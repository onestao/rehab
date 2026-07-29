// @ts-nocheck
(function attachSearchToolLoop(root) {
    const FUNCTION_SCHEMA = Object.freeze({
        type: 'function', function: {
            name: 'search_web', description: '检索公开网页的标题、URL 与摘要。仅用于获取来源，不能读取网页全文。',
            parameters: { type: 'object', additionalProperties: false, properties: {
                query: { type: 'string', description: '不超过 240 个字符的检索关键词' }
            }, required: ['query'] }
        }
    });
    function error(code, message) { return Object.assign(new Error(message), { code }); }
    function budgetState(value) {
        if (!value || typeof value !== 'object') return null;
        if (!Number.isFinite(Number(value.limit))) value.limit = 2;
        if (!Number.isFinite(Number(value.remaining))) value.remaining = Number(value.limit);
        if (!Array.isArray(value.attempts)) value.attempts = [];
        return value;
    }
    function consumeBudget(value, kind, providerId = '') {
        const budget = budgetState(value);
        if (!budget) return null;
        if (Number(budget.remaining) <= 0) throw error('SEARCH_TOOL_LIMIT', '联网检索次数已达上限');
        budget.remaining = Math.max(0, Number(budget.remaining) - 1);
        const attempt = { kind: String(kind || 'external'), providerId: String(providerId || ''), status: 'started' };
        budget.attempts.push(attempt);
        return attempt;
    }
    function finishAttempt(attempt, status, code = '') {
        if (!attempt) return;
        attempt.status = String(status || 'failed');
        if (code) attempt.code = String(code);
    }
    function argsOf(value) {
        if (value && typeof value === 'object' && !Array.isArray(value)) return value;
        try { const parsed = JSON.parse(String(value || '{}')); return parsed && typeof parsed === 'object' ? parsed : {}; } catch { return {}; }
    }
    function callOf(value, index = 0) {
        const fn = value?.function || value?.functionCall || value || {};
        const name = String(fn.name || value?.name || '');
        if (name !== 'search_web') return null;
        return { id: String(value?.id || value?.call_id || `search_${index}`), name, arguments: argsOf(fn.arguments ?? fn.args ?? value?.input) };
    }
    function resultText(evidence, limit) {
        const value = evidence.map(item => ({ title: item.title, url: item.url, domain: item.domain, snippet: item.snippet, sourceType: item.sourceType, official: item.official }));
        let out = JSON.stringify(value);
        return out.length > limit ? out.slice(0, limit) : out;
    }
    function schemaOf(value = FUNCTION_SCHEMA) { return value?.function || value; }
    function requestOptions(provider, options = {}) {
        const schemas = Array.isArray(options.externalTools) ? options.externalTools : [];
        if (!schemas.length) return {};
        const required = options.toolChoice === 'required';
        if (provider === 'openai-responses') return {
            tools: schemas.map(item => ({ type: 'function', name: schemaOf(item).name, description: schemaOf(item).description, parameters: schemaOf(item).parameters })),
            ...(required ? { tool_choice: 'required' } : {})
        };
        if (provider === 'claude') return {
            tools: schemas.map(item => ({ name: schemaOf(item).name, description: schemaOf(item).description, input_schema: schemaOf(item).parameters })),
            ...(required ? { tool_choice: { type: 'any' } } : {})
        };
        if (provider === 'gemini') return {
            tools: [{ functionDeclarations: schemas.map(item => ({ name: schemaOf(item).name, description: schemaOf(item).description, parameters: schemaOf(item).parameters })) }],
            ...(required ? { toolConfig: { functionCallingConfig: { mode: 'ANY' } } } : {})
        };
        return { tools: schemas, ...(required ? { tool_choice: 'required' } : {}) };
    }
    function mapMessages(provider, messages = []) {
        const mapped = [];
        for (const message of (Array.isArray(messages) ? messages : [])) {
            const calls = Array.isArray(message?.toolCalls) ? message.toolCalls : [];
            if (provider === 'openai-responses') {
                if (calls.length) calls.forEach(call => mapped.push({ type: 'function_call', call_id: call.id, name: call.name, arguments: JSON.stringify(call.arguments || {}) }));
                else if (message?.role === 'tool') mapped.push({ type: 'function_call_output', call_id: message.toolCallId, output: String(message.content || '') });
                else mapped.push({ role: message.role, content: [{ type: message.role === 'assistant' ? 'output_text' : 'input_text', text: String(message.content || '') }] });
                continue;
            }
            if (provider === 'claude') {
                if (calls.length) mapped.push({ role: 'assistant', content: calls.map(call => ({ type: 'tool_use', id: call.id, name: call.name, input: call.arguments || {} })) });
                else if (message?.role === 'tool') mapped.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: message.toolCallId, content: String(message.content || '') }] });
                else mapped.push({ role: message?.role === 'assistant' ? 'assistant' : 'user', content: String(message?.content || '') });
                continue;
            }
            if (provider === 'gemini') {
                if (calls.length) mapped.push({ role: 'model', parts: calls.map(call => ({ functionCall: { name: call.name, args: call.arguments || {} } })) });
                else if (message?.role === 'tool') mapped.push({ role: 'user', parts: [{ functionResponse: { name: message.name || 'search_web', response: { content: String(message.content || '') } } }] });
                else mapped.push({ role: message?.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(message?.content || '') }] });
                continue;
            }
            if (calls.length) mapped.push({ role: 'assistant', content: message.content || null, tool_calls: calls.map(call => ({ id: call.id, type: 'function', function: { name: call.name, arguments: JSON.stringify(call.arguments || {}) } })) });
            else if (message?.role === 'tool') mapped.push({ role: 'tool', tool_call_id: message.toolCallId, content: String(message.content || '') });
            else mapped.push(message);
        }
        return mapped;
    }
    function responseEnvelope(provider, payload = {}, text = '') {
        let raw = [];
        if (provider === 'openai-responses') raw = (payload?.output || []).filter(item => item?.type === 'function_call');
        else if (provider === 'claude') raw = (payload?.content || []).filter(item => item?.type === 'tool_use');
        else if (provider === 'gemini') raw = (payload?.candidates?.[0]?.content?.parts || []).map(item => item?.functionCall).filter(Boolean);
        else raw = payload?.choices?.[0]?.message?.tool_calls || [];
        return { text: String(text || ''), toolCalls: raw.map(callOf).filter(Boolean) };
    }
    const loop = {
        FUNCTION_SCHEMA, requestOptions, mapMessages, responseEnvelope,
        async search(args = {}, policy = {}, budget = null) {
            const query = root.searchPolicyPure?.safeSearchQuery?.(args.query) || '';
            if (!query) throw error('SEARCH_QUERY_INVALID', '搜索关键词无效');
            const candidates = root.searchRegistry?.select?.(policy) || [];
            if (!candidates.length) throw error('SEARCH_DISABLED', '未配置可用的联网检索服务');
            const strictEmpty = policy.mode === 'required' || policy.sourcePolicy === 'official-only';
            let lastError = null;
            let sawEmpty = false;
            for (const provider of candidates) {
                let attempt = null;
                try {
                    attempt = consumeBudget(budget, 'external', provider.id);
                    const evidence = await root.searchAdapters.search(provider, query, { policy });
                    if (Array.isArray(evidence) && evidence.length) {
                        finishAttempt(attempt, 'success');
                        return evidence;
                    }
                    sawEmpty = true;
                    finishAttempt(attempt, 'empty', 'SEARCH_NO_RESULTS');
                    if (!strictEmpty) return [];
                } catch (cause) {
                    if (String(cause?.code || '') === 'SEARCH_TOOL_LIMIT') throw cause;
                    lastError = cause;
                    finishAttempt(attempt, 'failed', String(cause?.code || 'SEARCH_NETWORK_ERROR'));
                }
            }
            if (lastError) throw lastError;
            if (sawEmpty && strictEmpty) throw error('SEARCH_NO_RESULTS', '未找到符合来源策略的检索结果');
            return [];
        },
        async executeTask({ effective = {}, messages = [], maxTokens = 2000, requestOpts = {}, disableNetworkSearch = false, hasImage = false, direct, requestModel, getEvidence, prepareExternalMessages } = {}) {
            if (typeof direct !== 'function') throw error('SEARCH_MODEL_REQUIRED', '模型调用器不可用');
            const policy = effective.network || { mode: 'off', execution: 'native-first', fallback: 'local-estimate' };
            const nativeSupported = root.searchRegistry?.nativeUsable?.(effective) === true;
            const externalAllowed = !disableNetworkSearch && policy.mode !== 'off' && policy.execution !== 'native-only'
                && (!hasImage || String(requestOpts.taskId || effective.taskId || '') === 'advice.vision');
            const strict = policy.mode === 'required' || policy.fallback === 'fail' || policy.fallback === 'ask-user';
            const requiresEvidence = !disableNetworkSearch && policy.mode !== 'off' && strict;
            const external = async () => {
                if (!externalAllowed || typeof requestModel !== 'function') throw error('SEARCH_DISABLED', '外部联网检索不可用');
                let toolMessages = messages;
                if (typeof prepareExternalMessages === 'function') {
                    try { toolMessages = await prepareExternalMessages(); }
                    catch (cause) { throw error('SEARCH_IMAGE_CONTEXT_FAILED', '无法从图片提取安全的检索上下文'); }
                }
                const result = await this.run({ messages: toolMessages, policy, requestModel, budget: requestOpts.searchBudget });
                return { text: result.text, evidence: result.evidence || [], external: true };
            };
            const tryExternal = async () => {
                try { return await external(); }
                catch (cause) {
                    // Keep native failover available for external-first.
                    if (strict && !(policy.execution === 'external-first' && nativeSupported && !disableNetworkSearch)) throw cause;
                    return null;
                }
            };
            const runDirect = async () => {
                requestOpts.disableNetworkSearch = disableNetworkSearch === true;
                const budget = requestOpts.searchBudget;
                let nativeAttempt = null;
                if (nativeSupported && !requestOpts.disableNativeSearch && !disableNetworkSearch && budget) {
                    nativeAttempt = consumeBudget(budget, 'native', effective.provider || '');
                    requestOpts.nativeSearchMaxUses = 1;
                }
                let text;
                try {
                    text = await direct();
                    finishAttempt(nativeAttempt, 'success');
                } catch (cause) {
                    finishAttempt(nativeAttempt, 'failed', String(cause?.code || 'AI_REQUEST_FAILED'));
                    throw cause;
                }
                const evidence = typeof getEvidence === 'function' ? getEvidence() : [];
                return { text, evidence, external: false };
            };
            const ensureEvidence = async (result) => {
                if (!requiresEvidence || (result.evidence || []).length) return result;
                if (externalAllowed && !result.external) {
                    const fallback = await tryExternal();
                    if (fallback) return fallback;
                }
                throw error('SEARCH_REQUIRED_UNSATISFIED', '本次任务要求联网检索，但未获得可用来源');
            };
            if (policy.mode !== 'off' && !disableNetworkSearch) {
                if (policy.execution === 'native-only' && !nativeSupported) {
                    if (strict) throw error('SEARCH_NATIVE_UNAVAILABLE', '当前模型不支持原生联网检索');
                    requestOpts.disableNativeSearch = true;
                } else if (policy.execution === 'native-first' && !nativeSupported) {
                    const result = await tryExternal();
                    if (result) return result;
                    requestOpts.disableNativeSearch = true;
                } else if (policy.execution === 'native-first' && nativeSupported) {
                    try {
                        return await ensureEvidence(await runDirect());
                    } catch (cause) {
                        if (String(cause?.code || '') === 'SEARCH_REQUIRED_UNSATISFIED') throw cause;
                        const result = await tryExternal();
                        if (result) return result;
                        throw cause;
                    }
                } else if (policy.execution === 'external-first' || policy.execution === 'external-only') {
                    const result = await tryExternal();
                    if (result) return result;
                    if (policy.execution === 'external-only' || !nativeSupported) {
                        requestOpts.disableNativeSearch = true;
                        if (strict) throw error('SEARCH_REQUIRED_UNSATISFIED', '本次任务要求联网检索，但未获得可用来源');
                    }
                    // external-first + native support falls through to native direct().
                }
            }
            return ensureEvidence(await runDirect());
        },
        async run({ requestModel, messages = [], policy = {}, maxToolCalls, maxResultChars, budget = null } = {}) {
            if (typeof requestModel !== 'function') throw error('SEARCH_MODEL_REQUIRED', '模型工具调用器不可用');
            const calls = Math.max(1, Math.min(2, Number(maxToolCalls || root.searchStore?.config?.networkDefaults?.maxToolCalls || 2)));
            const chars = Math.max(1000, Math.min(12000, Number(maxResultChars || root.searchStore?.config?.networkDefaults?.maxResultChars || 12000)));
            let current = [...messages];
            const audit = [];
            for (let index = 0; index <= calls; index += 1) {
                const response = await requestModel(current, { externalTools: [FUNCTION_SCHEMA], toolChoice: policy.mode === 'required' && index === 0 ? 'required' : 'auto' });
                const toolCalls = Array.isArray(response?.toolCalls) ? response.toolCalls : [];
                if (!toolCalls.length) {
                    if (policy.mode === 'required' && !audit.length) throw error('SEARCH_REQUIRED_UNSATISFIED', '本次任务要求联网检索，但模型未完成检索');
                    return { text: String(response?.text || ''), evidence: audit, searched: audit.length > 0 };
                }
                if (index >= calls) throw error('SEARCH_TOOL_LIMIT', '联网检索次数已达上限');
                const call = toolCalls[0];
                let evidence = [];
                let result;
                try { evidence = await this.search(call?.arguments || {}, policy, budget); result = { ok: true, evidence }; }
                catch (cause) { result = { ok: false, code: String(cause?.code || 'SEARCH_NETWORK_ERROR'), message: String(cause?.message || '联网检索失败') }; }
                audit.push(...evidence);
                current.push({ role: 'assistant', content: response?.text || '', toolCalls: [call] });
                current.push({ role: 'tool', toolCallId: String(call?.id || `search_${index}`), name: 'search_web', content: result.ok ? resultText(evidence, chars) : JSON.stringify(result) });
            }
            throw error('SEARCH_TOOL_LIMIT', '联网检索次数已达上限');
        }
    };
    root.searchToolLoop = loop;
})(window);
