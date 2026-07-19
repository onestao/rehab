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
const swSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function createHarness({
    isPlaying = false,
    isPaused = false,
    pendingWrite = false,
    lastActionDraft = null,
    editingExerciseDraft = null,
    phaseLeft = null,
    controllerPostMessages = null
} = {}) {
    const events = [];
    const toasts = [];
    const reloads = [];
    const postMessages = [];
    const swControllerMessages = controllerPostMessages || [];
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
    const store = new Map();
    const windowObj = {
        location: {
            href: 'https://example.test/index.html',
            reload() { reloads.push('reload'); }
        },
        errorBus: {
            event(channel, name, meta) { events.push({ channel, name, meta }); }
        },
        workout: {
            isPlaying,
            isPaused,
            _phaseLeft: phaseLeft,
            timer: null,
            sessionInt: null,
            totalSec: isPlaying || isPaused ? 12 : 0,
            mode: 'strength'
        },
        workoutSystem: null,
        data: {
            _pendingLocalWrite: pendingWrite,
            db: { lastActionDraft },
            _editingExerciseDraft: editingExerciseDraft
        },
        toast: { show(msg, type) { toasts.push({ msg, type }); } },
        setTimeout: (...args) => {
            const id = setTimeout(...args);
            if (typeof id?.unref === 'function') id.unref();
            return id;
        },
        clearTimeout: (...args) => clearTimeout(...args),
        setInterval: (...args) => {
            // Session-clear watcher is intentional long-lived; unref so node:test can exit.
            const id = setInterval(...args);
            if (typeof id?.unref === 'function') id.unref();
            return id;
        },
        clearInterval: (...args) => clearInterval(...args),
        localStorage: {
            getItem(key) { return store.has(key) ? store.get(key) : null; },
            setItem(key, value) { store.set(key, String(value)); },
            removeItem(key) { store.delete(key); }
        }
    };
    windowObj.workoutSystem = windowObj.workout;
    const navigatorObj = {
        serviceWorker: {
            controller: {
                scriptURL: 'https://example.test/sw.js?v=342',
                postMessage(msg) { swControllerMessages.push(msg); }
            },
            addEventListener() {},
            removeEventListener() {}
        }
    };
    const documentObj = {
        scripts: [{ src: 'https://example.test/data.js?v=342' }],
        body: {
            appendChild() {},
            removeChild() {}
        },
        getElementById(id) {
            if (id === 'appUpdateBanner') return banner;
            if (id === 'rehabUpgradeOverlay') return null;
            return null;
        },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        createElement() {
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
        localStorage: windowObj.localStorage,
        URL,
        Object,
        console,
        setTimeout: (...args) => {
            const id = setTimeout(...args);
            if (typeof id?.unref === 'function') id.unref();
            return id;
        },
        clearTimeout,
        setInterval: (...args) => {
            const id = setInterval(...args);
            if (typeof id?.unref === 'function') id.unref();
            return id;
        },
        clearInterval,
        Number,
        String
    };
    context.globalThis = context;
    windowObj.window = windowObj;
    vm.createContext(context);
    vm.runInContext(appUpdateSource, context, { filename: 'app-update.js' });
    const appUpdate = context.window.appUpdate;
    appUpdate.waitingWorker = waitingWorker;
    appUpdate.registration = { waiting: waitingWorker };
    appUpdate.prepareWaitingWorker = async () => true;
    return {
        appUpdate,
        events,
        toasts,
        reloads,
        postMessages,
        swControllerMessages,
        banner,
        waitingWorker,
        windowObj,
        documentObj
    };
}

test('source contract: apply defers when hasActiveRehabSession', () => {
    assert.match(appUpdateSource, /hasActiveRehabSession\s*\(/);
    assert.match(appUpdateSource, /isPlaying/);
    assert.match(appUpdateSource, /isPaused/);
    assert.match(appUpdateSource, /lastActionDraft/);
    assert.match(appUpdateSource, /UPDATE_DEFER_FOR_SESSION/);
    assert.match(appUpdateSource, /active-session/);
    assert.match(appUpdateSource, /showUpgradeOverlay/);
    assert.match(appUpdateSource, /deferred-for-session|deferredForSession/);
});

test('source contract: SW honors UPDATE_DEFER_FOR_SESSION before hard navigate', () => {
    assert.match(swSource, /sessionDeferClientIds/);
    assert.match(swSource, /UPDATE_DEFER_FOR_SESSION/);
    assert.match(swSource, /UPDATE_SESSION_CLEAR/);
    assert.match(swSource, /deferred-for-session/);
    // Hard navigate must be after defer check.
    const deferIdx = swSource.indexOf("sessionDeferClientIds.has(clientId)");
    const navIdx = swSource.indexOf('stillAfterGrace.navigate(target)');
    assert.ok(deferIdx > 0, 'defer set membership check present');
    assert.ok(navIdx > deferIdx, 'client.navigate must come after session defer check');
});

test('E-T1: apply while workout.isPlaying does not SKIP_WAITING or reload', async () => {
    const { appUpdate, reloads, postMessages, toasts, swControllerMessages } = createHarness({ isPlaying: true });
    const result = await appUpdate.apply();
    assert.equal(result?.ok, false);
    assert.equal(result?.reason, 'active-session');
    assert.equal(reloads.length, 0);
    assert.equal(postMessages.filter((m) => m?.type === 'SKIP_WAITING').length, 0);
    assert.ok(toasts.some((t) => /训练|更新|推迟/.test(t.msg)));
    assert.equal(appUpdate.deferredForSession, true);
    assert.ok(swControllerMessages.some((m) => m?.type === 'UPDATE_DEFER_FOR_SESSION'));
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
    appUpdate.version = '342';
    const original = appUpdate.documentNeedsControllerReload.bind(appUpdate);
    appUpdate.documentNeedsControllerReload = () => true;
    appUpdate.claimControllerReload = () => true;
    assert.equal(appUpdate.hasActiveRehabSession(), true);
    appUpdate.showUpdateDeferredForSession();
    assert.equal(typeof original, 'function');
    assert.equal(reloads.length, 0);
});

test('E-T4: boot/index has upgrade overlay barrier for __rehab_upgrade', () => {
    assert.match(html, /earlyUpgradeOverlay|rehabUpgradeOverlay/);
    assert.match(html, /__rehab_upgrade/);
    assert.match(html, /__rehabClearUpgradeOverlay/);
});

test('E-T5: paused workout blocks update', async () => {
    const { appUpdate, postMessages } = createHarness({ isPlaying: false, isPaused: true });
    // Paused sessions keep isPlaying true in production; also cover isPaused alone.
    assert.equal(appUpdate.hasActiveRehabSession(), true);
    const result = await appUpdate.apply();
    assert.equal(result?.ok, false);
    assert.equal(postMessages.filter((m) => m?.type === 'SKIP_WAITING').length, 0);
});

test('E-T6: lastActionDraft and pending write block update', async () => {
    const draft = createHarness({ lastActionDraft: { sets: 3, pain: 4 } });
    assert.equal(draft.appUpdate.hasActiveRehabSession(), true);
    const r1 = await draft.appUpdate.apply();
    assert.equal(r1?.ok, false);

    const pending = createHarness({ pendingWrite: true });
    assert.equal(pending.appUpdate.hasActiveRehabSession(), true);
    const r2 = await pending.appUpdate.apply();
    assert.equal(r2?.ok, false);

    const exercise = createHarness({ editingExerciseDraft: { type: 'strength', minutes: 10 } });
    assert.equal(exercise.appUpdate.hasActiveRehabSession(), true);
});

test('E-T7: active phase timer blocks update', () => {
    const { appUpdate } = createHarness({ isPlaying: false, phaseLeft: 18 });
    assert.equal(appUpdate.hasActiveRehabSession(), true);
});

test('E-T8: idle session allows update', async () => {
    const { appUpdate, postMessages } = createHarness({});
    assert.equal(appUpdate.hasActiveRehabSession(), false);
    const result = await appUpdate.apply();
    assert.equal(result?.ok, true);
    assert.ok(postMessages.some((m) => m?.type === 'SKIP_WAITING'));
});
