// @ts-nocheck
(function () {
    function refreshContent(ctx) {
        const content = document.getElementById('aiTemplateManagerContent');
        if (content) {
            content.innerHTML = ctx.renderTemplateManagerContent();
            ctx.bindTemplateManagerActions?.(content);
        }
    }

    function renderChipGroup(ctx, taskId, field, currentValue) {
        const isMulti = field.type === 'multi-chips';
        const selected = isMulti ? (Array.isArray(currentValue) ? new Set(currentValue) : new Set()) : null;
        return field.options.map(opt => {
            const active = isMulti ? selected.has(opt.value) : currentValue === opt.value;
            const valStr = typeof opt.value === 'number' ? String(opt.value) : opt.value;
            return `<button class="md-chip pref-chip ${active ? 'active' : ''}" type="button"
                onclick="data.handlePrefChipClick('${taskId}','${field.key}',${isMulti ? 'true' : 'false'},'${ctx.escapeHtml(valStr)}')"
                aria-pressed="${active}">${ctx.escapeHtml(opt.label)}</button>`;
        }).join('');
    }

    function renderPrefCard(ctx, taskId, meta) {
        const tpl = window.dataAiTemplates;
        const customized = tpl.isTaskCustomized(taskId, ctx.db);
        const prefs = tpl.getPromptPrefs(taskId, ctx.db);
        const defaults = tpl.DEFAULT_PROMPT_PREFS[taskId] || {};
        const fieldsHtml = meta.fields.map(field => {
            const value = prefs[field.key];
            let control = '';
            if (field.type === 'chips' || field.type === 'multi-chips') {
                control = renderChipGroup(ctx, taskId, field, value);
            } else if (field.type === 'number') {
                control = `<div class="pref-number-row">${Array.from({ length: (field.max || 5) - (field.min || 1) + 1 }, (_, i) => {
                    const v = (field.min || 1) + i;
                    return `<button class="md-chip pref-chip ${value === v ? 'active' : ''}" type="button"
                        onclick="data.handlePrefNumberClick('${taskId}','${field.key}',${v})">${v}</button>`;
                }).join('')}</div>`;
            } else if (field.type === 'toggle') {
                control = `<label class="pref-toggle"><input type="checkbox" ${value ? 'checked' : ''}
                    onchange="data.handlePrefToggle('${taskId}','${field.key}',this.checked)"><span>${field.label}</span></label>`;
            } else if (field.type === 'textarea') {
                control = `<div class="md-field pref-textarea-field"><textarea rows="2" placeholder=" "
                    oninput="data.handlePrefTextarea('${taskId}','${field.key}',this.value)">${ctx.escapeHtml(String(value || ''))}</textarea><label>${ctx.escapeHtml(field.label)}</label></div>`;
            } else if (field.type === 'tags') {
                const tagStr = Array.isArray(value) ? value.join('、') : '';
                control = `<div class="md-field pref-textarea-field"><textarea rows="1" placeholder=" "
                    oninput="data.handlePrefTags('${taskId}','${field.key}',this.value)">${ctx.escapeHtml(tagStr)}</textarea><label>${ctx.escapeHtml(field.label)}（用「、」分隔）</label></div>`;
            }
            if (field.type === 'textarea' || field.type === 'tags') return control;
            return `<div class="pref-field"><label class="pref-field-label">${ctx.escapeHtml(field.label)}</label><div class="pref-field-control">${control}</div></div>`;
        }).join('');

        const previewCollapsed = !ctx._prefPreviewOpen?.[taskId];
        const previewHtml = `<details class="pref-preview" ${previewCollapsed ? '' : 'open'}>
            <summary onclick="data.togglePrefPreview('${taskId}')">查看最终提示词预览</summary>
            <pre class="pref-preview-content" id="prefPreview_${taskId}">${ctx.escapeHtml(ctx.buildPrefPreviewText(taskId))}</pre>
        </details>`;

        return `<details class="pref-card" data-task-id="${taskId}">
            <summary class="pref-card-summary">
                <div class="pref-card-head">
                    <strong>${ctx.escapeHtml(meta.label)}</strong>
                    <span class="pref-badge ${customized ? 'pref-badge-custom' : 'pref-badge-default'}">${customized ? '已自定义' : '默认'}</span>
                    <span class="material-symbols-rounded pref-card-chevron">expand_more</span>
                </div>
                <small class="pref-card-desc">${ctx.escapeHtml(meta.desc)}</small>
            </summary>
            <div class="pref-card-body">
                <div class="pref-card-fields">${fieldsHtml}</div>
                ${previewHtml}
                <div class="pref-card-actions">
                    <button class="md-btn md-btn-tonal pref-reset-btn" type="button" onclick="data.resetSinglePref('${taskId}')">
                        <span class="material-symbols-rounded">restart_alt</span> 恢复此用途默认
                    </button>
                </div>
            </div>
        </details>`;
    }

    window.adviceTemplateManager = {
        _prefPreviewOpen: {},
        _prefAdvancedOpen: false,

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
            this.rerenderAdvicePanel({ refreshMessages: false });
        },

        toggleTemplateManager() {
            this._templateManagerOpen = !this._templateManagerOpen;
            if (!this._templateManagerOpen) return this.closeTemplateManager();
            const sheet = document.getElementById('aiTemplateManagerSheet');
            const content = document.getElementById('aiTemplateManagerContent');
            if (!sheet || !content) return;
            content.innerHTML = this.renderTemplateManagerContent();
            this.bindTemplateManagerActions(content);
            sheet.classList.remove('hidden');
            sheet.setAttribute('aria-hidden', 'false');
            window.navStack?.open?.('modal', 'aiTemplateManagerSheet', () => this.closeTemplateManager(true));
        },

        bindTemplateManagerActions(root) {
            if (!root || root.dataset.templateManagerActionsBound === '1') return;
            root.dataset.templateManagerActionsBound = '1';
            root.addEventListener('click', (event) => {
                const btn = event.target?.closest?.('[data-template-action]');
                if (!btn || !root.contains(btn)) return;
                const action = btn.getAttribute('data-template-action') || '';
                const id = btn.getAttribute('data-template-id') || '';

                event.preventDefault();
                if (action === 'select') this.selectAdviceTemplate(id);
                else if (action === 'edit') {
                    event.stopPropagation();
                    this.editTemplateById(id);
                } else if (action === 'delete') {
                    event.stopPropagation();
                    this.deleteTemplateById(id);
                }
            });
        },

        closeTemplateManager(direct) {
            if (!direct && window.navStack?.requestClose?.('modal', 'aiTemplateManagerSheet')) return;
            this._templateManagerOpen = false;
            const sheet = document.getElementById('aiTemplateManagerSheet');
            if (!sheet) return true;
            sheet.classList.add('hidden');
            sheet.setAttribute('aria-hidden', 'true');
        },

        handlePrefChipClick(taskId, fieldKey, isMulti, value) {
            const tpl = window.dataAiTemplates;
            const defaults = tpl.DEFAULT_PROMPT_PREFS[taskId] || {};
            if (!this.db.aiPromptPrefs) this.db.aiPromptPrefs = {};
            if (!this.db.aiPromptPrefs[taskId]) this.db.aiPromptPrefs[taskId] = {};
            const current = this.db.aiPromptPrefs[taskId];
            if (isMulti) {
                const arr = Array.isArray(current[fieldKey]) ? [...current[fieldKey]] : [...(defaults[fieldKey] || [])];
                const idx = arr.indexOf(value);
                if (idx >= 0) arr.splice(idx, 1);
                else arr.push(value);
                current[fieldKey] = arr;
            } else {
                current[fieldKey] = value;
            }
            this._cleanupPref(taskId, fieldKey, defaults);
            this.save();
            refreshContent(this);
        },

        handlePrefNumberClick(taskId, fieldKey, value) {
            const tpl = window.dataAiTemplates;
            const defaults = tpl.DEFAULT_PROMPT_PREFS[taskId] || {};
            if (!this.db.aiPromptPrefs) this.db.aiPromptPrefs = {};
            if (!this.db.aiPromptPrefs[taskId]) this.db.aiPromptPrefs[taskId] = {};
            this.db.aiPromptPrefs[taskId][fieldKey] = value;
            this._cleanupPref(taskId, fieldKey, defaults);
            this.save();
            refreshContent(this);
        },

        handlePrefToggle(taskId, fieldKey, checked) {
            const tpl = window.dataAiTemplates;
            const defaults = tpl.DEFAULT_PROMPT_PREFS[taskId] || {};
            if (!this.db.aiPromptPrefs) this.db.aiPromptPrefs = {};
            if (!this.db.aiPromptPrefs[taskId]) this.db.aiPromptPrefs[taskId] = {};
            this.db.aiPromptPrefs[taskId][fieldKey] = checked;
            this._cleanupPref(taskId, fieldKey, defaults);
            this.save();
        },

        handlePrefTextarea(taskId, fieldKey, value) {
            if (!this.db.aiPromptPrefs) this.db.aiPromptPrefs = {};
            if (!this.db.aiPromptPrefs[taskId]) this.db.aiPromptPrefs[taskId] = {};
            this.db.aiPromptPrefs[taskId][fieldKey] = value;
            this._cleanupPref(taskId, fieldKey, {});
            this.save();
        },

        handlePrefTags(taskId, fieldKey, value) {
            if (!this.db.aiPromptPrefs) this.db.aiPromptPrefs = {};
            if (!this.db.aiPromptPrefs[taskId]) this.db.aiPromptPrefs[taskId] = {};
            const tags = String(value || '').split(/[、,，]/).map(s => s.trim()).filter(Boolean);
            this.db.aiPromptPrefs[taskId][fieldKey] = tags;
            this._cleanupPref(taskId, fieldKey, {});
            this.save();
        },

        _cleanupPref(taskId, fieldKey, defaults) {
            const current = this.db.aiPromptPrefs?.[taskId]?.[fieldKey];
            const def = defaults[fieldKey];
            if (current === def || (Array.isArray(current) && Array.isArray(def) && JSON.stringify(current) === JSON.stringify(def))) {
                delete this.db.aiPromptPrefs[taskId][fieldKey];
            }
            if (this.db.aiPromptPrefs?.[taskId] && Object.keys(this.db.aiPromptPrefs[taskId]).length === 0) {
                delete this.db.aiPromptPrefs[taskId];
            }
        },

        resetSinglePref(taskId) {
            window.dataAiTemplates.resetPromptPrefs(taskId, this.db, () => this.save());
            refreshContent(this);
            window.toast?.show?.(`已恢复「${window.dataAiTemplates.TASK_PREF_META[taskId]?.label || taskId}」默认设置`, 'success');
        },

        resetAllPrefs() {
            window.dataAiTemplates.resetAllPromptPrefs(this.db, () => this.save());
            refreshContent(this);
            window.toast?.show?.('已恢复全部默认设置', 'success');
        },

        exportPrefs() {
            const payload = JSON.stringify({ aiPromptPrefs: this.db.aiPromptPrefs || {} }, null, 2);
            const blob = new Blob([payload], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `rehab-ai-prefs-${this.logicalDateKey()}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        },

        openPrefsImport() {
            document.getElementById('aiPrefsImportInput')?.click();
        },

        async handlePrefsImport(event) {
            const file = event?.target?.files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                const json = JSON.parse(text);
                const imported = json?.aiPromptPrefs || json?.prefs || json;
                if (!imported || typeof imported !== 'object') throw new Error('格式无效');
                if (!this.db.aiPromptPrefs) this.db.aiPromptPrefs = {};
                const validKeys = new Set(Object.keys(window.dataAiTemplates.DEFAULT_PROMPT_PREFS));
                let count = 0;
                Object.entries(imported).forEach(([key, val]) => {
                    if (validKeys.has(key) && val && typeof val === 'object') {
                        this.db.aiPromptPrefs[key] = { ...(this.db.aiPromptPrefs[key] || {}), ...val };
                        count++;
                    }
                });
                this.save();
                refreshContent(this);
                window.toast?.show?.(`已导入 ${count} 个用途的偏好设置`, 'success');
            } catch (e) {
                window.toast?.show?.('偏好导入失败: ' + (e?.message || e), 'error');
            } finally {
                if (event?.target) event.target.value = '';
            }
        },

        togglePrefPreview(taskId) {
            if (!this._prefPreviewOpen) this._prefPreviewOpen = {};
            this._prefPreviewOpen[taskId] = !this._prefPreviewOpen[taskId];
        },

        buildPrefPreviewText(taskId) {
            const tpl = window.dataAiTemplates;
            const result = tpl.buildPromptMessages(taskId, {}, this.db);
            if (!result || !result.messages) return '此用途暂无预览';
            return result.messages.map(m => `[${m.role}]\n${m.content}`).join('\n\n');
        },

        togglePrefAdvanced() {
            this._prefAdvancedOpen = !this._prefAdvancedOpen;
            const el = document.getElementById('prefAdvancedSection');
            if (el) el.classList.toggle('hidden', !this._prefAdvancedOpen);
        },

        renderTemplateManagerContent() {
            const tpl = window.dataAiTemplates;
            const meta = tpl.TASK_PREF_META;
            const categories = { conversation: [], structured: [] };
            Object.entries(meta).forEach(([taskId, m]) => {
                const cat = m.category || 'structured';
                if (categories[cat]) categories[cat].push({ taskId, meta: m });
            });

            const conversationCards = categories.conversation.map(({ taskId, meta: m }) => renderPrefCard(this, taskId, m)).join('');
            const structuredCards = categories.structured.map(({ taskId, meta: m }) => renderPrefCard(this, taskId, m)).join('');

            const advancedHtml = this._prefAdvancedOpen ? this.renderTemplateManagerAdvanced() : '';

            return `<div class="pref-panel-body">
                <div class="pref-panel-header">
                    <h3>AI 提示词偏好</h3>
                    <div class="pref-panel-actions">
                        <button class="md-btn md-btn-tonal" type="button" onclick="data.resetAllPrefs()"><span class="material-symbols-rounded">restart_alt</span> 全部恢复默认</button>
                        <button class="md-btn md-btn-tonal" type="button" onclick="data.exportPrefs()"><span class="material-symbols-rounded">download</span> 导出</button>
                        <button class="md-btn md-btn-tonal" type="button" onclick="data.openPrefsImport()"><span class="material-symbols-rounded">upload</span> 导入</button>
                    </div>
                </div>
                <input type="file" id="aiPrefsImportInput" accept=".json" style="display:none" onchange="data.handlePrefsImport(event)">

                ${conversationCards ? `<div class="pref-section"><div class="pref-section-title"><span class="material-symbols-rounded">forum</span> 用户对话型 AI</div>${conversationCards}</div>` : ''}
                ${structuredCards ? `<div class="pref-section"><div class="pref-section-title"><span class="material-symbols-rounded">rule</span> 结构化后台任务</div>${structuredCards}</div>` : ''}

                <div class="pref-section pref-advanced-toggle">
                    <label class="pref-toggle">
                        <input type="checkbox" ${this._prefAdvancedOpen ? 'checked' : ''} onchange="data.togglePrefAdvanced()">
                        <span>启用高级提示词编辑</span>
                    </label>
                </div>
                <div id="prefAdvancedSection" class="${this._prefAdvancedOpen ? '' : 'hidden'}">
                    ${advancedHtml}
                </div>
            </div>`;
        },

        renderTemplateManagerAdvanced() {
            const templates = this.getAdviceTemplates();
            const draft = this._templateEditor;
            const activeId = this.db.aiTemplateActiveId || templates[0]?.id || '';
            const draftVars = Array.isArray(draft?.vars) ? draft.vars.join(', ') : '';
            return `<div class="pref-advanced-section">
                <div class="pref-advanced-warning"><span class="material-symbols-rounded">warning</span> 实验性：修改可能导致功能异常</div>
                <div class="template-manager-body">
                    <div class="template-manager-list">
                        ${templates.map(t => `<button class="template-manager-item ${t.id === activeId ? 'active' : ''}" data-template-action="select" data-template-id="${this.escapeHtml(t.id)}" type="button">
                            <div class="template-manager-item-main">
                                <strong>${this.escapeHtml(t.name)}</strong>
                                <small>${this.escapeHtml(t.scenario)}</small>
                            </div>
                            <span class="template-manager-item-actions">
                                <span class="material-symbols-rounded" data-template-action="edit" data-template-id="${this.escapeHtml(t.id)}">edit</span>
                                <span class="material-symbols-rounded" data-template-action="delete" data-template-id="${this.escapeHtml(t.id)}">delete</span>
                            </span>
                        </button>`).join('')}
                    </div>
                    <div class="template-manager-toolbar">
                        <button class="md-btn md-btn-tonal" onclick="data.editTemplateById('')" type="button"><span class="material-symbols-rounded">add</span> 新建</button>
                        <button class="md-btn md-btn-tonal" onclick="data.exportTemplates()" type="button"><span class="material-symbols-rounded">download</span> 导出模板</button>
                        <button class="md-btn md-btn-tonal" onclick="data.importTemplates()" type="button"><span class="material-symbols-rounded">upload</span> 导入模板</button>
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
                </div>
            </div>`;
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
                refreshContent(this);
                return;
            }
            const template = this.getAdviceTemplates().find(item => item.id === id);
            this._templateEditor = this.createTemplateDraft(template || null);
            refreshContent(this);
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
            refreshContent(this);
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
            refreshContent(this);
        },

        deleteTemplateById(id) {
            if (!id) return;
            const list = this.getAdviceTemplates().filter(t => t.id !== id);
            this.db.aiTemplates = list;
            if (this.db.aiTemplateActiveId === id) this.db.aiTemplateActiveId = list[0]?.id || '';
            this.save();
            refreshContent(this);
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
        }
    };
})();
