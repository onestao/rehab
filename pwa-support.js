// @ts-nocheck
(function () {
    const REQUIRED_ASSETS = [
        'manifest.json',
        'assets/app-icon.svg',
        'build/generated.css',
        'workout-core.js',
        'sync.js',
        'backup.js'
    ];

    function resolveShortcut() {
        try {
            const params = new URLSearchParams(location.search);
            const raw = params.get('shortcut') || '';
            if (raw === 'workout' || raw === 'today' || raw === 'ai-coach') return raw;
            if (raw === 'sync') return 'profile:sync';
        } catch {}
        return '';
    }

    async function openShortcut() {
        const target = resolveShortcut();
        if (!target || !window.ui?.tab) return;
        const page = target.startsWith('profile') ? 'profile' : target;
        const navIndex = { today: 0, workout: 1, records: 2, 'ai-coach': 3, profile: 4 }[page] || 0;
        const nav = document.querySelectorAll('.nav-item')[navIndex];
        await window.ui.tab(page, nav);
        if (target === 'profile:sync') {
            window.data?.setRoutineView?.('sync');
            window.data?.renderProfilePage?.();
        }
    }

    async function cacheHealth() {
        const result = {
            sw: !!navigator.serviceWorker,
            controller: !!navigator.serviceWorker?.controller,
            cacheCount: 0,
            missing: [],
            storage: null
        };
        try {
            if (typeof caches !== 'undefined') {
                const keys = await caches.keys();
                for (const key of keys) {
                    const cache = await caches.open(key);
                    const requests = await cache.keys();
                    result.cacheCount += requests.length;
                }
                for (const asset of REQUIRED_ASSETS) {
                    const hit = await caches.match(asset) || await caches.match(`${asset}?v=${window.appUpdate?.version || ''}`);
                    if (!hit) result.missing.push(asset);
                }
            }
            if (navigator.storage?.estimate) {
                result.storage = await navigator.storage.estimate();
            }
        } catch (e) {
            result.error = e?.message || String(e);
        }
        return result;
    }

    async function renderHealth(targetId = 'syncPwaHealth') {
        const el = document.getElementById(targetId);
        if (!el) return;
        const safe = window.renderSafe?.escapeHtml || ((v) => String(v ?? ''));
        el.innerHTML = '<div class="sync-meta-item sync-meta-wide"><strong>PWA 离线检查</strong><span>检查中...</span></div>';
        const status = await cacheHealth();
        const usage = status.storage?.usage ? `${Math.round(status.storage.usage / 1024 / 1024)} MB` : '暂无';
        const quota = status.storage?.quota ? `${Math.round(status.storage.quota / 1024 / 1024)} MB` : '暂无';
        el.innerHTML = `
            <div class="sync-meta-item"><strong>Service Worker</strong><span>${status.sw ? (status.controller ? '已接管' : '已支持') : '不支持'}</span></div>
            <div class="sync-meta-item"><strong>缓存资源</strong><span>${status.cacheCount}</span></div>
            <div class="sync-meta-item"><strong>存储占用</strong><span>${usage}</span></div>
            <div class="sync-meta-item"><strong>可用配额</strong><span>${quota}</span></div>
            <div class="sync-meta-item sync-meta-wide"><strong>关键离线资源</strong><span>${status.missing.length ? safe(status.missing.join('、')) : '完整'}</span></div>`;
    }

    window.pwaSupport = { openShortcut, cacheHealth, renderHealth };
})();
