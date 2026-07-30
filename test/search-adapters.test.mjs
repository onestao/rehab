// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as searchPolicyPure from '../search-policy-pure.mjs';

const source = readFileSync(new URL('../search-adapters.js', import.meta.url), 'utf8');

function load(results, options = {}) {
  const window = {
    searchPolicyPure,
    searchStore: { apiKeyFor: () => options.apiKey === undefined ? 'key' : options.apiKey },
    searchRegistry: { effectiveDomains: () => [], mark() {} }
  };
  const fetch = options.fetch || (async () => ({ ok: true, status: 200, async json() { return { web: { results } }; } }));
  vm.runInNewContext(source, { window, fetch, AbortController, TextDecoder, setTimeout, clearTimeout, JSON, String, Number, Array, Date, encodeURIComponent, Error });
  return window.searchAdapters;
}

const response = (payload, status = 200) => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: name => name.toLowerCase() === 'content-type' ? 'application/json' : '' },
  async text() { return JSON.stringify(payload); }
});

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

test('health official-only accepts public health sources and rejects food brands', async () => {
  const adapters = load([
    { title: 'Brand', url: 'https://mcdonalds.com/health', description: 'a' },
    { title: 'WHO', url: 'https://www.who.int/health-topics', description: 'b' },
    { title: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/123', description: 'c' }
  ]);
  const result = await adapters.search({ id: 'brave', type: 'brave', options: { maxResults: 3 } }, 'rehab guideline', {
    taskId: 'rehab.weekly', domainProfile: 'health', policy: { sourcePolicy: 'official-only' }
  });
  assert.deepEqual(Array.from(result, item => item.title), ['WHO']);
});

const providerCases = [
  {
    type: 'exa', payload: { results: [{ title: 'Exa', url: 'https://example.com/exa', summary: 'exa summary' }] },
    empty: { results: [] }, endpoint: 'https://api.exa.ai/search', requiresKey: true
  },
  {
    type: 'jina', payload: { data: [{ title: 'Jina', url: 'https://example.com/jina', description: 'jina summary' }] },
    empty: { data: [] }, endpoint: 'https://s.jina.ai/?q=', requiresKey: true
  },
  {
    type: 'serper', payload: { organic: [{ title: 'Serper', link: 'https://example.com/serper', snippet: 'serper summary' }] },
    empty: { organic: [] }, endpoint: 'https://google.serper.dev/search', requiresKey: true
  },
  {
    type: 'duckduckgo', payload: { Heading: 'DDG', AbstractURL: 'https://example.com/ddg', AbstractText: 'ddg summary', RelatedTopics: [] },
    empty: { RelatedTopics: [] }, endpoint: 'https://api.duckduckgo.com/', requiresKey: false
  }
];

for (const entry of providerCases) {
  test(`${entry.type} maps successful and empty browser responses`, async () => {
    const requests = [];
    let payload = entry.payload;
    const adapters = load([], { fetch: async (url, init) => { requests.push({ url, init }); return response(payload); } });
    const provider = { id: entry.type, type: entry.type, region: 'US', options: { maxResults: 5, timeoutMs: 8000 } };
    const success = await adapters.search(provider, 'nutrition facts', { policy: { sourcePolicy: 'any' } });
    assert.equal(success.length, 1);
    assert.match(requests[0].url, new RegExp(entry.endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    if (entry.type === 'exa') assert.deepEqual(JSON.parse(requests[0].init.body).contents, { highlights: { maxCharacters: 1200 } });
    payload = entry.empty;
    assert.equal((await adapters.search(provider, 'nutrition facts', { policy: { sourcePolicy: 'any' } })).length, 0);
  });

  test(`${entry.type} maps HTTP errors and missing-key behavior`, async () => {
    const provider = { id: entry.type, type: entry.type, options: { maxResults: 5, timeoutMs: 8000 } };
    const failing = load([], { fetch: async () => response({}, 503) });
    await assert.rejects(() => failing.search(provider, 'facts', { policy: { sourcePolicy: 'any' } }), error => error?.code === 'SEARCH_HTTP_ERROR' && error?.status === 503);
    const noKey = load([], { apiKey: '', fetch: async () => response(entry.payload) });
    if (entry.requiresKey) await assert.rejects(() => noKey.search(provider, 'facts', { policy: { sourcePolicy: 'any' } }), error => error?.code === 'SEARCH_DISABLED');
    else assert.equal((await noKey.search(provider, 'facts', { policy: { sourcePolicy: 'any' } })).length, 1);
  });
}

test('streamed responses abort as soon as the byte limit is exceeded', async () => {
  let cancelled = false;
  let signal;
  const adapters = load([], { fetch: async (_url, init) => {
    signal = init.signal;
    let sent = false;
    return {
      ok: true, status: 200,
      headers: { get: name => name.toLowerCase() === 'content-type' ? 'application/json' : '' },
      body: { getReader: () => ({
        async read() { if (sent) return { done: true }; sent = true; return { done: false, value: new Uint8Array(750001) }; },
        async cancel() { cancelled = true; }
      }) }
    };
  } });
  await assert.rejects(() => adapters.fetchUrl(
    { id: 'jina', type: 'jina', options: { timeoutMs: 8000 } },
    'https://example.com/page', { apiKey: 'key', policy: { sourcePolicy: 'any' } }
  ), error => error?.code === 'SEARCH_RESPONSE_TOO_LARGE');
  assert.equal(cancelled, true);
  assert.equal(signal.aborted, true);
});


test('declared oversized responses cancel the body and abort before reading', async () => {
  let cancelled = false;
  let signal;
  let read = false;
  const adapters = load([], { fetch: async (_url, init) => {
    signal = init.signal;
    return {
      ok: true, status: 200,
      headers: { get: name => name.toLowerCase() === 'content-type' ? 'application/json' : name.toLowerCase() === 'content-length' ? '750001' : '' },
      body: { async cancel() { cancelled = true; }, getReader() { read = true; throw new Error('must not read'); } }
    };
  } });
  await assert.rejects(() => adapters.fetchUrl(
    { id: 'jina', type: 'jina', options: { timeoutMs: 8000 } },
    'https://example.com/page', { apiKey: 'key', policy: { sourcePolicy: 'any' } }
  ), error => error?.code === 'SEARCH_RESPONSE_TOO_LARGE');
  assert.equal(cancelled, true);
  assert.equal(signal.aborted, true);
  assert.equal(read, false);
});
