// @ts-nocheck
// Search policy and evidence are deliberately kept independent from browser APIs.
export const NETWORK_MODES = Object.freeze(['off', 'auto', 'required']);
export const NETWORK_EXECUTIONS = Object.freeze(['native-first', 'native-only', 'external-first', 'external-only']);
export const SOURCE_POLICIES = Object.freeze(['official-preferred', 'official-only', 'any']);
export const NETWORK_FALLBACKS = Object.freeze(['local-estimate', 'ask-user', 'fail']);
export const SEARCH_PROVIDER_TYPES = Object.freeze(['tavily', 'brave', 'searxng']);
export const SEARCH_LIMITS = Object.freeze({ maxProviders: 12, maxProviderIds: 12, maxDomains: 20, maxDomainLength: 253, maxToolCalls: 2, maxResultChars: 12000, maxResults: 10, timeoutMs: 8000, queryChars: 240, snippetChars: 2000 });
const OFFICIAL_DOMAIN_RULES = Object.freeze({
  'mcdonalds.com': 'official-nutrition', 'kfc.com': 'official-nutrition',
  'starbucks.com': 'official-nutrition', 'subway.com': 'official-nutrition',
  'burgerking.com': 'official-nutrition', 'coca-cola.com': 'official-nutrition'
});

const freeze = Object.freeze;
const own = (value, key) => {
  try { return value && typeof value === 'object' && !Array.isArray(value) && Object.getOwnPropertyDescriptor(value, key)?.value; } catch { return undefined; }
};
const text = (value, limit = 0) => typeof value === 'string' ? value.trim().slice(0, limit || undefined) : '';
const oneOf = (value, values, fallback) => values.includes(String(value || '').trim()) ? String(value).trim() : fallback;
const positive = (value, fallback, max) => Number.isFinite(Number(value)) ? Math.max(1, Math.min(max, Math.floor(Number(value)))) : fallback;

export function normalizeDomain(value) {
  let domain = text(value, SEARCH_LIMITS.maxDomainLength).toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!domain || /[\s/@?#\\]/.test(domain) || domain === 'localhost' || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(domain)) return '';
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain) ? domain : '';
}

function uniqueStrings(value, limit, mapper = value => text(value)) {
  const result = [];
  const seen = new Set();
  for (const entry of Array.isArray(value) ? value : []) {
    const normalized = mapper(entry);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

export function normalizeNetworkDefaults(value = {}) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return freeze({
    sourcePolicy: oneOf(own(raw, 'sourcePolicy'), SOURCE_POLICIES, 'official-preferred'),
    allowedDomains: freeze(uniqueStrings(own(raw, 'allowedDomains'), SEARCH_LIMITS.maxDomains, normalizeDomain)),
    maxToolCalls: positive(own(raw, 'maxToolCalls'), SEARCH_LIMITS.maxToolCalls, SEARCH_LIMITS.maxToolCalls),
    maxResultChars: positive(own(raw, 'maxResultChars'), SEARCH_LIMITS.maxResultChars, SEARCH_LIMITS.maxResultChars)
  });
}

export function normalizeNetworkPolicy(value = {}, defaults = {}) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const base = normalizeNetworkDefaults(defaults);
  const mode = oneOf(own(raw, 'mode'), NETWORK_MODES, 'off');
  return freeze({
    mode,
    execution: oneOf(own(raw, 'execution'), NETWORK_EXECUTIONS, 'native-first'),
    providerIds: freeze(uniqueStrings(own(raw, 'providerIds'), SEARCH_LIMITS.maxProviderIds, id => text(id, 128))),
    sourcePolicy: oneOf(own(raw, 'sourcePolicy'), SOURCE_POLICIES, base.sourcePolicy),
    fallback: oneOf(own(raw, 'fallback'), NETWORK_FALLBACKS, mode === 'required' ? 'fail' : 'local-estimate'),
    // Task domains only add restrictions; callers intersect this list with global rules.
    allowedDomains: freeze(uniqueStrings(own(raw, 'allowedDomains'), SEARCH_LIMITS.maxDomains, normalizeDomain))
  });
}

export function normalizeSearchProvider(value = {}, index = 0) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const type = oneOf(own(raw, 'type'), SEARCH_PROVIDER_TYPES, '');
  const id = text(own(raw, 'id'), 128);
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id) || !type) return null;
  const options = own(raw, 'options');
  const safeOptions = options && typeof options === 'object' && !Array.isArray(options) ? options : {};
  let baseUrl = '';
  try {
    const parsed = new URL(text(own(safeOptions, 'baseUrl'), 500));
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password && normalizeDomain(parsed.hostname)) {
      baseUrl = `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`;
    }
  } catch {}
  return freeze({
    id,
    name: text(own(raw, 'name'), 80) || id,
    type,
    enabled: own(raw, 'enabled') !== false,
    archived: own(raw, 'archived') === true,
    sortOrder: Math.max(0, Math.min(9999, Math.floor(Number(own(raw, 'sortOrder')) || index))),
    region: text(own(raw, 'region'), 12).toUpperCase(),
    options: freeze({
      maxResults: positive(own(safeOptions, 'maxResults'), 5, SEARCH_LIMITS.maxResults),
      timeoutMs: positive(own(safeOptions, 'timeoutMs'), SEARCH_LIMITS.timeoutMs, 30000),
      ...(type === 'searxng' && baseUrl ? { baseUrl } : {})
    })
  });
}

