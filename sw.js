// @ts-nocheck
const CACHE = 'training-assistant-v202';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'build/generated.css?v=202',
    'css-src/42-health-profile.css?v=202',
    'theme.js?v=202',
    'haptics.js?v=202',
    'fooddb.js?v=202',
    'ai-store.js?v=202',
    'ai-vision-pure.mjs?v=202',
    'ai-profile.js?v=202',
    'ai-models.js?v=202',
    'ai-api.js?v=202',
    'ai-pricing.js?v=202',
    'ai-templates.js?v=202',
    'render-safe.js?v=202',
    'nav-stack.js?v=202',
    'data-utils-pure.js?v=202',
    'data-utils.js?v=202',
    'data-records.js?v=202',
    'data-schema.js?v=202',
    'storage/idb.js?v=202',
    'storage/idb-collections.js?v=202',
    'storage/migrate.js?v=202',
    'data-store.js?v=202',
    'data-ui-state.js?v=202',
    'health-diet.js?v=202',
    'health-weight.js?v=202',
    'health-exercise.js?v=202',
    'goal-plan.js?v=202',
    'routine-plan.js?v=202',
    'routine-library.js?v=202',
    'data-views.js?v=202',
    'data.js?v=202',
    'voice-engine.js?v=202',
    'voice-cache.js?v=202',
    'voice-webspeech-adapter.js?v=202',
    'voice-legado-adapter.js?v=202',
    'workout-voice.js?v=202',
    'strength-form.js?v=202',
    'weekly-plan.js?v=202',
    'action-history.js?v=202',
    'plan-chains.js?v=202',
    'plan-progression.js?v=202',
    'plan-store.js?v=202',
    'plan-feedback.js?v=202',
    'plan-cooldown.js?v=202',
    'plan-weekly.js?v=202',
    'plan-equipment.js?v=202',
    'plan-ai.js?v=202',
    'plan-ui.js?v=202',
    'plan-progression-pure.js?v=202',
    'plan-store-pure.js?v=202',
    'food-log.js?v=202',
    'advice-panel.js?v=202',
    'advice-rules.js?v=202',
    'plan-analytics.js?v=202',
    'advice-template-manager.js?v=202',
    'advice-render.js?v=202',
    'advice-prompt.js?v=202',
    'advice-stream-renderer.js?v=202',
    'backup.js?v=202',
    'sync-ui.js?v=202',
    'sync-adapters.js?v=202',
    'sync.js?v=202',
    'sync-pure.js?v=202',
    'sync-status.js?v=202',
    'workout-system.js?v=202',
    'workout-wakelock.js?v=202',
    'workout-media-session.js?v=202',
    'workout-pip.js?v=202',
    'workout-core.js?v=202',
    'workout-cardio-pure.js?v=202',
    'workout-cardio.js?v=202',
    'workout-engine.js?v=202',
    'workout-state.js?v=202',
    'app-update.js?v=202',
    'credential-fields.js?v=202',
    'sheet-drag.js?v=202',
    'm3e-ripple.js?v=202',
    'toast.js?v=202',
    'error-bus.js?v=202',
    'i18n.js?v=202',
    'a11y-focus-trap.js?v=202',
    'i18n/zh-CN.json?v=202',
    'i18n/en-US.json?v=202',
    'weekly-summary.js?v=202',
    'pr-tracker.js?v=202',
    'volume-heatmap.js?v=202',
    'swipe-actions.js?v=202',
    'health-profile.js?v=202',
    'report-metrics-pure.js?v=202',
    'report-panel.js?v=202',
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
