import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeNetworkPolicy,
  normalizeSearchConfig,
  normalizeSearchEvidence,
  normalizeSearchProvider,
  classifySearchSource,
  domainProfileForTask,
  searchSourcePriority,
  safeFetchUrl,
  summarizeSearchEvidence,
  summarizeFoodEvidence,
  sortSearchEvidence,
  resolveNetworkPolicy,
  safeSearchQuery
} from '../search-policy-pure.mjs';
import { calculateFoodTotal, normalizeFoodEvidence } from '../food-evidence-pure.mjs';
import {
  deriveFoodEvidenceTier,
  foodVerificationSaveDecision,
  invalidateFoodVerification,
  validateFoodEvidenceLinks,
  verificationStateFromEvidence,
  shouldVerifyFoodEvidence
} from '../search-policy-pure.mjs';

test('network policy is offline by default and drops malformed values', () => {
  assert.deepEqual(normalizeNetworkPolicy({}), {
    mode: 'off', execution: 'native-first', providerIds: [], sourcePolicy: 'official-preferred', fallback: 'local-estimate', allowedDomains: []
  });
  const policy = normalizeNetworkPolicy({ mode: 'required', providerIds: ['a', 'a', 'b'], allowedDomains: ['https://Example.com/', 'localhost', 'bad path'], unknown: 'drop' });
  assert.deepEqual(policy.providerIds, ['a', 'b']);
  assert.deepEqual(policy.allowedDomains, ['example.com']);
  assert.equal(Object.hasOwn(policy, 'unknown'), false);
});

test('search configuration removes duplicate providers and credentials', () => {
  const config = normalizeSearchConfig({ searchProviders: [
    { id: 'one', name: 'One', type: 'tavily', apiKey: 'must-not-survive' },
    { id: 'one', name: 'Duplicate', type: 'brave' },
    { id: 'two', type: 'unsupported' }
  ] });
  assert.equal(config.searchProviders.length, 1);
  assert.equal(Object.hasOwn(config.searchProviders[0], 'apiKey'), false);
  const searx = normalizeSearchConfig({ searchProviders: [{ id: 'self', type: 'searxng', options: { baseUrl: 'https://search.example.com/searx/' } }] }).searchProviders[0];
  assert.equal(searx.options.baseUrl, 'https://search.example.com/searx');
});

test('task domains can only narrow a global whitelist', () => {
  const global = { networkDefaults: { allowedDomains: ['example.com', 'brand.test'] } };
  assert.deepEqual(resolveNetworkPolicy({ network: { allowedDomains: ['brand.test', 'other.test'] } }, global).allowedDomains, ['brand.test']);
  assert.deepEqual(resolveNetworkPolicy({ network: { allowedDomains: ['other.test'] } }, global).allowedDomains, ['blocked.invalid']);
  assert.deepEqual(resolveNetworkPolicy({ network: {} }, global).allowedDomains, ['example.com', 'brand.test']);
});

test('evidence requires HTTPS and cannot self-promote official status', () => {
  assert.equal(normalizeSearchEvidence({ url: 'http://example.com' }), null);
  const item = normalizeSearchEvidence({ url: 'https://example.com/a', official: true, sourceType: 'other' });
  assert.equal(item?.official, false);
  assert.equal(normalizeSearchEvidence({ url: 'https://mcdonalds.com/a', matchTrusted: true })?.matchTrusted, false);
  assert.equal(normalizeSearchEvidence({ url: 'https://mcdonalds.com/a' }, { matchTrusted: true })?.matchTrusted, true);
  assert.equal(normalizeSearchEvidence({ url: 'https://other.example.com/a' }, { allowedDomains: ['example.com'] })?.domain, 'other.example.com');
  assert.equal(normalizeSearchEvidence({ url: 'https://example.org/a' }, { allowedDomains: ['example.com'] }), null);
  assert.equal(safeSearchQuery(`a${String.fromCharCode(0)} b`).includes(String.fromCharCode(0)), false);
});

test('official source classification is pure and limited to explicit domains', () => {
  assert.deepEqual(classifySearchSource('https://menu.mcdonalds.com/item', { taskId: 'food.text' }), { sourceType: 'official-nutrition', official: true });
  assert.deepEqual(classifySearchSource('https://menu.mcdonalds.com/item', { taskId: 'rehab.weekly' }), { sourceType: 'official-nutrition', official: false });
  assert.deepEqual(classifySearchSource('https://www.who.int/news-room/fact-sheets', { taskId: 'rehab.weekly' }), { sourceType: 'public-health', official: true });
  assert.deepEqual(classifySearchSource('https://pubmed.ncbi.nlm.nih.gov/123', { taskId: 'rehab.weekly' }), { sourceType: 'academic', official: false });
  assert.deepEqual(classifySearchSource('https://mcdonalds.example/item'), { sourceType: 'other', official: false });
  assert.equal(domainProfileForTask('plan.today'), 'training-health');
  assert.deepEqual(Array.from(sortSearchEvidence([
    { title: 'Hospital', url: 'https://www.mayoclinic.org/example', sourceType: 'other', official: false },
    { title: 'Academic', url: 'https://pubmed.ncbi.nlm.nih.gov/123', sourceType: 'other', official: false },
    { title: 'WHO', url: 'https://www.who.int/example', sourceType: 'other', official: false }
  ], { taskId: 'rehab.weekly' }), item => item.title), ['WHO', 'Academic', 'Hospital']);
});

