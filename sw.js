// @ts-nocheck
const CACHE = 'training-assistant-v241';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=241',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=241',
    'workout-readiness.js?v=241',
    'css-src/42-health-profile.css?v=241',
    'theme.js?v=241',
    'haptics.js?v=241',
    'fooddb.js?v=241',
    'ai-store.js?v=241',
    'ai-vision-pure.mjs?v=241',
    'ai-profile.js?v=241',
    'ai-models.js?v=241',
    'ai-api.js?v=241',
    'ai-pricing.js?v=241',
    'ai-templates.js?v=241',
    'render-safe.js?v=241',
    'nav-stack.js?v=241',
    'data-utils-pure.js?v=241',
    'data-utils.js?v=241',
    'data-records.js?v=241',
    'data-schema.js?v=241',
    'storage/idb.js?v=241',
    'storage/idb-collections.js?v=241',
    'storage/migrate.js?v=241',
    'data-store.js?v=241',
    'data-ui-state.js?v=241',
    'health-diet.js?v=241',
    'health-weight.js?v=241',
    'health-exercise.js?v=241',
    'goal-plan.js?v=241',
    'routine-plan.js?v=241',
    'routine-library.js?v=241',
    'data-views.js?v=241',
    'data.js?v=241',
    'voice-engine.js?v=241',
    'voice-cache.js?v=241',
    'voice-webspeech-adapter.js?v=241',
    'voice-legado-adapter.js?v=241',
    'workout-voice.js?v=241',
    'strength-form.js?v=241',
    'weekly-plan.js?v=241',
    'action-history.js?v=241',
    'plan-chains.js?v=241',
    'plan-progression.js?v=241',
    'plan-store.js?v=241',
    'plan-feedback.js?v=241',
    'plan-cooldown.js?v=241',
    'plan-weekly.js?v=241',
    'plan-equipment.js?v=241',
    'plan-ai.js?v=241',
    'plan-ui.js?v=241',
    'plan-progression-pure.js?v=241',
    'plan-store-pure.js?v=241',
    'food-log.js?v=241',
    'advice-panel.js?v=241',
    'coach-context.js?v=241',
    'advice-rules.js?v=241',
    'plan-analytics.js?v=241',
    'advice-template-manager.js?v=241',
    'advice-render.js?v=241',
    'advice-attachments.js?v=241',
    'advice-prompt.js?v=241',
    'advice-stream-renderer.js?v=241',
    'backup.js?v=241',
    'sync-ui.js?v=241',
    'sync-adapters.js?v=241',
    'sync.js?v=241',
    'sync-pure.js?v=241',
    'sync-status.js?v=241',
    'workout-system.js?v=241',
    'workout-wakelock.js?v=241',
    'workout-media-session.js?v=241',
    'workout-pip.js?v=241',
    'workout-core.js?v=241',
    'workout-cardio-pure.js?v=241',
    'workout-cardio.js?v=241',
    'workout-engine.js?v=241',
    'workout-state.js?v=241',
    'app-update.js?v=241',
    'credential-fields.js?v=241',
    'sheet-drag.js?v=241',
    'mi-scale-pure.js?v=241',
    'mi-scale-web-bluetooth.js?v=241',
    'm3e-ripple.js?v=241',
    'toast.js?v=241',
    'error-bus.js?v=241',
    'i18n.js?v=241',
    'a11y-focus-trap.js?v=241',
    'i18n/zh-CN.json?v=241',
    'i18n/en-US.json?v=241',
    'weekly-summary.js?v=241',
    'pr-tracker.js?v=241',
    'volume-heatmap.js?v=241',
    'swipe-actions.js?v=241',
    'health-profile.js?v=241',
    'report-metrics-pure.js?v=241',
    'report-panel.js?v=241',
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
