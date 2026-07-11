// @ts-nocheck
const CACHE = 'training-assistant-v315';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=315',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=315',
    'workout-readiness.js?v=315',
    // Lazy CSS: loaded on profile or records/training entry, still precached for offline use.
    'css-src/42-health-profile.css?v=315',
    'theme.js?v=315',
    'haptics.js?v=315',
    'fooddb.js?v=315',
    'ai-store.js?v=315',
    'ai-model-catalog-pure.mjs?v=315',
    'ai-vision-pure.mjs?v=315',
    'ai-profile.js?v=315',
    'ai-model-cache.js?v=315',
    'ai-models.js?v=315',
    'ai-routing-pure.mjs?v=315',
    'ai-routing.js?v=315',
    'ai-api.js?v=315',
    'ai-task-settings.js?v=315',
    'ai-pricing.js?v=315',
    'ai-templates.js?v=315',
    'render-safe.js?v=315',
    'nav-stack.js?v=315',
    'app-route.js?v=315',
    'data-utils-pure.js?v=315',
    'action-identity.js?v=315',
    'data-utils.js?v=315',
    'data-records.js?v=315',
    'data-schema.js?v=315',
    'storage/idb.js?v=315',
    'storage/idb-collections.js?v=315',
    'storage/idb-advice-collections.js?v=315',
    'storage/migrate.js?v=315',
    'advice-virtual-list.js?v=315',
    'data-store.js?v=315',
    'data-ui-state.js?v=315',
    'health-diet.js?v=315',
    'health-weight.js?v=315',
    'health-exercise.js?v=315',
    'goal-plan.js?v=315',
    'routine-plan.js?v=315',
    'routine-library.js?v=315',
    'data-views.js?v=315',
    'data.js?v=315',
    'voice-engine.js?v=315',
    'voice-cache.js?v=315',
    'voice-webspeech-adapter.js?v=315',
    'voice-legado-adapter.js?v=315',
    'workout-voice.js?v=315',
    'strength-form.js?v=315',
    'weekly-plan.js?v=315',
    'action-history.js?v=315',
    'plan-chains.js?v=315',
    'plan-progression.js?v=315',
    'rehab-policy.js?v=315',
    'plan-store.js?v=315',
    'plan-feedback.js?v=315',
    'plan-cooldown.js?v=315',
    'plan-auto-adjust.js?v=315',
    'plan-weekly.js?v=315',
    'plan-equipment.js?v=315',
    'plan-ai-pure.js?v=315',
    'plan-ai.js?v=315',
    'plan-ui.js?v=315',
    'rehab-progression-pure.js?v=315',
    'plan-store-pure.js?v=315',
    'food-log.js?v=315',
    'lib/virtual-core.umd.js?v=315',
    'lib/flexsearch.light.js?v=315',
    'lib/flexsearch.light.js',
    'advice-search.worker.js',
    'advice-search.worker.js?v=315',
    'advice-panel.js?v=315',
    'coach-context.js?v=315',
    'advice-rules.js?v=315',
    'plan-analytics.js?v=315',
    'advice-template-manager.js?v=315',
    'advice-render.js?v=315',
    'advice-attachments.js?v=315',
    'advice-prompt.js?v=315',
    'advice-stream-renderer.js?v=315',
    'backup-import-pure.js?v=315',
    'backup-ring-pure.js?v=315',
    'backup.js?v=315',
    'sync-ui.js?v=315',
    'sync-adapters.js?v=315',
    'sync.js?v=315',
    'sync-pure.js?v=315',
    'sync-status.js?v=315',
    'workout-system.js?v=315',
    'workout-wakelock.js?v=315',
    'workout-media-session.js?v=315',
    'workout-pip.js?v=315',
    'workout-core.js?v=315',
    'workout-cardio-pure.js?v=315',
    'workout-cardio.js?v=315',
    'workout-engine.js?v=315',
    'workout-state.js?v=315',
    'app-update.js?v=315',
    'credential-fields.js?v=315',
    'sheet-drag.js?v=315',
    'mi-scale-pure.js?v=315',
    'mi-scale-web-bluetooth.js?v=315',
    'm3e-ripple.js?v=315',
    'toast.js?v=315',
    'error-bus.js?v=315',
    'i18n.js?v=315',
    'a11y-focus-trap.js?v=315',
    'i18n/zh-CN.json?v=315',
    'i18n/en-US.json?v=315',
    'weekly-summary.js?v=315',
    'pr-tracker.js?v=315',
    'volume-heatmap.js?v=315',
    'swipe-actions.js?v=315',
    'health-profile.js?v=315',
    'report-metrics-pure.js?v=315',
    'report-version-pure.js?v=315',
    'report-panel.js?v=315',
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
    'manifest.json',
    'favicon.ico'
];

let voiceTtsHosts = new Set();
const RUNTIME_CACHE_FIRST_ASSETS = new Set([
    'assets/heic2any.min.js'
]);

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

function isRuntimeCacheFirstAsset(url) {
    const pathname = url.pathname.replace(/^\/+/, '');
    if (RUNTIME_CACHE_FIRST_ASSETS.has(pathname)) return true;
    return [...RUNTIME_CACHE_FIRST_ASSETS].some((asset) => pathname.endsWith('/' + asset));
}

async function fetchRuntimeCacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const res = await fetch(request, { credentials: 'same-origin', cache: 'no-store' });
        if (res && res.ok) {
            const clone = res.clone();
            const cache = await caches.open(CACHE);
            await cache.put(request, clone).catch(() => {});
        }
        return res;
    } catch (err) {
        const fallback = await caches.match(request);
        if (fallback) return fallback;
        throw err;
    }
}

async function fetchNavigation(request) {
    try {
        const res = await fetch(request, { cache: 'no-store' });
        if (res && res.ok) {
            const cache = await caches.open(CACHE);
            await cache.put('index.html', res.clone()).catch(() => {});
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

    if (isRuntimeCacheFirstAsset(url)) {
        event.respondWith(fetchRuntimeCacheFirst(event.request));
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
                    await cache.put(cacheKey, clone).catch(() => {});
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
                await cache.put(event.request, clone).catch(() => {});
            }
            return res;
        } catch (err) {
            const cached = await caches.match(event.request);
            if (cached) return cached;
            throw err;
        }
    })());
});
