// @ts-nocheck
const CACHE = 'training-assistant-v256';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=256',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=256',
    'workout-readiness.js?v=256',
    'css-src/42-health-profile.css?v=256',
    'theme.js?v=256',
    'haptics.js?v=256',
    'fooddb.js?v=256',
    'ai-store.js?v=256',
    'ai-vision-pure.mjs?v=256',
    'ai-profile.js?v=256',
    'ai-model-cache.js?v=256',
    'ai-models.js?v=256',
    'ai-api.js?v=256',
    'ai-pricing.js?v=256',
    'ai-templates.js?v=256',
    'render-safe.js?v=256',
    'nav-stack.js?v=256',
    'data-utils-pure.js?v=256',
    'data-utils.js?v=256',
    'data-records.js?v=256',
    'data-schema.js?v=256',
    'storage/idb.js?v=256',
    'storage/idb-collections.js?v=256',
    'storage/migrate.js?v=256',
    'data-store.js?v=256',
    'data-ui-state.js?v=256',
    'health-diet.js?v=256',
    'health-weight.js?v=256',
    'health-exercise.js?v=256',
    'goal-plan.js?v=256',
    'routine-plan.js?v=256',
    'routine-library.js?v=256',
    'data-views.js?v=256',
    'data.js?v=256',
    'voice-engine.js?v=256',
    'voice-cache.js?v=256',
    'voice-webspeech-adapter.js?v=256',
    'voice-legado-adapter.js?v=256',
    'workout-voice.js?v=256',
    'strength-form.js?v=256',
    'weekly-plan.js?v=256',
    'action-history.js?v=256',
    'plan-chains.js?v=256',
    'plan-progression.js?v=256',
    'plan-store.js?v=256',
    'plan-feedback.js?v=256',
    'plan-cooldown.js?v=256',
    'plan-weekly.js?v=256',
    'plan-equipment.js?v=256',
    'plan-ai-pure.js?v=256',
    'plan-ai.js?v=256',
    'plan-ui.js?v=256',
    'plan-progression-pure.js?v=256',
    'plan-store-pure.js?v=256',
    'food-log.js?v=256',
    'advice-panel.js?v=256',
    'coach-context.js?v=256',
    'advice-rules.js?v=256',
    'plan-analytics.js?v=256',
    'advice-template-manager.js?v=256',
    'advice-render.js?v=256',
    'advice-attachments.js?v=256',
    'advice-prompt.js?v=256',
    'advice-stream-renderer.js?v=256',
    'backup.js?v=256',
    'sync-ui.js?v=256',
    'sync-adapters.js?v=256',
    'sync.js?v=256',
    'sync-pure.js?v=256',
    'sync-status.js?v=256',
    'workout-system.js?v=256',
    'workout-wakelock.js?v=256',
    'workout-media-session.js?v=256',
    'workout-pip.js?v=256',
    'workout-core.js?v=256',
    'workout-cardio-pure.js?v=256',
    'workout-cardio.js?v=256',
    'workout-engine.js?v=256',
    'workout-state.js?v=256',
    'app-update.js?v=256',
    'credential-fields.js?v=256',
    'sheet-drag.js?v=256',
    'mi-scale-pure.js?v=256',
    'mi-scale-web-bluetooth.js?v=256',
    'm3e-ripple.js?v=256',
    'toast.js?v=256',
    'error-bus.js?v=256',
    'i18n.js?v=256',
    'a11y-focus-trap.js?v=256',
    'i18n/zh-CN.json?v=256',
    'i18n/en-US.json?v=256',
    'weekly-summary.js?v=256',
    'pr-tracker.js?v=256',
    'volume-heatmap.js?v=256',
    'swipe-actions.js?v=256',
    'health-profile.js?v=256',
    'report-metrics-pure.js?v=256',
    'report-panel.js?v=256',
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
