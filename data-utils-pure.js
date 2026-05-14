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
