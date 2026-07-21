// @ts-nocheck
/**
 * Pure AI JSON contract helpers: extract, shape-check, completion/block
 * classification, and safe diagnostic field construction.
 * No DOM / fetch / credentials.
 */

const JSON_FORMAT_RETRY_CODES = Object.freeze([
    'AI_OUTPUT_TRUNCATED',
    'AI_JSON_PARSE_FAILED',
    'AI_JSON_SHAPE_MISMATCH'
]);

const ABORT_CODES = Object.freeze([
    'AI_REQUEST_ABORTED',
    'AI_CANCELLED',
    'AbortError'
]);

function freeze(value) {
    try { return Object.freeze(value); } catch { return value; }
}

export function isJsonFormatRetryable(error) {
    const code = String(error?.code || '');
    return JSON_FORMAT_RETRY_CODES.includes(code);
}

export function isAbortLikeError(error) {
    if (!error) return false;
    if (error.name === 'AbortError') return true;
    const code = String(error?.code || '');
    if (ABORT_CODES.includes(code)) return true;
    const msg = String(error?.message || '');
    return /aborted|abort|取消|cancelled|canceled/i.test(msg) && (
        code === 'AI_REQUEST_ABORTED'
        || code === 'AI_CANCELLED'
        || error.name === 'AbortError'
    );
}

export function balancedJsonSpans(raw, open, close) {
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
}

export function jsonTextCandidates(raw) {
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
        ...balancedJsonSpans(text, '{', '}'),
        ...balancedJsonSpans(text, '[', ']')
    ].sort((a, b) => a.start - b.start || b.text.length - a.text.length);
    spans.forEach(span => add(span.text));
    return candidates;
}

export function matchesAiJsonFieldType(value, type) {
    const t = String(type || '');
    if (t === 'array') return Array.isArray(value);
    if (t === 'object') return !!value && typeof value === 'object' && !Array.isArray(value);
    if (t === 'string') return typeof value === 'string';
    if (t === 'number') return typeof value === 'number' && Number.isFinite(value);
    if (t === 'boolean') return typeof value === 'boolean';
    return true;
}

export function objectMatchesAiJsonShape(value, opts = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const shapeKeys = Array.isArray(opts.shapeKeys) ? opts.shapeKeys : [];
    const requiredKeys = Array.isArray(opts.requiredKeys) ? opts.requiredKeys : [];
    const fieldTypes = opts.fieldTypes && typeof opts.fieldTypes === 'object' ? opts.fieldTypes : {};
    if (requiredKeys.length) {
        if (requiredKeys.some(key => value[key] === undefined)) return false;
    } else if (shapeKeys.length && !shapeKeys.some(key => value[key] !== undefined)) {
        return false;
    }
    return Object.entries(fieldTypes).every(([key, type]) => (
        value[key] === undefined || matchesAiJsonFieldType(value[key], type)
    ));
}

