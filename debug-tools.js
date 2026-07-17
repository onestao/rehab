// @ts-nocheck
(function () {
    if (window.debugTools) return;

    const STORAGE_KEY = 'rehab_debug_tools';
    const OVERLAY_ID = 'adviceDebugOverlay';
    const FAB_ID = 'adviceDebugFab';
    const extensions = new Map();

    let errorBusDebugAdapter = null;

    function createErrorBusDebugAdapter() {
    let debugMode = false;
    const debugQueue = [];
    const MAX_DEBUG_EVENTS = 500;
    const priorityDebugQueue = [];
    const MAX_PRIORITY_DEBUG_EVENTS = 200;
    let debugScopeFilter = '';
    let debugScopePatterns = [];
    let consolePatched = false;
    let originalConsole = null;
    let fetchPatched = false;
    let originalFetch = null;

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

    function sanitizeMeta(value) {
        return window.errorBus?.sanitizeDebugMeta?.(value) ?? value;
    }

    function normalizeDebugScopeFilter(value = '') {
        return String(value || '').split(/[\s,，]+/).map(item => item.trim()).filter(Boolean).slice(0, 12);
    }

    function setDebugScopeFilterValue(value = '', persist = true) {
        debugScopePatterns = normalizeDebugScopeFilter(value);
        debugScopeFilter = debugScopePatterns.join(',');
        if (persist) {
            try {
                if (debugScopeFilter) localStorage.setItem('rehab_debug_scope_filter', debugScopeFilter);
                else localStorage.removeItem('rehab_debug_scope_filter');
            } catch {}
        }
        return debugScopeFilter;
    }

    function debugScopeAllowed(scope = 'global') {
        if (!debugScopePatterns.length) return true;
        const value = String(scope || 'global');
        return debugScopePatterns.some((pattern) => pattern.endsWith('*') ? value.startsWith(pattern.slice(0, -1)) : value === pattern);
    }

    try { setDebugScopeFilterValue(localStorage.getItem('rehab_debug_scope_filter') || '', false); } catch {}

    function pushDebug(level, scope, args, extra) {
        if (!debugMode) return;
        try {
            const scopeName = String(scope || 'global');
            if (!debugScopeAllowed(scopeName)) return;
            const priority = /^plan-ai$|^plan-auto-adjust$|^ai[\w:-]*/.test(scopeName);
            const entry = {
                t: Date.now(),
                level: level || 'log',
                scope: scopeName,
                args: Array.isArray(args) ? args.map(safeStringify) : [safeStringify(args)],
                extra: extra || null,
                priority: priority || undefined
            };
            debugQueue.push(entry);
            while (debugQueue.length > MAX_DEBUG_EVENTS) debugQueue.shift();
            if (priority) {
                priorityDebugQueue.push(entry);
                while (priorityDebugQueue.length > MAX_PRIORITY_DEBUG_EVENTS) priorityDebugQueue.shift();
            }
            try { sessionStorage.setItem('rehabDebugBus', JSON.stringify(debugQueue.slice(-MAX_DEBUG_EVENTS))); } catch {}
            try { sessionStorage.setItem('rehabPriorityDebugBus', JSON.stringify(priorityDebugQueue.slice(-MAX_PRIORITY_DEBUG_EVENTS))); } catch {}
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
            const url = window.errorBus?.sanitizeDebugUrl?.((input && typeof input === 'object' && input.url) || (typeof input === 'string' ? input : '') || '') || '';
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

    let layoutWatcherStop = null;

    function collectLayoutSamples(page) {
        const samples = {};
        if (!page) return samples;
        const seen = new Set();
        const push = (el, prefix) => {
            if (!el || seen.has(el)) return;
            seen.add(el);
            const r = el.getBoundingClientRect();
            if (!r.width && !r.height) return;
            const cls = (el.className || '').toString().slice(0, 50).replace(/\s+/g, '.');
            const id = el.id ? '#' + el.id : '';
            const tag = el.tagName ? el.tagName.toLowerCase() : '';
            const name = `${prefix}:${tag}${id}.${cls}`.slice(0, 90);
            if (samples[name]) return;
            samples[name] = `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}`;
            if (Object.keys(samples).length >= 25) throw new Error('__SAMPLES_FULL__');
        };
        try {
            // 1) Direct children of the page (top-level layout slots).
            Array.from(page.children).forEach((c, i) => push(c, `child${i}`));

            // 2) Every sticky / fixed positioned descendant.
            page.querySelectorAll('*').forEach(el => {
                if (Object.keys(samples).length >= 25) throw new Error('__SAMPLES_FULL__');
                try {
                    const cs = getComputedStyle(el);
                    if (cs.position === 'sticky' || cs.position === 'fixed') push(el, 'pos');
                } catch {}
            });

            // 3) Frequently-shifted UI: docks, bars, fabs, action rows, big buttons that act as primary CTA.
            page.querySelectorAll('.dock, [class*="dock"], [class*="-bar"], [class*="-actions"], [class*="-fab"], .fab, .quick-dock, .ai-input, .composer, .advice-scroll-rail, .global-training-bar, .workout-fab, .start-btn, .primary-action, button.primary')
                .forEach(el => push(el, 'tag'));
        } catch (e) {
            if (e?.message !== '__SAMPLES_FULL__') {
                pushDebug('warn', 'layout-collect', [String(e?.message || e)]);
            }
        }
        return samples;
    }

    function startLayoutWatcher() {
        if (layoutWatcherStop) return;
        if (typeof document === 'undefined' || typeof MutationObserver !== 'function') return;

        const sample = (page, label) => {
            if (!page) return null;
            const id = page.id || '?';
            const samples = collectLayoutSamples(page);
            const pageRect = page.getBoundingClientRect();
            pushDebug('info', 'layout', [`${label} page=${id} samples=${Object.keys(samples).length}`], {
                pageRect: `${Math.round(pageRect.left)},${Math.round(pageRect.top)} ${Math.round(pageRect.width)}×${Math.round(pageRect.height)}`,
                pageScrollTop: page.scrollTop || 0,
                windowScrollY: window.scrollY || 0,
                viewport: `${window.innerWidth}×${window.innerHeight}`,
                samples
            });
            return samples;
        };

        const compareSamples = (before, after) => {
            const diffs = [];
            const beforeMap = new Map(Object.entries(before || {}));
            for (const [key, val] of Object.entries(after || {})) {
                const prev = beforeMap.get(key);
                if (prev && prev !== val) diffs.push(`${key} : ${prev} → ${val}`);
                else if (!prev) diffs.push(`${key} : (新增) ${val}`);
            }
            for (const [key, val] of beforeMap) {
                if (!(key in (after || {}))) diffs.push(`${key} : ${val} → (消失)`);
            }
            return diffs;
        };

        const onPageChange = (newPage) => {
            const id = newPage?.id || '?';
            const t0 = window.performance?.now?.() || Date.now();
            const initialSamples = sample(newPage, 'activate frame=0');
            requestAnimationFrame(() => {
                sample(newPage, 'activate frame=1');
                requestAnimationFrame(() => {
                    sample(newPage, 'activate frame=2');
                    setTimeout(() => {
                        const settled = sample(newPage, 'activate frame=settled');
                        const diffs = compareSamples(initialSamples, settled);
                        if (diffs.length) {
                            pushDebug('warn', 'layout-shift', [`page=${id} 切换后 ${diffs.length} 处位置变化 (耗时 ${Math.round((window.performance?.now?.() || Date.now()) - t0)}ms)`], { diffs });
                        }
                    }, 350);
                });
            });
        };

        const pageObservers = [];
        document.querySelectorAll('.page').forEach(page => {
            const observer = new MutationObserver(records => {
                for (const r of records) {
                    if (r.type === 'attributes' && r.attributeName === 'class') {
                        if (page.classList.contains('active')) onPageChange(page);
                    }
                }
            });
            observer.observe(page, { attributes: true, attributeFilter: ['class'] });
            pageObservers.push(observer);
        });

        layoutWatcherStop = () => {
            pageObservers.forEach(o => o.disconnect());
        };
    }

    function stopLayoutWatcher() {
        if (layoutWatcherStop) {
            try { layoutWatcherStop(); } catch {}
            layoutWatcherStop = null;
        }
    }

        return {
            capture: pushDebug,
            log(scope, payload, meta) {
                if (!debugMode) return null;
                const item = { scope: scope || 'log', message: typeof payload === 'string' ? payload : safeStringify(payload), meta: sanitizeMeta(meta || (typeof payload === 'object' ? payload : null)), at: new Date().toISOString() };
                pushDebug('log', item.scope, [item.message], item.meta);
                return item;
            },
            event(scope, type, meta) {
                if (!debugMode) return null;
                const safeMeta = sanitizeMeta(meta || {});
                pushDebug('info', scope || 'event', [String(type || 'event')], safeMeta);
                return { scope: scope || 'event', type: String(type || 'event'), meta: safeMeta, at: new Date().toISOString() };
            },
            list() { return Array.from(new Set([...debugQueue, ...priorityDebugQueue])).sort((a, b) => (a.t || 0) - (b.t || 0)); },
            clear() {
                debugQueue.length = 0;
                priorityDebugQueue.length = 0;
                try { sessionStorage.removeItem('rehabDebugBus'); } catch {}
                try { sessionStorage.removeItem('rehabPriorityDebugBus'); } catch {}
            },
            isEnabled() { return debugMode; },
            getScope() { return debugScopeFilter; },
            setScope(value = '') {
                const next = setDebugScopeFilterValue(value);
                this.clear();
                pushDebug('info', 'debug', [next ? `debug scope filter=${next}` : 'debug scope filter cleared']);
                return next;
            },
            enable() {
                if (debugMode) return true;
                debugMode = true;
                patchConsole();
                patchFetch();
                startLayoutWatcher();
                pushDebug('info', 'debug', ['debug bus enabled']);
                return true;
            },
            disable() {
                if (!debugMode) return false;
                debugMode = false;
                unpatchConsole();
                unpatchFetch();
                stopLayoutWatcher();
                this.clear();
                return false;
            }
        };
    }

    function ensureErrorBusDebugAdapter() {
        if (!errorBusDebugAdapter) errorBusDebugAdapter = createErrorBusDebugAdapter();
        window.errorBus?.attachDebugAdapter?.(errorBusDebugAdapter);
        return errorBusDebugAdapter;
    }


    function hostOf(target) {
        return target || window.data || null;
    }

    function setHostEnabled(target, enabled) {
        const host = hostOf(target);
        if (host) host._debugToolsEnabled = !!enabled;
        return host;
    }

    function refreshHost(target) {
        const host = hostOf(target);
        host?.rerenderAdvicePanel?.();
        host?.renderProfilePage?.();
    }

    function report(scope, err, meta) {
        try { window.errorBus?.report?.(scope, err, meta); } catch {}
    }

    function registerExtension(extension = {}) {
        const name = String(extension.name || '').trim();
        if (!name) return false;
        extensions.set(name, extension);
        return true;
    }

    async function runExtensionHook(hook) {
        for (const extension of extensions.values()) {
            if (typeof extension[hook] !== 'function') continue;
            try {
                await extension[hook]();
            } catch (e) {
                report('debug.extension', e, { name: extension.name || 'unknown', hook });
            }
        }
    }

    function recordsFromErrorBus() {
        const errors = window.errorBus?.list?.() || [];
        const debugEntries = window.errorBus?.listDebug?.() || [];
        return [
            ...errors.map(e => ({
                t: Date.parse(e.at) || 0,
                iso: e.at || new Date().toISOString(),
                level: 'error',
                scope: e.scope || 'unknown',
                message: e.message || '',
                meta: e.meta || null,
                stack: e.stack || null
            })),
            ...debugEntries.map(d => ({
                t: d.t || 0,
                iso: new Date(d.t || Date.now()).toISOString(),
                level: d.level || 'log',
                scope: d.scope || 'global',
                message: Array.isArray(d.args) ? d.args.join(' ') : String(d.args || ''),
                meta: d.extra || null,
                stack: null
            }))
        ].sort((a, b) => a.t - b.t);
    }

    function copyText(text, ok, status) {
        const done = () => { status.textContent = ok; };
        try {
            if (window.navigator?.clipboard?.writeText) {
                return window.navigator.clipboard.writeText(text).then(done).catch(fallback);
            }
        } catch {}
        fallback();
        function fallback() {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;left:-9999px';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch {}
            ta.remove();
            done();
        }
    }

    function recordText(records) {
        return records.map((r, i) => {
            const meta = r.meta ? '\nmeta: ' + (typeof r.meta === 'string' ? r.meta : JSON.stringify(r.meta)) : '';
            return '#' + i + ' ' + new Date(r.t).toLocaleTimeString() + ' [' + r.level + '] ' + r.scope + '\nmsg: ' + r.message + meta;
        }).join('\n\n');
    }

    function makeButton(label, bg, fn) {
        const button = document.createElement('button');
        button.textContent = label;
        button.style.cssText = 'background:' + bg + ';color:' + (bg === '#fff' ? '#000' : '#fff') + ';border:0;padding:4px 10px;border-radius:4px;font-size:12px';
        button.onclick = fn;
        return button;
    }

    function showOverlay() {
        try {
            const existing = document.getElementById(OVERLAY_ID);
            if (existing) { existing.remove(); return; }

            const records = recordsFromErrorBus();
            const planAiRecords = records.filter(r => r.scope === 'plan-ai');
            const scopeFilter = window.errorBus?.getDebugScopeFilter?.() || '';
            const ndjson = records.map(r => JSON.stringify(r)).join('\n');
            const planAiNdjson = planAiRecords.map(r => JSON.stringify(r)).join('\n');

            const wrap = document.createElement('div');
            wrap.id = OVERLAY_ID;
            wrap.style.cssText = 'position:fixed;left:0;right:0;bottom:0;top:25%;background:#000;color:#0f0;font:11px/1.4 ui-monospace,monospace;padding:10px;z-index:9999;overflow:auto';

            const bar = document.createElement('div');
            bar.style.cssText = 'position:sticky;top:-10px;margin:-10px -10px 8px;padding:8px;background:#111;border-bottom:1px solid #333;display:flex;flex-wrap:wrap;gap:6px;align-items:center';
            const status = document.createElement('span');
            status.style.cssText = 'flex:1;min-width:120px;color:#0f0';
            status.textContent = '共 ' + records.length + ' 条 · AI计划 ' + planAiRecords.length + ' 条 · 收集 ' + (scopeFilter || '全部') + ' · 仅会话级元数据，已脱敏';

            const setScope = (scope, label) => {
                window.errorBus?.setDebugScopeFilter?.(scope);
                window.toast?.show?.(label);
                wrap.remove();
            };

            bar.appendChild(status);
            const note = document.createElement('div');
            note.style.cssText = 'width:100%;color:#9f9;font-size:11px;opacity:.85';
            note.textContent = '导出内容不进入业务数据/同步/备份；默认只含状态、耗时、数量、错误类型等元数据。';
            bar.appendChild(note);
            bar.appendChild(makeButton('文本', '#08f', () => copyText(recordText(records), '已复制 (' + records.length + ')', status)));
            bar.appendChild(makeButton('AI计划', '#097', () => {
                copyText(recordText(planAiRecords) || '(没有 AI 计划调试记录，请先启用调试工具后重新生成计划)', '已复制 AI计划 (' + planAiRecords.length + ')', status);
            }));
            bar.appendChild(makeButton('只收AI', '#750', () => setScope('plan-ai', '调试日志已切换为只收 AI 计划，请重新生成计划')));
            bar.appendChild(makeButton('收全部', '#555', () => setScope('', '调试日志已切换为收集全部')));
            bar.appendChild(makeButton('NDJSON', '#0a8', () => copyText(ndjson, '已复制 NDJSON (' + records.length + ')', status)));
            bar.appendChild(makeButton('AI NDJSON', '#068', () => copyText(planAiNdjson || '', '已复制 AI NDJSON (' + planAiRecords.length + ')', status)));
            bar.appendChild(makeButton('下载', '#a08', () => {
                try {
                    const url = URL.createObjectURL(new Blob([ndjson], { type: 'application/x-ndjson;charset=utf-8' }));
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'rehab-debug-' + new Date().toISOString().replace(/[:.]/g, '-') + '.ndjson';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 4000);
                    status.textContent = '已下载 (' + records.length + ')';
                } catch (e) {
                    status.textContent = '下载失败:' + e.message;
                }
            }));
            bar.appendChild(makeButton('清空', '#f80', () => { window.errorBus?.clear?.(); wrap.remove(); }));
            bar.appendChild(makeButton('关闭', '#fff', () => wrap.remove()));
            wrap.appendChild(bar);

            const list = document.createElement('div');
            list.style.cssText = 'display:flex;flex-direction:column;gap:6px';
            if (!records.length) {
                const empty = document.createElement('div');
                empty.textContent = '(empty)';
                empty.style.opacity = '0.6';
                list.appendChild(empty);
            } else {
                records.forEach((r, i) => {
                    const card = document.createElement('div');
                    card.style.cssText = 'border:1px solid #1a3;border-radius:6px;padding:6px 8px;background:#020;white-space:pre-wrap;word-break:break-all';
                    let body = '#' + i + ' ' + new Date(r.t).toLocaleTimeString() + ' [' + r.level + '] ' + r.scope + '\nmsg: ' + r.message;
                    if (r.meta) {
                        if (Array.isArray(r.meta?.diffs)) body += '\ndiffs (' + r.meta.diffs.length + '):\n  ' + r.meta.diffs.map(d => '- ' + d).join('\n  ');
                        else body += '\nmeta: ' + (typeof r.meta === 'string' ? r.meta : JSON.stringify(r.meta));
                    }
                    if (r.stack) body += '\nstack: ' + r.stack.split('\n').slice(0, 3).join(' | ');
                    card.textContent = body;
                    list.appendChild(card);
                });
            }
            wrap.appendChild(list);
            document.body.appendChild(wrap);
        } catch (e) {
            if (typeof window.alert === 'function') window.alert('debug overlay failed: ' + e.message);
        }
    }

    function mountFab() {
        if (document.getElementById(FAB_ID)) return;
        const fab = document.createElement('button');
        fab.id = FAB_ID;
        fab.type = 'button';
        fab.textContent = 'LOG';
        fab.title = '查看调试日志（点击查看 / 长按拖动）';
        fab.style.cssText = 'position:fixed;right:6px;bottom:120px;width:42px;height:42px;border-radius:50%;border:0;background:#000;color:#0f0;font:700 11px/1 ui-monospace,monospace;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(0,0,0,0.35);z-index:9998;cursor:pointer;';
        fab.onclick = () => showOverlay();
        document.body.appendChild(fab);
    }

    function removeUi() {
        document.getElementById(OVERLAY_ID)?.remove();
        document.getElementById(FAB_ID)?.remove();
    }

    function logAdviceScroll(target, label, payload) {
        if (!hostOf(target)?._debugToolsEnabled) return;
        try {
            const summary = `${label} | sc=${payload.scrollerTag} cy=${payload.currentY} wy=${payload.windowScrollY} st=${payload.scrollerScrollTop} t=${payload.targetOffset}`;
            document.title = summary.slice(0, 80);
            window.errorBus?.log?.('advice:scroll', summary, { ...payload, label });
        } catch {
            // Debug helpers must never break the app.
        }
    }

    async function enable(target, options = {}) {
        const host = setHostEnabled(target, true);
        try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
        ensureErrorBusDebugAdapter();
        window.errorBus?.enableDebug?.();
        await runExtensionHook('enable');
        mountFab();
        if (!options.silent) {
            const scope = window.errorBus?.getDebugScopeFilter?.() || '';
            window.toast?.show?.('调试工具已启用，将记录' + (scope ? scope + ' 日志' : '全局错误、console、网络、导航与布局变化'));
        }
        refreshHost(host);
        return true;
    }

    async function disable(target, options = {}) {
        const host = setHostEnabled(target, false);
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        await runExtensionHook('disable');
        window.errorBus?.disableDebug?.();
        removeUi();
        if (!options.silent) window.toast?.show?.('调试工具已关闭');
        refreshHost(host);
        return false;
    }

    async function toggle(target) {
        return hostOf(target)?._debugToolsEnabled ? disable(target) : enable(target);
    }

    function init(target) {
        let enabled = false;
        try { enabled = localStorage.getItem(STORAGE_KEY) === '1'; } catch {}
        setHostEnabled(target, enabled);
        if (!enabled) return Promise.resolve(false);
        return enable(target, { silent: true });
    }

    registerExtension({
        name: 'ai',
        async enable() {
            if (typeof window.loadAppScript === 'function') await window.loadAppScript('debug-ai');
            window.aiDebug?.enable?.();
        },
        disable() {
            window.aiDebug?.disable?.();
        }
    });

    registerExtension({
        name: 'plan-ai',
        async enable() {
            if (typeof window.loadAppScript === 'function') await window.loadAppScript('debug-plan-ai');
            window.planAiDebug?.enable?.();
        },
        disable() {
            window.planAiDebug?.disable?.();
        }
    });

    window.debugTools = {
        enable,
        disable,
        init,
        toggle,
        showOverlay,
        mountFab,
        removeUi,
        logAdviceScroll,
        registerExtension
    };
})();
