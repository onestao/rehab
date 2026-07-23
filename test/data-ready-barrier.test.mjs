/**
 * FIND-12: data.whenReady / ensureDataReady write barrier.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

function read(file) {
    return readFileSync(path.join(process.cwd(), file), 'utf8');
}

function createStoreContext(options = {}) {
    const toasts = [];
    const writes = [];
    const localStore = new Map();
    if (options.seedDb) {
        localStore.set('rehab_pro_universal_db', options.seedDb);
    }
    let activePage = options.activePage || 'today';
    let navToken = 0;

    const context = {
        console,
        setTimeout,
        clearTimeout,
        document: {
            querySelector(sel) {
                if (sel === '.page.active') return { id: activePage };
                return null;
            },
            querySelectorAll() { return []; },
            getElementById() { return null; },
            addEventListener() {}
        },
        window: {
            addEventListener() {},
            toast: {
                show(msg, type) { toasts.push({ msg, type }); },
                sanitize(e) { return e?.message || String(e); }
            },
            errorBus: {
                event() {},
                report() {}
            },
            ui: {
                get _navigationToken() { return navToken; }
            },
            localStorage: {
                getItem(k) {
                    if (!localStore.has(k)) return null;
                    const v = localStore.get(k);
                    return typeof v === 'string' ? v : JSON.stringify(v);
                },
                setItem(k, v) {
                    writes.push({ key: k, value: v });
                    localStore.set(k, v);
                },
                removeItem(k) { localStore.delete(k); }
            },
            requestIdleCallback: null
        },
        performance: { mark() {}, measure() {}, clearMarks() {} }
    };
    context.globalThis = context;
    context.window.window = context.window;
    context.window.document = context.document;
    context.localStorage = context.window.localStorage;
    vm.createContext(context);

    // Minimal stubs for modules data-store expects optionally.
    vm.runInContext(`
        window.dataRecords = window.dataRecords || {};
        window.dataSchema = window.dataSchema || {
            normalizeDb() {},
            generateRecordId(prefix) { return prefix + '-1'; },
            activeRecords(list) { return Array.isArray(list) ? list.filter(r => !r?.deleted) : []; }
        };
        window.dataUtils = window.dataUtils || {
            normalizeDb() {},
            generateRecordId(prefix) { return prefix + '-1'; },
            activeRecords(list) { return Array.isArray(list) ? list.filter(r => !r?.deleted) : []; },
            render() {},
            migrateLegacy() { return Promise.resolve(); }
        };
    `, context);
    vm.runInContext(read('data-store.js'), context);
    // Merge store methods onto a data-like host the same way data.js would.
    const data = /** @type {any} */ (Object.assign({
        DB_KEY: 'rehab_pro_universal_db',
        CFG_KEY: 'rehab_pro_universal_cfg',
        db: {
            actions: [],
            routines: [],
            history: [],
            health: { weights: [], foodLogs: [], exerciseLogs: [], aiAdviceChat: [] }
        },
        cfg: { mode: 'none' },
        _activePageId: activePage,
        render() {},
        normalizeDb() {},
        migrateLegacy() { return Promise.resolve(); },
        scheduleAdviceColdStart() {},
        bindFlushHooks() {},
        restoreActionDraft() {},
        activeRecords(list) { return Array.isArray(list) ? list.filter((r) => !r?.deleted) : []; },
        generateRecordId(prefix) { return `${prefix}-1`; },
        _initHistoryApi() {
            /** @type {any} */ (this).history = {
                append() {},
                update() {},
                deleteById() { return false; },
                queryRecent() { return Promise.resolve([]); },
                getAll() { return Promise.resolve([]); },
                count() { return Promise.resolve(0); }
            };
        },
        _initAdviceApi() {
            /** @type {any} */ (this).advice = {
                setActiveRecords() {},
                flush() { return Promise.resolve(); }
            };
        },
        beginActionBusy() { return true; },
        endActionBusy() {}
    }, context.window.dataStore));

    context.window.data = data;
    return {
        data,
        toasts,
        writes,
        setActivePage(id) {
            activePage = id;
            data._activePageId = id;
        },
        bumpNav() { navToken += 1; },
        seedWriteCount: writes.length
    };
}

