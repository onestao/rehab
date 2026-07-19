import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import path from 'node:path';

function read(file) {
    return readFileSync(path.join(process.cwd(), file), 'utf8');
}

function createGateContext() {
    const toasts = [];
    const errors = [];
    const loadLog = [];
    let planUiReady = false;
    let loadShouldFail = false;
    let loadDelayMs = 0;
    let openCalls = 0;
    let drawerCalls = 0;

    const context = {
        console,
        document: {
            querySelector() { return { id: 'today' }; },
            querySelectorAll() { return []; },
            createElement() {
                return {
                    className: '',
                    setAttribute() {},
                    style: {},
                    innerHTML: '',
                    querySelectorAll() { return []; },
                    querySelector() { return null },
                    appendChild() {}
                };
            },
            body: { appendChild() {} },
            addEventListener() {}
        },
        window: {
            addEventListener() {},
            toast: { show(msg, type) { toasts.push({ msg, type }); } },
            errorBus: { report(tag, e) { errors.push({ tag, message: e?.message || String(e) }); } },
            ui: { _navigationToken: 0 },
            dataPlanUi: null,
            async loadAppScript(name) {
                loadLog.push(name);
                if (loadDelayMs) await new Promise((r) => setTimeout(r, loadDelayMs));
                if (loadShouldFail) throw new Error(`Failed to load script: ${name}`);
                if (name === 'plan-ui') {
                    planUiReady = true;
                    context.window.dataPlanUi = {
                        openNewPlanSheet(...args) {
                            openCalls += 1;
                            this._lastOpenArgs = args;
                            return { opened: true, args };
                        },
                        openPlanTaskDrawer(...args) {
                            drawerCalls += 1;
                            return { drawer: true, args };
                        },
                        handlePlanTaskTap() { return { tap: true }; },
                        selectTodayPlan() { return { selected: true }; },
                        openPlanTodayAiSheet() { return { ai: true }; },
                        enhanceTodayPage() { return { enhanced: true }; }
                    };
                }
            }
        }
    };
    context.globalThis = context;
    context.window.window = context.window;
    context.window.document = context.document;
    vm.createContext(context);
    vm.runInContext(read('data-ui-state.js'), context);
    vm.runInContext(read('data.js'), context);

    return {
        context,
        toasts,
        errors,
        loadLog,
        get openCalls() { return openCalls; },
        get drawerCalls() { return drawerCalls; },
        setLoadDelay(ms) { loadDelayMs = ms; },
        setFail(flag) { loadShouldFail = flag; },
        setRoute(id) {
            context.document.querySelector = () => ({ id });
            context.context?.window && (context.window.data._activePageId = id);
            context.window.data._activePageId = id;
        },
        bumpNav() {
            context.window.ui._navigationToken += 1;
        },
        get data() { return context.window.data; }
    };
}

test('plan feature gate stubs exist before plan-ui loads', () => {
    const h = createGateContext();
    assert.equal(typeof h.data.openNewPlanSheet, 'function');
    assert.equal(h.data.openNewPlanSheet.__isPlanFeatureGateStub, true);
    assert.equal(typeof h.data.planFeatureGate?.run, 'function');
    assert.equal(h.data.planFeatureGate.getState(), 'unloaded');
});

test('first openNewPlanSheet waits for plan-ui then replays once', async () => {
    const h = createGateContext();
    h.setLoadDelay(30);
    const result = await h.data.openNewPlanSheet({ defaultTypes: ['rehab'] });
    assert.deepEqual(result, { opened: true, args: [{ defaultTypes: ['rehab'] }] });
    assert.equal(h.openCalls, 1);
    assert.ok(h.loadLog.filter((n) => n === 'plan-ui').length >= 1);
    assert.equal(h.data.planFeatureGate.getState(), 'ready');
    // real method should replace stub after refresh
    assert.notEqual(h.data.openNewPlanSheet.__isPlanFeatureGateStub, true);
});

test('rapid repeated openNewPlanSheet only loads and opens once', async () => {
    const h = createGateContext();
    h.setLoadDelay(40);
    // Fire five synchronous clicks before any load settles.
    const p1 = h.data.openNewPlanSheet();
    const p2 = h.data.openNewPlanSheet();
    const p3 = h.data.openNewPlanSheet();
    const p4 = h.data.openNewPlanSheet();
    const p5 = h.data.openNewPlanSheet();
    const results = await Promise.all([p1, p2, p3, p4, p5]);
    // Single-flight: one network load, one real modal open. Joiners share the same promise result.
    assert.equal(h.loadLog.filter((n) => n === 'plan-ui').length, 1, 'plan-ui should load once');
    assert.equal(h.openCalls, 1, `expected one modal open, got ${h.openCalls}; results=${JSON.stringify(results)}`);
    assert.ok(results.every((r) => r && r.opened), 'joiners should settle with the shared open result');
});

test('plan-ui load failure shows user toast and allows retry', async () => {
    const h = createGateContext();
    h.setFail(true);
    const first = await h.data.openNewPlanSheet();
    assert.equal(first, undefined);
    assert.equal(h.openCalls, 0);
    assert.ok(h.toasts.some((t) => /计划功能暂时未加载成功/.test(t.msg)));
    assert.equal(h.data.planFeatureGate.getState(), 'failed');
    assert.equal(h.data._actionBusy?.openNewPlanSheet, undefined);

    h.setFail(false);
    const second = await h.data.openNewPlanSheet();
    assert.deepEqual(second, { opened: true, args: [] });
    assert.equal(h.openCalls, 1);
});

test('does not open plan modal after leaving Today', async () => {
    const h = createGateContext();
    h.setLoadDelay(50);
    const pending = h.data.openNewPlanSheet();
    h.setRoute('records');
    h.bumpNav();
    const result = await pending;
    assert.equal(result, undefined);
    assert.equal(h.openCalls, 0);
});

test('source contracts: plan openers and fail toast are wired', () => {
    const source = read('data.js');
    assert.match(source, /planFeatureGate/);
    assert.match(source, /LAZY_PLAN_OPENERS/);
    assert.match(source, /openNewPlanSheet/);
    assert.match(source, /计划功能暂时未加载成功/);
    assert.match(source, /attachPlanFeatureGate/);
    const uiState = read('data-ui-state.js');
    assert.match(uiState, /openNewPlanSheet/);
});
