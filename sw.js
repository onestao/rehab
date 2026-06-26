// @ts-nocheck
const CACHE = 'training-assistant-v297';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=297',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=297',
    'workout-readiness.js?v=297',
    'css-src/42-health-profile.css?v=297',
    'theme.js?v=297',
    'haptics.js?v=297',
    'fooddb.js?v=297',
    'ai-store.js?v=297',
    'ai-vision-pure.mjs?v=297',
    'ai-profile.js?v=297',
    'ai-model-cache.js?v=297',
    'ai-models.js?v=297',
    'ai-api.js?v=297',
    'ai-pricing.js?v=297',
    'ai-templates.js?v=297',
    'render-safe.js?v=297',
    'nav-stack.js?v=297',
    'app-route.js?v=297',
    'data-utils-pure.js?v=297',
    'action-identity.js?v=297',
    'data-utils.js?v=297',
    'data-records.js?v=297',
    'data-schema.js?v=297',
    'storage/idb.js?v=297',
    'storage/idb-collections.js?v=297',
    'storage/idb-advice-collections.js?v=297',
    'storage/migrate.js?v=297',
    'advice-virtual-list.js?v=297',
    'data-store.js?v=297',
    'data-ui-state.js?v=297',
    'health-diet.js?v=297',
    'health-weight.js?v=297',
    'health-exercise.js?v=297',
    'goal-plan.js?v=297',
    'routine-plan.js?v=297',
    'routine-library.js?v=297',
    'data-views.js?v=297',
    'data.js?v=297',
    'voice-engine.js?v=297',
    'voice-cache.js?v=297',
    'voice-webspeech-adapter.js?v=297',
    'voice-legado-adapter.js?v=297',
    'workout-voice.js?v=297',
    'strength-form.js?v=297',
    'weekly-plan.js?v=297',
    'action-history.js?v=297',
    'plan-chains.js?v=297',
    'plan-progression.js?v=297',
    'rehab-policy.js?v=297',
    'plan-store.js?v=297',
    'plan-feedback.js?v=297',
    'plan-cooldown.js?v=297',
    'plan-auto-adjust.js?v=297',
    'plan-weekly.js?v=297',
    'plan-equipment.js?v=297',
    'plan-ai-pure.js?v=297',
    'plan-ai.js?v=297',
    'plan-ui.js?v=297',
    'rehab-progression-pure.js?v=297',
    'plan-store-pure.js?v=297',
    'food-log.js?v=297',
    'lib/virtual-core.umd.js?v=297',
    'lib/flexsearch.light.js?v=297',
    'lib/flexsearch.light.js',
    'advice-search.worker.js',
    'advice-search.worker.js?v=297',
    'advice-panel.js?v=297',
    'coach-context.js?v=297',
    'advice-rules.js?v=297',
    'plan-analytics.js?v=297',
    'advice-template-manager.js?v=297',
    'advice-render.js?v=297',
    'advice-attachments.js?v=297',
    'advice-prompt.js?v=297',
    'advice-stream-renderer.js?v=297',
    'backup.js?v=297',
    'sync-ui.js?v=297',
    'sync-adapters.js?v=297',
    'sync.js?v=297',
    'sync-pure.js?v=297',
    'sync-status.js?v=297',
    'workout-system.js?v=297',
    'workout-wakelock.js?v=297',
    'workout-media-session.js?v=297',
    'workout-pip.js?v=297',
    'workout-core.js?v=297',
    'workout-cardio-pure.js?v=297',
    'workout-cardio.js?v=297',
    'workout-engine.js?v=297',
    'workout-state.js?v=297',
    'app-update.js?v=297',
    'credential-fields.js?v=297',
    'sheet-drag.js?v=297',
    'mi-scale-pure.js?v=297',
    'mi-scale-web-bluetooth.js?v=297',
    'm3e-ripple.js?v=297',
    'toast.js?v=297',
    'error-bus.js?v=297',
    'i18n.js?v=297',
    'a11y-focus-trap.js?v=297',
    'i18n/zh-CN.json?v=297',
    'i18n/en-US.json?v=297',
    'weekly-summary.js?v=297',
    'pr-tracker.js?v=297',
    'volume-heatmap.js?v=297',
    'swipe-actions.js?v=297',
    'health-profile.js?v=297',
    'report-metrics-pure.js?v=297',
    'report-panel.js?v=297',
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
