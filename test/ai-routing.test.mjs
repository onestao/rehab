// @ts-nocheck
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import * as routingPure from '../ai-routing-pure.mjs';

import {
  REASONING_DEPTHS,
  buildFallbackSequence,
  buildReasoningOptions,
  isRetryableAiError,
  normalizeTaskRegistry,
  normalizeTaskRoute,
  registerTaskDefinitions,
  resolveTaskRoute
} from '../ai-routing-pure.mjs';

const primary = { profileId: 'openai-main', modelId: 'gpt-5-mini' };

test('task registry normalizes defaults and rejects duplicate task ids', () => {
  assert.deepEqual(REASONING_DEPTHS, ['auto', 'off', 'low', 'medium', 'high']);
  const registry = normalizeTaskRegistry([
    { id: 'food.text', defaultReasoningDepth: 'off' },
    { id: 'plan.week', defaultReasoningDepth: 'high', requiredCapabilities: ['json'] }
  ]);
  assert.deepEqual(registry['food.text'], {
    id: 'food.text',
    defaultReasoningDepth: 'off',
    requiredCapabilities: []
  });
  assert.deepEqual(registry['plan.week'].requiredCapabilities, ['json']);
  assert.equal(normalizeTaskRegistry({
    'advice.chat': { defaultReasoningDepth: 'medium' }
  })['advice.chat'].id, 'advice.chat');
  assert.throws(
    () => registerTaskDefinitions(registry, [{ id: 'food.text' }]),
    error => error.code === 'AI_TASK_DUPLICATE'
  );
});

test('required capabilities report compatible, incompatible, and unknown states without filtering a model', () => {
  const requiredCapabilityState = routingPure.requiredCapabilityState;
  assert.equal(typeof requiredCapabilityState, 'function');

  assert.deepEqual(
    requiredCapabilityState(['vision', 'json'], { vision: true, json: true }),
    { status: 'compatible', missing: [], incompatible: [] }
  );
  assert.deepEqual(
    requiredCapabilityState(['vision', 'json'], { vision: false, json: true }),
    { status: 'incompatible', missing: [], incompatible: ['vision'] }
  );
  assert.deepEqual(
    requiredCapabilityState(['vision', 'json'], { vision: true }),
    { status: 'unknown', missing: ['json'], incompatible: [] }
  );
  assert.deepEqual(
    requiredCapabilityState(['vision'], null),
    { status: 'unknown', missing: ['vision'], incompatible: [] }
  );
});

test('required capability state normalizes malformed inputs without mutating or treating unknown as false', () => {
  const requiredCapabilityState = routingPure.requiredCapabilityState;
  const required = [' vision ', null, 'json', 'vision', 42];
  const capabilities = Object.create(null);
  capabilities.vision = false;
  capabilities.json = undefined;

  const state = requiredCapabilityState(required, capabilities);
  assert.deepEqual(state, {
    status: 'incompatible',
    missing: ['json'],
    incompatible: ['vision']
  });
  assert.deepEqual(required, [' vision ', null, 'json', 'vision', 42]);
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.missing), true);
  assert.equal(Object.isFrozen(state.incompatible), true);
  assert.deepEqual(
    requiredCapabilityState(' vision ', ['vision']),
    { status: 'compatible', missing: [], incompatible: [] }
  );
  assert.deepEqual(
    requiredCapabilityState(['vision', 'json'], 'vision'),
    { status: 'unknown', missing: ['json'], incompatible: [] }
  );
});

test('model reference normalization returns only canonical own string identifiers', () => {
  const source = Object.create({ profileId: 'inherited-profile', modelId: 'inherited-model' });
  source.profileId = ' lab-profile ';
  source.modelId = ' vision-model ';
  source.apiKey = 'must-not-propagate';
  Object.defineProperty(source, '__proto__', { value: 'ignored', enumerable: true });

  const reference = routingPure.normalizeModelRef(source);
  assert.deepEqual(reference, { profileId: 'lab-profile', modelId: 'vision-model' });
  assert.notEqual(reference, source);
  assert.equal(Object.isFrozen(reference), true);
  assert.equal(Object.hasOwn(reference, 'apiKey'), false);
  assert.equal(Object.hasOwn(reference, '__proto__'), false);
  assert.equal(routingPure.normalizeModelRef({ profileId: 42, modelId: 'model' }), null);
  assert.equal(routingPure.normalizeModelRef({ profileId: 'profile', modelId: '   ' }), null);
  assert.equal(routingPure.normalizeModelRef(Object.create({ profileId: 'profile', modelId: 'model' })), null);
});

