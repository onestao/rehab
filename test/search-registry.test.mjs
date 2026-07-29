// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../search-registry.js', import.meta.url), 'utf8');

function load(providers = []) {
  const window = {
    searchStore: { getProviders: () => providers, config: { networkDefaults: { allowedDomains: [] } } },
    searchPolicyPure: {}
  };
  vm.runInNewContext(source, { window, Map, Set, String, Array, Date });
  return window.searchRegistry;
}

test('task providerIds are the sole stable failover order', () => {
  const registry = load([
    { id: 'b', enabled: true, archived: false, sortOrder: 0 },
    { id: 'a', enabled: true, archived: false, sortOrder: 99 },
    { id: 'c', enabled: false, archived: false },
    { id: 'd', enabled: true, archived: true }
  ]);
  assert.deepEqual(registry.select({ providerIds: ['a', 'b', 'a', 'c', 'missing', 'd'] }).map(item => item.id), ['a', 'b']);
  assert.deepEqual(registry.references({ providerIds: ['a', 'c', 'missing', 'd'] }).map(item => [item.id, item.reason]), [
    ['a', ''], ['c', 'disabled'], ['missing', 'missing'], ['d', 'archived']
  ]);
});

test('native capability state reports concrete recovery reasons', () => {
  const registry = load();
  assert.equal(registry.nativeCapabilityState({ provider: 'claude', capabilities: { webSearch: true } }).code, 'available');
  assert.equal(registry.nativeCapabilityState({ provider: 'openai', capabilities: { webSearch: true } }).code, 'chat-dialect-unconfirmed');
  assert.equal(registry.nativeCapabilityState({ provider: 'gemini', capabilities: { webSearch: true }, network: { allowedDomains: ['example.com'] } }).code, 'gemini-domain-filter-incompatible');
  assert.equal(registry.nativeCapabilityState({ provider: 'claude', capabilities: {} }).code, 'capability-unknown');
  assert.equal(registry.nativeUsable({ provider: 'claude', capabilities: { webSearch: true } }), true);
});
