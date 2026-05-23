// @ts-nocheck
const CACHE = 'training-assistant-v106';
const ASSETS = [
    'index.html',
    'build/generated.css?v=106',
    'css-src/42-health-profile.css?v=106',
    'theme.js?v=106',
    'fooddb.js?v=106',
    'ai-store.js?v=106',
    'ai-profile.js?v=106',
    'ai-models.js?v=106',
    'ai-api.js?v=106',
    'ai-pricing.js?v=106',
    'ai-templates.js?v=106',
    'render-safe.js?v=106',
    'nav-stack.js?v=106',
    'data-utils-pure.js?v=106',
    'data-utils.js?v=106',
    'data-records.js?v=106',
    'data-schema.js?v=106',
    'storage/idb.js?v=106',
    'storage/migrate.js?v=106',
    'data-store.js?v=106',
    'data-ui-state.js?v=106',
    'health-diet.js?v=106',
    'health-weight.js?v=106',
    'health-exercise.js?v=106',
    'goal-plan.js?v=106',
    'routine-plan.js?v=106',
    'routine-library.js?v=106',
    'data-views.js?v=106',
    'data.js?v=106',
    'voice-engine.js?v=106',
    'voice-cache.js?v=106',
    'voice-webspeech-adapter.js?v=106',
    'voice-legado-adapter.js?v=106',
    'workout-voice.js?v=106',
    'food-log.js?v=106',
    'advice-panel.js?v=106',
    'advice-template-manager.js?v=106',
    'advice-render.js?v=106',
    'advice-prompt.js?v=106',
    'advice-stream-renderer.js?v=106',
    'backup.js?v=106',
    'sync-ui.js?v=106',
    'sync-adapters.js?v=106',
    'sync.js?v=106',
    'sync-pure.js?v=106',
    'sync-status.js?v=106',
    'workout-system.js?v=106',
    'workout-wakelock.js?v=106',
    'workout-media-session.js?v=106',
    'workout-pip.js?v=106',
    'workout-core.js?v=106',
    'workout-cardio-pure.js?v=106',
    'workout-cardio.js?v=106',
    'workout-engine.js?v=106',
    'workout-state.js?v=106',
    'app-update.js?v=106',
    'toast.js?v=106',
    'error-bus.js?v=106',
    'i18n.js?v=106',
    'a11y-focus-trap.js?v=106',
    'i18n/zh-CN.json?v=106',
    'i18n/en-US.json?v=106',
    'weekly-summary.js?v=106',
    'pr-tracker.js?v=106',
    'volume-heatmap.js?v=106',
    'onboarding.js?v=106',
    'swipe-actions.js?v=106',
    'health-profile.js?v=106',
    'report-metrics-pure.js?v=106',
    'report-panel.js?v=106',
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
