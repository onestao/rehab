// @ts-nocheck

const PRIORITIES = new Set(['online-first', 'local-first', 'online-only', 'local-only']);
const DEFAULT_VOICE = Object.freeze({
    priority: 'online-first',
    engines: [],
    cache: true,
    timeoutMs: 4000
});

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function mapRateToLegado(rate) {
    const numeric = Number.isFinite(Number(rate)) ? Number(rate) : 1;
    return Math.round(clamp((numeric - 1) * 50, -50, 50));
}

function mapPitchToLegado(pitch) {
    const numeric = Number.isFinite(Number(pitch)) ? Number(pitch) : 1;
    return Math.round(clamp((numeric - 1) * 50, -50, 50));
}

function hashString(input) {
    let hash = 2166136261;
    const text = String(input || '');
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function parseHeader(raw, warnings, index) {
    if (!raw) return {};
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return parseHeader(parsed, warnings, index);
        } catch {
            warnings.push({ index, field: 'header', message: 'header JSON 解析失败，已按空请求头处理' });
            return {};
        }
    }
    if (typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out = {};
    Object.keys(raw).forEach(key => {
        const value = raw[key];
        if (value == null) return;
        out[String(key)] = String(value);
    });
    return out;
}

function normalizeEngine(item, index, warnings) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error(`第 ${index + 1} 条 Legado 配置不是对象`);
    }
    const url = String(item.url || '').trim();
    if (!url) throw new Error(`第 ${index + 1} 条 Legado 配置缺少 url`);
    const name = String(item.name || `Legado ${index + 1}`).trim() || `Legado ${index + 1}`;
    const header = parseHeader(item.header, warnings, index);
    return {
        id: String(item.id || `legado-${hashString(`${name}\n${url}\n${index}`)}`),
        name,
        url,
        header,
        contentType: String(item.contentType || '').trim(),
        timeoutMs: Number(item.timeoutMs || 0) > 0 ? Number(item.timeoutMs) : undefined
    };
}

function parseLegadoConfigWithWarnings(input) {
    let raw = input;
    if (typeof input === 'string') {
        try {
            raw = JSON.parse(input);
        } catch (error) {
            throw new Error(`Legado JSON 解析失败：${error.message}`);
        }
    }
    const list = Array.isArray(raw) ? raw : [raw];
    const warnings = [];
    const engines = list.map((item, index) => normalizeEngine(item, index, warnings));
    if (!engines.length) throw new Error('Legado 配置为空');
    return { engines, warnings };
}

function parseLegadoConfig(input) {
    return parseLegadoConfigWithWarnings(input).engines;
}

function tokenizeArithmetic(expression) {
    const tokens = [];
    const source = String(expression || '');
    let i = 0;
    while (i < source.length) {
        const ch = source[i];
        if (/\s/.test(ch)) {
            i += 1;
            continue;
        }
        if ('+-*/()'.includes(ch)) {
            tokens.push(ch);
            i += 1;
            continue;
        }
        if (/[0-9.]/.test(ch)) {
            let j = i + 1;
            while (j < source.length && /[0-9.]/.test(source[j])) j += 1;
            const n = Number(source.slice(i, j));
            if (!Number.isFinite(n)) return null;
            tokens.push(n);
            i = j;
            continue;
        }
        return null;
    }
    return tokens;
}

function evaluateArithmetic(expression) {
    const tokens = tokenizeArithmetic(expression);
    if (!tokens || !tokens.length) return null;
    let pos = 0;

    const parseFactor = () => {
        const token = tokens[pos];
        if (token === '+') {
            pos += 1;
            return parseFactor();
        }
        if (token === '-') {
            pos += 1;
            return -parseFactor();
        }
        if (token === '(') {
            pos += 1;
            const value = parseExpression();
            if (tokens[pos] !== ')') throw new Error('missing closing paren');
            pos += 1;
            return value;
        }
        if (typeof token !== 'number') throw new Error('number expected');
        pos += 1;
        return token;
    };

    const parseTerm = () => {
        let value = parseFactor();
        while (tokens[pos] === '*' || tokens[pos] === '/') {
            const op = tokens[pos];
            pos += 1;
            const next = parseFactor();
            value = op === '*' ? value * next : value / next;
        }
        return value;
    };

    function parseExpression() {
        let value = parseTerm();
        while (tokens[pos] === '+' || tokens[pos] === '-') {
            const op = tokens[pos];
            pos += 1;
            const next = parseTerm();
            value = op === '+' ? value + next : value - next;
        }
        return value;
    }

    try {
        const value = parseExpression();
        if (pos !== tokens.length || !Number.isFinite(value)) return null;
        return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
    } catch {
        return null;
    }
}

