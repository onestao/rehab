// @ts-check
(function () {
    function estimateOneRm(weightKg, reps) {
        const weight = Number(weightKg || 0);
        const r = Number(reps || 0);
        if (!(weight > 0) || !(r > 0) || r > 12) return 0;
        return Number((weight * (1 + r / 30)).toFixed(2));
    }

    function computePrByAction(logs) {
        const out = {};
        for (const raw of logs || []) {
            if (!raw || raw.deleted || raw.type !== 'strength') continue;
            const name = String(raw.customName || '').trim();
            if (!name) continue;
            const weightKg = Number(raw.weightKg || 0);
            const repsPerSet = Number(raw.repsPerSet || 0);
            const oneRm = estimateOneRm(weightKg, repsPerSet);
            const current = out[name] || {
                action: name,
                maxWeight: 0,
                maxWeightDate: '',
                maxReps: 0,
                maxRepsDate: '',
                oneRm: 0,
                oneRmDate: '',
                history: []
            };
            if (weightKg > current.maxWeight) {
                current.maxWeight = weightKg;
                current.maxWeightDate = String(raw.date || '');
            }
            if (repsPerSet > current.maxReps) {
                current.maxReps = repsPerSet;
                current.maxRepsDate = String(raw.date || '');
            }
            if (oneRm > current.oneRm) {
                current.oneRm = oneRm;
                current.oneRmDate = String(raw.date || '');
            }
            current.history.push({ date: String(raw.date || ''), weightKg, repsPerSet, oneRm });
            out[name] = current;
        }
        Object.values(out).forEach(item => item.history.sort((a, b) => a.date.localeCompare(b.date)));
        return out;
    }

    function diffPrEntries(prev, next) {
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

    window.prTracker = {
        compute(logs) {
            return computePrByAction(logs);
        },

        diff(prev, next) {
            return diffPrEntries(prev, next);
        },

        refresh(db) {
            const target = db && typeof db === 'object' ? db : (window.data?.db || {});
            target.cache = target.cache || {};
            const previous = target.cache.prByAction && typeof target.cache.prByAction === 'object'
                ? target.cache.prByAction
                : {};
            const next = this.compute(target.health?.exerciseLogs || []);
            const diff = this.diff(previous, next);
            target.cache.prByAction = next;
            target.cache.prUpdatedAt = Date.now();
            return { next, diff };
        },

        topEntries(db, limit = 8) {
            const target = db && typeof db === 'object' ? db : (window.data?.db || {});
            const map = target.cache?.prByAction || {};
            return Object.values(map)
                .sort((a, b) => Number(b.oneRm || 0) - Number(a.oneRm || 0) || Number(b.maxWeight || 0) - Number(a.maxWeight || 0))
                .slice(0, limit);
        }
    };
})();
