// @ts-nocheck
(function () {
    function refreshContent(ctx) {
        const content = document.getElementById('aiTemplateManagerContent');
        if (content) content.innerHTML = ctx.renderTemplateManagerContent();
    }

    window.adviceTemplateManager = {
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
        }
    };
})();
