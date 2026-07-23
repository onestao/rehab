// @ts-nocheck
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'data-store-deferred.js'), 'utf8');

function loadDeferred() {
    const events = [];
    const loaded = [];
    const writes = [];
    const context = {
        Promise,
        console,
        window: {
            errorBus: { event(...args) { events.push(args); } },
            async loadAppScript(name) { loaded.push(name); },
            storageMigrate: {
                createLocalAdapter() { return { mode: 'local' }; },
                async migrateLocalToIdb() { return { ok: true }; },
                createIdbAdapter() {
                    return { mode: 'idb', async write(key, value) { writes.push([key, value]); } };
                }
            }
        }
    };
    context.window.window = context.window;
    vm.createContext(context);
    vm.runInContext(source, context, { filename: 'data-store-deferred.js' });
    return { api: context.window.dataStoreDeferred, context, events, loaded, writes };
}

test('deferred migration loads collection adapters and promotes storage after success', async () => {
    const harness = loadDeferred();
    const host = {
        DB_KEY: 'db',
        CFG_KEY: 'cfg',
        db: { actions: [] },
        cfg: { mode: 'none' },
        createLocalStorageAdapter() { return { mode: 'fallback' }; }
    };
    const result = await harness.api.runStorageMigration.call(host, { dbKey: 'db', targetVersion: 2 });
    assert.equal(result.ok, true);
    assert.deepEqual(harness.loaded, ['storage/idb-collections', 'storage/idb-advice-collections']);
    assert.equal(host._storageMode, 'idb');
    assert.equal(harness.writes.length, 2);
});

test('advice cold start merges recent records and initializes search lazily', async () => {
    const harness = loadDeferred();
    let searchStarts = 0;
    let activeRecords = [];
    const local = [{ id: 'local', updatedAt: 1 }];
    const coldNewestFirst = [{ id: 'cold-2', updatedAt: 3 }, { id: 'cold-1', updatedAt: 2 }];
    const host = {
        db: { health: { aiAdviceChat: local } },
        activeRecords(records) { return records; },
        advice: {
            workingSet: local,
            async getRecent() { return coldNewestFirst; },
            _mergeChronological(...groups) { return groups.flat().sort((a, b) => a.updatedAt - b.updatedAt); },
            setActiveRecords(records) { activeRecords = records; },
            initSearchWorker() { searchStarts++; }
        }
    };
    await harness.api.loadRecentAdviceColdStart.call(host);
    assert.deepEqual(host.db.health.aiAdviceChat.map((item) => item.id), ['local', 'cold-1', 'cold-2']);
    assert.deepEqual(activeRecords, host.db.health.aiAdviceChat);
    assert.equal(searchStarts, 1);
});
