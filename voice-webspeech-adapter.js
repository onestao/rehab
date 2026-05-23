// @ts-nocheck
(function () {
    const adapter = {
        id: 'webspeech',
        type: 'webspeech',
        name: '本地语音',
        _speechWatchdog: null,
        _currentResolve: null,
        _currentReject: null,

        available() {
            return !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
        },

        speak(text, opts = {}) {
            if (!this.available()) return Promise.reject(new Error('Web Speech unavailable'));
            this.cancel();
            return new Promise((resolve, reject) => {
                let settled = false;
                const utterance = new SpeechSynthesisUtterance(String(text || ''));
                const silentAudio = document.getElementById('silentAudio');
                const finish = (fn, value) => {
                    if (settled) return;
                    settled = true;
                    clearInterval(this._speechWatchdog);
                    this._speechWatchdog = null;
                    this._currentResolve = null;
                    this._currentReject = null;
                    if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
                    fn(value);
                };
                const onAbort = () => {
                    window.speechSynthesis.cancel();
                    finish(reject, new DOMException('Aborted', 'AbortError'));
                };

                this._currentResolve = () => finish(resolve);
                this._currentReject = error => finish(reject, error);
                utterance.lang = opts.lang || 'zh-CN';
                utterance.rate = parseFloat(opts.rate || 1.1);
                utterance.volume = 1;
                utterance.pitch = parseFloat(opts.pitch || 1.05);
                utterance.onend = () => finish(resolve);
                utterance.onerror = event => finish(reject, event?.error ? new Error(String(event.error)) : new Error('Web Speech failed'));

                if (opts.signal) {
                    if (opts.signal.aborted) {
                        onAbort();
                        return;
                    }
                    opts.signal.addEventListener('abort', onAbort, { once: true });
                }

                this._speechWatchdog = setInterval(() => {
                    try { window.speechSynthesis.resume(); } catch {}
                    try { silentAudio?.play?.().catch(() => {}); } catch {}
                }, 2500);
                try { silentAudio?.play?.().catch(() => {}); } catch {}
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(utterance);
            });
        },

        cancel() {
            clearInterval(this._speechWatchdog);
            this._speechWatchdog = null;
            try { window.speechSynthesis?.cancel?.(); } catch {}
            if (this._currentResolve) {
                const resolve = this._currentResolve;
                this._currentResolve = null;
                this._currentReject = null;
                resolve();
            }
        }
    };

    window.voiceWebSpeechAdapter = adapter;
})();
