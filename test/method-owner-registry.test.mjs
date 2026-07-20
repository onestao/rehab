/**
 * FIND-11: method-owner registry + refreshModules ownership contracts.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

function read(file) {
    return readFileSync(path.join(process.cwd(), file), 'utf8');
}

function createOwnerContext() {
    const toasts = [];
    const errors = [];
    const loadLog = [];
    let dietReady = false;
    let loadShouldFail = false;

    const context = {
        console,
        document: {
            querySelector() { return { id: 'today' }; },
            querySelectorAll() { return []; },
            getElementById() { return null; },
            createElement() {
                return {
                    className: '',
                    setAttribute() {},
                    style: {},
                    innerHTML: '',
                    querySelectorAll() { return []; },
                    querySelector() { return null; },
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
            dataHealthDiet: null,
            dataPlanUi: null,
            async loadAppScript(name) {
                loadLog.push(name);
                if (loadShouldFail) throw new Error(`Failed to load script: ${name}`);
                if (name === 'health-diet' || name === 'fooddb' || name === 'food-log') {
                    dietReady = true;
                    context.window.dataHealthDiet = {
                        openDietModal(...args) {
                            this._openArgs = args;
                            return { opened: true, args };
                        }
                    };
                }
                if (name === 'plan-ui') {
                    context.window.dataPlanUi = {
                        openNewPlanSheet(...args) {
                            return { opened: true, args };
                        },
                        openPlanTaskDrawer() { return { drawer: true }; },
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
        setFail(flag) { loadShouldFail = flag; },
        get data() { return context.window.data; },
        get dietReady() { return dietReady; }
    };
}

test('FIND-11 registry exposes lazy record + plan openers', () => {
    const h = createOwnerContext();
    const reg = h.data.getMethodOwnerRegistry();
    assert.ok(Array.isArray(reg.methods));
    const diet = reg.methods.find((m) => m.method === 'openDietModal');
    assert.ok(diet);
    assert.equal(diet.ownerModule, 'dataHealthDiet');
    assert.equal(diet.isStub, true);
    assert.equal(diet.gateOrStubIdentity, 'lazy-record-stub');
    assert.equal(h.data.openDietModal.__isLazyRecordOpenerStub, true);

    const plan = reg.methods.find((m) => m.method === 'openNewPlanSheet');
    assert.ok(plan);
    assert.equal(plan.ownerModule, 'dataPlanUi');
    assert.equal(plan.isStub, true);
});

test('FIND-11 stub → real: load replaces stub and refresh keeps owner identity', async () => {
    const h = createOwnerContext();
    const stub = h.data.openDietModal;
    assert.equal(stub.__isLazyRecordOpenerStub, true);

    const result = await h.data.openDietModal({ from: 'test' });
    assert.deepEqual(result, { opened: true, args: [{ from: 'test' }] });
    assert.ok(h.loadLog.includes('health-diet'));

    const after = h.data.openDietModal;
    assert.notEqual(after.__isLazyRecordOpenerStub, true);
    assert.equal(typeof after, 'function');

    const realRef = after;
    h.data.refreshModules();
    h.data.refreshModules();
    h.data.refreshModules();
    assert.equal(h.data.openDietModal, realRef, 'refreshModules must not reinstall stub over real opener');
    assert.equal(h.data.openDietModal, h.context.window.dataHealthDiet.openDietModal);

    const reg = h.data.getMethodOwnerRegistry();
    const diet = reg.methods.find((m) => m.method === 'openDietModal');
    assert.equal(diet.isStub, false);
    assert.equal(diet.hasRealImplementation, true);
    assert.equal(diet.currentIsOwnerImpl, true);
});

test('FIND-11 real implementation present: attach never reinstalls stub', () => {
    const h = createOwnerContext();
    const real = function openDietModal() { return 'real'; };
    h.context.window.dataHealthDiet = { openDietModal: real };
    h.data.refreshModules();
    assert.equal(h.data.openDietModal, real);
    h.data.refreshModules();
    assert.equal(h.data.openDietModal, real);
    assert.notEqual(h.data.openDietModal.__isLazyRecordOpenerStub, true);
});

test('FIND-11 load failure then retry restores real opener', async () => {
    const h = createOwnerContext();
    h.setFail(true);
    const first = await h.data.openDietModal();
    assert.equal(first, undefined);
    assert.ok(h.toasts.some((t) => /饮食记录加载失败/.test(t.msg)));
    assert.equal(h.data.openDietModal.__isLazyRecordOpenerStub, true);

    h.setFail(false);
    const second = await h.data.openDietModal();
    assert.deepEqual(second, { opened: true, args: [] });
    assert.notEqual(h.data.openDietModal.__isLazyRecordOpenerStub, true);
});

test('FIND-11 plan gate: real methods survive repeated refreshModules', async () => {
    const h = createOwnerContext();
    await h.data.openNewPlanSheet({ defaultTypes: ['rehab'] });
    const real = h.data.openNewPlanSheet;
    assert.notEqual(real.__isPlanFeatureGateStub, true);
    h.data.refreshModules();
    h.data.refreshModules();
    assert.equal(h.data.openNewPlanSheet, real);
    assert.notEqual(h.data.openNewPlanSheet.__isPlanFeatureGateStub, true);
});

test('FIND-11 runtime state keys survive refreshModules merge', () => {
    const h = createOwnerContext();
    // data-ui-state registers __runtimeStateKeys; set a key if present.
    const keys = h.data.getMethodOwnerRegistry().runtimeStateKeys;
    assert.ok(Array.isArray(keys));
    if (keys.length) {
        const key = keys[0];
        const sentinel = { marker: 'find-11' };
        h.data[key] = sentinel;
        h.data.refreshModules();
        assert.equal(h.data[key], sentinel, `runtime key ${key} must survive merge`);
    }
});

test('FIND-11 source contract: lazy record stubs use identity flag', () => {
    const src = read('data.js');
    assert.match(src, /__isLazyRecordOpenerStub/);
    assert.match(src, /getMethodOwnerRegistry/);
    assert.match(src, /resolveRecordOpener/);
});
