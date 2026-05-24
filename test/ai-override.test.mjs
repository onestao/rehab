import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEffectiveAiConfig } from '../ai-store-pure.mjs';

const cfg = {
  activeProfileId: 'p1',
  provider: 'openai',
  model: 'gpt-4o-mini',
  baseUrl: 'https://api.openai.test/v1',
  profiles: [
    { id: 'p1', name: 'Default', provider: 'openai', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.test/v1' },
    { id: 'p2', name: 'Claude', provider: 'claude', model: 'claude-sonnet', baseUrl: 'https://api.anthropic.test/v1' }
  ]
};
const keyMap = { p1: 'k1', p2: 'k2' };

test('effective config uses current profile without override', () => {
  const out = resolveEffectiveAiConfig(cfg, keyMap, null);
  assert.equal(out.profileId, 'p1');
  assert.equal(out.provider, 'openai');
  assert.equal(out.model, 'gpt-4o-mini');
  assert.equal(out.baseUrl, 'https://api.openai.test/v1');
  assert.equal(out.apiKey, 'k1');
});

test('effective config uses override profile and model', () => {
  const out = resolveEffectiveAiConfig(cfg, keyMap, { profileId: 'p2', provider: 'claude', model: 'claude-opus' });
  assert.equal(out.profileId, 'p2');
  assert.equal(out.provider, 'claude');
  assert.equal(out.model, 'claude-opus');
  assert.equal(out.baseUrl, 'https://api.anthropic.test/v1');
  assert.equal(out.apiKey, 'k2');
});

test('effective config supports partial model override', () => {
  const out = resolveEffectiveAiConfig(cfg, keyMap, { model: 'gpt-4o' });
  assert.equal(out.profileId, 'p1');
  assert.equal(out.provider, 'openai');
  assert.equal(out.model, 'gpt-4o');
  assert.equal(out.baseUrl, 'https://api.openai.test/v1');
  assert.equal(out.apiKey, 'k1');
});
