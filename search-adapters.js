// @ts-nocheck
(function attachSearchAdapters(root) {
    const ERROR_MESSAGES = Object.freeze({
        SEARCH_DISABLED: '未配置可用的联网检索服务', SEARCH_QUERY_INVALID: '搜索关键词无效',
        SEARCH_TIMEOUT: '检索超时，请稍后重试', SEARCH_NETWORK_ERROR: '检索服务不可用',
        SEARCH_HTTP_ERROR: '检索服务返回错误', SEARCH_PROVIDER_UNSUPPORTED: '不支持的检索服务'
    });
    const error = (code, details = {}) => Object.assign(new Error(ERROR_MESSAGES[code] || '联网检索失败'), { code, ...details });

    async function request(url, init, timeoutMs) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), Math.max(1000, Math.min(30000, Number(timeoutMs) || 8000)));
        try {
            const response = await fetch(url, { ...init, credentials: 'omit', signal: controller.signal });
            if (!response.ok) throw error('SEARCH_HTTP_ERROR', { status: response.status });
            return await response.json();
        } catch (cause) {
            if (cause?.code) throw cause;
            if (cause?.name === 'AbortError') throw error('SEARCH_TIMEOUT');
            throw error('SEARCH_NETWORK_ERROR');
        } finally { clearTimeout(timer); }
    }

    async function tavily(provider, key, query) {
        if (!key) throw error('SEARCH_DISABLED');
        const json = await request('https://api.tavily.com/search', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: key, query, max_results: provider.options?.maxResults || 5, search_depth: 'basic', include_raw_content: false })
        }, provider.options?.timeoutMs);
        return Array.isArray(json?.results) ? json.results.map(item => ({ title: item?.title, url: item?.url, snippet: item?.content })) : [];
    }

    async function brave(provider, key, query) {
        if (!key) throw error('SEARCH_DISABLED');
        const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${encodeURIComponent(provider.options?.maxResults || 5)}`;
        const json = await request(url, { headers: { Accept: 'application/json', 'X-Subscription-Token': key } }, provider.options?.timeoutMs);
        return Array.isArray(json?.web?.results) ? json.web.results.map(item => ({ title: item?.title, url: item?.url, snippet: item?.description })) : [];
    }

    async function searxng(provider, _key, query) {
        const baseUrl = String(provider.options?.baseUrl || '').replace(/\/$/, '');
        if (!baseUrl.startsWith('https://')) throw error('SEARCH_DISABLED');
        const url = `${baseUrl}/search?q=${encodeURIComponent(query)}&format=json&language=${encodeURIComponent(provider.region || 'all')}`;
        const json = await request(url, { headers: { Accept: 'application/json' } }, provider.options?.timeoutMs);
        return Array.isArray(json?.results) ? json.results.slice(0, provider.options?.maxResults || 5).map(item => ({ title: item?.title, url: item?.url, snippet: item?.content })) : [];
    }

    // A self-hosted SearXNG server must be registered by type, not an arbitrary
    // endpoint. v1 intentionally has no endpoint/header fields and therefore does
    // not provide a generic browser request proxy.
    const handlers = Object.freeze({ tavily, brave, searxng });
    const adapters = {
        async search(provider, query, options = {}) {
            const safeQuery = root.searchPolicyPure?.safeSearchQuery?.(query) || '';
            if (!safeQuery) throw error('SEARCH_QUERY_INVALID');
            if (!provider?.id || !handlers[provider.type]) throw error('SEARCH_PROVIDER_UNSUPPORTED');
            const raw = await handlers[provider.type](provider, typeof options.apiKey === 'string' ? options.apiKey : (root.searchStore?.apiKeyFor?.(provider.id) || ''), safeQuery);
            const domains = root.searchRegistry?.effectiveDomains?.(options.policy || {}) || [];
            const sourcePolicy = options.policy?.sourcePolicy || 'official-preferred';
            const normalized = raw.map((item, index) => root.searchPolicyPure?.normalizeSearchEvidence?.({
                ...item, ...root.searchPolicyPure?.classifySearchSource?.(item?.url), id: `ev_${provider.id}_${Date.now().toString(36)}_${index}`, providerId: provider.id, retrievedAt: Date.now()
            }, { allowedDomains: domains })).filter(Boolean);
            let filtered = sourcePolicy === 'official-only' ? normalized.filter(item => item.official) : normalized;
            if (sourcePolicy === 'official-preferred') {
                filtered = [
                    ...filtered.filter(item => item.official === true),
                    ...filtered.filter(item => item.official !== true)
                ];
            }
            root.searchRegistry?.mark?.(provider.id, true);
            return filtered;
        },
        test(provider, apiKey = '') { return this.search(provider, 'nutrition facts', { policy: { sourcePolicy: 'any' }, apiKey }); },
        errorMessage(code) { return ERROR_MESSAGES[code] || ERROR_MESSAGES.SEARCH_NETWORK_ERROR; }
    };
    root.searchAdapters = adapters;
})(window);
