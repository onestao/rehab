import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeNetworkPolicy,
  normalizeSearchConfig,
  normalizeSearchEvidence,
  classifySearchSource,
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
  assert.deepEqual(classifySearchSource('https://menu.mcdonalds.com/item'), { sourceType: 'official-nutrition', official: true });
  assert.deepEqual(classifySearchSource('https://mcdonalds.example/item'), { sourceType: 'other', official: false });
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
