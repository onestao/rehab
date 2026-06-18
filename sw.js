// @ts-nocheck
const CACHE = 'training-assistant-v283';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=283',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=283',
    'workout-readiness.js?v=283',
    'css-src/42-health-profile.css?v=283',
    'theme.js?v=283',
    'haptics.js?v=283',
    'fooddb.js?v=283',
    'ai-store.js?v=283',
    'ai-vision-pure.mjs?v=283',
    'ai-profile.js?v=283',
    'ai-model-cache.js?v=283',
    'ai-models.js?v=283',
    'ai-api.js?v=283',
    'ai-pricing.js?v=283',
    'ai-templates.js?v=283',
    'render-safe.js?v=283',
    'nav-stack.js?v=283',
    'app-route.js?v=283',
    'data-utils-pure.js?v=283',
    'data-utils.js?v=283',
    'data-records.js?v=283',
    'data-schema.js?v=283',
    'storage/idb.js?v=283',
    'storage/idb-collections.js?v=283',
    'storage/idb-advice-collections.js?v=283',
    'storage/migrate.js?v=283',
    'advice-virtual-list.js?v=283',
    'data-store.js?v=283',
    'data-ui-state.js?v=283',
    'health-diet.js?v=283',
    'health-weight.js?v=283',
    'health-exercise.js?v=283',
    'goal-plan.js?v=283',
    'routine-plan.js?v=283',
    'routine-library.js?v=283',
    'data-views.js?v=283',
    'data.js?v=283',
    'voice-engine.js?v=283',
    'voice-cache.js?v=283',
    'voice-webspeech-adapter.js?v=283',
    'voice-legado-adapter.js?v=283',
    'workout-voice.js?v=283',
    'strength-form.js?v=283',
    'weekly-plan.js?v=283',
    'action-history.js?v=283',
    'plan-chains.js?v=283',
    'plan-progression.js?v=283',
    'plan-store.js?v=283',
    'plan-feedback.js?v=283',
    'plan-cooldown.js?v=283',
    'plan-auto-adjust.js?v=283',
    'plan-weekly.js?v=283',
    'plan-equipment.js?v=283',
    'plan-ai-pure.js?v=283',
    'plan-ai.js?v=283',
    'plan-ui.js?v=283',
    'plan-progression-pure.js?v=283',
    'plan-store-pure.js?v=283',
    'food-log.js?v=283',
    'lib/virtual-core.umd.js?v=283',
    'lib/flexsearch.light.js?v=283',
    'lib/flexsearch.light.js',
    'advice-search.worker.js',
    'advice-search.worker.js?v=283',
    'advice-panel.js?v=283',
    'coach-context.js?v=283',
    'advice-rules.js?v=283',
    'plan-analytics.js?v=283',
    'advice-template-manager.js?v=283',
    'advice-render.js?v=283',
    'advice-attachments.js?v=283',
    'advice-prompt.js?v=283',
    'advice-stream-renderer.js?v=283',
    'backup.js?v=283',
    'sync-ui.js?v=283',
    'sync-adapters.js?v=283',
    'sync.js?v=283',
    'sync-pure.js?v=283',
    'sync-status.js?v=283',
    'workout-system.js?v=283',
    'workout-wakelock.js?v=283',
    'workout-media-session.js?v=283',
    'workout-pip.js?v=283',
    'workout-core.js?v=283',
    'workout-cardio-pure.js?v=283',
    'workout-cardio.js?v=283',
    'workout-engine.js?v=283',
    'workout-state.js?v=283',
    'app-update.js?v=283',
    'credential-fields.js?v=283',
    'sheet-drag.js?v=283',
    'mi-scale-pure.js?v=283',
    'mi-scale-web-bluetooth.js?v=283',
    'm3e-ripple.js?v=283',
    'toast.js?v=283',
    'error-bus.js?v=283',
    'i18n.js?v=283',
    'a11y-focus-trap.js?v=283',
    'i18n/zh-CN.json?v=283',
    'i18n/en-US.json?v=283',
    'weekly-summary.js?v=283',
    'pr-tracker.js?v=283',
    'volume-heatmap.js?v=283',
    'swipe-actions.js?v=283',
    'health-profile.js?v=283',
    'report-metrics-pure.js?v=283',
    'report-panel.js?v=283',
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
