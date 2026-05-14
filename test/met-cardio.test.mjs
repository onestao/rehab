import test from 'node:test';
import assert from 'node:assert/strict';
import { cardioTypes, calcCalories } from '../workout-cardio-pure.js';

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
