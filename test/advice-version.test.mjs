import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeAdviceVersions, mergeAdviceRecord } from '../sync-pure.js';

test('mergeAdviceVersions performs append-only union sorted by createdAt', () => {
    const out = mergeAdviceVersions(
        [{ id: 'v1', createdAt: 1 }, { id: 'v2', createdAt: 2 }],
        [{ id: 'v1', createdAt: 1 }, { id: 'v3', createdAt: 3 }]
    );
    assert.deepEqual(out.map(v => v.id), ['v1', 'v2', 'v3']);
});

test('mergeAdviceRecord uses LWW for activeVersionId and append-only for versions', () => {
    const out = mergeAdviceRecord(
        { id: 'a', updatedAt: 10, activeVersionId: 'v2', versions: [{ id: 'v1', createdAt: 1 }, { id: 'v2', createdAt: 2 }] },
        { id: 'a', updatedAt: 20, activeVersionId: 'v3', versions: [{ id: 'v1', createdAt: 1 }, { id: 'v3', createdAt: 3 }] }
    );
    assert.equal(out.activeVersionId, 'v3');
    assert.deepEqual((out.versions || []).map(v => v.id), ['v1', 'v2', 'v3']);
});
