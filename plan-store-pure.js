export const PLAN_PREF_DEFAULTS = {
    stage: 'unset',
    customStageLabel: '',
    equipment: [],
    customEquipment: [],
    cooldownMode: 'attached',
    askOnEdit: 'always',
    askBeforeProgression: true,
    showCooldownDock: true,
    showWeeklyDock: true
};

export const PLAN_TYPES = ['rehab', 'cut', 'bulk', 'maintenance', 'custom'];

export function planTypeMeta(type = 'rehab', title = '') {
    const key = PLAN_TYPES.includes(type) ? type : 'rehab';
    const map = {
        rehab: { label: '康复计划', taskLabel: '康复任务', cooldownLabel: '放松', icon: 'self_improvement' },
        cut: { label: '减脂日程', taskLabel: '减脂任务', cooldownLabel: '拉伸', icon: 'local_fire_department' },
        bulk: { label: '增肌日程', taskLabel: '增肌任务', cooldownLabel: '整理组', icon: 'fitness_center' },
        maintenance: { label: '综合训练', taskLabel: '训练任务', cooldownLabel: '放松', icon: 'health_and_safety' },
        custom: { label: title || '自定义计划', taskLabel: '任务', cooldownLabel: '放松', icon: 'event_note' }
    };
    return map[key];
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function uniqueList(values = []) {
    return [...new Set((Array.isArray(values) ? values : []).map((item) => String(item || '').trim()).filter(Boolean))];
}

function normalizeTaskCategory(value = 'main') {
    const raw = String(value || '').trim().toLowerCase();
    if (['warmup', 'warm-up', '热身'].includes(raw)) return 'warmup';
    if (['cooldown', 'cool-down', 'stretch', 'stretching', '拉伸', '放松'].includes(raw)) return 'cooldown';
    return 'main';
}

function normalizeCustomEquipment(values = []) {
    const normalized = (Array.isArray(values) ? values : [])
        .map((item) => {
            if (typeof item === 'string') {
                const label = item.trim();
                return label ? { id: `custom_${label}`, label, icon: 'inventory_2' } : null;
            }
            if (!item || typeof item !== 'object') return null;
            const label = String(item.label || item.name || '').trim();
            if (!label) return null;
            const id = String(item.id || `custom_${label}`).trim();
            return {
                id,
                label,
                icon: String(item.icon || 'inventory_2').trim() || 'inventory_2'
            };
        })
        .filter((item) => item !== null);
    return normalized.filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index);
}

function fieldMeta(record) {
    return record && typeof record.__fieldUpdatedAt === 'object' ? record.__fieldUpdatedAt : {};
}

function touchRecord(record, changedFields = [], nowTs = Date.now()) {
    const next = record && typeof record === 'object' ? record : {};
    next.updatedAt = Number(nowTs || Date.now());
    next.deleted = !!next.deleted;
    if (Array.isArray(changedFields) && changedFields.length) {
        next.__fieldUpdatedAt = { ...fieldMeta(next) };
        const iso = new Date(next.updatedAt).toISOString();
        changedFields.forEach((field) => {
            next.__fieldUpdatedAt[field] = iso;
        });
    }
    return next;
}

export function normalizePlanPrefs(raw = {}) {
    const stage = ['unset', 'post_op', 'post_op_4w', 'post_op_8w', 'cutting', 'bulking', 'maintenance', 'chronic', 'custom'].includes(raw?.stage)
        ? raw.stage
        : 'unset';
    return {
        ...PLAN_PREF_DEFAULTS,
        ...(raw && typeof raw === 'object' ? raw : {}),
        stage,
        customStageLabel: String(raw?.customStageLabel || ''),
        equipment: uniqueList(raw?.equipment),
        customEquipment: normalizeCustomEquipment(raw?.customEquipment)
    };
}

