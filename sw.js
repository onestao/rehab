// @ts-nocheck
const CACHE = 'training-assistant-v257';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=257',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=257',
    'workout-readiness.js?v=257',
    'css-src/42-health-profile.css?v=257',
    'theme.js?v=257',
    'haptics.js?v=257',
    'fooddb.js?v=257',
    'ai-store.js?v=257',
    'ai-vision-pure.mjs?v=257',
    'ai-profile.js?v=257',
    'ai-model-cache.js?v=257',
    'ai-models.js?v=257',
    'ai-api.js?v=257',
    'ai-pricing.js?v=257',
    'ai-templates.js?v=257',
    'render-safe.js?v=257',
    'nav-stack.js?v=257',
    'data-utils-pure.js?v=257',
    'data-utils.js?v=257',
    'data-records.js?v=257',
    'data-schema.js?v=257',
    'storage/idb.js?v=257',
    'storage/idb-collections.js?v=257',
    'storage/migrate.js?v=257',
    'data-store.js?v=257',
    'data-ui-state.js?v=257',
    'health-diet.js?v=257',
    'health-weight.js?v=257',
    'health-exercise.js?v=257',
    'goal-plan.js?v=257',
    'routine-plan.js?v=257',
    'routine-library.js?v=257',
    'data-views.js?v=257',
    'data.js?v=257',
    'voice-engine.js?v=257',
    'voice-cache.js?v=257',
    'voice-webspeech-adapter.js?v=257',
    'voice-legado-adapter.js?v=257',
    'workout-voice.js?v=257',
    'strength-form.js?v=257',
    'weekly-plan.js?v=257',
    'action-history.js?v=257',
    'plan-chains.js?v=257',
    'plan-progression.js?v=257',
    'plan-store.js?v=257',
    'plan-feedback.js?v=257',
    'plan-cooldown.js?v=257',
    'plan-weekly.js?v=257',
    'plan-equipment.js?v=257',
    'plan-ai-pure.js?v=257',
    'plan-ai.js?v=257',
    'plan-ui.js?v=257',
    'plan-progression-pure.js?v=257',
    'plan-store-pure.js?v=257',
    'food-log.js?v=257',
    'advice-panel.js?v=257',
    'coach-context.js?v=257',
    'advice-rules.js?v=257',
    'plan-analytics.js?v=257',
    'advice-template-manager.js?v=257',
    'advice-render.js?v=257',
    'advice-attachments.js?v=257',
    'advice-prompt.js?v=257',
    'advice-stream-renderer.js?v=257',
    'backup.js?v=257',
    'sync-ui.js?v=257',
    'sync-adapters.js?v=257',
    'sync.js?v=257',
    'sync-pure.js?v=257',
    'sync-status.js?v=257',
    'workout-system.js?v=257',
    'workout-wakelock.js?v=257',
    'workout-media-session.js?v=257',
    'workout-pip.js?v=257',
    'workout-core.js?v=257',
    'workout-cardio-pure.js?v=257',
    'workout-cardio.js?v=257',
    'workout-engine.js?v=257',
    'workout-state.js?v=257',
    'app-update.js?v=257',
    'credential-fields.js?v=257',
    'sheet-drag.js?v=257',
    'mi-scale-pure.js?v=257',
    'mi-scale-web-bluetooth.js?v=257',
    'm3e-ripple.js?v=257',
    'toast.js?v=257',
    'error-bus.js?v=257',
    'i18n.js?v=257',
    'a11y-focus-trap.js?v=257',
    'i18n/zh-CN.json?v=257',
    'i18n/en-US.json?v=257',
    'weekly-summary.js?v=257',
    'pr-tracker.js?v=257',
    'volume-heatmap.js?v=257',
    'swipe-actions.js?v=257',
    'health-profile.js?v=257',
    'report-metrics-pure.js?v=257',
    'report-panel.js?v=257',
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
