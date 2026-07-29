// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { normalizeFoodEvidence, shouldVerifyFoodEvidence } from '../food-evidence-pure.mjs';

const source = readFileSync(new URL('../food-evidence.js', import.meta.url), 'utf8');

function load({ policy, evidence = [] } = {}) {
  const calls = [];
  const ai = {
    cfg: { taskRoutes: {} },
    getTaskNetworkPolicy: taskId => ({ ...(policy || { mode: 'auto', execution: 'native-first', fallback: 'local-estimate' }), taskId }),
    getTaskRoute: () => ({ primary: { profileId: 'p1', modelId: 'm1' } }),
    async run(options) { calls.push(['run', options]); return { text: 'sources', meta: { searchEvidence: evidence } }; },
    async runJson(options) {
      calls.push(['runJson', options]);
      return {
        status: 'verified', confidenceTier: evidence.some(item => item.official) ? 'official-composed' : 'database-estimate',
        base: { name: '汉堡', grams: 200, nutrients: { cal: 500, pro: 20 } },
        modifications: [{ kind: 'remove', label: '酱', nutrients: { cal: 80, pro: 1 } }],
        total: { nutrients: { cal: 420 } }
      };
    }
  };
  const window = {
    ai,
    aiRoutingPure: { manualFallbackTarget: value => value },
    foodEvidencePure: { normalizeFoodEvidence, shouldVerifyFoodEvidence }
  };
  vm.runInNewContext(source, { window, console, JSON, String, Number, Object, Array });
  return { api: window.foodEvidence, ai, calls };
}

test('native-only food verification performs lookup instead of immediate downgrade', async () => {
  const official = { id: 'ev', url: 'https://mcdonalds.com/item', official: true, sourceType: 'official-nutrition' };
  const { api, calls } = load({ policy: { mode: 'required', execution: 'native-only', fallback: 'fail' }, evidence: [official] });
  const result = await api.verify({ name: '汉堡', grams: 200, cal: 500, confidence: 90 }, { input: '麦当劳汉堡不要酱', sourceTask: 'food.text' });
  assert.equal(calls[0][0], 'run');
  assert.equal(calls[0][1].networkPolicy.execution, 'native-only');
  assert.equal(calls[1][0], 'runJson');
  assert.equal(calls[1][1].disableNetworkSearch, true);
  assert.equal(result.total.nutrients.cal, 420);
});

test('required food verification remains unavailable when lookup yields no evidence', async () => {
  const { api, calls } = load({ policy: { mode: 'required', execution: 'external-only', providerIds: [], fallback: 'fail' }, evidence: [] });
  const result = await api.verify({ name: '包装食品', cal: 100 }, { input: '核实包装来源', sourceTask: 'food.vision' });
  assert.equal(result.status, 'unavailable');
  assert.equal(calls[0][1].networkPolicy.taskId, 'food.vision');
  assert.equal(calls.some(([name]) => name === 'runJson'), false);
});
