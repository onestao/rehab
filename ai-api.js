// @ts-nocheck
Object.assign(ai, {
    FOOD_WRAPPER_KEYS: Object.freeze([
        'items', 'foods', 'foodItems', 'food_items', 'foodList', 'food_list',
        'results', 'result', 'data', 'list', '食物', '食物列表', '结果'
    ]),

    _effectiveConfigForRequest(opts = {}) {
        if (opts?.effective) return opts.effective;
        if (opts?.taskId && this.resolveTaskConfig) return this.resolveTaskConfig(opts.taskId, opts.routeOverride || null);
        const cfg = this.cfg || {};
        return this.getEffectiveConfig ? this.getEffectiveConfig() : { ...cfg, profileId: cfg.activeProfileId || '', apiKey: this.apiKeyFor?.(cfg.activeProfileId) || '' };
    },

    _reasoningRequestOptions(effective = {}, maxTokens = 0) {
        const helper = window.aiRoutingPure;
        if (!helper?.buildReasoningOptions) {
            return { params: {}, omitTemperature: false, maxOutputTokens: maxTokens, effectiveDepth: 'off' };
        }
        return helper.buildReasoningOptions({
            provider: effective.provider,
            model: effective.model,
            capabilities: effective.capabilities || {},
            reasoningDepth: effective.reasoningDepth || 'auto',
            maxOutputTokens: maxTokens
        });
    },

    _nativeSearchTool(effective = {}, requestOpts = {}) {
        const policy = effective.network || {};
        const capabilities = effective.capabilities || {};
        const supported = capabilities.webSearch === true || capabilities.web_search === true || capabilities.tools?.webSearch === true;
        if (requestOpts.disableNativeSearch || !requestOpts.allowNativeSearch || requestOpts.disableNetworkSearch || policy.mode === 'off' || !supported) return null;
        const domains = Array.isArray(policy.allowedDomains) ? policy.allowedDomains.slice(0, 20) : [];
        const provider = String(effective.provider || '').toLowerCase();
        if (provider === 'openai-responses') {
            return { type: 'web_search_preview', ...(domains.length ? { filters: { allowed_domains: domains } } : {}) };
        }
        if (provider === 'openai' || provider === 'openai-chat') {
            if (capabilities.nativeWebSearchChat !== true) return null;
            return { type: 'web_search_preview', ...(domains.length ? { filters: { allowed_domains: domains } } : {}) };
        }
        if (provider === 'claude') {
            return { type: 'web_search_20250305', name: 'web_search', max_uses: Math.min(2, Number(requestOpts.nativeSearchMaxUses || policy.maxToolCalls) || 2), ...(domains.length ? { allowed_domains: domains } : {}) };
        }
        if (provider === 'gemini') {
            // Gemini Google Search has no portable allow-list field. A task/global
            // allow-list is therefore a hard compatibility requirement.
            if (domains.length) return null;
            return { google_search: {} };
        }
        return null;
    },

    _emitNativeSearchEvidence(payload, effective, requestOpts = {}, cited = []) {
        if (typeof requestOpts.onSearchEvidence !== 'function') return;
        const existing = Array.isArray(requestOpts._nativeSearchEvidence) ? requestOpts._nativeSearchEvidence : [];
        const seen = new Set(existing.map(item => String(item?.url || item?.id || '')));
        const evidence = [...existing];
        const append = citation => {
            const source = window.searchPolicyPure?.classifySearchSource?.(citation?.url || citation?.uri || '') || { sourceType: 'other', official: false };
            const normalized = window.searchPolicyPure?.normalizeSearchEvidence?.({
                id: `native_${evidence.length}`, title: citation?.title || citation?.name || '', url: citation?.url || citation?.uri || '', snippet: citation?.snippet || '', providerId: 'native', retrievedAt: Date.now(), ...source
            }, { allowedDomains: effective.network?.allowedDomains || [] });
            if (!normalized) return;
            if (effective.network?.sourcePolicy === 'official-only' && !normalized.official) return;
            const key = String(normalized.url || normalized.id || '');
            if (key && seen.has(key)) return;
            if (key) seen.add(key);
            evidence.push(normalized);
        };
        for (const citation of cited) append(citation);
        for (const item of (payload?.output || [])) for (const content of (item?.content || [])) {
            for (const annotation of (content?.annotations || [])) {
                const citation = annotation?.url_citation || annotation;
                append(citation);
            }
        }
        requestOpts._nativeSearchEvidence = evidence;
        if (evidence.length) requestOpts.onSearchEvidence(evidence);
    },

    // Client inactivity budgets. Reasoning / Responses models often spend minutes
    // before the first token, and active streams refresh the timer on every chunk.
    MIN_AI_TIMEOUT_MS: 1000,
    MAX_AI_TIMEOUT_MS: 900000,
    DEFAULT_AI_TIMEOUT_MS: 300000,

    _resolveTimeoutMs(opts = {}, maxTokens = 2000) {
        const minMs = Number(this.MIN_AI_TIMEOUT_MS) || 1000;
        const maxMs = Number(this.MAX_AI_TIMEOUT_MS) || 300000;
        const explicit = Number(opts?.timeoutMs);
        if (Number.isFinite(explicit) && explicit > 0) {
            return Math.max(minMs, Math.min(maxMs, Math.floor(explicit)));
        }
        const configured = Number(this.cfg?.requestTimeoutMs);
        if (Number.isFinite(configured) && configured > 0) {
            return Math.max(minMs, Math.min(maxMs, Math.floor(configured)));
        }
        const tokens = Math.max(1, Number(maxTokens) || 2000);
        if (tokens >= 6000) return Math.min(maxMs, 420000);
        if (tokens >= 3500) return Math.min(maxMs, 360000);
        return Math.min(maxMs, Number(this.DEFAULT_AI_TIMEOUT_MS) || 300000);
    },

    _timeoutErrorMessage(wasTimeout, timeoutMs = 0) {
        const seconds = Math.max(1, Math.round((Number(timeoutMs) || 0) / 1000));
        const duration = seconds >= 120 && seconds % 60 === 0 ? `${seconds / 60} 分钟` : `${seconds} 秒`;
        return wasTimeout
            ? `AI 请求超时：客户端连续等待 ${duration} 后已停止。可在“我的 > AI 设置”延长最长等待时间，或换用更快模型后重试。`
            : 'AI 请求已取消';
    },

    async run(options = {}) {
        const taskId = options.taskId || 'advice.chat';
        const sequence = this.getTaskRequestSequence
            ? this.getTaskRequestSequence(taskId, options.routeOverride || null)
            : [this._effectiveConfigForRequest({ taskId, routeOverride: options.routeOverride })];
        let lastError = null;
        const withMeta = (text, effective, index, evidence = []) => {
            if (index > 0) window.toast?.show?.(`\u4e3b\u6a21\u578b\u4e0d\u53ef\u7528\uff0c\u5df2\u4f7f\u7528\u5907\u7528\u6a21\u578b ${effective.modelId || effective.model || ''}`, 'warning');
            return options.returnMeta ? {
                text,
                meta: {
                    taskId,
                    profileId: effective.profileId || '',
                    provider: effective.provider || '',
                    modelId: effective.modelId || effective.model || '',
                    reasoningDepth: effective.reasoningDepth || 'auto',
                    ...(evidence.length ? { searchEvidence: evidence } : {}),
                    fallback: { used: index > 0, index, mode: effective.route?.fallbackMode || 'manual' }
                }
            } : text;
        };
        for (let index = 0; index < sequence.length; index++) {
            const resolved = sequence[index];
            const networkOverride = options.networkPolicy && typeof options.networkPolicy === 'object'
                ? window.searchPolicyPure?.normalizeNetworkPolicy?.(options.networkPolicy, this.cfg?.networkDefaults || {})
                : null;
            const effective = networkOverride ? { ...resolved, network: networkOverride } : resolved;
            let emitted = false;
            let searchEvidence = [];
            const originalOnToken = options.onToken || (() => {});
            const requestOpts = {
                ...options,
                taskId,
                effective,
                allowNativeSearch: !options.disableNativeSearch
                    && options.disableNetworkSearch !== true
                    && effective.network?.mode !== 'off',
                disableNetworkSearch: options.disableNetworkSearch === true,
                onToken: (delta, accumulated, meta) => {
                    if (delta || accumulated) emitted = true;
                    return originalOnToken(delta, accumulated, meta);
                },
                onSearchEvidence: evidence => { searchEvidence = Array.isArray(evidence) ? evidence : []; }
            };
            try {
                const messages = options.messages || [];
                const maxTokens = options.maxTokens || 2000;
                const hasImage = !!options.imageFile || (Array.isArray(options.attachments) && options.attachments.some(item => item?.kind === 'image' && item.file));
                const direct = async () => {
                    if (options.imageFile) return this.callVisionTextImage(options.promptText || '', options.imageFile, maxTokens, options.systemText || '', requestOpts);
                    if (hasImage) return this.callAdviceWithAttachments(messages, options.attachments, options.maxTokens || 2400, requestOpts);
                    if (options.stream) return this.callStream(messages, maxTokens, requestOpts.onToken, requestOpts);
                    return this.call(messages, maxTokens, requestOpts);
                };
                const result = window.searchToolLoop?.executeTask
                    ? await window.searchToolLoop.executeTask({
                        effective, messages, maxTokens, requestOpts, hasImage,
                        disableNetworkSearch: options.disableNetworkSearch === true,
                        direct,
                        getEvidence: () => searchEvidence,
                        requestModel: (current, toolOptions) => this.call(current, maxTokens, {
                            ...requestOpts, ...toolOptions, allowNativeSearch: false, disableNativeSearch: true, returnToolEnvelope: true, stream: false
                        })
                    })
                    : { text: await direct(), evidence: searchEvidence, external: false };
                if (options.stream && result.external && result.text) requestOpts.onToken(result.text, result.text, { done: true });
                return withMeta(result.text, effective, index, result.evidence || []);
            } catch (error) {
                let exposedError = error;
                try {
                    if (error && typeof error === 'object') Object.defineProperty(error, 'aiFallback', {
                        value: undefined, writable: true, configurable: true, enumerable: true
                    });
                } catch {
                    exposedError = new Error(String(error?.message || '请求失败'));
                    exposedError.name = String(error?.name || 'Error');
                    if (typeof error?.code === 'string') exposedError.code = error.code;
                    if (Number.isFinite(Number(error?.status))) exposedError.status = Number(error.status);
                    if (typeof error?.finishReason === 'string') exposedError.finishReason = error.finishReason;
                    if (Number.isFinite(Number(error?.bodyLength))) exposedError.bodyLength = Number(error.bodyLength);
                }
                this._attachAiAttempt?.(exposedError, {
                    taskId,
                    profileId: effective.profileId || '',
                    modelId: effective.modelId || effective.model || '',
                    provider: effective.provider || '',
                    reasoningDepth: effective.reasoningDepth || ''
                });
                lastError = exposedError;
                const reasoningDepth = String(effective.reasoningDepth || 'auto');
                if (!['auto', 'off'].includes(reasoningDepth) && [400, 415, 422].includes(Number(exposedError?.status || 0))) {
                    exposedError.message = `${exposedError.message || '请求失败'}；当前模型可能不支持所选推理强度，请切换模型或改为自动/关闭`;
                }
                const retryable = window.aiRoutingPure?.isRetryableAiError?.(exposedError) === true;
                if (!retryable || emitted || index >= sequence.length - 1) {
                    const route = this.getTaskRoute?.(taskId) || {};
                    const target = retryable && !emitted && (route.fallbackMode || 'manual') === 'manual'
                        ? window.aiRoutingPure?.manualFallbackTarget?.(route.fallbacks?.[0])
                        : null;
                    if (target) exposedError.aiFallback = { taskId, target };
                    throw exposedError;
                }
                try { window.dispatchEvent(new CustomEvent('ai:route-fallback', { detail: { taskId, index, error: exposedError } })); } catch {}
            }
        }
        throw lastError || new Error('AI 请求失败');
    },

    runStream(taskId, messages, maxTokens, onToken = () => {}, options = {}) {
        return this.run({ ...options, taskId, messages, maxTokens, stream: true, onToken });
    },

    _assertCompleteAiResponse(provider, payload, options = {}) {
        if (!options.requireCompleteOutput) return;
        const pure = this._requireAiJsonPure();
        const classified = pure.classifyAiResponseCompletion(provider, payload, options);
        if (!classified) return;
        if (classified.kind === 'blocked') {
            throw this._makeAiError('AI 输出被内容安全策略拦截', {
                code: 'AI_OUTPUT_BLOCKED',
                finishReason: String(classified.finishReason || 'blocked')
            });
        }
        if (classified.kind === 'truncated') {
            throw this._makeAiError('AI 输出达到长度上限被截断', {
                code: 'AI_OUTPUT_TRUNCATED',
                finishReason: String(classified.finishReason || 'max_output_tokens'),
                outputLength: Number(classified.outputLength) || String(options.text || '').length
            });
        }
    },

    _attachAiAttempt(error, meta = {}) {
        if (!error || typeof error !== 'object') return error;
        try {
            const pure = window.aiJsonPure;
            const attempt = pure?.safeAiAttempt
                ? pure.safeAiAttempt({ ...(error.aiAttempt || {}), ...meta })
                : {
                    taskId: String(meta.taskId || error.aiAttempt?.taskId || ''),
                    profileId: String(meta.profileId || error.aiAttempt?.profileId || ''),
                    modelId: String(meta.modelId || meta.model || error.aiAttempt?.modelId || ''),
                    provider: String(meta.provider || error.aiAttempt?.provider || ''),
                    reasoningDepth: String(meta.reasoningDepth || error.aiAttempt?.reasoningDepth || '')
                };
            error.aiAttempt = attempt;
        } catch {}
        return error;
    },

    _isJsonFormatRetryable(error) {
        const pure = window.aiJsonPure;
        if (pure?.isJsonFormatRetryable) return pure.isJsonFormatRetryable(error);
        const code = String(error?.code || '');
        return code === 'AI_OUTPUT_TRUNCATED'
            || code === 'AI_JSON_PARSE_FAILED'
            || code === 'AI_JSON_SHAPE_MISMATCH';
    },

    _isAbortLikeAiError(error) {
        const pure = window.aiJsonPure;
        if (pure?.isAbortLikeError) return pure.isAbortLikeError(error);
        if (!error) return false;
        if (error.name === 'AbortError') return true;
        const code = String(error?.code || '');
        return code === 'AI_REQUEST_ABORTED' || code === 'AI_CANCELLED';
    },

    _withJsonRetryConstraint(messages, systemText, imageFile, attachments) {
        const constraint = [
            '上一次输出不完整或不是有效 JSON。请重新生成完整、精简的严格 JSON。',
            '只输出 JSON，不要 Markdown、分析过程或解释。',
            '必须闭合所有字符串、对象和数组，并且保留要求的必需字段。'
        ].join('\n');
        const hasVision = !!(imageFile || (Array.isArray(attachments) && attachments.some(item => item?.kind === 'image' && item.file)));
        if (hasVision) {
            return {
                messages,
                systemText: [String(systemText || '').trim(), constraint].filter(Boolean).join('\n')
            };
        }
        const next = Array.isArray(messages) ? messages.map(item => ({ ...item })) : [];
        const sysIndex = next.findIndex(item => item?.role === 'system');
        if (sysIndex >= 0) {
            next[sysIndex] = {
                ...next[sysIndex],
                content: [String(next[sysIndex].content || '').trim(), constraint].filter(Boolean).join('\n')
            };
        } else {
            next.unshift({ role: 'system', content: constraint });
        }
        return { messages: next, systemText };
    },

    async runJson(options = {}) {
        if (options.stream) throw this._makeAiError('runJson 不支持流式请求', { code: 'AI_JSON_STREAM_UNSUPPORTED' });
        const pure = window.aiJsonPure;
        const taskId = options.taskId || '';
        const maxTokens = Math.max(1, Number(options.maxTokens) || 2000);
        const parseOptions = options.parseOptions || {};
        const returnMeta = !!options.returnMeta;
        const searchBudget = options.searchBudget && typeof options.searchBudget === 'object'
            ? options.searchBudget
            : { remaining: 2 };
        let firstAttemptCode = '';
        let attemptMeta = null;
        let firstResult = null;

        const finalizeSuccess = (value, meta) => (returnMeta ? { value, meta } : value);
        const withAttempt = (error, meta) => this._attachAiAttempt(error, {
            taskId,
            profileId: meta?.profileId || attemptMeta?.profileId || '',
            modelId: meta?.modelId || meta?.model || attemptMeta?.modelId || attemptMeta?.model || '',
            provider: meta?.provider || attemptMeta?.provider || '',
            reasoningDepth: meta?.reasoningDepth || attemptMeta?.reasoningDepth || ''
        });

        const failAfterRetry = (error) => {
            const classification = pure?.classifySecondAttemptError
                ? pure.classifySecondAttemptError(error, firstAttemptCode)
                : { action: this._isAbortLikeAiError(error) ? 'abort' : (this._isJsonFormatRetryable(error) ? 'wrap' : 'passthrough'), code: String(error?.code || firstAttemptCode || 'AI_JSON_PARSE_FAILED') };

            if (classification.action === 'abort') {
                const existingCode = String(error?.code || '');
                const abortCode = (existingCode === 'AI_CANCELLED' || existingCode === 'AI_REQUEST_ABORTED')
                    ? existingCode
                    : 'AI_REQUEST_ABORTED';
                if (existingCode === 'AI_CANCELLED' || existingCode === 'AI_REQUEST_ABORTED') {
                    error.retryAttempted = true;
                    if (firstAttemptCode && !error.firstAttemptCode) error.firstAttemptCode = firstAttemptCode;
                    throw withAttempt(error, attemptMeta || error?.aiAttempt || {});
                }
                const aborted = this._makeAiError(String(error?.message || '请求已取消'), {
                    code: abortCode,
                    firstAttemptCode,
                    retryAttempted: true,
                    finishReason: String(error?.finishReason || '')
                });
                throw withAttempt(aborted, attemptMeta || error?.aiAttempt || {});
            }

            if (classification.action === 'passthrough') {
                error.retryAttempted = true;
                if (firstAttemptCode && !error.firstAttemptCode) error.firstAttemptCode = firstAttemptCode;
                throw withAttempt(error, attemptMeta || error?.aiAttempt || {});
            }

            const finalCode = String(classification.code || error?.code || firstAttemptCode || 'AI_JSON_PARSE_FAILED');
            const message = pure?.buildJsonRetryFailureMessage
                ? pure.buildJsonRetryFailureMessage(finalCode)
                : 'AI 重新生成后仍未返回有效 JSON，请切换支持 JSON 输出的模型。';
            const safeProps = pure?.buildSafeAiDiagnosticProps
                ? pure.buildSafeAiDiagnosticProps(error, {
                    code: finalCode,
                    firstAttemptCode,
                    retryAttempted: true,
                    finishReason: error?.finishReason || '',
                    aiAttempt: attemptMeta || error?.aiAttempt || {},
                    outputLength: error?.outputLength
                })
                : {
                    code: finalCode,
                    finishReason: String(error?.finishReason || ''),
                    firstAttemptCode,
                    retryAttempted: true,
                    aiAttempt: attemptMeta || error?.aiAttempt || {},
                    outputLength: error?.outputLength
                };
            throw this._makeAiError(message, safeProps);
        };

        try {
            firstResult = await this.run({
                taskId,
                messages: options.messages,
                promptText: options.promptText,
                systemText: options.systemText,
                imageFile: options.imageFile,
                attachments: options.attachments,
                maxTokens,
                routeOverride: options.routeOverride || null,
                signal: options.signal || null,
                timeoutMs: options.timeoutMs,
                onProgress: options.onProgress,
                returnMeta: true,
                requireCompleteOutput: true,
                disableNativeSearch: options.disableNativeSearch === true,
                disableNetworkSearch: options.disableNetworkSearch === true,
                searchBudget,
                stream: false
            });
            attemptMeta = firstResult.meta || null;
            const value = this._parseAiJsonPayload(firstResult.text, parseOptions);
            return finalizeSuccess(value, firstResult.meta);
        } catch (error) {
            firstAttemptCode = String(error?.code || '');
            if (!this._isJsonFormatRetryable(error)) throw error;
            if (firstResult?.meta) attemptMeta = firstResult.meta;
            else if (error?.aiAttempt?.profileId && error?.aiAttempt?.modelId) attemptMeta = error.aiAttempt;
            if (!attemptMeta?.profileId || !(attemptMeta.modelId || attemptMeta.model)) throw error;
        }

        if (options.signal?.aborted) {
            throw withAttempt(this._makeAiError('请求已取消', {
                code: 'AI_REQUEST_ABORTED',
                firstAttemptCode,
                retryAttempted: false
            }), attemptMeta);
        }

        const retryMaxTokens = Math.min(Math.max(maxTokens * 2, 4000), 8000);
        try {
            options.onRetry?.({
                attempt: 2,
                reasonCode: firstAttemptCode,
                modelId: attemptMeta.modelId || attemptMeta.model || '',
                maxTokens: retryMaxTokens
            });
        } catch {}

        const constrained = this._withJsonRetryConstraint(
            options.messages,
            options.systemText,
            options.imageFile,
            options.attachments
        );
        try {
            const retryResult = await this.run({
                taskId,
                messages: constrained.messages,
                promptText: options.promptText,
                systemText: constrained.systemText,
                imageFile: options.imageFile,
                attachments: options.attachments,
                maxTokens: retryMaxTokens,
                routeOverride: {
                    primary: {
                        profileId: attemptMeta.profileId,
                        modelId: attemptMeta.modelId || attemptMeta.model
                    },
                    reasoningDepth: 'off',
                    fallbackMode: 'manual',
                    fallbacks: []
                },
                signal: options.signal || null,
                timeoutMs: options.timeoutMs,
                onProgress: options.onProgress,
                returnMeta: true,
                requireCompleteOutput: true,
                disableNativeSearch: options.disableNativeSearch === true,
                disableNetworkSearch: options.disableNetworkSearch === true,
                searchBudget,
                stream: false
            });
            attemptMeta = retryResult.meta || attemptMeta;
            const value = this._parseAiJsonPayload(retryResult.text, parseOptions);
            return finalizeSuccess(value, retryResult.meta);
        } catch (error) {
            failAfterRetry(error);
        }
    },

    async verifyFoodEvidence(options = {}) {
        return window.foodEvidence?.verifyWithAi?.(options) || null;
    },

    // --- API Calls (统一入口，按 provider 分发) ---
    async call(messages, maxTokens = 2000, opts = {}) {
        const effective = this._effectiveConfigForRequest(opts);
        if (!effective.enabled) throw new Error('请先在设置中配置 AI 接口');
        const key = effective.apiKey;
        if (!key) throw new Error('请先在当前 AI 配置中填写 API Key');
        const provider = effective.provider || 'openai';
        const timeout = this._makeTimeoutSignal(opts.signal, this._resolveTimeoutMs(opts, maxTokens));
        try {
            timeout.signal.throwIfAborted?.();
            if (provider === 'claude')           return await this._callClaude(messages, maxTokens, key, false, null, effective, timeout.signal, opts);
            if (provider === 'openai-responses') return await this._callOpenAIResponses(messages, maxTokens, key, false, null, effective, timeout.signal, opts);
            if (provider === 'gemini')           return await this._callGemini(messages, maxTokens, key, false, null, effective, timeout.signal, opts);
            return await this._callOpenAIChat(messages, maxTokens, key, false, null, effective, timeout.signal, opts);
        } catch (e) {
            if (e?.name === 'AbortError') {
                const wasTimeout = timeout.wasTimeout();
                throw this._makeAiError(this._timeoutErrorMessage(wasTimeout, timeout.timeoutMs), {
                    code: wasTimeout ? 'AI_TIMEOUT' : 'AI_CANCELLED',
                    cause: e
                });
            }
            if (e instanceof TypeError) throw this._makeAiError(e.message || 'NETWORK_ERROR', { code: 'NETWORK_ERROR', cause: e });
            throw e;
        } finally {
            timeout.cleanup();
        }
    },

    // --- Vision Helpers ---
    async _blobToDataUrl(blob) {
        return await new Promise((resolve, reject) => {
            try {
                const reader = new FileReader();
                reader.onerror = () => reject(new Error('读取图片失败'));
                reader.onload = () => resolve(String(reader.result || ''));
                reader.readAsDataURL(blob);
            } catch (e) {
                reject(e);
            }
        });
    },

    _visionDebugEnabled() {
        return !!window.data?._dietPhotoDebug;
    },

    _debugDietPhoto(payload = {}) {
        if (!this._visionDebugEnabled()) return;
        try { console.debug('[diet-photo]', payload); } catch {}
    },

    _isHeicFile(file) {
        const type = String(file?.type || '').toLowerCase();
        const name = String(file?.name || '').toLowerCase();
        return type.includes('heic') || type.includes('heif') || /\.(heic|heif)$/i.test(name);
    },

    _isAvifFile(file) {
        const type = String(file?.type || '').toLowerCase();
        const name = String(file?.name || '').toLowerCase();
        return type.includes('avif') || /\.avif$/i.test(name);
    },

    _withJpegName(file) {
        const name = String(file?.name || 'diet-photo.heic').replace(/\.(heic|heif)$/i, '') || 'diet-photo';
        return `${name}.jpg`;
    },

    _makeAiError(message, props = {}) {
        const err = new Error(message);
        Object.assign(err, props);
        return err;
    },

    _requireAiJsonPure() {
        const pure = window.aiJsonPure;
        if (!pure) {
            throw this._makeAiError('AI JSON 运行时不可用，请刷新后重试。', {
                code: 'AI_JSON_RUNTIME_UNAVAILABLE'
            });
        }
        return pure;
    },

    _balancedJsonSpans(raw, open, close) {
        return this._requireAiJsonPure().balancedJsonSpans(raw, open, close);
    },

    _jsonTextCandidates(raw) {
        return this._requireAiJsonPure().jsonTextCandidates(raw);
    },

    _matchesAiJsonFieldType(value, type) {
        return this._requireAiJsonPure().matchesAiJsonFieldType(value, type);
    },

    _objectMatchesAiJsonShape(value, opts = {}) {
        return this._requireAiJsonPure().objectMatchesAiJsonShape(value, opts);
    },

    _coerceAiJsonPayload(value, opts = {}) {
        return this._requireAiJsonPure().coerceAiJsonPayload(value, opts);
    },

    _parseAiJsonPayload(raw, opts = {}) {
        const pure = this._requireAiJsonPure();
        const result = pure.parseAiJsonPayload(raw, opts);
        if (result?.ok) return result.value;
        throw this._makeAiError('AI 返回格式异常', {
            code: result?.code || 'AI_JSON_PARSE_FAILED',
            outputLength: Number(result?.outputLength) || String(raw || '').length
        });
    },

    _makeHttpAiError(status, body = '') {
        const statusNum = Number(status) || 0;
        const bodyLength = String(body ?? '').length;
        // Never attach raw provider response bodies (may contain secrets or health data).
        return this._makeAiError(`AI 请求失败: HTTP ${statusNum}`, {
            code: 'AI_HTTP_ERROR',
            status: statusNum,
            bodyLength
        });
    },

    _makeTimeoutSignal(externalSignal, timeoutMs = 300000) {
        const controller = new AbortController();
        let timedOut = false;
        let timer = null;
        const abortFromExternal = () => {
            try { controller.abort(externalSignal?.reason); } catch {}
        };
        if (externalSignal?.aborted) abortFromExternal();
        else externalSignal?.addEventListener?.('abort', abortFromExternal, { once: true });
        const resolved = this._resolveTimeoutMs
            ? this._resolveTimeoutMs({ timeoutMs }, 0)
            : Math.max(1000, Number(timeoutMs) || 300000);
        const arm = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                timedOut = true;
                try { controller.abort(); } catch {}
            }, resolved);
        };
        arm();
        return {
            signal: controller.signal,
            timeoutMs: resolved,
            wasTimeout: () => timedOut,
            refresh: () => {
                if (!timedOut && !controller.signal.aborted) arm();
            },
            cleanup: () => {
                clearTimeout(timer);
                externalSignal?.removeEventListener?.('abort', abortFromExternal);
            }
        };
    },

    async _loadImageBitmapLike(file) {
        if (typeof createImageBitmap === 'function') {
            return await createImageBitmap(file);
        }
        const url = URL.createObjectURL(file);
        try {
            const img = new Image();
            img.decoding = 'async';
            img.src = url;
            await img.decode();
            return img;
        } finally {
            URL.revokeObjectURL(url);
        }
    },

    async _canDecodeImage(file) {
        let bitmap;
        try {
            bitmap = await this._loadImageBitmapLike(file);
            return true;
        } catch {
            return false;
        } finally {
            try { bitmap?.close?.(); } catch {}
        }
    },

    async _ensureHeicDecoder() {
        if (typeof window.heic2any === 'function') return window.heic2any;
        await new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-heic2any]');
            if (existing) {
                existing.addEventListener('load', resolve, { once: true });
                existing.addEventListener('error', reject, { once: true });
                return;
            }
            const script = document.createElement('script');
            script.src = 'assets/heic2any.min.js';
            script.async = true;
            script.dataset.heic2any = 'true';
            script.onload = resolve;
            script.onerror = () => reject(this._makeAiError('HEIC_DECODE_FAILED', { code: 'HEIC_DECODE_FAILED' }));
            document.head.appendChild(script);
        });
        if (typeof window.heic2any !== 'function') throw this._makeAiError('HEIC_DECODE_FAILED', { code: 'HEIC_DECODE_FAILED' });
        return window.heic2any;
    },

    async _transcodeHeicToJpeg(file) {
        const started = performance.now?.() || Date.now();
        try {
            const heic2any = await this._ensureHeicDecoder();
            const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
            const blob = Array.isArray(converted) ? converted[0] : converted;
            if (!blob) throw new Error('empty converted image');
            const jpeg = new File([blob], this._withJpegName(file), { type: 'image/jpeg', lastModified: file?.lastModified || Date.now() });
            this._lastHeicTranscodeMeta = {
                heicTranscoded: true,
                transcodeMs: Math.round((performance.now?.() || Date.now()) - started),
                outputBytes: jpeg.size,
                outputType: jpeg.type,
                outputName: jpeg.name
            };
            return jpeg;
        } catch (e) {
            if (e?.code === 'HEIC_DECODE_FAILED') throw e;
            throw this._makeAiError('HEIC_DECODE_FAILED', { code: 'HEIC_DECODE_FAILED', cause: e });
        }
    },

    async preprocessVisionImageFile(file, opts = {}) {
        if (!file) throw new Error('缺少图片文件');
        const isHeic = this._isHeicFile(file);
        const isAvif = this._isAvifFile(file);
        this._lastHeicTranscodeMeta = { heicTranscoded: false };
        if (!isHeic) {
            if (isAvif) this._debugDietPhoto({ stage: 'avif_input', mime: file.type, bytes: file.size, name: file.name });
            return file;
        }
        opts.onProgress?.({ stage: 'heic' });
        if (await this._canDecodeImage(file)) return file;
        return await this._transcodeHeicToJpeg(file);
    },

    async _resizeImageBlob(file, maxDimension = 1024, outMime = 'image/jpeg', quality = 0.85) {
        if (typeof document === 'undefined') return file;
        if (!file) throw new Error('缺少图片文件');
        const safeMax = Math.max(256, Math.min(2048, Number(maxDimension) || 1024));
        const safeQuality = Math.max(0.5, Math.min(0.95, Number(quality) || 0.85));
        let bitmap;
        try {
            bitmap = await this._loadImageBitmapLike(file);
        } catch {
            this._lastResizeImageMeta = {
                resized: false,
                decodeFailed: true,
                inputBytes: file?.size || 0,
                inputType: file?.type || ''
            };
            return file;
        }
        try {
            const w = bitmap.width || bitmap.naturalWidth || 0;
            const h = bitmap.height || bitmap.naturalHeight || 0;
            if (!w || !h) return file;
            const scale = Math.min(1, safeMax / Math.max(w, h));
            const tw = Math.max(1, Math.round(w * scale));
            const th = Math.max(1, Math.round(h * scale));
            const canvas = document.createElement('canvas');
            canvas.width = tw;
            canvas.height = th;
            const ctx = canvas.getContext('2d', { alpha: false });
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(bitmap, 0, 0, tw, th);

            const blob = await new Promise(resolve => {
                try {
                    canvas.toBlob(b => resolve(b || null), outMime, safeQuality);
                } catch {
                    resolve(null);
                }
            });
            const output = blob || file;
            this._lastResizeImageMeta = {
                resized: !!blob,
                decodeFailed: false,
                inputWidth: w,
                inputHeight: h,
                outputWidth: tw,
                outputHeight: th,
                inputBytes: file?.size || 0,
                outputBytes: output?.size || 0,
                outputType: output?.type || file?.type || ''
            };
            return output;
        } finally {
            try { bitmap.close?.(); } catch {}
        }
    },

    async prepareVisionImage(file, opts = {}) {
        const original = file;
        const preprocessed = await this.preprocessVisionImageFile(file, opts);
        opts.onProgress?.({ stage: 'resize' });
        const resized = await this._resizeImageBlob(preprocessed, opts.maxDimension ?? 1024, opts.outMime ?? 'image/jpeg', opts.quality ?? 0.85);
        const dataUrl = await this._blobToDataUrl(resized);
        const base64 = (dataUrl.split(',')[1] || '').trim();
        const mimeType = resized?.type || opts.outMime || file?.type || 'image/jpeg';
        if (!base64) throw new Error('图片编码失败');
        this._debugDietPhoto({
            stage: 'prepared',
            originalMime: original?.type || '',
            originalBytes: original?.size || 0,
            originalName: original?.name || '',
            isHeic: this._isHeicFile(original),
            ...this._lastHeicTranscodeMeta,
            ...this._lastResizeImageMeta,
            payloadMime: mimeType,
            payloadBytes: resized?.size || 0
        });
        return { dataUrl, base64, mimeType, fileName: resized?.name || preprocessed?.name || original?.name || '' };
    },

    async callVisionTextImage(promptText, imageFile, maxTokens = 2000, systemText = '', opts = {}) {
        const effective = this._effectiveConfigForRequest(opts);
        if (!effective.enabled) throw new Error('请先在设置中配置 AI 接口');
        const key = effective.apiKey;
        if (!key) throw new Error('请先在当前 AI 配置中填写 API Key');
        const provider = effective.provider || 'openai';
        const timeout = this._makeTimeoutSignal(opts.signal, this._resolveTimeoutMs(opts, maxTokens));
        try {
            const img = await this.prepareVisionImage(imageFile, { maxDimension: 1024, outMime: 'image/jpeg', quality: 0.85, onProgress: opts.onProgress });
            timeout.signal.throwIfAborted?.();
            opts.onProgress?.({ stage: 'request' });
            if (provider === 'claude') return await this._callClaudeVision(promptText, img, maxTokens, key, effective, systemText, timeout.signal, opts);
            if (provider === 'openai-responses') return await this._callOpenAIResponsesVision(promptText, img, maxTokens, key, effective, systemText, timeout.signal, opts);
            if (provider === 'gemini') return await this._callGeminiVision(promptText, img, maxTokens, key, effective, systemText, timeout.signal, opts);
            return await this._callOpenAIChatVision(promptText, img, maxTokens, key, effective, systemText, timeout.signal, opts);
        } catch (e) {
            if (e?.name === 'AbortError') {
                const wasTimeout = timeout.wasTimeout();
                throw this._makeAiError(this._timeoutErrorMessage(wasTimeout, timeout.timeoutMs), { code: wasTimeout ? 'AI_TIMEOUT' : 'AI_CANCELLED', cause: e });
            }
            if (e instanceof TypeError) throw this._makeAiError(e.message || 'NETWORK_ERROR', { code: 'NETWORK_ERROR', cause: e });
            throw e;
        } finally {
            timeout.cleanup();
        }
    },

    async callAdviceWithAttachments(messages = [], attachments = [], maxTokens = 2400, opts = {}) {
        const images = (attachments || []).filter(att => att && att.kind === 'image' && att.file);
        if (!images.length) return this.call(messages, maxTokens, opts);
        const promptText = (messages || [])
            .filter(m => m.role !== 'system')
            .map(m => `${m.role === 'assistant' ? 'AI' : '用户'}：${m.content || ''}`)
            .join('\n\n');
        const systemText = (messages || [])
            .filter(m => m.role === 'system')
            .map(m => m.content || '')
            .join('\n\n');
        if (images.length > 1) {
            opts.onProgress?.({ stage: 'notice', message: '当前仅发送第一张图片，其余图片以附件说明进入问题上下文' });
        }
        return await this.callVisionTextImage(promptText, images[0].file, maxTokens, systemText, opts);
    },

    async callStream(messages, maxTokens = 2000, onToken = () => {}, opts = {}) {
        const effective = this._effectiveConfigForRequest(opts);
        if (!effective.enabled) throw new Error('请先在设置中配置 AI 接口');
        const key = effective.apiKey;
        if (!key) throw new Error('请先在当前 AI 配置中填写 API Key');
        const provider = effective.provider || 'openai';
        const timeout = this._makeTimeoutSignal(opts.signal, this._resolveTimeoutMs(opts, maxTokens));
        const onStreamToken = (...args) => {
            timeout.refresh?.();
            return onToken(...args);
        };
        try {
            timeout.signal.throwIfAborted?.();
            if (provider === 'claude')           return await this._callClaude(messages, maxTokens, key, true, onStreamToken, effective, timeout.signal, opts);
            if (provider === 'openai-responses') return await this._callOpenAIResponses(messages, maxTokens, key, true, onStreamToken, effective, timeout.signal, opts);
            if (provider === 'gemini')           return await this._callGemini(messages, maxTokens, key, true, onStreamToken, effective, timeout.signal, opts);
            return await this._callOpenAIChat(messages, maxTokens, key, true, onStreamToken, effective, timeout.signal, opts);
        } catch (e) {
            if (e?.name === 'AbortError' || timeout.signal?.aborted || opts.signal?.aborted) {
                const wasTimeout = timeout.wasTimeout();
                throw this._makeAiError(this._timeoutErrorMessage(wasTimeout, timeout.timeoutMs), {
                    code: wasTimeout ? 'AI_TIMEOUT' : 'AI_CANCELLED',
                    cause: e
                });
            }
            if (e instanceof TypeError) throw this._makeAiError(e.message || 'NETWORK_ERROR', { code: 'NETWORK_ERROR', cause: e });
            throw e;
        } finally {
            timeout.cleanup();
        }
    },

    async _callOpenAIChatVision(promptText, img, maxTokens, key, effective, systemText = '', signal = null, requestOpts = {}) {
        const url = `${effective.baseUrl}/chat/completions`;
        const messages = [
            ...(systemText ? [{ role: 'system', content: systemText }] : []),
            {
                role: 'user',
                content: [
                    { type: 'text', text: promptText },
                    { type: 'image_url', image_url: { url: img.dataUrl } }
                ]
            }
        ];
        const reasoning = this._reasoningRequestOptions(effective, maxTokens);
        const body = { model: effective.model, messages, max_tokens: reasoning.maxOutputTokens, ...reasoning.params };
        if (!reasoning.omitTemperature) body.temperature = 0.3;
        const nativeSearch = this._nativeSearchTool(effective, requestOpts);
        if (nativeSearch) body.tools = [nativeSearch];
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify(body),
            signal
        });
        this._debugDietPhoto({ stage: 'response', url, status: res.status });
        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            throw this._makeHttpAiError(res.status, txt);
        }
        const raw = await res.text();
        let d;
        try { d = JSON.parse(raw); } catch (e) { throw this._makeAiError('AI 返回格式异常', { code: 'AI_JSON_PARSE_FAILED', outputLength: String(raw || '').length }); }
        const text = d.choices?.[0]?.message?.content || '';
        this._assertCompleteAiResponse('openai', d, { requireCompleteOutput: requestOpts?.requireCompleteOutput, text });
        return text;
    },

    async _callOpenAIResponsesVision(promptText, img, maxTokens, key, effective, systemText = '', signal = null, requestOpts = {}) {
        const url = `${effective.baseUrl}/responses`;
        const reasoning = this._reasoningRequestOptions(effective, maxTokens);
        const body = {
            model: effective.model,
            input: [{
                role: 'user',
                content: [
                    { type: 'input_text', text: promptText },
                    { type: 'input_image', image_url: img.dataUrl }
                ]
            }],
            max_output_tokens: reasoning.maxOutputTokens,
            ...reasoning.params
        };
        if (!reasoning.omitTemperature) body.temperature = 0.3;
        if (systemText) body.instructions = systemText;
        const nativeSearch = this._nativeSearchTool(effective, requestOpts);
        if (nativeSearch) body.tools = [nativeSearch];
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify(body),
            signal
        });
        this._debugDietPhoto({ stage: 'response', url, status: res.status });
        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            throw this._makeHttpAiError(res.status, txt);
        }
        const raw = await res.text();
        let d;
        try { d = JSON.parse(raw); } catch (e) { throw this._makeAiError('AI 返回格式异常', { code: 'AI_JSON_PARSE_FAILED', outputLength: String(raw || '').length }); }
        let txt = '';
        if (d.output_text) txt = d.output_text;
        else {
            for (const item of (d.output || [])) {
                for (const c of (item.content || [])) {
                    if (c.type === 'output_text' || c.type === 'text') txt += c.text || '';
                }
            }
        }
        this._assertCompleteAiResponse('openai-responses', d, { requireCompleteOutput: requestOpts?.requireCompleteOutput, text: txt });
        this._emitNativeSearchEvidence(d, effective, requestOpts);
        return txt;
    },

    async _callClaudeVision(promptText, img, maxTokens, key, effective, systemText = '', signal = null, requestOpts = {}) {
        const url = `${effective.baseUrl}/messages`;
        const reasoning = this._reasoningRequestOptions(effective, maxTokens);
        const body = {
            model: effective.model,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: promptText },
                    { type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.base64 } }
                ]
            }],
            max_tokens: reasoning.maxOutputTokens,
            ...reasoning.params
        };
        if (!reasoning.omitTemperature) body.temperature = 0.3;
        if (systemText) body.system = systemText;
        const nativeSearch = this._nativeSearchTool(effective, requestOpts);
        if (nativeSearch) body.tools = [nativeSearch];
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify(body),
            signal
        });
        this._debugDietPhoto({ stage: 'response', url, status: res.status });
        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            throw this._makeHttpAiError(res.status, txt);
        }
        const raw = await res.text();
        let d;
        try { d = JSON.parse(raw); } catch (e) { throw this._makeAiError('AI 返回格式异常', { code: 'AI_JSON_PARSE_FAILED', outputLength: String(raw || '').length }); }
        const text = (d.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
        this._assertCompleteAiResponse('claude', d, { requireCompleteOutput: requestOpts?.requireCompleteOutput, text });
        this._emitNativeSearchEvidence(d, effective, requestOpts, (d.content || []).flatMap(item => item?.citations || []));
        return text;
    },

    async _callGeminiVision(promptText, img, maxTokens, key, effective, systemText = '', signal = null, requestOpts = {}) {
        const action = `generateContent?key=${key}`;
        const url = `${effective.baseUrl}/models/${effective.model}:${action}`;
        const contents = [{
            role: 'user',
            parts: [
                { text: promptText },
                { inline_data: { mime_type: img.mimeType, data: img.base64 } }
            ]
        }];
        const reasoning = this._reasoningRequestOptions(effective, maxTokens);
        const body = {
            contents,
            generationConfig: {
                maxOutputTokens: reasoning.maxOutputTokens,
                ...reasoning.params,
                ...(!reasoning.omitTemperature ? { temperature: 0.3 } : {})
            },
            ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {})
        };
        const nativeSearch = this._nativeSearchTool(effective, requestOpts);
        if (nativeSearch) body.tools = [nativeSearch];
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal
        });
        this._debugDietPhoto({ stage: 'response', url: url.replace(/key=[^&]+/i, 'key=***'), status: res.status });
        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            throw this._makeHttpAiError(res.status, txt);
        }
        const raw = await res.text();
        let d;
        try { d = JSON.parse(raw); } catch (e) { throw this._makeAiError('AI 返回格式异常', { code: 'AI_JSON_PARSE_FAILED', outputLength: String(raw || '').length }); }
        const text = d.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
        this._assertCompleteAiResponse('gemini', d, { requireCompleteOutput: requestOpts?.requireCompleteOutput, text });
        this._emitNativeSearchEvidence(d, effective, requestOpts, (d.candidates || []).flatMap(item => item?.groundingMetadata?.groundingChunks || []).map(chunk => chunk?.web || {}).filter(Boolean));
        return text;
    },

    // ---------- OpenAI Chat Completions ----------
    async _callOpenAIChat(messages, maxTokens, key, stream, onChunk, effective = this.getEffectiveConfig?.() || this.cfg, signal = null, requestOpts = {}) {
        const url = `${effective.baseUrl}/chat/completions`;
        const reasoning = this._reasoningRequestOptions(effective, maxTokens);
        const mappedMessages = window.searchToolLoop?.mapMessages?.('openai-chat', messages) || messages;
        const body = { model: effective.model, messages: mappedMessages, max_tokens: reasoning.maxOutputTokens, ...reasoning.params };
        if (!reasoning.omitTemperature) body.temperature = 0.3;
        const nativeSearch = this._nativeSearchTool(effective, requestOpts);
        if (nativeSearch) body.tools = [nativeSearch];
        Object.assign(body, window.searchToolLoop?.requestOptions?.('openai-chat', requestOpts) || {});
        if (stream) body.stream = true;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify(body),
            signal
        });
        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            throw this._makeHttpAiError(res.status, txt);
        }
        if (!stream) {
            const raw = await res.text();
            try {
                const d = JSON.parse(raw);
                const text = d.choices?.[0]?.message?.content || '';
                this._assertCompleteAiResponse('openai', d, { requireCompleteOutput: requestOpts?.requireCompleteOutput, text });
                this._emitNativeSearchEvidence(d, effective, requestOpts, d.choices?.[0]?.message?.annotations || []);
                if (requestOpts.returnToolEnvelope) return window.searchToolLoop?.responseEnvelope?.('openai-chat', d, text) || { text, toolCalls: [] };
                return text;
            } catch (e) {
                if (e?.code === 'AI_OUTPUT_TRUNCATED' || e?.code === 'AI_OUTPUT_BLOCKED') throw e;
                let content = '';
                const parts = raw.split(/\r?\n/);
                for (const line of parts) {
                    if (!line.startsWith('data:')) continue;
                    const payload = line.slice(5).trim();
                    if (!payload || payload === '[DONE]') continue;
                    try {
                        const json = JSON.parse(payload);
                        content += json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content ?? '';
                    } catch {}
                }
                if (content) return content;
                throw new Error('AI 返回格式异常');
            }
        }
         return this._readSSE(res, onChunk,
              (json) => {
                  const choice = json.choices?.[0] || {};
                  const cited = choice.delta?.annotations || choice.message?.annotations || [];
                  if (cited.length) this._emitNativeSearchEvidence(json, effective, requestOpts, cited);
                  return choice.delta?.content ?? choice.message?.content ?? '';
              },
              (json) => {
                  const usage = json.usage ? { in: Number(json.usage.prompt_tokens || 0), out: Number(json.usage.completion_tokens || 0) } : null;
                  const finishReason = json.choices?.[0]?.finish_reason || '';
                  return usage || finishReason ? { usage, finishReason } : null;
              },
              signal
          );
    },

    // ---------- OpenAI Responses API（最新 /v1/responses） ----------
    async _callOpenAIResponses(messages, maxTokens, key, stream, onChunk, effective = this.getEffectiveConfig?.() || this.cfg, signal = null, requestOpts = {}) {
        const url = `${effective.baseUrl}/responses`;
        const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
        const sourceInput = messages.filter(m => m.role !== 'system');
        const input = window.searchToolLoop?.mapMessages?.('openai-responses', sourceInput) || sourceInput.map(m => ({
            role: m.role, content: [{ type: m.role === 'assistant' ? 'output_text' : 'input_text', text: m.content }]
        }));
        const reasoning = this._reasoningRequestOptions(effective, maxTokens);
        const body = {
            model: effective.model,
            input,
            max_output_tokens: reasoning.maxOutputTokens,
            ...reasoning.params
        };
        if (!reasoning.omitTemperature) body.temperature = 0.3;
        if (sys) body.instructions = sys;
        const nativeSearch = this._nativeSearchTool(effective, requestOpts);
        if (nativeSearch) body.tools = [nativeSearch];
        Object.assign(body, window.searchToolLoop?.requestOptions?.('openai-responses', requestOpts) || {});
        if (stream) body.stream = true;

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify(body),
            signal
        });
        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            throw this._makeHttpAiError(res.status, txt);
        }
        if (!stream) {
            const d = await res.json();
            let txt = '';
            if (d.output_text) txt = d.output_text;
            else {
                for (const item of (d.output || [])) {
                    for (const c of (item.content || [])) {
                        if (c.type === 'output_text' || c.type === 'text') txt += c.text || '';
                    }
                }
            }
            this._assertCompleteAiResponse('openai-responses', d, { requireCompleteOutput: requestOpts?.requireCompleteOutput, text: txt });
            this._emitNativeSearchEvidence(d, effective, requestOpts);
            if (requestOpts.returnToolEnvelope) return window.searchToolLoop?.responseEnvelope?.('openai-responses', d, txt) || { text: txt, toolCalls: [] };
            return txt;
        }
          return this._readSSE(res, onChunk, (json) => {
              if (json.type === 'response.output_text.delta') return json.delta || '';
              return '';
          }, (json) => {
             const response = json.response || null;
             const finishReason = response?.incomplete_details?.reason || (response?.status && response.status !== 'completed' ? response.status : '') || '';
             if (json.type === 'response.completed') {
                 this._emitNativeSearchEvidence(response || json, effective, requestOpts);
                 if (response?.usage) {
                     const u = response.usage;
                     return { usage: { in: Number(u.input_tokens || 0), out: Number(u.output_tokens || 0) }, finishReason };
                 }
             }
             if (finishReason) return { finishReason };
              return null;
          }, signal);
    },

    // ---------- Anthropic Claude Messages API ----------
    async _callClaude(messages, maxTokens, key, stream, onChunk, effective = this.getEffectiveConfig?.() || this.cfg, signal = null, requestOpts = {}) {
        const url = `${effective.baseUrl}/messages`;
        const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
        const sourceMessages = messages.filter(m => m.role !== 'system');
        const msgs = window.searchToolLoop?.mapMessages?.('claude', sourceMessages) || sourceMessages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
        const reasoning = this._reasoningRequestOptions(effective, maxTokens);
        const body = {
            model: effective.model,
            messages: msgs,
            max_tokens: reasoning.maxOutputTokens,
            ...reasoning.params
        };
        if (!reasoning.omitTemperature) body.temperature = 0.3;
        if (sys) body.system = sys;
        const nativeSearch = this._nativeSearchTool(effective, requestOpts);
        if (nativeSearch) body.tools = [nativeSearch];
        Object.assign(body, window.searchToolLoop?.requestOptions?.('claude', requestOpts) || {});
        if (stream) body.stream = true;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify(body),
            signal
        });
        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            throw this._makeHttpAiError(res.status, txt);
        }
        if (!stream) {
            const d = await res.json();
            const text = (d.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
            this._assertCompleteAiResponse('claude', d, { requireCompleteOutput: requestOpts?.requireCompleteOutput, text });
            this._emitNativeSearchEvidence(d, effective, requestOpts, (d.content || []).flatMap(item => item?.citations || []));
            if (requestOpts.returnToolEnvelope) return window.searchToolLoop?.responseEnvelope?.('claude', d, text) || { text, toolCalls: [] };
            return text;
        }
          return this._readSSE(res, onChunk, (json) => {
              if (json.type === 'content_block_start' && json.content_block?.type === 'text' && Array.isArray(json.content_block?.citations)) {
                  this._emitNativeSearchEvidence(null, effective, requestOpts, json.content_block.citations);
              }
              if (json.type === 'content_block_delta' && json.delta?.type === 'citations_delta' && json.delta?.citation) {
                  this._emitNativeSearchEvidence(null, effective, requestOpts, [json.delta.citation]);
              }
              if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
                  if (Array.isArray(json.delta?.citations)) this._emitNativeSearchEvidence(null, effective, requestOpts, json.delta.citations);
                  return json.delta.text || '';
              }
             return '';
         }, (json) => {
             const finishReason = json.delta?.stop_reason || json.stop_reason || '';
             if (json.type === 'message_delta' && json.usage) {
                 return { usage: { in: Number(json.usage.input_tokens || 0), out: Number(json.usage.output_tokens || 0) }, finishReason };
             }
             if (finishReason) return { finishReason };
              return null;
          }, signal);
    },

    // ---------- Gemini ----------
    async _callGemini(messages, maxTokens, key, stream, onChunk, effective = this.getEffectiveConfig?.() || this.cfg, signal = null, requestOpts = {}) {
        const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
        const sourceContents = messages.filter(m => m.role !== 'system');
        const contents = window.searchToolLoop?.mapMessages?.('gemini', sourceContents) || sourceContents.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
        const action = stream ? `streamGenerateContent?alt=sse&key=${key}` : `generateContent?key=${key}`;
        const url = `${effective.baseUrl}/models/${effective.model}:${action}`;
        const reasoning = this._reasoningRequestOptions(effective, maxTokens);
        const body = {
            contents,
            generationConfig: {
                maxOutputTokens: reasoning.maxOutputTokens,
                ...reasoning.params,
                ...(!reasoning.omitTemperature ? { temperature: 0.3 } : {})
            },
            ...(sys ? { systemInstruction: { parts: [{ text: sys }] } } : {})
        };
        const nativeSearch = this._nativeSearchTool(effective, requestOpts);
        if (nativeSearch) body.tools = [nativeSearch];
        Object.assign(body, window.searchToolLoop?.requestOptions?.('gemini', requestOpts) || {});
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal
        });
        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            throw this._makeHttpAiError(res.status, txt);
        }
        if (!stream) {
            const d = await res.json();
            const text = d.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
            this._assertCompleteAiResponse('gemini', d, { requireCompleteOutput: requestOpts?.requireCompleteOutput, text });
            this._emitNativeSearchEvidence(d, effective, requestOpts, (d.candidates || []).flatMap(item => item?.groundingMetadata?.groundingChunks || []).map(chunk => chunk?.web || {}).filter(Boolean));
            if (requestOpts.returnToolEnvelope) return window.searchToolLoop?.responseEnvelope?.('gemini', d, text) || { text, toolCalls: [] };
            return text;
        }
          return this._readSSE(res, onChunk,
              (json) => {
                  const cited = (json.candidates || []).flatMap(item => item?.groundingMetadata?.groundingChunks || []).map(chunk => chunk?.web || {}).filter(Boolean);
                  if (cited.length) this._emitNativeSearchEvidence(json, effective, requestOpts, cited);
                  return json.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
              },
              (json) => {
                 const meta = json.usageMetadata || null;
                 const finishReason = json.candidates?.[0]?.finishReason || '';
                 const usage = meta ? {
                     in: Number(meta.promptTokenCount || 0),
                     out: Number(meta.candidatesTokenCount || meta.totalTokenCount || 0)
                 } : null;
                 return usage || finishReason ? { usage, finishReason } : null;
              },
              signal
          );
    },

    // ---------- 通用 SSE 读取 ----------
    async _readSSE(res, onChunk, extract, extractUsage = null, signal = null) {
        if (!res.body) {
            signal?.throwIfAborted?.();
            const text = await res.text();
            signal?.throwIfAborted?.();
            try {
                const d = JSON.parse(text);
                const t = extract(d);
                if (t) onChunk(t, t);
                return t;
            } catch { return ''; }
        }
         const reader = res.body.getReader();
         const cancelReader = () => {
             try { reader.cancel(signal?.reason).catch?.(() => {}); } catch {}
         };
         if (signal?.aborted) cancelReader();
         else signal?.addEventListener?.('abort', cancelReader, { once: true });
         const decoder = new TextDecoder('utf-8');
         let buffer = '', full = '';
         let lastMeta = null;
         const normalizeMeta = (raw) => {
             if (!raw) return null;
             const meta = {};
             const usage = raw.usage || ((raw.in || raw.out) ? raw : null);
             if (usage && (usage.in || usage.out)) {
                 meta.usage = { in: Number(usage.in || 0), out: Number(usage.out || 0) };
             }
             if (raw.finishReason) meta.finishReason = String(raw.finishReason);
             if (raw.done) meta.done = true;
             return Object.keys(meta).length ? meta : null;
         };
         const flush = (chunk) => {
             const parts = chunk.split(/\r?\n/).filter(Boolean);
             for (const part of parts) {
                 if (!part.startsWith('data:')) continue;
                 const payload = part.slice(5).trim();
                 if (!payload || payload === '[DONE]') continue;
                 try {
                     const json = JSON.parse(payload);
                     if (extractUsage) {
                         const meta = normalizeMeta(extractUsage(json));
                         if (meta) {
                             lastMeta = { ...(lastMeta || {}), ...meta };
                             onChunk('', full, meta);
                         }
                     }
                     const delta = extract(json);
                     if (!delta) continue;
                     full += delta;
                     onChunk(delta, full, lastMeta ? { ...lastMeta } : undefined);
                 } catch {}
             }
         };
        try {
            while (true) {
                signal?.throwIfAborted?.();
                const { value, done } = await reader.read();
                signal?.throwIfAborted?.();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const events = buffer.split(/\r?\n\r?\n/);
                buffer = events.pop() || '';
                for (const event of events) flush(event);
            }
        } finally {
            signal?.removeEventListener?.('abort', cancelReader);
        }
         if (buffer) flush(buffer);
         if (lastMeta) {
             try { onChunk('', full, { ...lastMeta, done: true }); } catch {}
         }
         return full;
    },

    async parseFood(text, opts = {}) {
        const tpl = window.dataAiTemplates;
        const prefResult = tpl?.buildPromptMessages('food_parse_text', { text: text }, window.data?.db) || {};
        const sysMsg = prefResult.messages?.find(m => m.role === 'system')?.content || '你是营养师助手，只返回纯 JSON 数组，不要 markdown，不要解释。';
        const userMsg = prefResult.messages?.find(m => m.role === 'user')?.content || `用户描述：${text}`;
        const messages = [
            { role: 'system', content: sysMsg },
            { role: 'user', content: userMsg }
        ];
        if (typeof this.runJson === 'function') {
            return this.runJson({
                taskId: 'food.text',
                messages,
                maxTokens: 2000,
                disableNetworkSearch: true,
                routeOverride: opts?.routeOverride || null,
                parseOptions: {
                    expected: 'array',
                    wrapperKeys: this.FOOD_WRAPPER_KEYS
                },
                onRetry: opts.onRetry
            });
        }
        const raw = this.resolveTaskConfig ? await this.run({
            taskId: 'food.text',
            messages,
            maxTokens: 2000,
            disableNetworkSearch: true,
            routeOverride: opts?.routeOverride || null
        }) : await this.call(messages, 2000);
        return this._parseAiJsonPayload(raw, {
            expected: 'array',
            wrapperKeys: this.FOOD_WRAPPER_KEYS
        });
    },

    _visionFailureCacheKey() {
        return 'rehab_diet_photo_vision_failures';
    },

    _visionFailureCacheId(provider, model) {
        return `${String(provider || '').toLowerCase()}::${String(model || '').toLowerCase()}`;
    },

    _readVisionFailureCache() {
        try {
            const raw = localStorage.getItem(this._visionFailureCacheKey());
            const parsed = raw ? JSON.parse(raw) : {};
            const now = Date.now();
            Object.keys(parsed).forEach(key => {
                if (!parsed[key]?.expiresAt || parsed[key].expiresAt <= now) delete parsed[key];
            });
            return parsed;
        } catch {
            return {};
        }
    },

    getVisionFailure(provider, model) {
        const cache = this._readVisionFailureCache();
        return cache[this._visionFailureCacheId(provider, model)] || null;
    },

    markVisionFailure(provider, model, reason) {
        const cache = this._readVisionFailureCache();
        cache[this._visionFailureCacheId(provider, model)] = {
            reason: String(reason || '当前模型可能不支持图片').slice(0, 80),
            at: Date.now(),
            expiresAt: Date.now() + 24 * 60 * 60 * 1000
        };
        try { localStorage.setItem(this._visionFailureCacheKey(), JSON.stringify(cache)); } catch {}
    },

    clearVisionFailure(provider, model) {
        const cache = this._readVisionFailureCache();
        delete cache[this._visionFailureCacheId(provider, model)];
        try { localStorage.setItem(this._visionFailureCacheKey(), JSON.stringify(cache)); } catch {}
    },

    async parseFoodFromImage(file, opts = {}) {
        const tpl = window.dataAiTemplates;
        const prefResult = tpl?.buildPromptMessages('food_parse_image', {}, window.data?.db) || {};
        const sysMsg = prefResult.messages?.find(m => m.role === 'system')?.content || '你是营养师助手，只返回纯 JSON 数组，不要 markdown，不要解释。';
        const prompt = prefResult.messages?.find(m => m.role === 'user')?.content || `你是营养师助手。用户给出了一张"这顿饭/食物"的照片。请你根据图片内容识别食物，并严格只返回 JSON 数组，不要其他文字。\n每个元素必须包含核心字段 name、grams、cal、pro、carb、fat，不能省略；这些字段的值必须是数字，即使为 0 也必须明确输出。格式：{"name":"食物名","grams":克数,"cal":热量kcal,"pro":蛋白质g,"carb":碳水g,"fat":脂肪g,"fiber":膳食纤维g,"sugar":糖g,"sodium":钠mg,"saturatedFat":饱和脂肪g,"ingredients":["主要配料"],"cooking":"烹饪方式","source":"估算依据","confidence":0-100,"note":"健康性备注"}\n要求：\n- 如果无法判断克数，请用常见份量估算；\n- 热量可按蛋白质、碳水和脂肪计算，但不要省略 cal；\n- fiber/sugar/sodium/saturatedFat/ingredients/cooking/source/confidence/note 可根据可见信息合理填写，无法判断时使用 0、空数组或空字符串；\n- 如果图片中看不清或不确定，请不要编造，返回空数组 [] 或减少条目；\n- 不要输出 markdown、不要解释。`;
        if (typeof this.runJson === 'function') {
            opts.onProgress?.({ stage: 'request' });
            const result = await this.runJson({
                taskId: 'food.vision',
                promptText: prompt,
                systemText: sysMsg,
                imageFile: file,
                maxTokens: 2000,
                disableNetworkSearch: true,
                routeOverride: opts?.routeOverride || null,
                signal: opts?.signal || null,
                timeoutMs: opts?.timeoutMs,
                parseOptions: {
                    expected: 'array',
                    wrapperKeys: this.FOOD_WRAPPER_KEYS
                },
                returnMeta: true,
                onRetry: info => {
                    opts.onProgress?.({
                        stage: 'retry',
                        ...info
                    });
                }
            });
            if (result?.meta) opts.onResolvedMeta?.(result.meta);
            opts.onProgress?.({ stage: 'parse' });
            return result?.value;
        }
        const result = this.resolveTaskConfig
            ? await this.run({ ...opts, taskId: 'food.vision', promptText: prompt, imageFile: file, systemText: sysMsg, maxTokens: 2000, disableNetworkSearch: true, returnMeta: true })
            : await this.callVisionTextImage(prompt, file, 2000, sysMsg, opts);
        const raw = result && typeof result === 'object' && typeof result.text === 'string' ? result.text : result;
        if (result?.meta) opts.onResolvedMeta?.(result.meta);
        opts.onProgress?.({ stage: 'parse' });
        try {
            return this._parseAiJsonPayload(raw, {
                expected: 'array',
                wrapperKeys: this.FOOD_WRAPPER_KEYS
            });
        } catch (e) {
            console.warn('AI 返回格式异常:', String(raw || '').slice(0, 80));
            throw e;
        }
    },

    async weightLossPlan(params, options = {}) {
        return this.bodyGoalPlan({ ...params, goalType: 'loss' }, options);
    },

    async bodyGoalPlan(params, options = {}) {
        const { goalType = 'loss', currentWeight, targetWeight, activityLevel, dailyTrainMin, height, weeklyFreq, intensity, sportType, experience, gender = 'male', age = 30 } = params;
        const routeOverride = window.aiRoutingPure?.manualFallbackTarget?.(options?.routeOverride) || null;
        const isGain = goalType === 'gain';
        const diff = isGain ? (targetWeight - currentWeight) : (currentWeight - targetWeight);
        const activityMap = {
            sedentary: '久坐：办公/学习为主，少于5000步/日',
            light: '轻度活动：少量走动，5000-8000步/日',
            moderate: '中等活动：经常走动或站立，8000-12000步/日',
            active: '高强度活动：体力劳动或超过12000步/日'
        };
        const intensityMap = {
            light: '低强度：轻松，可完整说话',
            moderate: '中等强度：明显出汗，可短句交流',
            vigorous: '高强度：很喘，难以连续说话'
        };
        const sportMap = { strength: '力量训练', cardio: '有氧运动', mixed: '力量+有氧混合', flexibility: '拉伸/瑜伽' };
        const experienceMap = {
            beginner: '新手：系统力量训练少于6个月',
            intermediate: '中级：规律训练6个月-2年',
            advanced: '高级：规律训练超过2年，有周期化经验'
        };
        const tpl = window.dataAiTemplates;
        const taskId = isGain ? 'body_goal_plan' : 'body_goal_plan';
        const prefResult = tpl?.buildPromptMessages(taskId, {}, window.data?.db) || {};
        const prefTags = prefResult.prefTags || '';
        const sysMsg = prefResult.messages?.find(m => m.role === 'system')?.content || '你是运动营养师，只返回纯 JSON，不要 markdown，不要解释。';
        const healthContext = [
            Array.isArray(params.conditions) && params.conditions.length ? `诊断结果/禁忌:${JSON.stringify(params.conditions)}` : '',
            Array.isArray(params.examResults) && params.examResults.length ? `检查结果:${JSON.stringify(params.examResults)}` : '',
            Array.isArray(params.allergies) && params.allergies.length ? `过敏/不耐受:${params.allergies.join('、')}` : ''
        ].filter(Boolean).join('\n');
        const healthPrompt = healthContext ? `\n健康档案（必须参考，检查结果可细化潦草诊断；如缺少诊断则按检查结果保守规避风险）：\n${healthContext}` : '';
        let prompt;
        if (isGain) {
            prompt = `你是运动营养师。请为用户制定增肌计划。\n用户信息：\n- 当前体重：${currentWeight} kg\n- 目标体重：${targetWeight} kg（需增 ${diff.toFixed(2)} kg）\n- 身高：${height || '未知'} cm\n- 日常活动水平：${activityMap[activityLevel] || activityLevel}\n- 每次运动时间：${dailyTrainMin} 分钟\n- 每周运动次数：${weeklyFreq} 次\n- 运动强度：${intensityMap[intensity] || intensity}\n- 主要运动项目：${sportMap[sportType] || sportType}\n- 训练经验：${experienceMap[experience] || experience || '未知'}
- 用户性别：${gender === 'female' ? '女' : '男'}，年龄：${age} 岁。${tpl?.buildFormulaTag?.(prefResult.prefs?.formulaPreference || 'mifflin_st_jeor') || '请使用 Mifflin-St Jeor 公式计算 BMR 和 TDEE'}\n\n${prefTags ? prefTags + '\n' : ''}请严格只返回如下 JSON，不要其他文字：\n{\n  "conservative": { "days": 天数, "weeklyChange": 每周增重kg, "dailyCal": 建议每日摄入kcal, "calorieDelta": 每日热量盈余kcal, "proteinGoal": 蛋白质目标g, "carbGoal": 碳水目标g, "fatGoal": 脂肪目标g, "desc": "一句话说明" },\n  "moderate": { "days": 天数, "weeklyChange": 每周增重kg, "dailyCal": 建议每日摄入kcal, "calorieDelta": 每日热量盈余kcal, "proteinGoal": 蛋白质目标g, "carbGoal": 碳水目标g, "fatGoal": 脂肪目标g, "desc": "一句话说明" },\n  "aggressive": { "days": 天数, "weeklyChange": 每周增重kg, "dailyCal": 建议每日摄入kcal, "calorieDelta": 每日热量盈余kcal, "proteinGoal": 蛋白质目标g, "carbGoal": 碳水目标g, "fatGoal": 脂肪目标g, "desc": "一句话说明" },\n  "tips": ["建议1", "建议2", "建议3"]\n}`;
        } else {
            prompt = `你是运动营养师。请为用户制定减重计划。\n用户信息：\n- 当前体重：${currentWeight} kg\n- 目标体重：${targetWeight} kg（需减 ${diff.toFixed(2)} kg）\n- 身高：${height || '未知'} cm\n- 日常活动水平：${activityMap[activityLevel] || activityLevel}\n- 每次运动时间：${dailyTrainMin} 分钟\n- 每周运动次数：${weeklyFreq} 次\n- 运动强度：${intensityMap[intensity] || intensity}\n- 主要运动项目：${sportMap[sportType] || sportType}\n- 用户性别：${gender === 'female' ? '女' : '男'}，年龄：${age} 岁。${tpl?.buildFormulaTag?.(prefResult.prefs?.formulaPreference || 'mifflin_st_jeor') || '请使用 Mifflin-St Jeor 公式计算 BMR 和 TDEE'}\n\n${prefTags ? prefTags + '\n' : ''}请严格只返回如下 JSON，不要其他文字：\n{\n  "fast": { "days": 天数, "weeklyLoss": 每周减重kg, "dailyCal": 建议每日摄入kcal, "deficit": 每日热量缺口kcal, "proteinGoal": 蛋白质目标g, "carbGoal": 碳水目标g, "fatGoal": 脂肪目标g, "desc": "一句话说明" },\n  "moderate": { "days": 天数, "weeklyLoss": 每周减重kg, "dailyCal": 建议每日摄入kcal, "deficit": 每日热量缺口kcal, "proteinGoal": 蛋白质目标g, "carbGoal": 碳水目标g, "fatGoal": 脂肪目标g, "desc": "一句话说明" },\n  "slow": { "days": 天数, "weeklyLoss": 每周减重kg, "dailyCal": 建议每日摄入kcal, "deficit": 每日热量缺口kcal, "proteinGoal": 蛋白质目标g, "carbGoal": 碳水目标g, "fatGoal": 脂肪目标g, "desc": "一句话说明" },\n  "tips": ["建议1", "建议2", "建议3"]\n}`;
        }
        if (healthPrompt) prompt = prompt.replace('\n\n请严格只返回', `${healthPrompt}\n\n请严格只返回`);
        if (healthPrompt && prefTags) prompt = prompt.replace(`\n\n${prefTags}\n`, `${healthPrompt}\n\n${prefTags}\n`);
        const messages = [
            { role: 'system', content: sysMsg },
            { role: 'user', content: prompt }
        ];
        const paceKeys = isGain
            ? ['conservative', 'moderate', 'aggressive']
            : ['fast', 'moderate', 'slow'];
        const parseOptions = {
            expected: 'object',
            requiredKeys: [...paceKeys, 'tips'],
            fieldTypes: Object.fromEntries([...paceKeys.map(k => [k, 'object']), ['tips', 'array']])
        };
        const attachGoalFallback = (error) => {
            if (!error || typeof error !== 'object' || error.aiFallback) return error;
            const route = routeOverride ? null : this.getTaskRoute?.('goal.body');
            const target = (route?.fallbackMode || 'manual') === 'manual'
                ? window.aiRoutingPure?.manualFallbackTarget?.(route?.fallbacks?.[0])
                : null;
            if (target) error.aiFallback = { taskId: 'goal.body', target };
            return error;
        };
        try {
            if (typeof this.runJson === 'function') {
                return await this.runJson({
                    taskId: 'goal.body',
                    messages,
                    maxTokens: 2600,
                    routeOverride,
                    parseOptions
                });
            }
            const raw = this.resolveTaskConfig ? await this.run({
                taskId: 'goal.body',
                messages,
                maxTokens: 2600,
                routeOverride
            }) : await this.call(messages, 2600);
            return this._parseAiJsonPayload(raw, parseOptions);
        } catch (error) {
            if (error && typeof error === 'object' && !error.code) error.code = 'AI_JSON_PARSE_FAILED';
            throw attachGoalFallback(error);
        }
    }
});

window.aiDebug?.patch?.();
