// @ts-nocheck
(function attachSearchRegistry(root) {
    function policy() { return root.searchPolicyPure; }
    const registry = {
        health: new Map(),
        list(policyValue = {}) {
            const providers = root.searchStore?.getProviders?.() || [];
            const requested = new Set(Array.isArray(policyValue.providerIds) ? policyValue.providerIds : []);
            if (!requested.size) return [];
            return providers.filter(provider => provider.enabled && !provider.archived && requested.has(provider.id));
        },
        select(policyValue = {}) {
            const rank = new Map((policyValue.providerIds || []).map((id, index) => [id, index]));
            return this.list(policyValue).sort((a, b) => rank.get(a.id) - rank.get(b.id));
        },
        mark(providerId, ok, code = '') {
            this.health.set(String(providerId || ''), { ok: !!ok, code: String(code || ''), checkedAt: Date.now() });
        },
        state(providerId) { return this.health.get(String(providerId || '')) || null; },
        effectiveDomains(policyValue = {}) {
            // Routing has already intersected task/global constraints. Do not widen
            // it again here when a task explicitly has no overlapping domains.
            const domains = Array.isArray(policyValue.allowedDomains) ? policyValue.allowedDomains : [];
            const globalDomains = root.searchStore?.config?.networkDefaults?.allowedDomains || [];
            return globalDomains.length && !domains.length ? ['blocked.invalid'] : domains;
        },
        nativeUsable(effective = {}) {
            const caps = effective.capabilities || {};
            if (!(caps.webSearch === true || caps.web_search === true || caps.tools?.webSearch === true)) return false;
            const provider = String(effective.provider || '').toLowerCase();
            if (provider === 'openai-responses' || provider === 'claude') return true;
            if (provider === 'openai' || provider === 'openai-chat') return caps.nativeWebSearchChat === true;
            if (provider === 'gemini') return !(effective.network?.allowedDomains || []).length;
            return false;
        },
        normalizeEvidence(value, options = {}) {
            return policy()?.normalizeSearchEvidence?.(value, options) || null;
        }
    };
    root.searchRegistry = registry;
})(window);
