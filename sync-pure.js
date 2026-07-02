/**
 * @param {Array<{id?: string, updatedAt?: number, deletedAt?: number|null, deleted?: boolean, [key: string]: any}>} localList
 * @param {Array<{id?: string, updatedAt?: number, deletedAt?: number|null, deleted?: boolean, [key: string]: any}>} remoteList
 */
function mergeIncremental(localList, remoteList) {
    const merged = new Map();
    for (const item of localList || []) {
        if (!item?.id) continue;
        merged.set(item.id, item);
    }
    for (const item of remoteList || []) {
        if (!item?.id) continue;
        const current = merged.get(item.id);
        if (!current || Number(item.updatedAt || 0) >= Number(current.updatedAt || 0)) {
            merged.set(item.id, item);
        }
    }
    return Array.from(merged.values());
}

/** @param {number} attempt @param {{baseDelay?: number, factor?: number, jitter?: number}=} opts */
function computeRetryDelay(attempt, opts = {}) {
    const baseDelay = Number(opts.baseDelay || 800);
    const factor = Number(opts.factor || 2);
    const jitter = Number(opts.jitter || 0.2);
    const base = baseDelay * (factor ** Math.max(0, attempt - 1));
    const delta = base * jitter;
    return Math.max(0, Math.round(base + delta));
}

/** @param {unknown} error */
function isRetryableError(error) {
    const status = Number(error && typeof error === 'object' && 'status' in error ? error.status : 0);
    if (status === 429 || status >= 500) return true;
    if (status >= 400 && status < 500) return false;
    const message = String(error && typeof error === 'object' && 'message' in error ? error.message : error || '');
    return /fetch|network|timeout|load failed|failed to fetch/i.test(message);
}

/**
 * @param {string} remotePath
 * @param {string} prefix
 */
function buildS3ObjectKey(remotePath, prefix = 'rehab') {
    const cleanPath = String(remotePath || '').trim().replace(/^\/+/, '');
    const cleanPrefix = String(prefix || '').trim().replace(/^\/+|\/+$/g, '');
    if (!cleanPrefix) return cleanPath;
    if (!cleanPath) return `${cleanPrefix}/`;
    if (cleanPath === cleanPrefix || cleanPath.startsWith(`${cleanPrefix}/`)) return cleanPath;
    return `${cleanPrefix}/${cleanPath}`;
}

/** @param {any} profile */
function hasMeaningfulHealthProfile(profile) {
    if (!profile || typeof profile !== 'object') return false;
    const conditions = Array.isArray(profile.conditions) ? profile.conditions : [];
    const examResults = Array.isArray(profile.examResults) ? profile.examResults : [];
    const allergies = Array.isArray(profile.allergies) ? profile.allergies : [];
    const prefs = profile.preferences && typeof profile.preferences === 'object' ? profile.preferences : {};
    const equipment = Array.isArray(prefs.equipment) ? prefs.equipment : [];
    const sports = Array.isArray(prefs.sports) ? prefs.sports : [];
    const vitals = profile.vitals && typeof profile.vitals === 'object' ? profile.vitals : {};
    return !!(
        Number(profile.age || 0) ||
        profile.gender === 'female' ||
        conditions.length ||
        examResults.length ||
        allergies.length ||
        equipment.length ||
        sports.length ||
        Number(vitals.restingHR || 0)
    );
}

/** @param {any} local @param {any} remote */
function mergeHealthProfileRecord(local, remote) {
    const localHas = hasMeaningfulHealthProfile(local);
    const remoteHas = hasMeaningfulHealthProfile(remote);
    if (localHas && !remoteHas) return local;
    if (remoteHas && !localHas) return remote;
    return Number(remote?.updatedAt || 0) >= Number(local?.updatedAt || 0) ? remote : local;
}

/**
 * Fieldwise merge: only uses per-field timestamps when present, otherwise falls back to LWW by record updatedAt.
 * @param {{updatedAt?: number, __fieldUpdatedAt?: Record<string, string>, [k: string]: any}} local
 * @param {{updatedAt?: number, __fieldUpdatedAt?: Record<string, string>, [k: string]: any}} remote
 */
