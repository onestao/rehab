// @ts-nocheck
const planAnalytics = {
    _escapeHtml(value) {
        const esc = typeof window !== 'undefined' && (window.renderSafe?.escapeHtml || window.data?.escapeHtml);
        return esc ? esc(value) : String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    },

    _weekKey(date) {
        const d = new Date(date);
        d.setDate(d.getDate() - d.getDay());
        return d.toISOString().slice(0, 10);
    },

    _trainingLabelKey(value) {
        return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
    },

    _normalizeTrainingBucket(value) {
        const key = String(value || '').trim().toLowerCase();
        const aliases = {
            pushing: 'push', chest: 'push', shoulder: 'push', triceps: 'push', 推: 'push', 胸: 'push', 肩: 'push',
            pulling: 'pull', back: 'pull', biceps: 'pull', 拉: 'pull', 背: 'pull',
            legs: 'lower', leg: 'lower', lowerbody: 'lower', 下肢: 'lower', 腿: 'lower', 臀: 'lower',
            abs: 'core', trunk: 'core', 核心: 'core', 腹: 'core',
            aerobic: 'cardio', endurance: 'cardio', 有氧: 'cardio', 跑步: 'cardio', 步行: 'cardio', 骑行: 'cardio',
            rehabilitation: 'rehab', mobility: 'rehab', stretch: 'rehab', 康复: 'rehab', 拉伸: 'rehab'
        };
        const normalized = aliases[key] || key;
        return ['push', 'pull', 'lower', 'core', 'cardio', 'rehab'].includes(normalized) ? normalized : '';
    },

    _cachedTrainingBucket(db, name = '', fallback = '') {
        const cache = db?.health?.trainingLabelClassifications || db?.cache?.trainingLabelClassifications || {};
        const candidates = [name, fallback].map((value) => this._trainingLabelKey(value)).filter(Boolean);
        for (const key of candidates) {
            const hit = cache[key];
            const bucket = this._normalizeTrainingBucket(typeof hit === 'string' ? hit : hit?.bucket);
            if (bucket && !hit?.deleted) return bucket;
        }
        return '';
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

        const sumVolume = (plans, exerciseLogs, from, to) => {
            const planVolume = plans
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
            const logVolume = (exerciseLogs || [])
                .filter(e => e && !e.deleted && e.type === 'strength' && e.date >= from && e.date < to)
                .reduce((sum, e) => sum + (Number(e.sets || 0) * Number(e.repsPerSet || 0) * Number(e.weightKg || 0)), 0);
            return planVolume + logVolume;
        };

        const nowKey = now.toISOString().slice(0, 10);
        const exerciseLogs = (db?.health?.exerciseLogs || []).filter(e => !e.deleted);
        const thisVol = sumVolume(active, exerciseLogs, thisWeekKey, nowKey);
        const lastVol = sumVolume(active, exerciseLogs, lastWeekKey, thisWeekKey);

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
        if (typeof window !== 'undefined' && window.prTracker?.refresh) {
            window.prTracker.refresh(db);
            const top = window.prTracker.topEntries?.(db, 1)?.[0];
            if (top) return { lift: top.action, weight: top.oneRm || top.maxWeight, maxWeight: top.maxWeight, reps: top.maxReps, date: top.oneRmDate || top.maxWeightDate };
        }
        const logs = db?.health?.exerciseLogs || [];
        const best = logs
            .filter(e => e && !e.deleted && e.type === 'strength' && e.customName)
            .map(e => ({ lift: e.customName, weight: Number(e.weightKg || 0) * (1 + Number(e.repsPerSet || 0) / 30), maxWeight: Number(e.weightKg || 0), reps: Number(e.repsPerSet || 0), date: e.date || '' }))
            .sort((a, b) => Number(b.weight || 0) - Number(a.weight || 0))[0];
        return best || null;
    },

    pushPullRatio(db) {
        const plans = db?.dailyPlans || [];
        const history = db?.history || [];
        const exerciseLogs = db?.health?.exerciseLogs || [];
        const rehabWeeks = db?.health?.rehabWeekly || [];
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const start = weekAgo.toISOString().slice(0, 10);
        const bucket = { push: 0, pull: 0, lower: 0, core: 0, cardio: 0, rehab: 0, unknown: 0 };
        const unknown = [];
        const classify = (name = '', fallback = '') => {
            const cached = this._cachedTrainingBucket(db, name, fallback);
            if (cached) return cached;
            const text = `${name || ''} ${fallback || ''}`.toLowerCase();
            if (/跑|走|骑|游泳|有氧|战绳|单车|椭圆|cardio|run|walk|cycling|bike|swim|rope/.test(text)) return 'cardio';
            if (/康复|拉伸|伸展|活动|疼痛|踝泵|等长|外旋|屈|伸|rehab|stretch|mobility/.test(text)) return 'rehab';
            if (/推|胸|肩|三头|press|push|bench/.test(text)) return 'push';
            if (/拉|背|划船|下拉|二头|row|pull|curl/.test(text)) return 'pull';
            if (/腿|臀|髋|膝|踝|深蹲|蹲|弓步|硬拉|leg|glute|hip|knee|squat|deadlift|lunge/.test(text)) return 'lower';
            if (/核心|腹|腰|平板|plank|core|abs/.test(text)) return 'core';
            return 'unknown';
        };
        const add = (name, count = 1, fallback = '') => {
            const key = classify(name, fallback);
            bucket[key] += Math.max(1, Number(count || 1));
            if (key === 'unknown' && name) unknown.push(String(name).slice(0, 24));
        };
        plans
            .filter((plan) => plan && !plan.deleted && plan.date >= start)
            .flatMap((plan) => plan.items || [])
            .filter((item) => item && !item.deleted && item.category !== 'cooldown' && item.status === 'done')
            .forEach((item) => {
                add(item.name || item.group || '', item.spec?.sets || 1, item.group || '');
            });
        history
            .filter((record) => record && !record.deleted && (record.dayKey || record.date || '') >= start)
            .forEach((record) => {
                if (record.type === 'cardio') add(record.cardio?.type || record.cardio?.name || '有氧', Math.max(1, Math.round(Number(record.duration || 0) / 600)), 'cardio');
                (record.actions || []).forEach((action) => add(action.name || '', action.sets || 1));
                (record.actualSets || []).forEach((set) => add(set.action || set.actionName || '', 1));
            });
        exerciseLogs
            .filter((entry) => entry && !entry.deleted && entry.date >= start)
            .forEach((entry) => add(entry.customName || entry.type || '', entry.type === 'strength' ? entry.sets || 1 : Math.max(1, Math.round(Number(entry.minutes || 0) / 10)), entry.type));
        rehabWeeks
            .filter((week) => week && !week.deleted && String(week.weekStart || week.visitDate || '') >= start)
            .flatMap((week) => week.actions || [])
            .forEach((action) => add(action.name || '康复', 1, 'rehab'));
        const parts = [
            bucket.push && `推${bucket.push}`,
            bucket.pull && `拉${bucket.pull}`,
            bucket.lower && `下肢${bucket.lower}`,
            bucket.core && `核心${bucket.core}`,
            bucket.cardio && `有氧${bucket.cardio}`,
            bucket.rehab && `康复${bucket.rehab}`,
            bucket.unknown && `待判${bucket.unknown}`
        ].filter(Boolean);
        return parts.length ? { summary: parts.join(' · '), unknown: [...new Set(unknown)].slice(0, 6) } : null;
    },

    recoveryIndex(db) {
        const streak = this.consecutiveTrainingDays(db);
        const streakPenalty = Math.min(30, streak * 5);
        const deficit = this.weekCalorieDeficit(db);
        const deficitPenalty = deficit && deficit < -500 ? 15 : 0;
        return Math.max(0, Math.min(100, 100 - streakPenalty - deficitPenalty));
    },

    buildContext(db) {
        const esc = this._escapeHtml;
        const vol = this.weeklyVolumeDelta(db);
        const streak = this.consecutiveTrainingDays(db);
        const deficit = this.weekCalorieDeficit(db);
        const pr = this.latestPR(db);
        const recovery = this.recoveryIndex(db);
        const trainingBalance = this.pushPullRatio(db);

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
        const planDisplayTitle = esc(planTitle);
        const nextItemDisplayName = nextItem ? esc(nextItem.name) : '';
        const planProgress = totalCount ? totalDone + '/' + totalCount : '';
        const planCompact = items.length
            ? `<div class="ai-plan-shared"><div class="ai-plan-row"><span class="ai-plan-name">${planDisplayTitle} · ${nextItem ? nextItemDisplayName + ' →' : '已完成'}</span><span class="ai-plan-meta">${done}/${items.length}</span></div><div class="ai-plan-bar">${items.map((_, i) => '<div class="ai-plan-seg' + (i < done ? ' done' : '') + (i === done ? ' active' : '') + '"></div>').join('')}</div></div>`
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
        const canApplyProgression = !!(todayPlan?.id && nextItem?.id && nextItem?.chainId && !nextItem?.userOverride);

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
                prDistance: pr ? (pr.weight ? Number(pr.weight).toFixed(1) : null) : null,
                prLift: pr?.lift || null,
                prWeight: pr?.maxWeight || pr?.weight || null,
                prReps: pr?.reps || null,
                streakDays: streak,
                pushPullRatio: trainingBalance?.summary || null,
                unknownTrainingLabels: trainingBalance?.unknown || [],
                recoveryIndex: recovery,
            },
            planProgress,
            planCompact,
            planId: todayPlan?.id || '',
            planTitle,
            planDone: done,
            planTotal: items.length,
            nextItemId: nextItem?.id || '',
            nextItemName: nextItem?.name || null,
            currentTask: nextItem ? {
                id: nextItem.id || '',
                name: nextItem.name || '',
                chainId: nextItem.chainId || '',
                currentLevel: nextItem.currentLevel ?? null,
                spec: nextItem.spec || {},
                feedback: nextItem.feedback || null
            } : null,
            progression: canApplyProgression ? { canApply: true } : null,
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
