export const REHAB_PREF_DEFAULTS = {
    stage: 'unset',
    equipment: [],
    cooldownMode: 'attached',
    askOnEdit: 'always',
    askBeforeProgression: true,
    showCooldownDock: true,
    showWeeklyDock: true
};

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function uniqueList(values = []) {
    return [...new Set((Array.isArray(values) ? values : []).map((item) => String(item || '').trim()).filter(Boolean))];
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

export function normalizeRehabPrefs(raw = {}) {
    return {
        ...REHAB_PREF_DEFAULTS,
        ...(raw && typeof raw === 'object' ? raw : {}),
        equipment: uniqueList(raw?.equipment)
    };
}

export function normalizeTaskItem(item = {}, options = {}) {
    const nowTs = Number(options.nowTs || Date.now());
    const idFactory = typeof options.idFactory === 'function' ? options.idFactory : (prefix) => `${prefix}-${nowTs}`;
    const spec = item?.spec && typeof item.spec === 'object' ? item.spec : {};
    return touchRecord({
        id: item.id || idFactory('rehab-task'),
        name: String(item.name || '未命名任务'),
        category: item.category === 'cooldown' ? 'cooldown' : 'main',
        spec: {
            sets: Math.max(1, Number(spec.sets || 1)),
            reps: Math.max(0, Number(spec.reps || 0)),
            work: Math.max(0, Number(spec.work || 0)),
            repRest: Math.max(0, Number(spec.repRest || 0)),
            actionRest: Math.max(0, Number(spec.actionRest || 0)),
            isAlt: !!spec.isAlt,
            ...(spec.weight != null ? { weight: Number(spec.weight || 0) } : {})
        },
        chainId: item.chainId ? String(item.chainId) : '',
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
    const items = (Array.isArray(plan.items) ? plan.items : []).map((item) => normalizeTaskItem(item, { nowTs, idFactory }));
    const pending = uniqueList(plan.pendingCooldowns).filter((id) => items.some((item) => item.id === id));
    return touchRecord({
        id: plan.id || idFactory('rehab-plan'),
        date: String(plan.date || ''),
        source: ['ai', 'manual', 'rehab-center'].includes(plan.source) ? plan.source : 'manual',
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
        id: chain.id || idFactory('rehab-chain'),
        group: String(chain.group || '未分组'),
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

export function upsertDailyPlan(plans = [], plan = {}, options = {}) {
    const nextPlan = normalizeDailyPlan(plan, options);
    const list = Array.isArray(plans) ? plans.map((item) => clone(item)) : [];
    const index = list.findIndex((item) => item?.id === nextPlan.id || (!item?.deleted && item?.date === nextPlan.date));
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
