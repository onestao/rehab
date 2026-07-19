// @ts-nocheck
(function () {
    if (window.dataPlanUi?.enhanceTodayPage && window.dataPlanUi?.renderTodayAiReminder) return;

    function navButton(pageId) {
        return Array.from(document.querySelectorAll('.nav-item')).find((btn) => (btn.getAttribute('onclick') || '').includes(`'${pageId}'`));
    }

    function formatTime(ts) {
        if (!ts) return '';
        return new Date(Number(ts)).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }

    function taskSort(task) {
        const order = { 'in-progress': 0, todo: 1, done: 2, skipped: 3 };
        return order[task?.status] ?? 9;
    }

    function taskStatusMeta(task = {}) {
        if (task.status === 'done') return { label: '已完成', icon: 'check_circle', className: 'is-done' };
        if (task.status === 'skipped') return { label: '已跳过', icon: 'remove_circle', className: 'is-skipped' };
        if (task.status === 'in-progress') return { label: '进行中', icon: 'play_circle', className: 'is-current' };
        return { label: '待执行', icon: 'radio_button_unchecked', className: 'is-todo' };
    }

    function taskCategoryMeta(task = {}) {
        if (task.category === 'warmup') return { label: '热身', icon: 'directions_run' };
        if (task.category === 'cooldown') return { label: '拉伸', icon: 'self_improvement' };
        return { label: '主训练', icon: 'fitness_center' };
    }

    function taskConfirmMeta(task = {}) {
        const source = task.policy?.source;
        const blocked = task.policy?.blocked || source === 'blocked';
        const prescription = source === 'prescription' || task.prescriptionActionId;
        const base = blocked ? '冲突候选' : prescription ? '医嘱' : '非医嘱';
        return {
            badge: `${base} · ${task.userConfirmed ? '已确认' : '待确认'}`,
            title: blocked ? '确认冲突候选动作' : prescription ? '确认医嘱' : '确认非医嘱动作',
            detail: blocked ? '与最近暂停/避免记录冲突。' : prescription ? '来自医嘱，需确认。' : '不是当前明确医嘱动作。'
        };
    }

    function taskSpecText(task = {}) {
        const spec = task.spec || {};
        const category = taskCategoryMeta(task);
        const noData = (Number(spec.reps || 0) <= 0 && Number(spec.work || 0) <= 0);
        const main = noData ? '参数不完整' : (Number(spec.reps || 0) > 0 ? `每组${Number(spec.reps || 0)}次` : `每次${Number(spec.work || 0)}秒`);
        const details = [
            Number(spec.repRest || 0) > 0 ? `次休${Number(spec.repRest || 0)}秒` : '',
            Number(spec.actionRest || 0) > 0 ? `组休${Number(spec.actionRest || 0)}秒` : '',
            spec.isAlt ? '双侧交替' : ''
        ].filter(Boolean);
        return `${category.label} · ${Number(spec.sets || 1)}组 · ${main}${details.length ? ` · ${details.join(' · ')}` : ''}`;
    }

    function planStatusClass(type = 'rehab') {
        return ['rehab', 'cut', 'bulk', 'maintenance', 'custom'].includes(type) ? `is-${type}` : 'is-rehab';
    }

    function normalizePlanTypes(input) {
        const allowed = ['rehab', 'cut', 'bulk', 'maintenance', 'custom'];
        const list = Array.isArray(input) ? input : [input];
        const normalized = list.map((item) => String(item || '').trim()).filter((item) => allowed.includes(item));
        return normalized.length ? [...new Set(normalized)] : ['rehab'];
    }

    function n0(v){return +v||0}
    function ths(ctx,s){
        if(s&&typeof s==='object')return s;
        if(ctx?._ths)return ctx._ths;
        const today=ctx.logicalDateKey?.()||ctx.dateKey?.(new Date())||'';
        s=window.healthSummaryPure?.summarizeToday?.(ctx.db,today,{historyDayKey:r=>ctx.historyDayKey?.(r)||r?.dayKey||r?.date||''});
        if(s)return s;
        const m=ctx.todayMacros?.()||{},g=ctx.defaultDietGoals?.()||{};
        return{intake:n0(ctx.todayCalories?.()),macros:{pro:n0(m.pro),carb:n0(m.carb),fat:n0(m.fat)},goals:{cal:n0(g.cal||ctx.db?.health?.dietGoal?.dailyCal),pro:n0(g.pro),carb:n0(g.carb),fat:n0(g.fat)}};
    }

    window.dataPlanUi = Object.assign(window.dataPlanUi || {}, {
        // First-paint V6 renderers live only on dataTodayViewCore. plan-ui must not
        // re-own them on refreshModules (Object.assign last-wins would flip ownership).
        renderTodayPage(){this._ths=ths(this);try{return window.dataViews.renderTodayPage.call(this)}finally{this._ths=null}},

        // Local enhancement only: fill deferred AI/timeline slots + bind interactions.
        // Never rewrite ready hero/plan/diet/dock, never create plans.
        enhanceTodayPage() {
            const ctx = this;
            const timeline = document.getElementById('todayTimeline');
            const aiCard = document.getElementById('todayAiCard');
            const fillIfNeeded = (el, html) => {
                if (!el) return;
                const next = String(html || '');
                if (!next) return;
                const shell = el.dataset?.todayShell;
                // Ready slots already painted by core; only fill skeleton/placeholder deferred sinks.
                if (shell === 'ready' && el.firstChild && !el.querySelector?.('.today-shell-skeleton, .is-placeholder')) return;
                el.innerHTML = next;
                if (el.dataset) el.dataset.todayShell = 'ready';
            };
            fillIfNeeded(timeline, ctx.renderTodayTimeline?.() || '');
            if (aiCard) {
                let aiHtml = ctx.renderTodayAiReminder?.() || ctx.renderContextAiCard?.('today') || '';
                if (ctx.renderWeeklyAiInsightCard) aiHtml += ctx.renderWeeklyAiInsightCard();
                fillIfNeeded(aiCard, aiHtml);
            }
            ctx.bindPlanQuickRepeat?.();
            ctx.updateTodayV6Greet?.();
        },

        selectTodayPlan(planId) {
            this.selectedPlanId = planId;
            this.renderTodayPage?.();
        },

        todayPlanAiTypes() {
            const plans = this.getTodayDailyPlans?.() || [];
            const selected = plans.find((item) => item.id === this.selectedPlanId);
            const ordered = [
                ...(selected ? [selected.type || 'rehab'] : []),
                ...plans.map((item) => item.type || 'rehab')
            ];
            return normalizePlanTypes(ordered);
        },

        openPlanTodayAiSheet() {
            this.openNewPlanSheet?.({ defaultTypes: this.todayPlanAiTypes() });
        },

        async openNewPlanSheet(options = {}) {
            const config = typeof options === 'string' ? { defaultMode: options } : (options || {});
            const types = ['rehab', 'cut', 'bulk', 'maintenance', 'custom'];
            this._newPlanTypes = normalizePlanTypes(config.defaultTypes || this._newPlanTypes || ['rehab']);
            const weekFirst = config.defaultMode === 'week';
            return this._openModal({
                title: '计划',
                icon: 'add_circle',
                bodyHtml: `<div id="planCreateSheetBody">${this.renderNewPlanSheetBody(types)}</div>`,
                actionsHtml: `
                    <button class="md-btn" type="button" data-modal-close>关闭</button><button class="md-btn md-btn-tonal" type="button" onclick="data.createSelectedPlans(false)">手动创建</button><button class="md-btn md-btn-filled" type="button" onclick="data.createSelectedPlans('${weekFirst ? 'week' : 'today'}')">AI ${weekFirst ? '7天' : '今日'}</button>
                `
            });
        },

        renderNewPlanSheetBody(types = ['rehab']) {
            const selected = new Set(normalizePlanTypes(this._newPlanTypes || ['rehab']));
            return `<div class="plan-create-sheet">
                ${types.map((type) => {
                    const meta = this.planTypeMeta?.(type) || { label: type, icon: 'event_note' };
                    return `<button class="model-picker-row plan-create-row ${planStatusClass(type)} ${selected.has(type) ? 'active' : ''}" type="button" onclick="data.toggleNewPlanType('${type}')"><span class="material-symbols-rounded">${selected.has(type) ? 'check_circle' : meta.icon}</span><span class="model-picker-main"><strong>${this.escapeHtml(meta.label)}</strong><small>AI 会按该目标生成任务和放松安排</small></span></button>`;
                }).join('')}
            </div>`;
        },

        toggleNewPlanType(type = 'rehab') {
            const set = new Set(normalizePlanTypes(this._newPlanTypes || ['rehab']));
            if (set.has(type) && set.size > 1) set.delete(type);
            else set.add(type);
            this._newPlanTypes = [...set];
            const body = document.getElementById('planCreateSheetBody');
            if (body) body.innerHTML = this.renderNewPlanSheetBody(['rehab', 'cut', 'bulk', 'maintenance', 'custom']);
        },

        createSelectedPlans(openAi = true) {
            const types = normalizePlanTypes(this._newPlanTypes || ['rehab']);
            const today = this.logicalDateKey?.() || this.dateKey(new Date());
            if (openAi) {
                this._closeActiveModal();
                this.openPlanAiSheet?.(openAi === 'week' ? 'week' : 'today', types);
                return;
            }
            const created = types.map((type) => {
                const meta = this.planTypeMeta?.(type) || { label: '训练计划' };
                const existing = this.getDailyPlans?.(today)?.find((plan) => (plan.type || 'rehab') === type);
                return existing || this.createDailyPlan?.({
                    date: today,
                    type,
                    title: meta.label,
                    source: 'manual',
                    items: type === 'rehab' ? this.seedTasksFromPrefs?.() || [] : []
                }, { render: false });
            }).filter(Boolean);
            this.selectedPlanId = created[0]?.id || '';
            this.save?.({ render: false });
            this._closeActiveModal();
            this.renderTodayPage?.();
        },

        renderTodayAiReminder() {
            const collapsed = this.isCollapsed?.('todayAiReminder', true);
            const content = this.renderContextAiCard?.('today') || `<div class="context-ai-card context-ai-placeholder"><div class="context-ai-head"><div><span class="cardio-kicker">AI 建议</span><h3>综合分析</h3><small>配置 AI 后，可结合今日饮食、训练和体重记录生成建议</small></div><span class="context-ai-icon material-symbols-rounded">psychology</span></div><div class="context-ai-actions"><button class="md-btn md-btn-tonal" type="button" onclick="ui.tab('ai-coach', document.querySelectorAll('.nav-item')[3])">打开 AI</button></div></div>`;
            return `<div class="md-card collapsible-card today-ai-reminder ${collapsed ? 'collapsed' : ''}"><button class="panel-head collapsible-head-btn" type="button" onclick="data.toggleCollapse('todayAiReminder')"><div><span class="cardio-kicker">AI</span><h3>今日 AI 提醒</h3><small>展开查看快速建议</small></div><span class="collapse-btn"><span class="material-symbols-rounded">${collapsed ? 'expand_more' : 'expand_less'}</span></span></button><div class="collapse-content">${content}</div></div>`;
        },

        renderPlanTaskDrawerBody(planId) {
            const activePlans = this.activeRecords?.(this.db.dailyPlans || []) || [];
            const plan = planId ? activePlans.find((item) => item.id === planId) : this.getTodayDailyPlan?.();
            if (!plan) return '<div class="plan-empty">暂无训练任务</div>';
            const planMeta = this.planTypeMeta?.(plan.type, plan.title) || { label: '训练计划', icon: 'event_note' };
            const completion = this.completionRate?.(plan) || { done: 0, total: 0, rate: 0 };
            const items = (plan.items || []).filter((item) => !item.deleted).sort((a, b) => taskSort(a) - taskSort(b));
            const sections = [
                ['待运动', 'todo', items.filter((item) => item.status === 'todo' || item.status === 'in-progress')],
                ['已完成', 'done', items.filter((item) => item.status === 'done')],
                ['已跳过', 'skipped', items.filter((item) => item.status === 'skipped')]
            ];
            return `<div class="plan-task-drawer"><div class="plan-drawer-summary ${planStatusClass(plan.type)}"><span class="material-symbols-rounded plan-drawer-summary-icon">${planMeta.icon}</span><span class="plan-drawer-summary-copy"><strong>${this.escapeHtml(plan.title || planMeta.label)}</strong><small>${completion.total ? `${completion.done}/${completion.total} 完成` : '暂无待完成训练'}${plan.notes ? ` · ${this.escapeHtml(plan.notes)}` : ''}</small></span><button class="md-btn md-btn-tonal plan-cancel-day-btn" type="button" data-cancel-plan-id="${this.escapeHtml(plan.id)}" title="取消今日计划" aria-label="取消今日计划"><span class="material-symbols-rounded">event_busy</span><span>取消计划</span></button></div>
                ${sections.map(([label, key, list]) => `
                    <section class="plan-section plan-section-${key}"><div class="plan-section-head"><strong>${label}</strong><small>${list.length}</small></div>
                        ${list.length ? list.map((task, index) => this.renderPlanTaskRow(plan.id, task, index + 1, false)).join('') : '<div class="plan-empty">暂无</div>'}
                    </section>
                `).join('')}
            </div>`;
        },

        openPlanTaskDrawer(planId) {
            this.closePlanTaskDrawer?.();
            const modal = document.createElement('div');
            modal.id = 'planTaskDrawer';
            modal.className = 'md-modal md-modal-sheet';
            modal.setAttribute('aria-hidden', 'false');
            modal.innerHTML = `
                <div class="md-modal-backdrop" data-modal-close></div><div class="md-modal-card md-modal-sheet-card"><div class="md-modal-head"><strong>今日训练任务</strong><button class="icon-btn" type="button" data-modal-close aria-label="关闭"><span class="material-symbols-rounded">close</span></button></div><div class="md-modal-body" id="planTaskDrawerBody">${this.renderPlanTaskDrawerBody(planId)}</div></div>`;
            modal.querySelectorAll('[data-modal-close]').forEach((btn) => {
                btn.addEventListener('click', () => this.closePlanTaskDrawer?.());
            });
            modal.querySelectorAll('[data-cancel-plan-id]').forEach((btn) => {
                btn.addEventListener('click', (event) => {
                    event.preventDefault();
                    this.cancelDailyPlanConfirm?.(btn.getAttribute('data-cancel-plan-id') || '');
                });
            });
            document.body.appendChild(modal);
            this._planTaskDrawerEl = modal;
        },

        closePlanTaskDrawer() {
            const el = this._planTaskDrawerEl || document.getElementById('planTaskDrawer');
            el?.remove?.();
            this._planTaskDrawerEl = null;
        },

        cancelDailyPlanConfirm(planId) {
            const plan = this.activeRecords?.(this.db.dailyPlans || []).find((item) => item.id === planId);
            if (!plan) return;
            const title = plan.title || this.planTypeMeta?.(plan.type, plan.title)?.label || '今日计划';
            this._confirmModal({
                title: '取消今日计划',
                icon: 'event_busy',
                message: `确定取消「${title}」？\n计划会软删除，历史记录和已完成训练不会被删除。`,
                okText: '取消计划',
                cancelText: '返回',
                danger: true,
                onOk: () => {
                    const changed = this.cancelDailyPlan?.(planId, { render: false });
                    if (!changed) return;
                    this.closePlanTaskDrawer?.();
                    this.updatePlanWorkoutBanner?.();
                    this.render?.();
                }
            });
        },

        renderPlanTaskRow(planId, task, index, compact = false) {
            const feedbackBits = [];
            if (task.feedback?.painScore != null) feedbackBits.push(`疼痛 ${task.feedback.painScore}/10${task.feedback.painPart ? ` ${this.escapeHtml(task.feedback.painPart)}` : ''}`);
            if (task.feedback?.noIncrease) feedbackBits.push('不加量');
            if (task.feedback?.keepNextTime) feedbackBits.push('下次保持');
            if (task.feedback?.wantsContinue === false) feedbackBits.push('不想继续');
            if (task.feedback?.unsuitable) feedbackBits.push('不适合');
            const doneMeta = task.feedback?.doneAt ? `<small>${formatTime(task.feedback.doneAt)}${feedbackBits.length ? ` · ${feedbackBits.join(' · ')}` : ''}${task.feedback?.note ? ` · ${this.escapeHtml(task.feedback.note)}` : ''}</small>` : '';
            const meta = taskStatusMeta(task);
            const confirmMeta = taskConfirmMeta(task);
            const policyBadge = task.requiresUserConfirm
                ? `<span class="plan-policy-badge ${task.userConfirmed ? 'is-confirmed' : 'is-warning'}">${confirmMeta.badge}</span>`
                : '';
            return `<div class="plan-task-row ${meta.className}"><button class="plan-task-main" type="button" onclick="data.handlePlanTaskTap('${planId}','${task.id}')"><span class="plan-task-order">${index}</span><span class="plan-task-body"><span class="plan-task-title"><strong>${this.escapeHtml(task.name || '未命名任务')}</strong><em><span class="material-symbols-rounded">${meta.icon}</span>${meta.label}</em></span>
                        ${policyBadge}
                        <small>${taskSpecText(task)}${task.currentLevel ? ` · Lv${task.currentLevel}` : ''}${task.userOverride ? ' · 已锁定' : ''}${task.invalidSpec ? ' · ⚠️ 参数不完整' : ''}</small>
                        ${!compact && doneMeta}
                    </span></button><div class="plan-task-actions"><button class="md-icon-btn" type="button" onclick="event.stopPropagation();data.openPlanTaskEdit('${planId}','${task.id}')" aria-label="编辑动作"><span class="material-symbols-rounded">edit</span></button><button class="md-icon-btn" type="button" onclick="event.stopPropagation();data.markPlanTaskDone('${planId}','${task.id}')" aria-label="手动完成"><span class="material-symbols-rounded">done</span></button><button class="md-icon-btn" type="button" onclick="event.stopPropagation();data.openPlanTaskMenu('${planId}','${task.id}')" aria-label="更多"><span class="material-symbols-rounded">more_vert</span></button></div></div>`;
        },

        renderPlanManualStrip() {
            return `<div class="plan-manual-strip"><div class="quick-dock"><button class="record-quick-btn" type="button" data-plan-quick="weight" onclick="data.openWeightModal()"><span class="material-symbols-rounded">monitor_weight</span><span>记体重</span></button><button class="record-quick-btn" type="button" data-plan-quick="diet" onclick="data.openDietModal()"><span class="material-symbols-rounded">restaurant</span><span>记饮食</span></button><button class="record-quick-btn" type="button" data-plan-quick="cardio" onclick="data.openExerciseModal()"><span class="material-symbols-rounded">fitness_center</span><span>记运动</span></button><button class="record-quick-btn record-quick-btn-ai context-ai-btn" type="button" data-plan-quick="ai" data-ai-ctx="today" data-ai-idx="0"><span class="material-symbols-rounded">psychology</span><span>问 AI</span></button></div></div>`;
        },

        togglePlanTodayExpanded() {
            this.planTodayExpanded = !this.planTodayExpanded;
            this.renderTodayPage?.();
        },

        openPlanQuickRecord(type) {
            if (type === 'weight') return this.openWeightModal?.();
            if (type === 'diet') return this.openDietModal?.();
            if (type === 'cardio') return this.openExerciseModal?.();
            if (type === 'strength') {
                ui.tab('workout', navButton('workout'));
                requestAnimationFrame(() => {
                    window.workout?.setMode?.('strengthLog');
                    document.getElementById('slName')?.focus?.();
                });
            }
        },

        async openPlanTaskEdit(planId, taskId) {
            const needsLoad = typeof window.loadAppScript === 'function' && !window.dataPlanAi?.searchPlanActionChoices;
            if (needsLoad) {
                if (this._planTaskEditBusy) return;
                this._planTaskEditBusy = true;
                document.querySelectorAll('[onclick*="openPlanTaskEdit"]').forEach((node) => {
                    if (!(node instanceof HTMLElement)) return;
                    if ('disabled' in node) node.disabled = true;
                    node.setAttribute('aria-busy', 'true');
                    node.classList.add('is-action-busy');
                });
            }
            try {
                if (needsLoad) {
                    await window.loadAppScript('plan-ai');
                    this.refreshModules?.();
                }
            } catch (e) {
                window.errorBus?.report?.('lazy-plan.openPlanTaskEdit', e);
                window.toast?.show?.('编辑计划模块加载失败，请稍后重试。', 'error');
                return;
            } finally {
                if (needsLoad) {
                    this._planTaskEditBusy = false;
                    document.querySelectorAll('[onclick*="openPlanTaskEdit"]').forEach((node) => {
                        if (!(node instanceof HTMLElement)) return;
                        if ('disabled' in node) node.disabled = false;
                        node.removeAttribute('aria-busy');
                        node.classList.remove('is-action-busy');
                    });
                }
            }
            const { task } = this.findTask?.(planId, taskId) || {};
            if (!task) return;
            const current = task.spec || {};
            const category = task.category || 'main';
            return this._openModal({
                title: '编辑计划动作',
                icon: 'edit',
                bodyHtml: `
                    <div class="md-grid modal-grid" style="gap:10px"><div class="md-field span-full"><input id="planEditName" type="text" placeholder=" " autocomplete="off" value="${this.escapeHtml(task.name || '')}" oninput="data.renderPlanEditActionSuggestions?.(this)" onfocus="data.renderPlanEditActionSuggestions?.(this)"><label>动作名称</label></div><div id="planEditActionSuggestions" class="plan-action-suggestions span-full"></div><div class="md-field"><select id="planEditCategory"><option value="warmup" ${category === 'warmup' ? 'selected' : ''}>热身</option><option value="main" ${category === 'main' ? 'selected' : ''}>主训练</option><option value="cooldown" ${category === 'cooldown' ? 'selected' : ''}>拉伸/放松</option></select><label>阶段</label></div><div class="md-field"><input id="planEditSets" type="number" placeholder=" " value="${Number(current.sets || 1)}"><label>组数</label></div><div class="md-field"><input id="planEditReps" type="number" placeholder=" " value="${Number(current.reps || 0)}"><label>次数</label></div><div class="md-field"><input id="planEditWork" type="number" placeholder=" " value="${Number(current.work || 0)}"><label>时长（秒）</label></div><div class="md-field"><input id="planEditRest" type="number" placeholder=" " value="${Number(current.actionRest || 0)}"><label>组间休息</label></div><div class="md-field"><input id="planEditRepRest" type="number" min="0" placeholder=" " value="${Number(current.repRest || 0)}"><label>次/侧间休息（秒）</label></div><label class="plan-edit-alt"><input id="planEditIsAlt" type="checkbox" ${current.isAlt ? 'checked' : ''}><span>双侧交替（左右换边）</span></label><div class="md-field span-full"><input id="planEditReason" type="text" placeholder=" " value="${this.escapeHtml(task.aiReasoning || '')}"><label>修改理由/备注（可选）</label></div></div>`,
                actionsHtml: `
                    <button class="md-btn" type="button" data-modal-close>取消</button><button class="md-btn md-btn-filled" type="button" onclick="data.savePlanTaskEdit('${planId}','${taskId}')">保存</button>
                `
            });
        },

        savePlanTaskEdit(planId, taskId) {
            const { plan, task } = this.findTask?.(planId, taskId) || {};
            if (!plan || !task) return;
            const nameInput = document.getElementById('planEditName');
            const previousName = String(task.name || '').trim();
            const name = String(nameInput?.value || '').trim();
            const nextName = name || task.name || '未命名任务';
            const nameChanged = nextName !== previousName;
            const category = String(document.getElementById('planEditCategory')?.value || task.category || 'main');
            task.name = nextName;
            task.category = ['warmup', 'main', 'cooldown'].includes(category) ? category : 'main';
            task.spec = {
                ...task.spec,
                sets: Math.max(1, Number(document.getElementById('planEditSets')?.value || task.spec.sets || 1)),
                reps: Math.max(0, Number(document.getElementById('planEditReps')?.value || task.spec.reps || 0)),
                work: Math.max(0, Number(document.getElementById('planEditWork')?.value || task.spec.work || 0)),
                actionRest: Math.max(0, Number(document.getElementById('planEditRest')?.value || task.spec.actionRest || 0)),
                repRest: Math.max(0, Number(document.getElementById('planEditRepRest')?.value || task.spec.repRest || 0)),
                isAlt: !!document.getElementById('planEditIsAlt')?.checked
            };
            task.aiReasoning = String(document.getElementById('planEditReason')?.value || '').trim();
            task.invalidSpec = (task.spec.reps <= 0 && task.spec.work <= 0);
            const choiceId = nameInput?.getAttribute?.('data-plan-edit-choice-id') || '';
            const choice = this.resolvePlanActionChoiceForText?.(task.name, choiceId) || null;
            if (choice || nameChanged) {
                const meta = choice || window.planPolicy?.actionMetaForName?.([task.name, task.aiReasoning].filter(Boolean).join(' ')) || {};
                task.actionKey = choice?.actionKey || meta.actionKey || '';
                task.canonicalName = choice?.canonicalName || meta.canonicalName || task.name || '';
                task.progressionGroup = choice?.progressionGroup || meta.progressionGroup || '';
                task.progressionLevel = Number(choice?.progressionLevel ?? meta.progressionLevel ?? 0);
                task.chainId = choice?.chainId || meta.chainId || '';
                if (choice?.sourceActionId) task.sourceActionId = choice.sourceActionId;
                else delete task.sourceActionId;
                if (choice?.prescriptionActionId) task.prescriptionActionId = choice.prescriptionActionId;
                else delete task.prescriptionActionId;
                task.policy = {
                    ...(task.policy || {}),
                    source: choice?.source || 'user-edit',
                    choiceLabel: choice?.sourceLabel || '',
                    prescriptionName: choice?.source === 'prescription' ? choice.name : ''
                };
            }
            const prefs = this.ensurePlanPrefs?.() || {};
            if (prefs.askOnEdit !== 'pass_default') task.userOverride = true;
            if (prefs.askOnEdit === 'pass_default') task.userOverride = false;
            this.touchRecord(task, ['name', 'category', 'spec', 'aiReasoning', 'userOverride', 'actionKey', 'canonicalName', 'progressionGroup', 'progressionLevel', 'chainId', 'sourceActionId', 'prescriptionActionId', 'policy']);
            this.touchRecord(plan, ['items']);
            this.save();
            this._closeActiveModal();
        },

        markPlanTaskDone(planId, taskId) {
            const { task } = this.findTask?.(planId, taskId) || {};
            if (task?.requiresUserConfirm && !task.userConfirmed) {
                const confirmMeta = taskConfirmMeta(task);
                return this._openModal({
                    title: confirmMeta.title,
                    icon: 'verified',
                    bodyHtml: `<p class="md-muted">${this.escapeHtml(task.name || '此动作')} ${confirmMeta.detail}确认后标记完成并记录反馈。</p>`,
                    actionsHtml: `
                        <button class="md-btn" type="button" data-modal-close>取消</button><button class="md-btn md-btn-filled" type="button" onclick="data.confirmPlanTaskSuggestion('${planId}','${taskId}', { silent: true, keepModalOpen: true }); data.markPlanTaskDone('${planId}','${taskId}')">确认并完成</button>
                    `
                });
                return;
            }
            this.updateItemStatus?.(planId, taskId, 'done');
            this.openPlanFeedback?.(planId, taskId);
            this.render?.();
        },

        openPlanTaskMenu(planId, taskId) {
            const { task } = this.findTask?.(planId, taskId) || {};
            if (!task) return;
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowKey = this.dateKey(tomorrow);
            const confirmMeta = taskConfirmMeta(task);
            return this._openModal({
                title: this.escapeHtml(task.name || '任务'),
                icon: 'more_vert',
                bodyHtml: `<div class="weekly-plan-picker">
                    ${task.requiresUserConfirm && !task.userConfirmed ? `<button class="model-picker-row plan-policy-confirm-row" type="button" onclick="data.confirmPlanTaskSuggestion('${planId}','${taskId}')"><span class="material-symbols-rounded">verified</span><span class="model-picker-main"><strong>${confirmMeta.title}</strong><small>${confirmMeta.detail}确认后执行</small></span></button>` : ''}
                    <button class="model-picker-row" type="button" onclick="data.openPlanTaskEdit('${planId}','${taskId}')"><span class="material-symbols-rounded">edit</span><span class="model-picker-main"><strong>编辑动作</strong><small>临时修改名称、阶段和训练参数</small></span></button><button class="model-picker-row" type="button" onclick="data.movePlanTaskTo('${planId}','${taskId}','${this.logicalDateKey?.() || this.dateKey(new Date())}')"><span class="material-symbols-rounded">today</span><span class="model-picker-main"><strong>移到今天</strong><small>回到当前日期执行</small></span></button><button class="model-picker-row" type="button" onclick="data.movePlanTaskTo('${planId}','${taskId}','${tomorrowKey}')"><span class="material-symbols-rounded">event</span><span class="model-picker-main"><strong>移到明天</strong><small>延后一天执行</small></span></button><button class="model-picker-row" type="button" onclick="data.togglePlanTaskLock('${planId}','${taskId}')"><span class="material-symbols-rounded">${task.userOverride ? 'lock_open' : 'lock'}</span><span class="model-picker-main"><strong>${task.userOverride ? '取消锁定' : '锁定任务'}</strong><small>锁定后 AI 不覆盖</small></span></button><button class="model-picker-row" type="button" onclick="data.deletePlanTaskConfirm('${planId}','${taskId}')"><span class="material-symbols-rounded">delete</span><span class="model-picker-main"><strong>删除任务</strong><small>软删除，可同步</small></span></button></div>`,
                actionsHtml: `<button class="md-btn" type="button" data-modal-close>关闭</button>`
            });
        },

        movePlanTaskTo(planId, taskId, targetDate) {
            this.moveTask?.(planId, taskId, targetDate);
            this._closeActiveModal();
            this.render?.();
        },

        togglePlanTaskLock(planId, taskId) {
            const { task } = this.findTask?.(planId, taskId) || {};
            if (!task) return;
            this.lockItem?.(planId, taskId, !task.userOverride);
            this._closeActiveModal();
            this.render?.();
        },

        confirmPlanTaskSuggestion(planId, taskId, options = {}) {
            const { plan, task } = this.findTask?.(planId, taskId) || {};
            if (!plan || !task) return false;
            task.userConfirmed = true;
            task.policy = { ...(task.policy || {}), userConfirmedAt: Date.now() };
            this.touchRecord?.(task, ['userConfirmed', 'policy']);
            this.touchRecord?.(plan, ['items']);
            if (options.save !== false) this.save?.();
            if (options.close !== false) this._closeActiveModal();
            if (options.render !== false) this.render?.();
            window.toast?.show?.(taskConfirmMeta(task).badge, 'success');
            return true;
        },

        deletePlanTaskConfirm(planId, taskId) {
            this.deleteTask?.(planId, taskId);
            this._closeActiveModal();
            const stillActive = this.activeRecords?.(this.db.dailyPlans || []).some((plan) => plan.id === planId);
            if (!stillActive) this.closePlanTaskDrawer?.();
            this.render?.();
        },

        async handlePlanTaskTap(planId, taskId) {
            const { task } = this.findTask?.(planId, taskId) || {};
            if (!task) return;
            if (task.requiresUserConfirm && !task.userConfirmed) {
                const confirmMeta = taskConfirmMeta(task);
                this._confirmModal({
                    title: confirmMeta.title,
                    icon: 'verified',
                    message: `${confirmMeta.detail}确认后开始训练。`,
                    okText: '确认并开始',
                    cancelText: '先不做',
                    onOk: async () => {
                        this.confirmPlanTaskSuggestion?.(planId, taskId, { save: false, close: false, render: false });
                        await this.runPlanTask(planId, taskId, { confirmedSuggestion: true });
                    }
                });
                return;
            }
            if (window.workout?.isPlaying) {
                const ok = confirm('正在训练，切换到计划任务？');
                if (!ok) return;
                window.workout.stop?.();
            }
            await this.runPlanTask(planId, taskId);
        },

        buildWorkoutActionFromPlanTask(task, options = {}) {
            const spec = task.spec || {};
            const phase = options.asCooldown ? 'cooldown' : (task.category === 'warmup' ? 'warmup' : (task.category === 'cooldown' ? 'cooldown' : 'main'));
            const prefix = phase === 'warmup' ? '计划·热身' : (phase === 'cooldown' ? '计划·拉伸' : '计划');
            return {
                id: `plan-run-${task.id}`,
                sourceActionId: task.id,
                name: `${prefix}·${task.name}`,
                sets: Math.max(1, Number(spec.sets || 1)),
                reps: Math.max(0, Number(spec.reps || 0)),
                work: Math.max(0, Number(spec.work || 0)),
                repRest: Math.max(0, Number(spec.repRest || 0)),
                actionRest: Math.max(0, Number(spec.actionRest || 0)),
                groupRest: Math.max(0, Number(spec.actionRest || 0)),
                switchRest: 3,
                isAlt: !!spec.isAlt,
                phase,
                libOnly: false,
                deleted: false,
                updatedAt: Date.now(),
                plan: true,
                planType: task.planType || 'rehab',
                excludeFromPr: true
            };
        },

        async runPlanTask(planId, taskId, options = {}) {
            const { plan, task } = this.findTask?.(planId, taskId) || {};
            if (!plan || !task) return;
            if (task.requiresUserConfirm && !task.userConfirmed && !options.confirmedSuggestion) {
                window.toast?.show?.('需先确认', 'error');
                return;
            }
            this.updateItemStatus?.(planId, taskId, 'in-progress', {}, { save: false });
            const previousPlan = JSON.parse(JSON.stringify(this._planActions?.() || []));
            this.activeRun = {
                planId,
                taskId,
                previousPlan,
                queueFollowup: !!options.queueFollowup,
                asCooldown: !!options.asCooldown
            };
            this.closePlanTaskDrawer?.();
            this._replacePlanActions?.([this.buildWorkoutActionFromPlanTask(task, options)]);
            this.save();
            await ui.tab('workout', navButton('workout'));
            requestAnimationFrame(() => {
                window.workout?.setMode?.('strength');
                this.renderWorkoutPlanCard?.();
                this.renderActions?.();
                this.updatePlanWorkoutBanner?.();
                if (!window.workout?.isPlaying) window.workout?.toggle?.();
            });
        },

        updatePlanWorkoutBanner() {
            const banner = document.getElementById('planWorkoutBanner');
            if (!banner) return;
            const ctx = this.activeRun;
            if (!ctx) {
                banner.classList.add('hidden');
                banner.innerHTML = '';
                return;
            }
            const { plan, task } = this.findTask?.(ctx.planId, ctx.taskId) || {};
            if (!plan || !task) return;
            const completion = this.completionRate?.(plan) || { done: 0, total: 0 };
            banner.classList.remove('hidden');
            const meta = this.planTypeMeta?.(plan.type, plan.title) || { taskLabel: '计划任务', icon: 'event_note' };
            banner.innerHTML = `<span class="material-symbols-rounded">${meta.icon}</span><strong>${this.escapeHtml(meta.taskLabel)} · ${this.escapeHtml(task.name || '')}</strong><small>${completion.done}/${completion.total || 0} 完成</small>`;
        },

        handlePlanWorkoutFinished(historyRecord) {
            const ctx = this.activeRun || historyRecord.__planCtx || null;
            if (!ctx) return;
            const { plan, task } = this.findTask?.(ctx.planId, ctx.taskId) || {};
            if (!plan || !task) {
                if (this.activeRun) this.activeRun = null;
                this.updatePlanWorkoutBanner?.();
                return;
            }
            historyRecord.plan = true;
            historyRecord.planType = plan.type || task.planType || 'rehab';
            historyRecord.planId = ctx.planId;
            historyRecord.planTaskId = ctx.taskId;
            historyRecord.planCooldown = !!ctx.asCooldown;
            this.updateItemStatus?.(ctx.planId, ctx.taskId, 'done', { doneSets: Number(task.spec?.sets || 1) }, { save: false });
            if (ctx.previousPlan) this._replacePlanActions?.(ctx.previousPlan);
            this.save();
            this.updatePlanWorkoutBanner?.();
            const queueFollowup = !!ctx.queueFollowup;
            const planId = ctx.planId;
            const isCooldown = !!ctx.asCooldown;
            this._planSaveRoutineManualStop = !!historyRecord.manualStop;
            this.activeRun = null;
            if (!isCooldown) this.openPlanFeedback?.(planId, ctx.taskId);
            else if (!queueFollowup) {
                this.maybePromptSavePlanRoutine?.({ manualStop: !!historyRecord.manualStop });
                this.maybeAutoAdjustNextDayAfterFeedback?.(planId);
            }
            if (queueFollowup) {
                const nextPlan = this.getTodayDailyPlans?.()?.find((item) => item.pendingCooldowns?.length);
                const next = nextPlan?.pendingCooldowns?.[0];
                if (next) {
                    setTimeout(() => this.runQueuedCooldown?.(nextPlan.id, next), 500);
                } else if (isCooldown) {
                    this.maybePromptSavePlanRoutine?.({ manualStop: !!historyRecord.manualStop });
                    this.maybeAutoAdjustNextDayAfterFeedback?.(planId);
                }
            }
        },

        maybePromptSavePlanRoutine(options = {}) {
            const plan = this.getTodayDailyPlan?.();
            if (!plan) return;
            const completion = this.completionRate?.(plan) || { rate: 0, done: 0, total: 0 };
            if (!completion.total || completion.rate < 0.8) {
                this._planSaveRoutineManualStop = false;
                return;
            }
            const hour = new Date().getHours();
            const manualStop = !!(options === true || options.force || options.manualStop || this._planSaveRoutineManualStop);
            this._planSaveRoutineManualStop = false;
            if (!manualStop && hour < 23) return;
            if (plan.planRoutineSavedAt || plan.planRoutineDismissedAt) return;
            return this._openModal({
                title: '保存为方案',
                icon: 'bookmark_add',
                bodyHtml: `<div class="plan-save-routine-sheet"><p>今日计划 ${completion.done}/${completion.total} 完成，存为方案？</p><small>保存后会进入方案库，并带有计划标记。</small></div>`,
                actionsHtml: `
                    <button class="md-btn" type="button" data-plan-save-dismiss>不用</button><button class="md-btn md-btn-tonal" type="button" data-plan-save-rename>改名后存</button><button class="md-btn md-btn-filled" type="button" data-plan-save-default>默认存</button>
                `,
                onMount: (root, close) => {
                    root.querySelector('[data-plan-save-dismiss]')?.addEventListener('click', () => {
                        plan.planRoutineDismissedAt = Date.now();
                        this.touchRecord(plan, ['planRoutineDismissedAt']);
                        this.save();
                        close();
                    });
                    root.querySelector('[data-plan-save-default]')?.addEventListener('click', () => {
                        this.savePlanPlanAsRoutine();
                        close();
                    });
                    root.querySelector('[data-plan-save-rename]')?.addEventListener('click', () => {
                        close();
                        this._textPromptModal?.({
                            title: '方案名称',
                            icon: 'edit',
                            label: '方案名称',
                            initialValue: `${plan.title || '训练计划'} ${plan.date}`,
                            okText: '保存',
                            cancelText: '取消',
                            onOk: (name) => this.savePlanPlanAsRoutine(name)
                        });
                    });
                }
            });
        },

        savePlanPlanAsRoutine(name = '') {
            const plan = this.getTodayDailyPlan?.();
            if (!plan) return;
            const routineName = name || `${plan.title || '训练计划'} ${plan.date}`;
            if (plan.planRoutineSavedAt) {
                window.toast?.show?.('今天的训练计划已保存过', 'info');
                return;
            }
            const actions = (plan.items || []).filter((item) => !item.deleted).map((item) => this.buildWorkoutActionFromPlanTask(item, { asCooldown: item.category === 'cooldown' }));
            const routine = {
                name: routineName,
                plan: true,
                planType: plan.type || 'rehab',
                planId: plan.id,
                actions,
                tags: [plan.title || '训练计划'],
                created: new Date().toLocaleDateString(),
                id: this.generateRecordId('routine'),
                updatedAt: Date.now(),
                deleted: false
            };
            this.db.routines.push(routine);
            plan.planRoutineSavedAt = Date.now();
            plan.planRoutineId = routine.id;
            this.touchRecord(plan, ['planRoutineSavedAt', 'planRoutineId']);
            this.save();
            window.toast?.show?.(`已存入方案库：${routineName}`, 'success');
        },

        bindPlanQuickRepeat() {
            if (this._planQuickRepeatBound) return;
            this._planQuickRepeatBound = true;
            let timer = 0;
            let targetType = '';
            document.addEventListener('pointerdown', (event) => {
                const btn = event.target?.closest?.('[data-plan-quick]');
                if (!btn) return;
                targetType = btn.getAttribute('data-plan-quick') || '';
                timer = window.setTimeout(() => this.openPlanQuickRepeat(targetType), 1000);
            }, true);
            const clear = () => {
                clearTimeout(timer);
                timer = 0;
                targetType = '';
            };
            document.addEventListener('pointerup', clear, true);
            document.addEventListener('pointercancel', clear, true);
            document.addEventListener('pointerleave', clear, true);
        },

        openPlanQuickRepeat(type) {
            if (!type) return;
            const rows = type === 'weight'
                ? this.sortedWeights?.().slice(-5).reverse().map((item) => ({
                    title: `${Number(item.weight || 0).toFixed(2)} kg`,
                    meta: item.note || item.date,
                    onClick: () => {
                        this.openWeightModal?.();
                        setTimeout(() => {
                            const input = document.getElementById('weightInput');
                            if (input) input.value = String(item.weight || '');
                        }, 80);
                    }
                }))
                : type === 'diet'
                    ? this.activeRecords(this.db.health.foodLogs || []).slice(-5).reverse().map((item) => ({
                        title: item.name || '饮食记录',
                        meta: `${item.cal || 0} kcal`,
                        onClick: () => this.openDietModal?.()
                    }))
                    : type === 'cardio'
                        ? this.activeRecords(this.db.health.exerciseLogs || []).slice(-5).reverse().map((item) => ({
                            title: this.exerciseLabel?.(item.type, item) || '有氧',
                            meta: `${item.minutes || 0} 分钟`,
                            onClick: () => this.openExerciseModal?.()
                        }))
                        : this.activeRecords(this.db.history || []).slice(-5).reverse().map((item) => ({
                            title: this.historyNames?.(item)?.[0] || '力量记录',
                            meta: `${Math.round((item.duration || 0) / 60)} 分钟`,
                            onClick: () => this.openPlanQuickRecord('strength')
                        }));
            if (!rows.length) return;
            return this._openModal({
                title: '快速重复',
                icon: 'history',
                bodyHtml: rows.map((row) => `<button class="model-picker-row" type="button"><span class="material-symbols-rounded">history</span><span class="model-picker-main"><strong>${this.escapeHtml(row.title || '')}</strong><small>${this.escapeHtml(row.meta || '')}</small></span></button>`).join(''),
                actionsHtml: '<button class="md-btn" type="button" data-modal-close>关闭</button>',
                onMount: (root, close) => {
                    root.querySelectorAll('.model-picker-row').forEach((btn, index) => {
                        btn.addEventListener('click', () => {
                            rows[index]?.onClick?.();
                            close();
                        });
                    });
                }
            });
        }
    });
})();
