import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadHealthWeightRuntime() {
    const code = readFileSync(new URL('../health-weight.js', import.meta.url), 'utf8');
    const context = { window: {}, console };
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(code, context);
    return context.window;
}

function loadHealthWeight() {
    return loadHealthWeightRuntime().dataHealthWeight;
}

function dateFromKey(value) {
    const text = String(value || '');
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return new Date(value);
}

function dateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

function buildHost(weights = [], extra = {}) {
    const api = loadHealthWeight();
    return {
        ...api,
        db: { health: { weights } },
        activeRecords(items = []) { return items.filter(item => item && !item.deleted); },
        dateFromKey,
        dateKey,
        parseHistoryDate: dateFromKey,
        logicalDateKey: () => '2026-06-30',
        escapeHtml,
        isCollapsed: () => true,
        ...extra
    };
}

test('weight module delegates modal opening to the eagerly loaded UI state', () => {
    const runtime = loadHealthWeightRuntime();
    let receiver = null;
    runtime.dataUiState = {
        openWeightModal() {
            receiver = this;
            return 'opened';
        }
    };
    const host = {
        ...runtime.dataHealthWeight,
        isMiScaleExperimentEnabled: () => false
    };

    assert.equal(host.openWeightModal(), 'opened');
    assert.equal(receiver, host);
});

test('weight chart defaults to weekly averages for year and monthly averages for all', () => {
    const data = buildHost();

    assert.equal(data.defaultWeightGranularity('week'), 'record');
    assert.equal(data.defaultWeightGranularity('month'), 'record');
    assert.equal(data.defaultWeightGranularity('year'), 'week');
    assert.equal(data.defaultWeightGranularity('all'), 'month');
    assert.equal(data.normalizeWeightGranularity('trend', 'year'), 'week');
    assert.equal(data.normalizeWeightGranularity('record', 'all'), 'month');
});

test('weekly weight aggregation averages records by calendar week', () => {
    const data = buildHost([
        { id: 'w1', date: '2026-06-01', weight: 80 },
        { id: 'w2', date: '2026-06-03', weight: 82 },
        { id: 'w3', date: '2026-06-08', weight: 79 }
    ]);

    const points = data.aggregateWeightPoints(data.sortedWeights(), 'week');

    assert.equal(points.length, 2);
    assert.equal(points[0].date, '2026-06-02');
    assert.equal(points[0].weight, 81);
    assert.equal(points[0].count, 2);
    assert.match(points[0].label, /2条均值/);
    assert.equal(points[1].weight, 79);
});

test('monthly weight aggregation averages records by month', () => {
    const data = buildHost([
        { id: 'w1', date: '2026-05-01', weight: 80 },
        { id: 'w2', date: '2026-05-20', weight: 78 },
        { id: 'w3', date: '2026-06-01', weight: 76 }
    ]);

    const points = data.aggregateWeightPoints(data.sortedWeights(), 'month');

    assert.equal(points.length, 2);
    assert.equal(points[0].axisLabel, '2026-05');
    assert.equal(points[0].weight, 79);
    assert.equal(points[1].axisLabel, '2026-06');
    assert.equal(points[1].weight, 76);
});

test('all-range trend card renders monthly average mode by default', () => {
    const data = buildHost([
        { id: 'w1', date: '2026-05-01', weight: 80 },
        { id: 'w2', date: '2026-05-20', weight: 78 },
        { id: 'w3', date: '2026-06-01', weight: 76 }
    ], { weightTrendRange: 'all', weightTrendGranularity: '' });

    const html = data.renderWeightTrendCard();

    assert.match(html, /月均 2 点 · 原始 3 条/);
    assert.match(html, /setWeightTrendGranularity\('record'\)/);
    assert.match(html, /setWeightTrendGranularity\('week'\)/);
    assert.match(html, /class="weight-range active" onclick="data\.setWeightTrendGranularity\('month'\)"/);
});
