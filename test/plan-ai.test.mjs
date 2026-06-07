import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadPlanAi() {
  const code = readFileSync(new URL('../plan-ai.js', import.meta.url), 'utf8');
  const sandbox = {
    window: { toast: { show() {} } },
    document: {},
    console
  };
  vm.runInNewContext(code, sandbox);
  return sandbox.window.dataPlanAi;
}

function createContext(api) {
  return {
    ...api,
    db: {
      dailyPlans: [],
      history: [],
      health: { exerciseLogs: [], profile: {}, dietGoal: null, rehabWeekly: [] }
    },
    logicalDateKey() {
      return '2026-05-25';
    },
    dateKey() {
      return '2026-05-25';
    },
    escapeHtml(value) {
      return String(value ?? '');
    },
    ensurePlanPrefs() {
      return { equipment: [], customEquipment: [], stage: 'maintenance', customStageLabel: '' };
    },
    planEquipmentOptions() {
      return [];
    },
    activeRecords(list) {
      return (list || []).filter((item) => item && !item.deleted);
    },
    completionRate() {
      return { done: 0, total: 0, rate: 0 };
    },
    historyDayKey(entry) {
      return entry?.dayKey || '2026-05-25';
    },
    historyNames(entry) {
      return (entry?.actions || []).map((item) => item.name || '未命名');
    },
    exerciseLabel(type = '', entry = {}) {
      if (type === 'strength') return entry?.customName || '力量训练';
      return type || '运动';
    },
    planTypeMeta(type = 'rehab') {
      const map = {
        rehab: { label: '康复计划', icon: 'self_improvement' },
        cut: { label: '减脂日程', icon: 'local_fire_department' },
        bulk: { label: '增肌日程', icon: 'fitness_center' },
        maintenance: { label: '综合训练', icon: 'health_and_safety' },
        custom: { label: '自定义计划', icon: 'event_note' }
      };
      return map[type] || map.rehab;
    },
    touchRecord(record) {
      record.updatedAt = 123;
    }
  };
}

test('plan AI type chips render all plan types with selected chips active', () => {
  const api = loadPlanAi();
  const html = api.renderPlanAiTypeChips.call(createContext(api), ['bulk', 'cut']);

  assert.match(html, /康复计划/);
  assert.match(html, /减脂日程/);
  assert.match(html, /增肌日程/);
  assert.match(html, /综合训练/);
  assert.match(html, /自定义计划/);
  assert.match(html, /onclick="data\.togglePlanAiType\('bulk'\)"/);
  assert.match(html, /plan-ai-type-chip active[\s\S]*?aria-pressed="true"[\s\S]*?增肌日程/);
  assert.match(html, /plan-ai-type-chip active[\s\S]*?aria-pressed="true"[\s\S]*?减脂日程/);
});

test('plan AI parser fills usable spec defaults and preserves alternation', () => {
  const api = loadPlanAi();
  const ctx = createContext(api);
  const parsed = api.parsePlanAiPayload.call(ctx, JSON.stringify({
    date: '2026-05-25',
    type: 'bulk',
    items: [
      { name: '保加利亚分腿蹲', category: 'main', spec: { sets: 4, reps: 12, work: 3, isAlt: '双侧交替' } },
      { name: '平板支撑', category: 'cooldown', spec: { sets: 3, work: 40, actionRest: 75 } }
    ]
  }), ['bulk']);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.plans[0].items[0].category, 'main');
  assert.equal(parsed.plans[0].items[1].category, 'cooldown');
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.plans[0].items[0].spec)), {
    sets: 4,
    reps: 12,
    work: 3,
    repRest: 15,
    actionRest: 45,
    isAlt: true,
    mode: 'alt-reps'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.plans[0].items[1].spec)), {
    sets: 3,
    reps: 1,
    work: 40,
    repRest: 10,
    actionRest: 75,
    isAlt: false,
    mode: 'hold'
  });
});

