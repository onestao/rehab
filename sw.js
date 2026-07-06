// @ts-nocheck
const CACHE = 'training-assistant-v309';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=309',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=309',
    'workout-readiness.js?v=309',
    // Lazy CSS: loaded on profile or records/training entry, still precached for offline use.
    'css-src/42-health-profile.css?v=309',
    'theme.js?v=309',
    'haptics.js?v=309',
    'fooddb.js?v=309',
    'ai-store.js?v=309',
    'ai-vision-pure.mjs?v=309',
    'ai-profile.js?v=309',
    'ai-model-cache.js?v=309',
    'ai-models.js?v=309',
    'ai-api.js?v=309',
    'ai-pricing.js?v=309',
    'ai-templates.js?v=309',
    'render-safe.js?v=309',
    'nav-stack.js?v=309',
    'app-route.js?v=309',
    'data-utils-pure.js?v=309',
    'action-identity.js?v=309',
    'data-utils.js?v=309',
    'data-records.js?v=309',
    'data-schema.js?v=309',
    'storage/idb.js?v=309',
    'storage/idb-collections.js?v=309',
    'storage/idb-advice-collections.js?v=309',
    'storage/migrate.js?v=309',
    'advice-virtual-list.js?v=309',
    'data-store.js?v=309',
    'data-ui-state.js?v=309',
    'health-diet.js?v=309',
    'health-weight.js?v=309',
    'health-exercise.js?v=309',
    'goal-plan.js?v=309',
    'routine-plan.js?v=309',
    'routine-library.js?v=309',
    'data-views.js?v=309',
    'data.js?v=309',
    'voice-engine.js?v=309',
    'voice-cache.js?v=309',
    'voice-webspeech-adapter.js?v=309',
    'voice-legado-adapter.js?v=309',
    'workout-voice.js?v=309',
    'strength-form.js?v=309',
    'weekly-plan.js?v=309',
    'action-history.js?v=309',
    'plan-chains.js?v=309',
    'plan-progression.js?v=309',
    'rehab-policy.js?v=309',
    'plan-store.js?v=309',
    'plan-feedback.js?v=309',
    'plan-cooldown.js?v=309',
    'plan-auto-adjust.js?v=309',
    'plan-weekly.js?v=309',
    'plan-equipment.js?v=309',
    'plan-ai-pure.js?v=309',
    'plan-ai.js?v=309',
    'plan-ui.js?v=309',
    'rehab-progression-pure.js?v=309',
    'plan-store-pure.js?v=309',
    'food-log.js?v=309',
    'lib/virtual-core.umd.js?v=309',
    'lib/flexsearch.light.js?v=309',
    'lib/flexsearch.light.js',
    'advice-search.worker.js',
    'advice-search.worker.js?v=309',
    'advice-panel.js?v=309',
    'coach-context.js?v=309',
    'advice-rules.js?v=309',
    'plan-analytics.js?v=309',
    'advice-template-manager.js?v=309',
    'advice-render.js?v=309',
    'advice-attachments.js?v=309',
    'advice-prompt.js?v=309',
    'advice-stream-renderer.js?v=309',
    'backup-import-pure.js?v=309',
    'backup-ring-pure.js?v=309',
    'backup.js?v=309',
    'sync-ui.js?v=309',
    'sync-adapters.js?v=309',
    'sync.js?v=309',
    'sync-pure.js?v=309',
    'sync-status.js?v=309',
    'workout-system.js?v=309',
    'workout-wakelock.js?v=309',
    'workout-media-session.js?v=309',
    'workout-pip.js?v=309',
    'workout-core.js?v=309',
    'workout-cardio-pure.js?v=309',
    'workout-cardio.js?v=309',
    'workout-engine.js?v=309',
    'workout-state.js?v=309',
    'app-update.js?v=309',
    'credential-fields.js?v=309',
    'sheet-drag.js?v=309',
    'mi-scale-pure.js?v=309',
    'mi-scale-web-bluetooth.js?v=309',
    'm3e-ripple.js?v=309',
    'toast.js?v=309',
    'error-bus.js?v=309',
    'i18n.js?v=309',
    'a11y-focus-trap.js?v=309',
    'i18n/zh-CN.json?v=309',
    'i18n/en-US.json?v=309',
    'weekly-summary.js?v=309',
    'pr-tracker.js?v=309',
    'volume-heatmap.js?v=309',
    'swipe-actions.js?v=309',
    'health-profile.js?v=309',
    'report-metrics-pure.js?v=309',
    'report-panel.js?v=309',
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