test('evidence official status is derived from URL and task domain', () => {
  const health = normalizeSearchEvidence({ url: 'https://www.cdc.gov/example', official: false, sourceType: 'other' }, { taskId: 'advice.chat' });
  assert.equal(health?.sourceType, 'public-health');
  assert.equal(health?.official, true);
  const foodInHealth = normalizeSearchEvidence({ url: 'https://mcdonalds.com/menu', official: true, sourceType: 'official-nutrition' }, { taskId: 'rehab.weekly' });
  assert.equal(foodInHealth?.official, false);
});

test('food verification trigger handles brand, required mode, and both confidence scales', () => {
  const auto = { mode: 'auto' };
  assert.equal(shouldVerifyFoodEvidence('麦当劳汉堡不要酱', { confidence: 90 }, auto), true);
  assert.equal(shouldVerifyFoodEvidence('米饭 150g', { confidence: 50 }, auto), true);
  assert.equal(shouldVerifyFoodEvidence('米饭 150g', { confidence: 0.9 }, auto), false);
  assert.equal(shouldVerifyFoodEvidence('米饭 150g', { confidence: 100 }, { mode: 'required' }), true);
  assert.equal(shouldVerifyFoodEvidence('米饭 150g', { confidence: 10 }, { mode: 'off' }), false);
});

test('food evidence calculates DIY removal and does not verify without official evidence', () => {
  const total = calculateFoodTotal({ nutrients: { cal: 500, pro: 20 } }, [{ kind: 'remove', nutrients: { cal: 100, pro: 1 } }, { kind: 'add', nutrients: { cal: 50, pro: 3 } }]);
  assert.equal(total.cal, 450);
  assert.equal(total.pro, 22);
  const evidence = normalizeFoodEvidence({ status: 'verified', confidenceTier: 'official-exact', base: { nutrients: { cal: 100 } }, evidence: [] });
  assert.notEqual(evidence.status, 'verified');
});

test('food evidence calculates replacement and portion changes without inventing a range', () => {
  const total = calculateFoodTotal(
    { nutrients: { cal: 500, pro: 20 } },
    [
      { kind: 'replace', nutrients: { cal: 160, pro: 8 }, replacedNutrients: { cal: 220, pro: 10 } },
      { kind: 'portion', portionFactor: 0.5 }
    ]
  );
  assert.equal(total.cal, 220);
  assert.equal(total.pro, 9);
  const evidence = normalizeFoodEvidence({
    status: 'estimated',
    base: { nutrients: { cal: 500 } },
    modifications: [{ kind: 'portion', portionFactor: 0.5 }],
    total: { nutrients: { cal: 250 } }
  });
  assert.deepEqual(evidence.total.range.cal, []);
  assert.equal(normalizeFoodEvidence({ status: 'estimated', base: {}, requiredUserInput: ['请确认地区'] }).status, 'needs-confirmation');
});


test('food evidence tier is derived from linked trusted evidence instead of model claims', () => {
  const official = {
    id: 'official-base', official: true, sourceType: 'official-nutrition', matchTrusted: true,
    match: { brand: '麦当劳', product: '巨无霸', market: 'CN', serving: '1份' }
  };
  const exact = normalizeFoodEvidence({
    status: 'estimated', confidenceTier: 'vision-estimate',
    base: { name: '麦当劳巨无霸', market: 'CN', servingLabel: '1份', nutrients: { cal: 500 }, evidenceIds: ['official-base'] },
    evidence: [official]
  });
  assert.equal(exact.confidenceTier, 'official-exact');
  assert.equal(exact.status, 'verified');

  const unrelated = normalizeFoodEvidence({
    status: 'verified', confidenceTier: 'official-exact',
    base: { name: '其他汉堡', nutrients: { cal: 400 } },
    evidence: [official]
  });
  assert.equal(unrelated.confidenceTier, 'vision-estimate');
  assert.notEqual(unrelated.status, 'verified');
});

