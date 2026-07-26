// @ts-check

function activeRecords(records) {
    return Array.isArray(records)
        ? records.filter((record) => record && !record.deleted && !record.deletedAt)
        : [];
}

function uniqueList(values = []) {
    return [
        ...new Set(
            (Array.isArray(values) ? values : [])
                .map((item) => String(item || '').trim())
                .filter(Boolean),
        ),
    ];
}

export function normalizePrescriptionActionName(value = '') {
    return String(value || '')
        .trim()
        .replace(/[\s·•、，。；;:：()（）【】\[\]{}"'_-]+/g, '')
        .toLowerCase();
}

// 处方 category 历史上是 AI 采集的自由文本。能识别的归一到动作性质枚举
// （action-taxonomy-pure.js），识别不了的保留原文：不丢信息，且重复归一化幂等。
function normalizeCategoryText(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const taxonomy = typeof window !== 'undefined' ? window['actionTaxonomy'] : null;
    return taxonomy?.normalizeActionNature?.(raw) || raw;
}

/**
 * bodyPartsSource 取值域：谁定的部位。本阶段只会产生 user / lexicon，ai 留给 AI 分类层。
 * 刻意不写成三元素字符串数组字面量：那种形状会被 scripts/collect-icons.mjs 的装备元组
 * 启发式（['id','标签','图标']）当成图标名收走，害得字体子集校验报 stale。
 */
const BODY_PARTS_SOURCES = new Set('user ai lexicon'.split(' '));

function normalizeBodyPartsSource(value = '') {
    const key = String(value || '').trim().toLowerCase();
    return BODY_PARTS_SOURCES.has(key) ? key : '';
}

function normalizeBodyPartList(value) {
    const taxonomy = typeof window !== 'undefined' ? window['actionTaxonomy'] : null;
    const normalize = taxonomy?.normalizeBodyParts;
    // taxonomy 未加载（无 window 的 Node 环境、boot 早期）：已有数组原样留着不丢信息，
    // 自由文本无从归一化则退化为空数组——静默降级，不抛错。
    if (typeof normalize !== 'function') return Array.isArray(value) ? uniqueList(value) : [];
    const list = normalize.call(taxonomy, value);
    return Array.isArray(list) ? list : [];
}

/**
 * 部位字段的派生规则（处方目录与普通动作库共用，保证两处语义一字不差）。
 *
 * 部位是多值维度：bodyPart 是用户/AI 写下的自由文本原文（「左膝内侧」一字不改地留着），
 * bodyParts 是归一化后的枚举键数组（['膝']），两者不互相改写。
 *  - 已有 bodyParts → 归一化后保留，bodyPartsSource 原样保留；
 *  - 只有 bodyPart 自由文本 → 派生 bodyParts，source 记为 user（用户/处方填的，优先级最高）；
 *  - 两者都无 → 空数组 + 空 source。
 * 本阶段刻意不从动作名自动推断——那是 AI 分类层与显式调用的职责，不把猜测写成数据。
 * 重复调用幂等：派生结果再次入参会走「已有 bodyParts」分支，结果完全一致。
 * @param {{bodyPart?: string, bodyParts?: unknown, bodyPartsSource?: string}} record
 * @returns {{bodyParts: string[], bodyPartsSource: string}}
 */
export function deriveBodyPartFields(record = {}) {
    const existing = Array.isArray(record.bodyParts) ? normalizeBodyPartList(record.bodyParts) : [];
    if (existing.length) {
        return { bodyParts: existing, bodyPartsSource: normalizeBodyPartsSource(record.bodyPartsSource) };
    }
    const bodyPart = String(record.bodyPart || '').trim();
    if (bodyPart) return { bodyParts: normalizeBodyPartList(bodyPart), bodyPartsSource: 'user' };
    return { bodyParts: [], bodyPartsSource: '' };
}

function hashText(value = '') {
    let hash = 2166136261;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

export function createPrescriptionActionId(name = '', nowTs = Date.now()) {
    const key = normalizePrescriptionActionName(name);
    return key
        ? `pa-${hashText(key)}`
        : `pa-${Math.round(Number(nowTs) || Date.now()).toString(36)}`;
}

function normalizeRelationIds(values = [], selfId = '') {
    return uniqueList(values).filter((id) => id && id !== selfId);
}

export function normalizePrescriptionAction(record = {}, options = {}) {
    const nowTs = Number(options.nowTs || Date.now());
    const displayName = String(record.displayName || record.name || '').trim();
    const id = String(record.id || createPrescriptionActionId(displayName, nowTs)).trim();
    const aliases = uniqueList([displayName, record.name, ...(record.aliases || [])]);
    return {
        id,
        displayName: displayName || aliases[0] || '未命名处方动作',
        aliases,
        sourceActionIds: uniqueList(record.sourceActionIds),
        linkedActionId: String(record.linkedActionId || '').trim(),
        regressionIds: normalizeRelationIds(record.regressionIds, id),
        progressionIds: normalizeRelationIds(record.progressionIds, id),
        category: normalizeCategoryText(record.category || record.actionCategory || record.type || ''),
        // bodyPart 是自由文本原文，bodyParts/bodyPartsSource 是它的归一化派生值，互不改写。
        bodyPart: String(record.bodyPart || '').trim(),
        ...deriveBodyPartFields(record),
        conditionId: String(record.conditionId || '').trim(),
        conditionLabel: String(record.conditionLabel || '').trim(),
        defaultSpec:
            record.defaultSpec && typeof record.defaultSpec === 'object'
                ? record.defaultSpec
                : null,
        latestStatus: String(record.latestStatus || '').trim(),
        latestPainLevel: Math.max(0, Number(record.latestPainLevel || 0)),
        progressionGroup: String(record.progressionGroup || '').trim(),
        progressionLevel: Number(record.progressionLevel || 0),
        notes: String(record.notes || '').trim(),
        createdAt: Number(record.createdAt || nowTs),
        updatedAt: Number(record.updatedAt || nowTs),
        deleted: !!record.deleted,
        __fieldUpdatedAt:
            record.__fieldUpdatedAt && typeof record.__fieldUpdatedAt === 'object'
                ? record.__fieldUpdatedAt
                : {},
    };
}

function chooseDisplayName(current = '', candidate = '') {
    const oldName = String(current || '').trim();
    const nextName = String(candidate || '').trim();
    if (!oldName) return nextName;
    return oldName;
}

function addAlias(record, name) {
    const text = String(name || '').trim();
    if (!text) return;
    record.aliases = uniqueList([...(record.aliases || []), text]);
}

function buildIndex(catalog = []) {
    const byId = new Map();
    const byName = new Map();
    activeRecords(catalog).forEach((item) => {
        const record = normalizePrescriptionAction(item);
        byId.set(record.id, record);
        [record.displayName, ...(record.aliases || [])].forEach((name) => {
            const key = normalizePrescriptionActionName(name);
            if (key && !byName.has(key)) byName.set(key, record.id);
        });
    });
    return { byId, byName };
}

function addRelation(records, fromId, toId, relation) {
    if (!fromId || !toId || fromId === toId) return;
    const from = records.get(fromId);
    const to = records.get(toId);
    if (!from || !to || from.deleted || to.deleted) return;
    if (relation === 'progression') {
        from.progressionIds = normalizeRelationIds([...(from.progressionIds || []), toId], fromId);
        to.regressionIds = normalizeRelationIds([...(to.regressionIds || []), fromId], toId);
    } else if (relation === 'regression') {
        from.regressionIds = normalizeRelationIds([...(from.regressionIds || []), toId], fromId);
        to.progressionIds = normalizeRelationIds([...(to.progressionIds || []), fromId], toId);
    }
}

function sortWeeks(weeks = []) {
    return activeRecords(weeks)
        .slice()
        .sort(
            (a, b) =>
                String(a.weekStart || a.visitDate || a.date || '').localeCompare(
                    String(b.weekStart || b.visitDate || b.date || ''),
                ) || Number(a.updatedAt || 0) - Number(b.updatedAt || 0),
        );
}

export function ensurePrescriptionActionCatalog(db = {}, options = {}) {
    const nowTs = Number(options.nowTs || Date.now());
    db.health = db.health || {};
    const existing = activeRecords(db.health.prescriptionActions || []).map((item) =>
        normalizePrescriptionAction(item, { nowTs }),
    );
    const { byId: records, byName } = buildIndex(existing);
    const rawActionToPrescription = new Map();
    const weeks = sortWeeks(db.health.rehabWeekly || []);

    const ensureRecord = (action = {}) => {
        const name = String(action.name || '').trim();
        if (!name) return null;
        const explicitId = String(
            action.prescriptionActionId || action.canonicalPrescriptionActionId || '',
        ).trim();
        const key = normalizePrescriptionActionName(name);
        let id = explicitId && records.has(explicitId) ? explicitId : key ? byName.get(key) : '';
        if (!id) {
            id = explicitId || createPrescriptionActionId(name, nowTs);
            records.set(
                id,
                normalizePrescriptionAction(
                    {
                        id,
                        displayName: name,
                        aliases: [name],
                        createdAt: nowTs,
                        updatedAt: nowTs,
                    },
                    { nowTs },
                ),
            );
        }
        const record = records.get(id);
        record.displayName = chooseDisplayName(record.displayName, name);
        addAlias(record, name);
        if (action.actionId)
            record.sourceActionIds = uniqueList([
                ...(record.sourceActionIds || []),
                action.actionId,
            ]);
        if (!record.category && (action.category || action.actionCategory || action.type))
            record.category = normalizeCategoryText(
                action.category || action.actionCategory || action.type || '',
            );
        if (!record.bodyPart && action.bodyPart)
            record.bodyPart = String(action.bodyPart || '').trim();
        // 只填空、不覆盖：处方动作已有部位数组就不动，否则用周处方动作上的数组、
        // 再退到本记录的 bodyPart 自由文本派生。识别不出时留空数组，重复 ensure 结果一致。
        if (!record.bodyParts?.length) {
            const derived = deriveBodyPartFields({
                bodyPart: record.bodyPart,
                bodyParts: action.bodyParts,
                bodyPartsSource: action.bodyPartsSource,
            });
            record.bodyParts = derived.bodyParts;
            record.bodyPartsSource = derived.bodyPartsSource;
        }
        if (!record.conditionId && action.conditionId)
            record.conditionId = String(action.conditionId || '').trim();
        if (!record.conditionLabel && action.conditionLabel)
            record.conditionLabel = String(action.conditionLabel || '').trim();
        if (!record.defaultSpec && action.spec && typeof action.spec === 'object')
            record.defaultSpec = action.spec;
        record.latestStatus = String(action.status || record.latestStatus || '').trim();
        record.latestPainLevel = Math.max(
            Number(record.latestPainLevel || 0),
            Number(action.painLevel || 0),
        );
        record.progressionGroup = String(
            action.progressionGroup || record.progressionGroup || '',
        ).trim();
        record.progressionLevel = Number(action.progressionLevel || record.progressionLevel || 0);
        // 进阶链知识目前硬编码在懒加载的 rehab-policy（window.planPolicy）词典里；
        // 这里趁 ensure 把它渐进落入可同步的处方目录数据：只填空、不覆盖、幂等。
        // boot 阶段 planPolicy 尚未加载则静默跳过，等 plan 功能加载后的下一次 ensure 自然回填。
        if (!record.progressionGroup) {
            const policy = typeof window !== 'undefined' ? window['planPolicy'] : null;
            const meta = policy?.actionMetaForName?.(record.displayName);
            const metaGroup = String(meta?.progressionGroup || '').trim();
            if (metaGroup) {
                record.progressionGroup = metaGroup;
                if (!Number(record.progressionLevel || 0)) {
                    record.progressionLevel = Number(meta.progressionLevel || 0);
                }
            }
        }
        record.updatedAt = Math.max(
            Number(record.updatedAt || 0),
            Number(action.updatedAt || nowTs),
            nowTs,
        );
        [record.displayName, ...(record.aliases || [])].forEach((alias) => {
            const aliasKey = normalizePrescriptionActionName(alias);
            if (aliasKey && !byName.has(aliasKey)) byName.set(aliasKey, id);
        });
        action.prescriptionActionId = id;
        delete action.canonicalPrescriptionActionId;
        if (action.actionId) rawActionToPrescription.set(String(action.actionId), id);
        return record;
    };

    weeks.forEach((week) => {
        (Array.isArray(week.actions) ? week.actions : []).forEach((action) => ensureRecord(action));
    });

    weeks.forEach((week) => {
        (Array.isArray(week.actions) ? week.actions : []).forEach((action) => {
            const fromRaw =
                action.progressesFrom !== undefined && action.progressesFrom !== null
                    ? String(action.progressesFrom)
                    : '';
            const fromId =
                rawActionToPrescription.get(fromRaw) || (records.has(fromRaw) ? fromRaw : '');
            const toId = String(action.prescriptionActionId || '');
            addRelation(records, fromId, toId, 'progression');
        });
    });

    records.forEach((record) => {
        record.progressionIds.forEach((id) => addRelation(records, record.id, id, 'progression'));
        record.regressionIds.forEach((id) => addRelation(records, record.id, id, 'regression'));
    });

    db.health.prescriptionActions = [...records.values()]
        .map((item) => normalizePrescriptionAction(item, { nowTs }))
        .sort((a, b) =>
            String(a.displayName || '').localeCompare(String(b.displayName || ''), 'zh-CN'),
        );
    return db.health.prescriptionActions;
}

export function getPrescriptionActionCatalog(db = {}) {
    return activeRecords(db?.health?.prescriptionActions || []).map((item) =>
        normalizePrescriptionAction(item),
    );
}

export function findPrescriptionAction(db = {}, id = '') {
    const key = String(id || '').trim();
    if (!key) return null;
    return getPrescriptionActionCatalog(db).find((item) => item.id === key) || null;
}

function replaceRelationId(list = [], sourceIds = new Set(), targetId = '') {
    return normalizeRelationIds(
        (Array.isArray(list) ? list : []).map((id) => (sourceIds.has(id) ? targetId : id)),
        targetId,
    );
}

export function mergePrescriptionActions(db = {}, targetId = '', sourceIds = [], options = {}) {
    db.health = db.health || {};
    const targetKey = String(targetId || '').trim();
    const sources = new Set(uniqueList(sourceIds).filter((id) => id !== targetKey));
    if (!targetKey || !sources.size) return null;
    ensurePrescriptionActionCatalog(db, options);
    const records = new Map(getPrescriptionActionCatalog(db).map((item) => [item.id, item]));
    const target = records.get(targetKey);
    if (!target) return null;
    const nowTs = Number(options.nowTs || Date.now());
    target.displayName =
        String(options.displayName || target.displayName || target.aliases?.[0] || '').trim() ||
        target.displayName;
    sources.forEach((sourceId) => {
        const source = records.get(sourceId);
        if (!source) return;
        target.aliases = uniqueList([
            ...(target.aliases || []),
            source.displayName,
            ...(source.aliases || []),
        ]);
        target.sourceActionIds = uniqueList([
            ...(target.sourceActionIds || []),
            ...(source.sourceActionIds || []),
        ]);
        target.regressionIds = normalizeRelationIds(
            [...(target.regressionIds || []), ...(source.regressionIds || [])],
            target.id,
        );
        target.progressionIds = normalizeRelationIds(
            [...(target.progressionIds || []), ...(source.progressionIds || [])],
            target.id,
        );
        if (!target.linkedActionId && source.linkedActionId)
            target.linkedActionId = source.linkedActionId;
        if (!target.defaultSpec && source.defaultSpec) target.defaultSpec = source.defaultSpec;
        if (!target.category && source.category) target.category = source.category;
        if (!target.bodyPart && source.bodyPart) target.bodyPart = source.bodyPart;
        // 目标没有部位数组时才继承：保住被合并方显式标注（含后续 AI 分类）的多部位信息。
        if (!target.bodyParts?.length && source.bodyParts?.length) {
            target.bodyParts = source.bodyParts;
            target.bodyPartsSource = source.bodyPartsSource;
        }
        source.deleted = true;
        source.updatedAt = nowTs;
    });
    target.updatedAt = nowTs;
    activeRecords(db.health.rehabWeekly || []).forEach((week) => {
        (week.actions || []).forEach((action) => {
            if (sources.has(action.prescriptionActionId)) action.prescriptionActionId = target.id;
        });
    });
    records.forEach((record) => {
        if (record.id === target.id || record.deleted) return;
        record.regressionIds = replaceRelationId(record.regressionIds, sources, target.id);
        record.progressionIds = replaceRelationId(record.progressionIds, sources, target.id);
    });
    db.health.prescriptionActions = [...records.values()].map((item) =>
        normalizePrescriptionAction(item, { nowTs }),
    );
    ensurePrescriptionActionCatalog(db, { nowTs });
    return findPrescriptionAction(db, target.id);
}

export function setPrescriptionActionLinkedAction(
    db = {},
    prescriptionActionId = '',
    linkedActionId = '',
    options = {},
) {
    ensurePrescriptionActionCatalog(db, options);
    const item = (db.health?.prescriptionActions || []).find(
        (record) => record && record.id === prescriptionActionId && !record.deleted,
    );
    if (!item) return null;
    item.linkedActionId = String(linkedActionId || '').trim();
    item.updatedAt = Number(options.nowTs || Date.now());
    return normalizePrescriptionAction(item, options);
}

export function addPrescriptionActionRelation(
    db = {},
    fromId = '',
    toId = '',
    relation = 'progression',
    options = {},
) {
    ensurePrescriptionActionCatalog(db, options);
    const records = new Map(getPrescriptionActionCatalog(db).map((item) => [item.id, item]));
    addRelation(
        records,
        String(fromId || ''),
        String(toId || ''),
        relation === 'regression' ? 'regression' : 'progression',
    );
    db.health.prescriptionActions = [...records.values()];
    return findPrescriptionAction(db, fromId);
}

export function removePrescriptionActionRelation(
    db = {},
    fromId = '',
    toId = '',
    relation = 'progression',
    options = {},
) {
    ensurePrescriptionActionCatalog(db, options);
    const from = (db.health?.prescriptionActions || []).find(
        (item) => item && item.id === fromId && !item.deleted,
    );
    const to = (db.health?.prescriptionActions || []).find(
        (item) => item && item.id === toId && !item.deleted,
    );
    if (!from || !to) return null;
    if (relation === 'regression') {
        from.regressionIds = normalizeRelationIds(
            (from.regressionIds || []).filter((id) => id !== toId),
            from.id,
        );
        to.progressionIds = normalizeRelationIds(
            (to.progressionIds || []).filter((id) => id !== fromId),
            to.id,
        );
    } else {
        from.progressionIds = normalizeRelationIds(
            (from.progressionIds || []).filter((id) => id !== toId),
            from.id,
        );
        to.regressionIds = normalizeRelationIds(
            (to.regressionIds || []).filter((id) => id !== fromId),
            to.id,
        );
    }
    const nowTs = Number(options.nowTs || Date.now());
    from.updatedAt = nowTs;
    to.updatedAt = nowTs;
    return normalizePrescriptionAction(from, options);
}

const api = {
    deriveBodyPartFields,
    normalizePrescriptionActionName,
    createPrescriptionActionId,
    normalizePrescriptionAction,
    ensurePrescriptionActionCatalog,
    getPrescriptionActionCatalog,
    findPrescriptionAction,
    mergePrescriptionActions,
    setPrescriptionActionLinkedAction,
    addPrescriptionActionRelation,
    removePrescriptionActionRelation,
};

if (typeof window !== 'undefined') {
    window['actionIdentity'] = api;
}

export default api;
