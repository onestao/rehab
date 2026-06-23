// @ts-nocheck
const CACHE = 'training-assistant-v288';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=288',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=288',
    'workout-readiness.js?v=288',
    'css-src/42-health-profile.css?v=288',
    'theme.js?v=288',
    'haptics.js?v=288',
    'fooddb.js?v=288',
    'ai-store.js?v=288',
    'ai-vision-pure.mjs?v=288',
    'ai-profile.js?v=288',
    'ai-model-cache.js?v=288',
    'ai-models.js?v=288',
    'ai-api.js?v=288',
    'ai-pricing.js?v=288',
    'ai-templates.js?v=288',
    'render-safe.js?v=288',
    'nav-stack.js?v=288',
    'app-route.js?v=288',
    'data-utils-pure.js?v=288',
    'data-utils.js?v=288',
    'data-records.js?v=288',
    'data-schema.js?v=288',
    'storage/idb.js?v=288',
    'storage/idb-collections.js?v=288',
    'storage/idb-advice-collections.js?v=288',
    'storage/migrate.js?v=288',
    'advice-virtual-list.js?v=288',
    'data-store.js?v=288',
    'data-ui-state.js?v=288',
    'health-diet.js?v=288',
    'health-weight.js?v=288',
    'health-exercise.js?v=288',
    'goal-plan.js?v=288',
    'routine-plan.js?v=288',
    'routine-library.js?v=288',
    'data-views.js?v=288',
    'data.js?v=288',
    'voice-engine.js?v=288',
    'voice-cache.js?v=288',
    'voice-webspeech-adapter.js?v=288',
    'voice-legado-adapter.js?v=288',
    'workout-voice.js?v=288',
    'strength-form.js?v=288',
    'weekly-plan.js?v=288',
    'action-history.js?v=288',
    'plan-chains.js?v=288',
    'plan-progression.js?v=288',
    'rehab-policy.js?v=288',
    'plan-store.js?v=288',
    'plan-feedback.js?v=288',
    'plan-cooldown.js?v=288',
    'plan-auto-adjust.js?v=288',
    'plan-weekly.js?v=288',
    'plan-equipment.js?v=288',
    'plan-ai-pure.js?v=288',
    'plan-ai.js?v=288',
    'plan-ui.js?v=288',
    'rehab-progression-pure.js?v=288',
    'plan-store-pure.js?v=288',
    'food-log.js?v=288',
    'lib/virtual-core.umd.js?v=288',
    'lib/flexsearch.light.js?v=288',
    'lib/flexsearch.light.js',
    'advice-search.worker.js',
    'advice-search.worker.js?v=288',
    'advice-panel.js?v=288',
    'coach-context.js?v=288',
    'advice-rules.js?v=288',
    'plan-analytics.js?v=288',
    'advice-template-manager.js?v=288',
    'advice-render.js?v=288',
    'advice-attachments.js?v=288',
    'advice-prompt.js?v=288',
    'advice-stream-renderer.js?v=288',
    'backup.js?v=288',
    'sync-ui.js?v=288',
    'sync-adapters.js?v=288',
    'sync.js?v=288',
    'sync-pure.js?v=288',
    'sync-status.js?v=288',
    'workout-system.js?v=288',
    'workout-wakelock.js?v=288',
    'workout-media-session.js?v=288',
    'workout-pip.js?v=288',
    'workout-core.js?v=288',
    'workout-cardio-pure.js?v=288',
    'workout-cardio.js?v=288',
    'workout-engine.js?v=288',
    'workout-state.js?v=288',
    'app-update.js?v=288',
    'credential-fields.js?v=288',
    'sheet-drag.js?v=288',
    'mi-scale-pure.js?v=288',
    'mi-scale-web-bluetooth.js?v=288',
    'm3e-ripple.js?v=288',
    'toast.js?v=288',
    'error-bus.js?v=288',
    'i18n.js?v=288',
    'a11y-focus-trap.js?v=288',
    'i18n/zh-CN.json?v=288',
    'i18n/en-US.json?v=288',
    'weekly-summary.js?v=288',
    'pr-tracker.js?v=288',
    'volume-heatmap.js?v=288',
    'swipe-actions.js?v=288',
    'health-profile.js?v=288',
    'report-metrics-pure.js?v=288',
    'report-panel.js?v=288',
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
