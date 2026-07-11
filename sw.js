// @ts-nocheck
const CACHE = 'training-assistant-v311';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=311',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=311',
    'workout-readiness.js?v=311',
    // Lazy CSS: loaded on profile or records/training entry, still precached for offline use.
    'css-src/42-health-profile.css?v=311',
    'theme.js?v=311',
    'haptics.js?v=311',
    'fooddb.js?v=311',
    'ai-store.js?v=311',
    'ai-model-catalog-pure.mjs?v=311',
    'ai-vision-pure.mjs?v=311',
    'ai-profile.js?v=311',
    'ai-model-cache.js?v=311',
    'ai-models.js?v=311',
    'ai-routing-pure.mjs?v=311',
    'ai-routing.js?v=311',
    'ai-api.js?v=311',
    'ai-task-settings.js?v=311',
    'ai-pricing.js?v=311',
    'ai-templates.js?v=311',
    'render-safe.js?v=311',
    'nav-stack.js?v=311',
    'app-route.js?v=311',
    'data-utils-pure.js?v=311',
    'action-identity.js?v=311',
    'data-utils.js?v=311',
    'data-records.js?v=311',
    'data-schema.js?v=311',
    'storage/idb.js?v=311',
    'storage/idb-collections.js?v=311',
    'storage/idb-advice-collections.js?v=311',
    'storage/migrate.js?v=311',
    'advice-virtual-list.js?v=311',
    'data-store.js?v=311',
    'data-ui-state.js?v=311',
    'health-diet.js?v=311',
    'health-weight.js?v=311',
    'health-exercise.js?v=311',
    'goal-plan.js?v=311',
    'routine-plan.js?v=311',
    'routine-library.js?v=311',
    'data-views.js?v=311',
    'data.js?v=311',
    'voice-engine.js?v=311',
    'voice-cache.js?v=311',
    'voice-webspeech-adapter.js?v=311',
    'voice-legado-adapter.js?v=311',
    'workout-voice.js?v=311',
    'strength-form.js?v=311',
    'weekly-plan.js?v=311',
    'action-history.js?v=311',
    'plan-chains.js?v=311',
    'plan-progression.js?v=311',
    'rehab-policy.js?v=311',
    'plan-store.js?v=311',
    'plan-feedback.js?v=311',
    'plan-cooldown.js?v=311',
    'plan-auto-adjust.js?v=311',
    'plan-weekly.js?v=311',
    'plan-equipment.js?v=311',
    'plan-ai-pure.js?v=311',
    'plan-ai.js?v=311',
    'plan-ui.js?v=311',
    'rehab-progression-pure.js?v=311',
    'plan-store-pure.js?v=311',
    'food-log.js?v=311',
    'lib/virtual-core.umd.js?v=311',
    'lib/flexsearch.light.js?v=311',
    'lib/flexsearch.light.js',
    'advice-search.worker.js',
    'advice-search.worker.js?v=311',
    'advice-panel.js?v=311',
    'coach-context.js?v=311',
    'advice-rules.js?v=311',
    'plan-analytics.js?v=311',
    'advice-template-manager.js?v=311',
    'advice-render.js?v=311',
    'advice-attachments.js?v=311',
    'advice-prompt.js?v=311',
    'advice-stream-renderer.js?v=311',
    'backup-import-pure.js?v=311',
    'backup-ring-pure.js?v=311',
    'backup.js?v=311',
    'sync-ui.js?v=311',
    'sync-adapters.js?v=311',
    'sync.js?v=311',
    'sync-pure.js?v=311',
    'sync-status.js?v=311',
    'workout-system.js?v=311',
    'workout-wakelock.js?v=311',
    'workout-media-session.js?v=311',
    'workout-pip.js?v=311',
    'workout-core.js?v=311',
    'workout-cardio-pure.js?v=311',
    'workout-cardio.js?v=311',
    'workout-engine.js?v=311',
    'workout-state.js?v=311',
    'app-update.js?v=311',
    'credential-fields.js?v=311',
    'sheet-drag.js?v=311',
    'mi-scale-pure.js?v=311',
    'mi-scale-web-bluetooth.js?v=311',
    'm3e-ripple.js?v=311',
    'toast.js?v=311',
    'error-bus.js?v=311',
    'i18n.js?v=311',
    'a11y-focus-trap.js?v=311',
    'i18n/zh-CN.json?v=311',
    'i18n/en-US.json?v=311',
    'weekly-summary.js?v=311',
    'pr-tracker.js?v=311',
    'volume-heatmap.js?v=311',
    'swipe-actions.js?v=311',
    'health-profile.js?v=311',
    'report-metrics-pure.js?v=311',
    'report-panel.js?v=311',
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
