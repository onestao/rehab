export const cardioTypes = {
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

/**
 * @param {number} met
 * @param {number} weightKg
 * @param {number} durationMin
 * @returns {number}
 */
export function calcCalories(met, weightKg, durationMin) {
    const safeMet = Number(met);
    const safeWeight = Number(weightKg);
    const safeDuration = Number(durationMin);
    if (!Number.isFinite(safeMet) || safeMet <= 0) return 0;
    if (!Number.isFinite(safeWeight) || safeWeight <= 0) return 0;
    if (!Number.isFinite(safeDuration) || safeDuration <= 0) return 0;
    return safeMet * safeWeight * (safeDuration / 60);
}
