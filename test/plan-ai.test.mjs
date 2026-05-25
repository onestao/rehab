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
