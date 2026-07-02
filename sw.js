// @ts-nocheck
const CACHE = 'training-assistant-v303';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=303',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=303',
    'workout-readiness.js?v=303',
    // Lazy CSS: loaded on profile or records/training entry, still precached for offline use.
    'css-src/42-health-profile.css?v=303',
    'theme.js?v=303',
    'haptics.js?v=303',
    'fooddb.js?v=303',
    'ai-store.js?v=303',
    'ai-vision-pure.mjs?v=303',
    'ai-profile.js?v=303',
    'ai-model-cache.js?v=303',
    'ai-models.js?v=303',
    'ai-api.js?v=303',
    'ai-pricing.js?v=303',
    'ai-templates.js?v=303',
    'render-safe.js?v=303',
    'nav-stack.js?v=303',
    'app-route.js?v=303',
    'data-utils-pure.js?v=303',
    'action-identity.js?v=303',
    'data-utils.js?v=303',
    'data-records.js?v=303',
    'data-schema.js?v=303',
    'storage/idb.js?v=303',
    'storage/idb-collections.js?v=303',
    'storage/idb-advice-collections.js?v=303',
    'storage/migrate.js?v=303',
    'advice-virtual-list.js?v=303',
    'data-store.js?v=303',
    'data-ui-state.js?v=303',
    'health-diet.js?v=303',
    'health-weight.js?v=303',
    'health-exercise.js?v=303',
    'goal-plan.js?v=303',
    'routine-plan.js?v=303',
    'routine-library.js?v=303',
    'data-views.js?v=303',
    'data.js?v=303',
    'voice-engine.js?v=303',
    'voice-cache.js?v=303',
    'voice-webspeech-adapter.js?v=303',
    'voice-legado-adapter.js?v=303',
    'workout-voice.js?v=303',
    'strength-form.js?v=303',
    'weekly-plan.js?v=303',
    'action-history.js?v=303',
    'plan-chains.js?v=303',
    'plan-progression.js?v=303',
    'rehab-policy.js?v=303',
    'plan-store.js?v=303',
    'plan-feedback.js?v=303',
    'plan-cooldown.js?v=303',
    'plan-auto-adjust.js?v=303',
    'plan-weekly.js?v=303',
    'plan-equipment.js?v=303',
    'plan-ai-pure.js?v=303',
    'plan-ai.js?v=303',
    'plan-ui.js?v=303',
    'rehab-progression-pure.js?v=303',
    'plan-store-pure.js?v=303',
    'food-log.js?v=303',
    'lib/virtual-core.umd.js?v=303',
    'lib/flexsearch.light.js?v=303',
    'lib/flexsearch.light.js',
    'advice-search.worker.js',
    'advice-search.worker.js?v=303',
    'advice-panel.js?v=303',
    'coach-context.js?v=303',
    'advice-rules.js?v=303',
    'plan-analytics.js?v=303',
    'advice-template-manager.js?v=303',
    'advice-render.js?v=303',
    'advice-attachments.js?v=303',
    'advice-prompt.js?v=303',
    'advice-stream-renderer.js?v=303',
    'backup-import-pure.js?v=303',
    'backup-ring-pure.js?v=303',
    'backup.js?v=303',
    'sync-ui.js?v=303',
    'sync-adapters.js?v=303',
    'sync.js?v=303',
    'sync-pure.js?v=303',
    'sync-status.js?v=303',
    'workout-system.js?v=303',
    'workout-wakelock.js?v=303',
    'workout-media-session.js?v=303',
    'workout-pip.js?v=303',
    'workout-core.js?v=303',
    'workout-cardio-pure.js?v=303',
    'workout-cardio.js?v=303',
    'workout-engine.js?v=303',
    'workout-state.js?v=303',
    'app-update.js?v=303',
    'credential-fields.js?v=303',
    'sheet-drag.js?v=303',
    'mi-scale-pure.js?v=303',
    'mi-scale-web-bluetooth.js?v=303',
    'm3e-ripple.js?v=303',
    'toast.js?v=303',
    'error-bus.js?v=303',
    'i18n.js?v=303',
    'a11y-focus-trap.js?v=303',
    'i18n/zh-CN.json?v=303',
    'i18n/en-US.json?v=303',
    'weekly-summary.js?v=303',
    'pr-tracker.js?v=303',
    'volume-heatmap.js?v=303',
    'swipe-actions.js?v=303',
    'health-profile.js?v=303',
    'report-metrics-pure.js?v=303',
    'report-panel.js?v=303',
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
