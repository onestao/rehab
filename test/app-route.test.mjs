import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadRouteHarness() {
    const context = {
        URLSearchParams,
        window: {},
        document: {
            querySelector: () => ({ id: 'today' }),
            querySelectorAll: () => ([
                { id: 'nav-today' },
                { id: 'nav-workout' },
                { id: 'nav-records' },
                { id: 'nav-ai' },
                { id: 'nav-profile' }
            ])
        },
        history: {
            state: { navIndex: 0 },
            replaceState(state, _title, url) {
                this.state = state;
                context.window.location.hash = String(url || '').replace(/^[^#]*/, '');
            }
        }
    };
    context.window = {
        location: { hash: '' },
        addEventListener: () => {},
        data: {
            healthView: 'weight',
            routineView: 'library',
            adviceRange: 'all'
        },
        ui: {
            /** @type {Array<{ page: string, navId: string, options: any }>} */
            calls: [],
            async _activateTab(page, nav, options) {
                context.window.data._activePageId = page;
                this.calls.push({ page, navId: nav?.id, options });
            }
        }
    };
    context.globalThis = context;
    vm.createContext(context);
    const code = fs.readFileSync(new URL('../app-route.js', import.meta.url), 'utf8');
    vm.runInContext(code, context);
    return context;
}

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

test('appRoute parses GitHub Pages friendly hash routes', () => {
    const { window } = loadRouteHarness();
    const parse = window.appRoute.parseHash;

    assert.deepEqual(plain(parse('#/ai/advice?range=all')), { page: 'ai-coach', view: 'advice', adviceRange: 'all' });
    assert.deepEqual(plain(parse('#/records/calendar')), { page: 'records', healthView: 'calendar' });
    assert.deepEqual(plain(parse('#/profile/sync')), { page: 'profile', routineView: 'sync' });
    assert.deepEqual(plain(parse('#/me/library')), { page: 'profile', routineView: 'library' });
    assert.deepEqual(plain(parse('#/unknown')), { page: 'today' });
});

test('appRoute serializes app state without leaking default subroutes', () => {
    const { window } = loadRouteHarness();
    const serialize = window.appRoute.serializeRoute;

    assert.equal(serialize({ page: 'ai-coach', adviceRange: 'all' }), '/ai/advice?range=all');
    assert.equal(serialize({ page: 'ai-coach', adviceRange: 'today' }), '/ai/advice');
    assert.equal(serialize({ page: 'records', healthView: 'diet' }), '/records');
    assert.equal(serialize({ page: 'records', healthView: 'training' }), '/records/training');
    assert.equal(serialize({ page: 'profile', routineView: 'home' }), '/profile');
    assert.equal(serialize({ page: 'profile', routineView: 'sync' }), '/profile/sync');
});

test('appRoute applies deep links and restores subpage defaults', async () => {
    const { window } = loadRouteHarness();

    await window.appRoute.apply(window.appRoute.parseHash('#/profile'));
    assert.equal(window.data.routineView, 'home');
    assert.equal(window.location.hash, '#/profile');
    assert.deepEqual(plain(window.ui.calls.at(-1)), { page: 'profile', navId: 'nav-profile', options: { preserveSubroute: true } });

    await window.appRoute.apply(window.appRoute.parseHash('#/records/calendar'));
    assert.equal(window.data.healthView, 'calendar');
    assert.equal(window.location.hash, '#/records/calendar');
    assert.deepEqual(plain(window.ui.calls.at(-1)), { page: 'records', navId: 'nav-records', options: { preserveSubroute: true } });

    await window.appRoute.apply(window.appRoute.parseHash('#/ai/advice?range=all'));
    assert.equal(window.data.adviceRange, 'all');
    assert.equal(window.location.hash, '#/ai/advice?range=all');
    assert.deepEqual(plain(window.ui.calls.at(-1)), { page: 'ai-coach', navId: 'nav-ai', options: { preserveSubroute: true } });
});

test('appRoute syncFromState uses explicit active page during tab transitions', () => {
    const context = loadRouteHarness();
    const { window } = context;
    context.document.querySelector = () => ({ id: 'today' });

    window.data._activePageId = 'workout';
    window.appRoute.syncFromState();
    assert.equal(window.location.hash, '#/workout');

    window.data._activePageId = 'ai-coach';
    window.data.adviceRange = 'all';
    window.appRoute.syncFromState();
    assert.equal(window.location.hash, '#/ai/advice?range=all');
});

function deferred() {
    let release = () => {};
    const promise = new Promise(done => { release = () => done(undefined); });
    return { promise, resolve: release };
}

test('late completion from an older navigation cannot replace the latest page or hash', async () => {
    const context = loadRouteHarness();
    const { window } = context;
    const gates = {
        records: deferred(),
        'ai-coach': deferred()
    };
    let navigationToken = 0;
    window.ui = {
        beginNavigation() {
            navigationToken += 1;
            return navigationToken;
        },
        isCurrentNavigation(token) {
            return token === navigationToken;
        },
        async _activateTab(page, _nav, options) {
            await gates[page].promise;
            if (!this.isCurrentNavigation(options.navigationToken)) return false;
            window.data._activePageId = page;
            return true;
        }
    };

    const older = window.appRoute.apply(window.appRoute.parseHash('#/records/calendar'));
    const latest = window.appRoute.apply(window.appRoute.parseHash('#/ai/advice?range=all'));

    assert.ok(gates['ai-coach'].resolve);
    gates['ai-coach'].resolve();
    assert.equal(await latest, true);
    assert.equal(window.data._activePageId, 'ai-coach');
    assert.equal(window.location.hash, '#/ai/advice?range=all');

    assert.ok(gates.records.resolve);
    gates.records.resolve();
    assert.equal(await older, false);
    assert.equal(window.data._activePageId, 'ai-coach');
    assert.equal(window.location.hash, '#/ai/advice?range=all');
});

test('FIND-08: cancelled older navigation does not commit staged healthView', async () => {
    const context = loadRouteHarness();
    const { window } = context;
    const gates = {
        records: deferred(),
        'ai-coach': deferred()
    };
    let navigationToken = 0;
    window.data.healthView = 'diet';
    window.data.adviceRange = 'today';
    window.ui = {
        beginNavigation() {
            navigationToken += 1;
            return navigationToken;
        },
        isCurrentNavigation(token) {
            return token === navigationToken;
        },
        async _activateTab(page, _nav, options) {
            await gates[page].promise;
            if (!this.isCurrentNavigation(options.navigationToken)) return false;
            window.data._activePageId = page;
            return true;
        }
    };

    const older = window.appRoute.apply(window.appRoute.parseHash('#/records/calendar'));
    const latest = window.appRoute.apply(window.appRoute.parseHash('#/ai/advice?range=all'));
    gates['ai-coach'].resolve();
    assert.equal(await latest, true);
    assert.equal(window.data.adviceRange, 'all');
    // Older still pending — healthView must not already be calendar.
    assert.notEqual(window.data.healthView, 'calendar');
    gates.records.resolve();
    assert.equal(await older, false);
    assert.notEqual(window.data.healthView, 'calendar');
    assert.equal(window.data.adviceRange, 'all');
});

test('appRoute.apply updates navStack for deep-linked tabs and subroutes', async () => {
    const context = loadRouteHarness();
    const { window } = context;
    const calls = [];
    window.navStack = {
        stack: [{ type: 'tab', id: 'today' }],
        resetToRoot() {
            calls.push(['resetToRoot']);
            this.stack = [{ type: 'tab', id: 'today' }];
        },
        replaceTopOrPushTab(id) {
            calls.push(['replaceTopOrPushTab', id]);
            this.stack = [{ type: 'tab', id: 'today' }, { type: 'tab', id }];
        }
    };
    window.data.syncRoutineSubpageNav = (view) => {
        calls.push(['syncRoutineSubpageNav', view]);
        window.navStack.stack.push({ type: 'subtab', id: 'routine', view });
    };
    window.data.syncHealthSubtabNav = (view) => {
        calls.push(['syncHealthSubtabNav', view]);
    };
    window.ui = {
        beginNavigation() { return 1; },
        isCurrentNavigation() { return true; },
        async _activateTab(page) {
            window.data._activePageId = page;
            return true;
        }
    };

    await window.appRoute.apply(window.appRoute.parseHash('#/profile/library'));
    assert.equal(window.data._activePageId, 'profile');
    assert.equal(window.data.routineView, 'library');
    assert.deepEqual(calls, [
        ['replaceTopOrPushTab', 'profile'],
        ['syncRoutineSubpageNav', 'library']
    ]);
    assert.equal(window.navStack.stack.at(-1).type, 'subtab');

    calls.length = 0;
    await window.appRoute.apply(window.appRoute.parseHash('#/records/calendar'));
    assert.deepEqual(calls, [
        ['replaceTopOrPushTab', 'records'],
        ['syncHealthSubtabNav', 'calendar']
    ]);

    calls.length = 0;
    await window.appRoute.apply(window.appRoute.parseHash('#/today'));
    assert.deepEqual(calls, [['resetToRoot']]);
});