function renderNumericExpression(expression, values) {
    const substituted = String(expression || '')
        .replace(/\bspeakSpeed\b/g, values.speed)
        .replace(/\bspeakPitch\b/g, values.pitch);
    return evaluateArithmetic(substituted);
}

function renderTemplate(template, params = {}) {
    const encodedText = encodeURIComponent(String(params.text ?? ''));
    const speed = String(mapRateToLegado(params.rate));
    const pitch = String(mapPitchToLegado(params.pitch));
    return String(template || '')
        .replace(/\{\{([^{}]*(?:speakSpeed|speakPitch)[^{}]*)\}\}/g, (match, expr) => {
            const value = renderNumericExpression(expr, { speed, pitch });
            return value == null ? match : value;
        })
        .replace(/\{\{\s*speakSpeed\s*\}\}/g, speed)
        .replace(/\{\{\s*speakPitch\s*\}\}/g, pitch)
        .replace(/\{\{\s*java\.encodeURI\s*\(\s*speakText\s*\)\s*\}\}/g, encodedText)
        .replace(/\{\{\s*speakText\s*\}\}/g, encodedText)
        .replace(/\{\{[^{}]*speakText[^{}]*\}\}/g, encodedText);
}

function renderUrl(cfg, params = {}) {
    return renderTemplate(cfg?.url || '', params);
}

function renderHeaders(cfg, params = {}) {
    const header = cfg?.header && typeof cfg.header === 'object' ? cfg.header : {};
    const out = {};
    Object.keys(header).forEach(key => {
        out[key] = renderTemplate(header[key], params);
    });
    return out;
}

function normalizeVoiceConfig(voice) {
    const source = voice && typeof voice === 'object' ? voice : {};
    const priority = PRIORITIES.has(source.priority) ? source.priority : DEFAULT_VOICE.priority;
    return {
        priority,
        engines: Array.isArray(source.engines) ? source.engines.filter(engine => engine && engine.url) : [],
        cache: source.cache !== false,
        timeoutMs: Number(source.timeoutMs || 0) > 0 ? Number(source.timeoutMs) : DEFAULT_VOICE.timeoutMs
    };
}

function resolveEngineChain(priority, engines = []) {
    const mode = PRIORITIES.has(priority) ? priority : DEFAULT_VOICE.priority;
    const legado = (Array.isArray(engines) ? engines : [])
        .filter(engine => engine && engine.url)
        .map((engine, index) => ({
            type: 'legado',
            id: engine.id || `legado-${index + 1}`,
            index,
            engine
        }));
    const local = [{ type: 'webspeech', id: 'webspeech' }];
    if (mode === 'online-first') return legado.concat(local);
    if (mode === 'local-first') return local.concat(legado);
    if (mode === 'online-only') return legado;
    return local;
}

export {
    DEFAULT_VOICE,
    mapRateToLegado,
    mapPitchToLegado,
    parseLegadoConfig,
    parseLegadoConfigWithWarnings,
    renderTemplate,
    renderUrl,
    renderHeaders,
    normalizeVoiceConfig,
    resolveEngineChain
};

if (typeof window !== 'undefined') {
    window.voiceEngine = {
        DEFAULT_VOICE,
        mapRateToLegado,
        mapPitchToLegado,
        parseLegadoConfig,
        parseLegadoConfigWithWarnings,
        renderTemplate,
        renderUrl,
        renderHeaders,
        normalizeVoiceConfig,
        resolveEngineChain
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DEFAULT_VOICE,
        mapRateToLegado,
        mapPitchToLegado,
        parseLegadoConfig,
        parseLegadoConfigWithWarnings,
        renderTemplate,
        renderUrl,
        renderHeaders,
        normalizeVoiceConfig,
        resolveEngineChain
    };
}
