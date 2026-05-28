// @ts-nocheck
const advicePanel = {
    DRAFT_KEY: 'rehab_advice_draft',
    SETTINGS_KEY: 'rehab_advice_settings',
    SCROLL_KEY: 'rehab_advice_scroll_top',
    PAGE_SCROLL_KEY: 'rehab_advice_page_scroll_offset',
    TEMPLATE_MANAGE_KEY: 'rehab_ai_template_manage',
    attach(target) {
        Object.assign(target, {
            DRAFT_KEY: this.DRAFT_KEY,
            SETTINGS_KEY: this.SETTINGS_KEY,
            SCROLL_KEY: this.SCROLL_KEY,
            PAGE_SCROLL_KEY: this.PAGE_SCROLL_KEY,
            MODEL_ICONS: this.MODEL_ICONS,
            sendAiAdvice: this.sendAiAdvice,
            requestAiAdvice: this.requestAiAdvice,
            findAdviceMessage: this.findAdviceMessage,
            pruneAdviceVersionGroup: this.pruneAdviceVersionGroup,
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
            syncAdviceTopChromeToScroll: this.syncAdviceTopChromeToScroll,
            measureAdviceTopChrome: this.measureAdviceTopChrome,
            applyAdviceTopChromeOffset: this.applyAdviceTopChromeOffset,
            holdAdviceTopChrome: this.holdAdviceTopChrome,
            rerenderAdvicePanel: this.rerenderAdvicePanel,
            renderAdviceTopChromeInner: this.renderAdviceTopChromeInner,
            renderAdviceFilterControls: this.renderAdviceFilterControls,
            _handleAdviceTopChromeScroll: this._handleAdviceTopChromeScroll,
            _handleAdviceTopChromePull: this._handleAdviceTopChromePull,
            restoreAdviceDraft: this.restoreAdviceDraft,
            clearAdviceDraft: this.clearAdviceDraft,
            loadAdviceSettings: this.loadAdviceSettings,
            saveAdviceSettings: this.saveAdviceSettings,
            isMobileAdviceInput: this.isMobileAdviceInput,
            onAdvicePromptInput: this.onAdvicePromptInput,
            onAdvicePromptKeydown: this.onAdvicePromptKeydown,
            setAdviceModel: this.setAdviceModel,
            providerKeyForModel: this.providerKeyForModel,
            providerIcon: this.providerIcon,
            modelShortName: this.modelShortName,
            openAdviceModelPicker: this.openAdviceModelPicker,
            closeAdviceModelPicker: this.closeAdviceModelPicker,
            chooseAdviceModel: this.chooseAdviceModel,
            setAdviceModelPickerScope: this.setAdviceModelPickerScope,
            renderAdviceModelPicker: this.renderAdviceModelPicker,
            setAdviceRange: this.setAdviceRange,
            toggleAdviceContext: this.toggleAdviceContext,
            toggleAdviceContextPanel: this.toggleAdviceContextPanel,
            toggleAdviceV6Insights: this.toggleAdviceV6Insights,
            toggleAdviceSearch: this.toggleAdviceSearch,
            onAdviceSearchInput: this.onAdviceSearchInput,
            clearAdviceSearch: this.clearAdviceSearch,
            getAdviceTemplates: this.getAdviceTemplates,
            getActiveAdviceTemplate: this.getActiveAdviceTemplate,
            selectAdviceTemplate: this.selectAdviceTemplate,
            toggleTemplateManager: this.toggleTemplateManager,
            closeTemplateManager: this.closeTemplateManager,
            setTemplateEditorField: this.setTemplateEditorField,
            resetTemplateEditor: this.resetTemplateEditor,
            saveTemplateEditor: this.saveTemplateEditor,
            deleteTemplateById: this.deleteTemplateById,
            editTemplateById: this.editTemplateById,
            createTemplateDraft: this.createTemplateDraft,
            renderTemplateManagerContent: this.renderTemplateManagerContent,
            exportTemplates: this.exportTemplates,
            importTemplates: this.importTemplates,
            openTemplateImport: this.openTemplateImport,
            handleTemplateImport: this.handleTemplateImport,
            buildAdviceTemplateVars: this.buildAdviceTemplateVars,
            applyAdviceTemplate: this.applyAdviceTemplate,
            useAdvicePrompt: this.useAdvicePrompt,
            scrollAdviceToLatest: this.scrollAdviceToLatest,
            scheduleAdviceStreamScroll: this.scheduleAdviceStreamScroll,
            refreshAdviceSearchResults: this.refreshAdviceSearchResults,
            refreshAdviceModelPicker: this.refreshAdviceModelPicker,
            refreshAdviceModelChip: this.refreshAdviceModelChip,
            renderAdviceModelChip: this.renderAdviceModelChip,
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
            extractAdviceRoutineBlocks: this.extractAdviceRoutineBlocks,
            normalizeAdviceRoutine: this.normalizeAdviceRoutine,
            openAdviceRoutineSave: this.openAdviceRoutineSave,
            saveAdviceRoutine: this.saveAdviceRoutine,
            renderAdvicePanel: this.renderAdvicePanel,
            toggleAiInsight: this.toggleAiInsight,
            setAdviceStreamUiState: this.setAdviceStreamUiState,
            toggleAdviceStreamRender: this.toggleAdviceStreamRender,
            flushAdviceStreamRender: this.flushAdviceStreamRender,
            pauseStreamForScroll: this.pauseStreamForScroll,
            resumeStreamFromScroll: this.resumeStreamFromScroll,
            showAdviceNewMessageButton: this.showAdviceNewMessageButton,
            hideAdviceNewMessageButton: this.hideAdviceNewMessageButton,
            jumpAdviceToLatest: this.jumpAdviceToLatest,
            _handleAdviceStreamScroll: this._handleAdviceStreamScroll,
            getAdviceVersionGroup: this.getAdviceVersionGroup,
            setActiveAdviceVersion: this.setActiveAdviceVersion,
            cycleAdviceVersion: this.cycleAdviceVersion,
            _isVersionActive: this._isVersionActive,
            pinAdviceVersion: this.pinAdviceVersion,
            deleteAdviceVersion: this.deleteAdviceVersion,
            shareAdviceMessage: this.shareAdviceMessage
        });
        Object.assign(target, window.adviceTemplateManager || {});

        target.loadAdviceSettings?.();
        this.listenThemeChanges();
        requestAnimationFrame(() => {
            const retry = document.getElementById('aiRetryMode');
            if (retry) retry.value = this.db?.aiRetryMode || 'versioned';
        });
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
            if (typeof parsed.templateId === 'string') {
                this.db.aiTemplateActiveId = parsed.templateId;
            }
            if (parsed.retryMode === 'replace' || parsed.retryMode === 'versioned') {
                this.db.aiRetryMode = parsed.retryMode;
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
                model: this.adviceModel || '__current__',
                templateId: this.db.aiTemplateActiveId || '',
                retryMode: this.db.aiRetryMode || 'versioned'
            };
            localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(payload));
        } catch {
            // ignore
        }
    },

    pruneAdviceVersionGroup(rootId, maxVersions = 10) {
        const group = this.getAdviceVersionGroup(rootId).sort((a, b) => Number(a.versionIdx || 0) - Number(b.versionIdx || 0));
        if (group.length <= maxVersions) return;
        const active = group.find(item => this._isVersionActive(item, group));
        const removable = group
            .filter(item => !item.versionPinned && item.id !== active?.id)
            .sort((a, b) => Number(a.lastViewedAt || a.updatedAt || 0) - Number(b.lastViewedAt || b.updatedAt || 0));
        while (group.length > maxVersions && removable.length) {
            const target = removable.shift();
            const idx = group.findIndex(item => item.id === target.id);
            if (idx >= 0) group.splice(idx, 1);
            this.softDeleteById(this.db.health.aiAdviceChat, target.id);
            this.db.aiTrash.push({
                id: target.id,
                deletedAt: Date.now(),
                payload: { ...target }
            });
        }
    },

    buildAdviceTemplateVars(context = {}) {
        const profile = this.db.health?.profile || {};
        const weight = this.sortedWeights?.().slice(-1)[0]?.weight || '';
        const height = this.db.health?.height || '';
        const age = profile.age || '';
        const gender = profile.gender === 'female' ? '女' : profile.gender === 'male' ? '男' : '';
        const recentRecords = (context.blocks || []).join('\n\n');
        return {
            prompt: context.prompt || '',
            weight,
            height,
            age,
            gender,
            recentRecords
        };
    },

    applyAdviceTemplate(text, vars) {
        return String(text || '').replace(/\{(\w+)\}/g, (_, key) => (key in vars ? String(vars[key] ?? '') : `{${key}}`));
    },

    setAdviceStreamUiState(state) {
        this._adviceStreamUi = state || 'idle';
        const toggle = document.getElementById('adviceStreamToggle');
        const flush = document.getElementById('adviceStreamFlush');
        const isActive = state && state !== 'idle' && this._adviceSending;
        if (toggle) {
            toggle.classList.toggle('hidden', !isActive);
            toggle.setAttribute('aria-hidden', isActive ? 'false' : 'true');
            const icon = toggle.querySelector('.material-symbols-rounded');
            const label = toggle.querySelector('.advice-stream-toggle-label');
            const isPaused = state === 'paused' || state === 'user-paused';
            if (icon) icon.textContent = isPaused ? 'play_arrow' : 'pause';
            const t = window.i18n?.t?.bind(window.i18n);
            if (label) {
                label.textContent = isPaused
                    ? (t ? t('advice.resumeRender') : '继续渲染')
                    : (t ? t('advice.pauseRender') : '暂停渲染');
            }
            toggle.dataset.state = state;
        }
        if (flush) {
            flush.classList.toggle('hidden', !isActive);
            flush.setAttribute('aria-hidden', isActive ? 'false' : 'true');
            const t = window.i18n?.t?.bind(window.i18n);
            const label = flush.querySelector('.advice-stream-toggle-label');
            if (label) label.textContent = t ? t('advice.flushAll') : '显示全部';
        }
    },

    toggleAdviceStreamRender() {
        const renderer = this._activeStreamRenderer;
        if (!renderer) return;
        const next = (this._adviceStreamUi === 'paused' || this._adviceStreamUi === 'user-paused') ? 'live' : 'user-paused';
        if (next === 'live') {
            renderer.resume();
            this._adviceUserScrollPaused = false;
            this.setAdviceStreamUiState('streaming');
        } else {
            renderer.pause('manual');
            this.setAdviceStreamUiState('user-paused');
        }
    },

    flushAdviceStreamRender() {
        const renderer = this._activeStreamRenderer;
        if (!renderer) return;
        renderer.flushAll();
        this.setAdviceStreamUiState('streaming');
    },

    pauseStreamForScroll() {
        if (!this._adviceSending) return;
        const renderer = this._activeStreamRenderer;
        if (!renderer) return;
        if (this._adviceStreamUi === 'paused' || this._adviceStreamUi === 'user-paused') return;
        renderer.pause('scroll');
        this._adviceUserScrollPaused = true;
        this.setAdviceStreamUiState('paused');
        this.showAdviceNewMessageButton();
    },

    resumeStreamFromScroll() {
        if (!this._adviceSending) return;
        if (!this._adviceUserScrollPaused) return;
        const renderer = this._activeStreamRenderer;
        if (!renderer) return;
        renderer.resume();
        this._adviceUserScrollPaused = false;
        this.hideAdviceNewMessageButton();
        this.setAdviceStreamUiState('streaming');
    },

    showAdviceNewMessageButton() {
        const btn = document.getElementById('adviceNewMessageBtn');
        if (!btn) return;
        btn.classList.remove('hidden');
        btn.setAttribute('aria-hidden', 'false');
    },

    hideAdviceNewMessageButton() {
        const btn = document.getElementById('adviceNewMessageBtn');
        if (!btn) return;
        btn.classList.add('hidden');
        btn.setAttribute('aria-hidden', 'true');
    },

    jumpAdviceToLatest() {
        this.resumeStreamFromScroll();
        this._adviceUserScrollPaused = false;
        this.hideAdviceNewMessageButton();
        this.scrollAdviceToLatest(true, 'smooth');
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

    syncAdviceTopChromeToScroll(list = document.querySelector('.advice-chat-list')) {
        if (!list || !this.isAdvicePageActive(list)) return;
        const maxOffset = this.measureAdviceTopChrome(list);
        const nextOffset = Math.min(Math.max(0, list.scrollTop || 0), maxOffset);
        this._adviceTopChromeHoldUntil = 0;
        this._adviceTopChromeLastScrollTop = list.scrollTop || 0;
        this.applyAdviceTopChromeOffset(list, nextOffset);
    },

    bindAdviceScrollListener() {
        const list = document.querySelector('.advice-chat-list');
        if (!list) return;
        if (!this.isAdvicePageActive(list)) return;
        if (this._adviceScrollEl === list) return;
        if (this._adviceScrollEl && this._adviceOnScroll) {
            this._adviceScrollEl.removeEventListener('scroll', this._adviceOnScroll);
        }
        if (this._adviceScrollEl && this._adviceOnUserIntent) {
            this._adviceScrollEl.removeEventListener('wheel', this._adviceOnUserIntent);
            this._adviceScrollEl.removeEventListener('keydown', this._adviceOnUserIntent);
        }
        if (this._adviceScrollEl && this._adviceOnTopChromeTouchMove) {
            this._adviceScrollEl.removeEventListener('touchmove', this._adviceOnTopChromeTouchMove);
        }
        if (this._adviceGestureEl && this._adviceOnTopChromeTouchStart) {
            this._adviceGestureEl.removeEventListener('touchstart', this._adviceOnTopChromeTouchStart, true);
        }
        if (this._adviceGestureEl && this._adviceOnTopChromeTouchMove) {
            this._adviceGestureEl.removeEventListener('touchmove', this._adviceOnTopChromeTouchMove, true);
        }
        if (this._adviceTopChromeEl && this._adviceOnTopChromePointerDown) {
            this._adviceTopChromeEl.removeEventListener('pointerdown', this._adviceOnTopChromePointerDown);
            this._adviceTopChromeEl.removeEventListener('click', this._adviceOnTopChromePointerDown);
        }
        if (this._adviceTopChromeEl && this._adviceOnTopChromeIntent) {
            this._adviceTopChromeEl.removeEventListener('wheel', this._adviceOnTopChromeIntent);
            this._adviceTopChromeEl.removeEventListener('touchstart', this._adviceOnTopChromeIntent);
            this._adviceTopChromeEl.removeEventListener('touchmove', this._adviceOnTopChromeIntent);
        }
        this._adviceOnScroll = () => {
            this.captureAdviceScroll();
            this._handleAdviceTopChromeScroll(list);
            this._handleAdviceStreamScroll(list);
        };
        this._adviceOnUserIntent = event => {
            this._adviceUserScrollIntent = true;
            this._handleAdviceTopChromePull(list, event);
            clearTimeout(this._adviceUserScrollIntentTimer);
            this._adviceUserScrollIntentTimer = setTimeout(() => {
                this._adviceUserScrollIntent = false;
            }, 600);
        };
        const markTouchIntent = () => {
            this._adviceUserScrollIntent = true;
            clearTimeout(this._adviceUserScrollIntentTimer);
            this._adviceUserScrollIntentTimer = setTimeout(() => {
                this._adviceUserScrollIntent = false;
            }, 600);
        };
        this._adviceOnTopChromeTouchStart = event => {
            markTouchIntent();
            this._handleAdviceTopChromePull(list, event);
        };
        this._adviceOnTopChromeTouchMove = event => {
            markTouchIntent();
            this._handleAdviceTopChromePull(list, event);
        };
        list.addEventListener('scroll', this._adviceOnScroll, { passive: true });
        list.addEventListener('wheel', this._adviceOnUserIntent, { passive: true });
        list.addEventListener('keydown', this._adviceOnUserIntent, { passive: true });
        this._adviceScrollEl = list;
        const chrome = list.closest('.advice-chat-shell')?.querySelector('.advice-top-chrome');
        const shell = list.closest('.advice-chat-shell');
        shell?.addEventListener('touchstart', this._adviceOnTopChromeTouchStart, { passive: true, capture: true });
        shell?.addEventListener('touchmove', this._adviceOnTopChromeTouchMove, { passive: true, capture: true });
        this._adviceGestureEl = shell;
        this._adviceOnTopChromePointerDown = () => this.holdAdviceTopChrome(list, false);
        this._adviceOnTopChromeIntent = event => {
            this._adviceUserScrollIntent = true;
            this._handleAdviceTopChromePull(list, event);
            clearTimeout(this._adviceUserScrollIntentTimer);
            this._adviceUserScrollIntentTimer = setTimeout(() => {
                this._adviceUserScrollIntent = false;
            }, 600);
        };
        chrome?.addEventListener('pointerdown', this._adviceOnTopChromePointerDown, { passive: true });
        chrome?.addEventListener('click', this._adviceOnTopChromePointerDown, { passive: true });
        chrome?.addEventListener('wheel', this._adviceOnTopChromeIntent, { passive: true });
        chrome?.addEventListener('touchstart', this._adviceOnTopChromeIntent, { passive: true });
        chrome?.addEventListener('touchmove', this._adviceOnTopChromeIntent, { passive: true });
        this._adviceTopChromeEl = chrome;
        this._adviceTopChromeLastScrollTop = list.scrollTop || 0;
        this.applyAdviceTopChromeOffset(list, this._adviceTopChromeOffset || 0);
        requestAnimationFrame(() => this.syncAdviceTopChromeToScroll(list));
    },

    measureAdviceTopChrome(list = document.querySelector('.advice-chat-list')) {
        const chrome = list?.closest?.('.advice-chat-shell')?.querySelector?.('.advice-top-chrome');
        const inner = chrome?.querySelector?.('.advice-top-chrome-inner');
        if (!chrome || !inner) return 0;
        const height = Math.ceil(inner.getBoundingClientRect().height || inner.scrollHeight || 0);
        chrome.style.setProperty('--advice-top-chrome-full', `${height}px`);
        return height;
    },

    applyAdviceTopChromeOffset(list = document.querySelector('.advice-chat-list'), offset = 0) {
        const chrome = list?.closest?.('.advice-chat-shell')?.querySelector?.('.advice-top-chrome');
        if (!chrome) return;
        const maxOffset = this.measureAdviceTopChrome(list);
        const next = Math.max(0, Math.min(Number(offset) || 0, maxOffset));
        this._adviceTopChromeOffset = next;
        chrome.style.setProperty('--advice-top-chrome-visible', `${Math.max(0, maxOffset - next)}px`);
        chrome.style.setProperty('--advice-top-chrome-offset', `${-next}px`);
        chrome.classList.toggle('is-collapsed', next >= maxOffset - 1);
    },

    holdAdviceTopChrome(list = document.querySelector('.advice-chat-list'), expand = true) {
        this._adviceTopChromeHoldUntil = performance.now() + 900;
        this._adviceTopChromeLastScrollTop = list?.scrollTop || 0;
        this.applyAdviceTopChromeOffset(list, expand ? 0 : this._adviceTopChromeOffset || 0);
    },

    rerenderAdvicePanel(options = {}) {
        const { expandChrome = false, focusSearch = false, refreshMessages = true } = options;
        this._adviceTopChromeHoldUntil = performance.now() + 900;
        const list = document.querySelector('.advice-chat-list');
        const chromeInner = document.querySelector('.advice-top-chrome-inner');
        if (!list || !chromeInner) {
            this.renderAiCoachPage?.() || this.renderRoutines?.();
            return;
        }
        const previousTop = list.scrollTop || 0;
        chromeInner.innerHTML = this.renderAdviceTopChromeInner();
        this.refreshAdviceModelChip?.();
        if (refreshMessages) {
            this.refreshAdviceSearchResults();
            list.scrollTop = Math.max(0, Math.min(previousTop, list.scrollHeight - list.clientHeight));
        }
        requestAnimationFrame(() => {
            this.autoResizeAdvicePrompt?.();
            this.holdAdviceTopChrome?.(list, expandChrome);
            if (focusSearch) document.getElementById('adviceSearchInput')?.focus();
        });
    },

    _handleAdviceTopChromeScroll(list) {
        const top = Math.max(0, list.scrollTop || 0);
        const maxOffset = this.measureAdviceTopChrome(list);
        const nextOffset = Math.min(top, maxOffset);
        this._adviceTopChromeLastScrollTop = top;
        this.applyAdviceTopChromeOffset(list, nextOffset);
    },

    _handleAdviceTopChromePull(list, event) {
        this._adviceTopChromeHoldUntil = 0;
        const currentOffset = this._adviceTopChromeOffset || 0;
        if (event?.type === 'touchstart') {
            this._adviceTopChromeLastTouchY = event.touches?.[0]?.clientY ?? null;
            return;
        }
        if (event?.type === 'touchmove') {
            const y = event.touches?.[0]?.clientY;
            if (!Number.isFinite(y)) return;
            const lastY = this._adviceTopChromeLastTouchY;
            this._adviceTopChromeLastTouchY = y;
            if (!Number.isFinite(lastY)) return;
            const deltaY = y - lastY;
            if (deltaY < 0) {
                this.applyAdviceTopChromeOffset(list, currentOffset - deltaY);
            } else if (deltaY > 0 && (list.scrollTop || 0) <= 0) {
                this.applyAdviceTopChromeOffset(list, currentOffset - deltaY);
            }
            return;
        }
        if (event?.type === 'wheel') {
            if (event.deltaY < 0 && (list.scrollTop || 0) <= 0) {
                this.applyAdviceTopChromeOffset(list, currentOffset + event.deltaY);
            }
        }
    },

    _handleAdviceStreamScroll(list) {
        if (!this._adviceSending) return;
        const distance = list.scrollHeight - list.clientHeight - list.scrollTop;
        const atBottom = distance < 24;
        if (atBottom) {
            if (this._adviceUserScrollPaused) this.resumeStreamFromScroll();
            this.hideAdviceNewMessageButton();
            return;
        }
        if (this._adviceUserScrollIntent && !this._adviceUserScrollPaused) {
            this.pauseStreamForScroll();
        }
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
            return;
        }
        if (e.key === '[' || e.key === ']') {
            const messages = this.visibleAdviceMessages(this.activeRecords(this.db.health.aiAdviceChat || []));
            const latestAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.versionGroup?.length > 1);
            if (!latestAssistant) return;
            e.preventDefault();
            this.cycleAdviceVersion(latestAssistant.replyToId || latestAssistant.id, e.key === '[' ? -1 : 1);
        }
    },

    autoResizeAdvicePrompt(el = document.getElementById('advicePrompt')) {
        if (!el) return;
        el.style.height = 'auto';
        const nextHeight = Math.max(44, Math.min(el.scrollHeight, 160));
        el.style.height = `${nextHeight}px`;
        el.classList.toggle('is-scrollable', el.scrollHeight > 160);
    },

    setAdviceModel(model) {
        if (!model || model === '__current__') ai.clearOverride?.();
        else ai.setOverride?.({ model, provider: (ai.models || []).find(m => m.id === model)?.provider || ai.cfg.provider || 'openai' });
        this.captureAdviceDraft();
        this.refreshAdviceModelPicker?.();
        this.rerenderAdvicePanel?.();
    },

    providerKeyForModel(provider = '', model = '') {
        const modelText = String(model || '').toLowerCase();
        if (/grok|x-ai|\bxai\b/.test(modelText)) return 'grok';
        if (/gemini|google/.test(modelText)) return 'gemini';
        if (/deepseek/.test(modelText)) return 'deepseek';
        if (/claude|anthropic/.test(modelText)) return 'claude';
        if (/qwen|通义|tongyi/.test(modelText)) return 'qwen';
        if (/doubao|豆包|volc|火山/.test(modelText)) return 'doubao';
        if (/kimi|moonshot|moon/.test(modelText)) return 'kimi';
        if (/minimax/.test(modelText)) return 'minimax';
        if (/mimo/.test(modelText)) return 'mimo';
        if (/glm|chatglm|zhipu|智谱/.test(modelText)) return 'glm';
        if (/gpt|openai|chatgpt|\bo[134]\b|o1|o3|o4/.test(modelText)) return 'openai';
        const providerText = String(provider || 'generic').toLowerCase().split(':')[0].trim();
        return providerText || 'generic';
    },

    providerIcon(provider = '', model = '') {
        const key = this.providerKeyForModel(provider, model);
        const known = ['openai','gemini','grok','deepseek','claude','qwen','doubao','kimi','minimax','mimo','glm'];
        return `assets/model-icons/${known.includes(key) ? key : 'generic'}.svg`;
    },

    modelShortName(model = '') {
        const text = String(model || '模型');
        return text.length > 18 ? `${text.slice(0, 16)}…` : text;
    },

    renderAdviceModelChip() {
        const effective = ai.getEffectiveConfig?.() || ai.cfg;
        const isOverride = !!ai.overrideModel;
        const model = effective.model || '模型';
        const label = `${effective.provider || 'AI'} ${model}`;
        const visual = this.adviceModelVisual(model);
        const style = this.adviceModelThemeStyle(visual);
        return `<button class="advice-model-picker advice-model-chip advice-model-${visual.key} ${isOverride ? 'is-override' : ''}" ${style ? `style="${this.escapeHtml(style)}"` : ''} onclick="data.openAdviceModelPicker()" type="button" aria-label="切换分析模型：${this.escapeHtml(label)}" title="切换分析模型：${this.escapeHtml(label)}">
            <span class="advice-model-mark">${this.adviceModelIconHtml(visual)}</span>
            ${isOverride ? '<span class="advice-model-chip-x" onclick="event.stopPropagation();ai.clearOverride?.();data.refreshAdviceModelChip?.()" role="button" aria-label="恢复默认">×</span>' : ''}
        </button>`;
    },

    refreshAdviceModelChip() {
        const chip = document.querySelector('.advice-model-chip');
        if (!chip) return;
        chip.outerHTML = this.renderAdviceModelChip();
    },

    openAdviceModelPicker() {
        const modal = document.getElementById('aiModelPickerSheet');
        const content = document.getElementById('aiModelPickerContent');
        if (!modal || !content) return;
        content.innerHTML = this.renderAdviceModelPicker();
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
    },

    closeAdviceModelPicker() {
        const modal = document.getElementById('aiModelPickerSheet');
        modal?.classList.add('hidden');
        modal?.setAttribute('aria-hidden', 'true');
    },

    setAdviceModelPickerScope(scope = 'current') {
        const allowed = new Set(['current', 'others', 'cached']);
        this.adviceModelPickerScope = allowed.has(scope) ? scope : 'current';
        const content = document.getElementById('aiModelPickerContent');
        if (content) content.innerHTML = this.renderAdviceModelPicker();
    },

    chooseAdviceModel(profileId, provider, model) {
        const profile = (ai.cfg.profiles || []).find(p => p.id === profileId) || null;
        if (!profile || !ai.apiKeyFor(profile.id)) {
            toast.show('该提供商未配置 API Key', 'error');
            return;
        }
        const cached = (ai.models || []).some(m => (m.provider || profile.provider) === provider && m.id === model);
        if (!cached && ai.fetchModels) {
            ai.fetchModels().catch(() => {});
        }
        ai.setOverride?.({ profileId, provider, model });
        this.closeAdviceModelPicker();
        window.haptics?.light?.();
        this.refreshAdviceModelChip?.();
        this.rerenderAdvicePanel?.();
    },

    renderAdviceModelPicker() {
        const effective = ai.getEffectiveConfig?.() || ai.cfg;
        const profiles = ai.cfg.profiles || [];
        const scope = this.adviceModelPickerScope || 'current';
        const activeProvider = effective.provider || ai.cfg.provider || 'openai';
        const profileForProvider = (provider) => {
            const normalized = provider || 'openai';
            const active = profiles.find(p => p.id === effective.profileId && (p.provider || 'openai') === normalized && ai.apiKeyFor(p.id));
            return active || profiles.find(p => (p.provider || 'openai') === normalized && ai.apiKeyFor(p.id)) || null;
        };
        const rawRows = [];
        if (effective.model) {
            rawRows.push({
                profileId: effective.profileId || profileForProvider(activeProvider)?.id || '',
                provider: activeProvider,
                model: effective.model,
                label: effective.model,
                tag: ai.overrideModel ? '临时模型' : '默认模型',
                disabled: !profileForProvider(activeProvider)
            });
        }
        (ai.models || []).forEach(model => {
            const provider = model.provider || activeProvider;
            const profile = profileForProvider(provider);
            rawRows.push({
                profileId: profile?.id || '',
                provider,
                model: model.id,
                label: model.displayName || model.id,
                tag: model.vision ? 'vision' : 'cached',
                disabled: !profile
            });
        });
        const rows = rawRows.filter(row => {
            if (!row.model) return false;
            if (scope === 'current') return row.provider === activeProvider;
            if (scope === 'others') return row.provider !== activeProvider;
            return true;
        });
        const deduped = rows.filter((row, index, all) => row.model && all.findIndex(x => x.provider === row.provider && x.model === row.model) === index);
        const restore = `<button class="md-btn md-btn-tonal" onclick="ai.clearOverride?.();data.closeAdviceModelPicker?.();data.rerenderAdvicePanel?.()" type="button">恢复默认</button>`;
        const emptyText = scope === 'cached'
            ? '暂无缓存模型，请先在 AI 设置中获取模型'
            : (scope === 'others' ? '暂无其他提供商缓存模型' : '当前提供商暂无缓存模型');
        return `<div class="model-picker-body">
            <div class="model-picker-tabs" role="tablist" aria-label="模型范围">
                <button class="model-picker-tab ${scope === 'current' ? 'active' : ''}" onclick="data.setAdviceModelPickerScope('current')" type="button" aria-selected="${scope === 'current'}">当前提供商</button>
                <button class="model-picker-tab ${scope === 'others' ? 'active' : ''}" onclick="data.setAdviceModelPickerScope('others')" type="button" aria-selected="${scope === 'others'}">其他提供商</button>
                <button class="model-picker-tab ${scope === 'cached' ? 'active' : ''}" onclick="data.setAdviceModelPickerScope('cached')" type="button" aria-selected="${scope === 'cached'}">全部缓存</button>
            </div>
            ${deduped.map(row => {
                const visual = this.adviceModelVisual(row.model);
                const style = this.adviceModelThemeStyle(visual);
                return `<button class="model-picker-row advice-model-${visual.key} ${row.model === effective.model && row.provider === effective.provider ? 'is-selected' : ''}" ${style ? `style="${this.escapeHtml(style)}"` : ''} type="button" aria-disabled="${row.disabled}" title="${row.disabled ? '未配置 API Key' : ''}" onclick="data.chooseAdviceModel('${this.escapeHtml(row.profileId)}','${this.escapeHtml(row.provider)}','${this.escapeHtml(row.model)}')">
                    <span class="advice-model-mark">${this.adviceModelIconHtml(visual)}</span>
                    <span class="model-picker-main"><strong>${this.escapeHtml(row.label)}</strong><small>${this.escapeHtml(row.provider)} · ${this.escapeHtml(row.tag)}</small></span>
                    ${row.model === effective.model && row.provider === effective.provider ? '<span class="material-symbols-rounded">check</span>' : ''}
                </button>`;
            }).join('') || `<div class="ai-model-empty">${this.escapeHtml(emptyText)}</div>`}
            ${restore}
        </div>`;
    },

    toggleAdviceSearch() {
        const shouldOpen = !(this.adviceSearchOpen || this.adviceSearchQuery);
        this.adviceSearchOpen = shouldOpen;
        if (!shouldOpen) this.adviceSearchQuery = '';
        this.captureAdviceDraft();
        this.captureAdviceScroll();
        this.rerenderAdvicePanel({ expandChrome: true, focusSearch: this.adviceSearchOpen });
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
        this.rerenderAdvicePanel({ expandChrome: true });
    },

    refreshAdviceSearchResults() {
        const list = document.querySelector('.advice-chat-list');
        const summary = document.getElementById('adviceMessageSummary');
        if (!list) return;
        const messages = this.activeRecords(this.db.health.aiAdviceChat || []);
        const visibleMessages = this.visibleAdviceMessages(messages);
        list.innerHTML = this.renderAdviceMessages(visibleMessages);
        if (summary) summary.textContent = this.adviceMessageSummary(messages, visibleMessages);
    },

    setAdviceRange(range) {
        this.adviceRange = range || 'today';
        this.saveAdviceSettings();
        this.captureAdviceDraft();
        this.captureAdviceScroll();
        this.rerenderAdvicePanel();
    },

    toggleAdviceContext(key) {
        this.adviceContexts = { diet: true, training: true, weight: true, goal: true, ...(this.adviceContexts || {}) };
        this.adviceContexts[key] = !this.adviceContexts[key];
        this.saveAdviceSettings();
        this.captureAdviceDraft();
        this.captureAdviceScroll();
        this.rerenderAdvicePanel({ expandChrome: true, refreshMessages: false });
    },

    toggleAdviceContextPanel() {
        this.adviceContextOpen = !this.adviceContextOpen;
        this.captureAdviceDraft();
        this.captureAdviceScroll();
        this.rerenderAdvicePanel({ expandChrome: this.adviceContextOpen, refreshMessages: false });
    },

    toggleAdviceV6Insights() {
        this.adviceV6InsightsOpen = !this.adviceV6InsightsOpen;
        this.captureAdviceDraft();
        this.captureAdviceScroll();
        this.rerenderAdvicePanel({ refreshMessages: false });
    },

    useAdvicePrompt(text) {
        if (String(text || '').includes('新建训练计划')) {
            this.openNewPlanSheet?.();
            return;
        }
        const input = document.getElementById('advicePrompt');
        if (!input) return;
        input.value = text;
        this.onAdvicePromptInput(input);
        input.focus();
    },

    adviceRangeStart(range = this.adviceRange || 'today') {
        const start = this.logicalDayStart();
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
        const groups = new Map();
        messages.forEach(msg => {
            if (!msg) return;
            if (msg.role !== 'assistant') return;
            const root = msg.replyToId || msg.id;
            if (!groups.has(root)) groups.set(root, []);
            groups.get(root).push(msg);
        });
        const filtered = messages.filter(msg => {
            if (!msg) return false;
            if (msg.role !== 'assistant') return true;
            const root = msg.replyToId || msg.id;
            const group = groups.get(root) || [];
            if (group.length <= 1) return true;
            return this._isVersionActive(msg, group);
        });
        const withIndex = filtered.map((msg, idx) => {
            const root = msg.role === 'assistant' ? (msg.replyToId || msg.id) : '';
            const group = root ? (groups.get(root) || []) : [];
            const versionGroup = group.length > 1 ? group : null;
            return { ...msg, idx, versionGroup };
        });
        const start = this.adviceRangeStart();
        const ranged = start ? withIndex.filter(msg => this.parseHistoryDate(msg.at) >= start) : withIndex;
        const query = String(this.adviceSearchQuery || '').trim().toLowerCase();
        if (!query) return ranged;
        const matched = new Set();
        ranged.forEach((msg, localIdx) => {
            const date = this.logicalDateKey(this.parseHistoryDate(msg.at));
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
        const messages = this.activeRecords(this.db.health.aiAdviceChat || []);
        const today = this.logicalDateKey();
        const todayMessages = messages.filter(msg => this.logicalDateKey(this.parseHistoryDate(msg.at)) === today);
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

    extractAdviceRoutineBlocks(text = '') {
        const blocks = [];
        const source = String(text || '');
        const re = /```routine\s*([\s\S]*?)```/gi;
        let match;
        while ((match = re.exec(source))) {
            const raw = String(match[1] || '').trim();
            if (!raw) continue;
            try {
                const parsed = JSON.parse(raw);
                const routine = this.normalizeAdviceRoutine(parsed);
                if (routine.ok) blocks.push(routine.value);
            } catch {}
        }
        return blocks;
    },

    normalizeAdviceRoutine(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
            return { ok: false, reason: '方案必须是 JSON 对象' };
        }
        const actions = Array.isArray(input.actions) ? input.actions : [];
        if (!actions.length) return { ok: false, reason: '方案缺少 actions 数组' };
        if (actions.length > 60) return { ok: false, reason: '动作数量过多' };
        const normalizedActions = [];
        for (const item of actions) {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
                return { ok: false, reason: '动作必须是对象' };
            }
            const name = String(item.name || '').trim();
            if (!name) return { ok: false, reason: '动作缺少 name' };
            const num = (key, fallback = 0, min = 0, max = 9999) => {
                const value = Number(item[key] ?? fallback);
                if (!Number.isFinite(value)) return fallback;
                return Math.min(max, Math.max(min, value));
            };
            const action = {
                id: this.generateRecordId('routine-action'),
                name: name.slice(0, 80),
                phase: ['warmup', 'main', 'cooldown'].includes(item.phase) ? item.phase : 'main',
                sets: Math.round(num('sets', 1, 1, 99)),
                reps: Math.round(num('reps', 0, 0, 999)),
                work: Math.round(num('work', 0, 0, 3600)),
                repRest: Math.round(num('repRest', 0, 0, 3600)),
                actionRest: Math.round(num('actionRest', 90, 0, 7200)),
                groupRest: Math.round(num('groupRest', 120, 0, 7200)),
                isAlt: !!item.isAlt,
                libOnly: false,
                deleted: false,
                updatedAt: Date.now()
            };
            if (!action.reps && !action.work) return { ok: false, reason: `${name} 缺少 reps 或 work` };
            normalizedActions.push(action);
        }
        const tags = Array.isArray(input.tags)
            ? input.tags.map(t => this.normalizeTagText ? this.normalizeTagText(t) : String(t || '').trim()).filter(Boolean).slice(0, 8)
            : [];
        return {
            ok: true,
            value: {
                name: String(input.name || 'AI 生成方案').trim().slice(0, 80) || 'AI 生成方案',
                tags,
                actions: normalizedActions
            }
        };
    },

    openAdviceRoutineSave(messageId = '', blockIndex = 0) {
        const msg = (this.db.health?.aiAdviceChat || []).find(item => item && item.id === messageId && !item.deleted);
        const routine = this.extractAdviceRoutineBlocks(msg?.content || '')[Number(blockIndex) || 0];
        if (!routine) {
            window.toast?.show?.('未找到可保存的方案 JSON', 'error');
            return;
        }
        const name = this.escapeHtml(routine.name || 'AI 生成方案');
        const tags = this.escapeHtml((routine.tags || ['AI']).join(', '));
        if (typeof this._openModal !== 'function') {
            this.saveAdviceRoutine(messageId, blockIndex, routine.name, (routine.tags || ['AI']).join(', '));
            return;
        }
        this._openModal({
            title: '保存到方案库',
            icon: 'library_books',
            bodyHtml: `
                <div class="md-grid modal-grid" style="margin:0">
                    <div class="md-field span-full"><input id="adviceRoutineNameInput" type="text" placeholder=" " value="${name}"><label>方案名称</label></div>
                    <div class="md-field span-full"><input id="adviceRoutineTagsInput" type="text" placeholder=" " value="${tags}"><label>标签，用逗号分隔</label></div>
                    <div style="grid-column:1/-1;color:var(--md-sys-on-surface-variant);font-size:12px">${routine.actions.length} 个动作</div>
                </div>
            `,
            actionsHtml: `
                <button class="md-btn" type="button" data-modal-close>取消</button>
                <button class="md-btn md-btn-filled" type="button" data-advice-routine-save><span class="material-symbols-rounded">save</span> 保存</button>
            `,
            onMount: (root, close) => {
                root.querySelector('[data-advice-routine-save]')?.addEventListener('click', (e) => {
                    e.preventDefault();
                    const nextName = root.querySelector('#adviceRoutineNameInput')?.value || routine.name;
                    const nextTags = root.querySelector('#adviceRoutineTagsInput')?.value || '';
                    if (this.saveAdviceRoutine(messageId, blockIndex, nextName, nextTags)) close();
                });
            }
        });
    },

    saveAdviceRoutine(messageId = '', blockIndex = 0, name = '', tagsText = '') {
        const msg = (this.db.health?.aiAdviceChat || []).find(item => item && item.id === messageId && !item.deleted);
        const routine = this.extractAdviceRoutineBlocks(msg?.content || '')[Number(blockIndex) || 0];
        if (!routine) {
            window.toast?.show?.('方案 JSON 校验失败', 'error');
            return false;
        }
        const routineName = String(name || routine.name || '').trim();
        if (!routineName) {
            window.toast?.show?.('请输入方案名称', 'error');
            return false;
        }
        const tags = [...new Set(String(tagsText || '').split(/[,，]/).map(t => this.normalizeTagText ? this.normalizeTagText(t) : String(t || '').trim()).filter(Boolean))];
        this.db.routines = this.db.routines || [];
        this.db.routines.push({
            id: this.generateRecordId('routine'),
            name: routineName.slice(0, 80),
            tags,
            actions: JSON.parse(JSON.stringify(routine.actions)).map(a => this.ensureRecordMeta(a, 'routine-action', Date.now())),
            created: new Date().toLocaleDateString(),
            updatedAt: Date.now(),
            deleted: false
        });
        this.saveAndBackup?.() || this.save?.();
        window.haptics?.light?.();
        window.toast?.show?.(`方案 "${routineName.slice(0, 24)}" 已保存`, 'success');
        return true;
    },

    async sendAiAdvice(promptOverride = '', options = {}) {
        const effective = ai.getEffectiveConfig ? ai.getEffectiveConfig() : { ...ai.cfg, profileId: ai.cfg.activeProfileId };
        if (!effective.enabled) return alert('请先在设置中配置 AI');
        if (this._adviceSending) return;
        const input = document.getElementById('advicePrompt');
        const prompt = (promptOverride || input?.value || '').trim();
        if (!prompt) return;
        const list = document.querySelector('.advice-chat-list');
        this._adviceFollowStream = !list || (list.scrollHeight - list.clientHeight - list.scrollTop) < 180;
        this._adviceUserScrollPaused = false;
        const model = effective.model || ai.cfg.model;
        const provider = effective.provider || ai.cfg.provider || 'openai';
        const isOverride = !!ai.overrideModel && (
            ai.overrideModel.model !== ai.cfg.model ||
            ai.overrideModel.provider !== ai.cfg.provider ||
            ai.overrideModel.profileId !== ai.cfg.activeProfileId
        );
        const now = new Date().toISOString();
        const pendingId = this.generateRecordId('advice-pending');
        const replyToId = options?.replyToId || '';
        const baseVersionIdx = Number(options?.versionIdx || 0);
        this._adviceSending = true;
        if (!options?.skipUserMessage) {
            this.db.health.aiAdviceChat.push({ id: this.generateRecordId('advice-user'), role: 'user', content: prompt, at: now, updatedAt: Date.now(), deleted: false });
        }
        this.db.health.aiAdviceChat.push({
            id: pendingId,
            role: 'assistant',
            content: '',
            at: now,
            model,
            provider,
            temporaryModel: isOverride,
            pending: true,
            updatedAt: Date.now(),
            deleted: false,
            replyToId,
            versionIdx: baseVersionIdx,
            versionActive: options?.versionActive !== false,
            versionPinned: !!options?.versionPinned
        });
        if (input) input.value = '';
        this.clearAdviceDraft();
        this.save();
        requestAnimationFrame(() => {
            if (!this._adviceUserScrollPaused && this._adviceFollowStream) {
                this.scrollAdviceToLatest(true);
            }
        });
        this._activeStreamRenderer = null;
        this._streamRenderers = this._streamRenderers || {};
        this.setAdviceStreamUiState('streaming');
        try {
            const messages = this.buildAdviceMessages(prompt, model);
            let full = '';
            let _lastRender = 0;
            let _pendingFrame = 0;
            /** @type {{ in: number, out: number }|null} */
            let lastUsage = null;
            full = await ai.callStream(messages, 2400, (delta, accumulated, meta) => {
                    const idx = this.db.health.aiAdviceChat.findIndex(msg => msg.id === pendingId);
                    if (idx < 0) return;
                    this.db.health.aiAdviceChat[idx].content = accumulated;
                    if (this.db.health.aiAdviceChat[idx].pending && accumulated) this.db.health.aiAdviceChat[idx].pending = false;
                    if (meta?.usage) {
                        lastUsage = meta.usage;
                        this.db.health.aiAdviceChat[idx].tokenUsage = meta.usage;
                        const modelName = model || ai.cfg.model || '';
                        if (window.aiPricing?.estimate) {
                            const est = window.aiPricing.estimate(meta.usage, provider, modelName);
                            this.db.health.aiAdviceChat[idx].costUsd = est.costUsd;
                        }
                    }
                    this.db.health.aiAdviceChat[idx].updatedAt = Date.now();
                    const bubble = document.querySelector(`[data-advice-id="${pendingId}"]`);
                    if (!bubble || !accumulated) return;
                    const contentEl = bubble.querySelector('.advice-bubble-content');
                    if (!contentEl) return;
                    if (!contentEl._renderer && window.adviceStreamRenderer) {
                        contentEl._renderer = adviceStreamRenderer.create(contentEl, {
                            chunkPerFrame: 8,
                            renderMarkdown: (text) => this.renderAdviceMarkdown(text)
                        });
                        contentEl._renderer.seed(accumulated);
                        this._activeStreamRenderer = contentEl._renderer;
                        this._streamRenderers[pendingId] = contentEl._renderer;
                    }
                    if (contentEl._renderer) {
                        const suffix = window.adviceStreamRenderer?.pendingAccumulatedSuffix
                            ? window.adviceStreamRenderer.pendingAccumulatedSuffix(contentEl._renderer.getState?.(), accumulated)
                            : null;
                        if (suffix !== null) {
                            if (suffix) contentEl._renderer.enqueue(suffix);
                        } else {
                            contentEl._renderer.seed(accumulated);
                        }
                    } else {
                        // fallback
                        contentEl.innerHTML = this.renderAdviceMarkdown(accumulated);
                    }
                    bubble.classList.remove('pending');
                    const dots = bubble.querySelector('.advice-typing-dot');
                    if (dots) dots.remove();
                    if (!this._adviceUserScrollPaused) this.scheduleAdviceStreamScroll();
            });
            const idx = this.db.health.aiAdviceChat.findIndex(msg => msg.id === pendingId);
            if (idx >= 0) this.db.health.aiAdviceChat[idx] = {
                ...this.db.health.aiAdviceChat[idx],
                role: 'assistant',
                content: full,
                at: new Date().toISOString(),
                model,
                provider,
                temporaryModel: isOverride,
                pending: false,
                deleted: false,
                updatedAt: Date.now()
            };
            this.save();
            requestAnimationFrame(() => {
                const bubble = document.querySelector(`[data-advice-id="${pendingId}"]`);
                if (bubble) {
                    const contentEl = bubble.querySelector('.advice-bubble-content');
                    if (contentEl && contentEl._renderer) {
                        try { contentEl._renderer.flushAll(); } catch {}
                        requestAnimationFrame(() => {
                            try { contentEl._renderer.destroy(); } catch {}
                            contentEl._renderer = null;
                            delete this._streamRenderers[pendingId];
                        });
                    } else if (contentEl) {
                        contentEl.innerHTML = this.renderAdviceMarkdown(full);
                    }
                }
                if (!this._adviceUserScrollPaused && this._adviceFollowStream) {
                    this.scrollAdviceToLatest(true);
                }
            });
        } catch (e) {
            const idx = this.db.health.aiAdviceChat.findIndex(msg => msg.id === pendingId);
            const failed = { id: pendingId, role: 'assistant', content: `分析失败：${window.toast ? toast.sanitize(e) : e.message}`, at: new Date().toISOString(), model, provider, temporaryModel: isOverride, error: true, retryPrompt: prompt, deleted: false, updatedAt: Date.now() };
            if (idx >= 0) this.db.health.aiAdviceChat[idx] = failed;
            else this.db.health.aiAdviceChat.push(failed);
            this.save();
            requestAnimationFrame(() => {
                if (!this._adviceUserScrollPaused && this._adviceFollowStream) {
                    this.scrollAdviceToLatest(true);
                }
            });
        } finally {
            this._adviceSending = false;
            this._activeStreamRenderer = null;
            this.setAdviceStreamUiState('idle');
            const send = document.getElementById('adviceSendBtn');
            if (send) send.disabled = true;
        }
    },

    findAdviceMessage(idx, id = '') {
        const messages = this.activeRecords(this.db.health.aiAdviceChat || []);
        if (id) {
            const byId = messages.find(msg => msg.id === id);
            if (byId) return byId;
        }
        return idx >= 0 && idx < messages.length ? messages[idx] : null;
    },

    deleteAiAdviceMessage(idx, id = '') {
        const target = this.findAdviceMessage(idx, id);
        const targetId = target?.id;
        if (!targetId) return;
        this.preserveAdviceScroll(() => {
            this.deleteWithUndo(this.db.health.aiAdviceChat, targetId, {
                save: () => this.saveAndBackup(),
                render: () => this.refreshAdviceSearchResults?.()
            });
        });
    },

    copyAdviceMessage(idx, id = '') {
        const msg = this.findAdviceMessage(idx, id);
        if (!msg?.content) return;
        navigator.clipboard?.writeText(msg.content).catch(() => {});
        workout?.showToast?.('已复制 AI 回答');
    },

    async shareAdviceMessage(idx, id = '') {
        const msg = this.findAdviceMessage(idx, id);
        if (!msg?.content) return;
        const text = String(msg.content || '').trim();
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            workout?.showToast?.('已复制 Markdown');
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', 'true');
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
            workout?.showToast?.('已复制 Markdown');
        }
    },

    retryAdviceFrom(idx, id = '') {
        const messages = this.activeRecords(this.db.health.aiAdviceChat || []);
        const msg = this.findAdviceMessage(idx, id);
        if (!msg) return;
        const msgIndex = messages.findIndex(m => m.id === msg.id);
        const prompt = msg?.retryPrompt || messages.slice(0, Math.max(0, msgIndex)).reverse().find(m => m.role === 'user')?.content;
        if (!prompt) return;
        if (msg.role === 'assistant') {
            if ((this.db.aiRetryMode || 'versioned') === 'replace') {
                this.softDeleteById(this.db.health.aiAdviceChat, msg.id);
                this.db.aiTrash.push({ id: msg.id, deletedAt: Date.now(), payload: { ...msg } });
                this.save();
                this.sendAiAdvice(prompt, { skipUserMessage: true });
                return;
            }
            const rootId = msg.replyToId || msg.id;
            const siblings = this.getAdviceVersionGroup(rootId);
            const nextIdx = siblings.length;
            const nextActive = !siblings.length || !siblings.some(s => s.versionActive);
            siblings.forEach(s => {
                if (s.versionActive && nextActive) {
                    s.versionActive = false;
                    s.updatedAt = Date.now();
                }
            });
            this.sendAiAdvice(prompt, {
                replyToId: rootId,
                versionIdx: nextIdx,
                skipUserMessage: true,
                versionActive: nextActive
            });
            this.pruneAdviceVersionGroup(rootId, 10);
            return;
        }
        this.sendAiAdvice(prompt);
    },

    regenerateAdvice() {
        const messages = this.activeRecords(this.db.health.aiAdviceChat || []);
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant') {
                this.retryAdviceFrom(i);
                return;
            }
        }
    },

    getAdviceVersionGroup(rootId) {
        if (!rootId) return [];
        const all = this.db.health?.aiAdviceChat || [];
        return all.filter(m => m && !m.deleted && m.role === 'assistant' && (m.id === rootId || m.replyToId === rootId));
    },

    setActiveAdviceVersion(rootId, versionId) {
        if (!rootId || !versionId) return;
        const group = this.getAdviceVersionGroup(rootId);
        const now = Date.now();
        this._streamRenderers = this._streamRenderers || {};
        group.forEach(m => {
            const wasActive = !!m.versionActive;
            const nextActive = m.id === versionId;
            if (wasActive !== nextActive) {
                m.versionActive = nextActive;
                m.updatedAt = now;
            }
            if (nextActive) m.lastViewedAt = now;
        });
        const previous = group.find(m => m.id !== versionId && m.versionActive);
        if (previous && this._streamRenderers[previous.id]) {
            this._streamRenderers[previous.id].pause('switch');
        }
        if (this._streamRenderers[versionId]) {
            this._streamRenderers[versionId].resume();
        }
        this.save();
    },

    cycleAdviceVersion(rootId, delta) {
        const group = this.getAdviceVersionGroup(rootId).sort((a, b) => Number(a.versionIdx || 0) - Number(b.versionIdx || 0));
        if (group.length < 2) return;
        const activeIdx = group.findIndex(m => this._isVersionActive(m, group));
        const safeIdx = activeIdx < 0 ? group.length - 1 : activeIdx;
        const next = group[(safeIdx + delta + group.length) % group.length];
        this.setActiveAdviceVersion(rootId, next.id);
    },

    _isVersionActive(message, group) {
        if (!message) return false;
        if (message.versionActive === true) return true;
        if (message.versionActive === false) return false;
        const hasActive = (group || this.getAdviceVersionGroup(message.replyToId || message.id)).some(m => m.versionActive === true);
        if (hasActive) return false;
        const list = group || this.getAdviceVersionGroup(message.replyToId || message.id);
        return message === list[list.length - 1];
    },

    pinAdviceVersion(rootId, versionId) {
        const group = this.getAdviceVersionGroup(rootId);
        const target = group.find(m => m.id === versionId);
        if (!target) return;
        target.versionPinned = !target.versionPinned;
        target.updatedAt = Date.now();
        this.save();
    },

    deleteAdviceVersion(rootId, versionId) {
        const group = this.getAdviceVersionGroup(rootId);
        const removeVersion = () => {
            if (group.length <= 1) {
                this.softDeleteById(this.db.health.aiAdviceChat, versionId);
            } else {
                const target = group.find(m => m.id === versionId);
                if (!target) return;
                const wasActive = this._isVersionActive(target, group);
                this.softDeleteById(this.db.health.aiAdviceChat, versionId);
                if (wasActive) {
                    const remaining = this.getAdviceVersionGroup(rootId);
                    const next = remaining[remaining.length - 1];
                    if (next) {
                        remaining.forEach(m => { m.versionActive = m.id === next.id; });
                    }
                }
            }
        };
        const restoreVersion = () => {
            if (!this.restoreById(this.db.health.aiAdviceChat, versionId)) return;
            const restored = this.db.health.aiAdviceChat.find(m => m?.id === versionId);
            if (restored) restored.versionActive = true;
            this.getAdviceVersionGroup(rootId).forEach(m => {
                if (m.id !== versionId) m.versionActive = false;
            });
        };
        removeVersion();
        this.save();
        this.refreshAdviceSearchResults?.();
        if (window.toast?.show) {
            toast.show('已删除', 'info', {
                action: '撤销',
                timeout: 5000,
                onAction: () => {
                    restoreVersion();
                    this.save();
                    this.refreshAdviceSearchResults?.();
                    window.haptics?.success?.();
                }
            });
        }
    },

    renderAdviceTopChromeInner() {
        const messages = this.activeRecords(this.db.health.aiAdviceChat || []);
        const visibleMessages = this.visibleAdviceMessages(messages);
        const messageSummary = this.adviceMessageSummary(messages, visibleMessages);
        return `<div class="advice-chat-header">
            <div>
                <span class="cardio-kicker">AI 分析建议</span>
                <h3>训练 / 饮食 / 体重分析</h3>
                <small id="adviceMessageSummary">${this.escapeHtml(messageSummary)}</small>
            </div>
            <span class="material-symbols-rounded advice-chat-icon">psychology</span>
        </div>
        <div class="advice-context-bar">
            ${(() => {
                const templates = Array.isArray(this.db.aiTemplates) ? this.db.aiTemplates : [];
                if (!templates.length) return '';
                const activeId = this.db.aiTemplateActiveId || templates[0]?.id || '';
                return `<div class="advice-template-row">${templates.map(t => `<button class="advice-pill ${t.id === activeId ? 'active' : ''}" onclick="data.selectAdviceTemplate('${this.escapeHtml(t.id)}')" type="button">${this.escapeHtml(t.name)}</button>`).join('')}</div>`;
            })()}
            ${this.renderAdviceFilterControls()}
        </div>`;
    },

    renderAdviceFilterControls() {
        const contexts = { diet: true, training: true, weight: true, goal: true, ...(this.adviceContexts || {}) };
        const ctxOpen = !!this.adviceContextOpen;
        const enabledCount = ['diet','training','weight','goal'].filter(k => contexts[k]).length;
        const range = this.adviceRange || 'today';
        const rawSearchQuery = this.adviceSearchQuery || '';
        const searchQuery = this.escapeHtml(rawSearchQuery);
        const searchOpen = !!this.adviceSearchOpen || !!this.adviceSearchQuery;
        return `
            <div class="advice-filter-row">
                <div class="advice-range-tabs">${[['today','今日'],['week','7天'],['month','30天'],['all','全部']].map(([key, label]) => `<button class="advice-pill ${range === key ? 'active' : ''}" onclick="data.setAdviceRange('${key}')" type="button">${label}</button>`).join('')}</div>
                <div class="advice-filter-actions">
                    <button class="advice-search-toggle ${ctxOpen ? 'active' : ''}" onclick="data.toggleAdviceContextPanel()" type="button" aria-label="数据维度" title="数据维度">
                        <span class="material-symbols-rounded">tune</span>
                        ${enabledCount < 4 ? `<span class="advice-ctx-badge">${enabledCount}</span>` : ''}
                    </button>
                    <button class="advice-search-toggle ${searchOpen ? 'active' : ''}" onclick="data.toggleAdviceSearch()" type="button" aria-label="搜索聊天记录"><span class="material-symbols-rounded">search</span></button>
                </div>
            </div>
            ${searchOpen ? `<div class="advice-search-row">
                <span class="material-symbols-rounded">search</span>
                <input id="adviceSearchInput" value="${searchQuery}" oninput="data.onAdviceSearchInput(this)" placeholder="搜索聊天记录、日期或模型" autocomplete="off">
                ${rawSearchQuery ? '<button onclick="data.clearAdviceSearch()" type="button" aria-label="清空搜索"><span class="material-symbols-rounded">close</span></button>' : ''}
            </div>` : ''}
            ${ctxOpen ? `<div class="advice-context-popover">
                <div class="advice-context-popover-head">
                    <span>选择给 AI 的数据维度</span>
                    <button onclick="data.toggleAdviceContextPanel()" type="button" aria-label="关闭"><span class="material-symbols-rounded">close</span></button>
                </div>
                <div class="advice-context-toggles">${[['diet','饮食','restaurant'],['training','训练','fitness_center'],['weight','体重','monitor_weight'],['goal','目标','flag']].map(([key, label, icon]) => `<button class="advice-pill ${contexts[key] ? 'active' : ''}" onclick="data.toggleAdviceContext('${key}')" type="button"><span class="material-symbols-rounded">${icon}</span>${label}</button>`).join('')}</div>
                <small class="advice-context-hint">关闭后该维度的记录不会发给 AI，回答会更聚焦</small>
            </div>` : ''}
        `;
    },

    renderAdvicePanel() {
        const messages = this.activeRecords(this.db.health.aiAdviceChat || []);
        const visibleMessages = this.visibleAdviceMessages(messages);
        const rawDraft = this.restoreAdviceDraft();
        const draft = this.escapeHtml(rawDraft);
        const goalType = this.db.health.dietGoal?.goalType || this.db.health.goalType || 'loss';
        const isGain = goalType === 'gain';
        const baseQuicks = isGain
            ? ['分析我最近增肌进展是否正常', '根据今天饮食给我加餐建议', '帮我安排本周力量训练重点', '我今天蛋白质和碳水够不够？']
            : ['分析我最近减重停滞的原因', '根据今天饮食给我晚餐建议', '帮我调整本周训练强度', '我今天蛋白质够不够？'];
        const quicks = [...(this.planAiQuickPrompts?.() || []), ...baseQuicks].slice(0, 4);

        const macros = this.todayMacros?.() || { pro: 0, carb: 0, fat: 0 };
        const sorted = this.sortedWeights?.() || [];
        const latest = sorted.length ? sorted[sorted.length - 1] : null;
        const bodyWeight = latest ? Number(latest.weight) : 0;
        const dailyPlans = this.db?.dailyPlans || [];
        const today = new Date().toISOString().slice(0, 10);
        const weekDeficit = this.buildPlanAnalytics?.().metrics?.weekDeficit;

        const diagCtx = {
            macros, bodyWeight, goalType,
            dailyPlans, today, weekDeficit,
            weights: sorted,
        };
        const diag = this.diagnoseInsight?.(diagCtx) || null;
        const analytics = this.buildPlanAnalytics?.() || {};
        const insightCtx = { ...analytics, diag, expanded: !!this._aiInsightExpanded };
        diagCtx.diag = diag;
        this._lastInsightCtx = { ...insightCtx };

        const insightHeader = this.renderInsightHeader?.(insightCtx) || '';
        const insightBaseline = this.renderInsightBaseline?.(insightCtx) || '';
        const expandedClass = this._aiInsightExpanded ? ' expanded' : '';

        return `<div class="advice-v6-page ${this._adviceSuppressCardAnimation ? 'advice-no-enter' : ''}">
            <div class="ai-insight${expandedClass}">
                ${insightHeader}
                ${insightBaseline}
                <div class="ai-insight-body" id="aiInsightBody"${this._aiInsightExpanded ? '' : ' style="max-height:0;opacity:0;overflow:hidden"'}></div>
            </div>
            <div class="advice-v6-filter-bar">${this.renderAdviceFilterControls()}</div>
            <div class="sect-head"><span class="t">对话</span><button class="a" onclick="data.clearAdviceChat?.()" type="button">清空</button></div>
            <div class="ai-msg-list">${this.renderAdviceMessages(visibleMessages)}</div>
            <button id="adviceNewMessageBtn" class="advice-new-message-btn hidden" onclick="data.jumpAdviceToLatest()" type="button" aria-hidden="true">↓ 新消息</button>
            <div class="glass-card advice-v6-suggestions-card">
                <div class="sect-head" style="padding:0 0 8px;margin:0"><span class="t">快速建议</span></div>
                <div class="advice-v6-suggestions">${quicks.map(q => `<button onclick="data.useAdvicePrompt('${this.escapeHtml(q)}')" type="button">${this.escapeHtml(q)}</button>`).join('')}</div>
            </div>
            <div class="ai-input">
                ${this.renderAdviceModelChip()}
                <textarea id="advicePrompt" class="advice-composer-input" rows="1" placeholder="问 AI 关于训练 / 饮食..." oninput="data.onAdvicePromptInput(this)" onkeydown="data.onAdvicePromptKeydown(event)">${draft}</textarea>
                <button id="adviceSendBtn" class="ai-send" onclick="data.sendAiAdvice()" type="button" ${String(rawDraft || '').trim() ? '' : 'disabled'} aria-label="发送问题"><span class="material-symbols-rounded">send</span></button>
            </div>
        </div>`;
    },

    toggleAiInsight() {
        this._aiInsightExpanded = !this._aiInsightExpanded;
        const card = document.querySelector('.ai-insight');
        const body = document.getElementById('aiInsightBody');
        if (!card || !body) return;
        if (this._aiInsightExpanded) {
            card.classList.add('expanded');
            body.style.maxHeight = body.scrollHeight + 'px';
            body.style.opacity = '1';
            body.style.overflow = 'visible';
            if (!this._insightBodyRendered) {
                const diagCtx = this._lastInsightCtx || {};
                const diag = diagCtx.diag || null;
                const llmHtml = this.renderLocalAdvice?.(diag) || '';
                const expandableHtml = this.renderInsightExpandable?.({ ...diagCtx, llmHtml }) || '';
                body.innerHTML = expandableHtml;
                this._insightBodyRendered = true;
                requestAnimationFrame(() => { body.style.maxHeight = body.scrollHeight + 40 + 'px'; });
            }
        } else {
            card.classList.remove('expanded');
            body.style.maxHeight = '0';
            body.style.opacity = '0';
            body.style.overflow = 'hidden';
        }
    },
};

if (typeof window !== 'undefined') {
    window.advicePanel = advicePanel;
    if (window.data) advicePanel.attach(window.data);
}
