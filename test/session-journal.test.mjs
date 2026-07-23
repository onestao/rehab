// @ts-nocheck
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
const JOURNAL_KEY = 'rehab_active_session';
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

function validStrengthJournal(overrides = {}) {
    return {
        schemaVersion: 1,
        journal: 'rehab-session',
        mode: 'strength',
        isPlaying: true,
        isPaused: false,
        totalSec: 42,
        updatedAt: new Date().toISOString(),
        labels: {},
        cardio: { isRunning: false, isPaused: false, seconds: 0, targetAnnounced: false },
        strength: { phase: 'work', phaseLeft: 8 },
        ...overrides
    };
}

function validCardioJournal(overrides = {}) {
    return {
        schemaVersion: 1,
        journal: 'rehab-session',
        mode: 'cardio',
        isPlaying: true,
        isPaused: false,
        totalSec: 42,
        updatedAt: new Date().toISOString(),
        labels: {},
        cardio: { isRunning: true, isPaused: false, seconds: 42, targetAnnounced: false },
        strength: null,
        ...overrides
    };
}

function loadWorkoutState({
    isPlaying = true,
    mode = 'strength',
    confirmRestore = true,
    engineSnapshot = { phase: 'work', phaseLeft: 8 }
} = {}) {
    const store = new Map();
    const calls = {
        confirms: 0,
        modes: [],
        strengthRestores: [],
        intervals: [],
        clearedIntervals: []
    };
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
            mode,
            isPlaying,
            isPaused: false,
            totalSec: 42,
            timer: null,
            sessionInt: null,
            setMode(nextMode) { calls.modes.push(nextMode); this.mode = nextMode; },
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
        clearInterval(handle) { calls.clearedIntervals.push(handle); },
        setInterval(callback, delay) {
            const handle = calls.intervals.length + 1;
            calls.intervals.push({ callback, delay, handle });
            return handle;
        },
        confirm() { calls.confirms++; return confirmRestore; },
        Date,
        JSON,
        Number,
        Math,
        String
    };
    context.window = context;
    context.globalThis = context;
    context.window.workoutEngine = {
        snapshot() { return engineSnapshot; },
        createInitialState() { return { phase: 'intro', phaseLeft: null }; },
        restore(...args) { calls.strengthRestores.push(args); },
        compensateElapsed() {}
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(root, 'workout-state.js'), 'utf8'), context);
    return { calls, context, store, workoutState: context.workoutState || context.window.workoutState };
}

test('H5-T1: snapshot includes schema marker and required strength payload', () => {
    const { workoutState } = loadWorkoutState();
    const snap = workoutState.snapshot();
    assert.equal(snap.schemaVersion, 1);
    assert.equal(snap.journal, 'rehab-session');
    assert.equal(snap.mode, 'strength');
    assert.equal(snap.isPlaying, true);
    assert.equal(snap.totalSec, 42);
    assert.equal(snap.strength.phase, 'work');
});

test('H5-T1b: strength startup writes a recoverable intro snapshot before engine state exists', () => {
    const { workoutState } = loadWorkoutState({ engineSnapshot: null });
    const saved = workoutState.saveJournal();
    assert.ok(saved);
    assert.equal(saved.strength.phase, 'intro');
    assert.equal(workoutState.isRecoverableJournal(saved), true);
});

test('H5-T2: active saveJournal round-trip protects snapshot identity and payload', () => {
    const { workoutState, store } = loadWorkoutState({ isPlaying: true });
    const forgedUpdatedAt = '2000-01-01T00:00:00.000Z';
    const saved = workoutState.saveJournal({
        deferredForUpdate: true,
        schemaVersion: 999,
        journal: 'not-rehab',
        mode: 'cardio',
        isPlaying: false,
        totalSec: 999,
        updatedAt: forgedUpdatedAt,
        labels: { statusText: 'forged' },
        cardio: { isRunning: true, seconds: 999 },
        strength: null
    });

    assert.ok(saved);
    assert.equal(store.has(JOURNAL_KEY), true);
    assert.equal(saved.deferredForUpdate, true);
    assert.equal(saved.schemaVersion, 1);
    assert.equal(saved.journal, 'rehab-session');
    assert.equal(saved.mode, 'strength');
    assert.equal(saved.isPlaying, true);
    assert.equal(saved.totalSec, 42);
    assert.notEqual(saved.updatedAt, forgedUpdatedAt);
    assert.equal(saved.labels.statusText, '');
    assert.equal(saved.cardio.isRunning, false);
    assert.equal(saved.cardio.seconds, 0);
    assert.equal(saved.strength.phase, 'work');
    assert.equal(workoutState.isRecoverableJournal(workoutState.readJournal()), true);
});

