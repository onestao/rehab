// @ts-nocheck
const TIERS = Object.freeze(['official-exact', 'official-composed', 'database-estimate', 'vision-estimate']);
const STATUSES = Object.freeze(['verified', 'estimated', 'needs-confirmation', 'unavailable']);
const VERIFICATION_STATES = Object.freeze(['not-required', 'pending', 'verified', 'estimated', 'needs-confirmation', 'unavailable', 'invalidated']);
const MODIFICATIONS = Object.freeze(['remove', 'add', 'replace', 'portion']);
const NUTRIENTS = Object.freeze(['cal', 'pro', 'carb', 'fat', 'fiber', 'sugar', 'sodium', 'saturatedFat']);
const own = (value, key) => { try { return value && typeof value === 'object' && !Array.isArray(value) && Object.getOwnPropertyDescriptor(value, key)?.value; } catch { return undefined; } };
const text = (value, max = 300) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const number = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(100000, Number(Number(value).toFixed(2)))) : 0;
const freeze = Object.freeze;
const VERIFY_TRIGGER = /(?:\b(?:kfc|mcdonald'?s|starbucks|subway|burger\s*king)\b|麦当劳|肯德基|星巴克|瑞幸|喜茶|奈雪|包装|条码|菜单|订单|套餐|去掉|不要|加|换|双倍|半份|核实|来源|最新)/i;

export {
  TIERS as FOOD_CONFIDENCE_TIERS,
  STATUSES as FOOD_EVIDENCE_STATUSES,
  VERIFICATION_STATES as FOOD_VERIFICATION_STATES,
  MODIFICATIONS as FOOD_MODIFICATION_KINDS
};

export function normalizeNutrients(value = {}) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return freeze(Object.fromEntries(NUTRIENTS.map(key => [key, number(own(raw, key))])));
}

function evidenceIds(value) {
  return freeze([...new Set((Array.isArray(value) ? value : []).map(item => text(item, 128)).filter(Boolean))].slice(0, 20));
}
function evidenceIndex(list = []) {
  return new Map((Array.isArray(list) ? list : []).filter(item => item && typeof item === 'object' && text(item.id, 128)).map(item => [text(item.id, 128), item]));
}
function resolveEvidence(ids, index) {
  return freeze((Array.isArray(ids) ? ids : []).map(id => index.get(text(id, 128))).filter(Boolean));
}
function normalizeBase(value = {}) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return freeze({
    name: text(own(raw, 'name')),
    market: text(own(raw, 'market'), 32),
    servingLabel: text(own(raw, 'servingLabel'), 120),
    grams: number(own(raw, 'grams')),
    nutrients: normalizeNutrients(own(raw, 'nutrients')),
    evidenceIds: evidenceIds(own(raw, 'evidenceIds'))
  });
}
function normalizeModification(value = {}) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const kind = String(own(raw, 'kind') || 'add');
  const factor = Number(own(raw, 'portionFactor'));
  return freeze({
    kind: MODIFICATIONS.includes(kind) ? kind : 'add',
    label: text(own(raw, 'label')),
    nutrients: normalizeNutrients(own(raw, 'nutrients')),
    replacedNutrients: normalizeNutrients(own(raw, 'replacedNutrients')),
    portionFactor: Number.isFinite(factor) && factor > 0 && factor <= 10 ? Number(factor.toFixed(3)) : 0,
    evidenceIds: evidenceIds(own(raw, 'evidenceIds')),
    assumption: text(own(raw, 'assumption'), 300)
  });
}

export function calculateFoodTotal(base, modifications = []) {
  const total = { ...normalizeBase(base).nutrients };
  for (const item of (Array.isArray(modifications) ? modifications : [])) {
    const modification = normalizeModification(item);
    for (const key of NUTRIENTS) {
      if (modification.kind === 'portion') {
        if (modification.portionFactor) total[key] *= modification.portionFactor;
        continue;
      }
      const removed = modification.kind === 'remove'
        ? modification.nutrients[key]
        : modification.kind === 'replace' ? modification.replacedNutrients[key] : 0;
      const added = modification.kind === 'add' || modification.kind === 'replace' ? modification.nutrients[key] : 0;
      total[key] = Math.max(0, Number(total[key] || 0) - removed + added);
    }
  }
  return normalizeNutrients(total);
}

export function shouldVerifyFoodEvidence(input, item = {}, policy = {}) {
  if (policy?.mode === 'required') return true;
  if (policy?.mode !== 'auto') return false;
  const confidence = Number(item?.confidence);
  const ratio = confidence > 1 ? confidence / 100 : confidence;
  return VERIFY_TRIGGER.test(String(input || '')) || (ratio > 0 && ratio < 0.65);
}

function normalizeEvidenceList(value) {
  return freeze((Array.isArray(value) ? value : []).filter(item => item && typeof item === 'object' && text(item.id, 128)).slice(0, 20));
}

