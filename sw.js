// @ts-nocheck
const CACHE = 'training-assistant-v230';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'build/generated.css?v=230',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=230',
    'workout-readiness.js?v=230',
    'css-src/42-health-profile.css?v=230',
    'theme.js?v=230',
    'haptics.js?v=230',
    'fooddb.js?v=230',
    'ai-store.js?v=230',
    'ai-vision-pure.mjs?v=230',
    'ai-profile.js?v=230',
    'ai-models.js?v=230',
    'ai-api.js?v=230',
    'ai-pricing.js?v=230',
    'ai-templates.js?v=230',
    'render-safe.js?v=230',
    'nav-stack.js?v=230',
    'data-utils-pure.js?v=230',
    'data-utils.js?v=230',
    'data-records.js?v=230',
    'data-schema.js?v=230',
    'storage/idb.js?v=230',
    'storage/idb-collections.js?v=230',
    'storage/migrate.js?v=230',
    'data-store.js?v=230',
    'data-ui-state.js?v=230',
    'health-diet.js?v=230',
    'health-weight.js?v=230',
    'health-exercise.js?v=230',
    'goal-plan.js?v=230',
    'routine-plan.js?v=230',
    'routine-library.js?v=230',
    'data-views.js?v=230',
    'data.js?v=230',
    'voice-engine.js?v=230',
    'voice-cache.js?v=230',
    'voice-webspeech-adapter.js?v=230',
    'voice-legado-adapter.js?v=230',
    'workout-voice.js?v=230',
    'strength-form.js?v=230',
    'weekly-plan.js?v=230',
    'action-history.js?v=230',
    'plan-chains.js?v=230',
    'plan-progression.js?v=230',
    'plan-store.js?v=230',
    'plan-feedback.js?v=230',
    'plan-cooldown.js?v=230',
    'plan-weekly.js?v=230',
    'plan-equipment.js?v=230',
    'plan-ai.js?v=230',
    'plan-ui.js?v=230',
    'plan-progression-pure.js?v=230',
    'plan-store-pure.js?v=230',
    'food-log.js?v=230',
    'advice-panel.js?v=230',
    'advice-rules.js?v=230',
    'plan-analytics.js?v=230',
    'advice-template-manager.js?v=230',
    'advice-render.js?v=230',
    'advice-attachments.js?v=230',
    'advice-prompt.js?v=230',
    'advice-stream-renderer.js?v=230',
    'backup.js?v=230',
    'sync-ui.js?v=230',
    'sync-adapters.js?v=230',
    'sync.js?v=230',
    'sync-pure.js?v=230',
    'sync-status.js?v=230',
    'workout-system.js?v=230',
    'workout-wakelock.js?v=230',
    'workout-media-session.js?v=230',
    'workout-pip.js?v=230',
    'workout-core.js?v=230',
    'workout-cardio-pure.js?v=230',
    'workout-cardio.js?v=230',
    'workout-engine.js?v=230',
    'workout-state.js?v=230',
    'app-update.js?v=230',
    'credential-fields.js?v=230',
    'sheet-drag.js?v=230',
    'mi-scale-pure.js?v=230',
    'mi-scale-web-bluetooth.js?v=230',
    'm3e-ripple.js?v=230',
    'toast.js?v=230',
    'error-bus.js?v=230',
    'i18n.js?v=230',
    'a11y-focus-trap.js?v=230',
    'i18n/zh-CN.json?v=230',
    'i18n/en-US.json?v=230',
    'weekly-summary.js?v=230',
    'pr-tracker.js?v=230',
    'volume-heatmap.js?v=230',
    'swipe-actions.js?v=230',
    'health-profile.js?v=230',
    'report-metrics-pure.js?v=230',
    'report-panel.js?v=230',
    'assets/vision-models.json',
    'assets/heic2any.min.js',
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
        await self.skipWaiting();
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

function normalizeVersionedAsset(url) {
    if (!isVersionedAsset(url) || url.searchParams.get('v') === CACHE_VERSION) return url.toString();
    const next = new URL(url.toString());
    next.searchParams.set('v', CACHE_VERSION);
    return next.toString();
}

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (voiceTtsHosts.has(url.hostname.toLowerCase())) {
        event.respondWith(fetch(event.request));
        return;
    }
    if (url.origin !== location.origin) return;

    if (event.request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname === '/') {
        event.respondWith(fetch(event.request, { cache: 'no-store' }));
        return;
    }

    if (isVersionedAsset(url)) {
        // Cache-first for hashed assets: avoids slow waterfall on tab switch.
        event.respondWith((async () => {
            const cacheKey = normalizeVersionedAsset(url);
            const cached = await caches.match(cacheKey);
            if (cached) return cached;
            try {
                const res = await fetch(cacheKey, { credentials: 'same-origin', cache: 'no-store' });
                if (res && res.ok) {
                    const clone = res.clone();
                    const cache = await caches.open(CACHE);
                    cache.put(cacheKey, clone).catch(() => {});
                }
                return res;
            } catch (err) {
                const fallback = await caches.match(cacheKey);
                if (fallback) return fallback;
                throw err;
            }
        })());
        return;
    }

    // Network-first for unversioned dynamic data.
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
