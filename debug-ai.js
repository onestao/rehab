// @ts-nocheck
(function () {
    if (window.aiDebug) return;

    const patched = [];
    let enabled = false;

    function truncate(value, max = 160) {
        const text = String(value || '');
        return text.length > max ? `${text.slice(0, max)}...` : text;
    }

    function summarizePayload(value) {
        if (Array.isArray(value)) return { kind: 'array', count: value.length };
        if (!value || typeof value !== 'object') return { kind: typeof value };
        return {
            kind: 'object',
            keys: Object.keys(value).slice(0, 12),
            actionCount: Array.isArray(value.actions) ? value.actions.length : undefined,
            itemCount: Array.isArray(value.items) ? value.items.length : undefined
        };
    }

    function event(type, meta = {}) {
        if (!enabled) return;
        try { window.errorBus?.event?.('ai', type, meta); } catch {}
    }

    function patchMethod(target, name, wrap) {
        const original = target?.[name];
        if (typeof original !== 'function' || original.__aiDebugPatched) return;
        const wrapped = wrap(original);
        wrapped.__aiDebugPatched = true;
        wrapped.__aiDebugOriginal = original;
        target[name] = wrapped;
        patched.push(() => {
            if (target[name]?.__aiDebugPatched) target[name] = original;
        });
    }

    function patch() {
        if (!enabled) return false;
        const client = window.ai;
        if (!client) return false;
        patchMethod(client, 'call', (original) => async function (messages, maxTokens, ...rest) {
            const started = Date.now();
            event('call:start', {
                roles: Array.isArray(messages) ? messages.map(m => m?.role || '?') : [],
                messageCount: Array.isArray(messages) ? messages.length : 0,
                maxTokens: Number(maxTokens || 0) || undefined
            });
            try {
                const result = await original.call(this, messages, maxTokens, ...rest);
                event('call:done', { ms: Date.now() - started, chars: String(result || '').length });
                return result;
            } catch (e) {
                event('call:error', { ms: Date.now() - started, code: e?.code || '', message: truncate(e?.message || e) });
                throw e;
            }
        });
        patchMethod(client, '_parseAiJsonPayload', (original) => function (raw, opts = {}) {
            try {
                const parsed = original.call(this, raw, opts);
                event('json:parse:done', {
                    expected: opts.expected || 'array',
                    chars: String(raw || '').length,
                    result: summarizePayload(parsed)
                });
                return parsed;
            } catch (e) {
                event('json:parse:error', {
                    expected: opts.expected || 'array',
                    chars: String(raw || '').length,
                    code: e?.code || '',
                    body: truncate(e?.body || raw, 240),
                    message: truncate(e?.message || e)
                });
                throw e;
            }
        });
        event('runtime:patched');
        return true;
    }

    function enable() {
        if (enabled) return;
        enabled = true;
        patch();
        event('debug:enabled');
    }

    function disable() {
        if (!enabled) return;
        while (patched.length) {
            try { patched.pop()(); } catch {}
        }
        enabled = false;
    }

    window.aiDebug = { enable, disable, patch, event };
})();
