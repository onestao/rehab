// @ts-nocheck
const CACHE = 'training-assistant-v237';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'build/generated.css?v=237',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=237',
    'workout-readiness.js?v=237',
    'css-src/42-health-profile.css?v=237',
    'theme.js?v=237',
    'haptics.js?v=237',
    'fooddb.js?v=237',
    'ai-store.js?v=237',
    'ai-vision-pure.mjs?v=237',
    'ai-profile.js?v=237',
    'ai-models.js?v=237',
    'ai-api.js?v=237',
    'ai-pricing.js?v=237',
    'ai-templates.js?v=237',
    'render-safe.js?v=237',
    'nav-stack.js?v=237',
    'data-utils-pure.js?v=237',
    'data-utils.js?v=237',
    'data-records.js?v=237',
    'data-schema.js?v=237',
    'storage/idb.js?v=237',
    'storage/idb-collections.js?v=237',
    'storage/migrate.js?v=237',
    'data-store.js?v=237',
    'data-ui-state.js?v=237',
    'health-diet.js?v=237',
    'health-weight.js?v=237',
    'health-exercise.js?v=237',
    'goal-plan.js?v=237',
    'routine-plan.js?v=237',
    'routine-library.js?v=237',
    'data-views.js?v=237',
    'data.js?v=237',
    'voice-engine.js?v=237',
    'voice-cache.js?v=237',
    'voice-webspeech-adapter.js?v=237',
    'voice-legado-adapter.js?v=237',
    'workout-voice.js?v=237',
    'strength-form.js?v=237',
    'weekly-plan.js?v=237',
    'action-history.js?v=237',
    'plan-chains.js?v=237',
    'plan-progression.js?v=237',
    'plan-store.js?v=237',
    'plan-feedback.js?v=237',
    'plan-cooldown.js?v=237',
    'plan-weekly.js?v=237',
    'plan-equipment.js?v=237',
    'plan-ai.js?v=237',
    'plan-ui.js?v=237',
    'plan-progression-pure.js?v=237',
    'plan-store-pure.js?v=237',
    'food-log.js?v=237',
    'advice-panel.js?v=237',
    'coach-context.js?v=237',
    'advice-rules.js?v=237',
    'plan-analytics.js?v=237',
    'advice-template-manager.js?v=237',
    'advice-render.js?v=237',
    'advice-attachments.js?v=237',
    'advice-prompt.js?v=237',
    'advice-stream-renderer.js?v=237',
    'backup.js?v=237',
    'sync-ui.js?v=237',
    'sync-adapters.js?v=237',
    'sync.js?v=237',
    'sync-pure.js?v=237',
    'sync-status.js?v=237',
    'workout-system.js?v=237',
    'workout-wakelock.js?v=237',
    'workout-media-session.js?v=237',
    'workout-pip.js?v=237',
    'workout-core.js?v=237',
    'workout-cardio-pure.js?v=237',
    'workout-cardio.js?v=237',
    'workout-engine.js?v=237',
    'workout-state.js?v=237',
    'app-update.js?v=237',
    'credential-fields.js?v=237',
    'sheet-drag.js?v=237',
    'mi-scale-pure.js?v=237',
    'mi-scale-web-bluetooth.js?v=237',
    'm3e-ripple.js?v=237',
    'toast.js?v=237',
    'error-bus.js?v=237',
    'i18n.js?v=237',
    'a11y-focus-trap.js?v=237',
    'i18n/zh-CN.json?v=237',
    'i18n/en-US.json?v=237',
    'weekly-summary.js?v=237',
    'pr-tracker.js?v=237',
    'volume-heatmap.js?v=237',
    'swipe-actions.js?v=237',
    'health-profile.js?v=237',
    'report-metrics-pure.js?v=237',
    'report-panel.js?v=237',
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
