// @ts-nocheck
(function () {
    if (window.strengthForm) return;

    const DEFAULTS = {
        sets: 3,
        reps: 12,
        work: 0,
        repRest: 30,
        actionRest: 90,
        groupRest: 120
    };
    const PRESETS = {
        classic: { reps: 12, sets: 3, work: 0, repRest: 0, actionRest: 90, groupRest: 120 },
        tabata: { reps: 8, sets: 1, work: 20, repRest: 10, actionRest: 90, groupRest: 120 },
        strength55: { reps: 5, sets: 5, work: 0, repRest: 0, actionRest: 180, groupRest: 120 },
        emom30: { reps: 4, sets: 4, work: 30, repRest: 0, actionRest: 90, groupRest: 120 }
    };

    function byId(id) { return document.getElementById(id); }
    function num(id) { return Number(byId(id)?.value || 0); }

    function ensureHelper(field, text) {
        if (!field) return;
        let helper = field.querySelector('.md-field-helper');
        if (!helper) {
            helper = document.createElement('small');
            helper.className = 'md-field-helper';
            field.appendChild(helper);
        }
        helper.textContent = text || '';
        helper.classList.toggle('hidden', !text);
    }

    function applyMutualState() {
        const reps = byId('reps');
        const work = byId('work');
        const repsField = reps?.closest('.md-field');
        const workField = work?.closest('.md-field');
        const hasReps = num('reps') > 0;
        const hasWork = num('work') > 0;
        if (hasReps && document.activeElement === reps && work) work.value = '';
        if (hasWork && document.activeElement === work && reps) reps.value = '';
        const nextHasReps = num('reps') > 0;
        const nextHasWork = num('work') > 0;
        if (work) work.disabled = nextHasReps;
        if (reps) reps.disabled = nextHasWork;
        ensureHelper(workField, nextHasReps ? '与次数二选一' : '');
        ensureHelper(repsField, nextHasWork ? '与时长二选一' : '');
    }

    function fillDefaults() {
        Object.entries(DEFAULTS).forEach(([id, value]) => {
            const el = byId(id);
            if (el && el.value === '') el.value = String(value);
        });
        applyMutualState();
    }

    function applyPreset(name) {
        const preset = PRESETS[name];
        if (!preset) return;
        Object.entries(preset).forEach(([id, value]) => {
            const el = byId(id);
            if (el) el.value = String(value);
        });
        applyMutualState();
        window.haptics?.light?.();
    }

    function applyPhaseSuggestion() {
        const phase = byId('actionPhase')?.value || 'main';
        const rest = byId('actionRest');
        if (!rest || phase === 'main') return;
        const current = Number(rest.value || DEFAULTS.actionRest);
        rest.value = String(Math.max(0, Math.round(current / 2)));
    }

    function init() {
        fillDefaults();
        if (window.strengthForm._bound) return;
        window.strengthForm._bound = true;
        ['reps', 'work'].forEach(id => byId(id)?.addEventListener('input', applyMutualState));
        byId('actionPhase')?.addEventListener('change', applyPhaseSuggestion);
    }

    window.strengthForm = { init, fillDefaults, applyPreset, applyMutualState, _bound: false };
})();
