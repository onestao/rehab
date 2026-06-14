// @ts-nocheck
const CACHE = 'training-assistant-v270';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=270',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=270',
    'workout-readiness.js?v=270',
    'css-src/42-health-profile.css?v=270',
    'theme.js?v=270',
    'haptics.js?v=270',
    'fooddb.js?v=270',
    'ai-store.js?v=270',
    'ai-vision-pure.mjs?v=270',
    'ai-profile.js?v=270',
    'ai-model-cache.js?v=270',
    'ai-models.js?v=270',
    'ai-api.js?v=270',
    'ai-pricing.js?v=270',
    'ai-templates.js?v=270',
    'render-safe.js?v=270',
    'nav-stack.js?v=270',
    'data-utils-pure.js?v=270',
    'data-utils.js?v=270',
    'data-records.js?v=270',
    'data-schema.js?v=270',
    'storage/idb.js?v=270',
    'storage/idb-collections.js?v=270',
    'storage/idb-advice-collections.js?v=270',
    'storage/migrate.js?v=270',
    'data-store.js?v=270',
    'data-ui-state.js?v=270',
    'health-diet.js?v=270',
    'health-weight.js?v=270',
    'health-exercise.js?v=270',
    'goal-plan.js?v=270',
    'routine-plan.js?v=270',
    'routine-library.js?v=270',
    'data-views.js?v=270',
    'data.js?v=270',
    'voice-engine.js?v=270',
    'voice-cache.js?v=270',
    'voice-webspeech-adapter.js?v=270',
    'voice-legado-adapter.js?v=270',
    'workout-voice.js?v=270',
    'strength-form.js?v=270',
    'weekly-plan.js?v=270',
    'action-history.js?v=270',
    'plan-chains.js?v=270',
    'plan-progression.js?v=270',
    'plan-store.js?v=270',
    'plan-feedback.js?v=270',
    'plan-cooldown.js?v=270',
    'plan-auto-adjust.js?v=270',
    'plan-weekly.js?v=270',
    'plan-equipment.js?v=270',
    'plan-ai-pure.js?v=270',
    'plan-ai.js?v=270',
    'plan-ui.js?v=270',
    'plan-progression-pure.js?v=270',
    'plan-store-pure.js?v=270',
    'food-log.js?v=270',
    'advice-panel.js?v=270',
    'coach-context.js?v=270',
    'advice-rules.js?v=270',
    'plan-analytics.js?v=270',
    'advice-template-manager.js?v=270',
    'advice-render.js?v=270',
    'advice-attachments.js?v=270',
    'advice-prompt.js?v=270',
    'advice-stream-renderer.js?v=270',
    'backup.js?v=270',
    'sync-ui.js?v=270',
    'sync-adapters.js?v=270',
    'sync.js?v=270',
    'sync-pure.js?v=270',
    'sync-status.js?v=270',
    'workout-system.js?v=270',
    'workout-wakelock.js?v=270',
    'workout-media-session.js?v=270',
    'workout-pip.js?v=270',
    'workout-core.js?v=270',
    'workout-cardio-pure.js?v=270',
    'workout-cardio.js?v=270',
    'workout-engine.js?v=270',
    'workout-state.js?v=270',
    'app-update.js?v=270',
    'credential-fields.js?v=270',
    'sheet-drag.js?v=270',
    'mi-scale-pure.js?v=270',
    'mi-scale-web-bluetooth.js?v=270',
    'm3e-ripple.js?v=270',
    'toast.js?v=270',
    'error-bus.js?v=270',
    'i18n.js?v=270',
    'a11y-focus-trap.js?v=270',
    'i18n/zh-CN.json?v=270',
    'i18n/en-US.json?v=270',
    'weekly-summary.js?v=270',
    'pr-tracker.js?v=270',
    'volume-heatmap.js?v=270',
    'swipe-actions.js?v=270',
    'health-profile.js?v=270',
    'report-metrics-pure.js?v=270',
    'report-panel.js?v=270',
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
