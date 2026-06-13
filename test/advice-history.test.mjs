import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function loadAdvicePanel() {
    const code = readFileSync(path.join(process.cwd(), 'advice-panel.js'), 'utf8');
    const context = {
        console,
        window: {},
        performance: { now: () => 0 },
        document: {},
        requestAnimationFrame: () => {},
    };
    context.window.data = null;
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(`${code}\nthis.__advicePanel = advicePanel;`, context);
    return { panel: context.__advicePanel, context };
}

function buildHost(records = []) {
    const { panel, context } = loadAdvicePanel();
    const host = {
        db: { health: { aiAdviceChat: records } },
        activeRecords(items = []) { return items.filter(item => item && !item.deleted); },
        logicalDateKey(date = new Date('2026-06-12T00:00:00.000Z')) { return new Date(date).toISOString().slice(0, 10); },
        parseHistoryDate(value) { return new Date(value || '2026-06-12T00:00:00.000Z'); },
    };
    panel.attach(host);
    host.__context = context;
    return host;
}

test('searchAdviceWorkingSet finds archived-memory messages by content, date, and model', () => {
    const host = buildHost([
        { id: 'old', role: 'assistant', content: '膝盖疼痛建议', model: 'deepseek', at: '2026-06-01T08:00:00.000Z', updatedAt: 100 },
        { id: 'new', role: 'user', content: '今天吃了鸡胸肉', model: 'gpt', at: '2026-06-12T08:00:00.000Z', updatedAt: 300 },
        { id: 'deleted', role: 'assistant', content: '膝盖', at: '2026-06-13T08:00:00.000Z', updatedAt: 400, deleted: true },
    ]);

    assert.deepEqual(host.searchAdviceWorkingSet('鸡胸', 10).map(item => item.id), ['new']);
    assert.deepEqual(host.searchAdviceWorkingSet('2026-06-01', 10).map(item => item.id), ['old']);
    assert.deepEqual(host.searchAdviceWorkingSet('deepseek', 10).map(item => item.id), ['old']);
});

test('mergeAdviceSearchResults deduplicates cold and working-set results newest first', () => {
    const host = buildHost();
    const cold = [
        { id: 'a', content: 'same', updatedAt: 100 },
        { id: 'b', content: 'cold', updatedAt: 200 },
    ];
    const local = [
        { id: 'a', content: 'same newer duplicate ignored by id', updatedAt: 300 },
        { id: 'c', content: 'local', updatedAt: 250 },
    ];

    const merged = host.mergeAdviceSearchResults(cold, local, 10);

    assert.equal(JSON.stringify(merged.map(item => item.id)), JSON.stringify(['c', 'b', 'a']));
});

test('loadAdviceWindowFromColdStore expands the in-memory working set from IndexedDB page results', async () => {
    const host = buildHost([
        { id: 'm-58', content: 'recent 58', updatedAt: 58 },
        { id: 'm-59', content: 'recent 59', updatedAt: 59 },
    ]);
    const newestFirst = Array.from({ length: 60 }, (_, index) => ({
        id: `m-${59 - index}`,
        content: `message ${59 - index}`,
        updatedAt: 59 - index,
    }));
    host.advice = {
        workingSet: host.db.health.aiAdviceChat,
        count: async () => 60,
        getPage: async (_offset, limit) => newestFirst.slice(0, limit),
    };

    const loaded = await host.loadAdviceWindowFromColdStore(60);

    assert.equal(loaded.length, 60);
    assert.equal(host.db.health.aiAdviceChat[0].id, 'm-0');
    assert.equal(host.db.health.aiAdviceChat.at(-1).id, 'm-59');
});

test('renderAdvicePanel keeps search under the original icon and exposes all-history checkbox', () => {
    const host = buildHost();
    host.restoreAdviceDraft = () => '';
    host.escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    host.logicalDayStart = () => new Date('2026-06-12T00:00:00.000Z');
    host.todayMacros = () => ({ pro: 0, carb: 0, fat: 0 });
    host.sortedWeights = () => [];
    host.buildPlanAnalytics = () => ({ metrics: {} });
    host.diagnoseInsight = () => null;
    host.renderInsightHeader = () => '';
    host.renderInsightBaseline = () => '';
    host.planAiQuickPrompts = () => [];
    host.renderAdviceAttachmentChips = () => '';
    host.renderAdviceAttachmentInputs = () => '';
    host.renderAdviceAttachmentControls = () => '';
    host.renderAdviceModelChip = () => '';
    host.renderAdviceMessages = () => '';
    host.adviceSearchOpen = true;
    host.adviceRange = 'all';

    const html = host.renderAdvicePanel();

    assert.match(html, /advice-search-panel/);
    assert.match(html, /包含全部历史/);
    assert.match(html, /type="checkbox" checked/);
    assert.doesNotMatch(html, /advice-history-actions/);
    assert.doesNotMatch(html, />搜索<\/button>/);
    assert.doesNotMatch(html, />全部历史<\/button>/);
});

test('toggleAdviceHistorySearchScope maps the checkbox to the all-history range', () => {
    const host = buildHost();
    let rerenderOptions = null;
    let saved = 0;
    host.resetAdviceRenderWindow = () => { host._adviceRenderLimit = 80; };
    host.saveAdviceSettings = () => { saved++; };
    host.captureAdviceDraft = () => {};
    host.captureAdviceScroll = () => {};
    host.rerenderAdvicePanel = (options) => { rerenderOptions = options; };

    host.toggleAdviceHistorySearchScope(true);

    assert.equal(host.adviceRange, 'all');
    assert.equal(saved, 0);
    assert.equal(JSON.stringify(rerenderOptions), JSON.stringify({ expandChrome: true, focusSearch: true }));

    host.toggleAdviceHistorySearchScope(false);

    assert.equal(host.adviceRange, 'today');
});

test('all-history search scope is not persisted across startup', () => {
    const host = buildHost();
    let stored = '';
    host.__context.localStorage = {
        getItem() { return JSON.stringify({ range: 'all' }); },
        setItem(_key, value) { stored = value; }
    };
    host.adviceRange = 'week';

    host.loadAdviceSettings();

    assert.equal(host.adviceRange, 'today');

    host.adviceRange = 'all';
    host.saveAdviceSettings();

    assert.equal(JSON.parse(stored).range, 'today');
});

test('rerenderAdvicePanel refreshes messages after full-page v6 fallback render', async () => {
    const host = buildHost();
    let rendered = 0;
    let refreshed = 0;
    host._adviceMessageList = () => null;
    host.renderAiCoachPage = () => { rendered++; return true; };
    host.refreshAdviceSearchResults = () => { refreshed++; };
    host.__context.document.querySelector = () => null;
    host.__context.requestAnimationFrame = (fn) => { fn(); };

    host.rerenderAdvicePanel({ expandChrome: true, focusSearch: true });

    assert.equal(rendered, 1);
    assert.equal(refreshed, 1);
});

test('opening search refreshes all-history scope when it is already selected', () => {
    const host = buildHost();
    let refreshed = 0;
    host.adviceRange = 'all';
    host.adviceSearchOpen = false;
    host.captureAdviceDraft = () => {};
    host.captureAdviceScroll = () => {};
    host.rerenderAdvicePanel = () => {};
    host.refreshAdviceSearchResults = () => { refreshed++; };
    host.__context.requestAnimationFrame = (fn) => { fn(); };

    host.toggleAdviceSearch();

    assert.equal(host.adviceSearchOpen, true);
    assert.equal(refreshed, 1);
});
