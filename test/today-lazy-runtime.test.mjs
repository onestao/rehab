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
