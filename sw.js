// @ts-nocheck
const CACHE = 'training-assistant-v261';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=261',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=261',
    'workout-readiness.js?v=261',
    'css-src/42-health-profile.css?v=261',
    'theme.js?v=261',
    'haptics.js?v=261',
    'fooddb.js?v=261',
    'ai-store.js?v=261',
    'ai-vision-pure.mjs?v=261',
    'ai-profile.js?v=261',
    'ai-model-cache.js?v=261',
    'ai-models.js?v=261',
    'ai-api.js?v=261',
    'ai-pricing.js?v=261',
    'ai-templates.js?v=261',
    'render-safe.js?v=261',
    'nav-stack.js?v=261',
    'data-utils-pure.js?v=261',
    'data-utils.js?v=261',
    'data-records.js?v=261',
    'data-schema.js?v=261',
    'storage/idb.js?v=261',
    'storage/idb-collections.js?v=261',
    'storage/migrate.js?v=261',
    'data-store.js?v=261',
    'data-ui-state.js?v=261',
    'health-diet.js?v=261',
    'health-weight.js?v=261',
    'health-exercise.js?v=261',
    'goal-plan.js?v=261',
    'routine-plan.js?v=261',
    'routine-library.js?v=261',
    'data-views.js?v=261',
    'data.js?v=261',
    'voice-engine.js?v=261',
    'voice-cache.js?v=261',
    'voice-webspeech-adapter.js?v=261',
    'voice-legado-adapter.js?v=261',
    'workout-voice.js?v=261',
    'strength-form.js?v=261',
    'weekly-plan.js?v=261',
    'action-history.js?v=261',
    'plan-chains.js?v=261',
    'plan-progression.js?v=261',
    'plan-store.js?v=261',
    'plan-feedback.js?v=261',
    'plan-cooldown.js?v=261',
    'plan-auto-adjust.js?v=261',
    'plan-weekly.js?v=261',
    'plan-equipment.js?v=261',
    'plan-ai-pure.js?v=261',
    'plan-ai.js?v=261',
    'plan-ui.js?v=261',
    'plan-progression-pure.js?v=261',
    'plan-store-pure.js?v=261',
    'food-log.js?v=261',
    'advice-panel.js?v=261',
    'coach-context.js?v=261',
    'advice-rules.js?v=261',
    'plan-analytics.js?v=261',
    'advice-template-manager.js?v=261',
    'advice-render.js?v=261',
    'advice-attachments.js?v=261',
    'advice-prompt.js?v=261',
    'advice-stream-renderer.js?v=261',
    'backup.js?v=261',
    'sync-ui.js?v=261',
    'sync-adapters.js?v=261',
    'sync.js?v=261',
    'sync-pure.js?v=261',
    'sync-status.js?v=261',
    'workout-system.js?v=261',
    'workout-wakelock.js?v=261',
    'workout-media-session.js?v=261',
    'workout-pip.js?v=261',
    'workout-core.js?v=261',
    'workout-cardio-pure.js?v=261',
    'workout-cardio.js?v=261',
    'workout-engine.js?v=261',
    'workout-state.js?v=261',
    'app-update.js?v=261',
    'credential-fields.js?v=261',
    'sheet-drag.js?v=261',
    'mi-scale-pure.js?v=261',
    'mi-scale-web-bluetooth.js?v=261',
    'm3e-ripple.js?v=261',
    'toast.js?v=261',
    'error-bus.js?v=261',
    'i18n.js?v=261',
    'a11y-focus-trap.js?v=261',
    'i18n/zh-CN.json?v=261',
    'i18n/en-US.json?v=261',
    'weekly-summary.js?v=261',
    'pr-tracker.js?v=261',
    'volume-heatmap.js?v=261',
    'swipe-actions.js?v=261',
    'health-profile.js?v=261',
    'report-metrics-pure.js?v=261',
    'report-panel.js?v=261',
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
