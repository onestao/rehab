import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadPlanAi() {
  const code = readFileSync(new URL('../plan-ai.js', import.meta.url), 'utf8');
  const sandbox = {
    window: {},
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
      health: { exerciseLogs: [], profile: {}, dietGoal: null }
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