test('manual fallback target is a frozen credential-free plain reference', () => {
  const source = {
    profileId: ' backup-profile ',
    modelId: ' backup/model ',
    apiKey: 'secret',
    key: 'secret',
    token: 'secret',
    baseUrl: 'https://secret.invalid',
    headers: { Authorization: 'secret' },
    provider: 'openai'
  };

  const target = routingPure.manualFallbackTarget(source);
  assert.deepEqual(target, { profileId: 'backup-profile', modelId: 'backup/model' });
  assert.notEqual(target, source);
  assert.equal(Object.getPrototypeOf(target), Object.prototype);
  assert.equal(Object.isFrozen(target), true);
  assert.equal(JSON.stringify(target), '{"profileId":"backup-profile","modelId":"backup/model"}');
  assert.deepEqual(source, {
    profileId: ' backup-profile ', modelId: ' backup/model ', apiKey: 'secret', key: 'secret',
    token: 'secret', baseUrl: 'https://secret.invalid', headers: { Authorization: 'secret' }, provider: 'openai'
  });
});

test('manual fallback target rejects accessors, inherited ids, pollution keys and malformed values', () => {
  let getterCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, 'profileId', { get() { getterCalls += 1; return 'profile'; } });
  Object.defineProperty(accessor, 'modelId', { value: 'model' });
  assert.equal(routingPure.manualFallbackTarget(accessor), null);
  assert.equal(getterCalls, 0);

  const inherited = Object.create({ profileId: 'profile', modelId: 'model' });
  assert.equal(routingPure.manualFallbackTarget(inherited), null);
  assert.equal(routingPure.manualFallbackTarget([]), null);
  assert.equal(routingPure.manualFallbackTarget(null), null);
  assert.equal(routingPure.manualFallbackTarget({ profileId: 'profile', modelId: 'model\u0000bad' }), null);
  assert.equal(routingPure.manualFallbackTarget({ profileId: 'p'.repeat(257), modelId: 'model' }), null);
  assert.equal(routingPure.manualFallbackTarget({ profileId: 'profile', modelId: 'm'.repeat(257) }), null);
  assert.equal(routingPure.manualFallbackTarget({ profileId: 'profile', modelId: '' }), null);

  const protoKey = { profileId: 'profile', modelId: 'model' };
  Object.defineProperty(protoKey, '__proto__', { value: { polluted: true }, enumerable: true });
  assert.equal(routingPure.manualFallbackTarget(protoKey), null);
  const constructorKey = { profileId: 'profile', modelId: 'model', constructor: 'blocked' };
  assert.equal(routingPure.manualFallbackTarget(constructorKey), null);
  assert.equal({}.polluted, undefined);
});

test('manual fallback target is available to the browser adapter', () => {
  assert.equal(typeof routingPure.manualFallbackTarget, 'function');
  assert.match(readFileSync(new URL('../ai-routing-pure.mjs', import.meta.url), 'utf8'), /manualFallbackTarget,/);
});

test('task route normalization removes invalid and duplicate fallbacks', () => {
  assert.deepEqual(normalizeTaskRoute({
    primary,
    reasoningDepth: 'HIGH',
    fallbacks: [
      primary,
      { profileId: 'claude', modelId: 'claude-sonnet', reasoningDepth: 'medium' },
      { profileId: 'claude', modelId: 'claude-sonnet', reasoningDepth: 'medium' },
      { profileId: '', modelId: 'broken' }
    ]
  }), {
    primary,
    reasoningDepth: 'high',
    fallbackMode: 'manual',
    fallbacks: [{ profileId: 'claude', modelId: 'claude-sonnet', reasoningDepth: 'medium' }]
  });
});

