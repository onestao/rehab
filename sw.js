// @ts-nocheck
const CACHE = 'training-assistant-v89';
const ASSETS = [
    'index.html',
    'build/generated.css?v=89',
    'css-src/42-health-profile.css?v=89',
    'theme.js?v=89',
    'fooddb.js?v=89',
    'ai-store.js?v=89',
    'ai-profile.js?v=89',
    'ai-models.js?v=89',
    'ai-api.js?v=89',
    'ai-pricing.js?v=89',
    'ai-templates.js?v=89',
    'data-utils-pure.js?v=89',
    'data-utils.js?v=89',
    'storage/idb.js?v=89',
    'storage/migrate.js?v=89',
    'data-store.js?v=89',
    'data-ui-state.js?v=89',
    'health-diet.js?v=89',
    'health-weight.js?v=89',
    'health-exercise.js?v=89',
    'goal-plan.js?v=89',
    'routine-library.js?v=89',
    'data-views.js?v=89',
    'data.js?v=89',
    'food-log.js?v=89',
    'advice-panel.js?v=89',
    'advice-render.js?v=89',
    'advice-prompt.js?v=89',
    'advice-stream-renderer.js?v=89',
    'backup.js?v=89',
    'sync.js?v=89',
    'sync-pure.js?v=89',
    'sync-status.js?v=89',
    'workout-system.js?v=89',
    'workout-wakelock.js?v=89',
    'workout-media-session.js?v=89',
    'workout-pip.js?v=89',
    'workout-core.js?v=89',
    'workout-cardio.js?v=89',
    'workout-engine.js?v=89',
    'workout-state.js?v=89',
    'app-update.js?v=89',
    'toast.js?v=89',
    'error-bus.js?v=89',
    'i18n.js?v=89',
    'a11y-focus-trap.js?v=89',
    'i18n/zh-CN.json?v=89',
    'i18n/en-US.json?v=89',
    'weekly-summary.js?v=89',
    'pr-tracker.js?v=89',
    'volume-heatmap.js?v=89',
    'onboarding.js?v=89',
    'swipe-actions.js?v=89',
    'health-profile.js?v=89',
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
