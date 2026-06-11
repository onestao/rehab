// @ts-nocheck
(function () {
    if (window.dataPlanCooldown) return;

    function byId(id) {
        return document.getElementById(id);
    }

    function removePrompt(root) {
        if (!root) return;
        clearInterval(root._planTimer);
        root.remove();
    }

    window.dataPlanCooldown = {
        afterPlanFeedback(planId, taskId) {
            const { plan, task } = this.findTask?.(planId, taskId) || {};
            if (!plan || !task) return;
            const refs = Array.isArray(task.cooldownRefs) ? task.cooldownRefs : [];
            if (!refs.length) {
                this.maybePromptSavePlanRoutine?.();
                this.maybeAutoAdjustNextDayAfterFeedback?.(planId);
                return;
            }
            const cooldownId = refs[0];
            const cooldownTask = (plan.items || []).find((item) => item.id === cooldownId && !item.deleted) || null;
            if (!cooldownTask) return;
            const prefs = this.ensurePlanPrefs?.() || {};
            if (prefs.cooldownMode === 'centralized') {
                this.queueCooldown?.(planId, cooldownId);
                this.renderTodayPage?.();
                this.maybePromptSavePlanRoutine?.();
                this.maybeAutoAdjustNextDayAfterFeedback?.(planId);
                return;
            }
            if (prefs.cooldownMode === 'paired') {
                this.runPlanTask?.(planId, cooldownId, { asCooldown: true });
                return;
            }
            this.showPlanCooldownPrompt(planId, cooldownId, cooldownTask);
        },

        showPlanCooldownPrompt(planId, taskId, cooldownTask) {
            document.querySelectorAll('.plan-cooldown-toast').forEach((el) => removePrompt(el));
            const root = document.createElement('div');
            root.className = 'plan-cooldown-toast';
            const equipment = (this.ensurePlanPrefs?.().equipment || []).join('、');
            root.innerHTML = `
                <div class="plan-cooldown-toast-head">
                    <strong>跟一组「${this.escapeHtml(cooldownTask.name || '放松动作')}」放松吗？</strong>
                    <small>${this.escapeHtml(equipment || '徒手')} · 30s 内自动暂存</small>
                </div>
                <div class="plan-cooldown-actions">
                    <button class="md-btn" type="button" data-plan-act="skip">跳过</button>
                    <button class="md-btn md-btn-tonal" type="button" data-plan-act="queue">暂存待集中拉伸</button>
                    <button class="md-btn md-btn-filled" type="button" data-plan-act="now">现在做</button>
                </div>
                <div class="plan-cooldown-progress"><i></i></div>`;
            document.body.appendChild(root);
            const bar = root.querySelector('.plan-cooldown-progress i');
            const started = Date.now();
            root._planTimer = setInterval(() => {
                const left = Math.max(0, 30000 - (Date.now() - started));
                if (bar) bar.style.width = `${Math.max(0, Math.round((left / 30000) * 100))}%`;
                if (left <= 0) {
                    clearInterval(root._planTimer);
                    this.queueCooldown?.(planId, taskId);
                    this.renderTodayPage?.();
                    this.maybeAutoAdjustNextDayAfterFeedback?.(planId);
                    removePrompt(root);
                }
            }, 200);
            root.querySelectorAll('[data-plan-act]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const act = btn.getAttribute('data-plan-act');
                    if (act === 'queue') {
                        this.queueCooldown?.(planId, taskId);
                        this.renderTodayPage?.();
                        this.maybeAutoAdjustNextDayAfterFeedback?.(planId);
                    } else if (act === 'now') {
                        this.dequeueCooldown?.(planId, taskId, { save: false });
                        this.runPlanTask?.(planId, taskId, { asCooldown: true });
                    } else {
                        this.maybePromptSavePlanRoutine?.();
                        this.maybeAutoAdjustNextDayAfterFeedback?.(planId);
                    }
                    removePrompt(root);
                });
            });
        },

        openPlanPendingCooldownSheet() {
            const plans = this.getTodayDailyPlans?.() || [];
            const queue = plans.flatMap((plan) => (plan.pendingCooldowns || []).map((id) => ({ plan, item: (plan.items || []).find((task) => task.id === id) })).filter((entry) => entry.item));
            if (!queue.length) {
                window.toast?.show?.('当前没有待集中拉伸', 'info');
                return;
            }
            this._openModal?.({
                title: '待集中拉伸',
                icon: 'self_improvement',
                bodyHtml: `<div class="plan-queue-list">
                    ${queue.map(({ plan, item }) => `
                        <button class="model-picker-row" type="button" onclick="data.runQueuedCooldown('${this.escapeHtml(plan.id)}','${this.escapeHtml(item.id)}')">
                            <span class="material-symbols-rounded">schedule</span>
                            <span class="model-picker-main">
                                <strong>${this.escapeHtml(item.name || '放松')}</strong>
                                <small>${Number(item.spec?.work || 30)} 秒</small>
                            </span>
                        </button>
                    `).join('')}
                </div>`,
                actionsHtml: `
                    <button class="md-btn" type="button" data-modal-close>关闭</button>
                    <button class="md-btn md-btn-tonal" type="button" onclick="data.runAllQueuedCooldowns()">全部连跑</button>
                `
            });
        },

        runQueuedCooldown(planId, taskId) {
            const plan = (this.getTodayDailyPlans?.() || []).find((item) => item.id === planId) || this.getTodayDailyPlan?.();
            if (!plan || !taskId) return;
            this.dequeueCooldown?.(plan.id, taskId);
            this.runPlanTask?.(plan.id, taskId, { asCooldown: true });
            this._closeActiveModal?.();
        },

        runAllQueuedCooldowns() {
            const plan = (this.getTodayDailyPlans?.() || []).find((item) => item.pendingCooldowns?.length);
            const nextId = plan?.pendingCooldowns?.[0];
            if (!plan || !nextId) return;
            this.dequeueCooldown?.(plan.id, nextId);
            this.runPlanTask?.(plan.id, nextId, { asCooldown: true, queueFollowup: true });
            this._closeActiveModal?.();
        }
    };
})();
