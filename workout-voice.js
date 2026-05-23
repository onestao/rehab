// @ts-nocheck
(function () {
    const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=';

    const workoutVoice = {
        _engines: [],
        _chain: [],
        _controller: null,
        _ducked: null,
        _unlocked: false,

        init(engineList) {
            const voice = window.voiceEngine.normalizeVoiceConfig({
                ...(data?.db?.voice || {}),
                engines: Array.isArray(engineList) ? engineList : data?.db?.voice?.engines
            });
            if (data?.db) data.db.voice = voice;
            this._chain = window.voiceEngine.resolveEngineChain(voice.priority, voice.engines);
            this._engines = this._chain.map(item => {
                if (item.type === 'webspeech') return window.voiceWebSpeechAdapter;
                return window.voiceLegadoAdapter.createEngine(item.engine);
            }).filter(Boolean);
            this.postLegadoHosts(voice.engines);
            return this._engines;
        },

        postLegadoHosts(engines = []) {
            const hosts = [];
            engines.forEach(engine => {
                try {
                    const url = new URL(engine.url, location.href);
                    hosts.push(url.hostname);
                } catch {}
            });
            try {
                navigator.serviceWorker?.controller?.postMessage({ type: 'VOICE_TTS_HOSTS', hosts });
                navigator.serviceWorker?.ready?.then(reg => reg.active?.postMessage({ type: 'VOICE_TTS_HOSTS', hosts })).catch(() => {});
            } catch {}
        },

        unlockAudio() {
            if (this._unlocked) return;
            this._unlocked = true;
            try {
                const audio = new Audio(SILENT_WAV);
                audio.muted = true;
                audio.play().then(() => {
                    audio.pause();
                    audio.removeAttribute('src');
                }).catch(() => {});
            } catch {}
        },

        beginDucking() {
            this.restoreDucking();
            if (typeof document === 'undefined') return;
            const items = [];
            document.querySelectorAll('audio,video').forEach(el => {
                if (el.id === 'silentAudio' || el.paused || el.muted) return;
                items.push({ el, volume: el.volume });
                el.volume = Math.min(Number(el.volume || 0), 0.15);
            });
            this._ducked = items;
        },

        restoreDucking() {
            const items = this._ducked || [];
            this._ducked = null;
            items.forEach(item => {
                try { item.el.volume = item.volume; } catch {}
            });
        },

        descriptorsForOptions(opts = {}) {
            const voice = window.voiceEngine.normalizeVoiceConfig(data?.db?.voice || {});
            if (Number.isInteger(opts.engineIndex)) {
                const engine = voice.engines[opts.engineIndex];
                return engine ? [{ type: 'legado', id: engine.id || `legado-${opts.engineIndex + 1}`, index: opts.engineIndex, engine }] : [];
            }
            return window.voiceEngine.resolveEngineChain(voice.priority, voice.engines);
        },

        makeRuntimeEngine(descriptor) {
            if (descriptor.type === 'webspeech') return window.voiceWebSpeechAdapter;
            return window.voiceLegadoAdapter.createEngine(descriptor.engine);
        },

        async speak(text, opts = {}) {
            if (!text) return { status: 'empty' };
            this.cancel();
            const started = performance.now();
            const controller = new AbortController();
            this._controller = controller;
            const voice = window.voiceEngine.normalizeVoiceConfig(data?.db?.voice || {});
            const descriptors = this.descriptorsForOptions(opts);
            this.beginDucking();
            let lastError = null;
            try {
                for (const descriptor of descriptors) {
                    if (controller.signal.aborted || opts.signal?.aborted) return { status: 'canceled' };
                    const engine = this.makeRuntimeEngine(descriptor);
                    if (!engine?.available?.(descriptor.engine)) continue;
                    try {
                        const mergedOpts = {
                            ...opts,
                            rate: opts.rate ?? data?.db?.rate ?? 1.1,
                            pitch: opts.pitch ?? 1.05,
                            timeoutMs: voice.timeoutMs,
                            cache: voice.cache,
                            signal: controller.signal
                        };
                        await engine.speak(String(text), mergedOpts);
                        return {
                            status: 'ok',
                            engineId: descriptor.id || engine.id,
                            elapsedMs: Math.round(performance.now() - started)
                        };
                    } catch (error) {
                        lastError = error;
                        if (controller.signal.aborted || opts.signal?.aborted) return { status: 'canceled' };
                    }
                }
                console.warn('workoutVoice: all engines failed', lastError?.message || lastError || 'unknown');
                return { status: 'failed', error: lastError };
            } finally {
                if (this._controller === controller) this._controller = null;
                this.restoreDucking();
            }
        },

        cancel() {
            if (this._controller) {
                try { this._controller.abort(new DOMException('Canceled', 'AbortError')); } catch { this._controller.abort(); }
                this._controller = null;
            }
            this._engines.forEach(engine => {
                try { engine.cancel?.(); } catch {}
            });
            try { window.voiceWebSpeechAdapter?.cancel?.(); } catch {}
            try { window.voiceLegadoAdapter?.cancel?.(); } catch {}
            this.restoreDucking();
        },

        ensureVoiceDb() {
            if (!data?.db) return window.voiceEngine.normalizeVoiceConfig({});
            data.db.voice = window.voiceEngine.normalizeVoiceConfig(data.db.voice);
            return data.db.voice;
        },

        saveSettings(options = {}) {
            const voice = this.ensureVoiceDb();
            const priorityEl = document.querySelector('input[name="voicePriority"]:checked');
            const cacheEl = document.getElementById('voiceCacheEnabled');
            const timeoutEl = document.getElementById('voiceTimeoutMs');
            voice.priority = priorityEl?.value || voice.priority;
            voice.cache = cacheEl ? !!cacheEl.checked : voice.cache;
            voice.timeoutMs = Math.max(1000, parseInt(timeoutEl?.value, 10) || 4000);
            data.save({ render: false, sync: false });
            this.init();
            if (options.render !== false) this.renderSettingsUI();
        },

        setStatus(message, type = '') {
            const el = document.getElementById('voiceImportStatus');
            if (!el) return;
            el.textContent = message || '';
            el.dataset.type = type;
        },

        setTestResult(message, type = '') {
            const el = document.getElementById('voiceTestResult');
            if (!el) return;
            el.textContent = message || '';
            el.dataset.type = type;
        },

        openSettings() {
            this.renderSettingsUI();
            const sheet = document.getElementById('voiceSettingsSheet');
            if (!sheet) return;
            sheet.classList.remove('hidden');
            sheet.setAttribute('aria-hidden', 'false');
            if (window.focusTrap?.trap) window.focusTrap.trap(sheet);
        },

        closeSettings() {
            const sheet = document.getElementById('voiceSettingsSheet');
            if (!sheet) return;
            sheet.classList.add('hidden');
            sheet.setAttribute('aria-hidden', 'true');
            this.cancelEngineEdit();
            if (window.focusTrap?.release) window.focusTrap.release();
        },

        voiceModeMeta(voice = this.ensureVoiceDb()) {
            const count = Array.isArray(voice.engines) ? voice.engines.length : 0;
            const mode = voice.priority;
            if (mode === 'online-first') {
                return { mode, title: '在线优先', detail: count ? `${count} 个在线音源，失败后回退本地` : '未导入在线音源，实际使用本地' };
            }
            if (mode === 'local-first') {
                return { mode, title: '本地优先', detail: count ? `先用本地，失败后尝试 ${count} 个在线音源` : '仅本地 Web Speech 可用' };
            }
            if (mode === 'online-only') {
                return { mode, title: '仅在线', detail: count ? `${count} 个在线音源` : '未导入在线音源' };
            }
            return { mode: 'local-only', title: '仅本地', detail: 'Web Speech API' };
        },

        validateLegadoJson() {
            const input = document.getElementById('voiceLegadoJson');
            try {
                const result = window.voiceEngine.parseLegadoConfigWithWarnings(input?.value || '');
                const warningText = result.warnings.length ? `；${result.warnings.map(w => w.message).join('；')}` : '';
                this.setStatus(`校验通过：${result.engines.length} 个在线引擎${warningText}`, result.warnings.length ? 'warn' : 'ok');
                if (result.warnings.length && window.toast?.show) toast.show(result.warnings[0].message, 'warning');
                return result;
            } catch (error) {
                this.setStatus(error.message || String(error), 'error');
                return null;
            }
        },

        importLegadoJson() {
            const result = this.validateLegadoJson();
            if (!result) return;
            const voice = this.ensureVoiceDb();
            voice.engines = voice.engines.concat(result.engines);
            data.save({ render: false, sync: false });
            this.init();
            this.renderSettingsUI();
            if (window.toast?.show) toast.show('语音引擎已导入', 'success');
        },

        exportEngines() {
            const voice = this.ensureVoiceDb();
            const blob = new Blob([JSON.stringify(voice.engines || [], null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `rehab-legado-tts-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        },

        moveEngine(index, delta) {
            const voice = this.ensureVoiceDb();
            const next = index + delta;
            if (next < 0 || next >= voice.engines.length) return;
            [voice.engines[index], voice.engines[next]] = [voice.engines[next], voice.engines[index]];
            data.save({ render: false, sync: false });
            this.init();
            this.renderSettingsUI();
        },

        deleteEngine(index) {
            const voice = this.ensureVoiceDb();
            voice.engines.splice(index, 1);
            data.save({ render: false, sync: false });
            this.init();
            this.renderSettingsUI();
        },

        stripTemplateBraces(value) {
            const decoded = (() => {
                try { return decodeURIComponent(String(value || '')); } catch { return String(value || ''); }
            })();
            const match = decoded.match(/^\s*\{\{\s*([\s\S]*?)\s*\}\}\s*$/);
            return match ? match[1] : decoded;
        },

        wrapTemplateExpression(value) {
            const text = String(value || '').trim();
            if (!text) return '';
            return /^\s*\{\{[\s\S]*\}\}\s*$/.test(text) ? text : `{{${text}}}`;
        },

        extractSpeedConfig(urlText) {
            const raw = String(urlText || '');
            try {
                const parsed = new URL(raw, location.href);
                for (const [key, value] of parsed.searchParams.entries()) {
                    const expr = this.stripTemplateBraces(value);
                    if (expr.includes('speakSpeed')) return { param: key, expression: expr };
                }
            } catch {}
            const match = raw.match(/[?&]([^=&#]+)=([^&#]*speakSpeed[^&#]*)/);
            if (!match) return { param: '', expression: '' };
            return { param: decodeURIComponent(match[1]), expression: this.stripTemplateBraces(match[2]) };
        },

        applySpeedConfig(urlText, param, expression) {
            const raw = String(urlText || '').trim();
            const key = String(param || '').trim();
            const expr = this.wrapTemplateExpression(expression);
            if (!raw || !key || !expr) return raw;
            const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(`([?&]${escaped}=)[^&#]*`);
            if (re.test(raw)) return raw.replace(re, (_match, prefix) => `${prefix}${expr}`);
            return `${raw}${raw.includes('?') ? '&' : '?'}${encodeURIComponent(key)}=${expr}`;
        },

        openEngineEditor(index) {
            const voice = this.ensureVoiceDb();
            const engine = voice.engines[index];
            if (!engine) return;
            const editor = document.getElementById('voiceEngineEditor');
            const title = document.getElementById('voiceEditorTitle');
            const idx = document.getElementById('voiceEditingIndex');
            const name = document.getElementById('voiceEditName');
            const url = document.getElementById('voiceEditUrl');
            const speedParam = document.getElementById('voiceEditSpeedParam');
            const speedExpr = document.getElementById('voiceEditSpeedExpr');
            const type = document.getElementById('voiceEditContentType');
            const header = document.getElementById('voiceEditHeader');
            if (!editor || !idx || !name || !url || !speedParam || !speedExpr || !type || !header) return;
            const speed = this.extractSpeedConfig(engine.url || '');
            if (title) title.textContent = `编辑音源 ${index + 1}`;
            idx.value = String(index);
            name.value = engine.name || '';
            url.value = engine.url || '';
            speedParam.value = speed.param || '';
            speedExpr.value = speed.expression || '';
            type.value = engine.contentType || '';
            header.value = engine.header && Object.keys(engine.header).length
                ? JSON.stringify(engine.header, null, 2)
                : '';
            editor.classList.remove('hidden');
            name.focus?.();
        },

        cancelEngineEdit() {
            const editor = document.getElementById('voiceEngineEditor');
            if (!editor) return;
            editor.classList.add('hidden');
            ['voiceEditingIndex', 'voiceEditName', 'voiceEditUrl', 'voiceEditSpeedParam', 'voiceEditSpeedExpr', 'voiceEditContentType', 'voiceEditHeader'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        },

        saveEngineEdit() {
            const voice = this.ensureVoiceDb();
            const index = parseInt(document.getElementById('voiceEditingIndex')?.value, 10);
            const engine = voice.engines[index];
            if (!engine) return;
            const name = String(document.getElementById('voiceEditName')?.value || '').trim();
            const rawUrl = String(document.getElementById('voiceEditUrl')?.value || '').trim();
            const speedParam = String(document.getElementById('voiceEditSpeedParam')?.value || '').trim();
            const speedExpr = String(document.getElementById('voiceEditSpeedExpr')?.value || '').trim();
            const url = this.applySpeedConfig(rawUrl, speedParam, speedExpr);
            const contentType = String(document.getElementById('voiceEditContentType')?.value || '').trim();
            const headerText = String(document.getElementById('voiceEditHeader')?.value || '').trim();
            if (!url) {
                this.setStatus('URL 不能为空', 'error');
                return;
            }
            let header = {};
            if (headerText) {
                try {
                    const parsed = JSON.parse(headerText);
                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                        Object.keys(parsed).forEach(key => {
                            if (parsed[key] != null) header[String(key)] = String(parsed[key]);
                        });
                    } else {
                        throw new Error('Header JSON 必须是对象');
                    }
                } catch (error) {
                    this.setStatus(error.message || 'Header JSON 解析失败', 'error');
                    return;
                }
            }
            voice.engines[index] = { ...engine, name: name || `Legado ${index + 1}`, url, contentType, header };
            data.save({ render: false, sync: false });
            this.init();
            this.cancelEngineEdit();
            this.renderSettingsUI();
            if (window.toast?.show) toast.show('音源已保存', 'success');
        },

        async testEngine(index) {
            const text = document.getElementById('voiceTestText')?.value || '测试，一二三';
            this.setTestResult('测试中...', '');
            const result = await this.speak(text, { engineIndex: index, rate: data?.db?.rate || 1.1 });
            this.setTestResult(`${result.engineId || `legado-${index + 1}`} / ${result.elapsedMs || 0}ms / ${result.status}`, result.status === 'ok' ? 'ok' : 'error');
        },

        async testCurrent() {
            const text = document.getElementById('voiceTestText')?.value || '测试，一二三';
            this.saveSettings({ render: false });
            this.setTestResult('测试中...', '');
            const result = await this.speak(text, { rate: data?.db?.rate || 1.1 });
            this.setTestResult(`${result.engineId || '-'} / ${result.elapsedMs || 0}ms / ${result.status}`, result.status === 'ok' ? 'ok' : 'error');
        },

        async clearCache() {
            try {
                await window.voiceCache?.clear?.();
                if (window.toast?.show) toast.show('语音缓存已清空', 'success');
            } catch (error) {
                if (window.toast?.show) toast.show(`清空缓存失败：${toast.sanitize(error)}`, 'error');
            }
        },

        renderSettingsUI() {
            const voice = this.ensureVoiceDb();
            const cacheEl = document.getElementById('voiceCacheEnabled');
            const timeoutEl = document.getElementById('voiceTimeoutMs');
            const meta = this.voiceModeMeta(voice);
            const trigger = document.getElementById('voiceTtsButton');
            const modeCard = document.getElementById('voiceModeCard');
            const modeTitle = document.getElementById('voiceModeTitle');
            const modeDetail = document.getElementById('voiceModeDetail');
            if (trigger) {
                trigger.dataset.mode = meta.mode;
                trigger.title = `TTS：${meta.title}`;
            }
            if (modeCard) modeCard.dataset.mode = meta.mode;
            if (modeTitle) modeTitle.textContent = meta.title;
            if (modeDetail) modeDetail.textContent = meta.detail;
            document.querySelectorAll('input[name="voicePriority"]').forEach(input => {
                input.checked = input.value === voice.priority;
            });
            if (cacheEl) cacheEl.checked = !!voice.cache;
            if (timeoutEl) timeoutEl.value = voice.timeoutMs;

            const list = document.getElementById('voiceEngineList');
            if (!list) return;
            list.textContent = '';
            if (!voice.engines.length) {
                const empty = document.createElement('div');
                empty.className = 'voice-empty';
                empty.textContent = '未导入在线引擎，默认使用本地语音。';
                list.appendChild(empty);
                return;
            }
            voice.engines.forEach((engine, index) => {
                const item = document.createElement('div');
                item.className = 'voice-engine-item';
                const main = document.createElement('div');
                main.className = 'voice-engine-main';
                const name = document.createElement('strong');
                name.textContent = engine.name || `Legado ${index + 1}`;
                const host = document.createElement('small');
                try { host.textContent = new URL(engine.url, location.href).host; } catch { host.textContent = 'URL 无效'; }
                main.appendChild(name);
                main.appendChild(host);
                const speed = this.extractSpeedConfig(engine.url || '');
                if (speed.param && speed.expression) {
                    const speedMeta = document.createElement('small');
                    speedMeta.textContent = `${speed.param} = ${speed.expression}`;
                    main.appendChild(speedMeta);
                }
                const actions = document.createElement('div');
                actions.className = 'voice-engine-actions';
                [
                    ['expand_less', '上移', () => this.moveEngine(index, -1)],
                    ['expand_more', '下移', () => this.moveEngine(index, 1)],
                    ['edit', '编辑', () => this.openEngineEditor(index)],
                    ['volume_up', '测试朗读', () => this.testEngine(index)],
                    ['delete', '删除', () => this.deleteEngine(index)]
                ].forEach(([icon, label, onClick]) => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'icon-btn';
                    btn.title = label;
                    btn.setAttribute('aria-label', label);
                    const span = document.createElement('span');
                    span.className = 'material-symbols-rounded';
                    span.textContent = icon;
                    btn.appendChild(span);
                    btn.addEventListener('click', onClick);
                    actions.appendChild(btn);
                });
                item.appendChild(main);
                item.appendChild(actions);
                list.appendChild(item);
            });
        }
    };

    window.workoutVoice = workoutVoice;
})();
