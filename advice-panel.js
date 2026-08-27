// @ts-nocheck
const ADVICE_MODEL_SCOPES = ['current', 'others', 'cached'];

function resolveAdviceModelSwipeScope(scope = 'current', deltaX = 0, width = 0, velocityX = 0) {
    const currentIndex = Math.max(0, ADVICE_MODEL_SCOPES.indexOf(scope));
    const viewportWidth = Math.max(1, Number(width) || 320);
    const distanceThreshold = Math.min(72, viewportWidth * 0.22);
    const deliberate = Math.abs(deltaX) >= distanceThreshold || Math.abs(velocityX) >= 0.55;
    if (!deliberate) return ADVICE_MODEL_SCOPES[currentIndex];
    const direction = deltaX < 0 ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(ADVICE_MODEL_SCOPES.length - 1, currentIndex + direction));
    return ADVICE_MODEL_SCOPES[nextIndex];
}

function safeAdviceFallbackTarget(meta, expectedTaskId = 'advice.chat') {
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
    try {
        const prototype = Object.getPrototypeOf(meta);
        if ((prototype && Object.getPrototypeOf(prototype))
            || Object.getOwnPropertyDescriptor(meta, '__proto__')
            || Object.getOwnPropertyDescriptor(meta, 'constructor')) return null;
        const taskDescriptor = Object.getOwnPropertyDescriptor(meta, 'taskId');
        const targetDescriptor = Object.getOwnPropertyDescriptor(meta, 'target');
        if (!targetDescriptor || !Object.prototype.hasOwnProperty.call(targetDescriptor, 'value')) return null;
        if (taskDescriptor && !Object.prototype.hasOwnProperty.call(taskDescriptor, 'value')) return null;
        const taskId = typeof taskDescriptor?.value === 'string' ? taskDescriptor.value.trim() : '';
        if ((taskDescriptor && typeof taskDescriptor.value !== 'string') || (taskId && taskId !== expectedTaskId)) return null;
        return window.aiRoutingPure?.manualFallbackTarget?.(targetDescriptor.value) || null;
    } catch {
        return null;
    }
}

