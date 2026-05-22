import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeIncremental, computeRetryDelay, isRetryableError, buildS3ObjectKey, buildS3MigrationPlan } from '../sync-pure.js';

test('mergeIncremental applies LWW by updatedAt', () => {
    const local = [{ id: 'a', value: 1, updatedAt: 10 }, { id: 'b', value: 2, updatedAt: 20 }];
    const remote = [{ id: 'a', value: 3, updatedAt: 30 }, { id: 'c', value: 4, updatedAt: 5 }];
    const merged = mergeIncremental(local, remote);
    assert.deepEqual(merged.find(x => x.id === 'a')?.value, 3);
    assert.deepEqual(merged.find(x => x.id === 'b')?.value, 2);
    assert.deepEqual(merged.find(x => x.id === 'c')?.value, 4);
});

test('mergeIncremental keeps tombstones by LWW', () => {
    const merged = mergeIncremental([{ id: 'a', updatedAt: 10, deleted: false }], [{ id: 'a', updatedAt: 20, deletedAt: 20, deleted: true }]);
    assert.equal(merged[0].deleted, true);
    assert.equal(merged[0].deletedAt, 20);
});

test('retry helpers classify delays and errors', () => {
    assert.ok(computeRetryDelay(1) >= 800);
    assert.equal(isRetryableError({ status: 429 }), true);
    assert.equal(isRetryableError({ status: 503 }), true);
    assert.equal(isRetryableError({ status: 404 }), false);
    assert.equal(isRetryableError(new Error('Failed to fetch')), true);
});

test('buildS3ObjectKey scopes remote files under rehab prefix', () => {
    assert.equal(buildS3ObjectKey('rehab_pro_data.json'), 'rehab/rehab_pro_data.json');
    assert.equal(buildS3ObjectKey('incremental/actions/1.json'), 'rehab/incremental/actions/1.json');
    assert.equal(buildS3ObjectKey('backup/2026/05/22/file.json.gz'), 'rehab/backup/2026/05/22/file.json.gz');
});

test('buildS3ObjectKey does not duplicate existing prefix', () => {
    assert.equal(buildS3ObjectKey('/rehab/manifest.json'), 'rehab/manifest.json');
    assert.equal(buildS3ObjectKey('manifest.json', '/rehab/'), 'rehab/manifest.json');
});

test('buildS3MigrationPlan includes snapshot manifest and manifest windows', () => {
    const plan = buildS3MigrationPlan({
        entities: {
            actions: { windows: [1000, '2000'] },
            routines: { windows: ['bad', 3000] }
        }
    }, ['backup/2026/05/22/a.json.gz', 'rehab/manifest.json']);
    assert.deepEqual(plan, [
        'rehab_pro_data.json',
        'manifest.json',
        'incremental/actions/1000.json',
        'incremental/actions/2000.json',
        'incremental/routines/3000.json',
        'backup/2026/05/22/a.json.gz'
    ]);
});
