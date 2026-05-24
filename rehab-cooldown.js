// @ts-nocheck
(function () {
    if (window.dataRehabCooldown) return;

    function byId(id) {
        return document.getElementById(id);
    }

    function removePrompt(root) {
        if (!root) return;
        clearInterval(root._rehabTimer);
        root.remove();
    }

    window.dataRehabCooldown = {
        afterRehabFeedback(planId, taskId) {
            const { plan, task } = this.findTask?.(planId, taskId) || {};
            if (!plan || !task) return;
            const refs = Array.isArray(task.cooldownRefs) ? task.cooldownRefs : [];
            if (!refs.length) {
                this.maybePromptSaveRehabRoutine?.();
                return;
            }
            const cooldownId = refs[0];
            const cooldownTask = (plan.items || []).find((item) => item.id === cooldownId && !item.deleted) || null;
            if (!cooldownTask) return;
            const prefs = this.ensureRehabPrefs?.() || {};
            if (prefs.cooldownMode === 'centralized') {
                this.queueCooldown?.(planId, cooldownId);
                this.renderRehabDock?.();
                this.maybePromptSaveRehabRoutine?.();
                return;
            }
            if (prefs.cooldownMode === 'paired') {
                this.runRehabTask?.(planId, cooldownId, { asCooldown: true });
                return;
            }
            this.showRehabCooldownPrompt(planId, cooldownId, cooldownTask);
        },

        showRehabCooldownPrompt(planId, taskId, cooldownTask) {
            document.querySelectorAll('.rehab-cooldown-toast').forEach((el) => removePrompt(el));
            const root = document.createElement('div');
            root.className = 'rehab-cooldown-toast';
            const equipment = (this.ensureRehabPrefs?.().equipment || []).join('、');
            root.innerHTML = `
                <div class="rehab-cooldown-toast-head">
                    <strong>跟一组「${this.escapeHtml(cooldownTask.name || '放松动作')}」放松吗？</strong>
                    <small>${this.escapeHtml(equipment || '徒手')} · 30s 内自动暂存</small>
                </div>
                <div class="rehab-cooldown-actions">
                    <button class="md-btn" type="button" data-rehab-act="skip">跳过</button>
                    <button class="md-btn md-btn-tonal" type="button" data-rehab-act="queue">暂存待集中拉伸</button>
                    <button class="md-btn md-btn-filled" type="button" data-rehab-act="now">现在做</button>
                </div>
                <div class="rehab-cooldown-progress"><i></i></div>`;
            document.body.appendChild(root);
            const bar = root.querySelector('.rehab-cooldown-progress i');
            const started = Date.now();
            root._rehabTimer = setInterval(() => {
                const left = Math.max(0, 30000 - (Date.now() - started));
                if (bar) bar.style.width = `${Math.max(0, Math.round((left / 30000) * 100))}%`;
                if (left <= 0) {
                    clearInterval(root._rehabTimer);
                    this.queueCooldown?.(planId, taskId);
                    this.renderRehabDock?.();
                    removePrompt(root);
                }
            }, 200);
            root.querySelectorAll('[data-rehab-act]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const act = btn.getAttribute('data-rehab-act');
                    if (act === 'queue') {
                        this.queueCooldown?.(planId, taskId);
                        this.renderRehabDock?.();
                    } else if (act === 'now') {
                        this.dequeueCooldown?.(planId, taskId, { save: false });
                        this.runRehabTask?.(planId, taskId, { asCooldown: true });
                    } else {
                        this.maybePromptSaveRehabRoutine?.();
                    }
                    removePrompt(root);
                });
            });
        },

        openPendingCooldownSheet() {
            const plan = this.getTodayDailyPlan?.();
            const queue = (plan?.pendingCooldowns || []).map((id) => (plan.items || []).find((item) => item.id === id)).filter(Boolean);
            if (!queue.length) {
                window.toast?.show?.('当前没有待集中拉伸', 'info');
                return;
            }
            this._openModal?.({
                title: '待集中拉伸',
                icon: 'self_improvement',
                bodyHtml: `<div class="rehab-queue-list">
                    ${queue.map((item) => `
                        <button class="model-picker-row" type="button" onclick="data.runQueuedCooldown('${this.escapeHtml(item.id)}')">
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

        runQueuedCooldown(taskId) {
            const plan = this.getTodayDailyPlan?.();
            if (!plan || !taskId) return;
            this.dequeueCooldown?.(plan.id, taskId);
            this.runRehabTask?.(plan.id, taskId, { asCooldown: true });
            this._closeActiveModal?.();
        },

        runAllQueuedCooldowns() {
            const plan = this.getTodayDailyPlan?.();
            const nextId = plan?.pendingCooldowns?.[0];
            if (!plan || !nextId) return;
            this.dequeueCooldown?.(plan.id, nextId);
            this.runRehabTask?.(plan.id, nextId, { asCooldown: true, queueFollowup: true });
            this._closeActiveModal?.();
        }
    };
})();
