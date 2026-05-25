import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadPlanStore() {
  const code = readFileSync(new URL('../plan-store.js', import.meta.url), 'utf8');
  const sandbox = {
    window: {},
    console,
    Date
  };
  vm.runInNewContext(code, sandbox);
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
