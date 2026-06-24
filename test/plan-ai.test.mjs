import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadPlanAi() {
  const pureCode = readFileSync(new URL('../plan-ai-pure.js', import.meta.url), 'utf8');
  const policyCode = readFileSync(new URL('../rehab-policy.js', import.meta.url), 'utf8');
  const code = readFileSync(new URL('../plan-ai.js', import.meta.url), 'utf8');
  const sandbox = {
    window: { toast: { show() {} } },
    document: {},
    console
  };
  vm.runInNewContext(pureCode, sandbox);
  vm.runInNewContext(policyCode, sandbox);
  vm.runInNewContext(code, sandbox);
  sandbox.window.dataPlanAi.__testDocument = sandbox.document;
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

test('plan action search includes rehab prescriptions and action library', () => {
  const api = loadPlanAi();
  const ctx = createContext(api);
  ctx.db.health.rehabWeekly = [{
    weekStart: '2026-06-23',
    actions: [{ actionId: 'rx-hip-abduction', name: '侧卧髋外展', rawDescription: '臀中肌轻量激活', spec: { sets: 2, reps: 10, work: 3 } }]
  }];
  ctx.db.actions = [{ id: 'lib-bridge', libOnly: true, name: '夹砖臀桥', tags: ['髋'], spec: { sets: 1, reps: 12, work: 5 } }];

  const prescription = api.searchPlanActionChoices.call(ctx, '外展', 4)[0];
  const library = api.searchPlanActionChoices.call(ctx, '夹砖', 4)[0];

  assert.equal(prescription.source, 'prescription');
  assert.equal(prescription.prescriptionActionId, 'rx-hip-abduction');
  assert.equal(prescription.actionKey, 'side-lying-hip-abduction');
  assert.equal(library.source, 'action-library');
  assert.equal(library.sourceActionId, 'lib-bridge');
});

test('plan preview collection treats edited action name as user override with new identity', () => {
  const api = loadPlanAi();
  const ctx = createContext(api);
  const input = (value, attrs = {}) => ({
    value,
    checked: !!attrs.checked,
    hasAttribute(name) { return Boolean(attrs[name]); },
    querySelector() { return null; }
  });
  const itemAttrs = {
    'data-original-name': '基础臀桥',
    'data-original-category': 'main',
    'data-original-spec': 'sets:2|reps:12|work:3|repRest:0|actionRest:30|isAlt:false|mode:reps',
    'data-original-reason': 'AI 生成',
    'data-original-user-override': 'false',
    'data-preview-action-key': 'bridge-basic',
    'data-preview-canonical-name': '基础臀桥',
    'data-preview-progression-group': 'bridge-adduction',
    'data-preview-progression-level': '1',
    'data-preview-chain-id': 'plan-chain-bridge'
  };
  const itemEl = {
    getAttribute(name) { return itemAttrs[name] || ''; },
    querySelector(selector) {
      const map = {
        '[data-preview-name]': input('侧卧髋外展'),
        '[data-preview-category]': input('main'),
        '[data-preview-work]': input('3'),
        '[data-preview-reps]': input('10'),
        '[data-preview-is-alt]': input('', { checked: false }),
        '[data-preview-mode]': input('reps'),
        '[data-preview-sets]': input('2'),
        '[data-preview-rep-rest]': input('0'),
        '[data-preview-rest]': input('30'),
        '[data-preview-reason]': input('用户改成处方动作'),
        '[data-preview-user-confirm]': null
      };
      return map[selector] || null;
    },
    querySelectorAll(selector) {
      return selector === '[data-auto-filled]' ? [] : [];
    }
  };
  const planEl = {
    querySelector(selector) {
      if (selector === '[data-preview-date]') return input('2026-05-25');
      if (selector === '[data-preview-notes]') return input('');
      if (selector === '.plan-ai-preview-type') return { textContent: '康复计划' };
      return null;
    },
    querySelectorAll(selector) {
      return selector === '.plan-ai-preview-item' ? [itemEl] : [];
    }
  };
  api.__testDocument.querySelectorAll = (selector) => selector === '.plan-ai-preview-plan' ? [planEl] : [];

  const plans = api.collectPlanAiPreviewPlans.call(ctx);
  const item = plans[0].items[0];

  assert.equal(item.name, '侧卧髋外展');
  assert.equal(item.userOverride, true);
  assert.equal(item.actionKey, 'side-lying-hip-abduction');
  assert.equal(item.canonicalName, '侧卧髋外展');
  assert.notEqual(item.actionKey, 'bridge-basic');
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
    sets: 2,
    reps: 1,
    work: 40,
    repRest: 0,
    actionRest: 30,
    isAlt: false,
    mode: 'hold'
  });
});

