// @ts-nocheck
const CACHE = 'training-assistant-v293';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=293',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=293',
    'workout-readiness.js?v=293',
    'css-src/42-health-profile.css?v=293',
    'theme.js?v=293',
    'haptics.js?v=293',
    'fooddb.js?v=293',
    'ai-store.js?v=293',
    'ai-vision-pure.mjs?v=293',
    'ai-profile.js?v=293',
    'ai-model-cache.js?v=293',
    'ai-models.js?v=293',
    'ai-api.js?v=293',
    'ai-pricing.js?v=293',
    'ai-templates.js?v=293',
    'render-safe.js?v=293',
    'nav-stack.js?v=293',
    'app-route.js?v=293',
    'data-utils-pure.js?v=293',
    'data-utils.js?v=293',
    'data-records.js?v=293',
    'data-schema.js?v=293',
    'storage/idb.js?v=293',
    'storage/idb-collections.js?v=293',
    'storage/idb-advice-collections.js?v=293',
    'storage/migrate.js?v=293',
    'advice-virtual-list.js?v=293',
    'data-store.js?v=293',
    'data-ui-state.js?v=293',
    'health-diet.js?v=293',
    'health-weight.js?v=293',
    'health-exercise.js?v=293',
    'goal-plan.js?v=293',
    'routine-plan.js?v=293',
    'routine-library.js?v=293',
    'data-views.js?v=293',
    'data.js?v=293',
    'voice-engine.js?v=293',
    'voice-cache.js?v=293',
    'voice-webspeech-adapter.js?v=293',
    'voice-legado-adapter.js?v=293',
    'workout-voice.js?v=293',
    'strength-form.js?v=293',
    'weekly-plan.js?v=293',
    'action-history.js?v=293',
    'plan-chains.js?v=293',
    'plan-progression.js?v=293',
    'rehab-policy.js?v=293',
    'plan-store.js?v=293',
    'plan-feedback.js?v=293',
    'plan-cooldown.js?v=293',
    'plan-auto-adjust.js?v=293',
    'plan-weekly.js?v=293',
    'plan-equipment.js?v=293',
    'plan-ai-pure.js?v=293',
    'plan-ai.js?v=293',
    'plan-ui.js?v=293',
    'rehab-progression-pure.js?v=293',
    'plan-store-pure.js?v=293',
    'food-log.js?v=293',
    'lib/virtual-core.umd.js?v=293',
    'lib/flexsearch.light.js?v=293',
    'lib/flexsearch.light.js',
    'advice-search.worker.js',
    'advice-search.worker.js?v=293',
    'advice-panel.js?v=293',
    'coach-context.js?v=293',
    'advice-rules.js?v=293',
    'plan-analytics.js?v=293',
    'advice-template-manager.js?v=293',
    'advice-render.js?v=293',
    'advice-attachments.js?v=293',
    'advice-prompt.js?v=293',
    'advice-stream-renderer.js?v=293',
    'backup.js?v=293',
    'sync-ui.js?v=293',
    'sync-adapters.js?v=293',
    'sync.js?v=293',
    'sync-pure.js?v=293',
    'sync-status.js?v=293',
    'workout-system.js?v=293',
    'workout-wakelock.js?v=293',
    'workout-media-session.js?v=293',
    'workout-pip.js?v=293',
    'workout-core.js?v=293',
    'workout-cardio-pure.js?v=293',
    'workout-cardio.js?v=293',
    'workout-engine.js?v=293',
    'workout-state.js?v=293',
    'app-update.js?v=293',
    'credential-fields.js?v=293',
    'sheet-drag.js?v=293',
    'mi-scale-pure.js?v=293',
    'mi-scale-web-bluetooth.js?v=293',
    'm3e-ripple.js?v=293',
    'toast.js?v=293',
    'error-bus.js?v=293',
    'i18n.js?v=293',
    'a11y-focus-trap.js?v=293',
    'i18n/zh-CN.json?v=293',
    'i18n/en-US.json?v=293',
    'weekly-summary.js?v=293',
    'pr-tracker.js?v=293',
    'volume-heatmap.js?v=293',
    'swipe-actions.js?v=293',
    'health-profile.js?v=293',
    'report-metrics-pure.js?v=293',
    'report-panel.js?v=293',
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
