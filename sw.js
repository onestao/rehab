// @ts-nocheck
const CACHE = 'training-assistant-v298';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=298',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=298',
    'workout-readiness.js?v=298',
    'css-src/42-health-profile.css?v=298',
    'theme.js?v=298',
    'haptics.js?v=298',
    'fooddb.js?v=298',
    'ai-store.js?v=298',
    'ai-vision-pure.mjs?v=298',
    'ai-profile.js?v=298',
    'ai-model-cache.js?v=298',
    'ai-models.js?v=298',
    'ai-api.js?v=298',
    'ai-pricing.js?v=298',
    'ai-templates.js?v=298',
    'render-safe.js?v=298',
    'nav-stack.js?v=298',
    'app-route.js?v=298',
    'data-utils-pure.js?v=298',
    'action-identity.js?v=298',
    'data-utils.js?v=298',
    'data-records.js?v=298',
    'data-schema.js?v=298',
    'storage/idb.js?v=298',
    'storage/idb-collections.js?v=298',
    'storage/idb-advice-collections.js?v=298',
    'storage/migrate.js?v=298',
    'advice-virtual-list.js?v=298',
    'data-store.js?v=298',
    'data-ui-state.js?v=298',
    'health-diet.js?v=298',
    'health-weight.js?v=298',
    'health-exercise.js?v=298',
    'goal-plan.js?v=298',
    'routine-plan.js?v=298',
    'routine-library.js?v=298',
    'data-views.js?v=298',
    'data.js?v=298',
    'voice-engine.js?v=298',
    'voice-cache.js?v=298',
    'voice-webspeech-adapter.js?v=298',
    'voice-legado-adapter.js?v=298',
    'workout-voice.js?v=298',
    'strength-form.js?v=298',
    'weekly-plan.js?v=298',
    'action-history.js?v=298',
    'plan-chains.js?v=298',
    'plan-progression.js?v=298',
    'rehab-policy.js?v=298',
    'plan-store.js?v=298',
    'plan-feedback.js?v=298',
    'plan-cooldown.js?v=298',
    'plan-auto-adjust.js?v=298',
    'plan-weekly.js?v=298',
    'plan-equipment.js?v=298',
    'plan-ai-pure.js?v=298',
    'plan-ai.js?v=298',
    'plan-ui.js?v=298',
    'rehab-progression-pure.js?v=298',
    'plan-store-pure.js?v=298',
    'food-log.js?v=298',
    'lib/virtual-core.umd.js?v=298',
    'lib/flexsearch.light.js?v=298',
    'lib/flexsearch.light.js',
    'advice-search.worker.js',
    'advice-search.worker.js?v=298',
    'advice-panel.js?v=298',
    'coach-context.js?v=298',
    'advice-rules.js?v=298',
    'plan-analytics.js?v=298',
    'advice-template-manager.js?v=298',
    'advice-render.js?v=298',
    'advice-attachments.js?v=298',
    'advice-prompt.js?v=298',
    'advice-stream-renderer.js?v=298',
    'backup.js?v=298',
    'sync-ui.js?v=298',
    'sync-adapters.js?v=298',
    'sync.js?v=298',
    'sync-pure.js?v=298',
    'sync-status.js?v=298',
    'workout-system.js?v=298',
    'workout-wakelock.js?v=298',
    'workout-media-session.js?v=298',
    'workout-pip.js?v=298',
    'workout-core.js?v=298',
    'workout-cardio-pure.js?v=298',
    'workout-cardio.js?v=298',
    'workout-engine.js?v=298',
    'workout-state.js?v=298',
    'app-update.js?v=298',
    'credential-fields.js?v=298',
    'sheet-drag.js?v=298',
    'mi-scale-pure.js?v=298',
    'mi-scale-web-bluetooth.js?v=298',
    'm3e-ripple.js?v=298',
    'toast.js?v=298',
    'error-bus.js?v=298',
    'i18n.js?v=298',
    'a11y-focus-trap.js?v=298',
    'i18n/zh-CN.json?v=298',
    'i18n/en-US.json?v=298',
    'weekly-summary.js?v=298',
    'pr-tracker.js?v=298',
    'volume-heatmap.js?v=298',
    'swipe-actions.js?v=298',
    'health-profile.js?v=298',
    'report-metrics-pure.js?v=298',
    'report-panel.js?v=298',
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