test('plan AI parser supplies hold duration and caps very long rests', () => {
  const api = loadPlanAi();
  const ctx = createContext(api);
  const parsed = api.parsePlanAiPayload.call(ctx, JSON.stringify({
    date: '2026-05-25',
    type: 'rehab',
    items: [
      { name: '平板支撑', category: 'main', spec: { sets: 3, actionRest: 999 } }
    ]
  }), ['rehab']);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.plans[0].items[0].spec.reps, 1);
  assert.equal(parsed.plans[0].items[0].spec.work, 30);
  assert.equal(parsed.plans[0].items[0].spec.actionRest, 45);
});

test('plan AI parser supplies fallback work seconds for rep actions missing work', () => {
  const api = loadPlanAi();
  const ctx = createContext(api);
  const parsed = api.parsePlanAiPayload.call(ctx, JSON.stringify({
    date: '2026-05-25',
    type: 'bulk',
    items: [{ name: '俯卧撑', category: 'main', spec: { sets: 3, reps: 10, repRest: 0, actionRest: 60 } }]
  }), ['bulk']);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.plans[0].items[0].spec.reps, 10);
  assert.equal(parsed.plans[0].items[0].spec.work, 3);
  assert.ok(Array.isArray(parsed.warnings));
  assert.match(parsed.warnings.join('\n'), /work/);
});

test('plan AI parser warns when AI omits rest fields entirely', () => {
  const api = loadPlanAi();
  const ctx = createContext(api);
  const parsed = api.parsePlanAiPayload.call(ctx, JSON.stringify({
    date: '2026-05-25',
    type: 'bulk',
    items: [{ name: '哑铃肩推', category: 'main', spec: { sets: 3, reps: 10, work: 3 } }]
  }), ['bulk']);

  assert.equal(parsed.ok, true);
  assert.match(parsed.warnings.join('\n'), /repRest/);
  assert.match(parsed.warnings.join('\n'), /actionRest/);
});

test('plan AI parser allows short rests for low-level rehab actions', () => {
  const api = loadPlanAi();
  const ctx = createContext(api);
  const parsed = api.parsePlanAiPayload.call(ctx, JSON.stringify({
    date: '2026-05-25',
    type: 'rehab',
    items: [
      { name: '踝泵', category: 'main', currentLevel: 1, spec: { sets: 2, reps: 15, work: 1, actionRest: 10 } },
      { name: '股四头肌等长收缩', category: 'main', currentLevel: 1, spec: { sets: 2, reps: 10, work: 5 } }
    ]
  }), ['rehab']);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.plans[0].items[0].spec.actionRest, 10);
  assert.equal(parsed.plans[0].items[1].spec.actionRest, 20);
});

test('plan AI context includes today completed workouts and manual exercises', () => {
  const api = loadPlanAi();
  const ctx = createContext(api);
  ctx.db.history = [{
    id: 'h1',
    dayKey: '2026-05-25',
    duration: 1800,
    actions: [
      { name: '深蹲', sets: 4, reps: 8, work: 0 },
      { name: '卧推', sets: 3, reps: 10, work: 0 }
    ],
    actualSets: [
      { action: '深蹲', weightKg: 60, reps: 8 },
      { action: '深蹲', weightKg: 60, reps: 7 }
    ],
    cardio: { calories: 120 }
  }];
  ctx.db.health.exerciseLogs = [{
    id: 'e1',
    date: '2026-05-25',
    type: 'strength',
    customName: '哑铃划船',
    weightKg: 20,
    sets: 3,
    repsPerSet: 12,
    minutes: 15,
    calories: 80,
    note: '背部已疲劳'
  }];

  const prompt = api.buildPlanAiContext.call(ctx, 'today', '安排后续训练', ['bulk']);

  assert.match(prompt, /今日已完成运动摘要/);
  assert.match(prompt, /深蹲/);
  assert.match(prompt, /60kg×8/);
  assert.match(prompt, /卧推/);
  assert.match(prompt, /哑铃划船/);
  assert.match(prompt, /背部已疲劳/);
});

