// @ts-nocheck
const CACHE = 'training-assistant-v296';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=296',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=296',
    'workout-readiness.js?v=296',
    'css-src/42-health-profile.css?v=296',
    'theme.js?v=296',
    'haptics.js?v=296',
    'fooddb.js?v=296',
    'ai-store.js?v=296',
    'ai-vision-pure.mjs?v=296',
    'ai-profile.js?v=296',
    'ai-model-cache.js?v=296',
    'ai-models.js?v=296',
    'ai-api.js?v=296',
    'ai-pricing.js?v=296',
    'ai-templates.js?v=296',
    'render-safe.js?v=296',
    'nav-stack.js?v=296',
    'app-route.js?v=296',
    'data-utils-pure.js?v=296',
    'data-utils.js?v=296',
    'data-records.js?v=296',
    'data-schema.js?v=296',
    'storage/idb.js?v=296',
    'storage/idb-collections.js?v=296',
    'storage/idb-advice-collections.js?v=296',
    'storage/migrate.js?v=296',
    'advice-virtual-list.js?v=296',
    'data-store.js?v=296',
    'data-ui-state.js?v=296',
    'health-diet.js?v=296',
    'health-weight.js?v=296',
    'health-exercise.js?v=296',
    'goal-plan.js?v=296',
    'routine-plan.js?v=296',
    'routine-library.js?v=296',
    'data-views.js?v=296',
    'data.js?v=296',
    'voice-engine.js?v=296',
    'voice-cache.js?v=296',
    'voice-webspeech-adapter.js?v=296',
    'voice-legado-adapter.js?v=296',
    'workout-voice.js?v=296',
    'strength-form.js?v=296',
    'weekly-plan.js?v=296',
    'action-history.js?v=296',
    'plan-chains.js?v=296',
    'plan-progression.js?v=296',
    'rehab-policy.js?v=296',
    'plan-store.js?v=296',
    'plan-feedback.js?v=296',
    'plan-cooldown.js?v=296',
    'plan-auto-adjust.js?v=296',
    'plan-weekly.js?v=296',
    'plan-equipment.js?v=296',
    'plan-ai-pure.js?v=296',
    'plan-ai.js?v=296',
    'plan-ui.js?v=296',
    'rehab-progression-pure.js?v=296',
    'plan-store-pure.js?v=296',
    'food-log.js?v=296',
    'lib/virtual-core.umd.js?v=296',
    'lib/flexsearch.light.js?v=296',
    'lib/flexsearch.light.js',
    'advice-search.worker.js',
    'advice-search.worker.js?v=296',
    'advice-panel.js?v=296',
    'coach-context.js?v=296',
    'advice-rules.js?v=296',
    'plan-analytics.js?v=296',
    'advice-template-manager.js?v=296',
    'advice-render.js?v=296',
    'advice-attachments.js?v=296',
    'advice-prompt.js?v=296',
    'advice-stream-renderer.js?v=296',
    'backup.js?v=296',
    'sync-ui.js?v=296',
    'sync-adapters.js?v=296',
    'sync.js?v=296',
    'sync-pure.js?v=296',
    'sync-status.js?v=296',
    'workout-system.js?v=296',
    'workout-wakelock.js?v=296',
    'workout-media-session.js?v=296',
    'workout-pip.js?v=296',
    'workout-core.js?v=296',
    'workout-cardio-pure.js?v=296',
    'workout-cardio.js?v=296',
    'workout-engine.js?v=296',
    'workout-state.js?v=296',
    'app-update.js?v=296',
    'credential-fields.js?v=296',
    'sheet-drag.js?v=296',
    'mi-scale-pure.js?v=296',
    'mi-scale-web-bluetooth.js?v=296',
    'm3e-ripple.js?v=296',
    'toast.js?v=296',
    'error-bus.js?v=296',
    'i18n.js?v=296',
    'a11y-focus-trap.js?v=296',
    'i18n/zh-CN.json?v=296',
    'i18n/en-US.json?v=296',
    'weekly-summary.js?v=296',
    'pr-tracker.js?v=296',
    'volume-heatmap.js?v=296',
    'swipe-actions.js?v=296',
    'health-profile.js?v=296',
    'report-metrics-pure.js?v=296',
    'report-panel.js?v=296',
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
