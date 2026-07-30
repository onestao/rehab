// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as aiJsonPure from '../ai-json-pure.mjs';

const loopSource = readFileSync(new URL('../search-tool-loop.js', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('../ai-api.js', import.meta.url), 'utf8');

function harness({ providerIds = ['search_one'], adapter, reader } = {}) {
  const providers = [
    { id: 'search_one', type: 'jina', enabled: true, archived: false, sortOrder: 0 },
    { id: 'search_two', type: 'tavily', enabled: true, archived: false, sortOrder: 1 }
  ];
  const root = {
    aiJsonPure,
    searchPolicyPure: {
      safeSearchQuery: value => String(value || '').trim(),
      safeFetchUrl: value => /^https:\/\/[a-z0-9.-]+(?:\/[^\s]*)?$/i.test(String(value || '')) ? String(value).replace(/#.*$/, '') : ''
    },
    searchStore: { config: { networkDefaults: { maxToolCalls: 2, maxResultChars: 12000 } } },
    searchRegistry: { select: policy => providers.filter(provider => providerIds.includes(provider.id) && policy.providerIds?.includes(provider.id)), nativeUsable: effective => effective.capabilities?.webSearch === true },
    searchAdapters: {
      async search(provider) { return adapter ? adapter(provider) : [{ id: 'ev_1', title: 'Official', url: 'https://example.com', domain: 'example.com', snippet: 'facts', sourceType: 'other', official: false, readStatus: 'summary' }]; },
      async fetchUrl(provider, url, options) {
        return reader ? reader(provider, url, options) : { ...(options.evidence || {}), id: options.evidence?.id || 'ev_read', title: options.evidence?.title || 'Read', url, domain: 'example.com', snippet: 'facts', sourceType: 'other', official: false, readStatus: 'deep-read', contentExcerpt: 'full page content' };
      }
    }
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
  assert.equal(loop.FETCH_URL_SCHEMA.function.name, 'fetch_url');

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

test('search_web and fetch_url share the same two-call budget and replace summary evidence', async () => {
  const { loop } = harness();
  const budget = { limit: 2, remaining: 2, attempts: [] };
  let modelCalls = 0;
  const result = await loop.run({
    policy: { mode: 'required', providerIds: ['search_one'] }, budget,
    messages: [{ role: 'user', content: '请查找并深读指南' }],
    requestModel: async messages => {
      modelCalls += 1;
      if (modelCalls === 1) return { text: '', toolCalls: [{ id: 's1', name: 'search_web', arguments: { query: 'guideline' } }] };
      if (modelCalls === 2) {
        assert.equal(messages.some(message => message.role === 'tool' && message.name === 'search_web'), true);
        return { text: '', toolCalls: [{ id: 'f1', name: 'fetch_url', arguments: { url: 'https://example.com' } }] };
      }
      return { text: 'grounded from full text', toolCalls: [] };
    }
  });
  assert.equal(result.text, 'grounded from full text');
  assert.equal(result.evidence.length, 1);
  assert.equal(result.evidence[0].readStatus, 'deep-read');
  assert.equal(budget.remaining, 0);
  assert.deepEqual(budget.attempts.map(item => item.kind), ['external', 'fetch']);
});

test('fetch_url rejects URLs that were neither searched nor provided by the user', async () => {
  const { loop } = harness();
  const budget = { limit: 2, remaining: 2, attempts: [] };
  await assert.rejects(() => loop.fetchUrl(
    { url: 'https://attacker.example/private' },
    { providerIds: ['search_one'] }, budget,
    { userProvidedUrls: ['https://example.com/allowed'] }
  ), error => error?.code === 'FETCH_URL_NOT_ALLOWED');
  assert.equal(budget.remaining, 2);
  assert.equal(budget.attempts.length, 0);
});

test('fetch_url reader failover is ordered and each reader request consumes budget', async () => {
  const attempts = [];
  const { loop } = harness({
    providerIds: ['search_one', 'search_two'],
    reader: async provider => {
      attempts.push(provider.id);
      if (provider.id === 'search_one') throw Object.assign(new Error('reader down'), { code: 'SEARCH_NETWORK_ERROR' });
      return { id: 'read', title: 'Read', url: 'https://example.com/page', domain: 'example.com', snippet: '', sourceType: 'other', official: false, readStatus: 'deep-read', contentExcerpt: 'body' };
    }
  });
  const budget = { limit: 2, remaining: 2, attempts: [] };
  const evidence = await loop.fetchUrl({ url: 'https://example.com/page' }, { providerIds: ['search_one', 'search_two'] }, budget, { searchedUrls: ['https://example.com/page'] });
  assert.equal(evidence.readStatus, 'deep-read');
  assert.deepEqual(attempts, ['search_one', 'search_two']);
  assert.equal(budget.remaining, 0);
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

test('ai.run rejects fetch authorization inferred from serialized database context', async () => {
  let readerCalled = false;
  const { root, context } = harness({ reader: async () => { readerCalled = true; return null; } });
  const ai = {
    cfg: {},
    getTaskRequestSequence() {
      return [{ enabled: true, provider: 'openai', model: 'model', modelId: 'model', profileId: 'p1', capabilities: {}, network: { mode: 'required', execution: 'external-only', providerIds: ['search_one'], fallback: 'fail' } }];
    }
  };
  context.ai = ai; root.ai = ai; root.aiRoutingPure = { isRetryableAiError: () => false };
  vm.runInNewContext(apiSource, context);
  let calls = 0;
  ai.call = async () => (++calls === 1
    ? { text: '', toolCalls: [{ id: 'fetch', name: 'fetch_url', arguments: { url: 'https://imported.example/page' } }] }
    : { text: 'unsupported', toolCalls: [] });
  await assert.rejects(() => ai.run({
    taskId: 'plan.week',
    messages: [{ role: 'user', content: 'SERIALIZED_DATABASE_CONTEXT https://imported.example/page' }]
  }), error => error?.code === 'SEARCH_REQUIRED_UNSATISFIED');
  assert.equal(readerCalled, false);
});

test('advice.vision external-only uses hidden vision context before the text search loop', async () => {
  const { root, context } = harness();
  const ai = {
    cfg: {},
    getTaskRequestSequence() {
      return [{ enabled: true, provider: 'openai', model: 'vision-model', modelId: 'vision-model', profileId: 'p1', capabilities: {}, network: { mode: 'required', execution: 'external-only', providerIds: ['search_one'], fallback: 'fail' } }];
    }
  };
  context.ai = ai; root.ai = ai; root.aiRoutingPure = { isRetryableAiError: () => false };
  vm.runInNewContext(apiSource, context);
  let visionCalls = 0;
  ai.callAdviceWithAttachments = async (messages, attachments, _maxTokens, options) => {
    visionCalls += 1;
    assert.equal(options.disableNetworkSearch, true);
    assert.equal(attachments.length, 1);
    assert.equal(messages.some(message => String(message.content || '').includes('old history')), false);
    return JSON.stringify({ query: 'shoulder sprain cold compress guidance', imageContext: 'Visible shoulder support; no open wound', uncertainties: ['pain severity unknown'] });
  };
  let modelCalls = 0;
  ai.call = async (messages, _maxTokens, options) => {
    modelCalls += 1;
    assert.equal(options.disableNativeSearch, true);
    if (modelCalls === 1) {
      const payload = JSON.parse(messages.find(message => message.role === 'user').content);
      assert.equal(payload.query, 'shoulder sprain cold compress guidance');
      assert.match(payload.imageContext, /shoulder support/);
      return { text: '', toolCalls: [{ id: 'vision-search', name: 'search_web', arguments: { query: payload.query } }] };
    }
    assert.equal(messages.some(message => message.role === 'tool'), true);
    return { text: '基于来源的非诊断性建议', toolCalls: [] };
  };
  const result = await ai.run({
    taskId: 'advice.vision',
    messages: [
      { role: 'user', content: 'old history' },
      { role: 'assistant', content: 'old answer' },
      { role: 'user', content: '这张图应该怎么处理？' }
    ],
    attachments: [{ kind: 'image', file: {} }],
    searchBudget: { limit: 2, remaining: 2, attempts: [] },
    returnMeta: true
  });
  assert.equal(visionCalls, 1);
  assert.equal(modelCalls, 2);
  assert.equal(result.text, '基于来源的非诊断性建议');
  assert.equal(result.meta.searchEvidence.length, 1);
});

test('advice.vision required external search does not disguise context extraction failure as offline advice', async () => {
  const { root, context } = harness();
  const ai = {
    cfg: {},
    getTaskRequestSequence() {
      return [{ enabled: true, provider: 'openai', model: 'vision-model', modelId: 'vision-model', profileId: 'p1', capabilities: {}, network: { mode: 'required', execution: 'external-only', providerIds: ['search_one'], fallback: 'fail' } }];
    }
  };
  context.ai = ai; root.ai = ai; root.aiRoutingPure = { isRetryableAiError: () => false };
  vm.runInNewContext(apiSource, context);
  let visionCalls = 0;
  ai.callAdviceWithAttachments = async () => { visionCalls += 1; return 'not json'; };
  ai.call = async () => { throw new Error('text search must not start'); };
  await assert.rejects(() => ai.run({
    taskId: 'advice.vision',
    messages: [{ role: 'user', content: '看图给建议' }],
    attachments: [{ kind: 'image', file: {} }],
    searchBudget: { limit: 2, remaining: 2, attempts: [] }
  }), error => error?.code === 'SEARCH_IMAGE_CONTEXT_FAILED');
  assert.equal(visionCalls, 1);
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

test('URL token boundaries are shared for bare brackets, backticks, and Chinese brackets', () => {
  const { loop } = harness();
  const urls = [
    'https://one.example/guide',
    'https://two.example/code',
    'https://three.example/menu'
  ];
  const text = `裸边界 ${urls[0]}] 代码 \`${urls[1]}\` 中文【${urls[2]}】。`;
  assert.deepEqual(JSON.parse(JSON.stringify(loop.urlsFromText(text))), urls);
  assert.deepEqual(
    JSON.parse(JSON.stringify(loop.urlsFromText(`${urls[0]}]https://four.example/next`))),
    [urls[0], 'https://four.example/next']
  );
  const encoded = 'https://encoded.example/a%5Db%60c%E3%80%91';
  assert.deepEqual(JSON.parse(JSON.stringify(loop.urlsFromText(encoded))), [encoded]);
});

test('imported or application-generated user context never grants fetch authorization', async () => {
  const { loop } = harness();
  assert.equal(JSON.stringify(loop.urlsFromText('read https://current.example/guide')), JSON.stringify(['https://current.example/guide']));

  let readerCalled = false;
  const isolated = harness({ reader: async () => { readerCalled = true; return null; } }).loop;
  let calls = 0;
  await assert.rejects(() => isolated.run({
    policy: { mode: 'required', providerIds: ['search_one'] },
    messages: [{ role: 'user', content: 'DATABASE_CONTEXT https://generated.example/page' }],
    requestModel: async () => (++calls === 1
      ? { text: '', toolCalls: [{ id: 'f', name: 'fetch_url', arguments: { url: 'https://generated.example/page' } }] }
      : { text: 'unsupported', toolCalls: [] })
  }), error => error?.code === 'SEARCH_REQUIRED_UNSATISFIED');
  assert.equal(readerCalled, false);
});

test('nested OpenAI and OpenRouter URL citations are unwrapped', () => {
  const { loop } = harness();
  const citations = loop.nativeCitations({}, [{
    type: 'url_citation',
    url_citation: { title: 'Nested', url: 'https://example.com/nested' }
  }]);
  assert.equal(citations[0].url, 'https://example.com/nested');
  assert.equal(loop.nativeEvidence(citations[0]).title, 'Nested');
});

test('Gemini native budget uses the shared URL token boundaries', () => {
  const { loop } = harness();
  const effective = {
    provider: 'gemini', model: 'gemini-2.5-pro', capabilities: { webSearch: true, urlContext: true },
    network: { mode: 'auto', execution: 'native-first', fallback: 'local-estimate' }
  };
  const authorized = 'https://allowed.example/guide';
  const unauthorized = 'https://unauthorized.example/private';
  for (const boundary of [']', '`', '】']) {
    const requestOpts = {
      allowNativeSearch: true,
      nativeUrlContextUrls: [authorized],
      searchBudget: { limit: 2, remaining: 2, attempts: [] }
    };
    const key = `${authorized}${boundary}${unauthorized}`;
    const prepared = loop.prepareGeminiRequest({
      contents: [{ role: 'model', parts: [{ functionCall: { name: 'inspect_source', args: { [key]: 'value' } } }] }]
    }, { google_search: {} }, effective, requestOpts);
    assert.deepEqual(JSON.parse(JSON.stringify(prepared.body.tools)), [{ google_search: {} }]);
    assert.equal(requestOpts.searchBudget.remaining, 1);
    assert.deepEqual(requestOpts.searchBudget.attempts.map(item => item.kind), ['native-search']);
  }

  const allowedOpts = {
    allowNativeSearch: true,
    nativeUrlContextUrls: [authorized],
    searchBudget: { limit: 2, remaining: 2, attempts: [] }
  };
  const prepared = loop.prepareGeminiRequest({
    contents: [{ role: 'user', parts: [{ text: `裸边界 ${authorized}] 代码 \`${authorized}\` 中文【${authorized}】` }] }]
  }, { google_search: {} }, effective, allowedOpts);
  assert.deepEqual(JSON.parse(JSON.stringify(prepared.body.tools)), [{ google_search: {} }, { url_context: {} }]);
  assert.equal(allowedOpts.searchBudget.remaining, 0);
  assert.deepEqual(allowedOpts.searchBudget.attempts.map(item => item.kind), ['native-search', 'native-fetch']);
});

test('mixed Gemini URL provenance disables native URL Context before budget consumption', async () => {
  const { loop } = harness();
  const effective = {
    provider: 'gemini', model: 'gemini-2.5-pro', capabilities: { webSearch: true, urlContext: true },
    network: { mode: 'auto', execution: 'native-first', fallback: 'local-estimate' }
  };
  const authorized = 'https://allowed.example/guide';
  const requestOpts = {
    allowNativeSearch: true,
    nativeUrlContextUrls: [authorized],
    searchBudget: { limit: 2, remaining: 2, attempts: [] }
  };
  const result = await loop.executeTask({
    effective, requestOpts,
    direct: async () => {
      loop.prepareGeminiRequest({ contents: [{ role: 'user', parts: [{ text: `${authorized} https://imported.example/private` }] }] }, { google_search: {} }, effective, requestOpts);
      return 'grounded';
    },
    getEvidence: () => []
  });
  assert.equal(result.text, 'grounded');
  assert.equal(requestOpts.searchBudget.remaining, 1);
  assert.deepEqual(requestOpts.searchBudget.attempts.map(item => item.kind), ['native-search']);
});

test('unauthorized URL in an object key disables Gemini URL Context budget', async () => {
  const { loop } = harness();
  const effective = {
    provider: 'gemini', model: 'gemini-2.5-pro', capabilities: { webSearch: true, urlContext: true },
    network: { mode: 'auto', execution: 'native-first', fallback: 'local-estimate' }
  };
  const authorized = 'https://allowed.example/guide';
  const unauthorized = 'https://unauthorized.example/private';
  const requestOpts = {
    allowNativeSearch: true,
    nativeUrlContextUrls: [authorized],
    searchBudget: { limit: 2, remaining: 2, attempts: [] }
  };
  const result = await loop.executeTask({
    effective, requestOpts,
    direct: async () => {
      loop.prepareGeminiRequest({ contents: [{ role: 'model', parts: [{ functionCall: { name: 'inspect_source', args: { [unauthorized]: 'value', source: authorized } } }] }] }, { google_search: {} }, effective, requestOpts);
      return 'grounded';
    },
    getEvidence: () => []
  });
  assert.equal(result.text, 'grounded');
  assert.equal(requestOpts.searchBudget.remaining, 1);
  assert.deepEqual(requestOpts.searchBudget.attempts.map(item => item.kind), ['native-search']);
});

test('Gemini budget uses the same snapshot for inherited toJSON output', async () => {
  const { loop } = harness();
  const effective = {
    provider: 'gemini', model: 'gemini-2.5-pro', capabilities: { webSearch: true, urlContext: true },
    network: { mode: 'auto', execution: 'native-first', fallback: 'local-estimate' }
  };
  const authorized = 'https://allowed.example/guide';
  const unauthorized = 'https://unauthorized.example/private';
  let calls = 0;
  const args = Object.create({
    toJSON() {
      calls += 1;
      return { source: authorized, injected: unauthorized };
    }
  });
  args.source = authorized;
  const requestOpts = {
    allowNativeSearch: true,
    nativeUrlContextUrls: [authorized],
    searchBudget: { limit: 2, remaining: 2, attempts: [] }
  };
  let prepared;
  const result = await loop.executeTask({
    effective, requestOpts,
    direct: async () => {
      prepared = loop.prepareGeminiRequest({ contents: [{ role: 'model', parts: [{ functionCall: { name: 'inspect_source', args } }] }] }, { google_search: {} }, effective, requestOpts);
      return 'grounded';
    },
    getEvidence: () => []
  });
  assert.equal(result.text, 'grounded');
  assert.equal(calls, 1);
  assert.match(prepared.json, /unauthorized\.example/);
  assert.equal(requestOpts.searchBudget.remaining, 1);
  assert.deepEqual(requestOpts.searchBudget.attempts.map(item => item.kind), ['native-search']);
});

test('Gemini budget and sent snapshot read a stateful getter once', async () => {
  const { loop } = harness();
  const effective = {
    provider: 'gemini', model: 'gemini-2.5-pro', capabilities: { webSearch: true, urlContext: true },
    network: { mode: 'auto', execution: 'native-first', fallback: 'local-estimate' }
  };
  const authorized = 'https://allowed.example/guide';
  const unauthorized = 'https://unauthorized.example/private';
  let reads = 0;
  const args = {};
  Object.defineProperty(args, 'source', {
    enumerable: true,
    get() {
      reads += 1;
      return reads === 1 ? authorized : unauthorized;
    }
  });
  const requestOpts = {
    allowNativeSearch: true,
    nativeUrlContextUrls: [authorized],
    searchBudget: { limit: 2, remaining: 2, attempts: [] }
  };
  let prepared;
  const result = await loop.executeTask({
    effective, requestOpts,
    direct: async () => {
      prepared = loop.prepareGeminiRequest({ contents: [{ role: 'model', parts: [{ functionCall: { name: 'inspect_source', args } }] }] }, { google_search: {} }, effective, requestOpts);
      return 'grounded';
    },
    getEvidence: () => []
  });
  assert.equal(result.text, 'grounded');
  assert.equal(reads, 1);
  assert.match(prepared.json, /allowed\.example/);
  assert.doesNotMatch(prepared.json, /unauthorized\.example/);
  assert.equal(requestOpts.searchBudget.remaining, 0);
  assert.deepEqual(requestOpts.searchBudget.attempts.map(item => item.kind), ['native-search', 'native-fetch']);
});

test('authorized URL inside a JSON message still reserves Gemini URL Context budget', async () => {
  const { loop } = harness();
  const effective = {
    provider: 'gemini', model: 'gemini-2.5-pro', capabilities: { webSearch: true, urlContext: true },
    network: { mode: 'auto', execution: 'native-first', fallback: 'local-estimate' }
  };
  const authorized = 'https://restaurant.example/official-menu';
  const requestOpts = {
    allowNativeSearch: true,
    nativeUrlContextUrls: [authorized],
    searchBudget: { limit: 2, remaining: 2, attempts: [] }
  };
  const result = await loop.executeTask({
    effective, requestOpts,
    direct: async () => {
      loop.prepareGeminiRequest({ contents: [{ role: 'user', parts: [{ text: JSON.stringify({ item: { name: '套餐' }, input: authorized }) }] }] }, { google_search: {} }, effective, requestOpts);
      return 'grounded';
    },
    getEvidence: () => []
  });
  assert.equal(result.text, 'grounded');
  assert.equal(requestOpts.searchBudget.remaining, 0);
  assert.deepEqual(requestOpts.searchBudget.attempts.map(item => item.kind), ['native-search', 'native-fetch']);
});

test('Gemini search plus URL Context consumes two native budget units atomically', async () => {
  const { loop } = harness();
  const effective = {
    provider: 'gemini', model: 'gemini-2.5-pro', capabilities: { webSearch: true, urlContext: true },
    network: { mode: 'required', execution: 'native-first', fallback: 'fail' }
  };
  const requestOpts = {
    allowNativeSearch: true,
    nativeUrlContextUrls: ['https://example.com/guide'],
    searchBudget: { limit: 2, remaining: 2, attempts: [] }
  };
  const result = await loop.executeTask({
    effective, requestOpts,
    direct: async () => {
      loop.prepareGeminiRequest({ contents: [{ role: 'user', parts: [{ text: 'https://example.com/guide' }] }] }, { google_search: {} }, effective, requestOpts);
      return 'grounded';
    },
    getEvidence: () => [{ url: 'https://example.com/guide' }]
  });
  assert.equal(result.text, 'grounded');
  assert.equal(requestOpts.searchBudget.remaining, 0);
  assert.deepEqual(requestOpts.searchBudget.attempts.map(item => item.kind), ['native-search', 'native-fetch']);

  let sent = false;
  const insufficient = { ...requestOpts, searchBudget: { limit: 2, remaining: 1, attempts: [] } };
  await assert.rejects(() => loop.executeTask({
    effective,
    requestOpts: insufficient,
    direct: async () => {
      loop.prepareGeminiRequest({ contents: [{ role: 'user', parts: [{ text: 'https://example.com/guide' }] }] }, { google_search: {} }, effective, insufficient);
      sent = true;
      return 'no';
    },
    getEvidence: () => []
  }), error => error?.code === 'SEARCH_TOOL_LIMIT');
  assert.equal(sent, false);
  assert.equal(insufficient.searchBudget.remaining, 1);
});