export function normalizeSearchConfig(value = {}) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const providers = uniqueProviders(own(raw, 'searchProviders'));
  return freeze({
    searchSchemaVersion: 1,
    searchProviders: freeze(providers),
    networkDefaults: normalizeNetworkDefaults(own(raw, 'networkDefaults'))
  });
}

function uniqueProviders(value) {
  const providers = [];
  const ids = new Set();
  for (const [index, item] of (Array.isArray(value) ? value : []).entries()) {
    const provider = normalizeSearchProvider(item, index);
    if (!provider || ids.has(provider.id)) continue;
    ids.add(provider.id);
    providers.push(provider);
    if (providers.length >= SEARCH_LIMITS.maxProviders) break;
  }
  return providers.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

export function resolveNetworkPolicy(route = {}, config = {}) {
  const defaults = normalizeSearchConfig(config).networkDefaults;
  const policy = normalizeNetworkPolicy(own(route, 'network'), defaults);
  const globalDomains = defaults.allowedDomains;
  const taskDomains = policy.allowedDomains;
  const allowedDomains = !globalDomains.length ? taskDomains
    : !taskDomains.length ? globalDomains
      : taskDomains.filter(domain => globalDomains.includes(domain));
  return freeze({ ...policy, allowedDomains: freeze(globalDomains.length && taskDomains.length && !allowedDomains.length ? ['blocked.invalid'] : allowedDomains) });
}

export function safeSearchQuery(value) {
  return [...text(value, SEARCH_LIMITS.queryChars)].map(char => {
    const code = char.charCodeAt(0);
    return code <= 0x1f || code === 0x7f ? ' ' : char;
  }).join('').replace(/\s+/g, ' ').trim();
}

export function classifySearchSource(value) {
  let domain = '';
  try { domain = normalizeDomain(new URL(String(value || '')).hostname); } catch {}
  const match = Object.entries(OFFICIAL_DOMAIN_RULES)
    .find(([allowed]) => domain === allowed || domain.endsWith(`.${allowed}`));
  return freeze(match
    ? { sourceType: match[1], official: true }
    : { sourceType: 'other', official: false });
}

export function normalizeSearchEvidence(value = {}, options = {}) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  let url = text(own(raw, 'url'), 2048);
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !normalizeDomain(parsed.hostname)) url = '';
    else url = parsed.href;
  } catch { url = ''; }
  if (!url) return null;
  const domain = normalizeDomain(new URL(url).hostname);
  const allowed = uniqueStrings(options.allowedDomains, SEARCH_LIMITS.maxDomains, normalizeDomain);
  if (allowed.length && !allowed.some(item => domain === item || domain.endsWith(`.${item}`))) return null;
  const sourceType = oneOf(own(raw, 'sourceType'), ['official-nutrition', 'official-menu', 'database', 'other'], 'other');
  const official = own(raw, 'official') === true && ['official-nutrition', 'official-menu'].includes(sourceType);
  return freeze({
    id: text(own(raw, 'id'), 128) || `ev_${Math.random().toString(36).slice(2, 12)}`,
    title: text(own(raw, 'title'), 300), url, domain,
    snippet: text(own(raw, 'snippet'), SEARCH_LIMITS.snippetChars),
    providerId: text(own(raw, 'providerId'), 128),
    retrievedAt: Math.max(0, Number(own(raw, 'retrievedAt')) || Date.now()),
    sourceType, official,
    match: freeze({
      brand: text(own(own(raw, 'match'), 'brand'), 120), product: text(own(own(raw, 'match'), 'product'), 160),
      market: text(own(own(raw, 'match'), 'market'), 32), serving: text(own(own(raw, 'match'), 'serving'), 120)
    })
  });
}

if (typeof window !== 'undefined') window.searchPolicyPure = { NETWORK_MODES, NETWORK_EXECUTIONS, SOURCE_POLICIES, NETWORK_FALLBACKS, SEARCH_PROVIDER_TYPES, SEARCH_LIMITS, normalizeDomain, normalizeNetworkDefaults, normalizeNetworkPolicy, normalizeSearchProvider, normalizeSearchConfig, normalizeSearchEvidence, resolveNetworkPolicy, safeSearchQuery, classifySearchSource };
