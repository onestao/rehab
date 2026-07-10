// @ts-nocheck
Object.assign(advicePanel, {
    parsePromptTargetDate(prompt) {
        const text = String(prompt || '');
        const explicit = text.match(/(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
        if (explicit) return this.dateKey(new Date(Number(explicit[1]), Number(explicit[2]) - 1, Number(explicit[3])));
        const md = text.match(/(\d{1,2})月(\d{1,2})日/);
        if (md) {
            const now = new Date();
            return this.dateKey(new Date(now.getFullYear(), Number(md[1]) - 1, Number(md[2])));
        }
        if (/今天/.test(text)) return this.logicalDateKey();
        if (/昨天/.test(text)) return this.dateKey(new Date(this.logicalDayStart().getTime() - 86400000));
        return '';
    },

    detectAdviceFocus(prompt = '') {
        const text = String(prompt || '').toLowerCase().replace(/\s+/g, '');
        const has = (patterns) => patterns.some(pattern => pattern.test(text));
        const diet = has([/饮食|早餐|午餐|晚餐|加餐|吃|摄入|食物|蛋白|碳水|脂肪|营养|热量|卡路里|膳食|补剂|钠|糖|纤维/]);
        const weight = has([/体重|体脂|bmi|腰围|围度|秤|公斤|kg|减重|减肥|增重|称重|掉秤|平台期|体重.*趋势|趋势.*体重|体重.*停滞|停滞.*体重|减重.*停滞|增肌.*停滞/]);
        const training = has([/训练|运动|动作|组数|次数|强度|频率|rpe|疼|痛|康复|处方|恢复|拉伸|力量|有氧|跑步|骑行|游泳|训练计划|运动计划|训练日程|我的计划|计划和目标|今日计划|今天.*计划|计划.*今天|日程|deload|降载|肩|膝|腰|髋|踝|腕|肘/]);
        const goal = has([/目标|达标|够不够|是否够|计划|调整|建议|减脂|增肌|维持|热量控制|热量目标|体重目标/]) || diet || weight;
        const broad = has([/综合|整体|全部|全面|总结合并|今天.*记录|记录.*今天|周总结|月总结|饮食.*训练.*体重|体重.*饮食.*训练/]);
        const contexts = broad
            ? { diet: true, training: true, weight: true, goal: true }
            : { diet, training, weight, goal: goal || diet || weight };
        const active = ['diet', 'training', 'weight', 'goal'].filter(key => contexts[key]);
        const labels = { diet: '饮食', training: '训练', weight: '体重', goal: '目标' };
        return {
            contexts,
            active,
            broad,
            hasFocus: broad || active.some(key => key !== 'goal'),
            label: active.map(key => labels[key]).join('、') || '综合',
            profileMode: training ? 'full' : (diet || weight || goal ? 'basic' : 'none')
        };
    },

    resolveAdviceContexts(prompt = '', mode = 'auto') {
        const enabled = mode === 'none'
            ? { diet: false, training: false, weight: false, goal: false }
            : { diet: true, training: true, weight: true, goal: true, ...(this.adviceContexts || {}) };
        if (mode === 'none') {
            const focus = this.detectAdviceFocus(prompt);
            focus.profileMode = 'none';
            return { contexts: enabled, focus };
        }
        const focus = this.detectAdviceFocus(prompt);
        const requested = focus.hasFocus ? focus.contexts : { diet: true, training: true, weight: true, goal: true };
        const contexts = {};
        ['diet', 'training', 'weight', 'goal'].forEach(key => { contexts[key] = !!enabled[key] && !!requested[key]; });
        focus.profileMode = contexts.training ? 'full' : (contexts.diet || contexts.weight || contexts.goal ? 'basic' : 'none');
        return { contexts, focus };
    },

    buildAdviceMessages(prompt, model, options = {}) {
        const rawMode = options.contextMode || this.adviceContextMode || 'auto';
        const requested = ['auto', 'light', 'none'].includes(rawMode) ? rawMode : 'auto';
        const build = (mode) => {
            const { contexts, focus } = this.resolveAdviceContexts(prompt, mode);
            const range = mode === 'light' && /^(month|all)$/.test(this.adviceRange || '') ? 'week' : (this.adviceRange || 'today');
            const today = this.logicalDateKey();
            const trim = list => mode === 'light' ? list.slice(-10) : list;
            const rangeFilter = (items, getDate) => {
                const start = this.adviceRangeStart(range);
                const out = start ? items.filter(item => { const date = getDate(item); return date && date >= start; }) : items;
                return trim(out);
            };

            const allHistory = this.activeRecords(this.db.history || []);
            const allFoods = this.activeRecords(this.db.health.foodLogs || []);
            const allExerciseLogs = this.activeRecords(this.db.health.exerciseLogs || []);
            const allWeights = this.sortedWeights();
            const allDailyPlans = this.activeRecords(this.db.dailyPlans || []);
            const allReports = this.activeRecords(this.db.health?.reports || []);
            const allActions = this.activeRecords(this.db.actions || []);
            const allRoutines = this.activeRecords(this.db.routines || []);

            const rangeHistory = contexts.training ? rangeFilter(allHistory, h => this.parseHistoryDate(h.date)) : [];
            const rangeFoods = contexts.diet ? rangeFilter(allFoods, f => f.date ? this.dateFromKey(f.date) : null) : [];
            const rangeExerciseLogs = contexts.training ? rangeFilter(allExerciseLogs, e => e.date ? this.dateFromKey(e.date) : null) : [];
            const rangeWeights = contexts.weight ? rangeFilter(allWeights, w => w.date ? this.dateFromKey(w.date) : null) : [];
            const rangeDailyPlans = contexts.training ? rangeFilter(allDailyPlans, p => p.date ? this.dateFromKey(p.date) : null) : [];
            const includeReports = !!(contexts.training || contexts.diet || focus.broad);
            const rangeReports = includeReports ? rangeFilter(allReports, r => this.dateFromKey(r.periodEnd || r.periodStart || r.generatedAt || this.logicalDateKey())) : [];
            const trendWeights = contexts.weight ? allWeights.slice(mode === 'light' ? -10 : -30) : [];
            const todayHistory = contexts.training ? allHistory.filter(h => this.historyDayKey(h) === today) : [];
            const todayFoods = contexts.diet ? allFoods.filter(f => f.date === today) : [];
            const todayExerciseLogs = contexts.training ? allExerciseLogs.filter(e => e.date === today) : [];
            const todayWeights = contexts.weight ? allWeights.filter(w => w.date === today) : [];
            const todayDailyPlans = contexts.training ? allDailyPlans.filter(p => p.date === today) : [];
            const dietGoal = contexts.goal ? (this.db.health.dietGoal || {}) : {};
            const bodyPlan = contexts.goal ? (this.db.health.bodyPlan || {}) : {};
            const weightPlan = contexts.goal ? (this.db.health.weightPlan || {}) : {};
            const targetDate = this.parsePromptTargetDate(prompt);
            const sumMacros = list => list.reduce((a, f) => { a.cal += Number(f.cal || 0); a.pro += Number(f.pro || 0); a.carb += Number(f.carb || 0); a.fat += Number(f.fat || 0); return a; }, { cal: 0, pro: 0, carb: 0, fat: 0 });
            const todayMacros = sumMacros(todayFoods);
            const rangeMacros = sumMacros(rangeFoods);
            const targetHistory = (targetDate && contexts.training) ? allHistory.filter(h => this.dateKey(this.parseHistoryDate(h.date)) === targetDate) : [];
            const targetFoods = (targetDate && contexts.diet) ? allFoods.filter(f => f.date === targetDate) : [];
            const targetExerciseLogs = (targetDate && contexts.training) ? allExerciseLogs.filter(e => e.date === targetDate) : [];
            const targetWeights = (targetDate && contexts.weight) ? allWeights.filter(w => w.date === targetDate) : [];
            const targetDailyPlans = (targetDate && contexts.training) ? allDailyPlans.filter(p => p.date === targetDate) : [];
            const targetMacros = sumMacros(targetFoods);
            const rangeLabel = { today: '今日', week: '最近7天', month: '最近30天', all: '全部记录' }[range];
            const formatTraining = list => list.map(h => {
                const mins = Math.floor(h.duration / 60), secs = h.duration % 60, names = this.historyNames(h).join('、');
                const meta = h.type === 'cardio' ? `${Math.round(h.cardio.calories || 0)} kcal · ${h.cardio?.type || h.cardio?.name || '有氧'}` : `${h.actions.length}个动作`;
                return `- ${h.date}｜训练时长 ${mins}分${secs}秒｜项目 ${names || '未命名'}｜${meta}`;
            }).join('\n');
            const formatFoods = list => list.map(f => {
                const meal = f.meal === 'breakfast' ? '早餐' : f.meal === 'lunch' ? '午餐' : f.meal === 'dinner' ? '晚餐' : '加餐';
                const extras = [];
                if (f.fiber) extras.push(`纤维${Number(f.fiber || 0).toFixed(1)}g`);
                if (f.sugar) extras.push(`糖${Number(f.sugar || 0).toFixed(1)}g`);
                if (f.sodium) extras.push(`钠${Number(f.sodium || 0).toFixed(0)}mg`);
                if (f.source) extras.push(`来源:${f.source}`);
                if (f.confidence) extras.push(`置信${f.confidence}%`);
                if (Array.isArray(f.ingredients) && f.ingredients.length) extras.push(`配料:${f.ingredients.slice(0, 5).join('、')}`);
                if (f.cooking) extras.push(`烹饪:${f.cooking}`);
                if (f.note) extras.push(`备注:${f.note}`);
                return `- ${f.date}｜${meal}｜${f.name}${f.grams ? ' ' + f.grams + 'g' : ''}｜${f.cal} kcal｜P${Number(f.pro || 0).toFixed(0)} C${Number(f.carb || 0).toFixed(0)} F${Number(f.fat || 0).toFixed(0)}${extras.length ? '｜' + extras.join('｜') : ''}`;
            }).join('\n');
            const formatExerciseLogs = list => list.map(e => {
                const label = this.exerciseLabel?.(e.type, e) || e.customName || e.name || e.type || '运动';
                const details = [`${Number(e.minutes || 0)}分钟`, `${Number(e.calories || 0)} kcal`];
                if (e.distance) details.push(`${e.distance}km`);
                if (e.type === 'strength') {
                    if (e.weightKg) details.push(`${e.weightKg}kg`);
                    if (e.sets || e.repsPerSet) details.push(`${Number(e.sets || 0)}组${e.repsPerSet ? `×${Number(e.repsPerSet || 0)}次` : ''}`);
                }
                if (e.note) details.push(`备注：${e.note}`);
                return `- ${e.date}｜${label}｜${details.join('｜')}`;
            }).join('\n');
            const formatWeightDateTime = w => {
                const measuredAt = w?.measuredAt ? new Date(w.measuredAt) : null;
                if (measuredAt && Number.isFinite(measuredAt.getTime())) {
                    const yyyy = measuredAt.getFullYear();
                    const mm = String(measuredAt.getMonth() + 1).padStart(2, '0');
                    const dd = String(measuredAt.getDate()).padStart(2, '0');
                    const hh = String(measuredAt.getHours()).padStart(2, '0');
                    const min = String(measuredAt.getMinutes()).padStart(2, '0');
                    return { at: `${yyyy}-${mm}-${dd} ${hh}:${min}`, note: '实测时间' };
                }
                return { at: `${w.date} 07:00`, note: '默认晨起空腹（未记录具体时刻）' };
            };
            const formatWeights = list => list.map(w => {
                const weight = Number(w.weight);
                const measured = formatWeightDateTime(w);
                return `- ${measured.at}｜${Number.isFinite(weight) ? weight.toFixed(2) : String(w.weight || '--')} kg｜时间:${measured.note}`;
            }).join('\n');
            const formatRehabWeekly = list => list.map(week => {
                const actions = (week.actions || []).map(a => `${a.name || '未命名'}[${a.actionId || '?'}]（${a.status || 'continued'}${a.painLevel ? `，疼痛${a.painLevel}/10` : ''}${a.needsReview ? '，需确认' : ''}${a.progressesFrom ? '，进阶自:' + a.progressesFrom : ''}${a.coachNote ? '，' + a.coachNote : ''}）`).join('；');
                const extras = [];
                if (week.visitDate) extras.push(`就诊:${week.visitDate}`);
                if (week.homework) extras.push(`作业:${week.homework}`);
                if (week.rawText) extras.push(`原文:${String(week.rawText).slice(0, 160)}`);
                const specs = (week.actions || []).map(a => a.spec ? `${a.name || '动作'}:${JSON.stringify(a.spec)}` : '').filter(Boolean).slice(0, 4);
                if (specs.length) extras.push(`规格:${specs.join('；')}`);
                return `- ${week.weekStart || week.visitDate || ''}｜${actions || '无动作明细'}${week.therapistAssessment ? '｜评估：' + week.therapistAssessment : ''}${extras.length ? '｜' + extras.join('｜') : ''}`;
            }).join('\n');
            const planTypeLabel = (type = '', title = '') => this.planTypeMeta?.(type, title)?.label || ({ rehab: '康复计划', cut: '减脂日程', bulk: '增肌日程', maintenance: '综合训练', custom: '自定义计划' }[type] || title || type || '训练计划');
            const formatDailyPlans = list => list.map(plan => {
                const items = (plan.items || []).filter(item => !item.deleted);
                const done = items.filter(item => item.status === 'done').length;
                const briefItems = items.slice(0, mode === 'light' ? 5 : 10).map(item => {
                    const spec = item.spec || {};
                    const specText = [spec.sets ? `${spec.sets}组` : '', spec.reps ? `${spec.reps}次` : '', spec.work ? `${spec.work}秒` : '', item.currentLevel ? `L${item.currentLevel}` : '', item.feedback?.rpe ? `RPE${item.feedback.rpe}` : '', item.feedback?.note ? `反馈:${item.feedback.note}` : '', item.aiReasoning ? `原因:${item.aiReasoning}` : ''].filter(Boolean).join(' ');
                    return `${item.name || '未命名任务'}(${item.status || 'todo'}${specText ? '，' + specText : ''})`;
                }).join('；');
                const title = plan.title && plan.title !== planTypeLabel(plan.type, plan.title) ? `｜标题:${plan.title}` : '';
                return `- ${plan.date}｜${planTypeLabel(plan.type, plan.title)}${title}｜${done}/${items.length}完成｜来源:${plan.source || 'manual'}${plan.notes ? '｜备注:' + plan.notes : ''}${briefItems ? '｜任务:' + briefItems : ''}`;
            }).join('\n');
            const formatWeeklyPlan = () => {
                const labels = [['mon', '周一'], ['tue', '周二'], ['wed', '周三'], ['thu', '周四'], ['fri', '周五'], ['sat', '周六'], ['sun', '周日']];
                const plan = this.db.weeklyPlan || {};
                return labels.map(([key, label]) => {
                    const routine = allRoutines.find(r => r.id === plan[key]);
                    return routine ? `- ${label}｜${routine.name || '未命名方案'}｜${(routine.actions || []).slice(0, 8).map(a => a.name || '未命名').join('、')}` : '';
                }).filter(Boolean).join('\n');
            };
            const formatCurrentActions = () => allActions.filter(a => !a.libOnly).slice(0, mode === 'light' ? 8 : 16).map(a => `- ${a.name || '未命名'}${a.tags?.length ? '｜标签:' + a.tags.join('、') : ''}${a.note ? '｜备注:' + a.note : ''}`).join('\n');
            const formatRoutines = () => allRoutines.slice(0, mode === 'light' ? 5 : 10).map(r => `- ${r.name || '未命名方案'}｜${(r.actions || []).length}个动作｜${(r.actions || []).slice(0, 8).map(a => a.name || '未命名').join('、')}${r.note ? '｜备注:' + r.note : ''}`).join('\n');
            const formatGoalPlans = () => {
                const lines = [];
                if (dietGoal && Object.keys(dietGoal).length) lines.push(`饮食目标:${JSON.stringify(dietGoal)}`);
                if (bodyPlan && Object.keys(bodyPlan).length) lines.push(`身体目标计划:${JSON.stringify(bodyPlan)}`);
                if (weightPlan && Object.keys(weightPlan).length) lines.push(`体重目标计划:${JSON.stringify(weightPlan)}`);
                if (this.db.health?.weeklyGoalSessions) lines.push(`每周训练目标:${this.db.health.weeklyGoalSessions}次`);
                return lines.join('\n');
            };
            const formatReports = list => list.slice(0, mode === 'light' ? 2 : 4).map(r => `- ${r.kind || 'report'}｜${r.periodStart || ''}-${r.periodEnd || ''}｜${r.ai?.summary || r.summary || ''}${r.ai?.highlights?.length ? '｜重点:' + r.ai.highlights.join('、') : ''}${r.ai?.suggestions?.length ? '｜建议:' + r.ai.suggestions.join('、') : ''}`).join('\n');
            const enabledLabels = [contexts.diet && '饮食', contexts.training && '训练', contexts.weight && '体重', contexts.goal && '目标'].filter(Boolean).join('、') || '无';
            const prefResult = window.dataAiTemplates?.buildPromptMessages('advice_general', {}, this.db) || {};
            const focusLine = focus.hasFocus ? `问题重点：${focus.label}。请优先回答这个重点；除非用户明确要求，不要主动展开非重点维度。\n` : '';
            const sys = `当前启用的分析维度：${enabledLabels}。上下文模式：${mode === 'light' ? '轻量' : mode === 'none' ? '仅提问' : '自动'}。${focusLine}未启用的维度不会提供数据，请不要编造，也不要要求用户开启。\n` + (prefResult.messages?.[0]?.content || '');
            const blocks = [`分析范围：${rangeLabel}`, `用户提问：${prompt}`];
            const profile = this.db.health?.profile || {}, profileLines = [];
            const _typeMap = { injury: '运动损伤', chronic: '慢性病', allergy: '过敏', surgery: '手术史', medication: '用药', other: '其他' };
            if (profile.gender || profile.age) profileLines.push(`基础：${profile.gender === 'female' ? '女' : '男'} · ${profile.age || '?'} 岁${this.db.health?.height ? ' · 身高 ' + this.db.health.height + ' cm' : ''}`);
            if (focus.profileMode === 'full' && profile.conditions?.length) { profileLines.push('诊断结果：'); profile.conditions.forEach(c => profileLines.push(`  - [${_typeMap[c.type] || c.type}] ${c.label}${c.severity ? '（' + c.severity + '）' : ''}${c.bodyPart ? '；部位：' + c.bodyPart : ''}${c.avoid?.length ? '；避免：' + c.avoid.join('、') : ''}${c.note ? '；备注：' + c.note : ''}`)); }
            if (focus.profileMode === 'full' && profile.examResults?.length) { profileLines.push('检查结果：'); profile.examResults.forEach(exam => profileLines.push(`  - ${exam.item || '检查'}${exam.date ? '（' + exam.date + '）' : ''}${exam.bodyPart ? '；部位：' + exam.bodyPart : ''}${exam.conditionLabel ? '；关联诊断：' + exam.conditionLabel : ''}${exam.result ? '；结果：' + exam.result : ''}${exam.note ? '；备注：' + exam.note : ''}`)); }
            if (contexts.diet && profile.allergies?.length) profileLines.push(`过敏/不耐受：${profile.allergies.join('、')}`);
            if (contexts.training && profile.preferences?.equipment?.length) profileLines.push(`可用器材：${profile.preferences.equipment.join('、')}`);
            if (contexts.training && profile.preferences?.sports?.length) profileLines.push(`偏好运动：${profile.preferences.sports.join('、')}`);
            if (contexts.training && profile.vitals?.restingHR) profileLines.push(`静息心率：${profile.vitals.restingHR} bpm`);
            if (profileLines.length) blocks.unshift(`【健康档案（必须遵守）】\n${profileLines.join('\n')}`);
            if (mode === 'none') blocks.push('【上下文说明】\n本次仅发送用户问题，不附带训练、饮食、体重或目标记录。');
            if (targetDate && mode !== 'none') blocks.push(`【优先分析日期】\n${targetDate}`);
            if (contexts.training && targetDate) blocks.push(`【该日期训练记录】\n${formatTraining(targetHistory) || '该日期无训练记录'}`);
            if (contexts.diet && targetDate) { blocks.push(`【该日期饮食记录】\n${formatFoods(targetFoods) || '该日期无饮食记录'}`); blocks.push(`【该日期宏量营养】\n蛋白 ${targetMacros.pro.toFixed(1)}g / 碳水 ${targetMacros.carb.toFixed(1)}g / 脂肪 ${targetMacros.fat.toFixed(1)}g`); }
            if (contexts.weight && targetDate) blocks.push(`【该日期体重记录】\n${formatWeights(targetWeights) || '该日期无体重记录'}`);
            const targetExerciseText = formatExerciseLogs(targetExerciseLogs);
            const todayExerciseText = formatExerciseLogs(todayExerciseLogs);
            const rangeExerciseText = formatExerciseLogs(rangeExerciseLogs);
            if (contexts.training && targetDate) blocks.push(`【该日期手动运动】\n${targetExerciseText || '该日期无手动运动记录'}`);
            if (contexts.training && targetDate) blocks.push(`【该日期训练计划】\n${formatDailyPlans(targetDailyPlans) || '该日期无训练计划'}`);
            if (contexts.diet) { blocks.push(`【今日饮食记录】\n${formatFoods(todayFoods) || '今日无饮食记录'}`); blocks.push(`【今日宏量营养】\n摄入 ${todayMacros.cal || 0} kcal · 蛋白 ${todayMacros.pro.toFixed(1)}g / 碳水 ${todayMacros.carb.toFixed(1)}g / 脂肪 ${todayMacros.fat.toFixed(1)}g`); blocks.push(`【${rangeLabel}饮食记录】\n${formatFoods(rangeFoods) || `${rangeLabel}暂无饮食记录`}`); blocks.push(`【${rangeLabel}宏量营养】\n蛋白 ${rangeMacros.pro.toFixed(1)}g / 碳水 ${rangeMacros.carb.toFixed(1)}g / 脂肪 ${rangeMacros.fat.toFixed(1)}g`); }
            if (contexts.training) { blocks.push(`【${rangeLabel}训练记录】\n${formatTraining(rangeHistory) || `${rangeLabel}暂无训练记录`}`); blocks.push(`【${rangeLabel}手动运动】\n${rangeExerciseText || `${rangeLabel}暂无手动运动记录`}`); blocks.push(`【${rangeLabel}训练计划】\n${formatDailyPlans(rangeDailyPlans) || `${rangeLabel}暂无训练计划`}`); blocks.push(`【周计划绑定】\n${formatWeeklyPlan() || '暂无周计划绑定'}`); blocks.push(`【当前动作计划】\n${formatCurrentActions() || '暂无当前动作计划'}`); blocks.push(`【方案库摘要】\n${formatRoutines() || '暂无保存方案'}`); const rehabWeeks = this.activeRecords(this.db.health?.rehabWeekly || []).slice().sort((a, b) => String(b.weekStart || '').localeCompare(String(a.weekStart || '')) || Number(b.updatedAt || 0) - Number(a.updatedAt || 0)).slice(0, mode === 'light' ? 3 : 6); blocks.push(`【近${mode === 'light' ? '3' : '6'}周康复中心处方】\n${formatRehabWeekly(rehabWeeks) || '暂无康复中心处方'}\n规则：优先遵守最近3周；更早处方用于理解长期禁忌、反复疼痛和动作演变。`); }
            if (contexts.weight) { blocks.push(`【${rangeLabel}体重记录】\n${formatWeights(rangeWeights) || `${rangeLabel}暂无体重记录`}`); if (range === 'today' && trendWeights.length) blocks.push(`【近${trendWeights.length}条体重记录（用于趋势分析）】\n${formatWeights(trendWeights)}`); }
            if (contexts.goal) blocks.push(`【目标与计划】\n${formatGoalPlans() || '暂无目标计划'}`);
            if (rangeReports.length) blocks.push(`【近期报告摘要】\n${formatReports(rangeReports)}`);
            const conversation = this.adviceConversationContext(mode === 'none' ? 0 : mode === 'light' ? 2 : 8);
            const activeTemplate = this.getActiveAdviceTemplate?.() || null;
            const structuredScenarios = new Set(['plan_generate', 'weekly_report', 'monthly_report', 'food_parse_text', 'food_parse_image', 'body_goal_plan', 'rehab_weekly_parse', 'food_alias_merge', 'insight_advice']);
            const templateScenario = String(activeTemplate?.scenario || '').trim();
            const templateText = `${activeTemplate?.system || ''}\n${activeTemplate?.user || ''}`;
            const structuredTemplate = structuredScenarios.has(templateScenario) || /只输出严格 JSON|训练日程计划助手|"plans"\s*:|"items"\s*:/.test(templateText);
            const template = activeTemplate && !structuredTemplate ? activeTemplate : null;
            if (template) {
                const vars = this.buildAdviceTemplateVars?.({ prompt, range, blocks, today, todayFoods, todayHistory, todayExerciseLogs, todayExerciseText, todayManualExercises: todayExerciseText, todayWeights, todayDailyPlans, rangeFoods, rangeHistory, rangeExerciseLogs, rangeExerciseText, manualExercises: rangeExerciseText, rangeWeights, rangeDailyPlans, targetExerciseLogs, targetExerciseText, targetManualExercises: targetExerciseText, targetDailyPlans }) || {};
                return [{ role: 'system', content: String(template.system || '').trim() || sys }, ...conversation, { role: 'user', content: this.applyAdviceTemplate?.(template.user || '{prompt}', vars) || blocks.join('\n\n') }];
            }
            return [{ role: 'system', content: sys }, ...conversation, { role: 'user', content: blocks.join('\n\n') }];
        };
        if (requested !== 'auto') return build(requested);
        const full = build('auto');
        const chars = full.reduce((n, m) => n + String(m?.content || '').length, 0);
        const budget = /web|browser|网页|proxy|中转|local|ollama|7b|8b|14b/i.test(String(model || '')) ? 8000 : 18000;
        return chars <= budget ? full : build('light');
    },

    classifyAdviceFailure(error, messages = [], model = '') {
        const raw = String(error?.message || error || ''), lower = raw.toLowerCase(), status = Number(error?.status || raw.match(/AI 请求失败:\s*(\d{3})/)?.[1] || 0);
        const code = String(error?.code || '');
        const body = String(error?.body || '').slice(0, 800);
        const type = code === 'AI_TIMEOUT' ? 'timeout'
            : code === 'NETWORK_ERROR' || /failed to fetch|network|load failed/i.test(raw) ? 'network'
                : status === 429 ? 'rate_limit'
                    : status === 401 || status === 403 ? 'auth'
                        : status === 404 ? 'endpoint'
                            : status >= 500 ? 'upstream'
                                : status >= 400 ? 'request'
                                    : code || 'unknown';
        const contextFail = status === 413 || status === 414 || /context_length|maximum context|token limit|too many tokens|prompt too long|context.*exceed/.test(lower);
        const upstreamFail = [502, 503, 504].includes(status) || /server_error|upstream|bad gateway|gateway|timeout|upsy/.test(lower);
        const info = {
            type,
            status,
            code,
            message: raw.slice(0, 500),
            body,
            requestChars: messages.reduce((n, m) => n + String(m?.content || '').length, 0),
            possibleContextOverflow: contextFail || (upstreamFail && messages.reduce((n, m) => n + String(m?.content || '').length, 0) > Math.min(12000, /web|browser|网页|proxy|中转|local|ollama|7b|8b|14b/i.test(String(model || '')) ? 8000 : 12000)),
            failedAt: new Date().toISOString()
        };
        const content = contextFail ? '当前上下文超过模型限制，建议使用轻量上下文或仅提问重试。'
            : upstreamFail ? (info.possibleContextOverflow ? 'AI 服务返回上游错误，当前上下文较长，可能超过网页转 API 通道能力。' : 'AI 服务暂时不可用，可能是供应商或代理异常。')
                : status === 429 ? 'AI 请求被限流或额度不足，请稍后重试。'
                    : status === 401 || status === 403 ? 'AI 鉴权失败，请检查 API Key。'
                        : status === 404 ? 'AI 接口路径或模型不存在，请检查 Base URL 和模型名称。'
                            : type === 'network' ? '网络连接异常或后台切换导致请求中断，请回到前台后重试。'
                        : 'AI 请求失败，请重试或切换模型。';
        return { content, info };
    },

    renderAdviceErrorRecovery(msg = {}) {
        if (!msg?.error) return '';
        const safeId = this.escapeHtml?.(msg.id || '') || '';
        const safe = this.escapeHtml?.bind(this) || ((value) => String(value ?? ''));
        const info = msg.errorInfo || {};
        const hint = msg.errorInfo?.possibleContextOverflow ? '当前模型通道可能不适合长上下文，建议先用轻量上下文重试。' : '如果仍失败，请稍后重试或切换模型。';
        const rows = [
            ['错误分类', info.type || 'unknown'],
            ['HTTP 状态', info.status || '无'],
            ['提供商', msg.provider || info.provider || '未知'],
            ['模型', msg.model || info.model || '未知'],
            ['请求时间', info.startedAt || msg.at || '未知'],
            ['失败时间', info.failedAt || '未知'],
            ['前后台状态', `${info.visibilityState || 'unknown'}${info.wasBackgrounded ? '，曾切到后台' : ''}${info.pageHidden ? '，触发 pagehide' : ''}`],
            ['请求长度', info.requestChars ? `${info.requestChars} 字符` : '未知']
        ];
        const detailRows = rows.map(([k, v]) => `<div><strong>${safe(k)}</strong><span>${safe(v)}</span></div>`).join('');
        const raw = info.body || info.message || '';
        const details = `<details class="advice-error-details"><summary><span class="material-symbols-rounded">bug_report</span>查看失败详情</summary><div class="advice-error-detail-grid">${detailRows}</div>${raw ? `<pre>${safe(raw)}</pre>` : ''}</details>`;
        return `<div class="advice-error-recovery"><div class="advice-error-hint"><span class="material-symbols-rounded">tips_and_updates</span>${safe(hint)}</div>${details}<div class="advice-error-actions"><button type="button" onclick="data.retryAdviceFrom(0, '${safeId}', 'light')"><span class="material-symbols-rounded">compress</span>轻量重试</button><button type="button" onclick="data.retryAdviceFrom(0, '${safeId}', 'none')"><span class="material-symbols-rounded">short_text</span>仅提问</button><button type="button" onclick="data.openAdviceModelPicker?.()"><span class="material-symbols-rounded">tune</span>切换模型</button></div></div>`;
    },

    async requestAiAdvice(prompt, model) {
        const messages = this.buildAdviceMessages(prompt, model);
        if (!window.ai?.run) return await ai.call(messages, 2400);
        const cached = model ? (ai.models || []).find(item => item.id === model && item.profileId) : null;
        const routeOverride = model ? { profileId: cached?.profileId || ai.cfg.activeProfileId || '', modelId: model } : null;
        return await ai.run({ taskId: 'advice.chat', messages, maxTokens: 2400, routeOverride });
    },
});

if (typeof window !== 'undefined' && window.data) {
    advicePanel.attach(window.data);
}
