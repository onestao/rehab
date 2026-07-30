// @ts-nocheck
// Search policy and evidence are deliberately kept independent from browser APIs.
import './search-evidence-schema-pure.js';
const evidencePure = globalThis.searchEvidenceSchemaPure;
if (!evidencePure) throw new Error('search evidence schema unavailable');
export const NETWORK_MODES = Object.freeze(['off', 'auto', 'required']);
export const NETWORK_EXECUTIONS = Object.freeze(['native-first', 'native-only', 'external-first', 'external-only']);
export const SOURCE_POLICIES = Object.freeze(['official-preferred', 'official-only', 'any']);
export const NETWORK_FALLBACKS = Object.freeze(['local-estimate', 'ask-user', 'fail']);
export const SEARCH_PROVIDER_TYPES = Object.freeze(['tavily', 'brave', 'searxng', 'exa', 'jina', 'serper', 'duckduckgo']);
export const SEARCH_LIMITS = evidencePure.SEARCH_LIMITS;
export const SEARCH_DOMAIN_PROFILES = evidencePure.SEARCH_DOMAIN_PROFILES;
export const SEARCH_SOURCE_TYPES = evidencePure.SEARCH_SOURCE_TYPES;

const freeze = Object.freeze;
const own = (value, key) => {
  try { return value && typeof value === 'object' && !Array.isArray(value) && Object.getOwnPropertyDescriptor(value, key)?.value; } catch { return undefined; }
};
const text = (value, limit = 0) => typeof value === 'string' ? value.trim().slice(0, limit || undefined) : '';
const oneOf = (value, values, fallback) => values.includes(String(value || '').trim()) ? String(value).trim() : fallback;
const positive = (value, fallback, max) => Number.isFinite(Number(value)) ? Math.max(1, Math.min(max, Math.floor(Number(value)))) : fallback;

export const normalizeDomain = evidencePure.normalizeDomain;

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
      ...(type === 'searxng' && baseUrl ? { baseUrl } : {}),
      ...(type === 'duckduckgo' ? { experimental: true } : {})
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

export const safeFetchUrl = evidencePure.safeFetchUrl;
export const domainProfileForTask = evidencePure.domainProfileForTask;
export const classifySearchSource = evidencePure.classifySearchSource;
export const searchSourcePriority = evidencePure.searchSourcePriority;
export const sortSearchEvidence = evidencePure.sortSearchEvidence;
export const normalizeSearchEvidence = evidencePure.normalizeSearchEvidence;
export const summarizeSearchEvidence = evidencePure.summarizeSearchEvidence;
export const stripSearchEvidenceBody = evidencePure.stripSearchEvidenceBody;
export const searchEvidenceVersion = evidencePure.searchEvidenceVersion;


