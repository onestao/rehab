// @ts-nocheck
(function () {
    if (window.dataPlanAi) return;

    function bodyValue(id) {
        return document.getElementById?.(id)?.value || '';
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    const planAiPure = window.planAiPure;
    const {
        VALID_MODES,
        readNumber,
        coerceAiSpec,
        normalizeAiCategory,
        normalizePlanTypes,
        parsePlanAiPayload: parsePlanAiPayloadPure,
        validatePlanAiPayload: validatePlanAiPayloadPure
    } = planAiPure;

    function truncate(text, max = 160) {
        const raw = String(text || '').trim();
        return raw.length > max ? `${raw.slice(0, max)}…` : raw;
    }

    const protectedPlanTask = window.planPolicy.isProtectedPlanTask;

    const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

    function hasUserPlanMergeIntent(text = '') {
        const raw = String(text || '').trim();
        if (!raw) return false;
        return /(保留|继续|沿用|照旧|不要删|不删除|不要覆盖|不覆盖|顺延|延后|延期|推迟|挪到|移到|明天|下一次|下次)/.test(raw);
    }

    function stripPlanAiMeta(result) {
        if (!result || typeof result !== 'object') return result;
        const { meta, ...publicResult } = result;
        return publicResult;
    }

    function queryPlanAiPreview(selector) {
        if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return null;
        return document.querySelector(selector);
    }

    function queryPlanAiPreviewAll(selector) {
        if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return [];
        return Array.from(document.querySelectorAll(selector));
    }

    function formatPlanAiDateKey(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
        ].join('-');
    }

    function planAiTargetDates(ctx, mode = 'today', options = {}) {
        const explicitDates = Array.isArray(options.targetDates)
            ? options.targetDates.map((date) => String(date || '').trim()).filter(Boolean)
            : [];
        if (explicitDates.length) return explicitDates.slice(0, mode === 'week' ? 7 : 1);
        const today = String(options.startDate || options.targetDate || ctx.logicalDateKey?.() || ctx.dateKey?.(new Date()) || new Date().toISOString().slice(0, 10));
        const start = ctx.dateFromKey?.(today) || new Date(`${today}T00:00:00`);
        const length = mode === 'week' ? 7 : 1;
        return Array.from({ length }, (_, index) => {
            const date = new Date(start);
            date.setDate(date.getDate() + index);
            return formatPlanAiDateKey(date);
        });
    }

    function planAiPreviewItemName(item = {}) {
        return String(item?.name || item?.canonicalName || item?.title || '').trim();
    }

    function planAiPreviewElementName(itemEl) {
        return String(itemEl?.querySelector?.('[data-preview-name]')?.value
            || itemEl?.getAttribute?.('data-original-name')
            || itemEl?.getAttribute?.('data-preview-canonical-name')
            || '').trim();
    }

    function buildPlanAiPayloadOptions(ctx, fallbackTypes = 'rehab') {
        return {
            types: fallbackTypes,
            repairJson: (text) => window.planPolicy?.repairPlanAiJson?.(text),
            today: ctx.logicalDateKey?.() || ctx.dateKey?.(new Date()) || '',
            titleForType: (type) => ctx.planTypeMeta?.(type)?.label || '训练计划',
            actionMetaForText: (text) => window.planPolicy?.actionMetaForName?.(text) || {},
            resolveActionChoice: ({ name, item, preferredChoiceId }) => resolvePlanActionChoiceForText(ctx, name, preferredChoiceId || item?.choiceId || item?.prescriptionActionId || '')
        };
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function equipmentLabels(prefs = {}, options = []) {
        const custom = new Map((prefs.customEquipment || []).map((item) => [item.id, item.label]));
        const optionMap = new Map((options || []).map((item) => [item.id, item.label]));
        return (prefs.equipment || []).map((id) => optionMap.get(id) || custom.get(id) || id).filter(Boolean);
    }

    function splitTags(value = '') {
        return String(value || '').split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean);
    }

    // 部位词典已收编进 action-taxonomy-pure.js（boot 常驻）；保留函数壳以维持闭包内调用点不变。
    function inferBodyPart(value = '') {
        return window.actionTaxonomy?.inferBodyPart?.(value) || '';
    }

    function conditionKey(condition = {}) {
        return String(condition.id || `${condition.type || 'other'}:${condition.label || ''}:${condition.addedAt || ''}`).trim();
    }

    function normalizeCondition(condition = {}) {
        const label = String(condition.label || '').trim();
        return {
            id: conditionKey(condition),
            label,
            type: condition.type || 'other',
            severity: condition.severity || '',
            bodyPart: condition.bodyPart || inferBodyPart(`${label} ${(condition.avoid || []).join(' ')} ${condition.note || ''}`),
            avoid: Array.isArray(condition.avoid) ? condition.avoid : [],
            note: condition.note || ''
        };
    }

    function normalizeExamResult(exam = {}) {
        const item = String(exam.item || '').trim();
        const result = String(exam.result || '').trim();
        return {
            id: String(exam.id || `exam:${item}:${exam.date || ''}`).trim(),
            item,
            date: exam.date || '',
            bodyPart: exam.bodyPart || inferBodyPart(`${item} ${result} ${exam.note || ''}`),
            result,
            note: exam.note || '',
            conditionId: exam.conditionId || '',
            conditionLabel: exam.conditionLabel || ''
        };
    }

    function defaultSelectedConditionIds(profile = {}) {
        const preferred = new Set(['injury', 'surgery']);
        const selected = (profile.conditions || [])
            .filter((condition) => preferred.has(condition.type || ''))
            .map(conditionKey)
            .filter(Boolean);
        if (selected.length) return selected;
        return (profile.examResults || [])
            .map((exam) => `exam:${normalizeExamResult(exam).id}`)
            .filter(Boolean);
    }

    function currentSelectedConditionIds(ctx, profile = {}) {
        const existing = Array.isArray(ctx._planAiConditionIds) ? ctx._planAiConditionIds : defaultSelectedConditionIds(profile);
        const valid = new Set([
            ...(profile.conditions || []).map(conditionKey),
            ...(profile.examResults || []).map((exam) => `exam:${normalizeExamResult(exam).id}`)
        ]);
        return existing.filter((id) => valid.has(id));
    }

    function currentTemporaryConditions(ctx) {
        const input = bodyValue('planAiTempConditions');
        const source = input || (Array.isArray(ctx._planAiTemporaryConditions) ? ctx._planAiTemporaryConditions.join('、') : '');
        return splitTags(source).map((label, index) => ({
            id: `temp:${label}`,
            label,
            type: 'temporary',
            severity: '',
            bodyPart: inferBodyPart(label),
            avoid: [],
            note: index === 0 ? '本次生成临时指定' : ''
        }));
    }

    function buildConditionTargets(profile = {}, selectedIds = [], temporaryConditions = []) {
        const selected = new Set(selectedIds);
        const known = (profile.conditions || []).map(normalizeCondition);
        const exams = (profile.examResults || []).map(normalizeExamResult);
        const selectedExams = exams.filter((exam) => selected.has(`exam:${exam.id}`));
        const target = [
            ...known.filter((condition) => selected.has(condition.id)),
            ...selectedExams.map((exam) => ({ ...exam, type: 'exam-result', label: exam.item || exam.result || '检查结果', severity: '', avoid: [], note: [exam.result, exam.note].filter(Boolean).join('；') })),
            ...temporaryConditions
        ];
        const safetyOnly = known.filter((condition) => !selected.has(condition.id));
        const examEvidence = exams.filter((exam) => !selected.has(`exam:${exam.id}`));
        return { target, safetyOnly, examEvidence };
    }

    function partitionRehabWeeklyByConditions(rehabWeekly = [], selectedIds = [], temporaryConditions = [], profile = {}) {
        const selected = new Set(selectedIds);
        const selectedParts = new Set((profile.conditions || []).filter((condition) => selected.has(conditionKey(condition))).map((condition) => normalizeCondition(condition).bodyPart).filter(Boolean));
        (profile.examResults || []).filter((exam) => selected.has(`exam:${normalizeExamResult(exam).id}`)).forEach((exam) => {
            const part = normalizeExamResult(exam).bodyPart;
            if (part) selectedParts.add(part);
        });
        const temporaryParts = new Set(temporaryConditions.map((condition) => condition.bodyPart).filter(Boolean));
        const target = [];
        const safetyOnly = [];
        (rehabWeekly || []).forEach((week) => {
            const base = { weekStart: week.weekStart || '', visitDate: week.visitDate || '', therapistAssessment: week.therapistAssessment || '', homework: week.homework || '' };
            const targetActions = [];
            const safetyActions = [];
            (week.actions || []).forEach((action) => {
                const part = action.bodyPart || inferBodyPart(`${action.name || ''} ${action.rawDescription || ''} ${action.coachNote || ''}`);
                const linked = action.conditionId && selected.has(action.conditionId);
                const inferredMatch = !action.conditionId && part && (selectedParts.has(part) || temporaryParts.has(part));
                if (linked || inferredMatch) targetActions.push(action);
                else safetyActions.push(action);
            });
            if (targetActions.length) target.push({ ...base, actions: targetActions });
            if (safetyActions.length) safetyOnly.push({ ...base, actions: safetyActions });
        });
        return { target, safetyOnly };
    }

    function summarizeBodyPartConstraints(profile = {}, rehabWeekly = [], selectedIds = [], temporaryConditions = []) {
        const map = new Map();
        const selected = new Set(selectedIds);
        const ensure = (part) => {
            const key = String(part || '').trim();
            if (!key) return null;
            if (!map.has(key)) map.set(key, { bodyPart: key, sources: [], avoid: [], required: [], cautious: [], dropped: [], maxIntensity: '' });
            return map.get(key);
        };
        [...(profile.conditions || []), ...temporaryConditions].forEach((condition) => {
            const normalized = normalizeCondition(condition);
            const part = normalized.bodyPart || inferBodyPart(`${normalized.label || ''} ${(normalized.avoid || []).join(' ')} ${normalized.note || ''}`);
            const row = ensure(part || '其他');
            if (!row) return;
            row.sources.push(`${selected.has(normalized.id) || normalized.type === 'temporary' ? '目标病症' : '安全病症'}:${normalized.label || '未命名'}`);
            if (normalized.severity) row.maxIntensity = normalized.severity === 'severe' ? '低强度/康复优先' : (normalized.severity === 'moderate' ? '中低强度' : row.maxIntensity);
            row.avoid.push(...(normalized.avoid || []));
        });
        (profile.examResults || []).forEach((exam) => {
            const normalized = normalizeExamResult(exam);
            const row = ensure(normalized.bodyPart || '其他');
            if (!row) return;
            row.sources.push(`检查结果:${normalized.item || normalized.result || '未命名'}`);
            if (normalized.result) row.cautious.push(normalized.result.slice(0, 80));
        });
        (rehabWeekly || []).slice(0, 3).forEach((week) => {
            (week.actions || []).forEach((action) => {
                const part = action.bodyPart || inferBodyPart(`${action.name || ''} ${action.rawDescription || ''} ${action.coachNote || ''}`);
                const row = ensure(part || '其他');
                if (!row) return;
                const name = action.name || '未命名动作';
                const status = action.status || 'continued';
                const isTarget = action.conditionId && selected.has(action.conditionId);
                if (['continued', 'progressed'].includes(status)) row.required.push(name);
                if (status === 'dropped') row.dropped.push(name);
                if (status === 'new' || status === 'watch' || action.needsReview || Number(action.painLevel || 0) >= 4) row.cautious.push(`${name}${Number(action.painLevel || 0) ? `(疼痛${Number(action.painLevel || 0)}/10)` : ''}`);
                row.sources.push(`${isTarget ? '目标处方' : '安全处方'}:${week.weekStart || week.visitDate || '未知周'}:${name}`);
            });
        });
        return Array.from(map.values()).map((row) => ({
            bodyPart: row.bodyPart,
            sources: [...new Set(row.sources)].slice(0, 6),
            avoid: [...new Set(row.avoid)].slice(0, 8),
            required: [...new Set(row.required)].slice(0, 8),
            cautious: [...new Set(row.cautious)].slice(0, 8),
            dropped: [...new Set(row.dropped)].slice(0, 8),
            maxIntensity: row.maxIntensity || ''
        }));
    }

    function profileContext(profile = {}) {
        return {
            gender: profile.gender || '',
            age: profile.age || null,
            height: profile.height || null,
            weight: profile.weight || null,
            conditions: Array.isArray(profile.conditions) ? profile.conditions : [],
            examResults: Array.isArray(profile.examResults) ? profile.examResults : [],
            allergies: Array.isArray(profile.allergies) ? profile.allergies : [],
            preferences: profile.preferences || { equipment: [], sports: [] },
            vitals: profile.vitals || { restingHR: null }
        };
    }

    function formatMinutes(seconds = 0) {
        const minutes = Math.round(Number(seconds || 0) / 60);
        return minutes > 0 ? `${minutes}分钟` : '';
    }

    function summarizeActualSets(sets = []) {
        const list = (Array.isArray(sets) ? sets : []).slice(0, 8).map((set) => {
            const weight = Number(set.weightKg || 0);
            const reps = Number(set.reps || 0);
            const action = String(set.action || set.actionName || '').trim();
            const body = weight > 0 || reps > 0
                ? `${weight > 0 ? `${weight}kg` : '自重'}×${reps || 0}`
                : '';
            return [action, body, set.note ? `备注:${set.note}` : ''].filter(Boolean).join(' ');
        }).filter(Boolean);
        return list;
    }

    function summarizeTodayHistory(ctx, today) {
        return (ctx.activeRecords?.(ctx.db?.history || []) || [])
            .filter((record) => (ctx.historyDayKey?.(record) || record.dayKey || '') === today)
            .slice(-6)
            .map((record) => {
                const names = ctx.historyNames?.(record) || (record.actions || []).map((action) => action.name || '未命名');
                const actions = (record.actions || []).slice(0, 8).map((action) => ({
                    name: action.name || '',
                    phase: action.phase || '',
                    sets: Number(action.sets || 0),
                    reps: Number(action.reps || 0),
                    work: Number(action.work || 0),
                    isAlt: !!action.isAlt
                }));
                return {
                    source: record.plan ? 'plan-workout' : (record.type === 'cardio' ? 'cardio' : 'workout'),
                    minutes: formatMinutes(record.duration),
                    calories: Number(record.cardio?.calories || 0),
                    names: names.slice(0, 10),
                    actions,
                    actualSets: summarizeActualSets(record.actualSets)
                };
            });
    }

    function summarizeManualExercises(ctx, today) {
        return (ctx.activeRecords?.(ctx.db?.health?.exerciseLogs || []) || [])
            .filter((entry) => entry.date === today)
            .slice(-8)
            .map((entry) => ({
                source: 'manual-exercise',
                type: entry.type || '',
                name: ctx.exerciseLabel?.(entry.type, entry) || entry.customName || entry.type || '运动',
                minutes: Number(entry.minutes || 0),
                calories: Number(entry.calories || 0),
                distance: Number(entry.distance || 0),
                weightKg: Number(entry.weightKg || 0),
                sets: Number(entry.sets || 0),
                repsPerSet: Number(entry.repsPerSet || 0),
                note: String(entry.note || '').slice(0, 120)
            }));
    }

    function ensurePlanAiPrescriptionCatalog(ctx) {
        if (!window.actionIdentity?.ensurePrescriptionActionCatalog) return;
        const before = JSON.stringify((ctx.db?.health?.rehabWeekly || []).flatMap((week) => (week.actions || []).map((action) => action.prescriptionActionId || '')));
        window.actionIdentity.ensurePrescriptionActionCatalog(ctx.db || {});
        const after = JSON.stringify((ctx.db?.health?.rehabWeekly || []).flatMap((week) => (week.actions || []).map((action) => action.prescriptionActionId || '')));
        if (before !== after) ctx.save?.({ render: false });
    }

    function summarizeRehabWeekly(ctx, limit = 3) {
        ensurePlanAiPrescriptionCatalog(ctx);
        const prescriptionMap = new Map((window.actionIdentity?.getPrescriptionActionCatalog?.(ctx.db || {}) || []).map((item) => [item.id, item]));
        const weeks = ctx.activeRecords?.(ctx.db?.health?.rehabWeekly || []) || [];
        return weeks.slice()
            .sort((a, b) => String(b.weekStart || '').localeCompare(String(a.weekStart || '')) || Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
            .slice(0, limit)
            .map((week) => ({
                weekStart: week.weekStart || '',
                visitDate: week.visitDate || '',
                therapistAssessment: week.therapistAssessment || '',
                homework: week.homework || '',
                actions: (week.actions || []).map((action) => ({
                    actionId: action.actionId || '',
                    prescriptionActionId: action.prescriptionActionId || '',
                    name: prescriptionMap.get(action.prescriptionActionId)?.displayName || action.name || '',
                    rawName: action.name || '',
                    standardName: prescriptionMap.get(action.prescriptionActionId)?.displayName || action.name || '',
                    aliases: prescriptionMap.get(action.prescriptionActionId)?.aliases || [],
                    linkedActionId: prescriptionMap.get(action.prescriptionActionId)?.linkedActionId || '',
                    regressionIds: prescriptionMap.get(action.prescriptionActionId)?.regressionIds || [],
                    progressionIds: prescriptionMap.get(action.prescriptionActionId)?.progressionIds || [],
                    status: action.status || 'continued',
                    rawDescription: action.rawDescription || '',
                    bodyPart: action.bodyPart || '',
                    spec: action.spec || null,
                    painLevel: Number(action.painLevel || 0),
                    confidence: Number(action.confidence || 0),
                    needsReview: !!action.needsReview,
                    coachNote: action.coachNote || '',
                    progressesFrom: action.progressesFrom || null
                }))
            }));
    }

    function summarizePrescriptionActionCatalog(ctx, rehabWeekly = null) {
        ensurePlanAiPrescriptionCatalog(ctx);
        const scopedIds = Array.isArray(rehabWeekly)
            ? new Set(rehabWeekly.flatMap((week) => (week.actions || []).map((action) => action.prescriptionActionId).filter(Boolean)))
            : null;
        const catalog = (window.actionIdentity?.getPrescriptionActionCatalog?.(ctx.db || {}) || [])
            .filter((item) => !scopedIds || scopedIds.has(item.id));
        const byId = new Map(catalog.map((item) => [item.id, item]));
        return catalog.map((item) => ({
            id: item.id,
            displayName: item.displayName,
            aliases: item.aliases || [],
            linkedActionId: item.linkedActionId || '',
            linkedActionName: item.linkedActionId ? (ctx.db?.actions || []).find((action) => action.id === item.linkedActionId)?.name || '' : '',
            regression: (item.regressionIds || []).map((id) => byId.get(id)?.displayName || id),
            progression: (item.progressionIds || []).map((id) => byId.get(id)?.displayName || id),
            bodyPart: item.bodyPart || '',
            conditionLabel: item.conditionLabel || '',
            latestStatus: item.latestStatus || '',
            latestPainLevel: Number(item.latestPainLevel || 0),
            defaultSpec: item.defaultSpec || null
        }));
    }

    const normalizePlanActionSearchText = (value = '') => String(value || '')
        .trim()
        .replace(/[\s·•、，。；;:：()（）【】\[\]_-]+/g, '')
        .toLowerCase();

    function planActionSpecFingerprint(spec = {}) {
        const normalized = coerceAiSpec({ spec }).spec || {};
        return ['sets', 'reps', 'work', 'repRest', 'actionRest', 'isAlt', 'mode']
            .map((key) => `${key}:${normalized[key] ?? ''}`)
            .join('|');
    }

    function planActionSpecFromSource(source = {}, category = 'main') {
        const spec = isPlainObject(source.spec) ? source.spec
            : isPlainObject(source.suggestedSpec) ? source.suggestedSpec
                : isPlainObject(source.prescription) ? source.prescription
                    : {};
        const merged = {
            ...spec,
            sets: spec.sets ?? source.sets,
            reps: spec.reps ?? source.reps ?? source.repsPerSet,
            work: spec.work ?? source.work ?? source.duration,
            repRest: spec.repRest ?? source.repRest,
            actionRest: spec.actionRest ?? source.actionRest ?? source.rest,
            isAlt: spec.isAlt ?? source.isAlt,
            mode: spec.mode ?? source.mode
        };
        return coerceAiSpec({ name: source.name || source.title || source.actionName || '', category, spec: merged }).spec;
    }

    function planActionChoiceCategory(source = {}, fallback = 'main') {
        const text = source.category || source.phase || source.type || source.section || '';
        return normalizeAiCategory(text || window.planPolicy?.inferCategory?.(text, source.name || source.title || source.actionName || '') || fallback);
    }

    function planActionChoiceMeta(choice = {}) {
        const meta = window.planPolicy?.actionMetaForName?.([choice.name, choice.rawDescription, choice.description, choice.note].filter(Boolean).join(' ')) || {};
        return {
            ...choice,
            actionKey: choice.actionKey || meta.actionKey || '',
            canonicalName: choice.canonicalName || meta.canonicalName || choice.name || '',
            progressionGroup: choice.progressionGroup || meta.progressionGroup || '',
            progressionLevel: Number(choice.progressionLevel ?? meta.progressionLevel ?? 0),
            chainId: choice.chainId || meta.chainId || ''
        };
    }

    function buildPlanActionChoiceCatalog(ctx) {
        const choices = [];
        const seen = new Set();
        const active = (list) => ctx.activeRecords?.(list || []) || (Array.isArray(list) ? list.filter((item) => item && !item.deleted && !item.deletedAt) : []);
        const addChoice = (choice = {}) => {
            const name = String(choice.name || '').trim();
            if (!name) return;
            const source = choice.source || 'action-library';
            const sourceId = String(choice.refId || choice.sourceActionId || choice.prescriptionActionId || choice.routineId || name);
            const key = `${source}:${sourceId}:${normalizePlanActionSearchText(name)}`;
            if (seen.has(key)) return;
            seen.add(key);
            const category = planActionChoiceCategory(choice, 'main');
            const enriched = planActionChoiceMeta({
                ...choice,
                id: key,
                name,
                category,
                spec: planActionSpecFromSource(choice, category)
            });
            enriched.searchText = [
                enriched.name,
                enriched.canonicalName,
                enriched.sourceLabel,
                enriched.routineName,
                enriched.rawDescription,
                enriched.description,
                enriched.note,
                Array.isArray(enriched.aliases) ? enriched.aliases.join(' ') : '',
                Array.isArray(enriched.tags) ? enriched.tags.join(' ') : '',
                // 归一化部位（如「膝盖」→「膝」），让搜索枚举键能命中自由文本部位。
                window.actionTaxonomy?.normalizeBodyPart?.(enriched.bodyPart) || ''
            ].filter(Boolean).join(' ');
            choices.push(enriched);
        };
        if (window.actionIdentity?.ensurePrescriptionActionCatalog) {
            window.actionIdentity.ensurePrescriptionActionCatalog(ctx.db || {});
        }
        (window.actionIdentity?.getPrescriptionActionCatalog?.(ctx.db || {}) || []).forEach((action) => addChoice({
            ...action,
            name: action.displayName || action.name || '',
            source: 'prescription',
            sourceLabel: '处方动作',
            refId: action.id,
            prescriptionActionId: action.id,
            sourceActionId: action.linkedActionId || '',
            rawDescription: [
                (action.aliases || []).filter((name) => name !== action.displayName).join('、'),
                action.bodyPart,
                action.conditionLabel
            ].filter(Boolean).join(' · '),
            spec: action.defaultSpec || null
        }));
        summarizeRehabWeekly(ctx, 8).forEach((week, weekIndex) => {
            (week.actions || []).forEach((action, actionIndex) => addChoice({
                ...action,
                source: 'prescription',
                sourceLabel: '处方动作',
                refId: action.prescriptionActionId || action.actionId || `${week.weekStart || week.visitDate || weekIndex}:${actionIndex}`,
                prescriptionActionId: action.prescriptionActionId || action.actionId || '',
                weekStart: week.weekStart || '',
                name: action.standardName || action.name || '',
                aliases: action.aliases || [],
                rawDescription: action.rawDescription || action.coachNote || ''
            }));
        });
        active(ctx.db?.actions || []).forEach((action) => {
            if (action.libOnly !== true) return;
            addChoice({
                ...action,
                source: 'action-library',
                sourceLabel: '动作库',
                refId: action.id || action.name,
                sourceActionId: action.id || action.sourceActionId || '',
                description: action.description || action.note || ''
            });
        });
        active(ctx.db?.routines || []).forEach((routine) => {
            (routine.actions || []).forEach((action, actionIndex) => addChoice({
                ...action,
                source: 'routine-library',
                sourceLabel: '方案库',
                routineId: routine.id || '',
                routineName: routine.name || routine.title || '',
                refId: `${routine.id || routine.name || 'routine'}:${action.sourceActionId || action.id || actionIndex}`,
                sourceActionId: action.sourceActionId || action.id || '',
                description: [routine.name || routine.title, action.description || action.note].filter(Boolean).join(' ')
            }));
        });
        return choices;
    }

    function renderPlanActionChoiceHtml(ctx, choices = [], applyMethod = 'applyPlanActionChoiceToPreview') {
        const esc = ctx.escapeHtml ? ctx.escapeHtml.bind(ctx) : (value) => String(value ?? '');
        if (!choices.length) return '<div class="plan-action-choice-empty">没有匹配的处方或动作库动作</div>';
        return choices.map((choice) => {
            const meta = [choice.sourceLabel, choice.routineName, choice.weekStart].filter(Boolean).join(' · ');
            const detail = choice.rawDescription || choice.description || choice.note || '';
            return `<button class="plan-action-choice" type="button" data-plan-action-choice-id="${esc(choice.id)}" onclick="data.${applyMethod}(this)"><span><strong>${esc(choice.name)}</strong><small>${esc(meta || '动作')}</small></span>${detail ? `<em>${esc(truncate(detail, 60))}</em>` : ''}</button>`;
        }).join('');
    }

    function planActionChoiceMatchesText(choice = {}, text = '') {
        const needle = normalizePlanActionSearchText(text);
        if (!needle || !choice) return false;
        const values = [choice.name, choice.canonicalName, ...(Array.isArray(choice.aliases) ? choice.aliases : [])]
            .map((value) => normalizePlanActionSearchText(value))
            .filter(Boolean);
        if (values.some((value) => value === needle)) return true;
        const textMeta = window.planPolicy?.actionMetaForName?.(text) || {};
        if (textMeta.actionKey && choice.actionKey && textMeta.actionKey === choice.actionKey) return true;
        return choice.source === 'prescription'
            && values.some((value) => value.length >= 3 && (needle.includes(value) || value.includes(needle)));
    }

    function resolvePlanActionChoiceForText(ctx, text = '', preferredChoiceId = '') {
        const preferred = preferredChoiceId ? ctx.findPlanActionChoiceById?.(preferredChoiceId) : null;
        if (preferred) return preferred;
        const meta = window.planPolicy?.actionMetaForName?.(text) || {};
        const queries = [...new Set([text, meta.canonicalName].filter(Boolean))];
        const exact = queries
            .flatMap((query) => ctx.searchPlanActionChoices?.(query, 12) || [])
            .find((choice) => planActionChoiceMatchesText(choice, text));
        return exact || null;
    }

    function setPlanActionChoiceAttrs(el, choice = {}, prefix = 'data-preview') {
        if (!el) return;
        const attrs = {
            [`${prefix}-choice-id`]: choice.id || '',
            [`${prefix}-choice-source`]: choice.source || '',
            [`${prefix}-choice-source-label`]: choice.sourceLabel || '',
            [`${prefix}-action-key`]: choice.actionKey || '',
            [`${prefix}-canonical-name`]: choice.canonicalName || choice.name || '',
            [`${prefix}-progression-group`]: choice.progressionGroup || '',
            [`${prefix}-progression-level`]: choice.progressionLevel ?? '',
            [`${prefix}-chain-id`]: choice.chainId || '',
            [`${prefix}-source-action-id`]: choice.sourceActionId || '',
            [`${prefix}-prescription-action-id`]: choice.prescriptionActionId || ''
        };
        Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value || '')));
    }

    function applyPlanActionChoiceToFields(root, choice = {}) {
        if (!root) return;
        const setValue = (selector, value) => {
            const el = root.querySelector?.(selector);
            if (el && value !== undefined && value !== null && value !== '') el.value = value;
        };
        const setChecked = (selector, value) => {
            const el = root.querySelector?.(selector);
            if (el) el.checked = !!value;
        };
        const spec = choice.spec || planActionSpecFromSource(choice, choice.category || 'main');
        setValue('[data-preview-name], #planEditName', choice.name || '');
        setValue('[data-preview-category], #planEditCategory', choice.category || 'main');
        setValue('[data-preview-mode]', spec.mode || 'reps');
        setValue('[data-preview-sets], #planEditSets', Number(spec.sets || 1));
        setValue('[data-preview-reps], #planEditReps', Number(spec.reps || 0));
        setValue('[data-preview-work], #planEditWork', Number(spec.work || 0));
        setValue('[data-preview-rep-rest], #planEditRepRest', Number(spec.repRest || 0));
        setValue('[data-preview-rest], #planEditRest', Number(spec.actionRest || 45));
        setChecked('[data-preview-is-alt], #planEditIsAlt', !!spec.isAlt);
        const reason = root.querySelector?.('[data-preview-reason], #planEditReason');
        if (reason && !String(reason.value || '').trim()) reason.value = `${choice.sourceLabel || '已选动作'}：${choice.name || ''}`;
    }

    window.dataPlanAi = {
        planAiQuickPrompts() {
            return [
                '+ 新建训练计划',
                '优化我现有的计划',
                '根据今日反馈调整明天'
            ];
        },

        planAiTypeOptions() {
            return ['rehab', 'cut', 'bulk', 'maintenance', 'custom'];
        },

        planActionChoiceCatalog() {
            return buildPlanActionChoiceCatalog(this);
        },

        searchPlanActionChoices(query = '', limit = 8) {
            const needle = normalizePlanActionSearchText(query);
            const ranked = (this.planActionChoiceCatalog?.() || []).map((choice, index) => {
                const name = normalizePlanActionSearchText(choice.name);
                const canonical = normalizePlanActionSearchText(choice.canonicalName);
                const haystack = normalizePlanActionSearchText(choice.searchText || '');
                let score = 0;
                if (!needle) score = choice.source === 'prescription' ? 40 : 20;
                else if (name === needle || canonical === needle) score = 100;
                else if (name.startsWith(needle) || canonical.startsWith(needle)) score = 80;
                else if (name.includes(needle) || canonical.includes(needle)) score = 65;
                else if (haystack.includes(needle)) score = 45;
                if (choice.source === 'prescription') score += 12;
                if (choice.source === 'action-library') score += 6;
                return { choice, score, index };
            }).filter((entry) => entry.score > 0);
            return ranked.sort((a, b) => b.score - a.score || a.index - b.index).slice(0, limit).map((entry) => entry.choice);
        },

        findPlanActionChoiceById(choiceId = '') {
            const id = String(choiceId || '');
            if (!id) return null;
            return (this.planActionChoiceCatalog?.() || []).find((choice) => [choice.id, choice.prescriptionActionId, choice.sourceActionId].some((value) => String(value || '') === id)) || null;
        },

        resolvePlanActionChoiceForText(text = '', preferredChoiceId = '') {
            return resolvePlanActionChoiceForText(this, text, preferredChoiceId);
        },

        renderPlanActionSuggestions(input) {
            const itemEl = input?.closest?.('.plan-ai-preview-item');
            const box = itemEl?.querySelector?.('[data-plan-action-suggestions]');
            if (!box) return;
            box.innerHTML = renderPlanActionChoiceHtml(this, this.searchPlanActionChoices(input?.value || '', 6), 'applyPlanActionChoiceToPreview');
        },

        applyPlanActionChoiceToPreview(button) {
            const itemEl = button?.closest?.('.plan-ai-preview-item');
            const choice = this.findPlanActionChoiceById?.(button?.getAttribute?.('data-plan-action-choice-id') || '');
            if (!itemEl || !choice) return;
            applyPlanActionChoiceToFields(itemEl, choice);
            setPlanActionChoiceAttrs(itemEl, choice, 'data-preview');
            const box = itemEl.querySelector?.('[data-plan-action-suggestions]');
            if (box) box.innerHTML = '';
        },

        renderPlanEditActionSuggestions(input) {
            const box = document.getElementById?.('planEditActionSuggestions');
            if (!box) return;
            box.innerHTML = renderPlanActionChoiceHtml(this, this.searchPlanActionChoices(input?.value || '', 6), 'applyPlanActionChoiceToEdit');
        },

        applyPlanActionChoiceToEdit(button) {
            const choice = this.findPlanActionChoiceById?.(button?.getAttribute?.('data-plan-action-choice-id') || '');
            const modal = document.getElementById?.('planEditName')?.closest?.('.modal-body') || document;
            if (!choice) return;
            applyPlanActionChoiceToFields(modal, choice);
            setPlanActionChoiceAttrs(document.getElementById?.('planEditName'), choice, 'data-plan-edit');
            const box = document.getElementById?.('planEditActionSuggestions');
            if (box) box.innerHTML = '';
        },

        renderPlanAiTypeChips(typesInput = 'rehab') {
            const selected = new Set(normalizePlanTypes(typesInput));
            return this.planAiTypeOptions().map((type) => {
                const info = this.planTypeMeta?.(type) || { label: type, icon: 'event_note' };
                const active = selected.has(type);
                return `<button class="md-chip plan-ai-type-chip ${active ? 'active' : ''}" type="button" onclick="data.togglePlanAiType('${type}')" aria-pressed="${active}"><span class="material-symbols-rounded">${this.escapeHtml(info.icon || 'event_note')}</span>${this.escapeHtml(info.label)}</button>`;
            }).join('');
        },

        renderPlanAiModeChips(mode = 'today') {
            const current = mode === 'week' ? 'week' : 'today';
            return [['today', '今日'], ['week', '7天']].map(([key, label]) => {
                const active = current === key;
                return `<button class="md-chip plan-ai-mode-chip ${active ? 'active' : ''}" type="button" data-plan-ai-mode="${key}" onclick="data.togglePlanAiMode('${key}')" aria-pressed="${active}">${label}</button>`;
            }).join('');
        },

        renderPlanAiConditionChips() {
            const profile = profileContext(this.db.health?.profile || {});
            const selected = new Set(currentSelectedConditionIds(this, profile));
            const conditions = (profile.conditions || []).map(normalizeCondition).filter((condition) => condition.label);
            const exams = (profile.examResults || []).map(normalizeExamResult).filter((exam) => exam.item || exam.result);
            if (!conditions.length && !exams.length) return '<div class="plan-ai-condition-empty">健康档案暂无诊断/检查结果；可在下方填写本次临时病症。</div>';
            const conditionHtml = conditions.map((condition) => {
                const active = selected.has(condition.id);
                const meta = [condition.bodyPart, condition.severity].filter(Boolean).join(' · ');
                return `<button class="md-chip plan-ai-condition-chip ${active ? 'active' : ''}" type="button" data-plan-ai-condition-id="${this.escapeHtml(condition.id)}" onclick="data.togglePlanAiConditionFromEvent(event)" aria-pressed="${active}">${this.escapeHtml(condition.label)}${meta ? `<small>${this.escapeHtml(meta)}</small>` : ''}</button>`;
            }).join('');
            const examHtml = exams.map((exam) => {
                const id = `exam:${exam.id}`;
                const active = selected.has(id);
                const label = exam.item || exam.result || '检查结果';
                const meta = [exam.bodyPart, exam.date].filter(Boolean).join(' · ');
                return `<button class="md-chip plan-ai-condition-chip plan-ai-exam-chip ${active ? 'active' : ''}" type="button" data-plan-ai-condition-id="${this.escapeHtml(id)}" onclick="data.togglePlanAiConditionFromEvent(event)" aria-pressed="${active}">${this.escapeHtml(label)}${meta ? `<small>${this.escapeHtml(meta)}</small>` : ''}</button>`;
            }).join('');
            return [conditionHtml, examHtml].filter(Boolean).join('');
        },

        refreshPlanAiConditionChips() {
            const row = document.getElementById('planAiConditionChipRow');
            if (row) row.innerHTML = this.renderPlanAiConditionChips();
        },

        togglePlanAiCondition(conditionId = '') {
            const profile = profileContext(this.db.health?.profile || {});
            const valid = new Set([
                ...(profile.conditions || []).map(conditionKey),
                ...(profile.examResults || []).map((exam) => `exam:${normalizeExamResult(exam).id}`)
            ]);
            const id = String(conditionId || '');
            if (!valid.has(id)) return;
            const set = new Set(currentSelectedConditionIds(this, profile));
            if (set.has(id)) set.delete(id);
            else set.add(id);
            this._planAiConditionIds = [...set];
            this.refreshPlanAiConditionChips();
        },

        togglePlanAiConditionFromEvent(event) {
            const id = event?.currentTarget?.getAttribute?.('data-plan-ai-condition-id') || '';
            this.togglePlanAiCondition(id);
        },

        buildPlanAiContext(mode = 'today', userText = '', typesInput = 'rehab', options = {}) {
            const prefs = this.ensurePlanPrefs?.() || {};
            const tpl = window.dataAiTemplates;
            const prefResult = tpl?.buildPromptMessages('plan_generate', {}, this.db) || {};
            const prefSys = prefResult.messages?.find(m => m.role === 'system')?.content || '';
            const prefTagsStr = prefResult.prefTags || '';
            const today = this.logicalDateKey?.() || this.dateKey(new Date());
            const types = normalizePlanTypes(typesInput);
            const metas = types.map((type) => this.planTypeMeta?.(type) || { label: '训练计划' });
            const prefEquipment = equipmentLabels(prefs, this.planEquipmentOptions?.() || []);
            const profile = profileContext(this.db.health?.profile || {});
            const selectedConditionIds = currentSelectedConditionIds(this, profile);
            const temporaryConditions = currentTemporaryConditions(this);
            const conditionTargets = buildConditionTargets(profile, selectedConditionIds, temporaryConditions);
            const profileEquipment = Array.isArray(profile.preferences?.equipment) ? profile.preferences.equipment : [];
            const allEquipment = [...new Set([...prefEquipment, ...profileEquipment].map((item) => String(item || '').trim()).filter(Boolean))];
            const todayCompleted = {
                date: today,
                workouts: summarizeTodayHistory(this, today),
                manualExercises: summarizeManualExercises(this, today)
            };
            const rehabWeekly = summarizeRehabWeekly(this, 6);
            const prescriptionCatalog = summarizePrescriptionActionCatalog(this, rehabWeekly);
            const rehabByCondition = partitionRehabWeeklyByConditions(rehabWeekly, selectedConditionIds, temporaryConditions, profile);
            const bodyPartConstraints = summarizeBodyPartConstraints(profile, rehabWeekly, selectedConditionIds, temporaryConditions);
            const recentPlans = this.activeRecords(this.db.dailyPlans || [])
                .filter((plan) => types.includes(plan.type || 'rehab'))
                .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
                .slice(0, 14)
                .map((plan) => ({
                date: plan.date,
                type: plan.type || 'rehab',
                title: plan.title || '',
                notes: plan.notes,
                completion: this.completionRate?.(plan),
                items: (plan.items || []).filter((item) => !item.deleted).map((item) => ({
                    name: item.name,
                    status: item.status,
                    currentLevel: item.currentLevel,
                    feedback: item.feedback || null,
                    userOverride: !!item.userOverride
                }))
            }));
            const targetDates = planAiTargetDates(this, mode, options);
            const currentTargetPlans = this.activeRecords(this.db.dailyPlans || [])
                .filter((plan) => targetDates.includes(plan.date) && types.includes(plan.type || 'rehab'))
                .map((plan) => ({
                    id: plan.id || '',
                    date: plan.date,
                    type: plan.type || 'rehab',
                    title: plan.title || '',
                    notes: plan.notes || '',
                    completion: this.completionRate?.(plan),
                    items: (plan.items || []).filter((item) => item && !item.deleted).map((item) => {
                        let progressionSignal = undefined;
                        const meta = window.planPolicy?.actionMetaForName?.(item.name || '') || {};
                        const chainId = item.chainId || meta.chainId || '';
                        if (chainId && window.planProgression?.evaluate) {
                            const chain = window.planChains?.find?.(chainId) || window.planChains?.get?.(chainId);
                            progressionSignal = window.planProgression.evaluate({
                                taskItem: item,
                                chain,
                                history: this.buildFeedbackHistory?.(chainId, item) || item.progressionHistory || [],
                                planType: plan.type
                            });
                        }
                        return {
                            id: item.id || '',
                            name: item.name || '',
                            category: item.category || 'main',
                            status: item.status || 'todo',
                            spec: item.spec || {},
                            currentLevel: item.currentLevel ?? null,
                            actionKey: item.actionKey || meta.actionKey || '',
                            progressionGroup: item.progressionGroup || meta.progressionGroup || '',
                            progressionLevel: item.progressionLevel ?? meta.progressionLevel ?? null,
                            feedback: item.feedback || null,
                            userOverride: !!item.userOverride,
                            aiReasoning: item.aiReasoning || '',
                            bodyPart: inferBodyPart(`${item.name || ''} ${item.aiReasoning || ''}`),
                            progressionSignal
                        };
                    })
                }));
            const missedCandidates = typeof this.detectMissedPlanCandidates === 'function'
                ? this.detectMissedPlanCandidates({ targetDate: today, types, lookbackDays: 3 }).slice(0, 12)
                : [];
            const adjustmentPrefs = this.db.planAdjustmentPrefs || {};
            const policyContext = window.planPolicy?.buildPlanPolicyContext?.({
                db: this.db || {},
                activeRecords: this.activeRecords?.bind(this),
                sourcePlans: this.activeRecords(this.db.dailyPlans || []),
                types
            });
            const userSpecRule = /(\d+\s*(组|次|秒|分钟|min)|次数|时长|每组|保持|休息)/i.test(userText)
                ? '用户补充中的次数/组数/时长/休息=硬约束，写入 spec.sets/reps/work/repRest/actionRest；不安全则 aiReasoning 说明替代值。'
                : '';
            const planJsonShape = '{"date":"YYYY-MM-DD","type":"<rehab|cut|bulk|maintenance|custom>","title":"...","notes":"...","items":[{"name":"...","prescriptionActionId":"","category":"<warmup|main|cooldown>","chainHint":"","spec":{"sets":<int>,"reps":<int>,"work":<int>,"repRest":<int>,"actionRest":<int>,"isAlt":<bool>,"mode":"<reps|hold|alt-reps|alt-hold>"},"cooldownRefs":[],"aiReasoning":"...","durationEstHint":"","requiresUserConfirm":false}]}';
            const promptMode = mode === 'week'
                ? `输出严格 JSON：{"plans":[${planJsonShape}]}`
                : `请输出严格 JSON，结构为：${planJsonShape}`;
            const specRules = [
                '只输出 JSON 本体，不要使用 Markdown 代码块、不要前后加自然语言、不要注释。所有数值字段必须是 number 类型，布尔字段必须是 true/false，禁止用字符串如 "3"、"true"。',
                '字段必填: name、category(warmup/main/cooldown)、spec.sets≥1/reps≥0/work>0/repRest 0..30/actionRest 0..90/isAlt/mode；缺失、0、空都不合规。',
                'spec.mode 决定动作类型，必须从以下四选一：',
                '  mode="reps"：次数动作（如深蹲、俯卧撑）→ reps≥1, work≥1（每次动作秒数）, isAlt=false',
                '  mode="hold"：静态保持（如靠墙静蹲、平板支撑）→ reps=0, work≥15（保持秒数）, isAlt=false',
                '  mode="alt-reps"：双侧交替次数（如侧弓步、单臂划船）→ reps≥1, work≥1, isAlt=true',
                '  mode="alt-hold"：双侧交替保持（如单腿站立）→ reps=0, work≥15, isAlt=true',
                'category 只能是 warmup（热身）/ main（主训练）/ cooldown（拉伸放松）三选一；不要使用其他词。',
                '阶段难度必须分层：warmup 只用于准备身体，1-2组低中强度；cooldown 只用于拉伸/呼吸/恢复，1-2组低强度，不得作为进阶加量对象；main 才承载主要训练负荷。',
                'work: 次数动作2-5秒，保持/拉伸20-45秒；拿不准用 reps=12,work=3。repRest: 0-10秒，慢速高强度最多15；actionRest: 康复15-30，主训30-60，大复合最多75。',
                '必须参考今日已完成运动摘要；今日同动作/同部位已高强度训练时，后续降负荷或改恢复，除非用户要求加量。'
            ].join('\n');
            const overwriteRules = [
                '当前计划覆盖规则: 你正在重写目标日期/类型的计划，而不是只追加动作。必须先参考“目标当前计划完整摘要”。',
                '同日期同类型保存时客户端会保留已完成任务和用户锁定(userOverride=true)任务；你输出的 items 应作为未完成未锁定部分的替代方案。',
                '若当前计划中的未完成动作仍安全且符合最新处方，可保留或微调；若与禁忌、dropped 处方、疼痛>=4/10 或部位排程冲突，必须替换、降级或移到其他日期。',
                '【极其重要：动作进阶与降阶规则】',
                '1. 如果某动作包含了 progressionSignal，你必须严格遵守其 decision 字段的建议（hold/progress/deload/volume-up）。',
                '2. 如果 progressionSignal.decision 为 "progress"，并且提供了 chainAlternatives，你可以从中选择一个进阶动作替换原动作。',
                '3. 如果 progressionSignal.decision 为 "deload"，你可以减少 sets/work/reps 或从 chainAlternatives 选择一个降阶动作。',
                '4. 如果 progressionSignal.decision 为 "volume-up"，建议只增加 sets。',
                '5. 如果 progressionSignal.decision 为 "hold"，严禁替换该动作，维持原有动作和原有规格。',
                '6. 不要随意调整原本已适应良好动作（无 progressionSignal 要求调整）的难度或更换不同动作，以免引起 "莫名其妙的降阶或变动"。',
                '7. 不要无脑堆砌容量（如超过 5 组），如果连续合适，应该优先增加负荷、换高阶动作（如 progressionSignal 所述）。'
            ].join('\n');
            const conditionRules = [
                '病症目标规则: 本次康复计划必须围绕“本次选中训练病症/检查结果”制定；即使某个目标没有对应康复中心处方，也要根据诊断、检查结果、严重程度、禁忌和器材安排中低风险训练。',
                '检查结果规则: 有诊断时检查结果用于细化风险、部位和动作选择；诊断潦草或没有诊断时，可依赖检查结果作为目标来源，但必须更保守并要求用户确认。',
                '目标病症有对应处方时，相关处方是强规则；目标病症没有处方时，可推荐中低风险动作，但必须在 aiReasoning 中写明“非处方建议/需用户确认/风险点”。',
                '未选中病症不能驱动主训练动作；它们只作为安全限制，尤其是禁忌、dropped、watch、疼痛>=4/10 的动作或部位。',
                '不要把不同病症的处方混用：每个康复动作必须能说明服务于哪个目标病症或为什么只是安全替代。'
            ].join('\n');
            const bodyPartRules = mode === 'week'
                ? '部位排程规则: 生成 7 天计划时必须按 bodyPart 分配频次和恢复日；同一疼痛/损伤部位避免连续高负荷训练，优先把处方 required 动作分散到合适日期；cautious/new/watch 动作只能低强度观察，不得自动加量；dropped/avoid 动作不得出现。'
                : '部位排程规则: 生成今日计划时按 warmup → 处方/主训练 → 辅助 → cooldown 排序；同一 bodyPart 动作可分段聚合，但疼痛/损伤部位不得连续高负荷，必须穿插恢复、低强度技术练习或放松；dropped/avoid 动作不得出现。';
            const confirmationRules = '确认规则: 任何非康复中心处方、仅基于诊断推断的中低风险康复动作，requiresUserConfirm 必须为 true，userConfirmed 必须为 false，且 aiReasoning 必须醒目说明“非医嘱新增，需要用户确认”；来自目标病症处方且无疼痛/低置信问题的动作可为 false。';
            const rehabPolicyRules = [
                '自动调整风格: 平衡。最新医嘱是强约束，但“之前动作可以继续做”表示历史稳定动作可作为候选，不代表必须把所有旧动作塞回计划。',
                '动作链: 基础臀桥 -> 夹砖臀桥 -> 骨盆内收夹砖臀桥 是同一条进阶链；单腿臀桥只在“哪侧不稳”条件满足时作为待确认动作，不得自动替代该链。',
                '用户真实体验反馈优先: 疼痛部位、疼痛分数、RPE、不想继续、不再加量、保持下次、不适合都会影响进阶。若用户选择不再加量/保持下次，必须 hold；疼痛>=4 或不适合必须降载或等待确认。',
                '非医嘱新增动作必须在输出中 requiresUserConfirm=true、userConfirmed=false；不要把它伪装成处方动作。'
            ].join('\n');
            const typeInstructions = types.map((type, index) => `${index + 1}. ${type} / ${this.planTypeMeta?.(type)?.label || type}`).join('\n');
            return [
                prefSys || '你是训练日程计划助手。只输出严格 JSON 文本，不要 Markdown 代码块、不要解释、不要追加任何说明。',
                promptMode,
                specRules,
                overwriteRules,
                conditionRules,
                rehabPolicyRules,
                bodyPartRules,
                confirmationRules,
                'spec sets/reps/work/repRest/actionRest/isAlt/mode 必须显式填写；拿不准按默认值，不能省略或填0/空。mode 要匹配动作。',
                mode === 'week'
                    ? `目标日期列表:${JSON.stringify(targetDates)};${types.length > 1 ? `每日期每类型1 plan,共 ${targetDates.length * types.length} 个 plan:${typeInstructions}` : `每天1个${types[0]} plan,共 ${targetDates.length} 个 plan`}`
                    : (types.length > 1
                        ? `本次需要同时生成多个计划类型，请分别输出到 plans 数组中，每个选中类型各生成 1 个 plan：\n${typeInstructions}`
                        : `计划类型: ${types[0]} / ${metas[0]?.label || '训练计划'}`),
                `训练阶段: ${prefs.customStageLabel || prefs.stage || 'unset'}`,
                `设计偏好装备: ${prefEquipment.join(', ') || '无'}`,
                `健康档案装备偏好: ${profileEquipment.join(', ') || '无'}`,
                `最终可用装备池: ${allEquipment.join(', ') || '无'}`,
                `本次选中训练病症: ${JSON.stringify(conditionTargets.target)}`,
                `未选中病症安全限制: ${JSON.stringify(conditionTargets.safetyOnly)}`,
                `检查结果证据/安全背景: ${JSON.stringify(conditionTargets.examEvidence || [])}`,
                `训练计划策略上下文: ${JSON.stringify(policyContext?.summary || policyContext || {})}`,
                `目标当前计划完整摘要: ${JSON.stringify(currentTargetPlans)}`,
                `漏练补偿候选: ${JSON.stringify(missedCandidates)}`,
                `计划调整偏好约束: ${JSON.stringify(adjustmentPrefs)}`,
                `今日已完成运动摘要: ${JSON.stringify(todayCompleted)}`,
                `近6周康复中心处方: ${JSON.stringify(rehabWeekly)}`,
                `处方动作标准库: ${JSON.stringify(prescriptionCatalog)}`,
                '处方动作标准库规则: 生成动作时优先使用 displayName；来自处方动作标准库或近6周处方的动作必须原样回填 prescriptionActionId，非处方动作留空；aliases 只是识别同一动作的历史写法；linkedActionId 表示可参考普通动作库参数；regression/progression 表示退阶/进阶，只能按疼痛、RPE 和用户反馈选择。不要把关联动作当成合并动作。',
                `选中病症相关处方强规则: ${JSON.stringify(rehabByCondition.target)}`,
                `其他病症处方安全限制: ${JSON.stringify(rehabByCondition.safetyOnly)}`,
                `诊断/处方部位约束: ${JSON.stringify(bodyPartConstraints)}`,
                rehabWeekly.length ? '康复处方规则: 必须优先遵守最近3周康复中心处方；continued/progressed 动作应保留或参考；dropped 动作不能出现在计划中；new/watch/needsReview 动作不得自动加量，疼痛>=4/10 只能降级或替换。第4-6周处方仅用于理解长期禁忌、反复疼痛和动作演变。' : '',
                '冲突优先级: 安全/健康禁忌/疼痛阈值 > 最近3周康复处方 > 当前计划保留/改造 > 用户临时目标。',
                userSpecRule,
                `最近 7 天对应类型计划摘要: ${JSON.stringify(recentPlans)}`,
                `健康档案: ${JSON.stringify(profile)}`,
                `目标类型: ${String(this.db.health?.dietGoal?.goalType || this.db.health?.goalType || '')}`,
                prefTagsStr ? `偏好参数:\n${prefTagsStr}` : '',
                `用户补充: ${userText || '无'}`
            ].join('\n');
        },

        openPlanAiSheet(mode = 'today', typesInput = 'rehab') {
            mode = mode === 'week' ? 'week' : 'today';
            const sheet = document.getElementById('planAiSheet');
            const body = document.getElementById('planAiSheetBody');
            if (!sheet || !body) return;
            const types = normalizePlanTypes(typesInput);
            const meta = this.planTypeMeta?.(types[0]) || { label: '训练计划', icon: 'event_note' };
            this._planAiTypes = types;
            this._planAiMode = mode;
            const profile = profileContext(this.db.health?.profile || {});
            this._planAiConditionIds = currentSelectedConditionIds(this, profile);
            body.innerHTML = `
                <div class="plan-ai-sheet">
                    <div class="plan-sheet-head">
                        <span class="material-symbols-rounded plan-head-icon">${meta.icon}</span>
                        <div>
                            <span class="cardio-kicker">生成训练计划</span>
                            <small>会自动带上健康档案、训练阶段、设计偏好装备、最近 7 天反馈和漏做项</small>
                        </div>
                    </div>
                    <div id="planAiTypeChipRow" class="plan-ai-chip-row">
                        ${this.renderPlanAiTypeChips(types)}
                    </div>
                    <div class="plan-ai-condition-head"><span>生成范围</span></div>
                    <div id="planAiModeChipRow" class="plan-ai-chip-row">
                        ${this.renderPlanAiModeChips(mode)}
                    </div>
                    <div class="plan-ai-chip-row">
                        ${this.planAiQuickPrompts().map((text) => `<button class="md-chip" type="button" onclick="data.handlePlanAiQuickPrompt('${this.escapeHtml(text)}')">${this.escapeHtml(text)}</button>`).join('')}
                    </div>
                    <div class="plan-ai-condition-box">
                        <div class="plan-ai-condition-head"><span>本次康复目标病症</span><small>未选中病症仅作为安全限制</small></div>
                        <div id="planAiConditionChipRow" class="plan-ai-chip-row plan-ai-condition-row">
                            ${this.renderPlanAiConditionChips()}
                        </div>
                        <div class="md-field">
                            <input id="planAiTempConditions" type="text" placeholder=" ">
                            <label>临时病症/部位（可选，用「、」分隔）</label>
                        </div>
                    </div>
                    <div class="md-field">
                        <textarea id="planAiPrompt" rows="5" placeholder=" "></textarea>
                        <label>告诉 AI 目标、疼痛点、保留动作或次数/时长调整</label>
                    </div>
                    <div id="planAiStatus" class="plan-ai-status" aria-live="polite">填写补充要求后点击生成，AI 会返回可编辑的计划草稿。</div>
                    <div class="md-row modal-actions">
                        <button class="md-btn" type="button" onclick="data.closePlanAiSheet()">取消</button>
                        <button id="planAiSubmitBtn" class="md-btn md-btn-filled" type="button" onclick="data.submitPlanAi()">生成</button>
                    </div>
                </div>`;
            sheet.classList.remove('hidden');
            sheet.setAttribute('aria-hidden', 'false');
            window.navStack?.push?.({ type: 'modal', id: 'planAiSheet', close: () => this.closePlanAiSheet() });
            void this.mountPlanAiPickerReady?.();
        },

        /**
         * Deterministically ensure AI picker runtime and mount plan.week / plan.today controls.
         * Replaces optional-chain no-op when ai-task-settings is not yet loaded from Today.
         */
        async mountPlanAiPickerReady() {
            const sheet = document.getElementById('planAiSheet');
            const body = document.getElementById('planAiSheetBody');
            if (!sheet || !body || !body.childElementCount) return;

            const generation = (this._planAiPickerMountGeneration = (this._planAiPickerMountGeneration || 0) + 1);
            const taskId = this._planAiMode === 'week' ? 'plan.week' : 'plan.today';

            let host = document.getElementById('planAiTaskPicker');
            if (!host) {
                host = document.createElement('div');
                host.id = 'planAiTaskPicker';
                const actions = body.querySelector('.modal-actions');
                const parent = actions?.parentElement || body;
                parent.insertBefore(host, actions || null);
            }
            host.dataset.aiTaskPicker = taskId;
            host.replaceChildren();
            const loading = document.createElement('div');
            loading.className = 'ai-task-settings-empty';
            loading.textContent = '正在加载模型…';
            host.append(loading);

            const paintError = (message) => {
                if (!host.isConnected) return;
                host.replaceChildren();
                const status = document.createElement('div');
                status.className = 'ai-task-settings-empty is-error';
                status.textContent = message;
                const retry = document.createElement('button');
                retry.type = 'button';
                retry.className = 'md-btn md-btn-tonal plan-ai-picker-retry';
                retry.textContent = '重试';
                retry.addEventListener('click', () => {
                    void this.mountPlanAiPickerReady();
                });
                host.append(status, retry);
            };

            try {
                const ensure = this.ensureAiPickerRuntime || window.data?.ensureAiPickerRuntime;
                if (typeof ensure !== 'function') {
                    throw new Error('AI 模型选择器尚未就绪');
                }
                const { taskSettings } = await ensure.call(this);
                if (generation !== this._planAiPickerMountGeneration) return;
                if (sheet.classList.contains('hidden') || !body.isConnected) return;
                if (typeof taskSettings?.mountPlanAiPicker !== 'function') {
                    throw new Error('AI 模型选择模块未注册');
                }
                taskSettings.mountPlanAiPicker({ force: true });
            } catch (error) {
                if (generation !== this._planAiPickerMountGeneration) return;
                window.errorBus?.report?.('plan.aiPicker', error);
                paintError(error?.message || '模型加载失败，请重试');
            }
        },

        closePlanAiSheet() {
            const sheet = document.getElementById('planAiSheet');
            sheet?.classList.add('hidden');
            sheet?.setAttribute('aria-hidden', 'true');
            this._planAiTypes = null;
            this._planAiMode = null;
            this._planAiConditionIds = null;
            this._planAiTemporaryConditions = null;
            return true;
        },

        fillPlanAiPrompt(text) {
            const input = document.getElementById('planAiPrompt');
            if (input) input.value = text;
        },

        refreshPlanAiTypeChips() {
            const row = document.getElementById('planAiTypeChipRow');
            if (row) row.innerHTML = this.renderPlanAiTypeChips(this._planAiTypes || ['rehab']);
            const firstType = normalizePlanTypes(this._planAiTypes || ['rehab'])[0];
            const icon = document.querySelector('#planAiSheet .plan-head-icon');
            if (icon) icon.textContent = this.planTypeMeta?.(firstType)?.icon || 'event_note';
        },

        togglePlanAiType(type = 'rehab') {
            const allowed = this.planAiTypeOptions();
            if (!allowed.includes(type)) return;
            const set = new Set(normalizePlanTypes(this._planAiTypes || ['rehab']));
            if (set.has(type) && set.size > 1) set.delete(type);
            else set.add(type);
            this._planAiTypes = [...set];
            this.refreshPlanAiTypeChips();
        },

        togglePlanAiMode(mode = 'today') {
            this._planAiMode = mode === 'week' ? 'week' : 'today';
            queryPlanAiPreviewAll('#planAiModeChipRow [data-plan-ai-mode]').forEach((chip) => {
                const active = chip.getAttribute('data-plan-ai-mode') === this._planAiMode;
                chip.classList.toggle('active', active);
                chip.setAttribute('aria-pressed', String(active));
            });
        },

        handlePlanAiQuickPrompt(text) {
            if (text === '+ 新建训练计划') {
                this.openNewPlanSheet?.();
                return;
            }
            this.fillPlanAiPrompt(text);
        },

        setPlanAiStatus(message = '', state = '') {
            setText('planAiStatus', message);
            const el = document.getElementById('planAiStatus');
            if (el) {
                el.dataset.state = state || '';
                el.classList.toggle('is-busy', state === 'busy');
                el.classList.toggle('is-error', state === 'error');
            }
        },

        setPlanAiPending(pending) {
            const btn = document.getElementById('planAiSubmitBtn');
            if (!btn) return;
            btn.disabled = !!pending;
            btn.innerHTML = pending
                ? '<span class="material-symbols-rounded">progress_activity</span>生成中'
                : '生成';
        },

        setPlanAiPreviewIssue(message = '') {
            const alert = queryPlanAiPreview('[data-plan-ai-preview-error]');
            if (!alert) return;
            const text = String(message || '').trim();
            alert.hidden = !text;
            alert.textContent = text;
        },

        syncPlanAiConfirmAllState() {
            const boxes = queryPlanAiPreviewAll('[data-preview-user-confirm]');
            const allBox = queryPlanAiPreview('[data-plan-ai-confirm-all]');
            if (!allBox) return;
            const checkedCount = boxes.filter((box) => box.checked).length;
            allBox.checked = boxes.length > 0 && checkedCount === boxes.length;
            allBox.indeterminate = checkedCount > 0 && checkedCount < boxes.length;
        },

        togglePlanAiConfirmAll(checked) {
            queryPlanAiPreviewAll('[data-preview-user-confirm]').forEach((box) => {
                box.checked = !!checked;
                box.closest?.('.plan-ai-preview-item')?.classList.remove('needs-confirmation');
            });
            this.setPlanAiPreviewIssue?.('');
            this.syncPlanAiConfirmAllState?.();
        },

        clearPlanAiPreviewItemIssue(source) {
            const input = source?.closest ? source : null;
            const itemEl = input?.closest?.('.plan-ai-preview-item');
            if (itemEl && input?.checked) itemEl.classList.remove('needs-confirmation');
            const missing = queryPlanAiPreviewAll('.plan-ai-preview-item.needs-confirmation');
            if (!missing.length) this.setPlanAiPreviewIssue?.('');
            this.syncPlanAiConfirmAllState?.();
        },

        focusPlanAiPreviewItem(target = {}) {
            const targetName = planAiPreviewItemName(target);
            const items = queryPlanAiPreviewAll('.plan-ai-preview-item');
            const itemEl = items.find((el) => {
                if (!targetName) return false;
                const name = planAiPreviewElementName(el);
                if (!name) return false;
                return name === targetName || name.includes(targetName) || targetName.includes(name);
            }) || items.find((el) => el.querySelector?.('[data-preview-user-confirm]:not(:checked)')) || null;
            if (!itemEl) return null;
            itemEl.classList.add('needs-confirmation');
            itemEl.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            const focusTarget = itemEl.querySelector?.('[data-preview-user-confirm]') || itemEl.querySelector?.('[data-preview-name]');
            focusTarget?.focus?.({ preventScroll: true });
            return itemEl;
        },

        parsePlanAiPayload(rawText, fallbackTypes = 'rehab') {
            const parsed = parsePlanAiPayloadPure(rawText, buildPlanAiPayloadOptions(this, fallbackTypes));
            return stripPlanAiMeta(parsed);
        },

        validatePlanAiPayload(rawText, fallbackTypes = 'rehab', targetDates = []) {
            const options = buildPlanAiPayloadOptions(this, fallbackTypes);
            const validation = stripPlanAiMeta(validatePlanAiPayloadPure(rawText, options));
            const planDates = new Set((stripPlanAiMeta(parsePlanAiPayloadPure(rawText, options)).plans || []).map((plan) => String(plan.date || '')));
            const missing = (targetDates || []).filter((date) => date && !planDates.has(date));
            if (missing.length) return { ...validation, ok: false, errors: [...(validation.errors || []), `缺:${missing.join('、')}`] };
            return validation;
        },

        async submitPlanAi(mode = '', options = {}) {
            mode = mode || this._planAiMode || 'today';
            mode = mode === 'week' ? 'week' : 'today';
            if (!window.ai?.call) {
                this.setPlanAiStatus?.('AI 模块尚未加载完成，请稍后重试。', 'error');
                window.toast?.show?.('AI 模块尚未加载完成', 'error');
                return;
            }
            const types = normalizePlanTypes(this._planAiTypes);
            const prompt = bodyValue('planAiPrompt').trim();
            this._lastPlanAiPrompt = prompt;
            this._planAiAllowUserPlanMerge = hasUserPlanMergeIntent(prompt);
            const targetDates = planAiTargetDates(this, mode);
            const outputTokenBudget = mode === 'week' ? 5200 : 3600;
            const taskId = mode === 'week' ? 'plan.week' : 'plan.today';
            const routeOverride = window.aiRoutingPure?.manualFallbackTarget?.(options?.routeOverride) || null;
            const messages = [
                { role: 'system', content: '你是训练排程助手，只输出 JSON。' },
                { role: 'user', content: this.buildPlanAiContext(mode, prompt, types) }
            ];
            try {
                this.setPlanAiPending?.(true);
                this.setPlanAiStatus?.('正在发送训练档案和最近计划摘要…', 'busy');
                window.toast?.show?.('AI 正在生成训练计划…', 'info', 4200);
                const MAX_ATTEMPTS = 2;
                let text = '';
                let parsed = null;
                let validation = null;
                let requestMeta = null;
                for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
                    if (attempt > 0) {
                        this.setPlanAiStatus?.(`第 ${attempt + 1} 次尝试：AI 正在修正 spec 字段…`, 'busy');
                    }
                    const result = await ai.runStream(taskId, messages, outputTokenBudget, (_delta, accumulated) => {
                        const length = String(accumulated || '').length;
                        this.setPlanAiStatus?.(length ? `正在接收计划草稿：${length} 字` : 'AI 已响应，正在等待内容…', 'busy');
                    }, { routeOverride, returnMeta: true });
                    text = typeof result === 'string' ? result : String(result?.text || '');
                    if (result?.meta) requestMeta = { ...result.meta };
                    this.setPlanAiStatus?.('已收到计划草稿，正在校验 JSON…', 'busy');
                    validation = this.validatePlanAiPayload(text, types, mode === 'week' ? targetDates : []);
                    if (validation.ok) break;
                    if (validation.errors?.length && attempt < MAX_ATTEMPTS - 1) {
                        messages.push({ role: 'assistant', content: text });
                        messages.push({
                            role: 'user',
                            content: `上一次输出不符合 schema 要求，以下是具体问题，请只针对这些问题修正后输出完整 JSON：\n- ${validation.errors.slice(0, 15).join('\n- ')}`
                        });
                        continue;
                    }
                }
                if (validation && !validation.ok) {
                    this.setPlanAiStatus?.('计划不完整，请重试。', 'error');
                    return;
                }
                parsed = this.parsePlanAiPayload(text, types);
                if (!parsed.ok) {
                    this.setPlanAiStatus?.('AI 返回内容无法解析，请调整提示后重试。', 'error');
                    this._openModal?.({
                        title: 'JSON 解析失败',
                        icon: 'warning',
                        bodyHtml: `<div class="plan-ai-raw"><p>${this.escapeHtml(parsed.reason || '解析失败')}</p><pre>${this.escapeHtml(truncate(parsed.rawText || text, 1200))}</pre></div>`,
                        actionsHtml: `<button class="md-btn md-btn-tonal" type="button" data-modal-close>关闭</button>`
                    });
                    return;
                }
                if (requestMeta) this._lastPlanAiMeta = requestMeta;
                this.setPlanAiStatus?.('计划草稿已生成，请在预览中确认。', 'success');
                if (Array.isArray(parsed.warnings) && parsed.warnings.length) {
                    const head = parsed.warnings.slice(0, 3).join('；');
                    window.toast?.show?.(`AI 漏填字段已用默认值补全：${head}${parsed.warnings.length > 3 ? '…' : ''}`, 'info', 5200);
                }
                this.previewPlanAiPlans(parsed.plans);
            } catch (error) {
                const message = window.toast?.sanitize ? toast.sanitize(error) : error?.message || error;
                this.setPlanAiStatus?.(`生成失败：${message}`, 'error');
                const fallbackTarget = error?.aiFallback?.taskId === taskId
                    ? window.aiRoutingPure?.manualFallbackTarget?.(error.aiFallback.target)
                    : null;
                let retried = false;
                const retry = fallbackTarget ? {
                    timeout: 6000,
                    action: '使用备用模型重试',
                    onAction: () => {
                        if (retried) return;
                        retried = true;
                        return this.submitPlanAi(mode, { routeOverride: fallbackTarget });
                    }
                } : undefined;
                window.toast?.show?.(`AI 生成失败：${message}`, 'error', retry);
            } finally {
                this.setPlanAiPending?.(false);
            }
        },

        previewPlanAiPlans(plans = [], options = {}) {
            if (!options.skipSanitize && window.planPolicy?.sanitizeGeneratedPlans) {
                plans = window.planPolicy.sanitizeGeneratedPlans(plans, {
                    db: this.db || {},
                    activeRecords: this.activeRecords?.bind(this),
                    sourcePlans: this.activeRecords?.(this.db?.dailyPlans || []) || [],
                    types: normalizePlanTypes(this._planAiTypes || plans.map((plan) => plan.type || 'rehab')),
                    ensureTaskShape: (item) => item,
                    keepBlockedAsConfirm: true,
                    respectUserOverride: true
                });
            }
            this._pendingPlanAiPlans = plans;
            const confirmItems = plans.flatMap((plan) => Array.isArray(plan.items) ? plan.items : []).filter((item) => item.requiresUserConfirm);
            const confirmCount = confirmItems.length;
            const allConfirmed = confirmCount > 0 && confirmItems.every((item) => item.userConfirmed === true);
            this._openModal?.({
                title: '确认训练计划',
                icon: 'auto_awesome',
                bodyHtml: `<div class="plan-ai-preview">
                    <div class="plan-ai-preview-error" data-plan-ai-preview-error hidden></div>
                    ${confirmCount ? `<label class="plan-ai-confirm-all">
                        <input type="checkbox" data-plan-ai-confirm-all onchange="data.togglePlanAiConfirmAll(this.checked)" ${allConfirmed ? 'checked' : ''}>
                        <span><strong>确认所有风险一次性落库</strong><small>共 ${confirmCount} 个动作需要确认；勾选后会同步勾选下方所有风险项。</small></span>
                    </label>` : ''}
                    ${plans.map((plan, planIndex) => `
                        <section class="plan-ai-preview-plan" data-plan-index="${planIndex}">
                            <div class="plan-ai-preview-type">${this.escapeHtml(this.planTypeMeta?.(plan.type)?.label || plan.type || '训练计划')}</div>
                            <div class="plan-ai-preview-plan-head">
                                <div class="md-field">
                                    <input type="date" data-preview-date value="${this.escapeHtml(plan.date)}" placeholder=" ">
                                    <label>日期</label>
                                </div>
                                <button class="md-icon-btn" type="button" onclick="data.addPlanAiPreviewItem(${planIndex})" aria-label="添加动作"><span class="material-symbols-rounded">add</span></button>
                            </div>
                            <div class="md-field">
                                <input type="text" data-preview-notes value="${this.escapeHtml(plan.notes || '')}" placeholder=" ">
                                <label>备注</label>
                            </div>
                            <div class="plan-ai-preview-items">
                                ${plan.items.map((item, itemIndex) => this.renderPlanAiPreviewItem(planIndex, itemIndex, item)).join('')}
                            </div>
                        </section>
                    `).join('')}
                </div>`,
                actionsHtml: `
                    <button class="md-btn" type="button" data-modal-close>取消</button>
                    <button class="md-btn md-btn-filled" type="button" data-plan-ai-confirm-save onclick="data.confirmPlanAiPlans(this.dataset.force === 'true')">确认落库</button>
                `
            });
            this.syncPlanAiConfirmAllState?.();
            if (options.issue?.message) {
                this.setPlanAiPreviewIssue?.(options.issue.message);
                this.focusPlanAiPreviewItem?.(options.issue.item || { name: options.issue.itemName || '' });
            }
        },

        renderPlanAiPreviewItem(planIndex, itemIndex, item = {}) {
            const coerced = coerceAiSpec(item);
            const spec = coerced.spec;
            const autoSet = new Set(item.autoFilled || []);
            const af = (field) => autoSet.has(field) ? ' data-auto-filled' : '';
            const category = normalizeAiCategory(item.category || item.phase);
            const itemMeta = planActionChoiceMeta(item);
            const originalReason = item.aiReasoning || '';
            const metaAttrs = [
                ['data-original-name', item.name || ''],
                ['data-original-category', category],
                ['data-original-spec', planActionSpecFingerprint(spec)],
                ['data-original-reason', originalReason],
                ['data-original-user-override', item.userOverride ? 'true' : 'false'],
                ['data-preview-action-key', itemMeta.actionKey || ''],
                ['data-preview-canonical-name', itemMeta.canonicalName || item.name || ''],
                ['data-preview-progression-group', itemMeta.progressionGroup || ''],
                ['data-preview-progression-level', itemMeta.progressionLevel || ''],
                ['data-preview-chain-id', itemMeta.chainId || ''],
                ['data-preview-source-action-id', item.sourceActionId || ''],
                ['data-preview-prescription-action-id', item.prescriptionActionId || '']
            ].map(([key, value]) => `${key}="${this.escapeHtml(value)}"`).join(' ');
            const confirmLabel = item.policy?.blocked || item.policy?.source === 'blocked'
                ? '确认冲突候选'
                : (item.policy?.source === 'prescription' || item.prescriptionActionId ? '确认医嘱' : '确认非医嘱建议');
            return `<div class="plan-ai-preview-item" data-item-index="${itemIndex}" ${metaAttrs}>
                <div class="md-field plan-ai-preview-name">
                    <input type="text" data-preview-name value="${this.escapeHtml(item.name || '')}" placeholder=" " autocomplete="off" oninput="data.renderPlanActionSuggestions(this)" onfocus="data.renderPlanActionSuggestions(this)">
                    <label>动作</label>
                </div>
                <div class="plan-action-suggestions" data-plan-action-suggestions></div>
                <div class="md-field plan-ai-preview-category">
                    <select data-preview-category>
                        ${[
                            ['warmup', '热身'],
                            ['main', '主训练'],
                            ['cooldown', '拉伸']
                        ].map(([value, label]) => `<option value="${value}" ${category === value ? 'selected' : ''}>${label}</option>`).join('')}
                    </select>
                    <label>阶段</label>
                </div>
                <div class="md-field plan-ai-preview-mode">
                    <select data-preview-mode>
                        ${VALID_MODES.map((m) => `<option value="${m}" ${spec.mode === m ? 'selected' : ''}>${m}</option>`).join('')}
                    </select>
                    <label>模式</label>
                </div>
                <div class="plan-ai-preview-spec">
                    <div class="md-field"${af('sets')}><input type="number" min="1" data-preview-sets value="${Number(spec.sets || 3)}" placeholder=" "><label>组数</label></div>
                    <div class="md-field"${af('reps')}><input type="number" min="0" data-preview-reps value="${Number(spec.reps || 0)}" placeholder=" "><label>每组次数</label></div>
                    <div class="md-field"${af('work')}><input type="number" min="0" data-preview-work value="${Number(spec.work || 0)}" placeholder=" "><label>每次秒数</label></div>
                    <div class="md-field"${af('repRest')}><input type="number" min="0" data-preview-rep-rest value="${Number(spec.repRest || 0)}" placeholder=" "><label>次间休息</label></div>
                    <div class="md-field"${af('actionRest')}><input type="number" min="0" data-preview-rest value="${Number(spec.actionRest || 0)}" placeholder=" "><label>组间休息</label></div>
                    <label class="plan-ai-preview-alt"><input type="checkbox" data-preview-is-alt ${spec.isAlt ? 'checked' : ''}><span>双侧交替</span></label>
                </div>
                <div class="md-field plan-ai-preview-reason">
                    <input type="text" data-preview-reason value="${this.escapeHtml(item.aiReasoning || '')}" placeholder=" ">
                    <label>理由</label>
                </div>
                ${item.requiresUserConfirm ? `<label class="plan-ai-preview-confirm"><input type="checkbox" data-preview-user-confirm onchange="data.clearPlanAiPreviewItemIssue?.(this)" ${item.userConfirmed ? 'checked' : ''}><span>${this.escapeHtml(confirmLabel)}</span></label>` : ''}
                <button class="md-icon-btn" type="button" onclick="data.deletePlanAiPreviewItem(${planIndex}, ${itemIndex})" aria-label="删除动作"><span class="material-symbols-rounded">delete</span></button>
            </div>`;
        },

        addPlanAiPreviewItem(planIndex) {
            const current = this.collectPlanAiPreviewPlans?.();
            const plans = current?.length ? current : (Array.isArray(this._pendingPlanAiPlans) ? this._pendingPlanAiPlans : []);
            const plan = plans[planIndex];
            if (!plan) return;
            plan.items = Array.isArray(plan.items) ? plan.items : [];
            plan.items.push({
                name: '新训练动作',
                category: 'main',
                spec: { sets: 3, reps: 12, work: 3, repRest: 0, actionRest: 45, isAlt: false, mode: 'reps' },
                cooldownRefs: [],
                aiReasoning: '',
                durationEstHint: '',
                status: 'todo',
                doneSets: 0,
                userOverride: false,
                excludeFromPr: true,
                requiresUserConfirm: false
            });
            this.previewPlanAiPlans(plans);
        },

        deletePlanAiPreviewItem(planIndex, itemIndex) {
            const current = this.collectPlanAiPreviewPlans?.();
            const plans = current?.length ? current : (Array.isArray(this._pendingPlanAiPlans) ? this._pendingPlanAiPlans : []);
            const plan = plans[planIndex];
            if (!plan?.items) return;
            plan.items.splice(itemIndex, 1);
            this.previewPlanAiPlans(plans.filter((item) => item.items?.length));
        },

        collectPlanAiPreviewPlans() {
            const plans = [];
            document.querySelectorAll('.plan-ai-preview-plan').forEach((planEl) => {
                const date = String(planEl.querySelector('[data-preview-date]')?.value || '').trim();
                const notes = String(planEl.querySelector('[data-preview-notes]')?.value || '').trim();
                const items = [];
                planEl.querySelectorAll('.plan-ai-preview-item').forEach((itemEl) => {
                    const name = String(itemEl.querySelector('[data-preview-name]')?.value || '').trim();
                    if (!name) return;
                    const work = Math.max(0, readNumber(itemEl.querySelector('[data-preview-work]')?.value, 0));
                    let reps = Math.max(0, readNumber(itemEl.querySelector('[data-preview-reps]')?.value, 0));
                    if (reps <= 0 && work <= 0) reps = 12;
                    const isAlt = !!itemEl.querySelector('[data-preview-is-alt]')?.checked;
                    const rawMode = String(itemEl.querySelector('[data-preview-mode]')?.value || '').trim();
                    const mode = VALID_MODES.includes(rawMode) ? rawMode : (isAlt ? 'alt-reps' : 'reps');
                    const autoFilledEls = itemEl.querySelectorAll('[data-auto-filled]');
                    const autoFilled = Array.from(autoFilledEls).map((el) => {
                        const input = el.querySelector('input');
                        if (input?.hasAttribute('data-preview-sets')) return 'sets';
                        if (input?.hasAttribute('data-preview-reps')) return 'reps';
                        if (input?.hasAttribute('data-preview-work')) return 'work';
                        if (input?.hasAttribute('data-preview-rep-rest')) return 'repRest';
                        if (input?.hasAttribute('data-preview-rest')) return 'actionRest';
                        return '';
                    }).filter(Boolean);
                    const category = normalizeAiCategory(itemEl.querySelector('[data-preview-category]')?.value || 'main');
                    const coerced = coerceAiSpec({
                        name,
                        category,
                        spec: {
                            sets: Math.max(1, Math.round(readNumber(itemEl.querySelector('[data-preview-sets]')?.value, 3))),
                            reps,
                            work,
                            repRest: Math.max(0, readNumber(itemEl.querySelector('[data-preview-rep-rest]')?.value, 0)),
                            actionRest: Math.max(0, readNumber(itemEl.querySelector('[data-preview-rest]')?.value, 45)),
                            isAlt,
                            mode
                        }
                    });
                    const reason = String(itemEl.querySelector('[data-preview-reason]')?.value || '').trim();
                    const originalSpec = itemEl.getAttribute('data-original-spec') || '';
                    const originalName = itemEl.getAttribute('data-original-name') || '';
                    const originalCategory = itemEl.getAttribute('data-original-category') || '';
                    const originalReason = itemEl.getAttribute('data-original-reason') || '';
                    const specChanged = originalSpec && planActionSpecFingerprint(coerced.spec) !== originalSpec;
                    const textChanged = name !== originalName || category !== originalCategory || reason !== originalReason;
                    const choiceId = itemEl.getAttribute('data-preview-choice-id') || '';
                    const choice = resolvePlanActionChoiceForText(this, name, choiceId);
                    const userOverride = itemEl.getAttribute('data-original-user-override') === 'true' || Boolean(choice) || textChanged || specChanged;
                    const inferredMeta = planActionChoiceMeta({
                        name,
                        rawDescription: reason,
                        actionKey: userOverride && !choice ? '' : itemEl.getAttribute('data-preview-action-key') || '',
                        canonicalName: userOverride && !choice ? '' : itemEl.getAttribute('data-preview-canonical-name') || '',
                        progressionGroup: userOverride && !choice ? '' : itemEl.getAttribute('data-preview-progression-group') || '',
                        progressionLevel: userOverride && !choice ? 0 : readNumber(itemEl.getAttribute('data-preview-progression-level') || 0, 0),
                        chainId: userOverride && !choice ? '' : itemEl.getAttribute('data-preview-chain-id') || ''
                    });
                    const selectedMeta = choice || inferredMeta;
                    const sourceLabel = choice?.sourceLabel || (!userOverride ? itemEl.getAttribute('data-preview-choice-source-label') : '') || '';
                    const confirmInput = itemEl.querySelector('[data-preview-user-confirm]');
                    items.push({
                        name,
                        category,
                        spec: coerced.spec,
                        cooldownRefs: [],
                        aiReasoning: reason,
                        durationEstHint: '',
                        requiresUserConfirm: !!confirmInput,
                        userConfirmed: confirmInput ? confirmInput.checked === true : false,
                        status: 'todo',
                        doneSets: 0,
                        userOverride,
                        excludeFromPr: true,
                        actionKey: selectedMeta.actionKey || '',
                        canonicalName: selectedMeta.canonicalName || name,
                        progressionGroup: selectedMeta.progressionGroup || '',
                        progressionLevel: Number(selectedMeta.progressionLevel || 0),
                        chainId: selectedMeta.chainId || '',
                        sourceActionId: choice?.sourceActionId || (!userOverride ? itemEl.getAttribute('data-preview-source-action-id') : '') || '',
                        prescriptionActionId: choice?.prescriptionActionId || (!userOverride ? itemEl.getAttribute('data-preview-prescription-action-id') : '') || '',
                        ...(choice || userOverride ? { policy: { source: choice?.source || 'user-preview', choiceLabel: sourceLabel, prescriptionName: choice?.source === 'prescription' ? choice.name : '' } } : {}),
                        ...((autoFilled.length || coerced.autoFilled.length) ? { autoFilled: [...new Set([...autoFilled, ...coerced.autoFilled])] } : {})
                    });
                });
                const typeText = String(planEl.querySelector('.plan-ai-preview-type')?.textContent || '').trim();
                const type = ['减脂日程', '减脂计划'].includes(typeText)
                    ? 'cut'
                    : ['增肌日程', '增肌计划'].includes(typeText)
                        ? 'bulk'
                        : typeText === '综合训练'
                            ? 'maintenance'
                            : typeText === '自定义计划'
                                ? 'custom'
                                : 'rehab';
                if (date && items.length) plans.push({ date, type, title: typeText || this.planTypeMeta?.(type)?.label || '训练计划', notes, source: 'ai', items });
            });
            return plans;
        },

        cleanupEmptyUnselectedPlanTypes(plans = []) {
            const selectedByDate = new Map();
            plans.forEach((plan) => {
                const date = String(plan.date || '');
                const type = String(plan.type || 'rehab');
                if (!date) return;
                if (!selectedByDate.has(date)) selectedByDate.set(date, new Set());
                selectedByDate.get(date).add(type);
            });
            if (!selectedByDate.size || !Array.isArray(this.db?.dailyPlans)) return;
            this.db.dailyPlans.forEach((plan) => {
                if (!plan || plan.deleted) return;
                const selected = selectedByDate.get(String(plan.date || ''));
                if (!selected || selected.has(plan.type || 'rehab')) return;
                const activeItems = (plan.items || []).filter((item) => item && !item.deleted);
                if (activeItems.length) return;
                plan.deleted = true;
                this.touchRecord?.(plan, ['deleted']);
                if (this.selectedPlanId === plan.id) this.selectedPlanId = '';
            });
        },

        confirmPlanAiPlans(options = {}) {
            const forceUserPlanOverwrite = options === true || options?.forceUserPlanOverwrite === true;
            const allowUserPlanMerge = !forceUserPlanOverwrite && (this._planAiAllowUserPlanMerge || hasUserPlanMergeIntent(this._lastPlanAiPrompt || ''));
            const confirmBtn = queryPlanAiPreview('[data-plan-ai-confirm-save]');
            if (confirmBtn && !forceUserPlanOverwrite) {
                confirmBtn.dataset.force = '';
                confirmBtn.textContent = '确认落库';
            }
            let plans = this.collectPlanAiPreviewPlans?.() || [];
            if (!plans.length) {
                this.setPlanAiPreviewIssue?.('预览里没有可保存的训练动作');
                window.toast?.show?.('预览里没有可保存的训练动作', 'error');
                return;
            }
            if (window.planPolicy?.sanitizeGeneratedPlans) {
                plans = window.planPolicy.sanitizeGeneratedPlans(plans, {
                    db: this.db || {},
                    activeRecords: this.activeRecords?.bind(this),
                    sourcePlans: this.activeRecords?.(this.db?.dailyPlans || []) || [],
                    types: normalizePlanTypes(this._planAiTypes || plans.map((plan) => plan.type || 'rehab')),
                    ensureTaskShape: (item) => item,
                    keepBlockedAsConfirm: true,
                    respectUserOverride: true
                });
            }
            const unconfirmed = plans.flatMap((plan) => plan.items || []).filter((item) => item.requiresUserConfirm && !item.userConfirmed);
            if (unconfirmed.length) {
                const firstUnconfirmed = unconfirmed[0] || {};
                const message = `还有 ${unconfirmed.length} 个风险确认未勾选，已定位到第一个：${firstUnconfirmed.name || '未命名动作'}`;
                this.previewPlanAiPlans(plans, { skipSanitize: true, issue: { message, item: firstUnconfirmed } });
                window.toast?.show?.(message, 'error', 5200);
                return;
            }
            const hasAutoFilled = plans.some((plan) => plan.items.some((item) => item.autoFilled?.length));
            const beforePlansSnapshot = clone(this.db.dailyPlans || []);
            const beforeSelectedPlanId = this.selectedPlanId;
            const batchBeforePlans = [];
            const batchAfterPlans = [];
            const prepared = [];
            let blockedReason = '';
            let blockedViolation = null;
            plans.forEach((plan) => {
                if (blockedReason) return;
                const sameDay = this.activeRecords(this.db.dailyPlans || []).filter((p) => p.date === plan.date && !p.deleted);
                sameDay.forEach((old) => {
                    const sameType = (old.type || 'rehab') === (plan.type || 'rehab');
                    const hasProtected = window.planPolicy?.isUserOwnedPlan?.(old)
                        || (old.items || []).some((it) => protectedPlanTask(it, old) && !it.deleted);
                    if (sameType || hasProtected) return;
                    batchBeforePlans.push(clone(old));
                    old.deleted = true;
                    this.touchRecord?.(old, ['deleted']);
                    batchAfterPlans.push(old);
                    if (this.selectedPlanId === old.id) this.selectedPlanId = '';
                });
                const current = this.getDailyPlans?.(plan.date)?.find((item) => (item.type || 'rehab') === (plan.type || 'rehab'));
                const currentUserPlan = window.planPolicy?.isUserOwnedPlan?.(current);
                const forceCurrentUserPlan = forceUserPlanOverwrite && currentUserPlan;
                const preserved = (current?.items || []).filter((item) => item && !item.deleted && (forceCurrentUserPlan ? (item.status === 'done' || Number(item.doneSets || 0) > 0) : protectedPlanTask(item, current)));
                const aiItems = plan.items.map((item) => {
                    const meta = window.planPolicy?.actionMetaForName?.(item.name || '') || {};
                    const chain = this.activeRecords(this.db.progressionChains || []).find((entry) => entry.id === item.chainId || entry.group === item.chainId)
                        || window.planChains?.find?.(item.chainId || meta.chainId || '');
                    return this.ensureTaskShape({
                        ...item,
                        actionKey: item.actionKey || meta.actionKey || '',
                        canonicalName: item.canonicalName || meta.canonicalName || item.name || '',
                        progressionGroup: item.progressionGroup || meta.progressionGroup || '',
                        progressionLevel: Number(item.progressionLevel ?? meta.progressionLevel ?? 0),
                        chainId: chain?.id || item.chainId || meta.chainId || ''
                    });
                }).filter((item) => !preserved.some((protectedItem) => window.planPolicy?.tasksShareIdentity?.(item, protectedItem)));
                const merged = this.ensureDailyPlanShape({
                    ...(current || {}),
                    date: plan.date,
                    type: plan.type || 'rehab',
                    title: plan.title || this.planTypeMeta?.(plan.type)?.label || '训练计划',
                    source: currentUserPlan && allowUserPlanMerge ? (current.source || 'manual') : 'ai',
                    notes: plan.notes,
                    items: [...preserved, ...aiItems]
                });
                const validation = currentUserPlan && (forceUserPlanOverwrite || allowUserPlanMerge || !(current.items || []).some((item) => item && !item.deleted)) ? null : window.planPolicy?.validatePlanChanges?.({
                    beforePlans: current ? [current] : [],
                    afterPlans: [merged],
                    source: 'ai'
                });
                if (validation && !validation.ok) {
                    blockedViolation = validation.violations[0] || null;
                    blockedReason = blockedViolation?.reason || '存在受保护任务变更';
                    return;
                }
                if (current) batchBeforePlans.push(current);
                prepared.push({ current, merged, sourcePlan: plan });
            });
            if (blockedReason) {
                this.db.dailyPlans = beforePlansSnapshot;
                this.selectedPlanId = beforeSelectedPlanId;
                const canForce = blockedReason === '手工/导入计划不能被自动改写';
                const message = `训练计划未保存：${blockedReason}${canForce ? '。确认替换请点强制入库。' : ''}`;
                this.setPlanAiPreviewIssue?.(message);
                this.focusPlanAiPreviewItem?.({ name: blockedViolation?.taskName || blockedViolation?.duplicateName || '' });
                if (canForce && confirmBtn) {
                    confirmBtn.dataset.force = 'true';
                    confirmBtn.textContent = '强制入库';
                }
                window.toast?.show?.(message, 'error', 6200);
                return;
            }
            const changes = [];
            prepared.forEach(({ current, merged, sourcePlan }) => {
                changes.push(...(window.planPolicy?.buildPlanAdjustmentChanges?.(current || {}, merged, sourcePlan) || []));
                this.saveDailyPlan?.(merged, { save: false });
                batchAfterPlans.push(merged);
            });
            this.cleanupEmptyUnselectedPlanTypes(plans);
            if (!this.selectedPlanId && plans[0]) {
                const selected = this.getDailyPlans?.(plans[0].date)?.find((item) => (item.type || 'rehab') === (plans[0].type || 'rehab'));
                this.selectedPlanId = selected?.id || '';
            }
            this.createPlanAdjustmentBatch?.({
                source: 'ai',
                status: 'applied',
                createdAt: Date.now(),
                appliedAt: Date.now(),
                sourceDate: this.logicalDateKey?.() || this.dateKey?.(new Date()) || '',
                targetDates: [...new Set(plans.map((plan) => plan.date).filter(Boolean))],
                trigger: { type: 'ai-regenerate' },
                summary: 'AI 生成/重排训练计划',
                beforePlans: batchBeforePlans,
                afterPlans: batchAfterPlans,
                changes,
                undo: { beforePlansRef: 'inline', canUndo: true }
            }, { save: false });
            this.save();
            this.closePlanAiSheet();
            this._closeActiveModal?.();
            this.render?.();
            if (hasAutoFilled) {
                window.toast?.show?.('训练计划已落库（部分字段由默认值补全，可进入「调整任务参数」修正）', 'info', 5000);
            } else {
                window.toast?.show?.('训练计划已生成', 'success');
            }
        }
    };
})();
