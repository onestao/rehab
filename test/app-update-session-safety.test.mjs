// @ts-nocheck
/**
 * Phase E: SW update must not force reload mid active rehab session.
 * Blockers are classified: active-session / pending-write / unsaved-draft.
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

function createHarness({
    isPlaying = false,
    isPaused = false,
    pendingWrite = false,
    dbDirty = false,
    pendingPersistPromise = null,
    lastActionDraft = null,
    editingExerciseDraft = null,
    editingFoodDraft = null,
    phaseLeft = null,
    timer = null,
    sessionInt = null,
    cardioRunning = false,
    journal = null,
    bannerPresent = true,
    workoutStatePresent = true,
    controllerIsWaiting = false,
    controllerPostMessages = null
} = {}) {
    const events = [];
    const toasts = [];
    const reloads = [];
    const postMessages = [];
    const swControllerMessages = controllerPostMessages || [];
    const journalSaves = [];
    const intervalCallbacks = new Map();
    let nextIntervalId = 1;
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
    if (journal != null) {
        store.set('rehab_active_session', typeof journal === 'string' ? journal : JSON.stringify(journal));
    }
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
            timer,
            sessionInt,
            totalSec: isPlaying || isPaused ? 12 : 0,
            mode: 'strength'
        },
        workoutSystem: null,
        cardio: {
            isRunning: cardioRunning,
            isPaused: false,
            seconds: cardioRunning ? 30 : 0
        },
        data: {
            _pendingLocalWrite: pendingWrite,
            _dbDirty: dbDirty,
            _pendingPersistPromise: pendingPersistPromise,
            db: { lastActionDraft },
            _editingExerciseDraft: editingExerciseDraft,
            _editingFoodDraft: editingFoodDraft
        },
        toast: { show(msg, type) { toasts.push({ msg, type }); } },
        setTimeout: (...args) => {
            const id = setTimeout(...args);
            if (typeof id?.unref === 'function') id.unref();
            return id;
        },
        clearTimeout: (...args) => clearTimeout(...args),
        setInterval(callback) {
            const id = nextIntervalId++;
            intervalCallbacks.set(id, callback);
            return id;
        },
        clearInterval(id) { intervalCallbacks.delete(id); },
        localStorage: {
            getItem(key) { return store.has(key) ? store.get(key) : null; },
            setItem(key, value) { store.set(key, String(value)); },
            removeItem(key) { store.delete(key); }
        },
        workoutState: workoutStatePresent ? {
            KEY: 'rehab_active_session',
            readJournal() {
                try {
                    const raw = store.get('rehab_active_session');
                    if (!raw) return null;
                    return JSON.parse(raw);
                } catch {
                    return null;
                }
            },
            isRecoverableJournal(snapshot, now = Date.now()) {
                if (!snapshot || typeof snapshot !== 'object') return false;
                if (snapshot.isPlaying !== true) return false;
                const updatedAt = new Date(snapshot.updatedAt || 0).getTime();
                const ageMs = now - updatedAt;
                return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= 1000 * 60 * 60 * 12;
            },
            saveJournal(extra = {}) {
                if (!windowObj.workout?.isPlaying) {
                    store.delete('rehab_active_session');
                    return null;
                }
                const payload = {
                    schemaVersion: 1,
                    journal: 'rehab-session',
                    isPlaying: true,
                    mode: 'strength',
                    totalSec: windowObj.workout.totalSec,
                    strength: { phase: 'hold' },
                    updatedAt: new Date().toISOString(),
                    ...extra
                };
                journalSaves.push(payload);
                store.set('rehab_active_session', JSON.stringify(payload));
                return payload;
            },
            clear() {
                store.delete('rehab_active_session');
            }
        } : undefined
    };
    windowObj.workoutSystem = windowObj.workout;
    const navigatorObj = {
        serviceWorker: {
            controller: controllerIsWaiting ? waitingWorker : {
                scriptURL: 'https://example.test/sw.js?v=345',
                postMessage(msg) { swControllerMessages.push(msg); }
            },
            addEventListener() {},
            removeEventListener() {}
        }
    };
    const documentObj = {
        scripts: [{ src: 'https://example.test/data.js?v=345' }],
        body: {
            appendChild() {},
            removeChild() {}
        },
        getElementById(id) {
            if (id === 'appUpdateBanner') return bannerPresent ? banner : null;
            if (id === 'rehabUpgradeOverlay') return null;
            return null;
        },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        createElement() {
            return {
                id: '',
                style: { cssText: '', display: '' },
                textContent: '',
                setAttribute() {},
                innerHTML: '',
                appendChild() {},
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
        setInterval: windowObj.setInterval,
        clearInterval: windowObj.clearInterval,
        Number,
        String
    };
    context.globalThis = context;
    windowObj.window = windowObj;
    vm.createContext(context);
    vm.runInContext(appUpdateSource, context, { filename: 'app-update.js' });
    const appUpdate = context.window.appUpdate;
    appUpdate.version = '345';
    appUpdate.waitingWorker = waitingWorker;
    appUpdate.registration = { waiting: waitingWorker };
    appUpdate.prepareWaitingWorker = async () => true;
    appUpdate.documentNeedsControllerReload = () => true;
    appUpdate.claimControllerReload = () => true;
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
        documentObj,
        store,
        journalSaves,
        runWatcherCallbacks() {
            for (const callback of [...intervalCallbacks.values()]) callback();
        }
    };
}

function validStrengthJournal(overrides = {}) {
    return {
        schemaVersion: 1,
        journal: 'rehab-session',
        isPlaying: true,
        mode: 'strength',
        totalSec: 12,
        updatedAt: new Date().toISOString(),
        strength: { phase: 'hold' },
        ...overrides
    };
}

function messagesOfType(messages, type) {
    return messages.filter((message) => message?.type === type);
}

test('source contract: apply classifies block reasons', () => {
    assert.match(appUpdateSource, /hasActiveRehabSession\s*\(/);
    assert.match(appUpdateSource, /getUpdateBlockReason\s*\(/);
    assert.match(appUpdateSource, /isPlaying\s*===\s*true/);
    assert.match(appUpdateSource, /readRecoverableSessionJournal/);
    assert.doesNotMatch(appUpdateSource, /data\?\.db\?\.lastActionDraft/);
    assert.match(appUpdateSource, /UPDATE_DEFER_FOR_CLIENT/);
    assert.match(appUpdateSource, /UPDATE_CLIENT_CLEAR/);
    assert.doesNotMatch(appUpdateSource, /UPDATE_DEFER_FOR_SESSION/);
    assert.doesNotMatch(appUpdateSource, /UPDATE_SESSION_CLEAR/);
    assert.match(appUpdateSource, /active-session/);
    assert.match(appUpdateSource, /pending-write/);
    assert.match(appUpdateSource, /unsaved-draft/);
    assert.match(appUpdateSource, /_dbDirty/);
    assert.match(appUpdateSource, /_pendingPersistPromise/);
    assert.match(appUpdateSource, /showUpgradeOverlay/);
    assert.match(appUpdateSource, /deferred-for-session|deferredForSession/);
});

test('source contract: journal validation is strict and localStorage-backed', () => {
    assert.match(appUpdateSource, /schemaVersion\s*!==\s*1/);
    assert.match(appUpdateSource, /journal\s*!==\s*'rehab-session'/);
    assert.match(appUpdateSource, /mode\s*!==\s*'strength'/);
    assert.match(appUpdateSource, /rehab_active_session/);
    assert.match(appUpdateSource, /localStorage\?\.removeItem/);
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
    assert.equal(messagesOfType(swControllerMessages, 'UPDATE_DEFER_FOR_CLIENT').length, 1);
    assert.equal(messagesOfType(postMessages, 'UPDATE_DEFER_FOR_CLIENT').length, 1);
    assert.equal(swControllerMessages.find((m) => m.type === 'UPDATE_DEFER_FOR_CLIENT').reason, 'active-session');
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
    assert.equal(appUpdate.hasActiveRehabSession(), true);
    appUpdate.showUpdateDeferredForSession();
    assert.equal(reloads.length, 0);
});

test('E-T4: boot/index has upgrade overlay barrier for __rehab_upgrade', () => {
    assert.match(html, /earlyUpgradeOverlay|rehabUpgradeOverlay/);
    assert.match(html, /__rehab_upgrade/);
    assert.match(html, /__rehabClearUpgradeOverlay/);
});

test('E-T5: paused workout with isPlaying true blocks update', async () => {
    // Production pause keeps isPlaying === true.
    const { appUpdate, postMessages } = createHarness({ isPlaying: true, isPaused: true });
    assert.equal(appUpdate.hasActiveRehabSession(), true);
    const result = await appUpdate.apply();
    assert.equal(result?.ok, false);
    assert.equal(result?.reason, 'active-session');
    assert.equal(postMessages.filter((m) => m?.type === 'SKIP_WAITING').length, 0);
});

test('E-T5b: lone isPaused without isPlaying does not count as active session', () => {
    const { appUpdate } = createHarness({ isPlaying: false, isPaused: true });
    assert.equal(appUpdate.hasActiveRehabSession(), false);
    assert.equal(appUpdate.getUpdateBlockReason(), null);
});

test('E-T6: lastActionDraft alone allows update; pending/edit drafts soft-block', async () => {
    const draft = createHarness({ lastActionDraft: { sets: 3, pain: 4 } });
    assert.equal(draft.appUpdate.hasActiveRehabSession(), false);
    assert.equal(draft.appUpdate.getUpdateBlockReason(), null);
    const r1 = await draft.appUpdate.apply();
    assert.equal(r1?.ok, true);
    assert.ok(draft.postMessages.some((m) => m?.type === 'SKIP_WAITING'));

    const pending = createHarness({ pendingWrite: true });
    assert.equal(pending.appUpdate.hasActiveRehabSession(), false);
    assert.equal(pending.appUpdate.getUpdateBlockReason(), 'pending-write');
    const r2 = await pending.appUpdate.apply();
    assert.equal(r2?.ok, false);
    assert.equal(r2?.reason, 'pending-write');
    assert.equal(messagesOfType(pending.swControllerMessages, 'UPDATE_DEFER_FOR_CLIENT')[0]?.reason, 'pending-write');
    assert.ok(pending.toasts.some((t) => /保存|稍后/.test(t.msg)));

    const exercise = createHarness({ editingExerciseDraft: { type: 'strength', minutes: 10 } });
    assert.equal(exercise.appUpdate.hasActiveRehabSession(), false);
    assert.equal(exercise.appUpdate.getUpdateBlockReason(), 'unsaved-draft');
    const r3 = await exercise.appUpdate.apply();
    assert.equal(r3?.ok, false);
    assert.equal(r3?.reason, 'unsaved-draft');
    assert.equal(messagesOfType(exercise.swControllerMessages, 'UPDATE_DEFER_FOR_CLIENT')[0]?.reason, 'unsaved-draft');
    assert.ok(exercise.toasts.some((t) => /未保存|编辑/.test(t.msg)));
});

test('E-T7: residual phaseLeft alone allows update', () => {
    const { appUpdate } = createHarness({ isPlaying: false, phaseLeft: 18 });
    assert.equal(appUpdate.hasActiveRehabSession(), false);
    assert.equal(appUpdate.getUpdateBlockReason(), null);
});

test('E-T7b: residual timer/sessionInt alone allows update', () => {
    const { appUpdate } = createHarness({ isPlaying: false, timer: 11, sessionInt: 22 });
    assert.equal(appUpdate.hasActiveRehabSession(), false);
    assert.equal(appUpdate.getUpdateBlockReason(), null);
});

test('E-T8: idle session allows update', async () => {
    const { appUpdate, postMessages } = createHarness({});
    assert.equal(appUpdate.hasActiveRehabSession(), false);
    const result = await appUpdate.apply();
    assert.equal(result?.ok, true);
    assert.ok(postMessages.some((m) => m?.type === 'SKIP_WAITING'));
});

test('E-T9: recoverable active journal blocks update', async () => {
    const { appUpdate, postMessages, swControllerMessages } = createHarness({
        isPlaying: false,
        journal: validStrengthJournal()
    });
    assert.equal(appUpdate.hasActiveRehabSession(), true);
    const result = await appUpdate.apply();
    assert.equal(result?.ok, false);
    assert.equal(result?.reason, 'active-session');
    assert.equal(postMessages.filter((m) => m?.type === 'SKIP_WAITING').length, 0);
    assert.equal(messagesOfType(swControllerMessages, 'UPDATE_DEFER_FOR_CLIENT')[0]?.reason, 'active-session');
});

test('E-T10: idle/false journal allows update and clears key', async () => {
    const { appUpdate, postMessages, store } = createHarness({
        isPlaying: false,
        journal: validStrengthJournal({ isPlaying: false })
    });
    assert.equal(appUpdate.hasActiveRehabSession(), false);
    const result = await appUpdate.apply();
    assert.equal(result?.ok, true);
    assert.ok(postMessages.some((m) => m?.type === 'SKIP_WAITING'));
    assert.equal(store.has('rehab_active_session'), false);
});

test('E-T11: expired journal allows update and clears key', async () => {
    const expired = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString();
    const { appUpdate, store } = createHarness({
        isPlaying: false,
        journal: validStrengthJournal({ updatedAt: expired })
    });
    assert.equal(appUpdate.hasActiveRehabSession(), false);
    const result = await appUpdate.apply();
    assert.equal(result?.ok, true);
    assert.equal(store.has('rehab_active_session'), false);
});

test('E-T12: corrupted or empty journal allows update and clears key', async () => {
    for (const journal of ['{not-json', '']) {
        const { appUpdate, store } = createHarness({ isPlaying: false, journal });
        assert.equal(appUpdate.hasActiveRehabSession(), false);
        const result = await appUpdate.apply();
        assert.equal(result?.ok, true);
        assert.equal(store.has('rehab_active_session'), false);
    }
});

test('E-T13: idle showUpdateDeferredForSession does not create journal', () => {
    const { appUpdate, store, windowObj } = createHarness({ isPlaying: false });
    appUpdate.showUpdateDeferredForSession();
    assert.equal(store.has('rehab_active_session'), false);
    assert.equal(windowObj.workout.isPlaying, false);
});

test('E-T14: active showUpdateDeferredForSession freezes journal', () => {
    const { appUpdate, store } = createHarness({ isPlaying: true });
    appUpdate.showUpdateDeferredForSession();
    assert.equal(store.has('rehab_active_session'), true);
    const saved = JSON.parse(store.get('rehab_active_session'));
    assert.equal(saved.deferredForUpdate, true);
});

test('E-T15: real watcher callback checks the full blocker set before clearing', () => {
    const harness = createHarness({ dbDirty: true });
    harness.appUpdate.show(harness.waitingWorker);
    assert.notEqual(harness.appUpdate._sessionClearWatch, null);

    harness.windowObj.data._dbDirty = false;
    harness.windowObj.data._editingExerciseDraft = { name: 'draft' };
    harness.runWatcherCallbacks();
    assert.equal(messagesOfType(harness.swControllerMessages, 'UPDATE_CLIENT_CLEAR').length, 0);
    assert.equal(messagesOfType(harness.postMessages, 'UPDATE_CLIENT_CLEAR').length, 0);

    harness.windowObj.data._editingExerciseDraft = null;
    harness.runWatcherCallbacks();
    assert.equal(messagesOfType(harness.swControllerMessages, 'UPDATE_CLIENT_CLEAR').length, 1);
    assert.equal(messagesOfType(harness.postMessages, 'UPDATE_CLIENT_CLEAR').length, 1);
    assert.equal(harness.appUpdate._sessionClearWatch, null);
});

test('E-T16: show proactively defers controller and waiting worker before rendering', () => {
    const harness = createHarness({ pendingWrite: true });
    harness.appUpdate.show(harness.waitingWorker);

    const controllerMessage = messagesOfType(harness.swControllerMessages, 'UPDATE_DEFER_FOR_CLIENT');
    const waitingMessage = messagesOfType(harness.postMessages, 'UPDATE_DEFER_FOR_CLIENT');
    assert.equal(controllerMessage.length, 1);
    assert.equal(waitingMessage.length, 1);
    assert.equal(controllerMessage[0].version, '345');
    assert.equal(controllerMessage[0].reason, 'pending-write');
    assert.equal(waitingMessage[0].reason, 'pending-write');
    assert.notEqual(harness.appUpdate._sessionClearWatch, null);
});

test('E-T17: defer and clear avoid duplicate posts when controller is waiting worker', () => {
    const harness = createHarness({ pendingWrite: true, controllerIsWaiting: true });
    harness.appUpdate.show(harness.waitingWorker);
    assert.equal(messagesOfType(harness.postMessages, 'UPDATE_DEFER_FOR_CLIENT').length, 1);

    harness.windowObj.data._pendingLocalWrite = false;
    harness.runWatcherCallbacks();
    assert.equal(messagesOfType(harness.postMessages, 'UPDATE_CLIENT_CLEAR').length, 1);
});

test('E-T18: missing banner still arms and executes blocker watcher', () => {
    const harness = createHarness({ pendingWrite: true, bannerPresent: false });
    harness.appUpdate.show(harness.waitingWorker);
    assert.notEqual(harness.appUpdate._sessionClearWatch, null);
    assert.equal(messagesOfType(harness.postMessages, 'UPDATE_DEFER_FOR_CLIENT').length, 1);

    harness.windowObj.data._pendingLocalWrite = false;
    harness.runWatcherCallbacks();
    assert.equal(messagesOfType(harness.swControllerMessages, 'UPDATE_CLIENT_CLEAR').length, 1);
    assert.equal(messagesOfType(harness.postMessages, 'UPDATE_CLIENT_CLEAR').length, 1);
});

test('E-T19: lazy workoutState absence still recognizes strict strength/cardio journals', () => {
    const strength = createHarness({
        workoutStatePresent: false,
        journal: validStrengthJournal()
    });
    assert.equal(strength.appUpdate.getUpdateBlockReason(), 'active-session');

    const cardio = createHarness({
        workoutStatePresent: false,
        journal: validStrengthJournal({
            mode: 'cardio',
            strength: undefined,
            cardio: { isRunning: true, seconds: 9 }
        })
    });
    assert.equal(cardio.appUpdate.getUpdateBlockReason(), 'active-session');
});

test('E-T20: lazy workoutState absence deletes journals that fail strict schema', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const invalidJournals = [
        validStrengthJournal({ schemaVersion: 2 }),
        validStrengthJournal({ journal: 'other' }),
        validStrengthJournal({ mode: 'other' }),
        validStrengthJournal({ totalSec: '12' }),
        validStrengthJournal({ updatedAt: future }),
        validStrengthJournal({ strength: null }),
        validStrengthJournal({ strength: { phase: '' } }),
        validStrengthJournal({ mode: 'cardio', cardio: null }),
        validStrengthJournal({ mode: 'cardio', cardio: { isRunning: false, seconds: 2 } }),
        validStrengthJournal({ mode: 'cardio', cardio: { isRunning: true, seconds: -1 } })
    ];

    for (const journal of invalidJournals) {
        const harness = createHarness({ workoutStatePresent: false, journal });
        assert.equal(harness.appUpdate.getUpdateBlockReason(), null);
        assert.equal(harness.store.has('rehab_active_session'), false);
    }
});

test('E-T21: pending and draft blockers defer generically without saving journal', () => {
    for (const options of [
        { dbDirty: true },
        { pendingPersistPromise: Promise.resolve() },
        { pendingWrite: true },
        { editingExerciseDraft: { name: 'draft' } },
        { editingFoodDraft: { name: 'draft' } }
    ]) {
        const harness = createHarness(options);
        const reason = harness.appUpdate.getUpdateBlockReason();
        harness.appUpdate.show(harness.waitingWorker);
        assert.ok(reason === 'pending-write' || reason === 'unsaved-draft');
        assert.equal(harness.journalSaves.length, 0);
        assert.equal(messagesOfType(harness.swControllerMessages, 'UPDATE_DEFER_FOR_CLIENT')[0]?.reason, reason);
        assert.equal(messagesOfType(harness.postMessages, 'UPDATE_DEFER_FOR_CLIENT')[0]?.reason, reason);
        assert.notEqual(harness.appUpdate._sessionClearWatch, null);
    }
});

test('E-T22: active blocker alone saves journal and compatibility wrappers use generic protocol', () => {
    const harness = createHarness({ isPlaying: true });
    harness.appUpdate.show(harness.waitingWorker);
    assert.equal(harness.journalSaves.length, 1);
    assert.equal(messagesOfType(harness.swControllerMessages, 'UPDATE_DEFER_FOR_CLIENT')[0]?.reason, 'active-session');

    harness.windowObj.workout.isPlaying = false;
    harness.store.delete('rehab_active_session');
    harness.runWatcherCallbacks();
    assert.equal(messagesOfType(harness.swControllerMessages, 'UPDATE_CLIENT_CLEAR').length, 1);
    assert.equal(messagesOfType(harness.postMessages, 'UPDATE_CLIENT_CLEAR').length, 1);
});
