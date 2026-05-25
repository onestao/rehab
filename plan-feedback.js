// @ts-nocheck
(function () {
    if (window.dataPlanFeedback) return;

    const FEEDBACK_OPTIONS = [
        { rpe: 1, emoji: '😌', label: '太轻' },
        { rpe: 2, emoji: '😊', label: '合适' },
        { rpe: 3, emoji: '🙂', label: '累' },
        { rpe: 4, emoji: '😣', label: '吃力' },
        { rpe: 5, emoji: '😖', label: '不行' }
    ];

    function qs(id) {
        return document.getElementById(id);
    }

    window.dataPlanFeedback = {
        _planFeedbackCtx: null,

        openPlanFeedback(planId, taskId) {
            const { plan, task } = this.findTask?.(planId, taskId) || {};
            if (!plan || !task) return;
            const sheet = qs('planFeedbackSheet');
            const body = qs('planFeedbackSheetBody');
            if (!sheet || !body) return;
            this._planFeedbackCtx = { planId, taskId, rpe: Number(task.feedback?.rpe || 0) || 0 };
            body.innerHTML = `
                <div class="plan-feedback-sheet">
                    <div class="plan-sheet-head plan-feedback-head">
                        <span class="material-symbols-rounded plan-head-icon">monitor_heart</span>
                        <div>
                            <span class="cardio-kicker">康复反馈</span>
                            <h3>${this.escapeHtml(task.name || '当前任务')}</h3>
                            <small>记录这次体感，帮助调整明天的负荷</small>
                        </div>
                    </div>
                    <div class="plan-feedback-grid">
                        ${FEEDBACK_OPTIONS.map((item) => `
                            <button class="plan-feedback-btn ${Number(task.feedback?.rpe || 0) === item.rpe ? 'active' : ''}" type="button" onclick="data.selectPlanFeedback(${item.rpe})" data-plan-rpe="${item.rpe}">
                                <span class="plan-feedback-emoji">${item.emoji}</span>
                                <strong>${item.label}</strong>
                            </button>
                        `).join('')}
                    </div>
                    <div class="md-field">
                        <textarea id="planFeedbackNote" rows="3" placeholder=" ">${this.escapeHtml(task.feedback?.note || '')}</textarea>
                        <label>备注（可选）</label>
                    </div>
                    <div class="md-row modal-actions">
                        <button class="md-btn" type="button" onclick="data.skipPlanFeedback()">跳过</button>
                        <button class="md-btn md-btn-filled" type="button" onclick="data.savePlanFeedback()">保存</button>
                    </div>
                </div>`;
            sheet.classList.remove('hidden');
            sheet.setAttribute('aria-hidden', 'false');
            window.navStack?.push?.({
                type: 'modal',
                id: 'planFeedbackSheet',
                close: () => this.closePlanFeedback()
            });
        },

        selectPlanFeedback(rpe) {
            this._planFeedbackCtx = this._planFeedbackCtx || {};
            this._planFeedbackCtx.rpe = Number(rpe || 0);
            document.querySelectorAll('[data-plan-rpe]').forEach((btn) => {
                const active = Number(btn.getAttribute('data-plan-rpe')) === Number(rpe);
                btn.classList.toggle('active', active);
            });
            window.haptics?.light?.();
        },

        closePlanFeedback() {
            const sheet = qs('planFeedbackSheet');
            sheet?.classList.add('hidden');
            sheet?.setAttribute('aria-hidden', 'true');
            this._planFeedbackCtx = null;
            return true;
        },

        skipPlanFeedback() {
            const ctx = this._planFeedbackCtx;
            this.closePlanFeedback();
            if (ctx) this.afterPlanFeedback?.(ctx.planId, ctx.taskId, false);
        },

        savePlanFeedback() {
            const ctx = this._planFeedbackCtx;
            if (!ctx?.planId || !ctx?.taskId || !ctx.rpe) {
                window.toast?.show?.('先选一个体感等级', 'info');
                return;
            }
            const note = String(qs('planFeedbackNote')?.value || '').trim();
            this.addFeedback?.(ctx.planId, ctx.taskId, { rpe: ctx.rpe, note, doneAt: Date.now() });
            this.maybeApplyProgression?.(ctx.planId, ctx.taskId);
            this.closePlanFeedback();
            this.render?.();
            this.afterPlanFeedback?.(ctx.planId, ctx.taskId, true);
        }
    };
})();
