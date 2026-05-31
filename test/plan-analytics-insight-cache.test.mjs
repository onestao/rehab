import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadPlanAnalytics() {
    const context = { window: {}, Date };
    context.globalThis = context;
    vm.createContext(context);
    const code = fs.readFileSync(new URL('../plan-analytics.js', import.meta.url), 'utf8');
    vm.runInContext(`${code}\nthis.__planAnalytics = planAnalytics;`, context);
    return context.__planAnalytics;
}

function loadAdvicePanel() {
    const context = {
        window: {},
        document: { querySelector: () => null, getElementById: () => null },
        localStorage: { getItem: () => null, setItem: () => {} },
        sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        requestAnimationFrame: (fn) => fn(),
        navigator: { maxTouchPoints: 0 },
        performance: { now: () => 0 }
    };
    context.window = { matchMedia: () => ({ matches: false, addEventListener: () => {} }), haptics: {} };
    context.globalThis = context;
    vm.createContext(context);
    const code = fs.readFileSync(new URL('../advice-panel.js', import.meta.url), 'utf8');
    vm.runInContext(`${code}\nthis.__advicePanel = advicePanel;`, context);
    return context.__advicePanel;
}

test('AI-classified unknown exercise labels are folded into training distribution', () => {
    const analytics = loadPlanAnalytics();
    const today = new Date().toISOString().slice(0, 10);
    const db = {
        health: {
            exerciseLogs: [
                { id: 'e1', date: today, type: 'custom', customName: 'Z-press machine', minutes: 20, deleted: false }
            ],
            trainingLabelClassifications: {
                'z-press machine': { label: 'Z-press machine', bucket: 'push', source: 'ai-insight' }
            }
        }
    };

    const out = analytics.pushPullRatio(db);

    assert.equal(out.summary, '推2');
    assert.equal(JSON.stringify(out.unknown), '[]');
});

test('insight cache keeps same-day AI suggestion until forced retry', () => {
    const panel = loadAdvicePanel();
    const data = {
        db: { health: {} },
        saveCalls: 0,
        save() { this.saveCalls += 1; },
        insightCacheKey: panel.insightCacheKey,
        getInsightCache: panel.getInsightCache,
        setInsightCache: panel.setInsightCache
    };
    const ctx = { planProgress: '1/3', planTitle: '今日计划', analysis: { pushPullRatio: '推1', unknownTrainingLabels: [] } };
    const key = data.insightCacheKey(ctx, '2026-05-31');

    data.setInsightCache(key, '2026-05-31', '<div>cached</div>', { text: 'cached' });

    assert.equal(data.getInsightCache(key, '2026-05-31').html, '<div>cached</div>');
    assert.equal(data.getInsightCache(key, '2026-06-01'), null);
    assert.equal(data.getInsightCache(`${key}:changed`, '2026-05-31'), null);
    assert.equal(data.saveCalls, 1);
});

test('training classification response parser extracts JSON and ignores invalid buckets', () => {
    const panel = loadAdvicePanel();
    const parsed = panel.parseTrainingClassificationResponse('```json\n{"advice":"今天保留轻量训练。","classifications":[{"label":"Z-press machine","bucket":"push"},{"label":"???","bucket":"unknown"}]}\n```');

    assert.equal(parsed.advice, '今天保留轻量训练。');
    assert.equal(JSON.stringify(parsed.classifications), JSON.stringify([{ label: 'Z-press machine', bucket: 'push' }]));
});
