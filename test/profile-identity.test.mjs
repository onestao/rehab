import test from 'node:test';
import assert from 'node:assert/strict';
import { weeklyWeightAchievement } from '../data-utils-pure.js';

test('weeklyWeightAchievement: 减重达成 80%', () => {
    const r = weeklyWeightAchievement({ weightDelta: -0.4, goalType: 'loss', weeklyTarget: 0.5 });
    assert.equal(r.pct, 80);
    assert.equal(r.color, 'positive');
});

test('weeklyWeightAchievement: 减重反向 → negative', () => {
    const r = weeklyWeightAchievement({ weightDelta: 0.3, goalType: 'loss', weeklyTarget: 0.5 });
    assert.equal(r.pct, 0);
    assert.equal(r.color, 'negative');
});

test('weeklyWeightAchievement: 增肌达成 67%', () => {
    const r = weeklyWeightAchievement({ weightDelta: 0.2, goalType: 'gain', weeklyTarget: 0.3 });
    assert.equal(r.pct, 67);
    assert.equal(r.color, 'positive');
});

test('weeklyWeightAchievement: 增肌反向 → negative', () => {
    const r = weeklyWeightAchievement({ weightDelta: -0.1, goalType: 'gain', weeklyTarget: 0.3 });
    assert.equal(r.pct, 0);
    assert.equal(r.color, 'negative');
});

test('weeklyWeightAchievement: 无记录 → neutral', () => {
    const r = weeklyWeightAchievement({ weightDelta: null, goalType: 'loss', weeklyTarget: 0.5 });
    assert.equal(r.pct, null);
    assert.equal(r.color, 'neutral');
});

test('weeklyWeightAchievement: 无目标 → neutral', () => {
    const r = weeklyWeightAchievement({ weightDelta: -0.3, goalType: 'loss', weeklyTarget: 0 });
    assert.equal(r.pct, null);
    assert.equal(r.color, 'neutral');
});

test('weeklyWeightAchievement: 超额完成 ≥ 100% 截断', () => {
    const r = weeklyWeightAchievement({ weightDelta: -0.8, goalType: 'loss', weeklyTarget: 0.5 });
    assert.equal(r.pct, 100);
    assert.equal(r.color, 'positive');
});
