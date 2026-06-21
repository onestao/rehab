// @ts-nocheck
(function () {
    if (window.planAiPure) return;

    function safeJsonParse(text) {
        try { return JSON.parse(text); } catch { return null; }
    }

    function readNumber(value, fallback = 0) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function readPositiveNumber(value, fallback = 0) {
        return Math.max(0, readNumber(value, fallback));
    }

    function readCappedPositiveNumber(value, fallback = 0, max = Infinity) {
        const number = readPositiveNumber(value, fallback);
        return Number.isFinite(max) ? Math.min(number, max) : number;
    }

    function readPositiveInteger(value, fallback = 1) {
        return Math.max(1, Math.round(readNumber(value, fallback)));
    }

    function parseBoolean(value) {
        if (typeof value === 'boolean') return value;
        const text = String(value ?? '').trim().toLowerCase();
        if (!text) return false;
        if (['true', '1', 'yes', 'y', '是', '需要', '交替', '双侧', '左右'].some((token) => text.includes(token))) return true;
        if (['false', '0', 'no', 'n', '否', '不'].some((token) => text.includes(token))) return false;
        return false;
    }

    const VALID_MODES = ['reps', 'hold', 'alt-reps', 'alt-hold'];

    function normalizeAiCategory(value = 'main') {
        const text = String(value || '').trim().toLowerCase();
        if (['warmup', 'warm-up', '热身', 'warm'].includes(text)) return 'warmup';
        if (['cooldown', 'cool-down', 'stretch', 'stretching', '拉伸', '放松'].includes(text)) return 'cooldown';
        return 'main';
    }

    function isTimedAiAction(item = {}) {
        const text = `${item.name || ''} ${item.category || ''} ${item.phase || ''} ${item.section || ''}`.toLowerCase();
        return /保持|支撑|平板|静蹲|静态|靠墙|拉伸|伸展|放松|呼吸|hold|plank|stretch|mobility|wall\s*sit|isometric|brace/.test(text)
            || normalizeAiCategory(item.category || item.phase || item.section) === 'cooldown';
    }

    function inferSpecMode(spec = {}, item = {}) {
        if (spec.mode && VALID_MODES.includes(spec.mode)) return spec.mode;
        const alt = parseBoolean(spec.isAlt ?? item.isAlt ?? item.alternating ?? item.bilateral ?? item.sideMode);
        const timed = isTimedAiAction(item);
        if (alt) return timed ? 'alt-hold' : 'alt-reps';
        return timed ? 'hold' : 'reps';
    }

    function validateAiSpec(spec, name) {
        const errs = [];
        if (!spec || typeof spec !== 'object') { errs.push(`${name}: spec 缺失`); return errs; }
        const { sets, reps, work, mode, repRest, actionRest } = spec;
        if (!Number.isInteger(sets) || sets < 1) errs.push(`${name}.spec.sets 必须 ≥1 整数`);
        if (!mode || !VALID_MODES.includes(mode)) errs.push(`${name}.spec.mode 必须为 reps|hold|alt-reps|alt-hold`);
        if (mode === 'reps' || mode === 'alt-reps') {
            if (!Number.isInteger(reps) || reps < 1) errs.push(`${name}.spec.reps (mode=${mode}) 必须 ≥1`);
            if (!Number.isInteger(work) || work < 1) errs.push(`${name}.spec.work (mode=${mode}) 必须 ≥1 秒`);
        }
        if (mode === 'hold' || mode === 'alt-hold') {
            if (!Number.isInteger(work) || work < 1) errs.push(`${name}.spec.work (mode=${mode}) 必须 ≥1 秒`);
        }
        if ((mode === 'alt-reps' || mode === 'alt-hold') && spec.isAlt !== true) {
            errs.push(`${name}.spec.isAlt (mode=${mode}) 必须为 true`);
        }
        if (repRest != null && (!Number.isInteger(repRest) || repRest < 0 || repRest > 30)) {
            errs.push(`${name}.spec.repRest 必须 0..30`);
        }
        if (actionRest != null && (!Number.isInteger(actionRest) || actionRest < 0 || actionRest > 90)) {
            errs.push(`${name}.spec.actionRest 必须 0..90`);
        }
        return errs;
    }

    function isLowLevelRehabAction(item = {}, planType = '') {
        if (planType !== 'rehab') return false;
        const text = `${item.name || ''} ${item.category || ''} ${item.phase || ''} ${item.section || ''}`.toLowerCase();
        return Number(item.currentLevel || 0) <= 1
            || normalizeAiCategory(item.category || item.phase || item.section) !== 'main'
            || /踝泵|股四头肌|等长|激活|活动度|低阶|初级|mobility|activation|isometric/.test(text);
    }

    function phaseIntensityCaps(category = 'main') {
        if (category === 'warmup') {
            return { sets: 2, reps: 12, work: 30, repRest: 5, actionRest: 30 };
        }
        if (category === 'cooldown') {
            return { sets: 2, reps: 8, work: 45, repRest: 0, actionRest: 30 };
        }
        return null;
    }

    function coerceAiSpec(item = {}, options = {}) {
        const spec = item.spec && typeof item.spec === 'object' ? { ...item.spec } : {};
        const category = normalizeAiCategory(item.category || item.phase || item.section);
        const timed = isTimedAiAction(item);
        const lowLevelRehab = isLowLevelRehabAction(item, options.planType || item.planType || '');
        const caps = phaseIntensityCaps(category);
        const autoFilled = [];
        const isAlt = parseBoolean(spec.isAlt ?? item.isAlt ?? item.alternating ?? item.bilateral ?? item.sideMode);

        let sets = readPositiveInteger(spec.sets ?? item.sets, 0);
        if (sets < 1) { sets = 3; autoFilled.push('sets'); }
        if (caps && sets > caps.sets) { sets = caps.sets; autoFilled.push('phaseCap.sets'); }

        let reps = readPositiveNumber(spec.reps ?? item.reps ?? item.count ?? item.times ?? item.perSet, 0);
        let work = readCappedPositiveNumber(spec.work ?? item.work ?? item.seconds ?? item.duration, 0, 90);

        if (reps <= 0 && work <= 0) {
            if (timed) { work = 30; reps = 1; autoFilled.push('work', 'reps'); }
            else { reps = 12; work = 3; autoFilled.push('reps', 'work'); }
        } else if (reps > 0 && work <= 0) {
            work = 3; autoFilled.push('work');
        } else if (timed && reps <= 0) {
            reps = 1; autoFilled.push('reps');
        }
        if (caps && reps > caps.reps) { reps = caps.reps; autoFilled.push('phaseCap.reps'); }
        if (caps && work > caps.work) { work = caps.work; autoFilled.push('phaseCap.work'); }

        const mode = isAlt ? (timed ? 'alt-hold' : 'alt-reps') : (timed ? 'hold' : 'reps');

        const repRestDefault = lowLevelRehab ? 0 : (timed ? 10 : 15);
        const actionRestDefault = lowLevelRehab ? 20 : (timed ? 30 : 45);
        let repRest = readCappedPositiveNumber(spec.repRest ?? item.repRest ?? item.restBetweenReps, repRestDefault, 30);
        if (spec.repRest === undefined && item.repRest === undefined && item.restBetweenReps === undefined) {
            autoFilled.push('repRest');
        }
        if (caps && repRest > caps.repRest) { repRest = caps.repRest; autoFilled.push('phaseCap.repRest'); }
        let actionRest = readCappedPositiveNumber(spec.actionRest ?? item.actionRest ?? item.restBetweenSets ?? item.groupRest, actionRestDefault, lowLevelRehab ? 45 : 75);
        if (spec.actionRest === undefined && item.actionRest === undefined && item.restBetweenSets === undefined && item.groupRest === undefined) {
            autoFilled.push('actionRest');
        }
        if (caps && actionRest > caps.actionRest) { actionRest = caps.actionRest; autoFilled.push('phaseCap.actionRest'); }

        return {
            spec: { sets, reps, work, repRest, actionRest, isAlt, mode },
            autoFilled,
            warnings: autoFilled.length ? [`${item.name || '未命名动作'} 以下字段由默认值补全: ${autoFilled.join(', ')}`] : []
        };
    }

    window.planAiPure = {
        VALID_MODES,
        safeJsonParse,
        readNumber,
        parseBoolean,
        inferSpecMode,
        validateAiSpec,
        isTimedAiAction,
        phaseIntensityCaps,
        coerceAiSpec,
        normalizeAiCategory
    };
})();
