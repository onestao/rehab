// @ts-nocheck
(function () {
    function esc(value) {
        return window.data?.escapeHtml ? data.escapeHtml(value) : String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
    }

    window.dataReport = {
        openWeightReport(kind = 'weekly') {
            this.db.health.reports = this.db.health.reports || [];
            this._weightReportKind = kind === 'monthly' ? 'monthly' : 'weekly';
            let sheet = document.getElementById('weightReportSheet');
            if (!sheet) {
                sheet = document.createElement('div');
                sheet.id = 'weightReportSheet';
                sheet.className = 'md-modal md-modal-sheet weight-report-sheet hidden';
                sheet.setAttribute('role', 'dialog');
                sheet.setAttribute('aria-modal', 'true');
                sheet.setAttribute('aria-hidden', 'true');
                sheet.innerHTML = `
                    <div class="md-modal-backdrop" data-report-close></div>
                    <div class="md-modal-card md-modal-sheet-card weight-report-card">
                        <div class="md-modal-head">
                            <strong id="weightReportTitle">体重复盘</strong>
                            <button class="icon-btn" type="button" data-report-close aria-label="关闭"><span class="material-symbols-rounded">close</span></button>
                        </div>
                        <div id="weightReportContent" class="weight-report-content"></div>
                    </div>`;
                sheet.querySelectorAll('[data-report-close]').forEach(btn => btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.closeWeightReport();
                }));
                document.body.appendChild(sheet);
            }
            this.renderWeightReportSheet();
            sheet.classList.remove('hidden');
            sheet.setAttribute('aria-hidden', 'false');
            window.navStack?.push?.({ type: 'sheet', id: 'weightReport', close: () => this.closeWeightReportInternal() });
            window.focusTrap?.trap?.(sheet);
        },

        closeWeightReport() {
            if (!window.navStack?.requestClose?.('sheet')) this.closeWeightReportInternal();
        },

        closeWeightReportInternal() {
            const sheet = document.getElementById('weightReportSheet');
            if (!sheet) return true;
            sheet.classList.add('hidden');
            sheet.setAttribute('aria-hidden', 'true');
            window.focusTrap?.release?.();
            return true;
        },

        currentReportPeriod(kind = this._weightReportKind || 'weekly') {
            const today = this.logicalDateKey?.() || new Date().toISOString().slice(0, 10);
            const metrics = kind === 'monthly'
                ? window.reportMetricsPure.buildMonthlyMetrics(this.db, today.slice(0, 7))
                : window.reportMetricsPure.buildWeeklyMetrics(this.db, today);
            return { start: metrics.periodStart, end: metrics.periodEnd };
        },

        findWeightReport(kind, start, end) {
            return this.activeRecords(this.db.health.reports || [])
                .find(r => r.kind === kind && r.periodStart === start && r.periodEnd === end) || null;
        },

        hasNewWeightReport() {
            const p = this.currentReportPeriod?.('weekly');
            if (!p) return false;
            return !this.findWeightReport?.('weekly', p.start, p.end);
        },

        async generateReport(kind = this._weightReportKind || 'weekly', anchor = '', opts = {}) {
            const useAi = !!opts.useAi;
            const metrics = kind === 'monthly'
                ? window.reportMetricsPure.buildMonthlyMetrics(this.db, anchor || (this.logicalDateKey?.() || '').slice(0, 7))
                : window.reportMetricsPure.buildWeeklyMetrics(this.db, anchor || this.logicalDateKey?.());
            let ai = window.reportMetricsPure.summarizeReportPlain(metrics);
            ai.model = 'offline';
            ai.prompt_id = `${kind}_report_offline`;
            if (useAi && typeof this.askContextAi === 'function') {
                try {
                    const payload = JSON.stringify(metrics.metrics);
                    const result = await this.askContextAi(kind === 'monthly' ? 'monthly_report' : 'weekly_report', payload);
                    if (result && typeof result === 'object') ai = { ...ai, ...result };
                    else if (typeof result === 'string' && result.trim()) ai.summary = result.trim().slice(0, 160);
                    ai.model = ai.model || this.adviceModel || 'ai';
                    ai.prompt_id = kind === 'monthly' ? 'monthly_report' : 'weekly_report';
                } catch {}
            }
            this.db.health.reports = this.db.health.reports || [];
            const now = Date.now();
            const existing = this.findWeightReport(kind, metrics.periodStart, metrics.periodEnd);
            const record = {
                id: existing?.id || this.generateRecordId(`weight-${kind}-report`),
                kind,
                periodStart: metrics.periodStart,
                periodEnd: metrics.periodEnd,
                generatedAt: existing?.generatedAt || new Date(now).toISOString(),
                updatedAt: now,
                deleted: false,
                metrics: metrics.metrics,
                ai
            };
            if (existing) Object.assign(existing, record);
            else this.db.health.reports.push(record);
            this.saveAndBackup?.();
            this.renderWeightReportSheet();
            this.renderHistory?.();
        },

        renderWeightReportSheet() {
            const el = document.getElementById('weightReportContent');
            if (!el) return;
            const kind = this._weightReportKind || 'weekly';
            const period = this.currentReportPeriod(kind);
            const current = this.findWeightReport(kind, period.start, period.end);
            el.innerHTML = `
                <div class="weight-report-tabs">
                    <button class="${kind === 'weekly' ? 'active' : ''}" onclick="data.switchWeightReportKind('weekly')" type="button">周报</button>
                    <button class="${kind === 'monthly' ? 'active' : ''}" onclick="data.switchWeightReportKind('monthly')" type="button">月报</button>
                </div>
                <div class="weight-report-body">
                    ${current ? this.renderWeightReport(current) : this.renderWeightReportEmpty(kind, period)}
                </div>
                ${this.renderReportArchive()}`;
        },

        switchWeightReportKind(kind) {
            this._weightReportKind = kind === 'monthly' ? 'monthly' : 'weekly';
            this.renderWeightReportSheet();
        },

        renderWeightReportEmpty(kind, period) {
            const label = kind === 'monthly' ? '本月复盘' : '本周复盘';
            return `<div class="weight-report-empty">
                <span class="material-symbols-rounded">assignment</span>
                <b>尚未生成 ${esc(label)}</b>
                <small>${esc(period.start)} 至 ${esc(period.end)}</small>
                <div class="weight-report-actions">
                    <button class="md-btn md-btn-filled" onclick="data.generateReport('${kind}', '', { useAi: false })" type="button">生成离线复盘</button>
                    <button class="md-btn md-btn-tonal" onclick="data.generateReport('${kind}', '', { useAi: true })" type="button">尝试 AI 复盘</button>
                </div>
            </div>`;
        },

        renderWeightReport(report) {
            const ai = report.ai || {};
            const m = report.metrics || {};
            const w = m.weight || {};
            const t = m.training || {};
            const d = m.diet || {};
            const c = m.cardio || {};
            const highlights = Array.isArray(ai.highlights) ? ai.highlights : [];
            const suggestions = Array.isArray(ai.suggestions) ? ai.suggestions : [];
            return `<article class="weight-report-current">
                <div class="weight-report-period"><b>${esc(report.periodStart)} 至 ${esc(report.periodEnd)}</b><small>${esc(report.kind === 'monthly' ? '月报' : '周报')}</small></div>
                <div class="weight-report-metrics">
                    <div><b>${w.delta > 0 ? '+' : ''}${Number(w.delta || 0).toFixed(1)}kg</b><small>体重变化</small></div>
                    <div><b>${Math.round(t.totalMinutes || 0)}分</b><small>训练时长</small></div>
                    <div><b>${Math.round(d.avgKcal || 0)}</b><small>日均 kcal</small></div>
                    <div><b>${Math.round(c.totalMinutes || 0)}分</b><small>有氧</small></div>
                </div>
                <section class="weight-report-ai"><h4>总结</h4><p>${esc(ai.summary || '暂无总结')}</p></section>
                ${highlights.length ? `<section class="weight-report-ai"><h4>亮点</h4>${highlights.slice(0, 3).map(x => `<p>${esc(x)}</p>`).join('')}</section>` : ''}
                ${suggestions.length ? `<section class="weight-report-ai"><h4>建议</h4>${suggestions.slice(0, 3).map(x => `<p>${esc(x)}</p>`).join('')}</section>` : ''}
            </article>`;
        },

        renderReportArchive() {
            const reports = this.activeRecords(this.db.health.reports || [])
                .slice()
                .sort((a, b) => String(b.periodEnd).localeCompare(String(a.periodEnd)))
                .slice(0, 12);
            return `<details class="weight-report-archive" ${reports.length ? '' : 'open'}>
                <summary>历史归档 <small>${reports.length} 条</small></summary>
                <div class="weight-report-archive-list">
                    ${reports.length ? reports.map(r => `<button type="button" onclick="data.openArchivedWeightReport('${esc(r.id)}')"><b>${esc(r.kind === 'monthly' ? '月报' : '周报')}</b><span>${esc(r.periodStart)} 至 ${esc(r.periodEnd)}</span></button>`).join('') : '<small>暂无归档</small>'}
                </div>
            </details>`;
        },

        openArchivedWeightReport(id) {
            const report = this.activeRecords(this.db.health.reports || []).find(r => r.id === id);
            const body = document.querySelector('#weightReportContent .weight-report-body');
            if (report && body) body.innerHTML = this.renderWeightReport(report);
        }
    };
})();
