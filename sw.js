// @ts-nocheck
const CACHE = 'training-assistant-v96';
const ASSETS = [
    'index.html',
    'build/generated.css?v=96',
    'css-src/42-health-profile.css?v=96',
    'theme.js?v=96',
    'fooddb.js?v=96',
    'ai-store.js?v=96',
    'ai-profile.js?v=96',
    'ai-models.js?v=96',
    'ai-api.js?v=96',
    'ai-pricing.js?v=96',
    'ai-templates.js?v=96',
    'data-utils-pure.js?v=96',
    'data-utils.js?v=96',
    'storage/idb.js?v=96',
    'storage/migrate.js?v=96',
    'data-store.js?v=96',
    'data-ui-state.js?v=96',
    'health-diet.js?v=96',
    'health-weight.js?v=96',
    'health-exercise.js?v=96',
    'goal-plan.js?v=96',
    'routine-library.js?v=96',
    'data-views.js?v=96',
    'data.js?v=96',
    'food-log.js?v=96',
    'advice-panel.js?v=96',
    'advice-render.js?v=96',
    'advice-prompt.js?v=96',
    'advice-stream-renderer.js?v=96',
    'backup.js?v=96',
    'sync.js?v=96',
    'sync-pure.js?v=96',
    'sync-status.js?v=96',
    'workout-system.js?v=96',
    'workout-wakelock.js?v=96',
    'workout-media-session.js?v=96',
    'workout-pip.js?v=96',
    'workout-core.js?v=96',
    'workout-cardio.js?v=96',
    'workout-engine.js?v=96',
    'workout-state.js?v=96',
    'app-update.js?v=96',
    'toast.js?v=96',
    'error-bus.js?v=96',
    'i18n.js?v=96',
    'a11y-focus-trap.js?v=96',
    'i18n/zh-CN.json?v=96',
    'i18n/en-US.json?v=96',
    'weekly-summary.js?v=96',
    'pr-tracker.js?v=96',
    'volume-heatmap.js?v=96',
    'onboarding.js?v=96',
    'swipe-actions.js?v=96',
    'health-profile.js?v=96',
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
