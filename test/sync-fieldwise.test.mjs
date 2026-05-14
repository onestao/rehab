import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeRecordsFieldwise } from '../sync-pure.js';

test('mergeRecordsFieldwise falls back to record-level LWW without field meta', () => {
    const local = { id: 'x', updatedAt: 10, a: 1 };
    const remote = { id: 'x', updatedAt: 20, a: 2 };
    assert.equal(mergeRecordsFieldwise(local, remote).a, 2);
});

test('mergeRecordsFieldwise merges by per-field timestamps when present', () => {
    const local = { id: 'x', updatedAt: 20, a: 1, b: 1, __fieldUpdatedAt: { a: '2026-01-01T00:00:00.000Z', b: '2026-01-03T00:00:00.000Z' } };
    const remote = { id: 'x', updatedAt: 20, a: 2, b: 2, __fieldUpdatedAt: { a: '2026-01-04T00:00:00.000Z', b: '2026-01-02T00:00:00.000Z' } };
    const out = mergeRecordsFieldwise(local, remote);
    assert.equal(out.a, 2);
    assert.equal(out.b, 1);
});
