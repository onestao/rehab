// @ts-nocheck
(function () {
    const active = new Set();

    function available(cfg) {
        return !!(cfg && typeof cfg === 'object' && String(cfg.url || '').trim());
    }

    function combineSignals(signal, controller) {
        if (signal?.aborted) controller.abort(signal.reason);
        if (signal) {
            const abort = () => controller.abort(signal.reason || new DOMException('Aborted', 'AbortError'));
            signal.addEventListener('abort', abort, { once: true });
            return () => signal.removeEventListener('abort', abort);
        }
        return () => {};
    }

    function playBlob(blob, signal, state) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(blob);
            const audio = new Audio();
            state.audio = audio;
            state.objectUrl = url;
            let settled = false;

            const cleanup = () => {
                audio.onended = null;
                audio.onerror = null;
                audio.pause();
                audio.removeAttribute('src');
                try { audio.load(); } catch {}
                URL.revokeObjectURL(url);
                state.audio = null;
                state.objectUrl = null;
                if (signal) signal.removeEventListener('abort', onAbort);
            };
            const finish = (fn, value) => {
                if (settled) return;
                settled = true;
                cleanup();
                fn(value);
            };
            const onAbort = () => finish(reject, new DOMException('Aborted', 'AbortError'));

            audio.onended = () => finish(resolve);
            audio.onerror = () => finish(reject, new Error('Legado audio playback failed'));
            if (signal) signal.addEventListener('abort', onAbort, { once: true });
            audio.src = url;
            audio.play().then(() => {
                if (signal?.aborted) onAbort();
            }).catch(error => finish(reject, error));
        });
    }

    function createEngine(cfg) {
        const engineCfg = cfg || {};
        const state = { controller: null, audio: null, objectUrl: null };
        return {
            id: engineCfg.id || engineCfg.name || 'legado',
            type: 'legado',
            name: engineCfg.name || 'Legado TTS',
            available: () => available(engineCfg),
            async speak(text, opts = {}) {
                if (!available(engineCfg)) throw new Error('Legado engine unavailable');
                this.cancel();
                const params = { text, rate: opts.rate, pitch: opts.pitch };
                const requestUrl = window.voiceEngine.renderUrl(engineCfg, params);
                const headers = window.voiceEngine.renderHeaders(engineCfg, params);
                const controller = new AbortController();
                state.controller = controller;
                active.add(this);
                const removeExternalAbort = combineSignals(opts.signal, controller);
                const timeoutMs = Number(engineCfg.timeoutMs || opts.timeoutMs || 4000);
                const timer = setTimeout(() => controller.abort(new Error('Legado TTS timeout')), timeoutMs);
                let blob = null;
                try {
                    const cacheKey = opts.cache && window.voiceCache?.keyFor
                        ? window.voiceCache.keyFor(engineCfg, text, params)
                        : '';
                    if (cacheKey && window.voiceCache?.get) {
                        try { blob = await window.voiceCache.get(cacheKey); } catch {}
                    }
                    if (!blob) {
                        const res = await fetch(requestUrl, { method: 'GET', headers, signal: controller.signal, cache: 'no-store' });
                        clearTimeout(timer);
                        if (!res.ok) throw new Error(`Legado TTS HTTP ${res.status}`);
                        blob = await res.blob();
                        if (cacheKey && window.voiceCache?.put) {
                            try { await window.voiceCache.put(cacheKey, blob); } catch {}
                        }
                    } else {
                        clearTimeout(timer);
                    }
                    await playBlob(blob, opts.signal || controller.signal, state);
                } finally {
                    clearTimeout(timer);
                    removeExternalAbort();
                    state.controller = null;
                    active.delete(this);
                }
            },
            cancel() {
                if (state.controller) state.controller.abort(new DOMException('Canceled', 'AbortError'));
                if (state.audio) {
                    state.audio.pause();
                    state.audio.removeAttribute('src');
                    try { state.audio.load(); } catch {}
                    state.audio = null;
                }
                if (state.objectUrl) {
                    URL.revokeObjectURL(state.objectUrl);
                    state.objectUrl = null;
                }
                active.delete(this);
            }
        };
    }

    const adapter = {
        cfg: null,
        available,
        createEngine,
        configure(cfg) {
            this.cfg = cfg;
            return this;
        },
        async speak(text, opts = {}) {
            return createEngine(opts.cfg || this.cfg).speak(text, opts);
        },
        cancel() {
            Array.from(active).forEach(engine => engine.cancel());
        }
    };

    window.voiceLegadoAdapter = adapter;
})();
