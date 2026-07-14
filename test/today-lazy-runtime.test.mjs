import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function loadTodayRuntime() {
    const context = {
        console,
        window: {},
        module: { exports: {} },
        exports: {}
    };
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(readFileSync(new URL('../health-summary-pure.js', import.meta.url), 'utf8'), context);
    vm.runInContext(readFileSync(new URL('../history-view.js', import.meta.url), 'utf8'), context);
    vm.runInContext(readFileSync(new URL('../goal-plan.js', import.meta.url), 'utf8'), context);
    return context.window;
}

test('goal panel reads the latest weight without loading the weight editor module', () => {
    const runtime = loadTodayRuntime();
    const data = {
        ...runtime.dataGoalPlan,
        db: {
            history: [],
            health: {
                weights: [
                    { id: 'w1', date: '2026-07-09', weight: 80.1 },
                    { id: 'w2', date: '2026-07-11', weight: 78.5 },
                    { id: 'w3', date: '2026-07-12', weight: 77, deleted: true }
                ],
                profile: {},
                goalType: 'loss'
            }
        },
        logicalDateKey: () => '2026-07-11'
    };

    const html = data.renderWeightLossPanel();

    assert.match(html, /id="planCurrentWeight"[^>]*value="78\.5"/);
});

function dateFromKey(value) {
    const [year, month, day] = String(value).split('-').map(Number);
    return new Date(year, month - 1, day);
}

test('today overview renders accurate health totals without loading record feature modules', () => {
    const runtime = loadTodayRuntime();
    const data = {
        ...runtime.dataHistoryView,
        db: {
            history: [
                { id: 'h1', dayKey: '2026-07-11', cardio: { calories: 120 } },
                { id: 'h2', dayKey: '2026-07-11', cardio: { calories: 999 }, deleted: true }
            ],
            health: {
                weights: [
                    { id: 'w1', date: '2026-07-10', weight: 79.2 },
                    { id: 'w2', date: '2026-07-11', weight: 78.5 }
                ],
                foodLogs: [
                    { id: 'f1', date: '2026-07-11', cal: 450, pro: 35, carb: 50, fat: 12 },
                    { id: 'f2', date: '2026-07-11', cal: 200, pro: 10, carb: 25, fat: 6 },
                    { id: 'f3', date: '2026-07-11', cal: 999, deleted: true }
                ],
                exerciseLogs: [
                    { id: 'e1', date: '2026-07-11', calories: 80 },
                    { id: 'e2', date: '2026-07-10', calories: 500 }
                ],
                dietGoal: { dailyCal: 1800, proteinGoal: 100, carbGoal: 190, fatGoal: 60 }
            }
        },
        logicalDateKey: () => '2026-07-11',
        historyDayKey: record => record.dayKey,
        dateFromKey,
        ratio: (value, total) => total ? Math.round((Number(value) / Number(total)) * 100) : 0
    };

    const html = data.renderRecordOverview();

    assert.match(html, /体重 78\.50 kg/);
    assert.match(html, />650\/1800</);
    assert.match(html, />200</);
    assert.match(html, />45\/100</);
});

test('sync status timer stays inert until the lazy sync adapter is available', () => {
    const callbacks = [];
    const context = {
        console,
        data: { cfg: { mode: 'none' }, db: { syncMeta: {} } },
        document: { getElementById: () => null },
        localStorage: { getItem: () => null, setItem() {} },
        clearInterval() {},
        setInterval(callback) { callbacks.push(callback); return 1; },
        window: { addEventListener() {} }
    };
    context.globalThis = context;
    context.window.window = context.window;
    vm.createContext(context);
    vm.runInContext(readFileSync(new URL('../sync-status.js', import.meta.url), 'utf8'), context);

    context.window.syncStatus.init();

    assert.equal(callbacks.length, 1);
    assert.doesNotThrow(() => callbacks[0]());
});

