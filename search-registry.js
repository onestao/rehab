// @ts-nocheck
(function attachSearchRegistry(root) {
    function policy() { return root.searchPolicyPure; }
    function providerIds(value = {}) {
        const seen = new Set();
        return (Array.isArray(value.providerIds) ? value.providerIds : []).map(id => String(id || '')).filter(id => id && !seen.has(id) && seen.add(id));
    }
    function nativeCapabilityState(effective = {}) {
        const caps = effective.capabilities || {};
        const declared = caps.webSearch ?? caps.web_search ?? caps.tools?.webSearch;
        const provider = String(effective.provider || '').toLowerCase();
        if (declared !== true) {
            return declared === false
                ? { usable: false, code: 'capability-unsupported', reason: '当前模型声明不支持原生联网检索', actions: ['选择支持联网的模型', '配置外部搜索服务'] }
                : { usable: false, code: 'capability-unknown', reason: '当前模型的原生联网能力尚未确认', actions: ['改用外部服务优先', '选择已确认支持的模型'] };
        }
        if (provider === 'openai-responses' || provider === 'claude') {
            return { usable: true, code: 'available', reason: '当前模型可使用原生联网检索', actions: [] };
        }
        if (provider === 'openai' || provider === 'openai-chat') {
            return caps.nativeWebSearchChat === true
                ? { usable: true, code: 'available', reason: '当前 Chat 接口已确认支持原生联网', actions: [] }
                : { usable: false, code: 'chat-dialect-unconfirmed', reason: '当前 Chat 兼容接口尚未确认支持原生联网工具', actions: ['改用外部服务优先', '切换到 Responses 接口'] };
        }
        if (provider === 'gemini') {
            return (effective.network?.allowedDomains || []).length
                ? { usable: false, code: 'gemini-domain-filter-incompatible', reason: 'Gemini 原生检索无法应用当前任务的域名白名单', actions: ['移除不兼容的域名限制', '改用外部服务优先'] }
                : { usable: true, code: 'available', reason: '当前 Gemini 模型可使用原生联网检索', actions: [] };
        }
        return { usable: false, code: 'provider-unsupported', reason: '当前供应商没有已验证的原生联网适配', actions: ['配置外部搜索服务', '选择支持的供应商'] };
    }
    const registry = {
        health: new Map(),
        list(policyValue = {}) {
            const byId = new Map((root.searchStore?.getProviders?.() || []).map(provider => [provider.id, provider]));
            return providerIds(policyValue).map(id => byId.get(id)).filter(provider => provider?.enabled && !provider?.archived);
        },
        select(policyValue = {}) { return this.list(policyValue); },
        references(policyValue = {}) {
            const byId = new Map((root.searchStore?.getProviders?.() || []).map(provider => [provider.id, provider]));
            return providerIds(policyValue).map((id, index) => {
                const provider = byId.get(id);
                return provider
                    ? { id, index, provider, available: provider.enabled !== false && provider.archived !== true, reason: provider.archived ? 'archived' : provider.enabled === false ? 'disabled' : '' }
                    : { id, index, provider: null, available: false, reason: 'missing' };
            });
        },
        mark(providerId, ok, code = '') {
            this.health.set(String(providerId || ''), { ok: !!ok, code: String(code || ''), checkedAt: Date.now() });
        },
        state(providerId) { return this.health.get(String(providerId || '')) || null; },
        effectiveDomains(policyValue = {}) {
            const domains = Array.isArray(policyValue.allowedDomains) ? policyValue.allowedDomains : [];
            const globalDomains = root.searchStore?.config?.networkDefaults?.allowedDomains || [];
            return globalDomains.length && !domains.length ? ['blocked.invalid'] : domains;
        },
        nativeCapabilityState,
        nativeUsable(effective = {}) { return nativeCapabilityState(effective).usable; },
        normalizeEvidence(value, options = {}) {
            return policy()?.normalizeSearchEvidence?.(value, options) || null;
        }
    };
    root.searchRegistry = registry;
})(window);
