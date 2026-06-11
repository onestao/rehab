// @ts-nocheck
const CACHE = 'training-assistant-v258';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=258',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=258',
    'workout-readiness.js?v=258',
    'css-src/42-health-profile.css?v=258',
    'theme.js?v=258',
    'haptics.js?v=258',
    'fooddb.js?v=258',
    'ai-store.js?v=258',
    'ai-vision-pure.mjs?v=258',
    'ai-profile.js?v=258',
    'ai-model-cache.js?v=258',
    'ai-models.js?v=258',
    'ai-api.js?v=258',
    'ai-pricing.js?v=258',
    'ai-templates.js?v=258',
    'render-safe.js?v=258',
    'nav-stack.js?v=258',
    'data-utils-pure.js?v=258',
    'data-utils.js?v=258',
    'data-records.js?v=258',
    'data-schema.js?v=258',
    'storage/idb.js?v=258',
    'storage/idb-collections.js?v=258',
    'storage/migrate.js?v=258',
    'data-store.js?v=258',
    'data-ui-state.js?v=258',
    'health-diet.js?v=258',
    'health-weight.js?v=258',
    'health-exercise.js?v=258',
    'goal-plan.js?v=258',
    'routine-plan.js?v=258',
    'routine-library.js?v=258',
    'data-views.js?v=258',
    'data.js?v=258',
    'voice-engine.js?v=258',
    'voice-cache.js?v=258',
    'voice-webspeech-adapter.js?v=258',
    'voice-legado-adapter.js?v=258',
    'workout-voice.js?v=258',
    'strength-form.js?v=258',
    'weekly-plan.js?v=258',
    'action-history.js?v=258',
    'plan-chains.js?v=258',
    'plan-progression.js?v=258',
    'plan-store.js?v=258',
    'plan-feedback.js?v=258',
    'plan-cooldown.js?v=258',
    'plan-weekly.js?v=258',
    'plan-equipment.js?v=258',
    'plan-ai-pure.js?v=258',
    'plan-ai.js?v=258',
    'plan-ui.js?v=258',
    'plan-progression-pure.js?v=258',
    'plan-store-pure.js?v=258',
    'food-log.js?v=258',
    'advice-panel.js?v=258',
    'coach-context.js?v=258',
    'advice-rules.js?v=258',
    'plan-analytics.js?v=258',
    'advice-template-manager.js?v=258',
    'advice-render.js?v=258',
    'advice-attachments.js?v=258',
    'advice-prompt.js?v=258',
    'advice-stream-renderer.js?v=258',
    'backup.js?v=258',
    'sync-ui.js?v=258',
    'sync-adapters.js?v=258',
    'sync.js?v=258',
    'sync-pure.js?v=258',
    'sync-status.js?v=258',
    'workout-system.js?v=258',
    'workout-wakelock.js?v=258',
    'workout-media-session.js?v=258',
    'workout-pip.js?v=258',
    'workout-core.js?v=258',
    'workout-cardio-pure.js?v=258',
    'workout-cardio.js?v=258',
    'workout-engine.js?v=258',
    'workout-state.js?v=258',
    'app-update.js?v=258',
    'credential-fields.js?v=258',
    'sheet-drag.js?v=258',
    'mi-scale-pure.js?v=258',
    'mi-scale-web-bluetooth.js?v=258',
    'm3e-ripple.js?v=258',
    'toast.js?v=258',
    'error-bus.js?v=258',
    'i18n.js?v=258',
    'a11y-focus-trap.js?v=258',
    'i18n/zh-CN.json?v=258',
    'i18n/en-US.json?v=258',
    'weekly-summary.js?v=258',
    'pr-tracker.js?v=258',
    'volume-heatmap.js?v=258',
    'swipe-actions.js?v=258',
    'health-profile.js?v=258',
    'report-metrics-pure.js?v=258',
    'report-panel.js?v=258',
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

async function fetchNavigation(request) {
    try {
        const res = await fetch(request, { cache: 'no-store' });
        if (res && res.ok) {
            const cache = await caches.open(CACHE);
            cache.put('index.html', res.clone()).catch(() => {});
        }
        return res;
    } catch (err) {
        const cached = await caches.match('index.html') || await caches.match('./index.html') || await caches.match('/index.html');
        if (cached) return cached;
        throw err;
    }
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
        event.respondWith(fetchNavigation(event.request));
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