export function coerceAiJsonPayload(value, opts = {}) {
    const expected = opts.expected || 'array';
    if (expected === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        const wrapperKeys = opts.wrapperKeys || ['data', 'result', 'payload', 'item'];
        const hasShapeConstraints = !!(opts.requiredKeys?.length || opts.shapeKeys?.length || (opts.fieldTypes && Object.keys(opts.fieldTypes).length));
        if (objectMatchesAiJsonShape(value, opts)) return value;
        for (const key of wrapperKeys) {
            if (objectMatchesAiJsonShape(value[key], opts)) return value[key];
        }
        return hasShapeConstraints ? null : value;
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
}

/**
 * Parse AI text into structured JSON with shape options.
 * Returns { ok:true, value } or { ok:false, code, outputLength, parseErrorMessage }.
 */
export function parseAiJsonPayload(raw, opts = {}) {
    let lastError = null;
    let parsedButWrongShape = false;
    const rawText = String(raw || '');
    for (const candidate of jsonTextCandidates(rawText)) {
        try {
            const parsed = JSON.parse(candidate);
            const coerced = coerceAiJsonPayload(parsed, opts);
            if (coerced !== null) return { ok: true, value: coerced };
            parsedButWrongShape = true;
        } catch (e) {
            lastError = e;
        }
    }
    return {
        ok: false,
        code: parsedButWrongShape ? 'AI_JSON_SHAPE_MISMATCH' : 'AI_JSON_PARSE_FAILED',
        outputLength: rawText.length,
        parseErrorMessage: lastError ? String(lastError.message || lastError) : ''
    };
}

function isBlockedToken(reason) {
    const value = String(reason || '').trim();
    if (!value) return '';
    const lower = value.toLowerCase();
    if ([
        'content_filter', 'content_filter_end', 'refusal', 'safety',
        'blocklist', 'prohibited_content', 'recitation', 'spii', 'other', 'blocked'
    ].includes(lower)) return value;
    if (lower.includes('content_filter') || lower.includes('refusal') || lower.includes('safety')) return value;
    return '';
}

/**
 * Classify provider payload for complete-output enforcement.
 * Returns null if OK, or { kind:'blocked'|'truncated', finishReason }.
 */
export function classifyAiResponseCompletion(provider, payload, options = {}) {
    if (!options.requireCompleteOutput) return null;
    const p = payload && typeof payload === 'object' ? payload : {};
    const providerKey = String(provider || '').toLowerCase();
    const choice = p.choices?.[0] || null;
    const finishReason = String(
        options.finishReason
        || p.incomplete_details?.reason
        || choice?.finish_reason
        || p.stop_reason
        || p.candidates?.[0]?.finishReason
        || (p.status && p.status !== 'completed' ? p.status : '')
        || ''
    );

    let blockedReason = isBlockedToken(finishReason)
        || (choice?.message?.refusal || p.refusal ? 'refusal' : '')
        || (p.promptFeedback?.blockReason ? String(p.promptFeedback.blockReason) : '');

    if (!blockedReason) {
        outer: for (const item of (Array.isArray(p.output) ? p.output : [])) {
            if (!item || typeof item !== 'object') continue;
            if (item.type === 'refusal' || item.refusal) { blockedReason = 'refusal'; break; }
            for (const part of (Array.isArray(item.content) ? item.content : [])) {
                if (part && typeof part === 'object' && (part.type === 'refusal' || part.refusal)) {
                    blockedReason = 'refusal';
                    break outer;
                }
            }
        }
    }
    if (!blockedReason) {
        const geminiFinish = String(p.candidates?.[0]?.finishReason || '');
        if (['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'RECITATION', 'SPII'].includes(geminiFinish)) {
            blockedReason = geminiFinish;
        } else if (['refusal', 'safety'].includes(String(p.stop_reason || '').toLowerCase())) {
            blockedReason = p.stop_reason;
        }
    }
    if (blockedReason) {
        return { kind: 'blocked', finishReason: String(blockedReason) };
    }

    const truncated = providerKey === 'openai-responses'
        ? (p.status === 'incomplete' && String(p.incomplete_details?.reason || '') === 'max_output_tokens')
        : providerKey === 'claude'
            ? (p.stop_reason === 'max_tokens' || finishReason === 'max_tokens')
            : providerKey === 'gemini'
                ? (p.candidates?.[0]?.finishReason === 'MAX_TOKENS' || finishReason === 'MAX_TOKENS')
                : ['length', 'max_tokens'].includes(String(choice?.finish_reason || finishReason));
    if (truncated) {
        return {
            kind: 'truncated',
            finishReason: finishReason || 'max_output_tokens',
            outputLength: String(options.text || '').length
        };
    }
    return null;
}

export function safeAiAttempt(meta = {}) {
    return freeze({
        taskId: String(meta.taskId || meta.aiAttempt?.taskId || ''),
        profileId: String(meta.profileId || meta.aiAttempt?.profileId || ''),
        modelId: String(meta.modelId || meta.model || meta.aiAttempt?.modelId || meta.aiAttempt?.model || ''),
        provider: String(meta.provider || meta.aiAttempt?.provider || ''),
        reasoningDepth: String(meta.reasoningDepth || meta.aiAttempt?.reasoningDepth || '')
    });
}

/**
 * Build a safe diagnostic error payload (no body/cause/raw text).
 */
export function buildSafeAiDiagnosticProps(error, extras = {}) {
    const code = String(extras.code || error?.code || '');
    const fromExtraAttempt = extras.aiAttempt && typeof extras.aiAttempt === 'object' ? extras.aiAttempt : {};
    const fromErrorAttempt = error?.aiAttempt && typeof error.aiAttempt === 'object' ? error.aiAttempt : {};
    const attempt = safeAiAttempt({
        ...fromErrorAttempt,
        ...fromExtraAttempt,
        modelId: extras.modelId || fromExtraAttempt.modelId || fromExtraAttempt.model || fromErrorAttempt.modelId || fromErrorAttempt.model || '',
        profileId: extras.profileId || fromExtraAttempt.profileId || fromErrorAttempt.profileId || '',
        taskId: extras.taskId || fromExtraAttempt.taskId || fromErrorAttempt.taskId || '',
        provider: extras.provider || fromExtraAttempt.provider || fromErrorAttempt.provider || '',
        reasoningDepth: extras.reasoningDepth || fromExtraAttempt.reasoningDepth || fromErrorAttempt.reasoningDepth || ''
    });
    const props = {
        code,
        finishReason: String(extras.finishReason ?? error?.finishReason ?? ''),
        firstAttemptCode: String(extras.firstAttemptCode ?? error?.firstAttemptCode ?? ''),
        retryAttempted: extras.retryAttempted != null ? !!extras.retryAttempted : !!error?.retryAttempted,
        aiAttempt: attempt
    };
    if (extras.status != null || error?.status != null) {
        props.status = Number(extras.status ?? error?.status) || extras.status || error?.status;
    }
    if (extras.outputLength != null || error?.outputLength != null) {
        props.outputLength = Number(extras.outputLength ?? error?.outputLength) || 0;
    }
    return props;
}

export function buildJsonRetryFailureMessage(code) {
    const finalCode = String(code || 'AI_JSON_PARSE_FAILED');
    if (finalCode === 'AI_OUTPUT_TRUNCATED') {
        return 'AI 输出达到长度上限，重新生成后仍不完整。请切换模型或将推理强度设为关闭。';
    }
    if (finalCode === 'AI_JSON_SHAPE_MISMATCH') {
        return 'AI 返回的 JSON 缺少当前功能所需字段，请切换模型后重试。';
    }
    return 'AI 重新生成后仍未返回有效 JSON，请切换支持 JSON 输出的模型。';
}

/**
 * Decide how to surface a second-attempt error after a JSON-format retry.
 * - abort: rethrow as unified abort (or pass-through abort)
 * - passthrough: non-JSON errors (network/HTTP/block) keep original semantics
 * - wrap: second JSON/shape/truncation failure becomes wrapped message
 */
export function classifySecondAttemptError(error, firstAttemptCode = '') {
    if (isAbortLikeError(error)) {
        return { action: 'abort', code: String(error?.code || 'AI_REQUEST_ABORTED') };
    }
    if (isJsonFormatRetryable(error)) {
        return {
            action: 'wrap',
            code: String(error?.code || firstAttemptCode || 'AI_JSON_PARSE_FAILED')
        };
    }
    return {
        action: 'passthrough',
        code: String(error?.code || 'AI_REQUEST_FAILED')
    };
}

export function sanitizeRehabErrorBusMeta(error, overrides = {}) {
    return freeze({
        phase: String(overrides.phase || (error?.retryAttempted ? 'retry' : (error?.code === 'AI_OUTPUT_TRUNCATED' ? 'request' : 'parse'))),
        code: String(overrides.code || error?.code || ''),
        retryAttempted: overrides.retryAttempted != null ? !!overrides.retryAttempted : !!error?.retryAttempted,
        finishReason: String(overrides.finishReason ?? error?.finishReason ?? ''),
        modelId: String(overrides.modelId || error?.aiAttempt?.modelId || '')
    });
}

/**
 * Safe error for errorBus: only message + code + safe props, no body/cause.
 */
export function toSafeErrorForBus(error, messageOverride) {
    const props = buildSafeAiDiagnosticProps(error);
    const err = new Error(String(messageOverride || error?.message || 'AI 请求失败'));
    err.name = error?.name || 'Error';
    err.code = props.code;
    err.finishReason = props.finishReason;
    err.firstAttemptCode = props.firstAttemptCode;
    err.retryAttempted = props.retryAttempted;
    err.aiAttempt = props.aiAttempt;
    if (props.status != null) err.status = props.status;
    if (props.outputLength != null) err.outputLength = props.outputLength;
    return err;
}

const api = {
    isJsonFormatRetryable,
    isAbortLikeError,
    balancedJsonSpans,
    jsonTextCandidates,
    matchesAiJsonFieldType,
    objectMatchesAiJsonShape,
    coerceAiJsonPayload,
    parseAiJsonPayload,
    classifyAiResponseCompletion,
    safeAiAttempt,
    buildSafeAiDiagnosticProps,
    buildJsonRetryFailureMessage,
    classifySecondAttemptError,
    sanitizeRehabErrorBusMeta,
    toSafeErrorForBus,
    JSON_FORMAT_RETRY_CODES
};

export default api;

if (typeof window !== 'undefined') {
    window.aiJsonPure = api;
}
