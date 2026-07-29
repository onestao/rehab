// @ts-nocheck
(function attachSearchSettings(root) {
    const el = (tag, className, content) => { const node = document.createElement(tag); if (className) node.className = className; if (content != null) node.textContent = String(content); return node; };
    const icon = name => el('span', 'material-symbols-rounded', name);
    const manager = {
        panel: 'list',
        open() { document.getElementById('searchProviderManager')?.classList.remove('hidden'); document.getElementById('searchProviderManager')?.setAttribute('aria-hidden', 'false'); this.render(); },
        close() { document.getElementById('searchProviderManager')?.classList.add('hidden'); document.getElementById('searchProviderManager')?.setAttribute('aria-hidden', 'true'); },
        async render() {
            const body = document.getElementById('searchProviderManagerBody');
            if (!body) return;
            await root.searchStore?.init?.();
            body.replaceChildren();
            const providers = root.searchStore?.getProviders?.() || [];
            if (!providers.length) body.append(el('p', 'search-settings-empty', '未配置外部搜索服务；食物核实将保持离线或使用模型原生联网。'));
            for (const provider of providers) body.append(this.providerRow(provider));
            const add = el('button', 'md-btn md-btn-tonal'); add.type = 'button'; add.append(icon('add'), document.createTextNode('添加搜索服务'));
            add.addEventListener('click', () => this.edit({ id: `search_${Date.now().toString(36)}`, name: '搜索服务', type: 'tavily', enabled: true, archived: false, options: { maxResults: 5, timeoutMs: 8000 } }));
            body.append(add);
            this.updateSummary();
        },
        providerRow(provider) {
            const row = el('section', 'search-provider-row');
            const meta = el('div', 'search-provider-meta'); meta.append(el('strong', '', provider.name), el('small', '', `${provider.type} · ${provider.archived ? '已归档' : provider.enabled ? '已启用' : '已停用'}`));
            const actions = el('div', 'search-provider-actions');
            for (const [symbol, label, delta] of [['arrow_upward', '上移', -1], ['arrow_downward', '下移', 1]]) {
                const move = el('button', 'md-icon-btn'); move.type = 'button'; move.title = label; move.append(icon(symbol)); move.addEventListener('click', async () => { await root.searchStore.moveProvider(provider.id, delta); this.render(); }); actions.append(move);
            }
            const edit = el('button', 'md-btn md-btn-tonal'); edit.type = 'button'; edit.append(icon('tune'), document.createTextNode('管理')); edit.addEventListener('click', () => this.edit(provider));
            actions.append(edit); row.append(meta, actions); return row;
        },
        edit(provider) {
            const body = document.getElementById('searchProviderManagerBody'); if (!body) return;
            body.replaceChildren();
            const form = el('form', 'search-provider-form'); form.noValidate = true;
            const field = (label, value, type = 'text') => { const wrap = el('label', 'md-field'); const input = document.createElement('input'); input.type = type; input.value = value || ''; input.placeholder = ' '; input.name = label; wrap.append(input, el('span', '', label)); return { wrap, input }; };
            const name = field('名称', provider.name); const key = field('API Key（留空则保持不变）', '', 'password');
            const typeWrap = el('label', 'md-field'); const type = document.createElement('select'); type.name = '类型';
            [['tavily', 'Tavily'], ['brave', 'Brave Search'], ['searxng', 'SearXNG（自托管）']].forEach(([value, label]) => { const option = document.createElement('option'); option.value = value; option.textContent = label; option.selected = provider.type === value; type.append(option); });
            typeWrap.append(type, el('span', '', '类型'));
            const endpoint = field('SearXNG HTTPS 地址', provider.options?.baseUrl || '', 'url');
            const enabled = document.createElement('input'); enabled.type = 'checkbox'; enabled.checked = provider.enabled !== false;
            const enabledWrap = el('label', 'md-switch'); enabledWrap.append(el('span', '', '启用此服务'), enabled);
            const actions = el('div', 'md-row search-provider-actions');
            const cancel = el('button', 'md-btn md-btn-tonal', '返回'); cancel.type = 'button'; cancel.addEventListener('click', () => this.render());
            const test = el('button', 'md-btn md-btn-tonal', '测试连接'); test.type = 'button';
            const save = el('button', 'md-btn md-btn-filled', '保存'); save.type = 'submit';
            const archive = el('button', 'md-btn md-btn-tonal', provider.archived ? '取消归档' : '归档'); archive.type = 'button'; archive.addEventListener('click', async () => { await root.searchStore.archiveProvider(provider.id, !provider.archived); this.render(); });
            const remove = el('button', 'md-btn md-btn-tonal', '删除'); remove.type = 'button'; remove.addEventListener('click', async () => { if (!root.confirm?.('删除此搜索服务及其本机密钥？')) return; await root.searchStore.removeProvider(provider.id); this.render(); });
            actions.append(cancel, archive, remove, test, save); form.append(name.wrap, typeWrap, endpoint.wrap, key.wrap, enabledWrap, actions);
            const value = () => ({ ...provider, name: name.input.value, type: type.value, enabled: enabled.checked, options: { ...provider.options, baseUrl: endpoint.input.value } });
            test.addEventListener('click', async () => { test.disabled = true; try { await root.searchAdapters?.test?.(value(), key.input.value || root.searchStore?.apiKeyFor?.(provider.id)); root.toast?.show?.('搜索服务连接正常', 'success'); } catch (error) { root.toast?.show?.(root.searchAdapters?.errorMessage?.(error?.code) || '测试失败', 'error'); } finally { test.disabled = false; } });
            form.addEventListener('submit', async event => { event.preventDefault(); await root.searchStore.saveProvider(value(), key.input.value); this.render(); });
            body.append(form);
        },
        updateSummary() {
            const node = document.getElementById('searchProviderSummary'); if (!node) return;
            const providers = root.searchStore?.getProviders?.() || []; const enabled = providers.filter(item => item.enabled && !item.archived).length;
            node.textContent = enabled ? `食物核实：可用 ${enabled} 个后备服务` : '未配置 · 仅使用本地估算';
        }
    };
    root.searchSettings = manager;
    root.addEventListener?.('ai:ready', () => root.searchStore?.init?.().then(() => manager.updateSummary()).catch(() => {}));
})(window);
