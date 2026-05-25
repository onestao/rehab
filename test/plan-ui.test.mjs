import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadPlanUi() {
  const code = readFileSync(new URL('../plan-ui.js', import.meta.url), 'utf8');
  const sandbox = {
    window: {},
    console,
    document: {
      querySelectorAll() {
        return [];
      }
    }
  };
  vm.runInNewContext(code, sandbox);
  return sandbox.window.dataPlanUi;
}

function createContext(api, plans) {
  return {
    ...api,
    db: { dailyPlans: plans, health: { weights: [], dietGoal: null } },
    selectedPlanId: plans[0]?.id || '',
    getTodayDailyPlans() {
      return plans;
    },
    ensureTodayPlan() {
      return null;
    },
    aggregateCompletionRate() {
      return { done: 0, total: 0, rate: 0 };
    },
    completionRate() {
      return { done: 0, total: 0, rate: 0 };
    },
    planTypeMeta(type = 'rehab') {
      const map = {
        rehab: { label: '康复计划', taskLabel: '康复任务', icon: 'self_improvement' },
        bulk: { label: '增肌日程', taskLabel: '增肌任务', icon: 'fitness_center' },
        cut: { label: '减脂日程', taskLabel: '减脂任务', icon: 'local_fire_department' }
      };
      return map[type] || map.rehab;
    },
    logicalDateKey() {
      return '2026-05-25';
    },
    dateKey() {
      return '2026-05-25';
    },
    dateFromKey(value) {
      return new Date(`${value}T00:00:00`);
    },
    activeRecords(list) {
      return list || [];
    },
    sortedWeights() {
      return [];
    },
    todayTrainingCalories() {
      return 0;
    },
    escapeHtml(value) {
      return String(value ?? '');
    },
    ensurePlanPrefs() {
      return { showCooldownDock: true };
    },
    pendingCooldownCount(plan) {
      return Array.isArray(plan?.pendingCooldowns) ? plan.pendingCooldowns.length : 0;
    },
    renderPlanIntakeRing() {
      return '';
    }
  };
}

test('today card removes Today kicker and disables empty cooldown dock', () => {
  const api = loadPlanUi();
  const plans = [{ id: 'p1', type: 'bulk', title: '增肌日程', items: [], pendingCooldowns: [] }];
  const html = api.renderPlanTodaySection.call(createContext(api, plans));

  assert.equal(html.includes('<span class="cardio-kicker">今日</span>'), false);
  assert.match(html, /openPlanTodayAiSheet/);
  assert.match(html, /aria-label="暂无待集中拉伸"/);
  assert.match(html, /disabled/);
});

test('today AI types use selected plan first and include other daily plan types', () => {
  const api = loadPlanUi();
  const plans = [
    { id: 'rehab', type: 'rehab', items: [] },
    { id: 'bulk', type: 'bulk', items: [] },
    { id: 'cut', type: 'cut', items: [] }
  ];
  const ctx = createContext(api, plans);
  ctx.selectedPlanId = 'bulk';

  assert.deepEqual(Array.from(api.todayPlanAiTypes.call(ctx)), ['bulk', 'rehab', 'cut']);
});

test('task drawer exposes compact cancel daily plan action', () => {
  const api = loadPlanUi();
  const plans = [{
    id: 'rehab',
    type: 'rehab',
    title: '康复计划',
    items: [{ id: 'task-1', name: '桥式', status: 'todo', spec: { sets: 3, reps: 12 } }],
    pendingCooldowns: []
  }];
  const html = api.renderPlanTaskDrawerBody.call(createContext(api, plans), 'rehab');

  assert.match(html, /plan-drawer-summary/);
  assert.match(html, /data-cancel-plan-id="rehab"/);
  assert.match(html, /plan-cancel-day-btn/);
  assert.match(html, /取消计划/);
});
