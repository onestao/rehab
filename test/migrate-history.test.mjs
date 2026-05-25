import test from 'node:test';
import assert from 'node:assert/strict';
import {
    splitLargeCollections,
    hydrateLargeCollections,
    pickLargestCollection,
    recoverLargeCollections
} from '../storage/migrate-pure.js';

test('split and hydrate history/advice collections preserves db equivalence', () => {
    const oldDb = {
        actions: [{ id: 'a1', name: '深蹲' }],
        history: [{ id: 'h1', actions: [{ name: '深蹲' }] }],
        health: {
            weights: [{ id: 'w1', weight: 70 }],
            aiAdviceChat: [{ id: 'm1', role: 'assistant', content: 'ok' }]
        },
        prefs: { haptics: true }
    };

    const split = splitLargeCollections(oldDb);
    assert.deepEqual(split.meta.history, []);
    assert.deepEqual(split.meta.health.aiAdviceChat, []);
    assert.deepEqual(split.history, oldDb.history);
    assert.deepEqual(split.advice, oldDb.health.aiAdviceChat);

    const hydrated = hydrateLargeCollections(split.meta, { history: split.history, advice: split.advice });
    assert.deepEqual(hydrated.history, oldDb.history);
    assert.deepEqual(hydrated.health.aiAdviceChat, oldDb.health.aiAdviceChat);
    assert.deepEqual(hydrated.actions, oldDb.actions);
});

test('recoverLargeCollections restores split metadata from idb or legacy-full collections', () => {
    const splitMeta = {
        actions: [{ id: 'a1', name: '深蹲' }],
        history: [],
        health: { aiAdviceChat: [] },
        largeCollections: { history: true, advice: true },
        lastModified: 300
    };
    const idbHistory = [{ id: 'h1' }, { id: 'h2' }];
    const legacyHistory = [{ id: 'old-h1' }];
    const legacyAdvice = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }];

    const recovered = recoverLargeCollections(splitMeta, {
        idbHistory,
        legacyHistory,
        legacyAdvice
    });

    assert.deepEqual(recovered.history, idbHistory);
    assert.deepEqual(recovered.health.aiAdviceChat, legacyAdvice);
    assert.deepEqual(recovered.actions, splitMeta.actions);
});

test('pickLargestCollection prefers the longest available non-null array', () => {
    const longest = [{ id: 'a' }, { id: 'b' }];
    assert.equal(pickLargestCollection(null, [], [{ id: 'x' }], longest), longest);
});
