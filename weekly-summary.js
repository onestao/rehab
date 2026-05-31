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
        }
    };
})();
