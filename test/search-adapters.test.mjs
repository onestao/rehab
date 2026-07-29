// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as searchPolicyPure from '../search-policy-pure.mjs';

const source = readFileSync(new URL('../search-adapters.js', import.meta.url), 'utf8');

function load(results) {
  const window = {
    searchPolicyPure,
    searchStore: { apiKeyFor: () => 'key' },
    searchRegistry: { effectiveDomains: () => [], mark() {} }
  };
  const fetch = async () => ({ ok: true, status: 200, async json() { return { web: { results } }; } });
  vm.runInNewContext(source, { window, fetch, AbortController, setTimeout, clearTimeout, JSON, String, Number, Array, Date, encodeURIComponent, Error });
  return window.searchAdapters;
}

test('official-preferred groups official results first while preserving group order', async () => {
  const adapters = load([
    { title: 'Other 1', url: 'https://example.com/1', description: 'a' },
    { title: 'Official 1', url: 'https://mcdonalds.com/1', description: 'b' },
    { title: 'Official 2', url: 'https://starbucks.com/2', description: 'c' },
    { title: 'Other 2', url: 'https://example.org/2', description: 'd' }
  ]);
  const result = await adapters.search({ id: 'brave', type: 'brave', options: { maxResults: 4 } }, 'nutrition', { policy: { sourcePolicy: 'official-preferred' } });
  assert.deepEqual(Array.from(result, item => item.title), ['Official 1', 'Official 2', 'Other 1', 'Other 2']);
});

test('official-only removes nonofficial results without reordering official results', async () => {
  const adapters = load([
    { title: 'Official 2', url: 'https://starbucks.com/2', description: 'c' },
    { title: 'Other', url: 'https://example.com/1', description: 'a' },
    { title: 'Official 1', url: 'https://mcdonalds.com/1', description: 'b' }
  ]);
  const result = await adapters.search({ id: 'brave', type: 'brave', options: { maxResults: 3 } }, 'nutrition', { policy: { sourcePolicy: 'official-only' } });
  assert.deepEqual(Array.from(result, item => item.title), ['Official 2', 'Official 1']);
});
