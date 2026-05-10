const advicePanel = {
    DRAFT_KEY: 'rehab_advice_draft',
    SETTINGS_KEY: 'rehab_advice_settings',
    MODEL_ICONS: {
        openai: 'assets/model-icons/openai.svg',
        gemini: 'assets/model-icons/gemini.svg',
        grok: 'assets/model-icons/grok.svg',
        deepseek: 'assets/model-icons/deepseek.svg',
        claude: 'assets/model-icons/claude.svg',
        qwen: 'assets/model-icons/qwen.svg',
        doubao: 'assets/model-icons/doubao.svg',
        kimi: 'assets/model-icons/kimi.svg',
        minimax: 'assets/model-icons/minimax.svg',
        mimo: 'assets/model-icons/mimo.svg',
        glm: 'assets/model-icons/glm.svg',
        generic: 'assets/model-icons/generic.svg'
    },

    attach(target) {
        Object.assign(target, {
            DRAFT_KEY: this.DRAFT_KEY,
            SETTINGS_KEY: this.SETTINGS_KEY,
            MODEL_ICONS: this.MODEL_ICONS,
            sendAiAdvice: this.sendAiAdvice,
            requestAiAdvice: this.requestAiAdvice,
            deleteAiAdviceMessage: this.deleteAiAdviceMessage,
            copyAdviceMessage: this.copyAdviceMessage,
            retryAdviceFrom: this.retryAdviceFrom,
            captureAdviceDraft: this.captureAdviceDraft,
            restoreAdviceDraft: this.restoreAdviceDraft,
            clearAdviceDraft: this.clearAdviceDraft,
            loadAdviceSettings: this.loadAdviceSettings,
            saveAdviceSettings: this.saveAdviceSettings,
            onAdvicePromptInput: this.onAdvicePromptInput,
            onAdvicePromptKeydown: this.onAdvicePromptKeydown,
            setAdviceModel: this.setAdviceModel,
            setAdviceRange: this.setAdviceRange,
            toggleAdviceContext: this.toggleAdviceContext,
            toggleAdviceSearch: this.toggleAdviceSearch,
            onAdviceSearchInput: this.onAdviceSearchInput,
            clearAdviceSearch: this.clearAdviceSearch,
            useAdvicePrompt: this.useAdvicePrompt,
            scrollAdviceToLatest: this.scrollAdviceToLatest,
            scheduleAdviceStreamScroll: this.scheduleAdviceStreamScroll,
            refreshAdviceSearchResults: this.refreshAdviceSearchResults,
            refreshAdviceModelPicker: this.refreshAdviceModelPicker,
            autoResizeAdvicePrompt: this.autoResizeAdvicePrompt,
            adviceRangeStart: this.adviceRangeStart,
            filterByAdviceRange: this.filterByAdviceRange,
            visibleAdviceMessages: this.visibleAdviceMessages,
            adviceMessageSummary: this.adviceMessageSummary,
            detectAdviceModelProvider: this.detectAdviceModelProvider,
            adviceModelVisual: this.adviceModelVisual,
            adviceConversationContext: this.adviceConversationContext,
            buildAdviceMessages: this.buildAdviceMessages,
            parsePromptTargetDate: this.parsePromptTargetDate,
            preserveAdviceScroll: this.preserveAdviceScroll,
            renderAdviceMarkdown: this.renderAdviceMarkdown,
            renderAdviceMessages: this.renderAdviceMessages,
            renderAdviceMessage: this.renderAdviceMessage,
            renderAdvicePanel: this.renderAdvicePanel
        });

        target.loadAdviceSettings?.();
    },

    loadAdviceSettings() {
        try {
            const raw = localStorage.getItem(this.SETTINGS_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return;

            const allowedRanges = new Set(['today', 'week', 'month', 'all']);
            if (typeof parsed.range === 'string' && allowedRanges.has(parsed.range)) {
                this.adviceRange = parsed.range;
            }

            if (parsed.contexts && typeof parsed.contexts === 'object') {
                const next = { ...(this.adviceContexts || {}) };
                ['diet', 'training', 'weight', 'goal'].forEach(k => {
                    if (typeof parsed.contexts[k] === 'boolean') next[k] = parsed.contexts[k];
                });
                this.adviceContexts = next;
            }

            if (typeof parsed.model === 'string' && parsed.model.trim()) {
                this.adviceModel = parsed.model;
            }
        } catch {
            // ignore
        }
    },

    saveAdviceSettings() {
        try {
            const contexts = { diet: true, training: true, weight: true, goal: true, ...(this.adviceContexts || {}) };
            const payload = {
                range: this.adviceRange || 'today',
                contexts: {
                    diet: !!contexts.diet,
                    training: !!contexts.training,
                    weight: !!contexts.weight,
                    goal: !!contexts.goal
                },
                model: this.adviceModel || '__current__'
            };
            localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(payload));
        } catch {
            // ignore
        }
    },

    captureAdviceDraft() {
        const input = document.getElementById('advicePrompt');
        if (!input) return;
        this._adviceDraft = input.value;
        try { sessionStorage.setItem(this.DRAFT_KEY, input.value); } catch {}
    },

    restoreAdviceDraft() {
        if (typeof this._adviceDraft === 'string') return this._adviceDraft;
        try { return sessionStorage.getItem(this.DRAFT_KEY) || ''; } catch { return ''; }
    },

    clearAdviceDraft() {
        this._adviceDraft = '';
        try { sessionStorage.removeItem(this.DRAFT_KEY); } catch {}
    },

    onAdvicePromptInput(el) {
        this._adviceDraft = el.value;
        try { sessionStorage.setItem(this.DRAFT_KEY, el.value); } catch {}
        this.autoResizeAdvicePrompt(el);
        const send = document.getElementById('adviceSendBtn');
        if (send) send.disabled = !el.value.trim() || !!this._adviceSending;
    },

    onAdvicePromptKeydown(e) {
        if (e.isComposing) return;
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendAiAdvice();
        }
    },

    autoResizeAdvicePrompt(el = document.getElementById('advicePrompt')) {
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    },

    setAdviceModel(model) {
        this.adviceModel = model || '__current__';
        this.saveAdviceSettings();
        this.captureAdviceDraft();
        this.refreshAdviceModelPicker();
    },

    detectAdviceModelProvider(model = '') {
        const text = String(model || '').toLowerCase();
        if (/grok|x-ai|\bxai\b/.test(text)) return { key: 'grok', label: 'Grok', mark: 'G' };
        if (/gemini|google/.test(text)) return { key: 'gemini', label: 'Gemini', mark: 'Gem' };
        if (/deepseek/.test(text)) return { key: 'deepseek', label: 'DeepSeek', mark: 'DS' };
        if (/claude|anthropic/.test(text)) return { key: 'claude', label: 'Claude', mark: 'C' };
        if (/qwen|通义|tongyi/.test(text)) return { key: 'qwen', label: 'Qwen', mark: 'Q' };
        if (/doubao|豆包|volc|火山/.test(text)) return { key: 'doubao', label: '豆包', mark: '豆' };
        if (/kimi|moonshot|moon/.test(text)) return { key: 'kimi', label: 'Kimi', mark: 'K' };
        if (/minimax/.test(text)) return { key: 'minimax', label: 'MiniMax', mark: 'MM' };
        if (/mimo/.test(text)) return { key: 'mimo', label: 'Mimo', mark: 'Mi' };
        if (/glm|chatglm|zhipu|智谱/.test(text)) return { key: 'glm', label: 'GLM', mark: 'GLM' };
        if (/gpt|openai|chatgpt|\bo[134]\b|o1|o3|o4/.test(text)) return { key: 'openai', label: 'OpenAI', mark: 'GPT' };
        return { key: 'generic', label: 'AI 模型', mark: 'AI' };
    },

    adviceModelVisual(model = '') {
        const provider = this.detectAdviceModelProvider(model);
        const icon = this.MODEL_ICONS?.[provider.key] || this.MODEL_ICONS?.generic || '';
        return { ...provider, icon };
    },

    refreshAdviceModelPicker() {
        const picker = document.querySelector('.advice-model-picker');
        const mark = picker?.querySelector('.advice-model-mark');
        if (!picker || !mark) return;
        const select = document.getElementById('adviceModel');
        const selected = select?.value || this.adviceModel || '__current__';
        const option = select?.selectedOptions?.[0];
        const activeModelValue = selected === '__current__' ? ai.cfg.model : (option?.textContent || selected);
        const visual = this.adviceModelVisual(activeModelValue);
        picker.className = `advice-model-picker advice-model-${visual.key}`;
        picker.title = `切换分析模型：${visual.label}`;
        picker.setAttribute('aria-label', `切换分析模型：${visual.label}`);
        mark.innerHTML = visual.icon
            ? `<img class="advice-model-icon" src="${visual.icon}" alt="">`
            : this.escapeHtml(visual.mark);
    },

    toggleAdviceSearch() {
        const shouldOpen = !(this.adviceSearchOpen || this.adviceSearchQuery);
        this.adviceSearchOpen = shouldOpen;
        if (!shouldOpen) this.adviceSearchQuery = '';
        this.captureAdviceDraft();
        this.renderAiCoachPage?.() || this.renderRoutines?.();
        requestAnimationFrame(() => {
            this.autoResizeAdvicePrompt();
            const input = document.getElementById('adviceSearchInput');
            if (this.adviceSearchOpen && input) input.focus();
        });
    },

    onAdviceSearchInput(el) {
        this.adviceSearchQuery = el?.value || '';
        this.captureAdviceDraft();
        this.refreshAdviceSearchResults();
    },

    clearAdviceSearch() {
        this.adviceSearchQuery = '';
        this.adviceSearchOpen = false;
        this.captureAdviceDraft();
        this.renderAiCoachPage?.() || this.renderRoutines?.();
        requestAnimationFrame(() => this.autoResizeAdvicePrompt());
    },

    refreshAdviceSearchResults() {
        const list = document.querySelector('.advice-chat-list');
        const summary = document.getElementById('adviceMessageSummary');
        if (!list) return;
        const messages = this.db.health.aiAdviceChat || [];
        const visibleMessages = this.visibleAdviceMessages(messages);
        list.innerHTML = this.renderAdviceMessages(visibleMessages);
        if (summary) summary.textContent = this.adviceMessageSummary(messages, visibleMessages);
    },

    setAdviceRange(range) {
        this.adviceRange = range || 'today';
        this.saveAdviceSettings();
        this.captureAdviceDraft();
        this.renderAiCoachPage?.() || this.renderRoutines?.();
        requestAnimationFrame(() => this.autoResizeAdvicePrompt());
    },

    toggleAdviceContext(key) {
        this.adviceContexts = { diet: true, training: true, weight: true, goal: true, ...(this.adviceContexts || {}) };
        this.adviceContexts[key] = !this.adviceContexts[key];
        this.saveAdviceSettings();
        this.captureAdviceDraft();
        this.renderAiCoachPage?.() || this.renderRoutines?.();
        requestAnimationFrame(() => this.autoResizeAdvicePrompt());
    },

    useAdvicePrompt(text) {
        const input = document.getElementById('advicePrompt');
        if (!input) return;
        input.value = text;
        this.onAdvicePromptInput(input);
        input.focus();
    },

    adviceRangeStart(range = this.adviceRange || 'today') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        if (range === 'week') start.setDate(start.getDate() - 6);
        if (range === 'month') start.setDate(start.getDate() - 29);
        if (range === 'all') return null;
        return start;
    },

    filterByAdviceRange(items, getDate) {
        const start = this.adviceRangeStart();
        if (!start) return items;
        return items.filter(item => {
            const date = getDate(item);
            return date && date >= start;
        });
    },

    visibleAdviceMessages(messages = []) {
        const withIndex = messages.map((msg, idx) => ({ ...msg, idx }));
        const start = this.adviceRangeStart();
        const ranged = start ? withIndex.filter(msg => this.parseHistoryDate(msg.at) >= start) : withIndex;
        const query = String(this.adviceSearchQuery || '').trim().toLowerCase();
        if (!query) return ranged;
        const matched = new Set();
        ranged.forEach((msg, localIdx) => {
            const date = this.dateKey(this.parseHistoryDate(msg.at));
            const haystack = `${msg.content || ''} ${msg.model || ''} ${msg.role || ''} ${date}`.toLowerCase();
            if (!haystack.includes(query)) return;
            matched.add(localIdx);
            if (msg.role === 'assistant' && localIdx > 0) matched.add(localIdx - 1);
            if (msg.role === 'user' && localIdx + 1 < ranged.length) matched.add(localIdx + 1);
        });
        return ranged.filter((_, localIdx) => matched.has(localIdx));
    },

    adviceMessageSummary(messages, visibleMessages) {
        const rangeLabel = { today: '今日', week: '最近7天', month: '最近30天', all: '全部' }[this.adviceRange || 'today'] || '今日';
        const query = String(this.adviceSearchQuery || '').trim();
        if (!messages.length) return '像聊天一样提问，AI 会结合你的记录分析';
        if (query) return `搜索“${query}”：${visibleMessages.length} 条匹配记录`;
        return `${rangeLabel}显示 ${Math.floor(visibleMessages.length / 2)} / 共 ${Math.floor(messages.length / 2)} 轮建议`;
    },

    adviceConversationContext(limit = 12) {
        const messages = this.db.health.aiAdviceChat || [];
        const today = this.dateKey(new Date());
        const todayMessages = messages.filter(msg => this.dateKey(this.parseHistoryDate(msg.at)) === today);
        const recentMessages = messages.slice(-limit);
        const merged = [];
        [...todayMessages, ...recentMessages].forEach(msg => {
            if (!msg?.content || msg.pending || msg.error) return;
            if (merged.includes(msg)) return;
            merged.push(msg);
        });
        return merged.slice(-Math.max(limit, todayMessages.length)).map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
        }));
    },

    preserveAdviceScroll(fn) {
        const list = document.querySelector('.advice-chat-list');
        const beforeTop = list?.scrollTop || 0;
        const beforeHeight = list?.scrollHeight || 0;
        fn();
        requestAnimationFrame(() => {
            const nextList = document.querySelector('.advice-chat-list');
            if (!nextList) return;
            const heightDelta = nextList.scrollHeight - beforeHeight;
            nextList.scrollTop = Math.max(0, beforeTop + heightDelta);
        });
    },

    renderAdviceMarkdown(text = '') {
        const escaped = this.escapeHtml(String(text || ''));
        const normalized = escaped.replace(/\r\n?/g, '\n');

        const renderInline = (line) => line
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>');

        const lines = normalized.split('\n');
        const out = [];
        let inList = false;
        let inCode = false;

        for (const raw of lines) {
            const line = raw.trimEnd();
            if (line.startsWith('```')) {
                if (inList) { out.push('</ul>'); inList = false; }
                out.push(inCode ? '</code></pre>' : '<pre><code>');
                inCode = !inCode;
                continue;
            }
            if (inCode) {
                out.push(`${line}\n`);
                continue;
            }
            if (!line.trim()) {
                if (inList) { out.push('</ul>'); inList = false; }
                continue;
            }
            const heading = line.match(/^(#{1,3})\s+(.+)$/);
            if (heading) {
                if (inList) { out.push('</ul>'); inList = false; }
                const level = heading[1].length;
                out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
                continue;
            }
            const bullet = line.match(/^[-*]\s+(.+)$/);
            if (bullet) {
                if (!inList) { out.push('<ul>'); inList = true; }
                out.push(`<li>${renderInline(bullet[1])}</li>`);
                continue;
            }
            if (inList) { out.push('</ul>'); inList = false; }
            out.push(`<p>${renderInline(line)}</p>`);
        }

        if (inList) out.push('</ul>');
        if (inCode) out.push('</code></pre>');
        return out.join('');
    },

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

    async sendAiAdvice(promptOverride = '') {
        if (!ai.cfg.enabled) return alert('请先在设置中配置 AI');
        if (this._adviceSending) return;
        const input = document.getElementById('advicePrompt');
        const prompt = (promptOverride || input?.value || '').trim();
        if (!prompt) return;
        const list = document.querySelector('.advice-chat-list');
        this._adviceFollowStream = !list || (list.scrollHeight - list.clientHeight - list.scrollTop) < 180;
        const selected = document.getElementById('adviceModel')?.value || this.adviceModel || '__current__';
        const model = selected === '__current__' ? ai.cfg.model : selected;
        const now = new Date().toISOString();
        const pendingId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        this._adviceSending = true;
        this.db.health.aiAdviceChat.push({ role: 'user', content: prompt, at: now });
        this.db.health.aiAdviceChat.push({ role: 'assistant', content: '', at: now, model, pending: true, id: pendingId });
        if (input) input.value = '';
        this.clearAdviceDraft();
        this.save();
        requestAnimationFrame(() => this.scrollAdviceToLatest(true));
        try {
            const messages = this.buildAdviceMessages(prompt, model);
            const oldModel = ai.cfg.model;
            ai.cfg.model = model;
            let full = '';
            try {
                full = await ai.callStream(messages, 2400, (delta, accumulated) => {
                    const idx = this.db.health.aiAdviceChat.findIndex(msg => msg.id === pendingId);
                    if (idx < 0) return;
                    this.db.health.aiAdviceChat[idx].content = accumulated;
                    if (this.db.health.aiAdviceChat[idx].pending && accumulated) this.db.health.aiAdviceChat[idx].pending = false;
                    const bubble = document.querySelector(`[data-advice-id="${pendingId}"]`);
                    if (bubble && accumulated) {
                        const contentEl = bubble.querySelector('.advice-bubble-content');
                        if (contentEl) contentEl.innerHTML = this.renderAdviceMarkdown(accumulated);
                        bubble.classList.remove('pending');
                        const dots = bubble.querySelector('.advice-typing-dot');
                        if (dots) dots.remove();
                    }
                    this.scheduleAdviceStreamScroll();
                });
            } finally {
                ai.cfg.model = oldModel;
            }
            const idx = this.db.health.aiAdviceChat.findIndex(msg => msg.id === pendingId);
            if (idx >= 0) this.db.health.aiAdviceChat[idx] = { role: 'assistant', content: full, at: new Date().toISOString(), model };
            this.save();
            requestAnimationFrame(() => this.scrollAdviceToLatest(true));
        } catch (e) {
            const idx = this.db.health.aiAdviceChat.findIndex(msg => msg.id === pendingId);
            const failed = { role: 'assistant', content: `分析失败：${e.message}`, at: new Date().toISOString(), model, error: true, retryPrompt: prompt };
            if (idx >= 0) this.db.health.aiAdviceChat[idx] = failed;
            else this.db.health.aiAdviceChat.push(failed);
            this.save();
            requestAnimationFrame(() => this.scrollAdviceToLatest(true));
        } finally {
            this._adviceSending = false;
            this._adviceFollowStream = false;
            const send = document.getElementById('adviceSendBtn');
            if (send) send.disabled = true;
        }
    },

    deleteAiAdviceMessage(idx) {
        const messages = this.db.health.aiAdviceChat || [];
        if (idx < 0 || idx >= messages.length) return;
        this.preserveAdviceScroll(() => {
            messages.splice(idx, 1);
            this.db.health.aiAdviceChat = messages;
            this.saveAndBackup();
        });
    },

    copyAdviceMessage(idx) {
        const msg = (this.db.health.aiAdviceChat || [])[idx];
        if (!msg?.content) return;
        navigator.clipboard?.writeText(msg.content).catch(() => {});
        workout?.showToast?.('已复制 AI 回答');
    },

    retryAdviceFrom(idx) {
        const msg = (this.db.health.aiAdviceChat || [])[idx];
        const prompt = msg?.retryPrompt || this.db.health.aiAdviceChat?.slice(0, idx).reverse().find(m => m.role === 'user')?.content;
        if (prompt) this.sendAiAdvice(prompt);
    },

    scheduleAdviceStreamScroll(force = false) {
        if (!force && !this._adviceFollowStream) return;
        if (this._adviceScrollRaf) return;
        this._adviceScrollRaf = requestAnimationFrame(() => {
            this._adviceScrollRaf = 0;
            this.scrollAdviceToLatest(force || !!this._adviceFollowStream, 'auto');
        });
    },

    scrollAdviceToLatest(force = false, behavior = force ? 'smooth' : 'auto') {
        const list = document.querySelector('.advice-chat-list');
        if (list) {
            const distance = list.scrollHeight - list.clientHeight - list.scrollTop;
            if (force || distance < 180 || this._adviceFollowStream) {
                list.scrollTo({ top: list.scrollHeight, behavior });
            }
        }
    },

    renderAdviceMessages(messages) {
        if (!messages.length) {
            const searching = String(this.adviceSearchQuery || '').trim();
            return searching
                ? '<div class="empty-state advice-empty"><span class="material-symbols-rounded">search_off</span><p>没有匹配的聊天记录</p></div>'
                : '<div class="empty-state advice-empty"><span class="material-symbols-rounded">forum</span><p>还没有 AI 建议，选择下方快捷问题开始</p></div>';
        }
        const groups = messages.reduce((acc, msg, idx) => {
            const date = this.dateKey(this.parseHistoryDate(msg.at));
            if (!acc[date]) acc[date] = [];
            acc[date].push({ ...msg, idx: Number.isInteger(msg.idx) ? msg.idx : idx });
            return acc;
        }, {});
        const lastVisibleIdx = messages[messages.length - 1]?.idx ?? messages.length - 1;
        return Object.keys(groups).sort((a, b) => a.localeCompare(b)).map(date => {
            const list = groups[date];
            const today = date === this.dateKey(new Date());
            const collapsed = this.isCollapsed(`advice_${date}`, !today && list.every(msg => msg.idx < lastVisibleIdx - 4));
            return `<section class="advice-date-group ${collapsed ? 'collapsed' : ''}">
                <button class="advice-date-head" onclick="data.toggleCollapse('advice_${date}')" type="button">
                    <span class="material-symbols-rounded">event_note</span>
                    <strong>${date}</strong>
                    <small>${list.length} 条</small>
                    <span class="material-symbols-rounded">${collapsed ? 'expand_more' : 'expand_less'}</span>
                </button>
                <div class="advice-date-content">
                    ${list.map(msg => this.renderAdviceMessage(msg, msg.idx === lastVisibleIdx)).join('')}
                </div>
            </section>`;
        }).join('');
    },

    renderAdviceMessage(msg, latest = false) {
        const label = msg.role === 'user' ? '我' : 'AI';
        const time = this.parseHistoryDate(msg.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const model = msg.model ? ` · ${this.escapeHtml(msg.model)}` : '';
        const rawContent = String(msg.content || '');
        const content = msg.role === 'assistant'
            ? (rawContent ? this.renderAdviceMarkdown(rawContent) : '')
            : `<p>${this.escapeHtml(rawContent).replace(/\n/g, '<br>')}</p>`;
        const state = msg.pending ? ' pending' : msg.error ? ' error' : '';
        const actions = msg.role === 'assistant'
            ? `<div class="advice-bubble-actions">
                <button onclick="data.copyAdviceMessage(${msg.idx})" type="button">复制</button>
                ${(msg.error || !msg.pending) ? `<button onclick="data.retryAdviceFrom(${msg.idx})" type="button">重试</button>` : ''}
                <button onclick="data.deleteAiAdviceMessage(${msg.idx})" type="button">删除</button>
            </div>`
            : `<div class="advice-bubble-actions"><button onclick="data.deleteAiAdviceMessage(${msg.idx})" type="button">删除</button></div>`;
        return `<div class="advice-bubble ${msg.role}${state}" ${msg.id ? `data-advice-id="${msg.id}"` : ''} ${latest ? 'data-advice-latest="true"' : ''}>
            <div class="advice-bubble-head">
                <b>${label}<small>${time}${model}</small></b>
                ${msg.pending ? '<span class="advice-typing-dot"></span>' : ''}
            </div>
            <div class="advice-bubble-content">${content}</div>
            ${actions}
        </div>`;
    },

    renderAdvicePanel() {
        const messages = this.db.health.aiAdviceChat || [];
        const visibleMessages = this.visibleAdviceMessages(messages);
        const draft = this.escapeHtml(this.restoreAdviceDraft());
        const activeModel = this.adviceModel || '__current__';
        const modelOptions = [{ id: '__current__', name: ai.cfg.model ? `当前配置：${ai.cfg.model}` : '当前配置模型' }, ...(ai.models || [])];
        const activeModelName = modelOptions.find(m => m.id === activeModel)?.name || modelOptions[0]?.name || '模型';
        const activeModelValue = activeModel === '__current__' ? ai.cfg.model : activeModelName;
        const modelVisual = this.adviceModelVisual(activeModelValue);
        const modelMark = modelVisual.icon
            ? `<img class="advice-model-icon" src="${modelVisual.icon}" alt="">`
            : this.escapeHtml(modelVisual.mark);
        const contexts = { diet: true, training: true, weight: true, goal: true, ...(this.adviceContexts || {}) };
        const range = this.adviceRange || 'today';
        const searchQuery = this.escapeHtml(this.adviceSearchQuery || '');
        const searchOpen = !!this.adviceSearchOpen || !!this.adviceSearchQuery;
        const goalType = this.db.health.dietGoal?.goalType || this.db.health.goalType || 'loss';
        const isGain = goalType === 'gain';
        const quicks = isGain
            ? ['分析我最近增肌进展是否正常', '根据今天饮食给我加餐建议', '帮我安排本周力量训练重点', '我今天蛋白质和碳水够不够？']
            : ['分析我最近减重停滞的原因', '根据今天饮食给我晚餐建议', '帮我调整本周训练强度', '我今天蛋白质够不够？'];
        const messageSummary = this.adviceMessageSummary(messages, visibleMessages);
        return `<div class="md-card advice-main-card">
            <div class="advice-chat-shell">
                <div class="advice-chat-header">
                    <div>
                        <span class="cardio-kicker">AI 分析建议</span>
                        <h3>训练 / 饮食 / 体重分析</h3>
                        <small id="adviceMessageSummary">${this.escapeHtml(messageSummary)}</small>
                    </div>
                    <span class="material-symbols-rounded advice-chat-icon">psychology</span>
                </div>
                <div class="advice-context-bar">
                    <div class="advice-filter-row">
                        <div class="advice-range-tabs">${[['today','今日'],['week','7天'],['month','30天'],['all','全部']].map(([key, label]) => `<button class="advice-pill ${range === key ? 'active' : ''}" onclick="data.setAdviceRange('${key}')" type="button">${label}</button>`).join('')}</div>
                        <button class="advice-search-toggle ${searchOpen ? 'active' : ''}" onclick="data.toggleAdviceSearch()" type="button" aria-label="搜索聊天记录"><span class="material-symbols-rounded">search</span></button>
                    </div>
                    ${searchOpen ? `<div class="advice-search-row">
                        <span class="material-symbols-rounded">search</span>
                        <input id="adviceSearchInput" value="${searchQuery}" oninput="data.onAdviceSearchInput(this)" placeholder="搜索聊天记录、日期或模型" autocomplete="off">
                        ${searchQuery ? '<button onclick="data.clearAdviceSearch()" type="button" aria-label="清空搜索"><span class="material-symbols-rounded">close</span></button>' : ''}
                    </div>` : ''}
                    <div class="advice-context-toggles">${[['diet','饮食'],['training','训练'],['weight','体重'],['goal','目标']].map(([key, label]) => `<button class="advice-pill ${contexts[key] ? 'active' : ''}" onclick="data.toggleAdviceContext('${key}')" type="button">${label}</button>`).join('')}</div>
                </div>
                <div class="advice-chat-list">${this.renderAdviceMessages(visibleMessages)}</div>
                <div class="advice-quick-prompts">${quicks.map(q => `<button onclick="data.useAdvicePrompt('${this.escapeHtml(q)}')" type="button">${this.escapeHtml(q)}</button>`).join('')}</div>
                <div class="advice-composer">
                    <label class="advice-model-picker advice-model-${modelVisual.key}" aria-label="切换分析模型：${this.escapeHtml(modelVisual.label)}" title="切换分析模型：${this.escapeHtml(modelVisual.label)}">
                        <span class="advice-model-mark">${modelMark}</span>
                        <span class="material-symbols-rounded advice-model-picker-arrow">expand_more</span>
                        <select id="adviceModel" class="advice-model-switch" onchange="data.setAdviceModel(this.value)">${modelOptions.map(m => `<option value="${this.escapeHtml(m.id)}" ${m.id === activeModel ? 'selected' : ''}>${this.escapeHtml(m.name || m.id)}</option>`).join('')}</select>
                    </label>
                    <textarea id="advicePrompt" class="advice-composer-input" rows="1" placeholder="向 AI 提问…" oninput="data.onAdvicePromptInput(this)" onkeydown="data.onAdvicePromptKeydown(event)">${draft}</textarea>
                    <button id="adviceSendBtn" class="advice-send-btn" onclick="data.sendAiAdvice()" type="button" ${draft.trim() ? '' : 'disabled'} aria-label="发送问题"><span class="material-symbols-rounded">send</span></button>
                </div>
                <div id="adviceStatus" class="food-ai-status advice-status-line">Enter 发送，Shift + Enter 换行</div>
            </div>
        </div>`;
    }
};

if (typeof window !== 'undefined' && window.data) advicePanel.attach(window.data);