test('official composed requires valid evidence links for every modification', () => {
  const evidence = [
    { id: 'base', official: true, sourceType: 'official-nutrition' },
    { id: 'cheese', official: true, sourceType: 'official-nutrition' }
  ];
  const complete = {
    base: { name: '汉堡', nutrients: { cal: 500 }, evidenceIds: ['base'] },
    modifications: [{ kind: 'add', label: '芝士', nutrients: { cal: 80 }, evidenceIds: ['cheese'] }],
    evidence
  };
  assert.equal(deriveFoodEvidenceTier(complete), 'official-composed');
  const missing = normalizeFoodEvidence({
    status: 'verified', confidenceTier: 'official-composed',
    ...complete,
    modifications: [{ kind: 'add', label: '芝士', nutrients: { cal: 80 }, evidenceIds: ['missing'] }]
  });
  assert.notEqual(missing.confidenceTier, 'official-composed');
  assert.equal(missing.status, 'needs-confirmation');
  assert.deepEqual(validateFoodEvidenceLinks(missing).missingIds, ['missing']);
});

test('trusted brand market and serving conflicts require confirmation', () => {
  const result = normalizeFoodEvidence({
    status: 'verified', confidenceTier: 'official-exact',
    base: { name: '麦当劳巨无霸', market: 'CN', servingLabel: '1份', nutrients: { cal: 500 }, evidenceIds: ['official'] },
    evidence: [{
      id: 'official', official: true, sourceType: 'official-nutrition', matchTrusted: true,
      match: { brand: '麦当劳', product: '巨无霸', market: 'US', serving: '2份' }
    }]
  });
  assert.equal(result.status, 'needs-confirmation');
  assert.match(result.requiredUserInput.join(' '), /品牌、地区或规格/);
});

test('food verification state invalidation cannot be saved until reverified', () => {
  const pending = verificationStateFromEvidence(null, { required: true });
  assert.equal(foodVerificationSaveDecision(pending, { fallback: 'fail' }).allowed, false);
  const verified = verificationStateFromEvidence({ status: 'verified' }, { required: true });
  assert.equal(foodVerificationSaveDecision(verified, { fallback: 'fail' }).allowed, true);
  const invalidated = invalidateFoodVerification(verified);
  assert.deepEqual(invalidated, { required: true, state: 'invalidated', evidence: null });
  assert.equal(foodVerificationSaveDecision(invalidated, { fallback: 'fail' }).allowed, false);
  const reverified = verificationStateFromEvidence({ status: 'verified' }, { required: true });
  assert.equal(foodVerificationSaveDecision(reverified, { fallback: 'fail' }).allowed, true);
});

test('unknown domains cannot self-report academic source type or priority', () => {
  const evidence = normalizeSearchEvidence({
    url: 'https://example.com/untrusted', title: 'Untrusted', sourceType: 'academic', official: true
  }, { taskId: 'rehab.weekly' });
  assert.ok(evidence);
  assert.equal(evidence.sourceType, 'other');
  assert.equal(evidence.official, false);
  assert.equal(searchSourcePriority(evidence, { taskId: 'rehab.weekly' }), 0);
});

test('provider normalization accepts sprint 2 providers and marks duckduckgo experimental', () => {
  for (const type of ['exa', 'jina', 'serper']) {
    assert.equal(normalizeSearchProvider({ id: type, type, options: {} })?.type, type);
  }
  assert.equal(normalizeSearchProvider({ id: 'ddg', type: 'duckduckgo', options: {} })?.options.experimental, true);
});

test('safeFetchUrl accepts public HTTPS and rejects local private or credentialed targets', () => {
  assert.equal(safeFetchUrl('https://example.com/a#part'), 'https://example.com/a');
  for (const value of [
    'http://example.com/a', 'https://localhost/a', 'https://127.0.0.1/a',
    'https://192.168.1.1/a', 'https://service.internal/a',
    'https://user:pass@example.com/a', 'https://example.com:8443/a'
  ]) assert.equal(safeFetchUrl(value), '');
});

test('summarizeSearchEvidence keeps only safe citation metadata', () => {
  const sources = summarizeSearchEvidence([
    { id: 'a', title: 'Guide', url: 'https://example.com/guide', contentExcerpt: 'full body', readStatus: 'deep-read' },
    { id: 'b', title: 'Unsafe', url: 'http://localhost/private', sourceType: 'academic' }
  ]);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].readStatus, 'deep-read');
  assert.equal(Object.hasOwn(sources[0], 'contentExcerpt'), false);
});

test('food evidence normalization and persistence summaries remove deep-read body fields', () => {
  const normalized = normalizeFoodEvidence({
    status: 'estimated', base: { nutrients: { cal: 100 } },
    evidence: [{
      id: 'ev', title: 'Guide', url: 'https://example.com/food', domain: 'example.com',
      contentExcerpt: 'full body must stay transient', contentType: 'text/markdown', readStatus: 'deep-read'
    }]
  });
  assert.equal(Object.hasOwn(normalized.evidence[0], 'contentExcerpt'), false);
  assert.equal(Object.hasOwn(normalized.evidence[0], 'contentType'), false);
  const stored = summarizeFoodEvidence(normalized);
  assert.equal(stored.sources.length, 1);
  assert.equal(Object.hasOwn(stored.sources[0], 'contentExcerpt'), false);
  assert.equal(Object.hasOwn(stored.sources[0], 'contentType'), false);
});
