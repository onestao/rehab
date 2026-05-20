// @ts-nocheck
const CACHE = 'training-assistant-v93';
const ASSETS = [
    'index.html',
    'build/generated.css?v=93',
    'css-src/42-health-profile.css?v=93',
    'theme.js?v=93',
    'fooddb.js?v=93',
    'ai-store.js?v=93',
    'ai-profile.js?v=93',
    'ai-models.js?v=93',
    'ai-api.js?v=93',
    'ai-pricing.js?v=93',
    'ai-templates.js?v=93',
    'data-utils-pure.js?v=93',
    'data-utils.js?v=93',
    'storage/idb.js?v=93',
    'storage/migrate.js?v=93',
    'data-store.js?v=93',
    'data-ui-state.js?v=93',
    'health-diet.js?v=93',
    'health-weight.js?v=93',
    'health-exercise.js?v=93',
    'goal-plan.js?v=93',
    'routine-library.js?v=93',
    'data-views.js?v=93',
    'data.js?v=93',
    'food-log.js?v=93',
    'advice-panel.js?v=93',
    'advice-render.js?v=93',
    'advice-prompt.js?v=93',
    'advice-stream-renderer.js?v=93',
    'backup.js?v=93',
    'sync.js?v=93',
    'sync-pure.js?v=93',
    'sync-status.js?v=93',
    'workout-system.js?v=93',
    'workout-wakelock.js?v=93',
    'workout-media-session.js?v=93',
    'workout-pip.js?v=93',
    'workout-core.js?v=93',
    'workout-cardio.js?v=93',
    'workout-engine.js?v=93',
    'workout-state.js?v=93',
    'app-update.js?v=93',
    'toast.js?v=93',
    'error-bus.js?v=93',
    'i18n.js?v=93',
    'a11y-focus-trap.js?v=93',
    'i18n/zh-CN.json?v=93',
    'i18n/en-US.json?v=93',
    'weekly-summary.js?v=93',
    'pr-tracker.js?v=93',
    'volume-heatmap.js?v=93',
    'onboarding.js?v=93',
    'swipe-actions.js?v=93',
    'health-profile.js?v=93',
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
