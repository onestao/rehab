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

function loadStorageMigrate(options = {}) {
    const code = readFileSync(new URL('../storage/migrate.js', import.meta.url), 'utf8');
    const hasIndexedDb = options.hasIndexedDb !== false;
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
        window: hasIndexedDb ? { storageIdb } : {},
        indexedDB: hasIndexedDb ? {} : undefined,
        localStorage,
        console
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return { appWindow: sandbox.window, localStorage, storageIdb, storageMigrate: sandbox.window.storageMigrate };
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

test('createAdapter can defer first-run idb migration without opening idb during boot', async () => {
    const { localStorage, storageIdb, storageMigrate } = loadStorageMigrate();
    const initial = {
        schemaVersion: 3,
        actions: [],
        history: [{ id: 'history-boot', updatedAt: 1 }],
        health: { aiAdviceChat: [{ id: 'advice-boot', updatedAt: 2 }] }
    };
    let opened = false;
    storageIdb.open = async () => {
        opened = true;
        throw new Error('IDB should not open during deferred boot');
    };
    localStorage.setItem('rehab.db', JSON.stringify(initial));

    const result = await storageMigrate.createAdapter({
        dbKey: 'rehab.db',
        cfgKey: 'rehab.cfg',
        storageVersionKey: 'storageVersion',
        migrationFailedKey: 'migration.failed',
        targetVersion: 4,
        deferMigration: true
    });

    assert.equal(result.mode, 'localStorage');
    assert.equal(result.migration.deferred, true);
    assert.equal(opened, false);
    assert.equal(localStorage.getItem('storageVersion'), null);
    assert.deepEqual(clone(result.adapter.read('rehab.db')), initial);
});

test('idb adapter merges working-set advice into collection store without clearing cold history', async () => {
    const { appWindow, localStorage, storageMigrate } = loadStorageMigrate();
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
    const byId = new Map([
        ['cold-old', { id: 'cold-old', role: 'assistant', content: 'old cold record', updatedAt: 1, deleted: false }]
    ]);
    let clearCount = 0;
    appWindow.adviceCollections = {
        async clear() {
            clearCount++;
            byId.clear();
        },
        async putMany(records) {
            records.forEach(record => byId.set(record.id, clone(record)));
        },
        async count() {
            return byId.size;
        },
        async getAll() {
            return Array.from(byId.values()).map(clone);
        }
    };
    const next = {
        ...initial,
        health: {
            aiAdviceChat: [{ id: 'recent-new', role: 'user', content: 'recent', updatedAt: 10, deleted: false }]
        }
    };

    await result.adapter.write('rehab.db', next);

    assert.equal(clearCount, 0);
    assert.deepEqual(Array.from(byId.keys()).sort(), ['cold-old', 'recent-new']);
});

test('idb adapter recovers current-version empty idb from legacy full snapshot', async () => {
    const { localStorage, storageIdb, storageMigrate } = loadStorageMigrate();
    const db = {
        schemaVersion: 3,
        actions: [{ id: 'action-1', updatedAt: 1 }],
        history: [{ id: 'history-1', updatedAt: 2 }],
        health: {
            weights: [{ id: 'weight-1', updatedAt: 3 }],
            aiAdviceChat: [{ id: 'advice-1', updatedAt: 4 }]
        }
    };
    localStorage.setItem('storageVersion', '4');
    localStorage.setItem('rehab.db:legacy-full', JSON.stringify(db));
    localStorage.setItem('rehab.cfg', JSON.stringify({ mode: 's3' }));

    const result = await storageMigrate.createAdapter({
        dbKey: 'rehab.db',
        cfgKey: 'rehab.cfg',
        storageVersionKey: 'storageVersion',
        migrationFailedKey: 'migration.failed',
        targetVersion: 4
    });
    const restored = await result.adapter.read('rehab.db');

    assert.equal(result.mode, 'idb');
    assert.deepEqual(clone(restored.actions), db.actions);
    assert.deepEqual(clone(restored.history), db.history);
    assert.deepEqual(clone(restored.health.aiAdviceChat), db.health.aiAdviceChat);
    assert.deepEqual(await storageIdb.get('rehab.db:history'), db.history);
    assert.deepEqual(await storageIdb.get('rehab.db:advice'), db.health.aiAdviceChat);
});

test('local fallback adapter hydrates db from legacy full snapshot when idb is unavailable', async () => {
    const { localStorage, storageMigrate } = loadStorageMigrate({ hasIndexedDb: false });
    const db = {
        schemaVersion: 3,
        actions: [{ id: 'action-1', updatedAt: 1 }],
        history: [{ id: 'history-1', updatedAt: 2 }],
        health: { aiAdviceChat: [{ id: 'advice-1', updatedAt: 3 }] }
    };
    localStorage.setItem('storageVersion', '4');
    localStorage.setItem('rehab.db:legacy-full', JSON.stringify(db));
    localStorage.setItem('rehab.cfg', JSON.stringify({ mode: 's3' }));

    const result = await storageMigrate.createAdapter({
        dbKey: 'rehab.db',
        cfgKey: 'rehab.cfg',
        storageVersionKey: 'storageVersion',
        migrationFailedKey: 'migration.failed',
        targetVersion: 4
    });
    const restored = await result.adapter.read('rehab.db');

    assert.equal(result.mode, 'localStorage');
    assert.deepEqual(clone(restored.actions), db.actions);
    assert.deepEqual(clone(restored.history), db.history);
    assert.deepEqual(clone(restored.health.aiAdviceChat), db.health.aiAdviceChat);
});
