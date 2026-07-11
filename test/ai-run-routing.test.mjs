// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../ai-api.js', import.meta.url), 'utf8');

function loadAi(sequence) {
  const ai = {
    cfg: {},
    getTaskRequestSequence() { return sequence; },
    async call() {}
  };
  const events = [];
  const window = {
    aiRoutingPure: { isRetryableAiError: error => error?.status === 503 },
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
