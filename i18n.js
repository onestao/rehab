// @ts-nocheck
(function () {
    /** @type {Record<string, any>} */
    const packs = {};
    const STORAGE_KEY = 'rehab_locale';

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
            const v = detectVersionParam();
            const res = await fetch(`i18n/${locale}.json?v=${v || ''}`);
            const json = await res.json();
            packs[locale] = json;
            return json;
        } catch (e) {
            // Offline: rely on SW precache; if still fails, keep empty pack.
            packs[locale] = packs[locale] || {};
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
