import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateOneRm, computePrByAction, diffPrEntries } from '../pr-tracker-pure.mjs';

test('estimateOneRm uses Epley formula for reps <= 12', () => {
    assert.equal(estimateOneRm(80, 5), Number((80 * (1 + 5 / 30)).toFixed(2)));
});

test('estimateOneRm ignores reps > 12', () => {
    assert.equal(estimateOneRm(60, 15), 0);
});

test('computePrByAction aggregates per action', () => {
    const out = computePrByAction([
        { id: '1', type: 'strength', customName: '卧推', weightKg: 80, repsPerSet: 5, date: '2026-05-01' },
        { id: '2', type: 'strength', customName: '卧推', weightKg: 85, repsPerSet: 3, date: '2026-05-02' },
        { id: '3', type: 'strength', customName: '深蹲', weightKg: 100, repsPerSet: 8, date: '2026-05-03' }
    ]);
    assert.equal(out['卧推'].maxWeight, 85);
    assert.equal(out['卧推'].maxReps, 5);
    assert.ok(out['深蹲'].oneRm > 0);
});

test('diffPrEntries finds improvements', () => {
    const prev = { '卧推': { maxWeight: 80, maxReps: 5, oneRm: 93.33 } };
    const next = { '卧推': { maxWeight: 85, maxReps: 5, oneRm: 93.33 } };
    const diff = diffPrEntries(prev, next);
    assert.equal(diff.length, 1);
    assert.equal(diff[0].improvedWeight, true);
});