export function migratePlanPrefs(db = {}) {
    const next = clone(db || {});
    next.prefs = next.prefs && typeof next.prefs === 'object' ? next.prefs : {};
    if (!next.prefs.plan && next.prefs.rehab) {
        next.prefs.plan = normalizePlanPrefs(next.prefs.rehab);
        delete next.prefs.rehab;
    } else {
        next.prefs.plan = normalizePlanPrefs(next.prefs.plan || {});
        delete next.prefs.rehab;
    }
    return next;
}

export function normalizeTaskItem(item = {}, options = {}) {
    const nowTs = Number(options.nowTs || Date.now());
    const idFactory = typeof options.idFactory === 'function' ? options.idFactory : (prefix) => `${prefix}-${nowTs}`;
    const spec = item?.spec && typeof item.spec === 'object' ? item.spec : {};
    let reps = Math.max(0, Number(spec.reps || 0));
    const work = Math.max(0, Number(spec.work || 0));
    if (reps <= 0 && work > 0) reps = 1;
    const invalidSpec = !item.deleted && (reps <= 0 && work <= 0);

    const isNew = !item.id;
    const originalSpecRaw = item?.originalSpec && typeof item.originalSpec === 'object' ? item.originalSpec : null;
    const originalSpec = originalSpecRaw || {
        sets: Math.max(1, Number(spec.sets || 1)),
        reps,
        work,
        repRest: Math.max(0, Number(spec.repRest || 0)),
        actionRest: Math.max(0, Number(spec.actionRest || 0)),
        isAlt: !!spec.isAlt,
        ...(spec.mode ? { mode: String(spec.mode) } : {}),
        ...(spec.weight != null ? { weight: Number(spec.weight || 0) } : {})
    };
    const specSource = ['initial', 'migrated'].includes(item.specSource) ? item.specSource : (originalSpecRaw ? 'initial' : (isNew ? 'initial' : 'migrated'));
    const progressionPhase = ['baseline', 'volume-up', 'ready-to-progress', 'progressed', 'deload'].includes(item.progressionPhase) ? item.progressionPhase : 'baseline';
    const progressionHistory = Array.isArray(item.progressionHistory) ? item.progressionHistory : [];

    return touchRecord({
        id: item.id || idFactory('plan-task'),
        name: String(item.name || '未命名任务'),
        planType: PLAN_TYPES.includes(item.planType) ? item.planType : (PLAN_TYPES.includes(options.planType) ? options.planType : 'rehab'),
        category: normalizeTaskCategory(item.category || item.phase),
        spec: {
            sets: Math.max(1, Number(spec.sets || 1)),
            reps,
            work,
            repRest: Math.max(0, Number(spec.repRest || 0)),
            actionRest: Math.max(0, Number(spec.actionRest || 0)),
            isAlt: !!spec.isAlt,
            ...(spec.mode ? { mode: String(spec.mode) } : {}),
            ...(spec.weight != null ? { weight: Number(spec.weight || 0) } : {})
        },
        originalSpec,
        specSource,
        progressionPhase,
        progressionHistory,
        nextProgressionSuggestion: item.nextProgressionSuggestion && typeof item.nextProgressionSuggestion === 'object'
            ? { ...item.nextProgressionSuggestion }
            : null,
        chainId: item.chainId ? String(item.chainId) : '',
        invalidSpec,
        currentLevel: item.currentLevel == null ? null : Math.max(1, Number(item.currentLevel || 1)),
        status: ['todo', 'in-progress', 'done', 'skipped'].includes(item.status) ? item.status : 'todo',
        doneSets: Math.max(0, Number(item.doneSets || 0)),
        feedback: item.feedback && typeof item.feedback === 'object'
            ? {
                rpe: [1, 2, 3, 4, 5].includes(Number(item.feedback.rpe)) ? Number(item.feedback.rpe) : null,
                note: String(item.feedback.note || ''),
                doneAt: Number(item.feedback.doneAt || 0)
            }
            : null,
        cooldownRefs: uniqueList(item.cooldownRefs),
        userOverride: !!item.userOverride,
        sourceActionId: item.sourceActionId || '',
        prescriptionActionId: item.prescriptionActionId || '',
        excludeFromPr: item.excludeFromPr !== false,
        aiReasoning: String(item.aiReasoning || ''),
        durationEstHint: String(item.durationEstHint || ''),
        updatedAt: Number(item.updatedAt || nowTs),
        deleted: !!item.deleted,
        __fieldUpdatedAt: fieldMeta(item)
    }, [], nowTs);
}

