// @ts-nocheck
const CACHE = 'training-assistant-v82';
const ASSETS = [
    'index.html',
    'build/generated.css?v=82',
    'css-src/42-health-profile.css?v=82',
    'theme.js?v=82',
    'fooddb.js?v=82',
    'ai-store.js?v=82',
    'ai-profile.js?v=82',
    'ai-models.js?v=82',
    'ai-api.js?v=82',
    'data-utils.js?v=82',
    'storage/idb.js?v=82',
    'storage/migrate.js?v=82',
    'data-store.js?v=82',
    'data-ui-state.js?v=82',
    'health-diet.js?v=82',
    'health-weight.js?v=82',
    'health-exercise.js?v=82',
    'goal-plan.js?v=82',
    'routine-library.js?v=82',
    'data-views.js?v=82',
    'data.js?v=82',
    'food-log.js?v=82',
    'advice-panel.js?v=82',
    'advice-render.js?v=82',
    'advice-prompt.js?v=82',
    'advice-stream-renderer.js?v=82',
    'backup.js?v=82',
    'sync.js?v=82',
    'sync-status.js?v=82',
    'workout-system.js?v=82',
    'workout-wakelock.js?v=82',
    'workout-media-session.js?v=82',
    'workout-pip.js?v=82',
    'workout-core.js?v=82',
    'workout-cardio.js?v=82',
    'workout-engine.js?v=82',
    'workout-state.js?v=82',
    'app-update.js?v=82',
    'toast.js?v=82',
    'error-bus.js?v=82',
    'i18n.js?v=82',
    'a11y-focus-trap.js?v=82',
    'i18n/zh-CN.json?v=82',
    'i18n/en-US.json?v=82',
    'weekly-summary.js?v=82',
    'onboarding.js?v=82',
    'swipe-actions.js?v=82',
    'health-profile.js?v=82',
    'assets/model-icons/openai.svg',
    'assets/model-icons/gemini.svg',
    'assets/model-icons/grok.svg',
    'assets/model-icons/deepseek.svg',
    'assets/model-icons/claude.svg',
    'assets/model-icons/qwen.svg',
    'assets/model-icons/doubao.svg',
    'assets/model-icons/kimi.svg',
    'assets/model-icons/minimax.svg',
    'assets/model-icons/mimo.svg',
    'assets/model-icons/glm.svg',
    'assets/model-icons/generic.svg',
    'manifest.json'
];

self.addEventListener('install', (e) => {
    e.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        await Promise.all(ASSETS.map((asset) => cache.add(asset).catch((err) => {
            console.warn('[sw] precache skipped', asset, err && err.message);
        })));
    })());
});

self.addEventListener('activate', (e) => {
    e.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
        await self.clients.claim();
    })());
});

self.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isVersionedAsset(url) {
    return url.searchParams.has('v');
}

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.origin !== location.origin) return;

    if (isVersionedAsset(url)) {
        // Cache-first for hashed assets: avoids slow waterfall on tab switch.
        event.respondWith((async () => {
            const cached = await caches.match(event.request);
            if (cached) return cached;
            try {
                const res = await fetch(event.request);
                if (res && res.ok) {
                    const clone = res.clone();
                    const cache = await caches.open(CACHE);
                    cache.put(event.request, clone).catch(() => {});
                }
                return res;
            } catch (err) {
                const fallback = await caches.match(event.request);
                if (fallback) return fallback;
                throw err;
            }
        })());
        return;
    }

    // Network-first for unversioned navigations / dynamic data.
    event.respondWith((async () => {
        try {
            const res = await fetch(event.request);
            if (res && res.ok) {
                const clone = res.clone();
                const cache = await caches.open(CACHE);
                cache.put(event.request, clone).catch(() => {});
            }
            return res;
        } catch (err) {
            const cached = await caches.match(event.request);
            if (cached) return cached;
            throw err;
        }
    })());
});

