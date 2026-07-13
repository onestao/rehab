// @ts-nocheck
const CACHE = 'training-assistant-v316';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=316',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=316',
    'workout-readiness.js?v=316',
    // Lazy CSS: loaded on profile or records/training entry, still precached for offline use.
    'css-src/42-health-profile.css?v=316',
    'theme.js?v=316',
    'haptics.js?v=316',
    'fooddb.js?v=316',
    'ai-store.js?v=316',
    'ai-model-catalog-pure.mjs?v=316',
    'ai-vision-pure.mjs?v=316',
    'ai-profile.js?v=316',
    'ai-model-cache.js?v=316',
    'ai-models.js?v=316',
    'ai-routing-pure.mjs?v=316',
    'ai-routing.js?v=316',
    'ai-api.js?v=316',
    'ai-model-visual.js?v=316',
    'ai-task-settings.js?v=316',
    'ai-pricing.js?v=316',
    'ai-templates.js?v=316',
    'render-safe.js?v=316',
    'nav-stack.js?v=316',
    'app-route.js?v=316',
    'data-utils-pure.js?v=316',
    'action-identity.js?v=316',
    'data-utils.js?v=316',
    'data-records.js?v=316',
    'data-schema.js?v=316',
    'storage/idb.js?v=316',
    'storage/idb-collections.js?v=316',
    'storage/idb-advice-collections.js?v=316',
    'storage/migrate.js?v=316',
    'advice-virtual-list.js?v=316',
    'data-store.js?v=316',
    'data-ui-state.js?v=316',
    'health-diet.js?v=316',
    'health-weight.js?v=316',
    'health-exercise.js?v=316',
    'goal-plan.js?v=316',
    'routine-plan.js?v=316',
    'routine-library.js?v=316',
    'data-views.js?v=316',
    'data.js?v=316',
    'voice-engine.js?v=316',
    'voice-cache.js?v=316',
    'voice-webspeech-adapter.js?v=316',
    'voice-legado-adapter.js?v=316',
    'workout-voice.js?v=316',
    'strength-form.js?v=316',
    'weekly-plan.js?v=316',
    'action-history.js?v=316',
    'plan-chains.js?v=316',
    'plan-progression.js?v=316',
    'rehab-policy.js?v=316',
    'plan-store.js?v=316',
    'plan-feedback.js?v=316',
    'plan-cooldown.js?v=316',
    'plan-auto-adjust.js?v=316',
    'plan-weekly.js?v=316',
    'plan-equipment.js?v=316',
    'plan-ai-pure.js?v=316',
    'plan-ai.js?v=316',
    'plan-ui.js?v=316',
    'rehab-progression-pure.js?v=316',
    'plan-store-pure.js?v=316',
    'food-log.js?v=316',
    'lib/virtual-core.umd.js?v=316',
    'lib/flexsearch.light.js?v=316',
    'lib/flexsearch.light.js',
    'advice-search.worker.js',
    'advice-search.worker.js?v=316',
    'advice-panel.js?v=316',
    'coach-context.js?v=316',
    'advice-rules.js?v=316',
    'plan-analytics.js?v=316',
    'advice-template-manager.js?v=316',
    'advice-render.js?v=316',
    'advice-attachments.js?v=316',
    'advice-prompt.js?v=316',
    'advice-stream-renderer.js?v=316',
    'backup-import-pure.js?v=316',
    'backup-ring-pure.js?v=316',
    'backup.js?v=316',
    'sync-ui.js?v=316',
    'sync-adapters.js?v=316',
    'sync.js?v=316',
    'sync-pure.js?v=316',
    'sync-status.js?v=316',
    'workout-system.js?v=316',
    'workout-wakelock.js?v=316',
    'workout-media-session.js?v=316',
    'workout-pip.js?v=316',
    'workout-core.js?v=316',
    'workout-cardio-pure.js?v=316',
    'workout-cardio.js?v=316',
    'workout-engine.js?v=316',
    'workout-state.js?v=316',
    'app-update.js?v=316',
    'credential-fields.js?v=316',
    'sheet-drag.js?v=316',
    'mi-scale-pure.js?v=316',
    'mi-scale-web-bluetooth.js?v=316',
    'm3e-ripple.js?v=316',
    'toast.js?v=316',
    'error-bus.js?v=316',
    'i18n.js?v=316',
    'a11y-focus-trap.js?v=316',
    'i18n/zh-CN.json?v=316',
    'i18n/en-US.json?v=316',
    'weekly-summary.js?v=316',
    'pr-tracker.js?v=316',
    'volume-heatmap.js?v=316',
    'swipe-actions.js?v=316',
    'health-profile.js?v=316',
    'report-metrics-pure.js?v=316',
    'report-version-pure.js?v=316',
    'report-panel.js?v=316',
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
