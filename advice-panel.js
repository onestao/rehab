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
            toggleAdviceContextPanel: this.toggleAdviceContextPanel,
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
            renderAdvicePanel: this.renderAdvicePanel,
            setAdviceStreamUiState: this.setAdviceStreamUiState,
            toggleAdviceStreamRender: this.toggleAdviceStreamRender,
            flushAdviceStreamRender: this.flushAdviceStreamRender,
            pauseStreamForScroll: this.pauseStreamForScroll,
            resumeStreamFromScroll: this.resumeStreamFromScroll,
            _handleAdviceStreamScroll: this._handleAdviceStreamScroll,
            getAdviceVersionGroup: this.getAdviceVersionGroup,
            setActiveAdviceVersion: this.setActiveAdviceVersion,
            cycleAdviceVersion: this.cycleAdviceVersion,
            _isVersionActive: this._isVersionActive,
            pinAdviceVersion: this.pinAdviceVersion,
            deleteAdviceVersion: this.deleteAdviceVersion,
            shareAdviceMessage: this.shareAdviceMessage
        });

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

    getAdviceTemplates() {
        return Array.isArray(this.db.aiTemplates) ? this.db.aiTemplates : [];
    },

    getActiveAdviceTemplate() {
        const templates = this.getAdviceTemplates();
        if (!templates.length) return null;
        const activeId = this.db.aiTemplateActiveId || '';
        return templates.find(t => t.id === activeId) || templates[0] || null;
    },

    selectAdviceTemplate(id) {
        this.db.aiTemplateActiveId = id || '';
        this.saveAdviceSettings();
        this.captureAdviceDraft();
        this.renderAiCoachPage?.() || this.renderRoutines?.();
    },

    toggleTemplateManager() {
        this._templateManagerOpen = !this._templateManagerOpen;
        const sheet = document.getElementById('aiTemplateManagerSheet');
        const content = document.getElementById('aiTemplateManagerContent');
        if (!sheet || !content) return;
        content.innerHTML = this.renderTemplateManagerContent();
        sheet.classList.toggle('hidden', !this._templateManagerOpen);
        sheet.setAttribute('aria-hidden', this._templateManagerOpen ? 'false' : 'true');
    },

    closeTemplateManager() {
        this._templateManagerOpen = false;
        const sheet = document.getElementById('aiTemplateManagerSheet');
        if (!sheet) return;
        sheet.classList.add('hidden');
        sheet.setAttribute('aria-hidden', 'true');
    },

    createTemplateDraft(template = null) {
        return window.dataAiTemplates?.sanitizeTemplate(template || {
            name: '新模板',
            scenario: 'custom',
            system: '',
            user: '{prompt}',
            vars: ['prompt']
        }) || template;
    },

    editTemplateById(id) {
        if (!id) {
            this._templateEditor = this.createTemplateDraft();
            const content = document.getElementById('aiTemplateManagerContent');
            if (content) content.innerHTML = this.renderTemplateManagerContent();
            return;
        }
        const template = this.getAdviceTemplates().find(item => item.id === id);
        this._templateEditor = this.createTemplateDraft(template || null);
        const content = document.getElementById('aiTemplateManagerContent');
        if (content) content.innerHTML = this.renderTemplateManagerContent();
    },

    setTemplateEditorField(field, value) {
        const draft = this._templateEditor || this.createTemplateDraft();
        if (field === 'vars') {
            draft.vars = String(value || '').split(/[,，\s]+/).map(v => v.trim()).filter(Boolean);
        } else {
            draft[field] = value;
        }
        this._templateEditor = draft;
    },

    resetTemplateEditor() {
        this._templateEditor = null;
        const content = document.getElementById('aiTemplateManagerContent');
        if (content) content.innerHTML = this.renderTemplateManagerContent();
    },

    saveTemplateEditor() {
        const form = this._templateEditor || {};
        const template = window.dataAiTemplates?.sanitizeTemplate(form) || form;
        const list = this.getAdviceTemplates();
        const idx = list.findIndex(t => t.id === template.id);
        if (idx >= 0) list[idx] = template;
        else list.push(template);
        this.db.aiTemplates = list;
        if (!this.db.aiTemplateActiveId) this.db.aiTemplateActiveId = template.id;
        this._templateEditor = null;
        this.save();
        const content = document.getElementById('aiTemplateManagerContent');
        if (content) content.innerHTML = this.renderTemplateManagerContent();
    },

    deleteTemplateById(id) {
        if (!id) return;
        const list = this.getAdviceTemplates().filter(t => t.id !== id);
        this.db.aiTemplates = list;
        if (this.db.aiTemplateActiveId === id) {
            this.db.aiTemplateActiveId = list[0]?.id || '';
        }
        this.save();
        const content = document.getElementById('aiTemplateManagerContent');
        if (content) content.innerHTML = this.renderTemplateManagerContent();
    },

    renderTemplateManagerContent() {
        const templates = this.getAdviceTemplates();
        const draft = this._templateEditor;
        const activeId = this.db.aiTemplateActiveId || templates[0]?.id || '';
        const draftVars = Array.isArray(draft?.vars) ? draft.vars.join(', ') : '';
        return `<div class="template-manager-body">
            <div class="template-manager-list">
                ${templates.map(t => `<button class="template-manager-item ${t.id === activeId ? 'active' : ''}" onclick="data.selectAdviceTemplate('${this.escapeHtml(t.id)}')" type="button">
                    <div class="template-manager-item-main">
                        <strong>${this.escapeHtml(t.name)}</strong>
                        <small>${this.escapeHtml(t.scenario)}</small>
                    </div>
                    <span class="template-manager-item-actions">
                        <span class="material-symbols-rounded" onclick="event.stopPropagation();data.editTemplateById('${this.escapeHtml(t.id)}')">edit</span>
                        <span class="material-symbols-rounded" onclick="event.stopPropagation();data.deleteTemplateById('${this.escapeHtml(t.id)}')">delete</span>
                    </span>
                </button>`).join('')}
            </div>
            <div class="template-manager-toolbar">
                <button class="md-btn md-btn-tonal" onclick="data.editTemplateById('')" type="button"><span class="material-symbols-rounded">add</span> 新建</button>
            </div>
            ${draft ? `<div class="template-editor-card">
                <div class="md-grid modal-grid">
                    <div class="md-field span-full"><input type="text" value="${this.escapeHtml(draft.name || '')}" oninput="data.setTemplateEditorField('name', this.value)" placeholder=" "><label>模板名称</label></div>
                    <div class="md-field span-full"><input type="text" value="${this.escapeHtml(draft.scenario || '')}" oninput="data.setTemplateEditorField('scenario', this.value)" placeholder=" "><label>场景</label></div>
                    <div class="md-field span-full"><input type="text" value="${this.escapeHtml(draftVars)}" oninput="data.setTemplateEditorField('vars', this.value)" placeholder=" "><label>变量（逗号分隔）</label></div>
                    <div class="md-field span-full"><textarea rows="3" oninput="data.setTemplateEditorField('system', this.value)" placeholder=" ">${this.escapeHtml(draft.system || '')}</textarea><label>System Prompt</label></div>
                    <div class="md-field span-full"><textarea rows="6" oninput="data.setTemplateEditorField('user', this.value)" placeholder=" ">${this.escapeHtml(draft.user || '')}</textarea><label>User Template</label></div>
                </div>
                <div class="md-row modal-actions">
                    <button class="md-btn md-btn-tonal" onclick="data.resetTemplateEditor()" type="button">取消</button>
                    <button class="md-btn md-btn-filled" onclick="data.saveTemplateEditor()" type="button"><span class="material-symbols-rounded">save</span> 保存</button>
                </div>
            </div>` : ''}
        </div>`;
    },

    exportTemplates() {
        const payload = JSON.stringify({ templates: this.getAdviceTemplates() }, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rehab-ai-templates-${this.logicalDateKey()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    openTemplateImport() {
        document.getElementById('aiTemplateImportInput')?.click();
    },

    async handleTemplateImport(event) {
        const file = event?.target?.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const json = JSON.parse(text);
            const list = Array.isArray(json?.templates) ? json.templates : Array.isArray(json) ? json : [];
            const normalized = window.dataAiTemplates?.normalizeTemplates(list) || list;
            this.db.aiTemplates = normalized;
            this.db.aiTemplateActiveId = normalized[0]?.id || '';
            this.save();
        } catch (e) {
            alert('模板导入失败: ' + (e?.message || e));
        } finally {
            if (event?.target) event.target.value = '';
            this.renderProfilePage?.();
        }
    },

    importTemplates() {
        this.openTemplateImport();
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
    },

    resumeStreamFromScroll() {
        if (!this._adviceSending) return;
        if (!this._adviceUserScrollPaused) return;
        const renderer = this._activeStreamRenderer;
        if (!renderer) return;
        renderer.resume();
        this._adviceUserScrollPaused = false;
        this.setAdviceStreamUiState('streaming');
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
        if (this._adviceScrollEl && this._adviceOnUserIntent) {
            this._adviceScrollEl.removeEventListener('wheel', this._adviceOnUserIntent);
            this._adviceScrollEl.removeEventListener('touchstart', this._adviceOnUserIntent);
            this._adviceScrollEl.removeEventListener('keydown', this._adviceOnUserIntent);
        }
        this._adviceOnScroll = () => {
            this.captureAdviceScroll();
            this._handleAdviceStreamScroll(list);
        };
        this._adviceOnUserIntent = () => {
            this._adviceUserScrollIntent = true;
            clearTimeout(this._adviceUserScrollIntentTimer);
            this._adviceUserScrollIntentTimer = setTimeout(() => {
                this._adviceUserScrollIntent = false;
            }, 600);
        };
        list.addEventListener('scroll', this._adviceOnScroll, { passive: true });
        list.addEventListener('wheel', this._adviceOnUserIntent, { passive: true });
        list.addEventListener('touchstart', this._adviceOnUserIntent, { passive: true });
        list.addEventListener('keydown', this._adviceOnUserIntent, { passive: true });
        this._adviceScrollEl = list;
    },

    _handleAdviceStreamScroll(list) {
        if (!this._adviceSending) return;
        const distance = list.scrollHeight - list.clientHeight - list.scrollTop;
        const atBottom = distance < 24;
        if (atBottom) {
            if (this._adviceUserScrollPaused) this.resumeStreamFromScroll();
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

    toggleAdviceContextPanel() {
        this.adviceContextOpen = !this.adviceContextOpen;
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

    async sendAiAdvice(promptOverride = '', options = {}) {
        if (!ai.cfg.enabled) return alert('请先在设置中配置 AI');
        if (this._adviceSending) return;
        const input = document.getElementById('advicePrompt');
        const prompt = (promptOverride || input?.value || '').trim();
        if (!prompt) return;
        const list = document.querySelector('.advice-chat-list');
        this._adviceFollowStream = !list || (list.scrollHeight - list.clientHeight - list.scrollTop) < 180;
        this._adviceUserScrollPaused = false;
        const selected = document.getElementById('adviceModel')?.value || this.adviceModel || '__current__';
        const model = selected === '__current__' ? ai.cfg.model : selected;
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
        requestAnimationFrame(() => this.scrollAdviceToLatest(true));
        this._activeStreamRenderer = null;
        this._streamRenderers = this._streamRenderers || {};
        this.setAdviceStreamUiState('streaming');
        try {
            const messages = this.buildAdviceMessages(prompt, model);
            const oldModel = ai.cfg.model;
            ai.cfg.model = model;
            let full = '';
            let _lastRender = 0;
            let _pendingFrame = 0;
            try {
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
                        const provider = ai.cfg.provider || 'openai';
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
                        if (contentEl._renderer.getState?.().shown === accumulated) {
                            contentEl._renderer.enqueue(delta);
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
            } finally {
                ai.cfg.model = oldModel;
            }
            const idx = this.db.health.aiAdviceChat.findIndex(msg => msg.id === pendingId);
            if (idx >= 0) this.db.health.aiAdviceChat[idx] = {
                ...this.db.health.aiAdviceChat[idx],
                role: 'assistant',
                content: full,
                at: new Date().toISOString(),
                model,
                pending: false,
                deleted: false,
                updatedAt: Date.now()
            };
            this.save();
            requestAnimationFrame(() => {
                const bubble = document.querySelector(`[data-advice-id="${pendingId}"]`);
                if (bubble) {
                    const contentEl = bubble.querySelector('.advice-bubble-content');
                    if (contentEl) {
                        if (contentEl._renderer) {
                            try { contentEl._renderer.destroy(); } catch {}
                            contentEl._renderer = null;
                            delete this._streamRenderers[pendingId];
                        }
                        contentEl.innerHTML = this.renderAdviceMarkdown(full);
                        contentEl.querySelectorAll('p, li, h1, h2, h3').forEach(el => {
                            el.classList.add('m3e-token-in');
                        });
                    }
                }
                this.scrollAdviceToLatest(true);
            });
        } catch (e) {
            const idx = this.db.health.aiAdviceChat.findIndex(msg => msg.id === pendingId);
            const failed = { id: pendingId, role: 'assistant', content: `分析失败：${window.toast ? toast.sanitize(e) : e.message}`, at: new Date().toISOString(), model, error: true, retryPrompt: prompt, deleted: false, updatedAt: Date.now() };
            if (idx >= 0) this.db.health.aiAdviceChat[idx] = failed;
            else this.db.health.aiAdviceChat.push(failed);
            this.save();
            requestAnimationFrame(() => this.scrollAdviceToLatest(true));
        } finally {
            this._adviceSending = false;
            this._adviceFollowStream = false;
            this._activeStreamRenderer = null;
            this._adviceUserScrollPaused = false;
            this.setAdviceStreamUiState('idle');
            const send = document.getElementById('adviceSendBtn');
            if (send) send.disabled = true;
        }
    },

    deleteAiAdviceMessage(idx) {
        const messages = this.activeRecords(this.db.health.aiAdviceChat || []);
        if (idx < 0 || idx >= messages.length) return;
        const targetId = messages[idx].id;
        this.preserveAdviceScroll(() => {
            this.softDeleteById(this.db.health.aiAdviceChat, targetId);
            this.saveAndBackup();
        });
    },

    copyAdviceMessage(idx) {
        const msg = (this.activeRecords(this.db.health.aiAdviceChat || []))[idx];
        if (!msg?.content) return;
        navigator.clipboard?.writeText(msg.content).catch(() => {});
        workout?.showToast?.('已复制 AI 回答');
    },

    async shareAdviceMessage(idx) {
        const msg = (this.activeRecords(this.db.health.aiAdviceChat || []))[idx];
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

    retryAdviceFrom(idx) {
        const messages = this.activeRecords(this.db.health.aiAdviceChat || []);
        const msg = messages[idx];
        if (!msg) return;
        const prompt = msg?.retryPrompt || messages.slice(0, idx).reverse().find(m => m.role === 'user')?.content;
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
        this.save();
    },

    renderAdvicePanel() {
        const messages = this.activeRecords(this.db.health.aiAdviceChat || []);
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
        const ctxOpen = !!this.adviceContextOpen;
        const enabledCount = ['diet','training','weight','goal'].filter(k => contexts[k]).length;
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
                    ${(() => {
                        const templates = Array.isArray(this.db.aiTemplates) ? this.db.aiTemplates : [];
                        if (!templates.length) return '';
                        const activeId = this.db.aiTemplateActiveId || templates[0]?.id || '';
                        return `<div class="advice-template-row">${templates.map(t => `<button class="advice-pill ${t.id === activeId ? 'active' : ''}" onclick="data.selectAdviceTemplate('${this.escapeHtml(t.id)}')" type="button">${this.escapeHtml(t.name)}</button>`).join('')}</div>`;
                    })()}
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
                        ${searchQuery ? '<button onclick="data.clearAdviceSearch()" type="button" aria-label="清空搜索"><span class="material-symbols-rounded">close</span></button>' : ''}
                    </div>` : ''}
                    ${ctxOpen ? `<div class="advice-context-popover">
                        <div class="advice-context-popover-head">
                            <span>选择给 AI 的数据维度</span>
                            <button onclick="data.toggleAdviceContextPanel()" type="button" aria-label="关闭"><span class="material-symbols-rounded">close</span></button>
                        </div>
                        <div class="advice-context-toggles">${[['diet','饮食','restaurant'],['training','训练','fitness_center'],['weight','体重','monitor_weight'],['goal','目标','flag']].map(([key, label, icon]) => `<button class="advice-pill ${contexts[key] ? 'active' : ''}" onclick="data.toggleAdviceContext('${key}')" type="button"><span class="material-symbols-rounded">${icon}</span>${label}</button>`).join('')}</div>
                        <small class="advice-context-hint">关闭后该维度的记录不会发给 AI，回答会更聚焦</small>
                    </div>` : ''}
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
                    <div id="adviceStatus" class="food-ai-status advice-status-line">
                        <span class="advice-status-text">${sendHint}</span>
                    </div>
                </div>
            </div>
        </div>`;
    }
};

if (typeof window !== 'undefined') window.advicePanel = advicePanel;
