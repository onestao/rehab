(function () {
    const MAX_EVENTS = 200;
    const queue = [];
    let debugMode = false;
    const debugQueue = [];
    const MAX_DEBUG_EVENTS = 500;
    let consolePatched = false;
    let originalConsole = null;
    let fetchPatched = false;
    let originalFetch = null;

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

    function safeToast(message) {
        try {
            if (window.toast && typeof toast.show === 'function') toast.show(message, 'error');
        } catch {}
    }

    function safeStringify(value) {
        try {
            if (value === undefined) return 'undefined';
            if (value === null) return 'null';
            if (typeof value === 'string') return value;
            if (value instanceof Error) return (value.stack || value.message || String(value));
            if (typeof value === 'function') return '[Function]';
            const seen = new WeakSet();
            return JSON.stringify(value, (k, v) => {
                if (v && typeof v === 'object') {
                    if (seen.has(v)) return '[Circular]';
                    seen.add(v);
                    if (v instanceof Element) return `<${v.tagName?.toLowerCase() || 'el'}${v.id ? '#' + v.id : ''}>`;
                }
                return v;
            }).slice(0, 1000);
        } catch (e) {
            return String(value);
        }
    }

    function pushDebug(level, scope, args, extra) {
        if (!debugMode) return;
        try {
            const entry = {
                t: Date.now(),
                level: level || 'log',
                scope: scope || 'global',
                args: Array.isArray(args) ? args.map(safeStringify) : [safeStringify(args)],
                extra: extra || null
            };
            debugQueue.push(entry);
            while (debugQueue.length > MAX_DEBUG_EVENTS) debugQueue.shift();
            try { sessionStorage.setItem('rehabDebugBus', JSON.stringify(debugQueue.slice(-MAX_DEBUG_EVENTS))); } catch {}
        } catch {}
    }

    function patchConsole() {
        if (consolePatched) return;
        originalConsole = {
            log: console.log.bind(console),
            info: console.info.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
            debug: console.debug.bind(console)
        };
        ['log', 'info', 'warn', 'error', 'debug'].forEach(level => {
            console[level] = function (...args) {
                pushDebug(level, 'console', args);
                return originalConsole[level](...args);
            };
        });
        consolePatched = true;
    }

    function unpatchConsole() {
        if (!consolePatched || !originalConsole) return;
        Object.keys(originalConsole).forEach(level => {
            console[level] = originalConsole[level];
        });
        consolePatched = false;
        originalConsole = null;
    }

    function patchFetch() {
        if (fetchPatched || typeof fetch !== 'function') return;
        originalFetch = fetch.bind(window);
        window.fetch = function (...args) {
            const started = Date.now();
            const input = /** @type {any} */ (args[0]);
            const init = /** @type {any} */ (args[1]);
            const url = (input && typeof input === 'object' && input.url) || (typeof input === 'string' ? input : '') || '';
            const method = (init && init.method) || (input && typeof input === 'object' && input.method) || 'GET';
            return originalFetch(...args).then(res => {
                pushDebug('info', 'fetch', [`${method} ${url} → ${res.status} (${Date.now() - started}ms)`]);
                return res;
            }).catch(err => {
                pushDebug('error', 'fetch', [`${method} ${url} ✗ ${err?.message || err} (${Date.now() - started}ms)`]);
                throw err;
            });
        };
        fetchPatched = true;
    }

    function unpatchFetch() {
        if (!fetchPatched || !originalFetch) return;
        window.fetch = originalFetch;
        fetchPatched = false;
        originalFetch = null;
    }

    const errorBus = {
        report(scope, err, meta) {
            try {
                const error = normalizeError(err);
                const item = {
                    scope: scope || 'unknown',
                    message: friendlyMessage(error),
                    meta: meta || null,
                    at: new Date().toISOString(),
                    stack: error.stack || ''
                };
                queue.push(item);
                while (queue.length > MAX_EVENTS) queue.shift();
                if (consolePatched && originalConsole) originalConsole.error(`[${item.scope}]`, error, meta || '');
                else console.error(`[${item.scope}]`, error, meta || '');
                pushDebug('error', item.scope, [item.message, meta]);
                safeToast(item.message);
                return item;
            } catch (secondary) {
                console.error('[errorBus] report failed', secondary, err, meta || '');
                return null;
            }
        },
        log(scope, payload, meta) {
            // Lightweight diagnostic entry, only persisted when debug mode is on.
            if (!debugMode) return null;
            const item = {
                scope: scope || 'log',
                message: typeof payload === 'string' ? payload : safeStringify(payload),
                meta: meta || (typeof payload === 'object' ? payload : null),
                at: new Date().toISOString()
            };
            pushDebug('log', item.scope, [item.message], item.meta);
            return item;
        },
        list() {
            return queue.slice();
        },
        listDebug() {
            return debugQueue.slice();
        },
        clear() {
            queue.length = 0;
            debugQueue.length = 0;
            try { sessionStorage.removeItem('rehabDebugBus'); } catch {}
        },
        isDebugEnabled() {
            return debugMode;
        },
        enableDebug() {
            if (debugMode) return;
            debugMode = true;
            patchConsole();
            patchFetch();
            pushDebug('info', 'debug', ['debug bus enabled']);
        },
        disableDebug() {
            if (!debugMode) return;
            debugMode = false;
            unpatchConsole();
            unpatchFetch();
            debugQueue.length = 0;
            try { sessionStorage.removeItem('rehabDebugBus'); } catch {}
        }
    };

    if (typeof window !== 'undefined') {
        window.errorBus = errorBus;
        window.addEventListener('error', function (event) {
            errorBus.report('global', event.error || event.message || '脚本错误', {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });
        window.addEventListener('unhandledrejection', function (event) {
            errorBus.report('global', event.reason || '未处理的 Promise 拒绝');
        });

        // Capture page navigation / view changes if the app exposes setView etc.
        window.addEventListener('hashchange', () => pushDebug('info', 'nav', ['hashchange → ' + location.hash]));
        window.addEventListener('popstate', () => pushDebug('info', 'nav', ['popstate → ' + location.pathname + location.search]));
        document.addEventListener('visibilitychange', () => pushDebug('info', 'nav', ['visibility → ' + document.visibilityState]));
    }
})();
