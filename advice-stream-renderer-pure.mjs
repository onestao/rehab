/**
 * Scheduler decides how many chars to flush per frame.
 * @param {{ raf: (cb: () => void) => any, now: () => number }} deps
 */
export function createScheduler(deps) {
    let mode = 'live'; // 'live' | 'paused' | 'fast'
    let chunkPerFrame = 8;
    let scheduled = false;

    function setMode(next) {
        mode = next;
    }

    function tick(bufferLen) {
        if (mode === 'paused') return 0;
        if (mode === 'fast') return bufferLen;
        return Math.min(bufferLen, chunkPerFrame);
    }

    function schedule(fn) {
        if (scheduled) return;
        scheduled = true;
        deps.raf(() => {
            scheduled = false;
            fn();
        });
    }

    return {
        setMode,
        tick,
        schedule,
        getMode: () => mode,
        setChunkPerFrame: (n) => { chunkPerFrame = Math.max(1, Number(n) || 8); }
    };
}

export function pendingAccumulatedSuffix(state, accumulated) {
    const target = String(accumulated || '');
    const shown = String(state?.shown || '');
    const buffer = String(state?.buffer || '');
    const expected = shown + buffer;
    return target.startsWith(expected) ? target.slice(expected.length) : null;
}
