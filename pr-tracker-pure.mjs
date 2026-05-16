/**
 * @typedef {{
 *   id?: string,
 *   date?: string,
 *   type?: string,
 *   customName?: string,
 *   weightKg?: number,
 *   sets?: number,
 *   repsPerSet?: number,
 *   minutes?: number,
 *   calories?: number,
 *   deleted?: boolean
 * }} StrengthLogLike
 */

/**
 * @param {number} weightKg
 * @param {number} reps
 */
export function estimateOneRm(weightKg, reps) {
    const weight = Number(weightKg || 0);
    const r = Number(reps || 0);
    if (!(weight > 0) || !(r > 0) || r > 12) return 0;
    return Number((weight * (1 + r / 30)).toFixed(2));
}

/**
 * @param {StrengthLogLike} log
 */
export function normalizeStrengthEntry(log) {
    const name = String(log?.customName || '').trim();
    if (!name) return null;
    const weightKg = Number(log?.weightKg || 0);
    const repsPerSet = Number(log?.repsPerSet || 0);
    const sets = Number(log?.sets || 0);
    return {
        id: String(log?.id || ''),
        date: String(log?.date || ''),
        name,
        weightKg,
        repsPerSet,
        sets,
        oneRm: estimateOneRm(weightKg, repsPerSet)
    };
}

/**
 * @param {StrengthLogLike[]} logs
 */
export function computePrByAction(logs) {
    /** @type {Record<string, {
     *   action: string,
     *   maxWeight: number,
     *   maxWeightDate: string,
     *   maxReps: number,
     *   maxRepsDate: string,
     *   oneRm: number,
     *   oneRmDate: string,
     *   history: { date: string, weightKg: number, repsPerSet: number, oneRm: number }[]
     * }>} */
    const out = {};
    for (const raw of logs || []) {
        if (!raw || raw.deleted || raw.type !== 'strength') continue;
        const entry = normalizeStrengthEntry(raw);
        if (!entry) continue;
        const current = out[entry.name] || {
            action: entry.name,
            maxWeight: 0,
            maxWeightDate: '',
            maxReps: 0,
            maxRepsDate: '',
            oneRm: 0,
            oneRmDate: '',
            history: []
        };
        if (entry.weightKg > current.maxWeight) {
            current.maxWeight = entry.weightKg;
            current.maxWeightDate = entry.date;
        }
        if (entry.repsPerSet > current.maxReps) {
            current.maxReps = entry.repsPerSet;
            current.maxRepsDate = entry.date;
        }
        if (entry.oneRm > current.oneRm) {
            current.oneRm = entry.oneRm;
            current.oneRmDate = entry.date;
        }
        current.history.push({
            date: entry.date,
            weightKg: entry.weightKg,
            repsPerSet: entry.repsPerSet,
            oneRm: entry.oneRm
        });
        out[entry.name] = current;
    }
    Object.values(out).forEach(item => {
        item.history.sort((a, b) => a.date.localeCompare(b.date));
    });
    return out;
}

/**
 * @param {Record<string, any>} prev
 * @param {Record<string, any>} next
 */
export function diffPrEntries(prev, next) {
    const changes = [];
    const keys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]);
    for (const key of keys) {
        const before = prev?.[key] || null;
        const after = next?.[key] || null;
        if (!after) continue;
        const improvedWeight = Number(after.maxWeight || 0) > Number(before?.maxWeight || 0);
        const improvedReps = Number(after.maxReps || 0) > Number(before?.maxReps || 0);
        const improvedOneRm = Number(after.oneRm || 0) > Number(before?.oneRm || 0);
        if (improvedWeight || improvedReps || improvedOneRm) {
            changes.push({ action: key, before, after, improvedWeight, improvedReps, improvedOneRm });
        }
    }
    return changes;
}
