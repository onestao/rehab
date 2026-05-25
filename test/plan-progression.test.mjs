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
    assert.equal(result.suggestion, 'maintain');
    assert.equal(result.targetLevel, 2);
});

test('upgrades after two consecutive too-light feedbacks', () => {
    const result = evaluateProgression({
        taskItem: { currentLevel: 2, spec: { sets: 3, reps: 12 } },
        chain,
        history: [{ rpe: 1, doneAt: 1 }, { rpe: 1, doneAt: 2 }]
    });
    assert.equal(result.suggestion, 'upgrade');
    assert.equal(result.targetLevel, 3);
});

test('downgrades immediately on rpe 5 when not at floor', () => {
    const result = evaluateProgression({
        taskItem: { currentLevel: 3, spec: { sets: 3, reps: 12 } },
        chain,
        history: [{ rpe: 5, doneAt: 2 }]
    });
    assert.equal(result.suggestion, 'downgrade');
    assert.equal(result.targetLevel, 2);
});

test('uses upgrade fallback at top level', () => {
    const result = evaluateProgression({
        taskItem: { currentLevel: 3, spec: { sets: 3, work: 30, reps: 0 } },
        chain,
        history: [{ rpe: 1, doneAt: 1 }, { rpe: 1, doneAt: 2 }]
    });
    assert.equal(result.suggestion, 'upgrade');
    assert.equal(result.targetLevel, 3);
    assert.deepEqual(result.fallbackSpec, { sets: 3, reps: 0, work: 35 });
});

test('uses downgrade fallback at bottom level', () => {
    const result = evaluateProgression({
        taskItem: { currentLevel: 1, spec: { sets: 3, work: 30, reps: 0 } },
        chain,
        history: [{ rpe: 5, doneAt: 1 }]
    });
    assert.equal(result.suggestion, 'downgrade');
    assert.equal(result.targetLevel, 1);
    assert.deepEqual(result.fallbackSpec, { sets: 2, reps: 0, work: 25 });
});

test('locked item always maintains', () => {
    const result = evaluateProgression({
        taskItem: { currentLevel: 2, userOverride: true, spec: { sets: 3, reps: 12 } },
        chain,
        history: [{ rpe: 1, doneAt: 1 }, { rpe: 1, doneAt: 2 }]
    });
    assert.equal(result.suggestion, 'maintain');
});

test('mixed history does not upgrade', () => {
    const result = evaluateProgression({
        taskItem: { currentLevel: 2, spec: { sets: 3, reps: 12 } },
        chain,
        history: [{ rpe: 1, doneAt: 1 }, { rpe: 2, doneAt: 2 }]
    });
    assert.equal(result.suggestion, 'maintain');
});

test('ignores invalid feedback entries', () => {
    const result = evaluateProgression({
        taskItem: { currentLevel: 2, spec: { sets: 3, reps: 12 } },
        chain,
        history: [{ rpe: 9, doneAt: 1 }, { rpe: 1, doneAt: 2 }, { rpe: 1, doneAt: 3 }]
    });
    assert.equal(result.suggestion, 'upgrade');
    assert.equal(result.targetLevel, 3);
});
