// @ts-nocheck
const CACHE = 'training-assistant-v121';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'build/generated.css?v=121',
    'css-src/42-health-profile.css?v=121',
    'theme.js?v=121',
    'haptics.js?v=121',
    'fooddb.js?v=121',
    'ai-store.js?v=121',
    'ai-profile.js?v=121',
    'ai-models.js?v=121',
    'ai-api.js?v=121',
    'ai-pricing.js?v=121',
    'ai-templates.js?v=121',
    'render-safe.js?v=121',
    'nav-stack.js?v=121',
    'data-utils-pure.js?v=121',
    'data-utils.js?v=121',
    'data-records.js?v=121',
    'data-schema.js?v=121',
    'storage/idb.js?v=121',
    'storage/migrate.js?v=121',
    'data-store.js?v=121',
    'data-ui-state.js?v=121',
    'health-diet.js?v=121',
    'health-weight.js?v=121',
    'health-exercise.js?v=121',
    'goal-plan.js?v=121',
    'routine-plan.js?v=121',
    'routine-library.js?v=121',
    'data-views.js?v=121',
    'data.js?v=121',
    'voice-engine.js?v=121',
    'voice-cache.js?v=121',
    'voice-webspeech-adapter.js?v=121',
    'voice-legado-adapter.js?v=121',
    'workout-voice.js?v=121',
    'strength-form.js?v=121',
    'weekly-plan.js?v=121',
    'action-history.js?v=121',
    'food-log.js?v=121',
    'advice-panel.js?v=121',
    'advice-template-manager.js?v=121',
    'advice-render.js?v=121',
    'advice-prompt.js?v=121',
    'advice-stream-renderer.js?v=121',
    'backup.js?v=121',
    'sync-ui.js?v=121',
    'sync-adapters.js?v=121',
    'sync.js?v=121',
    'sync-pure.js?v=121',
    'sync-status.js?v=121',
    'workout-system.js?v=121',
    'workout-wakelock.js?v=121',
    'workout-media-session.js?v=121',
    'workout-pip.js?v=121',
    'workout-core.js?v=121',
    'workout-cardio-pure.js?v=121',
    'workout-cardio.js?v=121',
    'workout-engine.js?v=121',
    'workout-state.js?v=121',
    'app-update.js?v=121',
    'credential-fields.js?v=121',
    'sheet-drag.js?v=121',
    'toast.js?v=121',
    'error-bus.js?v=121',
    'i18n.js?v=121',
    'a11y-focus-trap.js?v=121',
    'i18n/zh-CN.json?v=121',
    'i18n/en-US.json?v=121',
    'weekly-summary.js?v=121',
    'pr-tracker.js?v=121',
    'volume-heatmap.js?v=121',
    'onboarding.js?v=121',
    'swipe-actions.js?v=121',
    'health-profile.js?v=121',
    'report-metrics-pure.js?v=121',
    'report-panel.js?v=121',
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

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (voiceTtsHosts.has(url.hostname.toLowerCase())) {
        event.respondWith(fetch(event.request));
        return;
    }
    if (url.origin !== location.origin) return;

    if (event.request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname === '/') {
        event.respondWith(fetch(event.request, { cache: 'no-store' }));
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
