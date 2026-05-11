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
        if (/今天/.test(text)) return this.dateKey(new Date());
        if (/昨天/.test(text)) {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            return this.dateKey(d);
        }
        return '';
    },

    buildAdviceMessages(prompt, model) {
        const contexts = { diet: true, training: true, weight: true, goal: true, ...(this.adviceContexts || {}) };
        const range = this.adviceRange || 'today';
        const today = this.dateKey(new Date());

        const allHistory = this.db.history || [];
        const allFoods = this.db.health.foodLogs || [];
        const allExerciseLogs = this.db.health.exerciseLogs || [];
        const allWeights = this.sortedWeights();

        const rangeHistory = contexts.training ? this.filterByAdviceRange(allHistory, h => this.parseHistoryDate(h.date)) : [];
        const rangeFoods = contexts.diet ? this.filterByAdviceRange(allFoods, f => f.date ? new Date(f.date) : null) : [];
        const rangeExerciseLogs = contexts.training ? this.filterByAdviceRange(allExerciseLogs, e => e.date ? new Date(e.date) : null) : [];
        const rangeWeights = contexts.weight ? this.filterByAdviceRange(allWeights, w => w.date ? new Date(w.date) : null) : [];

        const todayHistory = allHistory.filter(h => this.dateKey(this.parseHistoryDate(h.date)) === today);
        const todayFoods = allFoods.filter(f => f.date === today);
        const todayExerciseLogs = allExerciseLogs.filter(e => e.date === today);
        const todayWeights = allWeights.filter(w => w.date === today);

        const dietGoal = contexts.goal ? (this.db.health.dietGoal || {}) : {};
        const targetDate = this.parsePromptTargetDate(prompt);

        const todayMacros = contexts.diet
            ? todayFoods.reduce((acc, f) => {
                acc.cal += Number(f.cal || 0);
                acc.pro += Number(f.pro || 0);
                acc.carb += Number(f.carb || 0);
                acc.fat += Number(f.fat || 0);
                return acc;
            }, { cal: 0, pro: 0, carb: 0, fat: 0 })
            : { cal: 0, pro: 0, carb: 0, fat: 0 };

        const rangeMacros = contexts.diet
            ? rangeFoods.reduce((acc, f) => {
                acc.pro += Number(f.pro || 0);
                acc.carb += Number(f.carb || 0);
                acc.fat += Number(f.fat || 0);
                return acc;
            }, { pro: 0, carb: 0, fat: 0 })
            : {};

        const targetHistory = targetDate ? allHistory.filter(h => this.dateKey(this.parseHistoryDate(h.date)) === targetDate) : [];
        const targetFoods = targetDate ? allFoods.filter(f => f.date === targetDate) : [];
        const targetExerciseLogs = targetDate ? allExerciseLogs.filter(e => e.date === targetDate) : [];
        const targetWeights = targetDate ? allWeights.filter(w => w.date === targetDate) : [];
        const targetMacros = contexts.diet
            ? targetFoods.reduce((acc, f) => {
                acc.pro += Number(f.pro || 0);
                acc.carb += Number(f.carb || 0);
                acc.fat += Number(f.fat || 0);
                return acc;
            }, { pro: 0, carb: 0, fat: 0 })
            : { pro: 0, carb: 0, fat: 0 };
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

        const formatWeights = (list) => list.map(w =>
            `- ${w.date}｜${w.weight.toFixed(1)} kg`
        ).join('\n');

        const sys = `你是训练与营养健康顾问。基于用户的实际记录回答问题。规则：
1. 如果下方提供了训练/饮食/体重记录，你必须优先基于这些记录分析，不能忽略它们，也不能说"暂无记录"
2. 必须引用至少 2 条具体的训练/饮食/体重记录作为证据
3. 引用时请写出具体日期和内容，例如"5月6日午餐鸡胸肉饭 520 kcal"
3. 如果某一类数据确实为空，再说明该类数据不足，不要笼统说全部记录不足
4. 优先用短段落和清单表达，不要输出 markdown 表格
5. 如果用户问题提到了某个具体日期，你必须优先分析该日期的数据，再结合近期整体趋势补充
6. 回答后可给出 1-2 条具体可执行的建议`;

        const user = `分析范围：${rangeLabel}
用户提问：${prompt}

【优先分析日期】
${targetDate || '未指定具体日期'}

【该日期训练记录】
${formatTraining(targetHistory) || '该日期无训练记录'}

【该日期饮食记录】
${formatFoods(targetFoods) || '该日期无饮食记录'}

【该日期宏量营养】
蛋白 ${targetMacros.pro?.toFixed(1) || 0}g / 碳水 ${targetMacros.carb?.toFixed(1) || 0}g / 脂肪 ${targetMacros.fat?.toFixed(1) || 0}g

【该日期体重记录】
${formatWeights(targetWeights) || '该日期无体重记录'}

【该日期手动运动】
${formatExerciseLogs(targetExerciseLogs) || '该日期无手动运动记录'}

【今日饮食记录】
${formatFoods(todayFoods) || '今日无饮食记录'}

【今日宏量营养】
摄入 ${todayMacros.cal || 0} kcal · 蛋白 ${todayMacros.pro?.toFixed(1) || 0}g / 碳水 ${todayMacros.carb?.toFixed(1) || 0}g / 脂肪 ${todayMacros.fat?.toFixed(1) || 0}g

【${rangeLabel}训练记录】
${formatTraining(rangeHistory) || `${rangeLabel}暂无训练记录`}

【${rangeLabel}饮食记录】
${formatFoods(rangeFoods) || `${rangeLabel}暂无饮食记录`}

【${rangeLabel}宏量营养】
蛋白 ${rangeMacros.pro?.toFixed(1) || 0}g / 碳水 ${rangeMacros.carb?.toFixed(1) || 0}g / 脂肪 ${rangeMacros.fat?.toFixed(1) || 0}g

【饮食目标】
${dietGoal.dailyCal ? `每日 ${dietGoal.dailyCal} kcal · 目标类型：${dietGoal.goalType === 'gain' ? '增肌' : '减重'}` : '未设置'}

【${rangeLabel}体重记录】
${formatWeights(rangeWeights) || `${rangeLabel}暂无体重记录`}

【${rangeLabel}手动运动】
${formatExerciseLogs(rangeExerciseLogs) || `${rangeLabel}暂无手动运动记录`}`;

        const conversation = this.adviceConversationContext();
        return [{ role: 'system', content: sys }, ...conversation, { role: 'user', content: user }];
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