export function validateEvidenceLinks(value = {}) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const base = normalizeBase(own(raw, 'base'));
  const modifications = freeze((Array.isArray(own(raw, 'modifications')) ? own(raw, 'modifications') : []).map(normalizeModification).slice(0, 20));
  const evidence = normalizeEvidenceList(own(raw, 'evidence'));
  const index = evidenceIndex(evidence);
  const baseMissingIds = freeze(base.evidenceIds.filter(id => !index.has(id)));
  const baseEvidence = resolveEvidence(base.evidenceIds, index);
  const modificationLinks = freeze(modifications.map((item, itemIndex) => {
    const missingIds = freeze(item.evidenceIds.filter(id => !index.has(id)));
    return freeze({ index: itemIndex, ids: item.evidenceIds, missingIds, evidence: resolveEvidence(item.evidenceIds, index) });
  }));
  const missingIds = freeze([...new Set([...baseMissingIds, ...modificationLinks.flatMap(item => item.missingIds)])]);
  const completeBase = base.evidenceIds.length > 0 && baseMissingIds.length === 0;
  const completeModifications = modifications.every((_, indexValue) => modificationLinks[indexValue].ids.length > 0 && modificationLinks[indexValue].missingIds.length === 0);
  return freeze({
    valid: missingIds.length === 0,
    completeBase,
    completeModifications,
    missingIds,
    baseEvidence,
    modificationLinks,
    base,
    modifications,
    evidence
  });
}

function normalizedLower(value) { return text(value, 300).toLocaleLowerCase(); }
function containsEither(a, b) {
  const left = normalizedLower(a), right = normalizedLower(b);
  return !!left && !!right && (left.includes(right) || right.includes(left));
}
function trustedMatchConflict(base, item) {
  if (item?.matchTrusted !== true) return false;
  const match = item?.match && typeof item.match === 'object' ? item.match : {};
  if (match.brand && base.name && !containsEither(base.name, match.brand)) return true;
  if (match.product && base.name && !containsEither(base.name, match.product)) return true;
  if (match.market && base.market && normalizedLower(match.market) !== normalizedLower(base.market)) return true;
  if (match.serving && base.servingLabel && normalizedLower(match.serving) !== normalizedLower(base.servingLabel)) return true;
  if (match.serving && base.grams && /^\s*\d+(?:\.\d+)?\s*g?\s*$/i.test(String(match.serving))) {
    const servingGrams = Number(String(match.serving).match(/\d+(?:\.\d+)?/)?.[0] || 0);
    if (servingGrams && Math.abs(servingGrams - Number(base.grams)) > 0.01) return true;
  }
  return false;
}
function exactMatchReady(base, linked) {
  return linked.some(item => {
    if (item?.official !== true || item?.matchTrusted !== true) return false;
    const match = item?.match && typeof item.match === 'object' ? item.match : {};
    const hasIdentity = !!(match.brand || match.product);
    const hasServing = !!match.serving || !!base.servingLabel || !!base.grams;
    return hasIdentity && hasServing && !trustedMatchConflict(base, item);
  });
}

export function deriveFoodEvidenceTier(value = {}) {
  const links = validateEvidenceLinks(value);
  const baseOfficial = links.completeBase && links.baseEvidence.every(item => item.official === true);
  const modificationsOfficial = links.completeModifications && links.modificationLinks.every(group => group.evidence.every(item => item.official === true));
  if (!links.modifications.length && baseOfficial && exactMatchReady(links.base, links.baseEvidence)) return 'official-exact';
  if (links.modifications.length && baseOfficial && modificationsOfficial) return 'official-composed';
  const linkedEvidence = [...links.baseEvidence, ...links.modificationLinks.flatMap(item => item.evidence)];
  const databaseBacked = linkedEvidence.some(item => item.sourceType === 'database');
  const structuredBreakdown = links.modifications.length > 0 && links.valid
    && links.modifications.every(item => item.label && (item.kind !== 'portion' || item.portionFactor));
  return databaseBacked || structuredBreakdown ? 'database-estimate' : 'vision-estimate';
}

