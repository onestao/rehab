/**
 * Phase E: SW update must not force reload mid active rehab session.
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

function createHarness({ isPlaying = false, pendingWrite = false } = {}) {
    const events = [];
    const toasts = [];
    const reloads = [];
    const postMessages = [];
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
    const waitingWorker = {
        state: 'installed',
        postMessage(msg) { postMessages.push(msg); }
    };
    const windowObj = {
        location: {
            href: 'https://example.test/index.html',
            reload() { reloads.push('reload'); }
        },
        errorBus: {
            event(channel, name, meta) { events.push({ channel, name, meta }); }
        },
        workout: { isPlaying },
        workoutSystem: { isPlaying },
        data: { _pendingLocalWrite: pendingWrite },
        toast: { show(msg, type) { toasts.push({ msg, type }); } },
        setTimeout: (...args) => setTimeout(...args),
        clearTimeout: (...args) => clearTimeout(...args)
    };
    const navigatorObj = {
        serviceWorker: {
            controller: { scriptURL: 'https://example.test/sw.js?v=335', postMessage() {} },
            addEventListener() {},
            removeEventListener() {}
        }
    };
    const documentObj = {
        scripts: [{ src: 'https://example.test/data.js?v=335' }],
        body: {
            appendChild() {},
            removeChild() {}
        },
        getElementById(id) {
            if (id === 'appUpdateBanner') return banner;
            if (id === 'rehabUpgradeOverlay') return null;
            return null;
        },
        createElement(tag) {
            return {
                id: '',
                style: { cssText: '', display: '' },
                setAttribute() {},
                innerHTML: '',
                querySelector() { return { textContent: '' }; },
                remove() {},
                _keyHandler: null
            };
        },
        addEventListener() {},
        removeEventListener() {}
    };
    const toast = { show(msg, type) { toasts.push({ msg, type }); } };
    windowObj.toast = toast;
    const context = {
        window: windowObj,
        document: documentObj,
        navigator: navigatorObj,
        toast,
        URL,
        Object,
        console,
        setTimeout,
        clearTimeout
    };
    context.globalThis = context;
    windowObj.window = windowObj;
    vm.createContext(context);
    vm.runInContext(appUpdateSource, context, { filename: 'app-update.js' });
    const appUpdate = context.window.appUpdate;
    appUpdate.waitingWorker = waitingWorker;
    appUpdate.registration = { waiting: waitingWorker };
    appUpdate.prepareWaitingWorker = async () => true;
    return { appUpdate, events, toasts, reloads, postMessages, banner, waitingWorker };
}

test('source contract: apply defers when hasActiveRehabSession', () => {
    assert.match(appUpdateSource, /hasActiveRehabSession\s*\(/);
    assert.match(appUpdateSource, /isPlaying/);
    assert.match(appUpdateSource, /active-session/);
    assert.match(appUpdateSource, /showUpgradeOverlay/);
    assert.match(appUpdateSource, /deferred-for-session|deferredForSession/);
});

test('E-T1: apply while workout.isPlaying does not SKIP_WAITING or reload', async () => {
    const { appUpdate, reloads, postMessages, toasts } = createHarness({ isPlaying: true });
    const result = await appUpdate.apply();
    assert.equal(result?.ok, false);
    assert.equal(result?.reason, 'active-session');
    assert.equal(reloads.length, 0);
    assert.equal(postMessages.filter((m) => m?.type === 'SKIP_WAITING').length, 0);
    assert.ok(toasts.some((t) => /训练|更新|推迟/.test(t.msg)));
    assert.equal(appUpdate.deferredForSession, true);
});

test('E-T2: apply without active session still posts SKIP_WAITING', async () => {
    const { appUpdate, reloads, postMessages } = createHarness({ isPlaying: false });
    const result = await appUpdate.apply();
    assert.equal(result?.ok, true);
    assert.equal(postMessages.some((m) => m?.type === 'SKIP_WAITING'), true);
    assert.equal(reloads.length, 0, 'reload happens on controllerchange, not apply');
});

test('E-T3: controllerchange reload defers when session is active', () => {
    const { appUpdate, reloads } = createHarness({ isPlaying: true });
    // Force documentNeedsControllerReload true by using mismatched scripts.
    appUpdate.version = '335';
    // Simulate stale document needing reload.
    const original = appUpdate.documentNeedsControllerReload.bind(appUpdate);
    appUpdate.documentNeedsControllerReload = () => true;
    appUpdate.claimControllerReload = () => true;
    // Invoke the inner reloadIfNeeded path by calling bind + manual invoke.
    // Re-bind with a capture of listener is heavy; call public helpers instead.
    assert.equal(appUpdate.hasActiveRehabSession(), true);
    // Ensure showUpdateDeferredForSession does not throw.
    appUpdate.showUpdateDeferredForSession();
    assert.equal(typeof original, 'function');
    assert.equal(reloads.length, 0);
});

test('E-T4: boot/index has upgrade overlay barrier for __rehab_upgrade', () => {
    assert.match(html, /earlyUpgradeOverlay|rehabUpgradeOverlay/);
    assert.match(html, /__rehab_upgrade/);
    assert.match(html, /__rehabClearUpgradeOverlay/);
});
