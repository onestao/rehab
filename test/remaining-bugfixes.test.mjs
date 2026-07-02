import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadSync(dataOverrides = {}) {
    const code = readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
    const data = {
        SCHEMA_VERSION: 3,
        cfg: { mode: 'webdav' },
        db: { syncMeta: {}, actions: [], routines: [], history: [], health: {} },
        normalizeDb() { this.db.health = this.db.health || {}; },
        touchRecord(record) { if (record) record.updatedAt = Number(record.updatedAt || Date.now()); },
        save() {},
        flush: async () => {},
        render() {},
        ...dataOverrides
    };
    const context = {
        window: { syncPure: {}, syncUi: { setStatus() {} }, syncAdapters: {}, backup: null },
        data,
        console,
        alert() {},
        confirm: () => true,
        Date,
        crypto: { subtle: { digest: async () => new Uint8Array(32).buffer } },
        TextEncoder
    };
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(`${code}\nthis.__sync = sync;`, context);
    return { sync: context.__sync, data };
}

test('service worker precaches index and falls back for offline navigation', () => {
    const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

    assert.match(sw, /'index\.html'/);
    assert.match(sw, /async function fetchNavigation/);
    assert.match(sw, /caches\.match\('index\.html'\)/);
    assert.match(sw, /event\.respondWith\(fetchNavigation\(event\.request\)\)/);
});

test('restored strength sessions use delta-based elapsed time', () => {
    const state = readFileSync(new URL('../workout-state.js', import.meta.url), 'utf8');

    assert.match(state, /workout\._sessionLastTick = Date\.now\(\)/);
    assert.match(state, /Math\.floor\(\(now - Number\(workout\._sessionLastTick \|\| now\)\) \/ 1000\)/);
    assert.match(state, /workout\.totalSec \+= delta/);
    assert.doesNotMatch(state, /workout\.totalSec\+\+/);
});

test('applySnapshot preserves local encrypted AI config when remote omits it', async () => {
    /** @type {{ id: string, payload: { secret: string }, updatedAt: number, deleted: boolean }} */
    const localCipher = { id: 'ai-cipher', payload: { secret: 'local' }, updatedAt: 10, deleted: false };
    const { sync, data } = loadSync({
        db: {
            syncMeta: {},
            actions: [{ id: 'local-action', updatedAt: 10 }],
            routines: [],
            history: [],
            aiCipher: localCipher,
            encryptedAi: localCipher.payload,
            health: { weights: [], foodLogs: [], exerciseLogs: [], reports: [], rehabWeekly: [], aiAdviceChat: [] }
        }
    });

    await sync.applySnapshot({
        schemaVersion: 3,
        actions: [{ id: 'remote-action', updatedAt: 20 }],
        routines: [],
        history: [],
        health: { weights: [], foodLogs: [], exerciseLogs: [], reports: [], rehabWeekly: [], aiAdviceChat: [] }
    });

    assert.equal(data.db.aiCipher.id, localCipher.id);
    assert.equal(data.db.aiCipher.payload.secret, localCipher.payload.secret);
    assert.equal(data.db.encryptedAi.secret, localCipher.payload.secret);
    const actions = /** @type {Array<any>} */ (data.db.actions);
    assert.equal(actions.some(item => item.id === 'local-action'), true);
    assert.equal(actions.some(item => item.id === 'remote-action'), true);
});

