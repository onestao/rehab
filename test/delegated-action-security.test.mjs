import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function loadWindowModule(filename, exportExpr, extra = {}) {
    const code = readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8');
    /** @type {any} */
    const context = { window: {}, console, ...extra };
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(`${code}\nthis.__loaded = ${exportExpr};`, context);
    return { api: context.__loaded, context };
}

function fakeRoot() {
    /** @type {{ dataset: Record<string, string>, listener: null | ((event: any) => void), addEventListener: (type: string, fn: (event: any) => void) => void, contains: () => boolean }} */
    const root = {
        dataset: {},
        listener: null,
        addEventListener(_type, fn) { this.listener = fn; },
        contains() { return true; }
    };
    return root;
}

function fakeEvent(attrs) {
    const target = {
        closest() {
            return {
                getAttribute(name) { return attrs[name] ?? ''; }
            };
        }
    };
    return {
        target,
        prevented: false,
        stopped: false,
        preventDefault() { this.prevented = true; },
        stopPropagation() { this.stopped = true; }
    };
}

test('routine library delegates untrusted tags and routine ids instead of inline JS', () => {
    const { api } = loadWindowModule('routine-library.js', 'window.dataRoutineLibrary');
    const malicious = `x');globalThis.pwned=1;//`;
    const ctx = {
        ...api,
        db: {
            actions: [{ id: 'a1', tags: [malicious] }],
            routines: [{ id: malicious, name: 'Routine', tags: [malicious], actions: [{ name: 'Move' }] }],
            libraryFilterTag: malicious
        },
        escapeHtml,
        activeRecords(list) { return list || []; },
        isCollapsed() { return false; }
    };

    const html = api.renderRoutineLibraryPane.call(ctx);

    assert.doesNotMatch(html, /setLibraryFilterTag\('/);
    assert.doesNotMatch(html, /toggleCollapse\('routine_lib_/);
    assert.doesNotMatch(html, /moveRoutineAction\('/);
    assert.match(html, /data-library-tag="x&#39;\);globalThis\.pwned=1;\/\//);
    assert.match(html, /data-routine-id="x&#39;\);globalThis\.pwned=1;\/\//);

    const root = fakeRoot();
    let received = '';
    api.bindLibraryActions.call({ ...ctx, setLibraryFilterTag(value) { received = value; } }, root);
    const event = fakeEvent({ 'data-rl-action': 'set-library-tag', 'data-library-tag': malicious });

    const listener = root.listener;
    assert.ok(listener);
    listener(event);

    assert.equal(received, malicious);
    assert.equal(event.prevented, true);
});

test('weekly plan delegates untrusted plan and task ids instead of inline JS', () => {
    const calls = [];
    const data = {
        dateKey() { return '2026-06-01'; },
        getDailyPlans() {
            return [{
                id: `plan');globalThis.pwned=1;//`,
                date: '2026-06-01',
                items: [{ id: `task');globalThis.pwned=1;//`, name: 'Task', status: 'todo' }]
            }];
        },
        aggregateCompletionRate() { return { done: 0, total: 1, rate: 0 }; },
        escapeHtml,
        handlePlanTaskTap(planId, taskId) { calls.push(['tap', planId, taskId]); },
        openPlanTaskMenu(planId, taskId) { calls.push(['menu', planId, taskId]); }
    };
    const { api } = loadWindowModule('plan-weekly.js', 'window.planWeekly', { data });

    const html = api.render();

    assert.doesNotMatch(html, /handlePlanTaskTap\('/);
    assert.doesNotMatch(html, /openPlanTaskMenu\('/);
    assert.match(html, /data-plan-id="plan&#39;\);globalThis\.pwned=1;\/\//);
    assert.match(html, /data-task-id="task&#39;\);globalThis\.pwned=1;\/\//);

    const root = fakeRoot();
    api.bindActions(root);
    const listener = root.listener;
    assert.ok(listener);
    listener(fakeEvent({
        'data-plan-weekly-action': 'task-menu',
        'data-plan-id': `plan');globalThis.pwned=1;//`,
        'data-task-id': `task');globalThis.pwned=1;//`
    }));

    assert.deepEqual(calls, [['menu', `plan');globalThis.pwned=1;//`, `task');globalThis.pwned=1;//`]]);
});

test('template manager delegates untrusted template ids instead of inline JS', () => {
    const { api } = loadWindowModule('advice-template-manager.js', 'window.adviceTemplateManager');
    const malicious = `tpl');globalThis.pwned=1;//`;
    const ctx = {
        ...api,
        db: { aiTemplateActiveId: malicious, aiTemplates: [{ id: malicious, name: 'Template', scenario: 'Any' }] },
        escapeHtml
    };

    const html = api.renderTemplateManagerAdvanced.call(ctx);

    assert.doesNotMatch(html, /selectAdviceTemplate\('tpl/);
    assert.doesNotMatch(html, /editTemplateById\('tpl/);
    assert.doesNotMatch(html, /deleteTemplateById\('tpl/);
    assert.match(html, /data-template-id="tpl&#39;\);globalThis\.pwned=1;\/\//);

    const root = fakeRoot();
    let edited = '';
    api.bindTemplateManagerActions.call({ ...ctx, editTemplateById(id) { edited = id; } }, root);
    const event = fakeEvent({ 'data-template-action': 'edit', 'data-template-id': malicious });

    const listener = root.listener;
    assert.ok(listener);
    listener(event);

    assert.equal(edited, malicious);
    assert.equal(event.stopped, true);
});

test('model picker delegates untrusted model metadata instead of inline JS', () => {
    const ai = {
        cfg: { provider: 'openai', profiles: [{ id: `profile');globalThis.pwned=1;//`, provider: 'openai', key: 'set' }] },
        models: [{ provider: 'openai', id: `model');globalThis.pwned=1;//`, displayName: 'Model' }],
        getEffectiveConfig() { return { profileId: `profile');globalThis.pwned=1;//`, provider: 'openai', model: 'base' }; },
        apiKeyFor() { return 'key'; }
    };
    const { api } = loadWindowModule('advice-panel.js', 'advicePanel', {
        ai,
        document: { querySelector: () => null, getElementById: () => null },
        localStorage: { getItem: () => null, setItem: () => {} },
        requestAnimationFrame: () => {}
    });
    api.escapeHtml = escapeHtml;
    api.adviceModelVisual = () => ({ key: 'generic' });
    api.adviceModelThemeStyle = () => '';
    api.adviceModelIconHtml = () => '';

    const html = api.renderAdviceModelPicker();

    assert.doesNotMatch(html, /chooseAdviceModel\('/);
    assert.match(html, /data-profile-id="profile&#39;\);globalThis\.pwned=1;\/\//);
    assert.match(html, /data-model="model&#39;\);globalThis\.pwned=1;\/\//);

    const root = fakeRoot();
    let chosen = null;
    api.chooseAdviceModel = (profileId, provider, model) => { chosen = { profileId, provider, model }; };
    api.bindAdviceModelPickerActions(root);
    const listener = root.listener;
    assert.ok(listener);
    listener(fakeEvent({
        'data-advice-model-action': 'choose',
        'data-profile-id': `profile');globalThis.pwned=1;//`,
        'data-provider': 'openai',
        'data-model': `model');globalThis.pwned=1;//`
    }));

    assert.deepEqual(chosen, {
        profileId: `profile');globalThis.pwned=1;//`,
        provider: 'openai',
        model: `model');globalThis.pwned=1;//`
    });
});

test('app update version matches current service worker cache version', () => {
    const { api } = loadWindowModule('app-update.js', 'appUpdate', { navigator: {}, window: {} });

    assert.equal(api.version, '240');
});
