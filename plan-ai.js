// @ts-nocheck
(function () {
    if (window.dataPlanAi) return;

    function bodyValue(id) {
        return document.getElementById(id)?.value || '';
    }

    function safeJsonParse(text) {
        try { return JSON.parse(text); } catch { return null; }
    }

    function truncate(text, max = 160) {
        const raw = String(text || '').trim();
        return raw.length > max ? `${raw.slice(0, max)}…` : raw;
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

    function isTimedAiAction(item = {}) {
        const text = `${item.name || ''} ${item.category || ''} ${item.phase || ''} ${item.section || ''}`.toLowerCase();
        return /保持|支撑|平板|静蹲|静态|靠墙|拉伸|伸展|放松|呼吸|hold|plank|stretch|mobility|wall\s*sit|isometric|brace/.test(text)
            || normalizeAiCategory(item.category || item.phase || item.section) === 'cooldown';
    }

    function isLowLevelRehabAction(item = {}, planType = '') {
        if (planType !== 'rehab') return false;
        const text = `${item.name || ''} ${item.category || ''} ${item.phase || ''} ${item.section || ''}`.toLowerCase();
        return Number(item.currentLevel || 0) <= 1
            || normalizeAiCategory(item.category || item.phase || item.section) !== 'main'
            || /踝泵|股四头肌|等长|激活|活动度|低阶|初级|mobility|activation|isometric/.test(text);
    }

    function coerceAiSpec(item = {}, options = {}) {
        const spec = item.spec && typeof item.spec === 'object' ? { ...item.spec } : {};
        const timed = isTimedAiAction(item);
        const lowLevelRehab = isLowLevelRehabAction(item, options.planType || item.planType || '');
        const autoFilled = [];
        const isAlt = parseBoolean(spec.isAlt ?? item.isAlt ?? item.alternating ?? item.bilateral ?? item.sideMode);

        let sets = readPositiveInteger(spec.sets ?? item.sets, 0);
        if (sets < 1) { sets = 3; autoFilled.push('sets'); }

        let reps = readPositiveNumber(spec.reps ?? item.reps ?? item.count ?? item.times ?? item.perSet, 0);
        let work = readCappedPositiveNumber(spec.work ?? item.work ?? item.seconds ?? item.duration, 0, 90);

        if (reps <= 0 && work <= 0) {
            if (timed) { work = 30; reps = 1; autoFilled.push('work', 'reps'); }
            else { reps = 12; work = 3; autoFilled.push('reps', 'work'); }
        } else if (reps > 0 && work <= 0) {
            work = 3; autoFilled.push('work');
        } else if (timed && reps <= 0) {
            // 计时/保持类动作引擎要求 reps>=1（每组至少做 1 次保持）
            reps = 1; autoFilled.push('reps');
        }

        const mode = isAlt ? (timed ? 'alt-hold' : 'alt-reps') : (timed ? 'hold' : 'reps');

        const repRestDefault = lowLevelRehab ? 0 : (timed ? 10 : 15);
        const actionRestDefault = lowLevelRehab ? 20 : (timed ? 30 : 45);
        const repRest = readCappedPositiveNumber(spec.repRest ?? item.repRest ?? item.restBetweenReps, repRestDefault, 30);
        if (spec.repRest === undefined && item.repRest === undefined && item.restBetweenReps === undefined) {
            autoFilled.push('repRest');
        }
        const actionRest = readCappedPositiveNumber(spec.actionRest ?? item.actionRest ?? item.restBetweenSets ?? item.groupRest, actionRestDefault, lowLevelRehab ? 45 : 75);
        if (spec.actionRest === undefined && item.actionRest === undefined && item.restBetweenSets === undefined && item.groupRest === undefined) {
            autoFilled.push('actionRest');
        }

        return {
            spec: { sets, reps, work, repRest, actionRest, isAlt, mode },
            autoFilled,
            warnings: autoFilled.length ? [`${item.name || '未命名动作'} 以下字段由默认值补全: ${autoFilled.join(', ')}`] : []
        };
    }

    function normalizeAiCategory(value = 'main') {
        const text = String(value || '').trim().toLowerCase();
        if (['warmup', 'warm-up', '热身', 'warm'].includes(text)) return 'warmup';
        if (['cooldown', 'cool-down', 'stretch', 'stretching', '拉伸', '放松'].includes(text)) return 'cooldown';
        return 'main';
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

    function normalizePlanTypes(input) {
        const allowed = ['rehab', 'cut', 'bulk', 'maintenance', 'custom'];
        const list = Array.isArray(input) ? input : [input];
        const normalized = list.map((item) => String(item || '').trim()).filter((item) => allowed.includes(item));
        return normalized.length ? [...new Set(normalized)] : ['rehab'];
    }

    function profileContext(profile = {}) {
        return {
            gender: profile.gender || '',
            age: profile.age || null,
            height: profile.height || null,
            weight: profile.weight || null,
            conditions: Array.isArray(profile.conditions) ? profile.conditions : [],
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

        buildPlanAiContext(mode = 'today', userText = '', typesInput = 'rehab') {
            const prefs = this.ensurePlanPrefs?.() || {};
            const today = this.logicalDateKey?.() || this.dateKey(new Date());
            const types = normalizePlanTypes(typesInput);
            const metas = types.map((type) => this.planTypeMeta?.(type) || { label: '训练计划' });
            const prefEquipment = equipmentLabels(prefs, this.planEquipmentOptions?.() || []);
            const profile = profileContext(this.db.health?.profile || {});
            const profileEquipment = Array.isArray(profile.preferences?.equipment) ? profile.preferences.equipment : [];
            const allEquipment = [...new Set([...prefEquipment, ...profileEquipment].map((item) => String(item || '').trim()).filter(Boolean))];
            const todayCompleted = {
                date: today,
                workouts: summarizeTodayHistory(this, today),
                manualExercises: summarizeManualExercises(this, today)
            };
            const recentPlans = this.activeRecords(this.db.dailyPlans || [])
                .filter((plan) => types.includes(plan.type || 'rehab'))
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
            const promptMode = mode === 'week'
                ? '请为接下来 7 天输出严格 JSON，结构为：{"plans":[{"date":"YYYY-MM-DD","type":"<rehab|cut|bulk|maintenance|custom>","title":"...","notes":"...","items":[{"name":"...","category":"<warmup|main|cooldown>","chainHint":"","spec":{"sets":<int>,"reps":<int>,"work":<int>,"repRest":<int>,"actionRest":<int>,"isAlt":<bool>,"mode":"<reps|hold|alt-reps|alt-hold>"},"cooldownRefs":[],"aiReasoning":"...","durationEstHint":""}]}]}'
                : '请输出严格 JSON，结构为：{"date":"YYYY-MM-DD","type":"<rehab|cut|bulk|maintenance|custom>","title":"...","notes":"...","items":[{"name":"...","category":"<warmup|main|cooldown>","chainHint":"","spec":{"sets":<int>,"reps":<int>,"work":<int>,"repRest":<int>,"actionRest":<int>,"isAlt":<bool>,"mode":"<reps|hold|alt-reps|alt-hold>"},"cooldownRefs":[],"aiReasoning":"...","durationEstHint":""}]}';
            const specRules = [
                '只输出 JSON 本体，不要使用 Markdown 代码块、不要前后加自然语言、不要注释。所有数值字段必须是 number 类型，布尔字段必须是 true/false，禁止用字符串如 "3"、"true"。',
                '每个 item 必须填齐：name(string)、category(枚举 warmup/main/cooldown)、spec.sets(int≥1)、spec.reps(int≥0)、spec.work(int>0)、spec.repRest(int 0..30)、spec.actionRest(int 0..90)、spec.isAlt(bool)、spec.mode(枚举 reps/hold/alt-reps/alt-hold)。任一字段缺失或为 0/空都视为不合规，必须重填。',
                'spec.mode 决定动作类型，必须从以下四选一：',
                '  mode="reps"：次数动作（如深蹲、俯卧撑）→ reps≥1, work≥1（每次动作秒数）, isAlt=false',
                '  mode="hold"：静态保持（如靠墙静蹲、平板支撑）→ reps=0, work≥15（保持秒数）, isAlt=false',
                '  mode="alt-reps"：双侧交替次数（如侧弓步、单臂划船）→ reps≥1, work≥1, isAlt=true',
                '  mode="alt-hold"：双侧交替保持（如单腿站立）→ reps=0, work≥15, isAlt=true',
                'category 只能是 warmup（热身）/ main（主训练）/ cooldown（拉伸放松）三选一；不要使用其他词。',
                'spec.work 是每次动作的执行/保持秒数，必须 >0：力量/次数动作 2-5 秒；静态保持/拉伸/呼吸/支撑 20-45 秒。识别不出来时按"次数动作 reps=12, work=3"兜底，绝对禁止 work=0 或省略。',
                'spec.repRest 是同一组内每次/左右侧之间的休息秒数：常规力量 0-10、慢速/高强度最多 15、连续次数动作直接 0；上限 20。必须显式给出该字段。',
                'spec.actionRest 是组间休息秒数：康复/激活/活动度/拉伸 15-30、常规主训 30-60、大重量复合最多 75；严禁 >90。必须显式给出该字段。',
                '示例（仅作字段格式参考，不要照抄内容）：',
                '  次数动作: {"name":"深蹲","category":"main","spec":{"sets":3,"reps":12,"work":3,"repRest":0,"actionRest":45,"isAlt":false,"mode":"reps"}}',
                '  静态保持: {"name":"靠墙静蹲","category":"main","spec":{"sets":3,"reps":0,"work":40,"repRest":0,"actionRest":30,"isAlt":false,"mode":"hold"}}',
                '  双侧交替: {"name":"侧弓步","category":"main","spec":{"sets":3,"reps":10,"work":3,"repRest":0,"actionRest":45,"isAlt":true,"mode":"alt-reps"}}',
                '必须参考今日已完成运动摘要；如果今天已经高强度训练过同动作或同部位，后续计划应降低重复负荷、改为恢复/拉伸/低强度技术练习，除非用户明确要求继续加量。'
            ].join('\n');
            const typeInstructions = types.map((type, index) => `${index + 1}. ${type} / ${this.planTypeMeta?.(type)?.label || type}`).join('\n');
            return [
                '你是训练日程计划助手。只输出严格 JSON 文本，不要 Markdown 代码块、不要解释、不要追加任何说明。',
                promptMode,
                specRules,
                '所有 spec 字段（sets/reps/work/repRest/actionRest/isAlt/mode）都必须由你显式填写，不能依赖客户端推断；如果你拿不准就按规则中的默认值填上，但绝不能省略字段或填 0/空。mode 必须根据动作类型正确选择 reps/hold/alt-reps/alt-hold。',
                types.length > 1
                    ? `本次需要同时生成多个计划类型，请分别输出到 plans 数组中，每个选中类型各生成 1 个 plan：\n${typeInstructions}`
                    : `计划类型: ${types[0]} / ${metas[0]?.label || '训练计划'}`,
                `训练阶段: ${prefs.customStageLabel || prefs.stage || 'unset'}`,
                `设计偏好装备: ${prefEquipment.join(', ') || '无'}`,
                `健康档案装备偏好: ${profileEquipment.join(', ') || '无'}`,
                `最终可用装备池: ${allEquipment.join(', ') || '无'}`,
                `今日已完成运动摘要: ${JSON.stringify(todayCompleted)}`,
                `最近 7 天对应类型计划摘要: ${JSON.stringify(recentPlans)}`,
                `健康档案: ${JSON.stringify(profile)}`,
                `目标类型: ${String(this.db.health?.dietGoal?.goalType || this.db.health?.goalType || '')}`,
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
            const parsed = safeJsonParse(String(rawText || '').trim());
            if (!parsed || typeof parsed !== 'object') return { ok: false, reason: 'AI 返回不是有效 JSON', rawText };
            const plans = Array.isArray(parsed.plans) ? parsed.plans : [parsed];
            const validPlans = plans.map((plan, index) => {
                const planType = ['rehab', 'cut', 'bulk', 'maintenance', 'custom'].includes(plan.type) ? plan.type : (allowedTypes[index] || allowedTypes[0] || 'rehab');
                const items = (Array.isArray(plan.items) ? plan.items : []).map((item) => {
                    const name = String(item.name || '');
                    if (!name) return null;
                    const coerced = coerceAiSpec(item, { planType });
                    return {
                        name,
                        category: normalizeAiCategory(item.category || item.phase || item.section),
                        chainId: String(item.chainId || item.chainHint || ''),
                        currentLevel: item.currentLevel == null ? null : Number(item.currentLevel),
                        spec: coerced.spec,
                        cooldownRefs: Array.isArray(item.cooldownRefs) ? item.cooldownRefs.map((value) => String(value || '')) : [],
                        aiReasoning: String(item.aiReasoning || ''),
                        durationEstHint: String(item.durationEstHint || ''),
                        status: 'todo',
                        doneSets: 0,
                        userOverride: false,
                        excludeFromPr: true,
                        autoFilled: coerced.autoFilled.length ? coerced.autoFilled : undefined
                    };
                }).filter(Boolean);
                return {
                    date: String(plan.date || this.logicalDateKey?.() || this.dateKey(new Date())),
                    type: planType,
                    title: String(plan.title || this.planTypeMeta?.(planType)?.label || '训练计划'),
                    notes: String(plan.notes || ''),
                    source: 'ai',
                    items
                };
            }).filter((plan) => plan.items.length > 0);
            if (!validPlans.length) return { ok: false, reason: 'JSON 缺少可用 items', rawText };
            const warnings = validPlans.flatMap((plan) => plan.items).flatMap((item) => item.autoFilled?.length ? [`${item.name} 字段已自动补全: ${item.autoFilled.join(', ')}`] : []);
            return { ok: true, plans: validPlans, warnings };
        },

        validatePlanAiPayload(rawText, fallbackTypes = 'rehab') {
            const allowedTypes = normalizePlanTypes(fallbackTypes);
            const parsed = safeJsonParse(String(rawText || '').trim());
            if (!parsed || typeof parsed !== 'object') return { ok: false, errors: ['AI 返回不是有效 JSON'] };
            const plans = Array.isArray(parsed.plans) ? parsed.plans : [parsed];
            const allErrors = [];
            plans.forEach((plan, index) => {
                void (['rehab', 'cut', 'bulk', 'maintenance', 'custom'].includes(plan.type) ? plan.type : (allowedTypes[index] || allowedTypes[0] || 'rehab'));
                (Array.isArray(plan.items) ? plan.items : []).forEach((item) => {
                    const name = String(item.name || '');
                    if (!name) return;
                    const rawSpec = item.spec && typeof item.spec === 'object' ? item.spec : {};
                    const mode = inferSpecMode(rawSpec, item);
                    const itemErrors = validateAiSpec({ ...rawSpec, mode }, name);
                    if (itemErrors.length) allErrors.push(...itemErrors);
                });
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
                excludeFromPr: true
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
                    items.push({
                        name,
                        category: normalizeAiCategory(itemEl.querySelector('[data-preview-category]')?.value || 'main'),
                        spec: {
                            sets: Math.max(1, Math.round(readNumber(itemEl.querySelector('[data-preview-sets]')?.value, 3))),
                            reps,
                            work,
                            repRest: Math.max(0, readNumber(itemEl.querySelector('[data-preview-rep-rest]')?.value, 0)),
                            actionRest: Math.max(0, readNumber(itemEl.querySelector('[data-preview-rest]')?.value, 45)),
                            isAlt,
                            mode
                        },
                        cooldownRefs: [],
                        aiReasoning: String(itemEl.querySelector('[data-preview-reason]')?.value || '').trim(),
                        durationEstHint: '',
                        status: 'todo',
                        doneSets: 0,
                        userOverride: false,
                        excludeFromPr: true,
                        ...(autoFilled.length ? { autoFilled } : {})
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
            const plans = this.collectPlanAiPreviewPlans?.() || [];
            if (!plans.length) {
                window.toast?.show?.('预览里没有可保存的训练动作', 'error');
                return;
            }
            const hasAutoFilled = plans.some((plan) => plan.items.some((item) => item.autoFilled?.length));
            if (hasAutoFilled) {
                window.toast?.show?.('有字段由默认值补全（红色边框），请检查后再次确认', 'info', 4000);
                return;
            }
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
                const locked = (current?.items || []).filter((item) => item.userOverride && !item.deleted);
                const aiItems = plan.items.map((item) => this.ensureTaskShape({
                    ...item,
                    chainId: (this.activeRecords(this.db.progressionChains || []).find((chain) => chain.id === item.chainId || chain.group === item.chainId)?.id) || ''
                }));
                const merged = this.ensureDailyPlanShape({
                    ...(current || {}),
                    date: plan.date,
                    type: plan.type || 'rehab',
                    title: plan.title || this.planTypeMeta?.(plan.type)?.label || '训练计划',
                    source: 'ai',
                    notes: plan.notes,
                    items: [...locked, ...aiItems]
                });
                this.saveDailyPlan?.(merged, { save: false });
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
            window.toast?.show?.('训练计划已生成', 'success');
        }
    };
})();
