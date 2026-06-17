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
