// @ts-nocheck
(function attachSearchAdapters(root) {
    const ERROR_MESSAGES = Object.freeze({
        SEARCH_DISABLED: '未配置可用的联网检索服务', SEARCH_QUERY_INVALID: '搜索关键词无效',
        SEARCH_TIMEOUT: '检索超时，请稍后重试', SEARCH_NETWORK_ERROR: '检索服务不可用',
        SEARCH_HTTP_ERROR: '检索服务返回错误', SEARCH_PROVIDER_UNSUPPORTED: '不支持的检索服务',
        SEARCH_RESPONSE_TOO_LARGE: '检索响应超过安全大小限制', SEARCH_MIME_UNSUPPORTED: '检索服务返回了不支持的内容类型',
        FETCH_URL_UNAVAILABLE: '当前服务不支持网页深读', FETCH_URL_EMPTY: '网页深读没有返回可用正文'
    });
    const error = (code, details = {}) => Object.assign(new Error(ERROR_MESSAGES[code] || '联网检索失败'), { code, ...details });
    function utf8Bytes(value) {
        let count = 0;
        for (const char of String(value || '')) {
            const code = char.codePointAt(0);
            count += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
        }
        return count;
    }

    async function responseJson(response, maxBytes, controller) {
        const contentType = String(response.headers?.get?.('content-type') || 'application/json').toLowerCase();
        if (!contentType.includes('json')) throw error('SEARCH_MIME_UNSUPPORTED');
        const declared = Number(response.headers?.get?.('content-length') || 0);
        if (declared > maxBytes) {
            try { await response.body?.cancel?.(); } catch {}
            controller.abort();
            throw error('SEARCH_RESPONSE_TOO_LARGE');
        }
        let raw = '';
        const reader = response.body?.getReader?.();
        if (reader) {
            const decoder = new TextDecoder();
            let received = 0;
            while (true) {
                const chunk = await reader.read();
                if (chunk.done) break;
                received += Number(chunk.value?.byteLength || 0);
                if (received > maxBytes) {
                    await reader.cancel().catch(() => {});
                    controller.abort();
                    throw error('SEARCH_RESPONSE_TOO_LARGE');
                }
                raw += decoder.decode(chunk.value, { stream: true });
            }
            raw += decoder.decode();
        } else if (typeof response.arrayBuffer === 'function') {
            const buffer = await response.arrayBuffer();
            if (buffer.byteLength > maxBytes) throw error('SEARCH_RESPONSE_TOO_LARGE');
            raw = new TextDecoder().decode(buffer);
        } else if (typeof response.text === 'function') {
            raw = await response.text();
            if (utf8Bytes(raw) > maxBytes) throw error('SEARCH_RESPONSE_TOO_LARGE');
        } else {
            return await response.json();
        }
        try { return JSON.parse(raw); } catch { throw error('SEARCH_MIME_UNSUPPORTED'); }
    }

    async function request(url, init, timeoutMs, maxBytes = 1500000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), Math.max(1000, Math.min(30000, Number(timeoutMs) || 8000)));
        try {
            const response = await fetch(url, { ...init, credentials: 'omit', signal: controller.signal });
            if (!response.ok) throw error('SEARCH_HTTP_ERROR', { status: response.status });
            return await responseJson(response, maxBytes, controller);
        } catch (cause) {
            if (cause?.code) throw cause;
            if (cause?.name === 'AbortError') throw error('SEARCH_TIMEOUT');
            throw error('SEARCH_NETWORK_ERROR');
        } finally { clearTimeout(timer); }
    }

    function requireKey(key) {
        if (!key) throw error('SEARCH_DISABLED');
        return key;
    }

    async function tavily(provider, key, query) {
        requireKey(key);
        const json = await request('https://api.tavily.com/search', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: key, query, max_results: provider.options?.maxResults || 5, search_depth: 'basic', include_raw_content: false })
        }, provider.options?.timeoutMs);
        return Array.isArray(json?.results) ? json.results.map(item => ({ title: item?.title, url: item?.url, snippet: item?.content })) : [];
    }

    async function brave(provider, key, query) {
        requireKey(key);
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

    async function exa(provider, key, query) {
        requireKey(key);
        const json = await request('https://api.exa.ai/search', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key },
            body: JSON.stringify({
                query, numResults: provider.options?.maxResults || 5, type: 'fast',
                contents: { highlights: { maxCharacters: 1200 } }
            })
        }, provider.options?.timeoutMs);
        return Array.isArray(json?.results) ? json.results.map(item => ({
            title: item?.title, url: item?.url, snippet: item?.summary || item?.text || item?.highlights?.[0] || ''
        })) : [];
    }

    async function jina(provider, key, query) {
        requireKey(key);
        const json = await request(`https://s.jina.ai/?q=${encodeURIComponent(query)}`, {
            headers: { Accept: 'application/json', Authorization: `Bearer ${key}`, 'X-No-Cache': 'true' }
        }, provider.options?.timeoutMs);
        const rows = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : Array.isArray(json?.results) ? json.results : [];
        return rows.slice(0, provider.options?.maxResults || 5).map(item => ({
            title: item?.title, url: item?.url, snippet: item?.description || item?.content || item?.text || ''
        }));
    }

    async function serper(provider, key, query) {
        requireKey(key);
        const json = await request('https://google.serper.dev/search', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': key },
            body: JSON.stringify({ q: query, num: provider.options?.maxResults || 5, gl: String(provider.region || '').toLowerCase() || undefined })
        }, provider.options?.timeoutMs);
        return Array.isArray(json?.organic) ? json.organic.map(item => ({ title: item?.title, url: item?.link, snippet: item?.snippet })) : [];
    }

    function flattenDdgTopics(value, output = []) {
        for (const item of Array.isArray(value) ? value : []) {
            if (Array.isArray(item?.Topics)) flattenDdgTopics(item.Topics, output);
            else if (item?.FirstURL) output.push({ title: item?.Text, url: item?.FirstURL, snippet: item?.Text });
        }
        return output;
    }

    async function duckduckgo(provider, _key, query) {
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&no_redirect=1`;
        const json = await request(url, { headers: { Accept: 'application/json' } }, provider.options?.timeoutMs);
        const rows = [];
        if (json?.AbstractURL) rows.push({ title: json?.Heading || query, url: json.AbstractURL, snippet: json?.AbstractText || '' });
        rows.push(...flattenDdgTopics(json?.RelatedTopics));
        return rows.slice(0, provider.options?.maxResults || 5);
    }

    async function tavilyRead(provider, key, url) {
        requireKey(key);
        const json = await request('https://api.tavily.com/extract', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({ urls: [url], extract_depth: 'basic', include_images: false, format: 'markdown' })
        }, provider.options?.timeoutMs, 750000);
        const item = Array.isArray(json?.results) ? json.results[0] : null;
        return item ? { url: item.url || url, title: '', content: item.raw_content || '', contentType: 'text/markdown' } : null;
    }

    async function jinaRead(provider, key, url) {
        const headers = { Accept: 'application/json', 'X-No-Cache': 'true', 'X-Remove-Selector': 'nav, footer, script, style' };
        if (key) headers.Authorization = `Bearer ${key}`;
        const json = await request(`https://r.jina.ai/${url}`, { headers }, provider.options?.timeoutMs, 750000);
        const item = json?.data && !Array.isArray(json.data) ? json.data : json;
        return item ? {
            url: item.url || url, title: item.title || '', content: item.content || item.text || '',
            contentType: item.contentType || item.content_type || 'text/markdown'
        } : null;
    }

    // A self-hosted SearXNG server must be registered by type, not an arbitrary
    // endpoint. v1 intentionally has no endpoint/header fields and therefore does
    // not provide a generic browser request proxy.
    const handlers = Object.freeze({ tavily, brave, searxng, exa, jina, serper, duckduckgo });
    const readers = Object.freeze({ tavily: tavilyRead, jina: jinaRead });
    const adapters = {
        async search(provider, query, options = {}) {
            const safeQuery = root.searchPolicyPure?.safeSearchQuery?.(query) || '';
            if (!safeQuery) throw error('SEARCH_QUERY_INVALID');
            if (!provider?.id || !handlers[provider.type]) throw error('SEARCH_PROVIDER_UNSUPPORTED');
            const raw = await handlers[provider.type](provider, typeof options.apiKey === 'string' ? options.apiKey : (root.searchStore?.apiKeyFor?.(provider.id) || ''), safeQuery);
            const domains = root.searchRegistry?.effectiveDomains?.(options.policy || {}) || [];
            const sourcePolicy = options.policy?.sourcePolicy || 'official-preferred';
            const sourceOptions = { taskId: options.taskId || '', domainProfile: options.domainProfile || '', allowedDomains: domains };
            const normalized = raw.map((item, index) => root.searchPolicyPure?.normalizeSearchEvidence?.({
                ...item, ...root.searchPolicyPure?.classifySearchSource?.(item?.url, sourceOptions), id: `ev_${provider.id}_${Date.now().toString(36)}_${index}`, providerId: provider.id, retrievedAt: Date.now()
            }, sourceOptions)).filter(Boolean);
            let filtered = sourcePolicy === 'official-only' ? normalized.filter(item => item.official) : normalized;
            if (sourcePolicy === 'official-preferred') {
                filtered = root.searchPolicyPure?.sortSearchEvidence?.(filtered, sourceOptions) || filtered;
            }
            root.searchRegistry?.mark?.(provider.id, true);
            return filtered;
        },
        async fetchUrl(provider, value, options = {}) {
            const url = root.searchPolicyPure?.safeFetchUrl?.(value) || '';
            if (!url) throw error('SEARCH_QUERY_INVALID');
            const reader = readers[provider?.type];
            if (!provider?.id || !reader) throw error('FETCH_URL_UNAVAILABLE');
            const key = typeof options.apiKey === 'string' ? options.apiKey : (root.searchStore?.apiKeyFor?.(provider.id) || '');
            const raw = await reader(provider, key, url);
            const content = String(raw?.content || '').trim().slice(0, root.searchPolicyPure?.SEARCH_LIMITS?.fetchChars || 24000);
            if (!content) throw error('FETCH_URL_EMPTY');
            const returnedUrl = root.searchPolicyPure?.safeFetchUrl?.(raw?.url || url) || '';
            if (!returnedUrl || new URL(returnedUrl).origin !== new URL(url).origin) throw error('SEARCH_HTTP_ERROR', { status: 310 });
            const base = options.evidence && typeof options.evidence === 'object' ? options.evidence : {};
            return root.searchPolicyPure?.normalizeSearchEvidence?.({
                ...base, url: returnedUrl, title: raw?.title || base.title || '',
                readStatus: 'deep-read', contentExcerpt: content,
                contentType: raw?.contentType || 'text/markdown', readerProviderId: provider.id,
                providerId: base.providerId || provider.id, retrievedAt: Date.now()
            }, { taskId: options.taskId || '', domainProfile: options.domainProfile || '', allowedDomains: root.searchRegistry?.effectiveDomains?.(options.policy || {}) || [] });
        },
        test(provider, apiKey = '') { return this.search(provider, 'nutrition facts', { policy: { sourcePolicy: 'any' }, apiKey }); },
        errorMessage(code) { return ERROR_MESSAGES[code] || ERROR_MESSAGES.SEARCH_NETWORK_ERROR; }
    };
    root.searchAdapters = adapters;
})(window);
