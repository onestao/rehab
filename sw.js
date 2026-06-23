// @ts-nocheck
const CACHE = 'training-assistant-v294';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=294',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=294',
    'workout-readiness.js?v=294',
    'css-src/42-health-profile.css?v=294',
    'theme.js?v=294',
    'haptics.js?v=294',
    'fooddb.js?v=294',
    'ai-store.js?v=294',
    'ai-vision-pure.mjs?v=294',
    'ai-profile.js?v=294',
    'ai-model-cache.js?v=294',
    'ai-models.js?v=294',
    'ai-api.js?v=294',
    'ai-pricing.js?v=294',
    'ai-templates.js?v=294',
    'render-safe.js?v=294',
    'nav-stack.js?v=294',
    'app-route.js?v=294',
    'data-utils-pure.js?v=294',
    'data-utils.js?v=294',
    'data-records.js?v=294',
    'data-schema.js?v=294',
    'storage/idb.js?v=294',
    'storage/idb-collections.js?v=294',
    'storage/idb-advice-collections.js?v=294',
    'storage/migrate.js?v=294',
    'advice-virtual-list.js?v=294',
    'data-store.js?v=294',
    'data-ui-state.js?v=294',
    'health-diet.js?v=294',
    'health-weight.js?v=294',
    'health-exercise.js?v=294',
    'goal-plan.js?v=294',
    'routine-plan.js?v=294',
    'routine-library.js?v=294',
    'data-views.js?v=294',
    'data.js?v=294',
    'voice-engine.js?v=294',
    'voice-cache.js?v=294',
    'voice-webspeech-adapter.js?v=294',
    'voice-legado-adapter.js?v=294',
    'workout-voice.js?v=294',
    'strength-form.js?v=294',
    'weekly-plan.js?v=294',
    'action-history.js?v=294',
    'plan-chains.js?v=294',
    'plan-progression.js?v=294',
    'rehab-policy.js?v=294',
    'plan-store.js?v=294',
    'plan-feedback.js?v=294',
    'plan-cooldown.js?v=294',
    'plan-auto-adjust.js?v=294',
    'plan-weekly.js?v=294',
    'plan-equipment.js?v=294',
    'plan-ai-pure.js?v=294',
    'plan-ai.js?v=294',
    'plan-ui.js?v=294',
    'rehab-progression-pure.js?v=294',
    'plan-store-pure.js?v=294',
    'food-log.js?v=294',
    'lib/virtual-core.umd.js?v=294',
    'lib/flexsearch.light.js?v=294',
    'lib/flexsearch.light.js',
    'advice-search.worker.js',
    'advice-search.worker.js?v=294',
    'advice-panel.js?v=294',
    'coach-context.js?v=294',
    'advice-rules.js?v=294',
    'plan-analytics.js?v=294',
    'advice-template-manager.js?v=294',
    'advice-render.js?v=294',
    'advice-attachments.js?v=294',
    'advice-prompt.js?v=294',
    'advice-stream-renderer.js?v=294',
    'backup.js?v=294',
    'sync-ui.js?v=294',
    'sync-adapters.js?v=294',
    'sync.js?v=294',
    'sync-pure.js?v=294',
    'sync-status.js?v=294',
    'workout-system.js?v=294',
    'workout-wakelock.js?v=294',
    'workout-media-session.js?v=294',
    'workout-pip.js?v=294',
    'workout-core.js?v=294',
    'workout-cardio-pure.js?v=294',
    'workout-cardio.js?v=294',
    'workout-engine.js?v=294',
    'workout-state.js?v=294',
    'app-update.js?v=294',
    'credential-fields.js?v=294',
    'sheet-drag.js?v=294',
    'mi-scale-pure.js?v=294',
    'mi-scale-web-bluetooth.js?v=294',
    'm3e-ripple.js?v=294',
    'toast.js?v=294',
    'error-bus.js?v=294',
    'i18n.js?v=294',
    'a11y-focus-trap.js?v=294',
    'i18n/zh-CN.json?v=294',
    'i18n/en-US.json?v=294',
    'weekly-summary.js?v=294',
    'pr-tracker.js?v=294',
    'volume-heatmap.js?v=294',
    'swipe-actions.js?v=294',
    'health-profile.js?v=294',
    'report-metrics-pure.js?v=294',
    'report-panel.js?v=294',
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