test('FIND-12 source contract: whenReady + ensureDataReady exist', () => {
    const src = read('data-store.js');
    assert.match(src, /ensureDataReady/);
    assert.match(src, /whenReady\s*\(/);
    assert.match(src, /markDataReady/);
    assert.match(src, /markDataFailed/);
    assert.match(src, /_readyState/);
});

test('FIND-12 pending double-click runs action once after ready', async () => {
    const h = createStoreContext();
    let runs = 0;
    const p1 = h.data.whenReady(async () => { runs += 1; return 'ok'; }, { busyKey: 'openDiet' });
    const p2 = h.data.whenReady(async () => { runs += 1; return 'ok'; }, { busyKey: 'openDiet' });
    assert.equal(h.data._readyState, 'pending');
    h.data.markDataReady();
    const results = await Promise.all([p1, p2]);
    assert.deepEqual(results, ['ok', 'ok']);
    assert.equal(runs, 1, 'single-flight: only one action execution');
});

test('FIND-12 init success path: ensureDataReady true then save writes', async () => {
    const h = createStoreContext({
        seedDb: {
            actions: [{ id: 'a1' }],
            routines: [],
            history: [],
            health: { weights: [], foodLogs: [], exerciseLogs: [], aiAdviceChat: [] },
            schemaVersion: 3
        }
    });
    // Simulate successful init without full storage migrate.
    h.data._storage = h.data.createLocalStorageAdapter();
    h.data._storageMode = 'localStorage';
    h.data.markDataReady();
    assert.equal(await h.data.ensureDataReady(), true);
    const before = h.writes.length;
    h.data.save({ render: false, sync: false });
    assert.ok(h.writes.length > before, 'save after ready must write');
});

test('FIND-12 init failure cancels action and blocks empty-db overwrite', async () => {
    const h = createStoreContext({
        seedDb: {
            actions: [{ id: 'keep-me' }],
            routines: [],
            history: [],
            health: { foodLogs: [], weights: [], exerciseLogs: [], aiAdviceChat: [] }
        }
    });
    let runs = 0;
    const pending = h.data.whenReady(() => { runs += 1; return 'ran'; }, { busyKey: 'saveFood' });
    h.data.markDataFailed(new Error('boom'));
    const result = await pending;
    assert.equal(result, undefined);
    assert.equal(runs, 0);
    assert.ok(h.toasts.some((t) => /数据初始化失败/.test(t.msg)));

    const before = h.writes.length;
    const saveResult = h.data.save({ render: false, sync: false });
    assert.equal(saveResult, undefined);
    assert.equal(h.writes.length, before, 'failed init must not write empty default db');
});

test('FIND-12 route changed before init cancels queued action', async () => {
    const h = createStoreContext({ activePage: 'today' });
    let runs = 0;
    const pending = h.data.whenReady(() => { runs += 1; }, {
        busyKey: 'openDiet',
        routeAtClick: 'today',
        navigationGeneration: 0
    });
    h.setActivePage('records');
    h.bumpNav();
    h.data.markDataReady();
    await pending;
    assert.equal(runs, 0, 'navigating away cancels queued first-paint write');
});

test('FIND-12 ready action runs immediately once', async () => {
    const h = createStoreContext();
    h.data.markDataReady();
    let runs = 0;
    await h.data.whenReady(() => { runs += 1; });
    await h.data.whenReady(() => { runs += 1; });
    assert.equal(runs, 2);
});

test('FIND-12 ready state is listed in dataStore runtimeStateKeys', () => {
    const src = read('data-store.js');
    assert.match(src, /__runtimeStateKeys/);
    assert.match(src, /_readyState/);
    assert.match(src, /_readyPromise/);
});
