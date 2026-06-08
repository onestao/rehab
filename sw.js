// @ts-nocheck
const CACHE = 'training-assistant-v245';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=245',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=245',
    'workout-readiness.js?v=245',
    'css-src/42-health-profile.css?v=245',
    'theme.js?v=245',
    'haptics.js?v=245',
    'fooddb.js?v=245',
    'ai-store.js?v=245',
    'ai-vision-pure.mjs?v=245',
    'ai-profile.js?v=245',
    'ai-models.js?v=245',
    'ai-api.js?v=245',
    'ai-pricing.js?v=245',
    'ai-templates.js?v=245',
    'render-safe.js?v=245',
    'nav-stack.js?v=245',
    'data-utils-pure.js?v=245',
    'data-utils.js?v=245',
    'data-records.js?v=245',
    'data-schema.js?v=245',
    'storage/idb.js?v=245',
    'storage/idb-collections.js?v=245',
    'storage/migrate.js?v=245',
    'data-store.js?v=245',
    'data-ui-state.js?v=245',
    'health-diet.js?v=245',
    'health-weight.js?v=245',
    'health-exercise.js?v=245',
    'goal-plan.js?v=245',
    'routine-plan.js?v=245',
    'routine-library.js?v=245',
    'data-views.js?v=245',
    'data.js?v=245',
    'voice-engine.js?v=245',
    'voice-cache.js?v=245',
    'voice-webspeech-adapter.js?v=245',
    'voice-legado-adapter.js?v=245',
    'workout-voice.js?v=245',
    'strength-form.js?v=245',
    'weekly-plan.js?v=245',
    'action-history.js?v=245',
    'plan-chains.js?v=245',
    'plan-progression.js?v=245',
    'plan-store.js?v=245',
    'plan-feedback.js?v=245',
    'plan-cooldown.js?v=245',
    'plan-weekly.js?v=245',
    'plan-equipment.js?v=245',
    'plan-ai-pure.js?v=245',
    'plan-ai.js?v=245',
    'plan-ui.js?v=245',
    'plan-progression-pure.js?v=245',
    'plan-store-pure.js?v=245',
    'food-log.js?v=245',
    'advice-panel.js?v=245',
    'coach-context.js?v=245',
    'advice-rules.js?v=245',
    'plan-analytics.js?v=245',
    'advice-template-manager.js?v=245',
    'advice-render.js?v=245',
    'advice-attachments.js?v=245',
    'advice-prompt.js?v=245',
    'advice-stream-renderer.js?v=245',
    'backup.js?v=245',
    'sync-ui.js?v=245',
    'sync-adapters.js?v=245',
    'sync.js?v=245',
    'sync-pure.js?v=245',
    'sync-status.js?v=245',
    'workout-system.js?v=245',
    'workout-wakelock.js?v=245',
    'workout-media-session.js?v=245',
    'workout-pip.js?v=245',
    'workout-core.js?v=245',
    'workout-cardio-pure.js?v=245',
    'workout-cardio.js?v=245',
    'workout-engine.js?v=245',
    'workout-state.js?v=245',
    'app-update.js?v=245',
    'credential-fields.js?v=245',
    'sheet-drag.js?v=245',
    'mi-scale-pure.js?v=245',
    'mi-scale-web-bluetooth.js?v=245',
    'm3e-ripple.js?v=245',
    'toast.js?v=245',
    'error-bus.js?v=245',
    'i18n.js?v=245',
    'a11y-focus-trap.js?v=245',
    'i18n/zh-CN.json?v=245',
    'i18n/en-US.json?v=245',
    'weekly-summary.js?v=245',
    'pr-tracker.js?v=245',
    'volume-heatmap.js?v=245',
    'swipe-actions.js?v=245',
    'health-profile.js?v=245',
    'report-metrics-pure.js?v=245',
    'report-panel.js?v=245',
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
