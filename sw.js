// @ts-nocheck
const CACHE = 'training-assistant-v213';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'build/generated.css?v=213',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=213',
    'workout-readiness.js?v=213',
    'css-src/42-health-profile.css?v=213',
    'theme.js?v=213',
    'haptics.js?v=213',
    'fooddb.js?v=213',
    'ai-store.js?v=213',
    'ai-vision-pure.mjs?v=213',
    'ai-profile.js?v=213',
    'ai-models.js?v=213',
    'ai-api.js?v=213',
    'ai-pricing.js?v=213',
    'ai-templates.js?v=213',
    'render-safe.js?v=213',
    'nav-stack.js?v=213',
    'data-utils-pure.js?v=213',
    'data-utils.js?v=213',
    'data-records.js?v=213',
    'data-schema.js?v=213',
    'storage/idb.js?v=213',
    'storage/idb-collections.js?v=213',
    'storage/migrate.js?v=213',
    'data-store.js?v=213',
    'data-ui-state.js?v=213',
    'health-diet.js?v=213',
    'health-weight.js?v=213',
    'health-exercise.js?v=213',
    'goal-plan.js?v=213',
    'routine-plan.js?v=213',
    'routine-library.js?v=213',
    'data-views.js?v=213',
    'data.js?v=213',
    'voice-engine.js?v=213',
    'voice-cache.js?v=213',
    'voice-webspeech-adapter.js?v=213',
    'voice-legado-adapter.js?v=213',
    'workout-voice.js?v=213',
    'strength-form.js?v=213',
    'weekly-plan.js?v=213',
    'action-history.js?v=213',
    'plan-chains.js?v=213',
    'plan-progression.js?v=213',
    'plan-store.js?v=213',
    'plan-feedback.js?v=213',
    'plan-cooldown.js?v=213',
    'plan-weekly.js?v=213',
    'plan-equipment.js?v=213',
    'plan-ai.js?v=213',
    'plan-ui.js?v=213',
    'plan-progression-pure.js?v=213',
    'plan-store-pure.js?v=213',
    'food-log.js?v=213',
    'advice-panel.js?v=213',
    'advice-rules.js?v=213',
    'plan-analytics.js?v=213',
    'advice-template-manager.js?v=213',
    'advice-render.js?v=213',
    'advice-attachments.js?v=213',
    'advice-prompt.js?v=213',
    'advice-stream-renderer.js?v=213',
    'backup.js?v=213',
    'sync-ui.js?v=213',
    'sync-adapters.js?v=213',
    'sync.js?v=213',
    'sync-pure.js?v=213',
    'sync-status.js?v=213',
    'workout-system.js?v=213',
    'workout-wakelock.js?v=213',
    'workout-media-session.js?v=213',
    'workout-pip.js?v=213',
    'workout-core.js?v=213',
    'workout-cardio-pure.js?v=213',
    'workout-cardio.js?v=213',
    'workout-engine.js?v=213',
    'workout-state.js?v=213',
    'app-update.js?v=213',
    'credential-fields.js?v=213',
    'sheet-drag.js?v=213',
    'm3e-ripple.js?v=213',
    'toast.js?v=213',
    'error-bus.js?v=213',
    'i18n.js?v=213',
    'a11y-focus-trap.js?v=213',
    'i18n/zh-CN.json?v=213',
    'i18n/en-US.json?v=213',
    'weekly-summary.js?v=213',
    'pr-tracker.js?v=213',
    'volume-heatmap.js?v=213',
    'swipe-actions.js?v=213',
    'health-profile.js?v=213',
    'report-metrics-pure.js?v=213',
    'report-panel.js?v=213',
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
