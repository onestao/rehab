// @ts-nocheck
const CACHE = 'training-assistant-v285';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=285',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=285',
    'workout-readiness.js?v=285',
    'css-src/42-health-profile.css?v=285',
    'theme.js?v=285',
    'haptics.js?v=285',
    'fooddb.js?v=285',
    'ai-store.js?v=285',
    'ai-vision-pure.mjs?v=285',
    'ai-profile.js?v=285',
    'ai-model-cache.js?v=285',
    'ai-models.js?v=285',
    'ai-api.js?v=285',
    'ai-pricing.js?v=285',
    'ai-templates.js?v=285',
    'render-safe.js?v=285',
    'nav-stack.js?v=285',
    'app-route.js?v=285',
    'data-utils-pure.js?v=285',
    'data-utils.js?v=285',
    'data-records.js?v=285',
    'data-schema.js?v=285',
    'storage/idb.js?v=285',
    'storage/idb-collections.js?v=285',
    'storage/idb-advice-collections.js?v=285',
    'storage/migrate.js?v=285',
    'advice-virtual-list.js?v=285',
    'data-store.js?v=285',
    'data-ui-state.js?v=285',
    'health-diet.js?v=285',
    'health-weight.js?v=285',
    'health-exercise.js?v=285',
    'goal-plan.js?v=285',
    'routine-plan.js?v=285',
    'routine-library.js?v=285',
    'data-views.js?v=285',
    'data.js?v=285',
    'voice-engine.js?v=285',
    'voice-cache.js?v=285',
    'voice-webspeech-adapter.js?v=285',
    'voice-legado-adapter.js?v=285',
    'workout-voice.js?v=285',
    'strength-form.js?v=285',
    'weekly-plan.js?v=285',
    'action-history.js?v=285',
    'plan-chains.js?v=285',
    'plan-progression.js?v=285',
    'plan-store.js?v=285',
    'plan-feedback.js?v=285',
    'plan-cooldown.js?v=285',
    'plan-auto-adjust.js?v=285',
    'plan-weekly.js?v=285',
    'plan-equipment.js?v=285',
    'plan-ai-pure.js?v=285',
    'plan-ai.js?v=285',
    'plan-ui.js?v=285',
    'plan-progression-pure.js?v=285',
    'plan-store-pure.js?v=285',
    'food-log.js?v=285',
    'lib/virtual-core.umd.js?v=285',
    'lib/flexsearch.light.js?v=285',
    'lib/flexsearch.light.js',
    'advice-search.worker.js',
    'advice-search.worker.js?v=285',
    'advice-panel.js?v=285',
    'coach-context.js?v=285',
    'advice-rules.js?v=285',
    'plan-analytics.js?v=285',
    'advice-template-manager.js?v=285',
    'advice-render.js?v=285',
    'advice-attachments.js?v=285',
    'advice-prompt.js?v=285',
    'advice-stream-renderer.js?v=285',
    'backup.js?v=285',
    'sync-ui.js?v=285',
    'sync-adapters.js?v=285',
    'sync.js?v=285',
    'sync-pure.js?v=285',
    'sync-status.js?v=285',
    'workout-system.js?v=285',
    'workout-wakelock.js?v=285',
    'workout-media-session.js?v=285',
    'workout-pip.js?v=285',
    'workout-core.js?v=285',
    'workout-cardio-pure.js?v=285',
    'workout-cardio.js?v=285',
    'workout-engine.js?v=285',
    'workout-state.js?v=285',
    'app-update.js?v=285',
    'credential-fields.js?v=285',
    'sheet-drag.js?v=285',
    'mi-scale-pure.js?v=285',
    'mi-scale-web-bluetooth.js?v=285',
    'm3e-ripple.js?v=285',
    'toast.js?v=285',
    'error-bus.js?v=285',
    'i18n.js?v=285',
    'a11y-focus-trap.js?v=285',
    'i18n/zh-CN.json?v=285',
    'i18n/en-US.json?v=285',
    'weekly-summary.js?v=285',
    'pr-tracker.js?v=285',
    'volume-heatmap.js?v=285',
    'swipe-actions.js?v=285',
    'health-profile.js?v=285',
    'report-metrics-pure.js?v=285',
    'report-panel.js?v=285',
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
