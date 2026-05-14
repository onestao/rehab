// @ts-nocheck
Object.assign(advicePanel, {
    parsePromptTargetDate(prompt) {
        const text = String(prompt || '');
        const explicit = text.match(/(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
        if (explicit) {
            return this.dateKey(new Date(Number(explicit[1]), Number(explicit[2]) - 1, Number(explicit[3])));
        }
        const md = text.match(/(\d{1,2})月(\d{1,2})日/);
        if (md) {
            const now = new Date();
            return this.dateKey(new Date(now.getFullYear(), Number(md[1]) - 1, Number(md[2])));
        }
        if (/今天/.test(text)) return this.logicalDateKey();
        if (/昨天/.test(text)) {
            const d = new Date(this.logicalDayStart().getTime() - 86400000);
            return this.dateKey(d);
        }
        return '';
    },

    buildAdviceMessages(prompt, model) {
        const contexts = { diet: true, training: true, weight: true, goal: true, ...(this.adviceContexts || {}) };
        const range = this.adviceRange || 'today';
        const today = this.logicalDateKey();

        const allHistory = this.activeRecords(this.db.history || []);
        const allFoods = this.activeRecords(this.db.health.foodLogs || []);
        const allExerciseLogs = this.activeRecords(this.db.health.exerciseLogs || []);
        const allWeights = this.sortedWeights();

        const rangeHistory = contexts.training ? this.filterByAdviceRange(allHistory, h => this.parseHistoryDate(h.date)) : [];
        const rangeFoods = contexts.diet ? this.filterByAdviceRange(allFoods, f => f.date ? this.dateFromKey(f.date) : null) : [];
        const rangeExerciseLogs = contexts.training ? this.filterByAdviceRange(allExerciseLogs, e => e.date ? this.dateFromKey(e.date) : null) : [];
        const rangeWeights = contexts.weight ? this.filterByAdviceRange(allWeights, w => w.date ? this.dateFromKey(w.date) : null) : [];
        const trendWeights = contexts.weight ? allWeights.slice(-30) : [];

        const todayHistory = contexts.training ? allHistory.filter(h => this.historyDayKey(h) === today) : [];
        const todayFoods = contexts.diet ? allFoods.filter(f => f.date === today) : [];
        const todayExerciseLogs = contexts.training ? allExerciseLogs.filter(e => e.date === today) : [];
        const todayWeights = contexts.weight ? allWeights.filter(w => w.date === today) : [];

        const dietGoal = contexts.goal ? (this.db.health.dietGoal || {}) : {};
        const targetDate = this.parsePromptTargetDate(prompt);

        const sumMacros = list => list.reduce((a, f) => {
            a.cal += Number(f.cal || 0); a.pro += Number(f.pro || 0);
            a.carb += Number(f.carb || 0); a.fat += Number(f.fat || 0);
            return a;
        }, { cal: 0, pro: 0, carb: 0, fat: 0 });

        const todayMacros = sumMacros(todayFoods);
        const rangeMacros = sumMacros(rangeFoods);

        const targetHistory = (targetDate && contexts.training) ? allHistory.filter(h => this.dateKey(this.parseHistoryDate(h.date)) === targetDate) : [];
        const targetFoods = (targetDate && contexts.diet) ? allFoods.filter(f => f.date === targetDate) : [];
        const targetExerciseLogs = (targetDate && contexts.training) ? allExerciseLogs.filter(e => e.date === targetDate) : [];
        const targetWeights = (targetDate && contexts.weight) ? allWeights.filter(w => w.date === targetDate) : [];
        const targetMacros = sumMacros(targetFoods);

        const rangeLabel = { today: '今日', week: '最近7天', month: '最近30天', all: '全部记录' }[range];

        const formatTraining = (list) => list.map(h => {
            const mins = Math.floor(h.duration / 60);
            const secs = h.duration % 60;
            const names = this.historyNames(h).join('、');
            const meta = h.type === 'cardio'
                ? `${Math.round(h.cardio.calories || 0)} kcal · ${h.cardio?.type || h.cardio?.name || '有氧'}`
                : `${h.actions.length}个动作`;
            return `- ${h.date}｜训练时长 ${mins}分${secs}秒｜项目 ${names || '未命名'}｜${meta}`;
        }).join('\n');
        const formatFoods = (list) => list.map(f =>
            `- ${f.date}｜${f.meal === 'breakfast' ? '早餐' : f.meal === 'lunch' ? '午餐' : f.meal === 'dinner' ? '晚餐' : '加餐'}｜${f.name}${f.grams ? ' ' + f.grams + 'g' : ''}｜${f.cal} kcal｜P${Number(f.pro || 0).toFixed(0)} C${Number(f.carb || 0).toFixed(0)} F${Number(f.fat || 0).toFixed(0)}`
        ).join('\n');
        const formatExerciseLogs = (list) => list.map(e => {
            const label = this.exerciseLabel(e.type, e);
            return `- ${e.date}｜${label}｜${e.minutes}分钟｜${e.calories || 0} kcal${e.distance ? `｜${e.distance}km` : ''}`;
        }).join('\n');
        const formatWeights = (list) => list.map(w => `- ${w.date}｜${w.weight.toFixed(1)} kg`).join('\n');

        const enabledLabels = [
            contexts.diet && '饮食', contexts.training && '训练',
            contexts.weight && '体重', contexts.goal && '目标'
        ].filter(Boolean).join('、') || '无';

        const sys = `你是训练与营养健康顾问。基于用户的实际记录回答问题。
当前启用的分析维度：${enabledLabels}。未启用的维度不会提供数据，请不要编造，也不要要求用户开启。
规则：
0. 用户健康档案为最高优先级：在生成任何训练或饮食建议前必须先核对【健康档案】。如果建议涉及档案中标记的避免项或用户过敏/不耐受的食物，必须替换为安全替代方案，并在回答中显式说明（例如"考虑到你的左膝问题，已用臀桥替代深蹲"）。
1. 只能引用下方实际提供的记录，不能凭空编造数据
2. 必须引用至少 2 条具体记录作为证据（如果数据足够）
3. 引用时写出具体日期和内容，例如"5月6日午餐鸡胸肉饭 520 kcal"
4. 如果某一类数据为空或未启用，简要说明，不要笼统说全部不足
5. 优先用短段落和清单表达，不要输出 markdown 表格
6. 如果用户问题提到了某个具体日期，优先分析该日期的数据
7. 回答后给出 1-2 条具体可执行的建议
8. 体重为状态量，进行趋势分析时应综合"近30条体重记录"，不局限于当前分析范围`;

        const blocks = [`分析范围：${rangeLabel}`, `用户提问：${prompt}`];
        const profile = this.db.health?.profile || {};
        const profileLines = [];
        const _typeMap = { injury: '运动损伤', chronic: '慢性病', allergy: '过敏', surgery: '手术史', medication: '用药', other: '其他' };
        if (profile.gender || profile.age) {
            profileLines.push(`基础：${profile.gender === 'female' ? '女' : '男'} · ${profile.age || '?'} 岁${this.db.health?.height ? ' · 身高 ' + this.db.health.height + ' cm' : ''}`);
        }
        if (profile.conditions?.length) {
            profileLines.push('健康状况：');
            profile.conditions.forEach(c => {
                profileLines.push(`  - [${_typeMap[c.type] || c.type}] ${c.label}${c.severity ? '（' + c.severity + '）' : ''}${c.avoid?.length ? '；避免：' + c.avoid.join('、') : ''}${c.note ? '；备注：' + c.note : ''}`);
            });
        }
        if (profile.allergies?.length) profileLines.push(`过敏/不耐受：${profile.allergies.join('、')}`);
        if (profile.preferences?.equipment?.length) profileLines.push(`可用器材：${profile.preferences.equipment.join('、')}`);
        if (profile.preferences?.sports?.length) profileLines.push(`偏好运动：${profile.preferences.sports.join('、')}`);
        if (profile.vitals?.restingHR) profileLines.push(`静息心率：${profile.vitals.restingHR} bpm`);
        if (profileLines.length) {
            blocks.unshift(`【健康档案（必须遵守）】\n${profileLines.join('\n')}`);
        }
        if (targetDate) blocks.push(`【优先分析日期】\n${targetDate}`);
        if (contexts.training && targetDate) blocks.push(`【该日期训练记录】\n${formatTraining(targetHistory) || '该日期无训练记录'}`);
        if (contexts.diet && targetDate) {
            blocks.push(`【该日期饮食记录】\n${formatFoods(targetFoods) || '该日期无饮食记录'}`);
            blocks.push(`【该日期宏量营养】\n蛋白 ${targetMacros.pro.toFixed(1)}g / 碳水 ${targetMacros.carb.toFixed(1)}g / 脂肪 ${targetMacros.fat.toFixed(1)}g`);
        }
        if (contexts.weight && targetDate) blocks.push(`【该日期体重记录】\n${formatWeights(targetWeights) || '该日期无体重记录'}`);
        if (contexts.training && targetDate) blocks.push(`【该日期手动运动】\n${formatExerciseLogs(targetExerciseLogs) || '该日期无手动运动记录'}`);
        if (contexts.diet) {
            blocks.push(`【今日饮食记录】\n${formatFoods(todayFoods) || '今日无饮食记录'}`);
            blocks.push(`【今日宏量营养】\n摄入 ${todayMacros.cal || 0} kcal · 蛋白 ${todayMacros.pro.toFixed(1)}g / 碳水 ${todayMacros.carb.toFixed(1)}g / 脂肪 ${todayMacros.fat.toFixed(1)}g`);
            blocks.push(`【${rangeLabel}饮食记录】\n${formatFoods(rangeFoods) || `${rangeLabel}暂无饮食记录`}`);
            blocks.push(`【${rangeLabel}宏量营养】\n蛋白 ${rangeMacros.pro.toFixed(1)}g / 碳水 ${rangeMacros.carb.toFixed(1)}g / 脂肪 ${rangeMacros.fat.toFixed(1)}g`);
        }
        if (contexts.training) {
            blocks.push(`【${rangeLabel}训练记录】\n${formatTraining(rangeHistory) || `${rangeLabel}暂无训练记录`}`);
            blocks.push(`【${rangeLabel}手动运动】\n${formatExerciseLogs(rangeExerciseLogs) || `${rangeLabel}暂无手动运动记录`}`);
        }
        if (contexts.weight) {
            blocks.push(`【${rangeLabel}体重记录】\n${formatWeights(rangeWeights) || `${rangeLabel}暂无体重记录`}`);
            if (range === 'today' && trendWeights.length) {
                blocks.push(`【近30条体重记录（用于趋势分析）】\n${formatWeights(trendWeights)}`);
            }
        }
        if (contexts.goal && dietGoal.dailyCal) {
            blocks.push(`【饮食目标】\n每日 ${dietGoal.dailyCal} kcal · 目标类型：${dietGoal.goalType === 'gain' ? '增肌' : '减重'}`);
        }

        const conversation = this.adviceConversationContext();
        return [{ role: 'system', content: sys }, ...conversation, { role: 'user', content: blocks.join('\n\n') }];
    },

    async requestAiAdvice(prompt, model) {
        const messages = this.buildAdviceMessages(prompt, model);
        const oldModel = ai.cfg.model;
        ai.cfg.model = model;
        try {
            return await ai.call(messages, 2400);
        } finally {
            ai.cfg.model = oldModel;
        }
    },
});
