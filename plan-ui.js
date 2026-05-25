// @ts-nocheck
(function () {
    if (window.dataPlanUi?.renderPlanTodaySection) return;

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

    function taskSpecText(task = {}) {
        const spec = task.spec || {};
        const category = taskCategoryMeta(task);
        const main = Number(spec.reps || 0) > 0 ? `每组${Number(spec.reps || 0)}次` : `每次${Number(spec.work || 0)}秒`;
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

    window.dataPlanUi = Object.assign(window.dataPlanUi || {}, {
        renderPlanTodaySection() {
            const plans = this.getTodayDailyPlans?.() || [];
            if (!plans.length) this.ensureTodayPlan?.();
            const todayPlans = this.getTodayDailyPlans?.() || [];
            const aggregate = this.aggregateCompletionRate?.(todayPlans) || { done: 0, total: 0, rate: 0 };
            const selected = todayPlans.find((item) => item.id === this.selectedPlanId) || todayPlans[0] || null;
            if (selected) this.selectedPlanId = selected.id;
            const completion = this.completionRate?.(selected) || { done: 0, total: 0, rate: 0 };
            const plan = selected;
            const planMeta = this.planTypeMeta?.(plan?.type || 'rehab', plan?.title) || { label: '训练计划', taskLabel: '任务', icon: 'event_note' };
            const items = (plan.items || []).filter((item) => !item.deleted).sort((a, b) => taskSort(a) - taskSort(b));
            const current = items.find((item) => item.status === 'in-progress') || items.find((item) => item.status === 'todo') || null;
            const percent = Math.round((aggregate.rate || 0) * 100);
            const pending = items.filter((item) => item.status === 'todo' || item.status === 'in-progress').length;
            const currentMeta = taskStatusMeta(current || {});
            const today = this.logicalDateKey?.() || this.dateKey(new Date());
            const prefs = this.ensurePlanPrefs?.() || {};
            const cooldownCount = todayPlans.reduce((sum, item) => sum + Number(this.pendingCooldownCount?.(item) || 0), 0);
            const weekdays = ['周日','周一','周二','周三','周四','周五','周六'];
            const weekday = weekdays[this.dateFromKey(today).getDay()];
            const weight = this.activeRecords?.(this.db.health?.weights || []).find((item) => item.date === today) || this.sortedWeights?.().slice(-1)[0] || null;
            const exerciseCal = Math.round(this.todayTrainingCalories?.() || 0);
            const metricText = [
                weight ? `体重 ${Number(weight.weight || 0).toFixed(1)} kg` : '',
                `${exerciseCal} kcal 消耗`
            ].filter(Boolean).join(' · ');
            return `<div class="md-card plan-today-card plan-hero-card">
                <div class="plan-today-head">
                    <div>
                        <h3>${today.slice(5, 7)}月${today.slice(8, 10)}日 ${weekday}</h3>
                        <small class="plan-today-metrics">${this.escapeHtml(metricText || '现在 / 今天 / 接下来')}</small>
                        ${plan?.notes ? `<small>${this.escapeHtml(plan.notes)}</small>` : ''}
                    </div>
                    <div class="plan-card-actions">
                        ${prefs.showCooldownDock === false ? '' : `<button class="md-icon-btn" type="button" ${cooldownCount ? 'onclick="data.openPlanPendingCooldownSheet?.()"' : 'disabled'} aria-label="${cooldownCount ? `待集中拉伸 ${cooldownCount} 项` : '暂无待集中拉伸'}" title="${cooldownCount ? `待集中拉伸 ${cooldownCount} 项` : '暂无待集中拉伸'}"><span class="material-symbols-rounded">self_improvement</span>${cooldownCount ? `<b>${cooldownCount}</b>` : ''}</button>`}
                        <button class="md-icon-btn" type="button" onclick="planWeekly.open()" aria-label="本周计划"><span class="material-symbols-rounded">calendar_month</span></button>
                        <button class="md-icon-btn" type="button" onclick="data.openPlanTodayAiSheet?.()" aria-label="AI 重排训练计划"><span class="material-symbols-rounded">auto_awesome</span></button>
                    </div>
                </div>
                <div class="plan-ring-row">
                    ${this.renderPlanIntakeRing?.() || ''}
                    <button class="today-focus-ring plan-progress-ring ${plan ? planStatusClass(plan.type) : 'is-empty'}" style="--plan-progress:${percent * 3.6}deg" type="button" onclick="${plan ? `data.openPlanTaskDrawer('${plan.id}')` : 'data.openNewPlanSheet()'}">
                        <div>
                            <b>${aggregate.total ? `${aggregate.done}/${aggregate.total}` : '+'}</b>
                            <small>${aggregate.total ? '计划' : '新建'}</small>
                            <em>${plan ? this.escapeHtml(plan.title || planMeta.label) : '添加计划'}</em>
                        </div>
                    </button>
                </div>
                ${todayPlans.length > 1 ? `<div class="plan-type-tabs">${todayPlans.map((item) => {
                    const meta = this.planTypeMeta?.(item.type, item.title) || { label: item.title || '计划', icon: 'event_note' };
                    return `<button class="plan-type-tab ${item.id === plan.id ? 'active' : ''} ${planStatusClass(item.type)}" type="button" onclick="data.selectTodayPlan('${item.id}')"><span class="material-symbols-rounded">${meta.icon}</span>${this.escapeHtml(item.title || meta.label)}</button>`;
                }).join('')}</div>` : ''}
                <div class="plan-current-block ${planStatusClass(plan?.type)}">
                    <span class="material-symbols-rounded plan-current-icon">${currentMeta.icon}</span>
                    <span class="plan-current-copy">
                        <strong>${current ? `下一项：${this.escapeHtml(current.name || '暂无任务')}` : this.escapeHtml(plan?.title || planMeta.label)}</strong>
                        <small>${current ? `${taskSpecText(current)}${current.currentLevel ? ` · Lv${current.currentLevel}` : ''}` : '点击 + 新建训练计划或让 AI 排程'}</small>
                    </span>
                    ${current ? `<div class="plan-current-actions">
                        <button class="md-btn md-btn-filled" type="button" onclick="data.handlePlanTaskTap('${plan.id}','${current.id}')"><span class="material-symbols-rounded">play_arrow</span>开始</button>
                        <button class="md-btn md-btn-tonal" type="button" onclick="data.updateItemStatus('${plan.id}','${current.id}','skipped');data.renderTodayPage?.()">跳过</button>
                        <button class="md-btn md-btn-tonal" type="button" onclick="data.markPlanTaskDone('${plan.id}','${current.id}')">完成</button>
                    </div>` : `<button class="md-btn md-btn-tonal" type="button" onclick="data.openNewPlanSheet()"><span class="material-symbols-rounded">add</span>新建训练计划</button>`}
                    <button class="plan-current-list-btn" type="button" onclick="${plan ? `data.openPlanTaskDrawer('${plan.id}')` : 'data.openNewPlanSheet()'}" aria-label="查看今日任务">
                        <span class="material-symbols-rounded">playlist_add</span>
                        ${pending ? `<b>${pending}</b>` : ''}
                    </button>
                </div>
            </div>`;
        },

        renderPlanIntakeRing() {
            const intake = this.todayCalories?.() || 0;
            const macros = this.todayMacros?.() || { pro: 0, carb: 0, fat: 0 };
            const goalCal = this.db.health?.dietGoal?.dailyCal || 0;
            const goals = this.defaultDietGoals?.() || { pro: 0, carb: 0, fat: 0 };
            const progress = goalCal ? Math.min(100, Math.round((intake / goalCal) * 100)) : 0;
            const remaining = goalCal ? goalCal - intake : 0;
            const remainingText = goalCal ? (remaining >= 0 ? `剩余${remaining}kcal` : `超出${Math.abs(remaining)}kcal`) : '';
            const macroStops = {
                pro: Math.min(120, this.ratio(macros.pro, goals.pro) * 1.2),
                carb: 120 + Math.min(120, this.ratio(macros.carb, goals.carb) * 1.2),
                fat: 240 + Math.min(120, this.ratio(macros.fat, goals.fat) * 1.2)
            };
            if (!goalCal) return '<div class="today-focus-ring macro-focus-ring plan-intake-ring"><div><b>--</b><small>摄入</small></div></div>';
            return `<div class="today-focus-ring macro-focus-ring plan-intake-ring" style="--progress:${progress};--pro-stop:${macroStops.pro}deg;--carb-stop:${macroStops.carb}deg;--fat-stop:${macroStops.fat}deg"><div><b>${progress}%</b><small>摄入</small><em>${remainingText}</em></div></div>`;
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
            this.openPlanAiSheet?.('today', this.todayPlanAiTypes());
        },

        openNewPlanSheet() {
            const types = ['rehab', 'cut', 'bulk', 'maintenance', 'custom'];
            this._newPlanTypes = normalizePlanTypes(this._newPlanTypes || ['rehab']);
            this._openModal?.({
                title: '+ 新建训练计划',
                icon: 'add_circle',
                bodyHtml: `<div id="planCreateSheetBody">${this.renderNewPlanSheetBody(types)}</div>`,
                actionsHtml: `
                    <button class="md-btn" type="button" data-modal-close>关闭</button>
                    <button class="md-btn md-btn-tonal" type="button" onclick="data.createSelectedPlans(false)">手动创建</button>
                    <button class="md-btn md-btn-filled" type="button" onclick="data.createSelectedPlans(true)">AI 生成</button>
                `
            });
        },

        renderNewPlanSheetBody(types = ['rehab']) {
            const selected = new Set(normalizePlanTypes(this._newPlanTypes || ['rehab']));
            return `<div class="plan-create-sheet">
                <p>可同时选择多个计划类型。AI 会一次生成多个 plan，手动创建则直接建立空白 plan。</p>
                ${types.map((type) => {
                    const meta = this.planTypeMeta?.(type) || { label: type, icon: 'event_note' };
                    return `<button class="model-picker-row plan-create-row ${planStatusClass(type)} ${selected.has(type) ? 'active' : ''}" type="button" onclick="data.toggleNewPlanType('${type}')">
                        <span class="material-symbols-rounded">${selected.has(type) ? 'check_circle' : meta.icon}</span>
                        <span class="model-picker-main"><strong>${this.escapeHtml(meta.label)}</strong><small>AI 会按该目标生成任务和放松安排</small></span>
                    </button>`;
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
            this._closeActiveModal?.();
            if (openAi) this.openPlanAiSheet?.('today', types);
            this.renderTodayPage?.();
        },

        renderTodayActionDock() {
            return `<div class="today-action-dock">
                <button class="record-quick-btn" type="button" data-plan-quick="diet" onclick="data.openDietModal()"><span class="material-symbols-rounded">restaurant</span><span>记饮食</span></button>
                <button class="record-quick-btn" type="button" data-plan-quick="cardio" onclick="data.openExerciseModal()"><span class="material-symbols-rounded">fitness_center</span><span>记运动</span></button>
                <button class="record-quick-btn" type="button" data-plan-quick="weight" onclick="data.openWeightModal()"><span class="material-symbols-rounded">monitor_weight</span><span>记体重</span></button>
                <button class="record-quick-btn record-quick-btn-ai context-ai-btn" type="button" data-ai-ctx="today" data-ai-idx="0"><span class="material-symbols-rounded">psychology</span><span>问 AI</span></button>
            </div>`;
        },

        renderTodayAiReminder() {
            const collapsed = this.isCollapsed?.('todayAiReminder', true);
            return `<div class="md-card collapsible-card today-ai-reminder ${collapsed ? 'collapsed' : ''}">
                <button class="panel-head collapsible-head-btn" type="button" onclick="data.toggleCollapse('todayAiReminder')">
                    <div><span class="cardio-kicker">AI</span><h3>今日 AI 提醒</h3><small>展开查看快速建议</small></div>
                    <span class="collapse-btn"><span class="material-symbols-rounded">${collapsed ? 'expand_more' : 'expand_less'}</span></span>
                </button>
                <div class="collapse-content">${this.renderContextAiCard?.('today') || ''}</div>
            </div>`;
        },

        renderPlanTaskDrawerBody(planId) {
            const plan = this.activeRecords?.(this.db.dailyPlans || []).find((item) => item.id === planId) || this.getTodayDailyPlan?.();
            if (!plan) return '<div class="plan-empty">暂无训练任务</div>';
            const planMeta = this.planTypeMeta?.(plan.type, plan.title) || { label: '训练计划', icon: 'event_note' };
            const completion = this.completionRate?.(plan) || { done: 0, total: 0, rate: 0 };
            const items = (plan.items || []).filter((item) => !item.deleted).sort((a, b) => taskSort(a) - taskSort(b));
            const sections = [
                ['待运动', 'todo', items.filter((item) => item.status === 'todo' || item.status === 'in-progress')],
                ['已完成', 'done', items.filter((item) => item.status === 'done')],
                ['已跳过', 'skipped', items.filter((item) => item.status === 'skipped')]
            ];
            return `<div class="plan-task-drawer">
                <div class="plan-drawer-summary ${planStatusClass(plan.type)}">
                    <span class="material-symbols-rounded plan-drawer-summary-icon">${planMeta.icon}</span>
                    <span class="plan-drawer-summary-copy">
                        <strong>${this.escapeHtml(plan.title || planMeta.label)}</strong>
                        <small>${completion.total ? `${completion.done}/${completion.total} 完成` : '暂无待完成训练'}${plan.notes ? ` · ${this.escapeHtml(plan.notes)}` : ''}</small>
                    </span>
                    <button class="md-btn md-btn-tonal plan-cancel-day-btn" type="button" data-cancel-plan-id="${this.escapeHtml(plan.id)}" title="取消今日计划" aria-label="取消今日计划">
                        <span class="material-symbols-rounded">event_busy</span><span>取消计划</span>
                    </button>
                </div>
                ${sections.map(([label, key, list]) => `
                    <section class="plan-section plan-section-${key}">
                        <div class="plan-section-head"><strong>${label}</strong><small>${list.length}</small></div>
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
                <div class="md-modal-backdrop" data-modal-close></div>
                <div class="md-modal-card md-modal-sheet-card">
                    <div class="md-modal-head">
                        <strong>今日训练任务</strong>
                        <button class="icon-btn" type="button" data-modal-close aria-label="关闭"><span class="material-symbols-rounded">close</span></button>
                    </div>
                    <div class="md-modal-body" id="planTaskDrawerBody">${this.renderPlanTaskDrawerBody(planId)}</div>
                </div>`;
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
            this._confirmModal?.({
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
            const doneMeta = task.feedback?.doneAt ? `<small>${formatTime(task.feedback.doneAt)} · ${this.escapeHtml(task.feedback?.note || '')}</small>` : '';
            const meta = taskStatusMeta(task);
            return `<div class="plan-task-row ${meta.className}">
                <button class="plan-task-main" type="button" onclick="data.handlePlanTaskTap('${planId}','${task.id}')">
                    <span class="plan-task-order">${index}</span>
                    <span class="plan-task-body">
                        <span class="plan-task-title">
                            <strong>${this.escapeHtml(task.name || '未命名任务')}</strong>
                            <em><span class="material-symbols-rounded">${meta.icon}</span>${meta.label}</em>
                        </span>
                        <small>${taskSpecText(task)}${task.currentLevel ? ` · Lv${task.currentLevel}` : ''}${task.userOverride ? ' · 已锁定' : ''}</small>
                        ${!compact && doneMeta}
                    </span>
                </button>
                <div class="plan-task-actions">
                    <button class="md-icon-btn" type="button" onclick="event.stopPropagation();data.openPlanTaskEdit('${planId}','${task.id}')" aria-label="编辑参数"><span class="material-symbols-rounded">tune</span></button>
                    <button class="md-icon-btn" type="button" onclick="event.stopPropagation();data.markPlanTaskDone('${planId}','${task.id}')" aria-label="手动完成"><span class="material-symbols-rounded">done</span></button>
                    <button class="md-icon-btn" type="button" onclick="event.stopPropagation();data.openPlanTaskMenu('${planId}','${task.id}')" aria-label="更多"><span class="material-symbols-rounded">more_vert</span></button>
                </div>
            </div>`;
        },

        renderPlanManualStrip() {
            return `<div class="plan-manual-strip">
                <div class="record-quick-actions">
                    <button class="record-quick-btn" type="button" data-plan-quick="diet" onclick="data.openDietModal()"><span class="material-symbols-rounded">restaurant</span><span>记饮食</span></button>
                    <button class="record-quick-btn" type="button" data-plan-quick="cardio" onclick="data.openExerciseModal()"><span class="material-symbols-rounded">fitness_center</span><span>记运动</span></button>
                    <button class="record-quick-btn" type="button" data-plan-quick="weight" onclick="data.openWeightModal()"><span class="material-symbols-rounded">monitor_weight</span><span>记体重</span></button>
                    <button class="record-quick-btn record-quick-btn-ai context-ai-btn" type="button" data-ai-ctx="today" data-ai-idx="0"><span class="material-symbols-rounded">psychology</span><span>问 AI</span></button>
                </div>
            </div>`;
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

        openPlanTaskEdit(planId, taskId) {
            const { task } = this.findTask?.(planId, taskId) || {};
            if (!task) return;
            const current = task.spec || {};
            this._openModal?.({
                title: '调整任务参数',
                icon: 'tune',
                bodyHtml: `
                    <div class="md-grid modal-grid" style="gap:10px">
                        <div class="md-field"><input id="planEditSets" type="number" placeholder=" " value="${Number(current.sets || 1)}"><label>组数</label></div>
                        <div class="md-field"><input id="planEditReps" type="number" placeholder=" " value="${Number(current.reps || 0)}"><label>次数</label></div>
                        <div class="md-field"><input id="planEditWork" type="number" placeholder=" " value="${Number(current.work || 0)}"><label>时长（秒）</label></div>
                        <div class="md-field"><input id="planEditRest" type="number" placeholder=" " value="${Number(current.actionRest || 0)}"><label>组间休息</label></div>
                    </div>`,
                actionsHtml: `
                    <button class="md-btn" type="button" data-modal-close>取消</button>
                    <button class="md-btn md-btn-filled" type="button" onclick="data.savePlanTaskEdit('${planId}','${taskId}')">保存</button>
                `
            });
        },

        savePlanTaskEdit(planId, taskId) {
            const { plan, task } = this.findTask?.(planId, taskId) || {};
            if (!plan || !task) return;
            task.spec = {
                ...task.spec,
                sets: Math.max(1, Number(document.getElementById('planEditSets')?.value || task.spec.sets || 1)),
                reps: Math.max(0, Number(document.getElementById('planEditReps')?.value || task.spec.reps || 0)),
                work: Math.max(0, Number(document.getElementById('planEditWork')?.value || task.spec.work || 0)),
                actionRest: Math.max(0, Number(document.getElementById('planEditRest')?.value || task.spec.actionRest || 0))
            };
            const prefs = this.ensurePlanPrefs?.() || {};
            if (prefs.askOnEdit === 'lock_default') task.userOverride = true;
            if (prefs.askOnEdit === 'pass_default') task.userOverride = false;
            this.touchRecord(task, ['spec', 'userOverride']);
            this.touchRecord(plan, ['items']);
            this.save();
            this._closeActiveModal?.();
        },

        markPlanTaskDone(planId, taskId) {
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
            this._openModal?.({
                title: this.escapeHtml(task.name || '任务'),
                icon: 'more_vert',
                bodyHtml: `<div class="weekly-plan-picker">
                    <button class="model-picker-row" type="button" onclick="data.movePlanTaskTo('${planId}','${taskId}','${this.logicalDateKey?.() || this.dateKey(new Date())}')"><span class="material-symbols-rounded">today</span><span class="model-picker-main"><strong>移到今天</strong><small>回到当前日期执行</small></span></button>
                    <button class="model-picker-row" type="button" onclick="data.movePlanTaskTo('${planId}','${taskId}','${tomorrowKey}')"><span class="material-symbols-rounded">event</span><span class="model-picker-main"><strong>移到明天</strong><small>延后一天执行</small></span></button>
                    <button class="model-picker-row" type="button" onclick="data.togglePlanTaskLock('${planId}','${taskId}')"><span class="material-symbols-rounded">${task.userOverride ? 'lock_open' : 'lock'}</span><span class="model-picker-main"><strong>${task.userOverride ? '取消锁定' : '锁定任务'}</strong><small>锁定后 AI 不覆盖</small></span></button>
                    <button class="model-picker-row" type="button" onclick="data.deletePlanTaskConfirm('${planId}','${taskId}')"><span class="material-symbols-rounded">delete</span><span class="model-picker-main"><strong>删除任务</strong><small>软删除，可同步</small></span></button>
                </div>`,
                actionsHtml: `<button class="md-btn" type="button" data-modal-close>关闭</button>`
            });
        },

        movePlanTaskTo(planId, taskId, targetDate) {
            this.moveTask?.(planId, taskId, targetDate);
            this._closeActiveModal?.();
            this.render?.();
        },

        togglePlanTaskLock(planId, taskId) {
            const { task } = this.findTask?.(planId, taskId) || {};
            if (!task) return;
            this.lockItem?.(planId, taskId, !task.userOverride);
            this._closeActiveModal?.();
            this.render?.();
        },

        deletePlanTaskConfirm(planId, taskId) {
            this.deleteTask?.(planId, taskId);
            this._closeActiveModal?.();
            const stillActive = this.activeRecords?.(this.db.dailyPlans || []).some((plan) => plan.id === planId);
            if (!stillActive) this.closePlanTaskDrawer?.();
            this.render?.();
        },

        async handlePlanTaskTap(planId, taskId) {
            const { task } = this.findTask?.(planId, taskId) || {};
            if (!task) return;
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
            this.updateItemStatus?.(planId, taskId, 'in-progress', {}, { save: false });
            const previousPlan = JSON.parse(JSON.stringify(this._planActions?.() || []));
            this.activeRun = {
                planId,
                taskId,
                previousPlan,
                queueFollowup: !!options.queueFollowup,
                asCooldown: !!options.asCooldown
            };
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
            const ctx = this.activeRun;
            if (!ctx) return;
            const { plan, task } = this.findTask?.(ctx.planId, ctx.taskId) || {};
            if (!plan || !task) {
                this.activeRun = null;
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
            else if (!queueFollowup) this.maybePromptSavePlanRoutine?.({ manualStop: !!historyRecord.manualStop });
            if (queueFollowup) {
                const nextPlan = this.getTodayDailyPlans?.()?.find((item) => item.pendingCooldowns?.length);
                const next = nextPlan?.pendingCooldowns?.[0];
                if (next) {
                    setTimeout(() => this.runQueuedCooldown?.(nextPlan.id, next), 500);
                } else if (isCooldown) {
                    this.maybePromptSavePlanRoutine?.({ manualStop: !!historyRecord.manualStop });
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
            this._openModal?.({
                title: '保存为方案',
                icon: 'bookmark_add',
                bodyHtml: `<div class="plan-save-routine-sheet">
                    <p>今日计划 ${completion.done}/${completion.total} 完成，存为方案？</p>
                    <small>保存后会进入方案库，并带有计划标记。</small>
                </div>`,
                actionsHtml: `
                    <button class="md-btn" type="button" data-plan-save-dismiss>不用</button>
                    <button class="md-btn md-btn-tonal" type="button" data-plan-save-rename>改名后存</button>
                    <button class="md-btn md-btn-filled" type="button" data-plan-save-default>默认存</button>
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
                    title: `${Number(item.weight || 0).toFixed(1)} kg`,
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
            this._openModal?.({
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
