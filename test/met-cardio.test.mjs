import test from 'node:test';
import assert from 'node:assert/strict';
import {
    cardioTypes,
    calcCalories,
    calcCaloriesForSeconds,
    normalizeCardioCatalog,
    formatDurationParts,
    shouldAnnounceTarget,
    shouldSaveCardioSession,
    buildCardioHistoryRecord
} from '../workout-cardio-pure.js';

test('calcCalories uses MET formula', () => {
    assert.equal(calcCalories(5, 60, 0), 0);
    assert.equal(calcCalories(5, -1, 20), 0);
    assert.equal(calcCalories(0, 60, 20), 0);
    assert.equal(Number(calcCalories(10, 60, 30).toFixed(2)), 300);
});

test('all builtin cardio types produce positive calories', () => {
    for (const key of Object.keys(cardioTypes)) {
        const value = calcCalories(cardioTypes[key].met, 70, 30);
        assert.ok(value > 0, key);
    }
});

test('cardio helpers normalize timer and save thresholds', () => {
    assert.equal(calcCaloriesForSeconds({ type: 'run', weight: 60 }, 1800), 294);
    assert.deepEqual(formatDurationParts(65), { minutes: 1, seconds: 5, label: '01:05' });
    assert.equal(shouldSaveCardioSession(19), false);
    assert.equal(shouldSaveCardioSession(20), true);
    assert.equal(shouldAnnounceTarget({ seconds: 60, target: 1, targetAnnounced: false }), true);
    assert.equal(shouldAnnounceTarget({ seconds: 60, target: 1, targetAnnounced: true }), false);
});

test('custom cardio catalog extends type normalization and calorie math', () => {
    const catalog = normalizeCardioCatalog({ 'action-stair': { name: '登山机', met: 8.8 } });

    assert.equal(catalog['action-stair'].name, '登山机');
    assert.equal(calcCaloriesForSeconds({ type: 'action-stair', weight: 70 }, 1800, catalog), 308);
});

test('buildCardioHistoryRecord owns cardio history shape', () => {
    const record = buildCardioHistoryRecord({
        id: 'history-1',
        now: new Date('2026-05-22T00:00:00Z').getTime(),
        dayKey: '2026-05-22',
        plan: { type: 'cycling', weight: 80, target: 45 },
        duration: 1800,
        calories: 272
    });
    assert.equal(record.id, 'history-1');
    assert.equal(record.type, 'cardio');
    assert.equal(record.dayKey, '2026-05-22');
    assert.equal(record.cardio.name, '骑行');
    assert.equal(record.cardio.met, 6.8);
    assert.equal(record.cardio.calories, 272);
});
