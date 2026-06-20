// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateProgression } from '../plan-progression-pure.js';

const chain = {
    levels: [
        { lv: 1, name: 'L1' },
        { lv: 2, name: 'L2' },
        { lv: 3, name: 'L3' }
    ]
};

test('maintains when no usable history exists', () => {
    const result = evaluateProgression({ taskItem: { currentLevel: 2, spec: { sets: 3, reps: 12 } }, chain, history: [] });
    assert.equal(result.decision, 'hold');
    assert.equal(result.targetLevel, 2);
});

test('upgrades after two consecutive too-light feedbacks', () => {
    const result = evaluateProgression({
        taskItem: { currentLevel: 2, spec: { sets: 3, reps: 12 } },
        chain,
        history: [{ rpe: 1, doneAt: 1 }, { rpe: 1, doneAt: 2 }]
    });
    assert.equal(result.decision, 'progress');
    assert.equal(result.targetLevel, 3);
});

test('downgrades immediately on rpe 5 when not at floor', () => {
    const result = evaluateProgression({
        taskItem: { currentLevel: 3, spec: { sets: 3, reps: 12 } },
        chain,
        history: [{ rpe: 5, doneAt: 2 }]
    });
    assert.equal(result.decision, 'deload');
    assert.equal(result.targetLevel, 2);
});

test('locked item always maintains', () => {
    const result = evaluateProgression({
        taskItem: { currentLevel: 2, userOverride: true, spec: { sets: 3, reps: 12 } },
        chain,
        history: [{ rpe: 1, doneAt: 1 }, { rpe: 1, doneAt: 2 }]
    });
    assert.equal(result.decision, 'hold');
});

test('mixed history does not upgrade', () => {
    const result = evaluateProgression({
        taskItem: { currentLevel: 2, spec: { sets: 3, reps: 12 } },
        chain,
        history: [{ rpe: 2, doneAt: 1 }, { rpe: 3, doneAt: 2 }]
    });
    assert.equal(result.decision, 'hold');
});

test('ignores invalid feedback entries', () => {
    const result = evaluateProgression({
        taskItem: { currentLevel: 2, spec: { sets: 3, reps: 12 } },
        chain,
        history: [{ rpe: 9, doneAt: 1 }, { rpe: 1, doneAt: 2 }, { rpe: 1, doneAt: 3 }]
    });
    assert.equal(result.decision, 'progress');
    assert.equal(result.targetLevel, 3);
});
