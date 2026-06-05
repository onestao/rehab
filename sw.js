// @ts-nocheck
const CACHE = 'training-assistant-v238';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'build/generated.css?v=238',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=238',
    'workout-readiness.js?v=238',
    'css-src/42-health-profile.css?v=238',
    'theme.js?v=238',
    'haptics.js?v=238',
    'fooddb.js?v=238',
    'ai-store.js?v=238',
    'ai-vision-pure.mjs?v=238',
    'ai-profile.js?v=238',
    'ai-models.js?v=238',
    'ai-api.js?v=238',
    'ai-pricing.js?v=238',
    'ai-templates.js?v=238',
    'render-safe.js?v=238',
    'nav-stack.js?v=238',
    'data-utils-pure.js?v=238',
    'data-utils.js?v=238',
    'data-records.js?v=238',
    'data-schema.js?v=238',
    'storage/idb.js?v=238',
    'storage/idb-collections.js?v=238',
    'storage/migrate.js?v=238',
    'data-store.js?v=238',
    'data-ui-state.js?v=238',
    'health-diet.js?v=238',
    'health-weight.js?v=238',
    'health-exercise.js?v=238',
    'goal-plan.js?v=238',
    'routine-plan.js?v=238',
    'routine-library.js?v=238',
    'data-views.js?v=238',
    'data.js?v=238',
    'voice-engine.js?v=238',
    'voice-cache.js?v=238',
    'voice-webspeech-adapter.js?v=238',
    'voice-legado-adapter.js?v=238',
    'workout-voice.js?v=238',
    'strength-form.js?v=238',
    'weekly-plan.js?v=238',
    'action-history.js?v=238',
    'plan-chains.js?v=238',
    'plan-progression.js?v=238',
    'plan-store.js?v=238',
    'plan-feedback.js?v=238',
    'plan-cooldown.js?v=238',
    'plan-weekly.js?v=238',
    'plan-equipment.js?v=238',
    'plan-ai.js?v=238',
    'plan-ui.js?v=238',
    'plan-progression-pure.js?v=238',
    'plan-store-pure.js?v=238',
    'food-log.js?v=238',
    'advice-panel.js?v=238',
    'coach-context.js?v=238',
    'advice-rules.js?v=238',
    'plan-analytics.js?v=238',
    'advice-template-manager.js?v=238',
    'advice-render.js?v=238',
    'advice-attachments.js?v=238',
    'advice-prompt.js?v=238',
    'advice-stream-renderer.js?v=238',
    'backup.js?v=238',
    'sync-ui.js?v=238',
    'sync-adapters.js?v=238',
    'sync.js?v=238',
    'sync-pure.js?v=238',
    'sync-status.js?v=238',
    'workout-system.js?v=238',
    'workout-wakelock.js?v=238',
    'workout-media-session.js?v=238',
    'workout-pip.js?v=238',
    'workout-core.js?v=238',
    'workout-cardio-pure.js?v=238',
    'workout-cardio.js?v=238',
    'workout-engine.js?v=238',
    'workout-state.js?v=238',
    'app-update.js?v=238',
    'credential-fields.js?v=238',
    'sheet-drag.js?v=238',
    'mi-scale-pure.js?v=238',
    'mi-scale-web-bluetooth.js?v=238',
    'm3e-ripple.js?v=238',
    'toast.js?v=238',
    'error-bus.js?v=238',
    'i18n.js?v=238',
    'a11y-focus-trap.js?v=238',
    'i18n/zh-CN.json?v=238',
    'i18n/en-US.json?v=238',
    'weekly-summary.js?v=238',
    'pr-tracker.js?v=238',
    'volume-heatmap.js?v=238',
    'swipe-actions.js?v=238',
    'health-profile.js?v=238',
    'report-metrics-pure.js?v=238',
    'report-panel.js?v=238',
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
