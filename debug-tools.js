// @ts-nocheck
(function () {
    if (window.debugTools) return;

    const STORAGE_KEY = 'rehab_debug_tools';
    const OVERLAY_ID = 'adviceDebugOverlay';
    const FAB_ID = 'adviceDebugFab';
    const extensions = new Map();

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
