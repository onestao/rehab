import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildHistoryStoreConfig,
    prepareHistoryForStore,
    migrateHistoryArrayToStoreRecords,
    computeHistoryListHash
} from '../storage/idb-collections-pure.js';

test('buildHistoryStoreConfig returns correct store definition', () => {
    const config = buildHistoryStoreConfig();
    assert.equal(config.storeName, 'history');
    assert.equal(config.keyPath, 'id');
    assert.ok(Array.isArray(config.indexes));
    assert.equal(config.indexes.length, 2);
    assert.equal(config.indexes[0].name, 'byUpdatedAt');
    assert.equal(config.indexes[0].keyPath, 'updatedAt');
    assert.equal(config.indexes[1].name, 'byDateKey');
    assert.equal(config.indexes[1].keyPath, 'dayKey');
});

test('prepareHistoryForStore returns null for invalid input', () => {
    assert.equal(prepareHistoryForStore(null), null);
    assert.equal(prepareHistoryForStore(undefined), null);
    assert.equal(prepareHistoryForStore('string'), null);
    assert.equal(prepareHistoryForStore({}), null);
    assert.equal(prepareHistoryForStore({ name: 'no-id' }), null);
});

test('prepareHistoryForStore preserves existing fields and fills defaults', () => {
    const record = { id: 'h-1', date: '2026-05-25', duration: 3600 };
    const prepared = prepareHistoryForStore(record);
    assert.equal(prepared.id, 'h-1');
    assert.equal(prepared.dayKey, '2026-05-25');
    assert.equal(prepared.duration, 3600);
    assert.equal(prepared.deleted, false);
    assert.ok(typeof prepared.updatedAt === 'number');
    assert.ok(prepared.updatedAt > 0);
});

test('prepareHistoryForStore uses existing dayKey over date', () => {
    const record = { id: 'h-2', dayKey: '2026-01-01', date: '2026-05-25', updatedAt: 1000 };
    const prepared = prepareHistoryForStore(record);
    assert.equal(prepared.dayKey, '2026-01-01');
    assert.equal(prepared.updatedAt, 1000);
});

test('prepareHistoryForStore marks deleted correctly', () => {
    const record = { id: 'h-3', deleted: true, updatedAt: 500 };
    const prepared = prepareHistoryForStore(record);
    assert.equal(prepared.deleted, true);
    assert.equal(prepared.updatedAt, 500);
});

test('migrateHistoryArrayToStoreRecords handles empty/null input', () => {
    assert.deepEqual(migrateHistoryArrayToStoreRecords(null), []);
    assert.deepEqual(migrateHistoryArrayToStoreRecords(undefined), []);
    assert.deepEqual(migrateHistoryArrayToStoreRecords('string'), []);
    assert.deepEqual(migrateHistoryArrayToStoreRecords([]), []);
});

test('migrateHistoryArrayToStoreRecords filters invalid records', () => {
    const input = [
        { id: 'h-1', updatedAt: 100 },
        null,
        { noId: true },
        { id: 'h-2', updatedAt: 200 },
        42
    ];
    const result = migrateHistoryArrayToStoreRecords(input);
    assert.equal(result.length, 2);
    assert.equal(result[0].id, 'h-1');
    assert.equal(result[1].id, 'h-2');
});

test('migrateHistoryArrayToStoreRecords preserves all valid records from legacy data', () => {
    const legacyHistory = [
        { id: 'h-1', date: '2026-01-01', actions: [{ name: '深蹲' }], duration: 3600, updatedAt: 1000 },
        { id: 'h-2', date: '2026-01-02', actions: [{ name: '卧推' }], duration: 2400, updatedAt: 2000 },
        { id: 'h-3', date: '2026-01-03', actions: [{ name: '硬拉' }], duration: 1800, updatedAt: 3000, deleted: true }
    ];
    const result = migrateHistoryArrayToStoreRecords(legacyHistory);
    assert.equal(result.length, 3);
    assert.equal(result[0].id, 'h-1');
    assert.equal(result[0].dayKey, '2026-01-01');
    assert.deepEqual(result[0].actions, [{ name: '深蹲' }]);
    assert.equal(result[2].deleted, true);
});

test('migrateHistoryArrayToStoreRecords handles corrupt records gracefully', () => {
    const corrupt = [
        { id: 'ok-1', updatedAt: 100 },
        { id: 'ok-2' },
        { /* missing id */ date: '2026-01-01' },
        null,
        undefined
    ];
    const result = migrateHistoryArrayToStoreRecords(corrupt);
    assert.equal(result.length, 2);
    assert.equal(result[0].id, 'ok-1');
    assert.equal(result[1].id, 'ok-2');
});

test('computeHistoryListHash returns stable hash for same input', () => {
    const records = [
        { id: 'h-1', updatedAt: 100 },
        { id: 'h-2', updatedAt: 200 }
    ];
    const hash1 = computeHistoryListHash(records);
    const hash2 = computeHistoryListHash(records);
    assert.equal(hash1, hash2);
    assert.equal(hash1, '2:100:200');
});

test('computeHistoryListHash returns different hash for different input', () => {
    const a = [{ id: 'h-1', updatedAt: 100 }];
    const b = [{ id: 'h-1', updatedAt: 100 }, { id: 'h-2', updatedAt: 200 }];
    assert.notEqual(computeHistoryListHash(a), computeHistoryListHash(b));
});

test('computeHistoryListHash handles empty and null input', () => {
    assert.equal(computeHistoryListHash([]), '0:0');
    assert.equal(computeHistoryListHash(null), '0:0');
    assert.equal(computeHistoryListHash(undefined), '0:0');
});
