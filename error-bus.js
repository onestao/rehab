(function () {
    const MAX_EVENTS = 100;
    const queue = [];

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
                console.error(`[${item.scope}]`, error, meta || '');
                safeToast(item.message);
                return item;
            } catch (secondary) {
                console.error('[errorBus] report failed', secondary, err, meta || '');
                return null;
            }
        },
        list() {
            return queue.slice();
        },
        clear() {
            queue.length = 0;
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
    }
})();