function mergeRecordsFieldwise(local, remote) {
    const lTs = Number(local?.updatedAt || 0);
    const rTs = Number(remote?.updatedAt || 0);
    const lMeta = local?.__fieldUpdatedAt || null;
    const rMeta = remote?.__fieldUpdatedAt || null;
    if (!lMeta || !rMeta) return rTs >= lTs ? remote : local;
    const out = { ...(lTs >= rTs ? local : remote) };
    const keys = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]);
    for (const k of keys) {
        if (k === '__fieldUpdatedAt') continue;
        const lt = Date.parse(lMeta[k] || '') || lTs;
        const rt = Date.parse(rMeta[k] || '') || rTs;
        out[k] = rt >= lt ? remote[k] : local[k];
    }
    out.__fieldUpdatedAt = { ...lMeta, ...rMeta };
    out.updatedAt = Math.max(lTs, rTs);
    return out;
}

/**
 * @param {Array<any>} queue
 * @param {number} limit
 * @returns {{ batch: any[], tail: any[] }}
 */
function takeQueueBatch(queue, limit = 20) {
    const q = Array.isArray(queue) ? queue : [];
    return { batch: q.slice(0, limit), tail: q.slice(limit) };
}

/**
 * @param {Array<{id?: string, createdAt?: number}>} localVersions
 * @param {Array<{id?: string, createdAt?: number}>} remoteVersions
 */
function mergeAdviceVersions(localVersions, remoteVersions) {
    const map = new Map();
    for (const item of localVersions || []) {
        if (!item?.id) continue;
        map.set(item.id, item);
    }
    for (const item of remoteVersions || []) {
        if (!item?.id) continue;
        const current = map.get(item.id);
        if (!current) {
            map.set(item.id, item);
            continue;
        }
        const currentTs = Number(current.createdAt || 0);
        const nextTs = Number(item.createdAt || 0);
        if (nextTs >= currentTs) map.set(item.id, item);
    }
    return Array.from(map.values()).sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
}

/**
 * @param {{id?: string, updatedAt?: number, versions?: Array<any>, activeVersionId?: string, pinnedVersionId?: string}} local
 * @param {{id?: string, updatedAt?: number, versions?: Array<any>, activeVersionId?: string, pinnedVersionId?: string}} remote
 */
function mergeAdviceRecord(local, remote) {
    const lTs = Number(local?.updatedAt || 0);
    const rTs = Number(remote?.updatedAt || 0);
    const base = rTs >= lTs ? { ...local, ...remote } : { ...remote, ...local };
    base.versions = mergeAdviceVersions(local?.versions || [], remote?.versions || []);
    if (rTs >= lTs) {
        base.activeVersionId = remote?.activeVersionId || base.activeVersionId || '';
        base.pinnedVersionId = remote?.pinnedVersionId || base.pinnedVersionId || '';
    } else {
        base.activeVersionId = local?.activeVersionId || base.activeVersionId || '';
        base.pinnedVersionId = local?.pinnedVersionId || base.pinnedVersionId || '';
    }
    base.updatedAt = Math.max(lTs, rTs);
    return base;
}

/**
 * @param {any} json
 * @param {number} localSchemaVer
 * @returns {{ ok: boolean, reason?: string, code?: string, db?: any }}
 */
function validatePayload(json, localSchemaVer = 1) {
    if (!json || typeof json !== 'object') return { ok: false, reason: '结构非法' };
    const db = json.db || (json.actions ? json : null);
    if (!db || typeof db !== 'object') return { ok: false, reason: '缺少 db 字段' };
    if (json.checksum && typeof json.checksum !== 'string') return { ok: false, reason: 'checksum 类型错误' };
    if ((json.schemaVersion || 1) > Number(localSchemaVer || 1)) {
        return { ok: false, reason: 'schemaVersion 高于本地', code: 'SCHEMA_HIGHER' };
    }
    return { ok: true, db };
}

/**
 * @param {Record<string, number>} remoteCounts
 * @param {any} localDb
 * @param {number} dropRatio
 * @returns {Array<{ entity: string, remote: number, local: number }>}
 */
function compareCounts(remoteCounts, localDb, dropRatio = 0.5) {
    const warns = [];
    if (!remoteCounts || typeof remoteCounts !== 'object') return warns;
    const map = {
        actions:  () => localDb?.actions?.length || 0,
        routines: () => localDb?.routines?.length || 0,
        history:  () => localDb?.history?.length || 0,
        dailyPlans: () => localDb?.dailyPlans?.length || 0,
        progressionChains: () => localDb?.progressionChains?.length || 0,
        prescriptionActions: () => localDb?.health?.prescriptionActions?.length || 0,
        food:     () => localDb?.health?.foodLogs?.length || 0,
        exercise: () => localDb?.health?.exerciseLogs?.length || 0,
        weight:   () => localDb?.health?.weights?.length || 0,
        rehabWeekly: () => localDb?.health?.rehabWeekly?.length || 0,
        aiInsightCache: () => localDb?.health?.aiInsightCache ? 1 : 0
    };
    for (const k of Object.keys(remoteCounts)) {
        const r = Number(remoteCounts[k] || 0);
        const lFn = map[k];
        if (!lFn) continue;
        const l = lFn();
        if (l > 0 && r < l * dropRatio) warns.push({ entity: k, remote: r, local: l });
    }
    return warns;
}

