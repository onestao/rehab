import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWeeklyMetrics } from '../report-metrics-pure.js';

// 2026-07-22 是周三，对应周一为 2026-07-20，覆盖 20..26。
const ANCHOR = '2026-07-22';

function dbWithLogs(exerciseLogs) {
    return { health: { exerciseLogs, weights: [], foodLogs: [] }, history: [] };
}

function log(overrides) {
    return { date: '2026-07-21', minutes: 30, deleted: false, ...overrides };
}

test('拉伸与无 MET 自定义记录不再计入有氧场次', () => {
    const report = buildWeeklyMetrics(dbWithLogs([
        log({ type: 'walk', met: 3.5 }),
        log({ type: 'custom', customName: '椭圆机', met: 5, minutes: 20 }),
        log({ type: 'custom', customName: '泡沫轴放松', met: 0, minutes: 15 }),
        log({ type: 'stretch', minutes: 10 }),
        log({ type: 'strength', sets: 3, repsPerSet: 10, weightKg: 20, minutes: 12 })
    ]), ANCHOR);

    assert.equal(report.metrics.cardio.sessions, 2);
    assert.equal(report.metrics.cardio.totalMinutes, 50);
    assert.equal(report.metrics.training.sessions, 1);
    assert.equal(report.metrics.training.totalVolume, 3 * 10 * 20);
});

test('历史 met 字段缺失的内置有氧类型仍按有氧统计', () => {
    const report = buildWeeklyMetrics(dbWithLogs([
        log({ type: 'jog' }),
        log({ type: 'custom', customName: '不明运动' })
    ]), ANCHOR);

    assert.equal(report.metrics.cardio.sessions, 1);
    assert.equal(report.metrics.cardio.totalMinutes, 30);
});

test('删除的记录不参与有氧统计', () => {
    const report = buildWeeklyMetrics(dbWithLogs([
        log({ type: 'walk', met: 3.5, deleted: true })
    ]), ANCHOR);

    assert.equal(report.metrics.cardio.sessions, 0);
});
