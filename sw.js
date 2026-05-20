// @ts-nocheck
const CACHE = 'training-assistant-v91';
const ASSETS = [
    'index.html',
    'build/generated.css?v=91',
    'css-src/42-health-profile.css?v=91',
    'theme.js?v=91',
    'fooddb.js?v=91',
    'ai-store.js?v=91',
    'ai-profile.js?v=91',
    'ai-models.js?v=91',
    'ai-api.js?v=91',
    'ai-pricing.js?v=91',
    'ai-templates.js?v=91',
    'data-utils-pure.js?v=91',
    'data-utils.js?v=91',
    'storage/idb.js?v=91',
    'storage/migrate.js?v=91',
    'data-store.js?v=91',
    'data-ui-state.js?v=91',
    'health-diet.js?v=91',
    'health-weight.js?v=91',
    'health-exercise.js?v=91',
    'goal-plan.js?v=91',
    'routine-library.js?v=91',
    'data-views.js?v=91',
    'data.js?v=91',
    'food-log.js?v=91',
    'advice-panel.js?v=91',
    'advice-render.js?v=91',
    'advice-prompt.js?v=91',
    'advice-stream-renderer.js?v=91',
    'backup.js?v=91',
    'sync.js?v=91',
    'sync-pure.js?v=91',
    'sync-status.js?v=91',
    'workout-system.js?v=91',
    'workout-wakelock.js?v=91',
    'workout-media-session.js?v=91',
    'workout-pip.js?v=91',
    'workout-core.js?v=91',
    'workout-cardio.js?v=91',
    'workout-engine.js?v=91',
    'workout-state.js?v=91',
    'app-update.js?v=91',
    'toast.js?v=91',
    'error-bus.js?v=91',
    'i18n.js?v=91',
    'a11y-focus-trap.js?v=91',
    'i18n/zh-CN.json?v=91',
    'i18n/en-US.json?v=91',
    'weekly-summary.js?v=91',
    'pr-tracker.js?v=91',
    'volume-heatmap.js?v=91',
    'onboarding.js?v=91',
    'swipe-actions.js?v=91',
    'health-profile.js?v=91',
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
