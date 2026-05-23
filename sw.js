// @ts-nocheck
const CACHE = 'training-assistant-v101';
const ASSETS = [
    'index.html',
    'build/generated.css?v=101',
    'css-src/42-health-profile.css?v=101',
    'theme.js?v=101',
    'fooddb.js?v=101',
    'ai-store.js?v=101',
    'ai-profile.js?v=101',
    'ai-models.js?v=101',
    'ai-api.js?v=101',
    'ai-pricing.js?v=101',
    'ai-templates.js?v=101',
    'render-safe.js?v=101',
    'data-utils-pure.js?v=101',
    'data-utils.js?v=101',
    'data-records.js?v=101',
    'data-schema.js?v=101',
    'storage/idb.js?v=101',
    'storage/migrate.js?v=101',
    'data-store.js?v=101',
    'data-ui-state.js?v=101',
    'health-diet.js?v=101',
    'health-weight.js?v=101',
    'health-exercise.js?v=101',
    'goal-plan.js?v=101',
    'routine-plan.js?v=101',
    'routine-library.js?v=101',
    'data-views.js?v=101',
    'data.js?v=101',
    'voice-engine.js?v=101',
    'voice-cache.js?v=101',
    'voice-webspeech-adapter.js?v=101',
    'voice-legado-adapter.js?v=101',
    'workout-voice.js?v=101',
    'food-log.js?v=101',
    'advice-panel.js?v=101',
    'advice-template-manager.js?v=101',
    'advice-render.js?v=101',
    'advice-prompt.js?v=101',
    'advice-stream-renderer.js?v=101',
    'backup.js?v=101',
    'sync-ui.js?v=101',
    'sync-adapters.js?v=101',
    'sync.js?v=101',
    'sync-pure.js?v=101',
    'sync-status.js?v=101',
    'workout-system.js?v=101',
    'workout-wakelock.js?v=101',
    'workout-media-session.js?v=101',
    'workout-pip.js?v=101',
    'workout-core.js?v=101',
    'workout-cardio-pure.js?v=101',
    'workout-cardio.js?v=101',
    'workout-engine.js?v=101',
    'workout-state.js?v=101',
    'app-update.js?v=101',
    'toast.js?v=101',
    'error-bus.js?v=101',
    'i18n.js?v=101',
    'a11y-focus-trap.js?v=101',
    'i18n/zh-CN.json?v=101',
    'i18n/en-US.json?v=101',
    'weekly-summary.js?v=101',
    'pr-tracker.js?v=101',
    'volume-heatmap.js?v=101',
    'onboarding.js?v=101',
    'swipe-actions.js?v=101',
    'health-profile.js?v=101',
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

let voiceTtsHosts = new Set();

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
    if (e.data && e.data.type === 'VOICE_TTS_HOSTS') {
        voiceTtsHosts = new Set((e.data.hosts || []).map(host => String(host || '').toLowerCase()).filter(Boolean));
    }
});

function isVersionedAsset(url) {
    return url.searchParams.has('v');
}

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (voiceTtsHosts.has(url.hostname.toLowerCase())) {
        event.respondWith(fetch(event.request));
        return;
    }
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
