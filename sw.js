// @ts-nocheck
const CACHE = 'training-assistant-v188';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'build/generated.css?v=188',
    'css-src/42-health-profile.css?v=188',
    'theme.js?v=188',
    'haptics.js?v=188',
    'fooddb.js?v=188',
    'ai-store.js?v=188',
    'ai-vision-pure.mjs?v=188',
    'ai-profile.js?v=188',
    'ai-models.js?v=188',
    'ai-api.js?v=188',
    'ai-pricing.js?v=188',
    'ai-templates.js?v=188',
    'render-safe.js?v=188',
    'nav-stack.js?v=188',
    'data-utils-pure.js?v=188',
    'data-utils.js?v=188',
    'data-records.js?v=188',
    'data-schema.js?v=188',
    'storage/idb.js?v=188',
    'storage/idb-collections.js?v=188',
    'storage/migrate.js?v=188',
    'data-store.js?v=188',
    'data-ui-state.js?v=188',
    'health-diet.js?v=188',
    'health-weight.js?v=188',
    'health-exercise.js?v=188',
    'goal-plan.js?v=188',
    'routine-plan.js?v=188',
    'routine-library.js?v=188',
    'data-views.js?v=188',
    'data.js?v=188',
    'voice-engine.js?v=188',
    'voice-cache.js?v=188',
    'voice-webspeech-adapter.js?v=188',
    'voice-legado-adapter.js?v=188',
    'workout-voice.js?v=188',
    'strength-form.js?v=188',
    'weekly-plan.js?v=188',
    'action-history.js?v=188',
    'plan-chains.js?v=188',
    'plan-progression.js?v=188',
    'plan-store.js?v=188',
    'plan-feedback.js?v=188',
    'plan-cooldown.js?v=188',
    'plan-weekly.js?v=188',
    'plan-equipment.js?v=188',
    'plan-ai.js?v=188',
    'plan-ui.js?v=188',
    'plan-progression-pure.js?v=188',
    'plan-store-pure.js?v=188',
    'food-log.js?v=188',
    'advice-panel.js?v=188',
    'advice-rules.js?v=188',
    'plan-analytics.js?v=188',
    'advice-template-manager.js?v=188',
    'advice-render.js?v=188',
    'advice-prompt.js?v=188',
    'advice-stream-renderer.js?v=188',
    'backup.js?v=188',
    'sync-ui.js?v=188',
    'sync-adapters.js?v=188',
    'sync.js?v=188',
    'sync-pure.js?v=188',
    'sync-status.js?v=188',
    'workout-system.js?v=188',
    'workout-wakelock.js?v=188',
    'workout-media-session.js?v=188',
    'workout-pip.js?v=188',
    'workout-core.js?v=188',
    'workout-cardio-pure.js?v=188',
    'workout-cardio.js?v=188',
    'workout-engine.js?v=188',
    'workout-state.js?v=188',
    'app-update.js?v=188',
    'credential-fields.js?v=188',
    'sheet-drag.js?v=188',
    'm3e-ripple.js?v=188',
    'toast.js?v=188',
    'error-bus.js?v=188',
    'i18n.js?v=188',
    'a11y-focus-trap.js?v=188',
    'i18n/zh-CN.json?v=188',
    'i18n/en-US.json?v=188',
    'weekly-summary.js?v=188',
    'pr-tracker.js?v=188',
    'volume-heatmap.js?v=188',
    'swipe-actions.js?v=188',
    'health-profile.js?v=188',
    'report-metrics-pure.js?v=188',
    'report-panel.js?v=188',
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
