/**
 * @param {Array<{id?: string, updatedAt?: number, deletedAt?: number|null, deleted?: boolean, [key: string]: any}>} localList
 * @param {Array<{id?: string, updatedAt?: number, deletedAt?: number|null, deleted?: boolean, [key: string]: any}>} remoteList
 */
export function mergeIncremental(localList, remoteList) {
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
export function computeRetryDelay(attempt, opts = {}) {
    const baseDelay = Number(opts.baseDelay || 800);
    const factor = Number(opts.factor || 2);
    const jitter = Number(opts.jitter || 0.2);
    const base = baseDelay * (factor ** Math.max(0, attempt - 1));
    const delta = base * jitter;
    return Math.max(0, Math.round(base + delta));
}

/** @param {unknown} error */
export function isRetryableError(error) {
    const status = Number(error && typeof error === 'object' && 'status' in error ? error.status : 0);
    if (status === 429 || status >= 500) return true;
    if (status >= 400 && status < 500) return false;
    const message = String(error && typeof error === 'object' && 'message' in error ? error.message : error || '');
    return /fetch|network|timeout|load failed|failed to fetch/i.test(message);
}

/**
 * Fieldwise merge: only uses per-field timestamps when present, otherwise falls back to LWW by record updatedAt.
 * @param {{updatedAt?: number, __fieldUpdatedAt?: Record<string, string>, [k: string]: any}} local
 * @param {{updatedAt?: number, __fieldUpdatedAt?: Record<string, string>, [k: string]: any}} remote
 */
export function mergeRecordsFieldwise(local, remote) {
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
export function takeQueueBatch(queue, limit = 20) {
    const q = Array.isArray(queue) ? queue : [];
    return { batch: q.slice(0, limit), tail: q.slice(limit) };
}

/**
 * @param {Array<{id?: string, createdAt?: number}>} localVersions
 * @param {Array<{id?: string, createdAt?: number}>} remoteVersions
 */
export function mergeAdviceVersions(localVersions, remoteVersions) {
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
export function mergeAdviceRecord(local, remote) {
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
export function validatePayload(json, localSchemaVer = 1) {
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
export function compareCounts(remoteCounts, localDb, dropRatio = 0.5) {
    const warns = [];
    if (!remoteCounts || typeof remoteCounts !== 'object') return warns;
    const map = {
        actions:  () => localDb?.actions?.length || 0,
        routines: () => localDb?.routines?.length || 0,
        history:  () => localDb?.history?.length || 0,
        food:     () => localDb?.health?.foodLogs?.length || 0,
        exercise: () => localDb?.health?.exerciseLogs?.length || 0,
        weight:   () => localDb?.health?.weights?.length || 0
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

if (typeof window !== 'undefined') {
    window.syncPure = window.syncPure || {};
    Object.assign(window.syncPure, {
        mergeIncremental, computeRetryDelay, isRetryableError,
        mergeRecordsFieldwise, takeQueueBatch,
        mergeAdviceVersions, mergeAdviceRecord,
        validatePayload, compareCounts
    });
}
