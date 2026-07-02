import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadPlanStore() {
  const policyCode = readFileSync(new URL('../rehab-policy.js', import.meta.url), 'utf8');
  const code = readFileSync(new URL('../plan-store.js', import.meta.url), 'utf8');
  const sandbox = {
    window: {},
    console,
    Date
  };
  vm.runInNewContext(policyCode, sandbox);
  vm.runInNewContext(code, sandbox);
  sandbox.window.dataPlanStore.__sandboxWindow = sandbox.window;
  return sandbox.window.dataPlanStore;
}

function createContext(api) {
  return {
    ...api,
    selectedPlanId: 'bulk',
    saved: 0,
    db: {
      dailyPlans: [
        {
          id: 'rehab',
          date: '2026-05-25',
          type: 'rehab',
          title: '康复计划',
          items: [{ id: 'r1', name: '桥式', status: 'todo', spec: { sets: 1, reps: 10 } }],
          pendingCooldowns: [],
          deleted: false
        },
        {
          id: 'bulk',
          date: '2026-05-25',
          type: 'bulk',
          title: '增肌日程',
          items: [{ id: 'b1', name: '深蹲', status: 'todo', spec: { sets: 3, reps: 10 } }],
          pendingCooldowns: ['b1'],
          deleted: false
        }
      ],
      prefs: {},
      progressionChains: []
    },
    activeRecords(list) {
      return (list || []).filter((item) => item && !item.deleted);
    },
    touchRecord(record, fields = []) {
      record.updatedAt = 123;
      record.__touched = fields;
    },
    save() {
      this.saved += 1;
    }
  };
}

test('deleting the last task soft deletes empty daily plan so its chip disappears', () => {
  const api = loadPlanStore();
  const ctx = createContext(api);

  assert.equal(api.deleteTask.call(ctx, 'bulk', 'b1'), true);

  const bulk = ctx.db.dailyPlans.find((plan) => plan.id === 'bulk');
  assert.equal(bulk.deleted, true);
  assert.equal(bulk.items[0].deleted, true);
  assert.equal(bulk.pendingCooldowns.length, 0);
  assert.equal(ctx.selectedPlanId, 'rehab');
  assert.deepEqual(Array.from(ctx.activeRecords(ctx.db.dailyPlans).map((plan) => plan.type)), ['rehab']);
  assert.equal(ctx.saved, 1);
});

test('progression after feedback records future suggestion without mutating completed task', () => {
  const api = loadPlanStore();
  const win = api.__sandboxWindow;
  win.planPolicy = {
    actionMetaForName() {
      return { chainId: 'bridge-chain', actionKey: 'bridge-basic', progressionGroup: 'bridge' };
    }
  };
  win.planProgression = {
    evaluate() {
      return {
        decision: 'progress',
        phase: 'ready-to-progress',
        targetLevel: 2,
        suggestedSpec: { sets: 4, reps: 12, work: 3 },
        reason: '连续太轻，建议进入下一阶动作',
        chainAlternatives: [{ lv: 2, name: '夹砖臀桥' }]
      };
    }
  };
  win.planChains = {
    find() {
      return {
        id: 'bridge-chain',
        levels: [{ lv: 1, name: '基础臀桥' }, { lv: 2, name: '夹砖臀桥' }]
      };
    }
  };
  const ctx = createContext(api);
  ctx.db.dailyPlans = [{
    id: 'rehab',
    date: '2026-05-25',
    type: 'rehab',
    title: '康复计划',
    items: [{
      id: 'r1',
      name: '基础臀桥',
      status: 'done',
      currentLevel: 1,
      chainId: 'bridge-chain',
      spec: { sets: 3, reps: 12, work: 3 },
      feedback: { rpe: 1, doneAt: 100 }
    }],
    pendingCooldowns: [],
    deleted: false
  }];
  ctx.db.progressionChains = [{
    id: 'bridge-chain',
    levels: [{ lv: 1, name: '基础臀桥' }, { lv: 2, name: '夹砖臀桥' }]
  }];

  const result = api.maybeApplyProgression.call(ctx, 'rehab', 'r1');

  const task = ctx.db.dailyPlans[0].items[0];
  assert.equal(result.decision, 'progress');
  assert.equal(task.name, '基础臀桥');
  assert.deepEqual(task.spec, { sets: 3, reps: 12, work: 3 });
  assert.equal(task.nextProgressionSuggestion.appliesTo, 'future-only');
  assert.equal(task.nextProgressionSuggestion.targetName, '夹砖臀桥');
  assert.equal(ctx.db.planAdjustments.length, 1);
  assert.equal(ctx.db.planAdjustments[0].status, 'previewed');
  assert.equal(ctx.saved, 1);
});

