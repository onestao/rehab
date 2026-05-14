/** @param {unknown} err */
export function normalizeError(err) {
    if (err instanceof Error) return err;
    if (typeof err === 'string') return new Error(err);
    if (err && typeof err === 'object' && 'message' in err) return new Error(String(err.message));
    return new Error('未知错误');
}

/** @param {Error|unknown} err */
export function mapFriendlyMessage(err) {
    const message = String(err instanceof Error ? err.message : err || '未知错误');
    if (/Failed to fetch|NetworkError|Load failed|fetch/i.test(message)) return '网络异常，请稍后再试';
    return message || '发生未知错误';
}

export function createErrorBus(max = 100) {
    const queue = [];
    return {
        report(scope, err, meta) {
            const error = normalizeError(err);
            const item = {
                scope: scope || 'unknown',
                message: mapFriendlyMessage(error),
                meta: meta || null,
                at: new Date().toISOString(),
                stack: error.stack || ''
            };
            queue.push(item);
            while (queue.length > max) queue.shift();
            return item;
        },
        list() { return queue.slice(); },
        clear() { queue.length = 0; }
    };
}
