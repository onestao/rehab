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
        closest(selector = '') {
            const expected = String(selector).match(/\[([^=\]]+)="([^"]+)"\]/);
            if (expected && attrs[expected[1]] !== expected[2]) return null;
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

test('weekly plan shows recent past and future days across natural week boundary', () => {
    const localDateKey = (date) => [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
    const data = {
        logicalDateKey() { return '2026-07-05'; },
        dateKey(date) {
            return localDateKey(date);
        },
        dateFromKey(value) {
            return new Date(`${value}T00:00:00`);
        },
        getDailyPlans(date) {
            if (date === '2026-07-03') {
                return [{ id: 'recent-plan', date, items: [{ id: 'task-past', name: 'Recent missed task', status: 'todo' }] }];
            }
            return date === '2026-07-06'
                ? [{ id: 'next-week-plan', date, items: [{ id: 'task-next', name: 'Next week task', status: 'todo' }] }]
                : [];
        },
        aggregateCompletionRate(plans) {
            return plans.length ? { done: 0, total: 1, rate: 0 } : { done: 0, total: 0, rate: 0 };
        },
        escapeHtml,
        handlePlanTaskTap() {},
        openPlanTaskMenu() {}
    };
    const { api } = loadWindowModule('plan-weekly.js', 'window.planWeekly', { data });

    const range = api.range();

    assert.deepEqual(JSON.parse(JSON.stringify(range.map((item) => item.key))), [
        '2026-07-02',
        '2026-07-03',
        '2026-07-04',
        '2026-07-05',
        '2026-07-06',
        '2026-07-07',
        '2026-07-08',
        '2026-07-09',
        '2026-07-10',
        '2026-07-11',
        '2026-07-12'
    ]);
    api.selectedDate = '2026-07-03';
    assert.match(api.render(), /Recent missed task/);
    api.selectedDate = '2026-07-06';
    assert.match(api.render(), /Next week task/);
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
        normalizeProvider(provider = '') { return String(provider || '').trim() || 'openai'; },
        isModelEnabled(model) { return model?.enabled !== false; },
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

test('model picker aggregates only enabled cached models by provider scope', () => {
    const ai = {
        cfg: {
            provider: 'openai',
            profiles: [
                { id: 'p-openai', provider: 'openai' },
                { id: 'p-claude', provider: 'claude' }
            ]
        },
        models: [
            { provider: 'openai', id: 'hidden-openai', enabled: false },
            { provider: 'openai', id: 'enabled-openai', enabled: true },
            { provider: 'claude', id: 'enabled-claude', enabled: true }
        ],
        normalizeProvider(provider = '') { return String(provider || '').trim() || 'openai'; },
        isModelEnabled(model) { return model?.enabled !== false; },
        getEffectiveConfig() { return { profileId: 'p-openai', provider: 'openai', model: 'enabled-openai' }; },
        apiKeyFor(id) { return id ? 'key' : ''; }
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

    api.adviceModelPickerScope = 'cached';
    const cachedHtml = api.renderAdviceModelPicker();
    assert.match(cachedHtml, /enabled-openai/);
    assert.match(cachedHtml, /enabled-claude/);
    assert.doesNotMatch(cachedHtml, /hidden-openai/);

    api.adviceModelPickerScope = 'others';
    const othersHtml = api.renderAdviceModelPicker();
    assert.doesNotMatch(othersHtml, /enabled-openai/);
    assert.match(othersHtml, /enabled-claude/);
});

test('model picker stars models and sorts starred rows first', () => {
    const stored = {};
    const ai = {
        cfg: {
            provider: 'openai',
            profiles: [
                { id: 'p-openai', provider: 'openai' },
                { id: 'p-claude', provider: 'claude' }
            ]
        },
        models: [
            { provider: 'openai', id: 'openai-model', enabled: true },
            { provider: 'claude', id: 'claude-model', enabled: true }
        ],
        normalizeProvider(provider = '') { return String(provider || '').trim() || 'openai'; },
        isModelEnabled(model) { return model?.enabled !== false; },
        getEffectiveConfig() { return { profileId: 'p-openai', provider: 'openai', model: 'openai-model' }; },
        apiKeyFor(id) { return id ? 'key' : ''; }
    };
    const { api } = loadWindowModule('advice-panel.js', 'advicePanel', {
        ai,
        document: { querySelector: () => null, getElementById: () => null },
        localStorage: { getItem: () => null, setItem: (key, value) => { stored[key] = value; } },
        requestAnimationFrame: () => {},
        window: { haptics: { light() {} } }
    });
    api.db = { aiTemplateActiveId: '', aiRetryMode: 'versioned' };
    api.escapeHtml = escapeHtml;
    api.adviceModelVisual = () => ({ key: 'generic' });
    api.adviceModelThemeStyle = () => '';
    api.adviceModelIconHtml = () => '';
    api.adviceModelPickerScope = 'cached';
    api.adviceStarredModels = ['claude::claude-model'];

    const html = api.renderAdviceModelPicker();
    assert.ok(html.indexOf('claude-model') < html.indexOf('openai-model'));
    assert.match(html, /data-advice-model-action="star"/);
    assert.match(html, /star/);

    api.adviceStarredModels = [];
    api.toggleAdviceModelStar('openai', 'openai-model');
    assert.equal(api.adviceStarredModels.includes('openai::openai-model'), true);
    assert.equal(stored.rehab_advice_settings.includes('openai::openai-model'), true);

    const root = fakeRoot();
    let starred = null;
    let chosen = null;
    api.toggleAdviceModelStar = (provider, model) => { starred = { provider, model }; };
    api.chooseAdviceModel = (profileId, provider, model) => { chosen = { profileId, provider, model }; };
    api.bindAdviceModelPickerActions(root);
    const listener = root.listener;
    assert.ok(listener);

    const event = fakeEvent({
        'data-advice-model-action': 'star',
        'data-provider': 'openai',
        'data-model': 'openai-model'
    });
    listener(event);

    assert.deepEqual(starred, { provider: 'openai', model: 'openai-model' });
    assert.equal(chosen, null);
    assert.equal(event.prevented, true);
    assert.equal(event.stopped, true);
});

test('app update version matches current service worker cache version', () => {
    const { api } = loadWindowModule('app-update.js', 'appUpdate', { navigator: {}, window: {} });
    const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
    const swVersion = sw.match(/training-assistant-v(\d+)/);

    assert.ok(swVersion);
    assert.equal(api.version, swVersion[1]);
});
