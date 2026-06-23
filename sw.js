// @ts-nocheck
const CACHE = 'training-assistant-v292';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=292',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=292',
    'workout-readiness.js?v=292',
    'css-src/42-health-profile.css?v=292',
    'theme.js?v=292',
    'haptics.js?v=292',
    'fooddb.js?v=292',
    'ai-store.js?v=292',
    'ai-vision-pure.mjs?v=292',
    'ai-profile.js?v=292',
    'ai-model-cache.js?v=292',
    'ai-models.js?v=292',
    'ai-api.js?v=292',
    'ai-pricing.js?v=292',
    'ai-templates.js?v=292',
    'render-safe.js?v=292',
    'nav-stack.js?v=292',
    'app-route.js?v=292',
    'data-utils-pure.js?v=292',
    'data-utils.js?v=292',
    'data-records.js?v=292',
    'data-schema.js?v=292',
    'storage/idb.js?v=292',
    'storage/idb-collections.js?v=292',
    'storage/idb-advice-collections.js?v=292',
    'storage/migrate.js?v=292',
    'advice-virtual-list.js?v=292',
    'data-store.js?v=292',
    'data-ui-state.js?v=292',
    'health-diet.js?v=292',
    'health-weight.js?v=292',
    'health-exercise.js?v=292',
    'goal-plan.js?v=292',
    'routine-plan.js?v=292',
    'routine-library.js?v=292',
    'data-views.js?v=292',
    'data.js?v=292',
    'voice-engine.js?v=292',
    'voice-cache.js?v=292',
    'voice-webspeech-adapter.js?v=292',
    'voice-legado-adapter.js?v=292',
    'workout-voice.js?v=292',
    'strength-form.js?v=292',
    'weekly-plan.js?v=292',
    'action-history.js?v=292',
    'plan-chains.js?v=292',
    'plan-progression.js?v=292',
    'rehab-policy.js?v=292',
    'plan-store.js?v=292',
    'plan-feedback.js?v=292',
    'plan-cooldown.js?v=292',
    'plan-auto-adjust.js?v=292',
    'plan-weekly.js?v=292',
    'plan-equipment.js?v=292',
    'plan-ai-pure.js?v=292',
    'plan-ai.js?v=292',
    'plan-ui.js?v=292',
    'rehab-progression-pure.js?v=292',
    'plan-store-pure.js?v=292',
    'food-log.js?v=292',
    'lib/virtual-core.umd.js?v=292',
    'lib/flexsearch.light.js?v=292',
    'lib/flexsearch.light.js',
    'advice-search.worker.js',
    'advice-search.worker.js?v=292',
    'advice-panel.js?v=292',
    'coach-context.js?v=292',
    'advice-rules.js?v=292',
    'plan-analytics.js?v=292',
    'advice-template-manager.js?v=292',
    'advice-render.js?v=292',
    'advice-attachments.js?v=292',
    'advice-prompt.js?v=292',
    'advice-stream-renderer.js?v=292',
    'backup.js?v=292',
    'sync-ui.js?v=292',
    'sync-adapters.js?v=292',
    'sync.js?v=292',
    'sync-pure.js?v=292',
    'sync-status.js?v=292',
    'workout-system.js?v=292',
    'workout-wakelock.js?v=292',
    'workout-media-session.js?v=292',
    'workout-pip.js?v=292',
    'workout-core.js?v=292',
    'workout-cardio-pure.js?v=292',
    'workout-cardio.js?v=292',
    'workout-engine.js?v=292',
    'workout-state.js?v=292',
    'app-update.js?v=292',
    'credential-fields.js?v=292',
    'sheet-drag.js?v=292',
    'mi-scale-pure.js?v=292',
    'mi-scale-web-bluetooth.js?v=292',
    'm3e-ripple.js?v=292',
    'toast.js?v=292',
    'error-bus.js?v=292',
    'i18n.js?v=292',
    'a11y-focus-trap.js?v=292',
    'i18n/zh-CN.json?v=292',
    'i18n/en-US.json?v=292',
    'weekly-summary.js?v=292',
    'pr-tracker.js?v=292',
    'volume-heatmap.js?v=292',
    'swipe-actions.js?v=292',
    'health-profile.js?v=292',
    'report-metrics-pure.js?v=292',
    'report-panel.js?v=292',
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
