// @ts-nocheck
/**
 * Completion lifecycle for PWA updates:
 * after controllerchange with an already-current document, the update banner
 * and remembered waiting worker must be cleared (not left as a false "new version").
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appUpdateSource = fs.readFileSync(path.join(root, 'app-update.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const releaseVersion = (
    html.match(/const releaseVersion = ['"](\d+)['"]/)
    || appUpdateSource.match(/version:\s*['"](\d+)['"]/)
    || []
)[1];
assert.ok(releaseVersion, 'release version missing');
const v = releaseVersion;

function createCompletionHarness({
    pageVersion = v,
    controllerVersion = String(Number(v) - 1),
    bannerPresent = true
} = {}) {
    const reloads = [];
    const toasts = [];
    const controllerMessages = [];
    const intervalCallbacks = new Map();
    let nextIntervalId = 1;
    const swListeners = {
        controllerchange: [],
        message: []
    };

    const banner = {
        classList: {
            _hidden: true,
            contains(name) { return name === 'hidden' ? this._hidden : false; },
            add(name) { if (name === 'hidden') this._hidden = true; },
            remove(name) { if (name === 'hidden') this._hidden = false; }
        },
        querySelector(sel) {
            if (sel === 'strong' || sel === 'small') return { textContent: '' };
            return null;
        },
        querySelectorAll() {
            return [
                { textContent: '', onclick: null },
                { textContent: '', onclick: null }
            ];
        }
    };

    let titleNode = { textContent: '' };
    let detailNode = { textContent: '' };
    banner.querySelector = (sel) => {
        if (sel === 'strong') return titleNode;
        if (sel === 'small') return detailNode;
        return null;
    };

    let upgradeOverlay = null;
    let controller = controllerVersion
        ? {
            scriptURL: `https://example.test/sw.js?v=${controllerVersion}`,
            state: 'activated',
            postMessage(msg) { controllerMessages.push(msg); }
        }
        : null;

    const registration = {
        waiting: null,
        installing: null,
        async update() {},
        addEventListener() {},
        removeEventListener() {}
    };

    const windowObj = {
        location: {
            href: 'https://example.test/index.html',
            reload() { reloads.push('reload'); }
        },
        errorBus: { event() {}, report() {} },
        toast: { show(msg, type) { toasts.push({ msg, type }); } },
        data: {},
        workout: { isPlaying: false },
        workoutSystem: { isPlaying: false },
        cardio: { isRunning: false },
        localStorage: {
            getItem() { return null; },
            setItem() {},
            removeItem() {}
        },
        setTimeout: (...args) => {
            const id = setTimeout(...args);
            if (typeof id?.unref === 'function') id.unref();
            return id;
        },
        clearTimeout,
        setInterval(callback) {
            const id = nextIntervalId++;
            intervalCallbacks.set(id, callback);
            return id;
        },
        clearInterval(id) { intervalCallbacks.delete(id); }
    };

    const navigatorObj = {
        serviceWorker: {
            get controller() { return controller; },
            set controller(value) { controller = value; },
            addEventListener(type, handler) {
                if (swListeners[type]) swListeners[type].push(handler);
            },
            removeEventListener(type, handler) {
                if (!swListeners[type]) return;
                swListeners[type] = swListeners[type].filter((h) => h !== handler);
            },
            async getRegistration() { return registration; },
            async register() { return registration; }
        }
    };

    const documentObj = {
        scripts: [{ src: `https://example.test/data.js?v=${pageVersion}` }],
        body: {
            appendChild(el) {
                if (el?.id === 'rehabUpgradeOverlay') upgradeOverlay = el;
            },
            removeChild() {}
        },
        getElementById(id) {
            if (id === 'appUpdateBanner') return bannerPresent ? banner : null;
            if (id === 'rehabUpgradeOverlay') return upgradeOverlay;
            if (id === 'profileUpdateCheckBtn') {
                return {
                    disabled: false,
                    querySelector() { return { textContent: '' }; }
                };
            }
            return null;
        },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        createElement(tag) {
            return {
                tagName: String(tag || '').toUpperCase(),
                id: '',
                style: { cssText: '', display: '' },
                textContent: '',
                setAttribute() {},
                appendChild() {},
                querySelector() { return { textContent: '' }; },
                remove() {
                    if (this.id === 'rehabUpgradeOverlay') upgradeOverlay = null;
                },
                _keyHandler: null
            };
        },
        addEventListener() {},
        removeEventListener() {}
    };

    const toast = windowObj.toast;
    const context = {
        window: windowObj,
        document: documentObj,
        navigator: navigatorObj,
        toast,
        URL,
        Object,
        console,
        setTimeout: windowObj.setTimeout,
        clearTimeout,
        setInterval: windowObj.setInterval,
        clearInterval: windowObj.clearInterval,
        Number,
        String,
        Date,
        Math,
        Promise
    };
    context.globalThis = context;
    windowObj.window = windowObj;
    vm.createContext(context);
    vm.runInContext(appUpdateSource, context, { filename: 'app-update.js' });

    const appUpdate = context.window.appUpdate;
    appUpdate.version = v;
    appUpdate.swUrl = `./sw.js?v=${v}`;
    appUpdate.registration = registration;
    appUpdate.prepareWaitingWorker = async () => true;

    return {
        appUpdate,
        reloads,
        toasts,
        controllerMessages,
        banner,
        titleNode,
        registration,
        get upgradeOverlay() { return upgradeOverlay; },
        setController(next) {
            controller = next;
        },
        fireControllerChange() {
            for (const handler of [...swListeners.controllerchange]) handler();
        },
        makeWorker(state = 'installed', scriptVersion = v) {
            return {
                state,
                scriptURL: `https://example.test/sw.js?v=${scriptVersion}`,
                postMessage() {}
            };
        }
    };
}

test('T1: completed update with current document clears banner and waitingWorker without reload', () => {
    const h = createCompletionHarness({
        pageVersion: v,
        controllerVersion: String(Number(v) - 1)
    });
    const installed = h.makeWorker('installed', v);

    h.appUpdate.show(installed);
    assert.equal(h.banner.classList.contains('hidden'), false);
    assert.equal(h.titleNode.textContent, '发现新版本');
    assert.equal(h.appUpdate.waitingWorker, installed);

    h.appUpdate.bindControllerReload(true);
    h.appUpdate.showUpgradeOverlay('正在完成更新…');
    assert.ok(h.upgradeOverlay);

    h.setController({
        scriptURL: `https://example.test/sw.js?v=${v}`,
        state: 'activated',
        postMessage(msg) { h.controllerMessages.push(msg); }
    });
    h.fireControllerChange();

    assert.equal(h.reloads.length, 0, 'must not reload when document scripts already match');
    assert.equal(h.banner.classList.contains('hidden'), true, 'banner must be hidden after completion');
    assert.equal(h.upgradeOverlay, null, 'upgrade overlay must be removed');
    assert.equal(h.appUpdate.waitingWorker, null, 'waitingWorker must be cleared');
    assert.equal(h.controllerMessages.length, 1);
    assert.equal(h.controllerMessages[0].type, 'V327_PAGE_READY');
    assert.equal(h.controllerMessages[0].version, v);
});

test('T2: checkNow ignores activated stale waitingWorker references', async () => {
    const h = createCompletionHarness({
        pageVersion: v,
        controllerVersion: v
    });
    const stale = h.makeWorker('activated', v);
    h.registration.waiting = null;
    h.registration.installing = null;
    h.appUpdate.waitingWorker = stale;
    h.banner.classList.add('hidden');

    const result = await h.appUpdate.checkNow();

    assert.equal(result.ok, true);
    assert.equal(result.updateFound, false);
    assert.ok(h.toasts.some((t) => t.msg === '已是最新版本'));
    assert.equal(h.banner.classList.contains('hidden'), true, 'must not re-show banner');
    assert.equal(h.appUpdate.waitingWorker, null, 'stale activated worker must be cleared');
});

test('T3: real installed waiting worker still surfaces update', async () => {
    const h = createCompletionHarness({
        pageVersion: v,
        controllerVersion: v
    });
    const waiting = h.makeWorker('installed', v);
    h.registration.waiting = waiting;
    h.registration.installing = null;
    h.appUpdate.waitingWorker = null;

    const result = await h.appUpdate.checkNow();

    assert.equal(result.ok, true);
    assert.equal(result.updateFound, true);
    assert.equal(h.banner.classList.contains('hidden'), false);
    assert.equal(h.titleNode.textContent, '发现新版本');
    assert.equal(h.appUpdate.waitingWorker, waiting);
});

test('T4: page scripts current but controller still old keeps legitimate waiting banner', () => {
    const h = createCompletionHarness({
        pageVersion: v,
        controllerVersion: String(Number(v) - 1)
    });
    const waiting = h.makeWorker('installed', v);

    h.appUpdate.show(waiting);

    assert.equal(h.banner.classList.contains('hidden'), false, 'must still show pending update');
    assert.equal(h.titleNode.textContent, '发现新版本');
    assert.equal(h.appUpdate.waitingWorker, waiting);
    assert.equal(h.appUpdate.documentNeedsControllerReload(), true,
        'controller mismatch still requires reload once activation completes');
});



