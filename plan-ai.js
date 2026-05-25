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

    window.dataPlanAi = {
        planAiQuickPrompts() {
            return [
                '+ 新建训练计划',
                '优化我现有的计划',
                '根据今日反馈调整明天'
            ];
        },

        buildPlanAiContext(mode = 'today', userText = '', typesInput = 'rehab') {
            const prefs = this.ensurePlanPrefs?.() || {};
            const types = normalizePlanTypes(typesInput);
            const metas = types.map((type) => this.planTypeMeta?.(type) || { label: '训练计划' });
            const prefEquipment = equipmentLabels(prefs, this.planEquipmentOptions?.() || []);
            const profile = profileContext(this.db.health?.profile || {});
            const profileEquipment = Array.isArray(profile.preferences?.equipment) ? profile.preferences.equipment : [];
            const allEquipment = [...new Set([...prefEquipment, ...profileEquipment].map((item) => String(item || '').trim()).filter(Boolean))];
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
                ? '请为接下来 7 天输出 JSON：{"plans":[{date,type,title,notes,items:[{name,chainHint,spec:{sets,reps,work,repRest,actionRest,isAlt},cooldownRefs,aiReasoning,durationEstHint}]}]}'
                : '请输出 JSON：{date,type,title,notes,items:[{name,chainHint,spec:{sets,reps,work,repRest,actionRest,isAlt},cooldownRefs,aiReasoning,durationEstHint}]}';
            const typeInstructions = types.map((type, index) => `${index + 1}. ${type} / ${this.planTypeMeta?.(type)?.label || type}`).join('\n');
            return [
                '你是训练日程计划助手，只输出 JSON，不要输出解释。',
                promptMode,
                types.length > 1
                    ? `本次需要同时生成多个计划类型，请分别输出到 plans 数组中，每个选中类型各生成 1 个 plan：\n${typeInstructions}`
                    : `计划类型: ${types[0]} / ${metas[0]?.label || '训练计划'}`,
                `训练阶段: ${prefs.customStageLabel || prefs.stage || 'unset'}`,
                `设计偏好装备: ${prefEquipment.join(', ') || '无'}`,
                `健康档案装备偏好: ${profileEquipment.join(', ') || '无'}`,
                `最终可用装备池: ${allEquipment.join(', ') || '无'}`,
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
                            <span class="cardio-kicker">训练计划 AI</span>
                            <h3>${mode === 'week' ? 'AI 重排本周剩余计划' : `生成${types.length > 1 ? `${types.length} 个训练计划` : meta.label}`}</h3>
                            <small>会自动带上健康档案、训练阶段、设计偏好装备、最近 7 天反馈和漏做项</small>
                        </div>
                    </div>
                    <div class="plan-ai-chip-row">
                        ${types.map((type) => {
                            const info = this.planTypeMeta?.(type) || { label: type, icon: 'event_note' };
                            return `<span class="md-chip">${this.escapeHtml(info.label)}</span>`;
                        }).join('')}
                    </div>
                    <div class="plan-ai-chip-row">
                        ${this.planAiQuickPrompts().map((text) => `<button class="md-chip" type="button" onclick="data.fillPlanAiPrompt('${this.escapeHtml(text)}')">${this.escapeHtml(text)}</button>`).join('')}
                    </div>
                    <div class="md-field">
                        <textarea id="planAiPrompt" rows="5" placeholder=" "></textarea>
                        <label>告诉 AI 你的目标、疼痛点或希望保留的动作</label>
                    </div>
                    <div class="md-row modal-actions">
                        <button class="md-btn" type="button" onclick="data.closePlanAiSheet()">取消</button>
                        <button class="md-btn md-btn-filled" type="button" onclick="data.submitPlanAi('${mode}')">生成计划</button>
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

        parsePlanAiPayload(rawText, fallbackTypes = 'rehab') {
            const allowedTypes = normalizePlanTypes(fallbackTypes);
            const parsed = safeJsonParse(String(rawText || '').trim());
            if (!parsed || typeof parsed !== 'object') return { ok: false, reason: 'AI 返回不是有效 JSON', rawText };
            const plans = Array.isArray(parsed.plans) ? parsed.plans : [parsed];
            const validPlans = plans.map((plan, index) => ({
                date: String(plan.date || this.logicalDateKey?.() || this.dateKey(new Date())),
                type: ['rehab', 'cut', 'bulk', 'maintenance', 'custom'].includes(plan.type) ? plan.type : (allowedTypes[index] || allowedTypes[0] || 'rehab'),
                title: String(plan.title || this.planTypeMeta?.(plan.type || allowedTypes[index] || allowedTypes[0])?.label || '训练计划'),
                notes: String(plan.notes || ''),
                source: 'ai',
                items: (Array.isArray(plan.items) ? plan.items : []).map((item) => ({
                    name: String(item.name || ''),
                    chainId: String(item.chainId || item.chainHint || ''),
                    currentLevel: item.currentLevel == null ? null : Number(item.currentLevel),
                    spec: {
                        sets: Math.max(1, Number(item.spec?.sets || 1)),
                        reps: Math.max(0, Number(item.spec?.reps || 0)),
                        work: Math.max(0, Number(item.spec?.work || 0)),
                        repRest: Math.max(0, Number(item.spec?.repRest || 0)),
                        actionRest: Math.max(0, Number(item.spec?.actionRest || 0)),
                        isAlt: !!item.spec?.isAlt
                    },
                    cooldownRefs: Array.isArray(item.cooldownRefs) ? item.cooldownRefs.map((value) => String(value || '')) : [],
                    aiReasoning: String(item.aiReasoning || ''),
                    durationEstHint: String(item.durationEstHint || ''),
                    status: 'todo',
                    doneSets: 0,
                    userOverride: false,
                    excludeFromPr: true
                })).filter((item) => item.name)
            })).filter((plan) => plan.items.length > 0);
            if (!validPlans.length) return { ok: false, reason: 'JSON 缺少可用 items', rawText };
            return { ok: true, plans: validPlans };
        },

        async submitPlanAi(mode = 'today') {
            if (!window.ai?.call) {
                window.toast?.show?.('AI 模块尚未加载完成', 'error');
                return;
            }
            const types = normalizePlanTypes(this._planAiTypes);
            const prompt = bodyValue('planAiPrompt').trim();
            try {
                window.toast?.show?.('AI 正在生成训练计划…', 'info');
                const text = await window.ai.call([
                    { role: 'system', content: '你是训练排程助手，只输出 JSON。' },
                    { role: 'user', content: this.buildPlanAiContext(mode, prompt, types) }
                ], 1800);
                const parsed = this.parsePlanAiPayload(text, types);
                if (!parsed.ok) {
                    this._openModal?.({
                        title: 'JSON 解析失败',
                        icon: 'warning',
                        bodyHtml: `<div class="plan-ai-raw"><p>${this.escapeHtml(parsed.reason || '解析失败')}</p><pre>${this.escapeHtml(truncate(parsed.rawText || text, 1200))}</pre></div>`,
                        actionsHtml: `<button class="md-btn md-btn-tonal" type="button" data-modal-close>关闭</button>`
                    });
                    return;
                }
                this.previewPlanAiPlans(parsed.plans);
            } catch (error) {
                window.toast?.show?.(`AI 生成失败：${window.toast?.sanitize ? toast.sanitize(error) : error?.message || error}`, 'error');
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
            const spec = item.spec || {};
            return `<div class="plan-ai-preview-item" data-item-index="${itemIndex}">
                <div class="md-field plan-ai-preview-name">
                    <input type="text" data-preview-name value="${this.escapeHtml(item.name || '')}" placeholder=" ">
                    <label>动作</label>
                </div>
                <div class="plan-ai-preview-spec">
                    <div class="md-field"><input type="number" min="1" data-preview-sets value="${Number(spec.sets || 1)}" placeholder=" "><label>组</label></div>
                    <div class="md-field"><input type="number" min="0" data-preview-reps value="${Number(spec.reps || 0)}" placeholder=" "><label>次</label></div>
                    <div class="md-field"><input type="number" min="0" data-preview-work value="${Number(spec.work || 0)}" placeholder=" "><label>秒</label></div>
                    <div class="md-field"><input type="number" min="0" data-preview-rest value="${Number(spec.actionRest || 0)}" placeholder=" "><label>休</label></div>
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
                spec: { sets: 3, reps: 12, work: 0, repRest: 20, actionRest: 60, isAlt: false },
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
                    items.push({
                        name,
                        spec: {
                            sets: Math.max(1, Number(itemEl.querySelector('[data-preview-sets]')?.value || 1)),
                            reps: Math.max(0, Number(itemEl.querySelector('[data-preview-reps]')?.value || 0)),
                            work: Math.max(0, Number(itemEl.querySelector('[data-preview-work]')?.value || 0)),
                            repRest: 20,
                            actionRest: Math.max(0, Number(itemEl.querySelector('[data-preview-rest]')?.value || 0)),
                            isAlt: false
                        },
                        cooldownRefs: [],
                        aiReasoning: String(itemEl.querySelector('[data-preview-reason]')?.value || '').trim(),
                        durationEstHint: '',
                        status: 'todo',
                        doneSets: 0,
                        userOverride: false,
                        excludeFromPr: true
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

        confirmPlanAiPlans() {
            const plans = this.collectPlanAiPreviewPlans?.() || [];
            if (!plans.length) {
                window.toast?.show?.('预览里没有可保存的训练动作', 'error');
                return;
            }
            plans.forEach((plan) => {
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
            this.save();
            this.closePlanAiSheet();
            this._closeActiveModal?.();
            this.render?.();
            window.toast?.show?.('训练计划已生成', 'success');
        }
    };
})();
