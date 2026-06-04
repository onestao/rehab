// @ts-nocheck
const CACHE = 'training-assistant-v235';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'build/generated.css?v=235',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=235',
    'workout-readiness.js?v=235',
    'css-src/42-health-profile.css?v=235',
    'theme.js?v=235',
    'haptics.js?v=235',
    'fooddb.js?v=235',
    'ai-store.js?v=235',
    'ai-vision-pure.mjs?v=235',
    'ai-profile.js?v=235',
    'ai-models.js?v=235',
    'ai-api.js?v=235',
    'ai-pricing.js?v=235',
    'ai-templates.js?v=235',
    'render-safe.js?v=235',
    'nav-stack.js?v=235',
    'data-utils-pure.js?v=235',
    'data-utils.js?v=235',
    'data-records.js?v=235',
    'data-schema.js?v=235',
    'storage/idb.js?v=235',
    'storage/idb-collections.js?v=235',
    'storage/migrate.js?v=235',
    'data-store.js?v=235',
    'data-ui-state.js?v=235',
    'health-diet.js?v=235',
    'health-weight.js?v=235',
    'health-exercise.js?v=235',
    'goal-plan.js?v=235',
    'routine-plan.js?v=235',
    'routine-library.js?v=235',
    'data-views.js?v=235',
    'data.js?v=235',
    'voice-engine.js?v=235',
    'voice-cache.js?v=235',
    'voice-webspeech-adapter.js?v=235',
    'voice-legado-adapter.js?v=235',
    'workout-voice.js?v=235',
    'strength-form.js?v=235',
    'weekly-plan.js?v=235',
    'action-history.js?v=235',
    'plan-chains.js?v=235',
    'plan-progression.js?v=235',
    'plan-store.js?v=235',
    'plan-feedback.js?v=235',
    'plan-cooldown.js?v=235',
    'plan-weekly.js?v=235',
    'plan-equipment.js?v=235',
    'plan-ai.js?v=235',
    'plan-ui.js?v=235',
    'plan-progression-pure.js?v=235',
    'plan-store-pure.js?v=235',
    'food-log.js?v=235',
    'advice-panel.js?v=235',
    'advice-rules.js?v=235',
    'plan-analytics.js?v=235',
    'advice-template-manager.js?v=235',
    'advice-render.js?v=235',
    'advice-attachments.js?v=235',
    'advice-prompt.js?v=235',
    'advice-stream-renderer.js?v=235',
    'backup.js?v=235',
    'sync-ui.js?v=235',
    'sync-adapters.js?v=235',
    'sync.js?v=235',
    'sync-pure.js?v=235',
    'sync-status.js?v=235',
    'workout-system.js?v=235',
    'workout-wakelock.js?v=235',
    'workout-media-session.js?v=235',
    'workout-pip.js?v=235',
    'workout-core.js?v=235',
    'workout-cardio-pure.js?v=235',
    'workout-cardio.js?v=235',
    'workout-engine.js?v=235',
    'workout-state.js?v=235',
    'app-update.js?v=235',
    'credential-fields.js?v=235',
    'sheet-drag.js?v=235',
    'mi-scale-pure.js?v=235',
    'mi-scale-web-bluetooth.js?v=235',
    'm3e-ripple.js?v=235',
    'toast.js?v=235',
    'error-bus.js?v=235',
    'i18n.js?v=235',
    'a11y-focus-trap.js?v=235',
    'i18n/zh-CN.json?v=235',
    'i18n/en-US.json?v=235',
    'weekly-summary.js?v=235',
    'pr-tracker.js?v=235',
    'volume-heatmap.js?v=235',
    'swipe-actions.js?v=235',
    'health-profile.js?v=235',
    'report-metrics-pure.js?v=235',
    'report-panel.js?v=235',
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
