const cardioTypes = {
    walk: { name: '步行', met: 3.5 },
    brisk_walk: { name: '快走', met: 4.3 },
    jog: { name: '慢跑', met: 7.0 },
    run: { name: '跑步', met: 9.8 },
    cycling: { name: '骑行', met: 6.8 },
    swim: { name: '游泳', met: 7.0 },
    elliptical: { name: '椭圆机', met: 5.0 },
    rowing: { name: '划船机', met: 7.0 },
    battle_rope: { name: '战绳', met: 8.0 },
    spin_bike: { name: '动感单车', met: 7.5 }
};

function normalizeCardioCatalog(extraTypes = {}) {
    const catalog = { ...cardioTypes };
    Object.entries(extraTypes && typeof extraTypes === 'object' ? extraTypes : {}).forEach(([key, value]) => {
        const type = String(key || '').trim();
        const name = String(value?.name || '').trim();
        const met = Number(value?.met || 0);
        if (!type || !name || !Number.isFinite(met) || met <= 0) return;
        catalog[type] = { name, met };
    });
    return catalog;
}

/**
 * @param {number} met
 * @param {number} weightKg
 * @param {number} durationMin
 * @returns {number}
 */
function calcCalories(met, weightKg, durationMin) {
    const safeMet = Number(met);
    const safeWeight = Number(weightKg);
    const safeDuration = Number(durationMin);
    if (!Number.isFinite(safeMet) || safeMet <= 0) return 0;
    if (!Number.isFinite(safeWeight) || safeWeight <= 0) return 0;
    if (!Number.isFinite(safeDuration) || safeDuration <= 0) return 0;
    return safeMet * safeWeight * (safeDuration / 60);
}

function normalizeCardioPlan(input = {}, extraTypes = {}) {
    const catalog = normalizeCardioCatalog(extraTypes);
    const rawType = String(input.type || 'walk');
    const customMet = Number(input.met || 0);
    const customName = String(input.name || '').trim();
    const customInfo = customName && Number.isFinite(customMet) && customMet > 0
        ? { name: customName, met: customMet }
        : null;
    const info = catalog[rawType] || customInfo || cardioTypes.walk;
    const type = catalog[rawType] || customInfo ? rawType : 'walk';
    const weight = Number(input.weight || 70);
    const target = Number.parseInt(input.target || 30, 10);
    return {
        type,
        weight: Number.isFinite(weight) && weight > 0 ? weight : 70,
        target: Number.isFinite(target) && target > 0 ? target : 30,
        name: info.name,
        met: info.met
    };
}

function calcCaloriesForSeconds(plan, seconds, extraTypes = {}) {
    const normalized = normalizeCardioPlan(plan, extraTypes);
    return calcCalories(normalized.met, normalized.weight, Number(seconds || 0) / 60);
}

function formatDurationParts(seconds) {
    const safe = Math.max(0, Number.parseInt(seconds || 0, 10) || 0);
    return {
        minutes: Math.floor(safe / 60),
        seconds: safe % 60,
        label: `${Math.floor(safe / 60).toString().padStart(2, '0')}:${(safe % 60).toString().padStart(2, '0')}`
    };
}

function shouldSaveCardioSession(seconds, minSeconds = 20) {
    return Number(seconds || 0) >= minSeconds;
}

function shouldAnnounceTarget({ seconds = 0, target = 0, targetAnnounced = false } = {}) {
    const targetSec = Number(target || 0) * 60;
    return !targetAnnounced && targetSec > 0 && Number(seconds || 0) >= targetSec;
}

function buildCardioHistoryRecord({ id, now = Date.now(), dayKey, plan, duration, calories }) {
    const normalized = normalizeCardioPlan(plan);
    return {
        id,
        type: 'cardio',
        date: new Date(now).toLocaleString(),
        dayKey,
        duration: Number(duration || 0),
        actions: [],
        cardio: {
            name: normalized.name,
            type: normalized.type,
            met: normalized.met,
            weight: normalized.weight,
            target: normalized.target,
            calories: Math.round(Number(calories || 0))
        },
        updatedAt: now,
        deleted: false
    };
}

export {
    cardioTypes,
    normalizeCardioCatalog,
    calcCalories,
    normalizeCardioPlan,
    calcCaloriesForSeconds,
    formatDurationParts,
    shouldSaveCardioSession,
    shouldAnnounceTarget,
    buildCardioHistoryRecord
};

if (typeof window !== 'undefined') {
    window.cardioPure = {
        cardioTypes,
        normalizeCardioCatalog,
        calcCalories,
        normalizeCardioPlan,
        calcCaloriesForSeconds,
        formatDurationParts,
        shouldSaveCardioSession,
        shouldAnnounceTarget,
        buildCardioHistoryRecord
    };
}
