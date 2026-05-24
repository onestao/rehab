// @ts-nocheck
(function () {
    if (window.dataRehabFeedback) return;

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

    window.dataRehabFeedback = {
        _rehabFeedbackCtx: null,

        openRehabFeedback(planId, taskId) {
            const { plan, task } = this.findTask?.(planId, taskId) || {};
            if (!plan || !task) return;
            const sheet = qs('rehabFeedbackSheet');
            const body = qs('rehabFeedbackSheetBody');
            if (!sheet || !body) return;
            this._rehabFeedbackCtx = { planId, taskId, rpe: Number(task.feedback?.rpe || 0) || 0 };
            body.innerHTML = `
                <div class="rehab-feedback-sheet">
                    <div class="rehab-feedback-head">
                        <span class="cardio-kicker">康复反馈</span>
                        <h3>${this.escapeHtml(task.name || '当前任务')}</h3>
                        <small>记录这次体感，帮助调整明天的负荷</small>
                    </div>
                    <div class="rehab-feedback-grid">
                        ${FEEDBACK_OPTIONS.map((item) => `
                            <button class="rehab-feedback-btn ${Number(task.feedback?.rpe || 0) === item.rpe ? 'active' : ''}" type="button" onclick="data.selectRehabFeedback(${item.rpe})" data-rehab-rpe="${item.rpe}">
                                <span class="rehab-feedback-emoji">${item.emoji}</span>
                                <strong>${item.label}</strong>
                            </button>
                        `).join('')}
                    </div>
                    <div class="md-field">
                        <textarea id="rehabFeedbackNote" rows="3" placeholder=" ">${this.escapeHtml(task.feedback?.note || '')}</textarea>
                        <label>备注（可选）</label>
                    </div>
                    <div class="md-row modal-actions">
                        <button class="md-btn" type="button" onclick="data.skipRehabFeedback()">跳过</button>
                        <button class="md-btn md-btn-filled" type="button" onclick="data.saveRehabFeedback()">保存</button>
                    </div>
                </div>`;
            sheet.classList.remove('hidden');
            sheet.setAttribute('aria-hidden', 'false');
            window.navStack?.push?.({
                type: 'modal',
                id: 'rehabFeedbackSheet',
                close: () => this.closeRehabFeedback()
            });
        },

        selectRehabFeedback(rpe) {
            this._rehabFeedbackCtx = this._rehabFeedbackCtx || {};
            this._rehabFeedbackCtx.rpe = Number(rpe || 0);
            document.querySelectorAll('[data-rehab-rpe]').forEach((btn) => {
                const active = Number(btn.getAttribute('data-rehab-rpe')) === Number(rpe);
                btn.classList.toggle('active', active);
            });
            window.haptics?.light?.();
        },

        closeRehabFeedback() {
            const sheet = qs('rehabFeedbackSheet');
            sheet?.classList.add('hidden');
            sheet?.setAttribute('aria-hidden', 'true');
            this._rehabFeedbackCtx = null;
            return true;
        },

        skipRehabFeedback() {
            const ctx = this._rehabFeedbackCtx;
            this.closeRehabFeedback();
            if (ctx) this.afterRehabFeedback?.(ctx.planId, ctx.taskId, false);
        },

        saveRehabFeedback() {
            const ctx = this._rehabFeedbackCtx;
            if (!ctx?.planId || !ctx?.taskId || !ctx.rpe) {
                window.toast?.show?.('先选一个体感等级', 'info');
                return;
            }
            const note = String(qs('rehabFeedbackNote')?.value || '').trim();
            this.addFeedback?.(ctx.planId, ctx.taskId, { rpe: ctx.rpe, note, doneAt: Date.now() });
            this.maybeApplyProgression?.(ctx.planId, ctx.taskId);
            this.closeRehabFeedback();
            this.render?.();
            this.afterRehabFeedback?.(ctx.planId, ctx.taskId, true);
        }
    };
})();