test('resolveTaskRoute applies task, registry default, global default, then request override', () => {
  const cfg = {
    taskRegistry: {
      'plan.week': { id: 'plan.week', defaultReasoningDepth: 'high', requiredCapabilities: [] }
    },
    defaultRoute: {
      primary: { profileId: 'default', modelId: 'default-model' },
      reasoningDepth: 'auto'
    },
    taskRoutes: {
      'plan.week': {
        primary: { profileId: 'claude', modelId: 'claude-sonnet' },
        fallbacks: [{ profileId: 'gemini', modelId: 'gemini-pro' }]
      }
    }
  };
  assert.deepEqual(resolveTaskRoute(cfg, 'plan.week', null), {
    taskId: 'plan.week',
    primary: { profileId: 'claude', modelId: 'claude-sonnet' },
    reasoningDepth: 'high',
    fallbackMode: 'manual',
    fallbacks: [{ profileId: 'gemini', modelId: 'gemini-pro', reasoningDepth: 'high' }]
  });
  assert.deepEqual(resolveTaskRoute(cfg, 'plan.week', {
    profileId: 'openai-main',
    modelId: 'o3',
    reasoningDepth: 'low'
  }).primary, { profileId: 'openai-main', modelId: 'o3' });
  assert.equal(resolveTaskRoute(cfg, 'plan.week', { reasoningDepth: 'low' }).reasoningDepth, 'low');
  assert.equal(resolveTaskRoute(cfg, 'unknown', null).primary.profileId, 'default');
});

test('fallback sequence is ordered, immutable and inherits route reasoning depth', () => {
  const route = normalizeTaskRoute({
    primary,
    reasoningDepth: 'high',
    fallbackMode: 'automatic',
    fallbacks: [
      { profileId: 'claude', modelId: 'sonnet' },
      { profileId: 'gemini', modelId: 'pro', reasoningDepth: 'low' }
    ]
  });
  const sequence = buildFallbackSequence(route);
  assert.deepEqual(sequence, [
    { profileId: 'openai-main', modelId: 'gpt-5-mini', reasoningDepth: 'high' },
    { profileId: 'claude', modelId: 'sonnet', reasoningDepth: 'high' },
    { profileId: 'gemini', modelId: 'pro', reasoningDepth: 'low' }
  ]);
  sequence[0].modelId = 'mutated';
  assert.equal(route.primary.modelId, 'gpt-5-mini');
});

test('fallback routes default to manual and require explicit automatic authorization', () => {
  const manual = normalizeTaskRoute({ primary, fallbacks: [{ profileId: 'backup', modelId: 'backup-model' }] });
  assert.equal(manual.fallbackMode, 'manual');
  assert.deepEqual(buildFallbackSequence(manual), [
    { ...primary, reasoningDepth: 'auto' }
  ]);
  assert.equal(normalizeTaskRoute({ ...manual, fallbackMode: 'invalid' }).fallbackMode, 'manual');
  assert.equal(normalizeTaskRoute({ ...manual, fallbackMode: 'AUTOMATIC' }).fallbackMode, 'automatic');
});

test('off reasoning sends no provider options and keeps temperature', () => {
  assert.deepEqual(buildReasoningOptions({
    protocol: 'openai-responses',
    modelId: 'o3',
    reasoningDepth: 'off',
    maxOutputTokens: 3000
  }), {
    requestedDepth: 'off',
    effectiveDepth: 'off',
    supported: true,
    params: {},
    omitTemperature: false,
    maxOutputTokens: 3000,
    visibleOutputTokens: 3000,
    thinkingBudget: 0
  });
});

