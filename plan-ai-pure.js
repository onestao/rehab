// @ts-nocheck
(function () {
function safeJsonParse(text) {
    try { return JSON.parse(text); } catch { return null; }
}

function readNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function readPositiveNumber(value, fallback = 0) {
    return Math.max(0, readNumber(value, fallback));
}

function readCappedPositiveNumber(value, fallback = 0, max = Infinity) {
    const number = readPositiveNumber(value, fallback);
    return Number.isFinite(max) ? Math.min(number, max) : number;
}

function readPositiveInteger(value, fallback = 1) {
    return Math.max(1, Math.round(readNumber(value, fallback)));
}

function parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    const text = String(value ?? '').trim().toLowerCase();
    if (!text) return false;
    if (['true', '1', 'yes', 'y', '是', '需要', '交替', '双侧', '左右'].some((token) => text.includes(token))) return true;
    if (['false', '0', 'no', 'n', '否', '不'].some((token) => text.includes(token))) return false;
    return false;
}

const VALID_MODES = ['reps', 'hold', 'alt-reps', 'alt-hold'];
const PLAN_AI_TYPES = ['rehab', 'cut', 'bulk', 'maintenance', 'custom'];

// 计划阶段枚举的唯一定义在 action-taxonomy-pure.js（对外 JSON 契约，不可改名改值）。
function actionTaxonomy() {
    return typeof window !== 'undefined' ? window.actionTaxonomy : null;
}

function normalizeAiCategory(value = 'main') {
    return actionTaxonomy()?.normalizePlanPhase?.(value) || 'main';
}

function isTimedAiAction(item = {}) {
    const text = `${item.name || ''} ${item.category || ''} ${item.phase || ''} ${item.section || ''}`.toLowerCase();
    return /保持|支撑|平板|静蹲|静态|靠墙|拉伸|伸展|放松|呼吸|hold|plank|stretch|mobility|wall\s*sit|isometric|brace/.test(text)
        || normalizeAiCategory(item.category || item.phase || item.section) === 'cooldown';
}

function inferSpecMode(spec = {}, item = {}) {
    if (spec.mode && VALID_MODES.includes(spec.mode)) return spec.mode;
    const alt = parseBoolean(spec.isAlt ?? item.isAlt ?? item.alternating ?? item.bilateral ?? item.sideMode);
    const timed = isTimedAiAction(item);
    if (alt) return timed ? 'alt-hold' : 'alt-reps';
    return timed ? 'hold' : 'reps';
}

function validateAiSpec(spec, name) {
    const errs = [];
    if (!spec || typeof spec !== 'object') { errs.push(`${name}: spec 缺失`); return errs; }
    const { sets, reps, work, mode, repRest, actionRest } = spec;
    if (!Number.isInteger(sets) || sets < 1) errs.push(`${name}.spec.sets 必须 ≥1 整数`);
    if (!mode || !VALID_MODES.includes(mode)) errs.push(`${name}.spec.mode 必须为 reps|hold|alt-reps|alt-hold`);
    if (mode === 'reps' || mode === 'alt-reps') {
        if (!Number.isInteger(reps) || reps < 1) errs.push(`${name}.spec.reps (mode=${mode}) 必须 ≥1`);
        if (!Number.isInteger(work) || work < 1) errs.push(`${name}.spec.work (mode=${mode}) 必须 ≥1 秒`);
    }
    if (mode === 'hold' || mode === 'alt-hold') {
        if (!Number.isInteger(work) || work < 1) errs.push(`${name}.spec.work (mode=${mode}) 必须 ≥1 秒`);
    }
    if ((mode === 'alt-reps' || mode === 'alt-hold') && spec.isAlt !== true) {
        errs.push(`${name}.spec.isAlt (mode=${mode}) 必须为 true`);
    }
    if (repRest != null && (!Number.isInteger(repRest) || repRest < 0 || repRest > 30)) {
        errs.push(`${name}.spec.repRest 必须 0..30`);
    }
    if (actionRest != null && (!Number.isInteger(actionRest) || actionRest < 0 || actionRest > 90)) {
        errs.push(`${name}.spec.actionRest 必须 0..90`);
    }
    return errs;
}

function isLowLevelRehabAction(item = {}, planType = '') {
    if (planType !== 'rehab') return false;
    const text = `${item.name || ''} ${item.category || ''} ${item.phase || ''} ${item.section || ''}`.toLowerCase();
    return Number(item.currentLevel || 0) <= 1
        || normalizeAiCategory(item.category || item.phase || item.section) !== 'main'
        || /踝泵|股四头肌|等长|激活|活动度|低阶|初级|mobility|activation|isometric/.test(text);
}

function phaseIntensityCaps(category = 'main') {
    if (category === 'warmup') {
        return { sets: 2, reps: 12, work: 30, repRest: 5, actionRest: 30 };
    }
    if (category === 'cooldown') {
        return { sets: 2, reps: 8, work: 45, repRest: 0, actionRest: 30 };
    }
    return null;
}

function coerceAiSpec(item = {}, options = {}) {
    const spec = item.spec && typeof item.spec === 'object' ? { ...item.spec } : {};
    const category = normalizeAiCategory(item.category || item.phase || item.section);
    const timed = isTimedAiAction(item);
    const lowLevelRehab = isLowLevelRehabAction(item, options.planType || item.planType || '');
    const caps = phaseIntensityCaps(category);
    const autoFilled = [];
    const isAlt = parseBoolean(spec.isAlt ?? item.isAlt ?? item.alternating ?? item.bilateral ?? item.sideMode);

    let sets = readPositiveInteger(spec.sets ?? item.sets, 0);
    if (sets < 1) { sets = 3; autoFilled.push('sets'); }
    if (caps && sets > caps.sets) { sets = caps.sets; autoFilled.push('phaseCap.sets'); }

    let reps = readPositiveNumber(spec.reps ?? item.reps ?? item.count ?? item.times ?? item.perSet, 0);
    let work = readCappedPositiveNumber(spec.work ?? item.work ?? item.seconds ?? item.duration, 0, 90);

    if (reps <= 0 && work <= 0) {
        if (timed) { work = 30; reps = 1; autoFilled.push('work', 'reps'); }
        else { reps = 12; work = 3; autoFilled.push('reps', 'work'); }
    } else if (reps > 0 && work <= 0) {
        work = 3; autoFilled.push('work');
    } else if (timed && reps <= 0) {
        reps = 1; autoFilled.push('reps');
    }
    if (caps && reps > caps.reps) { reps = caps.reps; autoFilled.push('phaseCap.reps'); }
    if (caps && work > caps.work) { work = caps.work; autoFilled.push('phaseCap.work'); }

    const mode = isAlt ? (timed ? 'alt-hold' : 'alt-reps') : (timed ? 'hold' : 'reps');

    const repRestDefault = lowLevelRehab ? 0 : (timed ? 10 : 15);
    const actionRestDefault = lowLevelRehab ? 20 : (timed ? 30 : 45);
    let repRest = readCappedPositiveNumber(spec.repRest ?? item.repRest ?? item.restBetweenReps, repRestDefault, 30);
    if (spec.repRest === undefined && item.repRest === undefined && item.restBetweenReps === undefined) {
        autoFilled.push('repRest');
    }
    if (caps && repRest > caps.repRest) { repRest = caps.repRest; autoFilled.push('phaseCap.repRest'); }
    let actionRest = readCappedPositiveNumber(spec.actionRest ?? item.actionRest ?? item.restBetweenSets ?? item.groupRest, actionRestDefault, lowLevelRehab ? 45 : 75);
    if (spec.actionRest === undefined && item.actionRest === undefined && item.restBetweenSets === undefined && item.groupRest === undefined) {
        autoFilled.push('actionRest');
    }
    if (caps && actionRest > caps.actionRest) { actionRest = caps.actionRest; autoFilled.push('phaseCap.actionRest'); }

    return {
        spec: { sets, reps, work, repRest, actionRest, isAlt, mode },
        autoFilled,
        warnings: autoFilled.length ? [`${item.name || '未命名动作'} 以下字段由默认值补全: ${autoFilled.join(', ')}`] : []
    };
}

function parsePlanAiJson(rawText = '', options = {}) {
    const text = String(rawText || '').trim();
    let value = safeJsonParse(text);
    if (value) return { value, source: 'direct' };
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1] && (value = safeJsonParse(fenced[1].trim()))) return { value, source: 'fenced' };
    const start = text.search(/[\[{]/);
    const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
    value = start >= 0 && end > start ? safeJsonParse(text.slice(start, end + 1)) : null;
    if (value) return { value, source: 'sliced' };
    const repairJson = typeof options.repairJson === 'function' ? options.repairJson : null;
    value = repairJson ? repairJson(text) : null;
    return { value, source: value ? 'repair' : 'none' };
}

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const normalizeAiKey = (key = '') => String(key || '').trim().replace(/[\s_-]+/g, '').toLowerCase();
const AI_ITEM_KEYS = ['items', 'exercises', 'exercise', 'actions', 'tasks', 'movements', 'drills', 'stretches', 'stretching', 'activities', 'list', 'mainExercises', 'warmupExercises', 'cooldownExercises'];
const AI_ITEM_KEY_SET = new Set(AI_ITEM_KEYS.map(normalizeAiKey));
const AI_INSTRUCTION_ARRAY_KEYS = new Set(['steps', 'step', 'instructions', 'instruction', 'cues', 'tips'].map(normalizeAiKey));
const PLAN_AI_SECTION_KEYS = new Set(['sections', 'phases', 'blocks', 'parts', 'groups', 'segments', 'schedule', 'program', 'routine', 'session', 'plan', 'dayplan', 'dailyplan', 'trainingplan', 'workoutplan', 'rehabplan', 'exerciseplan', 'movementplan', 'actionplan', 'workout', 'workouts', 'training']);
const isPlanAiInstructionArrayKey = (key = '') => AI_INSTRUCTION_ARRAY_KEYS.has(normalizeAiKey(key));
const isPlanAiItemArrayKey = (key = '') => {
    const text = normalizeAiKey(key);
    return AI_ITEM_KEY_SET.has(text) || /(?:items|exercises?|actions?|tasks?|movements?|drills?|stretches?|stretching|activities|list)$/.test(text);
};
const isPlanAiSectionContainerKey = (key = '') => {
    const text = normalizeAiKey(key);
    return PLAN_AI_SECTION_KEYS.has(text) || /(?:sections?|phases?|blocks?|parts?|groups?|segments?|schedule|program|routine|session|plan)$/.test(text);
};
const aiCategoryFromLabel = (value = '') => {
    const text = normalizeAiKey(value);
    return /warm|prep|activation|mobility|热身|准备|激活|活动度|动态活动/.test(text) ? 'warmup'
        : /cool|stretch|relax|recovery|breath|拉伸|放松|冷身|收操|恢复|呼吸/.test(text) ? 'cooldown'
            : /main|workout|training|strength|主训|主训练|主体|训练动作|处方动作/.test(text) ? 'main' : '';
};

function firstStringValue(source = {}, keys = ['name', 'title', 'label', 'actionName', 'exerciseName', 'movement', 'exercise', 'action', 'task', 'drill']) {
    for (const key of keys) {
        const value = source?.[key];
        if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
        if (isPlainObject(value)) {
            const nested = firstStringValue(value, ['name', 'title', 'label', 'actionName', 'exerciseName']);
            if (nested) return nested;
        }
    }
    return '';
}

function normalizePlanAiRawItem(rawItem, categoryHint = '') {
    if (typeof rawItem === 'string') {
        const name = rawItem.trim();
        return name ? { name, category: normalizeAiCategory(categoryHint || 'main') } : null;
    }
    if (!isPlainObject(rawItem)) return null;
    const nestedKey = ['exercise', 'action', 'movement', 'task', 'drill'].find((key) => isPlainObject(rawItem[key]));
    const item = nestedKey ? { ...rawItem[nestedKey], ...rawItem } : rawItem;
    const name = firstStringValue(item);
    if (!name) return null;
    const spec = isPlainObject(item.spec) ? item.spec : (isPlainObject(item.prescription) ? item.prescription : (isPlainObject(item.dosage) ? item.dosage : {}));
    const explicitCategory = aiCategoryFromLabel(item.category || item.phase || item.section || item.type || '') || item.category || item.phase || item.section || item.type || '';
    return { ...item, name, category: normalizeAiCategory(explicitCategory || categoryHint || 'main'), spec };
}

function arrayLooksLikePlanAiItems(list = []) {
    return (Array.isArray(list) ? list : []).some((entry) => {
        if (typeof entry === 'string') return !!entry.trim();
        if (!isPlainObject(entry)) return false;
        if (normalizePlanAiRawItem(entry)) return true;
        return Object.entries(entry).some(([key, value]) => Array.isArray(value) && !isPlanAiInstructionArrayKey(key) && isPlanAiItemArrayKey(key));
    });
}

function collectPlanAiRawItems(plan = {}) {
    const items = [];
    const pushItem = (entry, categoryHint = '') => {
        const item = normalizePlanAiRawItem(entry, categoryHint);
        if (item) items.push(item);
    };
    const containerCategory = (key, fallback = '') => aiCategoryFromLabel(key) || fallback;
    const shouldReadArrayContainer = (key, value, parentHasOwnItem = false) => {
        if (isPlanAiInstructionArrayKey(key)) return !parentHasOwnItem && arrayLooksLikePlanAiItems(value);
        return isPlanAiItemArrayKey(key) || isPlanAiSectionContainerKey(key) || !!aiCategoryFromLabel(key);
    };
    const shouldReadObjectContainer = (key) => isPlanAiSectionContainerKey(key) || !!aiCategoryFromLabel(key);
    const collectFromContainer = (value, categoryHint = '') => {
        if (Array.isArray(value)) {
            eachItem(value, categoryHint);
            return;
        }
        if (!isPlainObject(value)) {
            pushItem(value, categoryHint);
            return;
        }
        let consumed = false;
        Object.entries(value).forEach(([key, child]) => {
            const nextCategory = containerCategory(key, categoryHint);
            if (Array.isArray(child) && shouldReadArrayContainer(key, child)) {
                eachItem(child, nextCategory);
                consumed = true;
            } else if (isPlainObject(child) && shouldReadObjectContainer(key)) {
                collectFromContainer(child, nextCategory);
                consumed = true;
            }
        });
        if (!consumed) pushItem(value, categoryHint);
    };
    const eachItem = (list, categoryHint = '') => (Array.isArray(list) ? list : []).forEach((entry) => {
        if (!isPlainObject(entry)) {
            pushItem(entry, categoryHint);
            return;
        }
        const sectionCategory = aiCategoryFromLabel(entry.category || entry.phase || entry.section || entry.title || entry.name) || categoryHint;
        const ownItem = normalizePlanAiRawItem(entry, sectionCategory);
        const nestedEntries = Object.entries(entry).filter(([key, value]) => {
            if (Array.isArray(value)) return shouldReadArrayContainer(key, value, !!ownItem);
            if (isPlainObject(value)) return shouldReadObjectContainer(key);
            return false;
        });
        nestedEntries.length
            ? nestedEntries.forEach(([key, value]) => collectFromContainer(value, containerCategory(key, sectionCategory)))
            : pushItem(entry, sectionCategory);
    });
    if (Array.isArray(plan)) eachItem(plan, 'main');
    else if (isPlainObject(plan)) Object.entries(plan).forEach(([key, value]) => {
        const keyCategory = aiCategoryFromLabel(key) || (isPlanAiItemArrayKey(key) ? 'main' : '');
        if (Array.isArray(value) && shouldReadArrayContainer(key, value)) eachItem(value, keyCategory);
        else if (isPlainObject(value) && shouldReadObjectContainer(key)) collectFromContainer(value, keyCategory);
    });
    if (!items.length) pushItem(plan, 'main');
    return items;
}

function collectPlanAiDirectArrayItems(plan = {}) {
    if (!isPlainObject(plan)) return [];
    const items = [];
    Object.entries(plan).forEach(([key, value]) => {
        const keyCategory = aiCategoryFromLabel(key) || (isPlanAiItemArrayKey(key) ? 'main' : '');
        if (!keyCategory || !Array.isArray(value)) return;
        value.forEach((entry) => {
            const item = normalizePlanAiRawItem(entry, keyCategory);
            if (item) items.push(item);
        });
    });
    return items;
}

function extractPlanAiPlanCandidates(parsed) {
    if (Array.isArray(parsed)) return [{ sections: parsed }];
    if (!isPlainObject(parsed)) return [];
    for (const [key, value] of Object.entries(parsed)) {
        if (/^(plans|dailyplans|days|schedule|week|weeklyplan|weeklyplans|planlist)$/.test(normalizeAiKey(key)) && Array.isArray(value)) return value;
    }
    for (const [key, value] of Object.entries(parsed)) {
        if (/^(plan|dailyplan|trainingplan|workoutplan|rehabplan|program|routine|session|result|data|payload)$/.test(normalizeAiKey(key)) && isPlainObject(value)) return extractPlanAiPlanCandidates(value);
    }
    return [parsed];
}

const normalizePlanAiPlanCandidate = (plan) => Array.isArray(plan) ? { sections: plan } : (isPlainObject(plan) ? plan : {});
const planAiPlanType = (plan = {}, allowedTypes = [], index = 0) => {
    const type = String(plan.type || plan.planType || plan.goal || '').trim().toLowerCase();
    return PLAN_AI_TYPES.includes(type) ? type : (allowedTypes[index] || allowedTypes[0] || 'rehab');
};
const planAiNotes = (plan = {}) => ['notes', 'note', 'overview', 'intro', 'description', 'summary', 'safety', 'advice']
    .map((key) => typeof plan[key] === 'string' ? plan[key].trim() : '')
    .filter(Boolean)
    .join('；');

function normalizePlanTypes(input) {
    const list = Array.isArray(input) ? input : [input];
    const normalized = list.map((item) => String(item || '').trim()).filter((item) => PLAN_AI_TYPES.includes(item));
    return normalized.length ? [...new Set(normalized)] : ['rehab'];
}

function resolvePayloadOptions(options = {}) {
    return {
        allowedTypes: normalizePlanTypes(options.types || 'rehab'),
        today: String(options.today || ''),
        titleForType: typeof options.titleForType === 'function' ? options.titleForType : () => '训练计划',
        actionMetaForText: typeof options.actionMetaForText === 'function' ? options.actionMetaForText : () => ({}),
        resolveActionChoice: typeof options.resolveActionChoice === 'function' ? options.resolveActionChoice : () => null,
        repairJson: typeof options.repairJson === 'function' ? options.repairJson : null
    };
}

function parsePlanAiPayload(rawText = '', options = {}) {
    const resolved = resolvePayloadOptions(options);
    const parsedResult = parsePlanAiJson(rawText, { repairJson: resolved.repairJson });
    const parsed = parsedResult.value;
    const baseMeta = { parseSource: parsedResult.source };
    if (!parsed || typeof parsed !== 'object') {
        return {
            ok: false,
            reason: 'AI 返回不是有效 JSON',
            rawText,
            meta: { ...baseMeta, reason: 'invalid-json' }
        };
    }
    const rawPlans = extractPlanAiPlanCandidates(parsed);
    const validPlans = rawPlans.map((rawPlan, index) => {
        const plan = normalizePlanAiPlanCandidate(rawPlan);
        const planType = planAiPlanType(plan, resolved.allowedTypes, index);
        const collectedItems = collectPlanAiRawItems(plan);
        const directItems = collectPlanAiDirectArrayItems(plan);
        const rawItems = directItems.length > collectedItems.length ? directItems : collectedItems;
        const items = rawItems.map((item) => {
            const name = String(item.name || '');
            if (!name) return null;
            const category = normalizeAiCategory(item.category || item.phase || item.section);
            const progressionAllowed = category === 'main';
            const meta = resolved.actionMetaForText(`${name} ${item.aiReasoning || item.reason || item.note || ''}`, { name, item, planType }) || {};
            const choice = resolved.resolveActionChoice({
                name,
                item,
                preferredChoiceId: item.choiceId || item.prescriptionActionId || '',
                planType
            }) || null;
            const coerced = coerceAiSpec({ ...item, category }, { planType });
            return {
                name,
                category,
                actionKey: item.actionKey || choice?.actionKey || meta.actionKey || '',
                canonicalName: item.canonicalName || choice?.canonicalName || meta.canonicalName || name,
                progressionGroup: item.progressionGroup || choice?.progressionGroup || meta.progressionGroup || '',
                progressionLevel: Number(item.progressionLevel ?? choice?.progressionLevel ?? meta.progressionLevel ?? 0),
                chainId: progressionAllowed ? String(item.chainId || item.chainHint || choice?.chainId || meta.chainId || '') : '',
                currentLevel: progressionAllowed && item.currentLevel != null ? Number(item.currentLevel) : null,
                spec: coerced.spec,
                cooldownRefs: Array.isArray(item.cooldownRefs) ? item.cooldownRefs.map((value) => String(value || '')) : [],
                aiReasoning: String(item.aiReasoning || item.reason || item.rationale || item.note || ''),
                durationEstHint: String(item.durationEstHint || item.durationHint || item.estimatedDuration || ''),
                requiresUserConfirm: !!(item.requiresUserConfirm || item.requiresConfirmation || item.needsReview),
                userConfirmed: item.userConfirmed === true,
                policy: item.policy && typeof item.policy === 'object' ? item.policy : null,
                status: 'todo',
                doneSets: 0,
                userOverride: false,
                excludeFromPr: true,
                sourceActionId: choice?.sourceActionId || item.sourceActionId || '',
                prescriptionActionId: choice?.prescriptionActionId || item.prescriptionActionId || '',
                ...(choice ? { policy: { ...(item.policy && typeof item.policy === 'object' ? item.policy : {}), source: choice.source || 'prescription', choiceLabel: choice.sourceLabel || '', prescriptionName: choice.source === 'prescription' ? choice.name : '' } } : {}),
                autoFilled: coerced.autoFilled.length ? coerced.autoFilled : undefined
            };
        }).filter(Boolean);
        return {
            date: String(plan.date || plan.day || plan.dayKey || plan.targetDate || resolved.today),
            type: planType,
            title: String(plan.title || plan.name || resolved.titleForType(planType) || '训练计划'),
            notes: planAiNotes(plan),
            source: 'ai',
            items
        };
    }).filter((plan) => plan.items.length > 0);
    if (!validPlans.length) {
        return {
            ok: false,
            reason: 'JSON 缺少可用 items',
            rawText,
            meta: {
                ...baseMeta,
                reason: 'no-usable-items'
            }
        };
    }
    const warnings = validPlans.flatMap((plan) => plan.items).flatMap((item) => item.autoFilled?.length ? [`${item.name} 字段已自动补全: ${item.autoFilled.join(', ')}`] : []);
    return {
        ok: true,
        plans: validPlans,
        warnings,
        meta: {
            ...baseMeta,
            warningCount: warnings.length
        }
    };
}

function validatePlanAiPayload(rawText = '', options = {}) {
    const resolved = resolvePayloadOptions(options);
    const parsedResult = parsePlanAiJson(rawText, { repairJson: resolved.repairJson });
    const parsed = parsedResult.value;
    const baseMeta = { parseSource: parsedResult.source };
    if (!parsed || typeof parsed !== 'object') {
        return {
            ok: false,
            errors: ['AI 返回不是有效 JSON'],
            meta: { ...baseMeta, reason: 'invalid-json' }
        };
    }
    const plans = extractPlanAiPlanCandidates(parsed);
    const allErrors = [];
    if (!plans.length) allErrors.push('JSON 缺少 plans/items');
    plans.forEach((rawPlan, index) => {
        const plan = normalizePlanAiPlanCandidate(rawPlan);
        const planType = planAiPlanType(plan, resolved.allowedTypes, index);
        const items = collectPlanAiRawItems(plan);
        if (!items.length) {
            allErrors.push(`第 ${index + 1} 个计划缺少可用动作 items/main/warmup/cooldown`);
            return;
        }
        items.forEach((item) => {
            const name = String(item.name || '');
            if (!name) return;
            const category = normalizeAiCategory(item.category || item.phase || item.section);
            const coerced = coerceAiSpec({ ...item, category }, { planType });
            const mode = inferSpecMode(coerced.spec, item);
            const itemErrors = validateAiSpec({ ...coerced.spec, mode }, name);
            if (itemErrors.length) allErrors.push(...itemErrors);
        });
    });
    return {
        ok: allErrors.length === 0,
        errors: allErrors,
        meta: {
            ...baseMeta,
            errorCount: allErrors.length
        }
    };
}

const planAiPure = {
    VALID_MODES,
    safeJsonParse,
    readNumber,
    parseBoolean,
    inferSpecMode,
    validateAiSpec,
    isTimedAiAction,
    phaseIntensityCaps,
    coerceAiSpec,
    normalizeAiCategory,
    normalizePlanTypes,
    parsePlanAiJson,
    parsePlanAiPayload,
    validatePlanAiPayload
};

if (typeof window !== 'undefined') {
    window.planAiPure = window.planAiPure || planAiPure;
}
})();
