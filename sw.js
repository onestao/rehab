// @ts-nocheck
const CACHE = 'training-assistant-v85';
const ASSETS = [
    'index.html',
    'build/generated.css?v=86',
    'css-src/42-health-profile.css?v=86',
    'theme.js?v=86',
    'fooddb.js?v=86',
    'ai-store.js?v=86',
    'ai-profile.js?v=86',
    'ai-models.js?v=86',
    'ai-api.js?v=86',
    'ai-pricing.js?v=86',
    'ai-templates.js?v=86',
    'data-utils-pure.js?v=86',
    'data-utils.js?v=86',
    'storage/idb.js?v=86',
    'storage/migrate.js?v=86',
    'data-store.js?v=86',
    'data-ui-state.js?v=86',
    'health-diet.js?v=86',
    'health-weight.js?v=86',
    'health-exercise.js?v=86',
    'goal-plan.js?v=86',
    'routine-library.js?v=86',
    'data-views.js?v=86',
    'data.js?v=86',
    'food-log.js?v=86',
    'advice-panel.js?v=86',
    'advice-render.js?v=86',
    'advice-prompt.js?v=86',
    'advice-stream-renderer.js?v=86',
    'backup.js?v=86',
    'sync.js?v=86',
    'sync-pure.js?v=86',
    'sync-status.js?v=86',
    'workout-system.js?v=86',
    'workout-wakelock.js?v=86',
    'workout-media-session.js?v=86',
    'workout-pip.js?v=86',
    'workout-core.js?v=86',
    'workout-cardio.js?v=86',
    'workout-engine.js?v=86',
    'workout-state.js?v=86',
    'app-update.js?v=86',
    'toast.js?v=86',
    'error-bus.js?v=86',
    'i18n.js?v=86',
    'a11y-focus-trap.js?v=86',
    'i18n/zh-CN.json?v=86',
    'i18n/en-US.json?v=86',
    'weekly-summary.js?v=86',
    'pr-tracker.js?v=86',
    'volume-heatmap.js?v=86',
    'onboarding.js?v=86',
    'swipe-actions.js?v=86',
    'health-profile.js?v=86',
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
