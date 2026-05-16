// @ts-check
(function () {
    function startOfWeek(date) {
        const d = new Date(date);
        const diff = (d.getDay() + 6) % 7;
        d.setDate(d.getDate() - diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function dateKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function addDays(date, days) {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    }

    function colorFor(level, dark) {
        const light = ['#ebedf0', '#c6e6c6', '#88d188', '#45b745', '#178b17'];
        const darkSet = ['#1e2530', '#244832', '#2f7d44', '#4cbf68', '#87e3a0'];
        const palette = dark ? darkSet : light;
        return palette[Math.max(0, Math.min(4, level))];
    }

    window.volumeHeatmap = {
        aggregate(dataApi, weeks = 26) {
            const map = {};
            const history = dataApi.activeRecords(dataApi.db.history || []);
            const exercise = dataApi.activeRecords(dataApi.db.health.exerciseLogs || []);
            history.forEach(item => {
                const key = dataApi.historyDayKey(item);
                map[key] = (map[key] || 0) + Number(item.duration || 0);
            });
            exercise.forEach(item => {
                if (!item?.date) return;
                map[item.date] = (map[item.date] || 0) + Number(item.minutes || 0) * 60;
            });
            const today = startOfWeek(new Date());
            const start = addDays(today, -(weeks - 1) * 7);
            return { start, weeks, values: map };
        },

        render(dataApi, weeks = 26) {
            const { start, values } = this.aggregate(dataApi, weeks);
            const dark = !!document.documentElement.classList.contains('dark');
            const cell = 12;
            const gap = 4;
            const width = weeks * (cell + gap) + 28;
            const height = 7 * (cell + gap) + 20;
            const vals = Object.values(values);
            const max = vals.length ? Math.max(...vals) : 0;
            const dayLabels = ['一', '二', '三', '四', '五', '六', '日'];
            const cells = [];
            for (let w = 0; w < weeks; w++) {
                for (let d = 0; d < 7; d++) {
                    const date = addDays(start, w * 7 + d);
                    const key = dateKey(date);
                    const value = Number(values[key] || 0);
                    const level = max <= 0 ? 0 : Math.min(4, Math.ceil((value / max) * 4));
                    const x = 24 + w * (cell + gap);
                    const y = d * (cell + gap) + 8;
                    cells.push(`<rect class="volume-heatmap-cell" x="${x}" y="${y}" width="${cell}" height="${cell}" rx="3" fill="${colorFor(level, dark)}" data-date="${key}" data-value="${value}" onclick="data.selectCalendarDate('${key}')"><title>${key} · ${Math.round(value / 60)} 分钟</title></rect>`);
                }
            }
            return `<div class="md-card volume-heatmap-card">
                <div class="today-timeline-header" style="margin:0 0 10px"><span class="material-symbols-rounded">calendar_month</span><strong>训练量热力图</strong><small>最近 ${weeks} 周</small></div>
                <svg viewBox="0 0 ${width} ${height}" class="volume-heatmap-svg" role="img" aria-label="训练量热力图">
                    ${dayLabels.map((label, idx) => `<text x="0" y="${idx * (cell + gap) + 18}" class="volume-heatmap-label">${label}</text>`).join('')}
                    ${cells.join('')}
                </svg>
            </div>`;
        }
    };
})();