test('plan AI parser accepts grouped warmup main and stretching structures', () => {
  const api = loadPlanAi();
  const ctx = createContext(api);
  const parsed = api.parsePlanAiPayload.call(ctx, JSON.stringify({
    date: '2026-05-25',
    type: 'rehab',
    title: '左髋康复',
    overview: '根据您的要求，若任何动作导致疼痛达到4/10，请立即降级或停止。',
    warmup: [
      { name: '踝泵', sets: 1, reps: 15, work: 1 }
    ],
    mainExercises: [
      { exercise: '侧卧髋外展', sets: 2, reps: 10, work: 3, reason: '臀中肌轻量激活' },
      { action: { name: '基础臀桥' }, prescription: { sets: 2, reps: 12, work: 3, actionRest: 20 } }
    ],
    stretching: [
      { title: '臀中肌拉伸', duration: 45 }
    ]
  }), ['rehab']);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.plans[0].items.length, 4);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.plans[0].items.map((item) => item.category))), ['warmup', 'main', 'main', 'cooldown']);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.plans[0].items.map((item) => item.name))), ['踝泵', '侧卧髋外展', '基础臀桥', '臀中肌拉伸']);
  assert.match(parsed.plans[0].notes, /疼痛达到4\/10/);
  assert.equal(api.validatePlanAiPayload.call(ctx, JSON.stringify({
    date: '2026-05-25',
    type: 'rehab',
    warmup: [{ name: '踝泵', sets: 1, reps: 15, work: 1 }],
    mainExercises: [{ exercise: '侧卧髋外展', sets: 2, reps: 10, work: 3 }],
    stretching: [{ title: '臀中肌拉伸', duration: 45 }]
  }), ['rehab']).ok, true);
});

test('plan AI parser descends into object phase containers', () => {
  const api = loadPlanAi();
  const ctx = createContext(api);
  const parsed = api.parsePlanAiPayload.call(ctx, JSON.stringify({
    plan: {
      date: '2026-05-25',
      type: 'rehab',
      warmup: {
        items: [{ name: '站姿髋环绕', sets: 1, reps: 10, work: 2 }]
      },
      main: {
        exercises: [
          { name: '侧卧髋外展', sets: 2, reps: 10, work: 3 },
          { name: '基础臀桥', prescription: { sets: 2, reps: 12, work: 3 } }
        ]
      },
      cooldown: {
        stretches: [{ name: '臀中肌拉伸', duration: 40 }]
      }
    }
  }), ['rehab']);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.plans[0].items.length, 4);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.plans[0].items.map((item) => item.category))), ['warmup', 'main', 'main', 'cooldown']);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.plans[0].items.map((item) => item.name))), ['站姿髋环绕', '侧卧髋外展', '基础臀桥', '臀中肌拉伸']);
});

test('plan AI parser accepts suffixed plan and action container names', () => {
  const api = loadPlanAi();
  const ctx = createContext(api);
  const parsed = api.parsePlanAiPayload.call(ctx, JSON.stringify({
    dayPlan: {
      date: '2026-05-25',
      type: 'rehab',
      exercisePlan: {
        warmupExercises: [{ name: '猫牛式', sets: 1, reps: 8, work: 2 }],
        trainingActions: [
          { name: '弹力带侧向行走', prescription: { sets: 2, reps: 10, work: 3 } }
        ],
        stretchList: [{ name: '髋屈肌拉伸', duration: 40 }]
      }
    }
  }), ['rehab']);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.plans[0].items.length, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.plans[0].items.map((item) => item.category))), ['warmup', 'main', 'cooldown']);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.plans[0].items.map((item) => item.name))), ['猫牛式', '弹力带侧向行走', '髋屈肌拉伸']);
});

