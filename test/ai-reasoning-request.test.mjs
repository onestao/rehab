// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { buildReasoningOptions } from '../ai-routing-pure.mjs';

const source = readFileSync(new URL('../ai-api.js', import.meta.url), 'utf8');
const searchToolLoopSource = readFileSync(new URL('../search-tool-loop.js', import.meta.url), 'utf8');

function loadApi() {
  const requests = [];
  const ai = { cfg: {}, apiKeyFor() { return ''; } };
  const sandbox = {
    ai,
    window: {
      aiRoutingPure: { buildReasoningOptions },
      searchPolicyPure: { safeFetchUrl: value => /^https:\/\//.test(String(value || '')) ? String(value).replace(/#.*$/, '') : '' }
    },
    fetch: async (url, options) => {
      requests.push({ url, rawBody: options.body, body: JSON.parse(options.body) });
      return {
        ok: true,
        status: 200,
        async text() { return JSON.stringify({ choices: [{ message: { content: 'ok', annotations: [{ url: 'https://example.com/source', title: 'Source' }] } }], content: [{ type: 'text', text: 'ok' }], candidates: [{ content: { parts: [{ text: 'ok' }] } }] }); },
        async json() { return { output_text: 'ok' }; }
      };
    },
    console,
    TypeError,
    setTimeout,
    clearTimeout,
    URL
  };
  vm.runInNewContext(searchToolLoopSource, sandbox);
  vm.runInNewContext(source, sandbox);
  return { ai, requests, loop: sandbox.window.searchToolLoop };
}

test('OpenAI chat sends reasoning effort and omits temperature', async () => {
  const { ai, requests } = loadApi();
  await ai._callOpenAIChat([{ role: 'user', content: 'x' }], 1200, 'key', false, null, {
    provider: 'openai', baseUrl: 'https://example.test/v1', model: 'gpt-5', reasoningDepth: 'high', capabilities: { reasoning: true }
  });
  assert.equal(requests[0].body.reasoning_effort, 'high');
  assert.equal(requests[0].body.temperature, undefined);
  assert.equal(requests[0].body.max_tokens, 1200);
});

test('Claude thinking adds hidden budget to visible output allowance', async () => {
  const { ai, requests } = loadApi();
  await ai._callClaude([{ role: 'user', content: 'x' }], 2000, 'key', false, null, {
    provider: 'claude', baseUrl: 'https://example.test/v1', model: 'claude-4-sonnet', reasoningDepth: 'medium', capabilities: { reasoning: true }
  });
  assert.deepEqual(requests[0].body.thinking, { type: 'enabled', budget_tokens: 4096 });
  assert.equal(requests[0].body.max_tokens, 6096);
  assert.equal(requests[0].body.temperature, undefined);
});

test('Gemini thinking config stays inside generationConfig', async () => {
  const { ai, requests } = loadApi();
  await ai._callGemini([{ role: 'user', content: 'x' }], 1800, 'key', false, null, {
    provider: 'gemini', baseUrl: 'https://example.test/v1beta', model: 'gemini-2.5-pro', reasoningDepth: 'low', capabilities: { reasoning: true }
  });
  assert.deepEqual(requests[0].body.generationConfig.thinkingConfig, { thinkingBudget: 1024 });
  assert.equal(requests[0].body.generationConfig.maxOutputTokens, 1800);
  assert.equal(requests[0].body.generationConfig.temperature, undefined);
});

test('native search is injected only for explicitly supported provider dialects', async () => {
  const base = { network: { mode: 'auto', execution: 'native-first', allowedDomains: ['example.com'] } };
  const chat = loadApi();
  await chat.ai._callOpenAIChat([{ role: 'user', content: 'x' }], 300, 'key', false, null, {
    ...base, provider: 'openai', baseUrl: 'https://example.test/v1', model: 'model', capabilities: { webSearch: true, nativeWebSearchChat: true }
  }, null, { allowNativeSearch: true });
  assert.deepEqual(chat.requests[0].body.tools, [{ type: 'web_search_preview', filters: { allowed_domains: ['example.com'] } }]);

  const claude = loadApi();
  await claude.ai._callClaude([{ role: 'user', content: 'x' }], 300, 'key', false, null, {
    ...base, provider: 'claude', baseUrl: 'https://example.test', model: 'claude', capabilities: { webSearch: true }
  }, null, { allowNativeSearch: true });
  assert.equal(claude.requests[0].body.tools[0].type, 'web_search_20250305');

  const gemini = loadApi();
  await gemini.ai._callGemini([{ role: 'user', content: 'x' }], 300, 'key', false, null, {
    provider: 'gemini', baseUrl: 'https://example.test', model: 'gemini', capabilities: { webSearch: true }, network: { mode: 'auto', execution: 'native-first', allowedDomains: [] }
  }, null, { allowNativeSearch: true });
  assert.deepEqual(gemini.requests[0].body.tools, [{ google_search: {} }]);
});

test('Gemini URL Context is combined with Google Search only when a safe URL is present', async () => {
  const gemini = loadApi();
  await gemini.ai._callGemini([{ role: 'user', content: 'read https://example.com/guide' }], 300, 'key', false, null, {
    provider: 'gemini', baseUrl: 'https://example.test', model: 'gemini-2.5-pro', capabilities: { webSearch: true, urlContext: true },
    network: { mode: 'auto', execution: 'native-first', allowedDomains: [] }
  }, null, { allowNativeSearch: true, nativeUrlContextUrls: ['https://example.com/guide'] });
  assert.deepEqual(gemini.requests[0].body.tools, [{ google_search: {} }, { url_context: {} }]);
});

test('Gemini URL Context uses shared bare bracket, backtick, and Chinese bracket boundaries', async () => {
  const gemini = loadApi();
  const authorized = [
    'https://one.example/guide',
    'https://two.example/code',
    'https://three.example/menu'
  ];
  const content = `裸边界 ${authorized[0]}] 代码 \`${authorized[1]}\` 中文【${authorized[2]}】。`;
  await gemini.ai._callGemini([{ role: 'user', content }], 300, 'key', false, null, {
    provider: 'gemini', baseUrl: 'https://example.test', model: 'gemini-2.5-pro', capabilities: { webSearch: true, urlContext: true },
    network: { mode: 'auto', execution: 'native-first', allowedDomains: [] }
  }, null, { allowNativeSearch: true, nativeUrlContextUrls: authorized });
  assert.deepEqual(gemini.requests[0].body.tools, [{ google_search: {} }, { url_context: {} }]);
  assert.equal(gemini.requests[0].body.contents[0].parts[0].text, content);
});

test('Gemini URL Context detects an unauthorized URL immediately after each shared boundary', async () => {
  const authorized = 'https://allowed.example/guide';
  const unauthorized = 'https://unauthorized.example/private';
  for (const boundary of [']', '`', '】']) {
    const gemini = loadApi();
    const dynamicKey = `${authorized}${boundary}${unauthorized}`;
    await gemini.ai._callGemini([
      { role: 'assistant', toolCalls: [{ id: 'call_1', name: 'inspect_source', arguments: { [dynamicKey]: 'value' } }] }
    ], 300, 'key', false, null, {
      provider: 'gemini', baseUrl: 'https://example.test', model: 'gemini-2.5-pro', capabilities: { webSearch: true, urlContext: true },
      network: { mode: 'auto', execution: 'native-first', allowedDomains: [] }
    }, null, { allowNativeSearch: true, nativeUrlContextUrls: [authorized] });
    assert.deepEqual(gemini.requests[0].body.tools, [{ google_search: {} }]);
    assert.equal(gemini.requests[0].body.contents[0].parts[0].functionCall.args[dynamicKey], 'value');
  }
});

test('Gemini URL Context stays enabled when a JSON message contains only an authorized URL', async () => {
  const gemini = loadApi();
  const authorized = 'https://restaurant.example/official-menu';
  const content = JSON.stringify({
    item: { name: '套餐', grams: 100, ingredients: [] },
    input: `请核实官方菜单 ${authorized}`,
    market: ''
  });
  await gemini.ai._callGemini([{ role: 'user', content }], 300, 'key', false, null, {
    provider: 'gemini', baseUrl: 'https://example.test', model: 'gemini-2.5-pro', capabilities: { webSearch: true, urlContext: true },
    network: { mode: 'auto', execution: 'native-first', allowedDomains: [] }
  }, null, { allowNativeSearch: true, nativeUrlContextUrls: [authorized] });
  assert.deepEqual(gemini.requests[0].body.tools, [{ google_search: {} }, { url_context: {} }]);
  assert.match(gemini.requests[0].body.contents[0].parts[0].text, /restaurant\.example\/official-menu/);
});

test('Gemini URL Context is disabled when the final request also exposes an unauthorized URL', async () => {
  const gemini = loadApi();
  const authorized = 'https://allowed.example/guide';
  const imported = 'https://imported.example/private';
  await gemini.ai._callGemini([{
    role: 'user',
    content: JSON.stringify({ input: authorized, candidate: { source: imported } })
  }], 300, 'key', false, null, {
    provider: 'gemini', baseUrl: 'https://example.test', model: 'gemini-2.5-pro', capabilities: { webSearch: true, urlContext: true },
    network: { mode: 'auto', execution: 'native-first', allowedDomains: [] }
  }, null, { allowNativeSearch: true, nativeUrlContextUrls: [authorized] });
  assert.deepEqual(gemini.requests[0].body.tools, [{ google_search: {} }]);
  assert.match(JSON.stringify(gemini.requests[0].body.contents), /imported\.example/);
  assert.equal(JSON.stringify(gemini.requests[0].body.tools).includes('url_context'), false);
});

test('Gemini URL Context is disabled when functionCall args contain an unauthorized URL key', async () => {
  const gemini = loadApi();
  const authorized = 'https://allowed.example/guide';
  const unauthorized = 'https://unauthorized.example/private';
  await gemini.ai._callGemini([
    { role: 'user', content: authorized },
    { role: 'assistant', toolCalls: [{ id: 'call_1', name: 'inspect_source', arguments: { [unauthorized]: 'value', source: authorized } }] }
  ], 300, 'key', false, null, {
    provider: 'gemini', baseUrl: 'https://example.test', model: 'gemini-2.5-pro', capabilities: { webSearch: true, urlContext: true },
    network: { mode: 'auto', execution: 'native-first', allowedDomains: [] }
  }, null, { allowNativeSearch: true, nativeUrlContextUrls: [authorized] });
  assert.deepEqual(gemini.requests[0].body.tools, [{ google_search: {} }]);
  assert.equal(gemini.requests[0].body.contents[1].parts[0].functionCall.args[unauthorized], 'value');
});

test('Gemini URL Context stays enabled when a functionCall args key is authorized', async () => {
  const gemini = loadApi();
  const authorized = 'https://allowed.example/guide';
  await gemini.ai._callGemini([
    { role: 'assistant', toolCalls: [{ id: 'call_1', name: 'inspect_source', arguments: { [authorized]: 'value' } }] }
  ], 300, 'key', false, null, {
    provider: 'gemini', baseUrl: 'https://example.test', model: 'gemini-2.5-pro', capabilities: { webSearch: true, urlContext: true },
    network: { mode: 'auto', execution: 'native-first', allowedDomains: [] }
  }, null, { allowNativeSearch: true, nativeUrlContextUrls: [authorized] });
  assert.deepEqual(gemini.requests[0].body.tools, [{ google_search: {} }, { url_context: {} }]);
  assert.equal(gemini.requests[0].body.contents[0].parts[0].functionCall.args[authorized], 'value');
});

test('Gemini request snapshot blocks an own toJSON URL injection', async () => {
  const gemini = loadApi();
  const authorized = 'https://allowed.example/guide';
  const unauthorized = 'https://unauthorized.example/private';
  let calls = 0;
  const args = {
    source: authorized,
    toJSON() {
      calls += 1;
      return { source: authorized, injected: unauthorized };
    }
  };
  await gemini.ai._callGemini([
    { role: 'assistant', toolCalls: [{ id: 'call_1', name: 'inspect_source', arguments: args }] }
  ], 300, 'key', false, null, {
    provider: 'gemini', baseUrl: 'https://example.test', model: 'gemini-2.5-pro', capabilities: { webSearch: true, urlContext: true },
    network: { mode: 'auto', execution: 'native-first', allowedDomains: [] }
  }, null, { allowNativeSearch: true, nativeUrlContextUrls: [authorized] });
  assert.equal(calls, 1);
  assert.match(gemini.requests[0].rawBody, /unauthorized\.example/);
  assert.deepEqual(gemini.requests[0].body.tools, [{ google_search: {} }]);
});

test('Gemini request snapshot blocks an inherited toJSON URL injection', async () => {
  const gemini = loadApi();
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
  await gemini.ai._callGemini([
    { role: 'assistant', toolCalls: [{ id: 'call_1', name: 'inspect_source', arguments: args }] }
  ], 300, 'key', false, null, {
    provider: 'gemini', baseUrl: 'https://example.test', model: 'gemini-2.5-pro', capabilities: { webSearch: true, urlContext: true },
    network: { mode: 'auto', execution: 'native-first', allowedDomains: [] }
  }, null, { allowNativeSearch: true, nativeUrlContextUrls: [authorized] });
  assert.equal(calls, 1);
  assert.match(gemini.requests[0].rawBody, /unauthorized\.example/);
  assert.deepEqual(gemini.requests[0].body.tools, [{ google_search: {} }]);
});

test('Gemini request snapshot reads a stateful getter only once', async () => {
  const gemini = loadApi();
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
  await gemini.ai._callGemini([
    { role: 'assistant', toolCalls: [{ id: 'call_1', name: 'inspect_source', arguments: args }] }
  ], 300, 'key', false, null, {
    provider: 'gemini', baseUrl: 'https://example.test', model: 'gemini-2.5-pro', capabilities: { webSearch: true, urlContext: true },
    network: { mode: 'auto', execution: 'native-first', allowedDomains: [] }
  }, null, { allowNativeSearch: true, nativeUrlContextUrls: [authorized] });
  assert.equal(reads, 1);
  assert.match(gemini.requests[0].rawBody, /allowed\.example/);
  assert.doesNotMatch(gemini.requests[0].rawBody, /unauthorized\.example/);
  assert.deepEqual(gemini.requests[0].body.tools, [{ google_search: {} }, { url_context: {} }]);
});

test('Gemini request options are merged before the URL Context snapshot', async () => {
  const gemini = loadApi();
  const authorized = 'https://allowed.example/guide';
  const unauthorized = 'https://unauthorized.example/private';
  const original = gemini.loop.requestOptions;
  gemini.loop.requestOptions = () => ({ postToolOption: { source: unauthorized } });
  try {
    await gemini.ai._callGemini([{ role: 'user', content: authorized }], 300, 'key', false, null, {
      provider: 'gemini', baseUrl: 'https://example.test', model: 'gemini-2.5-pro', capabilities: { webSearch: true, urlContext: true },
      network: { mode: 'auto', execution: 'native-first', allowedDomains: [] }
    }, null, { allowNativeSearch: true, nativeUrlContextUrls: [authorized] });
  } finally {
    gemini.loop.requestOptions = original;
  }
  assert.equal(gemini.requests[0].body.postToolOption.source, unauthorized);
  assert.deepEqual(gemini.requests[0].body.tools, [{ google_search: {} }]);
});

test('Gemini URL Context is disabled by an outbound HTTP URL that cannot be authorized', async () => {
  const gemini = loadApi();
  const authorized = 'https://allowed.example/guide';
  await gemini.ai._callGemini([{ role: 'user', content: `${authorized} http://legacy.example/page` }], 300, 'key', false, null, {
    provider: 'gemini', baseUrl: 'https://example.test', model: 'gemini-2.5-pro', capabilities: { urlContext: true },
    network: { mode: 'auto', execution: 'native-first', allowedDomains: [] }
  }, null, { allowNativeSearch: true, nativeUrlContextUrls: [authorized] });
  assert.equal(gemini.requests[0].body.tools, undefined);
});

test('OpenRouter chat uses the model-agnostic web plugin and preserves domain filters', async () => {
  const openrouter = loadApi();
  await openrouter.ai._callOpenAIChat([{ role: 'user', content: 'latest guidance' }], 300, 'key', false, null, {
    provider: 'openai', profileName: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-5', capabilities: {},
    network: { mode: 'auto', execution: 'native-first', allowedDomains: ['who.int'], maxResults: 3 }
  }, null, { allowNativeSearch: true });
  assert.deepEqual(openrouter.requests[0].body.plugins, [{ id: 'web', max_results: 3, include_domains: ['who.int'] }]);
});

test('streaming Chat and Claude citation events are collected separately from text', async () => {
  const chat = loadApi();
  const chatCitations = [];
  chat.ai._emitNativeSearchEvidence = (_payload, _effective, _opts, cited) => chatCitations.push(...cited);
  chat.ai._readSSE = async (_res, _onChunk, textOf) => textOf({ choices: [{ delta: { content: 'ok', annotations: [{ url: 'https://example.com/chat' }] } }] });
  assert.equal(await chat.ai._callOpenAIChat([], 100, 'key', true, () => {}, { provider: 'openai', baseUrl: 'https://example.test/v1', model: 'm', capabilities: {} }), 'ok');
  assert.equal(chatCitations[0].url, 'https://example.com/chat');

  const claude = loadApi();
  const claudeCitations = [];
  claude.ai._emitNativeSearchEvidence = (_payload, _effective, _opts, cited) => claudeCitations.push(...cited);
  claude.ai._readSSE = async (_res, _onChunk, textOf) => textOf({ type: 'content_block_delta', delta: { type: 'citations_delta', citation: { url: 'https://example.com/claude' } } });
  assert.equal(await claude.ai._callClaude([], 100, 'key', true, () => {}, { provider: 'claude', baseUrl: 'https://example.test', model: 'm', capabilities: {} }), '');
  assert.equal(claudeCitations[0].url, 'https://example.com/claude');
});

test('OpenAI Chat vision forwards response annotations to native evidence collection', async () => {
  const { ai } = loadApi();
  const citations = [];
  ai._emitNativeSearchEvidence = (_payload, _effective, _opts, cited) => citations.push(...cited);
  const text = await ai._callOpenAIChatVision('inspect', { dataUrl: 'data:image/jpeg;base64,AA==' }, 300, 'key', {
    provider: 'openai', baseUrl: 'https://example.test/v1', model: 'vision', capabilities: { webSearch: true, nativeWebSearchChat: true },
    network: { mode: 'auto', sourcePolicy: 'official-preferred', allowedDomains: [] }
  }, '', null, { allowNativeSearch: true });
  assert.equal(text, 'ok');
  assert.equal(citations[0].url, 'https://example.com/source');
});
