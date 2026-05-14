// @ts-nocheck
const CACHE = 'training-assistant-v83';
const ASSETS = [
    'index.html',
    'build/generated.css?v=83',
    'css-src/42-health-profile.css?v=83',
    'theme.js?v=83',
    'fooddb.js?v=83',
    'ai-store.js?v=83',
    'ai-profile.js?v=83',
    'ai-models.js?v=83',
    'ai-api.js?v=83',
    'data-utils.js?v=83',
    'storage/idb.js?v=83',
    'storage/migrate.js?v=83',
    'data-store.js?v=83',
    'data-ui-state.js?v=83',
    'health-diet.js?v=83',
    'health-weight.js?v=83',
    'health-exercise.js?v=83',
    'goal-plan.js?v=83',
    'routine-library.js?v=83',
    'data-views.js?v=83',
    'data.js?v=83',
    'food-log.js?v=83',
    'advice-panel.js?v=83',
    'advice-render.js?v=83',
    'advice-prompt.js?v=83',
    'advice-stream-renderer.js?v=83',
    'backup.js?v=83',
    'sync.js?v=83',
    'sync-status.js?v=83',
    'workout-system.js?v=83',
    'workout-wakelock.js?v=83',
    'workout-media-session.js?v=83',
    'workout-pip.js?v=83',
    'workout-core.js?v=83',
    'workout-cardio.js?v=83',
    'workout-engine.js?v=83',
    'workout-state.js?v=83',
    'app-update.js?v=83',
    'toast.js?v=83',
    'error-bus.js?v=83',
    'i18n.js?v=83',
    'a11y-focus-trap.js?v=83',
    'i18n/zh-CN.json?v=83',
    'i18n/en-US.json?v=83',
    'weekly-summary.js?v=83',
    'onboarding.js?v=83',
    'swipe-actions.js?v=83',
    'health-profile.js?v=83',
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

