// @ts-nocheck
(function () {
    /** @type {Record<string, any>} */
    const packs = {};
    const STORAGE_KEY = 'rehab_locale';
    const FALLBACK_PACKS = {
        'zh-CN': {
            nav: { today: '今日', workout: '训练', records: '记录', ai: 'AI', profile: '我的' },
            workout: { ready: 'READY', start: '开始训练', pause: '暂停', stop: '停止' },
            sync: { local: '仅本地', syncing: '同步中…', cloud: '云端同步正常' },
            errors: { boot: '启动失败：{message}', network: '网络异常，请稍后再试' },
            advice: {
                scrollToLatest: '跳到最新 · {n} 行',
                pauseRender: '暂停渲染',
                resumeRender: '继续渲染',
                flushAll: '一次性显示全部',
                bufferedChars: '已缓冲 {n} 字',
                stopGenerate: '停止生成'
            },
            records: {
                ai: {
                    title: 'AI 用量',
                    today: '今日',
                    week: '本周',
                    month: '本月',
                    tokens: 'Tokens',
                    cost: '成本'
                }
            }
        },
        'en-US': {
            nav: { today: 'Today', workout: 'Workout', records: 'Records', ai: 'AI', profile: 'Me' },
            workout: { ready: 'READY', start: 'Start', pause: 'Pause', stop: 'Stop' },
            sync: { local: 'Local only', syncing: 'Syncing…', cloud: 'Cloud OK' },
            errors: { boot: 'Startup failed: {message}', network: 'Network error, try again' },
            advice: {
                scrollToLatest: 'Jump to latest · {n} lines',
                pauseRender: 'Pause rendering',
                resumeRender: 'Resume rendering',
                flushAll: 'Show all',
                bufferedChars: 'Buffered {n} chars',
                stopGenerate: 'Stop generating'
            },
            records: {
                ai: {
                    title: 'AI Usage',
                    today: 'Today',
                    week: 'This week',
                    month: 'This month',
                    tokens: 'Tokens',
                    cost: 'Cost'
                }
            }
        }
    };

    function normalizeLocale(value) {
        if (!value || value === 'auto') return 'auto';
        if (value.startsWith('zh')) return 'zh-CN';
        if (value.startsWith('en')) return 'en-US';
        return value;
    }

    function detectDefault() {
        const lang = String(navigator.language || 'zh-CN');
        return lang.startsWith('en') ? 'en-US' : 'zh-CN';
    }

    function getStored() {
        try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
    }

    function setStored(v) {
        try { localStorage.setItem(STORAGE_KEY, v); } catch {}
    }

    function getPath(obj, path) {
        return String(path).split('.').reduce((acc, key) => (acc && key in acc) ? acc[key] : undefined, obj);
    }

    function formatTemplate(str, params) {
        if (!params) return str;
        return String(str).replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
    }

    function detectVersionParam() {
        try {
            const s = document.querySelector('script[src*="i18n.js?v="]');
            const m = s?.getAttribute('src')?.match(/\?v=(\d+)/);
            if (m) return m[1];
        } catch {}
        try {
            const css = document.querySelector('link[href*="generated.css?v="]');
            const cm = css?.getAttribute('href')?.match(/\?v=(\d+)/);
            if (cm) return cm[1];
        } catch {}
        return '';
    }

    async function loadPack(locale) {
        if (packs[locale]) return packs[locale];
        try {
            if (location.protocol === 'file:') {
                packs[locale] = FALLBACK_PACKS[locale] || {};
                return packs[locale];
            }
            const v = detectVersionParam();
            const res = await fetch(`i18n/${locale}.json?v=${v || ''}`);
            const json = await res.json();
            packs[locale] = json;
            return json;
        } catch (e) {
            // Offline/file fallback.
            packs[locale] = packs[locale] || FALLBACK_PACKS[locale] || {};
            return packs[locale];
        }
    }

    const i18n = {
        currentLocale: 'zh-CN',
        resolvedLocale: 'zh-CN',
        async init() {
            const stored = normalizeLocale(getStored());
            this.currentLocale = stored || 'auto';
            this.resolvedLocale = this.currentLocale === 'auto' ? detectDefault() : this.currentLocale;
            await loadPack('zh-CN');
            if (this.resolvedLocale !== 'zh-CN') await loadPack(this.resolvedLocale);
        },
        has(key) {
            return getPath(packs[this.resolvedLocale] || {}, key) != null || getPath(packs['zh-CN'] || {}, key) != null;
        },
        t(key, params) {
            const v = getPath(packs[this.resolvedLocale] || {}, key);
            const fallback = getPath(packs['zh-CN'] || {}, key);
            const out = v != null ? v : (fallback != null ? fallback : key);
            return formatTemplate(out, params);
        },
        async setLocale(locale) {
            const next = normalizeLocale(locale);
            this.currentLocale = next;
            setStored(next);
            this.resolvedLocale = next === 'auto' ? detectDefault() : next;
            await loadPack('zh-CN');
            if (this.resolvedLocale !== 'zh-CN') await loadPack(this.resolvedLocale);
            try { window.dispatchEvent(new CustomEvent('locale:change', { detail: { locale: this.resolvedLocale } })); } catch {}
            try { this.applyDom(document); } catch {}
            try { window.data?.render?.(); } catch {}
        },
        format: {
            number(n, opts) {
                try { return new Intl.NumberFormat(i18n.resolvedLocale, opts).format(Number(n)); } catch { return String(n); }
            },
            date(d, opts) {
                try { return new Intl.DateTimeFormat(i18n.resolvedLocale, opts).format(new Date(d)); } catch { return String(d); }
            },
            kcal(n) {
                const v = Number(n) || 0;
                return `${Math.round(v)} kcal`;
            }
        },
        applyDom(root) {
            const doc = root?.querySelectorAll ? root : document;
            doc.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (!key) return;
                el.textContent = i18n.t(key);
            });
            doc.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
                const key = el.getAttribute('data-i18n-aria-label');
                if (!key) return;
                el.setAttribute('aria-label', i18n.t(key));
            });
            doc.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                const key = el.getAttribute('data-i18n-placeholder');
                if (!key) return;
                el.setAttribute('placeholder', i18n.t(key));
            });
        }
    };

    window.i18n = i18n;
})();
