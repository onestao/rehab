import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import path from 'node:path';

function read(file) {
    return readFileSync(path.join(process.cwd(), file), 'utf8');
}

test('lazy record openers expose static busy and recover on failure', () => {
    const source = read('data.js');
    const uiState = read('data-ui-state.js');
    assert.match(uiState, /beginActionBusy\(key, label\)/);
    assert.match(uiState, /endActionBusy\(key\)/);
    assert.match(source, /data\.beginActionBusy\?\.\(method, '加载中'\)/);
    assert.match(source, /data\.endActionBusy\?\.\(method\)/);
    assert.match(source, /openPlanAiSheet[\s\S]*data\.beginActionBusy\?\.\('openPlanAiSheet'/);
    assert.match(uiState, /textContent = label/);
    assert.doesNotMatch(source, /document\.querySelectorAll/);
    assert.doesNotMatch(uiState, /innerHTML\s*=\s*label/);
});

test('plan task edit shows busy while plan-ai loads and allows retry', () => {
    const source = read('plan-ui.js');
    assert.match(source, /openPlanTaskEdit[\s\S]*_planTaskEditBusy/);
    assert.match(source, /aria-busy','true'|aria-busy", "true"|setAttribute\('aria-busy', 'true'\)/);
    assert.match(source, /编辑计划模块加载失败，请稍后重试/);
});

test('check update lazy-loads app-update instead of claiming unsupported', () => {
    const data = read('data.js');
    const routine = read('routine-library.js');
    assert.match(data, /async function checkAppUpdate\(/);
    assert.match(data, /return await window\.appUpdate\.checkNow\(\)/);
    assert.match(data, /attachStableUpdateCheck/);
    assert.match(data, /loadAppScript\('app-update'\)/);
    assert.doesNotMatch(routine, /async checkAppUpdate\(/);
    assert.doesNotMatch(routine, /loadAppScript\('app-update'\)/);
    assert.doesNotMatch(routine, /当前环境无法检测更新/);
});

test('service worker registration does not eagerly load app-update', () => {
    const index = read('index.html');
    const registration = index.slice(index.indexOf('function scheduleServiceWorkerRegistration'), index.indexOf('function idlePreloadEnabled'));
    assert.doesNotMatch(registration, /loadScript\('app-update'\)/);
    assert.match(registration, /navigator\.serviceWorker\.register\('\.\/sw\.js'/);
});

test('update check remains busy until deferred checkNow settles and retries after failure', async () => {
    class FakeHTMLElement {
        constructor() {
            this.disabled = false;
            this.dataset = {};
            this.attributes = {};
            this.label = { textContent: '检测更新', classList: { contains() { return false; } } };
            this.classList = { add() {}, remove() {} };
        }
        setAttribute(name, value) { this.attributes[name] = value; }
        removeAttribute(name) { delete this.attributes[name]; }
        querySelector(selector) { return selector === '.pvf-check-label' ? this.label : null; }
        querySelectorAll() { return [this.label]; }
    }
    const button = new FakeHTMLElement();
    let loadAttempts = 0;
    /** @type {(value: any) => void} */
    let resolveCheck = (value) => { void value; };
    const deferred = new Promise(resolve => { resolveCheck = resolve; });
    const context = {
        console,
        HTMLElement: FakeHTMLElement,
        Element: class Element {},
        document: {
            querySelectorAll(selector) { return selector === '#profileUpdateCheckBtn' ? [button] : []; },
            addEventListener() {},
            getElementById() { return null; }
        },
        window: {
            addEventListener() {},
            toast: { show() {} },
            errorBus: { report() {} }
        }
    };
    context.globalThis = context;
    context.window.window = context.window;
    context.window.document = context.document;
    vm.createContext(context);
    vm.runInContext(read('data-ui-state.js'), context);
    context.window.loadAppScript = async () => {
        loadAttempts += 1;
        if (loadAttempts === 1) throw new Error('first load failed');
        context.window.appUpdate = { checkNow: () => deferred };
    };
    vm.runInContext(read('data.js'), context);
    await context.window.data.checkAppUpdate();
    assert.equal(button.disabled, false);
    assert.equal(button.attributes['aria-busy'], undefined);
    assert.equal(button.label.textContent, '检测更新');
    const pending = context.window.data.checkAppUpdate();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(button.disabled, true);
    assert.equal(button.attributes['aria-busy'], 'true');
    assert.equal(button.label.textContent, '检测中...');
    resolveCheck({ ok: true });
    await pending;
    assert.equal(button.disabled, false);
    assert.equal(button.attributes['aria-busy'], undefined);
    assert.equal(button.label.textContent, '检测更新');
    assert.equal(loadAttempts, 2);
});
