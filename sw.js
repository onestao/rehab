// @ts-nocheck
const CACHE = 'training-assistant-v249';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=249',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=249',
    'workout-readiness.js?v=249',
    'css-src/42-health-profile.css?v=249',
    'theme.js?v=249',
    'haptics.js?v=249',
    'fooddb.js?v=249',
    'ai-store.js?v=249',
    'ai-vision-pure.mjs?v=249',
    'ai-profile.js?v=249',
    'ai-models.js?v=249',
    'ai-api.js?v=249',
    'ai-pricing.js?v=249',
    'ai-templates.js?v=249',
    'render-safe.js?v=249',
    'nav-stack.js?v=249',
    'data-utils-pure.js?v=249',
    'data-utils.js?v=249',
    'data-records.js?v=249',
    'data-schema.js?v=249',
    'storage/idb.js?v=249',
    'storage/idb-collections.js?v=249',
    'storage/migrate.js?v=249',
    'data-store.js?v=249',
    'data-ui-state.js?v=249',
    'health-diet.js?v=249',
    'health-weight.js?v=249',
    'health-exercise.js?v=249',
    'goal-plan.js?v=249',
    'routine-plan.js?v=249',
    'routine-library.js?v=249',
    'data-views.js?v=249',
    'data.js?v=249',
    'voice-engine.js?v=249',
    'voice-cache.js?v=249',
    'voice-webspeech-adapter.js?v=249',
    'voice-legado-adapter.js?v=249',
    'workout-voice.js?v=249',
    'strength-form.js?v=249',
    'weekly-plan.js?v=249',
    'action-history.js?v=249',
    'plan-chains.js?v=249',
    'plan-progression.js?v=249',
    'plan-store.js?v=249',
    'plan-feedback.js?v=249',
    'plan-cooldown.js?v=249',
    'plan-weekly.js?v=249',
    'plan-equipment.js?v=249',
    'plan-ai-pure.js?v=249',
    'plan-ai.js?v=249',
    'plan-ui.js?v=249',
    'plan-progression-pure.js?v=249',
    'plan-store-pure.js?v=249',
    'food-log.js?v=249',
    'advice-panel.js?v=249',
    'coach-context.js?v=249',
    'advice-rules.js?v=249',
    'plan-analytics.js?v=249',
    'advice-template-manager.js?v=249',
    'advice-render.js?v=249',
    'advice-attachments.js?v=249',
    'advice-prompt.js?v=249',
    'advice-stream-renderer.js?v=249',
    'backup.js?v=249',
    'sync-ui.js?v=249',
    'sync-adapters.js?v=249',
    'sync.js?v=249',
    'sync-pure.js?v=249',
    'sync-status.js?v=249',
    'workout-system.js?v=249',
    'workout-wakelock.js?v=249',
    'workout-media-session.js?v=249',
    'workout-pip.js?v=249',
    'workout-core.js?v=249',
    'workout-cardio-pure.js?v=249',
    'workout-cardio.js?v=249',
    'workout-engine.js?v=249',
    'workout-state.js?v=249',
    'app-update.js?v=249',
    'credential-fields.js?v=249',
    'sheet-drag.js?v=249',
    'mi-scale-pure.js?v=249',
    'mi-scale-web-bluetooth.js?v=249',
    'm3e-ripple.js?v=249',
    'toast.js?v=249',
    'error-bus.js?v=249',
    'i18n.js?v=249',
    'a11y-focus-trap.js?v=249',
    'i18n/zh-CN.json?v=249',
    'i18n/en-US.json?v=249',
    'weekly-summary.js?v=249',
    'pr-tracker.js?v=249',
    'volume-heatmap.js?v=249',
    'swipe-actions.js?v=249',
    'health-profile.js?v=249',
    'report-metrics-pure.js?v=249',
    'report-panel.js?v=249',
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
