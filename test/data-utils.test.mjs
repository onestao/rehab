import test from 'node:test';
import assert from 'node:assert/strict';
import { clamp, safeNumber, formatKcal, deepClone, toLogicalDay } from '../data-utils-pure.js';

test('toLogicalDay handles cutoff around midnight', () => {
    assert.equal(toLogicalDay(new Date('2026-05-14T03:59:00')), '2026-05-13');
    assert.equal(toLogicalDay(new Date('2026-05-14T04:00:00')), '2026-05-14');
    assert.equal(toLogicalDay(new Date('2026-05-14T23:59:00')), '2026-05-14');
});

test('numeric helpers are stable', () => {
    assert.equal(clamp(10, 0, 5), 5);
    assert.equal(clamp(-1, 0, 5), 0);
    assert.equal(safeNumber('12.5'), 12.5);
    assert.equal(safeNumber('bad', 9), 9);
    assert.equal(formatKcal(123.6), '124 kcal');
});

test('deepClone breaks nested references', () => {
    const source = { a: 1, nested: { b: 2 } };
    const copy = deepClone(source);
    copy.nested.b = 9;
    assert.equal(source.nested.b, 2);
});
