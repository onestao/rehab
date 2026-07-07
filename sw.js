// @ts-nocheck
const CACHE = 'training-assistant-v310';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=310',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=310',
    'workout-readiness.js?v=310',
    // Lazy CSS: loaded on profile or records/training entry, still precached for offline use.
    'css-src/42-health-profile.css?v=310',
    'theme.js?v=310',
    'haptics.js?v=310',
    'fooddb.js?v=310',
    'ai-store.js?v=310',
    'ai-vision-pure.mjs?v=310',
    'ai-profile.js?v=310',
    'ai-model-cache.js?v=310',
    'ai-models.js?v=310',
    'ai-api.js?v=310',
    'ai-pricing.js?v=310',
    'ai-templates.js?v=310',
    'render-safe.js?v=310',
    'nav-stack.js?v=310',
    'app-route.js?v=310',
    'data-utils-pure.js?v=310',
    'action-identity.js?v=310',
    'data-utils.js?v=310',
    'data-records.js?v=310',
    'data-schema.js?v=310',
    'storage/idb.js?v=310',
    'storage/idb-collections.js?v=310',
    'storage/idb-advice-collections.js?v=310',
    'storage/migrate.js?v=310',
    'advice-virtual-list.js?v=310',
    'data-store.js?v=310',
    'data-ui-state.js?v=310',
    'health-diet.js?v=310',
    'health-weight.js?v=310',
    'health-exercise.js?v=310',
    'goal-plan.js?v=310',
    'routine-plan.js?v=310',
    'routine-library.js?v=310',
    'data-views.js?v=310',
    'data.js?v=310',
    'voice-engine.js?v=310',
    'voice-cache.js?v=310',
    'voice-webspeech-adapter.js?v=310',
    'voice-legado-adapter.js?v=310',
    'workout-voice.js?v=310',
    'strength-form.js?v=310',
    'weekly-plan.js?v=310',
    'action-history.js?v=310',
    'plan-chains.js?v=310',
    'plan-progression.js?v=310',
    'rehab-policy.js?v=310',
    'plan-store.js?v=310',
    'plan-feedback.js?v=310',
    'plan-cooldown.js?v=310',
    'plan-auto-adjust.js?v=310',
    'plan-weekly.js?v=310',
    'plan-equipment.js?v=310',
    'plan-ai-pure.js?v=310',
    'plan-ai.js?v=310',
    'plan-ui.js?v=310',
    'rehab-progression-pure.js?v=310',
    'plan-store-pure.js?v=310',
    'food-log.js?v=310',
    'lib/virtual-core.umd.js?v=310',
    'lib/flexsearch.light.js?v=310',
    'lib/flexsearch.light.js',
    'advice-search.worker.js',
    'advice-search.worker.js?v=310',
    'advice-panel.js?v=310',
    'coach-context.js?v=310',
    'advice-rules.js?v=310',
    'plan-analytics.js?v=310',
    'advice-template-manager.js?v=310',
    'advice-render.js?v=310',
    'advice-attachments.js?v=310',
    'advice-prompt.js?v=310',
    'advice-stream-renderer.js?v=310',
    'backup-import-pure.js?v=310',
    'backup-ring-pure.js?v=310',
    'backup.js?v=310',
    'sync-ui.js?v=310',
    'sync-adapters.js?v=310',
    'sync.js?v=310',
    'sync-pure.js?v=310',
    'sync-status.js?v=310',
    'workout-system.js?v=310',
    'workout-wakelock.js?v=310',
    'workout-media-session.js?v=310',
    'workout-pip.js?v=310',
    'workout-core.js?v=310',
    'workout-cardio-pure.js?v=310',
    'workout-cardio.js?v=310',
    'workout-engine.js?v=310',
    'workout-state.js?v=310',
    'app-update.js?v=310',
    'credential-fields.js?v=310',
    'sheet-drag.js?v=310',
    'mi-scale-pure.js?v=310',
    'mi-scale-web-bluetooth.js?v=310',
    'm3e-ripple.js?v=310',
    'toast.js?v=310',
    'error-bus.js?v=310',
    'i18n.js?v=310',
    'a11y-focus-trap.js?v=310',
    'i18n/zh-CN.json?v=310',
    'i18n/en-US.json?v=310',
    'weekly-summary.js?v=310',
    'pr-tracker.js?v=310',
    'volume-heatmap.js?v=310',
    'swipe-actions.js?v=310',
    'health-profile.js?v=310',
    'report-metrics-pure.js?v=310',
    'report-panel.js?v=310',
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
