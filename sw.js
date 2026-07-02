// @ts-nocheck
const CACHE = 'training-assistant-v302';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=302',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=302',
    'workout-readiness.js?v=302',
    // Lazy CSS: loaded on profile or records/training entry, still precached for offline use.
    'css-src/42-health-profile.css?v=302',
    'theme.js?v=302',
    'haptics.js?v=302',
    'fooddb.js?v=302',
    'ai-store.js?v=302',
    'ai-vision-pure.mjs?v=302',
    'ai-profile.js?v=302',
    'ai-model-cache.js?v=302',
    'ai-models.js?v=302',
    'ai-api.js?v=302',
    'ai-pricing.js?v=302',
    'ai-templates.js?v=302',
    'render-safe.js?v=302',
    'nav-stack.js?v=302',
    'app-route.js?v=302',
    'data-utils-pure.js?v=302',
    'action-identity.js?v=302',
    'data-utils.js?v=302',
    'data-records.js?v=302',
    'data-schema.js?v=302',
    'storage/idb.js?v=302',
    'storage/idb-collections.js?v=302',
    'storage/idb-advice-collections.js?v=302',
    'storage/migrate.js?v=302',
    'advice-virtual-list.js?v=302',
    'data-store.js?v=302',
    'data-ui-state.js?v=302',
    'health-diet.js?v=302',
    'health-weight.js?v=302',
    'health-exercise.js?v=302',
    'goal-plan.js?v=302',
    'routine-plan.js?v=302',
    'routine-library.js?v=302',
    'data-views.js?v=302',
    'data.js?v=302',
    'voice-engine.js?v=302',
    'voice-cache.js?v=302',
    'voice-webspeech-adapter.js?v=302',
    'voice-legado-adapter.js?v=302',
    'workout-voice.js?v=302',
    'strength-form.js?v=302',
    'weekly-plan.js?v=302',
    'action-history.js?v=302',
    'plan-chains.js?v=302',
    'plan-progression.js?v=302',
    'rehab-policy.js?v=302',
    'plan-store.js?v=302',
    'plan-feedback.js?v=302',
    'plan-cooldown.js?v=302',
    'plan-auto-adjust.js?v=302',
    'plan-weekly.js?v=302',
    'plan-equipment.js?v=302',
    'plan-ai-pure.js?v=302',
    'plan-ai.js?v=302',
    'plan-ui.js?v=302',
    'rehab-progression-pure.js?v=302',
    'plan-store-pure.js?v=302',
    'food-log.js?v=302',
    'lib/virtual-core.umd.js?v=302',
    'lib/flexsearch.light.js?v=302',
    'lib/flexsearch.light.js',
    'advice-search.worker.js',
    'advice-search.worker.js?v=302',
    'advice-panel.js?v=302',
    'coach-context.js?v=302',
    'advice-rules.js?v=302',
    'plan-analytics.js?v=302',
    'advice-template-manager.js?v=302',
    'advice-render.js?v=302',
    'advice-attachments.js?v=302',
    'advice-prompt.js?v=302',
    'advice-stream-renderer.js?v=302',
    'backup-import-pure.js?v=302',
    'backup-ring-pure.js?v=302',
    'backup.js?v=302',
    'sync-ui.js?v=302',
    'sync-adapters.js?v=302',
    'sync.js?v=302',
    'sync-pure.js?v=302',
    'sync-status.js?v=302',
    'workout-system.js?v=302',
    'workout-wakelock.js?v=302',
    'workout-media-session.js?v=302',
    'workout-pip.js?v=302',
    'workout-core.js?v=302',
    'workout-cardio-pure.js?v=302',
    'workout-cardio.js?v=302',
    'workout-engine.js?v=302',
    'workout-state.js?v=302',
    'app-update.js?v=302',
    'credential-fields.js?v=302',
    'sheet-drag.js?v=302',
    'mi-scale-pure.js?v=302',
    'mi-scale-web-bluetooth.js?v=302',
    'm3e-ripple.js?v=302',
    'toast.js?v=302',
    'error-bus.js?v=302',
    'i18n.js?v=302',
    'a11y-focus-trap.js?v=302',
    'i18n/zh-CN.json?v=302',
    'i18n/en-US.json?v=302',
    'weekly-summary.js?v=302',
    'pr-tracker.js?v=302',
    'volume-heatmap.js?v=302',
    'swipe-actions.js?v=302',
    'health-profile.js?v=302',
    'report-metrics-pure.js?v=302',
    'report-panel.js?v=302',
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