const FOOD_VERIFY_TRIGGER = /(?:\b(?:kfc|mcdonald'?s|starbucks|subway|burger\s*king)\b|麦当劳|肯德基|星巴克|瑞幸|喜茶|奈雪|包装|条码|菜单|订单|套餐|去掉|不要|加|换|双倍|半份|核实|来源|最新)/i;

export function shouldVerifyFoodEvidence(input, item = {}, policy = {}) {
  if (policy?.mode === 'required') return true;
  if (policy?.mode !== 'auto') return false;
  const confidence = Number(item?.confidence);
  const ratio = confidence > 1 ? confidence / 100 : confidence;
  return FOOD_VERIFY_TRIGGER.test(String(input || '')) || (ratio > 0 && ratio < 0.65);
}

export function summarizeFoodEvidence(value) {
  if (!value) return null;
  const { evidence = [], ...summary } = value;
  return { ...summary, sources: summarizeSearchEvidence(evidence, { domainProfile: 'food' }) };
}

export const FOOD_VERIFICATION_STATES = freeze(['not-required', 'pending', 'verified', 'estimated', 'needs-confirmation', 'unavailable', 'invalidated']);

export function validateFoodEvidenceLinks(value = {}) {
  const base = value?.base && typeof value.base === 'object' ? value.base : {};
  const modifications = Array.isArray(value?.modifications) ? value.modifications.slice(0, 20) : [];
  const evidence = Array.isArray(value?.evidence) ? value.evidence.filter(item => item && typeof item === 'object' && text(item.id, 128)).slice(0, 20) : [];
  const index = new Map(evidence.map(item => [text(item.id, 128), item]));
  const resolve = ids => (Array.isArray(ids) ? ids : []).map(id => index.get(text(id, 128))).filter(Boolean);
  const baseIds = Array.isArray(base.evidenceIds) ? base.evidenceIds : [];
  const baseMissingIds = baseIds.filter(id => !index.has(text(id, 128)));
  const modificationLinks = modifications.map((item, itemIndex) => {
    const ids = Array.isArray(item?.evidenceIds) ? item.evidenceIds : [];
    const missingIds = ids.filter(id => !index.has(text(id, 128)));
    return freeze({ index: itemIndex, ids, missingIds: freeze(missingIds), evidence: freeze(resolve(ids)) });
  });
  const missingIds = freeze([...new Set([...baseMissingIds, ...modificationLinks.flatMap(item => item.missingIds)])]);
  return freeze({
    valid: missingIds.length === 0,
    completeBase: baseIds.length > 0 && baseMissingIds.length === 0,
    completeModifications: modifications.every((_, indexValue) => modificationLinks[indexValue].ids.length > 0 && modificationLinks[indexValue].missingIds.length === 0),
    missingIds,
    baseEvidence: freeze(resolve(baseIds)),
    modificationLinks: freeze(modificationLinks),
    base,
    modifications,
    evidence
  });
}

function normalizedFoodText(value) { return text(value, 300).toLocaleLowerCase(); }
function containsFoodIdentity(leftValue, rightValue) {
  const left = normalizedFoodText(leftValue), right = normalizedFoodText(rightValue);
  return !!left && !!right && (left.includes(right) || right.includes(left));
}

export function foodEvidenceMatchConflict(base = {}, item = {}) {
  if (item?.matchTrusted !== true) return false;
  const match = item?.match && typeof item.match === 'object' ? item.match : {};
  if (match.brand && base.name && !containsFoodIdentity(base.name, match.brand)) return true;
  if (match.product && base.name && !containsFoodIdentity(base.name, match.product)) return true;
  if (match.market && base.market && normalizedFoodText(match.market) !== normalizedFoodText(base.market)) return true;
  if (match.serving && base.servingLabel && normalizedFoodText(match.serving) !== normalizedFoodText(base.servingLabel)) return true;
  const servingGrams = match.serving && /^\s*\d+(?:\.\d+)?\s*g?\s*$/i.test(String(match.serving))
    ? Number(String(match.serving).match(/\d+(?:\.\d+)?/)?.[0] || 0) : 0;
  return !!(servingGrams && base.grams && Math.abs(servingGrams - Number(base.grams)) > 0.01);
}

export function deriveFoodEvidenceTier(value = {}) {
  const links = validateFoodEvidenceLinks(value);
  const baseOfficial = links.completeBase && links.baseEvidence.every(item => item.official === true);
  const modificationsOfficial = links.completeModifications && links.modificationLinks.every(group => group.evidence.every(item => item.official === true));
  const exact = !links.modifications.length && baseOfficial && links.baseEvidence.some(item => {
    const match = item?.match && typeof item.match === 'object' ? item.match : {};
    return item?.matchTrusted === true && !!(match.brand || match.product) && !!(match.serving || links.base.servingLabel || links.base.grams)
      && !foodEvidenceMatchConflict(links.base, item);
  });
  if (exact) return 'official-exact';
  if (links.modifications.length && baseOfficial && modificationsOfficial) return 'official-composed';
  const linked = [...links.baseEvidence, ...links.modificationLinks.flatMap(item => item.evidence)];
  const structured = links.modifications.length > 0 && links.valid
    && links.modifications.every(item => item.label && (item.kind !== 'portion' || item.portionFactor));
  return linked.some(item => item.sourceType === 'database') || structured ? 'database-estimate' : 'vision-estimate';
}

export function verificationStateFromEvidence(evidence, options = {}) {
  const required = options.required === true;
  if (options.invalidated === true) return freeze({ required: true, state: 'invalidated', evidence: null });
  if (options.pending === true) return freeze({ required, state: 'pending', evidence: null });
  if (!evidence) return freeze({ required, state: required ? 'pending' : 'not-required', evidence: null });
  const state = ['verified', 'estimated', 'needs-confirmation', 'unavailable'].includes(String(evidence.status))
    ? String(evidence.status) : (required ? 'needs-confirmation' : 'estimated');
  return freeze({ required, state, evidence });
}

export function createFoodVerificationStates(count, verifyIndexes = [], policy = {}) {
  const requiredIndexes = new Set(Array.isArray(verifyIndexes) ? verifyIndexes.map(Number) : []);
  return freeze(Array.from({ length: Math.max(0, Number(count) || 0) }, (_, index) => {
    const required = policy?.mode === 'required' || requiredIndexes.has(index);
    return verificationStateFromEvidence(null, { required, pending: required });
  }));
}

export function invalidateFoodVerification(value = {}) {
  const required = value?.required === true || String(value?.state || '') !== 'not-required' || !!value?.evidence;
  return freeze(required
    ? { required: true, state: 'invalidated', evidence: null }
    : { required: false, state: 'not-required', evidence: null });
}

export function foodVerificationSaveDecision(value = {}, policy = {}) {
  const state = FOOD_VERIFICATION_STATES.includes(String(value?.state || '')) ? String(value.state) : (value?.required ? 'pending' : 'not-required');
  if (state === 'not-required' || state === 'verified' || (state === 'estimated' && policy?.fallback === 'local-estimate')) {
    return freeze({ allowed: true, state, reason: '' });
  }
  const reason = {
    pending: '仍在等待联网核实',
    'needs-confirmation': '仍有规格、份量或改动项待确认',
    unavailable: '联网核实不可用',
    invalidated: '内容已编辑，需重新联网核实',
    estimated: '当前策略不允许保存未核实估算'
  }[state] || '需要先完成联网核实';
  return freeze({ allowed: false, state, reason });
}

if (typeof window !== 'undefined') window.searchPolicyPure = { NETWORK_MODES, NETWORK_EXECUTIONS, SOURCE_POLICIES, NETWORK_FALLBACKS, SEARCH_PROVIDER_TYPES, SEARCH_LIMITS, SEARCH_DOMAIN_PROFILES, SEARCH_SOURCE_TYPES, FOOD_VERIFICATION_STATES, normalizeDomain, normalizeNetworkDefaults, normalizeNetworkPolicy, normalizeSearchProvider, normalizeSearchConfig, normalizeSearchEvidence, summarizeSearchEvidence, stripSearchEvidenceBody, searchEvidenceVersion, resolveNetworkPolicy, safeSearchQuery, safeFetchUrl, domainProfileForTask, classifySearchSource, searchSourcePriority, sortSearchEvidence, shouldVerifyFoodEvidence, summarizeFoodEvidence, validateFoodEvidenceLinks, foodEvidenceMatchConflict, deriveFoodEvidenceTier, verificationStateFromEvidence, createFoodVerificationStates, invalidateFoodVerification, foodVerificationSaveDecision };
