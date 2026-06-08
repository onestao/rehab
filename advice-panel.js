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
            setAdviceModel: this.setAdviceModel,
            providerKeyForModel: this.providerKeyForModel,
            providerIcon: this.providerIcon,
            modelShortName: this.modelShortName,
            bindAdviceModelPickerActions: this.bindAdviceModelPickerActions,
            openAdviceModelPicker: this.openAdviceModelPicker,
            closeAdviceModelPicker: this.closeAdviceModelPicker,
            chooseAdviceModel: this.chooseAdviceModel,
            setAdviceModelPickerScope: this.setAdviceModelPickerScope,
            renderAdviceModelPicker: this.renderAdviceModelPicker,
            setAdviceRange: this.setAdviceRange,
            toggleAdviceContext: this.toggleAdviceContext,
            setAdviceContextMode: this.setAdviceContextMode,
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
            visibleAdviceWindowMessages: this.visibleAdviceWindowMessages,
            resetAdviceRenderWindow: this.resetAdviceRenderWindow,
            expandAdviceRenderWindow: this.expandAdviceRenderWindow,
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
            showAdviceDebugOverlay: this.showAdviceDebugOverlay,
            toggleDebugTools: this.toggleDebugTools,
            initDebugTools: this.initDebugTools,
            _mountDebugFab: this._mountDebugFab,
            _handleAdviceStreamScroll: this._handleAdviceStreamScroll,
            getAdviceVersionGroup: this.getAdviceVersionGroup,
            setActiveAdviceVersion: this.setActiveAdviceVersion,
            cycleAdviceVersion: this.cycleAdviceVersion,
            _isVersionActive: this._isVersionActive,
            pinAdviceVersion: this.pinAdviceVersion,
            deleteAdviceVersion: this.deleteAdviceVersion
        });
        Object.assign(target, window.adviceTemplateManager || {});
        Object.assign(target, window.adviceAttachments || {});

        target.loadAdviceSettings?.();
        this.listenThemeChanges();
        requestAnimationFrame(() => {
            const retry = document.getElementById('aiRetryMode');
            if (retry) retry.value = this.db?.aiRetryMode || 'versioned';
        });
        target.bindAdviceRequestLifecycle?.();
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

            if (parsed.contextMode === 'auto' || parsed.contextMode === 'light' || parsed.contextMode === 'none') {
                this.adviceContextMode = parsed.contextMode;
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
                contextMode: ['auto', 'light', 'none'].includes(this.adviceContextMode) ? this.adviceContextMode : 'auto',
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

    _adviceDebugLog(label, payload) {
        if (!this._debugToolsEnabled) return;
        try {
            const summary = `${label} | sc=${payload.scrollerTag} cy=${payload.currentY} wy=${payload.windowScrollY} st=${payload.scrollerScrollTop} t=${payload.targetOffset}`;
            document.title = summary.slice(0, 80);
            window.errorBus?.log?.('advice:scroll', summary, { ...payload, label });
        } catch (e) {
            // ignore — debug helper must never break the app
        }
    },

    showAdviceDebugOverlay() {
        try {
            const existing = document.getElementById('adviceDebugOverlay');
            if (existing) { existing.remove(); return; }
            const errors = window.errorBus?.list?.() || [];
            const debugEntries = window.errorBus?.listDebug?.() || [];
            const records = [
                ...errors.map(e => ({
                    t: Date.parse(e.at) || 0,
                    iso: e.at || new Date().toISOString(),
                    level: 'error',
                    scope: e.scope || 'unknown',
                    message: e.message || '',
                    meta: e.meta || null,
                    stack: e.stack || null
                })),
                ...debugEntries.map(d => ({
                    t: d.t || 0,
                    iso: new Date(d.t || Date.now()).toISOString(),
                    level: d.level || 'log',
                    scope: d.scope || 'global',
                    message: Array.isArray(d.args) ? d.args.join(' ') : String(d.args || ''),
                    meta: d.extra || null,
                    stack: null
                }))
            ].sort((a, b) => a.t - b.t);
            const ndjson = records.map(r => JSON.stringify(r)).join('\n');

            const wrap = document.createElement('div');
            wrap.id = 'adviceDebugOverlay';
            wrap.style.cssText = 'position:fixed;left:0;right:0;bottom:0;top:25%;background:#000;color:#0f0;font:11px/1.4 ui-monospace,monospace;padding:10px;z-index:9999;overflow:auto';

            const bar = document.createElement('div');
            bar.style.cssText = 'position:sticky;top:-10px;margin:-10px -10px 8px;padding:8px;background:#111;border-bottom:1px solid #333;display:flex;flex-wrap:wrap;gap:6px;align-items:center';
            const status = document.createElement('span');
            status.style.cssText = 'flex:1;min-width:120px;color:#0f0';
            status.textContent = '共 ' + records.length + ' 条 · 仅会话级元数据，已脱敏';
            const mkBtn = (label, bg, fn) => {
                const b = document.createElement('button');
                b.textContent = label;
                b.style.cssText = 'background:' + bg + ';color:' + (bg === '#fff' ? '#000' : '#fff') + ';border:0;padding:4px 10px;border-radius:4px;font-size:12px';
                b.onclick = fn;
                return b;
            };
            const copy = (text, ok) => {
                const done = () => { status.textContent = ok; };
                try {
                    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).then(done).catch(fb);
                } catch {}
                fb();
                function fb() {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.cssText = 'position:fixed;left:-9999px';
                    document.body.appendChild(ta);
                    ta.select();
                    try { document.execCommand('copy'); } catch {}
                    ta.remove();
                    done();
                }
            };
            bar.appendChild(status);
            const note = document.createElement('div');
            note.style.cssText = 'width:100%;color:#9f9;font-size:11px;opacity:.85';
            note.textContent = '导出内容不进入业务数据/同步/备份；默认只含状态、耗时、数量、错误类型等元数据。';
            bar.appendChild(note);
            bar.appendChild(mkBtn('文本', '#08f', () => {
                copy(records.map((r, i) => '#' + i + ' ' + new Date(r.t).toLocaleTimeString() + ' [' + r.level + '] ' + r.scope + '\nmsg: ' + r.message + (r.meta ? '\nmeta: ' + (typeof r.meta === 'string' ? r.meta : JSON.stringify(r.meta)) : '')).join('\n\n'), '已复制 (' + records.length + ')');
            }));
            bar.appendChild(mkBtn('NDJSON', '#0a8', () => copy(ndjson, '已复制 NDJSON (' + records.length + ')')));
            bar.appendChild(mkBtn('下载', '#a08', () => {
                try {
                    const url = URL.createObjectURL(new Blob([ndjson], { type: 'application/x-ndjson;charset=utf-8' }));
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'rehab-debug-' + new Date().toISOString().replace(/[:.]/g, '-') + '.ndjson';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 4000);
                    status.textContent = '已下载 (' + records.length + ')';
                } catch (e) { status.textContent = '下载失败:' + e.message; }
            }));
            bar.appendChild(mkBtn('清空', '#f80', () => { window.errorBus?.clear?.(); wrap.remove(); }));
            bar.appendChild(mkBtn('关闭', '#fff', () => wrap.remove()));
            wrap.appendChild(bar);

            const list = document.createElement('div');
            list.style.cssText = 'display:flex;flex-direction:column;gap:6px';
            if (!records.length) {
                const empty = document.createElement('div');
                empty.textContent = '(empty)';
                empty.style.opacity = '0.6';
                list.appendChild(empty);
            } else {
                records.forEach((r, i) => {
                    const card = document.createElement('div');
                    card.style.cssText = 'border:1px solid #1a3;border-radius:6px;padding:6px 8px;background:#020;white-space:pre-wrap;word-break:break-all';
                    let body = '#' + i + ' ' + new Date(r.t).toLocaleTimeString() + ' [' + r.level + '] ' + r.scope + '\nmsg: ' + r.message;
                    if (r.meta) {
                        if (Array.isArray(r.meta?.diffs)) body += '\ndiffs (' + r.meta.diffs.length + '):\n  ' + r.meta.diffs.map(d => '- ' + d).join('\n  ');
                        else body += '\nmeta: ' + (typeof r.meta === 'string' ? r.meta : JSON.stringify(r.meta));
                    }
                    if (r.stack) body += '\nstack: ' + r.stack.split('\n').slice(0, 3).join(' | ');
                    card.textContent = body;
                    list.appendChild(card);
                });
            }
            wrap.appendChild(list);
            document.body.appendChild(wrap);
        } catch (e) {
            alert('debug overlay failed: ' + e.message);
        }
    },

    toggleDebugTools() {
        try {
            this._debugToolsEnabled = !this._debugToolsEnabled;
            if (this._debugToolsEnabled) {
                localStorage.setItem('rehab_debug_tools', '1');
                window.errorBus?.enableDebug?.();
                this._mountDebugFab?.();
            } else {
                localStorage.removeItem('rehab_debug_tools');
                window.errorBus?.disableDebug?.();
                document.getElementById('adviceDebugOverlay')?.remove();
                document.getElementById('adviceDebugFab')?.remove();
            }
            if (typeof toast?.show === 'function') {
                toast.show('调试工具' + (this._debugToolsEnabled ? '已启用，将记录全局错误、控制台、网络与导航事件' : '已关闭'));
            }
            this.rerenderAdvicePanel?.();
            this.renderProfilePage?.();
        } catch (e) {
            console.warn('toggleDebugTools failed', e);
        }
    },

    initDebugTools() {
        try {
            this._debugToolsEnabled = localStorage.getItem('rehab_debug_tools') === '1';
        } catch {
            this._debugToolsEnabled = false;
        }
        if (this._debugToolsEnabled) {
            window.errorBus?.enableDebug?.();
            this._mountDebugFab?.();
        }
    },

    _mountDebugFab() {
        if (document.getElementById('adviceDebugFab')) return;
        const fab = document.createElement('button');
        fab.id = 'adviceDebugFab';
        fab.type = 'button';
        fab.textContent = 'LOG';
        fab.title = '查看调试日志（点击查看 / 长按拖动）';
        fab.style.cssText = 'position:fixed;right:6px;bottom:120px;width:42px;height:42px;border-radius:50%;border:0;background:#000;color:#0f0;font:700 11px/1 ui-monospace,monospace;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(0,0,0,0.35);z-index:9998;cursor:pointer;';
        fab.onclick = () => this.showAdviceDebugOverlay?.();
        document.body.appendChild(fab);
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
        // Some iOS Safari WebViews silently ignore smooth scrolling on a nested
        // overflow ancestor. Verify after a frame and force the position if
        // nothing actually moved.
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
        this.bindAdviceModelPickerActions(content);
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
        if (content) {
            content.innerHTML = this.renderAdviceModelPicker();
            this.bindAdviceModelPickerActions(content);
        }
    },

    bindAdviceModelPickerActions(root) {
        if (!root || root.dataset.adviceModelPickerActionsBound === '1') return;
        root.dataset.adviceModelPickerActionsBound = '1';
        root.addEventListener('click', (event) => {
            const row = event.target?.closest?.('[data-advice-model-action="choose"]');
            if (!row || !root.contains(row)) return;
            event.preventDefault();
            this.chooseAdviceModel(
                row.getAttribute('data-profile-id') || '',
                row.getAttribute('data-provider') || '',
                row.getAttribute('data-model') || ''
            );
        });
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
                return `<button class="model-picker-row advice-model-${visual.key} ${row.model === effective.model && row.provider === effective.provider ? 'is-selected' : ''}" ${style ? `style="${this.escapeHtml(style)}"` : ''} type="button" aria-disabled="${row.disabled}" title="${row.disabled ? '未配置 API Key' : ''}" data-advice-model-action="choose" data-profile-id="${this.escapeHtml(row.profileId)}" data-provider="${this.escapeHtml(row.provider)}" data-model="${this.escapeHtml(row.model)}">
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
        this.resetAdviceRenderWindow?.();
        this.captureAdviceDraft();
        this.refreshAdviceSearchResults();
    },

    clearAdviceSearch() {
        this.adviceSearchQuery = '';
        this.adviceSearchOpen = false;
        this.resetAdviceRenderWindow?.();
        this.captureAdviceDraft();
        this.captureAdviceScroll();
        this.rerenderAdvicePanel({ expandChrome: true });
    },

    refreshAdviceSearchResults() {
        const list = this._adviceMessageList?.();
        const summary = document.getElementById('adviceMessageSummary');
        if (!list) return;
        const messages = this.activeRecords(this.db.health.aiAdviceChat || []);
        const visibleMessages = this.visibleAdviceMessages(messages);
        const windowed = this.visibleAdviceWindowMessages(visibleMessages);
        list.innerHTML = this.renderAdviceMessages(windowed.messages, windowed.hiddenCount);
        if (summary) summary.textContent = this.adviceMessageSummary(messages, visibleMessages);
    },

    setAdviceRange(range) {
        this.adviceRange = range || 'today';
        this.resetAdviceRenderWindow?.();
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

    resetAdviceRenderWindow() {
        this._adviceRenderLimit = 80;
    },

    visibleAdviceWindowMessages(messages = []) {
        const limit = Math.max(20, Number(this._adviceRenderLimit || 80));
        if (this.adviceSearchQuery || messages.length <= limit) {
            return { messages, hiddenCount: 0, totalCount: messages.length };
        }
        return {
            messages: messages.slice(-limit),
            hiddenCount: Math.max(0, messages.length - limit),
            totalCount: messages.length
        };
    },

    expandAdviceRenderWindow(step = 80) {
        const current = Math.max(20, Number(this._adviceRenderLimit || 80));
        this._adviceRenderLimit = current + Math.max(20, Number(step) || 80);
        this.captureAdviceDraft?.();
        this.rerenderAdvicePanel?.();
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
        fn();
        requestAnimationFrame(() => {
            const nextList = this._adviceMessageList?.();
            if (!nextList) return;
            const nextScroller = this._adviceScrollContainer?.();
            const heightDelta = (nextScroller?.scrollHeight || nextList.scrollHeight) - beforeHeight;
            this._adviceSetScrollY?.(nextScroller, Math.max(0, beforeTop + heightDelta), false);
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
        const attachments = (!promptOverride && !options?.skipUserMessage) ? (this._adviceAttachments || []).filter(att => att && att.status !== 'failed').slice() : [];
        const effectivePrompt = prompt || (attachments.some(att => att.kind === 'image') ? '请结合附件内容进行分析，并给出可执行建议。' : '请分析附件内容，并给出可执行建议。');
        if (!(this.canSendAdviceWithAttachments?.(prompt, attachments) || prompt)) return;
        if (attachments.some(att => att.status === 'processing')) {
            window.toast?.show?.('附件仍在处理中，请稍后发送', 'info');
            return;
        }
        const model = effective.model || ai.cfg.model;
        const provider = effective.provider || ai.cfg.provider || 'openai';
        const hasImageAttachment = attachments.some(att => att.kind === 'image');
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
        const isOverride = !!ai.overrideModel && (
            ai.overrideModel.model !== ai.cfg.model ||
            ai.overrideModel.provider !== ai.cfg.provider ||
            ai.overrideModel.profileId !== ai.cfg.activeProfileId
        );
        const now = new Date().toISOString();
        const pendingId = this.generateRecordId('advice-pending');
        this._activeAdvicePendingId = pendingId;
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
        try {
            const contextMode = ['auto', 'light', 'none'].includes(options?.contextMode || this.adviceContextMode) ? (options?.contextMode || this.adviceContextMode) : 'auto';
            const baseMessages = this.buildAdviceMessages(effectivePrompt, model, { contextMode });
            const messages = this.applyAdviceAttachmentsToMessages?.(baseMessages, attachments) || baseMessages;
            requestMessages = messages;
            window.errorBus?.event?.('advice.request', 'prepared', {
                provider,
                model,
                contextMode,
                requestMessageCount: messages.length,
                hasImageAttachment,
                attachmentCount: attachments.length
            });
            let full = '';
            let _lastRender = 0;
            let _pendingFrame = 0;
            /** @type {{ in: number, out: number }|null} */
            let lastUsage = null;
            const onToken = (delta, accumulated, meta) => {
                    if (controller.signal.aborted || this._activeAdvicePendingId !== pendingId) return;
                    const idx = this.db.health.aiAdviceChat.findIndex(msg => msg.id === pendingId);
                    if (idx < 0) return;
                    if (this.db.health.aiAdviceChat[idx].stopped) return;
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
            };
            full = hasImageAttachment
                ? await ai.callAdviceWithAttachments(messages, attachments, 2400, {
                    signal: controller.signal,
                    timeoutMs: 45000,
                    onProgress: ({ stage, message }) => {
                        const idx = this.db.health.aiAdviceChat.findIndex(msg => msg.id === pendingId);
                        if (idx < 0) return;
                        const status = message || (stage === 'resize' ? '正在处理图片…' : stage === 'request' ? '正在请求视觉模型…' : '正在分析附件…');
                        this.db.health.aiAdviceChat[idx].content = status;
                        this.db.health.aiAdviceChat[idx].pending = true;
                        this.rerenderAdvicePanel?.();
                    }
                })
                : await ai.callStream(messages, 2400, onToken, { signal: controller.signal });
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
                updatedAt: Date.now()
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
            const failure = this.classifyAdviceFailure?.(e, requestMessages || [], model) || { content: `分析失败：${window.toast ? toast.sanitize(e) : e.message}`, info: {} };
            const failed = { id: pendingId, role: 'assistant', content: failure.content, at: new Date().toISOString(), model, provider, temporaryModel: isOverride, error: true, errorInfo: { ...(failure.info || {}), ...(this._adviceRequestMeta || {}) }, retryPrompt: prompt, deleted: false, updatedAt: Date.now(), replyToId, versionIdx: baseVersionIdx, versionActive: options?.versionActive !== false, versionPinned: !!options?.versionPinned };
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
        this._openModal({
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

    retryAdviceFrom(idx, id = '', contextMode = '') {
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
                return this.sendAiAdvice(prompt, { skipUserMessage: true, contextMode });
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
            const result = this.sendAiAdvice(prompt, {
                replyToId: rootId,
                versionIdx: nextIdx,
                skipUserMessage: true,
                versionActive: nextActive,
                contextMode
            });
            this.pruneAdviceVersionGroup(rootId, 10);
            return result;
        }
        return this.sendAiAdvice(prompt, { contextMode });
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
                <div class="advice-range-tabs">${[['today','今日'],['week','7天'],['month','30天'],['all','全部']].map(([key, label]) => `<button class="advice-pill ${range === key ? 'active' : ''}" onclick="data.setAdviceRange('${key}')" type="button">${label}</button>`).join('')}</div>
                <div class="advice-filter-actions">
                    <button class="advice-search-toggle ${ctxOpen ? 'active' : ''}" onclick="data.toggleAdviceContextPanel()" type="button" aria-label="数据维度" title="数据维度">
                        <span class="material-symbols-rounded">tune</span>
                        ${contextMode !== 'auto' ? `<span class="advice-ctx-badge advice-ctx-mode-badge">${this.escapeHtml(contextModeLabel)}</span>` : enabledCount < 4 ? `<span class="advice-ctx-badge">${enabledCount}</span>` : ''}
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
                <div class="advice-context-section">
                    <small>上下文模式</small>
                    <div class="advice-context-mode-row">${modeItems.map(([key, label, icon]) => `<button class="advice-pill ${contextMode === key ? 'active' : ''}" onclick="data.setAdviceContextMode('${key}')" type="button" aria-pressed="${contextMode === key}"><span class="material-symbols-rounded">${icon}</span>${label}</button>`).join('')}</div>
                </div>
                <div class="advice-context-section">
                    <small>数据维度</small>
                <div class="advice-context-toggles">${[['diet','饮食','restaurant'],['training','训练','fitness_center'],['weight','体重','monitor_weight'],['goal','目标','flag']].map(([key, label, icon]) => `<button class="advice-pill ${contexts[key] ? 'active' : ''}" onclick="data.toggleAdviceContext('${key}')" type="button"><span class="material-symbols-rounded">${icon}</span>${label}</button>`).join('')}</div>
                </div>
                <small class="advice-context-hint">自动会按模型预算裁剪；轻量适合网页转 API；仅提问不附带记录。</small>
            </div>` : ''}
        `;
    },

    renderAdvicePanel() {
        const messages = this.activeRecords(this.db.health.aiAdviceChat || []);
        const visibleMessages = this.visibleAdviceMessages(messages);
        const windowedMessages = this.visibleAdviceWindowMessages(visibleMessages);
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
            <div class="ai-msg-list advice-v6-chat-list">${this.renderAdviceMessages(windowedMessages.messages, windowedMessages.hiddenCount)}</div>
            <div class="advice-scroll-rail" aria-label="对话快速跳转">
                <button class="advice-rail-btn" onclick="data.scrollAdviceToTop()" type="button" aria-label="跳到最顶端" title="跳到最顶端"><span class="material-symbols-rounded">vertical_align_top</span></button>
                <button class="advice-rail-btn" onclick="data.scrollAdviceToPrevBubble()" type="button" aria-label="上一段对话" title="上一段对话"><span class="material-symbols-rounded">expand_less</span></button>
                <button class="advice-rail-btn" onclick="data.scrollAdviceToNextBubble()" type="button" aria-label="下一段对话" title="下一段对话"><span class="material-symbols-rounded">expand_more</span></button>
                <button class="advice-rail-btn" onclick="data.scrollAdviceToBottom()" type="button" aria-label="跳到最下端" title="跳到最下端"><span class="material-symbols-rounded">vertical_align_bottom</span></button>
            </div>
            <button id="adviceNewMessageBtn" class="advice-new-message-btn hidden" onclick="data.jumpAdviceToLatest()" type="button" aria-hidden="true">↓ 新消息</button>
            <div class="glass-card advice-v6-suggestions-card">
                <div class="sect-head" style="padding:0 0 8px;margin:0"><span class="t">快速建议</span></div>
                <div class="advice-v6-suggestions">${quicks.map(q => `<button onclick="data.useAdvicePrompt('${this.escapeHtml(q)}')" type="button">${this.escapeHtml(q)}</button>`).join('')}</div>
            </div>
            <div class="advice-composer-stack">
                ${this.renderAdviceAttachmentChips?.() || ''}
                <div class="ai-input">
                    ${this.renderAdviceAttachmentInputs?.() || ''}
                    ${this.renderAdviceModelChip()}
                    ${this.renderAdviceAttachmentControls?.() || ''}
                    <textarea id="advicePrompt" class="advice-composer-input" rows="1" placeholder="问 AI 关于训练 / 饮食..." oninput="data.onAdvicePromptInput(this)" onkeydown="data.onAdvicePromptKeydown(event)">${draft}</textarea>
                    <button id="adviceSendBtn" class="ai-send ${isSendingAdvice ? 'is-stopping' : ''}" onclick="${isSendingAdvice ? 'data.cancelAiAdvice()' : 'data.sendAiAdvice()'}" type="button" ${isSendingAdvice || canSend ? '' : 'disabled'} aria-label="${isSendingAdvice ? '停止生成' : '发送问题'}" title="${isSendingAdvice ? '停止生成' : '发送问题'}"><span class="material-symbols-rounded">${isSendingAdvice ? 'stop' : 'send'}</span></button>
                </div>
            </div>
        </div>`;
    },

    async requestInsightAiAdvice(options = {}) {
        const ctx = this._lastInsightCtx || {};
        const a = ctx.analysis || {};
        const m = ctx.metrics || {};
        const block = document.getElementById('aiInsightLlmBlock');
        if (!block) return;
        const today = this.logicalDateKey?.() || new Date().toISOString().slice(0, 10);
        const cacheKey = this.insightCacheKey?.(ctx, today) || today;
        const cached = !options.force ? this.getInsightCache?.(cacheKey, today) : null;
        if (cached?.html) {
            this.updateInsightAiBlock(cached.html);
            return;
        }
        const effective = ai.getEffectiveConfig?.() || ai.cfg || {};
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
            const text = await ai.call(messages, 700);
            const parsed = this.parseTrainingClassificationResponse?.(text) || { advice: text, classifications: [] };
            this.cacheTrainingClassifications?.(parsed.classifications);
            const updatedCtx = parsed.classifications?.length && this.buildPlanAnalytics ? { ...ctx, ...this.buildPlanAnalytics() } : ctx;
            this._lastInsightCtx = { ...updatedCtx };
            const html = `<div class="ai-llm-label">AI 跨域建议</div>${this.renderAdviceMarkdown(parsed.advice || text)}`;
            this.setInsightCache?.(cacheKey, today, html, { text: parsed.advice || text, classifications: parsed.classifications || [], analysis: updatedCtx.analysis || {} });
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

    insightCacheKey(ctx = {}, today = '') {
        const a = ctx.analysis || {};
        return [
            today,
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
        const allowed = new Set(['push', 'pull', 'lower', 'core', 'cardio', 'rehab']);
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
        advicePanel.initDebugTools.call(window.data);
    }
}
