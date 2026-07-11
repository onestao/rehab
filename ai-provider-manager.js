// @ts-nocheck
(function attachAiProviderManager(root) {
    'use strict';

    const text = value => String(value == null ? '' : value);
    const byId = id => document.getElementById(id);
    const icon = name => {
        const node = document.createElement('span');
        node.className = 'material-symbols-rounded';
        node.textContent = name;
        node.setAttribute('aria-hidden', 'true');
        return node;
    };
    const button = (label, iconName, className = '') => {
        const node = document.createElement('button');
        node.type = 'button';
        node.className = className;
        if (iconName) node.append(icon(iconName));
        if (label) node.append(document.createTextNode(label));
        return node;
    };
    const familyFor = model => {
        const owner = text(model?.owned_by || model?.vendor || model?.publisher).trim();
        if (owner) return owner;
        const id = text(model?.id).toLowerCase();
        const rules = [
            [/^(gpt-|chatgpt-)/, 'GPT'], [/^o[134](?:-|$)/, 'OpenAI o-series'],
            [/claude/, 'Claude'], [/gemini/, 'Gemini'], [/deepseek/, 'DeepSeek'],
            [/qwen|qwq/, 'Qwen'], [/llama/, 'Llama'], [/mistral|mixtral/, 'Mistral'],
            [/embedding|embed/, 'Embedding']
        ];
        return rules.find(([pattern]) => pattern.test(id))?.[1] || '其他';
    };
    const profileList = () => [...(root.ai?.cfg?.profiles || [])]
        .filter(profile => profile.archived !== true)
        .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || text(a.name).localeCompare(text(b.name)));

    const manager = {
        profileId: '',
        panel: 'list',
        detailTab: 'config',
        dragId: '',

        open(profileId = '') {
            this.profileId = text(profileId);
            this.panel = this.profileId ? 'detail' : 'list';
            this.detailTab = 'config';
            byId('aiProviderManager')?.classList.remove('hidden');
            byId('aiProviderManager')?.setAttribute('aria-hidden', 'false');
            this.render();
        },

        close() {
            byId('aiProviderManager')?.classList.add('hidden');
            byId('aiProviderManager')?.setAttribute('aria-hidden', 'true');
        },

        async persist() {
            await root.ai.persist();
            root.ai.persistDataDb(false);
            root.ai.syncUI();
            this.render();
            root.aiTaskSettings?.render?.();
        },

        renderSummary() {
            const profiles = root.ai?.cfg?.profiles || [];
            const active = profiles.filter(profile => profile.enabled !== false && profile.archived !== true).length;
            const total = profiles.filter(profile => profile.archived !== true).length;
            const summary = byId('aiProviderSummary');
            if (summary) summary.textContent = `${active} 已启用 / ${total} 个供应商`;
        },

        render() {
            this.renderSummary();
            const title = byId('aiProviderManagerTitle');
            const body = byId('aiProviderManagerBody');
            if (!body) return;
            body.replaceChildren();
            if (this.panel === 'detail') this.renderDetail(body, title);
            else this.renderList(body, title);
        },

        renderList(body, title) {
            if (title) title.textContent = '供应商';
            const toolbar = document.createElement('div');
            toolbar.className = 'ai-provider-toolbar';
            const search = document.createElement('input');
            search.type = 'search';
            search.placeholder = '搜索供应商';
            search.setAttribute('aria-label', '搜索供应商');
            const refresh = button('', 'cloud_sync', 'ai-icon-btn');
            refresh.title = '刷新全部已启用供应商';
            refresh.addEventListener('click', () => this.refreshAll(refresh));
            const add = button('', 'add', 'ai-icon-btn');
            add.title = '添加供应商';
            add.addEventListener('click', () => this.startNew());
            toolbar.append(search, refresh, add);
            const status = document.createElement('div');
            status.id = 'aiProviderBulkStatus';
            status.className = 'ai-provider-bulk-status';
            const list = document.createElement('div');
            list.className = 'ai-provider-list';
            const renderRows = () => {
                const query = search.value.trim().toLowerCase();
                list.replaceChildren();
                profileList().filter(profile => `${profile.name} ${profile.provider}`.toLowerCase().includes(query)).forEach(profile => {
                    const row = document.createElement('div');
                    row.className = 'ai-provider-row';
                    row.draggable = true;
                    row.dataset.profileId = profile.id;
                    row.addEventListener('dragstart', () => { this.dragId = profile.id; });
                    row.addEventListener('dragover', event => event.preventDefault());
                    row.addEventListener('drop', event => { event.preventDefault(); this.reorder(this.dragId, profile.id); });
                    const open = button('', '', 'ai-provider-main');
                    const mark = document.createElement('span');
                    mark.className = 'ai-provider-mark';
                    mark.textContent = text(profile.name || profile.provider || 'AI').slice(0, 1).toUpperCase();
                    const labels = document.createElement('span');
                    const strong = document.createElement('strong');
                    strong.textContent = profile.name || '未命名供应商';
                    const small = document.createElement('small');
                    small.textContent = root.ai.providerLabel?.(profile.provider) || profile.provider;
                    labels.append(strong, small);
                    open.append(mark, labels);
                    open.addEventListener('click', () => { this.profileId = profile.id; this.panel = 'detail'; this.detailTab = 'config'; this.render(); });
                    const state = button(profile.enabled === false ? '已禁用' : '已启用', '', `ai-provider-state ${profile.enabled === false ? 'is-off' : 'is-on'}`);
                    state.addEventListener('click', () => this.toggle(profile.id));
                    row.append(open, state, icon('chevron_right'));
                    list.append(row);
                });
                if (!list.childElementCount) {
                    const empty = document.createElement('div');
                    empty.className = 'ai-provider-empty';
                    empty.textContent = query ? '未找到供应商' : '尚未添加供应商';
                    list.append(empty);
                }
            };
            search.addEventListener('input', renderRows);
            renderRows();
            body.append(toolbar, status, list);
        },

        startNew() {
            this.profileId = '';
            this.panel = 'detail';
            this.detailTab = 'config';
            this.render();
        },

        field(labelText, value = '', type = 'text') {
            const label = document.createElement('label');
            label.className = 'ai-provider-field';
            const caption = document.createElement('span');
            caption.textContent = labelText;
            const input = document.createElement('input');
            input.type = type;
            input.value = value;
            label.append(caption, input);
            return { label, input };
        },

        renderDetail(body, title) {
            const profile = (root.ai.cfg.profiles || []).find(item => item.id === this.profileId) || null;
            if (title) title.textContent = profile?.name || '添加供应商';
            const tabs = document.createElement('div');
            tabs.className = 'ai-provider-tabs';
            const configTab = button('配置', 'tune', 'is-active');
            const modelsTab = button('模型', 'inventory_2');
            const content = document.createElement('div');
            const showConfig = () => { this.detailTab = 'config'; configTab.classList.add('is-active'); modelsTab.classList.remove('is-active'); this.renderConfig(content, profile); };
            const showModels = () => { this.detailTab = 'models'; modelsTab.classList.add('is-active'); configTab.classList.remove('is-active'); this.renderModelsPanel(content, profile); };
            configTab.addEventListener('click', showConfig);
            modelsTab.addEventListener('click', showModels);
            tabs.append(configTab, modelsTab);
            body.append(tabs, content);
            if (this.detailTab === 'models') showModels(); else showConfig();
        },

        renderConfig(content, profile) {
            content.replaceChildren();
            content.className = 'ai-provider-config';
            const name = this.field('供应商名称', profile?.name || '');
            const typeWrap = document.createElement('label');
            typeWrap.className = 'ai-provider-field';
            const typeCaption = document.createElement('span');
            typeCaption.textContent = '接口类型';
            const provider = document.createElement('select');
            [['openai', 'OpenAI 兼容'], ['openai-responses', 'OpenAI Responses'], ['claude', 'Claude'], ['gemini', 'Gemini']].forEach(([value, label]) => {
                const option = document.createElement('option'); option.value = value; option.textContent = label; provider.append(option);
            });
            provider.value = profile?.provider || 'openai';
            typeWrap.append(typeCaption, provider);
            const baseUrl = this.field('Base URL', profile?.baseUrl || '', 'url');
            const apiKey = this.field('API Key', profile ? root.ai.apiKeyFor(profile.id) : '', 'password');
            apiKey.input.autocomplete = 'off';
            const actions = document.createElement('div');
            actions.className = 'ai-provider-detail-actions';
            const save = button('保存并验证', 'save', 'md-btn md-btn-filled');
            save.addEventListener('click', () => this.saveDetails({ profile, name: name.input.value, provider: provider.value, baseUrl: baseUrl.input.value, apiKey: apiKey.input.value }, save));
            actions.append(save);
            if (profile) {
                const archive = button('归档', 'inventory_2', 'md-btn md-btn-tonal');
                archive.addEventListener('click', () => this.archive(profile.id));
                const remove = button('永久删除', 'delete_forever', 'md-btn md-btn-text ai-cache-danger');
                remove.addEventListener('click', () => this.removeProvider(profile.id));
                actions.append(archive, remove);
            }
            const status = document.createElement('div');
            status.id = 'aiProviderDetailStatus';
            status.className = 'ai-provider-bulk-status';
            content.append(name.label, typeWrap, baseUrl.label, apiKey.label, actions, status);
        },

        async saveDetails(values, trigger) {
            const name = text(values.name).trim() || '未命名供应商';
            const baseUrl = text(values.baseUrl).trim().replace(/\/+$/, '');
            const apiKey = text(values.apiKey).trim();
            if (!baseUrl || !apiKey) return alert('请填写 Base URL 和 API Key');
            trigger.disabled = true;
            const id = values.profile?.id || `provider_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const meta = {
                ...(values.profile || {}), id, name, provider: values.provider, baseUrl,
                model: values.profile?.model || '', enabled: values.profile?.enabled !== false,
                archived: false, sortOrder: values.profile?.sortOrder ?? profileList().length
            };
            const index = root.ai.cfg.profiles.findIndex(item => item.id === id);
            if (index >= 0) root.ai.cfg.profiles[index] = meta; else root.ai.cfg.profiles.push(meta);
            root.ai.keyMap[id] = apiKey;
            root.ai.cfg.activeProfileId = id;
            await root.ai.persistKeyMap();
            await root.ai.persist();
            root.ai.persistDataDb(false);
            this.profileId = id;
            try {
                await this.discover(id);
                alert('供应商已保存，已获取候选模型');
                this.detailTab = 'models';
                this.render();
            } catch (error) {
                const status = byId('aiProviderDetailStatus');
                if (status) status.textContent = `供应商已保存，验证失败：${text(error?.message || error)}`;
            } finally { trigger.disabled = false; this.renderSummary(); }
        },

        async discover(profileId) {
            const profile = root.ai.findProfile(profileId);
            if (!profile) throw new Error('供应商不存在');
            const key = root.ai.apiKeyFor(profileId);
            let models;
            if (profile.provider === 'gemini') models = await root.ai.fetchGeminiModels(profile.baseUrl, key);
            else if (profile.provider === 'claude') models = await root.ai.fetchClaudeModels(profile.baseUrl, key);
            else models = await root.ai.fetchOpenAIModels(profile.baseUrl, key);
            if (!Array.isArray(models) || !models.length) throw new Error('接口返回空模型列表，已保留上次结果');
            const fetchedAt = new Date().toISOString();
            const helper = await root.ai.loadModelCatalogPure();
            const normalized = models.map(model => helper.normalizeCatalogModel(model, {
                profileId, provider: profile.provider, baseUrl: profile.baseUrl, fetchedAt, source: 'discovered'
            }));
            root.ai.modelCandidates = { ...(root.ai.modelCandidates || {}), [profileId]: { fetchedAt, models: normalized } };
            await root.ai.persistModelCandidates();
            return normalized;
        },

        renderModelsDirect() {
            const body = byId('aiProviderManagerBody');
            const profile = root.ai.findProfile(this.profileId);
            if (!body || !profile) return;
            const content = body.querySelector('.ai-provider-config');
            if (content) this.renderModelsPanel(content, profile);
        },

        renderModelsPanel(content, profile) {
            content.replaceChildren();
            content.className = 'ai-provider-models';
            if (!profile) {
                const empty = document.createElement('div'); empty.className = 'ai-provider-empty'; empty.textContent = '请先保存供应商'; content.append(empty); return;
            }
            const toolbar = document.createElement('div'); toolbar.className = 'ai-provider-toolbar';
            const refresh = button('刷新候选', 'refresh', 'md-btn md-btn-tonal');
            refresh.addEventListener('click', async () => {
                refresh.disabled = true;
                try { await this.discover(profile.id); this.renderModelsPanel(content, profile); }
                catch (error) { alert(text(error?.message || error)); }
                finally { refresh.disabled = false; }
            });
            const manual = button('手动添加', 'add', 'md-btn md-btn-tonal');
            manual.addEventListener('click', () => this.addManual(profile.id, content));
            const clear = button('', 'delete_sweep', 'ai-icon-btn');
            clear.title = '清除候选记录';
            clear.addEventListener('click', async () => {
                if (!confirm('仅清除候选记录，已添加模型和功能绑定不受影响。继续吗？')) return;
                delete root.ai.modelCandidates[profile.id]; await root.ai.persistModelCandidates(); this.renderModelsPanel(content, profile);
            });
            toolbar.append(refresh, manual, clear);
            const added = (root.ai.models || []).filter(model => model.profileId === profile.id);
            const candidates = root.ai.modelCandidates?.[profile.id]?.models || [];
            const candidateSection = this.modelSection('候选模型', candidates, added, profile, true, content);
            const candidateIds = new Set(candidates.map(model => model.id));
            const addedRows = added.map(model => ({ ...model, notDiscovered: candidates.length > 0 && !candidateIds.has(model.id) }));
            const addedSection = this.modelSection('已添加模型', addedRows, addedRows, profile, false, content);
            content.append(toolbar, candidateSection, addedSection);
        },

        modelSection(titleText, models, added, profile, selectable, host) {
            const section = document.createElement('section'); section.className = 'ai-provider-model-section';
            const heading = document.createElement('div'); heading.className = 'ai-provider-model-heading';
            const title = document.createElement('strong'); title.textContent = `${titleText} (${models.length})`;
            heading.append(title);
            const groups = new Map();
            models.forEach(model => { const family = familyFor(model); if (!groups.has(family)) groups.set(family, []); groups.get(family).push(model); });
            const selected = new Set();
            if (selectable && models.length) {
                const commit = button('添加 0 个模型', 'playlist_add', 'md-btn md-btn-filled');
                commit.disabled = true;
                commit.addEventListener('click', () => this.addCandidates(profile.id, models.filter(model => selected.has(model.id)), host));
                heading.append(commit);
                section._updateCommit = () => { commit.textContent = ''; commit.append(icon('playlist_add'), document.createTextNode(`添加 ${selected.size} 个模型`)); commit.disabled = !selected.size; };
            }
            section.append(heading);
            if (!models.length) {
                const empty = document.createElement('div'); empty.className = 'ai-provider-empty'; empty.textContent = selectable ? '暂无候选快照' : '尚未添加模型'; section.append(empty); return section;
            }
            groups.forEach((rows, family) => {
                const group = document.createElement('div'); group.className = 'ai-model-family';
                const groupHead = document.createElement('div'); groupHead.className = 'ai-model-family-title';
                const familyLabel = document.createElement('strong'); familyLabel.textContent = family;
                groupHead.append(familyLabel);
                if (selectable) {
                    const chooseGroup = button('全选分组', '', 'md-btn md-btn-text');
                    chooseGroup.addEventListener('click', () => {
                        rows.filter(model => !added.some(item => item.id === model.id)).forEach(model => selected.add(model.id));
                        group.querySelectorAll('input[type="checkbox"]').forEach(input => { if (!input.disabled) input.checked = true; });
                        section._updateCommit?.();
                    });
                    groupHead.append(chooseGroup);
                }
                group.append(groupHead);
                rows.forEach(model => {
                    const row = document.createElement('div'); row.className = 'ai-provider-model-row';
                    if (selectable) {
                        const check = document.createElement('input'); check.type = 'checkbox';
                        check.disabled = added.some(item => item.id === model.id);
                        check.setAttribute('aria-label', `选择 ${model.id}`);
                        check.addEventListener('change', () => { if (check.checked) selected.add(model.id); else selected.delete(model.id); section._updateCommit?.(); });
                        row.append(check);
                    }
                    const labels = document.createElement('span'); labels.className = 'ai-provider-model-labels';
                    const strong = document.createElement('strong'); strong.textContent = model.displayName || model.id;
                    const small = document.createElement('small'); small.textContent = model.id;
                    labels.append(strong, small); row.append(labels);
                    if (selectable && added.some(item => item.id === model.id)) { const mark = document.createElement('span'); mark.className = 'ai-model-added'; mark.textContent = '已添加'; row.append(mark); }
                    if (!selectable) {
                        if (model.notDiscovered) { const missing = document.createElement('span'); missing.className = 'ai-model-added'; missing.textContent = '本次未发现'; row.append(missing); }
                        const rename = button('', 'edit', 'ai-icon-btn'); rename.title = '修改显示名称'; rename.addEventListener('click', () => this.renameModel(profile.id, model.id, host));
                        const remove = button('', 'delete', 'ai-icon-btn is-danger'); remove.title = '删除模型'; remove.addEventListener('click', () => this.removeModel(profile.id, model.id, host));
                        row.append(rename, remove);
                    }
                    group.append(row);
                });
                section.append(group);
            });
            return section;
        },

        async addCandidates(profileId, models, host) {
            const helper = await root.ai.loadModelCatalogPure();
            const profile = root.ai.findProfile(profileId);
            const existing = new Map((root.ai.models || []).map(model => [`${model.profileId}::${model.id}`, model]));
            models.forEach(model => {
                const key = `${profileId}::${model.id}`;
                if (!existing.has(key)) existing.set(key, helper.normalizeCatalogModel(model, { profileId, provider: profile.provider, baseUrl: profile.baseUrl, source: 'manual' }));
            });
            root.ai.models = Array.from(existing.values());
            await root.ai.persistModelCache();
            this.renderModelsPanel(host, profile);
            root.aiTaskSettings?.render?.();
        },

        async addManual(profileId, host) {
            const id = text(prompt('输入原始模型 ID')).trim();
            if (!id) return;
            const displayName = text(prompt('显示名称（可留空）', id)).trim() || id;
            await this.addCandidates(profileId, [{ id, displayName, source: 'manual' }], host);
        },

        impactedTasks(profileId, modelId) {
            return Object.entries(root.ai.cfg.taskRoutes || {}).filter(([, route]) => {
                const refs = [route?.primary, ...(route?.fallbacks || [])];
                return refs.some(ref => ref?.profileId === profileId && ref?.modelId === modelId);
            }).map(([taskId]) => root.ai.getTaskDefinition?.(taskId)?.label || taskId);
        },

        async removeModel(profileId, modelId, host) {
            const impacted = this.impactedTasks(profileId, modelId);
            const message = impacted.length ? `该模型正被以下功能使用：\n${impacted.join('\n')}\n\n删除后将标记为失效，继续吗？` : `删除模型 ${modelId}？`;
            if (!confirm(message)) return;
            root.ai.models = (root.ai.models || []).filter(model => !(model.profileId === profileId && model.id === modelId));
            await root.ai.persistModelCache();
            this.renderModelsPanel(host, root.ai.findProfile(profileId));
            root.aiTaskSettings?.render?.();
        },

        async renameModel(profileId, modelId, host) {
            const model = (root.ai.models || []).find(item => item.profileId === profileId && item.id === modelId);
            if (!model) return;
            const name = text(prompt('显示名称', model.displayName || model.id)).trim();
            if (!name) return;
            model.displayName = name;
            await root.ai.persistModelCache();
            this.renderModelsPanel(host, root.ai.findProfile(profileId));
        },

        async toggle(profileId) {
            const profile = root.ai.findProfile(profileId); if (!profile) return;
            profile.enabled = profile.enabled === false;
            await this.persist();
        },

        async archive(profileId) {
            if (!confirm('归档后已有功能绑定将保留并标红。继续吗？')) return;
            const profile = root.ai.findProfile(profileId); if (!profile) return;
            profile.archived = true; profile.enabled = false;
            this.panel = 'list'; this.profileId = '';
            await this.persist();
        },

        async removeProvider(profileId) {
            const impacted = Object.keys(root.ai.cfg.taskRoutes || {}).filter(taskId => this.impactedTasks(profileId, root.ai.cfg.taskRoutes[taskId]?.primary?.modelId).length);
            if (!confirm(`永久删除供应商、凭据和模型？${impacted.length ? `\n将影响 ${impacted.length} 个功能绑定。` : ''}`)) return;
            root.ai.cfg.profiles = root.ai.cfg.profiles.filter(profile => profile.id !== profileId);
            root.ai.models = (root.ai.models || []).filter(model => model.profileId !== profileId);
            delete root.ai.modelCandidates[profileId]; delete root.ai.keyMap[profileId];
            await Promise.all([root.ai.persistKeyMap(), root.ai.persistModelCache(), root.ai.persistModelCandidates()]);
            this.panel = 'list'; this.profileId = '';
            await this.persist();
        },

        async refreshAll(trigger) {
            trigger.disabled = true;
            const profiles = profileList().filter(profile => profile.enabled !== false);
            const results = [];
            for (const profile of profiles) {
                try { const models = await this.discover(profile.id); results.push({ ok: true, count: models.length }); }
                catch (error) { results.push({ ok: false, error }); }
            }
            const ok = results.filter(item => item.ok).length;
            const status = byId('aiProviderBulkStatus');
            if (status) status.textContent = `${ok} 个成功，${results.length - ok} 个失败`;
            trigger.disabled = false;
        },

        async reorder(fromId, toId) {
            if (!fromId || !toId || fromId === toId) return;
            const rows = profileList();
            const from = rows.findIndex(item => item.id === fromId); const to = rows.findIndex(item => item.id === toId);
            if (from < 0 || to < 0) return;
            const [moved] = rows.splice(from, 1); rows.splice(to, 0, moved);
            rows.forEach((profile, index) => { profile.sortOrder = index; });
            await this.persist();
        }
    };

    root.aiProviderManager = manager;
    root.addEventListener('ai:ready', () => manager.renderSummary());
    root.addEventListener('ai:catalog-changed', () => manager.renderSummary());
})(window);
