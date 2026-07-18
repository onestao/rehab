import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

function read(file) {
    return readFileSync(path.join(process.cwd(), file), 'utf8');
}

function loadTodayViewCore(extra = {}) {
    const context = {
        console,
        window: {
            addEventListener() {},
            removeEventListener() {},
            ...extra.window
        },
        document: {
            getElementById() { return null; },
            querySelector() { return null; },
            querySelectorAll() { return []; },
            addEventListener() {},
            removeEventListener() {},
            ...extra.document
        }
    };
    context.globalThis = context;
    context.window.window = context.window;
    context.window.document = context.document;
    context.document.defaultView = context.window;
    if (extra.healthSummaryPure) context.window.healthSummaryPure = extra.healthSummaryPure;
    vm.createContext(context);
    vm.runInContext(read('health-summary-pure.js'), context);
    vm.runInContext(read('today-view-core.js'), context);
    return context;
}

test('today-view-core module exists and is registered as a first-paint today dependency', () => {
    assert.equal(existsSync(path.join(process.cwd(), 'today-view-core.js')), true, 'today-view-core.js must exist');
    const html = read('index.html');
    const todayDeps = html.match(/today:\s*\[([^\]]*)\]/)?.[1] || '';
    assert.match(todayDeps, /'history-view'/);
    assert.match(todayDeps, /'today-view-core'/);
    assert.doesNotMatch(todayDeps, /'plan-ui'/);
});