export function normalizeFoodEvidence(value = {}, options = {}) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const evidence = normalizeEvidenceList(own(raw, 'evidence'));
  const base = normalizeBase(own(raw, 'base'));
  const modifications = freeze((Array.isArray(own(raw, 'modifications')) ? own(raw, 'modifications') : []).map(normalizeModification).slice(0, 20));
  const links = validateEvidenceLinks({ base, modifications, evidence });
  const tier = deriveFoodEvidenceTier({ base, modifications, evidence });
  const calculated = calculateFoodTotal(base, modifications);
  const requestedStatus = String(own(raw, 'status') || 'estimated');
  let status = STATUSES.includes(requestedStatus) ? requestedStatus : 'estimated';
  const unresolvedModification = modifications.some(item => item.kind === 'portion'
    ? !item.portionFactor
    : item.kind === 'replace' && !Object.values(item.replacedNutrients).some(Boolean));
  const matchConflict = links.baseEvidence.some(item => trustedMatchConflict(base, item));
  const rawRange = own(own(own(raw, 'total'), 'range'), 'cal');
  const calRange = Array.isArray(rawRange) && rawRange.length >= 2 && rawRange.slice(0, 2).every(value => Number.isFinite(Number(value)))
    ? [number(rawRange[0]), number(rawRange[1])].sort((a, b) => a - b) : [];
  const total = freeze({ nutrients: calculated, range: freeze({ cal: freeze(calRange) }) });
  const requiredUserInput = (Array.isArray(own(raw, 'requiredUserInput')) ? own(raw, 'requiredUserInput') : []).map(item => text(item, 160)).filter(Boolean);
  if (!links.valid && !requiredUserInput.length) requiredUserInput.push('证据引用无效，请重新核实');
  if (matchConflict && !requiredUserInput.length) requiredUserInput.push('品牌、地区或规格与来源不一致，请确认');
  if (unresolvedModification && !requiredUserInput.length) requiredUserInput.push('请确认替换内容或份量比例');
  if (options.required === true && !evidence.length) status = 'unavailable';
  else if (!links.valid || matchConflict || unresolvedModification || requiredUserInput.length) status = 'needs-confirmation';
  else if (status === 'verified' && !['official-exact', 'official-composed'].includes(tier)) status = 'estimated';
  else if (['official-exact', 'official-composed'].includes(tier) && status !== 'unavailable') status = 'verified';
  return freeze({
    status,
    confidenceTier: tier,
    base,
    modifications,
    total,
    evidence,
    assumptions: freeze((Array.isArray(own(raw, 'assumptions')) ? own(raw, 'assumptions') : []).map(item => text(item, 300)).filter(Boolean).slice(0, 20)),
    requiredUserInput: freeze(requiredUserInput.slice(0, 10))
  });
}

export function verificationStateFromEvidence(evidence, options = {}) {
  const required = options.required === true;
  if (options.invalidated === true) return freeze({ required: true, state: 'invalidated', evidence: null });
  if (options.pending === true) return freeze({ required, state: 'pending', evidence: null });
  if (!evidence) return freeze({ required, state: required ? 'pending' : 'not-required', evidence: null });
  const state = STATUSES.includes(String(evidence.status)) ? String(evidence.status) : (required ? 'needs-confirmation' : 'estimated');
  return freeze({ required, state, evidence });
}

export function invalidateFoodVerification(value = {}) {
  const current = value && typeof value === 'object' ? value : {};
  const required = current.required === true || String(current.state || '') !== 'not-required' || !!current.evidence;
  return required
    ? freeze({ required: true, state: 'invalidated', evidence: null })
    : freeze({ required: false, state: 'not-required', evidence: null });
}

export function foodVerificationSaveDecision(value = {}, policy = {}) {
  const state = VERIFICATION_STATES.includes(String(value?.state || '')) ? String(value.state) : (value?.required ? 'pending' : 'not-required');
  if (state === 'not-required' || state === 'verified') return freeze({ allowed: true, state, reason: '' });
  if (state === 'estimated' && policy?.fallback === 'local-estimate') return freeze({ allowed: true, state, reason: '' });
  const reasons = {
    pending: '仍在等待联网核实',
    'needs-confirmation': '仍有规格、份量或改动项待确认',
    unavailable: '联网核实不可用',
    invalidated: '内容已编辑，需重新联网核实',
    estimated: '当前策略不允许保存未核实估算'
  };
  return freeze({ allowed: false, state, reason: reasons[state] || '需要先完成联网核实' });
}

export function summarizeFoodEvidence(value) {
  if (!value) return null;
  const { evidence = [], ...summary } = value;
  return { ...summary, sources: evidence.map(({ snippet, match, matchTrusted, providerId, retrievedAt, ...source }) => source).slice(0, 20) };
}

if (typeof window !== 'undefined') window.foodEvidencePure = {
  FOOD_CONFIDENCE_TIERS: TIERS,
  FOOD_EVIDENCE_STATUSES: STATUSES,
  FOOD_VERIFICATION_STATES: VERIFICATION_STATES,
  FOOD_MODIFICATION_KINDS: MODIFICATIONS,
  normalizeNutrients,
  calculateFoodTotal,
  shouldVerifyFoodEvidence,
  validateEvidenceLinks,
  deriveFoodEvidenceTier,
  normalizeFoodEvidence,
  verificationStateFromEvidence,
  invalidateFoodVerification,
  foodVerificationSaveDecision,
  summarizeFoodEvidence
};
