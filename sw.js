// @ts-nocheck
const CACHE = 'training-assistant-v113';
const ASSETS = [
    'index.html',
    'build/generated.css?v=113',
    'css-src/42-health-profile.css?v=113',
    'theme.js?v=113',
    'haptics.js?v=113',
    'fooddb.js?v=113',
    'ai-store.js?v=113',
    'ai-profile.js?v=113',
    'ai-models.js?v=113',
    'ai-api.js?v=113',
    'ai-pricing.js?v=113',
    'ai-templates.js?v=113',
    'render-safe.js?v=113',
    'nav-stack.js?v=113',
    'data-utils-pure.js?v=113',
    'data-utils.js?v=113',
    'data-records.js?v=113',
    'data-schema.js?v=113',
    'storage/idb.js?v=113',
    'storage/migrate.js?v=113',
    'data-store.js?v=113',
    'data-ui-state.js?v=113',
    'health-diet.js?v=113',
    'health-weight.js?v=113',
    'health-exercise.js?v=113',
    'goal-plan.js?v=113',
    'routine-plan.js?v=113',
    'routine-library.js?v=113',
    'data-views.js?v=113',
    'data.js?v=113',
    'voice-engine.js?v=113',
    'voice-cache.js?v=113',
    'voice-webspeech-adapter.js?v=113',
    'voice-legado-adapter.js?v=113',
    'workout-voice.js?v=113',
    'strength-form.js?v=113',
    'weekly-plan.js?v=113',
    'action-history.js?v=113',
    'food-log.js?v=113',
    'advice-panel.js?v=113',
    'advice-template-manager.js?v=113',
    'advice-render.js?v=113',
    'advice-prompt.js?v=113',
    'advice-stream-renderer.js?v=113',
    'backup.js?v=113',
    'sync-ui.js?v=113',
    'sync-adapters.js?v=113',
    'sync.js?v=113',
    'sync-pure.js?v=113',
    'sync-status.js?v=113',
    'workout-system.js?v=113',
    'workout-wakelock.js?v=113',
    'workout-media-session.js?v=113',
    'workout-pip.js?v=113',
    'workout-core.js?v=113',
    'workout-cardio-pure.js?v=113',
    'workout-cardio.js?v=113',
    'workout-engine.js?v=113',
    'workout-state.js?v=113',
    'app-update.js?v=113',
    'credential-fields.js?v=113',
    'sheet-drag.js?v=113',
    'toast.js?v=113',
    'error-bus.js?v=113',
    'i18n.js?v=113',
    'a11y-focus-trap.js?v=113',
    'i18n/zh-CN.json?v=113',
    'i18n/en-US.json?v=113',
    'weekly-summary.js?v=113',
    'pr-tracker.js?v=113',
    'volume-heatmap.js?v=113',
    'onboarding.js?v=113',
    'swipe-actions.js?v=113',
    'health-profile.js?v=113',
    'report-metrics-pure.js?v=113',
    'report-panel.js?v=113',
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
