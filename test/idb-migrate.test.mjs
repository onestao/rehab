import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { hydrateLargeCollections, migrateLegacyState, splitLargeCollections } from '../storage/migrate-pure.js';

test('migrateLegacyState backfills required arrays and meta', () => {
    const next = migrateLegacyState({ health: { profile: { gender: 'female' } } }, 1000);
    assert.ok(Array.isArray(next.actions));
    assert.ok(Array.isArray(next.health.weights));
    assert.equal(next.health.profile.id, 'profile-1000');
    assert.equal(next.health.profile.updatedAt, 1000);
    assert.equal(next.health.profile.deleted, false);
});

test('split and hydrate large collections do not add internal fields to db shape', () => {
    const db = {
        history: [{ id: 'history-1' }],
        health: { aiAdviceChat: [{ id: 'advice-1' }] },
        largeCollections: { history: true, advice: true }
    };

    const split = splitLargeCollections(db);
    assert.equal(Object.hasOwn(split.meta, 'largeCollections'), false);

    const hydrated = hydrateLargeCollections(split.meta, { history: split.history, advice: split.advice });
    assert.equal(Object.hasOwn(hydrated, 'largeCollections'), false);
    assert.deepEqual(hydrated.history, db.history);
    assert.deepEqual(hydrated.health.aiAdviceChat, db.health.aiAdviceChat);
});

function createLocalStorage() {
    const items = new Map();
    return {
        getItem(key) {
            return items.has(key) ? items.get(key) : null;
        },
        setItem(key, value) {
            items.set(key, String(value));
        },
        removeItem(key) {
            items.delete(key);
        }
    };
}

function clone(value) {
    return value == null ? null : JSON.parse(JSON.stringify(value));
}

function loadStorageMigrate() {
    const code = readFileSync(new URL('../storage/migrate.js', import.meta.url), 'utf8');
    const localStorage = createLocalStorage();
    const store = new Map();
    const storageIdb = {
        async open() {},
        async get(key) {
            return store.has(key) ? clone(store.get(key)) : null;
        },
        async set(key, value) {
            store.set(key, clone(value));
        },
        async remove(key) {
            store.delete(key);
        },
        async destroy() {
            store.clear();
        }
    };
    const sandbox = {
        window: { storageIdb },
        indexedDB: {},
        localStorage,
        console
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return { localStorage, storageIdb, storageMigrate: sandbox.window.storageMigrate };
}

test('local to idb migration validates split collection storage without extra fields', async () => {
    const { localStorage, storageIdb, storageMigrate } = loadStorageMigrate();
    const db = {
        schemaVersion: 3,
        actions: [],
        history: [{ id: 'history-1', updatedAt: 1 }],
        health: { aiAdviceChat: [{ id: 'advice-1', updatedAt: 2 }] }
    };
    localStorage.setItem('rehab.db', JSON.stringify(db));

    const result = await storageMigrate.migrateLocalToIdb({
        dbKey: 'rehab.db',
        cfgKey: 'rehab.cfg',
        storageVersionKey: 'storageVersion',
        migrationFailedKey: 'migration.failed',
        targetVersion: 4
    }, storageMigrate.createLocalAdapter());

    assert.equal(result.ok, true);
    assert.equal(localStorage.getItem('migration.failed'), null);
    assert.equal(localStorage.getItem('storageVersion'), '4');
    assert.equal(Object.hasOwn(await storageIdb.get('rehab.db'), 'largeCollections'), false);
    assert.deepEqual(await storageIdb.get('rehab.db:history'), db.history);
    assert.deepEqual(await storageIdb.get('rehab.db:advice'), db.health.aiAdviceChat);
});

test('idb adapter persists advice chat when advice collection store is unavailable', async () => {
    const { localStorage, storageIdb, storageMigrate } = loadStorageMigrate();
    const initial = {
        schemaVersion: 3,
        actions: [],
        history: [],
        health: { aiAdviceChat: [] }
    };
    localStorage.setItem('rehab.db', JSON.stringify(initial));

    const result = await storageMigrate.createAdapter({
        dbKey: 'rehab.db',
        cfgKey: 'rehab.cfg',
        storageVersionKey: 'storageVersion',
        migrationFailedKey: 'migration.failed',
        targetVersion: 4
    });
    const next = {
        ...initial,
        health: {
            aiAdviceChat: [{ id: 'advice-today', role: 'user', content: 'today', updatedAt: 10, deleted: false }]
        }
    };

    await result.adapter.write('rehab.db', next);

    assert.deepEqual(await storageIdb.get('rehab.db:advice'), next.health.aiAdviceChat);
    assert.deepEqual((await storageIdb.get('rehab.db')).health.aiAdviceChat, []);
    assert.deepEqual(clone(await result.adapter.read('rehab.db')), next);
});
