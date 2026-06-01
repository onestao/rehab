// @ts-nocheck
(function () {
    function weekWindow(offsetWeeks = 0) {
        const now = new Date();
        const monday = new Date(now);
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + offsetWeeks * 7);
        monday.setHours(0,0,0,0);
        const end = new Date(monday);
        end.setDate(end.getDate() + 7);
        return { start: monday, end };
    }

    window.dataWeeklySummary = {
        weeklyTrainingSummary(offsetWeeks = 0) {
            const { start, end } = weekWindow(offsetWeeks);
            const hist = this.activeRecords(this.db.history || []).filter(h => {
                const d = this.parseHistoryDate(h.date);
                return d >= start && d < end;
            });
            const ex = this.activeRecords(this.db.health.exerciseLogs || []).filter(e => {
                const d = new Date(e.date);
                return d >= start && d < end;
            });
            const minutes = Math.round(hist.reduce((s, h) => s + (h.duration || 0) / 60, 0))
                + ex.reduce((s, e) => s + (e.minutes || 0), 0);
            const sets = hist.reduce((s, h) => s + (h.actualSets?.length || 0), 0);
            const rpeValues = hist.flatMap(h => h.actualSets || []).map(s => Number(s.rpe || s.extras?.rpe || 0)).filter(Boolean);
            const avgRpe = rpeValues.length ? rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length : 0;
            const cal = Math.round(hist.reduce((s, h) => s + (h.cardio?.calories || 0), 0)
                + ex.reduce((s, e) => s + (e.calories || 0), 0));
            const counts = {};
            hist.forEach(h => this.historyNames(h).forEach(n => counts[n] = (counts[n] || 0) + 1));
            ex.forEach(e => { const n = this.exerciseLabel(e.type, e); counts[n] = (counts[n] || 0) + 1; });
            const top = Object.entries(counts).sort((a,b) => b[1]-a[1])[0]?.[0] || '—';
            return { total: hist.length + ex.length, minutes, cal, top, sets, avgRpe };
        },

        weeklyFatigueInsight() {
            const cur = this.weeklyTrainingSummary(0);
            const prev = this.weeklyTrainingSummary(-1);
            const minuteDelta = cur.minutes - prev.minutes;
            const loadSpike = prev.minutes > 0 ? cur.minutes / prev.minutes : (cur.minutes > 90 ? 2 : 1);
            const highRpe = cur.avgRpe >= 8.5;
            const fatigue = highRpe || loadSpike >= 1.5 || cur.total >= 6;
            const deload = fatigue && (cur.minutes >= 180 || highRpe);
            const level = deload ? '建议降载' : fatigue ? '注意恢复' : '节奏正常';
            const hint = deload
                ? '本周训练量或体感偏高，建议下周减少 20%-30% 训练量，保留动作模式但降低强度。'
                : fatigue
                    ? '本周训练压力偏高，优先保证睡眠、拉伸和低强度有氧。'
                    : '本周训练节奏稳定，可按计划渐进。';
            return { cur, prev, minuteDelta, loadSpike, highRpe, fatigue, deload, level, hint };
        },

        weeklyAiPrompt() {
            const insight = this.weeklyFatigueInsight();
            return `请基于我最近 7 天训练、饮食、体重和计划完成情况，做一份周总结。重点分析：1. 本周完成率和训练量；2. 是否存在疲劳累积；3. 是否需要 deload；4. 下周训练、饮食和恢复建议。当前本地摘要：本周 ${insight.cur.total} 次训练，${insight.cur.minutes} 分钟，较上周 ${insight.minuteDelta >= 0 ? '+' : ''}${insight.minuteDelta} 分钟，平均 RPE ${insight.cur.avgRpe ? insight.cur.avgRpe.toFixed(1) : '暂无'}，初步判断：${insight.level}。`;
        },

        renderWeeklyAiInsightCard() {
            const hasAi = !!(this.db?.aiProfiles?.length && (this.db.aiActiveId || this.db.aiProfiles[0]?.id)) || !!(window.ai && ai.cfg?.enabled);
            const insight = this.weeklyFatigueInsight();
            const safe = this.escapeHtml.bind(this);
            return `<div class="md-card weekly-ai-insight-card">
                <div class="context-ai-head"><div><span class="cardio-kicker">AI 周总结</span><h3>${safe(insight.level)}</h3><small>${safe(insight.hint)}</small></div><span class="context-ai-icon material-symbols-rounded">tips_and_updates</span></div>
                <div class="record-overview-stats">
                    <div class="record-overview-stat"><b>${insight.cur.total}</b><small>本周训练</small></div>
                    <div class="record-overview-stat"><b>${insight.cur.minutes}</b><small>分钟</small></div>
                    <div class="record-overview-stat"><b>${insight.cur.avgRpe ? insight.cur.avgRpe.toFixed(1) : '--'}</b><small>平均 RPE</small></div>
                </div>
                <div class="context-ai-actions">
                    <button class="md-btn md-btn-tonal context-ai-btn" ${hasAi ? '' : 'disabled'} data-ai-ctx="weekly_review" data-ai-idx="0" type="button">生成周总结</button>
                    <button class="md-btn md-btn-tonal context-ai-btn" ${hasAi ? '' : 'disabled'} data-ai-ctx="weekly_review" data-ai-idx="1" type="button">判断是否降载</button>
                </div>
            </div>`;
        },

        renderWeeklySummaryCard() {
            const now = new Date();
            const monday = new Date(now);
            monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
            monday.setHours(0,0,0,0);
            const lastMonday = new Date(monday); lastMonday.setDate(lastMonday.getDate() - 7);
            const summarize = (start, end) => {
                const hist = this.activeRecords(this.db.history || []).filter(h => {
                    const d = this.parseHistoryDate(h.date);
                    return d >= start && d < end;
                });
                const ex = this.activeRecords(this.db.health.exerciseLogs || []).filter(e => {
                    const d = new Date(e.date);
                    return d >= start && d < end;
                });
                const total = hist.length + ex.length;
                const minutes = Math.round(hist.reduce((s, h) => s + (h.duration || 0) / 60, 0))
                              + ex.reduce((s, e) => s + (e.minutes || 0), 0);
                const cal = Math.round(hist.reduce((s, h) => s + (h.cardio?.calories || 0), 0)
                              + ex.reduce((s, e) => s + (e.calories || 0), 0));
                const counts = {};
                hist.forEach(h => this.historyNames(h).forEach(n => counts[n] = (counts[n] || 0) + 1));
                ex.forEach(e => { const n = this.exerciseLabel(e.type, e); counts[n] = (counts[n] || 0) + 1; });
                const top = Object.entries(counts).sort((a,b) => b[1]-a[1])[0]?.[0] || '—';
                return { total, minutes, cal, top };
            };
            const cur = summarize(monday, new Date(now.getTime() + 86400000));
            const prev = summarize(lastMonday, monday);
            const dt = (a, b) => a - b > 0 ? `+${a-b}` : `${a-b}`;
            return `<div class="md-card weekly-summary-card">
                <div class="hero-kicker">本周总结</div>
                <h3>${cur.total} 次训练 · ${cur.minutes} 分钟</h3>
                <div class="record-overview-stats">
                    <div class="record-overview-stat"><b>${cur.cal}</b><small>消耗 kcal</small></div>
                    <div class="record-overview-stat"><b>${dt(cur.total, prev.total)}</b><small>较上周</small></div>
                    <div class="record-overview-stat"><b>${cur.top}</b><small>最常练</small></div>
                </div>
            </div>`;
        },

        closeSummarySheet() {
            const el = document.getElementById('summarySheetOverlay');
            if (!el) return;
            el.style.animation = 'summarySheetFadeIn .2s ease reverse forwards';
            const sheet = el.querySelector('.summary-sheet');
            if (sheet) sheet.style.animation = 'summarySheetSlideUp .25s var(--md-sys-motion-emphasized) reverse forwards';
            setTimeout(() => el.remove(), 220);
            document.removeEventListener('keydown', this._summarySheetEsc);
        },

        openWeeklySummarySheet() {
            const existing = document.getElementById('summarySheetOverlay');
            if (existing) existing.remove();
            const safe = this.escapeHtml.bind(this);
            const insight = this.weeklyFatigueInsight();
            const hasAi = !!(this.db?.aiProfiles?.length && (this.db.aiActiveId || this.db.aiProfiles[0]?.id)) || !!(window.ai && ai.cfg?.enabled);
            const dt = (a, b) => a - b > 0 ? `+${a-b}` : `${a-b}`;

            const overlay = document.createElement('div');
            overlay.id = 'summarySheetOverlay';
            overlay.className = 'summary-sheet-overlay';
            overlay.addEventListener('click', (e) => { if (e.target === overlay) this.closeSummarySheet(); });

            overlay.innerHTML = `<div class="summary-sheet">
                <div class="summary-sheet-head">
                    <h3><span class="summary-sheet-head-icon material-symbols-rounded">summarize</span>周总结</h3>
                    <button class="summary-sheet-close" onclick="data.closeSummarySheet()" type="button"><span class="material-symbols-rounded">close</span></button>
                </div>
                <div class="summary-sheet-body">
                    <div class="summary-glass-card">
                        <div class="summary-kicker">AI 周总结</div>
                        <h3>${safe(insight.level)}</h3>
                        <small>${safe(insight.hint)}</small>
                        <div class="summary-stats">
                            <div class="summary-stat"><strong>${insight.cur.total}</strong><small>本周训练</small></div>
                            <div class="summary-stat"><strong>${insight.cur.minutes}</strong><small>分钟</small></div>
                            <div class="summary-stat"><strong>${insight.cur.avgRpe ? insight.cur.avgRpe.toFixed(1) : '--'}</strong><small>平均 RPE</small></div>
                        </div>
                        <div class="summary-ai-actions">
                            <button class="summary-ai-btn context-ai-btn" ${hasAi ? '' : 'disabled'} data-ai-ctx="weekly_review" data-ai-idx="0" type="button"><span class="material-symbols-rounded">auto_awesome</span>生成周总结</button>
                            <button class="summary-ai-btn context-ai-btn" ${hasAi ? '' : 'disabled'} data-ai-ctx="weekly_review" data-ai-idx="1" type="button"><span class="material-symbols-rounded">trending_down</span>判断降载</button>
                        </div>
                    </div>
                    <div class="summary-glass-card">
                        <div class="summary-kicker">本周概览</div>
                        <h3>${insight.cur.total} 次训练 · ${insight.cur.minutes} 分钟</h3>
                        <small>较上周 ${dt(insight.cur.minutes, insight.prev.minutes)} 分钟 · ${insight.cur.cal} kcal</small>
                        <div class="summary-stats">
                            <div class="summary-stat"><strong>${insight.cur.cal}</strong><small>消耗 kcal</small></div>
                            <div class="summary-stat"><strong>${dt(insight.cur.total, insight.prev.total)}</strong><small>较上周</small></div>
                            <div class="summary-stat"><strong>${safe(insight.cur.top)}</strong><small>最常练</small></div>
                        </div>
                    </div>
                </div>
            </div>`;

            document.body.appendChild(overlay);
            this._summarySheetEsc = (e) => { if (e.key === 'Escape') this.closeSummarySheet(); };
            document.addEventListener('keydown', this._summarySheetEsc);
            window.navStack?.push?.({ type: 'sheet', id: 'weeklySummary', close: () => this.closeSummarySheet() });
        },

        monthlyTrainingSummary() {
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const hist = this.activeRecords(this.db.history || []).filter(h => {
                const d = this.parseHistoryDate(h.date);
                return d >= monthStart && d < nextMonth;
            });
            const ex = this.activeRecords(this.db.health.exerciseLogs || []).filter(e => {
                const d = new Date(e.date);
                return d >= monthStart && d < nextMonth;
            });
            const total = hist.length + ex.length;
            const minutes = Math.round(hist.reduce((s, h) => s + (h.duration || 0) / 60, 0))
                          + ex.reduce((s, e) => s + (e.minutes || 0), 0);
            const cal = Math.round(hist.reduce((s, h) => s + (h.cardio?.calories || 0), 0)
                          + ex.reduce((s, e) => s + (e.calories || 0), 0));
            const sets = hist.reduce((s, h) => s + (h.actualSets?.length || 0), 0);
            const rpeValues = hist.flatMap(h => h.actualSets || []).map(s => Number(s.rpe || s.extras?.rpe || 0)).filter(Boolean);
            const avgRpe = rpeValues.length ? rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length : 0;
            const counts = {};
            hist.forEach(h => this.historyNames(h).forEach(n => counts[n] = (counts[n] || 0) + 1));
            ex.forEach(e => { const n = this.exerciseLabel(e.type, e); counts[n] = (counts[n] || 0) + 1; });
            const top3 = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 3);
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const daysWithTraining = new Set([
                ...hist.map(h => this.parseHistoryDate(h.date)?.toDateString()),
                ...ex.map(e => new Date(e.date)?.toDateString())
            ].filter(Boolean)).size;
            return { total, minutes, cal, sets, avgRpe, top3, daysInMonth, daysWithTraining, monthLabel: `${now.getFullYear()}年${now.getMonth() + 1}月` };
        },

        openMonthlySummarySheet() {
            const existing = document.getElementById('summarySheetOverlay');
            if (existing) existing.remove();
            const safe = this.escapeHtml.bind(this);
            const m = this.monthlyTrainingSummary();
            const hasAi = !!(this.db?.aiProfiles?.length && (this.db.aiActiveId || this.db.aiProfiles[0]?.id)) || !!(window.ai && ai.cfg?.enabled);

            const overlay = document.createElement('div');
            overlay.id = 'summarySheetOverlay';
            overlay.className = 'summary-sheet-overlay';
            overlay.addEventListener('click', (e) => { if (e.target === overlay) this.closeSummarySheet(); });

            overlay.innerHTML = `<div class="summary-sheet">
                <div class="summary-sheet-head">
                    <h3><span class="summary-sheet-head-icon material-symbols-rounded">calendar_month</span>月总结</h3>
                    <button class="summary-sheet-close" onclick="data.closeSummarySheet()" type="button"><span class="material-symbols-rounded">close</span></button>
                </div>
                <div class="summary-sheet-body">
                    <div class="summary-glass-card">
                        <div class="summary-kicker">${safe(m.monthLabel)}</div>
                        <h3>${m.total} 次训练 · ${m.minutes} 分钟</h3>
                        <small>${m.daysWithTraining}/${m.daysInMonth} 天有训练记录</small>
                        <div class="summary-stats">
                            <div class="summary-stat"><strong>${m.total}</strong><small>训练次数</small></div>
                            <div class="summary-stat"><strong>${m.minutes}</strong><small>总分钟</small></div>
                            <div class="summary-stat"><strong>${m.cal}</strong><small>kcal</small></div>
                        </div>
                        <div class="summary-month-grid">
                            <div class="summary-month-item"><strong>${m.sets}</strong><small>总组数</small></div>
                            <div class="summary-month-item"><strong>${m.avgRpe ? m.avgRpe.toFixed(1) : '--'}</strong><small>平均 RPE</small></div>
                        </div>
                        ${m.top3.length ? `<div style="margin-top:12px"><div class="summary-kicker">高频动作</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">${m.top3.map(([name, count]) => `<span style="padding:4px 10px;border-radius:999px;background:var(--md-sys-secondary-container);color:var(--md-sys-on-secondary-container);font-size:12px;font-weight:600">${safe(name)} ×${count}</span>`).join('')}</div></div>` : ''}
                        <div class="summary-ai-actions">
                            <button class="summary-ai-btn context-ai-btn" ${hasAi ? '' : 'disabled'} data-ai-ctx="calendar" data-ai-idx="1" type="button"><span class="material-symbols-rounded">auto_awesome</span>本月总结</button>
                        </div>
                    </div>
                </div>
            </div>`;

            document.body.appendChild(overlay);
            this._summarySheetEsc = (e) => { if (e.key === 'Escape') this.closeSummarySheet(); };
            document.addEventListener('keydown', this._summarySheetEsc);
            window.navStack?.push?.({ type: 'sheet', id: 'monthlySummary', close: () => this.closeSummarySheet() });
        }
    };
})();
