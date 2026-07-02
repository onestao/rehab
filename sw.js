// @ts-nocheck
const CACHE = 'training-assistant-v301';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=301',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=301',
    'workout-readiness.js?v=301',
    // Lazy CSS: loaded on profile or records/training entry, still precached for offline use.
    'css-src/42-health-profile.css?v=301',
    'theme.js?v=301',
    'haptics.js?v=301',
    'fooddb.js?v=301',
    'ai-store.js?v=301',
    'ai-vision-pure.mjs?v=301',
    'ai-profile.js?v=301',
    'ai-model-cache.js?v=301',
    'ai-models.js?v=301',
    'ai-api.js?v=301',
    'ai-pricing.js?v=301',
    'ai-templates.js?v=301',
    'render-safe.js?v=301',
    'nav-stack.js?v=301',
    'app-route.js?v=301',
    'data-utils-pure.js?v=301',
    'action-identity.js?v=301',
    'data-utils.js?v=301',
    'data-records.js?v=301',
    'data-schema.js?v=301',
    'storage/idb.js?v=301',
    'storage/idb-collections.js?v=301',
    'storage/idb-advice-collections.js?v=301',
    'storage/migrate.js?v=301',
    'advice-virtual-list.js?v=301',
    'data-store.js?v=301',
    'data-ui-state.js?v=301',
    'health-diet.js?v=301',
    'health-weight.js?v=301',
    'health-exercise.js?v=301',
    'goal-plan.js?v=301',
    'routine-plan.js?v=301',
    'routine-library.js?v=301',
    'data-views.js?v=301',
    'data.js?v=301',
    'voice-engine.js?v=301',
    'voice-cache.js?v=301',
    'voice-webspeech-adapter.js?v=301',
    'voice-legado-adapter.js?v=301',
    'workout-voice.js?v=301',
    'strength-form.js?v=301',
    'weekly-plan.js?v=301',
    'action-history.js?v=301',
    'plan-chains.js?v=301',
    'plan-progression.js?v=301',
    'rehab-policy.js?v=301',
    'plan-store.js?v=301',
    'plan-feedback.js?v=301',
    'plan-cooldown.js?v=301',
    'plan-auto-adjust.js?v=301',
    'plan-weekly.js?v=301',
    'plan-equipment.js?v=301',
    'plan-ai-pure.js?v=301',
    'plan-ai.js?v=301',
    'plan-ui.js?v=301',
    'rehab-progression-pure.js?v=301',
    'plan-store-pure.js?v=301',
    'food-log.js?v=301',
    'lib/virtual-core.umd.js?v=301',
    'lib/flexsearch.light.js?v=301',
    'lib/flexsearch.light.js',
    'advice-search.worker.js',
    'advice-search.worker.js?v=301',
    'advice-panel.js?v=301',
    'coach-context.js?v=301',
    'advice-rules.js?v=301',
    'plan-analytics.js?v=301',
    'advice-template-manager.js?v=301',
    'advice-render.js?v=301',
    'advice-attachments.js?v=301',
    'advice-prompt.js?v=301',
    'advice-stream-renderer.js?v=301',
    'backup-import-pure.js?v=301',
    'backup-ring-pure.js?v=301',
    'backup.js?v=301',
    'sync-ui.js?v=301',
    'sync-adapters.js?v=301',
    'sync.js?v=301',
    'sync-pure.js?v=301',
    'sync-status.js?v=301',
    'workout-system.js?v=301',
    'workout-wakelock.js?v=301',
    'workout-media-session.js?v=301',
    'workout-pip.js?v=301',
    'workout-core.js?v=301',
    'workout-cardio-pure.js?v=301',
    'workout-cardio.js?v=301',
    'workout-engine.js?v=301',
    'workout-state.js?v=301',
    'app-update.js?v=301',
    'credential-fields.js?v=301',
    'sheet-drag.js?v=301',
    'mi-scale-pure.js?v=301',
    'mi-scale-web-bluetooth.js?v=301',
    'm3e-ripple.js?v=301',
    'toast.js?v=301',
    'error-bus.js?v=301',
    'i18n.js?v=301',
    'a11y-focus-trap.js?v=301',
    'i18n/zh-CN.json?v=301',
    'i18n/en-US.json?v=301',
    'weekly-summary.js?v=301',
    'pr-tracker.js?v=301',
    'volume-heatmap.js?v=301',
    'swipe-actions.js?v=301',
    'health-profile.js?v=301',
    'report-metrics-pure.js?v=301',
    'report-panel.js?v=301',
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