test('H5-T2b: idle saveJournal returns null and clears residual key', () => {
    const { workoutState, store } = loadWorkoutState({ isPlaying: false });
    store.set(JOURNAL_KEY, JSON.stringify(validStrengthJournal()));
    const saved = workoutState.saveJournal({ deferredForUpdate: true });
    assert.equal(saved, null);
    assert.equal(store.has(JOURNAL_KEY), false);
});

test('H5-T3: isRecoverableJournal enforces schema, marker, mode and base payload', () => {
    const { workoutState } = loadWorkoutState();
    const now = Date.now();
    const valid = validStrengthJournal({ updatedAt: new Date(now).toISOString() });

    assert.equal(workoutState.isRecoverableJournal(valid, now), true);
    assert.equal(workoutState.isRecoverableJournal(null, now), false);
    assert.equal(workoutState.isRecoverableJournal([], now), false);
    assert.equal(workoutState.isRecoverableJournal({ ...valid, schemaVersion: 2 }, now), false);
    assert.equal(workoutState.isRecoverableJournal({ ...valid, journal: 'other' }, now), false);
    assert.equal(workoutState.isRecoverableJournal({ ...valid, isPlaying: false }, now), false);
    assert.equal(workoutState.isRecoverableJournal({ ...valid, mode: 'strengthLog' }, now), false);
    assert.equal(workoutState.isRecoverableJournal({ ...valid, totalSec: -1 }, now), false);
    assert.equal(workoutState.isRecoverableJournal({ ...valid, totalSec: Infinity }, now), false);
});

test('H5-T4: strength and cardio payload contracts are strict', () => {
    const { workoutState } = loadWorkoutState();
    const now = Date.now();
    const strength = validStrengthJournal({ updatedAt: new Date(now).toISOString() });
    const cardioJournal = validCardioJournal({ updatedAt: new Date(now).toISOString() });

    assert.equal(workoutState.isRecoverableJournal(strength, now), true);
    assert.equal(workoutState.isRecoverableJournal({ ...strength, strength: null }, now), false);
    assert.equal(workoutState.isRecoverableJournal({ ...strength, strength: {} }, now), false);
    assert.equal(workoutState.isRecoverableJournal({ ...strength, strength: { phase: '   ' } }, now), false);
    assert.equal(workoutState.isRecoverableJournal(cardioJournal, now), true);
    assert.equal(workoutState.isRecoverableJournal({ ...cardioJournal, cardio: null }, now), false);
    assert.equal(workoutState.isRecoverableJournal({ ...cardioJournal, cardio: { isRunning: false, seconds: 42 } }, now), false);
    assert.equal(workoutState.isRecoverableJournal({ ...cardioJournal, cardio: { isRunning: true, seconds: -1 } }, now), false);
    assert.equal(workoutState.isRecoverableJournal({ ...cardioJournal, cardio: { isRunning: true, seconds: Infinity } }, now), false);
});

test('H5-T5: journal age rejects corrupt, expired and future snapshots', () => {
    const { calls, workoutState, store } = loadWorkoutState({ isPlaying: false });
    const now = Date.now();

    assert.equal(workoutState.isRecoverableJournal(validStrengthJournal({ updatedAt: new Date(now - TWELVE_HOURS_MS).toISOString() }), now), true);
    assert.equal(workoutState.isRecoverableJournal(validStrengthJournal({ updatedAt: new Date(now - TWELVE_HOURS_MS - 1).toISOString() }), now), false);
    assert.equal(workoutState.isRecoverableJournal(validStrengthJournal({ updatedAt: new Date(now + 1).toISOString() }), now), false);
    assert.equal(workoutState.isRecoverableJournal(validStrengthJournal({ updatedAt: 'not-a-date' }), now), false);

    const rejected = [
        '{broken',
        JSON.stringify(validStrengthJournal({ updatedAt: new Date(now - TWELVE_HOURS_MS - 1).toISOString() })),
        JSON.stringify(validStrengthJournal({ updatedAt: new Date(now + 60_000).toISOString() }))
    ];
    for (const raw of rejected) {
        store.set(JOURNAL_KEY, raw);
        workoutState.restoreIfNeeded();
        assert.equal(store.has(JOURNAL_KEY), false);
    }
    assert.equal(calls.confirms, 0);
});