const advicePanel = {
    _test: { resolveAdviceModelSwipeScope },
    DRAFT_KEY: 'rehab_advice_draft',
    SETTINGS_KEY: 'rehab_advice_settings',
    SCROLL_KEY: 'rehab_advice_scroll_top',
    PAGE_SCROLL_KEY: 'rehab_advice_page_scroll_offset',
    TEMPLATE_MANAGE_KEY: 'rehab_ai_template_manage',
    ADVICE_OUTPUT_TOKEN_BUDGET: 8192,
    ADVICE_AUTO_CONTINUE_LIMIT: 1,
    attach(target) {
        Object.assign(target, {
            DRAFT_KEY: this.DRAFT_KEY,
            SETTINGS_KEY: this.SETTINGS_KEY,
            SCROLL_KEY: this.SCROLL_KEY,
            PAGE_SCROLL_KEY: this.PAGE_SCROLL_KEY,
            ADVICE_OUTPUT_TOKEN_BUDGET: this.ADVICE_OUTPUT_TOKEN_BUDGET,
            sendAiAdvice: this.sendAiAdvice,
            cancelAiAdvice: this.cancelAiAdvice,
            stopActiveAdviceReply: this.stopActiveAdviceReply,
            bindAdviceRequestLifecycle: this.bindAdviceRequestLifecycle,
            requestAdviceWakeLock: this.requestAdviceWakeLock,
            releaseAdviceWakeLock: this.releaseAdviceWakeLock,
            requestAiAdvice: this.requestAiAdvice,
            findAdviceMessage: this.findAdviceMessage,
            pruneAdviceVersionGroup: this.pruneAdviceVersionGroup,
            isEmptyAdviceAssistantMessage: this.isEmptyAdviceAssistantMessage,
            pruneEmptyAdviceAssistantMessages: this.pruneEmptyAdviceAssistantMessages,
            deleteAiAdviceMessage: this.deleteAiAdviceMessage,
            copyAdviceMessage: this.copyAdviceMessage,
            retryAdviceFrom: this.retryAdviceFrom,
            regenerateAdvice: this.regenerateAdvice,
            openEditAdviceMessage: this.openEditAdviceMessage,
            regenerateAdviceFromEditedUser: this.regenerateAdviceFromEditedUser,
            findAssistantReplyForUser: this.findAssistantReplyForUser,
            toggleAdviceMessageExpanded: this.toggleAdviceMessageExpanded,
            captureAdviceDraft: this.captureAdviceDraft,
            adviceSavedScrollTop: this.adviceSavedScrollTop,
            adviceSavedPageScrollOffset: this.adviceSavedPageScrollOffset,
            isAdvicePageActive: this.isAdvicePageActive,
            captureAdviceScroll: this.captureAdviceScroll,
            restoreAdviceScroll: this.restoreAdviceScroll,
            resetAdviceScrollOnEntry: this.resetAdviceScrollOnEntry,
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
            updateAdviceSendState: this.updateAdviceSendState,
            adviceModelStarKey: this.adviceModelStarKey,
            isAdviceModelStarred: this.isAdviceModelStarred,
            toggleAdviceModelStar: this.toggleAdviceModelStar,
            modelShortName: this.modelShortName,
            advicePickerTaskId: this.advicePickerTaskId,
            bindAdviceModelPickerActions: this.bindAdviceModelPickerActions,
            openAdviceModelPicker: this.openAdviceModelPicker,
            closeAdviceModelPicker: this.closeAdviceModelPicker,
            chooseAdviceModel: this.chooseAdviceModel,
            setAdviceModelPickerScope: this.setAdviceModelPickerScope,
            setAdviceReasoningDepth: this.setAdviceReasoningDepth,
            renderAdviceModelPicker: this.renderAdviceModelPicker,
            setAdviceRange: this.setAdviceRange,
            toggleAdviceContext: this.toggleAdviceContext,
            setAdviceContextMode: this.setAdviceContextMode,
            toggleAdviceContextPanel: this.toggleAdviceContextPanel,
            toggleAdviceV6Insights: this.toggleAdviceV6Insights,
            toggleAdviceSearch: this.toggleAdviceSearch,
            onAdviceSearchInput: this.onAdviceSearchInput,
            clearAdviceSearch: this.clearAdviceSearch,
            toggleAdviceHistorySearchScope: this.toggleAdviceHistorySearchScope,
            adviceSearchTimestamp: this.adviceSearchTimestamp,
            adviceRecordMatchesSearch: this.adviceRecordMatchesSearch,
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
            searchAdviceWorkingSet: this.searchAdviceWorkingSet,
            mergeAdviceSearchResults: this.mergeAdviceSearchResults,
            loadAdviceWindowFromColdStore: this.loadAdviceWindowFromColdStore,
            refreshAdviceModelPicker: this.refreshAdviceModelPicker,
            refreshAdviceModelChip: this.refreshAdviceModelChip,
            renderAdviceModelChip: this.renderAdviceModelChip,
            applyPickerThemeFromCache: this.applyPickerThemeFromCache,
            autoResizeAdvicePrompt: this.autoResizeAdvicePrompt,
            adviceRangeStart: this.adviceRangeStart,
            filterByAdviceRange: this.filterByAdviceRange,
            visibleAdviceMessages: this.visibleAdviceMessages,
            prepareAdviceVirtualState: this.prepareAdviceVirtualState,
            mountAdviceVirtualList: this.mountAdviceVirtualList,
            setAdviceVirtualEmpty: this.setAdviceVirtualEmpty,
            renderAdviceVirtualShell: this.renderAdviceVirtualShell,
            renderAdviceVirtualSkeleton: this.renderAdviceVirtualSkeleton,
            resolveAdviceRecordsByIds: this.resolveAdviceRecordsByIds,
            countAdviceMessages: this.countAdviceMessages,
            resetAdviceRenderWindow: this.resetAdviceRenderWindow,
            expandAdviceRenderWindow: this.expandAdviceRenderWindow,
            adviceMessageSummary: this.adviceMessageSummary,
            adviceModelIconHtml: this.adviceModelIconHtml,
            adviceModelThemeStyle: this.adviceModelThemeStyle,
            adviceModelVisual: this.adviceModelVisual,
            adviceConversationContext: this.adviceConversationContext,
            detectAdviceFocus: this.detectAdviceFocus,
            resolveAdviceContexts: this.resolveAdviceContexts,
            buildAdviceMessages: this.buildAdviceMessages,
            parsePromptTargetDate: this.parsePromptTargetDate,
            classifyAdviceFailure: this.classifyAdviceFailure,
            renderAdviceErrorRecovery: this.renderAdviceErrorRecovery,
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
            requestInsightAiAdvice: this.requestInsightAiAdvice,
            insightCacheKey: this.insightCacheKey,
            getInsightCache: this.getInsightCache,
            setInsightCache: this.setInsightCache,
            parseTrainingClassificationResponse: this.parseTrainingClassificationResponse,
            cacheTrainingClassifications: this.cacheTrainingClassifications,
            updateInsightAiBlock: this.updateInsightAiBlock,
            resizeInsightBody: this.resizeInsightBody,
            runInsightAction: this.runInsightAction,
            setAdviceStreamUiState: this.setAdviceStreamUiState,
            toggleAdviceStreamRender: this.toggleAdviceStreamRender,
            flushAdviceStreamRender: this.flushAdviceStreamRender,
            pauseStreamForScroll: this.pauseStreamForScroll,
            resumeStreamFromScroll: this.resumeStreamFromScroll,
            showAdviceNewMessageButton: this.showAdviceNewMessageButton,
            hideAdviceNewMessageButton: this.hideAdviceNewMessageButton,
            jumpAdviceToLatest: this.jumpAdviceToLatest,
            scrollAdviceToTop: this.scrollAdviceToTop,
            scrollAdviceToBottom: this.scrollAdviceToBottom,
            scrollAdviceToPrevBubble: this.scrollAdviceToPrevBubble,
            scrollAdviceToNextBubble: this.scrollAdviceToNextBubble,
            _adviceMessageList: this._adviceMessageList,
            _adviceScrollContainer: this._adviceScrollContainer,
            _adviceCurrentScrollY: this._adviceCurrentScrollY,
            _adviceMaxScrollY: this._adviceMaxScrollY,
            _adviceSetScrollY: this._adviceSetScrollY,
            _adviceAnchorOffsetIn: this._adviceAnchorOffsetIn,
            _adviceBubbleAnchors: this._adviceBubbleAnchors,
            _adviceDebugLog: this._adviceDebugLog,
            _handleAdviceStreamScroll: this._handleAdviceStreamScroll,
            getAdviceVersionGroup: this.getAdviceVersionGroup,
            setActiveAdviceVersion: this.setActiveAdviceVersion,
            cycleAdviceVersion: this.cycleAdviceVersion,
            _isVersionActive: this._isVersionActive,
            pinAdviceVersion: this.pinAdviceVersion,
            deleteAdviceVersion: this.deleteAdviceVersion
        });
        target.adviceApi = this.createAdviceFacade(target);
        Object.assign(target, window.adviceTemplateManager || {});
        Object.assign(target, window.adviceAttachments || {});

        const volatileAdviceRange = target.adviceRange === 'all' ? 'all' : '';
        target.loadAdviceSettings?.();
        if (volatileAdviceRange) target.adviceRange = volatileAdviceRange;
        this.listenThemeChanges();
        requestAnimationFrame(() => {
            const retry = document.getElementById('aiRetryMode');
            if (retry) retry.value = this.db?.aiRetryMode || 'versioned';
        });
        target.bindAdviceRequestLifecycle?.();
    },

    createAdviceFacade(target) {
        return {
            send: (...args) => target.sendAiAdvice?.(...args),
            cancel: (...args) => target.cancelAiAdvice?.(...args),
            render: (...args) => target.renderAdvicePanel?.(...args),
            search: {
                toggle: (...args) => target.toggleAdviceSearch?.(...args),
                clear: (...args) => target.clearAdviceSearch?.(...args),
                refresh: (...args) => target.refreshAdviceSearchResults?.(...args),
                workingSet: (...args) => target.searchAdviceWorkingSet?.(...args)
            },
            modelPicker: {
                open: (...args) => target.openAdviceModelPicker?.(...args),
                close: (...args) => target.closeAdviceModelPicker?.(...args),
                choose: (...args) => target.chooseAdviceModel?.(...args),
                render: (...args) => target.renderAdviceModelPicker?.(...args),
                refresh: (...args) => target.refreshAdviceModelPicker?.(...args)
            },
            version: {
                getGroup: (...args) => target.getAdviceVersionGroup?.(...args),
                setActive: (...args) => target.setActiveAdviceVersion?.(...args),
                cycle: (...args) => target.cycleAdviceVersion?.(...args),
                pin: (...args) => target.pinAdviceVersion?.(...args),
                delete: (...args) => target.deleteAdviceVersion?.(...args)
            }
        };
    },

    bindAdviceRequestLifecycle() {
        if (this._adviceRequestLifecycleBound) return;
        this._adviceRequestLifecycleBound = true;
        document.addEventListener?.('visibilitychange', () => {
            if (!this._adviceSending || !this._adviceRequestMeta) return;
            if (document.hidden) {
                this._adviceRequestMeta.wasBackgrounded = true;
                this._adviceRequestMeta.hiddenAt = this._adviceRequestMeta.hiddenAt || new Date().toISOString();
                this._adviceRequestMeta.visibilityState = document.visibilityState || 'hidden';
            } else {
                this._adviceRequestMeta.visibleAgainAt = new Date().toISOString();
                this._adviceRequestMeta.visibilityState = document.visibilityState || 'visible';
            }
        });
        window.addEventListener?.('pagehide', () => {
            if (!this._adviceSending || !this._adviceRequestMeta) return;
            this._adviceRequestMeta.pageHidden = true;
            this._adviceRequestMeta.pageHiddenAt = new Date().toISOString();
        });
    },

    async requestAdviceWakeLock() {
        try {
            if (!navigator.wakeLock?.request) return null;
            const sentinel = await navigator.wakeLock.request('screen');
            sentinel?.addEventListener?.('release', () => {
                if (this._adviceWakeLock === sentinel) this._adviceWakeLock = null;
            }, { once: true });
            this._adviceWakeLock = sentinel;
            return sentinel;
        } catch (e) {
            try { window.errorBus?.report?.('advice.wakelock', e); } catch {}
            return null;
        }
    },

    releaseAdviceWakeLock() {
        const lock = this._adviceWakeLock;
        this._adviceWakeLock = null;
        try { lock?.release?.(); } catch {}
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

            const allowedRanges = new Set(['today', 'week', 'month']);
            if (typeof parsed.range === 'string' && allowedRanges.has(parsed.range)) {
                this.adviceRange = parsed.range;
            } else if (parsed.range === 'all') {
                this.adviceRange = 'today';
            }

            if (parsed.contexts && typeof parsed.contexts === 'object') {
                const next = { ...(this.adviceContexts || {}) };
                ['diet', 'training', 'weight', 'goal'].forEach(k => {
                    if (typeof parsed.contexts[k] === 'boolean') next[k] = parsed.contexts[k];
                });
                this.adviceContexts = next;
            }

            if (parsed.contextMode === 'auto' || parsed.contextMode === 'light' || parsed.contextMode === 'none') {
                this.adviceContextMode = parsed.contextMode;
            }

            if (typeof parsed.model === 'string' && parsed.model.trim()) {
                this.adviceModel = parsed.model;
            }
            if (Array.isArray(parsed.starredModels)) {
                this.adviceStarredModels = parsed.starredModels
                    .map(item => String(item || '').trim())
                    .filter(Boolean)
                    .slice(0, 100);
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
            const persistentRange = ['today', 'week', 'month'].includes(this.adviceRange) ? this.adviceRange : 'today';
            const payload = {
                range: persistentRange,
                contexts: {
                    diet: !!contexts.diet,
                    training: !!contexts.training,
                    weight: !!contexts.weight,
                    goal: !!contexts.goal
                },
                contextMode: ['auto', 'light', 'none'].includes(this.adviceContextMode) ? this.adviceContextMode : 'auto',
                model: this.adviceModel || '__current__',
                starredModels: Array.isArray(this.adviceStarredModels) ? this.adviceStarredModels.slice(0, 100) : [],
                templateId: this.db.aiTemplateActiveId || '',
                retryMode: this.db.aiRetryMode || 'versioned'
            };
            localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(payload));
        } catch {
            // ignore
        }
    },

    isAdviceTokenLimitFinishReason(finishReason = '') {
        return /length|max[_-]?tokens?|max[_-]?output/.test(String(finishReason || '').toLowerCase());
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
            recentRecords,
            manualExercises: context.manualExercises || context.rangeExerciseText || '',
            todayManualExercises: context.todayManualExercises || context.todayExerciseText || '',
            targetManualExercises: context.targetManualExercises || context.targetExerciseText || '',
            dailyPlans: Array.isArray(context.rangeDailyPlans) ? JSON.stringify(context.rangeDailyPlans) : (context.dailyPlans || ''),
            todayDailyPlans: Array.isArray(context.todayDailyPlans) ? JSON.stringify(context.todayDailyPlans) : '',
            targetDailyPlans: Array.isArray(context.targetDailyPlans) ? JSON.stringify(context.targetDailyPlans) : ''
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
        if (this._adviceStreamUi === 'paused' || this._adviceStreamUi === 'user-paused') return;
        this._adviceUserScrollPaused = true;
        this.setAdviceStreamUiState('streaming');
        this.showAdviceNewMessageButton();
    },

    resumeStreamFromScroll() {
        if (!this._adviceSending) return;
        if (!this._adviceUserScrollPaused) return;
        const renderer = this._activeStreamRenderer;
        if (renderer?.getState?.().mode === 'paused') renderer.resume();
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

    _adviceDebugLog(label, payload) {
        if (!this._debugToolsEnabled) return;
        window.debugTools?.logAdviceScroll?.(this, label, payload);
    },

    _adviceScrollContainer() {
        const seed = this._adviceMessageList?.()
            || document.querySelector('#ai-coach .advice-bubble');
        let el = seed;
        while (el && el !== document.body) {
            const cs = getComputedStyle(el);
            const oy = cs.overflowY;
            if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 4) {
                return el;
            }
            el = el.parentElement;
        }
        return document.scrollingElement || document.documentElement;
    },

    _adviceMessageList() {
        return document.querySelector('#ai-coach .advice-v6-chat-list')
            || document.querySelector('.advice-chat-list')
            || document.querySelector('#ai-coach .ai-msg-list');
    },

    _adviceCurrentScrollY(scroller) {
        if (!scroller) return 0;
        if (scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body) {
            return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
        }
        return scroller.scrollTop || 0;
    },

    _adviceMaxScrollY(scroller) {
        if (!scroller) return 0;
        if (scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body) {
            return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        }
        return Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    },

    _adviceSetScrollY(scroller, y, smooth = true) {
        if (!scroller) return;
        const target = Math.max(0, Math.min(this._adviceMaxScrollY(scroller), Math.round(y)));
        const isDoc = scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body;
        const behavior = smooth ? 'smooth' : 'auto';
        if (isDoc) {
            try { window.scrollTo({ top: target, behavior }); } catch { window.scrollTo(0, target); }
        } else if (typeof scroller.scrollTo === 'function') {
            try { scroller.scrollTo({ top: target, behavior }); } catch { scroller.scrollTop = target; }
        } else {
            scroller.scrollTop = target;
        }
        requestAnimationFrame(() => {
            const now = isDoc
                ? (window.scrollY || document.documentElement.scrollTop || 0)
                : (scroller.scrollTop || 0);
            if (Math.abs(now - target) > 2) {
                if (isDoc) {
                    window.scrollTo(0, target);
                    document.documentElement.scrollTop = target;
                    document.body.scrollTop = target;
                } else {
                    scroller.scrollTop = target;
                }
            }
        });
    },

    _adviceAnchorOffsetIn(scroller, anchor) {
        if (!scroller || !anchor) return 0;
        if (scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body) {
            return anchor.getBoundingClientRect().top + (window.scrollY || 0);
        }
        const scrollerRect = scroller.getBoundingClientRect();
        return anchor.getBoundingClientRect().top - scrollerRect.top + (scroller.scrollTop || 0);
    },

    _adviceBubbleAnchors() {
        // Skip anchors that are inside collapsed date groups or hidden
        // (display:none -> rect 全 0). They polluted the offsets array and
        // caused the prev/next loop to break on a phantom 0 before reaching
        // the real visible bubbles.
        const isVisible = (el) => {
            if (el.closest && el.closest('.advice-date-group.collapsed')) return false;
            const r = el.getBoundingClientRect();
            return !!(r.width || r.height);
        };
        const userBubbles = Array.from(document.querySelectorAll('#ai-coach .advice-bubble.user')).filter(isVisible);
        if (userBubbles.length) return userBubbles;
        return Array.from(document.querySelectorAll('#ai-coach .advice-bubble')).filter(isVisible);
    },

    scrollAdviceToTop() {
        const scroller = this._adviceScrollContainer();
        const before = this._adviceCurrentScrollY(scroller);
        this._adviceSetScrollY(scroller, 0, true);
        setTimeout(() => {
            this._adviceDebugLog('top', {
                scrollerTag: scroller?.id || scroller?.tagName,
                scrollerScrollTop: scroller?.scrollTop,
                windowScrollY: window.scrollY,
                documentScrollTop: document.documentElement.scrollTop,
                currentY: before,
                targetOffset: 0,
                afterScrollerScrollTop: scroller?.scrollTop,
                afterWindowScrollY: window.scrollY,
            });
        }, 200);
    },

    scrollAdviceToBottom() {
        const scroller = this._adviceScrollContainer();
        const max = this._adviceMaxScrollY(scroller);
        this._adviceSetScrollY(scroller, max, true);
        setTimeout(() => {
            this._adviceDebugLog('bottom', {
                scrollerTag: scroller?.id || scroller?.tagName,
                scrollerScrollTop: scroller?.scrollTop,
                windowScrollY: window.scrollY,
                currentY: this._adviceCurrentScrollY(scroller),
                targetOffset: max,
                afterScrollerScrollTop: scroller?.scrollTop,
                afterWindowScrollY: window.scrollY,
            });
        }, 200);
    },

    scrollAdviceToPrevBubble() {
        const anchors = this._adviceBubbleAnchors();
        const scroller = this._adviceScrollContainer();
        const currentY = this._adviceCurrentScrollY(scroller);
        const offsets = anchors.map(el => Math.round(this._adviceAnchorOffsetIn(scroller, el)));
        const rectTops = anchors.map(el => Math.round(el.getBoundingClientRect().top));
        if (!anchors.length) {
            this._adviceDebugLog('prev:no-anchors', {
                scrollerTag: scroller?.id || scroller?.tagName,
                scrollerScrollTop: scroller?.scrollTop,
                windowScrollY: window.scrollY,
                currentY, offsets, rectTops, targetOffset: null,
            });
            return this.scrollAdviceToTop();
        }
        let targetOffset = null;
        for (const offset of offsets) {
            if (offset < currentY - 24 && (targetOffset == null || offset > targetOffset)) {
                targetOffset = offset;
            }
        }
        this._adviceDebugLog('prev', {
            scrollerTag: scroller?.id || scroller?.tagName,
            scrollerScrollTop: scroller?.scrollTop,
            windowScrollY: window.scrollY,
            documentScrollTop: document.documentElement.scrollTop,
            bodyScrollTop: document.body.scrollTop,
            innerHeight: window.innerHeight,
            currentY, offsets, rectTops, targetOffset,
        });
        if (targetOffset == null) {
            this._adviceSetScrollY(scroller, 0, true);
            return;
        }
        this._adviceSetScrollY(scroller, targetOffset, true);
        // Verify after settle
        setTimeout(() => {
            this._adviceDebugLog('prev:after', {
                scrollerTag: scroller?.id || scroller?.tagName,
                scrollerScrollTop: scroller?.scrollTop,
                windowScrollY: window.scrollY,
                currentY: this._adviceCurrentScrollY(scroller),
                targetOffset,
            });
        }, 500);
    },

    scrollAdviceToNextBubble() {
        const anchors = this._adviceBubbleAnchors();
        const scroller = this._adviceScrollContainer();
        const currentY = this._adviceCurrentScrollY(scroller);
        const offsets = anchors.map(el => Math.round(this._adviceAnchorOffsetIn(scroller, el)));
        const rectTops = anchors.map(el => Math.round(el.getBoundingClientRect().top));
        if (!anchors.length) {
            this._adviceDebugLog('next:no-anchors', {
                scrollerTag: scroller?.id || scroller?.tagName,
                scrollerScrollTop: scroller?.scrollTop,
                windowScrollY: window.scrollY,
                currentY, offsets, rectTops, targetOffset: null,
            });
            return this.scrollAdviceToBottom();
        }
        let targetOffset = null;
        for (const offset of offsets) {
            if (offset > currentY + 24 && (targetOffset == null || offset < targetOffset)) {
                targetOffset = offset;
            }
        }
        this._adviceDebugLog('next', {
            scrollerTag: scroller?.id || scroller?.tagName,
            scrollerScrollTop: scroller?.scrollTop,
            windowScrollY: window.scrollY,
            documentScrollTop: document.documentElement.scrollTop,
            bodyScrollTop: document.body.scrollTop,
            innerHeight: window.innerHeight,
            currentY, offsets, rectTops, targetOffset,
        });
        if (targetOffset == null) {
            this._adviceSetScrollY(scroller, this._adviceMaxScrollY(scroller), true);
            return;
        }
        this._adviceSetScrollY(scroller, targetOffset, true);
        setTimeout(() => {
            this._adviceDebugLog('next:after', {
                scrollerTag: scroller?.id || scroller?.tagName,
                scrollerScrollTop: scroller?.scrollTop,
                windowScrollY: window.scrollY,
                currentY: this._adviceCurrentScrollY(scroller),
                targetOffset,
            });
        }, 500);
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

    toggleAdviceMessageExpanded(messageId = '') {
        if (!messageId) return;
        this._expandedAdviceMessageIds = this._expandedAdviceMessageIds || new Set();
        if (this._expandedAdviceMessageIds.has(messageId)) this._expandedAdviceMessageIds.delete(messageId);
        else this._expandedAdviceMessageIds.add(messageId);
        this.preserveAdviceScroll?.(() => this.refreshAdviceSearchResults?.());
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

    isAdvicePageActive(el = this._adviceMessageList?.()) {
        const page = el?.closest?.('.page');
        return !page || page.classList.contains('active');
    },

    captureAdviceScroll() {
        const list = this._adviceMessageList?.();
        if (!list) return;
        if (!this.isAdvicePageActive(list)) return;
        const scroller = this._adviceScrollContainer();
        const maxTop = this._adviceMaxScrollY(scroller);
        const top = Math.max(0, Math.min(this._adviceCurrentScrollY(scroller), maxTop));
        this._adviceScrollTop = top;
        try { sessionStorage.setItem(this.SCROLL_KEY, String(top)); } catch {}

        const card = list.closest('.advice-main-card');
        if (!card) return;
        const pageOffset = Math.max(0, window.scrollY - (card.getBoundingClientRect().top + window.scrollY));
        this._advicePageScrollOffset = pageOffset;
        try { sessionStorage.setItem(this.PAGE_SCROLL_KEY, String(pageOffset)); } catch {}
    },

    restoreAdviceScroll() {
        const list = this._adviceMessageList?.();
        if (!list) return;
        if (!this.isAdvicePageActive(list)) return;
        if (this._adviceResetOnNextRender) {
            this._adviceResetOnNextRender = false;
            this.resetAdviceScrollOnEntry?.();
            return;
        }
        const savedTop = this.adviceSavedScrollTop();
        if (Number.isFinite(savedTop)) {
            const scroller = this._adviceScrollContainer();
            this._adviceSetScrollY(scroller, Math.max(0, Math.min(savedTop, this._adviceMaxScrollY(scroller))), false);
        }

        const savedPageOffset = this.adviceSavedPageScrollOffset();
        const card = list.closest('.advice-main-card');
        if (!Number.isFinite(savedPageOffset) || !card) return;
        const cardTop = card.getBoundingClientRect().top + window.scrollY;
        const maxWindowTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        window.scrollTo({ top: Math.min(cardTop + savedPageOffset, maxWindowTop), behavior: 'auto' });
    },

    resetAdviceScrollOnEntry() {
        const list = this._adviceMessageList?.();
        if (list && !this.isAdvicePageActive(list)) return;
        this._adviceResetOnNextRender = false;
        this._adviceScrollTop = 0;
        this._advicePageScrollOffset = 0;
        try { sessionStorage.removeItem(this.SCROLL_KEY); } catch {}
        try { sessionStorage.removeItem(this.PAGE_SCROLL_KEY); } catch {}

        const scroller = this._adviceScrollContainer?.();
        const documentScroller = document.scrollingElement || document.documentElement || document.body;
        if (scroller) this._adviceSetScrollY?.(scroller, 0, false);
        if (documentScroller && documentScroller !== scroller) this._adviceSetScrollY?.(documentScroller, 0, false);

        this._adviceTopChromeOffset = 0;
        this._adviceTopChromeLastScrollTop = 0;
        if (list) {
            if (typeof list.scrollTop === 'number') list.scrollTop = 0;
            this.applyAdviceTopChromeOffset?.(list, 0);
            this.syncAdviceTopChromeToScroll?.(list);
        }
    },

    syncAdviceTopChromeToScroll(list = this._adviceMessageList?.()) {
        if (!list || !this.isAdvicePageActive(list)) return;
        const maxOffset = this.measureAdviceTopChrome(list);
        const nextOffset = Math.min(Math.max(0, list.scrollTop || 0), maxOffset);
        this._adviceTopChromeHoldUntil = 0;
        this._adviceTopChromeLastScrollTop = list.scrollTop || 0;
        this.applyAdviceTopChromeOffset(list, nextOffset);
    },

    bindAdviceScrollListener() {
        const list = this._adviceMessageList?.();
        if (!list) return;
        if (!this.isAdvicePageActive(list)) return;
        const scroller = this._adviceScrollContainer();
        if (this._adviceScrollEl === scroller) return;
        if (this._adviceScrollEl && this._adviceOnScroll) {
            this._adviceScrollEl.removeEventListener('scroll', this._adviceOnScroll);
        }
        if (this._adviceScrollEl && this._adviceOnUserIntent) {
            this._adviceScrollEl.removeEventListener('wheel', this._adviceOnUserIntent);
            this._adviceScrollEl.removeEventListener('keydown', this._adviceOnUserIntent);
        }
        if (this._adviceScrollEl && this._adviceOnTouchIntent) {
            this._adviceScrollEl.removeEventListener('touchstart', this._adviceOnTouchIntent);
            this._adviceScrollEl.removeEventListener('touchmove', this._adviceOnTouchIntent);
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
            this._handleAdviceStreamScroll(scroller);
        };
        this._adviceOnUserIntent = event => {
            this._adviceUserScrollIntent = true;
            this._handleAdviceTopChromePull(list, event);
            clearTimeout(this._adviceUserScrollIntentTimer);
            this._adviceUserScrollIntentTimer = setTimeout(() => {
                this._adviceUserScrollIntent = false;
            }, 600);
        };
        this._adviceOnTouchIntent = () => {
            this._adviceUserScrollIntent = true;
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
        scroller.addEventListener('scroll', this._adviceOnScroll, { passive: true });
        scroller.addEventListener('wheel', this._adviceOnUserIntent, { passive: true });
        scroller.addEventListener('keydown', this._adviceOnUserIntent, { passive: true });
        scroller.addEventListener('touchstart', this._adviceOnTouchIntent, { passive: true });
        scroller.addEventListener('touchmove', this._adviceOnTouchIntent, { passive: true });
        this._adviceScrollEl = scroller;
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

    measureAdviceTopChrome(list = this._adviceMessageList?.()) {
        const chrome = list?.closest?.('.advice-chat-shell')?.querySelector?.('.advice-top-chrome');
        const inner = chrome?.querySelector?.('.advice-top-chrome-inner');
        if (!chrome || !inner) return 0;
        const height = Math.ceil(inner.getBoundingClientRect().height || inner.scrollHeight || 0);
        chrome.style.setProperty('--advice-top-chrome-full', `${height}px`);
        return height;
    },

    applyAdviceTopChromeOffset(list = this._adviceMessageList?.(), offset = 0) {
        const chrome = list?.closest?.('.advice-chat-shell')?.querySelector?.('.advice-top-chrome');
        if (!chrome) return;
        const maxOffset = this.measureAdviceTopChrome(list);
        const next = Math.max(0, Math.min(Number(offset) || 0, maxOffset));
        this._adviceTopChromeOffset = next;
        chrome.style.setProperty('--advice-top-chrome-visible', `${Math.max(0, maxOffset - next)}px`);
        chrome.style.setProperty('--advice-top-chrome-offset', `${-next}px`);
        chrome.classList.toggle('is-collapsed', next >= maxOffset - 1);
    },

    holdAdviceTopChrome(list = this._adviceMessageList?.(), expand = true) {
        this._adviceTopChromeHoldUntil = performance.now() + 900;
        this._adviceTopChromeLastScrollTop = list?.scrollTop || 0;
        this.applyAdviceTopChromeOffset(list, expand ? 0 : this._adviceTopChromeOffset || 0);
    },

    rerenderAdvicePanel(options = {}) {
        const { expandChrome = false, focusSearch = false, refreshMessages = true } = options;
        this._adviceTopChromeHoldUntil = performance.now() + 900;
        const list = this._adviceMessageList?.();
        const chromeInner = document.querySelector('.advice-top-chrome-inner');
        if (!list || !chromeInner) {
            this.renderAiCoachPage?.() || this.renderRoutines?.();
            requestAnimationFrame(() => this.refreshAdviceSearchResults?.());
            return;
        }
        const measureScroll = (targetList = list) => {
            let scroller = targetList;
            try { scroller = this._adviceScrollContainer?.() || targetList; } catch { scroller = targetList; }
            const top = Number(this._adviceCurrentScrollY?.(scroller));
            const max = Number(this._adviceMaxScrollY?.(scroller));
            if (Number.isFinite(top) && Number.isFinite(max)) return { scroller, top, max };
            return {
                scroller: targetList,
                top: targetList?.scrollTop || 0,
                max: Math.max(0, (targetList?.scrollHeight || 0) - (targetList?.clientHeight || 0))
            };
        };
        const previousScroll = measureScroll(list);
        const shouldStickToBottom = !!this._adviceFollowStream || (previousScroll.max - previousScroll.top) < 180;
        const restoreScrollAfterRefresh = () => {
            const currentList = this._adviceMessageList?.() || list;
            if (!currentList) return;
            const currentScroll = measureScroll(currentList);
            const target = shouldStickToBottom
                ? currentScroll.max
                : Math.max(0, Math.min(previousScroll.top, currentScroll.max));
            try {
                if (currentScroll.scroller && typeof this._adviceSetScrollY === 'function') {
                    this._adviceSetScrollY(currentScroll.scroller, target, false);
                } else if (currentScroll.scroller) {
                    currentScroll.scroller.scrollTop = target;
                }
            } catch {
                if (currentList) currentList.scrollTop = target;
            }
            this.syncAdviceTopChromeToScroll?.(currentList);
        };
        chromeInner.innerHTML = this.renderAdviceTopChromeInner();
        const filterBar = document.querySelector('.advice-v6-filter-bar');
        if (filterBar) filterBar.innerHTML = this.renderAdviceFilterControls();
        this.refreshAdviceModelChip?.();
        if (refreshMessages) {
            const refreshResult = this.refreshAdviceSearchResults();
            const scheduleRestore = () => requestAnimationFrame(restoreScrollAfterRefresh);
            Promise.resolve(refreshResult).then(scheduleRestore, scheduleRestore);
        }
        requestAnimationFrame(() => {
            this.autoResizeAdvicePrompt?.();
            this.bindAdviceAttachmentControls?.();
            this.updateAdviceSendState?.();
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
        if (typeof this.updateAdviceSendState === 'function') this.updateAdviceSendState();
        else {
            const send = document.getElementById('adviceSendBtn');
            if (send) send.disabled = !el.value.trim() || !!this._adviceSending;
        }
    },

    updateAdviceSendState() {
        const send = document.getElementById('adviceSendBtn');
        const input = document.getElementById('advicePrompt');
        if (!send) return;
        const icon = send.querySelector('.material-symbols-rounded');
        const hasAttachment = (this._adviceAttachments || []).some(att => att && att.status !== 'failed' && (att.kind === 'image' || att.readable));
        const sending = !!this._adviceSending;
        send.disabled = sending ? false : !(String(input?.value || '').trim() || hasAttachment);
        send.classList.toggle('is-stopping', sending);
        send.setAttribute('aria-label', sending ? '停止生成' : '发送问题');
        send.title = sending ? '停止生成' : '发送问题';
        send.setAttribute('onclick', sending ? 'data.cancelAiAdvice()' : 'data.sendAiAdvice()');
        if (icon) icon.textContent = sending ? 'stop' : 'send';
    },

    cancelAiAdvice() {
        if (!this._adviceSending) return false;
        this._adviceCancelledByUser = true;
        if (this._adviceRequestMeta) {
            this._adviceRequestMeta.cancelledByUser = true;
            this._adviceRequestMeta.cancelledAt = new Date().toISOString();
        }
        try {
            const reason = typeof DOMException === 'function'
                ? new DOMException('User stopped AI advice generation', 'AbortError')
                : undefined;
            this._adviceAbortController?.abort?.(reason);
        } catch {
            try { this._adviceAbortController?.abort?.(); } catch {}
        }
        this.stopActiveAdviceReply?.('user');
        this.updateAdviceSendState?.();
        window.haptics?.light?.();
        return true;
    },

    stopActiveAdviceReply(reason = 'user') {
        const pendingId = this._activeAdvicePendingId;
        if (!pendingId) return false;
        const idx = this.db.health.aiAdviceChat.findIndex(msg => msg.id === pendingId);
        const previous = idx >= 0 ? this.db.health.aiAdviceChat[idx] : null;
        if (!previous || previous.stopped) return false;
        const renderer = this._streamRenderers?.[pendingId] || this._activeStreamRenderer;
        const rendererState = renderer?.getState?.() || null;
        const partial = String(rendererState?.shown || previous.content || '').trim();
        try { renderer?.destroy?.(); } catch {}
        if (this._streamRenderers) delete this._streamRenderers[pendingId];
        this._activeStreamRenderer = null;
        this.db.health.aiAdviceChat[idx] = {
            ...previous,
            content: partial || '已停止生成。',
            pending: false,
            stopped: true,
            stoppedAt: new Date().toISOString(),
            stopReason: reason,
            error: false,
            errorInfo: {
                ...(this._adviceRequestMeta || {}),
                type: reason === 'user' ? 'user_cancelled' : 'aborted',
                message: reason === 'user' ? '用户主动停止生成' : '请求已中断'
            },
            updatedAt: Date.now()
        };
        this._adviceSending = false;
        this.setAdviceStreamUiState?.('idle');
        this.releaseAdviceWakeLock?.();
        this.save();
        this.rerenderAdvicePanel?.({ refreshMessages: true });
        return true;
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
        el.classList.toggle('is-scrollable', el.scrollHeight > nextHeight + 1);
    },

    adviceModelStarKey(profileId = '', model = '') {
        return `${String(profileId || '').trim()}::${String(model || '').trim()}`;
    },

    adviceModelStarProfileId(identity = '') {
        const value = String(identity || '').trim();
        if ((ai.cfg.profiles || []).some(profile => profile.id === value)) return value;
        const matches = (ai.cfg.profiles || []).filter(profile => ai.normalizeProvider?.(profile.provider) === ai.normalizeProvider?.(value));
        return matches.length === 1 ? matches[0].id : value;
    },

    isAdviceModelStarred(profileId = '', model = '') {
        if (!model) return false;
        const starred = new Set(Array.isArray(this.adviceStarredModels) ? this.adviceStarredModels : []);
        try { (JSON.parse(localStorage.getItem('rehab.ai.modelFavorites.v2') || '[]') || []).forEach(key => starred.add(key)); } catch (_) { /* ignore invalid local preference */ }
        const profile = (ai.cfg.profiles || []).find(item => item.id === profileId);
        const legacy = profile ? `${ai.normalizeProvider?.(profile.provider) || profile.provider}::${String(model).trim()}` : '';
        return starred.has(this.adviceModelStarKey(profileId, model)) || (legacy && starred.has(legacy));
    },

    toggleAdviceModelStar(profileId = '', model = '') {
        if (!model) return false;
        const key = this.adviceModelStarKey(advicePanel.adviceModelStarProfileId.call(this, profileId), model);
        const starred = new Set(Array.isArray(this.adviceStarredModels) ? this.adviceStarredModels : []);
        const next = !starred.has(key);
        if (next) starred.add(key);
        else starred.delete(key);
        this.adviceStarredModels = Array.from(starred).slice(0, 100);
        try { localStorage.setItem('rehab.ai.modelFavorites.v2', JSON.stringify(this.adviceStarredModels)); } catch (_) { /* storage may be unavailable */ }
        this.saveAdviceSettings();
        const content = document.getElementById('aiModelPickerContent');
        if (content) {
            content.innerHTML = this.renderAdviceModelPicker();
            this.bindAdviceModelPickerActions(content);
        }
        window.haptics?.light?.();
        return next;
    },

    modelShortName(model = '') {
        const text = String(model || '模型');
        return text.length > 18 ? `${text.slice(0, 16)}…` : text;
    },

    renderAdviceModelChip() {
        const taskId = this.advicePickerTaskId?.() || 'advice.chat';
        const effective = ai.resolveTaskConfig?.(taskId) || ai.getEffectiveConfig?.() || ai.cfg;
        const route = ai.getTaskRoute?.(taskId) || {};
        const isOverride = !!ai.cfg.taskRoutes?.[taskId];
        const model = effective.model || '模型';
        const label = `${effective.provider || 'AI'} ${model}`;
        const cached = (ai.models || []).find(item => item.profileId === effective.profileId && item.id === model) || null;
        const visual = this.adviceModelVisual(model, effective.provider, cached?.iconKey || cached?.vendor || '');
        const style = this.adviceModelThemeStyle(visual);
        return `<button class="advice-model-picker advice-model-chip advice-model-${visual.key} ${isOverride ? 'is-override' : ''}" ${style ? `style="${this.escapeHtml(style)}"` : ''} onclick="data.openAdviceModelPicker()" type="button" aria-label="切换分析模型：${this.escapeHtml(label)}" title="切换分析模型：${this.escapeHtml(label)}">
            <span class="advice-model-mark">${this.adviceModelIconHtml(visual)}</span>
        </button>`;
    },

    renderAdviceReasoningChip() {
        if (typeof ai === 'undefined') return '';
        const taskId = this.advicePickerTaskId?.() || 'advice.chat';
        const depth = ai.getTaskRoute?.(taskId)?.reasoningDepth || 'auto';
        const visual = window.aiTaskSettings?.reasoningMeta?.(depth) || { icon: 'psychology', label: '\u63a8\u7406' };
        return `<button class="advice-reasoning-chip is-${this.escapeHtml(depth)}" onclick="window.advicePanel?.openAdviceReasoningPicker?.call(data)" type="button" aria-label="\u63a8\u7406\u5f3a\u5ea6\uff1a${visual.label}" title="\u63a8\u7406\u5f3a\u5ea6\uff1a${visual.label}"><span class="material-symbols-rounded">${visual.icon}</span></button>`;
    },

    advicePickerTaskId() {
        return (this._adviceAttachments || []).some(att => att?.kind === 'image' && att.status !== 'failed') ? 'advice.vision' : 'advice.chat';
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
        const card = modal.querySelector('.md-modal-sheet-card');
        const heading = modal.querySelector('.md-modal-head strong');
        if (heading) heading.textContent = '\u9009\u62e9\u672c\u6b21\u6a21\u578b';
        modal.classList.remove('ai-task-quick-sheet');
        modal.classList.add('advice-model-picker-sheet');
        card?.classList.remove('ai-task-quick-card');
        card?.classList.add('advice-model-picker-card');
        content.className = 'advice-model-picker-content';
        content.innerHTML = this.renderAdviceModelPicker();
        this.bindAdviceModelPickerActions(content);
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        window.navStack?.open?.('modal', 'aiModelPickerSheet', () => this.closeAdviceModelPicker(true));
    },

    closeAdviceModelPicker(direct) {
        if (!direct && window.navStack?.requestClose?.('modal', 'aiModelPickerSheet')) return;
        const modal = document.getElementById('aiModelPickerSheet');
        modal?.classList.add('hidden');
        modal?.classList.remove('advice-model-picker-sheet');
        modal?.setAttribute('aria-hidden', 'true');
        modal?.querySelector('.md-modal-sheet-card')?.classList.remove('advice-model-picker-card');
        document.getElementById('aiModelPickerContent')?.classList.remove('advice-model-picker-content');
        return true;
    },

    setAdviceModelPickerScope(scope = 'current') {
        this.adviceModelPickerScope = ADVICE_MODEL_SCOPES.includes(scope) ? scope : 'current';
        const content = document.getElementById('aiModelPickerContent');
        const body = content?.querySelector('.model-picker-body');
        if (!body) return;
        const index = ADVICE_MODEL_SCOPES.indexOf(this.adviceModelPickerScope);
        body.style.setProperty('--model-picker-scope-index', String(index));
        body.style.setProperty('--model-picker-tab-progress', String(index));
        body.style.setProperty('--model-picker-drag-x', '0px');
        body.querySelectorAll('[data-advice-model-scope]').forEach(tab => {
            const active = tab.getAttribute('data-advice-model-scope') === this.adviceModelPickerScope;
            tab.classList.toggle('active', active);
            tab.setAttribute('aria-selected', String(active));
            tab.tabIndex = active ? 0 : -1;
        });
        body.querySelectorAll('[data-advice-model-page]').forEach(page => {
            const active = page.getAttribute('data-advice-model-page') === this.adviceModelPickerScope;
            page.setAttribute('aria-hidden', String(!active));
            page.toggleAttribute('inert', !active);
        });
        const region = body.querySelector('[data-advice-model-swipe]');
        const page = body.querySelector(`[data-advice-model-page="${this.adviceModelPickerScope}"]`);
        if (region && page) region.style.height = `${page.scrollHeight}px`;
    },

    bindAdviceModelPickerActions(root) {
        if (!root) return;
        requestAnimationFrame(() => this.setAdviceModelPickerScope(this.adviceModelPickerScope || 'current'));
        if (root.dataset.adviceModelPickerActionsBound === '1') return;
        root.dataset.adviceModelPickerActionsBound = '1';
        root.addEventListener('click', (event) => {
            if (Date.now() < (this._adviceModelPickerSuppressClickUntil || 0)) {
                event.preventDefault();
                event.stopPropagation?.();
                return;
            }
            const tab = event.target?.closest?.('[data-advice-model-scope]');
            if (tab && root.contains(tab)) {
                event.preventDefault();
                this.setAdviceModelPickerScope(tab.getAttribute('data-advice-model-scope') || 'current');
                return;
            }
            const star = event.target?.closest?.('[data-advice-model-action="star"]');
            if (star && root.contains(star)) {
                event.preventDefault();
                event.stopPropagation?.();
                this.toggleAdviceModelStar(
                    star.getAttribute('data-profile-id') || star.getAttribute('data-provider') || '',
                    star.getAttribute('data-model') || ''
                );
                return;
            }
            const row = event.target?.closest?.('[data-advice-model-action="choose"]');
            if (!row || !root.contains(row)) return;
            if (row.getAttribute('aria-disabled') === 'true') return;
            event.preventDefault();
            this.chooseAdviceModel(
                row.getAttribute('data-profile-id') || '',
                row.getAttribute('data-provider') || '',
                row.getAttribute('data-model') || ''
            );
        });
        root.addEventListener('keydown', (event) => {
            const row = event.target?.closest?.('[data-advice-model-action="choose"]');
            if (!row || !root.contains(row) || !['Enter', ' '].includes(event.key)) return;
            event.preventDefault();
            row.click();
        });

        let swipe = null;
        root.addEventListener('pointerdown', (event) => {
            const region = event.target?.closest?.('[data-advice-model-swipe]');
            if (!region || !root.contains(region) || (event.button !== undefined && event.button !== 0)) return;
            const body = region.closest('.model-picker-body');
            const rect = region.getBoundingClientRect();
            swipe = {
                pointerId: event.pointerId,
                region,
                body,
                scope: this.adviceModelPickerScope || 'current',
                startX: event.clientX,
                startY: event.clientY,
                lastX: event.clientX,
                lastAt: performance.now(),
                velocityX: 0,
                width: Math.max(1, rect.width),
                axis: '',
                deltaX: 0
            };
            region.setPointerCapture?.(event.pointerId);
        });
        root.addEventListener('pointermove', (event) => {
            if (!swipe || event.pointerId !== swipe.pointerId) return;
            const rawX = event.clientX - swipe.startX;
            const rawY = event.clientY - swipe.startY;
            if (!swipe.axis && Math.max(Math.abs(rawX), Math.abs(rawY)) >= 6) {
                swipe.axis = Math.abs(rawX) > Math.abs(rawY) * 1.15 ? 'x' : 'y';
            }
            if (swipe.axis !== 'x') return;
            event.preventDefault();
            const now = performance.now();
            const dt = Math.max(1, now - swipe.lastAt);
            swipe.velocityX = (event.clientX - swipe.lastX) / dt;
            swipe.lastX = event.clientX;
            swipe.lastAt = now;
            const index = ADVICE_MODEL_SCOPES.indexOf(swipe.scope);
            const atBoundary = (index === 0 && rawX > 0) || (index === ADVICE_MODEL_SCOPES.length - 1 && rawX < 0);
            swipe.deltaX = atBoundary ? rawX * 0.28 : rawX;
            swipe.region.classList.add('is-dragging');
            swipe.body.classList.add('is-dragging');
            swipe.body.style.setProperty('--model-picker-drag-x', `${swipe.deltaX}px`);
            const progress = Math.max(0, Math.min(ADVICE_MODEL_SCOPES.length - 1, index - swipe.deltaX / swipe.width));
            swipe.body.style.setProperty('--model-picker-tab-progress', String(progress));
        }, { passive: false });
        const finishSwipe = (event, cancelled = false) => {
            if (!swipe || event.pointerId !== swipe.pointerId) return;
            const current = swipe;
            swipe = null;
            current.region.classList.remove('is-dragging');
            current.body.classList.remove('is-dragging');
            try { current.region.releasePointerCapture?.(event.pointerId); } catch (_) { /* pointer capture may already be released */ }
            const next = cancelled || current.axis !== 'x'
                ? current.scope
                : resolveAdviceModelSwipeScope(current.scope, current.deltaX, current.width, current.velocityX);
            if (current.axis === 'x' && Math.abs(current.deltaX) > 8) {
                this._adviceModelPickerSuppressClickUntil = Date.now() + 350;
            }
            this.setAdviceModelPickerScope(next);
            if (next !== current.scope) window.haptics?.selection?.();
        };
        root.addEventListener('pointerup', event => finishSwipe(event));
        root.addEventListener('pointercancel', event => finishSwipe(event, true));
    },

    chooseAdviceModel(profileId, provider, model) {
        const profile = (ai.cfg.profiles || []).find(p => p.id === profileId) || null;
        if (!profile || !ai.apiKeyFor(profile.id)) {
            toast.show('该提供商未配置 API Key', 'error');
            return;
        }
        const taskId = this.advicePickerTaskId();
        const current = ai.getTaskRoute?.(taskId) || {};
        const primary = { profileId, modelId: model };
        return Promise.resolve(ai.setTaskRoute?.(taskId, { ...current, primary })).then(() => {
            window.aiTaskSettings?.rememberRecent?.(taskId, primary);
            this.closeAdviceModelPicker();
            window.haptics?.light?.();
            this.refreshAdviceModelChip?.();
            this.rerenderAdvicePanel?.();
        });
    },

    openAdviceReasoningPicker() {
        const route = ai.getTaskRoute?.(this.advicePickerTaskId()) || {};
        window.aiTaskSettings?.openReasoningMenu?.(route, [], next => this.setAdviceReasoningDepth(next.reasoningDepth));
    },

    setAdviceReasoningDepth(depth = 'auto') {
        const taskId = this.advicePickerTaskId();
        const current = ai.getTaskRoute?.(taskId) || {};
        Promise.resolve(ai.setTaskRoute?.(taskId, { ...current, reasoningDepth: depth })).then(() => {
            this.closeAdviceModelPicker?.();
            this.refreshAdviceModelChip?.();
            this.rerenderAdvicePanel?.();
        });
    },

    renderAdviceModelPicker() {
        const taskId = this.advicePickerTaskId();
        const effective = ai.resolveTaskConfig?.(taskId) || ai.getEffectiveConfig?.() || ai.cfg;
        const scope = this.adviceModelPickerScope || 'current';
        const favoriteOrder = new Map(Array.from(window.aiTaskSettings?.favoriteKeys?.() || [], (key, index) => [key, index]));
        const recentOrder = new Map((window.aiTaskSettings?.recentKeysForTask?.(taskId) || []).map((key, index) => [key, index]));
        const normalizeProvider = ai.normalizeProvider.bind(ai);
        const activeProfileId = String(effective.profileId || ai.cfg.activeProfileId || '');
        const selectableModels = typeof ai.listSelectableModels === 'function'
            ? ai.listSelectableModels(taskId)
            : (ai.models || []).filter(model => ai.isModelEnabled?.(model) !== false).map(model => {
                const profile = (ai.cfg.profiles || []).find(item => item.id === model.profileId)
                    || (ai.cfg.profiles || []).find(item => normalizeProvider(item.provider) === normalizeProvider(model.provider));
                return {
                    profileId: profile?.id || '',
                    profileName: profile?.name || '',
                    provider: model.provider || profile?.provider || 'openai',
                    modelId: model.id,
                    displayName: model.displayName || model.id,
                    capabilities: model.capabilities || { vision: !!model.vision },
                    sizeTier: model.sizeTier || 'unknown',
                    iconKey: model.iconKey || ''
                };
            });
        const rawRows = selectableModels.map(model => ({
            profileId: model.profileId,
            profileName: model.profileName || '',
            provider: normalizeProvider(model.provider || 'openai'),
            model: model.modelId || model.model,
            label: model.displayName || model.modelId || model.model,
            iconKey: model.iconKey || '',
            tag: model.capabilities?.vision ? 'vision' : (model.sizeTier && model.sizeTier !== 'unknown' ? model.sizeTier : 'cached'),
            disabled: false
        }));
        if (effective.model && !rawRows.some(row => row.profileId === activeProfileId && row.model === effective.model)) {
            rawRows.push({
                profileId: activeProfileId,
                profileName: (ai.cfg.profiles || []).find(profile => profile.id === activeProfileId)?.name || '',
                provider: normalizeProvider(effective.provider || ai.cfg.provider || 'openai'),
                model: effective.model,
                label: effective.model,
                tag: '默认模型',
                disabled: !effective.apiKey
            });
        }
        const restore = `<button class="md-btn md-btn-tonal" onclick="ai.resetTaskRoute?.('${this.escapeHtml(taskId)}').then(()=>{data.closeAdviceModelPicker?.();data.rerenderAdvicePanel?.();})" type="button">恢复默认</button>`;
        const scopeIndex = Math.max(0, ADVICE_MODEL_SCOPES.indexOf(scope));
        const scopeLabels = { current: '当前连接', others: '其他连接', cached: '全部缓存' };
        const renderPage = pageScope => {
            const rows = rawRows.filter(row => {
                if (!row.model) return false;
                if (pageScope === 'current') return row.profileId === activeProfileId;
                if (pageScope === 'others') return row.profileId !== activeProfileId;
                return true;
            });
            const deduped = rows
                .filter((row, index, all) => row.model && all.findIndex(x => x.profileId === row.profileId && x.model === row.model) === index)
                .map((row, index) => ({ ...row, starred: this.isAdviceModelStarred(row.profileId, row.model), order: index }))
                .sort((a, b) => {
                    const aKey = this.adviceModelStarKey(a.profileId, a.model);
                    const bKey = this.adviceModelStarKey(b.profileId, b.model);
                    const rank = (row, key) => favoriteOrder.has(key)
                        ? [0, favoriteOrder.get(key)]
                        : (row.starred
                            ? [0, favoriteOrder.size + row.order]
                            : (recentOrder.has(key) ? [1, recentOrder.get(key)] : [2, row.order]));
                    const aRank = rank(a, aKey);
                    const bRank = rank(b, bKey);
                    return aRank[0] - bRank[0] || aRank[1] - bRank[1] || a.order - b.order;
                });
            const emptyText = pageScope === 'cached'
                ? '暂无启用模型'
                : (pageScope === 'others' ? '暂无其他启用模型' : '当前暂无启用模型');
            return `<section class="model-picker-page" data-advice-model-page="${pageScope}" role="tabpanel" aria-label="${scopeLabels[pageScope]}" aria-hidden="${pageScope !== scope}" ${pageScope !== scope ? 'inert' : ''}>
                <div class="model-picker-list">
                    ${deduped.map(row => {
                        const visual = this.adviceModelVisual(row.model, row.provider, row.iconKey);
                        const style = this.adviceModelThemeStyle(visual);
                        const starLabel = row.starred ? '取消星标' : '加星标';
                        return `<div class="model-picker-row advice-model-${visual.key} ${row.model === effective.model && row.profileId === activeProfileId ? 'is-selected' : ''} ${row.starred ? 'is-starred' : ''}" ${style ? `style="${this.escapeHtml(style)}"` : ''} role="button" tabindex="0" aria-disabled="${row.disabled}" title="${row.disabled ? '未配置 API Key' : ''}" data-advice-model-action="choose" data-profile-id="${this.escapeHtml(row.profileId)}" data-provider="${this.escapeHtml(row.provider)}" data-model="${this.escapeHtml(row.model)}">
                            <span class="advice-model-mark">${this.adviceModelIconHtml(visual)}</span>
                            <span class="model-picker-main"><strong>${this.escapeHtml(row.label)}</strong><small>${this.escapeHtml(row.profileName || row.provider)} · ${this.escapeHtml(row.tag)}</small></span>
                            <button class="model-picker-star ${row.starred ? 'active' : ''}" type="button" aria-label="${starLabel}：${this.escapeHtml(row.label)}" title="${starLabel}" data-advice-model-action="star" data-profile-id="${this.escapeHtml(row.profileId)}" data-provider="${this.escapeHtml(row.provider)}" data-model="${this.escapeHtml(row.model)}"><span class="material-symbols-rounded">${row.starred ? 'star' : 'star_border'}</span></button>
                            ${row.model === effective.model && row.profileId === activeProfileId ? '<span class="material-symbols-rounded model-picker-check">check</span>' : ''}
                        </div>`;
                    }).join('') || `<div class="ai-model-empty">${this.escapeHtml(emptyText)}</div>`}
                </div>
                <div class="model-picker-actions">${restore}</div>
            </section>`;
        };
        return `<div class="model-picker-body" style="--model-picker-scope-index:${scopeIndex};--model-picker-tab-progress:${scopeIndex};--model-picker-drag-x:0px">
            <div class="model-picker-tabs" role="tablist" aria-label="模型范围">
                <span class="model-picker-tab-indicator" aria-hidden="true"></span>
                ${ADVICE_MODEL_SCOPES.map(item => `<button class="model-picker-tab ${scope === item ? 'active' : ''}" data-advice-model-scope="${item}" role="tab" type="button" aria-selected="${scope === item}" tabindex="${scope === item ? '0' : '-1'}">${scopeLabels[item]}</button>`).join('')}
            </div>
            <div class="model-picker-swipe-region" data-advice-model-swipe>
                <div class="model-picker-track">${ADVICE_MODEL_SCOPES.map(renderPage).join('')}</div>
            </div>
        </div>`;
    },

    toggleAdviceSearch() {
        const shouldOpen = !(this.adviceSearchOpen || this.adviceSearchQuery);
        this.adviceSearchOpen = shouldOpen;
        if (!shouldOpen) this.adviceSearchQuery = '';
        this.captureAdviceDraft();
        this.captureAdviceScroll();
        this.rerenderAdvicePanel({ expandChrome: true, focusSearch: this.adviceSearchOpen });
        if (shouldOpen && (this.adviceRange || 'today') === 'all') {
            requestAnimationFrame(() => this.refreshAdviceSearchResults?.());
        }
    },

    onAdviceSearchInput(el) {
        this.adviceSearchQuery = el?.value || '';
        this.resetAdviceRenderWindow?.();
        this.captureAdviceDraft();
        if (this._adviceSearchTimer) clearTimeout(this._adviceSearchTimer);
        this._adviceSearchTimer = setTimeout(() => {
            this.refreshAdviceSearchResults();
        }, 300);
    },

    clearAdviceSearch() {
        this.adviceSearchQuery = '';
        this.adviceSearchOpen = false;
        this._adviceSearchRequestId = Number(this._adviceSearchRequestId || 0) + 1;
        this.resetAdviceRenderWindow?.();
        this.captureAdviceDraft();
        this.captureAdviceScroll();
        this.rerenderAdvicePanel({ expandChrome: true });
    },

    toggleAdviceHistorySearchScope(checked = false) {
        const nextRange = checked ? 'all' : 'today';
        if (this.adviceRange === nextRange) return;
        this.adviceRange = nextRange;
        this.resetAdviceRenderWindow?.();
        this.captureAdviceDraft?.();
        this.captureAdviceScroll?.();
        this.rerenderAdvicePanel?.({ expandChrome: true, focusSearch: true });
        window.appRoute?.syncFromState?.();
    },

    adviceSearchTimestamp(record) {
        const updatedAt = Number(record?.updatedAt || 0);
        if (Number.isFinite(updatedAt) && updatedAt > 0) return updatedAt;
        const at = new Date(record?.at || record?.date || 0).getTime();
        return Number.isFinite(at) ? at : 0;
    },

    adviceRecordMatchesSearch(record, query = '') {
        const term = String(query || '').trim().toLowerCase();
        if (!term || !record || record.deleted) return false;
        const dateText = record.at ? this.logicalDateKey?.(this.parseHistoryDate(record.at)) : '';
        return [
            record.content,
            record.model,
            record.provider,
            record.role,
            record.id,
            record.at,
            dateText
        ].some(value => String(value || '').toLowerCase().includes(term));
    },

    searchAdviceWorkingSet(query = '', limit = 20) {
        const max = Math.max(1, Number(limit) || 20);
        const records = this.activeRecords(this.db?.health?.aiAdviceChat || []);
        const matchesSearch = this.adviceRecordMatchesSearch || advicePanel.adviceRecordMatchesSearch;
        const timestamp = this.adviceSearchTimestamp || advicePanel.adviceSearchTimestamp;
        return records
            .filter(record => matchesSearch.call(this, record, query))
            .sort((a, b) => timestamp.call(this, b) - timestamp.call(this, a))
            .slice(0, max);
    },

    mergeAdviceSearchResults(primary = [], secondary = [], limit = 20) {
        const max = Math.max(1, Number(limit) || 20);
        const byId = new Map();
        const timestamp = this.adviceSearchTimestamp || advicePanel.adviceSearchTimestamp;
        [...(primary || []), ...(secondary || [])].forEach(record => {
            if (!record || record.deleted) return;
            const key = record.id || `${record.role || ''}:${record.at || ''}:${record.content || ''}`;
            if (!byId.has(key)) byId.set(key, record);
        });
        return Array.from(byId.values())
            .sort((a, b) => timestamp.call(this, b) - timestamp.call(this, a))
            .slice(0, max);
    },

    async loadAdviceWindowFromColdStore(limit = this._adviceRenderLimit || 80) {
        const store = this.advice || window.dataStore?.advice;
        const max = Math.max(50, Number(limit) || 80);
        const fallback = () => this.activeRecords(this.db?.health?.aiAdviceChat || []);
        if (!store || typeof store.getPage !== 'function') return fallback();
        if (this._adviceSending) return fallback();
        const memoryCount = (this.db?.health?.aiAdviceChat || []).length;
        let total = memoryCount;
        try {
            if (typeof store.count === 'function') total = Math.max(memoryCount, Number(await store.count()) || 0);
        } catch {
            total = memoryCount;
        }
        const target = Math.min(Math.max(max, memoryCount), total || max);
        if (target <= memoryCount) return fallback();
        const records = await store.getPage(0, target);
        const chronological = (Array.isArray(records) ? records : []).reverse();
        return chronological.length
            ? this.activeRecords(store._mergeChronological ? store._mergeChronological(fallback(), chronological) : chronological)
            : fallback();
    },

    async refreshAdviceSearchResults() {
        const list = this._adviceMessageList?.();
        const summary = document.getElementById('adviceMessageSummary');
        if (!list) return;

        const query = String(this.adviceSearchQuery || '').trim();
        const requestId = Number(this._adviceSearchRequestId || 0) + 1;
        const searchLimit = 20;
        const store = window.dataStore?.advice || this.advice;
        this._adviceSearchRequestId = requestId;
        let messages;
        let visibleMessages = [];
        let total = 0;

        if (query) {
            if (query.length < 2) {
                this.setAdviceVirtualEmpty('<div class="empty-state advice-empty"><span class="material-symbols-rounded">keyboard</span><p>输入至少 2 个字符后搜索历史记录</p></div>', 'search-short', list);
                if (summary) summary.textContent = '历史聊天不会预加载；输入至少 2 个字符后按需搜索';
                return;
            }
            if (summary) summary.textContent = `正在按需搜索历史记录“${query}”...`;
            this.setAdviceVirtualEmpty('<div class="empty-state advice-empty"><span class="material-symbols-rounded">manage_search</span><p>正在搜索冷历史记录</p></div>', 'search-loading', list);
            let results = [];
            try {
                const searchWorkingSet = this.searchAdviceWorkingSet || advicePanel.searchAdviceWorkingSet;
                const mergeResults = this.mergeAdviceSearchResults || advicePanel.mergeAdviceSearchResults;
                let coldResults = [];
                if (store?.searchIds) {
                    const ids = await store.searchIds(query, searchLimit);
                    coldResults = await this.resolveAdviceRecordsByIds(ids);
                } else if (store?.search) {
                    coldResults = await store.search(query, searchLimit);
                }
                const workingSetResults = searchWorkingSet.call(this, query, searchLimit);
                results = mergeResults.call(this, coldResults, workingSetResults, searchLimit);
            } catch (e) {
                const searchWorkingSet = this.searchAdviceWorkingSet || advicePanel.searchAdviceWorkingSet;
                results = searchWorkingSet.call(this, query, searchLimit);
                if (!results.length) {
                    if (requestId !== this._adviceSearchRequestId || query !== String(this.adviceSearchQuery || '').trim()) return;
                    console.error('Failed to search advice history', e);
                    this.setAdviceVirtualEmpty('<div class="empty-state advice-empty"><span class="material-symbols-rounded">error</span><p>历史搜索失败，请稍后重试</p></div>', 'search-error', list);
                    if (summary) summary.textContent = '历史搜索失败';
                    return;
                }
            }
            if (requestId !== this._adviceSearchRequestId || query !== String(this.adviceSearchQuery || '').trim()) return;
            messages = (Array.isArray(results) ? results : []).reverse();
            visibleMessages = this.visibleAdviceMessages(messages, true);
            total = visibleMessages.length;
            this.prepareAdviceVirtualState(visibleMessages, 'search', { list, emptyHtml: this.renderAdviceMessages([], 0) });
        } else {
            const isAllRange = (this.adviceRange || 'today') === 'all';
            const limit = this._adviceRenderLimit || 20;
            let hiddenCount;
            if (isAllRange && store?.getAllIds) {
                try {
                    const ids = await store.getAllIds();
                    if (requestId !== this._adviceSearchRequestId || query !== String(this.adviceSearchQuery || '').trim()) return;
                    total = ids.length;
                    const windowIds = ids.slice(-limit);
                    hiddenCount = total - windowIds.length;
                    messages = await this.resolveAdviceRecordsByIds(windowIds);
                } catch (e) {
                    console.error('Failed to load advice history ids', e);
                    messages = this.activeRecords(this.db.health.aiAdviceChat || []);
                }
            } else {
                messages = this.activeRecords(this.db.health.aiAdviceChat || []);
            }
            visibleMessages = this.visibleAdviceMessages(messages);
            if (isAllRange && hiddenCount == null) {
                total = visibleMessages.length;
                visibleMessages = visibleMessages.slice(-limit);
                hiddenCount = total - visibleMessages.length;
            }
            if (!isAllRange) total = visibleMessages.length;
            this.prepareAdviceVirtualState(visibleMessages, isAllRange ? 'window' : this.adviceRange || 'today', {
                list,
                hiddenCount,
                emptyHtml: this.renderAdviceMessages([])
            });
        }

        if (requestId !== this._adviceSearchRequestId || query !== String(this.adviceSearchQuery || '').trim()) return;
        if (summary) {
            if (query) summary.textContent = `搜索“${query}”：${visibleMessages.length} 条匹配记录${visibleMessages.length >= searchLimit ? `（显示前 ${searchLimit} 条）` : ''}`;
            else if (!total) summary.textContent = '像聊天一样提问，AI 会结合你的记录分析';
            else {
                const rangeLabel = { today: '今日', week: '最近7天', month: '最近30天', all: '全部' }[this.adviceRange || 'today'] || '今日';
                summary.textContent = `${rangeLabel}${(this.adviceRange || 'today') === 'all' ? '最新' : ''}显示 ${Math.floor(visibleMessages.length / 2)} / 共 ${Math.floor(total / 2)} 轮建议`;
            }
        }
    },

    setAdviceRange(range) {
        this.adviceRange = range || 'today';
        this.resetAdviceRenderWindow?.();
        this.saveAdviceSettings();
        this.captureAdviceDraft();
        this.captureAdviceScroll();
        this.rerenderAdvicePanel();
        window.appRoute?.syncFromState?.();
    },

    toggleAdviceContext(key) {
        this.adviceContexts = { diet: true, training: true, weight: true, goal: true, ...(this.adviceContexts || {}) };
        this.adviceContexts[key] = !this.adviceContexts[key];
        this.saveAdviceSettings();
        this.captureAdviceDraft();
        this.captureAdviceScroll();
        this.rerenderAdvicePanel({ expandChrome: true, refreshMessages: false });
    },

    setAdviceContextMode(mode = 'auto') {
        this.adviceContextMode = ['auto', 'light', 'none'].includes(mode) ? mode : 'auto';
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
        if (range === 'all') return null;
        const start = this.logicalDayStart();
        if (range === 'week') start.setDate(start.getDate() - 6);
        if (range === 'month') start.setDate(start.getDate() - 29);
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

    visibleAdviceMessages(messages = [], isSearch = false) {
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
        if (isSearch) return withIndex;
        const start = this.adviceRangeStart();
        return start ? withIndex.filter(msg => this.parseHistoryDate(msg.at) >= start) : withIndex;
    },

    prepareAdviceVirtualState(records = [], mode = 'recent', options = {}) {
        const store = window.dataStore?.advice || this.advice;
        const list = options.mount === false ? null : (options.list || this._adviceMessageList?.());
        const emptyHtml = options.emptyHtml || this.renderAdviceMessages?.([], 0) || '';
        this._adviceVirtualEmptyHtml = emptyHtml;
        this._adviceVirtualFallbackRecords = Array.isArray(records) ? records : [];
        this._adviceHistoryHiddenCount = options.hiddenCount || 0;
        let snapshot = null;
        if (store && typeof store.setActiveIds === 'function' && Array.isArray(options.ids)) {
            snapshot = store.setActiveIds(options.ids, mode, options.seedRecords || records || []);
        } else if (store && typeof store.setActiveRecords === 'function') {
            snapshot = store.setActiveRecords(records || [], mode);
        }
        this._adviceVirtualSnapshot = snapshot;
        if (options.mount !== false) this.mountAdviceVirtualList(list);
        return snapshot;
    },

    mountAdviceVirtualList(list = this._adviceMessageList?.()) {
        if (!list) return null;
        const store = window.dataStore?.advice || this.advice;
        const emptyHtml = this._adviceVirtualEmptyHtml || this.renderAdviceMessages?.([], 0) || '';
        const keyword = String(this.adviceSearchQuery || '').trim();
        const renderItem = (msg, index, latest, currentKeyword, options = {}) => {
            if (!msg || msg.skeleton) return this.renderAdviceVirtualSkeleton(msg, index);
            const localIndex = this.findAdviceMessageIndexById?.(msg.id);
            const renderMsg = {
                ...msg,
                idx: localIndex >= 0 ? localIndex : (Number.isInteger(msg.idx) ? msg.idx : index),
                showDateMeta: !!(options.showDateMeta || msg.showDateMeta)
            };
            if (typeof this.renderAdviceMessage === 'function') {
                return this.renderAdviceMessage(renderMsg, latest, currentKeyword || keyword);
            }
            return `<div class="advice-bubble ${this.escapeHtml?.(renderMsg.role || 'assistant') || 'assistant'}">${this.escapeHtml?.(renderMsg.content || '') || ''}</div>`;
        };
        const records = this._adviceVirtualFallbackRecords || [];
        const activeCount = Array.isArray(store?.activeIdsRef) ? store.activeIdsRef.length : records.length;
        const activeMode = store?.mode || this._adviceVirtualSnapshot?.mode || this.adviceRange || 'today';
        const staticThreshold = Math.max(80, Number(this._adviceStaticHistoryThreshold || 180));
        const hasColdIdsBeyondSeed = activeCount > records.length;
        const shouldVirtualize = activeMode === 'all'
            && window.adviceVirtualList?.mountVirtualList
            && store?.getItem
            && store?.activeIdsRef
            && (activeCount > staticThreshold || hasColdIdsBeyondSeed);
        if (shouldVirtualize) {
            if (list.dataset) list.dataset.adviceVirtualActive = 'true';
            this._adviceVirtualController = window.adviceVirtualList.mountVirtualList(list, {
                store,
                keyword,
                emptyHtml,
                initialHeight: this._adviceSegmentAverage || 132,
                renderItem: (msg, index, latest, currentKeyword) => renderItem(msg, index, latest, currentKeyword, { showDateMeta: true }),
                renderSkeleton: (item, index) => this.renderAdviceVirtualSkeleton(item, index)
            });
            return this._adviceVirtualController;
        }
        if (list._adviceVirtualController) list._adviceVirtualController.destroy?.();
        this._adviceVirtualController = null;
        if (list.dataset) delete list.dataset.adviceVirtualActive;
        const renderRecords = records.map((msg, index) => {
            const localIndex = this.findAdviceMessageIndexById?.(msg.id);
            return {
                ...msg,
                idx: localIndex >= 0 ? localIndex : (Number.isInteger(msg.idx) ? msg.idx : index)
            };
        });
        list.innerHTML = renderRecords.length
            ? (this.renderAdviceMessages?.(renderRecords, this._adviceHistoryHiddenCount) || renderRecords.map((msg, index) => renderItem(msg, index, index === renderRecords.length - 1, keyword)).join(''))
            : emptyHtml;
        return null;
    },

    findAdviceMessageIndexById(id = '') {
        if (!id) return -1;
        return this.activeRecords(this.db?.health?.aiAdviceChat || []).findIndex(msg => msg?.id === id);
    },

    setAdviceVirtualEmpty(html = '', mode = 'empty', list = this._adviceMessageList?.()) {
        this.prepareAdviceVirtualState([], mode, {
            list,
            ids: [],
            emptyHtml: html || this.renderAdviceMessages?.([], 0) || ''
        });
    },

    renderAdviceVirtualShell(emptyHtml = '') {
        return `<div class="advice-virtual-inner" data-advice-virtual-inner>${emptyHtml || ''}</div>`;
    },

    renderAdviceVirtualSkeleton(item = {}, index = 0) {
        if (window.adviceVirtualList?.defaultSkeletonHtml) return window.adviceVirtualList.defaultSkeletonHtml(item, index);
        return `<div class="advice-bubble assistant advice-virtual-skeleton" aria-busy="true">
            <div class="advice-virtual-shimmer"></div>
            <div class="advice-virtual-shimmer short"></div>
        </div>`;
    },

    async resolveAdviceRecordsByIds(ids = []) {
        const store = window.dataStore?.advice || this.advice;
        const cleanIds = (Array.isArray(ids) ? ids : []).map(id => String(id || '').trim()).filter(Boolean);
        if (!cleanIds.length) return [];
        if (store?.getByIds) return store.getByIds(cleanIds);
        const byId = new Map(this.activeRecords(this.db?.health?.aiAdviceChat || []).map(record => [record.id, record]));
        return cleanIds.map(id => byId.get(id)).filter(Boolean);
    },

    resetAdviceRenderWindow() {
        this._adviceRenderLimit = 20;
        this._adviceVirtualSnapshot = null;
    },

    async countAdviceMessages() {
        const fallback = () => this.activeRecords(this.db?.health?.aiAdviceChat || []).length;
        const store = window.dataStore?.advice;
        if (!store || typeof store.count !== 'function') return fallback();
        try {
            const count = Number(await store.count());
            return Number.isFinite(count) ? count : fallback();
        } catch {
            return fallback();
        }
    },

    async expandAdviceRenderWindow() {
        if (this._adviceLoadingOlder || this.adviceRange !== 'all' || String(this.adviceSearchQuery || '').trim()) return;
        this._adviceLoadingOlder = true;
        this._adviceRenderLimit = (this._adviceRenderLimit || 20) + 20;
        try {
            await this.preserveAdviceScroll(() => this.refreshAdviceSearchResults());
        } finally {
            this._adviceLoadingOlder = false;
        }
    },

    adviceMessageSummary(messages, visibleMessages) {
        const rangeLabel = { today: '今日', week: '最近7天', month: '最近30天', all: '全部' }[this.adviceRange || 'today'] || '今日';
        const query = String(this.adviceSearchQuery || '').trim();
        if (!messages.length) return '像聊天一样提问，AI 会结合你的记录分析';
        if (query) return `搜索“${query}”：${visibleMessages.length} 条匹配记录`;
        return `${rangeLabel}显示 ${Math.floor(visibleMessages.length / 2)} / 共 ${Math.floor(messages.length / 2)} 轮建议`;
    },

    adviceConversationContext(limit = 12) {
        if (limit <= 0) return [];
        const messages = this.visibleAdviceMessages(this.activeRecords(this.db.health.aiAdviceChat || []));
        const today = this.logicalDateKey();
        const todayMessages = messages.filter(msg => this.logicalDateKey(this.parseHistoryDate(msg.at)) === today);
        const recentMessages = messages.slice(-limit);
        const merged = [];
        [...todayMessages, ...recentMessages].forEach(msg => {
            if (!msg?.content || msg.pending || msg.error) return;
            if (merged.includes(msg)) return;
            merged.push(msg);
        });
        // Drop the trailing user message — sendAiAdvice will append the same prompt as the
        // final {role:'user'} entry, so keeping it here would duplicate the question.
        const trimmed = merged.length && merged[merged.length - 1].role === 'user'
            ? merged.slice(0, -1)
            : merged;
        return trimmed.slice(-Math.max(limit, todayMessages.length)).map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
        }));
    },

    preserveAdviceScroll(fn) {
        const list = this._adviceMessageList?.();
        const scroller = this._adviceScrollContainer?.();
        const beforeTop = this._adviceCurrentScrollY?.(scroller) || 0;
        const beforeHeight = scroller?.scrollHeight || list?.scrollHeight || 0;
        const captureViewport = (targetScroller) => {
            const isDoc = targetScroller === document.scrollingElement || targetScroller === document.documentElement || targetScroller === document.body;
            if (isDoc) return { top: 0, bottom: window.innerHeight || document.documentElement?.clientHeight || 0 };
            const rect = targetScroller?.getBoundingClientRect?.();
            return rect ? { top: rect.top || 0, bottom: rect.bottom || 0 } : { top: 0, bottom: window.innerHeight || 0 };
        };
        const anchorCandidates = (() => {
            const root = list || document;
            const viewport = captureViewport(scroller);
            const nodes = Array.from(root?.querySelectorAll?.('[data-advice-id]') || []);
            return nodes.map((node, order) => {
                const id = node?.dataset?.adviceId || node?.getAttribute?.('data-advice-id') || '';
                const rect = node?.getBoundingClientRect?.();
                if (!id || !rect) return null;
                if (rect.bottom <= viewport.top + 1 || rect.top >= viewport.bottom - 1) return null;
                return { id, order, topOffset: (rect.top || 0) - viewport.top };
            }).filter(Boolean).sort((a, b) => (a.topOffset - b.topOffset) || (a.order - b.order));
        })();
        const findAnchor = (root, id) => {
            if (!root || !id) return null;
            const nodes = Array.from(root.querySelectorAll?.('[data-advice-id]') || []);
            return nodes.find(node => (node?.dataset?.adviceId || node?.getAttribute?.('data-advice-id') || '') === id) || null;
        };
        const restore = () => {
            const nextList = this._adviceMessageList?.();
            if (!nextList) return;
            const nextScroller = this._adviceScrollContainer?.();
            const nextViewport = captureViewport(nextScroller);
            const currentTop = this._adviceCurrentScrollY?.(nextScroller) || 0;
            for (const anchor of anchorCandidates) {
                const node = findAnchor(nextList, anchor.id);
                const rect = node?.getBoundingClientRect?.();
                if (!rect) continue;
                const currentOffset = (rect.top || 0) - nextViewport.top;
                this._adviceSetScrollY?.(nextScroller, Math.max(0, currentTop + currentOffset - anchor.topOffset), false);
                return;
            }
            const heightDelta = (nextScroller?.scrollHeight || nextList.scrollHeight) - beforeHeight;
            this._adviceSetScrollY?.(nextScroller, Math.max(0, beforeTop + heightDelta), false);
        };
        const scheduleRestore = () => requestAnimationFrame(() => restore());
        let result;
        try {
            result = fn?.();
        } catch (e) {
            scheduleRestore();
            throw e;
        }
        if (result && typeof result.then === 'function') {
            result.then(scheduleRestore, scheduleRestore);
        } else {
            scheduleRestore();
        }
        return result;
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
        return this._openModal({
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
        if (this._adviceSending) return;
        const input = document.getElementById('advicePrompt');
        const prompt = (promptOverride || input?.value || '').trim();
        const attachmentPayloadId = typeof options?.attachmentPayloadId === 'string' ? options.attachmentPayloadId.trim() : '';
        const attachmentPayload = attachmentPayloadId ? this.getAdviceAttachmentPayload?.(attachmentPayloadId) : null;
        if (attachmentPayloadId && !attachmentPayload) {
            window.toast?.show?.('原图片仅在当前会话短期保留，请重新附图后再试。', 'info');
            return;
        }
        const attachments = attachmentPayload
            ? attachmentPayload.attachments.slice()
            : ((!promptOverride && !options?.skipUserMessage) ? (this._adviceAttachments || []).filter(att => att && att.status !== 'failed').slice() : []);
        const effectivePrompt = prompt || (attachments.some(att => att.kind === 'image') ? '请结合附件内容进行分析，并给出可执行建议。' : '请分析附件内容，并给出可执行建议。');
        const urls = Array.isArray(options?.userProvidedUrls)
            ? (Object.isFrozen(options.userProvidedUrls) ? options.userProvidedUrls : (window.searchToolLoop?.normalizeUserProvidedUrls?.(options.userProvidedUrls) || []))
            : (!options?.skipUserMessage ? (window.searchToolLoop?.urlsFromText?.(effectivePrompt) || []) : []);
        if (!(this.canSendAdviceWithAttachments?.(prompt, attachments) || prompt)) return;
        if (attachments.some(att => att.status === 'processing')) {
            window.toast?.show?.('附件仍在处理中，请稍后发送', 'info');
            return;
        }
        const hasImageAttachment = attachments.some(att => att.kind === 'image');
        const adviceTaskId = hasImageAttachment ? 'advice.vision' : 'advice.chat';
        const routeOverride = window.aiRoutingPure?.manualFallbackTarget?.(options?.routeOverride) || null;
        const effective = ai.resolveTaskConfig ? ai.resolveTaskConfig(adviceTaskId, routeOverride) : (ai.getEffectiveConfig ? ai.getEffectiveConfig() : { ...ai.cfg, profileId: ai.cfg.activeProfileId });
        if (!effective.enabled) return alert('请先在设置中配置 AI');
        const model = effective.model || ai.cfg.model;
        const provider = effective.provider || ai.cfg.provider || 'openai';
        if (hasImageAttachment) {
            const verdict = window.ai?.analyzeVisionModel?.(model, provider) || { vision: false, isImageGen: false };
            if (verdict.isImageGen) {
                window.toast?.show?.('图像生成模型不能用于图片问答，请切换视觉模型', 'info');
                return;
            }
            if (!verdict.vision) {
                window.toast?.show?.('当前模型未验证支持图片，仍将尝试识别', 'info');
            }
        }
        const scroller = this._adviceScrollContainer?.();
        this._adviceFollowStream = !scroller || (this._adviceMaxScrollY(scroller) - this._adviceCurrentScrollY(scroller)) < 180;
        this._adviceUserScrollPaused = false;
        const isOverride = !!routeOverride || !!ai.cfg.taskRoutes?.[adviceTaskId];
        const now = new Date().toISOString();
        const pendingId = this.generateRecordId('advice-pending');
        this._activeAdvicePendingId = pendingId;
        const activeAttachmentPayloadId = hasImageAttachment ? (attachmentPayloadId || pendingId) : '';
        if (hasImageAttachment && !attachmentPayloadId) {
            this.registerAdviceAttachmentPayload?.(activeAttachmentPayloadId, attachments);
        }
        let preserveAttachmentPayload = false;
        const replyToId = options?.replyToId || '';
        const baseVersionIdx = Number(options?.versionIdx || 0);
        this._adviceSending = true;
        this._adviceCancelledByUser = false;
        const AbortCtor = window.AbortController || globalThis.AbortController;
        if (typeof AbortCtor !== 'function') throw new Error('当前浏览器不支持取消 AI 请求');
        const controller = new AbortCtor();
        this._adviceAbortController = controller;
        this._adviceRequestMeta = {
            startedAt: now,
            provider,
            model,
            visibilityState: document.visibilityState || 'visible',
            displayMode: window.matchMedia?.('(display-mode: standalone)')?.matches ? 'standalone' : 'browser',
            wasBackgrounded: !!document.hidden,
            pageHidden: false,
            cancelledByUser: false
        };
        const requestStarted = Date.now();
        window.errorBus?.event?.('advice.request', 'start', {
            provider,
            model,
            hasImageAttachment,
            attachmentCount: attachments.length,
            messageCount: this.db.health.aiAdviceChat.length,
            contextMode: options?.contextMode || this.adviceContextMode || 'auto',
            retry: !!options?.skipUserMessage,
            temporaryModel: isOverride
        });
        this.requestAdviceWakeLock?.();
        this.updateAdviceSendState?.();
        let userMessageId = '';
        if (!options?.skipUserMessage) {
            const userMessage = { id: this.generateRecordId('advice-user'), role: 'user', content: effectivePrompt, attachments: this.adviceAttachmentMetadata?.(attachments) || [], at: now, updatedAt: Date.now(), deleted: false };
            userMessageId = userMessage.id;
            this.db.health.aiAdviceChat.push(userMessage);
        }
        const pendingRecord = {
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
        };
        const insertAfterId = options?.insertAfterId || userMessageId;
        const insertAfterIdx = insertAfterId ? this.db.health.aiAdviceChat.findIndex(msg => msg?.id === insertAfterId) : -1;
        if (insertAfterIdx >= 0) this.db.health.aiAdviceChat.splice(insertAfterIdx + 1, 0, pendingRecord);
        else this.db.health.aiAdviceChat.push(pendingRecord);
        if (input) input.value = '';
        this.clearAdviceDraft();
        if (!options?.skipUserMessage) this.clearAdviceAttachments?.();
        this.save();
        requestAnimationFrame(() => {
            if (!this._adviceUserScrollPaused && this._adviceFollowStream) {
                this.scrollAdviceToLatest(true);
            }
        });
        this._activeStreamRenderer = null;
        this._streamRenderers = this._streamRenderers || {};
        this.setAdviceStreamUiState('streaming');
        let requestMessages = [];
        let hasStreamedContent = false;
        try {
            const contextMode = ['auto', 'light', 'none'].includes(options?.contextMode || this.adviceContextMode) ? (options?.contextMode || this.adviceContextMode) : 'auto';
            const baseMessages = this.buildAdviceMessages(effectivePrompt, model, { contextMode });
            const messages = this.applyAdviceAttachmentsToMessages?.(baseMessages, attachments) || baseMessages;
            requestMessages = messages;
            const outputTokenBudget = Math.max(2400, Number(this.ADVICE_OUTPUT_TOKEN_BUDGET || advicePanel.ADVICE_OUTPUT_TOKEN_BUDGET) || 8192);
            window.errorBus?.event?.('advice.request', 'prepared', {
                provider,
                model,
                contextMode,
                requestMessageCount: messages.length,
                outputTokenBudget,
                hasImageAttachment,
                attachmentCount: attachments.length
            });
            let full = '';
            const searchBudget = { limit: 2, remaining: 2, attempts: [] };
            let searchEvidence = [];
            const unpack = result => {
                const found = result?.meta?.searchEvidence;
                if (Array.isArray(found)) {
                    const safe = window.searchPolicyPure?.summarizeSearchEvidence?.(found, {
                        taskId: hasImageAttachment ? 'advice.vision' : 'advice.chat'
                    }) || [];
                    const byUrl = new Map(searchEvidence.map(item => [item.url, item]));
                    safe.forEach(item => { if (item?.url) byUrl.set(item.url, item); });
                    searchEvidence = [...byUrl.values()].slice(0, 20);
                }
                return typeof result === 'string' ? result : String(result?.text || '');
            };
            let _lastRender = 0;
            let _pendingFrame = 0;
            /** @type {{ in: number, out: number }|null} */
            let lastUsage = null;
            let activeRequestUsage = null;
            let completedUsage = { in: 0, out: 0 };
            let lastFinishReason = '';
            const addUsage = (a, b) => ({
                in: Number(a?.in || 0) + Number(b?.in || 0),
                out: Number(a?.out || 0) + Number(b?.out || 0)
            });
            const displayUsage = () => addUsage(completedUsage, activeRequestUsage);
            const finishRequestUsage = () => {
                if (!activeRequestUsage) return;
                completedUsage = addUsage(completedUsage, activeRequestUsage);
                lastUsage = completedUsage;
                activeRequestUsage = null;
            };
            const createOnToken = (prefix = '') => (delta, accumulated, meta) => {
                    if (controller.signal.aborted || this._activeAdvicePendingId !== pendingId) return;
                    const idx = this.db.health.aiAdviceChat.findIndex(msg => msg.id === pendingId);
                    if (idx < 0) return;
                    if (this.db.health.aiAdviceChat[idx].stopped) return;
                    if (String(delta ?? '').length || String(accumulated ?? '').length) hasStreamedContent = true;
                    const displayAccumulated = prefix + accumulated;
                    this.db.health.aiAdviceChat[idx].content = displayAccumulated;
                    if (this.db.health.aiAdviceChat[idx].pending && displayAccumulated) this.db.health.aiAdviceChat[idx].pending = false;
                    if (meta?.usage) {
                        activeRequestUsage = meta.usage;
                        lastUsage = displayUsage();
                        this.db.health.aiAdviceChat[idx].tokenUsage = lastUsage;
                        const modelName = model || ai.cfg.model || '';
                        if (window.aiPricing?.estimate) {
                            const est = window.aiPricing.estimate(lastUsage, provider, modelName);
                            this.db.health.aiAdviceChat[idx].costUsd = est.costUsd;
                        }
                    }
                    if (meta?.finishReason) {
                        lastFinishReason = String(meta.finishReason);
                        this.db.health.aiAdviceChat[idx].finishReason = lastFinishReason;
                    }
                    if (meta?.done) this.db.health.aiAdviceChat[idx].streamDone = true;
                    this.db.health.aiAdviceChat[idx].updatedAt = Date.now();
                    const bubble = document.querySelector(`[data-advice-id="${pendingId}"]`);
                    if (!bubble || !displayAccumulated) return;
                    const contentEl = bubble.querySelector('.advice-bubble-content');
                    if (!contentEl) return;
                    if (!contentEl._renderer && window.adviceStreamRenderer) {
                        contentEl._renderer = adviceStreamRenderer.create(contentEl, {
                            chunkPerFrame: 8,
                            renderMarkdown: (text) => this.renderAdviceMarkdown(text)
                        });
                        contentEl._renderer.seed(displayAccumulated);
                        this._activeStreamRenderer = contentEl._renderer;
                        this._streamRenderers[pendingId] = contentEl._renderer;
                    }
                    if (contentEl._renderer) {
                        const suffix = window.adviceStreamRenderer?.pendingAccumulatedSuffix
                            ? window.adviceStreamRenderer.pendingAccumulatedSuffix(contentEl._renderer.getState?.(), displayAccumulated)
                            : null;
                        if (suffix !== null) {
                            if (suffix) contentEl._renderer.enqueue(suffix);
                        } else {
                            contentEl._renderer.seed(displayAccumulated);
                        }
                    } else {
                        contentEl.innerHTML = this.renderAdviceMarkdown(displayAccumulated);
                    }
                    bubble.classList.remove('pending');
                    const dots = bubble.querySelector('.advice-typing-dot');
                    if (dots) dots.remove();
                    if (!this._adviceUserScrollPaused) this.scheduleAdviceStreamScroll();
            };
            const onToken = createOnToken();
            full = unpack(hasImageAttachment
                ? (typeof ai.run === 'function' ? await ai.run({
                    taskId: 'advice.vision',
                    messages,
                    attachments,
                    maxTokens: outputTokenBudget,
                    signal: controller.signal,
                    routeOverride,
                    userProvidedUrls: urls,
                    returnMeta: true,
                    searchBudget,
                    onProgress: ({ stage, message }) => {
                        const idx = this.db.health.aiAdviceChat.findIndex(msg => msg.id === pendingId);
                        if (idx < 0) return;
                        const status = message || (stage === 'resize' ? '正在处理图片…' : stage === 'request' ? '正在请求视觉模型…' : '正在分析附件…');
                        this.db.health.aiAdviceChat[idx].content = status;
                        this.db.health.aiAdviceChat[idx].pending = true;
                        this.rerenderAdvicePanel?.();
                    }
                }) : await ai.callAdviceWithAttachments(messages, attachments, outputTokenBudget, { signal: controller.signal, routeOverride }))
                : (typeof ai.runStream === 'function'
                    ? await ai.runStream('advice.chat', messages, outputTokenBudget, onToken, { signal: controller.signal, routeOverride, returnMeta: true, searchBudget, userProvidedUrls: urls })
                    : (typeof ai.run === 'function'
                        ? await ai.run({ taskId: 'advice.chat', messages, maxTokens: outputTokenBudget, stream: true, onToken, signal: controller.signal, routeOverride, returnMeta: true, searchBudget, userProvidedUrls: urls })
                        : await ai.callStream(messages, outputTokenBudget, onToken, { signal: controller.signal, routeOverride }))));
            finishRequestUsage();
            const autoContinueLimit = Math.max(0, Number(this.ADVICE_AUTO_CONTINUE_LIMIT || advicePanel.ADVICE_AUTO_CONTINUE_LIMIT) || 0);
            let autoContinueCount = 0;
            while (!hasImageAttachment
                && autoContinueCount < autoContinueLimit
                && String(full || '').trim()
                && (this.isAdviceTokenLimitFinishReason || advicePanel.isAdviceTokenLimitFinishReason).call(this, lastFinishReason)) {
                autoContinueCount += 1;
                const continuedFrom = full;
                const previousFinishReason = lastFinishReason;
                lastFinishReason = '';
                activeRequestUsage = null;
                try {
                    const continuationMessages = [
                        ...messages,
                        { role: 'assistant', content: continuedFrom },
                        { role: 'user', content: '继续上一条回复：从断点处直接续写剩余内容，不要重复前文，不要重新开头，优先把结尾补完整。' }
                    ];
                    const continued = unpack(typeof ai.run === 'function'
                        ? await ai.run({ taskId: adviceTaskId, messages: continuationMessages, maxTokens: outputTokenBudget, stream: true, onToken: createOnToken(continuedFrom), signal: controller.signal, routeOverride, returnMeta: true, searchBudget, userProvidedUrls: urls })
                        : await ai.callStream(continuationMessages, outputTokenBudget, createOnToken(continuedFrom), { signal: controller.signal, routeOverride }));
                    finishRequestUsage();
                    full = continuedFrom + String(continued || '');
                } catch (continueError) {
                    if (controller.signal.aborted || continueError?.code === 'AI_CANCELLED' || continueError?.name === 'AbortError') throw continueError;
                    lastFinishReason = previousFinishReason;
                    const idx = this.db.health.aiAdviceChat.findIndex(msg => msg.id === pendingId);
                    if (idx >= 0) this.db.health.aiAdviceChat[idx].finishReason = previousFinishReason;
                    window.errorBus?.event?.('advice.request', 'auto_continue_failed', {
                        provider,
                        model,
                        message: continueError?.message || String(continueError)
                    });
                    break;
                }
            }
            if (hasImageAttachment) {
                const idx = this.db.health.aiAdviceChat.findIndex(msg => msg.id === pendingId);
                if (idx >= 0) {
                    this.db.health.aiAdviceChat[idx].content = full;
                    this.db.health.aiAdviceChat[idx].pending = false;
                    this.db.health.aiAdviceChat[idx].updatedAt = Date.now();
                }
            }
            const idx = this.db.health.aiAdviceChat.findIndex(msg => msg.id === pendingId);
            if (idx >= 0 && this.db.health.aiAdviceChat[idx]?.stopped) return;
            if (!String(full || '').trim()) {
                if (idx >= 0) this.softDeleteById(this.db.health.aiAdviceChat, pendingId);
                window.toast?.show?.('AI 返回为空，已删除空回复，请重试或切换模型。', 'error');
                this.save();
                return;
            }
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
                updatedAt: Date.now(),
                ...(searchEvidence.length ? { searchEvidence } : {})
            };
            window.errorBus?.event?.('advice.request', 'success', {
                provider,
                model,
                elapsedMs: Date.now() - requestStarted,
                outputChars: String(full || '').length,
                usageIn: lastUsage?.in,
                usageOut: lastUsage?.out,
                hasImageAttachment,
                wasBackgrounded: !!this._adviceRequestMeta?.wasBackgrounded,
                pageHidden: !!this._adviceRequestMeta?.pageHidden
            });
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
            if (this._adviceCancelledByUser || e?.code === 'AI_CANCELLED' || e?.name === 'AbortError') {
                if (idx >= 0 && this.db.health.aiAdviceChat[idx]?.stopped) return;
                const previous = idx >= 0 ? this.db.health.aiAdviceChat[idx] : null;
                const partial = String(previous?.content || '').trim();
                const stopped = {
                    ...(previous || {}),
                    id: pendingId,
                    role: 'assistant',
                    content: partial || '已停止生成。',
                    at: previous?.at || new Date().toISOString(),
                    model,
                    provider,
                    temporaryModel: isOverride,
                    pending: false,
                    stopped: true,
                    stoppedAt: new Date().toISOString(),
                    stopReason: this._adviceCancelledByUser ? 'user' : 'aborted',
                    error: false,
                    errorInfo: {
                        ...(this._adviceRequestMeta || {}),
                        type: this._adviceCancelledByUser ? 'user_cancelled' : 'aborted',
                        message: this._adviceCancelledByUser ? '用户主动停止生成' : '请求已中断'
                    },
                    retryPrompt: prompt,
                    deleted: false,
                    updatedAt: Date.now(),
                    replyToId,
                    versionIdx: baseVersionIdx,
                    versionActive: options?.versionActive !== false,
                    versionPinned: !!options?.versionPinned
                };
                if (idx >= 0) this.db.health.aiAdviceChat[idx] = stopped;
                else this.db.health.aiAdviceChat.push(stopped);
                window.errorBus?.event?.('advice.request', 'cancelled', {
                    provider,
                    model,
                    elapsedMs: Date.now() - requestStarted,
                    stopReason: stopped.stopReason,
                    partialChars: partial.length,
                    wasBackgrounded: !!this._adviceRequestMeta?.wasBackgrounded,
                    pageHidden: !!this._adviceRequestMeta?.pageHidden
                });
                this.save();
                requestAnimationFrame(() => {
                    const bubble = document.querySelector(`[data-advice-id="${pendingId}"]`);
                    const contentEl = bubble?.querySelector?.('.advice-bubble-content');
                    if (contentEl && contentEl._renderer) {
                        try { contentEl._renderer.flushAll(); } catch {}
                        try { contentEl._renderer.destroy(); } catch {}
                        contentEl._renderer = null;
                        delete this._streamRenderers[pendingId];
                    }
                    if (!this._adviceUserScrollPaused && this._adviceFollowStream) {
                        this.scrollAdviceToLatest(true);
                    }
                });
                return;
            }
            const previous = idx >= 0 ? this.db.health.aiAdviceChat[idx] : null;
            if (!hasImageAttachment && hasStreamedContent && previous) {
                const interrupted = {
                    ...previous,
                    role: 'assistant',
                    content: String(previous.content || ''),
                    model,
                    provider,
                    temporaryModel: isOverride,
                    pending: false,
                    error: true,
                    errorInfo: {
                        ...(this._adviceRequestMeta || {}),
                        type: e?.code || e?.name || 'stream_interrupted',
                        message: e?.message || String(e)
                    },
                    deleted: false,
                    updatedAt: Date.now()
                };
                delete interrupted.aiFallback;
                this.db.health.aiAdviceChat[idx] = interrupted;
                window.errorBus?.event?.('advice.request', 'stream_interrupted', {
                    provider,
                    model,
                    elapsedMs: Date.now() - requestStarted,
                    outputChars: interrupted.content.length,
                    type: interrupted.errorInfo.type
                });
                this.save();
                return;
            }
            const failure = this.classifyAdviceFailure?.(e, requestMessages || [], model) || { content: `分析失败：${window.toast ? toast.sanitize(e) : e.message}`, info: {} };
            const fallbackTarget = (hasImageAttachment || !String(previous?.content || '').trim())
                ? safeAdviceFallbackTarget(e?.aiFallback, adviceTaskId)
                : null;
            preserveAttachmentPayload = !!(hasImageAttachment && fallbackTarget && !attachmentPayloadId);
            const failed = { id: pendingId, role: 'assistant', content: failure.content, at: new Date().toISOString(), model, provider, temporaryModel: isOverride, error: true, errorInfo: { ...(failure.info || {}), ...(this._adviceRequestMeta || {}) }, retryPrompt: effectivePrompt, ...(fallbackTarget ? { aiFallback: { taskId: adviceTaskId, target: fallbackTarget } } : {}), deleted: false, updatedAt: Date.now(), replyToId, versionIdx: baseVersionIdx, versionActive: options?.versionActive !== false, versionPinned: !!options?.versionPinned };
            if (fallbackTarget && urls.length) Object.defineProperty(failed, '_userProvidedUrls', { value: urls });
            if (idx >= 0) this.db.health.aiAdviceChat[idx] = failed;
            else this.db.health.aiAdviceChat.push(failed);
            window.errorBus?.event?.('advice.request', 'failed', {
                provider,
                model,
                elapsedMs: Date.now() - requestStarted,
                type: failure.info?.type || e?.code || e?.name || 'unknown',
                status: failure.info?.status || e?.status || 0,
                requestMessageCount: requestMessages.length,
                hasImageAttachment,
                wasBackgrounded: !!this._adviceRequestMeta?.wasBackgrounded,
                pageHidden: !!this._adviceRequestMeta?.pageHidden
            });
            this.save();
            requestAnimationFrame(() => {
                if (!this._adviceUserScrollPaused && this._adviceFollowStream) {
                    this.scrollAdviceToLatest(true);
                }
            });
        } finally {
            if (activeAttachmentPayloadId && !preserveAttachmentPayload) {
                this.releaseAdviceAttachmentPayload?.(activeAttachmentPayloadId);
            }
            this._adviceSending = false;
            this._activeStreamRenderer = null;
            this._activeAdvicePendingId = '';
            this._adviceAbortController = null;
            this._adviceRequestMeta = null;
            this.releaseAdviceWakeLock?.();
            this.setAdviceStreamUiState('idle');
            this.updateAdviceSendState?.();
        }
    },

    findAssistantReplyForUser(userId = '') {
        if (!userId) return null;
        const messages = this.activeRecords(this.db.health?.aiAdviceChat || []);
        const userIndex = messages.findIndex(msg => msg?.id === userId && msg.role === 'user');
        if (userIndex < 0) return null;
        for (let i = userIndex + 1; i < messages.length; i++) {
            const msg = messages[i];
            if (!msg || msg.role === 'user') break;
            if (msg.role === 'assistant') return msg;
        }
        return null;
    },

    openEditAdviceMessage(idx, id = '') {
        const msg = this.findAdviceMessage(idx, id);
        if (!msg || msg.role !== 'user') return;
        if (this._adviceSending) {
            window.toast?.show?.('AI 正在回复，请稍后再编辑', 'info');
            return;
        }
        const original = String(msg.content || '');
        const commit = (value) => {
            const nextPrompt = String(value || '').trim();
            if (!nextPrompt) {
                window.toast?.show?.('问题不能为空', 'error');
                return false;
            }
            this.regenerateAdviceFromEditedUser(msg.id, nextPrompt).catch(e => {
                window.toast?.show?.(`重新提问失败：${window.toast?.sanitize ? toast.sanitize(e) : e?.message || e}`, 'error');
            });
            return true;
        };
        if (typeof this._openModal !== 'function') {
            const next = window.prompt?.('编辑问题后重新提问', original);
            if (next != null) commit(next);
            return;
        }
        return this._openModal({
            title: '编辑并重新提问',
            icon: 'edit_note',
            bodyHtml: `
                <div class="md-field" style="margin:0">
                    <textarea id="adviceEditPrompt" rows="7" placeholder=" " style="min-height:150px;max-height:50vh;overflow-y:auto;resize:vertical;-webkit-overflow-scrolling:touch;touch-action:pan-y">${this.escapeHtml(original)}</textarea>
                    <label>问题内容</label>
                </div>
                <div style="margin-top:8px;color:var(--md-sys-on-surface-variant);font-size:12px;line-height:1.45">保存后会在原对话位置重新提问，新回答会作为当前激活版本显示。</div>
            `,
            actionsHtml: `
                <button class="md-btn" type="button" data-modal-close>取消</button>
                <button class="md-btn md-btn-filled" type="button" data-advice-edit-save><span class="material-symbols-rounded">send</span> 重新提问</button>
            `,
            onMount: (root, close) => {
                const input = root.querySelector('#adviceEditPrompt');
                const save = root.querySelector('[data-advice-edit-save]');
                input?.focus?.();
                input?.setSelectionRange?.(input.value.length, input.value.length);
                const submit = () => {
                    if (commit(input?.value || '')) close();
                };
                save?.addEventListener('click', (e) => { e.preventDefault(); submit(); });
                input?.addEventListener('keydown', (e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        submit();
                    }
                });
            }
        });
    },

    async regenerateAdviceFromEditedUser(userId = '', prompt = '') {
        if (this._adviceSending) return;
        const messages = this.db.health?.aiAdviceChat || [];
        const user = messages.find(msg => msg?.id === userId && msg.role === 'user' && !msg.deleted);
        const nextPrompt = String(prompt || '').trim();
        if (!user || !nextPrompt) return;
        const now = Date.now();
        user.content = nextPrompt;
        user.editedAt = now;
        user.updatedAt = now;

        const reply = this.findAssistantReplyForUser(userId);
        const rootId = reply ? (reply.replyToId || reply.id) : '';
        const group = rootId ? this.getAdviceVersionGroup(rootId) : [];
        const nextVersionIdx = group.length
            ? Math.max(...group.map(item => Number(item.versionIdx || 0))) + 1
            : 0;
        group.forEach(item => {
            item.versionActive = false;
            item.updatedAt = now;
        });

        await this.sendAiAdvice(nextPrompt, {
            skipUserMessage: true,
            userProvidedUrls: window.searchToolLoop?.urlsFromText?.(nextPrompt) || [],
            insertAfterId: userId,
            replyToId: rootId,
            versionIdx: nextVersionIdx,
            versionActive: true
        });
        if (rootId) {
            this.pruneAdviceVersionGroup(rootId, 10);
            this.save({ render: false });
        }
        window.haptics?.light?.();
    },

    findAdviceMessage(idx, id = '') {
        const messages = this.activeRecords(this.db.health.aiAdviceChat || []);
        if (id) {
            const byId = messages.find(msg => msg.id === id);
            if (byId) return byId;
        }
        return idx >= 0 && idx < messages.length ? messages[idx] : null;
    },

    isEmptyAdviceAssistantMessage(msg) {
        if (!msg || msg.role !== 'assistant') return false;
        if (msg.pending || msg.error || msg.stopped) return false;
        return !String(msg.content || '').trim();
    },

    pruneEmptyAdviceAssistantMessages(rootId = '') {
        const list = this.db.health?.aiAdviceChat || [];
        const now = Date.now();
        let removed = 0;
        list.forEach(msg => {
            if (!this.isEmptyAdviceAssistantMessage(msg)) return;
            if (rootId && (msg.replyToId || msg.id) !== rootId) return;
            msg.deleted = true;
            msg.updatedAt = now;
            removed += 1;
        });
        return removed;
    },

    deleteAiAdviceMessage(idx, id = '') {
        const target = this.findAdviceMessage(idx, id);
        const targetId = target?.id;
        if (!targetId) return;
        return this.preserveAdviceScroll(() => {
            let renderResult = null;
            this.deleteWithUndo(this.db.health.aiAdviceChat, targetId, {
                save: () => this.saveAndBackup(),
                render: () => {
                    renderResult = this.refreshAdviceSearchResults?.();
                    return renderResult;
                }
            });
            return renderResult;
        });
    },

    copyAdviceMessage(idx, id = '') {
        const msg = this.findAdviceMessage(idx, id);
        if (!msg?.content) return;
        navigator.clipboard?.writeText(msg.content).catch(() => {});
        workout?.showToast?.('已复制 AI 回答');
    },

    retryAdviceFrom(idx, id = '', contextMode = '') {
        const messages = this.activeRecords(this.db.health.aiAdviceChat || []);
        const msg = this.findAdviceMessage(idx, id);
        if (!msg) return;
        this._adviceRetryPromises = this._adviceRetryPromises || new Map();
        if (msg.id && this._adviceRetryPromises.has(msg.id)) return this._adviceRetryPromises.get(msg.id);
        const msgIndex = messages.findIndex(m => m.id === msg.id);
        const prompt = msg?.retryPrompt || messages.slice(0, Math.max(0, msgIndex)).reverse().find(m => m.role === 'user')?.content;
        if (!prompt) return;
        let fallbackMeta = null;
        let fallbackTaskId = 'advice.chat';
        try {
            const fallbackDescriptor = Object.getOwnPropertyDescriptor(msg, 'aiFallback');
            if (fallbackDescriptor && !Object.prototype.hasOwnProperty.call(fallbackDescriptor, 'value')) return;
            fallbackMeta = fallbackDescriptor?.value;
            const taskDescriptor = fallbackMeta && typeof fallbackMeta === 'object'
                ? Object.getOwnPropertyDescriptor(fallbackMeta, 'taskId')
                : null;
            if (taskDescriptor
                && Object.prototype.hasOwnProperty.call(taskDescriptor, 'value')
                && taskDescriptor.value === 'advice.vision') fallbackTaskId = 'advice.vision';
        } catch {
            return;
        }
        const routeOverride = fallbackMeta ? safeAdviceFallbackTarget(fallbackMeta, fallbackTaskId) : null;
        if (fallbackMeta && !routeOverride) return;
        const attachmentPayloadId = fallbackTaskId === 'advice.vision' ? msg.id : '';
        if (attachmentPayloadId && !this.getAdviceAttachmentPayload?.(attachmentPayloadId)) {
            window.toast?.show?.('原图片仅在当前会话短期保留，请重新附图后再试。', 'info');
            return;
        }
        const proof = Object.getOwnPropertyDescriptor(msg, '_userProvidedUrls');
        const userProvidedUrls = proof && !proof.enumerable && Object.isFrozen(proof.value) ? proof.value : [];
        const startRetry = (sendOptions) => {
            const retry = Promise.resolve(this.sendAiAdvice(prompt, { ...sendOptions, routeOverride, attachmentPayloadId, userProvidedUrls }));
            if (!msg.id) return retry;
            this._adviceRetryPromises.set(msg.id, retry);
            retry.finally(() => {
                if (this._adviceRetryPromises?.get(msg.id) === retry) this._adviceRetryPromises.delete(msg.id);
            });
            return retry;
        };
        if (msg.role === 'assistant') {
            if ((this.db.aiRetryMode || 'versioned') === 'replace') {
                this.softDeleteById(this.db.health.aiAdviceChat, msg.id);
                this.db.aiTrash.push({ id: msg.id, deletedAt: Date.now(), payload: { ...msg } });
                this.save();
                return startRetry({ skipUserMessage: true, contextMode });
            }
            const rootId = msg.replyToId || msg.id;
            this.pruneEmptyAdviceAssistantMessages(rootId);
            const siblings = this.getAdviceVersionGroup(rootId);
            const nextIdx = siblings.length;
            const nextActive = true;
            siblings.forEach(s => {
                if (s.versionActive) {
                    s.versionActive = false;
                    s.updatedAt = Date.now();
                }
            });
            const result = startRetry({
                replyToId: rootId,
                versionIdx: nextIdx,
                skipUserMessage: true,
                versionActive: nextActive,
                contextMode
            });
            this.pruneAdviceVersionGroup(rootId, 10);
            return result;
        }
        return startRetry({ contextMode });
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
        this.preserveAdviceScroll(() => {
            removeVersion();
            this.save();
            return this.refreshAdviceSearchResults?.();
        });
        if (window.toast?.show) {
            toast.show('已删除', 'info', {
                action: '撤销',
                timeout: 5000,
                onAction: () => {
                    this.preserveAdviceScroll(() => {
                        restoreVersion();
                        this.save();
                        const renderResult = this.refreshAdviceSearchResults?.();
                        window.haptics?.success?.();
                        return renderResult;
                    });
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
                return `<div class="advice-template-row" role="group" aria-label="提示词模板">${templates.map(t => `<button class="advice-pill ${t.id === activeId ? 'active' : ''}" onclick="data.selectAdviceTemplate('${this.escapeHtml(t.id)}')" type="button" aria-pressed="${t.id === activeId}">${this.escapeHtml(t.name)}</button>`).join('')}</div>`;
            })()}
            ${this.renderAdviceFilterControls()}
        </div>`;
    },

    renderAdviceFilterControls() {
        const contexts = { diet: true, training: true, weight: true, goal: true, ...(this.adviceContexts || {}) };
        const ctxOpen = !!this.adviceContextOpen;
        const contextMode = ['auto', 'light', 'none'].includes(this.adviceContextMode) ? this.adviceContextMode : 'auto';
        const contextModeLabel = { auto: '自动', light: '轻量', none: '仅提问' }[contextMode] || '自动';
        const enabledCount = ['diet','training','weight','goal'].filter(k => contexts[k]).length;
        const range = this.adviceRange || 'today';
        const rawSearchQuery = this.adviceSearchQuery || '';
        const searchQuery = this.escapeHtml(rawSearchQuery);
        const searchOpen = !!this.adviceSearchOpen || !!this.adviceSearchQuery;
        const modeItems = 'auto,自动,auto_awesome|light,轻量,compress|none,仅提问,short_text'.split('|').map(item => item.split(','));
        return `
            <div class="advice-filter-row">
                <div class="advice-range-tabs" role="group" aria-label="对话时间范围">${[['today','今日'],['week','7天'],['month','30天'],['all','全部']].map(([key, label]) => `<button class="advice-pill ${range === key ? 'active' : ''}" onclick="data.setAdviceRange('${key}')" type="button" aria-pressed="${range === key}">${label}</button>`).join('')}</div>
                <div class="advice-filter-actions">
                    <button class="advice-search-toggle ${ctxOpen ? 'active' : ''}" onclick="data.toggleAdviceContextPanel()" type="button" aria-label="数据维度" title="数据维度">
                        <span class="material-symbols-rounded">tune</span>
                        ${contextMode !== 'auto' ? `<span class="advice-ctx-badge advice-ctx-mode-badge">${this.escapeHtml(contextModeLabel)}</span>` : enabledCount < 4 ? `<span class="advice-ctx-badge">${enabledCount}</span>` : ''}
                    </button>
                    <button class="advice-search-toggle ${searchOpen ? 'active' : ''}" onclick="data.toggleAdviceSearch()" type="button" aria-label="搜索聊天记录"><span class="material-symbols-rounded">search</span></button>
                </div>
            </div>
            ${searchOpen ? `<div class="advice-search-panel">
                <div class="advice-search-row">
                    <span class="material-symbols-rounded">search</span>
                    <input id="adviceSearchInput" value="${searchQuery}" oninput="data.onAdviceSearchInput(this)" placeholder="搜索聊天记录、日期或模型" autocomplete="off" aria-label="搜索聊天记录">
                    ${rawSearchQuery ? '<button onclick="data.clearAdviceSearch()" type="button" aria-label="清空搜索"><span class="material-symbols-rounded">close</span></button>' : ''}
                </div>
                <label class="advice-history-scope">
                    <input type="checkbox" ${range === 'all' ? 'checked' : ''} onchange="data.toggleAdviceHistorySearchScope(this.checked)">
                    <span class="material-symbols-rounded">history</span>
                    <span>包含全部历史</span>
                </label>
            </div>` : ''}
            ${ctxOpen ? `<div class="advice-context-popover">
                <div class="advice-context-popover-head">
                    <span>选择给 AI 的数据维度</span>
                    <button onclick="data.toggleAdviceContextPanel()" type="button" aria-label="关闭"><span class="material-symbols-rounded">close</span></button>
                </div>
                <div class="advice-context-section">
                    <small>上下文模式</small>
                    <div class="advice-context-mode-row">${modeItems.map(([key, label, icon]) => `<button class="advice-pill ${contextMode === key ? 'active' : ''}" onclick="data.setAdviceContextMode('${key}')" type="button" aria-pressed="${contextMode === key}"><span class="material-symbols-rounded">${icon}</span>${label}</button>`).join('')}</div>
                </div>
                <div class="advice-context-section">
                    <small>数据维度</small>
                <div class="advice-context-toggles">${[['diet','饮食','restaurant'],['training','训练','fitness_center'],['weight','体重','monitor_weight'],['goal','目标','flag']].map(([key, label, icon]) => `<button class="advice-pill ${contexts[key] ? 'active' : ''}" onclick="data.toggleAdviceContext('${key}')" type="button" aria-pressed="${contexts[key]}"><span class="material-symbols-rounded">${icon}</span>${label}</button>`).join('')}</div>
                </div>
                <small class="advice-context-hint">自动会按问题重点和模型预算裁剪；维度开关是可使用数据上限。</small>
            </div>` : ''}
        `;
    },

    renderAdvicePanel() {
        const messages = this.activeRecords(this.db.health.aiAdviceChat || []);
        const visibleMessages = this.visibleAdviceMessages(messages);
        const emptyHtml = this.renderAdviceMessages([], 0);
        this.prepareAdviceVirtualState(visibleMessages, this.adviceRange || 'today', { mount: false, emptyHtml });
        const virtualShell = this.renderAdviceVirtualShell(emptyHtml);
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
        const isSendingAdvice = !!this._adviceSending;
        const canSend = String(rawDraft || '').trim() || ((this._adviceAttachments || []).some(att => att && att.status !== 'failed' && (att.kind === 'image' || att.readable)));

        return `<div class="advice-v6-page ${this._adviceSuppressCardAnimation ? 'advice-no-enter' : ''}">
            <div class="ai-insight${expandedClass}">
                ${insightHeader}
                ${insightBaseline}
                <div class="ai-insight-body" id="aiInsightBody"${this._aiInsightExpanded ? '' : ' style="max-height:0;opacity:0;overflow:hidden"'}></div>
            </div>
            <div class="advice-v6-filter-bar">${this.renderAdviceFilterControls()}</div>
            <div class="sect-head"><span class="t">对话</span><button class="a" onclick="data.clearAdviceChat?.()" type="button">清空</button></div>
            <div class="ai-msg-list advice-v6-chat-list" data-advice-virtual-list="true">${virtualShell}</div>
            <nav class="advice-scroll-rail" aria-label="对话快速跳转">
                <button class="advice-rail-btn" onclick="data.scrollAdviceToTop()" type="button" aria-label="跳到最顶端" title="跳到最顶端"><span class="material-symbols-rounded">vertical_align_top</span></button>
                <button class="advice-rail-btn advice-rail-step" onclick="data.scrollAdviceToPrevBubble()" type="button" aria-label="上一段对话" title="上一段对话"><span class="material-symbols-rounded">expand_less</span></button>
                <button class="advice-rail-btn advice-rail-step" onclick="data.scrollAdviceToNextBubble()" type="button" aria-label="下一段对话" title="下一段对话"><span class="material-symbols-rounded">expand_more</span></button>
                <button class="advice-rail-btn" onclick="data.scrollAdviceToBottom()" type="button" aria-label="跳到最下端" title="跳到最下端"><span class="material-symbols-rounded">vertical_align_bottom</span></button>
            </nav>
            <button id="adviceNewMessageBtn" class="advice-new-message-btn hidden" onclick="data.jumpAdviceToLatest()" type="button" aria-hidden="true">↓ 新消息</button>
            <details class="glass-card advice-v6-suggestions-card"${messages.length ? '' : ' open'}>
                <summary>快速建议</summary>
                <div class="advice-v6-suggestions">${quicks.map(q => `<button onclick="data.useAdvicePrompt('${this.escapeHtml(q)}')" type="button">${this.escapeHtml(q)}</button>`).join('')}</div>
            </details>
            <div class="advice-composer-stack">
                ${this.renderAdviceAttachmentChips?.() || ''}
                <div class="ai-input">
                    ${this.renderAdviceAttachmentInputs?.() || ''}
                    ${this.renderAdviceModelChip()}
                    ${advicePanel.renderAdviceReasoningChip.call(this)}
                    ${this.renderAdviceAttachmentControls?.() || ''}
                    <textarea id="advicePrompt" class="advice-composer-input" rows="1" placeholder="问 AI 关于训练 / 饮食..." aria-label="向 AI 提问" oninput="data.onAdvicePromptInput(this)" onkeydown="data.onAdvicePromptKeydown(event)">${draft}</textarea>
                    <button id="adviceSendBtn" class="ai-send ${isSendingAdvice ? 'is-stopping' : ''}" onclick="${isSendingAdvice ? 'data.cancelAiAdvice()' : 'data.sendAiAdvice()'}" type="button" ${isSendingAdvice || canSend ? '' : 'disabled'} aria-label="${isSendingAdvice ? '停止生成' : '发送问题'}" title="${isSendingAdvice ? '停止生成' : '发送问题'}"><span class="material-symbols-rounded">${isSendingAdvice ? 'stop' : 'send'}</span></button>
                </div>
            </div>
        </div>`;
    },

    async requestInsightAiAdvice(options = {}) {
        const ctx = this._lastInsightCtx || {};
        const a = ctx.analysis || {};
        const m = ctx.metrics || {};
        const taskId = 'insight.quick';
        const normalizeTarget = (target) => window.aiRoutingPure?.manualFallbackTarget?.(target) || null;
        const routeOverride = normalizeTarget(options.routeOverride);
        const block = document.getElementById('aiInsightLlmBlock');
        if (!block) return;
        const today = this.logicalDateKey?.() || new Date().toISOString().slice(0, 10);
        const effective = ai.resolveTaskConfig?.(taskId, routeOverride) || ai.getEffectiveConfig?.() || ai.cfg || {};
        const requestedIdentity = normalizeTarget(effective) || routeOverride;
        const cacheKey = this.insightCacheKey?.(ctx, today, requestedIdentity) || today;
        const cached = !options.force ? this.getInsightCache?.(cacheKey, today) : null;
        if (cached?.html) {
            this.updateInsightAiBlock(cached.html);
            return;
        }
        if (!effective.enabled) {
            const local = ctx.diag ? (this.renderLocalAdvice?.(ctx.diag) || '') : '';
            this.updateInsightAiBlock(local || '<div class="ai-llm-label">本地建议</div><div>AI 未配置，已保留本地分析。</div>');
            return;
        }
        if (this._insightAiStreaming && !options.force) return;
        this._insightAiStreaming = true;
        block.className = 'ai-llm-block ai-llm-skeleton';
        block.innerHTML = '<div class="ai-llm-label"><span class="ai-llm-dot"></span> AI 正在生成具体建议…</div><div class="ai-llm-line"></div><div class="ai-llm-line"></div><div class="ai-llm-line ai-llm-short"></div>';
        try {
            const prefResult = window.dataAiTemplates?.buildPromptMessages('insight_advice', {}, this.db) || {};
            const insightSys = prefResult.messages?.find(m => m.role === 'system')?.content || '你是训练与营养健康顾问。只基于数据，用3条以内短建议，必须可执行。若存在待判训练标签，先判断它们属于 push、pull、lower、core、cardio、rehab 之一，并在最后用 JSON 单独输出：{"classifications":[{"label":"原标签","bucket":"lower"}],"advice":"建议正文"}。bucket 只能用这六个英文值。';
            const messages = [
                { role: 'system', content: insightSys },
                { role: 'user', content: `计划:${ctx.planTitle || '无'} ${ctx.planProgress || '--'} 下一项:${ctx.nextItemName || '无'}
饮食:蛋白${Math.round(m.proIntake || 0)}${m.proGoal ? '/' + Math.round(m.proGoal) + 'g' : 'g'} 热量${Math.round(m.calIntake || 0)}${m.calGoal ? '/' + Math.round(m.calGoal) + 'kcal' : 'kcal'}
训练:负荷${a.weeklyVolumeLoad ?? '--'}kg·rep 变化${a.volumeDelta ?? '--'}% 连续${a.streakDays ?? '--'}天 恢复${a.recoveryIndex ?? '--'}% 分布${a.pushPullRatio || '--'} 待判:${(a.unknownTrainingLabels || []).join('、') || '无'}
PR:${a.prLift || '无'} 1RM${a.prDistance || '--'} ${a.prWeight || '--'}kg${a.prReps ? 'x' + a.prReps : ''} 进阶:${ctx.progression?.suggestion || 'maintain'} ${ctx.progression?.reason || ''}
规则:${ctx.diag ? `${ctx.diag.title || ''} ${ctx.diag.subtitle || ''}` : '无告警'}` }
            ];
            const result = typeof ai.run === 'function'
                ? await ai.run({ taskId, messages, maxTokens: 700, routeOverride, returnMeta: true })
                : await ai.call(messages, 700);
            const text = typeof result === 'string' ? result : String(result?.text || '');
            if (!text.trim()) throw new Error('AI 返回内容为空');
            const parsed = this.parseTrainingClassificationResponse?.(text) || { advice: text, classifications: [] };
            this.cacheTrainingClassifications?.(parsed.classifications);
            const updatedCtx = parsed.classifications?.length && this.buildPlanAnalytics ? { ...ctx, ...this.buildPlanAnalytics() } : ctx;
            this._lastInsightCtx = { ...updatedCtx };
            const searchEvidence = window.searchEvidenceUi?.summary?.(result?.meta?.searchEvidence, taskId) || [];
            const html = `<div class="ai-llm-label">AI 跨域建议</div>${this.renderAdviceMarkdown(parsed.advice || text)}${window.searchEvidenceUi?.trail?.(searchEvidence, this.escapeHtml.bind(this)) || ''}`;
            const actualIdentity = normalizeTarget(result?.meta) || requestedIdentity;
            const actualCacheKey = this.insightCacheKey?.(ctx, today, actualIdentity) || cacheKey;
            this.setInsightCache?.(actualCacheKey, today, html, { text: parsed.advice || text, classifications: parsed.classifications || [], analysis: updatedCtx.analysis || {}, searchEvidence });
            this.updateInsightAiBlock(html);
            if (parsed.classifications?.length && this._aiInsightExpanded) {
                this._cachedInsightHtml = html;
                this._insightBodyRendered = false;
                this.rerenderAdvicePanel?.({ refreshMessages: false });
            }
        } catch (error) {
            const local = ctx.diag ? (this.renderLocalAdvice?.(ctx.diag) || '') : '';
            const msg = window.toast?.sanitize ? toast.sanitize(error) : (error?.message || 'AI 建议生成失败');
            this.updateInsightAiBlock(local || `<div class="ai-llm-label">本地建议</div><div>AI 暂不可用：${this.escapeHtml(msg)}。</div>`);
            const target = error?.aiFallback?.taskId === taskId ? normalizeTarget(error.aiFallback.target) : null;
            if (target) {
                let retryPromise;
                window.toast?.show?.(msg, 'error', {
                    timeout: 6000,
                    action: '使用备用模型重试',
                    onAction: () => retryPromise ||= Promise.resolve(this.requestInsightAiAdvice({ force: true, routeOverride: target }))
                });
            }
        } finally {
            this._insightAiStreaming = false;
            this.resizeInsightBody?.();
        }
    },

    updateInsightAiBlock(html = '') {
        const block = document.getElementById('aiInsightLlmBlock');
        if (!block) return;
        block.className = 'ai-llm-block';
        block.innerHTML = html;
        this.resizeInsightBody?.();
    },

    insightCacheKey(ctx = {}, today = '', identity = null) {
        const a = ctx.analysis || {};
        return [
            today,
            String(identity?.profileId || ''),
            String(identity?.modelId || ''),
            ctx.planProgress || '',
            ctx.planTitle || '',
            ctx.nextItemName || '',
            a.pushPullRatio || '',
            (a.unknownTrainingLabels || []).join('|'),
            a.weeklyVolumeLoad ?? '',
            a.recoveryIndex ?? '',
            ctx.diag?.id || ctx.diag?.title || ''
        ].join('::').slice(0, 500);
    },

    getInsightCache(key = '', today = '') {
        const cache = this.db.health?.aiInsightCache;
        if (!cache || cache.date !== today || cache.key !== key || !cache.html) return null;
        return cache;
    },

    setInsightCache(key = '', today = '', html = '', payload = {}) {
        this.db.health = this.db.health || {};
        this.db.health.aiInsightCache = {
            id: 'ai-insight-cache',
            date: today,
            key,
            html,
            payload,
            updatedAt: Date.now(),
            deleted: false
        };
        this.save?.({ render: false });
    },

    parseTrainingClassificationResponse(raw = '') {
        const text = String(raw || '').trim();
        const parseJson = (value) => { try { return JSON.parse(value); } catch { return null; } };
        const json = parseJson(text)
            || parseJson((text.match(/```(?:json)?\s*([\s\S]*?)```/i) || [])[1] || '')
            || parseJson((text.match(/\{[\s\S]*\}/) || [])[0] || '');
        if (!json || typeof json !== 'object') return { advice: text, classifications: [] };
        const allowed = new Set((typeof window !== 'undefined' ? window.actionTaxonomy?.TRAINING_BUCKETS : null) || []);
        const classifications = (Array.isArray(json.classifications) ? json.classifications : [])
            .map(item => ({ label: String(item?.label || item?.name || '').trim(), bucket: String(item?.bucket || item?.category || '').trim().toLowerCase() }))
            .filter(item => item.label && allowed.has(item.bucket))
            .slice(0, 24);
        return { advice: String(json.advice || json.suggestion || json.text || text).trim(), classifications };
    },

    cacheTrainingClassifications(classifications = []) {
        const normalizer = window.planAnalytics;
        const keyFor = (value) => normalizer?._trainingLabelKey ? normalizer._trainingLabelKey(value) : String(value || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
        const bucketFor = (value) => normalizer?._normalizeTrainingBucket ? normalizer._normalizeTrainingBucket(value) : value;
        const valid = (classifications || [])
            .map(item => ({ label: String(item?.label || '').trim(), bucket: bucketFor(item?.bucket) }))
            .filter(item => item.label && item.bucket);
        if (!valid.length) return false;
        this.db.health = this.db.health || {};
        const cache = this.db.health.trainingLabelClassifications && typeof this.db.health.trainingLabelClassifications === 'object'
            ? this.db.health.trainingLabelClassifications
            : {};
        const now = Date.now();
        valid.forEach((item) => {
            cache[keyFor(item.label)] = { label: item.label, bucket: item.bucket, source: 'ai-insight', updatedAt: now, deleted: false };
        });
        this.db.health.trainingLabelClassifications = cache;
        this.save?.({ render: false });
        return true;
    },

    resizeInsightBody() {
        const body = document.getElementById('aiInsightBody');
        if (body && this._aiInsightExpanded) body.style.maxHeight = body.scrollHeight + 40 + 'px';
    },

    runInsightAction(action = '') {
        const ctx = this._lastInsightCtx || {};
        if (action === 'continue') {
            if (ctx.planId && ctx.nextItemId) this.handlePlanTaskTap?.(ctx.planId, ctx.nextItemId);
            return;
        }
        if (action === 'progression') {
            if (ctx.planId && ctx.nextItemId) this.maybeApplyProgression?.(ctx.planId, ctx.nextItemId);
            return;
        }
        if (action === 'ai') {
            const today = this.logicalDateKey?.() || new Date().toISOString().slice(0, 10);
            const key = this.insightCacheKey?.(ctx, today) || today;
            if (this.db.health?.aiInsightCache?.key === key) this.db.health.aiInsightCache.deleted = true;
            this.requestInsightAiAdvice?.({ force: true });
        }
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
                const localHtml = diag ? (this.renderLocalAdvice?.(diag) || '') : '';
                const llmHtml = `<div id="aiInsightLlmBlock" class="ai-llm-block">${this._cachedInsightHtml || localHtml || '<div class="ai-llm-label"><span class="material-symbols-rounded" style="font-size:14px">tips_and_updates</span> AI 建议</div><div>展开后将基于今日训练、饮食和恢复数据生成建议。</div>'}</div>`;
                const expandableHtml = this.renderInsightExpandable?.({ ...diagCtx, llmHtml, llmStreaming: false }) || '';
                body.innerHTML = expandableHtml;
                this._insightBodyRendered = true;
                requestAnimationFrame(() => { body.style.maxHeight = body.scrollHeight + 40 + 'px'; });
                if (!this._cachedInsightHtml) this.requestInsightAiAdvice?.();
                this._cachedInsightHtml = '';
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
    if (window.data) {
        advicePanel.attach(window.data);
    }
}
