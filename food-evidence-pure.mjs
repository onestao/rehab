// @ts-nocheck
import {
  deriveFoodEvidenceTier,
  foodEvidenceMatchConflict,
  validateFoodEvidenceLinks
} from './search-policy-pure.mjs';

const TIERS = Object.freeze(['official-exact', 'official-composed', 'database-estimate', 'vision-estimate']);
const STATUSES = Object.freeze(['verified', 'estimated', 'needs-confirmation', 'unavailable']);
const MODIFICATIONS = Object.freeze(['remove', 'add', 'replace', 'portion']);
const NUTRIENTS = Object.freeze(['cal', 'pro', 'carb', 'fat', 'fiber', 'sugar', 'sodium', 'saturatedFat']);
const own = (value, key) => { try { return value && typeof value === 'object' && !Array.isArray(value) && Object.getOwnPropertyDescriptor(value, key)?.value; } catch { return undefined; } };
const text = (value, max = 300) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const number = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(100000, Number(Number(value).toFixed(2)))) : 0;
const freeze = Object.freeze;

export function normalizeNutrients(value = {}) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return freeze(Object.fromEntries(NUTRIENTS.map(key => [key, number(own(raw, key))])));
}

const evidenceIds = value => freeze([...new Set((Array.isArray(value) ? value : []).map(item => text(item, 128)).filter(Boolean))].slice(0, 20));
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
  for (const raw of (Array.isArray(modifications) ? modifications : [])) {
    const item = normalizeModification(raw);
    for (const key of NUTRIENTS) {
      if (item.kind === 'portion') {
        if (item.portionFactor) total[key] *= item.portionFactor;
        continue;
      }
      const removed = item.kind === 'remove' ? item.nutrients[key] : item.kind === 'replace' ? item.replacedNutrients[key] : 0;
      const added = item.kind === 'add' || item.kind === 'replace' ? item.nutrients[key] : 0;
      total[key] = Math.max(0, Number(total[key] || 0) - removed + added);
    }
  }
  return normalizeNutrients(total);
}

export function normalizeFoodEvidence(value = {}, options = {}) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const evidence = freeze((Array.isArray(own(raw, 'evidence')) ? own(raw, 'evidence') : []).filter(item => item && typeof item === 'object' && text(item.id, 128)).slice(0, 20));
  const base = normalizeBase(own(raw, 'base'));
  const modifications = freeze((Array.isArray(own(raw, 'modifications')) ? own(raw, 'modifications') : []).map(normalizeModification).slice(0, 20));
  const links = validateFoodEvidenceLinks({ base, modifications, evidence });
  const tier = deriveFoodEvidenceTier({ base, modifications, evidence });
  const unresolved = modifications.some(item => item.kind === 'portion'
    ? !item.portionFactor
    : item.kind === 'replace' && !Object.values(item.replacedNutrients).some(Boolean));
  const matchConflict = links.baseEvidence.some(item => foodEvidenceMatchConflict(base, item));
  const requestedStatus = String(own(raw, 'status') || 'estimated');
  let status = STATUSES.includes(requestedStatus) ? requestedStatus : 'estimated';
  const requiredUserInput = (Array.isArray(own(raw, 'requiredUserInput')) ? own(raw, 'requiredUserInput') : []).map(item => text(item, 160)).filter(Boolean);
  if (!links.valid && !requiredUserInput.length) requiredUserInput.push('证据引用无效，请重新核实');
  if (matchConflict && !requiredUserInput.length) requiredUserInput.push('品牌、地区或规格与来源不一致，请确认');
  if (unresolved && !requiredUserInput.length) requiredUserInput.push('请确认替换内容或份量比例');
  if (options.required === true && !evidence.length) status = 'unavailable';
  else if (!links.valid || matchConflict || unresolved || requiredUserInput.length) status = 'needs-confirmation';
  else if (['official-exact', 'official-composed'].includes(tier)) status = 'verified';
  else if (status === 'verified') status = 'estimated';
  const rawRange = own(own(own(raw, 'total'), 'range'), 'cal');
  const calRange = Array.isArray(rawRange) && rawRange.length >= 2 && rawRange.slice(0, 2).every(value => Number.isFinite(Number(value)))
    ? [number(rawRange[0]), number(rawRange[1])].sort((a, b) => a - b) : [];
  return freeze({
    status,
    confidenceTier: tier,
    base,
    modifications,
    total: freeze({ nutrients: calculateFoodTotal(base, modifications), range: freeze({ cal: freeze(calRange) }) }),
    evidence,
    assumptions: freeze((Array.isArray(own(raw, 'assumptions')) ? own(raw, 'assumptions') : []).map(item => text(item, 300)).filter(Boolean).slice(0, 20)),
    requiredUserInput: freeze(requiredUserInput.slice(0, 10))
  });
}


if (typeof window !== 'undefined') window.foodEvidencePure = {
  normalizeNutrients,
  calculateFoodTotal,
  normalizeFoodEvidence
};
