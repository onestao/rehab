// @ts-nocheck
const CACHE = 'training-assistant-v105';
const ASSETS = [
    'index.html',
    'build/generated.css?v=105',
    'css-src/42-health-profile.css?v=105',
    'theme.js?v=105',
    'fooddb.js?v=105',
    'ai-store.js?v=105',
    'ai-profile.js?v=105',
    'ai-models.js?v=105',
    'ai-api.js?v=105',
    'ai-pricing.js?v=105',
    'ai-templates.js?v=105',
    'render-safe.js?v=105',
    'nav-stack.js?v=105',
    'data-utils-pure.js?v=105',
    'data-utils.js?v=105',
    'data-records.js?v=105',
    'data-schema.js?v=105',
    'storage/idb.js?v=105',
    'storage/migrate.js?v=105',
    'data-store.js?v=105',
    'data-ui-state.js?v=105',
    'health-diet.js?v=105',
    'health-weight.js?v=105',
    'health-exercise.js?v=105',
    'goal-plan.js?v=105',
    'routine-plan.js?v=105',
    'routine-library.js?v=105',
    'data-views.js?v=105',
    'data.js?v=105',
    'voice-engine.js?v=105',
    'voice-cache.js?v=105',
    'voice-webspeech-adapter.js?v=105',
    'voice-legado-adapter.js?v=105',
    'workout-voice.js?v=105',
    'food-log.js?v=105',
    'advice-panel.js?v=105',
    'advice-template-manager.js?v=105',
    'advice-render.js?v=105',
    'advice-prompt.js?v=105',
    'advice-stream-renderer.js?v=105',
    'backup.js?v=105',
    'sync-ui.js?v=105',
    'sync-adapters.js?v=105',
    'sync.js?v=105',
    'sync-pure.js?v=105',
    'sync-status.js?v=105',
    'workout-system.js?v=105',
    'workout-wakelock.js?v=105',
    'workout-media-session.js?v=105',
    'workout-pip.js?v=105',
    'workout-core.js?v=105',
    'workout-cardio-pure.js?v=105',
    'workout-cardio.js?v=105',
    'workout-engine.js?v=105',
    'workout-state.js?v=105',
    'app-update.js?v=105',
    'toast.js?v=105',
    'error-bus.js?v=105',
    'i18n.js?v=105',
    'a11y-focus-trap.js?v=105',
    'i18n/zh-CN.json?v=105',
    'i18n/en-US.json?v=105',
    'weekly-summary.js?v=105',
    'pr-tracker.js?v=105',
    'volume-heatmap.js?v=105',
    'onboarding.js?v=105',
    'swipe-actions.js?v=105',
    'health-profile.js?v=105',
    'report-metrics-pure.js?v=105',
    'report-panel.js?v=105',
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