export function normalizeDailyPlan(plan = {}, options = {}) {
    const nowTs = Number(options.nowTs || Date.now());
    const idFactory = typeof options.idFactory === 'function' ? options.idFactory : (prefix) => `${prefix}-${nowTs}`;
    const legacySource = plan.source === 'rehab-center';
    const type = PLAN_TYPES.includes(plan.type) ? plan.type : 'rehab';
    const title = String(plan.title || planTypeMeta(type).label);
    const items = (Array.isArray(plan.items) ? plan.items : []).map((item) => normalizeTaskItem({ ...item, planType: item.planType || type }, { nowTs, idFactory, planType: type }));
    const pending = uniqueList(plan.pendingCooldowns).filter((id) => items.some((item) => item.id === id));
    return touchRecord({
        id: plan.id || idFactory('daily-plan'),
        date: String(plan.date || ''),
        type,
        title,
        source: legacySource ? 'manual' : String(plan.source || 'manual'),
        notes: String(plan.notes || ''),
        items,
        pendingCooldowns: pending,
        createdAt: Number(plan.createdAt || nowTs),
        updatedAt: Number(plan.updatedAt || nowTs),
        deleted: !!plan.deleted,
        __fieldUpdatedAt: fieldMeta(plan)
    }, [], nowTs);
}

export function normalizeProgressionChain(chain = {}, options = {}) {
    const nowTs = Number(options.nowTs || Date.now());
    const idFactory = typeof options.idFactory === 'function' ? options.idFactory : (prefix) => `${prefix}-${nowTs}`;
    const levels = (Array.isArray(chain.levels) ? chain.levels : []).map((level, index) => ({
        lv: Math.max(1, Number(level?.lv || index + 1)),
        name: String(level?.name || `Lv${index + 1}`),
        requiredEquipment: uniqueList(level?.requiredEquipment),
        hint: String(level?.hint || '')
    }));
    return touchRecord({
        id: chain.id || idFactory('plan-chain'),
        group: String(chain.group || '未分组'),
        applicableTypes: uniqueList(chain.applicableTypes).filter((type) => PLAN_TYPES.includes(type)),
        levels,
        updatedAt: Number(chain.updatedAt || nowTs),
        deleted: !!chain.deleted,
        __fieldUpdatedAt: fieldMeta(chain)
    }, [], nowTs);
}

export function createDailyPlanRecord(input = {}, options = {}) {
    const nowTs = Number(options.nowTs || Date.now());
    const idFactory = typeof options.idFactory === 'function' ? options.idFactory : (prefix) => `${prefix}-${nowTs}`;
    return normalizeDailyPlan({
        source: 'manual',
        notes: '',
        items: [],
        pendingCooldowns: [],
        ...clone(input),
        createdAt: Number(input.createdAt || nowTs),
        updatedAt: Number(input.updatedAt || nowTs)
    }, { nowTs, idFactory });
}

export function getPlanByDate(plans = [], date = '') {
    return (Array.isArray(plans) ? plans : []).find((plan) => !plan?.deleted && String(plan?.date || '') === String(date || '')) || null;
}

export function getPlansByDate(plans = [], date = '') {
    return (Array.isArray(plans) ? plans : [])
        .filter((plan) => !plan?.deleted && String(plan?.date || '') === String(date || ''))
        .map((plan) => normalizeDailyPlan(plan));
}

