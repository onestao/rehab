// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const pureCode = readFileSync(new URL('../ai-routing-pure.mjs', import.meta.url), 'utf8')
  .replace(/export\s+(const|function)\s+/g, '$1 ');
const runtimeCode = readFileSync(new URL('../ai-routing.js', import.meta.url), 'utf8');

function loadRuntime() {
  const ai = {
    cfg: {
      activeProfileId: 'p1',
      provider: 'openai',
      model: 'shared-model',
      taskRoutes: {},
      profiles: [
        { id: 'p1', name: '接口 A', provider: 'openai', baseUrl: 'https://a.test/v1', model: 'shared-model' },
        { id: 'p2', name: '接口 B', provider: 'openai', baseUrl: 'https://b.test/v1', model: 'shared-model' }
      ]
    },
    models: [
      { profileId: 'p1', id: 'shared-model', enabled: true, capabilities: { text: true } },
      { profileId: 'p2', id: 'shared-model', enabled: true, capabilities: { text: true, vision: true } }
    ],
    apiKeyFor(id) { return id === 'p1' ? 'key-a' : id === 'p2' ? 'key-b' : ''; },
    normalizeProvider(value) { return String(value || '').trim() || 'openai'; },
    isModelEnabled(model) { return model?.enabled !== false; },
    async persist() { this.persisted = true; },
    persistDataDb() { this.synced = true; }
  };
  const sandbox = {
    ai,
    window: { aiRoutingPure: {} },
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } }
  };
  sandbox.window.window = sandbox.window;
  vm.runInNewContext(`${pureCode}\nwindow.aiRoutingPure = { REASONING_DEPTHS, FALLBACK_MODES, normalizeTaskRegistry, registerTaskDefinitions, normalizeTaskRoute, resolveTaskRoute, buildFallbackSequence, buildReasoningOptions, isRetryableAiError };`, sandbox);
  vm.runInNewContext(runtimeCode, sandbox);
  return ai;
}

test('task routes keep identical model ids isolated by profile', async () => {
  const ai = loadRuntime();
  await ai.setTaskRoute('advice.chat', {
    primary: { profileId: 'p1', modelId: 'shared-model' },
    reasoningDepth: 'low'
  });
  await ai.setTaskRoute('food.vision', {
    primary: { profileId: 'p2', modelId: 'shared-model' },
    reasoningDepth: 'medium'
  });

  const advice = ai.resolveTaskConfig('advice.chat');
  const vision = ai.resolveTaskConfig('food.vision');
  assert.equal(advice.baseUrl, 'https://a.test/v1');
  assert.equal(advice.apiKey, 'key-a');
  assert.equal(advice.reasoningDepth, 'low');
  assert.equal(vision.baseUrl, 'https://b.test/v1');
  assert.equal(vision.apiKey, 'key-b');
  assert.equal(vision.reasoningDepth, 'medium');
});

test('selectable model values include profile identity', () => {
  const ai = loadRuntime();
  const rows = ai.listSelectableModels('advice.chat');
  assert.deepEqual(Array.from(rows, row => row.value), ['p1::shared-model', 'p2::shared-model']);
});

test('vision tasks exclude models explicitly marked without vision', () => {
  const ai = loadRuntime();
  ai.models[0].capabilities.vision = false;
  const rows = ai.listSelectableModels('food.vision');
  assert.deepEqual(Array.from(rows, row => row.profileId), ['p2']);
});

test('task fallback mode is persisted and controls the request sequence', async () => {
  const ai = loadRuntime();
  await ai.setTaskRoute('advice.chat', {
    primary: { profileId: 'p1', modelId: 'shared-model' },
    fallbackMode: 'manual',
    fallbacks: [{ profileId: 'p2', modelId: 'shared-model' }]
  });
  assert.equal(ai.getTaskRequestSequence('advice.chat').length, 1);
  await ai.setTaskRoute('advice.chat', { ...ai.getTaskRoute('advice.chat'), fallbackMode: 'automatic' });
  assert.deepEqual(Array.from(ai.getTaskRequestSequence('advice.chat'), item => item.profileId), ['p1', 'p2']);
});
