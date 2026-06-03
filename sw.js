// @ts-nocheck
const CACHE = 'training-assistant-v226';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'build/generated.css?v=226',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=226',
    'workout-readiness.js?v=226',
    'css-src/42-health-profile.css?v=226',
    'theme.js?v=226',
    'haptics.js?v=226',
    'fooddb.js?v=226',
    'ai-store.js?v=226',
    'ai-vision-pure.mjs?v=226',
    'ai-profile.js?v=226',
    'ai-models.js?v=226',
    'ai-api.js?v=226',
    'ai-pricing.js?v=226',
    'ai-templates.js?v=226',
    'render-safe.js?v=226',
    'nav-stack.js?v=226',
    'data-utils-pure.js?v=226',
    'data-utils.js?v=226',
    'data-records.js?v=226',
    'data-schema.js?v=226',
    'storage/idb.js?v=226',
    'storage/idb-collections.js?v=226',
    'storage/migrate.js?v=226',
    'data-store.js?v=226',
    'data-ui-state.js?v=226',
    'health-diet.js?v=226',
    'health-weight.js?v=226',
    'health-exercise.js?v=226',
    'goal-plan.js?v=226',
    'routine-plan.js?v=226',
    'routine-library.js?v=226',
    'data-views.js?v=226',
    'data.js?v=226',
    'voice-engine.js?v=226',
    'voice-cache.js?v=226',
    'voice-webspeech-adapter.js?v=226',
    'voice-legado-adapter.js?v=226',
    'workout-voice.js?v=226',
    'strength-form.js?v=226',
    'weekly-plan.js?v=226',
    'action-history.js?v=226',
    'plan-chains.js?v=226',
    'plan-progression.js?v=226',
    'plan-store.js?v=226',
    'plan-feedback.js?v=226',
    'plan-cooldown.js?v=226',
    'plan-weekly.js?v=226',
    'plan-equipment.js?v=226',
    'plan-ai.js?v=226',
    'plan-ui.js?v=226',
    'plan-progression-pure.js?v=226',
    'plan-store-pure.js?v=226',
    'food-log.js?v=226',
    'advice-panel.js?v=226',
    'advice-rules.js?v=226',
    'plan-analytics.js?v=226',
    'advice-template-manager.js?v=226',
    'advice-render.js?v=226',
    'advice-attachments.js?v=226',
    'advice-prompt.js?v=226',
    'advice-stream-renderer.js?v=226',
    'backup.js?v=226',
    'sync-ui.js?v=226',
    'sync-adapters.js?v=226',
    'sync.js?v=226',
    'sync-pure.js?v=226',
    'sync-status.js?v=226',
    'workout-system.js?v=226',
    'workout-wakelock.js?v=226',
    'workout-media-session.js?v=226',
    'workout-pip.js?v=226',
    'workout-core.js?v=226',
    'workout-cardio-pure.js?v=226',
    'workout-cardio.js?v=226',
    'workout-engine.js?v=226',
    'workout-state.js?v=226',
    'app-update.js?v=226',
    'credential-fields.js?v=226',
    'sheet-drag.js?v=226',
    'mi-scale-pure.js?v=226',
    'mi-scale-web-bluetooth.js?v=226',
    'm3e-ripple.js?v=226',
    'toast.js?v=226',
    'error-bus.js?v=226',
    'i18n.js?v=226',
    'a11y-focus-trap.js?v=226',
    'i18n/zh-CN.json?v=226',
    'i18n/en-US.json?v=226',
    'weekly-summary.js?v=226',
    'pr-tracker.js?v=226',
    'volume-heatmap.js?v=226',
    'swipe-actions.js?v=226',
    'health-profile.js?v=226',
    'report-metrics-pure.js?v=226',
    'report-panel.js?v=226',
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
