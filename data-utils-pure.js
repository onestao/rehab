/** @returns {number} */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/** @returns {number} */
export function safeNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

/** @returns {string} */
export function formatKcal(value) {
    const kcal = safeNumber(value, 0);
    return `${Math.round(kcal)} kcal`;
}

/** @template T @param {T} value @returns {T} */
export function deepClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

/** @param {Date} date @returns {string} */
export function dateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * @param {Date|string|number} date
 * @param {number} cutoffHour
 * @returns {string}
 */
export function toLogicalDay(date, cutoffHour = 4) {
    const d = new Date(date);
    if (d.getHours() < cutoffHour) d.setDate(d.getDate() - 1);
    return dateKey(d);
}

/**
 * @param {{ weightDelta: number|null, goalType: 'loss'|'gain'|null, weeklyTarget: number }} input
 * @returns {{ pct: number|null, color: 'positive'|'negative'|'neutral' }}
 */
export function weeklyWeightAchievement({ weightDelta, goalType, weeklyTarget }) {
    if (weightDelta === null || weightDelta === undefined) return { pct: null, color: 'neutral' };
    const target = Number(weeklyTarget) || 0;
    if (target <= 0) return { pct: null, color: 'neutral' };
    const signed = goalType === 'gain' ? Math.abs(target) : -Math.abs(target);
    const towards = signed === 0 ? 0 : Math.max(0, weightDelta / signed);
    const pct = Math.min(100, Math.round(towards * 100));
    const color = (weightDelta * signed >= 0) ? 'positive' : 'negative';
    return { pct, color };
}

/** @returns {number} */
export function countActionReferences(actionId, routines = []) {
    if (!actionId) return 0;
    return (routines || []).reduce((count, routine) => {
        const refs = (routine?.actions || []).filter(a => a && a.sourceActionId === actionId).length;
        return count + refs;
    }, 0);
}

/** @returns {string[]} */
export function mergeLibraryTags(actions = [], routines = []) {
    const actionTags = (actions || []).flatMap(a => Array.isArray(a?.tags) ? a.tags : []);
    const routineTags = (routines || []).flatMap(r => Array.isArray(r?.tags) ? r.tags : []);
    return [...new Set([...actionTags, ...routineTags].map(t => String(t || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

/** @returns {'actions'|'routines'} */
export function nextLibraryView(current, dir) {
    /** @type {('actions'|'routines')[]} */
    const order = ['actions', 'routines'];
    const idx = Math.max(0, order.indexOf(order.includes(current) ? current : 'actions'));
    const next = Math.max(0, Math.min(order.length - 1, idx + (dir > 0 ? 1 : -1)));
    return order[next];
}

/** @returns {number} */
export function clampSwipeProgress(deltaX, width, currentIndex, total) {
    const safeWidth = Math.max(1, Number(width) || 1);
    const progress = deltaX / safeWidth;
    const atStart = currentIndex <= 0 && progress > 0;
    const atEnd = currentIndex >= total - 1 && progress < 0;
    if (atStart || atEnd) return progress * 0.35;
    return progress;
}
