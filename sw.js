// @ts-nocheck
const CACHE = 'training-assistant-v84';
const ASSETS = [
    'index.html',
    'build/generated.css?v=84',
    'css-src/42-health-profile.css?v=84',
    'theme.js?v=84',
    'fooddb.js?v=84',
    'ai-store.js?v=84',
    'ai-profile.js?v=84',
    'ai-models.js?v=84',
    'ai-api.js?v=84',
    'ai-pricing.js?v=84',
    'ai-templates.js?v=84',
    'data-utils.js?v=84',
    'storage/idb.js?v=84',
    'storage/migrate.js?v=84',
    'data-store.js?v=84',
    'data-ui-state.js?v=84',
    'health-diet.js?v=84',
    'health-weight.js?v=84',
    'health-exercise.js?v=84',
    'goal-plan.js?v=84',
    'routine-library.js?v=84',
    'data-views.js?v=84',
    'data.js?v=84',
    'food-log.js?v=84',
    'advice-panel.js?v=84',
    'advice-render.js?v=84',
    'advice-prompt.js?v=84',
    'advice-stream-renderer.js?v=84',
    'backup.js?v=84',
    'sync.js?v=84',
    'sync-status.js?v=84',
    'workout-system.js?v=84',
    'workout-wakelock.js?v=84',
    'workout-media-session.js?v=84',
    'workout-pip.js?v=84',
    'workout-core.js?v=84',
    'workout-cardio.js?v=84',
    'workout-engine.js?v=84',
    'workout-state.js?v=84',
    'app-update.js?v=84',
    'toast.js?v=84',
    'error-bus.js?v=84',
    'i18n.js?v=84',
    'a11y-focus-trap.js?v=84',
    'i18n/zh-CN.json?v=84',
    'i18n/en-US.json?v=84',
    'weekly-summary.js?v=84',
    'pr-tracker.js?v=84',
    'volume-heatmap.js?v=84',
    'onboarding.js?v=84',
    'swipe-actions.js?v=84',
    'health-profile.js?v=84',
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