function loadPlanUiRuntime() {
    const context = {
        console,
        window: {
            addEventListener() {}
        },
        document: {
            getElementById() { return null; },
            querySelector() { return null; },
            querySelectorAll() { return []; },
            addEventListener() {}
        },
        requestAnimationFrame(fn) {
            fn();
            return 1;
        },
        module: { exports: {} },
        exports: {}
    };
    context.globalThis = context;
    context.window.window = context.window;
    context.addEventListener = () => {};
    vm.createContext(context);
    vm.runInContext(readFileSync(new URL('../health-summary-pure.js', import.meta.url), 'utf8'), context);
    vm.runInContext(readFileSync(new URL('../data-views.js', import.meta.url), 'utf8'), context);
    vm.runInContext(readFileSync(new URL('../rehab-policy.js', import.meta.url), 'utf8'), context);
    vm.runInContext(readFileSync(new URL('../plan-ui.js', import.meta.url), 'utf8'), context);
    return { window: context.window, context };
}

function createTodayHost(api, options = {}) {
    const elements = {
        todayOverview: { innerHTML: '' },
        todayQuickActions: { innerHTML: '' },
        todayPlanStatus: { innerHTML: '' },
        todayDietStatus: { innerHTML: '' },
        todayTimeline: { innerHTML: '' },
        todayAiCard: { innerHTML: '' }
    };
    const document = {
        getElementById(id) {
            return elements[id] || null;
        },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        addEventListener() {},
        removeEventListener() {}
    };
    return {
        ...api,
        db: {
            history: options.history || [],
            health: {
                weights: options.weights || [],
                foodLogs: options.foodLogs || [],
                exerciseLogs: options.exerciseLogs || [],
                dietGoal: options.dietGoal || {
                    dailyCal: 1800,
                    proteinGoal: 100,
                    carbGoal: 190,
                    fatGoal: 60
                }
            },
            profile: options.profile || {}
        },
        selectedPlanId: '',
        getTodayDailyPlans() { return options.plans || []; },
        ensureTodayPlan() { return null; },
        aggregateCompletionRate() { return { done: 0, total: 0, rate: 0 }; },
        completionRate() { return { done: 0, total: 0, rate: 0 }; },
        planTypeMeta(type = 'rehab') {
            return { label: type, taskLabel: type, icon: 'fitness_center' };
        },
        logicalDateKey() { return options.today || '2026-07-11'; },
        dateKey() { return options.today || '2026-07-11'; },
        dateFromKey,
        historyDayKey(record) { return record?.dayKey || record?.date || ''; },
        activeRecords(list) {
            return (Array.isArray(list) ? list : []).filter((item) => item && !item.deleted);
        },
        sortedWeights() {
            return this.activeRecords(this.db.health.weights || []);
        },
        todayTrainingCalories() { return 0; },
        computeStreakDays() { return 0; },
        ensurePlanPrefs() { return { showWeeklyDock: false, showCooldownDock: true }; },
        pendingCooldownCount() { return 0; },
        escapeHtml(value) { return String(value ?? ''); },
        ratio(value, total) {
            return total ? Math.max(0, Math.min(100, Math.round((Number(value) / Number(total)) * 100))) : 0;
        },
        bindPlanQuickRepeat() {},
        updateTodayV6Greet() {},
        __document: document,
        __elements: elements
    };
}

test('today diet cards render 650 kcal without loading food-log or health-diet modules', () => {
    const { window: runtime, context } = loadPlanUiRuntime();
    assert.equal(runtime.dataHealthDiet, undefined);
    assert.equal(runtime.dataFoodLog, undefined);
    assert.equal(typeof runtime.todayCalories, 'undefined');
    assert.equal(typeof runtime.defaultDietGoals, 'undefined');

    const host = createTodayHost(runtime.dataPlanUi, {
        foodLogs: [
            { id: 'f1', date: '2026-07-11', cal: 450, pro: 35, carb: 50, fat: 12 },
            { id: 'f2', date: '2026-07-11', cal: 200, pro: 10, carb: 25, fat: 6 },
            { id: 'f3', date: '2026-07-11', cal: 999, pro: 99, carb: 99, fat: 99, deleted: true }
        ],
        weights: [
            { id: 'w1', date: '2026-07-10', weight: 79.2 },
            { id: 'w2', date: '2026-07-11', weight: 78.5 }
        ]
    });
    context.document = host.__document;
    host.renderTodayPage();

    const overview = host.__elements.todayOverview.innerHTML;
    const diet = host.__elements.todayDietStatus.innerHTML;

    assert.match(overview, />36%<\/b>/);
    assert.match(overview, /650\/1800/);
    assert.match(overview, /距目标还差 1150 千卡/);
    assert.match(diet, /饮食摄入/);
    assert.match(diet, />1150</);
    assert.match(diet, /650 \/ 1800/);
    assert.match(diet, />75g</);
    assert.match(diet, />45g</);
    assert.match(diet, />18g</);
    assert.doesNotMatch(overview, />0\/1800</);
    assert.doesNotMatch(diet, /999/);
});

