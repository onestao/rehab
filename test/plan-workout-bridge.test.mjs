import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function makeElement() {
  return {
    innerText: '',
    textContent: '',
    style: {},
    classList: {
      add() {},
      remove() {},
      toggle() {}
    },
    setAttribute() {},
    appendChild() {},
    querySelector() {
      return makeElement();
    }
  };
}

function loadWorkoutCore() {
  const code = readFileSync(new URL('../workout-core.js', import.meta.url), 'utf8');
  const calls = [];
  const elements = new Map();
  const workoutEngine = { state: { phase: 'completed' } };
  const activeRun = /** @type {any} */ ({ planId: 'plan-1', taskId: 'task-1', previousPlan: [{ id: 'previous' }] });
  const data = /** @type {any} */ ({
    activeRun,
    db: { actualSetsBuffer: [], history: [] },
    generateRecordId(prefix) {
      return `${prefix}-1`;
    },
    logicalDateKey() {
      return '2026-05-25';
    },
    _planActions() {
      return [{ id: 'plan-run-task-1', name: '计划·基础臀桥' }];
    },
    activeRecords(list) {
      return list || [];
    },
    _replacePlanActions(actions) {
      calls.push(['replace-plan-actions', actions.map((item) => item.id).join(',')]);
    },
    updatePlanWorkoutBanner() {
      calls.push(['update-banner']);
    },
    handlePlanWorkoutFinished(record) {
      calls.push(['plan-finished', record.duration, record.manualStop]);
      this.activeRun = null;
    },
    save() {
      calls.push(['save']);
    },
    saveAndBackup() {
      calls.push(['save-and-backup']);
    }
  });
  const sandbox = {
    console,
    workout: {
      mode: 'strength',
      totalSec: 12,
      isPlaying: true,
      isPaused: false,
      timer: null,
      sessionInt: null,
      _manualStopRequested: false,
      _speechWatchdog: null,
      _audioKeepAliveInt: null,
      _countResolve: null,
      _speakResolve: null,
      _phaseLeft: null,
      _lastActiveAt: null,
      updatePipButton() {},
      renderPip() {},
      closePip() {},
      releaseWakeLock() {},
      speak(message) {
        calls.push(['speak', message]);
      }
    },
    workoutEngine,
    data,
    navigator: {},
    CustomEvent: function CustomEvent(type, init) {
      return { type, detail: init?.detail };
    },
    clearInterval() {},
    alert(message) {
      calls.push(['alert', message]);
    },
    document: {
      body: { classList: { toggle() {} } },
      getElementById(id) {
        if (id === 'globalTrainingBar') return null;
        if (!elements.has(id)) elements.set(id, makeElement());
        return elements.get(id);
      },
      querySelector() {
        return makeElement();
      },
      querySelectorAll(selector) {
        if (selector === '.stat-label') return [makeElement(), makeElement(), makeElement()];
        return [];
      },
      createElement() {
        return makeElement();
      }
    }
  };
  sandbox.window = {
    data,
    workoutEngine,
    dispatchEvent() {},
    errorBus: { event() {} },
    haptics: { success() {} },
    speechSynthesis: { cancel() {} },
    toast: {
      show(message, type) {
        calls.push(['toast', message, type]);
      }
    }
  };
  vm.runInNewContext(code, sandbox);
  return { ...sandbox, calls };
}

test('natural short plan workout completes plan task without creating history', () => {
  const ctx = loadWorkoutCore();

  ctx.workout.finish();

  assert.deepEqual(ctx.calls.filter((call) => call[0] === 'plan-finished'), [['plan-finished', 12, false]]);
  assert.deepEqual(ctx.data.db.history, []);
  assert.equal(ctx.calls.some((call) => call[0] === 'alert'), false);
});
