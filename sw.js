// @ts-nocheck
const CACHE = 'training-assistant-v187';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'build/generated.css?v=187',
    'css-src/42-health-profile.css?v=187',
    'theme.js?v=187',
    'haptics.js?v=187',
    'fooddb.js?v=187',
    'ai-store.js?v=187',
    'ai-vision-pure.mjs?v=187',
    'ai-profile.js?v=187',
    'ai-models.js?v=187',
    'ai-api.js?v=187',
    'ai-pricing.js?v=187',
    'ai-templates.js?v=187',
    'render-safe.js?v=187',
    'nav-stack.js?v=187',
    'data-utils-pure.js?v=187',
    'data-utils.js?v=187',
    'data-records.js?v=187',
    'data-schema.js?v=187',
    'storage/idb.js?v=187',
    'storage/idb-collections.js?v=187',
    'storage/migrate.js?v=187',
    'data-store.js?v=187',
    'data-ui-state.js?v=187',
    'health-diet.js?v=187',
    'health-weight.js?v=187',
    'health-exercise.js?v=187',
    'goal-plan.js?v=187',
    'routine-plan.js?v=187',
    'routine-library.js?v=187',
    'data-views.js?v=187',
    'data.js?v=187',
    'voice-engine.js?v=187',
    'voice-cache.js?v=187',
    'voice-webspeech-adapter.js?v=187',
    'voice-legado-adapter.js?v=187',
    'workout-voice.js?v=187',
    'strength-form.js?v=187',
    'weekly-plan.js?v=187',
    'action-history.js?v=187',
    'plan-chains.js?v=187',
    'plan-progression.js?v=187',
    'plan-store.js?v=187',
    'plan-feedback.js?v=187',
    'plan-cooldown.js?v=187',
    'plan-weekly.js?v=187',
    'plan-equipment.js?v=187',
    'plan-ai.js?v=187',
    'plan-ui.js?v=187',
    'plan-progression-pure.js?v=187',
    'plan-store-pure.js?v=187',
    'food-log.js?v=187',
    'advice-panel.js?v=187',
    'advice-rules.js?v=187',
    'plan-analytics.js?v=187',
    'advice-template-manager.js?v=187',
    'advice-render.js?v=187',
    'advice-prompt.js?v=187',
    'advice-stream-renderer.js?v=187',
    'backup.js?v=187',
    'sync-ui.js?v=187',
    'sync-adapters.js?v=187',
    'sync.js?v=187',
    'sync-pure.js?v=187',
    'sync-status.js?v=187',
    'workout-system.js?v=187',
    'workout-wakelock.js?v=187',
    'workout-media-session.js?v=187',
    'workout-pip.js?v=187',
    'workout-core.js?v=187',
    'workout-cardio-pure.js?v=187',
    'workout-cardio.js?v=187',
    'workout-engine.js?v=187',
    'workout-state.js?v=187',
    'app-update.js?v=187',
    'credential-fields.js?v=187',
    'sheet-drag.js?v=187',
    'm3e-ripple.js?v=187',
    'toast.js?v=187',
    'error-bus.js?v=187',
    'i18n.js?v=187',
    'a11y-focus-trap.js?v=187',
    'i18n/zh-CN.json?v=187',
    'i18n/en-US.json?v=187',
    'weekly-summary.js?v=187',
    'pr-tracker.js?v=187',
    'volume-heatmap.js?v=187',
    'swipe-actions.js?v=187',
    'health-profile.js?v=187',
    'report-metrics-pure.js?v=187',
    'report-panel.js?v=187',
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
