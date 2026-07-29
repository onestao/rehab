// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const pureCode = readFileSync(new URL('../ai-routing-pure.mjs', import.meta.url), 'utf8')
  .replace(/export\s+(const|function)\s+/g, '$1 ');
const runtimeCode = readFileSync(new URL('../ai-routing.js', import.meta.url), 'utf8');

function loadRuntime({ withCapabilityHelper = true } = {}) {
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
  vm.runInNewContext(`${pureCode}\nwindow.aiRoutingPure = { REASONING_DEPTHS, FALLBACK_MODES, normalizeTaskRegistry, registerTaskDefinitions, normalizeTaskRoute, resolveTaskRoute, buildFallbackSequence, buildReasoningOptions, isRetryableAiError, ...(typeof requiredCapabilityState === 'function' ? { requiredCapabilityState } : {}) };`, sandbox);
  if (!withCapabilityHelper) delete sandbox.window.aiRoutingPure.requiredCapabilityState;
  vm.runInNewContext(runtimeCode, sandbox);
  return ai;
}

test('food.verify is independently routable from advanced task settings', async () => {
  const ai = loadRuntime();
  assert.equal(ai.getTaskDefinition('food.verify')?.label, '食物营养核实');
  await ai.setTaskRoute('food.verify', { primary: { profileId: 'p1', modelId: 'shared-model' }, reasoningDepth: 'off' });
  assert.equal(ai.getTaskRoute('food.verify').primary.modelId, 'shared-model');
});

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
  assert.deepEqual(
    Array.from(rows, row => ({ key: row.key, value: row.value, profileId: row.profileId, modelId: row.modelId })),
    [
      { key: 'p1::shared-model', value: 'p1::shared-model', profileId: 'p1', modelId: 'shared-model' },
      { key: 'p2::shared-model', value: 'p2::shared-model', profileId: 'p2', modelId: 'shared-model' }
    ]
  );
});

test('task pickers leave model capability choices to the user', () => {
  const ai = loadRuntime();
  ai.models[0].capabilities.vision = false;
  ai.cfg.profiles.push(
    { id: 'disabled', name: '已禁用接口', provider: 'openai', enabled: false, baseUrl: 'https://disabled.test/v1', model: 'hidden-model' },
    { id: 'archived', name: '已归档接口', provider: 'openai', archived: true, baseUrl: 'https://archived.test/v1', model: 'hidden-model' }
  );
  ai.models.push(
    { profileId: 'disabled', id: 'hidden-model', enabled: true, capabilities: { vision: true } },
    { profileId: 'archived', id: 'hidden-model', enabled: true, capabilities: { vision: true } }
  );
  ai.apiKeyFor = () => 'available-key';
  const rows = ai.listSelectableModels('food.vision');
  assert.deepEqual(Array.from(rows, row => row.profileId), ['p1', 'p2']);
});

test('selectable models expose family and advisory capability state for compatible, unknown, and incompatible rows', () => {
  const ai = loadRuntime();
  ai.models = [
    {
      profileId: 'p1',
      id: 'claude-3-5-haiku',
      displayName: '实验室视觉助手',
      family: 'Claude',
      enabled: true,
      capabilities: { vision: true, json: true }
    },
    {
      profileId: 'p1',
      id: 'manual-unknown',
      displayName: 'Claude branded manual entry',
      enabled: true,
      capabilities: { vision: true }
    },
    {
      profileId: 'p1',
      id: 'text-only',
      family: 'Qwen',
      enabled: true,
      capabilities: { vision: false, json: true }
    }
  ];

  const rows = ai.listSelectableModels('food.vision');
  assert.notEqual(rows[0].capabilityState, rows[1].capabilityState);
  assert.notEqual(rows[0].capabilityState.missing, rows[1].capabilityState.missing);
  assert.deepEqual(
    Array.from(rows, row => row.modelId),
    ['claude-3-5-haiku', 'manual-unknown', 'text-only'],
    'capability metadata is advisory and must not hard-filter user-selectable models'
  );
  assert.deepEqual(
    Array.from(rows, row => ({
      modelId: row.modelId,
      displayName: row.displayName,
      family: row.family,
      capabilityState: {
        status: row.capabilityState?.status,
        missing: Array.from(row.capabilityState?.missing || []),
        incompatible: Array.from(row.capabilityState?.incompatible || [])
      }
    })),
    [
      {
        modelId: 'claude-3-5-haiku',
        displayName: '实验室视觉助手',
        family: 'Claude',
        capabilityState: { status: 'compatible', missing: [], incompatible: [] }
      },
      {
        modelId: 'manual-unknown',
        displayName: 'Claude branded manual entry',
        family: '其他',
        capabilityState: { status: 'unknown', missing: ['json'], incompatible: [] }
      },
      {
        modelId: 'text-only',
        displayName: 'text-only',
        family: 'Qwen',
        capabilityState: { status: 'incompatible', missing: [], incompatible: ['vision'] }
      }
    ]
  );

  const fallbackRows = loadRuntime({ withCapabilityHelper: false }).listSelectableModels('food.vision');
  assert.deepEqual(
    Array.from(fallbackRows, row => ({ value: row.value, capabilityState: {
      status: row.capabilityState?.status,
      missing: Array.from(row.capabilityState?.missing || []),
      incompatible: Array.from(row.capabilityState?.incompatible || [])
    } })),
    [
      { value: 'p1::shared-model', capabilityState: { status: 'unknown', missing: ['vision', 'json'], incompatible: [] } },
      { value: 'p2::shared-model', capabilityState: { status: 'unknown', missing: ['vision', 'json'], incompatible: [] } }
    ],
    'a missing browser helper degrades capability labels without changing selectable model identities'
  );
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
