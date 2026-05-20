// @ts-nocheck
const CACHE = 'training-assistant-v90';
const ASSETS = [
    'index.html',
    'build/generated.css?v=90',
    'css-src/42-health-profile.css?v=90',
    'theme.js?v=90',
    'fooddb.js?v=90',
    'ai-store.js?v=90',
    'ai-profile.js?v=90',
    'ai-models.js?v=90',
    'ai-api.js?v=90',
    'ai-pricing.js?v=90',
    'ai-templates.js?v=90',
    'data-utils-pure.js?v=90',
    'data-utils.js?v=90',
    'storage/idb.js?v=90',
    'storage/migrate.js?v=90',
    'data-store.js?v=90',
    'data-ui-state.js?v=90',
    'health-diet.js?v=90',
    'health-weight.js?v=90',
    'health-exercise.js?v=90',
    'goal-plan.js?v=90',
    'routine-library.js?v=90',
    'data-views.js?v=90',
    'data.js?v=90',
    'food-log.js?v=90',
    'advice-panel.js?v=90',
    'advice-render.js?v=90',
    'advice-prompt.js?v=90',
    'advice-stream-renderer.js?v=90',
    'backup.js?v=90',
    'sync.js?v=90',
    'sync-pure.js?v=90',
    'sync-status.js?v=90',
    'workout-system.js?v=90',
    'workout-wakelock.js?v=90',
    'workout-media-session.js?v=90',
    'workout-pip.js?v=90',
    'workout-core.js?v=90',
    'workout-cardio.js?v=90',
    'workout-engine.js?v=90',
    'workout-state.js?v=90',
    'app-update.js?v=90',
    'toast.js?v=90',
    'error-bus.js?v=90',
    'i18n.js?v=90',
    'a11y-focus-trap.js?v=90',
    'i18n/zh-CN.json?v=90',
    'i18n/en-US.json?v=90',
    'weekly-summary.js?v=90',
    'pr-tracker.js?v=90',
    'volume-heatmap.js?v=90',
    'onboarding.js?v=90',
    'swipe-actions.js?v=90',
    'health-profile.js?v=90',
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
