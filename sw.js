// @ts-nocheck
const CACHE = 'training-assistant-v183';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'build/generated.css?v=183',
    'css-src/42-health-profile.css?v=183',
    'theme.js?v=183',
    'haptics.js?v=183',
    'fooddb.js?v=183',
    'ai-store.js?v=183',
    'ai-vision-pure.mjs?v=183',
    'ai-profile.js?v=183',
    'ai-models.js?v=183',
    'ai-api.js?v=183',
    'ai-pricing.js?v=183',
    'ai-templates.js?v=183',
    'render-safe.js?v=183',
    'nav-stack.js?v=183',
    'data-utils-pure.js?v=183',
    'data-utils.js?v=183',
    'data-records.js?v=183',
    'data-schema.js?v=183',
    'storage/idb.js?v=183',
    'storage/idb-collections.js?v=183',
    'storage/migrate.js?v=183',
    'data-store.js?v=183',
    'data-ui-state.js?v=183',
    'health-diet.js?v=183',
    'health-weight.js?v=183',
    'health-exercise.js?v=183',
    'goal-plan.js?v=183',
    'routine-plan.js?v=183',
    'routine-library.js?v=183',
    'data-views.js?v=183',
    'data.js?v=183',
    'voice-engine.js?v=183',
    'voice-cache.js?v=183',
    'voice-webspeech-adapter.js?v=183',
    'voice-legado-adapter.js?v=183',
    'workout-voice.js?v=183',
    'strength-form.js?v=183',
    'weekly-plan.js?v=183',
    'action-history.js?v=183',
    'plan-chains.js?v=183',
    'plan-progression.js?v=183',
    'plan-store.js?v=183',
    'plan-feedback.js?v=183',
    'plan-cooldown.js?v=183',
    'plan-weekly.js?v=183',
    'plan-equipment.js?v=183',
    'plan-ai.js?v=183',
    'plan-ui.js?v=183',
    'plan-progression-pure.js?v=183',
    'plan-store-pure.js?v=183',
    'food-log.js?v=183',
    'advice-panel.js?v=183',
    'advice-template-manager.js?v=183',
    'advice-render.js?v=183',
    'advice-prompt.js?v=183',
    'advice-stream-renderer.js?v=183',
    'backup.js?v=183',
    'sync-ui.js?v=183',
    'sync-adapters.js?v=183',
    'sync.js?v=183',
    'sync-pure.js?v=183',
    'sync-status.js?v=183',
    'workout-system.js?v=183',
    'workout-wakelock.js?v=183',
    'workout-media-session.js?v=183',
    'workout-pip.js?v=183',
    'workout-core.js?v=183',
    'workout-cardio-pure.js?v=183',
    'workout-cardio.js?v=183',
    'workout-engine.js?v=183',
    'workout-state.js?v=183',
    'app-update.js?v=183',
    'credential-fields.js?v=183',
    'sheet-drag.js?v=183',
    'm3e-ripple.js?v=183',
    'toast.js?v=183',
    'error-bus.js?v=183',
    'i18n.js?v=183',
    'a11y-focus-trap.js?v=183',
    'i18n/zh-CN.json?v=183',
    'i18n/en-US.json?v=183',
    'weekly-summary.js?v=183',
    'pr-tracker.js?v=183',
    'volume-heatmap.js?v=183',
    'swipe-actions.js?v=183',
    'health-profile.js?v=183',
    'report-metrics-pure.js?v=183',
    'report-panel.js?v=183',
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
