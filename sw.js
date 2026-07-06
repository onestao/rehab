// @ts-nocheck
const CACHE = 'training-assistant-v308';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=308',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=308',
    'workout-readiness.js?v=308',
    // Lazy CSS: loaded on profile or records/training entry, still precached for offline use.
    'css-src/42-health-profile.css?v=308',
    'theme.js?v=308',
    'haptics.js?v=308',
    'fooddb.js?v=308',
    'ai-store.js?v=308',
    'ai-vision-pure.mjs?v=308',
    'ai-profile.js?v=308',
    'ai-model-cache.js?v=308',
    'ai-models.js?v=308',
    'ai-api.js?v=308',
    'ai-pricing.js?v=308',
    'ai-templates.js?v=308',
    'render-safe.js?v=308',
    'nav-stack.js?v=308',
    'app-route.js?v=308',
    'data-utils-pure.js?v=308',
    'action-identity.js?v=308',
    'data-utils.js?v=308',
    'data-records.js?v=308',
    'data-schema.js?v=308',
    'storage/idb.js?v=308',
    'storage/idb-collections.js?v=308',
    'storage/idb-advice-collections.js?v=308',
    'storage/migrate.js?v=308',
    'advice-virtual-list.js?v=308',
    'data-store.js?v=308',
    'data-ui-state.js?v=308',
    'health-diet.js?v=308',
    'health-weight.js?v=308',
    'health-exercise.js?v=308',
    'goal-plan.js?v=308',
    'routine-plan.js?v=308',
    'routine-library.js?v=308',
    'data-views.js?v=308',
    'data.js?v=308',
    'voice-engine.js?v=308',
    'voice-cache.js?v=308',
    'voice-webspeech-adapter.js?v=308',
    'voice-legado-adapter.js?v=308',
    'workout-voice.js?v=308',
    'strength-form.js?v=308',
    'weekly-plan.js?v=308',
    'action-history.js?v=308',
    'plan-chains.js?v=308',
    'plan-progression.js?v=308',
    'rehab-policy.js?v=308',
    'plan-store.js?v=308',
    'plan-feedback.js?v=308',
    'plan-cooldown.js?v=308',
    'plan-auto-adjust.js?v=308',
    'plan-weekly.js?v=308',
    'plan-equipment.js?v=308',
    'plan-ai-pure.js?v=308',
    'plan-ai.js?v=308',
    'plan-ui.js?v=308',
    'rehab-progression-pure.js?v=308',
    'plan-store-pure.js?v=308',
    'food-log.js?v=308',
    'lib/virtual-core.umd.js?v=308',
    'lib/flexsearch.light.js?v=308',
    'lib/flexsearch.light.js',
    'advice-search.worker.js',
    'advice-search.worker.js?v=308',
    'advice-panel.js?v=308',
    'coach-context.js?v=308',
    'advice-rules.js?v=308',
    'plan-analytics.js?v=308',
    'advice-template-manager.js?v=308',
    'advice-render.js?v=308',
    'advice-attachments.js?v=308',
    'advice-prompt.js?v=308',
    'advice-stream-renderer.js?v=308',
    'backup-import-pure.js?v=308',
    'backup-ring-pure.js?v=308',
    'backup.js?v=308',
    'sync-ui.js?v=308',
    'sync-adapters.js?v=308',
    'sync.js?v=308',
    'sync-pure.js?v=308',
    'sync-status.js?v=308',
    'workout-system.js?v=308',
    'workout-wakelock.js?v=308',
    'workout-media-session.js?v=308',
    'workout-pip.js?v=308',
    'workout-core.js?v=308',
    'workout-cardio-pure.js?v=308',
    'workout-cardio.js?v=308',
    'workout-engine.js?v=308',
    'workout-state.js?v=308',
    'app-update.js?v=308',
    'credential-fields.js?v=308',
    'sheet-drag.js?v=308',
    'mi-scale-pure.js?v=308',
    'mi-scale-web-bluetooth.js?v=308',
    'm3e-ripple.js?v=308',
    'toast.js?v=308',
    'error-bus.js?v=308',
    'i18n.js?v=308',
    'a11y-focus-trap.js?v=308',
    'i18n/zh-CN.json?v=308',
    'i18n/en-US.json?v=308',
    'weekly-summary.js?v=308',
    'pr-tracker.js?v=308',
    'volume-heatmap.js?v=308',
    'swipe-actions.js?v=308',
    'health-profile.js?v=308',
    'report-metrics-pure.js?v=308',
    'report-panel.js?v=308',
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