test('pushChanges queues manifest commit when window upload succeeded but manifest write fails', async () => {
    const { sync, data } = loadSync({
        db: {
            syncMeta: { lastIncrementalTs: 0, pendingQueue: [], etags: {} },
            actions: [{ id: 'a1', updatedAt: 1000, name: 'Action' }],
            routines: [],
            history: [],
            health: { weights: [], foodLogs: [], exerciseLogs: [], reports: [], rehabWeekly: [], aiAdviceChat: [] }
        }
    });
    sync.setStatus = () => {};
    sync.withRetry = async (fn) => fn();
    sync.fetchJson = async () => ({ data: { snapshotTs: 0, lastIncrementalTs: 0, entities: {}, schemaVersion: 3 }, etag: '' });
    sync.incrementalWindowTs = () => 1000;
    const writes = [];
    sync.writeJson = async (remotePath, payload) => {
        writes.push(remotePath);
        if (remotePath === sync.REMOTE_MANIFEST) throw new Error('network failed');
        return '';
    };

    await sync.pushChanges({ quiet: true });

    assert.deepEqual(writes, ['incremental/actions/1000.json', 'manifest.json']);
    assert.equal(data.db.syncMeta.pendingQueue.length, 1);
    assert.equal(data.db.syncMeta.pendingQueue[0].remotePath, 'manifest.json');
    assert.equal(data.db.syncMeta.pendingQueue[0].reason, 'manifest_commit_failed');
    assert.equal(data.db.syncMeta.pendingQueue[0].payload.entities.actions.windows.length, 1);
    assert.equal(data.db.syncMeta.pendingQueue[0].payload.entities.actions.windows[0], 1000);
});

test('pullChanges skips legacy S3 root when prefixed source has data', async () => {
    const { sync, data } = loadSync({
        cfg: { mode: 's3' },
        db: {
            syncMeta: { lastIncrementalTs: 0, sourceLastIncrementalTs: {} },
            actions: [],
            routines: [],
            history: [],
            health: { weights: [], foodLogs: [], exerciseLogs: [], reports: [], rehabWeekly: [], aiAdviceChat: [] }
        }
    });
    const reads = [];
    sync.setStatus = () => {};
    sync.withRetry = async (fn) => fn();
    sync.processRetryQueue = async () => ({ attempted: 0, remaining: 0 });
    sync.fullBackup = async () => {};
    sync.fetchJson = async (remotePath, allow404, options = {}) => {
        const source = options.s3Root ? 'root' : 'prefixed';
        reads.push(`${source}:${remotePath}`);
        if (source === 'prefixed' && remotePath === sync.REMOTE_SNAPSHOT) {
            return {
                data: {
                    schemaVersion: 3,
                    actions: [{ id: 'new-action', updatedAt: 20 }],
                    routines: [],
                    history: [],
                    health: { weights: [], foodLogs: [], exerciseLogs: [], reports: [], rehabWeekly: [], aiAdviceChat: [] }
                },
                etag: ''
            };
        }
        if (source === 'prefixed' && remotePath === sync.REMOTE_MANIFEST) {
            return { data: { snapshotTs: 20, lastIncrementalTs: 20, entities: {}, schemaVersion: 3 }, etag: '' };
        }
        if (source === 'root' && remotePath === sync.REMOTE_SNAPSHOT) {
            return {
                data: {
                    schemaVersion: 3,
                    actions: [{ id: 'old-action', updatedAt: 1 }],
                    routines: [],
                    history: [],
                    health: { weights: [], foodLogs: [], exerciseLogs: [], reports: [], rehabWeekly: [], aiAdviceChat: [] }
                },
                etag: ''
            };
        }
        return { data: { snapshotTs: 1, lastIncrementalTs: 1, entities: {}, schemaVersion: 3 }, etag: '' };
    };

    await sync.pullChanges();

    assert.deepEqual(reads, [
        'prefixed:rehab_pro_data.json',
        'prefixed:manifest.json'
    ]);
    const actions = /** @type {Array<any>} */ (data.db.actions);
    assert.equal(actions.some(item => item.id === 'new-action'), true);
    assert.equal(actions.some(item => item.id === 'old-action'), false);
});