test('renderTodayPage summarizes today health data exactly once and reuses the same summary object', () => {
    const { window: runtime, context } = loadPlanUiRuntime();
    let calls = 0;
    const marker = {
        __summaryId: 'today-summary-once',
        weight: { id: 'w2', date: '2026-07-11', weight: 78.5 },
        intake: 650,
        exerciseCal: 0,
        macros: { pro: 45, carb: 75, fat: 18 },
        goals: { cal: 1800, pro: 100, carb: 190, fat: 60 }
    };
    runtime.healthSummaryPure.summarizeToday = function () {
        calls += 1;
        return marker;
    };

    const host = createTodayHost(runtime.dataPlanUi, {
        foodLogs: [
            { id: 'f1', date: '2026-07-11', cal: 450, pro: 35, carb: 50, fat: 12 },
            { id: 'f2', date: '2026-07-11', cal: 200, pro: 10, carb: 25, fat: 6 }
        ]
    });
    context.document = host.__document;

    const seen = [];
    const originalSection = host.renderPlanTodaySection;
    const originalRing = host.renderPlanIntakeRing;
    const originalDiet = host.renderTodayV6DietCard;
    host.renderPlanTodaySection = function (summary) {
        seen.push(['hero', summary || this._ths]);
        return originalSection.call(this, summary);
    };
    host.renderPlanIntakeRing = function (summary) {
        seen.push(['ring', summary || this._ths]);
        return originalRing.call(this, summary);
    };
    host.renderTodayV6DietCard = function (summary) {
        seen.push(['diet', summary || this._ths]);
        return originalDiet.call(this, summary);
    };

    host.renderTodayPage();

    assert.equal(calls, 1);
    assert.equal(seen.length, 3);
    assert.equal(seen[0][1], marker);
    assert.equal(seen[1][1], marker);
    assert.equal(seen[2][1], marker);
    assert.equal(seen[0][1], seen[1][1]);
    assert.equal(seen[1][1], seen[2][1]);
    assert.match(host.__elements.todayOverview.innerHTML, /650\/1800/);
    assert.match(host.__elements.todayDietStatus.innerHTML, /650 \/ 1800/);
});

test('renderTodayPage still computes summary once when diet DOM sinks are missing', () => {
    const { window: runtime, context } = loadPlanUiRuntime();
    let calls = 0;
    runtime.healthSummaryPure.summarizeToday = function (...args) {
        calls += 1;
        return {
            weight: null,
            intake: 0,
            exerciseCal: 0,
            macros: { pro: 0, carb: 0, fat: 0 },
            goals: { cal: 1800, pro: 100, carb: 190, fat: 60 }
        };
    };

    const host = createTodayHost(runtime.dataPlanUi, {});
    context.document = {
        getElementById() { return null; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        addEventListener() {},
        removeEventListener() {}
    };
    host.renderTodayPage();
    assert.equal(calls, 1);
});

test('today diet render falls back safely when healthSummaryPure is unavailable', () => {
    const { window: runtime, context } = loadPlanUiRuntime();
    delete runtime.healthSummaryPure;

    const host = createTodayHost(runtime.dataPlanUi, {
        foodLogs: [{ id: 'f1', date: '2026-07-11', cal: 450, pro: 35, carb: 50, fat: 12 }]
    });
    // Incomplete adapter fallback should not throw on .toFixed
    host.todayCalories = () => 120;
    host.todayMacros = () => ({});
    host.defaultDietGoals = () => ({});
    context.document = host.__document;

    assert.doesNotThrow(() => host.renderTodayPage());
    assert.match(host.__elements.todayOverview.innerHTML, /120\/1800/);
    assert.match(host.__elements.todayDietStatus.innerHTML, /0g/);
});
