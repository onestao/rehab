// @ts-nocheck
const CACHE = 'training-assistant-v304';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=304',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=304',
    'workout-readiness.js?v=304',
    // Lazy CSS: loaded on profile or records/training entry, still precached for offline use.
    'css-src/42-health-profile.css?v=304',
    'theme.js?v=304',
    'haptics.js?v=304',
    'fooddb.js?v=304',
    'ai-store.js?v=304',
    'ai-vision-pure.mjs?v=304',
    'ai-profile.js?v=304',
    'ai-model-cache.js?v=304',
    'ai-models.js?v=304',
    'ai-api.js?v=304',
    'ai-pricing.js?v=304',
    'ai-templates.js?v=304',
    'render-safe.js?v=304',
    'nav-stack.js?v=304',
    'app-route.js?v=304',
    'data-utils-pure.js?v=304',
    'action-identity.js?v=304',
    'data-utils.js?v=304',
    'data-records.js?v=304',
    'data-schema.js?v=304',
    'storage/idb.js?v=304',
    'storage/idb-collections.js?v=304',
    'storage/idb-advice-collections.js?v=304',
    'storage/migrate.js?v=304',
    'advice-virtual-list.js?v=304',
    'data-store.js?v=304',
    'data-ui-state.js?v=304',
    'health-diet.js?v=304',
    'health-weight.js?v=304',
    'health-exercise.js?v=304',
    'goal-plan.js?v=304',
    'routine-plan.js?v=304',
    'routine-library.js?v=304',
    'data-views.js?v=304',
    'data.js?v=304',
    'voice-engine.js?v=304',
    'voice-cache.js?v=304',
    'voice-webspeech-adapter.js?v=304',
    'voice-legado-adapter.js?v=304',
    'workout-voice.js?v=304',
    'strength-form.js?v=304',
    'weekly-plan.js?v=304',
    'action-history.js?v=304',
    'plan-chains.js?v=304',
    'plan-progression.js?v=304',
    'rehab-policy.js?v=304',
    'plan-store.js?v=304',
    'plan-feedback.js?v=304',
    'plan-cooldown.js?v=304',
    'plan-auto-adjust.js?v=304',
    'plan-weekly.js?v=304',
    'plan-equipment.js?v=304',
    'plan-ai-pure.js?v=304',
    'plan-ai.js?v=304',
    'plan-ui.js?v=304',
    'rehab-progression-pure.js?v=304',
    'plan-store-pure.js?v=304',
    'food-log.js?v=304',
    'lib/virtual-core.umd.js?v=304',
    'lib/flexsearch.light.js?v=304',
    'lib/flexsearch.light.js',
    'advice-search.worker.js',
    'advice-search.worker.js?v=304',
    'advice-panel.js?v=304',
    'coach-context.js?v=304',
    'advice-rules.js?v=304',
    'plan-analytics.js?v=304',
    'advice-template-manager.js?v=304',
    'advice-render.js?v=304',
    'advice-attachments.js?v=304',
    'advice-prompt.js?v=304',
    'advice-stream-renderer.js?v=304',
    'backup-import-pure.js?v=304',
    'backup-ring-pure.js?v=304',
    'backup.js?v=304',
    'sync-ui.js?v=304',
    'sync-adapters.js?v=304',
    'sync.js?v=304',
    'sync-pure.js?v=304',
    'sync-status.js?v=304',
    'workout-system.js?v=304',
    'workout-wakelock.js?v=304',
    'workout-media-session.js?v=304',
    'workout-pip.js?v=304',
    'workout-core.js?v=304',
    'workout-cardio-pure.js?v=304',
    'workout-cardio.js?v=304',
    'workout-engine.js?v=304',
    'workout-state.js?v=304',
    'app-update.js?v=304',
    'credential-fields.js?v=304',
    'sheet-drag.js?v=304',
    'mi-scale-pure.js?v=304',
    'mi-scale-web-bluetooth.js?v=304',
    'm3e-ripple.js?v=304',
    'toast.js?v=304',
    'error-bus.js?v=304',
    'i18n.js?v=304',
    'a11y-focus-trap.js?v=304',
    'i18n/zh-CN.json?v=304',
    'i18n/en-US.json?v=304',
    'weekly-summary.js?v=304',
    'pr-tracker.js?v=304',
    'volume-heatmap.js?v=304',
    'swipe-actions.js?v=304',
    'health-profile.js?v=304',
    'report-metrics-pure.js?v=304',
    'report-panel.js?v=304',
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
