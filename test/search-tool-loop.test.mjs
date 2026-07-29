// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const loopSource = readFileSync(new URL('../search-tool-loop.js', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('../ai-api.js', import.meta.url), 'utf8');

function harness({ providerIds = ['search_one'], adapter } = {}) {
  const providers = [
    { id: 'search_one', enabled: true, archived: false, sortOrder: 0 },
    { id: 'search_two', enabled: true, archived: false, sortOrder: 1 }
  ];
  const root = {
    searchPolicyPure: { safeSearchQuery: value => String(value || '').trim() },
    searchStore: { config: { networkDefaults: { maxToolCalls: 2, maxResultChars: 12000 } } },
    searchRegistry: { select: policy => providers.filter(provider => providerIds.includes(provider.id) && policy.providerIds?.includes(provider.id)), nativeUsable: effective => effective.capabilities?.webSearch === true },
    searchAdapters: { async search(provider) { return adapter ? adapter(provider) : [{ id: 'ev_1', title: 'Official', url: 'https://example.com', domain: 'example.com', snippet: 'facts', sourceType: 'other', official: false }]; } }
  };
  const context = { window: root, console, Error, Object, JSON, String, Number, Math, Array, Set, Map, Date, TypeError, setTimeout, clearTimeout };
  vm.runInNewContext(loopSource, context);
  return { root, loop: root.searchToolLoop, context };
}

test('provider request builders adapt function tools and tool results for each dialect', () => {
  const { loop } = harness();
  const schema = loop.FUNCTION_SCHEMA;
  assert.equal(loop.requestOptions('openai-chat', { externalTools: [schema], toolChoice: 'required' }).tool_choice, 'required');
  assert.equal(loop.requestOptions('openai-responses', { externalTools: [schema] }).tools[0].name, 'search_web');
  assert.equal(loop.requestOptions('claude', { externalTools: [schema] }).tools[0].input_schema.type, 'object');
  assert.equal(loop.requestOptions('gemini', { externalTools: [schema] }).tools[0].functionDeclarations[0].name, 'search_web');
  assert.equal(Object.hasOwn(schema.function.parameters.properties, 'providerId'), false);

  const messages = [
    { role: 'assistant', toolCalls: [{ id: 'call_1', name: 'search_web', arguments: { query: 'nutrition' } }] },
    { role: 'tool', toolCallId: 'call_1', name: 'search_web', content: '[]' }
  ];
  assert.equal(loop.mapMessages('openai-chat', messages)[1].tool_call_id, 'call_1');
  assert.equal(loop.mapMessages('openai-responses', messages)[1].type, 'function_call_output');
  assert.equal(loop.mapMessages('claude', messages)[1].content[0].type, 'tool_result');
  assert.equal(loop.mapMessages('gemini', messages)[1].parts[0].functionResponse.name, 'search_web');
});

test('tool loop performs a real function round trip and returns evidence', async () => {
  const { loop } = harness();
  const calls = [];
  const result = await loop.run({
    policy: { mode: 'required', providerIds: ['search_one'] },
    messages: [{ role: 'user', content: 'check facts' }],
    requestModel: async (messages, options) => {
      calls.push({ messages, options });
      if (calls.length === 1) return { text: '', toolCalls: [{ id: 'call_1', name: 'search_web', arguments: { query: 'nutrition facts' } }] };
      return { text: 'grounded answer', toolCalls: [] };
    }
  });
  assert.equal(result.text, 'grounded answer');
  assert.equal(result.evidence.length, 1);
  assert.equal(calls[0].options.externalTools[0].function.name, 'search_web');
  assert.equal(calls[1].messages.some(message => message.role === 'tool'), true);
});

test('empty providerIds never selects arbitrary external providers', async () => {
  const { loop } = harness({ providerIds: [] });
  await assert.rejects(() => loop.run({
    policy: { mode: 'required', providerIds: [] },
    messages: [{ role: 'user', content: 'check' }],
    requestModel: async messages => messages.some(message => message.role === 'tool')
      ? { text: 'ungrounded', toolCalls: [] }
      : { text: '', toolCalls: [{ id: 'one', name: 'search_web', arguments: { query: 'facts' } }] }
  }), error => error?.code === 'SEARCH_REQUIRED_UNSATISFIED');
});

test('external search ignores model providerId and charges each ordered provider request', async () => {
  const attempted = [];
  const { loop } = harness({
    providerIds: ['search_one', 'search_two'],
    adapter: async provider => {
      attempted.push(provider.id);
      if (provider.id === 'search_one') throw Object.assign(new Error('down'), { code: 'SEARCH_NETWORK_ERROR' });
      return [{ id: 'ev_2', title: 'Fallback', url: 'https://example.com', domain: 'example.com', snippet: 'facts', sourceType: 'other', official: false }];
    }
  });
  const budget = { limit: 2, remaining: 2, attempts: [] };
  const evidence = await loop.search({ query: 'facts', providerId: 'search_two' }, { mode: 'required', providerIds: ['search_one', 'search_two'] }, budget);
  assert.deepEqual(attempted, ['search_one', 'search_two']);
  assert.equal(evidence.length, 1);
  assert.equal(budget.remaining, 0);
  assert.deepEqual(budget.attempts.map(item => [item.providerId, item.status]), [['search_one', 'failed'], ['search_two', 'success']]);
});