test('plan AI parser keeps exercise items that include instruction steps', () => {
  const api = loadPlanAi();
  const ctx = createContext(api);
  const raw = JSON.stringify({
    date: '2026-06-23',
    type: 'rehab',
    title: '康复计划',
    items: [
      {
        name: '站姿髋环绕',
        category: 'warmup',
        sets: 1,
        reps: 8,
        work: 2,
        steps: ['扶墙站稳', '小幅度画圈']
      },
      {
        name: '侧卧髋外展',
        category: 'main',
        prescription: { sets: 2, reps: 10, work: 3 },
        steps: ['侧卧垫软垫', '脚尖微向前']
      },
      {
        name: '臀中肌拉伸',
        category: 'cooldown',
        duration: 40,
        steps: ['仰卧抱膝', '疼痛超过阈值停止']
      }
    ]
  });
  const parsed = api.parsePlanAiPayload.call(ctx, raw, ['rehab']);
  const validated = api.validatePlanAiPayload.call(ctx, raw, ['rehab']);

  assert.equal(validated.ok, true);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.plans[0].items.length, 3);
  assert.equal(parsed.plans[0].title, '康复计划');
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.plans[0].items.map((item) => item.name))), ['站姿髋环绕', '侧卧髋外展', '臀中肌拉伸']);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.plans[0].items.map((item) => item.category))), ['warmup', 'main', 'cooldown']);
});

test('plan AI parser prefers direct action arrays over whole-plan fallback item', () => {
  const api = loadPlanAi();
  const ctx = createContext(api);
  const parsed = api.parsePlanAiPayload.call(ctx, JSON.stringify({
    date: '2026-06-23',
    type: 'rehab',
    name: '康复计划',
    items: [
      { name: '刷子轻抚阔筋膜张肌感觉激活', category: 'warmup', sets: 1, reps: 10, work: 2 },
      { name: '泡沫轴放松臀中肌与大腿前外侧', category: 'warmup', duration: 40 },
      { name: '弹力带侧卧髋部外展', category: 'main', prescription: { sets: 2, reps: 10, work: 3 } },
      { name: '靠墙夹砖闭眼平衡', category: 'main', duration: 30 },
      { name: '夹砖臀桥', category: 'main', sets: 2, reps: 12, work: 3 },
      { name: '动态哥本哈根侧桥', category: 'main', duration: 20 },
      { name: '泡沫轴放松大腿内侧', category: 'cooldown', duration: 40 },
      { name: '髂胫束/阔筋膜张肌拉伸', category: 'cooldown', duration: 40 }
    ]
  }), ['rehab']);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.plans[0].items.length, 8);
  assert.notEqual(parsed.plans[0].items[0].name, '康复计划');
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.plans[0].items.map((item) => item.category))), ['warmup', 'warmup', 'main', 'main', 'main', 'main', 'cooldown', 'cooldown']);
});

test('plan AI parser keeps explicit item categories when direct items array is chosen', () => {
  const api = loadPlanAi();
  const ctx = createContext(api);
  const parsed = api.parsePlanAiPayload.call(ctx, JSON.stringify({
    date: '2026-06-24',
    type: 'rehab',
    name: '康复计划',
    items: [
      { name: '刷子轻抚阔筋膜张肌感觉激活', category: 'warmup', sets: 1, reps: 10, work: 2 },
      { name: '泡沫轴放松臀中肌与大腿前外侧', category: 'warmup', duration: 40 },
      { name: '侧卧夹毛巾抬腿', category: 'main', sets: 2, reps: 10, work: 3 },
      { name: '靠墙深蹲', category: 'main', duration: 30 },
      { name: '靠墙夹砖闭眼平衡', category: 'main', duration: 30 },
      { name: '单腿站立外展', category: 'main', sets: 2, reps: 10, work: 3 },
      { name: '夹砖内收骨盆臀桥', category: 'main', sets: 2, reps: 12, work: 3 },
      { name: '四肢抬起压毛巾', category: 'main', sets: 2, reps: 10, work: 3 },
      { name: '髂胫束/阔筋膜张肌拉伸', category: 'cooldown', duration: 40 },
      { name: '臀肌拉伸', category: 'cooldown', duration: 40 }
    ]
  }), ['rehab']);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.plans[0].items.length, 10);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.plans[0].items.map((item) => item.category))), ['warmup', 'warmup', 'main', 'main', 'main', 'main', 'main', 'main', 'cooldown', 'cooldown']);
});

