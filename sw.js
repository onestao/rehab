// @ts-nocheck
const CACHE = 'training-assistant-v286';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=286',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=286',
    'workout-readiness.js?v=286',
    'css-src/42-health-profile.css?v=286',
    'theme.js?v=286',
    'haptics.js?v=286',
    'fooddb.js?v=286',
    'ai-store.js?v=286',
    'ai-vision-pure.mjs?v=286',
    'ai-profile.js?v=286',
    'ai-model-cache.js?v=286',
    'ai-models.js?v=286',
    'ai-api.js?v=286',
    'ai-pricing.js?v=286',
    'ai-templates.js?v=286',
    'render-safe.js?v=286',
    'nav-stack.js?v=286',
    'app-route.js?v=286',
    'data-utils-pure.js?v=286',
    'data-utils.js?v=286',
    'data-records.js?v=286',
    'data-schema.js?v=286',
    'storage/idb.js?v=286',
    'storage/idb-collections.js?v=286',
    'storage/idb-advice-collections.js?v=286',
    'storage/migrate.js?v=286',
    'advice-virtual-list.js?v=286',
    'data-store.js?v=286',
    'data-ui-state.js?v=286',
    'health-diet.js?v=286',
    'health-weight.js?v=286',
    'health-exercise.js?v=286',
    'goal-plan.js?v=286',
    'routine-plan.js?v=286',
    'routine-library.js?v=286',
    'data-views.js?v=286',
    'data.js?v=286',
    'voice-engine.js?v=286',
    'voice-cache.js?v=286',
    'voice-webspeech-adapter.js?v=286',
    'voice-legado-adapter.js?v=286',
    'workout-voice.js?v=286',
    'strength-form.js?v=286',
    'weekly-plan.js?v=286',
    'action-history.js?v=286',
    'plan-chains.js?v=286',
    'plan-progression.js?v=286',
    'plan-store.js?v=286',
    'plan-feedback.js?v=286',
    'plan-cooldown.js?v=286',
    'plan-auto-adjust.js?v=286',
    'plan-weekly.js?v=286',
    'plan-equipment.js?v=286',
    'plan-ai-pure.js?v=286',
    'plan-ai.js?v=286',
    'plan-ui.js?v=286',
    'plan-progression-pure.js?v=286',
    'plan-store-pure.js?v=286',
    'food-log.js?v=286',
    'lib/virtual-core.umd.js?v=286',
    'lib/flexsearch.light.js?v=286',
    'lib/flexsearch.light.js',
    'advice-search.worker.js',
    'advice-search.worker.js?v=286',
    'advice-panel.js?v=286',
    'coach-context.js?v=286',
    'advice-rules.js?v=286',
    'plan-analytics.js?v=286',
    'advice-template-manager.js?v=286',
    'advice-render.js?v=286',
    'advice-attachments.js?v=286',
    'advice-prompt.js?v=286',
    'advice-stream-renderer.js?v=286',
    'backup.js?v=286',
    'sync-ui.js?v=286',
    'sync-adapters.js?v=286',
    'sync.js?v=286',
    'sync-pure.js?v=286',
    'sync-status.js?v=286',
    'workout-system.js?v=286',
    'workout-wakelock.js?v=286',
    'workout-media-session.js?v=286',
    'workout-pip.js?v=286',
    'workout-core.js?v=286',
    'workout-cardio-pure.js?v=286',
    'workout-cardio.js?v=286',
    'workout-engine.js?v=286',
    'workout-state.js?v=286',
    'app-update.js?v=286',
    'credential-fields.js?v=286',
    'sheet-drag.js?v=286',
    'mi-scale-pure.js?v=286',
    'mi-scale-web-bluetooth.js?v=286',
    'm3e-ripple.js?v=286',
    'toast.js?v=286',
    'error-bus.js?v=286',
    'i18n.js?v=286',
    'a11y-focus-trap.js?v=286',
    'i18n/zh-CN.json?v=286',
    'i18n/en-US.json?v=286',
    'weekly-summary.js?v=286',
    'pr-tracker.js?v=286',
    'volume-heatmap.js?v=286',
    'swipe-actions.js?v=286',
    'health-profile.js?v=286',
    'report-metrics-pure.js?v=286',
    'report-panel.js?v=286',
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