test('auto compaction uploads incrementals but skips snapshot rebuild when local is behind remote', async () => {
    const windows = Array.from({ length: 49 }, (_, i) => i + 1);
    const remoteManifest = {
        snapshotTs: 1000,
        lastIncrementalTs: 1000,
        schemaVersion: 3,
        entities: {
            actions: { lastTs: 1000, count: 49, windows }
        }
    };
    const { sync, data } = loadSync({
        db: {
            syncMeta: { lastIncrementalTs: 0, pendingQueue: [], etags: {} },
            actions: [{ id: 'new-action', updatedAt: 2000, name: 'New local action' }],
            routines: [],
            history: [],
            health: { weights: [], foodLogs: [], exerciseLogs: [], reports: [], rehabWeekly: [], aiAdviceChat: [] }
        }
    });
    sync.setStatus = () => {};
    sync.withRetry = async (fn) => fn();
    sync.incrementalWindowTs = () => 2000;
    sync.processRetryQueue = async () => ({ attempted: 0, remaining: 0 });
    sync.fetchJson = async (remotePath) => {
        if (remotePath === sync.REMOTE_MANIFEST) return { data: remoteManifest, etag: '' };
        if (remotePath === sync.REMOTE_SNAPSHOT) {
            return {
                data: {
                    schemaVersion: 3,
                    actions: Array.from({ length: 10 }, (_, i) => ({ id: `old-action-${i}`, updatedAt: 100 + i })),
                    routines: [{ id: 'old-routine', updatedAt: 150 }],
                    history: Array.from({ length: 20 }, (_, i) => ({ id: `old-history-${i}`, updatedAt: 200 + i })),
                    health: {
                        weights: [{ id: 'old-weight', updatedAt: 300 }],
                        foodLogs: [],
                        exerciseLogs: [],
                        reports: [],
                        rehabWeekly: [],
                        aiAdviceChat: []
                    }
                },
                etag: ''
            };
        }
        return { data: null, etag: '' };
    };
    const writes = [];
    sync.writeJson = async (remotePath, payload) => {
        writes.push(remotePath);
        return '';
    };

    await sync.pushChanges({ quiet: true, rethrow: true });

    assert.deepEqual(writes, [
        'incremental/actions/2000.json',
        'manifest.json'
    ]);
    assert.equal(writes.includes(sync.REMOTE_SNAPSHOT), false);
    assert.equal(data.db.syncMeta.lastIncrementalTs, 2000);
});

test('quiet fullBackup blocks unsafe full snapshot overwrite', async () => {
    const { sync } = loadSync({
        db: {
            syncMeta: {},
            actions: [{ id: 'new-action', updatedAt: 2000, name: 'New local action' }],
            routines: [],
            history: [],
            health: { weights: [], foodLogs: [], exerciseLogs: [], reports: [], rehabWeekly: [], aiAdviceChat: [] }
        }
    });
    sync.setStatus = () => {};
    sync.withRetry = async (fn) => fn();
    sync.fetchJson = async (remotePath) => {
        if (remotePath === sync.REMOTE_SNAPSHOT) {
            return {
                data: {
                    schemaVersion: 3,
                    actions: Array.from({ length: 10 }, (_, i) => ({ id: `old-action-${i}`, updatedAt: 100 + i })),
                    routines: [{ id: 'old-routine', updatedAt: 150 }],
                    history: Array.from({ length: 20 }, (_, i) => ({ id: `old-history-${i}`, updatedAt: 200 + i })),
                    health: {
                        weights: [{ id: 'old-weight', updatedAt: 300 }],
                        foodLogs: [],
                        exerciseLogs: [],
                        reports: [],
                        rehabWeekly: [],
                        aiAdviceChat: []
                    }
                },
                etag: ''
            };
        }
        return { data: null, etag: '' };
    };
    const writes = [];
    sync.writeJson = async (remotePath) => {
        writes.push(remotePath);
        return '';
    };

    await assert.rejects(
        () => sync.fullBackup({ quiet: true }),
        /阻止自动全量覆盖/
    );

    assert.deepEqual(writes, []);
});