test('today-view-core never populates dataPlanUi or attaches global listeners', () => {
    const source = read('today-view-core.js');
    assert.doesNotMatch(source, /window\.dataPlanUi|dataPlanUi\s*=/);
    assert.doesNotMatch(source, /addEventListener\s*\(/);
    assert.doesNotMatch(source, /ensureTodayPlan/);
    assert.doesNotMatch(source, /createDailyPlan|saveData\s*\(|db\.dailyPlans\s*=/);
    assert.match(source, /window\.dataTodayViewCore/);
    const context = loadTodayViewCore();
    assert.equal(context.window.dataPlanUi, undefined);
});

test('first paint with only today-view-core produces V6 hero and never legacy record-overview-card', () => {
    const context = loadTodayViewCore();
    assert.equal(context.window.dataPlanUi, undefined);
    assert.ok(context.window.dataTodayViewCore);
    assert.equal(typeof context.window.dataTodayViewCore.renderPlanTodaySection, 'function');

    const host = {
        ...context.window.dataTodayViewCore,
        db: {
            dailyPlans: [],
            prefs: {},
            history: [],
            health: {
                weights: [{ id: 'w1', date: '2026-07-11', weight: 78.5 }],
                foodLogs: [
                    { id: 'f1', date: '2026-07-11', cal: 450, pro: 35, carb: 50, fat: 12 },
                    { id: 'f2', date: '2026-07-11', cal: 200, pro: 10, carb: 25, fat: 6 }
                ],
                exerciseLogs: [],
                dietGoal: { dailyCal: 1800, proteinGoal: 100, carbGoal: 190, fatGoal: 60 }
            },
            profile: { name: 'Tester' }
        },
        selectedPlanId: '',
        logicalDateKey: () => '2026-07-11',
        dateKey: () => '2026-07-11',
        historyDayKey: (r) => r?.dayKey || r?.date || '',
        activeRecords: (list) => (Array.isArray(list) ? list : []).filter((item) => item && !item.deleted),
        sortedWeights() { return this.activeRecords(this.db.health.weights || []); },
        todayTrainingCalories: () => 0,
        computeStreakDays: () => 0,
        escapeHtml: (v) => String(v ?? ''),
        ratio: (value, total) => (total ? Math.max(0, Math.min(100, Math.round((Number(value) / Number(total)) * 100))) : 0)
    };

    const overview = host.renderPlanTodaySection();
    const dock = host.renderTodayActionDock();
    const plan = host.renderTodayV6PlanCard();
    const diet = host.renderTodayV6DietCard();

    assert.match(overview, /class="hero"/);
    assert.doesNotMatch(overview, /record-overview-card/);
    assert.doesNotMatch(overview, /md-card hero-card/);
    assert.match(overview, /今日概览/);
    assert.match(dock, /记体重[\s\S]*记饮食[\s\S]*记运动[\s\S]*问 AI/);
    assert.match(plan, /当前训练计划|今天还没有训练计划/);
    assert.match(diet, /饮食摄入/);
    assert.equal(host.db.dailyPlans.length, 0, 'core must not create plans on first paint');
});

test('data-views Today first paint does not fall back to legacy record overview', () => {
    const source = read('data-views.js');
    const renderToday = source.slice(
        source.indexOf('renderTodayPage()'),
        source.indexOf('renderDietPage()')
    );
    assert.doesNotMatch(renderToday, /renderRecordOverview/);
    assert.doesNotMatch(renderToday, /renderRecordQuickActions/);
    assert.match(renderToday, /renderPlanTodaySection/);
    assert.match(renderToday, /renderTodayActionDock/);
});

test('today enhancement loads plan-ui without a full data.render(today) generation switch', () => {
    const html = read('index.html');
    const block = html.slice(
        html.indexOf('function scheduleTodayEnhancementLoad'),
        html.indexOf('function bootPerfDebugEnabled')
    );
    assert.match(block, /loadScript\('plan-ui'\)/);
    assert.match(block, /refreshModules/);
    assert.match(block, /enhanceTodayPage|data\.enhanceTodayPage/);
    assert.doesNotMatch(block, /data\.render\?\.\('today'\)|data\.render\(['"]today['"]\)/);
});

test('data.js merges dataTodayViewCore before dataPlanUi', () => {
    const source = read('data.js');
    const modules = source.slice(source.indexOf('function dataModules'), source.indexOf('function mergeDataModules'));
    const coreIdx = modules.indexOf('dataTodayViewCore');
    const planIdx = modules.indexOf('dataPlanUi');
    assert.ok(coreIdx >= 0, 'dataTodayViewCore must be in dataModules()');
    assert.ok(planIdx > coreIdx, 'dataTodayViewCore must merge before dataPlanUi');
});

const FIRST_PAINT_RENDERERS = [
    'renderPlanTodaySection',
    'renderTodayV6PlanCard',
    'renderTodayV6DietCard',
    'renderTodayActionDock',
    'renderPlanIntakeRing',
    'updateTodayV6Greet'
];

test('plan-ui does not define first-paint V6 renderers (core is sole owner)', () => {
    const source = read('plan-ui.js');
    for (const name of FIRST_PAINT_RENDERERS) {
        assert.doesNotMatch(
            source,
            new RegExp(`^\\s*${name}\\s*\\(`, 'm'),
            `plan-ui must not define ${name}`
        );
    }
    assert.match(source, /enhanceTodayPage\s*\(/);
    assert.match(source, /selectTodayPlan\s*\(/);
    assert.match(source, /renderTodayAiReminder\s*\(/);
    assert.doesNotMatch(source, /ensureTodayPlan/);
});

test('first-paint renderer identity stays on core after plan-ui loads and refreshModules', () => {
    const context = loadTodayViewCore();
    const core = context.window.dataTodayViewCore;
    assert.ok(core);

    // Simulate data bag after first paint (core merged in).
    const data = {
        ...core,
        db: { dailyPlans: [], prefs: {}, history: [], health: { weights: [], foodLogs: [], exerciseLogs: [], dietGoal: {} }, profile: {} },
        selectedPlanId: '',
        logicalDateKey: () => '2026-07-11',
        dateKey: () => '2026-07-11',
        activeRecords: (list) => (Array.isArray(list) ? list : []).filter((item) => item && !item.deleted),
        escapeHtml: (v) => String(v ?? ''),
        ratio: () => 0,
        refreshModules() {
            Object.assign(this, context.window.dataTodayViewCore || {}, context.window.dataPlanUi || {});
        }
    };
    context.window.data = data;

    const before = Object.fromEntries(FIRST_PAINT_RENDERERS.map((name) => [name, data[name]]));
    for (const name of FIRST_PAINT_RENDERERS) {
        assert.equal(typeof before[name], 'function', `${name} must exist from core before plan-ui`);
        assert.equal(before[name], core[name], `${name} must be the core function`);
    }

    // Load plan-ui into the same sandbox (defines dataPlanUi without first-paint renderers).
    vm.runInContext(read('plan-ui.js'), context);
    assert.ok(context.window.dataPlanUi);
    assert.equal(typeof context.window.dataPlanUi.enhanceTodayPage, 'function');
    for (const name of FIRST_PAINT_RENDERERS) {
        assert.equal(context.window.dataPlanUi[name], undefined, `dataPlanUi must not export ${name}`);
    }

    data.refreshModules();

    for (const name of FIRST_PAINT_RENDERERS) {
        assert.equal(data[name], before[name], `${name} identity must survive plan-ui + refreshModules`);
        assert.equal(data[name], core[name], `${name} must remain the core implementation`);
    }
    // enhanceTodayPage is intentionally replaced by plan-ui's local enhance.
    assert.equal(data.enhanceTodayPage, context.window.dataPlanUi.enhanceTodayPage);
});

test('full lifecycle: core first paint, plan-ui enhance, re-render stay V6 without ensureTodayPlan or legacy', () => {
    const slots = {
        todayOverview: { innerHTML: '', dataset: {}, removeAttribute() {} },
        todayQuickActions: { innerHTML: '', dataset: {}, removeAttribute() {} },
        todayPlanStatus: { innerHTML: '', dataset: {}, removeAttribute() {} },
        todayDietStatus: { innerHTML: '', dataset: {}, removeAttribute() {} },
        todayTimeline: { innerHTML: '', dataset: {}, removeAttribute() {} },
        todayAiCard: { innerHTML: '', dataset: {}, removeAttribute() {} }
    };
    let ensureCount = 0;
    let legacyCount = 0;
    let overviewWrites = 0;
    let planWrites = 0;
    let dietWrites = 0;
    let listenerCount = 0;

    Object.defineProperty(slots.todayOverview, 'innerHTML', {
        get() { return this._html || ''; },
        set(v) { overviewWrites += 1; this._html = String(v); }
    });
    Object.defineProperty(slots.todayPlanStatus, 'innerHTML', {
        get() { return this._html || ''; },
        set(v) { planWrites += 1; this._html = String(v); }
    });
    Object.defineProperty(slots.todayDietStatus, 'innerHTML', {
        get() { return this._html || ''; },
        set(v) { dietWrites += 1; this._html = String(v); }
    });

    const context = {
        console,
        window: {
            addEventListener() { listenerCount += 1; },
            removeEventListener() {}
        },
        document: {
            readyState: 'complete',
            getElementById(id) { return slots[id] || null; },
            querySelector(sel) {
                if (sel === '.page.active') return { id: 'today' };
                if (sel === '.today-v6-greet-line' || sel === '.today-v6-greet-sub') return { textContent: '' };
                return null;
            },
            querySelectorAll() { return []; },
            addEventListener() { listenerCount += 1; },
            removeEventListener() {}
        }
    };
    context.globalThis = context;
    context.window.window = context.window;
    context.window.document = context.document;
    context.document.defaultView = context.window;
    vm.createContext(context);
    vm.runInContext(read('health-summary-pure.js'), context);
    vm.runInContext(read('data-views.js'), context);
    vm.runInContext(read('today-view-core.js'), context);

    const core = context.window.dataTodayViewCore;
    const data = {
        ...core,
        db: {
            dailyPlans: [],
            prefs: {},
            history: [],
            health: { weights: [], foodLogs: [], exerciseLogs: [], dietGoal: { dailyCal: 1800 } },
            profile: { name: 'Tester' }
        },
        selectedPlanId: '',
        logicalDateKey: () => '2026-07-11',
        dateKey: () => '2026-07-11',
        historyDayKey: (r) => r?.dayKey || r?.date || '',
        activeRecords: (list) => (Array.isArray(list) ? list : []).filter((item) => item && !item.deleted),
        sortedWeights() { return this.activeRecords(this.db.health.weights || []); },
        todayTrainingCalories: () => 0,
        computeStreakDays: () => 0,
        escapeHtml: (v) => String(v ?? ''),
        ratio: (value, total) => (total ? Math.max(0, Math.min(100, Math.round((Number(value) / Number(total)) * 100))) : 0),
        ensureTodayPlan() { ensureCount += 1; return null; },
        renderRecordOverview() { legacyCount += 1; return '<div class="record-overview-card">legacy</div>'; },
        renderTodayTimeline() { return '<div class="timeline">timeline-ready</div>'; },
        renderTodayAiReminder() { return '<div class="ai">ai-ready</div>'; },
        bindPlanQuickRepeat() {
            if (this._planQuickRepeatBound) return;
            this._planQuickRepeatBound = true;
            this._bound = (this._bound || 0) + 1;
        }
    };
    const ensureStub = () => { ensureCount += 1; return null; };
    const legacyStub = () => { legacyCount += 1; return '<div class="record-overview-card">legacy</div>'; };
    const bindStub = function bindPlanQuickRepeat() {
        if (this._planQuickRepeatBound) return;
        this._planQuickRepeatBound = true;
        this._bound = (this._bound || 0) + 1;
    };
    data.ensureTodayPlan = ensureStub;
    data.renderRecordOverview = legacyStub;
    data.bindPlanQuickRepeat = bindStub;
    data.refreshModules = function refreshModules() {
        Object.assign(this, context.window.dataTodayViewCore || {}, context.window.dataPlanUi || {});
        this.ensureTodayPlan = ensureStub;
        this.renderRecordOverview = legacyStub;
        this.renderTodayTimeline = () => '<div class="timeline">timeline-ready</div>';
        this.bindPlanQuickRepeat = bindStub;
    };

    context.window.data = data;
    context.window.dataViews.renderTodayPage.call(data);

    assert.match(slots.todayOverview.innerHTML, /class="hero"/);
    assert.doesNotMatch(slots.todayOverview.innerHTML, /record-overview-card/);
    assert.equal(ensureCount, 0);
    assert.equal(legacyCount, 0);
    assert.equal(data.db.dailyPlans.length, 0);
    const heroAfterFirst = slots.todayOverview.innerHTML;
    const writesAfterFirst = { overview: overviewWrites, plan: planWrites, diet: dietWrites };

    // Load plan-ui and enhance (no full generation switch).
    vm.runInContext(read('plan-ui.js'), context);
    data.refreshModules();
    assert.equal(data.renderPlanTodaySection, core.renderPlanTodaySection);
    assert.equal(typeof data.enhanceTodayPage, 'function');
    assert.notEqual(data.enhanceTodayPage, core.enhanceTodayPage);

    data.enhanceTodayPage();
    data.enhanceTodayPage(); // idempotent

    assert.equal(ensureCount, 0, 'enhance must not call ensureTodayPlan');
    assert.equal(legacyCount, 0);
    assert.equal(data.db.dailyPlans.length, 0);
    assert.equal(slots.todayOverview.innerHTML, heroAfterFirst, 'enhance must not rewrite hero');
    assert.equal(overviewWrites, writesAfterFirst.overview, 'enhance must not rewrite overview slot');
    assert.equal(planWrites, writesAfterFirst.plan, 'enhance must not rewrite plan slot');
    assert.equal(dietWrites, writesAfterFirst.diet, 'enhance must not rewrite diet slot');
    assert.match(slots.todayTimeline.innerHTML, /timeline-ready/);
    assert.match(slots.todayAiCard.innerHTML, /ai-ready|今日 AI|AI 建议|psychology/);
    assert.equal(data._bound, 1, 'bindPlanQuickRepeat must be idempotent across double enhance');

    // Normal re-render after enhancement still uses core V6 path.
    context.window.dataViews.renderTodayPage.call(data);
    assert.match(slots.todayOverview.innerHTML, /class="hero"/);
    assert.doesNotMatch(slots.todayOverview.innerHTML, /record-overview-card/);
    assert.equal(ensureCount, 0, 're-render must not call ensureTodayPlan');
    assert.equal(legacyCount, 0);
    assert.equal(data.db.dailyPlans.length, 0);
    assert.equal(data.renderPlanTodaySection, core.renderPlanTodaySection);
});
