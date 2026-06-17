import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadVirtualHarness() {
    let now = 0;
    const context = {
        window: {},
        console,
        setTimeout,
        clearTimeout,
        performance: { now: () => now }
    };
    context.globalThis = context;
    vm.createContext(context);
    const code = fs.readFileSync(new URL('../advice-virtual-list.js', import.meta.url), 'utf8');
    vm.runInContext(code, context);
    return {
        api: context.window.adviceVirtualList,
        window: context.window,
        setNow(value) { now = value; }
    };
}

function createVirtualHost() {
    let inner = null;
    const host = {
        dataset: {},
        scrollTop: 0,
        scrollHeight: 0,
        clientHeight: 320,
        _html: '',
        set innerHTML(value) {
            this._html = String(value || '');
            if (this._html.includes('data-advice-virtual-inner')) {
                inner = {
                    style: {},
                    isConnected: true,
                    _html: '',
                    set innerHTML(next) { this._html = String(next || ''); },
                    get innerHTML() { return this._html; },
                    querySelectorAll: () => []
                };
            }
        },
        get innerHTML() { return this._html; },
        querySelector(selector) {
            return selector === '[data-advice-virtual-inner]' ? inner : null;
        }
    };
    return { host, inner: () => inner };
}

test('LRUSegmentCache uses fixed 100-item segment math and evicts oldest segments', () => {
    const { api } = loadVirtualHarness();
    const cache = new api.LRUSegmentCache({ capacity: 4, segmentSize: 100 });

    assert.equal(cache.segmentIdForIndex(0), 0);
    assert.equal(cache.segmentIdForIndex(99), 0);
    assert.equal(cache.segmentIdForIndex(100), 1);

    for (let i = 0; i < 5; i++) cache.set(i, [{ id: `m${i}`, content: `message ${i}` }], [`m${i}`]);

    assert.equal(JSON.stringify(cache.keys()), JSON.stringify([1, 2, 3, 4]));
    assert.equal(cache.getRecordById('m0'), null);
    assert.equal(cache.getRecordById('m4').content, 'message 4');
});

test('LagSmoothingFilter increases immediately and decays slowly', () => {
    const harness = loadVirtualHarness();
    const filter = new harness.api.LagSmoothingFilter({ minBudget: 1, maxBudget: 4, decayDelayMs: 100, decayStepMs: 50 });

    harness.setNow(0);
    assert.equal(filter.observeLag(3), 3);
    harness.setNow(20);
    assert.equal(filter.observeLag(0), 3);
    harness.setNow(160);
    assert.equal(filter.observeLag(0), 2);
});

test('AdviceVirtualStore keeps immutable id snapshots and resolves soft versus hard mismatches', () => {
    const { api } = loadVirtualHarness();
    const store = api.createStore({ fetchByIds: async () => [] });
    const first = store.setActiveRecords([
        { id: 'a', role: 'user', content: 'one' },
        { id: 'b', role: 'assistant', content: 'two' }
    ], 'today');

    const originalRef = first.activeIdsRef;
    assert.equal(store.getItem(0, first.version).id, 'a');

    store.upsertRecord({ id: 'a', role: 'user', content: 'one edited' });
    const soft = store.getItem(0, first.version);
    assert.equal(soft.content, 'one edited');

    const second = store.setActiveIds(['a', 'b'], 'search');
    assert.notEqual(second.activeIdsRef, originalRef);
    assert.equal(store.getItem(0, first.version).skeleton, true);
    assert.equal(store.getItem(0, first.version).stale, true);
});

test('QueryPlanningLayer throttles emergency prefetch with cooldown state machine', async () => {
    const harness = loadVirtualHarness();
    const ids = Array.from({ length: 300 }, (_, index) => `m${index}`);
    let fetches = 0;
    const planner = new harness.api.QueryPlanningLayer({
        getActiveIds: () => ids,
        fetchByIds: async requested => {
            fetches += 1;
            return requested.map(id => ({ id, content: id }));
        },
        missThreshold: 1,
        cooldownMs: 1000,
        recoveryMs: 100
    });

    harness.setNow(0);
    assert.equal(planner.recordMiss(0), false);
    assert.equal(planner.recordMiss(0), true);
    assert.equal(planner.telemetry().state, 'DEGRADED');

    harness.setNow(10);
    assert.equal(planner.recordMiss(250), false);
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.equal(planner.telemetry().emergencyCount, 1);
    assert.equal(fetches > 0, true);
});

test('mountVirtualList renders a fallback window when virtual-core reports no rows yet', () => {
    const harness = loadVirtualHarness();
    const { api } = harness;
    harness.window.VirtualCore = {
        observeElementRect: () => () => {},
        observeElementOffset: () => () => {},
        elementScroll: () => {},
        measureElement: () => {},
        Virtualizer: class {
            constructor(options) { this.options = options; }
            _didMount() { return () => {}; }
            _willUpdate() {}
            setOptions(options) { this.options = options; }
            getVirtualItems() { return []; }
            getTotalSize() { return 0; }
            measureElement() {}
        }
    };
    const store = api.createStore({ fetchByIds: async () => [] });
    store.setActiveRecords([
        { id: 'a', role: 'user', content: 'first' },
        { id: 'b', role: 'assistant', content: 'second' },
        { id: 'c', role: 'assistant', content: 'third' }
    ], 'all');

    const { host, inner } = createVirtualHost();
    const controller = api.mountVirtualList(host, {
        store,
        initialHeight: 50,
        renderItem: (msg) => `<div class="row">${msg.content}</div>`
    });

    assert.ok(controller);
    assert.equal(host.dataset.adviceVirtualActive, 'true');
    assert.match(inner().innerHTML, /advice-virtual-row/);
    assert.match(inner().innerHTML, /first/);
    assert.match(inner().innerHTML, /third/);

    controller.destroy();
    assert.equal(host.dataset.adviceVirtualActive, undefined);
});