test('one remaining search attempt never reaches a second provider', async () => {
  const attempted = [];
  const { loop } = harness({
    providerIds: ['search_one', 'search_two'],
    adapter: async provider => {
      attempted.push(provider.id);
      throw Object.assign(new Error('down'), { code: 'SEARCH_NETWORK_ERROR' });
    }
  });
  const budget = { limit: 2, remaining: 1, attempts: [] };
  await assert.rejects(
    () => loop.search({ query: 'facts' }, { mode: 'required', providerIds: ['search_one', 'search_two'] }, budget),
    error => error?.code === 'SEARCH_TOOL_LIMIT'
  );
  assert.deepEqual(attempted, ['search_one']);
  assert.equal(budget.remaining, 0);
});

test('ai.run routes required external-only tasks through the shared tool loop', async () => {
  const { root, context } = harness();
  const ai = {
    cfg: {},
    getTaskRequestSequence() {
      return [{ enabled: true, provider: 'openai', model: 'model', modelId: 'model', profileId: 'p1', capabilities: {}, network: { mode: 'required', execution: 'external-only', providerIds: ['search_one'], fallback: 'fail' } }];
    }
  };
  context.ai = ai;
  root.ai = ai;
  root.aiRoutingPure = { isRetryableAiError: () => false };
  vm.runInNewContext(apiSource, context);
  let requestCount = 0;
  ai.call = async (messages, maxTokens, options) => {
    requestCount += 1;
    assert.equal(options.disableNativeSearch, true);
    return requestCount === 1
      ? { text: '', toolCalls: [{ id: 'call_1', name: 'search_web', arguments: { query: 'source' } }] }
      : { text: 'verified', toolCalls: [] };
  };
  const result = await ai.run({ taskId: 'plan.week', messages: [{ role: 'user', content: 'latest guidance' }], returnMeta: true });
  assert.equal(result.text, 'verified');
  assert.equal(result.meta.searchEvidence.length, 1);
  assert.equal(requestCount, 2);
});

test('ai.run falls back from unsupported native-first to external search', async () => {
  const { root, context } = harness();
  const ai = {
    cfg: {},
    getTaskRequestSequence() {
      return [{ enabled: true, provider: 'claude', model: 'model', modelId: 'model', profileId: 'p1', capabilities: {}, network: { mode: 'required', execution: 'native-first', providerIds: ['search_one'], fallback: 'fail' } }];
    }
  };
  context.ai = ai; root.ai = ai; root.aiRoutingPure = { isRetryableAiError: () => false };
  vm.runInNewContext(apiSource, context);
  let count = 0;
  ai.call = async () => (++count === 1
    ? { text: '', toolCalls: [{ id: 'call', name: 'search_web', arguments: { query: 'facts' } }] }
    : { text: 'external answer', toolCalls: [] });
  const result = await ai.run({ taskId: 'rehab.weekly', messages: [{ role: 'user', content: 'latest' }], returnMeta: true });
  assert.equal(result.text, 'external answer');
  assert.equal(result.meta.searchEvidence.length, 1);
});

test('required native-only fails before offline generation when capability is unavailable', async () => {
  const { root, context } = harness();
  const ai = {
    cfg: {},
    getTaskRequestSequence() {
      return [{ enabled: true, provider: 'gemini', model: 'model', modelId: 'model', profileId: 'p1', capabilities: {}, network: { mode: 'required', execution: 'native-only', providerIds: [], fallback: 'fail' } }];
    }
  };
  context.ai = ai; root.ai = ai; root.aiRoutingPure = { isRetryableAiError: () => false };
  vm.runInNewContext(apiSource, context);
  let called = false;
  ai.call = async () => { called = true; return 'offline'; };
  await assert.rejects(() => ai.run({ taskId: 'plan.today', messages: [{ role: 'user', content: 'latest' }] }), error => error?.code === 'SEARCH_NATIVE_UNAVAILABLE');
  assert.equal(called, false);
});

test('native attempts reserve the shared user-action budget', async () => {
  const { loop } = harness();
  const requestOpts = { searchBudget: { remaining: 1 } };
  const result = await loop.executeTask({
    effective: { capabilities: { webSearch: true }, network: { mode: 'required', execution: 'native-first', fallback: 'fail' } },
    requestOpts,
    direct: async () => 'grounded',
    getEvidence: () => [{ url: 'https://example.com' }]
  });
  assert.equal(result.text, 'grounded');
  assert.equal(requestOpts.searchBudget.remaining, 0);
  assert.equal(requestOpts.nativeSearchMaxUses, 1);
});
