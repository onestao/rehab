// @ts-nocheck
(function () {
    if (window.planProgression) return;

    const CLAMPED_RPE = new Set([1, 2, 3, 4, 5]);

    const PROFILES = {
        rehab:       { progressAfterEasy: 1, progressAfterModerate: 3, deloadAtRpe: 5, volumeUpAtRpe: 2 },
        maintenance: { progressAfterEasy: 1, progressAfterModerate: 3, deloadAtRpe: 5, volumeUpAtRpe: 2 },
        cut:         { progressAfterEasy: 1, progressAfterModerate: 2, deloadAtRpe: 5, volumeUpAtRpe: 2 },
        bulk:        { progressAfterEasy: 1, progressAfterModerate: 2, deloadAtRpe: 5, volumeUpAtRpe: 2 },
        custom:      { progressAfterEasy: 1, progressAfterModerate: 3, deloadAtRpe: 5, volumeUpAtRpe: 2 }
    };

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

    function getChainAlternatives(chain, targetLevel) {
        const levels = Array.isArray(chain?.levels) ? chain.levels : [];
        const target = levels.find(l => (Number(l.lv) || -1) === targetLevel);
        if (!target) return [];
        return [{
            name: String(target.name || ''),
            lv: targetLevel,
            hint: String(target.hint || ''),
            requiredEquipment: Array.isArray(target.requiredEquipment) ? target.requiredEquipment : []
        }];
    }

    function evaluate({ taskItem, chain, history = [], planType = 'rehab' }) {
        const profile = PROFILES[planType] || PROFILES.rehab;
        const range = levelRange(chain);
        const currentLevel = Number(taskItem?.currentLevel || range.min);
        const safeHistory = normalizedHistory(history);
        const currentPhase = taskItem?.progressionPhase || 'baseline';
        const spec = taskItem?.spec || {};
        
        let consecutiveEasy = 0;
        let consecutiveModerate = 0;
        for (let i = safeHistory.length - 1; i >= 0; i--) {
            const rpe = safeHistory[i].rpe;
            if (rpe === 1) {
                consecutiveEasy++;
                break;
            } else if (rpe === 2) {
                consecutiveModerate++;
            } else {
                break;
            }
        }
        
        const latestRpe = safeHistory.length > 0 ? safeHistory[safeHistory.length - 1].rpe : null;

        if (taskItem?.userOverride) {
            return {
                decision: 'hold',
                phase: currentPhase,
                targetLevel: currentLevel,
                suggestedSpec: { ...spec },
                constraints: { volumeRange: [spec.sets || 1, spec.sets || 1], loadDelta: '+0' },
                reason: '已锁定当前动作，不自动调整',
                chainAlternatives: []
            };
        }

        const signal = {
            decision: 'hold',
            phase: currentPhase,
            targetLevel: currentLevel,
            suggestedSpec: { ...spec },
            constraints: { volumeRange: [spec.sets || 1, spec.sets || 1], loadDelta: '+0' },
            reason: '当前负荷合适，保持现有等级',
            chainAlternatives: []
        };

        if (latestRpe === 5) {
            signal.decision = 'deload';
            signal.phase = 'deload';
            if (currentLevel > range.min) {
                signal.targetLevel = currentLevel - 1;
                signal.reason = `上次反馈做不动，为你降级到 Lv${signal.targetLevel}`;
                signal.chainAlternatives = getChainAlternatives(chain, signal.targetLevel);
            } else {
                signal.reason = '已在最低等级，建议减组或缩短时长';
                signal.suggestedSpec.sets = Math.max(1, (spec.sets || 1) - 1);
                if (spec.reps > 0) signal.suggestedSpec.reps = Math.max(1, spec.reps - 2);
                if (spec.work > 0) signal.suggestedSpec.work = Math.max(10, spec.work - 5);
                signal.constraints.volumeRange = [1, Math.max(1, (spec.sets || 1) - 1)];
            }
            return signal;
        }

        if (latestRpe === 1) {
            signal.decision = 'progress';
            signal.phase = 'ready-to-progress';
            if (currentLevel < range.max) {
                signal.targetLevel = currentLevel + 1;
                signal.reason = '上次反馈太轻，建议立即升级';
                signal.chainAlternatives = getChainAlternatives(chain, signal.targetLevel);
            } else {
                signal.decision = 'volume-up';
                signal.reason = '已在最高等级，建议加组或延长时长';
                signal.suggestedSpec.sets = (spec.sets || 1) + 1;
                signal.constraints.volumeRange = [spec.sets || 1, (spec.sets || 1) + 2];
            }
            return signal;
        }

        if (latestRpe === 2) {
            if (consecutiveModerate >= profile.progressAfterModerate) {
                signal.decision = 'progress';
                signal.phase = 'ready-to-progress';
                if (currentLevel < range.max) {
                    signal.targetLevel = currentLevel + 1;
                    signal.reason = `连续 ${consecutiveModerate} 次合适，建议升级动作`;
                    signal.chainAlternatives = getChainAlternatives(chain, signal.targetLevel);
                } else {
                    signal.decision = 'volume-up';
                    signal.reason = '已在最高等级且适应良好，建议进一步加量';
                    signal.suggestedSpec.sets = (spec.sets || 1) + 1;
                    signal.constraints.volumeRange = [spec.sets || 1, (spec.sets || 1) + 2];
                }
            } else {
                signal.decision = 'volume-up';
                signal.phase = 'volume-up';
                signal.reason = '感觉合适，仍有余力，建议小幅加量';
                signal.suggestedSpec.sets = (spec.sets || 1) + 1;
                signal.constraints.volumeRange = [spec.sets || 1, (spec.sets || 1) + 1];
                if (spec.reps > 0) signal.suggestedSpec.reps = spec.reps + 2;
            }
            return signal;
        }

        if (latestRpe === 3) {
            signal.decision = 'hold';
            signal.reason = '理想状态，保持现状';
        } else if (latestRpe === 4) {
            signal.decision = 'hold';
            signal.reason = '较难，不加量也不降级';
        }

        return signal;
    }

    window.planProgression = { evaluate, PROFILES };
})();