export function upsertDailyPlan(plans = [], plan = {}, options = {}) {
    const nextPlan = normalizeDailyPlan(plan, options);
    const list = Array.isArray(plans) ? plans.map((item) => clone(item)) : [];
    const index = list.findIndex((item) => item?.id === nextPlan.id || (!item?.deleted && item?.date === nextPlan.date && (item.type || 'rehab') === nextPlan.type));
    if (index >= 0) list[index] = nextPlan;
    else list.unshift(nextPlan);
    return list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

export function updateTaskItem(plans = [], planId, taskId, updater, options = {}) {
    const nowTs = Number(options.nowTs || Date.now());
    const changed = [];
    const list = (Array.isArray(plans) ? plans : []).map((plan) => {
        if (!plan || plan.deleted || plan.id !== planId) return clone(plan);
        const nextPlan = clone(plan);
        nextPlan.items = (Array.isArray(plan.items) ? plan.items : []).map((item) => {
            if (!item || item.deleted || item.id !== taskId) return clone(item);
            const before = clone(item);
            const after = normalizeTaskItem(updater(clone(item)) || item, { nowTs, idFactory: options.idFactory });
            changed.push({ before, after });
            return after;
        });
        if (changed.length) touchRecord(nextPlan, ['items', 'pendingCooldowns'], nowTs);
        return nextPlan;
    });
    return { plans: list, changed: changed[0] || null };
}

export function updateItemStatus(plans = [], planId, taskId, status, extra = {}, options = {}) {
    return updateTaskItem(plans, planId, taskId, (item) => ({
        ...item,
        ...extra,
        status,
        doneSets: status === 'done'
            ? Math.max(Number(item.doneSets || 0), Number(extra.doneSets || item.spec?.sets || 1))
            : Number((extra.doneSets ?? item.doneSets) || 0)
    }), options);
}

export function addFeedback(plans = [], planId, taskId, feedback = {}, options = {}) {
    const nowTs = Number(options.nowTs || Date.now());
    return updateTaskItem(plans, planId, taskId, (item) => ({
        ...item,
        feedback: {
            rpe: [1, 2, 3, 4, 5].includes(Number(feedback.rpe)) ? Number(feedback.rpe) : null,
            note: String(feedback.note || ''),
            doneAt: Number(feedback.doneAt || nowTs)
        }
    }), options);
}

export function lockItem(plans = [], planId, taskId, locked = true, options = {}) {
    return updateTaskItem(plans, planId, taskId, (item) => ({
        ...item,
        userOverride: !!locked
    }), options);
}

export function softDeletePlan(plans = [], planId, options = {}) {
    const nowTs = Number(options.nowTs || Date.now());
    return (Array.isArray(plans) ? plans : []).map((plan) => {
        const next = clone(plan);
        if (next?.id === planId) {
            next.deleted = true;
            touchRecord(next, ['deleted'], nowTs);
        }
        return next;
    });
}

export function cancelDailyPlan(plans = [], planId, options = {}) {
    const nowTs = Number(options.nowTs || Date.now());
    return (Array.isArray(plans) ? plans : []).map((plan) => {
        const next = clone(plan);
        if (next?.id === planId && !next.deleted) {
            next.deleted = true;
            next.pendingCooldowns = [];
            touchRecord(next, ['deleted', 'pendingCooldowns'], nowTs);
        }
        return next;
    });
}

export function completionRate(plan = {}) {
    const items = (Array.isArray(plan.items) ? plan.items : []).filter((item) => item && !item.deleted && item.category !== 'cooldown');
    if (!items.length) return { done: 0, total: 0, rate: 0 };
    const done = items.filter((item) => item.status === 'done').length;
    return {
        done,
        total: items.length,
        rate: done / items.length
    };
}

export function aggregateCompletionRate(plans = []) {
    const rates = (Array.isArray(plans) ? plans : []).map((plan) => completionRate(plan));
    const done = rates.reduce((sum, item) => sum + Number(item.done || 0), 0);
    const total = rates.reduce((sum, item) => sum + Number(item.total || 0), 0);
    return { done, total, rate: total ? done / total : 0 };
}
