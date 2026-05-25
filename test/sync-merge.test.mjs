import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeIncremental, computeRetryDelay, isRetryableError, buildS3ObjectKey, prepareRemoteSnapshotDb } from '../sync-pure.js';

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

test('buildS3ObjectKey scopes sync and backup files under rehab prefix', () => {
    assert.equal(buildS3ObjectKey('rehab_pro_data.json'), 'rehab/rehab_pro_data.json');
    assert.equal(buildS3ObjectKey('manifest.json'), 'rehab/manifest.json');
    assert.equal(buildS3ObjectKey('incremental/actions/1.json'), 'rehab/incremental/actions/1.json');
    assert.equal(buildS3ObjectKey('backup/2026/05/25/a.json.gz'), 'rehab/backup/2026/05/25/a.json.gz');
});

test('buildS3ObjectKey does not duplicate existing rehab prefix', () => {
    assert.equal(buildS3ObjectKey('/rehab/manifest.json'), 'rehab/manifest.json');
    assert.equal(buildS3ObjectKey('manifest.json', '/rehab/'), 'rehab/manifest.json');
});

test('prepareRemoteSnapshotDb preserves voice engine configuration', () => {
    const db = {
        voice: {
            priority: 'online-first',
            cache: true,
            timeoutMs: 4000,
            engines: [{
                id: 'legado-1',
                name: 'Private TTS',
                url: 'https://tts.example/speak?text={{javaEncode(speakText)}}',
                header: { Authorization: 'Bearer token' }
            }]
        }
    };
    const snapshot = prepareRemoteSnapshotDb(db);
    assert.equal(snapshot.voice.engines.length, 1);
    assert.equal(snapshot.voice.engines[0].header.Authorization, 'Bearer token');
    snapshot.voice.engines[0].header.Authorization = 'changed';
    assert.equal(db.voice.engines[0].header.Authorization, 'Bearer token');
});
