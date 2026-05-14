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
