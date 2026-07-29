// @ts-nocheck
const TIERS = Object.freeze(['official-exact', 'official-composed', 'database-estimate', 'vision-estimate']);
const STATUSES = Object.freeze(['verified', 'estimated', 'needs-confirmation', 'unavailable']);
const MODIFICATIONS = Object.freeze(['remove', 'add', 'replace', 'portion']);
const NUTRIENTS = Object.freeze(['cal', 'pro', 'carb', 'fat', 'fiber', 'sugar', 'sodium', 'saturatedFat']);
const own = (value, key) => { try { return value && typeof value === 'object' && !Array.isArray(value) && Object.getOwnPropertyDescriptor(value, key)?.value; } catch { return undefined; } };
const text = (value, max = 300) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const number = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(100000, Number(Number(value).toFixed(2)))) : 0;
const freeze = Object.freeze;
const VERIFY_TRIGGER = /(?:\b(?:kfc|mcdonald'?s|starbucks|subway|burger\s*king)\b|麦当劳|肯德基|星巴克|瑞幸|喜茶|奈雪|包装|条码|菜单|订单|套餐|去掉|不要|加|换|双倍|半份|核实|来源|最新)/i;

export { TIERS as FOOD_CONFIDENCE_TIERS, STATUSES as FOOD_EVIDENCE_STATUSES, MODIFICATIONS as FOOD_MODIFICATION_KINDS };

export function normalizeNutrients(value = {}) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return freeze(Object.fromEntries(NUTRIENTS.map(key => [key, number(own(raw, key))])));
}

function evidenceIds(value) { return freeze([...new Set((Array.isArray(value) ? value : []).map(item => text(item, 128)).filter(Boolean))].slice(0, 20)); }
function evidenceIndex(list = []) {
  return new Map((Array.isArray(list) ? list : []).filter(item => item && typeof item === 'object' && text(item.id, 128)).map(item => [text(item.id, 128), item]));
}
function resolveEvidence(ids, index) {
  return freeze((Array.isArray(ids) ? ids : []).map(id => index.get(text(id, 128))).filter(Boolean));
}
function hasOfficialSupport(ids, index) {
  const resolved = resolveEvidence(ids, index);
  return resolved.length > 0 && resolved.every(item => item.official === true);
}
function exactMatchReady(base = {}, officialItems = []) {
  if (!base.name || !officialItems.length) return false;
  return officialItems.some(item => {
    const match = item?.match && typeof item.match === 'object' ? item.match : {};
    const brandOk = !match.brand || base.name.includes(match.brand) || match.brand.includes(base.name);
    const productOk = !match.product || base.name.includes(match.product) || match.product.includes(base.name);
    const marketOk = !match.market || !base.market || match.market === base.market;
    const servingOk = !match.serving || !base.servingLabel || match.serving === base.servingLabel || String(base.grams || '') === match.serving;
    return brandOk && productOk && marketOk && servingOk;
  });
}
function normalizeBase(value = {}) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return freeze({ name: text(own(raw, 'name')), market: text(own(raw, 'market'), 32), servingLabel: text(own(raw, 'servingLabel'), 120), grams: number(own(raw, 'grams')), nutrients: normalizeNutrients(own(raw, 'nutrients')), evidenceIds: evidenceIds(own(raw, 'evidenceIds')) });
}
function normalizeModification(value = {}) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const kind = String(own(raw, 'kind') || 'add');
  const factor = Number(own(raw, 'portionFactor'));
  return freeze({
    kind: MODIFICATIONS.includes(kind) ? kind : 'add', label: text(own(raw, 'label')),
    nutrients: normalizeNutrients(own(raw, 'nutrients')),
    replacedNutrients: normalizeNutrients(own(raw, 'replacedNutrients')),
    portionFactor: Number.isFinite(factor) && factor > 0 && factor <= 10 ? Number(factor.toFixed(3)) : 0,
    evidenceIds: evidenceIds(own(raw, 'evidenceIds')), assumption: text(own(raw, 'assumption'), 300)
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

export function normalizeFoodEvidence(value = {}, options = {}) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const evidence = (Array.isArray(own(raw, 'evidence')) ? own(raw, 'evidence') : []).filter(item => item && typeof item === 'object').slice(0, 20);
  const index = evidenceIndex(evidence);
  let base = normalizeBase(own(raw, 'base'));
  let modifications = freeze((Array.isArray(own(raw, 'modifications')) ? own(raw, 'modifications') : []).map(normalizeModification).slice(0, 20));
  if (!base.evidenceIds.length && evidence.length) base = freeze({ ...base, evidenceIds: evidenceIds(evidence.map(item => item.id)) });
  modifications = freeze(modifications.map(item => item.evidenceIds.length ? item : freeze({ ...item, evidenceIds: base.evidenceIds })));
  let tier = TIERS.includes(String(own(raw, 'confidenceTier'))) ? String(own(raw, 'confidenceTier')) : 'vision-estimate';
  const baseOfficial = hasOfficialSupport(base.evidenceIds, index);
  const modsOfficial = !modifications.length || modifications.every(item => hasOfficialSupport(item.evidenceIds, index));
  const officialItems = resolveEvidence(base.evidenceIds, index).filter(item => item.official === true);
  if (tier === 'official-exact') {
    if (!(baseOfficial && modsOfficial && exactMatchReady(base, officialItems))) tier = baseOfficial && modsOfficial ? 'official-composed' : 'database-estimate';
  } else if (tier === 'official-composed' && !(baseOfficial && modsOfficial)) {
    tier = 'database-estimate';
  }
  const officialEvidence = baseOfficial && modsOfficial;
  const calculated = calculateFoodTotal(base, modifications);
  const requestedStatus = String(own(raw, 'status') || 'estimated');
  let status = STATUSES.includes(requestedStatus) ? requestedStatus : 'estimated';
  const unresolvedModification = modifications.some(item => item.kind === 'portion'
    ? !item.portionFactor : item.kind === 'replace' && !Object.values(item.replacedNutrients).some(Boolean));
  if ((tier === 'official-exact' || tier === 'official-composed') && !officialEvidence) status = 'needs-confirmation';
  if (options.required === true && !evidence.length) status = 'unavailable';
  if (status === 'verified' && !officialEvidence) status = 'needs-confirmation';
  if (unresolvedModification) status = 'needs-confirmation';
  const rawRange = own(own(own(raw, 'total'), 'range'), 'cal');
  const calRange = Array.isArray(rawRange) && rawRange.length >= 2 && rawRange.slice(0, 2).every(value => Number.isFinite(Number(value)))
    ? [number(rawRange[0]), number(rawRange[1])].sort((a, b) => a - b) : [];
  const total = freeze({ nutrients: calculated, range: freeze({ cal: freeze(calRange) }) });
  const requiredUserInput = (Array.isArray(own(raw, 'requiredUserInput')) ? own(raw, 'requiredUserInput') : []).map(item => text(item, 160)).filter(Boolean);
  if (unresolvedModification && !requiredUserInput.length) requiredUserInput.push('请确认替换内容或份量比例');
  if (requiredUserInput.length && status !== 'unavailable') status = 'needs-confirmation';
  return freeze({ status, confidenceTier: tier, base, modifications, total, evidence: freeze(evidence), assumptions: freeze((Array.isArray(own(raw, 'assumptions')) ? own(raw, 'assumptions') : []).map(item => text(item, 300)).filter(Boolean).slice(0, 20)), requiredUserInput: freeze(requiredUserInput.slice(0, 10)) });
}

export function summarizeFoodEvidence(value) {
  if (!value) return null;
  const { evidence = [], ...summary } = value;
  return { ...summary, sources: evidence.map(({ snippet, match, providerId, retrievedAt, ...source }) => source).slice(0, 20) };
}

if (typeof window !== 'undefined') window.foodEvidencePure = { FOOD_CONFIDENCE_TIERS: TIERS, FOOD_EVIDENCE_STATUSES: STATUSES, FOOD_MODIFICATION_KINDS: MODIFICATIONS, normalizeNutrients, calculateFoodTotal, shouldVerifyFoodEvidence, normalizeFoodEvidence, summarizeFoodEvidence };