test('plan AI context includes six recent rehab prescriptions', () => {
  const api = loadPlanAi();
  const ctx = createContext(api);
  const weekStarts = ['2026-05-25', '2026-05-18', '2026-05-11', '2026-05-04', '2026-04-27', '2026-04-20', '2026-04-13'];
  ctx.db.health.rehabWeekly = weekStarts.map((weekStart, index) => ({
    id: `rw-${index}`,
    weekStart,
    actions: [{ name: `康复动作${index + 1}`, status: 'continued' }]
  }));

  const prompt = api.buildPlanAiContext.call(ctx, 'today', '安排康复训练', ['rehab']);

  assert.match(prompt, /近6周康复中心处方/);
  assert.match(prompt, /康复动作1/);
  assert.match(prompt, /康复动作6/);
  assert.doesNotMatch(prompt, /康复动作7/);
  assert.match(prompt, /第4-6周处方仅用于理解长期禁忌/);
});

test('plan AI context includes current target plan and body part constraints', () => {
  const api = loadPlanAi();
  const ctx = createContext(api);
  ctx.db.dailyPlans = [{
    id: 'today-rehab',
    date: '2026-05-25',
    type: 'rehab',
    title: '今日康复',
    notes: '原计划备注',
    items: [
      { id: 'done-knee', name: '靠墙蹲', category: 'main', status: 'done', spec: { sets: 2, reps: 0, work: 30 }, feedback: { rpe: 3 }, userOverride: false },
      { id: 'todo-ankle', name: '踝泵', category: 'main', status: 'todo', spec: { sets: 2, reps: 15, work: 1 }, userOverride: true }
    ]
  }];
  ctx.db.health.profile = {
    conditions: [{ type: 'injury', label: '左膝半月板损伤', severity: 'moderate', avoid: ['深蹲大重量'] }]
  };
  ctx.db.health.rehabWeekly = [{
    weekStart: '2026-05-25',
    actions: [
      { name: '台阶下放', bodyPart: '膝', status: 'watch', painLevel: 4, needsReview: true },
      { name: '跪姿后踢腿', bodyPart: '髋', status: 'dropped' }
    ]
  }];

  const prompt = api.buildPlanAiContext.call(ctx, 'today', '优化现有计划', ['rehab']);

  assert.match(prompt, /目标当前计划完整摘要/);
  assert.match(prompt, /今日康复/);
  assert.match(prompt, /靠墙蹲/);
  assert.match(prompt, /userOverride":true/);
  assert.match(prompt, /诊断\/处方部位约束/);
  assert.match(prompt, /"bodyPart":"膝"/);
  assert.match(prompt, /台阶下放\(疼痛4\/10\)/);
  assert.match(prompt, /跪姿后踢腿/);
  assert.match(prompt, /安全\/健康禁忌\/疼痛阈值 > 最近3周康复处方 > 当前计划保留\/改造/);
});

test('plan AI context scopes rehab prescriptions to selected conditions', () => {
  const api = loadPlanAi();
  const ctx = createContext(api);
  ctx.db.health.profile = {
    conditions: [
      { id: 'cond-knee', type: 'injury', label: '左膝半月板损伤', bodyPart: '膝', severity: 'moderate', avoid: ['深蹲大重量'] },
      { id: 'cond-shoulder', type: 'injury', label: '右肩撞击综合征', bodyPart: '肩', severity: 'mild', avoid: ['过顶推举'] }
    ]
  };
  ctx._planAiConditionIds = ['cond-knee'];
  ctx.db.health.rehabWeekly = [{
    weekStart: '2026-05-25',
    actions: [
      { name: '台阶下放', bodyPart: '膝', conditionId: 'cond-knee', conditionLabel: '左膝半月板损伤', status: 'continued' },
      { name: '肩外旋', bodyPart: '肩', conditionId: 'cond-shoulder', conditionLabel: '右肩撞击综合征', status: 'continued' }
    ]
  }];

  const prompt = api.buildPlanAiContext.call(ctx, 'today', '只练膝盖康复', ['rehab']);

  assert.match(prompt, /本次选中训练病症/);
  assert.match(prompt, /左膝半月板损伤/);
  assert.match(prompt, /未选中病症安全限制/);
  assert.match(prompt, /右肩撞击综合征/);
  assert.match(prompt, /选中病症相关处方强规则:[\s\S]*台阶下放/);
  assert.doesNotMatch(prompt, /选中病症相关处方强规则:[\s\S]*肩外旋[\s\S]*其他病症处方安全限制/);
  assert.match(prompt, /其他病症处方安全限制:[\s\S]*肩外旋/);
  assert.match(prompt, /即使某个目标没有对应康复中心处方，也要根据诊断、检查结果/);
});

test('plan AI condition chips default to injury and surgery conditions', () => {
  const api = loadPlanAi();
  const ctx = createContext(api);
  ctx.db.health.profile = {
    conditions: [
      { id: 'cond-knee', type: 'injury', label: '左膝损伤', bodyPart: '膝' },
      { id: 'cond-bp', type: 'chronic', label: '高血压', bodyPart: '全身' },
      { id: 'cond-acl', type: 'surgery', label: '前交叉韧带术后', bodyPart: '膝' }
    ]
  };

  const html = api.renderPlanAiConditionChips.call(ctx);

  assert.match(html, /左膝损伤/);
  assert.match(html, /高血压/);
  assert.match(html, /前交叉韧带术后/);
  assert.match(html, /cond-knee[\s\S]*aria-pressed="true"/);
  assert.match(html, /cond-bp[\s\S]*aria-pressed="false"/);
  assert.match(html, /cond-acl[\s\S]*aria-pressed="true"/);
});

test('plan AI can target exam results when diagnoses are missing', () => {
  const api = loadPlanAi();
  const ctx = createContext(api);
  ctx.db.health.profile = {
    conditions: [],
    examResults: [{ id: 'exam-mri', item: '膝关节 MRI', result: '左膝半月板后角损伤，少量积液', bodyPart: '膝', date: '2026-05-20' }]
  };

  const html = api.renderPlanAiConditionChips.call(ctx);
  const prompt = api.buildPlanAiContext.call(ctx, 'today', '根据检查结果安排康复', ['rehab']);

  assert.match(html, /膝关节 MRI/);
  assert.match(html, /exam:exam-mri[\s\S]*aria-pressed="true"/);
  assert.match(prompt, /本次选中训练病症/);
  assert.match(prompt, /膝关节 MRI/);
  assert.match(prompt, /半月板后角损伤/);
  assert.match(prompt, /诊断潦草或没有诊断时，可依赖检查结果作为目标来源/);
  assert.match(prompt, /requiresUserConfirm 必须为 true/);
});

test('plan AI preview exposes rest and alternation controls', () => {
  const api = loadPlanAi();
  const html = api.renderPlanAiPreviewItem.call(createContext(api), 0, 0, {
    name: '弓步蹲',
    category: 'warmup',
    spec: { sets: 3, reps: 10, work: 3, repRest: 15, actionRest: 60, isAlt: true }
  });

  assert.match(html, /data-preview-category/);
  assert.match(html, /value="warmup" selected/);
  assert.match(html, /data-preview-rep-rest/);
  assert.match(html, /data-preview-rest/);
  assert.match(html, /data-preview-is-alt checked/);
  assert.match(html, /每组次数/);
  assert.match(html, /组间休息/);
  assert.match(html, /双侧交替/);
});

test('plan AI cleanup deletes stale empty unselected plan types only', () => {
  const api = loadPlanAi();
  const ctx = createContext(api);
  ctx.selectedPlanId = 'bulk-empty';
  ctx.db = {
    dailyPlans: [
      { id: 'rehab', date: '2026-05-25', type: 'rehab', items: [{ id: 'a', deleted: false }] },
      { id: 'bulk-empty', date: '2026-05-25', type: 'bulk', items: [{ id: 'b', deleted: true }] },
      { id: 'cut-active', date: '2026-05-25', type: 'cut', items: [{ id: 'c', deleted: false }] }
    ]
  };

  api.cleanupEmptyUnselectedPlanTypes.call(ctx, [{ date: '2026-05-25', type: 'rehab' }]);

  assert.equal(ctx.db.dailyPlans[1].deleted, true);
  assert.equal(ctx.db.dailyPlans[2].deleted, undefined);
  assert.equal(ctx.selectedPlanId, '');
});

test('plan AI confirmation preserves completed and locked tasks while replacing unfinished unlocked tasks', () => {
  const api = loadPlanAi();
  const ctx = createContext(api);
  ctx.selectedPlanId = '';
  ctx.db.dailyPlans = [{
    id: 'existing-rehab',
    date: '2026-05-25',
    type: 'rehab',
    title: '旧康复计划',
    items: [
      { id: 'done-task', name: '已完成动作', status: 'done', category: 'main', spec: { sets: 1, reps: 10, work: 2 }, userOverride: false },
      { id: 'locked-task', name: '锁定动作', status: 'todo', category: 'main', spec: { sets: 1, reps: 10, work: 2 }, userOverride: true },
      { id: 'todo-task', name: '应被替换动作', status: 'todo', category: 'main', spec: { sets: 1, reps: 10, work: 2 }, userOverride: false }
    ]
  }];
  ctx._pendingPlanAiPlans = [{
    date: '2026-05-25',
    type: 'rehab',
    title: 'AI 康复计划',
    notes: 'AI notes',
    items: [{ name: 'AI 新动作', category: 'main', spec: { sets: 2, reps: 12, work: 3, repRest: 0, actionRest: 30, isAlt: false, mode: 'reps' } }]
  }];
  ctx.collectPlanAiPreviewPlans = () => ctx._pendingPlanAiPlans;
  ctx.ensureTaskShape = (item) => ({ id: item.id || `task-${item.name}`, status: item.status || 'todo', deleted: false, ...item });
  ctx.ensureDailyPlanShape = (plan) => ({ id: plan.id || 'existing-rehab', deleted: false, ...plan });
  ctx.getDailyPlans = (date) => ctx.db.dailyPlans.filter((plan) => plan.date === date && !plan.deleted);
  ctx.saveDailyPlan = (plan) => {
    const index = ctx.db.dailyPlans.findIndex((item) => item.id === plan.id || (!item.deleted && item.date === plan.date && item.type === plan.type));
    if (index >= 0) ctx.db.dailyPlans[index] = plan;
    else ctx.db.dailyPlans.unshift(plan);
  };
  ctx.cleanupEmptyUnselectedPlanTypes = () => {};
  ctx.save = () => { ctx.saved = true; };
  ctx.closePlanAiSheet = () => { ctx.closedSheet = true; };
  ctx._closeActiveModal = () => { ctx.closedModal = true; };
  ctx.render = () => { ctx.rendered = true; };
  api.confirmPlanAiPlans.call(ctx);

  const names = JSON.parse(JSON.stringify(ctx.db.dailyPlans[0].items.map((item) => item.name)));
  assert.deepEqual(names, ['已完成动作', '锁定动作', 'AI 新动作']);
  assert.equal(ctx.db.dailyPlans[0].source, 'ai');
  assert.equal(ctx.saved, true);
  assert.equal(ctx.closedSheet, true);
  assert.equal(ctx.closedModal, true);
  assert.equal(ctx.rendered, true);
});

test('plan AI confirmation blocks unconfirmed non-prescription suggestions', () => {
  const api = loadPlanAi();
  const ctx = createContext(api);
  ctx.db.dailyPlans = [];
  ctx._pendingPlanAiPlans = [{
    date: '2026-05-25',
    type: 'rehab',
    title: 'AI 康复计划',
    notes: '',
    items: [{ name: '低风险膝关节控制练习', category: 'main', requiresUserConfirm: true, userConfirmed: false, spec: { sets: 2, reps: 8, work: 3, repRest: 0, actionRest: 30, isAlt: false, mode: 'reps' } }]
  }];
  ctx.collectPlanAiPreviewPlans = () => ctx._pendingPlanAiPlans;
  ctx.save = () => { ctx.saved = true; };
  ctx.ensureTaskShape = (item) => item;
  ctx.ensureDailyPlanShape = (plan) => plan;
  ctx.getDailyPlans = () => [];
  api.confirmPlanAiPlans.call({
    ...ctx,
    activeRecords: ctx.activeRecords,
    cleanupEmptyUnselectedPlanTypes: () => {},
    saveDailyPlan: () => { ctx.savedPlan = true; }
  });

  assert.equal(ctx.saved, undefined);
  assert.equal(ctx.savedPlan, undefined);
});
