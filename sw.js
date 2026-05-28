// @ts-nocheck
const CACHE = 'training-assistant-v192';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'build/generated.css?v=192',
    'css-src/42-health-profile.css?v=192',
    'theme.js?v=192',
    'haptics.js?v=192',
    'fooddb.js?v=192',
    'ai-store.js?v=192',
    'ai-vision-pure.mjs?v=192',
    'ai-profile.js?v=192',
    'ai-models.js?v=192',
    'ai-api.js?v=192',
    'ai-pricing.js?v=192',
    'ai-templates.js?v=192',
    'render-safe.js?v=192',
    'nav-stack.js?v=192',
    'data-utils-pure.js?v=192',
    'data-utils.js?v=192',
    'data-records.js?v=192',
    'data-schema.js?v=192',
    'storage/idb.js?v=192',
    'storage/idb-collections.js?v=192',
    'storage/migrate.js?v=192',
    'data-store.js?v=192',
    'data-ui-state.js?v=192',
    'health-diet.js?v=192',
    'health-weight.js?v=192',
    'health-exercise.js?v=192',
    'goal-plan.js?v=192',
    'routine-plan.js?v=192',
    'routine-library.js?v=192',
    'data-views.js?v=192',
    'data.js?v=192',
    'voice-engine.js?v=192',
    'voice-cache.js?v=192',
    'voice-webspeech-adapter.js?v=192',
    'voice-legado-adapter.js?v=192',
    'workout-voice.js?v=192',
    'strength-form.js?v=192',
    'weekly-plan.js?v=192',
    'action-history.js?v=192',
    'plan-chains.js?v=192',
    'plan-progression.js?v=192',
    'plan-store.js?v=192',
    'plan-feedback.js?v=192',
    'plan-cooldown.js?v=192',
    'plan-weekly.js?v=192',
    'plan-equipment.js?v=192',
    'plan-ai.js?v=192',
    'plan-ui.js?v=192',
    'plan-progression-pure.js?v=192',
    'plan-store-pure.js?v=192',
    'food-log.js?v=192',
    'advice-panel.js?v=192',
    'advice-rules.js?v=192',
    'plan-analytics.js?v=192',
    'advice-template-manager.js?v=192',
    'advice-render.js?v=192',
    'advice-prompt.js?v=192',
    'advice-stream-renderer.js?v=192',
    'backup.js?v=192',
    'sync-ui.js?v=192',
    'sync-adapters.js?v=192',
    'sync.js?v=192',
    'sync-pure.js?v=192',
    'sync-status.js?v=192',
    'workout-system.js?v=192',
    'workout-wakelock.js?v=192',
    'workout-media-session.js?v=192',
    'workout-pip.js?v=192',
    'workout-core.js?v=192',
    'workout-cardio-pure.js?v=192',
    'workout-cardio.js?v=192',
    'workout-engine.js?v=192',
    'workout-state.js?v=192',
    'app-update.js?v=192',
    'credential-fields.js?v=192',
    'sheet-drag.js?v=192',
    'm3e-ripple.js?v=192',
    'toast.js?v=192',
    'error-bus.js?v=192',
    'i18n.js?v=192',
    'a11y-focus-trap.js?v=192',
    'i18n/zh-CN.json?v=192',
    'i18n/en-US.json?v=192',
    'weekly-summary.js?v=192',
    'pr-tracker.js?v=192',
    'volume-heatmap.js?v=192',
    'swipe-actions.js?v=192',
    'health-profile.js?v=192',
    'report-metrics-pure.js?v=192',
    'report-panel.js?v=192',
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