test('H5-T6: malformed, incomplete and unknown-mode journals cannot partially restore', () => {
    const { calls, context, workoutState, store } = loadWorkoutState({ isPlaying: false });
    const invalidJournals = [
        { ...validStrengthJournal(), schemaVersion: 0 },
        { ...validStrengthJournal(), journal: 'unknown' },
        { ...validStrengthJournal(), mode: 'unknown' },
        { ...validStrengthJournal(), strength: null },
        { ...validCardioJournal(), cardio: { isRunning: false, seconds: 42 } }
    ];

    for (const journal of invalidJournals) {
        store.set(JOURNAL_KEY, JSON.stringify(journal));
        workoutState.restoreIfNeeded();
        assert.equal(store.has(JOURNAL_KEY), false);
        assert.equal(context.workout.mode, 'strength');
        assert.equal(context.workout.isPlaying, false);
        assert.equal(context.workout.totalSec, 42);
        assert.equal(context.cardio.isRunning, false);
        assert.equal(context.cardio.seconds, 0);
    }
    assert.equal(calls.confirms, 0);
    assert.deepEqual(calls.modes, []);
    assert.deepEqual(calls.strengthRestores, []);
    assert.equal(calls.intervals.length, 0);
});

test('H5-T7: valid strength and cardio journals restore through their own paths', () => {
    const strengthHarness = loadWorkoutState({ isPlaying: false });
    strengthHarness.store.set(JOURNAL_KEY, JSON.stringify(validStrengthJournal()));
    strengthHarness.workoutState.restoreIfNeeded();
    assert.deepEqual(strengthHarness.calls.modes, ['strength']);
    assert.equal(strengthHarness.calls.strengthRestores.length, 1);
    assert.equal(strengthHarness.context.workout.isPlaying, true);
    assert.equal(strengthHarness.calls.intervals.length, 1);

    const cardioHarness = loadWorkoutState({ isPlaying: false });
    cardioHarness.store.set(JOURNAL_KEY, JSON.stringify(validCardioJournal()));
    cardioHarness.workoutState.restoreIfNeeded();
    assert.deepEqual(cardioHarness.calls.modes, ['cardio']);
    assert.equal(cardioHarness.calls.strengthRestores.length, 0);
    assert.equal(cardioHarness.context.workout.isPlaying, true);
    assert.equal(cardioHarness.context.cardio.isRunning, true);
    assert.equal(cardioHarness.context.cardio.seconds, 42);
    assert.equal(cardioHarness.calls.intervals.length, 1);
});

test('H5-T8: app-update defers and freezes journal only for real session', () => {
    const updateSrc = fs.readFileSync(path.join(root, 'app-update.js'), 'utf8');
    assert.match(updateSrc, /saveJournal/);
    assert.match(updateSrc, /hasActiveRehabSession/);
    assert.match(updateSrc, /getUpdateBlockReason/);
    assert.match(updateSrc, /UPDATE_DEFER_FOR_SESSION|notifyServiceWorkerSessionDefer/);
    const def = updateSrc.search(/showUpdateDeferredForSession\s*\([^)]*\)\s*\{/);
    assert.ok(def > 0, 'method definition missing');
    const body = updateSrc.slice(def, def + 1200);
    assert.match(body, /saveJournal/);
    assert.match(body, /isPlaying\s*===\s*true/);
    assert.match(body, /训练进行中，更新已推迟/);
});

test('H5-T9: lifecycle-ending interval clears null handles; synchronous replacement stays direct', () => {
    const coreSrc = fs.readFileSync(path.join(root, 'workout-core.js'), 'utf8');
    const cardioSrc = fs.readFileSync(path.join(root, 'workout-cardio.js'), 'utf8');

    for (const match of coreSrc.matchAll(/clearInterval\(this\.timer\);/g)) {
        assert.match(coreSrc.slice(match.index, match.index + 100), /this\.timer\s*=\s*null/);
    }
    assert.match(coreSrc, /clearInterval\(this\.sessionInt\);\s*this\.timer\s*=\s*null;\s*this\.sessionInt\s*=\s*null/);
    assert.match(coreSrc, /clearInterval\(this\._speechWatchdog\);\s*clearInterval\(this\._audioKeepAliveInt\);\s*this\._speechWatchdog\s*=\s*null;\s*this\._audioKeepAliveInt\s*=\s*null/);

    const start = cardioSrc.slice(cardioSrc.indexOf('async toggle()'), cardioSrc.indexOf('tick()'));
    assert.match(start, /clearInterval\(this\.timer\);\s*this\.timer\s*=\s*setInterval/);
    assert.doesNotMatch(start, /clearInterval\(this\.timer\);\s*this\.timer\s*=\s*null/);
    const reset = cardioSrc.slice(cardioSrc.indexOf('reset()'), cardioSrc.indexOf('speak(text)'));
    assert.match(reset, /clearInterval\(this\.timer\);\s*this\.timer\s*=\s*null/);
    assert.match(reset, /clearInterval\(workout\._speechWatchdog\);\s*clearInterval\(workout\._audioKeepAliveInt\);\s*workout\._speechWatchdog\s*=\s*null;\s*workout\._audioKeepAliveInt\s*=\s*null/);
});
