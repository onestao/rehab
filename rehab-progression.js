// @ts-nocheck
(function () {
    if (window.rehabProgression) return;

    function evaluate(input = {}) {
        const taskItem = input.taskItem || {};
        const chain = input.chain || {};
        const history = Array.isArray(input.history) ? input.history : [];
        const userOverride = !!input.userOverride;
        const levels = Array.isArray(chain.levels) ? chain.levels : [];
        const currentLevel = Math.max(1, Number(taskItem.currentLevel || levels[0]?.lv || 1));
        if (userOverride || taskItem.userOverride) {
            return { suggestion: 'maintain', targetLevel: currentLevel, reason: '已锁定当前动作，不自动调整' };
        }
        const cleaned = history
            .filter((item) => item && [1, 2, 3, 4, 5].includes(Number(item.rpe)))
            .sort((a, b) => Number(a.doneAt || a.at || 0) - Number(b.doneAt || b.at || 0));
        const latest = cleaned[cleaned.length - 1] || null;
        const previous = cleaned[cleaned.length - 2] || null;
        const minLevel = Math.min(...levels.map((item, index) => Number(item?.lv || index + 1)).filter(Boolean), 1);
        const maxLevel = Math.max(...levels.map((item, index) => Number(item?.lv || index + 1)).filter(Boolean), 1);
        const fallback = (direction) => {
            const spec = taskItem.spec || {};
            if (direction === 'upgrade') {
                return {
                    sets: Math.max(1, Number(spec.sets || 1)) + 1,
                    reps: Number(spec.reps || 0) > 0 ? Number(spec.reps || 0) : 0,
                    work: Number(spec.work || 0) > 0 ? Number(spec.work || 0) + 5 : 0
                };
            }
            return {
                sets: Math.max(1, Number(spec.sets || 1) - 1),
                reps: Number(spec.reps || 0) > 0 ? Math.max(1, Number(spec.reps || 0) - 2) : 0,
                work: Number(spec.work || 0) > 0 ? Math.max(10, Number(spec.work || 0) - 5) : 0
            };
        };
        if (latest?.rpe === 5) {
            if (currentLevel > minLevel) {
                const targetLevel = Math.max(minLevel, currentLevel - 1);
                return { suggestion: 'downgrade', targetLevel, reason: `上次反馈做不动，为你降级到 Lv${targetLevel}` };
            }
            return { suggestion: 'downgrade', targetLevel: currentLevel, fallbackSpec: fallback('downgrade'), reason: '已在最低等级，建议减组或缩短时长' };
        }
        if (latest?.rpe === 1 && previous?.rpe === 1) {
            if (currentLevel < maxLevel) {
                const targetLevel = Math.min(maxLevel, currentLevel + 1);
                return { suggestion: 'upgrade', targetLevel, reason: `连续两次反馈太轻，建议升级到 Lv${targetLevel}` };
            }
            return { suggestion: 'upgrade', targetLevel: currentLevel, fallbackSpec: fallback('upgrade'), reason: '已在最高等级，建议加组或延长时长' };
        }
        return { suggestion: 'maintain', targetLevel: currentLevel, reason: '当前负荷合适，保持现有等级' };
    }

    window.rehabProgression = { evaluate };
})();

