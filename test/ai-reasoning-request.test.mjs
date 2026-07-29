// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { buildReasoningOptions } from '../ai-routing-pure.mjs';

const source = readFileSync(new URL('../ai-api.js', import.meta.url), 'utf8');

function loadApi() {
  const requests = [];
  const ai = { cfg: {}, apiKeyFor() { return ''; } };
  const sandbox = {
    ai,
    window: { aiRoutingPure: { buildReasoningOptions } },
    fetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      return {
        ok: true,
        status: 200,
        async text() { return JSON.stringify({ choices: [{ message: { content: 'ok' } }], content: [{ type: 'text', text: 'ok' }], candidates: [{ content: { parts: [{ text: 'ok' }] } }] }); },
        async json() { return { output_text: 'ok' }; }
      };
    },
    console,
    TypeError,
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(source, sandbox);
  return { ai, requests };
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
