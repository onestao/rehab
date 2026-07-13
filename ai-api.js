// @ts-nocheck
Object.assign(ai, {
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

    async run(options = {}) {
        const taskId = options.taskId || 'advice.chat';
        const sequence = this.getTaskRequestSequence
            ? this.getTaskRequestSequence(taskId, options.routeOverride || null)
            : [this._effectiveConfigForRequest({ taskId, routeOverride: options.routeOverride })];
        let lastError = null;
        const withMeta = (text, effective, index) => {
            if (index > 0) window.toast?.show?.(`\u4e3b\u6a21\u578b\u4e0d\u53ef\u7528\uff0c\u5df2\u4f7f\u7528\u5907\u7528\u6a21\u578b ${effective.modelId || effective.model || ''}`, 'warning');
            return options.returnMeta ? {
                text,
                meta: {
                    taskId,
                    profileId: effective.profileId || '',
                    provider: effective.provider || '',
                    modelId: effective.modelId || effective.model || '',
                    reasoningDepth: effective.reasoningDepth || 'auto',
                    fallback: { used: index > 0, index, mode: effective.route?.fallbackMode || 'manual' }
                }
            } : text;
        };
        for (let index = 0; index < sequence.length; index++) {
            const effective = sequence[index];
            let emitted = false;
            const originalOnToken = options.onToken || (() => {});
            const requestOpts = {
                ...options,
                taskId,
                effective,
                onToken: (delta, accumulated, meta) => {
                    if (delta || accumulated) emitted = true;
                    return originalOnToken(delta, accumulated, meta);
                }
            };
            try {
                if (options.imageFile) {
                    const text = await this.callVisionTextImage(options.promptText || '', options.imageFile, options.maxTokens || 2000, options.systemText || '', requestOpts);
                    return withMeta(text, effective, index);
                }
                if (Array.isArray(options.attachments) && options.attachments.some(item => item?.kind === 'image' && item.file)) {
                    const text = await this.callAdviceWithAttachments(options.messages || [], options.attachments, options.maxTokens || 2400, requestOpts);
                    return withMeta(text, effective, index);
                }
                if (options.stream) {
                    const text = await this.callStream(options.messages || [], options.maxTokens || 2000, requestOpts.onToken, requestOpts);
                    return withMeta(text, effective, index);
                }
                const text = await this.call(options.messages || [], options.maxTokens || 2000, requestOpts);
                return withMeta(text, effective, index);
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
                }
                lastError = exposedError;
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

    // --- API Calls (统一入口，按 provider 分发) ---
    async call(messages, maxTokens = 2000, opts = {}) {
        const effective = this._effectiveConfigForRequest(opts);
        if (!effective.enabled) throw new Error('请先在设置中配置 AI 接口');
        const key = effective.apiKey;
        if (!key) throw new Error('请先在当前 AI 配置中填写 API Key');
        const provider = effective.provider || 'openai';
        if (provider === 'claude')           return this._callClaude(messages, maxTokens, key, false, null, effective);
        if (provider === 'openai-responses') return this._callOpenAIResponses(messages, maxTokens, key, false, null, effective);
        if (provider === 'gemini')           return this._callGemini(messages, maxTokens, key, false, null, effective);
        return this._callOpenAIChat(messages, maxTokens, key, false, null, effective);
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

    _balancedJsonSpans(raw, open, close) {
        const text = String(raw || '');
        const spans = [];
        for (let i = 0; i < text.length; i++) {
            if (text[i] !== open) continue;
            let depth = 0;
            let quote = '';
            let escaped = false;
            for (let j = i; j < text.length; j++) {
                const ch = text[j];
                if (quote) {
                    if (escaped) escaped = false;
                    else if (ch === '\\') escaped = true;
                    else if (ch === quote) quote = '';
                    continue;
                }
                if (ch === '"' || ch === "'") {
                    quote = ch;
                    continue;
                }
                if (ch === open) depth += 1;
                else if (ch === close) {
                    depth -= 1;
                    if (depth === 0) {
                        spans.push({ start: i, text: text.slice(i, j + 1) });
                        break;
                    }
                }
            }
        }
        return spans;
    },

    _jsonTextCandidates(raw) {
        const text = String(raw || '').trim();
        const seen = new Set();
        const candidates = [];
        const add = value => {
            const next = String(value || '').trim();
            if (next && !seen.has(next)) {
                seen.add(next);
                candidates.push(next);
            }
        };
        add(text);
        text.replace(/```(?:json|javascript|js)?\s*([\s\S]*?)```/gi, (_m, body) => {
            add(body);
            return _m;
        });
        add(text.replace(/^```(?:json|javascript|js)?\s*/i, '').replace(/```\s*$/i, ''));
        const spans = [
            ...this._balancedJsonSpans(text, '{', '}'),
            ...this._balancedJsonSpans(text, '[', ']')
        ].sort((a, b) => a.start - b.start || b.text.length - a.text.length);
        spans.forEach(span => add(span.text));
        return candidates;
    },

    _coerceAiJsonPayload(value, opts = {}) {
        const expected = opts.expected || 'array';
        if (expected === 'object') {
            if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
            const wrapperKeys = opts.wrapperKeys || ['data', 'result', 'payload', 'item'];
            const shapeKeys = opts.shapeKeys || [];
            const hasShape = item => !shapeKeys.length || shapeKeys.some(key => item?.[key] !== undefined);
            if (hasShape(value)) return value;
            for (const key of wrapperKeys) {
                const nested = value[key];
                if (nested && typeof nested === 'object' && !Array.isArray(nested) && hasShape(nested)) return nested;
            }
            return value;
        }
        if (expected !== 'array') return value;
        if (Array.isArray(value)) return value;
        if (!value || typeof value !== 'object') return null;
        const wrapperKeys = opts.wrapperKeys || [
            'items', 'foods', 'foodItems', 'food_items', 'foodList', 'food_list',
            'results', 'result', 'data', 'list', '食物', '食物列表', '结果'
        ];
        for (const key of wrapperKeys) {
            if (Array.isArray(value[key])) return value[key];
        }
        const singleFoodKeys = ['name', 'food', 'foodName', 'dish', '食物', '食物名', '名称', '名字'];
        if (singleFoodKeys.some(key => value[key] !== undefined && value[key] !== null && value[key] !== '')) return [value];
        return null;
    },

    _parseAiJsonPayload(raw, opts = {}) {
        let lastError = null;
        let parsedButWrongShape = false;
        for (const candidate of this._jsonTextCandidates(raw)) {
            try {
                const parsed = JSON.parse(candidate);
                const coerced = this._coerceAiJsonPayload(parsed, opts);
                if (coerced !== null) return coerced;
                parsedButWrongShape = true;
            } catch (e) {
                lastError = e;
            }
        }
        throw this._makeAiError('AI 返回格式异常', {
            code: parsedButWrongShape ? 'AI_JSON_SHAPE_MISMATCH' : 'AI_JSON_PARSE_FAILED',
            body: String(raw || '').slice(0, 500),
            cause: lastError || undefined
        });
    },

    _makeHttpAiError(status, body = '') {
        return this._makeAiError(`AI 请求失败: ${status} ${String(body).slice(0, 120)}`, {
            status,
            body: String(body || '')
        });
    },

    _makeTimeoutSignal(externalSignal, timeoutMs = 30000) {
        const controller = new AbortController();
        let timedOut = false;
        const abortFromExternal = () => {
            try { controller.abort(externalSignal?.reason); } catch {}
        };
        if (externalSignal?.aborted) abortFromExternal();
        else externalSignal?.addEventListener?.('abort', abortFromExternal, { once: true });
        const timer = setTimeout(() => {
            timedOut = true;
            try { controller.abort(); } catch {}
        }, Math.max(1000, Number(timeoutMs) || 30000));
        return {
            signal: controller.signal,
            wasTimeout: () => timedOut,
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
        const timeout = this._makeTimeoutSignal(opts.signal, opts.timeoutMs || 30000);
        try {
            const img = await this.prepareVisionImage(imageFile, { maxDimension: 1024, outMime: 'image/jpeg', quality: 0.85, onProgress: opts.onProgress });
            timeout.signal.throwIfAborted?.();
            opts.onProgress?.({ stage: 'request' });
            if (provider === 'claude') return await this._callClaudeVision(promptText, img, maxTokens, key, effective, systemText, timeout.signal);
            if (provider === 'openai-responses') return await this._callOpenAIResponsesVision(promptText, img, maxTokens, key, effective, systemText, timeout.signal);
            if (provider === 'gemini') return await this._callGeminiVision(promptText, img, maxTokens, key, effective, systemText, timeout.signal);
            return await this._callOpenAIChatVision(promptText, img, maxTokens, key, effective, systemText, timeout.signal);
        } catch (e) {
            if (e?.name === 'AbortError') {
                throw this._makeAiError(timeout.wasTimeout() ? 'AI_TIMEOUT' : 'AI_CANCELLED', { code: timeout.wasTimeout() ? 'AI_TIMEOUT' : 'AI_CANCELLED', cause: e });
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
        try {
            opts.signal?.throwIfAborted?.();
            if (provider === 'claude')           return await this._callClaude(messages, maxTokens, key, true, onToken, effective, opts.signal);
            if (provider === 'openai-responses') return await this._callOpenAIResponses(messages, maxTokens, key, true, onToken, effective, opts.signal);
            if (provider === 'gemini')           return await this._callGemini(messages, maxTokens, key, true, onToken, effective, opts.signal);
            return await this._callOpenAIChat(messages, maxTokens, key, true, onToken, effective, opts.signal);
        } catch (e) {
            if (e?.name === 'AbortError' || opts.signal?.aborted) {
                throw this._makeAiError('AI_CANCELLED', { code: 'AI_CANCELLED', cause: e });
            }
            if (e instanceof TypeError) throw this._makeAiError(e.message || 'NETWORK_ERROR', { code: 'NETWORK_ERROR', cause: e });
            throw e;
        }
    },

    async _callOpenAIChatVision(promptText, img, maxTokens, key, effective, systemText = '', signal = null) {
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
        try { d = JSON.parse(raw); } catch (e) { throw this._makeAiError('AI 返回格式异常', { code: 'AI_JSON_PARSE_FAILED', body: raw.slice(0, 200), cause: e }); }
        return d.choices?.[0]?.message?.content || '';
    },

    async _callOpenAIResponsesVision(promptText, img, maxTokens, key, effective, systemText = '', signal = null) {
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
        try { d = JSON.parse(raw); } catch (e) { throw this._makeAiError('AI 返回格式异常', { code: 'AI_JSON_PARSE_FAILED', body: raw.slice(0, 200), cause: e }); }
        if (d.output_text) return d.output_text;
        let txt = '';
        for (const item of (d.output || [])) {
            for (const c of (item.content || [])) {
                if (c.type === 'output_text' || c.type === 'text') txt += c.text || '';
            }
        }
        return txt;
    },

    async _callClaudeVision(promptText, img, maxTokens, key, effective, systemText = '', signal = null) {
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
        try { d = JSON.parse(raw); } catch (e) { throw this._makeAiError('AI 返回格式异常', { code: 'AI_JSON_PARSE_FAILED', body: raw.slice(0, 200), cause: e }); }
        return (d.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    },

    async _callGeminiVision(promptText, img, maxTokens, key, effective, systemText = '', signal = null) {
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
        try { d = JSON.parse(raw); } catch (e) { throw this._makeAiError('AI 返回格式异常', { code: 'AI_JSON_PARSE_FAILED', body: raw.slice(0, 200), cause: e }); }
        return d.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    },

    // ---------- OpenAI Chat Completions ----------
    async _callOpenAIChat(messages, maxTokens, key, stream, onChunk, effective = this.getEffectiveConfig?.() || this.cfg, signal = null) {
        const url = `${effective.baseUrl}/chat/completions`;
        const reasoning = this._reasoningRequestOptions(effective, maxTokens);
        const body = { model: effective.model, messages, max_tokens: reasoning.maxOutputTokens, ...reasoning.params };
        if (!reasoning.omitTemperature) body.temperature = 0.3;
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
                return d.choices?.[0]?.message?.content || '';
            } catch {
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
              (json) => json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content ?? '',
              (json) => {
                  const usage = json.usage ? { in: Number(json.usage.prompt_tokens || 0), out: Number(json.usage.completion_tokens || 0) } : null;
                  const finishReason = json.choices?.[0]?.finish_reason || '';
                  return usage || finishReason ? { usage, finishReason } : null;
              },
              signal
          );
    },

    // ---------- OpenAI Responses API（最新 /v1/responses） ----------
    async _callOpenAIResponses(messages, maxTokens, key, stream, onChunk, effective = this.getEffectiveConfig?.() || this.cfg, signal = null) {
        const url = `${effective.baseUrl}/responses`;
        const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
        const input = messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role,
            content: [{ type: m.role === 'assistant' ? 'output_text' : 'input_text', text: m.content }]
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
            if (d.output_text) return d.output_text;
            let txt = '';
            for (const item of (d.output || [])) {
                for (const c of (item.content || [])) {
                    if (c.type === 'output_text' || c.type === 'text') txt += c.text || '';
                }
            }
            return txt;
        }
          return this._readSSE(res, onChunk, (json) => {
              if (json.type === 'response.output_text.delta') return json.delta || '';
              return '';
          }, (json) => {
             const response = json.response || null;
             const finishReason = response?.incomplete_details?.reason || (response?.status && response.status !== 'completed' ? response.status : '') || '';
             if (json.type === 'response.completed' && response?.usage) {
                 const u = response.usage;
                 return { usage: { in: Number(u.input_tokens || 0), out: Number(u.output_tokens || 0) }, finishReason };
             }
             if (finishReason) return { finishReason };
              return null;
          }, signal);
    },

    // ---------- Anthropic Claude Messages API ----------
    async _callClaude(messages, maxTokens, key, stream, onChunk, effective = this.getEffectiveConfig?.() || this.cfg, signal = null) {
        const url = `${effective.baseUrl}/messages`;
        const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
        const msgs = messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content
        }));
        const reasoning = this._reasoningRequestOptions(effective, maxTokens);
        const body = {
            model: effective.model,
            messages: msgs,
            max_tokens: reasoning.maxOutputTokens,
            ...reasoning.params
        };
        if (!reasoning.omitTemperature) body.temperature = 0.3;
        if (sys) body.system = sys;
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
            return (d.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
        }
          return this._readSSE(res, onChunk, (json) => {
              if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
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
    async _callGemini(messages, maxTokens, key, stream, onChunk, effective = this.getEffectiveConfig?.() || this.cfg, signal = null) {
        const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
        const contents = messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));
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
            return d.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
        }
          return this._readSSE(res, onChunk,
              (json) => json.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '',
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
        const raw = this.resolveTaskConfig ? await this.run({
            taskId: 'food.text',
            messages,
            maxTokens: 2000,
            routeOverride: opts?.routeOverride || null
        }) : await this.call(messages, 2000);
        return this._parseAiJsonPayload(raw, {
            expected: 'array',
            wrapperKeys: ['items', 'foods', 'foodItems', 'food_items', 'foodList', 'food_list', 'results', 'result', 'data', '食物', '食物列表', '结果']
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
        const prompt = prefResult.messages?.find(m => m.role === 'user')?.content || `你是营养师助手。用户给出了一张"这顿饭/食物"的照片。请你根据图片内容识别食物，并严格只返回 JSON 数组，不要其他文字。\n每个元素格式：{"name":"食物名","grams":克数,"cal":热量kcal,"pro":蛋白质g,"carb":碳水g,"fat":脂肪g,"fiber":膳食纤维g,"sugar":糖g,"sodium":钠mg,"saturatedFat":饱和脂肪g,"ingredients":["主要配料"],"cooking":"烹饪方式","source":"估算依据","confidence":0-100,"note":"健康性备注"}\n要求：\n- 如果无法判断克数，请用常见份量估算；\n- fiber/sugar/sodium/saturatedFat/ingredients/cooking/source/confidence/note 可根据可见信息合理填写，无法判断时使用 0、空数组或空字符串；\n- 如果图片中看不清或不确定，请不要编造，返回空数组 [] 或减少条目；\n- 不要输出 markdown、不要解释。`;
        const result = this.resolveTaskConfig
            ? await this.run({ ...opts, taskId: 'food.vision', promptText: prompt, imageFile: file, systemText: sysMsg, maxTokens: 2000, returnMeta: true })
            : await this.callVisionTextImage(prompt, file, 2000, sysMsg, opts);
        const raw = result && typeof result === 'object' && typeof result.text === 'string' ? result.text : result;
        if (result?.meta) opts.onResolvedMeta?.(result.meta);
        opts.onProgress?.({ stage: 'parse' });
        try {
            return this._parseAiJsonPayload(raw, {
                expected: 'array',
                wrapperKeys: ['items', 'foods', 'foodItems', 'food_items', 'foodList', 'food_list', 'results', 'result', 'data', '食物', '食物列表', '结果']
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
        const raw = this.resolveTaskConfig ? await this.run({
            taskId: 'goal.body',
            messages,
            maxTokens: 2600,
            routeOverride
        }) : await this.call(messages, 2600);
        try {
            const match = raw.match(/\{[\s\S]*"tips"[\s\S]*\}/);
            if (!match) throw new Error('AI 返回格式异常');
            return JSON.parse(match[0]);
        } catch (error) {
            if (error && typeof error === 'object' && !error.code) error.code = 'AI_JSON_PARSE_FAILED';
            const route = routeOverride ? null : this.getTaskRoute?.('goal.body');
            const target = (route?.fallbackMode || 'manual') === 'manual'
                ? window.aiRoutingPure?.manualFallbackTarget?.(route?.fallbacks?.[0])
                : null;
            if (target && error && typeof error === 'object') error.aiFallback = { taskId: 'goal.body', target };
            throw error;
        }
    }
});

window.aiDebug?.patch?.();
