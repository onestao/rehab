// @ts-check
const DAY_MS = 86400000;

function dateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function dateFromKey(key) {
    const m = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
}

function active(list) {
    return (list || []).filter(item => item && !item.deleted);
}

function inRange(date, start, end) {
    const key = String(date || '');
    return key >= start && key <= end;
}

function periodFromWeek(anchorKey) {
    const anchor = dateFromKey(anchorKey || dateKey(new Date()));
    const start = new Date(anchor);
    const dow = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - dow);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: dateKey(start), end: dateKey(end) };
}

function periodFromMonth(ymKey) {
    const text = String(ymKey || dateKey(new Date()).slice(0, 7));
    const m = text.match(/^(\d{4})-(\d{2})/);
    const y = m ? Number(m[1]) : new Date().getFullYear();
    const month = m ? Number(m[2]) - 1 : new Date().getMonth();
    return {
        start: dateKey(new Date(y, month, 1)),
        end: dateKey(new Date(y, month + 1, 0))
    };
}

function historyDayKey(entry) {
    if (entry?.dayKey) return String(entry.dayKey);
    return dateKey(new Date(entry?.date || Date.now()));
}

function buildMetrics(db, period) {
    const health = db?.health || {};
    const weights = active(health.weights).filter(w => inRange(w.date, period.start, period.end)).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const first = weights[0] || null;
    const last = weights[weights.length - 1] || null;
    const delta = first && last ? Number((Number(last.weight || 0) - Number(first.weight || 0)).toFixed(1)) : 0;
    const days = first && last ? Math.max(1, Math.round((dateFromKey(last.date).getTime() - dateFromKey(first.date).getTime()) / DAY_MS)) : 1;
    const avgPerDay = Number((delta / days).toFixed(2));
    const trend = Math.abs(avgPerDay) < 0.01 ? 'stable' : avgPerDay < 0 ? 'down' : 'up';

    const exerciseLogs = active(health.exerciseLogs).filter(e => inRange(e.date, period.start, period.end));
    const histories = active(db?.history).filter(h => inRange(historyDayKey(h), period.start, period.end));
    const historyMinutes = histories.reduce((sum, h) => sum + Math.round(Number(h.duration || 0) / 60), 0);
    const exerciseMinutes = exerciseLogs.reduce((sum, e) => sum + Number(e.minutes || 0), 0);
    const strengthLogs = exerciseLogs.filter(e => e.type === 'strength');
    const totalVolume = strengthLogs.reduce((sum, e) => sum + Number(e.weightKg || 0) * Number(e.sets || 0) * Number(e.repsPerSet || 0), 0);

    const foodLogs = active(health.foodLogs).filter(f => inRange(f.date, period.start, period.end));
    const dietDays = new Set(foodLogs.map(f => String(f.date || ''))).size;
    const totalKcal = foodLogs.reduce((sum, f) => sum + Number(f.cal || 0), 0);
    const totalProtein = foodLogs.reduce((sum, f) => sum + Number(f.pro || 0), 0);

    const cardioHistories = histories.filter(h => h.type === 'cardio' || h.cardio);
    const cardioExercises = exerciseLogs.filter(e => e.type && e.type !== 'strength');
    const hrValues = cardioHistories.map(h => Number(h.cardio?.avgHr || h.avgHr || 0)).filter(n => n > 0);

    return {
        periodStart: period.start,
        periodEnd: period.end,
        metrics: {
            weight: {
                start: first ? Number(first.weight || 0) : null,
                end: last ? Number(last.weight || 0) : null,
                delta,
                avgPerDay,
                trend
            },
            training: {
                sessions: histories.length + strengthLogs.length,
                totalMinutes: historyMinutes + exerciseMinutes,
                totalVolume: Math.round(totalVolume),
                prCount: strengthLogs.filter(e => Number(e.weightKg || 0) > 0 && Number(e.repsPerSet || 0) > 0).length
            },
            diet: {
                avgKcal: dietDays ? Math.round(totalKcal / dietDays) : 0,
                proteinAvg: dietDays ? Number((totalProtein / dietDays).toFixed(1)) : 0,
                daysLogged: dietDays
            },
            cardio: {
                sessions: cardioHistories.length + cardioExercises.length,
                totalMinutes: cardioHistories.reduce((sum, h) => sum + Math.round(Number(h.duration || 0) / 60), 0) + cardioExercises.reduce((sum, e) => sum + Number(e.minutes || 0), 0),
                avgHr: hrValues.length ? Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length) : 0
            }
        }
    };
}

function buildWeeklyMetrics(db, anchorKey) {
    return buildMetrics(db, periodFromWeek(anchorKey));
}

function buildMonthlyMetrics(db, ymKey) {
    return buildMetrics(db, periodFromMonth(ymKey));
}

function summarizeReportPlain(input) {
    const metrics = input?.metrics || input || {};
    const w = metrics.weight || {};
    const t = metrics.training || {};
    const d = metrics.diet || {};
    const c = metrics.cardio || {};
    const deltaText = w.start == null || w.end == null ? '体重记录不足' : `体重${w.delta > 0 ? '上升' : w.delta < 0 ? '下降' : '基本稳定'} ${Math.abs(Number(w.delta || 0)).toFixed(1)}kg`;
    return {
        summary: `${deltaText}，训练 ${t.sessions || 0} 次，饮食记录 ${d.daysLogged || 0} 天。`,
        highlights: [
            `训练总时长 ${Math.round(t.totalMinutes || 0)} 分钟，力量容量 ${Math.round(t.totalVolume || 0)}。`,
            `日均摄入 ${Math.round(d.avgKcal || 0)} kcal，蛋白 ${Number(d.proteinAvg || 0).toFixed(1)}g。`,
            `有氧 ${c.sessions || 0} 次，总时长 ${Math.round(c.totalMinutes || 0)} 分钟。`
        ].filter(Boolean).slice(0, 3),
        suggestions: [
            '下个周期保持固定称重时间，减少水分波动干扰。',
            '优先补齐饮食记录，再根据体重趋势调整热量。',
            '训练日和休息日分开观察，避免只看单日变化。'
        ]
    };
}

if (typeof window !== 'undefined') {
    window['reportMetricsPure'] = { buildWeeklyMetrics, buildMonthlyMetrics, summarizeReportPlain };
}

export { buildWeeklyMetrics, buildMonthlyMetrics, summarizeReportPlain };
