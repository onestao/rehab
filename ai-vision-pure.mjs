// @ts-nocheck
const KNOWN_PHOTO_PROVIDERS = new Set(['openai', 'openai-responses', 'claude', 'gemini']);

function norm(value) {
    return String(value || '').trim().toLowerCase();
}

export function splitVisionKeywords(value) {
    if (Array.isArray(value)) return value.map(norm).filter(Boolean);
    return String(value || '')
        .split(',')
        .map(norm)
        .filter(Boolean);
}

function providerKeys(provider) {
    const p = norm(provider);
    if (p === 'openai' || p === 'openai-responses') return ['openai', 'openai_compatible'];
    return [p];
}

function listHasExact(list, model) {
    return Array.isArray(list) && list.some(item => norm(item) === model);
}

function listHasSubstring(list, model) {
    return Array.isArray(list) && list.some(item => {
        const needle = norm(item);
        return needle && model.includes(needle);
    });
}

export function analyzeVisionModel(modelId, provider, whitelist = {}, extraKeywords = '') {
    const model = norm(modelId);
    const keys = providerKeys(provider);
    const providers = whitelist?.providers || {};
    const userKeywords = splitVisionKeywords(extraKeywords);
    const keywords = [...(Array.isArray(whitelist?.keywords) ? whitelist.keywords : []), ...userKeywords];
    const isImageGen = listHasSubstring(whitelist?.exclude_image_gen, model);
    if (!model || isImageGen) {
        return { vision: false, highRes: false, isImageGen, source: isImageGen ? 'exclude_image_gen' : 'none' };
    }

    const exact = keys.some(key => listHasExact(providers[key], model));
    const keyword = !exact && listHasSubstring(keywords, model);
    const highRes = listHasExact(whitelist?.high_res_models, model);
    return {
        vision: exact || keyword,
        highRes: (exact || keyword) && highRes,
        isImageGen: false,
        source: exact ? 'provider' : keyword ? 'keyword' : 'none'
    };
}

export function isKnownDietPhotoProvider(provider) {
    return KNOWN_PHOTO_PROVIDERS.has(norm(provider));
}

export function classifyVisionError(errorLike) {
    const code = String(errorLike?.code || '');
    const status = Number(errorLike?.status || 0);
    const body = String(errorLike?.body || errorLike?.message || errorLike || '');
    const lower = body.toLowerCase();

    if (code === 'AI_CANCELLED' || errorLike?.name === 'AbortError') {
        return { type: 'cancelled', message: '已取消', cacheVisionFailure: false, isErrorToast: false };
    }
    if (code === 'AI_TIMEOUT') {
        return { type: 'timeout', message: '识别超时，请重试或换模型', cacheVisionFailure: false, isErrorToast: true };
    }
    if (code === 'HEIC_DECODE_FAILED') {
        return { type: 'decode', message: '照片解码失败，请换一张或改用 JPEG', cacheVisionFailure: false, isErrorToast: true };
    }
    if (code === 'AI_JSON_PARSE_FAILED') {
        return { type: 'parse', message: 'AI 返回格式异常', cacheVisionFailure: false, isErrorToast: true };
    }
    if (status === 401 || status === 403) {
        return { type: 'auth', message: '鉴权失败，请检查 API Key', cacheVisionFailure: false, isErrorToast: true };
    }
    if (status === 404) {
        return { type: 'base_url', message: '接口路径错误，请检查 Base URL', cacheVisionFailure: false, isErrorToast: true };
    }
    if ([400, 415, 422].includes(status) && /(image|vision|unsupported|modality)/i.test(body)) {
        return { type: 'unsupported_vision', message: '当前模型可能不支持图片', cacheVisionFailure: true, isErrorToast: true };
    }
    if (status === 429) {
        return { type: 'rate_limit', message: '请求过快或额度用尽', cacheVisionFailure: false, isErrorToast: true };
    }
    if (code === 'NETWORK_ERROR' || errorLike instanceof TypeError || /failed to fetch|network|load failed/i.test(body)) {
        return { type: 'network', message: '网络异常，请检查连接', cacheVisionFailure: false, isErrorToast: true };
    }
    return { type: 'unknown', message: body ? body.slice(0, 80) : '识别失败', cacheVisionFailure: false, isErrorToast: true };
}

if (typeof window !== 'undefined') {
    window.aiVisionPure = {
        analyzeVisionModel,
        classifyVisionError,
        isKnownDietPhotoProvider,
        splitVisionKeywords
    };
}