/** @param {any} dbObj */
function prepareRemoteSnapshotDb(dbObj) {
    return JSON.parse(JSON.stringify(dbObj || {}));
}

/** @param {any} dbObj */
function backupCounts(dbObj = {}) {
    const health = dbObj.health || {};
    return {
        actions: dbObj.actions?.length || 0,
        routines: dbObj.routines?.length || 0,
        history: dbObj.history?.length || 0,
        dailyPlans: dbObj.dailyPlans?.length || 0,
        prescriptionActions: health.prescriptionActions?.length || 0,
        food: health.foodLogs?.length || 0,
        exercise: health.exerciseLogs?.length || 0,
        weight: health.weights?.length || 0,
        rehabWeekly: health.rehabWeekly?.length || 0,
        advice: health.aiAdviceChat?.length || 0,
        aiInsightCache: health.aiInsightCache ? 1 : 0
    };
}

function countSnapshotItems(snapshotData = {}) {
    if (snapshotData?.itemCounts && typeof snapshotData.itemCounts === 'object') {
        return { ...snapshotData.itemCounts };
    }
    const dbObj = snapshotData?.db && typeof snapshotData.db === 'object' && !Array.isArray(snapshotData.db)
        ? snapshotData.db
        : snapshotData;
    return backupCounts(dbObj || {});
}

function compareSnapshotCountDrop(localCounts = {}, remoteCounts = {}, dropRatio = 0.5) {
    const warns = [];
    const keys = new Set([...Object.keys(localCounts || {}), ...Object.keys(remoteCounts || {})]);
    for (const key of keys) {
        const remote = Number(remoteCounts?.[key] || 0);
        const local = Number(localCounts?.[key] || 0);
        if (remote > 0 && local < remote * dropRatio) {
            warns.push({ entity: key, remote, local });
        }
    }
    return warns;
}

function hasRemoteSourceData(snapshotData, manifest) {
    const snapshotHasData = !!(
        snapshotData &&
        typeof snapshotData === 'object' &&
        !Array.isArray(snapshotData) &&
        Object.keys(snapshotData).length > 0
    );
    const sourceManifest = manifest && typeof manifest === 'object' ? manifest : {};
    return !!(
        snapshotHasData ||
        Number(sourceManifest.snapshotTs || 0) > 0 ||
        Number(sourceManifest.lastIncrementalTs || 0) > 0 ||
        Object.keys(sourceManifest.entities || {}).length > 0
    );
}

function shouldSkipRemoteReadSource(mode, sourceKey, primaryHasData) {
    return mode === 's3' && sourceKey === 's3:root' && !!primaryHasData;
}

export {
    mergeIncremental,
    computeRetryDelay,
    isRetryableError,
    buildS3ObjectKey,
    hasMeaningfulHealthProfile,
    mergeHealthProfileRecord,
    mergeRecordsFieldwise,
    takeQueueBatch,
    mergeAdviceVersions,
    mergeAdviceRecord,
    validatePayload,
    compareCounts,
    prepareRemoteSnapshotDb,
    backupCounts,
    countSnapshotItems,
    compareSnapshotCountDrop,
    hasRemoteSourceData,
    shouldSkipRemoteReadSource
};

if (typeof window !== 'undefined') {
    const win = /** @type {any} */ (window);
    win.syncPure = win.syncPure || {};
    Object.assign(win.syncPure, {
        mergeIncremental, computeRetryDelay, isRetryableError,
        buildS3ObjectKey, hasMeaningfulHealthProfile, mergeHealthProfileRecord,
        mergeRecordsFieldwise, takeQueueBatch,
        mergeAdviceVersions, mergeAdviceRecord,
        validatePayload, compareCounts, prepareRemoteSnapshotDb, backupCounts,
        countSnapshotItems, compareSnapshotCountDrop,
        hasRemoteSourceData, shouldSkipRemoteReadSource
    });
}
