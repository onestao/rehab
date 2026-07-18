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

test('data.js merges dataTodayViewCore before dataPlanUi so plan-ui cannot erase core first-paint methods before load', () => {
    const source = read('data.js');
    const modules = source.slice(source.indexOf('function dataModules'), source.indexOf('function mergeDataModules'));
    const coreIdx = modules.indexOf('dataTodayViewCore');
    const planIdx = modules.indexOf('dataPlanUi');
    assert.ok(coreIdx >= 0, 'dataTodayViewCore must be in dataModules()');
    assert.ok(planIdx > coreIdx, 'dataTodayViewCore must merge before dataPlanUi');
});
