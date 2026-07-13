// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { isRetryableAiError, manualFallbackTarget } from '../ai-routing-pure.mjs';

const source = readFileSync(new URL('../ai-api.js', import.meta.url), 'utf8');

function loadAi(sequence, route = {}) {
  const ai = {
    cfg: {},
    getTaskRequestSequence() { return sequence; },
    getTaskRoute() { return route; },
    async call() {}
  };
  const events = [];
  const window = {
    aiRoutingPure: { isRetryableAiError, manualFallbackTarget },
    dispatchEvent(event) { events.push(event); }
  };
  vm.runInNewContext(source, {
    ai,
    window,
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    console,
    localStorage: { getItem() { return null; }, setItem() {} },
    TextDecoder,
    AbortController,
    fetch: async () => { throw new Error('not used'); }
  });
  ai._callOpenAIChat = async (_messages, _maxTokens, _key, _stream, _onChunk, effective) => {
    if (effective.fail) {
      const error = new Error('temporary');
      error.status = 503;
      if (effective.errorFallback) error.aiFallback = effective.errorFallback;
      throw error;
    }
    return `answer:${effective.modelId}`;
  };
  return { ai, events };
}

test('run keeps legacy string result unless metadata is requested', async () => {
  const effective = {
    profileId: 'p1', provider: 'openai', modelId: 'gpt-5', reasoningDepth: 'medium',
    route: { fallbackMode: 'manual' }, enabled: true, apiKey: 'key'
  };
  const { ai } = loadAi([effective]);
  assert.equal(await ai.run({ taskId: 'advice.chat', messages: [] }), 'answer:gpt-5');
  assert.deepEqual(JSON.parse(JSON.stringify(await ai.run({ taskId: 'advice.chat', messages: [], returnMeta: true }))), {
    text: 'answer:gpt-5',
    meta: {
      taskId: 'advice.chat', profileId: 'p1', provider: 'openai', modelId: 'gpt-5', reasoningDepth: 'medium',
      fallback: { used: false, index: 0, mode: 'manual' }
    }
  });
});

test('run metadata reports the actual fallback target', async () => {
  const sequence = [
    { profileId: 'p1', provider: 'openai', modelId: 'primary', reasoningDepth: 'low', fail: true, route: { fallbackMode: 'automatic' }, enabled: true, apiKey: 'key' },
    { profileId: 'p2', provider: 'openai', modelId: 'backup', reasoningDepth: 'high', route: { fallbackMode: 'automatic' }, enabled: true, apiKey: 'key' }
  ];
  const { ai, events } = loadAi(sequence);
  const result = await ai.run({ taskId: 'summary.weekly', messages: [], returnMeta: true });
  assert.equal(result.text, 'answer:backup');
  assert.equal(result.meta.profileId, 'p2');
  assert.deepEqual(JSON.parse(JSON.stringify(result.meta.fallback)), { used: true, index: 1, mode: 'automatic' });
  assert.equal(events[0].type, 'ai:route-fallback');
});

test('manual fallback errors expose only a safe cloned target and preserve the original error', async () => {
  const fallback = { profileId: ' backup-profile ', modelId: ' backup-model ', apiKey: 'secret', headers: { Authorization: 'secret' } };
  const route = { fallbackMode: 'manual', fallbacks: [fallback] };
  const effective = { profileId: 'p1', provider: 'openai', modelId: 'primary', fail: true, route, enabled: true, apiKey: 'key' };
  const { ai } = loadAi([effective], route);
  await assert.rejects(ai.run({ taskId: 'advice.chat', messages: [] }), error => {
    assert.equal(error.message, 'temporary');
    assert.deepEqual(JSON.parse(JSON.stringify(error.aiFallback)), { taskId: 'advice.chat', target: { profileId: 'backup-profile', modelId: 'backup-model' } });
    assert.equal(Object.isFrozen(error.aiFallback.target), true);
    assert.doesNotMatch(JSON.stringify(error.aiFallback), /secret|apiKey|headers/);
    return true;
  });
});

test('manual fallback removes unsafe received targets and exposes no retry for invalid routes', async () => {
  for (const target of [{ profileId: '', modelId: 'backup' }, { profileId: 'profile', modelId: 'm'.repeat(257) }, Object.create({ profileId: 'profile', modelId: 'backup' })]) {
    const route = { fallbackMode: 'manual', fallbacks: [target] };
    const effective = { profileId: 'p1', provider: 'openai', modelId: 'primary', fail: true, errorFallback: { target: { profileId: 'attacker', modelId: 'injected', apiKey: 'secret' } }, route, enabled: true, apiKey: 'key' };
    const { ai } = loadAi([effective], route);
    await assert.rejects(ai.run({ taskId: 'advice.chat', messages: [] }), error => {
      assert.equal(error.aiFallback, undefined);
      return true;
    });
  }
});

test('non-retryable, automatic and emitted failures never expose manual fallback actions', async () => {
  const fallback = { profileId: 'backup-profile', modelId: 'backup-model' };
  const manualRoute = { fallbackMode: 'manual', fallbacks: [fallback] };
  const base = { profileId: 'p1', provider: 'openai', modelId: 'primary', fail: true, route: manualRoute, enabled: true, apiKey: 'key' };
  const { ai: nonRetryableAi } = loadAi([base], manualRoute);
  nonRetryableAi._callOpenAIChat = async () => { throw Object.assign(new Error('bad request'), { status: 400, aiFallback: { target: fallback } }); };
  await assert.rejects(nonRetryableAi.run({ taskId: 'advice.chat', messages: [] }), error => error.aiFallback === undefined);
  const automaticRoute = { fallbackMode: 'automatic', fallbacks: [fallback] };
  const { ai: automaticAi } = loadAi([{ ...base, route: automaticRoute }], automaticRoute);
  await assert.rejects(automaticAi.run({ taskId: 'advice.chat', messages: [] }), error => error.aiFallback === undefined);
  const { ai: streamAi } = loadAi([base], manualRoute);
  streamAi.callStream = async (_messages, _maxTokens, onToken) => { onToken('partial', 'partial'); throw Object.assign(new Error('stream failed'), { status: 503, aiFallback: { target: fallback } }); };
  await assert.rejects(streamAi.run({ taskId: 'advice.chat', messages: [], stream: true }), error => error.aiFallback === undefined);
});
