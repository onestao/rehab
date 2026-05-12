const advicePanel = {
    DRAFT_KEY: 'rehab_advice_draft',
    SETTINGS_KEY: 'rehab_advice_settings',
    SCROLL_KEY: 'rehab_advice_scroll_top',
    PAGE_SCROLL_KEY: 'rehab_advice_page_scroll_offset',
    attach(target) {
        Object.assign(target, {
            DRAFT_KEY: this.DRAFT_KEY,
            SETTINGS_KEY: this.SETTINGS_KEY,
            SCROLL_KEY: this.SCROLL_KEY,
            PAGE_SCROLL_KEY: this.PAGE_SCROLL_KEY,
            MODEL_ICONS: this.MODEL_ICONS,
            sendAiAdvice: this.sendAiAdvice,
            requestAiAdvice: this.requestAiAdvice,
            deleteAiAdviceMessage: this.deleteAiAdviceMessage,
            copyAdviceMessage: this.copyAdviceMessage,
            retryAdviceFrom: this.retryAdviceFrom,
            regenerateAdvice: this.regenerateAdvice,
            captureAdviceDraft: this.captureAdviceDraft,
            adviceSavedScrollTop: this.adviceSavedScrollTop,
            adviceSavedPageScrollOffset: this.adviceSavedPageScrollOffset,
            isAdvicePageActive: this.isAdvicePageActive,
            captureAdviceScroll: this.captureAdviceScroll,
            restoreAdviceScroll: this.restoreAdviceScroll,
            bindAdviceScrollListener: this.bindAdviceScrollListener,
            restoreAdviceDraft: this.restoreAdviceDraft,
            clearAdviceDraft: this.clearAdviceDraft,
            loadAdviceSettings: this.loadAdviceSettings,
            saveAdviceSettings: this.saveAdviceSettings,
            isMobileAdviceInput: this.isMobileAdviceInput,
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
            applyPickerThemeFromCache: this.applyPickerThemeFromCache,
            autoResizeAdvicePrompt: this.autoResizeAdvicePrompt,
            adviceRangeStart: this.adviceRangeStart,
            filterByAdviceRange: this.filterByAdviceRange,
            visibleAdviceMessages: this.visibleAdviceMessages,
            adviceMessageSummary: this.adviceMessageSummary,
            iconFallbackSrcs: this.iconFallbackSrcs,
            adviceModelIconHtml: this.adviceModelIconHtml,
            adviceModelThemeStyle: this.adviceModelThemeStyle,
            providerHashHue: this.providerHashHue,
            modelThemeFor: this.modelThemeFor,
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
        this.listenThemeChanges();
    },

    listenThemeChanges() {
        if (this._themeMediaBound) return;
        if (window.matchMedia) {
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            this._themeMediaBound = true;
            mq.addEventListener('change', () => this.applyPickerThemeFromCache());
        }
    },

    applyPickerThemeFromCache() {
        try {
            if (!this._lastVisual) return;
            const picker = document.querySelector('.advice-model-picker');
            if (!picker) return;
            const style = this.adviceModelThemeStyle(this._lastVisual);
            if (style) picker.setAttribute('style', style);
        } catch {}
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

    adviceSavedScrollTop() {
        if (Number.isFinite(this._adviceScrollTop)) return this._adviceScrollTop;
        try {
            const raw = sessionStorage.getItem(this.SCROLL_KEY);
            const parsed = Number(raw);
            return Number.isFinite(parsed) ? parsed : null;
        } catch {
            return null;
        }
    },

    adviceSavedPageScrollOffset() {
        if (Number.isFinite(this._advicePageScrollOffset)) return this._advicePageScrollOffset;
        try {
            const raw = sessionStorage.getItem(this.PAGE_SCROLL_KEY);
            const parsed = Number(raw);
            return Number.isFinite(parsed) ? parsed : null;
        } catch {
            return null;
        }
    },

    isAdvicePageActive(el = document.querySelector('.advice-chat-list')) {
        const page = el?.closest?.('.page');
        return !page || page.classList.contains('active');
    },

    captureAdviceScroll() {
        const list = document.querySelector('.advice-chat-list');
        if (!list) return;
        if (!this.isAdvicePageActive(list)) return;
        const maxTop = Math.max(0, list.scrollHeight - list.clientHeight);
        const top = Math.max(0, Math.min(list.scrollTop || 0, maxTop));
        this._adviceScrollTop = top;
        try { sessionStorage.setItem(this.SCROLL_KEY, String(top)); } catch {}

        const card = list.closest('.advice-main-card');
        if (!card) return;
        const pageOffset = Math.max(0, window.scrollY - (card.getBoundingClientRect().top + window.scrollY));
        this._advicePageScrollOffset = pageOffset;
        try { sessionStorage.setItem(this.PAGE_SCROLL_KEY, String(pageOffset)); } catch {}
    },

    restoreAdviceScroll() {
        const list = document.querySelector('.advice-chat-list');
        if (!list) return;
        if (!this.isAdvicePageActive(list)) return;
        const savedTop = this.adviceSavedScrollTop();
        if (Number.isFinite(savedTop)) {
            const maxTop = Math.max(0, list.scrollHeight - list.clientHeight);
            list.scrollTop = Math.max(0, Math.min(savedTop, maxTop));
        }

        const savedPageOffset = this.adviceSavedPageScrollOffset();
        const card = list.closest('.advice-main-card');
        if (!Number.isFinite(savedPageOffset) || !card) return;
        const cardTop = card.getBoundingClientRect().top + window.scrollY;
        const maxWindowTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        window.scrollTo({ top: Math.min(cardTop + savedPageOffset, maxWindowTop), behavior: 'auto' });
    },

    bindAdviceScrollListener() {
        const list = document.querySelector('.advice-chat-list');
        if (!list) return;
        if (!this.isAdvicePageActive(list)) return;
        if (this._adviceScrollEl === list) return;
        if (this._adviceScrollEl && this._adviceOnScroll) {
            this._adviceScrollEl.removeEventListener('scroll', this._adviceOnScroll);
        }
        this._adviceOnScroll = () => this.captureAdviceScroll();
        list.addEventListener('scroll', this._adviceOnScroll, { passive: true });
        this._adviceScrollEl = list;
    },

    isMobileAdviceInput() {
        return !!(
            window.matchMedia?.('(pointer: coarse) and (max-width: 768px)').matches
            || (navigator.maxTouchPoints > 0 && window.innerWidth <= 768)
        );
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
        if (this.isMobileAdviceInput()) return;
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

    toggleAdviceSearch() {
        const shouldOpen = !(this.adviceSearchOpen || this.adviceSearchQuery);
        this.adviceSearchOpen = shouldOpen;
        if (!shouldOpen) this.adviceSearchQuery = '';
        this.captureAdviceDraft();
        this.captureAdviceScroll();
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
        this.captureAdviceScroll();
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
        this.captureAdviceScroll();
        this.renderAiCoachPage?.() || this.renderRoutines?.();
        requestAnimationFrame(() => this.autoResizeAdvicePrompt());
    },

    toggleAdviceContext(key) {
        this.adviceContexts = { diet: true, training: true, weight: true, goal: true, ...(this.adviceContexts || {}) };
        this.adviceContexts[key] = !this.adviceContexts[key];
        this.saveAdviceSettings();
        this.captureAdviceDraft();
        this.captureAdviceScroll();
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
            const failed = { role: 'assistant', content: `分析失败：${window.toast ? toast.sanitize(e) : e.message}`, at: new Date().toISOString(), model, error: true, retryPrompt: prompt };
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

    regenerateAdvice() {
        const messages = this.db.health.aiAdviceChat || [];
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant') {
                const prompt = messages[i].retryPrompt || messages.slice(0, i).reverse().find(m => m.role === 'user')?.content;
                messages.splice(i, 1);
                this.save();
                if (prompt) this.sendAiAdvice(prompt);
                return;
            }
        }
    },

    renderAdvicePanel() {
        const messages = this.db.health.aiAdviceChat || [];
        const visibleMessages = this.visibleAdviceMessages(messages);
        const draft = this.escapeHtml(this.restoreAdviceDraft());
        const activeModel = this.adviceModel || '__current__';
        const modelOptions = [{ id: '__current__', name: ai.cfg.model ? `当前配置：${ai.cfg.model}` : '当前配置模型' }, ...(ai.models || [])];
        const activeEntry = modelOptions.find(m => m.id === activeModel);
        const activeModelLabel = activeEntry?.name || activeEntry?.id || modelOptions[0]?.name || activeModel || '模型';
        const activeModelValue = activeModel === '__current__' ? (ai.cfg.model || activeModelLabel) : activeModelLabel;
        const modelVisual = this.adviceModelVisual(activeModelValue);
        const modelThemeStyle = this.adviceModelThemeStyle(modelVisual);
        const modelMark = this.adviceModelIconHtml(modelVisual);
        const sendHint = this.isMobileAdviceInput() ? '回车换行，点击发送按钮提交' : 'Enter 发送，Shift + Enter 换行';
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
                <div class="advice-composer-tail">
                    <div class="advice-quick-prompts">${quicks.map(q => `<button onclick="data.useAdvicePrompt('${this.escapeHtml(q)}')" type="button">${this.escapeHtml(q)}</button>`).join('')}</div>
                    <div class="advice-composer">
                        <label class="advice-model-picker advice-model-${modelVisual.key}" style="${this.escapeHtml(modelThemeStyle)}" aria-label="切换分析模型：${this.escapeHtml(modelVisual.label)}" title="切换分析模型：${this.escapeHtml(modelVisual.label)}">
                            <span class="advice-model-mark">${modelMark}</span>
                            <span class="material-symbols-rounded advice-model-picker-arrow">expand_more</span>
                            <select id="adviceModel" class="advice-model-switch" onchange="data.setAdviceModel(this.value)">${modelOptions.map(m => `<option value="${this.escapeHtml(m.id)}" ${m.id === activeModel ? 'selected' : ''}>${this.escapeHtml(m.name || m.id)}</option>`).join('')}</select>
                        </label>
                        <textarea id="advicePrompt" class="advice-composer-input" rows="1" placeholder="向 AI 提问…" oninput="data.onAdvicePromptInput(this)" onkeydown="data.onAdvicePromptKeydown(event)">${draft}</textarea>
                        <button id="adviceSendBtn" class="advice-send-btn" onclick="data.sendAiAdvice()" type="button" ${draft.trim() ? '' : 'disabled'} aria-label="发送问题"><span class="material-symbols-rounded">send</span></button>
                    </div>
                    <div id="adviceStatus" class="food-ai-status advice-status-line">${sendHint}</div>
                </div>
            </div>
        </div>`;
    }
};

if (typeof window !== 'undefined') window.advicePanel = advicePanel;
