// @ts-nocheck
const CACHE = 'training-assistant-v240';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'build/generated.css?v=240',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=240',
    'workout-readiness.js?v=240',
    'css-src/42-health-profile.css?v=240',
    'theme.js?v=240',
    'haptics.js?v=240',
    'fooddb.js?v=240',
    'ai-store.js?v=240',
    'ai-vision-pure.mjs?v=240',
    'ai-profile.js?v=240',
    'ai-models.js?v=240',
    'ai-api.js?v=240',
    'ai-pricing.js?v=240',
    'ai-templates.js?v=240',
    'render-safe.js?v=240',
    'nav-stack.js?v=240',
    'data-utils-pure.js?v=240',
    'data-utils.js?v=240',
    'data-records.js?v=240',
    'data-schema.js?v=240',
    'storage/idb.js?v=240',
    'storage/idb-collections.js?v=240',
    'storage/migrate.js?v=240',
    'data-store.js?v=240',
    'data-ui-state.js?v=240',
    'health-diet.js?v=240',
    'health-weight.js?v=240',
    'health-exercise.js?v=240',
    'goal-plan.js?v=240',
    'routine-plan.js?v=240',
    'routine-library.js?v=240',
    'data-views.js?v=240',
    'data.js?v=240',
    'voice-engine.js?v=240',
    'voice-cache.js?v=240',
    'voice-webspeech-adapter.js?v=240',
    'voice-legado-adapter.js?v=240',
    'workout-voice.js?v=240',
    'strength-form.js?v=240',
    'weekly-plan.js?v=240',
    'action-history.js?v=240',
    'plan-chains.js?v=240',
    'plan-progression.js?v=240',
    'plan-store.js?v=240',
    'plan-feedback.js?v=240',
    'plan-cooldown.js?v=240',
    'plan-weekly.js?v=240',
    'plan-equipment.js?v=240',
    'plan-ai.js?v=240',
    'plan-ui.js?v=240',
    'plan-progression-pure.js?v=240',
    'plan-store-pure.js?v=240',
    'food-log.js?v=240',
    'advice-panel.js?v=240',
    'coach-context.js?v=240',
    'advice-rules.js?v=240',
    'plan-analytics.js?v=240',
    'advice-template-manager.js?v=240',
    'advice-render.js?v=240',
    'advice-attachments.js?v=240',
    'advice-prompt.js?v=240',
    'advice-stream-renderer.js?v=240',
    'backup.js?v=240',
    'sync-ui.js?v=240',
    'sync-adapters.js?v=240',
    'sync.js?v=240',
    'sync-pure.js?v=240',
    'sync-status.js?v=240',
    'workout-system.js?v=240',
    'workout-wakelock.js?v=240',
    'workout-media-session.js?v=240',
    'workout-pip.js?v=240',
    'workout-core.js?v=240',
    'workout-cardio-pure.js?v=240',
    'workout-cardio.js?v=240',
    'workout-engine.js?v=240',
    'workout-state.js?v=240',
    'app-update.js?v=240',
    'credential-fields.js?v=240',
    'sheet-drag.js?v=240',
    'mi-scale-pure.js?v=240',
    'mi-scale-web-bluetooth.js?v=240',
    'm3e-ripple.js?v=240',
    'toast.js?v=240',
    'error-bus.js?v=240',
    'i18n.js?v=240',
    'a11y-focus-trap.js?v=240',
    'i18n/zh-CN.json?v=240',
    'i18n/en-US.json?v=240',
    'weekly-summary.js?v=240',
    'pr-tracker.js?v=240',
    'volume-heatmap.js?v=240',
    'swipe-actions.js?v=240',
    'health-profile.js?v=240',
    'report-metrics-pure.js?v=240',
    'report-panel.js?v=240',
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