test('OpenAI Responses and Chat use their distinct reasoning contracts', () => {
  const responses = buildReasoningOptions({
    protocol: 'openai-responses', modelId: 'o3', reasoningDepth: 'high', maxOutputTokens: 2500
  });
  assert.deepEqual(responses.params, { reasoning: { effort: 'high' } });
  assert.equal(responses.omitTemperature, true);
  const chat = buildReasoningOptions({
    protocol: 'openai-chat', modelId: 'deepseek-r1', reasoningDepth: 'low',
    capabilities: { reasoning: true }
  });
  assert.deepEqual(chat.params, { reasoning_effort: 'low' });
  assert.equal(chat.omitTemperature, true);
});

test('Claude thinking budget is added to visible output budget', () => {
  const result = buildReasoningOptions({
    protocol: 'claude', modelId: 'claude-sonnet', reasoningDepth: 'medium', maxOutputTokens: 3000,
    capabilities: { reasoning: true }
  });
  assert.deepEqual(result.params, { thinking: { type: 'enabled', budget_tokens: 4096 } });
  assert.equal(result.thinkingBudget, 4096);
  assert.equal(result.visibleOutputTokens, 3000);
  assert.equal(result.maxOutputTokens, 7096);
  assert.equal(result.omitTemperature, true);
});

test('Gemini thinking budget does not consume visible output token setting', () => {
  const result = buildReasoningOptions({
    protocol: 'gemini', modelId: 'gemini-pro', reasoningDepth: 'high', maxOutputTokens: 3000,
    capabilities: { reasoning: true }
  });
  assert.deepEqual(result.params, { thinkingConfig: { thinkingBudget: 8192 } });
  assert.equal(result.maxOutputTokens, 3000);
  assert.equal(result.visibleOutputTokens, 3000);
  assert.equal(result.omitTemperature, true);
});

test('explicit reasoning remains user-controlled while auto may safely degrade to off', () => {
  const explicit = buildReasoningOptions({
    protocol: 'openai-chat', modelId: 'plain-model', reasoningDepth: 'high',
    capabilities: { reasoning: false }
  });
  assert.equal(explicit.effectiveDepth, 'high');
  assert.deepEqual(explicit.params, { reasoning_effort: 'high' });
  const auto = buildReasoningOptions({
    protocol: 'openai-chat', modelId: 'plain-model', reasoningDepth: 'auto',
    capabilities: { reasoning: false }, maxOutputTokens: 1000
  });
  assert.equal(auto.effectiveDepth, 'off');
  assert.deepEqual(auto.params, {});
  assert.equal(auto.omitTemperature, false);
  assert.throws(
    () => buildReasoningOptions({ protocol: 'unknown', reasoningDepth: 'medium' }),
    error => error.code === 'AI_REASONING_UNSUPPORTED'
  );
});

test('auto uses model capability default while explicit depth remains user-controlled', () => {
  const auto = buildReasoningOptions({
    protocol: 'openai-chat', modelId: 'custom-reasoner', reasoningDepth: 'auto',
    capabilities: { reasoning: true, reasoningModes: ['low', 'high'], defaultReasoningDepth: 'high' }
  });
  assert.equal(auto.effectiveDepth, 'high');
  assert.deepEqual(auto.params, { reasoning_effort: 'high' });
  const explicit = buildReasoningOptions({
    protocol: 'openai-chat', modelId: 'custom-reasoner', reasoningDepth: 'medium',
    capabilities: { reasoning: true, reasoningModes: ['low', 'high'] }
  });
  assert.equal(explicit.effectiveDepth, 'medium');
});

test('only transient transport and service errors are retryable', () => {
  assert.equal(isRetryableAiError({ code: 'AI_TIMEOUT' }), true);
  assert.equal(isRetryableAiError({ code: 'NETWORK_ERROR' }), true);
  assert.equal(isRetryableAiError({ status: 429 }), true);
  assert.equal(isRetryableAiError({ status: 503 }), true);
  assert.equal(isRetryableAiError(new TypeError('Failed to fetch')), true);
  assert.equal(isRetryableAiError({ name: 'AbortError' }), false);
  assert.equal(isRetryableAiError({ status: 401 }), false);
  assert.equal(isRetryableAiError({ status: 400 }), false);
  assert.equal(isRetryableAiError({ code: 'AI_JSON_PARSE_FAILED' }), false);
});
