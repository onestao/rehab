// @ts-nocheck
const CACHE = 'training-assistant-v244';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=244',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=244',
    'workout-readiness.js?v=244',
    'css-src/42-health-profile.css?v=244',
    'theme.js?v=244',
    'haptics.js?v=244',
    'fooddb.js?v=244',
    'ai-store.js?v=244',
    'ai-vision-pure.mjs?v=244',
    'ai-profile.js?v=244',
    'ai-models.js?v=244',
    'ai-api.js?v=244',
    'ai-pricing.js?v=244',
    'ai-templates.js?v=244',
    'render-safe.js?v=244',
    'nav-stack.js?v=244',
    'data-utils-pure.js?v=244',
    'data-utils.js?v=244',
    'data-records.js?v=244',
    'data-schema.js?v=244',
    'storage/idb.js?v=244',
    'storage/idb-collections.js?v=244',
    'storage/migrate.js?v=244',
    'data-store.js?v=244',
    'data-ui-state.js?v=244',
    'health-diet.js?v=244',
    'health-weight.js?v=244',
    'health-exercise.js?v=244',
    'goal-plan.js?v=244',
    'routine-plan.js?v=244',
    'routine-library.js?v=244',
    'data-views.js?v=244',
    'data.js?v=244',
    'voice-engine.js?v=244',
    'voice-cache.js?v=244',
    'voice-webspeech-adapter.js?v=244',
    'voice-legado-adapter.js?v=244',
    'workout-voice.js?v=244',
    'strength-form.js?v=244',
    'weekly-plan.js?v=244',
    'action-history.js?v=244',
    'plan-chains.js?v=244',
    'plan-progression.js?v=244',
    'plan-store.js?v=244',
    'plan-feedback.js?v=244',
    'plan-cooldown.js?v=244',
    'plan-weekly.js?v=244',
    'plan-equipment.js?v=244',
    'plan-ai-pure.js?v=244',
    'plan-ai.js?v=244',
    'plan-ui.js?v=244',
    'plan-progression-pure.js?v=244',
    'plan-store-pure.js?v=244',
    'food-log.js?v=244',
    'advice-panel.js?v=244',
    'coach-context.js?v=244',
    'advice-rules.js?v=244',
    'plan-analytics.js?v=244',
    'advice-template-manager.js?v=244',
    'advice-render.js?v=244',
    'advice-attachments.js?v=244',
    'advice-prompt.js?v=244',
    'advice-stream-renderer.js?v=244',
    'backup.js?v=244',
    'sync-ui.js?v=244',
    'sync-adapters.js?v=244',
    'sync.js?v=244',
    'sync-pure.js?v=244',
    'sync-status.js?v=244',
    'workout-system.js?v=244',
    'workout-wakelock.js?v=244',
    'workout-media-session.js?v=244',
    'workout-pip.js?v=244',
    'workout-core.js?v=244',
    'workout-cardio-pure.js?v=244',
    'workout-cardio.js?v=244',
    'workout-engine.js?v=244',
    'workout-state.js?v=244',
    'app-update.js?v=244',
    'credential-fields.js?v=244',
    'sheet-drag.js?v=244',
    'mi-scale-pure.js?v=244',
    'mi-scale-web-bluetooth.js?v=244',
    'm3e-ripple.js?v=244',
    'toast.js?v=244',
    'error-bus.js?v=244',
    'i18n.js?v=244',
    'a11y-focus-trap.js?v=244',
    'i18n/zh-CN.json?v=244',
    'i18n/en-US.json?v=244',
    'weekly-summary.js?v=244',
    'pr-tracker.js?v=244',
    'volume-heatmap.js?v=244',
    'swipe-actions.js?v=244',
    'health-profile.js?v=244',
    'report-metrics-pure.js?v=244',
    'report-panel.js?v=244',
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
