// @ts-nocheck
const CACHE = 'training-assistant-v219';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'build/generated.css?v=219',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=219',
    'workout-readiness.js?v=219',
    'css-src/42-health-profile.css?v=219',
    'theme.js?v=219',
    'haptics.js?v=219',
    'fooddb.js?v=219',
    'ai-store.js?v=219',
    'ai-vision-pure.mjs?v=219',
    'ai-profile.js?v=219',
    'ai-models.js?v=219',
    'ai-api.js?v=219',
    'ai-pricing.js?v=219',
    'ai-templates.js?v=219',
    'render-safe.js?v=219',
    'nav-stack.js?v=219',
    'data-utils-pure.js?v=219',
    'data-utils.js?v=219',
    'data-records.js?v=219',
    'data-schema.js?v=219',
    'storage/idb.js?v=219',
    'storage/idb-collections.js?v=219',
    'storage/migrate.js?v=219',
    'data-store.js?v=219',
    'data-ui-state.js?v=219',
    'health-diet.js?v=219',
    'health-weight.js?v=219',
    'health-exercise.js?v=219',
    'goal-plan.js?v=219',
    'routine-plan.js?v=219',
    'routine-library.js?v=219',
    'data-views.js?v=219',
    'data.js?v=219',
    'voice-engine.js?v=219',
    'voice-cache.js?v=219',
    'voice-webspeech-adapter.js?v=219',
    'voice-legado-adapter.js?v=219',
    'workout-voice.js?v=219',
    'strength-form.js?v=219',
    'weekly-plan.js?v=219',
    'action-history.js?v=219',
    'plan-chains.js?v=219',
    'plan-progression.js?v=219',
    'plan-store.js?v=219',
    'plan-feedback.js?v=219',
    'plan-cooldown.js?v=219',
    'plan-weekly.js?v=219',
    'plan-equipment.js?v=219',
    'plan-ai.js?v=219',
    'plan-ui.js?v=219',
    'plan-progression-pure.js?v=219',
    'plan-store-pure.js?v=219',
    'food-log.js?v=219',
    'advice-panel.js?v=219',
    'advice-rules.js?v=219',
    'plan-analytics.js?v=219',
    'advice-template-manager.js?v=219',
    'advice-render.js?v=219',
    'advice-attachments.js?v=219',
    'advice-prompt.js?v=219',
    'advice-stream-renderer.js?v=219',
    'backup.js?v=219',
    'sync-ui.js?v=219',
    'sync-adapters.js?v=219',
    'sync.js?v=219',
    'sync-pure.js?v=219',
    'sync-status.js?v=219',
    'workout-system.js?v=219',
    'workout-wakelock.js?v=219',
    'workout-media-session.js?v=219',
    'workout-pip.js?v=219',
    'workout-core.js?v=219',
    'workout-cardio-pure.js?v=219',
    'workout-cardio.js?v=219',
    'workout-engine.js?v=219',
    'workout-state.js?v=219',
    'app-update.js?v=219',
    'credential-fields.js?v=219',
    'sheet-drag.js?v=219',
    'm3e-ripple.js?v=219',
    'toast.js?v=219',
    'error-bus.js?v=219',
    'i18n.js?v=219',
    'a11y-focus-trap.js?v=219',
    'i18n/zh-CN.json?v=219',
    'i18n/en-US.json?v=219',
    'weekly-summary.js?v=219',
    'pr-tracker.js?v=219',
    'volume-heatmap.js?v=219',
    'swipe-actions.js?v=219',
    'health-profile.js?v=219',
    'report-metrics-pure.js?v=219',
    'report-panel.js?v=219',
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
