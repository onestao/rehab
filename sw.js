// @ts-nocheck
const CACHE = 'training-assistant-v88';
const ASSETS = [
    'index.html',
    'build/generated.css?v=88',
    'css-src/42-health-profile.css?v=88',
    'theme.js?v=88',
    'fooddb.js?v=88',
    'ai-store.js?v=88',
    'ai-profile.js?v=88',
    'ai-models.js?v=88',
    'ai-api.js?v=88',
    'ai-pricing.js?v=88',
    'ai-templates.js?v=88',
    'data-utils-pure.js?v=88',
    'data-utils.js?v=88',
    'storage/idb.js?v=88',
    'storage/migrate.js?v=88',
    'data-store.js?v=88',
    'data-ui-state.js?v=88',
    'health-diet.js?v=88',
    'health-weight.js?v=88',
    'health-exercise.js?v=88',
    'goal-plan.js?v=88',
    'routine-library.js?v=88',
    'data-views.js?v=88',
    'data.js?v=88',
    'food-log.js?v=88',
    'advice-panel.js?v=88',
    'advice-render.js?v=88',
    'advice-prompt.js?v=88',
    'advice-stream-renderer.js?v=88',
    'backup.js?v=88',
    'sync.js?v=88',
    'sync-pure.js?v=88',
    'sync-status.js?v=88',
    'workout-system.js?v=88',
    'workout-wakelock.js?v=88',
    'workout-media-session.js?v=88',
    'workout-pip.js?v=88',
    'workout-core.js?v=88',
    'workout-cardio.js?v=88',
    'workout-engine.js?v=88',
    'workout-state.js?v=88',
    'app-update.js?v=88',
    'toast.js?v=88',
    'error-bus.js?v=88',
    'i18n.js?v=88',
    'a11y-focus-trap.js?v=88',
    'i18n/zh-CN.json?v=88',
    'i18n/en-US.json?v=88',
    'weekly-summary.js?v=88',
    'pr-tracker.js?v=88',
    'volume-heatmap.js?v=88',
    'onboarding.js?v=88',
    'swipe-actions.js?v=88',
    'health-profile.js?v=88',
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
    , 'favicon.ico'
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