test('plan AI parser extracts fenced JSON with phase sections', () => {
  const api = loadPlanAi();
  const ctx = createContext(api);
  const raw = `好的，以下是计划：
\`\`\`json
{
  "plan": {
    "date": "2026-05-25",
    "type": "rehab",
    "sections": [
      { "phase": "热身", "items": [{ "name": "站姿髋屈伸", "spec": { "sets": 1, "reps": 12, "work": 2 } }] },
      { "phase": "主训练", "exercises": [{ "name": "弹力带侧步", "sets": 2, "reps": 10, "work": 3 }] },
      { "phase": "拉伸", "actions": [{ "name": "髂胫束放松", "duration": 40 }] }
    ]
  }
}
\`\`\`
请按疼痛阈值执行。`;
  const parsed = api.parsePlanAiPayload.call(ctx, raw, ['rehab']);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.plans[0].items.length, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.plans[0].items.map((item) => item.category))), ['warmup', 'main', 'cooldown']);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.plans[0].items.map((item) => item.name))), ['站姿髋屈伸', '弹力带侧步', '髂胫束放松']);
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

test('plan AI context tells the model to keep warmup and cooldown below main training load', () => {
  const api = loadPlanAi();
  const prompt = api.buildPlanAiContext.call(createContext(api), 'today', '安排高强度主训练', ['bulk']);

  assert.match(prompt, /阶段难度必须分层/);
  assert.match(prompt, /warmup 只用于准备身体/);
  assert.match(prompt, /cooldown 只用于拉伸\/呼吸\/恢复/);
  assert.match(prompt, /main 才承载主要训练负荷/);
  assert.match(prompt, /不得作为进阶加量对象/);
});

test('plan AI parser caps warmup and cooldown intensity even when model copies main training load', () => {
  const api = loadPlanAi();
  const ctx = createContext(api);
  const parsed = api.parsePlanAiPayload.call(ctx, JSON.stringify({
    date: '2026-05-25',
    type: 'bulk',
    items: [
      { name: '动态热身深蹲', category: 'warmup', chainId: 'squat-chain', currentLevel: 4, spec: { sets: 5, reps: 20, work: 5, repRest: 15, actionRest: 75, isAlt: false, mode: 'reps' } },
      { name: '腿后侧拉伸', category: 'cooldown', chainId: 'stretch-chain', currentLevel: 3, spec: { sets: 4, reps: 12, work: 60, repRest: 10, actionRest: 90, isAlt: false, mode: 'hold' } },
      { name: '杠铃深蹲', category: 'main', chainId: 'squat-chain', currentLevel: 4, spec: { sets: 5, reps: 5, work: 4, repRest: 15, actionRest: 75, isAlt: false, mode: 'reps' } }
    ]
  }), ['bulk']);

  assert.equal(parsed.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.plans[0].items[0].spec)), {
    sets: 2,
    reps: 12,
    work: 5,
    repRest: 5,
    actionRest: 30,
    isAlt: false,
    mode: 'reps'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.plans[0].items[1].spec)), {
    sets: 2,
    reps: 8,
    work: 45,
    repRest: 0,
    actionRest: 30,
    isAlt: false,
    mode: 'hold'
  });
  assert.equal(parsed.plans[0].items[0].chainId, '');
  assert.equal(parsed.plans[0].items[0].currentLevel, null);
  assert.equal(parsed.plans[0].items[1].chainId, '');
  assert.equal(parsed.plans[0].items[1].currentLevel, null);
  assert.equal(parsed.plans[0].items[2].chainId, 'squat-chain');
  assert.equal(parsed.plans[0].items[2].currentLevel, 4);
  assert.match(parsed.warnings.join('\n'), /phaseCap\.sets/);
  assert.match(parsed.warnings.join('\n'), /phaseCap\.actionRest/);
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
  assert.match(html, /data-preview-sets value="2"/);
  assert.match(html, /data-preview-rep-rest/);
  assert.match(html, /data-preview-rep-rest value="5"/);
  assert.match(html, /data-preview-rest/);
  assert.match(html, /data-preview-rest value="30"/);
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
    items: [{ name: 'AI 新动作', category: 'main', requiresUserConfirm: true, userConfirmed: true, spec: { sets: 2, reps: 12, work: 3, repRest: 0, actionRest: 30, isAlt: false, mode: 'reps' } }]
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
