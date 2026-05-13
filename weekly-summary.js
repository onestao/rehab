(function () {
    window.dataWeeklySummary = {
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
