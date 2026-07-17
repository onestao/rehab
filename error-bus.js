(function () {
    const MAX_EVENTS = 200;
    const queue = [];
    let debugAdapter = null;

    function normalizeError(err) {
        if (err instanceof Error) return err;
        if (typeof err === 'string') return new Error(err);
        if (err && typeof err === 'object' && 'message' in err) return new Error(String(err.message));
        return new Error('未知错误');
    }

    function friendlyMessage(error) {
        const message = String(error?.message || error || '未知错误');
        if (/Failed to fetch|NetworkError|Load failed|fetch/i.test(message)) return '网络异常，请稍后再试';
        return message || '发生未知错误';
    }

    function isIgnorableBrowserError(err) {
        const message = String(err?.message || err || '');
        return /ResizeObserver loop (?:limit exceeded|completed with undelivered notifications)|Observer loop completed with undelivered notifications/i.test(message);
    }

    function safeToast(message) {
        try {
            if (window.toast && typeof toast.show === 'function') toast.show(message, 'error');
        } catch {}
    }

    function sanitizeUrl(value) {
        try {
            const url = new URL(String(value || ''), location.href);
            return url.origin + url.pathname;
        } catch {
            return String(value || '').split('?')[0].slice(0, 160);
        }
    }

    function sanitizeMeta(value, depth = 0) {
        if (value == null) return value;
        if (depth > 3) return '[MaxDepth]';
        if (value instanceof Error) {
            return { name: value.name || 'Error', message: String(value.message || '').slice(0, 240) };
        }
        const type = typeof value;
        if (type === 'boolean' || type === 'number') return Number.isFinite(value) ? value : String(value);
        if (type === 'string') return value.length > 240 ? value.slice(0, 240) + '...' : value;
        if (type !== 'object') return String(value);
        if (Array.isArray(value)) {
            return {
                length: value.length,
                sample: value.slice(0, 5).map(item => sanitizeMeta(item, depth + 1))
            };
        }
        const out = {};
        const deny = /(^|_)(api[-_]?key|key|secret|token|pass|password|authorization|credential|prompt|content|body|response|text|payload|db|cfg|headers?)($|_)/i;
        Object.keys(value).slice(0, 40).forEach(key => {
            const raw = value[key];
            if (deny.test(key)) {
                out[key] = '[redacted]';
            } else if (/url|endpoint/i.test(key)) {
                out[key] = sanitizeUrl(raw);
            } else {
                out[key] = sanitizeMeta(raw, depth + 1);
            }
        });
        return out;
    }

    const errorBus = {
        report(scope, err, meta) {
            try {
                const error = normalizeError(err);
                if (isIgnorableBrowserError(error)) return null;
                const item = {
                    scope: scope || 'unknown',
                    message: friendlyMessage(error),
                    meta: meta ? sanitizeMeta(meta) : null,
                    at: new Date().toISOString(),
                    stack: error.stack || ''
                };
                queue.push(item);
                while (queue.length > MAX_EVENTS) queue.shift();
                console.error(`[${item.scope}]`, error, item.meta || '');
                debugAdapter?.capture?.('error', item.scope, [item.message, item.meta]);
                safeToast(item.message);
                return item;
            } catch (secondary) {
                console.error('[errorBus] report failed', secondary, err, meta || '');
                return null;
            }
        },
        sanitizeDebugUrl(value) {
            return sanitizeUrl(value);
        },
        sanitizeDebugMeta(value) {
            return sanitizeMeta(value);
        },
        log(scope, payload, meta) {
            return debugAdapter?.log?.(scope, payload, meta) || null;
        },
        event(scope, type, meta) {
            return debugAdapter?.event?.(scope, type, meta) || null;
        },
        list() {
            return queue.slice();
        },
        listDebug() {
            return debugAdapter?.list?.() || [];
        },
        clear() {
            queue.length = 0;
            debugAdapter?.clear?.();
        },
        isDebugEnabled() {
            return debugAdapter?.isEnabled?.() === true;
        },
        getDebugScopeFilter() {
            return debugAdapter?.getScope?.() || '';
        },
        setDebugScopeFilter(value = '') {
            return debugAdapter?.setScope?.(value) || '';
        },
        attachDebugAdapter(adapter) {
            debugAdapter = adapter || null;
            return debugAdapter;
        },
        enableDebug() {
            return debugAdapter?.enable?.() || false;
        },
        disableDebug() {
            return debugAdapter?.disable?.() || false;
        }
    };

    if (typeof window !== 'undefined') {
        window.errorBus = errorBus;
        window.addEventListener('error', function (event) {
            if (isIgnorableBrowserError(event.error || event.message)) {
                event.preventDefault?.();
                return;
            }
            errorBus.report('global', event.error || event.message || '脚本错误', {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });
        window.addEventListener('unhandledrejection', function (event) {
            if (isIgnorableBrowserError(event.reason)) return;
            errorBus.report('global', event.reason || '未处理的 Promise 拒绝');
        });

        // Capture page navigation / view changes if the app exposes setView etc.
        window.addEventListener('hashchange', () => debugAdapter?.capture?.('info', 'nav', ['hashchange → ' + location.hash]));
        window.addEventListener('popstate', () => debugAdapter?.capture?.('info', 'nav', ['popstate → ' + location.pathname + location.search]));
        document.addEventListener('visibilitychange', () => debugAdapter?.capture?.('info', 'nav', ['visibility → ' + document.visibilityState]));
    }
})();
