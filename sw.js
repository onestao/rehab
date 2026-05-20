// @ts-nocheck
const CACHE = 'training-assistant-v92';
const ASSETS = [
    'index.html',
    'build/generated.css?v=92',
    'css-src/42-health-profile.css?v=92',
    'theme.js?v=92',
    'fooddb.js?v=92',
    'ai-store.js?v=92',
    'ai-profile.js?v=92',
    'ai-models.js?v=92',
    'ai-api.js?v=92',
    'ai-pricing.js?v=92',
    'ai-templates.js?v=92',
    'data-utils-pure.js?v=92',
    'data-utils.js?v=92',
    'storage/idb.js?v=92',
    'storage/migrate.js?v=92',
    'data-store.js?v=92',
    'data-ui-state.js?v=92',
    'health-diet.js?v=92',
    'health-weight.js?v=92',
    'health-exercise.js?v=92',
    'goal-plan.js?v=92',
    'routine-library.js?v=92',
    'data-views.js?v=92',
    'data.js?v=92',
    'food-log.js?v=92',
    'advice-panel.js?v=92',
    'advice-render.js?v=92',
    'advice-prompt.js?v=92',
    'advice-stream-renderer.js?v=92',
    'backup.js?v=92',
    'sync.js?v=92',
    'sync-pure.js?v=92',
    'sync-status.js?v=92',
    'workout-system.js?v=92',
    'workout-wakelock.js?v=92',
    'workout-media-session.js?v=92',
    'workout-pip.js?v=92',
    'workout-core.js?v=92',
    'workout-cardio.js?v=92',
    'workout-engine.js?v=92',
    'workout-state.js?v=92',
    'app-update.js?v=92',
    'toast.js?v=92',
    'error-bus.js?v=92',
    'i18n.js?v=92',
    'a11y-focus-trap.js?v=92',
    'i18n/zh-CN.json?v=92',
    'i18n/en-US.json?v=92',
    'weekly-summary.js?v=92',
    'pr-tracker.js?v=92',
    'volume-heatmap.js?v=92',
    'onboarding.js?v=92',
    'swipe-actions.js?v=92',
    'health-profile.js?v=92',
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
