// @ts-nocheck
(function () {
    if (window.actionHistory) return;

    const ranges = { 30: 30, 90: 90, 365: 365 };
    const metrics = {
        weight: { label: '最大重量', color: '#2563eb' },
        reps: { label: '单组最大次数', color: '#059669' },
        volume: { label: '总容量', color: '#e11d48' }
    };
    const state = { actionName: '', range: 90, metric: 'weight' };

    function esc(value) {
        return window.renderSafe?.escapeHtml ? window.renderSafe.escapeHtml(value) : String(value ?? '');
    }

    function parseDate(record) {
        return window.data?.parseHistoryDate?.(record.date) || new Date(record.date || record.dayKey || Date.now());
    }

    function actionMatches(name, candidate) {
        return String(name || '').trim().toLowerCase() === String(candidate || '').trim().toLowerCase();
    }

    function collect(actionName, days = 90) {
        const since = Date.now() - Number(days || 90) * 86400000;
        return (window.data?.activeRecords?.(data.db.history || []) || [])
            .map(history => {
                const date = parseDate(history);
                if (!date || date.getTime() < since) return null;
                const planned = (history.actions || []).filter(a => actionMatches(a.name, actionName));
                const actualSets = (history.actualSets || []).filter(s => actionMatches(s.action, actionName));
                if (!planned.length && !actualSets.length) return null;
                const maxWeight = actualSets.reduce((m, s) => Math.max(m, Number(s.weightKg || 0)), 0);
                const maxReps = actualSets.reduce((m, s) => Math.max(m, Number(s.reps || 0)), 0) || planned.reduce((m, a) => Math.max(m, Number(a.reps || 0)), 0);
                const volume = actualSets.length
                    ? actualSets.reduce((sum, s) => sum + Number(s.weightKg || 0) * Number(s.reps || 0), 0)
                    : planned.reduce((sum, a) => sum + Number(a.sets || 1) * Number(a.reps || 0) * Number(a.weightKg || 0), 0);
                return {
                    date,
                    label: date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
                    weight: maxWeight,
                    reps: maxReps,
                    volume,
                    note: actualSets.map(s => s.note).filter(Boolean).join('；'),
                    setsText: actualSets.length
                        ? actualSets.map(s => `${Number(s.weightKg || 0)}kg×${Number(s.reps || 0)}`).join(' / ')
                        : planned.map(a => `${Number(a.sets || 1)}组×${Number(a.reps || 0)}次`).join(' / ')
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.date - b.date);
    }

    function render() {
        const content = document.getElementById('actionHistoryContent');
        const title = document.getElementById('actionHistoryTitle');
        if (!content || !title) return;
        const points = collect(state.actionName, state.range);
        const pr = window.prTracker?.computePrByAction
            ? window.prTracker.computePrByAction(data.db.history || {})?.[state.actionName]
            : data.db.cache?.prByAction?.[state.actionName];
        title.textContent = state.actionName || '动作历史';
        content.innerHTML = `
            <div class="action-history-controls">
                <div class="action-history-tabs" role="tablist" aria-label="时间范围">
                    ${Object.keys(ranges).map(r => `<button class="action-history-tab ${String(state.range) === r ? 'active' : ''}" onclick="actionHistory.setRange(${r})" type="button" aria-selected="${String(state.range) === r}">${r}天</button>`).join('')}
                </div>
                <div class="action-history-tabs" role="tablist" aria-label="指标">
                    ${Object.entries(metrics).map(([key, meta]) => `<button class="action-history-tab ${state.metric === key ? 'active' : ''}" onclick="actionHistory.setMetric('${key}')" type="button" aria-selected="${state.metric === key}">${meta.label}</button>`).join('')}
                </div>
            </div>
            <canvas id="actionHistoryCanvas" class="action-history-chart" height="180"></canvas>
            ${pr ? `<div class="action-history-pr"><span class="material-symbols-rounded">trending_up</span> PR ${esc(JSON.stringify(pr))}</div>` : ''}
            <div class="action-history-list">
                ${points.slice(-20).reverse().map(p => `<div class="action-history-row">
                    <strong>${esc(p.date.toLocaleDateString('zh-CN'))}</strong>
                    <span>${esc(p.setsText || '-')}</span>
                    <small>${esc(p.note || '')}</small>
                </div>`).join('') || '<div class="empty-state"><span class="material-symbols-rounded">monitoring</span><p>暂无该动作历史</p></div>'}
            </div>`;
        requestAnimationFrame(() => draw(points));
    }

    function draw(points) {
        const canvas = document.getElementById('actionHistoryCanvas');
        if (!(canvas instanceof HTMLCanvasElement)) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.clientWidth || 320;
        const height = Number(canvas.getAttribute('height') || 180);
        canvas.width = Math.max(320, Math.floor(width * devicePixelRatio));
        canvas.height = Math.floor(height * devicePixelRatio);
        ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = 'rgba(115,119,127,.28)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            const y = 18 + i * ((height - 36) / 3);
            ctx.beginPath(); ctx.moveTo(12, y); ctx.lineTo(width - 12, y); ctx.stroke();
        }
        const values = points.map(p => Number(p[state.metric] || 0));
        const max = Math.max(1, ...values);
        const min = Math.min(0, ...values);
        const xFor = i => points.length <= 1 ? width / 2 : 18 + i * ((width - 36) / (points.length - 1));
        const yFor = v => height - 18 - ((v - min) / (max - min || 1)) * (height - 36);
        ctx.strokeStyle = metrics[state.metric].color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        points.forEach((p, i) => {
            const x = xFor(i);
            const y = yFor(Number(p[state.metric] || 0));
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.fillStyle = metrics[state.metric].color;
        points.forEach((p, i) => {
            const x = xFor(i);
            const y = yFor(Number(p[state.metric] || 0));
            ctx.beginPath();
            ctx.arc(x, y, 3.5, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function openFor(actionName = '') {
        state.actionName = String(actionName || document.getElementById('slName')?.value || '').trim();
        if (!state.actionName) {
            window.toast?.show?.('请先输入动作名称', 'info');
            return;
        }
        const sheet = document.getElementById('actionHistorySheet');
        if (!sheet) return;
        render();
        sheet.classList.remove('hidden');
        sheet.setAttribute('aria-hidden', 'false');
    }

    function close() {
        const sheet = document.getElementById('actionHistorySheet');
        sheet?.classList.add('hidden');
        sheet?.setAttribute('aria-hidden', 'true');
    }

    window.actionHistory = {
        openFor,
        close,
        setRange(range) { state.range = ranges[range] || 90; render(); },
        setMetric(metric) { state.metric = metrics[metric] ? metric : 'weight'; render(); }
    };
})();
