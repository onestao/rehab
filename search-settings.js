// @ts-nocheck
(function attachSearchSettings(root) {
    const el = (tag, className, content) => { const node = document.createElement(tag); if (className) node.className = className; if (content != null) node.textContent = String(content); return node; };
    const icon = name => el('span', 'material-symbols-rounded', name);
    const NETWORK_ONBOARDING_KEY = 'rehab.ai.networkOnboarding.v1';
    const text = value => String(value == null ? '' : value);
    const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch (_) { return fallback; } };
    function privacyCopy(taskId) {
        const id = text(taskId).trim();
        if (id.startsWith('food.')) return '仅发送餐品、品牌、地区、规格和用户明确附带的订单或图片信息；不会发送完整健康档案。';
        if (id.startsWith('advice.')) return '仅发送当前问题、必要的对话片段和用户明确附带的图片或附件摘要。';
        if (id.startsWith('rehab.')) return '仅发送本次康复处方文本、用户明确提供的症状更新和任务所需上下文。';
        if (id.startsWith('plan.')) return '仅发送生成当前计划所需的目标、限制和用户明确提供的上下文。';
        return '仅发送完成当前任务所需的信息，不会自动附带无关健康记录。';
    }
    function updateProviderSelection(providerIds, providerId, checked) {
        const current = [...new Set((Array.isArray(providerIds) ? providerIds : []).map(value => text(value).trim()).filter(Boolean))];
        const id = text(providerId).trim();
        if (!id) return current;
        return checked ? [...current.filter(value => value !== id), id] : current.filter(value => value !== id);
    }
    function moveProviderSelection(providerIds, providerId, delta) {
        const current = updateProviderSelection(providerIds, '', false);
        const index = current.indexOf(text(providerId).trim());
        const target = Math.max(0, Math.min(current.length - 1, index + Number(delta || 0)));
        if (index < 0 || index === target) return current;
        const next = [...current];
        const [item] = next.splice(index, 1);
        next.splice(target, 0, item);
        return next;
    }
    const shouldShowOnboarding = (previousMode, nextMode, seen = false) => previousMode === 'off' && ['auto', 'required'].includes(nextMode) && seen !== true;
    const onboardingSeen = taskId => readJson(NETWORK_ONBOARDING_KEY, {})?.[text(taskId).trim()] === true;
    function markOnboardingSeen(taskId) {
        const stored = readJson(NETWORK_ONBOARDING_KEY, {});
        const next = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
        next[text(taskId).trim()] = true;
        try { localStorage.setItem(NETWORK_ONBOARDING_KEY, JSON.stringify(next)); } catch (_) { /* local-only preference */ }
    }
    function taskSection(options = {}) {
        const taskId = text(options.taskId).trim();
        const currentNetwork = options.currentNetwork;
        const saveRoute = options.saveRoute;
        if (!taskId || typeof currentNetwork !== 'function' || typeof saveRoute !== 'function') return null;
        const network = currentNetwork();
        const section = el('section', 'ai-task-network-settings');
        section.append(el('h3', '', '联网检索'), el('small', '', privacyCopy(taskId)));
        const saveNetwork = async patch => {
            const previous = currentNetwork();
            const nextNetwork = { ...previous, ...patch };
            if (shouldShowOnboarding(previous.mode, nextNetwork.mode, onboardingSeen(taskId))) {
                root.toast?.show?.(privacyCopy(taskId), 'info', 8000);
                markOnboardingSeen(taskId);
            }
            return saveRoute(nextNetwork);
        };
        const selectField = (label, choices, value, change) => {
            const wrap = el('label', 'ai-task-control');
            const select = el('select', 'ai-task-select');
            choices.forEach(([id, name]) => { const option = document.createElement('option'); option.value = id; option.textContent = name; select.append(option); });
            select.value = value; select.addEventListener('change', () => change(select.value));
            wrap.append(el('span', 'ai-task-control-label', label), select); return wrap;
        };
        section.append(
            selectField('联网模式', [['off', '不联网'], ['auto', '需要时联网'], ['required', '本次必须先核实']], network.mode, mode => saveNetwork({ mode })),
            selectField('执行顺序', [['native-first', '原生优先'], ['native-only', '仅模型原生'], ['external-first', '外部服务优先'], ['external-only', '仅外部服务']], network.execution, execution => saveNetwork({ execution })),
            selectField('来源策略', [['official-preferred', '官方优先'], ['official-only', '仅官方来源'], ['any', '允许所有来源']], network.sourcePolicy, sourcePolicy => saveNetwork({ sourcePolicy })),
            selectField('不可用时', [['local-estimate', '保留本地估算'], ['ask-user', '要求补充信息'], ['fail', '停止并提示失败']], network.fallback, fallback => saveNetwork({ fallback }))
        );
        const capability = root.searchRegistry?.nativeCapabilityState?.({ ...(root.ai?.resolveTaskConfig?.(taskId) || {}), network })
            || { usable: false, reason: '当前模型的原生联网能力尚未确认', actions: ['改用外部服务优先'] };
        const capabilityBox = el('div', `ai-task-network-capability is-${capability.usable ? 'available' : 'unavailable'}`);
        capabilityBox.append(icon(capability.usable ? 'verified' : 'info'), el('span', '', capability.reason));
        (capability.actions || []).slice(0, 3).forEach(action => {
            const button = el('button', 'md-btn md-btn-tonal', action); button.type = 'button';
            button.addEventListener('click', () => {
                if (action.includes('外部服务优先')) return saveNetwork({ execution: 'external-first' });
                if (action.includes('移除') && action.includes('域名')) return saveNetwork({ allowedDomains: [] });
                if (action.includes('配置外部搜索服务')) { options.closeSheet?.(); return manager.open(); }
                return undefined;
            });
            capabilityBox.append(button);
        });
        section.append(capabilityBox);
        const advanced = document.createElement('details'); advanced.className = 'ai-task-network-advanced'; advanced.append(el('summary', '', '高级选项'));
        const providerBox = el('div', 'ai-task-network-providers'); providerBox.append(el('strong', '', '外部服务顺序'));
        const providers = root.searchStore?.getProviders?.() || [];
        const byId = new Map(providers.map(provider => [provider.id, provider]));
        const selectedProviders = Array.isArray(network.providerIds) ? network.providerIds : [];
        const allProviderIds = [...new Set([...selectedProviders, ...providers.map(provider => provider.id)])];
        if (!allProviderIds.length) providerBox.append(el('small', '', '尚未配置外部搜索服务'));
        allProviderIds.forEach(providerId => {
            const provider = byId.get(providerId);
            const selectedIndex = selectedProviders.indexOf(providerId);
            const selected = selectedIndex >= 0;
            const state = !provider ? '已删除' : provider.archived ? '已归档' : provider.enabled === false ? '已禁用' : '';
            const line = el('div', 'ai-task-network-provider');
            const check = document.createElement('input'); check.type = 'checkbox'; check.checked = selected; check.disabled = !selected && !!state;
            check.addEventListener('change', () => saveNetwork({ providerIds: updateProviderSelection(currentNetwork().providerIds || [], providerId, check.checked) }));
            line.append(check, el('span', '', `${selected ? `${selectedIndex + 1}. ` : ''}${provider?.name || providerId}${state ? ` · ${state}` : ''}`));
            if (selected) {
                const controls = el('span', 'ai-task-network-provider-order');
                for (const [symbol, title, delta] of [['arrow_upward', '上移', -1], ['arrow_downward', '下移', 1]]) {
                    const move = el('button', 'md-icon-btn'); move.type = 'button'; move.title = title; move.append(icon(symbol));
                    move.disabled = delta < 0 ? selectedIndex === 0 : selectedIndex === selectedProviders.length - 1;
                    move.addEventListener('click', () => saveNetwork({ providerIds: moveProviderSelection(currentNetwork().providerIds || [], providerId, delta) }));
                    controls.append(move);
                }
                line.append(controls);
            }
            providerBox.append(line);
        });
        const domains = el('textarea', 'ai-task-network-domains'); domains.rows = 3; domains.placeholder = 'example.com，一行一个；最多 20 项'; domains.value = (network.allowedDomains || []).join('\n');
        domains.addEventListener('change', () => saveNetwork({ allowedDomains: domains.value.split(/[\n,，\s]+/).filter(Boolean) }));
        const domainField = el('label', 'ai-task-control'); domainField.append(el('span', 'ai-task-control-label', '任务域名白名单（只会收紧全局规则）'), domains);
        advanced.append(providerBox, domainField); section.append(advanced);
        return section;
    }
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
        },
        taskSection,
        _test: { privacyCopy, updateProviderSelection, moveProviderSelection, shouldShowOnboarding }
    };
    root.searchSettings = manager;
    root.addEventListener?.('ai:ready', () => root.searchStore?.init?.().then(() => manager.updateSummary()).catch(() => {}));
})(window);
