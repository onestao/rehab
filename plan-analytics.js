// @ts-nocheck
const planAnalytics = {
    _weekKey(date) {
        const d = new Date(date);
        d.setDate(d.getDate() - d.getDay());
        return d.toISOString().slice(0, 10);
    },

    weeklyVolumeDelta(db) {
        const plans = db?.dailyPlans || [];
        const active = plans.filter(p => !p.deleted);
        if (!active.length) return null;
        const now = new Date();
        const thisWeekStart = new Date(now);
        thisWeekStart.setDate(thisWeekStart.getDate() - 7);
        const lastWeekStart = new Date(now);
        lastWeekStart.setDate(lastWeekStart.getDate() - 14);
        const thisWeekKey = thisWeekStart.toISOString().slice(0, 10);
        const lastWeekKey = lastWeekStart.toISOString().slice(0, 10);

        const sumVolume = (plans, from, to) => {
            return plans
                .filter(p => p.date >= from && p.date < to)
                .reduce((sum, p) => {
                    return sum + (p.items || [])
                        .filter(i => i && !i.deleted && i.category !== 'cooldown' && i.status === 'done')
                        .reduce((s, i) => {
                            const sets = Number(i.spec?.sets || 0);
                            const reps = Number(i.spec?.reps || 0);
                            const weight = Number(i.spec?.weight || i.feedback?.weight || 0);
                            return s + (sets * reps * weight);
                        }, 0);
                }, 0);
        };

        const nowKey = now.toISOString().slice(0, 10);
        const thisVol = sumVolume(active, thisWeekKey, nowKey);
        const lastVol = sumVolume(active, lastWeekKey, thisWeekKey);

        if (!lastVol && !thisVol) return null;
        const delta = lastVol ? Math.round(((thisVol - lastVol) / lastVol) * 100) : 100;
        return { thisWeek: thisVol, lastWeek: lastVol, delta };
    },

    daysSinceLastTrainedMuscle(db, targetGroup) {
        const plans = db?.dailyPlans || [];
        const active = plans.filter(p => !p.deleted).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const today = new Date().toISOString().slice(0, 10);
        for (const plan of active) {
            if (plan.date >= today) continue;
            const hasGroup = (plan.items || []).some(i =>
                i && !i.deleted && i.category !== 'cooldown' &&
                (i.group === targetGroup || i.name?.includes(targetGroup) || (i.chainId && i.group === targetGroup))
            );
            if (hasGroup) {
                return Math.round((new Date(today) - new Date(plan.date)) / 86400000);
            }
        }
        return null;
    },

    consecutiveTrainingDays(db) {
        const plans = db?.dailyPlans || [];
        const active = plans.filter(p => !p.deleted);
        const dateSet = new Set(active.map(p => p.date));
        const today = new Date();
        let streak = 0;
        for (let i = 0; i < 30; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            if (dateSet.has(key)) streak++;
            else break;
        }
        return streak;
    },

    weekCalorieDeficit(db) {
        const foods = db?.health?.foodLogs || [];
        const today = new Date();
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekKey = weekAgo.toISOString().slice(0, 10);
        const recentFoods = foods.filter(f => !f.deleted && f.date && f.date >= weekKey);
        if (!recentFoods.length) return null;
        const totalCal = recentFoods.reduce((s, f) => s + Number(f.cal || 0), 0);
        const goal = Number(db?.health?.dietGoal?.dailyCal || 0);
        if (!goal) return null;
        return Math.round((totalCal / 7) - goal);
    },

    latestPR(db) {
        const prs = db?.health?.prs || [];
        if (!prs.length) return null;
        const sorted = [...prs].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        return sorted[0] || null;
    },

    recoveryIndex(db) {
        const streak = this.consecutiveTrainingDays(db);
        const streakPenalty = Math.min(30, streak * 5);
        const deficit = this.weekCalorieDeficit(db);
        const deficitPenalty = deficit && deficit < -500 ? 15 : 0;
        return Math.max(0, Math.min(100, 100 - streakPenalty - deficitPenalty));
    },

    buildContext(db) {
        const vol = this.weeklyVolumeDelta(db);
        const streak = this.consecutiveTrainingDays(db);
        const deficit = this.weekCalorieDeficit(db);
        const pr = this.latestPR(db);
        const recovery = this.recoveryIndex(db);

        const primaryGroup = (db?.health?.primaryMuscleGroup) || '背';
        const daysSince = this.daysSinceLastTrainedMuscle(db, primaryGroup);

        const plans = (db?.dailyPlans || []).filter(p => !p.deleted);
        const today = new Date().toISOString().slice(0, 10);
        const todayPlans = plans.filter(p => p.date === today);
        const todayPlan = todayPlans[0] || null;
        const allTodayItems = todayPlans.flatMap(p => (p.items || []).filter(i => i && !i.deleted && i.category !== 'cooldown'));
        const items = (todayPlan?.items || []).filter(i => i && !i.deleted && i.category !== 'cooldown');
        const done = items.filter(i => i.status === 'done').length;
        const totalDone = allTodayItems.filter(i => i.status === 'done').length;
        const totalCount = allTodayItems.length;
        const nextItem = items.find(i => i.status !== 'done');
        const planTitle = todayPlan?.title || '今日计划';
        const planProgress = totalCount ? totalDone + '/' + totalCount : '';
        const planCompact = items.length
            ? `<div class="ai-plan-shared"><div class="ai-plan-row"><span class="ai-plan-tag">紧凑</span><span class="ai-plan-name">${planTitle} · ${nextItem ? nextItem.name + ' →' : '已完成'}</span><span class="ai-plan-meta">${done}/${items.length}</span></div><div class="ai-plan-bar">${items.map((_, i) => '<div class="ai-plan-seg' + (i < done ? ' done' : '') + (i === done ? ' active' : '') + '"></div>').join('')}</div></div>`
            : '';

        const foodLogs = (db?.health?.foodLogs || []).filter(f => !f.deleted && f.date === today);
        const todayMacros = foodLogs.reduce((acc, f) => {
            acc.cal += Number(f.cal || 0);
            acc.pro += Number(f.pro || 0);
            return acc;
        }, { cal: 0, pro: 0 });
        const dietGoal = db?.health?.dietGoal || {};
        const calGoal = Number(dietGoal.dailyCal || 0);
        const proGoal = Number(dietGoal.dailyPro || 0);

        return {
            metrics: {
                trainProgress: totalCount ? { done: totalDone, total: totalCount } : null,
                proIntake: todayMacros.pro,
                proGoal: proGoal || null,
                calIntake: todayMacros.cal,
                calGoal: calGoal || null,
                volumeDelta: vol?.delta ?? null,
                daysSinceMuscle: daysSince,
                weekDeficit: deficit,
            },
            analysis: {
                weeklyVolumeLoad: vol?.thisWeek ?? null,
                lastWeekVolumeLoad: vol?.lastWeek ?? null,
                volumeDelta: vol?.delta ?? null,
                prDistance: pr ? (pr.weight ? Number(pr.weight) : null) : null,
                prLift: pr?.lift || null,
                prWeight: pr?.weight || null,
                streakDays: streak,
                pushPullRatio: null,
                recoveryIndex: recovery,
            },
            planProgress,
            planCompact,
            planTitle,
            planDone: done,
            planTotal: items.length,
            nextItemName: nextItem?.name || null,
        };
    },

    attach(target) {
        Object.assign(target, {
            buildPlanAnalytics: () => this.buildContext(target.db || window.data?.db),
        });
    },
};

if (typeof window !== 'undefined') {
    window.planAnalytics = planAnalytics;
    if (window.data) planAnalytics.attach(window.data);
}
