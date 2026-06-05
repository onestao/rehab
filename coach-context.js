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

    buildAdviceMessages(prompt, model, options = {}) {
        const rawMode = options.contextMode || this.adviceContextMode || 'auto';
        const requested = ['auto', 'light', 'none'].includes(rawMode) ? rawMode : 'auto';
        const build = (mode) => {
            const contexts = mode === 'none' ? { diet: false, training: false, weight: false, goal: false } : { diet: true, training: true, weight: true, goal: true, ...(this.adviceContexts || {}) };
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

            const rangeHistory = contexts.training ? rangeFilter(allHistory, h => this.parseHistoryDate(h.date)) : [];
            const rangeFoods = contexts.diet ? rangeFilter(allFoods, f => f.date ? this.dateFromKey(f.date) : null) : [];
            const rangeExerciseLogs = contexts.training ? rangeFilter(allExerciseLogs, e => e.date ? this.dateFromKey(e.date) : null) : [];
            const rangeWeights = contexts.weight ? rangeFilter(allWeights, w => w.date ? this.dateFromKey(w.date) : null) : [];
            const trendWeights = contexts.weight ? allWeights.slice(mode === 'light' ? -10 : -30) : [];
            const todayHistory = contexts.training ? allHistory.filter(h => this.historyDayKey(h) === today) : [];
            const todayFoods = contexts.diet ? allFoods.filter(f => f.date === today) : [];
            const todayExerciseLogs = contexts.training ? allExerciseLogs.filter(e => e.date === today) : [];
            const todayWeights = contexts.weight ? allWeights.filter(w => w.date === today) : [];
            const dietGoal = contexts.goal ? (this.db.health.dietGoal || {}) : {};
            const targetDate = this.parsePromptTargetDate(prompt);
            const sumMacros = list => list.reduce((a, f) => { a.cal += Number(f.cal || 0); a.pro += Number(f.pro || 0); a.carb += Number(f.carb || 0); a.fat += Number(f.fat || 0); return a; }, { cal: 0, pro: 0, carb: 0, fat: 0 });
            const todayMacros = sumMacros(todayFoods);
            const rangeMacros = sumMacros(rangeFoods);
            const targetHistory = (targetDate && contexts.training) ? allHistory.filter(h => this.dateKey(this.parseHistoryDate(h.date)) === targetDate) : [];
            const targetFoods = (targetDate && contexts.diet) ? allFoods.filter(f => f.date === targetDate) : [];
            const targetExerciseLogs = (targetDate && contexts.training) ? allExerciseLogs.filter(e => e.date === targetDate) : [];
            const targetWeights = (targetDate && contexts.weight) ? allWeights.filter(w => w.date === targetDate) : [];
            const targetMacros = sumMacros(targetFoods);
            const rangeLabel = { today: '今日', week: '最近7天', month: '最近30天', all: '全部记录' }[range];
            const formatTraining = list => list.map(h => {
                const mins = Math.floor(h.duration / 60), secs = h.duration % 60, names = this.historyNames(h).join('、');
                const meta = h.type === 'cardio' ? `${Math.round(h.cardio.calories || 0)} kcal · ${h.cardio?.type || h.cardio?.name || '有氧'}` : `${h.actions.length}个动作`;
                return `- ${h.date}｜训练时长 ${mins}分${secs}秒｜项目 ${names || '未命名'}｜${meta}`;
            }).join('\n');
            const formatFoods = list => list.map(f => `- ${f.date}｜${f.meal === 'breakfast' ? '早餐' : f.meal === 'lunch' ? '午餐' : f.meal === 'dinner' ? '晚餐' : '加餐'}｜${f.name}${f.grams ? ' ' + f.grams + 'g' : ''}｜${f.cal} kcal｜P${Number(f.pro || 0).toFixed(0)} C${Number(f.carb || 0).toFixed(0)} F${Number(f.fat || 0).toFixed(0)}`).join('\n');
            const formatExerciseLogs = list => list.map(e => `- ${e.date}｜${this.exerciseLabel(e.type, e)}｜${e.minutes}分钟｜${e.calories || 0} kcal${e.distance ? `｜${e.distance}km` : ''}`).join('\n');
            const formatWeights = list => list.map(w => `- ${w.date}｜${w.weight.toFixed(2)} kg`).join('\n');
            const formatRehabWeekly = list => list.map(week => {
                const actions = (week.actions || []).map(a => `${a.name || '未命名'}（${a.status || 'continued'}${a.painLevel ? `，疼痛${a.painLevel}/10` : ''}${a.needsReview ? '，需确认' : ''}${a.coachNote ? '，' + a.coachNote : ''}）`).join('；');
                return `- ${week.weekStart || week.visitDate || ''}｜${actions || '无动作明细'}${week.therapistAssessment ? '｜评估：' + week.therapistAssessment : ''}`;
            }).join('\n');
            const enabledLabels = [contexts.diet && '饮食', contexts.training && '训练', contexts.weight && '体重', contexts.goal && '目标'].filter(Boolean).join('、') || '无';
            const prefResult = window.dataAiTemplates?.buildPromptMessages('advice_general', {}, this.db) || {};
            const sys = `当前启用的分析维度：${enabledLabels}。上下文模式：${mode === 'light' ? '轻量' : mode === 'none' ? '仅提问' : '自动'}。未启用的维度不会提供数据，请不要编造，也不要要求用户开启。\n` + (prefResult.messages?.[0]?.content || '');
            const blocks = [`分析范围：${rangeLabel}`, `用户提问：${prompt}`];
            const profile = this.db.health?.profile || {}, profileLines = [];
            const _typeMap = { injury: '运动损伤', chronic: '慢性病', allergy: '过敏', surgery: '手术史', medication: '用药', other: '其他' };
            if (profile.gender || profile.age) profileLines.push(`基础：${profile.gender === 'female' ? '女' : '男'} · ${profile.age || '?'} 岁${this.db.health?.height ? ' · 身高 ' + this.db.health.height + ' cm' : ''}`);
            if (profile.conditions?.length) { profileLines.push('健康状况：'); profile.conditions.forEach(c => profileLines.push(`  - [${_typeMap[c.type] || c.type}] ${c.label}${c.severity ? '（' + c.severity + '）' : ''}${c.avoid?.length ? '；避免：' + c.avoid.join('、') : ''}${c.note ? '；备注：' + c.note : ''}`)); }
            if (profile.allergies?.length) profileLines.push(`过敏/不耐受：${profile.allergies.join('、')}`);
            if (profile.preferences?.equipment?.length) profileLines.push(`可用器材：${profile.preferences.equipment.join('、')}`);
            if (profile.preferences?.sports?.length) profileLines.push(`偏好运动：${profile.preferences.sports.join('、')}`);
            if (profile.vitals?.restingHR) profileLines.push(`静息心率：${profile.vitals.restingHR} bpm`);
            if (profileLines.length) blocks.unshift(`【健康档案（必须遵守）】\n${profileLines.join('\n')}`);
            if (mode === 'none') blocks.push('【上下文说明】\n本次仅发送用户问题，不附带训练、饮食、体重或目标记录。');
            if (targetDate && mode !== 'none') blocks.push(`【优先分析日期】\n${targetDate}`);
            if (contexts.training && targetDate) blocks.push(`【该日期训练记录】\n${formatTraining(targetHistory) || '该日期无训练记录'}`);
            if (contexts.diet && targetDate) { blocks.push(`【该日期饮食记录】\n${formatFoods(targetFoods) || '该日期无饮食记录'}`); blocks.push(`【该日期宏量营养】\n蛋白 ${targetMacros.pro.toFixed(1)}g / 碳水 ${targetMacros.carb.toFixed(1)}g / 脂肪 ${targetMacros.fat.toFixed(1)}g`); }
            if (contexts.weight && targetDate) blocks.push(`【该日期体重记录】\n${formatWeights(targetWeights) || '该日期无体重记录'}`);
            if (contexts.training && targetDate) blocks.push(`【该日期手动运动】\n${formatExerciseLogs(targetExerciseLogs) || '该日期无手动运动记录'}`);
            if (contexts.diet) { blocks.push(`【今日饮食记录】\n${formatFoods(todayFoods) || '今日无饮食记录'}`); blocks.push(`【今日宏量营养】\n摄入 ${todayMacros.cal || 0} kcal · 蛋白 ${todayMacros.pro.toFixed(1)}g / 碳水 ${todayMacros.carb.toFixed(1)}g / 脂肪 ${todayMacros.fat.toFixed(1)}g`); blocks.push(`【${rangeLabel}饮食记录】\n${formatFoods(rangeFoods) || `${rangeLabel}暂无饮食记录`}`); blocks.push(`【${rangeLabel}宏量营养】\n蛋白 ${rangeMacros.pro.toFixed(1)}g / 碳水 ${rangeMacros.carb.toFixed(1)}g / 脂肪 ${rangeMacros.fat.toFixed(1)}g`); }
            if (contexts.training) { blocks.push(`【${rangeLabel}训练记录】\n${formatTraining(rangeHistory) || `${rangeLabel}暂无训练记录`}`); blocks.push(`【${rangeLabel}手动运动】\n${formatExerciseLogs(rangeExerciseLogs) || `${rangeLabel}暂无手动运动记录`}`); const rehabWeeks = this.activeRecords(this.db.health?.rehabWeekly || []).slice().sort((a, b) => String(b.weekStart || '').localeCompare(String(a.weekStart || '')) || Number(b.updatedAt || 0) - Number(a.updatedAt || 0)).slice(0, mode === 'light' ? 3 : 6); blocks.push(`【近${mode === 'light' ? '3' : '6'}周康复中心处方】\n${formatRehabWeekly(rehabWeeks) || '暂无康复中心处方'}\n规则：优先遵守最近3周；更早处方用于理解长期禁忌、反复疼痛和动作演变。`); }
            if (contexts.weight) { blocks.push(`【${rangeLabel}体重记录】\n${formatWeights(rangeWeights) || `${rangeLabel}暂无体重记录`}`); if (range === 'today' && trendWeights.length) blocks.push(`【近${trendWeights.length}条体重记录（用于趋势分析）】\n${formatWeights(trendWeights)}`); }
            if (contexts.goal && dietGoal.dailyCal) blocks.push(`【饮食目标】\n每日 ${dietGoal.dailyCal} kcal · 目标类型：${dietGoal.goalType === 'gain' ? '增肌' : '减重'}`);
            const conversation = this.adviceConversationContext(mode === 'none' ? 0 : mode === 'light' ? 2 : 8);
            const template = this.getActiveAdviceTemplate?.() || null;
            if (template) {
                const vars = this.buildAdviceTemplateVars?.({ prompt, range, blocks, today, todayFoods, todayHistory, todayExerciseLogs, todayWeights, rangeFoods, rangeHistory, rangeExerciseLogs, rangeWeights }) || {};
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
        const raw = String(error?.message || error || ''), lower = raw.toLowerCase(), status = Number(raw.match(/AI 请求失败:\s*(\d{3})/)?.[1] || 0);
        const contextFail = status === 413 || status === 414 || /context_length|maximum context|token limit|too many tokens|prompt too long|context.*exceed/.test(lower);
        const upstreamFail = [502, 503, 504].includes(status) || /server_error|upstream|bad gateway|gateway|timeout|upsy/.test(lower);
        const info = { possibleContextOverflow: contextFail || (upstreamFail && messages.reduce((n, m) => n + String(m?.content || '').length, 0) > Math.min(12000, /web|browser|网页|proxy|中转|local|ollama|7b|8b|14b/i.test(String(model || '')) ? 8000 : 12000)) };
        const content = contextFail ? '当前上下文超过模型限制，建议使用轻量上下文或仅提问重试。'
            : upstreamFail ? (info.possibleContextOverflow ? 'AI 服务返回上游错误，当前上下文较长，可能超过网页转 API 通道能力。' : 'AI 服务暂时不可用，可能是供应商或代理异常。')
                : status === 429 ? 'AI 请求被限流或额度不足，请稍后重试。'
                    : status === 401 || status === 403 ? 'AI 鉴权失败，请检查 API Key。'
                        : 'AI 请求失败，请重试或切换模型。';
        return { content, info };
    },

    renderAdviceErrorRecovery(msg = {}) {
        if (!msg?.error) return '';
        const safeId = this.escapeHtml?.(msg.id || '') || '';
        const hint = msg.errorInfo?.possibleContextOverflow ? '当前模型通道可能不适合长上下文，建议先用轻量上下文重试。' : '如果仍失败，请稍后重试或切换模型。';
        return `<div class="advice-error-recovery"><div class="advice-error-hint"><span class="material-symbols-rounded">tips_and_updates</span>${this.escapeHtml?.(hint) || hint}</div><div class="advice-error-actions"><button type="button" onclick="data.retryAdviceFrom(0, '${safeId}', 'light')"><span class="material-symbols-rounded">compress</span>轻量重试</button><button type="button" onclick="data.retryAdviceFrom(0, '${safeId}', 'none')"><span class="material-symbols-rounded">short_text</span>仅提问</button><button type="button" onclick="data.openAdviceModelPicker?.()"><span class="material-symbols-rounded">tune</span>切换模型</button></div></div>`;
    },

    async requestAiAdvice(prompt, model) {
        const messages = this.buildAdviceMessages(prompt, model);
        const oldOverride = ai.overrideModel;
        if (model) ai.setOverride?.({ model });
        try {
            return await ai.call(messages, 2400);
        } finally {
            ai.overrideModel = oldOverride || null;
        }
    },
});

if (typeof window !== 'undefined' && window.data) {
    advicePanel.attach(window.data);
}
