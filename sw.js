// @ts-nocheck
const CACHE = 'training-assistant-v282';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=282',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=282',
    'workout-readiness.js?v=282',
    'css-src/42-health-profile.css?v=282',
    'theme.js?v=282',
    'haptics.js?v=282',
    'fooddb.js?v=282',
    'ai-store.js?v=282',
    'ai-vision-pure.mjs?v=282',
    'ai-profile.js?v=282',
    'ai-model-cache.js?v=282',
    'ai-models.js?v=282',
    'ai-api.js?v=282',
    'ai-pricing.js?v=282',
    'ai-templates.js?v=282',
    'render-safe.js?v=282',
    'nav-stack.js?v=282',
    'app-route.js?v=282',
    'data-utils-pure.js?v=282',
    'data-utils.js?v=282',
    'data-records.js?v=282',
    'data-schema.js?v=282',
    'storage/idb.js?v=282',
    'storage/idb-collections.js?v=282',
    'storage/idb-advice-collections.js?v=282',
    'storage/migrate.js?v=282',
    'advice-virtual-list.js?v=282',
    'data-store.js?v=282',
    'data-ui-state.js?v=282',
    'health-diet.js?v=282',
    'health-weight.js?v=282',
    'health-exercise.js?v=282',
    'goal-plan.js?v=282',
    'routine-plan.js?v=282',
    'routine-library.js?v=282',
    'data-views.js?v=282',
    'data.js?v=282',
    'voice-engine.js?v=282',
    'voice-cache.js?v=282',
    'voice-webspeech-adapter.js?v=282',
    'voice-legado-adapter.js?v=282',
    'workout-voice.js?v=282',
    'strength-form.js?v=282',
    'weekly-plan.js?v=282',
    'action-history.js?v=282',
    'plan-chains.js?v=282',
    'plan-progression.js?v=282',
    'plan-store.js?v=282',
    'plan-feedback.js?v=282',
    'plan-cooldown.js?v=282',
    'plan-auto-adjust.js?v=282',
    'plan-weekly.js?v=282',
    'plan-equipment.js?v=282',
    'plan-ai-pure.js?v=282',
    'plan-ai.js?v=282',
    'plan-ui.js?v=282',
    'plan-progression-pure.js?v=282',
    'plan-store-pure.js?v=282',
    'food-log.js?v=282',
    'lib/virtual-core.umd.js?v=282',
    'lib/flexsearch.light.js?v=282',
    'lib/flexsearch.light.js',
    'advice-search.worker.js',
    'advice-search.worker.js?v=282',
    'advice-panel.js?v=282',
    'coach-context.js?v=282',
    'advice-rules.js?v=282',
    'plan-analytics.js?v=282',
    'advice-template-manager.js?v=282',
    'advice-render.js?v=282',
    'advice-attachments.js?v=282',
    'advice-prompt.js?v=282',
    'advice-stream-renderer.js?v=282',
    'backup.js?v=282',
    'sync-ui.js?v=282',
    'sync-adapters.js?v=282',
    'sync.js?v=282',
    'sync-pure.js?v=282',
    'sync-status.js?v=282',
    'workout-system.js?v=282',
    'workout-wakelock.js?v=282',
    'workout-media-session.js?v=282',
    'workout-pip.js?v=282',
    'workout-core.js?v=282',
    'workout-cardio-pure.js?v=282',
    'workout-cardio.js?v=282',
    'workout-engine.js?v=282',
    'workout-state.js?v=282',
    'app-update.js?v=282',
    'credential-fields.js?v=282',
    'sheet-drag.js?v=282',
    'mi-scale-pure.js?v=282',
    'mi-scale-web-bluetooth.js?v=282',
    'm3e-ripple.js?v=282',
    'toast.js?v=282',
    'error-bus.js?v=282',
    'i18n.js?v=282',
    'a11y-focus-trap.js?v=282',
    'i18n/zh-CN.json?v=282',
    'i18n/en-US.json?v=282',
    'weekly-summary.js?v=282',
    'pr-tracker.js?v=282',
    'volume-heatmap.js?v=282',
    'swipe-actions.js?v=282',
    'health-profile.js?v=282',
    'report-metrics-pure.js?v=282',
    'report-panel.js?v=282',
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
