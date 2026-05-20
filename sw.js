// @ts-nocheck
const CACHE = 'training-assistant-v95';
const ASSETS = [
    'index.html',
    'build/generated.css?v=95',
    'css-src/42-health-profile.css?v=95',
    'theme.js?v=95',
    'fooddb.js?v=95',
    'ai-store.js?v=95',
    'ai-profile.js?v=95',
    'ai-models.js?v=95',
    'ai-api.js?v=95',
    'ai-pricing.js?v=95',
    'ai-templates.js?v=95',
    'data-utils-pure.js?v=95',
    'data-utils.js?v=95',
    'storage/idb.js?v=95',
    'storage/migrate.js?v=95',
    'data-store.js?v=95',
    'data-ui-state.js?v=95',
    'health-diet.js?v=95',
    'health-weight.js?v=95',
    'health-exercise.js?v=95',
    'goal-plan.js?v=95',
    'routine-library.js?v=95',
    'data-views.js?v=95',
    'data.js?v=95',
    'food-log.js?v=95',
    'advice-panel.js?v=95',
    'advice-render.js?v=95',
    'advice-prompt.js?v=95',
    'advice-stream-renderer.js?v=95',
    'backup.js?v=95',
    'sync.js?v=95',
    'sync-pure.js?v=95',
    'sync-status.js?v=95',
    'workout-system.js?v=95',
    'workout-wakelock.js?v=95',
    'workout-media-session.js?v=95',
    'workout-pip.js?v=95',
    'workout-core.js?v=95',
    'workout-cardio.js?v=95',
    'workout-engine.js?v=95',
    'workout-state.js?v=95',
    'app-update.js?v=95',
    'toast.js?v=95',
    'error-bus.js?v=95',
    'i18n.js?v=95',
    'a11y-focus-trap.js?v=95',
    'i18n/zh-CN.json?v=95',
    'i18n/en-US.json?v=95',
    'weekly-summary.js?v=95',
    'pr-tracker.js?v=95',
    'volume-heatmap.js?v=95',
    'onboarding.js?v=95',
    'swipe-actions.js?v=95',
    'health-profile.js?v=95',
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
