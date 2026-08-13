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

    function dateKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function startOfIsoWeek(date = new Date()) {
        const d = new Date(date);
        d.setHours(0,0,0,0);
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return d;
    }

    function isoWeekKey(date = new Date()) {
        const d = startOfIsoWeek(date);
        const thursday = new Date(d);
        thursday.setDate(d.getDate() + 3);
        const year = thursday.getFullYear();
        const weekOne = startOfIsoWeek(new Date(year, 0, 4));
        const week = Math.floor((d.getTime() - weekOne.getTime()) / 604800000) + 1;
        return `${year}-W${String(week).padStart(2, '0')}`;
    }

    function weekStartFromKey(weekKey) {
        const match = String(weekKey || '').match(/^(\d{4})-W(\d{2})$/);
        if (!match) return startOfIsoWeek(new Date());
        const year = Number(match[1]);
        const week = Number(match[2]);
        const start = startOfIsoWeek(new Date(year, 0, 4));
        start.setDate(start.getDate() + (week - 1) * 7);
        return start;
    }

    window.dataWeeklySummary = {
        weeklyTrainingSummaryForRange(start, end) {
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

        weeklyTrainingSummary(offsetWeeks = 0) {
            const { start, end } = weekWindow(offsetWeeks);
            return this.weeklyTrainingSummaryForRange(start, end);
        },

        buildPeriodReportContext(periodStart, periodEnd) {
            const active = (list) => this.activeRecords ? this.activeRecords(list || []) : (list || []).filter(item => item && !item.deleted);
            const inKeyRange = (key) => {
                const text = String(key || '');
                return text >= periodStart && text <= periodEnd;
            };
            const historyKey = (h) => this.historyDayKey ? this.historyDayKey(h) : dateKey(this.parseHistoryDate?.(h.date) || new Date(h.date || Date.now()));
            const fmtNum = (n, digits = 0) => Number(n || 0).toFixed(digits);
            const mealLabel = (meal) => ({ breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' }[meal] || meal || '未分类');
            const planTypeLabel = (type, title = '') => ({ rehab: '康复训练', cut: '减脂训练', bulk: '增肌/力量增强', maintenance: '维持训练', custom: '自定义训练' }[type] || title || type || '训练计划');
            const taskCategoryLabel = (category) => ({ warmup: '热身', main: '主训练', cooldown: '拉伸/放松' }[category] || category || '主训练');
            const taskStatusLabel = (status) => ({ done: '已完成', completed: '已完成', skipped: '已跳过', 'in-progress': '进行中', pending: '待执行' }[status] || status || '待执行');
            const taskSpec = (task = {}) => {
                const spec = task.spec || {};
                const parts = [];
                if (spec.sets) parts.push(`${spec.sets}组`);
                if (spec.reps) parts.push(`每组${spec.reps}次`);
                if (spec.work) parts.push(`每次${spec.work}秒`);
                if (spec.repRest) parts.push(`次休${spec.repRest}秒`);
                if (spec.actionRest) parts.push(`组休${spec.actionRest}秒`);
                if (spec.isAlt) parts.push('双侧交替');
                if (task.currentLevel) parts.push(`Lv${task.currentLevel}`);
                return parts.join('，') || '未填写参数';
            };
            const profile = this.db.health?.profile || {};
            const profileLines = [];
            const conditionType = { injury: '运动损伤', chronic: '慢性病', allergy: '过敏', surgery: '手术史', medication: '用药', other: '其他' };
            if (profile.gender || profile.age || this.db.health?.height) profileLines.push(`基础：${profile.gender === 'female' ? '女' : '男'} · ${profile.age || '?'}岁${this.db.health?.height ? ' · 身高' + this.db.health.height + 'cm' : ''}`);
            if (profile.conditions?.length) profile.conditions.forEach(c => profileLines.push(`- [诊断:${conditionType[c.type] || c.type || '健康状况'}] ${c.label || '未命名'}${c.severity ? '（' + c.severity + '）' : ''}${c.bodyPart ? '；部位：' + c.bodyPart : ''}${c.avoid?.length ? '；避免：' + c.avoid.join('、') : ''}${c.note ? '；备注：' + c.note : ''}`));
            if (profile.examResults?.length) profile.examResults.forEach(exam => profileLines.push(`- [检查结果] ${exam.item || '检查'}${exam.date ? '（' + exam.date + '）' : ''}${exam.bodyPart ? '；部位：' + exam.bodyPart : ''}${exam.conditionLabel ? '；关联诊断：' + exam.conditionLabel : ''}${exam.result ? '；结果：' + exam.result : ''}${exam.note ? '；备注：' + exam.note : ''}`));
            if (profile.allergies?.length) profileLines.push(`过敏/不耐受：${profile.allergies.join('、')}`);
            if (profile.preferences?.equipment?.length) profileLines.push(`可用器材：${profile.preferences.equipment.join('、')}`);
            if (profile.preferences?.sports?.length) profileLines.push(`偏好运动：${profile.preferences.sports.join('、')}`);
            if (profile.vitals?.restingHR) profileLines.push(`静息心率：${profile.vitals.restingHR} bpm`);
            const weights = active(this.db.health?.weights || []).filter(w => inKeyRange(w.date)).sort((a, b) => String(a.date).localeCompare(String(b.date)));
            const foods = active(this.db.health?.foodLogs || []).filter(f => inKeyRange(f.date)).sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.meal || '').localeCompare(String(b.meal || '')));
            const manualExercises = active(this.db.health?.exerciseLogs || []).filter(e => inKeyRange(e.date)).sort((a, b) => String(a.date).localeCompare(String(b.date)));
            const histories = active(this.db.history || []).filter(h => inKeyRange(historyKey(h))).sort((a, b) => String(historyKey(a)).localeCompare(String(historyKey(b))));
            const plans = active(this.db.dailyPlans || []).filter(p => inKeyRange(p.date || p.dayKey)).sort((a, b) => String(a.date || a.dayKey).localeCompare(String(b.date || b.dayKey)));
            const macros = foods.reduce((acc, f) => {
                acc.cal += Number(f.cal || 0);
                acc.pro += Number(f.pro || 0);
                acc.carb += Number(f.carb || 0);
                acc.fat += Number(f.fat || 0);
                return acc;
            }, { cal: 0, pro: 0, carb: 0, fat: 0 });
            const foodPer100 = (f, field, totalField) => {
                const direct = Number(f[field] || 0);
                if (direct > 0) return direct;
                const grams = Number(f.grams || 0);
                const total = Number(f[totalField] || 0);
                return grams > 0 && total > 0 ? total * 100 / grams : 0;
            };
            const foodSource = (f) => [
                f.sourceLabel,
                f.source,
                f.foodSource,
                f.id && String(f.id).startsWith('ai-food') ? 'AI识别' : '',
                f.calUnit ? `热量原单位:${f.calUnit}` : '',
                f.confidence ? `置信度:${f.confidence}` : ''
            ].filter(Boolean).join('；') || '手动/未标注';
            const foodExtra = (f) => [
                f.brand ? `品牌:${f.brand}` : '',
                f.fiber ? `膳食纤维:${fmtNum(f.fiber, 1)}g` : '',
                f.sugar ? `糖:${fmtNum(f.sugar, 1)}g` : '',
                f.sodium ? `钠:${fmtNum(f.sodium, 0)}mg` : '',
                f.saturatedFat ? `饱和脂肪:${fmtNum(f.saturatedFat, 1)}g` : '',
                Array.isArray(f.ingredients) && f.ingredients.length ? `主要配料:${f.ingredients.join('、')}` : '',
                f.cooking ? `烹饪方式:${f.cooking}` : '',
                f.note ? `备注:${f.note}` : '',
                f.rawText ? `原始描述:${f.rawText}` : '',
                f.aiText ? `AI描述:${f.aiText}` : '',
                Array.isArray(f.tags) && f.tags.length ? `标签:${f.tags.join('、')}` : ''
            ].filter(Boolean).join('；');
            const foodDaySummary = Object.entries(foods.reduce((acc, f) => {
                const key = f.date || '未知日期';
                acc[key] = acc[key] || { cal: 0, pro: 0, carb: 0, fat: 0, meals: {} };
                acc[key].cal += Number(f.cal || 0);
                acc[key].pro += Number(f.pro || 0);
                acc[key].carb += Number(f.carb || 0);
                acc[key].fat += Number(f.fat || 0);
                const meal = mealLabel(f.meal);
                acc[key].meals[meal] = (acc[key].meals[meal] || 0) + Number(f.cal || 0);
                return acc;
            }, {})).map(([day, d]) => `- ${day}｜总热量 ${Math.round(d.cal)} kcal｜P${fmtNum(d.pro, 1)} C${fmtNum(d.carb, 1)} F${fmtNum(d.fat, 1)}｜餐次热量 ${Object.entries(d.meals).map(([meal, cal]) => `${meal}${Math.round(cal)}kcal`).join('、')}`);
            const historyMinutes = histories.reduce((sum, h) => sum + Math.round(Number(h.duration || 0) / 60), 0);
            const manualMinutes = manualExercises.reduce((sum, e) => sum + Number(e.minutes || 0), 0);
            const actionNames = (h) => {
                const names = this.historyNames ? this.historyNames(h) : (h.actions || []).map(a => a.name).filter(Boolean);
                return names.join('、') || '未命名训练';
            };
            const setSummary = (h) => {
                const sets = h.actualSets || [];
                if (!sets.length) return '';
                const rpes = sets.map(s => Number(s.rpe || s.extras?.rpe || 0)).filter(Boolean);
                const avgRpe = rpes.length ? (rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1) : '暂无';
                return `｜组数 ${sets.length}｜平均RPE ${avgRpe}`;
            };
            const lines = [];
            lines.push(`【周期】${periodStart} 至 ${periodEnd}`);
            lines.push(`【健康档案（必须遵守）】\n${profileLines.length ? profileLines.join('\n') : '暂无健康档案'}`);
            lines.push(`【周期摘要】训练历史 ${histories.length} 条，手动运动 ${manualExercises.length} 条，训练总时长 ${historyMinutes + manualMinutes} 分钟；饮食 ${foods.length} 条，摄入 ${Math.round(macros.cal)} kcal，蛋白 ${fmtNum(macros.pro, 1)}g，碳水 ${fmtNum(macros.carb, 1)}g，脂肪 ${fmtNum(macros.fat, 1)}g；体重 ${weights.length} 条。`);
            lines.push(`【体重记录】\n${weights.length ? weights.map(w => `- ${w.date}｜${fmtNum(w.weight, 2)} kg${w.note ? '｜' + w.note : ''}`).join('\n') : '该周期无体重记录'}`);
            lines.push(`【饮食按日/餐汇总】\n${foodDaySummary.length ? foodDaySummary.join('\n') : '该周期无饮食记录'}`);
            lines.push(`【饮食记录明细（用于判断饮食是否健康）】\n${foods.length ? foods.slice(0, 120).map(f => `- ${f.date}｜${mealLabel(f.meal)}｜${f.name || '未命名食物'}${f.grams ? '｜食用量 ' + f.grams + 'g' : ''}｜总热量 ${Math.round(Number(f.cal || 0))} kcal｜每100g热量 ${fmtNum(foodPer100(f, 'calPer100g', 'cal'), 1)} kcal${f.calInputPer100g ? '｜录入热量 ' + fmtNum(f.calInputPer100g, 1) + (f.calUnit ? f.calUnit + '/100g' : '/100g') : ''}｜总P/C/F ${fmtNum(f.pro, 1)}/${fmtNum(f.carb, 1)}/${fmtNum(f.fat, 1)}g｜每100g P/C/F ${fmtNum(foodPer100(f, 'proPer100g', 'pro'), 1)}/${fmtNum(foodPer100(f, 'carbPer100g', 'carb'), 1)}/${fmtNum(foodPer100(f, 'fatPer100g', 'fat'), 1)}g｜来源 ${foodSource(f)}${foodExtra(f) ? '｜' + foodExtra(f) : ''}`).join('\n') : '该周期无饮食记录'}`);
            lines.push(`【训练历史】\n${histories.length ? histories.slice(0, 50).map(h => `- ${historyKey(h)}｜${actionNames(h)}｜${Math.round(Number(h.duration || 0) / 60)}分钟${h.cardio?.calories ? '｜有氧' + Math.round(h.cardio.calories) + 'kcal' : ''}${setSummary(h)}`).join('\n') : '该周期无训练历史'}`);
            lines.push(`【手动运动】\n${manualExercises.length ? manualExercises.slice(0, 80).map(e => `- ${e.date}｜${this.exerciseLabel ? this.exerciseLabel(e.type, e) : (e.name || e.type || '运动')}｜${Number(e.minutes || 0)}分钟｜${Math.round(Number(e.calories || 0))} kcal${e.distance ? '｜' + e.distance + 'km' : ''}${e.sets ? '｜' + e.sets + '组' : ''}${e.repsPerSet ? '×' + e.repsPerSet + '次' : ''}${e.weightKg ? '｜' + e.weightKg + 'kg' : ''}`).join('\n') : '该周期无手动运动记录'}`);
            lines.push(`【计划完成】\n${plans.length ? plans.slice(0, 30).map(p => {
                const items = p.items || p.tasks || [];
                const done = items.filter(item => item.completed || item.status === 'done' || item.status === 'completed').length;
                const planType = p.type || p.planType || 'rehab';
                const header = `- ${p.date || p.dayKey}｜${planTypeLabel(planType, p.title)}｜${done}/${items.length} 完成${p.cancelled || p.deleted ? '｜已取消/删除' : ''}`;
                const taskLines = items.slice(0, 12).map(task => `  · ${task.name || '未命名任务'}｜${taskCategoryLabel(task.category)}｜${taskStatusLabel(task.status)}｜${taskSpec(task)}`);
                return [header, ...taskLines].join('\n');
            }).join('\n') : '该周期无每日计划记录'}`);
            return lines.join('\n\n');
        },

        weeklyFatigueInsight(weekKey = '') {
            const currentStart = weekKey ? weekStartFromKey(weekKey) : weekWindow(0).start;
            const currentEnd = new Date(currentStart);
            currentEnd.setDate(currentEnd.getDate() + 7);
            const previousStart = new Date(currentStart);
            previousStart.setDate(previousStart.getDate() - 7);
            const cur = this.weeklyTrainingSummaryForRange(currentStart, currentEnd);
            const prev = this.weeklyTrainingSummaryForRange(previousStart, currentStart);
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
            return { cur, prev, minuteDelta, loadSpike, highRpe, fatigue, deload, level, hint, weekKey: isoWeekKey(currentStart), weekStart: dateKey(currentStart), weekEnd: dateKey(new Date(currentEnd.getTime() - 86400000)) };
        },

        weeklyAiPromptForWeek(weekKey = '') {
            const insight = this.weeklyFatigueInsight(weekKey);
            const tpl = window.dataAiTemplates;
            const prefs = tpl?.getPromptPrefs('weekly_report', this.db) || {};
            const focusMap = { completion: '完成率', fatigue: '疲劳', deload: '降载', diet: '饮食', weight: '体重' };
            const focusStr = Array.isArray(prefs.focus) && prefs.focus.length ? prefs.focus.map(f => focusMap[f] || f).join('、') : '完成率、疲劳、降载';
            const context = this.buildPeriodReportContext?.(insight.weekStart, insight.weekEnd) || '';
            return `请基于 ${insight.weekStart} 至 ${insight.weekEnd} 的训练、饮食、体重和计划完成情况，做一份周总结。重点分析：${focusStr}。当前本地训练摘要：该周 ${insight.cur.total} 次训练，${insight.cur.minutes} 分钟，较前一周 ${insight.minuteDelta >= 0 ? '+' : ''}${insight.minuteDelta} 分钟，平均 RPE ${insight.cur.avgRpe ? insight.cur.avgRpe.toFixed(1) : '暂无'}，初步判断：${insight.level}。请严格基于下面的周期数据，不要编造不存在的数据。${prefs.customNote ? '\n用户补充：' + prefs.customNote : ''}\n\n${context}`;
        },

        weeklyAiPrompt() {
            return this.weeklyAiPromptForWeek();
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

        closeSummarySheet(direct) {
            const id = window.navStack?.top?.()?.id === 'monthlySummary' ? 'monthlySummary' : 'weeklySummary';
            if (!direct && window.navStack?.requestClose?.('sheet', id)) return;
            const el = document.getElementById('summarySheetOverlay');
            if (!el) return true;
            el.style.animation = 'summarySheetFadeIn .2s ease reverse forwards';
            const sheet = el.querySelector('.summary-sheet');
            if (sheet) sheet.style.animation = 'summarySheetSlideUp .25s var(--md-sys-motion-emphasized) reverse forwards';
            setTimeout(() => el.remove(), 220);
            document.removeEventListener('keydown', this._summarySheetEsc);
        },

        renderWeeklySummarySheetBody(weekKey = '') {
            const safe = this.escapeHtml.bind(this);
            const insight = this.weeklyFatigueInsight(weekKey);
            const hasAi = !!(this.db?.aiProfiles?.length && (this.db.aiActiveId || this.db.aiProfiles[0]?.id)) || !!(window.ai && ai.cfg?.enabled);
            const dt = (a, b) => a - b > 0 ? `+${a-b}` : `${a-b}`;
            return `<div class="summary-month-controls">
                <label class="summary-month-field" for="summaryWeekInput"><span class="material-symbols-rounded">event</span><input id="summaryWeekInput" type="week" value="${safe(insight.weekKey)}" onchange="data.applyWeeklySummaryWeek()" aria-label="选择总结周"></label>
                <button class="summary-month-apply" onclick="data.applyWeeklySummaryWeek()" type="button">查看</button>
            </div>
            <div class="summary-glass-card">
                <div class="summary-kicker">AI 周总结 · ${safe(insight.weekStart)} 至 ${safe(insight.weekEnd)}</div>
                <h3>${safe(insight.level)}</h3>
                <small>${safe(insight.hint)}</small>
                <div class="summary-stats">
                    <div class="summary-stat"><strong>${insight.cur.total}</strong><small>本周训练</small></div>
                    <div class="summary-stat"><strong>${insight.cur.minutes}</strong><small>分钟</small></div>
                    <div class="summary-stat"><strong>${insight.cur.avgRpe ? insight.cur.avgRpe.toFixed(1) : '--'}</strong><small>平均 RPE</small></div>
                </div>
                <div class="summary-ai-actions">
                    <button class="summary-ai-btn" ${hasAi ? '' : 'disabled'} onclick="data.askWeeklySummaryAi('${safe(insight.weekKey)}', false)" type="button"><span class="material-symbols-rounded">auto_awesome</span>${safe(insight.weekKey)}总结</button>
                    <button class="summary-ai-btn" ${hasAi ? '' : 'disabled'} onclick="data.askWeeklySummaryAi('${safe(insight.weekKey)}', true)" type="button"><span class="material-symbols-rounded">trending_down</span>判断降载</button>
                </div>
                <div data-ai-task-picker="summary.weekly"></div>
                ${this.renderSavedSummaryResults('weekly', insight.weekKey)}
            </div>
            <div class="summary-glass-card">
                <div class="summary-kicker">周概览</div>
                <h3>${insight.cur.total} 次训练 · ${insight.cur.minutes} 分钟</h3>
                <small>较前一周 ${dt(insight.cur.minutes, insight.prev.minutes)} 分钟 · ${insight.cur.cal} kcal</small>
                <div class="summary-stats">
                    <div class="summary-stat"><strong>${insight.cur.cal}</strong><small>消耗 kcal</small></div>
                    <div class="summary-stat"><strong>${dt(insight.cur.total, insight.prev.total)}</strong><small>较前周</small></div>
                    <div class="summary-stat"><strong>${safe(insight.cur.top)}</strong><small>最常练</small></div>
                </div>
            </div>`;
        },

        applyWeeklySummaryWeek() {
            const input = document.getElementById('summaryWeekInput');
            const body = document.getElementById('summarySheetBody');
            if (!body) return;
            body.innerHTML = this.renderWeeklySummarySheetBody(input?.value);
        },

        askWeeklySummaryAi(weekKey = '', deload = false) {
            const basePrompt = this.weeklyAiPromptForWeek(weekKey);
            const prompt = deload ? `${basePrompt}\n请特别判断下一周是否需要 deload，并给出具体降载比例、保留动作和恢复安排。` : basePrompt;
            this._inlineSummaryAi('weekly', weekKey, prompt, deload ? '判断降载' : '周总结', deload ? 'deload' : 'summary');
        },

        askMonthlySummaryAi(monthKey = '') {
            const prompt = this.monthlySummaryAiPrompt(monthKey);
            this._inlineSummaryAi('monthly', monthKey, prompt, '月总结', 'summary');
        },

        async _inlineSummaryAi(kind, periodKey, prompt, label, resultType = 'summary', routeOverride = null) {
            const hasAi = !!(this.db?.aiProfiles?.length && (this.db.aiActiveId || this.db.aiProfiles[0]?.id)) || !!(window.ai && ai.cfg?.enabled);
            if (!hasAi) return alert('请先在设置中配置 AI');
            const body = document.getElementById('summarySheetBody');
            if (!body) return;
            const safe = this.escapeHtml ? this.escapeHtml.bind(this) : (v) => String(v ?? '');
            let responseEl = document.getElementById('summaryAiResponse');
            if (!responseEl) {
                responseEl = document.createElement('div');
                responseEl.id = 'summaryAiResponse';
                responseEl.className = 'summary-ai-response';
                body.appendChild(responseEl);
            }
            responseEl.innerHTML = `<div class="summary-ai-loading"><span class="material-symbols-rounded progress-icon">progress_activity</span> 正在生成${safe(label)}…</div>`;
            responseEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            try {
                const systemMsg = kind === 'monthly'
                    ? '你是严谨的训练与体重数据复盘助手。禁止编造数据，只能引用输入字段。输出：summary ≤80字，highlights ≤3条，suggestions ≤3条。'
                    : '你是严谨的训练与体重数据复盘助手。禁止编造数据，只能引用输入字段。输出：summary ≤80字，highlights ≤3条，suggestions ≤3条，deload判断（如适用）。';
                const messages = [
                    { role: 'system', content: systemMsg },
                    { role: 'user', content: prompt }
                ];
                const renderMd = this.renderAdviceMarkdown ? (t) => this.renderAdviceMarkdown(t) : (t) => `<p>${safe(t)}</p>`;
                const taskId = kind === 'monthly' ? 'summary.monthly' : 'summary.weekly';
                if (window.ai?.run) {
                    let accumulated = '';
                    let _lastRender = 0;
                    const result = await ai.run({ taskId, messages, maxTokens: 1800, stream: true, returnMeta: true, routeOverride, onToken: (delta, acc) => {
                        accumulated = acc;
                        const now = Date.now();
                        if (now - _lastRender > 60) {
                            _lastRender = now;
                            responseEl.innerHTML = `<div class="summary-ai-result">${renderMd(accumulated)}</div>`;
                        }
                    } });
                    const meta = window.reportVersionPure.metaFromResult(result, window.ai?.resolveTaskConfig?.(taskId) || window.ai?.getEffectiveConfig?.() || {});
                    const finalText = meta.text || accumulated;
                    responseEl.innerHTML = `<div class="summary-ai-result">${renderMd(finalText)}</div>`;
                    this._saveSummaryReport(kind, periodKey, resultType, finalText, meta);
                } else {
                    const result = await ai.call(messages, 1800);
                    const text = typeof result === 'string' ? result : (result?.choices?.[0]?.message?.content || JSON.stringify(result));
                    responseEl.innerHTML = `<div class="summary-ai-result">${renderMd(text)}</div>`;
                    this._saveSummaryReport(kind, periodKey, resultType, text, window.reportVersionPure.metaFromResult(result));
                }
            } catch (err) {
                const message = String(err?.message || err || '请求失败');
                responseEl.innerHTML = `<div class="summary-ai-error"><span class="material-symbols-rounded">error</span> ${safe(message)}</div>`;
                const target = window.aiRoutingPure?.manualFallbackTarget?.(err?.aiFallback?.target);
                if (target) {
                    let retryPromise;
                    window.toast?.show?.(message, 'error', { timeout: 6000, action: '使用备用模型重试', onAction: () => retryPromise ||= this._inlineSummaryAi(kind, periodKey, prompt, label, resultType, target) });
                }
            }
        },

        _saveSummaryReport(kind, periodKey, resultType, content, meta = {}) {
            try {
                this.db.health.reports = this.db.health.reports || [];
                const now = Date.now();
                const existing = this.activeRecords(this.db.health.reports).find(r => r.kind === `summary_${kind}` && r.periodKey === periodKey && (r.resultType || 'summary') === resultType);
                let record = {
                    ...(existing || {}),
                    id: existing?.id || this.generateRecordId(`summary-${kind}`),
                    kind: `summary_${kind}`,
                    periodKey,
                    resultType,
                    generatedAt: existing?.generatedAt || new Date(now).toISOString(),
                    updatedAt: now,
                    deleted: false
                };
                record = window.reportVersionPure.appendVersion(record, {
                    content,
                    ai: { summary: content, model: meta.model || 'ai', profileId: meta.profileId || '', reasoningEffort: meta.reasoningEffort || '', fallback: meta.fallback || null, prompt_id: `summary_${kind}_${resultType}` },
                    searchEvidence: meta.searchEvidence
                }, now);
                record.content = content;
                if (existing) Object.assign(existing, record);
                else this.db.health.reports.push(record);
                this.saveAndBackup?.();
                this.renderSavedSummaryResult(kind, periodKey, resultType);
            } catch {}
        },

        findSummaryReport(kind, periodKey, resultType = 'summary') {
            const report = this.activeRecords(this.db.health.reports || []).find(r => r.kind === `summary_${kind}` && r.periodKey === periodKey && (r.resultType || 'summary') === resultType) || null;
            if (report) Object.assign(report, window.reportVersionPure.normalizeRecord(report));
            return report;
        },

        renderSummaryVersion(report, resultType) {
            const safe = this.escapeHtml.bind(this);
            const version = window.reportVersionPure.activeVersion(report);
            if (!version) return '';
            const index = Math.max(0, report.versions.findIndex(v => v.id === report.activeVersionId));
            const ai = version.ai || {};
            const renderMd = this.renderAdviceMarkdown ? (t) => this.renderAdviceMarkdown(t) : (t) => `<p>${safe(t)}</p>`;
            return `<div class="summary-ai-response" data-summary-result="${safe(resultType)}">
                <div class="summary-version-head"><b>${resultType === 'deload' ? '降载判断' : '总结'}</b><small>${safe(ai.model || 'AI')}${ai.reasoningEffort ? ` · ${safe(ai.reasoningEffort)}` : ''}</small></div>
                <div class="summary-ai-result">${renderMd(version.content || ai.summary || '')}</div>
                ${window.searchEvidenceUi.trail(version.searchEvidence, safe)}
                <div class="advice-version-switcher" aria-label="总结版本">
                    <button class="advice-version-btn" ${index <= 0 ? 'disabled' : ''} onclick="data.cycleSummaryVersion('${safe(report.id)}', -1)" type="button" aria-label="上一个版本"><span class="material-symbols-rounded">chevron_left</span></button>
                    <span>${index + 1}/${report.versions.length}</span>
                    <button class="advice-version-btn" ${index >= report.versions.length - 1 ? 'disabled' : ''} onclick="data.cycleSummaryVersion('${safe(report.id)}', 1)" type="button" aria-label="下一个版本"><span class="material-symbols-rounded">chevron_right</span></button>
                    <button class="advice-version-btn" onclick="data.deleteSummaryVersion('${safe(report.id)}')" type="button" aria-label="删除当前版本"><span class="material-symbols-rounded">delete</span></button>
                </div>
            </div>`;
        },

        renderSavedSummaryResults(kind, periodKey) {
            const types = kind === 'weekly' ? ['summary', 'deload'] : ['summary'];
            return types.map(type => {
                const report = this.findSummaryReport(kind, periodKey, type);
                return report ? this.renderSummaryVersion(report, type) : '';
            }).join('');
        },

        renderSavedSummaryResult(kind, periodKey, resultType) {
            const body = document.getElementById('summarySheetBody');
            if (!body) return;
            body.innerHTML = kind === 'monthly'
                ? this.renderMonthlySummarySheetBody(periodKey)
                : this.renderWeeklySummarySheetBody(periodKey);
        },

        cycleSummaryVersion(id, delta) {
            const report = this.activeRecords(this.db.health.reports || []).find(r => r.id === id);
            if (!report) return;
            Object.assign(report, window.reportVersionPure.cycle(report, delta), { updatedAt: Date.now() });
            this.saveAndBackup?.();
            const target = document.querySelector(`[data-summary-result="${report.resultType || 'summary'}"]`);
            if (target) target.outerHTML = this.renderSummaryVersion(report, report.resultType || 'summary');
        },

        deleteSummaryVersion(id) {
            const report = this.activeRecords(this.db.health.reports || []).find(r => r.id === id);
            if (!report) return;
            const next = window.reportVersionPure.removeVersion(report, report.activeVersionId);
            if (!next.versions.length) report.deleted = true;
            else Object.assign(report, next, { updatedAt: Date.now() });
            this.saveAndBackup?.();
            this.renderSavedSummaryResult(report.kind === 'summary_monthly' ? 'monthly' : 'weekly', report.periodKey, report.resultType || 'summary');
        },

        openWeeklySummarySheet() {
            const existing = document.getElementById('summarySheetOverlay');
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.id = 'summarySheetOverlay';
            overlay.className = 'summary-sheet-overlay';
            overlay.addEventListener('click', (e) => { if (e.target === overlay) this.closeSummarySheet(); });

            overlay.innerHTML = `<div class="summary-sheet">
                <div class="summary-sheet-head">
                    <h3><span class="summary-sheet-head-icon material-symbols-rounded">summarize</span>周总结</h3>
                    <button class="summary-sheet-close" onclick="data.closeSummarySheet()" type="button"><span class="material-symbols-rounded">close</span></button>
                </div>
                <div id="summarySheetBody" class="summary-sheet-body">${this.renderWeeklySummarySheetBody()}</div>
            </div>`;

            document.body.appendChild(overlay);
            this._summarySheetEsc = (e) => { if (e.key === 'Escape') this.closeSummarySheet(); };
            document.addEventListener('keydown', this._summarySheetEsc);
            window.navStack?.open?.('sheet', 'weeklySummary', () => this.closeSummarySheet(true));
        },

        normalizeSummaryMonthKey(monthKey) {
            const now = new Date();
            const fallback = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const raw = String(monthKey || fallback).trim();
            return /^\d{4}-\d{2}$/.test(raw) ? raw : fallback;
        },

        monthlyTrainingSummary(monthKey) {
            const key = this.normalizeSummaryMonthKey(monthKey);
            const [year, month] = key.split('-').map(Number);
            const monthStart = new Date(year, month - 1, 1);
            const nextMonth = new Date(year, month, 1);
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
            const daysInMonth = new Date(year, month, 0).getDate();
            const daysWithTraining = new Set([
                ...hist.map(h => this.parseHistoryDate(h.date)?.toDateString()),
                ...ex.map(e => new Date(e.date)?.toDateString())
            ].filter(Boolean)).size;
            return { total, minutes, cal, sets, avgRpe, top3, daysInMonth, daysWithTraining, monthKey: key, monthLabel: `${year}年${month}月` };
        },

        monthlySummaryAiPrompt(monthKey) {
            const m = this.monthlyTrainingSummary(monthKey);
            const top = m.top3.length ? m.top3.map(([name, count]) => `${name}×${count}`).join('、') : '暂无';
            const [year, month] = m.monthKey.split('-').map(Number);
            const start = `${year}-${String(month).padStart(2, '0')}-01`;
            const end = dateKey(new Date(year, month, 0));
            const context = this.buildPeriodReportContext?.(start, end) || '';
            return `请总结我${m.monthLabel}的训练、饮食和体重变化，并给出下一个月建议。当前本地训练摘要：${m.monthLabel}共 ${m.total} 次训练，${m.minutes} 分钟，${m.daysWithTraining}/${m.daysInMonth} 天有训练记录，总组数 ${m.sets}，平均 RPE ${m.avgRpe ? m.avgRpe.toFixed(1) : '暂无'}，消耗 ${m.cal} kcal，高频动作：${top}。请严格基于下面的周期数据，不要编造不存在的数据。\n\n${context}`;
        },

        renderMonthlySummarySheetBody(monthKey) {
            const safe = this.escapeHtml.bind(this);
            const m = this.monthlyTrainingSummary(monthKey);
            const hasAi = !!(this.db?.aiProfiles?.length && (this.db.aiActiveId || this.db.aiProfiles[0]?.id)) || !!(window.ai && ai.cfg?.enabled);
            return `<div class="summary-month-controls">
                <label class="summary-month-field" for="summaryMonthInput"><span class="material-symbols-rounded">calendar_month</span><input id="summaryMonthInput" type="month" value="${safe(m.monthKey)}" onchange="data.applyMonthlySummaryMonth()" aria-label="选择总结月份"></label>
                <button class="summary-month-apply" onclick="data.applyMonthlySummaryMonth()" type="button">查看</button>
            </div>
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
                    <button class="summary-ai-btn" ${hasAi ? '' : 'disabled'} onclick="data.askMonthlySummaryAi('${safe(m.monthKey)}')" type="button"><span class="material-symbols-rounded">auto_awesome</span>${safe(m.monthLabel)}总结</button>
                </div>
                <div data-ai-task-picker="summary.monthly"></div>
                ${this.renderSavedSummaryResults('monthly', m.monthKey)}
            </div>`;
        },

        applyMonthlySummaryMonth() {
            const input = document.getElementById('summaryMonthInput');
            const body = document.getElementById('summarySheetBody');
            if (!body) return;
            body.innerHTML = this.renderMonthlySummarySheetBody(input?.value);
        },

        openMonthlySummarySheet() {
            const existing = document.getElementById('summarySheetOverlay');
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.id = 'summarySheetOverlay';
            overlay.className = 'summary-sheet-overlay';
            overlay.addEventListener('click', (e) => { if (e.target === overlay) this.closeSummarySheet(); });

            overlay.innerHTML = `<div class="summary-sheet">
                <div class="summary-sheet-head">
                    <h3><span class="summary-sheet-head-icon material-symbols-rounded">calendar_month</span>月总结</h3>
                    <button class="summary-sheet-close" onclick="data.closeSummarySheet()" type="button"><span class="material-symbols-rounded">close</span></button>
                </div>
                <div id="summarySheetBody" class="summary-sheet-body">${this.renderMonthlySummarySheetBody()}</div>
            </div>`;

            document.body.appendChild(overlay);
            this._summarySheetEsc = (e) => { if (e.key === 'Escape') this.closeSummarySheet(); };
            document.addEventListener('keydown', this._summarySheetEsc);
            window.navStack?.open?.('sheet', 'monthlySummary', () => this.closeSummarySheet(true));
        }
    };
})();
