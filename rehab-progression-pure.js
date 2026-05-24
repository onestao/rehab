const CLAMPED_RPE = new Set([1, 2, 3, 4, 5]);

function normalizedHistory(history = []) {
    return (Array.isArray(history) ? history : [])
        .filter((item) => item && CLAMPED_RPE.has(Number(item.rpe)))
        .map((item) => ({
            rpe: Number(item.rpe),
            doneAt: Number(item.doneAt || item.at || 0),
            note: String(item.note || '')
        }))
        .sort((a, b) => Number(a.doneAt || 0) - Number(b.doneAt || 0));
}

function levelRange(chain) {
    const levels = Array.isArray(chain?.levels) ? chain.levels : [];
    if (!levels.length) return { min: 1, max: 1 };
    const nums = levels.map((item, index) => Number(item?.lv || index + 1)).filter((value) => Number.isFinite(value) && value > 0);
    return {
        min: Math.min(...nums),
        max: Math.max(...nums)
    };
}

function nextLevel(level, direction, range) {
    if (direction === 'upgrade') return Math.min(range.max, Number(level || range.min) + 1);
    if (direction === 'downgrade') return Math.max(range.min, Number(level || range.min) - 1);
    return Number(level || range.min);
}

function fallbackTarget(taskItem, direction) {
    const spec = taskItem?.spec || {};
    const sets = Math.max(1, Number(spec.sets || 1));
    const reps = Math.max(0, Number(spec.reps || 0));
    const work = Math.max(0, Number(spec.work || 0));
    if (direction === 'upgrade') {
        return {
            sets: reps > 0 ? sets + 1 : sets,
            reps: reps > 0 ? reps : 0,
            work: work > 0 ? work + 5 : work
        };
    }
    return {
        sets: Math.max(1, sets - 1),
        reps: reps > 0 ? Math.max(1, reps - 2) : 0,
        work: work > 0 ? Math.max(10, work - 5) : 0
    };
}

export function evaluateProgression({ taskItem, chain, history = [], userOverride = false }) {
    const range = levelRange(chain);
    const currentLevel = Number(taskItem?.currentLevel || range.min);
    const safeHistory = normalizedHistory(history);
    if (userOverride || taskItem?.userOverride) {
        return {
            suggestion: 'maintain',
            targetLevel: currentLevel,
            reason: '已锁定当前动作，不自动调整'
        };
    }

    const latest = safeHistory[safeHistory.length - 1] || null;
    const previous = safeHistory[safeHistory.length - 2] || null;

    if (latest?.rpe === 5) {
        if (currentLevel > range.min) {
            return {
                suggestion: 'downgrade',
                targetLevel: nextLevel(currentLevel, 'downgrade', range),
                reason: `上次反馈做不动，为你降级到 Lv${nextLevel(currentLevel, 'downgrade', range)}`
            };
        }
        return {
            suggestion: 'downgrade',
            targetLevel: currentLevel,
            fallbackSpec: fallbackTarget(taskItem, 'downgrade'),
            reason: '已在最低等级，建议减组或缩短时长'
        };
    }

    if (latest?.rpe === 1 && previous?.rpe === 1) {
        if (currentLevel < range.max) {
            return {
                suggestion: 'upgrade',
                targetLevel: nextLevel(currentLevel, 'upgrade', range),
                reason: `连续两次反馈太轻，建议升级到 Lv${nextLevel(currentLevel, 'upgrade', range)}`
            };
        }
        return {
            suggestion: 'upgrade',
            targetLevel: currentLevel,
            fallbackSpec: fallbackTarget(taskItem, 'upgrade'),
            reason: '已在最高等级，建议加组或延长时长'
        };
    }

    return {
        suggestion: 'maintain',
        targetLevel: currentLevel,
        reason: '当前负荷合适，保持现有等级'
    };
}

