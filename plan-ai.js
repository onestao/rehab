// @ts-nocheck
(function () {
    if (window.dataPlanAi) return;

    function bodyValue(id) {
        return document.getElementById?.(id)?.value || '';
    }

    const {
        VALID_MODES,
        safeJsonParse,
        readNumber,
        inferSpecMode,
        validateAiSpec,
        coerceAiSpec,
        normalizeAiCategory
    } = window.planAiPure || {};

    function truncate(text, max = 160) {
        const raw = String(text || '').trim();
        return raw.length > max ? `${raw.slice(0, max)}…` : raw;
    }

    const PLAN_AI_TYPES = ['rehab', 'cut', 'bulk', 'maintenance', 'custom'];
    const AI_ITEM_KEYS = ['items', 'exercises', 'actions', 'tasks', 'movements', 'drills', 'list'];
    const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
    const normalizeAiKey = (key = '') => String(key || '').trim().replace(/[\s_-]+/g, '').toLowerCase();
    const aiCategoryFromLabel = (value = '') => {
        const text = normalizeAiKey(value);
        return /warm|prep|activation|mobility|热身|准备|激活|活动度|动态活动/.test(text) ? 'warmup'
            : /cool|stretch|relax|recovery|breath|拉伸|放松|冷身|收操|恢复|呼吸/.test(text) ? 'cooldown'
                : /main|workout|training|strength|主训|主训练|主体|训练动作|处方动作/.test(text) ? 'main' : '';
    };
    function firstStringValue(source = {}, keys = ['name', 'title', 'label', 'actionName', 'exerciseName', 'movement', 'exercise', 'action', 'task', 'drill']) {
        for (const key of keys) {
            const value = source?.[key];
            if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
            if (isPlainObject(value)) { const nested = firstStringValue(value, ['name', 'title', 'label', 'actionName', 'exerciseName']); if (nested) return nested; }
        }
        return '';
    }
    function normalizePlanAiRawItem(rawItem, categoryHint = '') {
        if (typeof rawItem === 'string') { const name = rawItem.trim(); return name ? { name, category: normalizeAiCategory(categoryHint || 'main') } : null; }
        if (!isPlainObject(rawItem)) return null;
        const nestedKey = ['exercise', 'action', 'movement', 'task', 'drill'].find((key) => isPlainObject(rawItem[key]));
        const item = nestedKey ? { ...rawItem[nestedKey], ...rawItem } : rawItem;
        const name = firstStringValue(item);
        if (!name) return null;
        const spec = isPlainObject(item.spec) ? item.spec : (isPlainObject(item.prescription) ? item.prescription : (isPlainObject(item.dosage) ? item.dosage : {}));
        return { ...item, name, category: normalizeAiCategory(categoryHint || aiCategoryFromLabel(item.category || item.phase || item.section || item.type || '') || item.category || item.phase || item.section || 'main'), spec };
    }
    function collectPlanAiRawItems(plan = {}) {
        const items = [];
        const pushItem = (entry, categoryHint = '') => { const item = normalizePlanAiRawItem(entry, categoryHint); if (item) items.push(item); };
        const eachItem = (list, categoryHint = '') => (Array.isArray(list) ? list : []).forEach((entry) => {
            if (!isPlainObject(entry)) { pushItem(entry, categoryHint); return; }
            const sectionCategory = aiCategoryFromLabel(entry.category || entry.phase || entry.section || entry.title || entry.name) || categoryHint;
            const nestedKeys = AI_ITEM_KEYS.filter((key) => Array.isArray(entry[key]));
            nestedKeys.length ? nestedKeys.forEach((key) => eachItem(entry[key], sectionCategory)) : pushItem(entry, sectionCategory);
        });
        if (Array.isArray(plan)) eachItem(plan, 'main');
        else if (isPlainObject(plan)) Object.entries(plan).forEach(([key, value]) => {
            if (!Array.isArray(value)) return;
            const normalizedKey = normalizeAiKey(key);
            const keyCategory = aiCategoryFromLabel(key) || (/^(items|exercises|actions|tasks|movements|drills|list)$/.test(normalizedKey) ? 'main' : '');
            if (keyCategory || /^(sections|phases|blocks|parts|groups|segments)$/.test(normalizedKey)) eachItem(value, keyCategory);
        });
        if (!items.length) pushItem(plan, 'main');
        return items;
    }
    function parsePlanAiJson(rawText = '') {
        const text = String(rawText || '').trim();
        let value = safeJsonParse(text);
        if (value) return { value, source: 'direct' };
        const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fenced?.[1] && (value = safeJsonParse(fenced[1].trim()))) return { value, source: 'fenced' };
        const start = text.search(/[\[{]/);
        const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
        value = start >= 0 && end > start ? safeJsonParse(text.slice(start, end + 1)) : null;
        return { value, source: value ? 'sliced' : 'none' };
    }
    function extractPlanAiPlanCandidates(parsed) {
        if (Array.isArray(parsed)) return [{ sections: parsed }];
        if (!isPlainObject(parsed)) return [];
        for (const [key, value] of Object.entries(parsed)) if (/^(plans|dailyplans|days|schedule|week|weeklyplan|weeklyplans|planlist)$/.test(normalizeAiKey(key)) && Array.isArray(value)) return value;
        for (const [key, value] of Object.entries(parsed)) if (/^(plan|dailyplan|trainingplan|workoutplan|rehabplan|program|routine|session|result|data|payload)$/.test(normalizeAiKey(key)) && isPlainObject(value)) return extractPlanAiPlanCandidates(value);
        return [parsed];
    }
    const normalizePlanAiPlanCandidate = (plan) => Array.isArray(plan) ? { sections: plan } : (isPlainObject(plan) ? plan : {});
    const planAiPlanType = (plan = {}, allowedTypes = [], index = 0) => PLAN_AI_TYPES.includes(String(plan.type || plan.planType || plan.goal || '').trim().toLowerCase()) ? String(plan.type || plan.planType || plan.goal).trim().toLowerCase() : (allowedTypes[index] || allowedTypes[0] || 'rehab');
    const planAiNotes = (plan = {}) => ['notes', 'note', 'overview', 'intro', 'description', 'summary', 'safety', 'advice'].map((key) => typeof plan[key] === 'string' ? plan[key].trim() : '').filter(Boolean).join('；');
    const summarizePlanAiPlansForDebug = (plans = []) => (Array.isArray(plans) ? plans : []).map((plan) => ({ date: String(plan?.date || plan?.day || plan?.dayKey || ''), type: String(plan?.type || plan?.planType || ''), itemCount: (Array.isArray(plan?.items) ? plan.items : collectPlanAiRawItems(plan)).length }));
    const planAiDebug = (type, meta = {}) => { try { window.errorBus?.event?.('plan-ai', type, meta); } catch {} };

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function equipmentLabels(prefs = {}, options = []) {
        const custom = new Map((prefs.customEquipment || []).map((item) => [item.id, item.label]));
        const optionMap = new Map((options || []).map((item) => [item.id, item.label]));
        return (prefs.equipment || []).map((id) => optionMap.get(id) || custom.get(id) || id).filter(Boolean);
    }

    function normalizePlanTypes(input) {
        const list = Array.isArray(input) ? input : [input];
        const normalized = list.map((item) => String(item || '').trim()).filter((item) => PLAN_AI_TYPES.includes(item));
        return normalized.length ? [...new Set(normalized)] : ['rehab'];
    }

    function splitTags(value = '') {
        return String(value || '').split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean);
    }

    function inferBodyPart(value = '') {
        const text = String(value || '').toLowerCase();
        const rules = [
            ['膝', /膝|髌|半月板|股四头|台阶|靠墙蹲|knee|patella|quad/],
            ['踝', /踝|跟腱|足底|小腿|提踵|踝泵|ankle|achilles|calf/],
            ['髋', /髋|臀|梨状|蚌式|髋外展|后踢腿|hip|glute/],
            ['腰背', /腰|背|脊柱|竖脊|核心|腰椎|low back|lumbar|spine|core/],
            ['肩', /肩|肩胛|袖|外旋|内旋|shoulder|scapula|rotator/],
            ['肘腕', /肘|腕|前臂|手腕|elbow|wrist|forearm/],
            ['颈', /颈|斜方|neck|cervical/]
        ];
        return rules.find(([, pattern]) => pattern.test(text))?.[0] || '';
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

    function summarizeRehabWeekly(ctx, limit = 3) {
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
                    name: action.name || '',
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

        renderPlanAiTypeChips(typesInput = 'rehab') {
            const selected = new Set(normalizePlanTypes(typesInput));
            return this.planAiTypeOptions().map((type) => {
                const info = this.planTypeMeta?.(type) || { label: type, icon: 'event_note' };
                const active = selected.has(type);
                return `<button class="md-chip plan-ai-type-chip ${active ? 'active' : ''}" type="button" onclick="data.togglePlanAiType('${type}')" aria-pressed="${active}"><span class="material-symbols-rounded">${this.escapeHtml(info.icon || 'event_note')}</span>${this.escapeHtml(info.label)}</button>`;
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

        buildPlanAiContext(mode = 'today', userText = '', typesInput = 'rehab') {
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
            const targetDates = mode === 'week'
                ? Array.from({ length: 7 }, (_, index) => {
                    const date = new Date(today);
                    date.setDate(date.getDate() + index);
                    return this.dateKey ? this.dateKey(date) : date.toISOString().slice(0, 10);
                })
                : [today];
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
            const policyContext = window.planPolicy?.buildPlanPolicyContext?.({
                db: this.db || {},
                activeRecords: this.activeRecords?.bind(this),
                sourcePlans: this.activeRecords(this.db.dailyPlans || []),
                types
            });
            const promptMode = mode === 'week'
                ? '请为接下来 7 天输出严格 JSON，结构为：{"plans":[{"date":"YYYY-MM-DD","type":"<rehab|cut|bulk|maintenance|custom>","title":"...","notes":"...","items":[{"name":"...","category":"<warmup|main|cooldown>","chainHint":"","spec":{"sets":<int>,"reps":<int>,"work":<int>,"repRest":<int>,"actionRest":<int>,"isAlt":<bool>,"mode":"<reps|hold|alt-reps|alt-hold>"},"cooldownRefs":[],"aiReasoning":"...","durationEstHint":"","requiresUserConfirm":false}]}]}'
                : '请输出严格 JSON，结构为：{"date":"YYYY-MM-DD","type":"<rehab|cut|bulk|maintenance|custom>","title":"...","notes":"...","items":[{"name":"...","category":"<warmup|main|cooldown>","chainHint":"","spec":{"sets":<int>,"reps":<int>,"work":<int>,"repRest":<int>,"actionRest":<int>,"isAlt":<bool>,"mode":"<reps|hold|alt-reps|alt-hold>"},"cooldownRefs":[],"aiReasoning":"...","durationEstHint":"","requiresUserConfirm":false}]}';
            const specRules = [
                '只输出 JSON 本体，不要使用 Markdown 代码块、不要前后加自然语言、不要注释。所有数值字段必须是 number 类型，布尔字段必须是 true/false，禁止用字符串如 "3"、"true"。',
                '每个 item 必须填齐：name(string)、category(枚举 warmup/main/cooldown)、spec.sets(int≥1)、spec.reps(int≥0)、spec.work(int>0)、spec.repRest(int 0..30)、spec.actionRest(int 0..90)、spec.isAlt(bool)、spec.mode(枚举 reps/hold/alt-reps/alt-hold)。任一字段缺失或为 0/空都视为不合规，必须重填。',
                'spec.mode 决定动作类型，必须从以下四选一：',
                '  mode="reps"：次数动作（如深蹲、俯卧撑）→ reps≥1, work≥1（每次动作秒数）, isAlt=false',
                '  mode="hold"：静态保持（如靠墙静蹲、平板支撑）→ reps=0, work≥15（保持秒数）, isAlt=false',
                '  mode="alt-reps"：双侧交替次数（如侧弓步、单臂划船）→ reps≥1, work≥1, isAlt=true',
                '  mode="alt-hold"：双侧交替保持（如单腿站立）→ reps=0, work≥15, isAlt=true',
                'category 只能是 warmup（热身）/ main（主训练）/ cooldown（拉伸放松）三选一；不要使用其他词。',
                '阶段难度必须分层：warmup 只用于准备身体，不得复制主训练难度，最多 1-2 组、轻中等强度、短休息；cooldown 只用于拉伸/呼吸/恢复，最多 1-2 组、低强度、不得作为进阶加量对象；main 才承载主要训练负荷。',
                'warmup/cooldown 即使服务于高强度主训练，也必须明显低于主训练：不要给 3-5 组、接近力竭、长组间休息、大重量、复杂高阶动作或 progression chain。',
                'spec.work 是每次动作的执行/保持秒数，必须 >0：力量/次数动作 2-5 秒；静态保持/拉伸/呼吸/支撑 20-45 秒。识别不出来时按"次数动作 reps=12, work=3"兜底，绝对禁止 work=0 或省略。',
                'spec.repRest 是同一组内每次/左右侧之间的休息秒数：常规力量 0-10、慢速/高强度最多 15、连续次数动作直接 0；上限 20。必须显式给出该字段。',
                'spec.actionRest 是组间休息秒数：康复/激活/活动度/拉伸 15-30、常规主训 30-60、大重量复合最多 75；严禁 >90。必须显式给出该字段。',
                '示例（仅作字段格式参考，不要照抄内容）：',
                '  次数动作: {"name":"深蹲","category":"main","spec":{"sets":3,"reps":12,"work":3,"repRest":0,"actionRest":45,"isAlt":false,"mode":"reps"}}',
                '  静态保持: {"name":"靠墙静蹲","category":"main","spec":{"sets":3,"reps":0,"work":40,"repRest":0,"actionRest":30,"isAlt":false,"mode":"hold"}}',
                '  双侧交替: {"name":"侧弓步","category":"main","spec":{"sets":3,"reps":10,"work":3,"repRest":0,"actionRest":45,"isAlt":true,"mode":"alt-reps"}}',
                '必须参考今日已完成运动摘要；如果今天已经高强度训练过同动作或同部位，后续计划应降低重复负荷、改为恢复/拉伸/低强度技术练习，除非用户明确要求继续加量。'
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
                '所有 spec 字段（sets/reps/work/repRest/actionRest/isAlt/mode）都必须由你显式填写，不能依赖客户端推断；如果你拿不准就按规则中的默认值填上，但绝不能省略字段或填 0/空。mode 必须根据动作类型正确选择 reps/hold/alt-reps/alt-hold。',
                types.length > 1
                    ? `本次需要同时生成多个计划类型，请分别输出到 plans 数组中，每个选中类型各生成 1 个 plan：\n${typeInstructions}`
                    : `计划类型: ${types[0]} / ${metas[0]?.label || '训练计划'}`,
                `训练阶段: ${prefs.customStageLabel || prefs.stage || 'unset'}`,
                `设计偏好装备: ${prefEquipment.join(', ') || '无'}`,
                `健康档案装备偏好: ${profileEquipment.join(', ') || '无'}`,
                `最终可用装备池: ${allEquipment.join(', ') || '无'}`,
                `本次选中训练病症: ${JSON.stringify(conditionTargets.target)}`,
                `未选中病症安全限制: ${JSON.stringify(conditionTargets.safetyOnly)}`,
                `检查结果证据/安全背景: ${JSON.stringify(conditionTargets.examEvidence || [])}`,
                `训练计划策略上下文: ${JSON.stringify(policyContext?.summary || policyContext || {})}`,
                `目标当前计划完整摘要: ${JSON.stringify(currentTargetPlans)}`,
                `今日已完成运动摘要: ${JSON.stringify(todayCompleted)}`,
                `近6周康复中心处方: ${JSON.stringify(rehabWeekly)}`,
                `选中病症相关处方强规则: ${JSON.stringify(rehabByCondition.target)}`,
                `其他病症处方安全限制: ${JSON.stringify(rehabByCondition.safetyOnly)}`,
                `诊断/处方部位约束: ${JSON.stringify(bodyPartConstraints)}`,
                rehabWeekly.length ? '康复处方规则: 必须优先遵守最近3周康复中心处方；continued/progressed 动作应保留或参考；dropped 动作不能出现在计划中；new/watch/needsReview 动作不得自动加量，疼痛>=4/10 只能降级或替换。第4-6周处方仅用于理解长期禁忌、反复疼痛和动作演变。' : '',
                '冲突优先级: 安全/健康禁忌/疼痛阈值 > 最近3周康复处方 > 当前计划保留/改造 > 用户临时目标。',
                `最近 7 天对应类型计划摘要: ${JSON.stringify(recentPlans)}`,
                `健康档案: ${JSON.stringify(profile)}`,
                `目标类型: ${String(this.db.health?.dietGoal?.goalType || this.db.health?.goalType || '')}`,
                prefTagsStr ? `偏好参数:\n${prefTagsStr}` : '',
                `用户补充: ${userText || '无'}`
            ].join('\n');
        },

        openPlanAiSheet(mode = 'today', typesInput = 'rehab') {
            const sheet = document.getElementById('planAiSheet');
            const body = document.getElementById('planAiSheetBody');
            if (!sheet || !body) return;
            const types = normalizePlanTypes(typesInput);
            const meta = this.planTypeMeta?.(types[0]) || { label: '训练计划', icon: 'event_note' };
            this._planAiTypes = types;
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
                        <label>告诉 AI 你的目标、疼痛点或希望保留的动作</label>
                    </div>
                    <div id="planAiStatus" class="plan-ai-status" aria-live="polite">填写补充要求后点击生成，AI 会返回可编辑的计划草稿。</div>
                    <div class="md-row modal-actions">
                        <button class="md-btn" type="button" onclick="data.closePlanAiSheet()">取消</button>
                        <button id="planAiSubmitBtn" class="md-btn md-btn-filled" type="button" onclick="data.submitPlanAi('${mode}')">生成计划</button>
                    </div>
                </div>`;
            sheet.classList.remove('hidden');
            sheet.setAttribute('aria-hidden', 'false');
            window.navStack?.push?.({ type: 'modal', id: 'planAiSheet', close: () => this.closePlanAiSheet() });
        },

        closePlanAiSheet() {
            const sheet = document.getElementById('planAiSheet');
            sheet?.classList.add('hidden');
            sheet?.setAttribute('aria-hidden', 'true');
            this._planAiTypes = null;
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
                : '生成计划';
        },

        parsePlanAiPayload(rawText, fallbackTypes = 'rehab') {
            const allowedTypes = normalizePlanTypes(fallbackTypes);
            const parsedResult = parsePlanAiJson(rawText);
            const parsed = parsedResult.value;
            if (!parsed || typeof parsed !== 'object') {
                planAiDebug('parse:failed', {
                    reason: 'invalid-json',
                    parseSource: parsedResult.source,
                    rawChars: String(rawText || '').length
                });
                return { ok: false, reason: 'AI 返回不是有效 JSON', rawText };
            }
            const rawPlans = extractPlanAiPlanCandidates(parsed);
            const validPlans = rawPlans.map((rawPlan, index) => {
                const plan = normalizePlanAiPlanCandidate(rawPlan);
                const planType = planAiPlanType(plan, allowedTypes, index);
                const rawItems = collectPlanAiRawItems(plan);
                const items = rawItems.map((item) => {
                    const name = String(item.name || '');
                    if (!name) return null;
                    const category = normalizeAiCategory(item.category || item.phase || item.section);
                    const progressionAllowed = category === 'main';
                    const meta = window.planPolicy?.actionMetaForName?.(`${name} ${item.aiReasoning || item.reason || item.note || ''}`) || {};
                    const coerced = coerceAiSpec({ ...item, category }, { planType });
                    return {
                        name,
                        category,
                        actionKey: item.actionKey || meta.actionKey || '',
                        canonicalName: item.canonicalName || meta.canonicalName || name,
                        progressionGroup: item.progressionGroup || meta.progressionGroup || '',
                        progressionLevel: Number(item.progressionLevel ?? meta.progressionLevel ?? 0),
                        chainId: progressionAllowed ? String(item.chainId || item.chainHint || meta.chainId || '') : '',
                        currentLevel: progressionAllowed && item.currentLevel != null ? Number(item.currentLevel) : null,
                        spec: coerced.spec,
                        cooldownRefs: Array.isArray(item.cooldownRefs) ? item.cooldownRefs.map((value) => String(value || '')) : [],
                        aiReasoning: String(item.aiReasoning || item.reason || item.rationale || item.note || ''),
                        durationEstHint: String(item.durationEstHint || item.durationHint || item.estimatedDuration || ''),
                        requiresUserConfirm: !!(item.requiresUserConfirm || item.requiresConfirmation || item.needsReview),
                        userConfirmed: item.userConfirmed === true,
                        policy: item.policy && typeof item.policy === 'object' ? item.policy : null,
                        status: 'todo',
                        doneSets: 0,
                        userOverride: false,
                        excludeFromPr: true,
                        autoFilled: coerced.autoFilled.length ? coerced.autoFilled : undefined
                    };
                }).filter(Boolean);
                return {
                    date: String(plan.date || plan.day || plan.dayKey || plan.targetDate || this.logicalDateKey?.() || this.dateKey(new Date())),
                    type: planType,
                    title: String(plan.title || plan.name || this.planTypeMeta?.(planType)?.label || '训练计划'),
                    notes: planAiNotes(plan),
                    source: 'ai',
                    items
                };
            }).filter((plan) => plan.items.length > 0);
            if (!validPlans.length) {
                planAiDebug('parse:failed', {
                    reason: 'no-usable-items',
                    parseSource: parsedResult.source,
                    rawChars: String(rawText || '').length,
                    rawPlans: summarizePlanAiPlansForDebug(rawPlans)
                });
                return { ok: false, reason: 'JSON 缺少可用 items', rawText };
            }
            const warnings = validPlans.flatMap((plan) => plan.items).flatMap((item) => item.autoFilled?.length ? [`${item.name} 字段已自动补全: ${item.autoFilled.join(', ')}`] : []);
            planAiDebug('parse:success', {
                parseSource: parsedResult.source,
                rawChars: String(rawText || '').length,
                parsedPlans: summarizePlanAiPlansForDebug(validPlans),
                warningCount: warnings.length
            });
            return { ok: true, plans: validPlans, warnings };
        },

        validatePlanAiPayload(rawText, fallbackTypes = 'rehab') {
            const allowedTypes = normalizePlanTypes(fallbackTypes);
            const parsedResult = parsePlanAiJson(rawText);
            const parsed = parsedResult.value;
            if (!parsed || typeof parsed !== 'object') {
                planAiDebug('validate', {
                    ok: false,
                    reason: 'invalid-json',
                    parseSource: parsedResult.source,
                    rawChars: String(rawText || '').length
                });
                return { ok: false, errors: ['AI 返回不是有效 JSON'] };
            }
            const plans = extractPlanAiPlanCandidates(parsed);
            const allErrors = [];
            if (!plans.length) allErrors.push('JSON 缺少 plans/items');
            plans.forEach((rawPlan, index) => {
                const plan = normalizePlanAiPlanCandidate(rawPlan);
                const planType = planAiPlanType(plan, allowedTypes, index);
                const items = collectPlanAiRawItems(plan);
                if (!items.length) {
                    allErrors.push(`第 ${index + 1} 个计划缺少可用动作 items/main/warmup/cooldown`);
                    return;
                }
                items.forEach((item) => {
                    const name = String(item.name || '');
                    if (!name) return;
                    const category = normalizeAiCategory(item.category || item.phase || item.section);
                    const coerced = coerceAiSpec({ ...item, category }, { planType });
                    const mode = inferSpecMode(coerced.spec, item);
                    const itemErrors = validateAiSpec({ ...coerced.spec, mode }, name);
                    if (itemErrors.length) allErrors.push(...itemErrors);
                });
            });
            planAiDebug('validate', {
                ok: allErrors.length === 0,
                parseSource: parsedResult.source,
                errorCount: allErrors.length,
                rawPlans: summarizePlanAiPlansForDebug(plans)
            });
            return { ok: allErrors.length === 0, errors: allErrors };
        },

        async submitPlanAi(mode = 'today') {
            if (!window.ai?.call) {
                this.setPlanAiStatus?.('AI 模块尚未加载完成，请稍后重试。', 'error');
                window.toast?.show?.('AI 模块尚未加载完成', 'error');
                return;
            }
            const types = normalizePlanTypes(this._planAiTypes);
            const prompt = bodyValue('planAiPrompt').trim();
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
                for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
                    if (attempt > 0) {
                        this.setPlanAiStatus?.(`第 ${attempt + 1} 次尝试：AI 正在修正 spec 字段…`, 'busy');
                    }
                    if (typeof window.ai.callStream === 'function') {
                        text = await window.ai.callStream(messages, 1800, (_delta, accumulated) => {
                            const length = String(accumulated || '').length;
                            this.setPlanAiStatus?.(length ? `正在接收计划草稿：${length} 字` : 'AI 已响应，正在等待内容…', 'busy');
                        });
                    } else {
                        text = await window.ai.call(messages, 1800);
                    }
                    this.setPlanAiStatus?.('已收到计划草稿，正在校验 JSON…', 'busy');
                    const validation = this.validatePlanAiPayload(text, types);
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
                this.setPlanAiStatus?.('计划草稿已生成，请在预览中确认。', 'success');
                if (Array.isArray(parsed.warnings) && parsed.warnings.length) {
                    const head = parsed.warnings.slice(0, 3).join('；');
                    window.toast?.show?.(`AI 漏填字段已用默认值补全：${head}${parsed.warnings.length > 3 ? '…' : ''}`, 'info', 5200);
                }
                this.previewPlanAiPlans(parsed.plans);
            } catch (error) {
                this.setPlanAiStatus?.(`生成失败：${window.toast?.sanitize ? toast.sanitize(error) : error?.message || error}`, 'error');
                window.toast?.show?.(`AI 生成失败：${window.toast?.sanitize ? toast.sanitize(error) : error?.message || error}`, 'error');
            } finally {
                this.setPlanAiPending?.(false);
            }
        },

        previewPlanAiPlans(plans = []) {
            const beforeSanitize = summarizePlanAiPlansForDebug(plans);
            if (window.planPolicy?.sanitizeGeneratedPlans) {
                plans = window.planPolicy.sanitizeGeneratedPlans(plans, {
                    db: this.db || {},
                    activeRecords: this.activeRecords?.bind(this),
                    sourcePlans: this.activeRecords?.(this.db?.dailyPlans || []) || [],
                    types: normalizePlanTypes(this._planAiTypes || plans.map((plan) => plan.type || 'rehab')),
                    ensureTaskShape: (item) => item
                });
                planAiDebug('sanitize:preview', {
                    before: beforeSanitize,
                    after: summarizePlanAiPlansForDebug(plans)
                });
            } else {
                planAiDebug('sanitize:preview:skipped', { before: beforeSanitize });
            }
            this._pendingPlanAiPlans = plans;
            this._openModal?.({
                title: '确认训练计划',
                icon: 'auto_awesome',
                bodyHtml: `<div class="plan-ai-preview">
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
                    <button class="md-btn md-btn-filled" type="button" onclick="data.confirmPlanAiPlans()">确认落库</button>
                `
            });
        },

        renderPlanAiPreviewItem(planIndex, itemIndex, item = {}) {
            const coerced = coerceAiSpec(item);
            const spec = coerced.spec;
            const autoSet = new Set(item.autoFilled || []);
            const af = (field) => autoSet.has(field) ? ' data-auto-filled' : '';
            const category = normalizeAiCategory(item.category || item.phase);
            return `<div class="plan-ai-preview-item" data-item-index="${itemIndex}">
                <div class="md-field plan-ai-preview-name">
                    <input type="text" data-preview-name value="${this.escapeHtml(item.name || '')}" placeholder=" ">
                    <label>动作</label>
                </div>
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
                ${item.requiresUserConfirm ? `<label class="plan-ai-preview-confirm"><input type="checkbox" data-preview-user-confirm ${item.userConfirmed ? 'checked' : ''}><span>我确认接受此非处方/中低风险建议</span></label>` : ''}
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
                    items.push({
                        name,
                        category,
                        spec: coerced.spec,
                        cooldownRefs: [],
                        aiReasoning: String(itemEl.querySelector('[data-preview-reason]')?.value || '').trim(),
                        durationEstHint: '',
                        requiresUserConfirm: !!itemEl.querySelector('[data-preview-user-confirm]'),
                        userConfirmed: itemEl.querySelector('[data-preview-user-confirm]')?.checked !== false,
                        status: 'todo',
                        doneSets: 0,
                        userOverride: false,
                        excludeFromPr: true,
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

        confirmPlanAiPlans() {
            let plans = this.collectPlanAiPreviewPlans?.() || [];
            if (!plans.length) {
                window.toast?.show?.('预览里没有可保存的训练动作', 'error');
                return;
            }
            planAiDebug('confirm:collected', { plans: summarizePlanAiPlansForDebug(plans) });
            const beforeSanitize = summarizePlanAiPlansForDebug(plans);
            if (window.planPolicy?.sanitizeGeneratedPlans) {
                plans = window.planPolicy.sanitizeGeneratedPlans(plans, {
                    db: this.db || {},
                    activeRecords: this.activeRecords?.bind(this),
                    sourcePlans: this.activeRecords?.(this.db?.dailyPlans || []) || [],
                    types: normalizePlanTypes(this._planAiTypes || plans.map((plan) => plan.type || 'rehab')),
                    ensureTaskShape: (item) => item
                });
                planAiDebug('sanitize:confirm', {
                    before: beforeSanitize,
                    after: summarizePlanAiPlansForDebug(plans)
                });
            } else {
                planAiDebug('sanitize:confirm:skipped', { before: beforeSanitize });
            }
            const unconfirmed = plans.flatMap((plan) => plan.items || []).filter((item) => item.requiresUserConfirm && !item.userConfirmed);
            if (unconfirmed.length) {
                planAiDebug('confirm:blocked-unconfirmed', {
                    count: unconfirmed.length,
                    plans: summarizePlanAiPlansForDebug(plans)
                });
                window.toast?.show?.(`有 ${unconfirmed.length} 个非处方建议尚未确认`, 'error');
                return;
            }
            const hasAutoFilled = plans.some((plan) => plan.items.some((item) => item.autoFilled?.length));
            const savedSummaries = [];
            plans.forEach((plan) => {
                const sameDay = this.activeRecords(this.db.dailyPlans || []).filter((p) => p.date === plan.date && !p.deleted);
                sameDay.forEach((old) => {
                    const sameType = (old.type || 'rehab') === (plan.type || 'rehab');
                    const hasLocked = (old.items || []).some((it) => it.userOverride && !it.deleted);
                    if (sameType || hasLocked) return;
                    old.deleted = true;
                    this.touchRecord?.(old, ['deleted']);
                    if (this.selectedPlanId === old.id) this.selectedPlanId = '';
                });
                const current = this.getDailyPlans?.(plan.date)?.find((item) => (item.type || 'rehab') === (plan.type || 'rehab'));
                const preserved = (current?.items || []).filter((item) => item && !item.deleted && (item.userOverride || item.status === 'done'));
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
                });
                const merged = this.ensureDailyPlanShape({
                    ...(current || {}),
                    date: plan.date,
                    type: plan.type || 'rehab',
                    title: plan.title || this.planTypeMeta?.(plan.type)?.label || '训练计划',
                    source: 'ai',
                    notes: plan.notes,
                    items: [...preserved, ...aiItems]
                });
                this.saveDailyPlan?.(merged, { save: false });
                savedSummaries.push({
                    date: plan.date,
                    type: plan.type || 'rehab',
                    preservedCount: preserved.length,
                    aiItemCount: aiItems.length,
                    totalCount: merged.items?.length || 0
                });
            });
            this.cleanupEmptyUnselectedPlanTypes(plans);
            if (!this.selectedPlanId && plans[0]) {
                const selected = this.getDailyPlans?.(plans[0].date)?.find((item) => (item.type || 'rehab') === (plans[0].type || 'rehab'));
                this.selectedPlanId = selected?.id || '';
            }
            this.save();
            this.closePlanAiSheet();
            this._closeActiveModal?.();
            this.render?.();
            planAiDebug('confirm:saved', {
                autoFilled: hasAutoFilled,
                plans: savedSummaries
            });
            if (hasAutoFilled) {
                window.toast?.show?.('训练计划已落库（部分字段由默认值补全，可进入「调整任务参数」修正）', 'info', 5000);
            } else {
                window.toast?.show?.('训练计划已生成', 'success');
            }
        }
    };
})();
