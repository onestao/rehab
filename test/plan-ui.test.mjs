import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadPlanUi() {
  const policyCode = readFileSync(new URL('../rehab-policy.js', import.meta.url), 'utf8');
  const code = readFileSync(new URL('../plan-ui.js', import.meta.url), 'utf8');
  const tabCalls = /** @type {{ page: string, nav: unknown }[]} */ ([]);
  const sandbox = {
    window: {},
    console,
    document: {
      querySelectorAll() {
        return [];
      }
    },
    __tabCalls: tabCalls,
    requestAnimationFrame(fn) {
      fn();
      return 1;
    }
  };
  sandbox.window.workout = {
    isPlaying: false,
    setMode() {},
    toggle() {}
  };
  sandbox.ui = {
    async tab(page, nav) {
      sandbox.__tabCalls.push({ page, nav });
    }
  };
  vm.runInNewContext(policyCode, sandbox);
  vm.runInNewContext(code, sandbox);
  sandbox.window.dataPlanUi.__testDocument = sandbox.document;
  sandbox.window.dataPlanUi.__testWindow = sandbox.window;
  sandbox.window.dataPlanUi.__testTabCalls = sandbox.__tabCalls;
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

test('today card removes Today kicker and shows weekly plan dock', () => {
  const api = loadPlanUi();
  const plans = [{ id: 'p1', type: 'bulk', title: '增肌日程', items: [], pendingCooldowns: [] }];
  const html = api.renderPlanTodaySection.call(createContext(api, plans));

  assert.equal(html.includes('<span class="cardio-kicker">今日</span>'), false);
  assert.match(html, /openPlanTodayAiSheet/);
  assert.match(html, /aria-label="本周计划"/);
  assert.match(html, /planWeekly\?\.open/);
  assert.doesNotMatch(html, /aria-label="暂无待集中拉伸"/);
});

test('diet ring displays intake above 100 percent while clamping visual progress', () => {
  const api = loadPlanUi();
  const ctx = {
    ...createContext(api, []),
    db: { dailyPlans: [], health: { dietGoal: { dailyCal: 2000 }, weights: [] } },
    todayCalories() {
      return 3000;
    },
    todayMacros() {
      return { pro: 90, carb: 300, fat: 80 };
    },
    defaultDietGoals() {
      return { pro: 100, carb: 250, fat: 70 };
    },
    ratio(value, total) {
      return total ? Math.max(0, Math.min(100, Math.round((value / total) * 100))) : 0;
    }
  };

  const html = api.renderPlanIntakeRing.call(ctx);

  assert.match(html, />150%<\/b>/);
  assert.match(html, /--progress:100;/);
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

test('today plan card renders an actionable state when no plan exists', () => {
  const api = loadPlanUi();
  const html = api.renderTodayV6PlanCard.call(createContext(api, []));

  assert.match(html, /当前训练计划/);
  assert.match(html, /今天还没有训练计划/);
  assert.match(html, /openNewPlanSheet/);
  assert.match(html, /openPlanTodayAiSheet/);
});

test('today AI reminder keeps visible content without configured AI', () => {
  const api = loadPlanUi();
  const html = api.renderTodayAiReminder.call(createContext(api, []));

  assert.match(html, /今日 AI 提醒/);
  assert.match(html, /配置 AI 后/);
  assert.match(html, /打开 AI/);
  assert.doesNotMatch(html, /<div class="collapse-content"><\/div>/);
});

test('new plan AI entry opens generator without creating a manual placeholder', () => {
  const api = loadPlanUi();
  const ctx = {
    ...createContext(api, []),
    _newPlanTypes: ['rehab', 'bulk'],
    createDailyPlan() {
      this.createdPlan = true;
      return { id: 'created', type: 'rehab' };
    },
    save() {
      this.saved = true;
    },
    _closeActiveModal() {
      this.closedModal = true;
    },
    openPlanAiSheet(mode, types) {
      this.openedPlanAi = { mode, types };
    },
    renderTodayPage() {
      this.renderedToday = true;
    }
  };

  const result = api.createSelectedPlans.call(ctx, true);

  assert.equal(result, undefined);
  assert.equal(ctx.createdPlan, undefined);
  assert.equal(ctx.saved, undefined);
  assert.equal(ctx.renderedToday, undefined);
  assert.equal(ctx.closedModal, true);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.openedPlanAi)), { mode: 'today', types: ['rehab', 'bulk'] });
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

test('task drawer does not fall back to another plan when requested plan was cancelled', () => {
  const api = loadPlanUi();
  const plans = [{
    id: 'other',
    type: 'bulk',
    title: '增肌日程',
    items: [{ id: 'task-1', name: '深蹲', status: 'todo', spec: { sets: 3, reps: 8 } }],
    pendingCooldowns: []
  }];
  const html = api.renderPlanTaskDrawerBody.call(createContext(api, plans), 'cancelled');

  assert.match(html, /暂无训练任务/);
  assert.doesNotMatch(html, /深蹲/);
});

test('prescription confirmation copy does not call cautious prescriptions non-prescription', async () => {
  const api = loadPlanUi();
  const task = {
    id: 'task-1',
    name: '侧卧髋外展',
    status: 'todo',
    category: 'main',
    requiresUserConfirm: true,
    userConfirmed: false,
    prescriptionActionId: 'pa-hip-abduction',
    policy: { source: 'prescription', cautious: true },
    spec: { sets: 2, reps: 10, work: 3 }
  };
  const plans = [{ id: 'rehab', type: 'rehab', title: '康复计划', items: [task], pendingCooldowns: [] }];
  const ctx = {
    ...createContext(api, plans),
    findTask() { return { plan: plans[0], task }; },
    _confirmModal(config) { this.confirmModal = config; }
  };

  const html = api.renderPlanTaskDrawerBody.call(ctx, 'rehab');
  await api.handlePlanTaskTap.call(ctx, 'rehab', 'task-1');

  assert.match(html, /医嘱 · 待确认/);
  assert.equal(ctx.confirmModal.title, '确认医嘱');
  assert.match(ctx.confirmModal.message, /来自医嘱/);
  assert.doesNotMatch(ctx.confirmModal.message, /非医嘱/);
});

test('running a plan task closes the task drawer before entering workout', async () => {
  const api = loadPlanUi();
  const task = {
    id: 'task-1',
    name: '基础臀桥',
    status: 'todo',
    category: 'main',
    spec: { sets: 1, reps: 12, work: 0 }
  };
  const plans = [{ id: 'rehab', type: 'rehab', title: '康复计划', items: [task], pendingCooldowns: [] }];
  const calls = [];
  const ctx = {
    ...createContext(api, plans),
    findTask() { return { plan: plans[0], task }; },
    updateItemStatus(_planId, _taskId, status) {
      task.status = status;
      calls.push(['status', status]);
    },
    _planActions() {
      return [{ id: 'existing-action' }];
    },
    _replacePlanActions(actions) {
      calls.push(['replace', actions.map((item) => item.id).join(',')]);
    },
    closePlanTaskDrawer() {
      calls.push(['close-drawer']);
      this.drawerClosed = true;
    },
    save() {
      calls.push(['save']);
    },
    renderWorkoutPlanCard() {
      calls.push(['render-workout-plan-card']);
    },
    renderActions() {
      calls.push(['render-actions']);
    },
    updatePlanWorkoutBanner() {
      calls.push(['update-banner']);
    }
  };
  api.__testWindow.workout = {
    isPlaying: false,
    setMode(mode) {
      calls.push(['mode', mode]);
    },
    toggle() {
      calls.push(['toggle']);
      this.isPlaying = true;
    }
  };

  await api.runPlanTask.call(ctx, 'rehab', 'task-1');

  assert.equal(ctx.drawerClosed, true);
  assert.equal(task.status, 'in-progress');
  assert.equal(ctx.activeRun.planId, 'rehab');
  assert.deepEqual(api.__testTabCalls.map((item) => item.page), ['workout']);
});

test('editing a saved plan task updates action identity and locks the task', () => {
  const api = loadPlanUi();
  const task = { id: 'task-1', name: '基础臀桥', category: 'main', spec: { sets: 1, reps: 12, work: 3 }, userOverride: false, actionKey: 'bridge-basic' };
  const plans = [{ id: 'rehab', type: 'rehab', items: [task] }];
  const ctx = {
    ...createContext(api, plans),
    findTask() { return { plan: plans[0], task }; },
    save() { this.saved = true; },
    _closeActiveModal() { this.closed = true; },
    touchRecord(record) { record.updatedAt = 456; }
  };
  const fields = {
    planEditName: { value: '侧卧髋外展', getAttribute() { return ''; } },
    planEditCategory: { value: 'main' },
    planEditSets: { value: '2' },
    planEditReps: { value: '10' },
    planEditWork: { value: '3' },
    planEditRest: { value: '30' },
    planEditRepRest: { value: '0' },
    planEditIsAlt: { checked: false },
    planEditReason: { value: '用户改为处方动作' }
  };
  api.__testDocument.getElementById = (id) => fields[id] || null;

  api.savePlanTaskEdit.call(ctx, 'rehab', 'task-1');

  assert.equal(task.name, '侧卧髋外展');
  assert.equal(task.userOverride, true);
  assert.equal(task.actionKey, 'side-lying-hip-abduction');
  assert.equal(task.canonicalName, '侧卧髋外展');
  assert.notEqual(task.actionKey, 'bridge-basic');
  assert.equal(ctx.saved, true);
});
