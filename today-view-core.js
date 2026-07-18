// @ts-nocheck
// Read-only V6 first paint for Today. Must not populate the plan UI module bag,
// mutate dailyPlans, or pull the full plan interaction / rehab-policy chain.
(function () {
    'use strict';

    function n0(v) { return +v || 0; }

    function planStatusClass(type = 'rehab') {
        return ['rehab', 'cut', 'bulk', 'maintenance', 'custom'].includes(type) ? `is-${type}` : 'is-rehab';
    }

    function taskSort(task) {
        const order = { 'in-progress': 0, todo: 1, done: 2, skipped: 3 };
        return order[task?.status] ?? 9;
    }

    function taskCategoryMeta(task = {}) {
        if (task.category === 'warmup') return { label: '热身', icon: 'directions_run' };
        if (task.category === 'cooldown') return { label: '拉伸', icon: 'self_improvement' };
        return { label: '主训练', icon: 'fitness_center' };
    }

    function taskSpecText(task = {}) {
        const spec = task.spec || {};
        const category = taskCategoryMeta(task);
        const noData = (Number(spec.reps || 0) <= 0 && Number(spec.work || 0) <= 0);
        const main = noData
            ? '参数不完整'
            : (Number(spec.reps || 0) > 0 ? `每组${Number(spec.reps || 0)}次` : `每次${Number(spec.work || 0)}秒`);
        const details = [
            Number(spec.repRest || 0) > 0 ? `次休${Number(spec.repRest || 0)}秒` : '',
            Number(spec.actionRest || 0) > 0 ? `组休${Number(spec.actionRest || 0)}秒` : '',
            spec.isAlt ? '双侧交替' : ''
        ].filter(Boolean);
        return `${category.label} · ${Number(spec.sets || 1)}组 · ${main}${details.length ? ` · ${details.join(' · ')}` : ''}`;
    }

    function planTypeMeta(type = 'rehab', title = '') {
        const key = ['rehab', 'cut', 'bulk', 'maintenance', 'custom'].includes(type) ? type : 'rehab';
        const map = {
            rehab: { label: '康复计划', icon: 'self_improvement' },
            cut: { label: '减脂日程', icon: 'local_fire_department' },
            bulk: { label: '增肌日程', icon: 'fitness_center' },
            maintenance: { label: '综合训练', icon: 'health_and_safety' },
            custom: { label: title || '自定义计划', icon: 'event_note' }
        };
        return map[key];
    }

    function completionRate(plan = {}) {
        const items = (Array.isArray(plan.items) ? plan.items : [])
            .filter((item) => item && !item.deleted && item.category !== 'cooldown');
        if (!items.length) return { done: 0, total: 0, rate: 0 };
        const done = items.filter((item) => item.status === 'done').length;
        return { done, total: items.length, rate: done / items.length };
    }

    function aggregateCompletionRate(plans = []) {
        const list = Array.isArray(plans) ? plans : [];
        const rates = list.map((plan) => completionRate(plan));
        const done = rates.reduce((sum, item) => sum + Number(item.done || 0), 0);
        const total = rates.reduce((sum, item) => sum + Number(item.total || 0), 0);
        return { done, total, rate: total ? done / total : 0 };
    }

    function todayKey(ctx) {
        return ctx.logicalDateKey?.() || ctx.dateKey?.(new Date()) || '';
    }

    function activeList(ctx, list) {
        if (typeof ctx.activeRecords === 'function') return ctx.activeRecords(list);
        return (Array.isArray(list) ? list : []).filter((item) => item && !item.deleted);
    }

    function readTodayPlans(ctx, date = todayKey(ctx)) {
        const raw = ctx.db?.dailyPlans;
        return activeList(ctx, raw).filter((plan) => String(plan?.date || '') === String(date || ''));
    }

    function readPlanPrefs(ctx) {
        const prefs = ctx.db?.prefs;
        if (!prefs || typeof prefs !== 'object') return { showWeeklyDock: true };
        const plan = prefs.plan && typeof prefs.plan === 'object'
            ? prefs.plan
            : (prefs.rehab && typeof prefs.rehab === 'object' ? prefs.rehab : {});
        return {
            showWeeklyDock: plan.showWeeklyDock !== false
        };
    }

    function selectedPlan(ctx, plans) {
        const list = Array.isArray(plans) ? plans : [];
        return list.find((item) => item.id === ctx.selectedPlanId) || list[0] || null;
    }

    function ths(ctx, s) {
        if (s && typeof s === 'object') return s;
        if (ctx?._ths) return ctx._ths;
        const today = todayKey(ctx);
        s = window.healthSummaryPure?.summarizeToday?.(ctx.db, today, {
            historyDayKey: (r) => ctx.historyDayKey?.(r) || r?.dayKey || r?.date || ''
        });
        if (s) return s;
        const m = ctx.todayMacros?.() || {};
        const g = ctx.defaultDietGoals?.() || {};
        return {
            intake: n0(ctx.todayCalories?.()),
            macros: { pro: n0(m.pro), carb: n0(m.carb), fat: n0(m.fat) },
            goals: {
                cal: n0(g.cal || ctx.db?.health?.dietGoal?.dailyCal),
                pro: n0(g.pro),
                carb: n0(g.carb),
                fat: n0(g.fat)
            }
        };
    }

    window.dataTodayViewCore = {
        getTodayDailyPlans(date) {
            return readTodayPlans(this, date == null ? todayKey(this) : date);
        },

        completionRate(plan) {
            return completionRate(plan);
        },

        aggregateCompletionRate(plans) {
            return aggregateCompletionRate(plans == null ? this.getTodayDailyPlans?.() || [] : plans);
        },

        planTypeMeta(type, title) {
            return planTypeMeta(type, title);
        },

        renderPlanIntakeRing(summary) {
            summary = ths(this, summary);
            const m = summary.macros || {};
            const g = summary.goals || {};
            const intake = n0(summary.intake);
            const goalCal = n0(g.cal || this.db?.health?.dietGoal?.dailyCal);
            const displayPercent = goalCal ? Math.max(0, Math.round(intake / goalCal * 100)) : 0;
            const ringProgress = Math.min(100, displayPercent);
            const st = (v, t, b) => b + Math.min(120, this.ratio(n0(v), n0(t)) * 1.2);
            const macroStops = {
                pro: st(m.pro, g.pro, 0),
                carb: st(m.carb, g.carb, 120),
                fat: st(m.fat, g.fat, 240)
            };
            if (!goalCal) {
                return '<div class="ring ring-diet"><span class="ring-motion-aura" aria-hidden="true"></span><div><b>--</b><small>饮食</small></div></div>';
            }
            return `<div class="ring ring-diet" style="--progress:${ringProgress};--pro-stop:${macroStops.pro}deg;--carb-stop:${macroStops.carb}deg;--fat-stop:${macroStops.fat}deg"><span class="ring-motion-aura" aria-hidden="true"></span><div><b>${displayPercent}%</b><small>饮食</small><em>${intake}/${goalCal}</em></div></div>`;
        },

        renderPlanTodaySection(summary) {
            // Read-only: never create or bootstrap plans on first paint.
            const todayPlans = this.getTodayDailyPlans?.() || readTodayPlans(this);
            const aggregate = this.aggregateCompletionRate?.(todayPlans) || aggregateCompletionRate(todayPlans);
            const plan = selectedPlan(this, todayPlans);
            const percent = Math.round((aggregate.rate || 0) * 100);
            const today = todayKey(this);
            summary = ths(this, summary);
            const weight = summary.weight
                || activeList(this, this.db?.health?.weights || []).find((item) => item.date === today)
                || this.sortedWeights?.().slice(-1)[0]
                || null;
            const exerciseCal = Math.round(this.todayTrainingCalories?.() || summary.exerciseCal || 0);
            const intake = n0(summary.intake);
            const goalCal = n0(summary.goals?.cal || this.db?.health?.dietGoal?.dailyCal);
            const remaining = goalCal ? goalCal - intake : 0;
            const heroTitle = goalCal
                ? `距目标还差 ${remaining} 千卡`
                : (weight ? `体重 ${Number(weight.weight || 0).toFixed(2)} kg` : '开始今日训练');
            const streakDays = this.computeStreakDays?.() || 0;
            const prefs = readPlanPrefs(this);
            const weeklySummary = window.planWeekly?.summary?.() || { done: 0, total: 0 };
            const esc = (v) => (typeof this.escapeHtml === 'function' ? this.escapeHtml(v) : String(v ?? ''));
            return `<div class="hero"><span class="hero-motion-aura" aria-hidden="true"></span><div class="hero-head"><div><div class="hero-label">今日概览</div><div class="hero-title">${esc(heroTitle)}</div></div><div style="display:flex;align-items:center;gap:6px">
                        ${streakDays > 0 ? `<span class="streak-chip"><span class="material-symbols-rounded">local_fire_department</span>连续 ${streakDays} 天</span>` : ''}
                        ${prefs.showWeeklyDock === false ? '' : `<button class="md-icon-btn-bar today-weekly-plan-btn" type="button" onclick="window.planWeekly?.open?.()" aria-label="近期计划" title="3-7天 · ${weeklySummary.done}/${weeklySummary.total || 0} 完成"><span class="material-symbols-rounded">calendar_month</span></button>`}
                        <button class="md-icon-btn-bar" type="button" onclick="data.openPlanTodayAiSheet?.()" aria-label="AI"><span class="material-symbols-rounded">auto_awesome</span></button></div></div><div class="rings">
                    ${this.renderPlanIntakeRing?.(summary) || ''}
                    <span class="ring-divider"></span><button class="ring ring-train ${plan ? planStatusClass(plan.type) : 'is-empty'}" style="--plan-progress:${percent * 3.6}deg" type="button" onclick="${plan ? `data.openPlanTaskDrawer('${plan.id}')` : 'data.openNewPlanSheet()'}"><span class="ring-motion-aura" aria-hidden="true"></span><div><b>${aggregate.total ? `${aggregate.done}/${aggregate.total}` : '+'}</b><small>训练</small><em>${percent}% · ${exerciseCal} 分钟</em></div></button></div>
                ${todayPlans.length > 1 ? `<div class="plan-type-tabs">${todayPlans.map((item) => {
                    const meta = this.planTypeMeta?.(item.type, item.title) || planTypeMeta(item.type, item.title);
                    return `<button class="plan-type-tab ${item.id === plan.id ? 'active' : ''} ${planStatusClass(item.type)}" type="button" onclick="data.selectTodayPlan?.('${item.id}')"><span class="material-symbols-rounded">${meta.icon}</span>${esc(item.title || meta.label)}</button>`;
                }).join('')}</div>` : ''}
            </div>`;
        },

        renderTodayV6PlanCard() {
            const todayPlans = this.getTodayDailyPlans?.() || readTodayPlans(this);
            const selected = selectedPlan(this, todayPlans);
            if (!selected) {
                return `<div class="sect-head"><span class="t">当前训练计划</span><button class="a" onclick="data.openNewPlanSheet()" type="button">新建计划</button></div><div class="glass-card plan-card"><div class="plan-head"><div><div class="pt">待安排</div><div class="pn">今天还没有训练计划</div></div><div class="plan-chip"><span class="material-symbols-rounded">event_note</span>0/0</div></div><div class="plan-meta"><span>先创建计划，或让 AI 根据当前目标安排今天的训练。</span></div><div class="plan-actions"><button class="md-btn md-btn-filled" type="button" onclick="data.openNewPlanSheet()"><span class="material-symbols-rounded">playlist_add</span>新建计划</button><button class="md-btn md-btn-tonal" type="button" onclick="data.openPlanTodayAiSheet?.()"><span class="material-symbols-rounded">auto_awesome</span>AI 生成</button></div></div>`;
            }
            const plan = selected;
            const planMeta = this.planTypeMeta?.(plan.type || 'rehab', plan.title) || planTypeMeta(plan.type || 'rehab', plan.title);
            const completion = this.completionRate?.(plan) || completionRate(plan);
            const items = (plan.items || []).filter((item) => !item.deleted).sort((a, b) => taskSort(a) - taskSort(b));
            const current = items.find((item) => item.status === 'in-progress') || items.find((item) => item.status === 'todo') || null;
            const pending = items.filter((item) => item.status === 'todo' || item.status === 'in-progress').length;
            const totalItems = items.length || 1;
            const esc = (v) => (typeof this.escapeHtml === 'function' ? this.escapeHtml(v) : String(v ?? ''));
            return `<div class="sect-head"><span class="t">当前训练计划</span><button class="a" onclick="data.openPlanTaskDrawer('${plan.id}')" type="button">查看全部</button></div><div class="glass-card plan-card"><div class="plan-head"><div><div class="pt">进行中 · ${esc(planMeta.label)}</div><div class="pn">${esc(plan.title || planMeta.label)}</div></div><div class="plan-chip"><span class="material-symbols-rounded">play_circle</span>${completion.done}/${completion.total}</div></div><div class="seg-bar">${items.map((item) => {
                const cls = item.status === 'done' ? 'done' : (current && item.id === current.id ? 'cur' : '');
                return `<span class="seg ${cls}" style="width:${100 / totalItems}%"></span>`;
            }).join('')}</div>
                ${current ? `<div class="plan-meta"><span>${taskSpecText(current)}${current.currentLevel ? ` · Lv${current.currentLevel}` : ''}</span>${pending ? `<span>${pending} 项待完成</span>` : ''}</div>` : ''}
                <div class="plan-actions">
                    ${current ? `<button class="md-btn md-btn-filled" type="button" onclick="data.handlePlanTaskTap('${plan.id}','${current.id}')"><span class="material-symbols-rounded">play_arrow</span>继续训练</button>` : `<button class="md-btn md-btn-tonal" type="button" onclick="data.openPlanTaskDrawer('${plan.id}')"><span class="material-symbols-rounded">checklist</span>查看完成</button>`}
                    <button class="md-btn md-btn-tonal" type="button" onclick="data.openPlanTaskDrawer('${plan.id}')">查看动作</button></div></div>`;
        },

        renderTodayV6DietCard(summary) {
            summary = ths(this, summary);
            const m = summary.macros || {};
            const g = summary.goals || {};
            const intake = n0(summary.intake);
            const pro = n0(m.pro);
            const carb = n0(m.carb);
            const fat = n0(m.fat);
            const goalCal = n0(g.cal || this.db?.health?.dietGoal?.dailyCal);
            const remaining = goalCal ? goalCal - intake : 0;
            const p = (v, t) => (t ? Math.min(100, Math.round(v / t * 100)) : 0);
            const proPct = p(pro, n0(g.pro));
            const carbPct = p(carb, n0(g.carb));
            const fatPct = p(fat, n0(g.fat));
            return `<div class="sect-head"><span class="t">饮食摄入</span><button class="a" onclick="data.openDietModal()" type="button">添加记录 ›</button></div><div class="glass-card"><div class="calorie-head"><div><span class="num">${goalCal ? remaining : '--'}</span><span class="unit">${goalCal ? 'kcal 剩余' : ''}</span></div>
                    ${goalCal ? `<div class="right"><div class="lab">已摄入 / 目标</div><div class="val">${intake} / ${goalCal}</div></div>` : ''}
                </div>
                ${goalCal ? `<div class="stack-bar"><i class="b1" style="width:${carbPct}%"></i><i class="b2" style="width:${proPct}%"></i><i class="b3" style="width:${fatPct}%"></i></div><div class="macros"><span class="macro c"><small>碳水</small><b>${carb.toFixed(0)}g</b></span><span class="macro p"><small>蛋白</small><b>${pro.toFixed(0)}g</b></span><span class="macro f"><small>脂肪</small><b>${fat.toFixed(0)}g</b></span><span class="macro r"><small>余</small><b>${remaining}</b></span></div>` : ''}
            </div>`;
        },

        renderTodayActionDock() {
            return `<div class="quick-dock"><button class="record-quick-btn" type="button" data-q="weight" onclick="data.openWeightModal()"><span class="material-symbols-rounded">monitor_weight</span><span>记体重</span></button><button class="record-quick-btn" type="button" data-q="diet" onclick="data.openDietModal()"><span class="material-symbols-rounded">restaurant</span><span>记饮食</span></button><button class="record-quick-btn" type="button" data-q="cardio" onclick="data.openExerciseModal()"><span class="material-symbols-rounded">fitness_center</span><span>记运动</span></button><button class="record-quick-btn record-quick-btn-ai context-ai-btn" type="button" data-q="ai" data-ai-ctx="today" data-ai-idx="0"><span class="material-symbols-rounded">psychology</span><span>问 AI</span></button></div>`;
        },

        updateTodayV6Greet() {
            const greetLine = document.querySelector('.today-v6-greet-line');
            const greetSub = document.querySelector('.today-v6-greet-sub');
            if (!greetLine) return;
            const hour = new Date().getHours();
            const greet = hour < 6 ? '凌晨好' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
            const name = this.db?.profile?.name || '';
            greetLine.textContent = name ? `${greet}，${name}` : greet;
            if (greetSub) {
                const now = new Date();
                const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
                greetSub.textContent = `${now.getMonth() + 1}月${now.getDate()}日 · ${weekdays[now.getDay()]}`;
            }
        },

        // Fallback only: without plan-ui there is nothing deferred to enhance.
        // plan-ui replaces this with a local AI/timeline enhance after it loads.
        enhanceTodayPage() {
            this.updateTodayV6Greet?.();
        }
    };
})();
