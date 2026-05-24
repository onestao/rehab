// @ts-nocheck
(function () {
    if (window.dataRehabAi) return;

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

    window.dataRehabAi = {
        rehabAiQuickPrompts() {
            return [
                '记录今天的康复动作',
                '为本周排康复计划',
                '优化我现有的康复清单'
            ];
        },

        buildRehabAiContext(mode = 'today', userText = '') {
            const prefs = this.ensureRehabPrefs?.() || {};
            const recentPlans = this.activeRecords(this.db.dailyPlans || []).slice(0, 7).map((plan) => ({
                date: plan.date,
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
            const profile = this.db.health?.profile || {};
            const promptMode = mode === 'week'
                ? '请为接下来 7 天输出 JSON：{"plans":[{date,notes,items:[{name,chainHint,spec:{sets,reps,work,repRest,actionRest,isAlt},cooldownRefs,aiReasoning,durationEstHint}]}]}'
                : '请输出 JSON：{date,notes,items:[{name,chainHint,spec:{sets,reps,work,repRest,actionRest,isAlt},cooldownRefs,aiReasoning,durationEstHint}]}';
            return [
                '你是康复训练计划助手，只输出 JSON，不要输出解释。',
                promptMode,
                `康复阶段: ${prefs.stage || 'unset'}`,
                `可用道具: ${(prefs.equipment || []).join(', ') || '无'}`,
                `最近 7 天计划摘要: ${JSON.stringify(recentPlans)}`,
                `体重身高: ${JSON.stringify({ weight: profile.weight || null, height: profile.height || null })}`,
                `用户补充: ${userText || '无'}`
            ].join('\n');
        },

        openRehabAiSheet(mode = 'today') {
            const sheet = document.getElementById('rehabAiSheet');
            const body = document.getElementById('rehabAiSheetBody');
            if (!sheet || !body) return;
            body.innerHTML = `
                <div class="rehab-ai-sheet">
                    <div class="rehab-feedback-head">
                        <span class="cardio-kicker">康复计划 AI</span>
                        <h3>${mode === 'week' ? 'AI 重排本周剩余计划' : '生成今日康复计划'}</h3>
                        <small>会自动带上康复阶段、道具、最近 7 天反馈和漏做项</small>
                    </div>
                    <div class="rehab-ai-chip-row">
                        ${this.rehabAiQuickPrompts().map((text) => `<button class="md-chip" type="button" onclick="data.fillRehabAiPrompt('${this.escapeHtml(text)}')">${this.escapeHtml(text)}</button>`).join('')}
                    </div>
                    <div class="md-field">
                        <textarea id="rehabAiPrompt" rows="5" placeholder=" "></textarea>
                        <label>告诉 AI 你的目标、疼痛点或希望保留的动作</label>
                    </div>
                    <div class="md-row modal-actions">
                        <button class="md-btn" type="button" onclick="data.closeRehabAiSheet()">取消</button>
                        <button class="md-btn md-btn-filled" type="button" onclick="data.submitRehabAi('${mode}')">生成计划</button>
                    </div>
                </div>`;
            sheet.classList.remove('hidden');
            sheet.setAttribute('aria-hidden', 'false');
            window.navStack?.push?.({ type: 'modal', id: 'rehabAiSheet', close: () => this.closeRehabAiSheet() });
        },

        closeRehabAiSheet() {
            const sheet = document.getElementById('rehabAiSheet');
            sheet?.classList.add('hidden');
            sheet?.setAttribute('aria-hidden', 'true');
            return true;
        },

        fillRehabAiPrompt(text) {
            const input = document.getElementById('rehabAiPrompt');
            if (input) input.value = text;
        },

        parseRehabAiPayload(rawText) {
            const parsed = safeJsonParse(String(rawText || '').trim());
            if (!parsed || typeof parsed !== 'object') return { ok: false, reason: 'AI 返回不是有效 JSON', rawText };
            const plans = Array.isArray(parsed.plans) ? parsed.plans : [parsed];
            const validPlans = plans.map((plan) => ({
                date: String(plan.date || this.logicalDateKey?.() || this.dateKey(new Date())),
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

        async submitRehabAi(mode = 'today') {
            if (!window.ai?.call) {
                window.toast?.show?.('AI 模块尚未加载完成', 'error');
                return;
            }
            const prompt = bodyValue('rehabAiPrompt').trim();
            try {
                window.toast?.show?.('AI 正在生成康复计划…', 'info');
                const text = await window.ai.call([
                    { role: 'system', content: '你是康复训练排程助手，只输出 JSON。' },
                    { role: 'user', content: this.buildRehabAiContext(mode, prompt) }
                ], 1800);
                const parsed = this.parseRehabAiPayload(text);
                if (!parsed.ok) {
                    this._openModal?.({
                        title: 'JSON 解析失败',
                        icon: 'warning',
                        bodyHtml: `<div class="rehab-ai-raw"><p>${this.escapeHtml(parsed.reason || '解析失败')}</p><pre>${this.escapeHtml(truncate(parsed.rawText || text, 1200))}</pre></div>`,
                        actionsHtml: `<button class="md-btn md-btn-tonal" type="button" data-modal-close>关闭</button>`
                    });
                    return;
                }
                this.previewRehabAiPlans(parsed.plans);
            } catch (error) {
                window.toast?.show?.(`AI 生成失败：${window.toast?.sanitize ? toast.sanitize(error) : error?.message || error}`, 'error');
            }
        },

        previewRehabAiPlans(plans = []) {
            this._pendingRehabAiPlans = plans;
            this._openModal?.({
                title: '确认康复计划',
                icon: 'auto_awesome',
                bodyHtml: `<div class="rehab-ai-preview">
                    ${plans.map((plan, planIndex) => `
                        <section class="rehab-ai-preview-plan" data-plan-index="${planIndex}">
                            <div class="rehab-ai-preview-plan-head">
                                <div class="md-field">
                                    <input type="date" data-preview-date value="${this.escapeHtml(plan.date)}" placeholder=" ">
                                    <label>日期</label>
                                </div>
                                <button class="md-icon-btn" type="button" onclick="data.addRehabAiPreviewItem(${planIndex})" aria-label="添加动作"><span class="material-symbols-rounded">add</span></button>
                            </div>
                            <div class="md-field">
                                <input type="text" data-preview-notes value="${this.escapeHtml(plan.notes || '')}" placeholder=" ">
                                <label>备注</label>
                            </div>
                            <div class="rehab-ai-preview-items">
                                ${plan.items.map((item, itemIndex) => this.renderRehabAiPreviewItem(planIndex, itemIndex, item)).join('')}
                            </div>
                        </section>
                    `).join('')}
                </div>`,
                actionsHtml: `
                    <button class="md-btn" type="button" data-modal-close>取消</button>
                    <button class="md-btn md-btn-filled" type="button" onclick="data.confirmRehabAiPlans()">确认落库</button>
                `
            });
        },

        renderRehabAiPreviewItem(planIndex, itemIndex, item = {}) {
            const spec = item.spec || {};
            return `<div class="rehab-ai-preview-item" data-item-index="${itemIndex}">
                <div class="md-field rehab-ai-preview-name">
                    <input type="text" data-preview-name value="${this.escapeHtml(item.name || '')}" placeholder=" ">
                    <label>动作</label>
                </div>
                <div class="rehab-ai-preview-spec">
                    <div class="md-field"><input type="number" min="1" data-preview-sets value="${Number(spec.sets || 1)}" placeholder=" "><label>组</label></div>
                    <div class="md-field"><input type="number" min="0" data-preview-reps value="${Number(spec.reps || 0)}" placeholder=" "><label>次</label></div>
                    <div class="md-field"><input type="number" min="0" data-preview-work value="${Number(spec.work || 0)}" placeholder=" "><label>秒</label></div>
                    <div class="md-field"><input type="number" min="0" data-preview-rest value="${Number(spec.actionRest || 0)}" placeholder=" "><label>休</label></div>
                </div>
                <div class="md-field rehab-ai-preview-reason">
                    <input type="text" data-preview-reason value="${this.escapeHtml(item.aiReasoning || '')}" placeholder=" ">
                    <label>理由</label>
                </div>
                <button class="md-icon-btn" type="button" onclick="data.deleteRehabAiPreviewItem(${planIndex}, ${itemIndex})" aria-label="删除动作"><span class="material-symbols-rounded">delete</span></button>
            </div>`;
        },

        addRehabAiPreviewItem(planIndex) {
            const current = this.collectRehabAiPreviewPlans?.();
            const plans = current?.length ? current : (Array.isArray(this._pendingRehabAiPlans) ? this._pendingRehabAiPlans : []);
            const plan = plans[planIndex];
            if (!plan) return;
            plan.items = Array.isArray(plan.items) ? plan.items : [];
            plan.items.push({
                name: '新康复动作',
                spec: { sets: 3, reps: 12, work: 0, repRest: 20, actionRest: 60, isAlt: false },
                cooldownRefs: [],
                aiReasoning: '',
                durationEstHint: '',
                status: 'todo',
                doneSets: 0,
                userOverride: false,
                excludeFromPr: true
            });
            this.previewRehabAiPlans(plans);
        },

        deleteRehabAiPreviewItem(planIndex, itemIndex) {
            const current = this.collectRehabAiPreviewPlans?.();
            const plans = current?.length ? current : (Array.isArray(this._pendingRehabAiPlans) ? this._pendingRehabAiPlans : []);
            const plan = plans[planIndex];
            if (!plan?.items) return;
            plan.items.splice(itemIndex, 1);
            this.previewRehabAiPlans(plans.filter((item) => item.items?.length));
        },

        collectRehabAiPreviewPlans() {
            const plans = [];
            document.querySelectorAll('.rehab-ai-preview-plan').forEach((planEl) => {
                const date = String(planEl.querySelector('[data-preview-date]')?.value || '').trim();
                const notes = String(planEl.querySelector('[data-preview-notes]')?.value || '').trim();
                const items = [];
                planEl.querySelectorAll('.rehab-ai-preview-item').forEach((itemEl) => {
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
                if (date && items.length) plans.push({ date, notes, source: 'ai', items });
            });
            return plans;
        },

        confirmRehabAiPlans() {
            const plans = this.collectRehabAiPreviewPlans?.() || [];
            if (!plans.length) {
                window.toast?.show?.('预览里没有可保存的康复动作', 'error');
                return;
            }
            plans.forEach((plan) => {
                const current = this.getDailyPlan?.(plan.date);
                const locked = (current?.items || []).filter((item) => item.userOverride && !item.deleted);
                const aiItems = plan.items.map((item) => this.ensureTaskShape({
                    ...item,
                    chainId: (this.activeRecords(this.db.progressionChains || []).find((chain) => chain.id === item.chainId || chain.group === item.chainId)?.id) || ''
                }));
                const merged = this.ensureDailyPlanShape({
                    ...(current || {}),
                    date: plan.date,
                    source: 'ai',
                    notes: plan.notes,
                    items: [...locked, ...aiItems]
                });
                this.saveDailyPlan?.(merged, { save: false });
            });
            this.save();
            this.closeRehabAiSheet();
            this._closeActiveModal?.();
            this.render?.();
            window.toast?.show?.('康复计划已生成', 'success');
        }
    };
})();
