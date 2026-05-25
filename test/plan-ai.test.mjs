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
    logicalDateKey() {
      return '2026-05-25';
    },
    escapeHtml(value) {
      return String(value ?? '');
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
      { name: '保加利亚分腿蹲', category: 'main', spec: { sets: 4, isAlt: '双侧交替' } },
      { name: '平板支撑', category: 'cooldown', spec: { sets: 3, work: 40, actionRest: 75 } }
    ]
  }), ['bulk']);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.plans[0].items[0].category, 'main');
  assert.equal(parsed.plans[0].items[1].category, 'cooldown');
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.plans[0].items[0].spec)), {
    sets: 4,
    reps: 12,
    work: 0,
    repRest: 20,
    actionRest: 60,
    isAlt: true
  });
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.plans[0].items[1].spec)), {
    sets: 3,
    reps: 0,
    work: 40,
    repRest: 20,
    actionRest: 75,
    isAlt: false
  });
});

test('plan AI preview exposes rest and alternation controls', () => {
  const api = loadPlanAi();
  const html = api.renderPlanAiPreviewItem.call(createContext(api), 0, 0, {
    name: '弓步蹲',
    category: 'warmup',
    spec: { sets: 3, reps: 10, repRest: 15, actionRest: 60, isAlt: true }
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