test('hold progression clears stale future suggestion', () => {
  const api = loadPlanStore();
  const win = api.__sandboxWindow;
  win.planPolicy = {
    actionMetaForName() {
      return { chainId: 'bridge-chain', actionKey: 'bridge-basic', progressionGroup: 'bridge' };
    }
  };
  win.planProgression = {
    evaluate() {
      return {
        decision: 'hold',
        targetLevel: 1,
        suggestedSpec: { sets: 3, reps: 12, work: 3 },
        reason: '用户选择保持/不再加量'
      };
    }
  };
  const ctx = createContext(api);
  ctx.db.dailyPlans = [{
    id: 'rehab',
    date: '2026-05-25',
    type: 'rehab',
    title: '康复计划',
    items: [{
      id: 'r1',
      name: '基础臀桥',
      status: 'done',
      currentLevel: 1,
      chainId: 'bridge-chain',
      spec: { sets: 3, reps: 12, work: 3 },
      feedback: { rpe: 1, noIncrease: true, doneAt: 200 },
      nextProgressionSuggestion: {
        appliesTo: 'future-only',
        decision: 'progress',
        targetLevel: 2,
        targetName: '夹砖臀桥',
        suggestedSpec: { sets: 4, reps: 12, work: 3 }
      }
    }],
    pendingCooldowns: [],
    deleted: false
  }];
  ctx.db.progressionChains = [{
    id: 'bridge-chain',
    levels: [{ lv: 1, name: '基础臀桥' }, { lv: 2, name: '夹砖臀桥' }]
  }];

  const result = api.maybeApplyProgression.call(ctx, 'rehab', 'r1');

  assert.equal(result.decision, 'hold');
  assert.equal(ctx.db.dailyPlans[0].items[0].nextProgressionSuggestion, null);
  assert.equal(ctx.saved, 1);
});

test('undo adjustment restores touched plans without replacing unrelated later edits', () => {
  const api = loadPlanStore();
  const ctx = createContext(api);
  ctx.selectedPlanId = 'other-plan';
  ctx.ensureRecordMeta = (record) => record;
  ctx.generateRecordId = (prefix) => `${prefix}-new`;
  ctx.ensureTaskShape = (item) => ({ status: 'todo', deleted: false, ...item });
  ctx.ensureDailyPlanShape = (plan) => ({
    id: plan.id || `plan-${plan.date}-${plan.type || 'rehab'}`,
    date: plan.date,
    type: plan.type || 'rehab',
    source: plan.source || 'manual',
    items: (plan.items || []).map((item) => ctx.ensureTaskShape(item)),
    deleted: !!plan.deleted
  });
  ctx.render = () => { ctx.rendered = true; };
  ctx.db.dailyPlans = [
    {
      id: 'target-plan',
      date: '2026-05-26',
      type: 'rehab',
      source: 'ai',
      items: [{ id: 'target-task', name: '调整后动作', status: 'todo', spec: { sets: 3, reps: 12 } }]
    },
    {
      id: 'other-plan',
      date: '2026-05-27',
      type: 'rehab',
      source: 'manual',
      items: [{ id: 'other-task', name: '撤销后用户新增动作', status: 'todo', spec: { sets: 1, reps: 8 } }]
    }
  ];
  ctx.db.planAdjustments = [{
    id: 'adj-1',
    status: 'applied',
    undo: { canUndo: true },
    beforePlans: [{
      id: 'target-plan',
      date: '2026-05-26',
      type: 'rehab',
      source: 'ai',
      items: [{ id: 'target-task', name: '调整前动作', status: 'todo', spec: { sets: 2, reps: 10 } }]
    }],
    afterPlans: [{
      id: 'target-plan',
      date: '2026-05-26',
      type: 'rehab',
      source: 'ai',
      items: [{ id: 'target-task', name: '调整后动作', status: 'todo', spec: { sets: 3, reps: 12 } }]
    }]
  }];

  assert.equal(api.undoLastPlanAdjustment.call(ctx, 'adj-1'), true);

  assert.deepEqual(JSON.parse(JSON.stringify(ctx.db.dailyPlans.find((plan) => plan.id === 'target-plan').items.map((item) => item.name))), ['调整前动作']);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.db.dailyPlans.find((plan) => plan.id === 'other-plan').items.map((item) => item.name))), ['撤销后用户新增动作']);
  assert.equal(ctx.selectedPlanId, 'other-plan');
  assert.equal(ctx.db.planAdjustments[0].status, 'reverted');
  assert.equal(ctx.saved, 1);
  assert.equal(ctx.rendered, true);
});
