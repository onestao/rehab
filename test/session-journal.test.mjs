/**
 * H5: session journal schema + pre-update persist + restore path.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadWorkoutState() {
    const store = new Map();
    const context = {
        console,
        document: {
            addEventListener() {},
            getElementById() { return { innerText: '', classList: { remove() {}, add() {}, toggle() {} } }; },
            body: { classList: { add() {}, toggle() {} } }
        },
        localStorage: {
            getItem(k) { return store.has(k) ? store.get(k) : null; },
            setItem(k, v) { store.set(k, String(v)); },
            removeItem(k) { store.delete(k); }
        },
        workout: {
            mode: 'strength',
            isPlaying: true,
            isPaused: false,
            totalSec: 42,
            setMode() {},
            updateStateClasses() {},
            keepAudioAlive() {},
            initBackGuard() {},
            acquireWakeLock() {},
            setupMediaSession() {},
            updateUI() {},
            showToast() {}
        },
        cardio: {
            isRunning: false,
            isPaused: false,
            seconds: 0,
            targetAnnounced: false,
            updateUI() {},
            updatePlan() {},
            tick() {},
            timer: null
        },
        window: {},
        clearInterval() {},
        setInterval() { return 1; },
        confirm() { return true; },
        Date,
        JSON,
        Number,
        Math,
        String
    };
    context.window = context;
    context.globalThis = context;
    context.window.workoutEngine = {
        snapshot() { return { phase: 'work', phaseLeft: 8 }; },
        restore() {},
        compensateElapsed() {}
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(root, 'workout-state.js'), 'utf8'), context);
    return { context, store, workoutState: context.workoutState || context.window.workoutState };
}

test('H5-T1: snapshot includes schemaVersion and journal marker', () => {
    const { workoutState } = loadWorkoutState();
    const snap = workoutState.snapshot();
    assert.equal(snap.schemaVersion, 1);
    assert.equal(snap.journal, 'rehab-session');
    assert.equal(snap.isPlaying, true);
    assert.equal(snap.totalSec, 42);
});

test('H5-T2: saveJournal / readJournal round-trip survives clear of runtime only', () => {
    const { workoutState, store } = loadWorkoutState();
    const saved = workoutState.saveJournal({ deferredForUpdate: true });
    assert.ok(saved);
    assert.equal(store.get('rehab_active_session') != null, true);
    const read = workoutState.readJournal();
    assert.equal(read.schemaVersion, 1);
    assert.equal(read.deferredForUpdate, true);
    assert.equal(read.totalSec, 42);
});

test('H5-T3: app-update defers and freezes journal source contract', () => {
    const updateSrc = fs.readFileSync(path.join(root, 'app-update.js'), 'utf8');
    assert.match(updateSrc, /saveJournal/);
    assert.match(updateSrc, /hasActiveRehabSession/);
    assert.match(updateSrc, /UPDATE_DEFER_FOR_SESSION|notifyServiceWorkerSessionDefer/);
    // Method body (not call sites like this.showUpdateDeferredForSession())
    const def = updateSrc.search(/showUpdateDeferredForSession\s*\(\s*\)\s*\{/);
    assert.ok(def > 0, 'method definition missing');
    const body = updateSrc.slice(def, def + 900);
    assert.match(body, /saveJournal/);
    assert.match(body, /训练进行中，更新已推迟/);
});

test('H5-T4: workout-state restoreIfNeeded reads KEY journal', () => {
    const src = fs.readFileSync(path.join(root, 'workout-state.js'), 'utf8');
    assert.match(src, /restoreIfNeeded/);
    assert.match(src, /rehab_active_session|this\.KEY/);
    assert.match(src, /schemaVersion/);
    assert.match(src, /saveJournal/);
});
