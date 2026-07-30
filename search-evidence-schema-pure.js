// @ts-nocheck
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.searchEvidenceSchemaPure = api;
})(typeof globalThis !== 'undefined' ? globalThis : null, function () {
  const freeze = Object.freeze;
  const SEARCH_LIMITS = freeze({ maxProviders: 12, maxProviderIds: 12, maxDomains: 20, maxDomainLength: 253, maxToolCalls: 2, maxResultChars: 12000, maxResults: 10, timeoutMs: 8000, queryChars: 240, snippetChars: 2000, fetchChars: 24000, fetchExcerptChars: 6000 });
  const SEARCH_DOMAIN_PROFILES = freeze(['food', 'health', 'training-health', 'any']);
  const SEARCH_SOURCE_TYPES = freeze(['official-nutrition', 'official-menu', 'medical-guideline', 'public-health', 'academic', 'hospital-or-society', 'database', 'other']);
  const SOURCE_DOMAIN_RULES = freeze({
    food: freeze({
      'mcdonalds.com': 'official-nutrition', 'kfc.com': 'official-nutrition',
      'starbucks.com': 'official-nutrition', 'subway.com': 'official-nutrition',
      'burgerking.com': 'official-nutrition', 'coca-cola.com': 'official-nutrition'
    }),
    health: freeze({
      'who.int': 'public-health', 'cdc.gov': 'public-health', 'nih.gov': 'public-health',
      'nhs.uk': 'public-health', 'nhc.gov.cn': 'public-health', 'nice.org.uk': 'medical-guideline',
      'pubmed.ncbi.nlm.nih.gov': 'academic', 'ncbi.nlm.nih.gov': 'academic', 'cochranelibrary.com': 'academic',
      'apta.org': 'hospital-or-society', 'acsm.org': 'hospital-or-society',
      'mayoclinic.org': 'hospital-or-society', 'clevelandclinic.org': 'hospital-or-society'
    })
  });
  const OFFICIAL_TYPES_BY_PROFILE = freeze({
    food: freeze(['official-nutrition', 'official-menu']),
    health: freeze(['medical-guideline', 'public-health']),
    'training-health': freeze(['medical-guideline', 'public-health']),
    any: freeze(['official-nutrition', 'official-menu', 'medical-guideline', 'public-health'])
  });
  const SOURCE_WEIGHTS_BY_PROFILE = freeze({
    food: freeze({ 'official-nutrition': 100, 'official-menu': 95, database: 70, other: 0 }),
    health: freeze({ 'medical-guideline': 100, 'public-health': 95, academic: 80, 'hospital-or-society': 65, database: 35, other: 0 }),
    'training-health': freeze({ 'medical-guideline': 100, 'public-health': 95, academic: 85, 'hospital-or-society': 70, database: 40, other: 0 }),
    any: freeze({ 'official-nutrition': 100, 'official-menu': 95, 'medical-guideline': 100, 'public-health': 95, academic: 80, 'hospital-or-society': 65, database: 40, other: 0 })
  });
  const own = (value, key) => {
    try { return value && typeof value === 'object' && !Array.isArray(value) && Object.getOwnPropertyDescriptor(value, key)?.value; } catch { return undefined; }
  };
  const text = (value, limit = 0) => typeof value === 'string' ? value.trim().slice(0, limit || undefined) : '';
  const oneOf = (value, values, fallback) => values.includes(String(value || '').trim()) ? String(value).trim() : fallback;
  function normalizeDomain(value) {
    let domain = text(value, SEARCH_LIMITS.maxDomainLength).toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!domain || /[\s/@?#\\]/.test(domain) || domain === 'localhost' || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(domain)) return '';
    return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain) ? domain : '';
  }
  function uniqueStrings(value, limit, mapper = value => text(value)) {
    const result = [], seen = new Set();
    for (const entry of Array.isArray(value) ? value : []) {
      const normalized = mapper(entry);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized); result.push(normalized);
      if (result.length >= limit) break;
    }
    return result;
  }
  function safeFetchUrl(value) {
    let parsed;
    try { parsed = new URL(text(value, 2048)); } catch { return ''; }
    const domain = normalizeDomain(parsed.hostname);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !domain) return '';
    if (parsed.port && parsed.port !== '443') return '';
    if (/(?:^|\.)(?:localhost|local|internal|home|lan|arpa|onion)$/i.test(domain)) return '';
    parsed.hash = '';
    return parsed.href;
  }
  function domainProfileForTask(taskId = '') {
    const id = text(taskId, 128).toLowerCase();
    if (id.startsWith('food.')) return 'food';
    if (id.startsWith('rehab.') || id.startsWith('advice.')) return 'health';
    if (['plan.', 'goal.', 'summary.', 'report.', 'insight.'].some(prefix => id.startsWith(prefix))) return 'training-health';
    return 'any';
  }
  function domainProfile(options = {}) {
    return oneOf(own(options, 'domainProfile'), SEARCH_DOMAIN_PROFILES, domainProfileForTask(own(options, 'taskId')));
  }
  function sourceRuleForDomain(domain) {
    return Object.values(SOURCE_DOMAIN_RULES).flatMap(rules => Object.entries(rules))
      .sort((left, right) => right[0].length - left[0].length)
      .find(([allowed]) => domain === allowed || domain.endsWith(`.${allowed}`));
  }
  function classifySearchSource(value, options = {}) {
    let domain = '';
    try { domain = normalizeDomain(new URL(String(value || '')).hostname); } catch {}
    const match = sourceRuleForDomain(domain), profile = domainProfile(options), sourceType = match?.[1] || 'other';
    return freeze(match ? { sourceType, official: OFFICIAL_TYPES_BY_PROFILE[profile].includes(sourceType) } : { sourceType: 'other', official: false });
  }
  function searchSourcePriority(value, options = {}) {
    const profile = domainProfile(options);
    const classified = typeof value === 'object' ? classifySearchSource(own(value, 'url'), options) : null;
    const trustedType = options.trustedSourceType === true ? oneOf(typeof value === 'string' ? value : own(value, 'sourceType'), SEARCH_SOURCE_TYPES, 'other') : 'other';
    const sourceType = classified?.sourceType !== 'other' ? classified.sourceType : trustedType;
    return (classified?.official === true ? 1000 : 0) + Number(SOURCE_WEIGHTS_BY_PROFILE[profile]?.[sourceType] || 0);
  }
  function sortSearchEvidence(value = [], options = {}) {
    return freeze((Array.isArray(value) ? value : []).map((item, index) => ({ item, index }))
      .sort((left, right) => searchSourcePriority(right.item, options) - searchSourcePriority(left.item, options) || left.index - right.index)
      .map(entry => entry.item));
  }
  function normalizeSearchEvidence(value = {}, options = {}) {
    const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const url = safeFetchUrl(own(raw, 'url'));
    if (!url) return null;
    const domain = normalizeDomain(new URL(url).hostname);
    const allowed = uniqueStrings(options.allowedDomains, SEARCH_LIMITS.maxDomains, normalizeDomain);
    if (allowed.length && !allowed.some(item => domain === item || domain.endsWith(`.${item}`))) return null;
    const classified = classifySearchSource(url, options);
    const rawSourceType = options.trustedSourceType === true ? oneOf(own(raw, 'sourceType'), SEARCH_SOURCE_TYPES, 'other') : 'other';
    const sourceType = classified.sourceType !== 'other' ? classified.sourceType : rawSourceType;
    const official = classified.official === true && sourceType === classified.sourceType;
    return freeze({
      id: text(own(raw, 'id'), 128) || `ev_${Math.random().toString(36).slice(2, 12)}`,
      title: text(own(raw, 'title'), 300), url, domain,
      snippet: text(own(raw, 'snippet'), SEARCH_LIMITS.snippetChars), providerId: text(own(raw, 'providerId'), 128),
      retrievedAt: Math.max(0, Number(own(raw, 'retrievedAt')) || Date.now()), sourceType, official,
      readStatus: oneOf(own(raw, 'readStatus'), ['summary', 'deep-read'], 'summary'),
      contentExcerpt: text(own(raw, 'contentExcerpt'), SEARCH_LIMITS.fetchExcerptChars), contentType: text(own(raw, 'contentType'), 80),
      readerProviderId: text(own(raw, 'readerProviderId'), 128), matchTrusted: options.matchTrusted === true,
      match: freeze({
        brand: text(own(own(raw, 'match'), 'brand'), 120), product: text(own(own(raw, 'match'), 'product'), 160),
        market: text(own(own(raw, 'match'), 'market'), 32), serving: text(own(own(raw, 'match'), 'serving'), 120)
      })
    });
  }
  function summarizeSearchEvidence(value = [], options = {}) {
    const out = [], seen = new Set();
    for (const raw of (Array.isArray(value) ? value : [])) {
      const item = normalizeSearchEvidence(raw, options);
      if (!item || seen.has(item.url)) continue;
      seen.add(item.url);
      out.push(freeze({ id: item.id, title: item.title, url: item.url, domain: item.domain, providerId: item.providerId, retrievedAt: item.retrievedAt, sourceType: item.sourceType, official: item.official, readStatus: item.readStatus, readerProviderId: item.readerProviderId }));
      if (out.length >= 20) break;
    }
    return freeze(out);
  }
  function stripSearchEvidenceBody(value = {}) {
    const { contentExcerpt: _body, contentType: _mime, ...safe } = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return freeze({ ...safe, match: freeze({ ...(safe.match || {}) }) });
  }
  function searchEvidenceVersion(payload = {}) {
    const ai = { ...(payload.ai || {}) };
    const searchEvidence = summarizeSearchEvidence(payload.searchEvidence || ai.searchEvidence);
    delete ai.searchEvidence;
    return freeze({ ai: freeze(ai), searchEvidence });
  }
  return freeze({ SEARCH_LIMITS, SEARCH_DOMAIN_PROFILES, SEARCH_SOURCE_TYPES, normalizeDomain, safeFetchUrl, domainProfileForTask, classifySearchSource, searchSourcePriority, sortSearchEvidence, normalizeSearchEvidence, summarizeSearchEvidence, stripSearchEvidenceBody, searchEvidenceVersion });
});
