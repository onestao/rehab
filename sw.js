// @ts-nocheck
const CACHE = 'training-assistant-v200';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'build/generated.css?v=200',
    'css-src/42-health-profile.css?v=200',
    'theme.js?v=200',
    'haptics.js?v=200',
    'fooddb.js?v=200',
    'ai-store.js?v=200',
    'ai-vision-pure.mjs?v=200',
    'ai-profile.js?v=200',
    'ai-models.js?v=200',
    'ai-api.js?v=200',
    'ai-pricing.js?v=200',
    'ai-templates.js?v=200',
    'render-safe.js?v=200',
    'nav-stack.js?v=200',
    'data-utils-pure.js?v=200',
    'data-utils.js?v=200',
    'data-records.js?v=200',
    'data-schema.js?v=200',
    'storage/idb.js?v=200',
    'storage/idb-collections.js?v=200',
    'storage/migrate.js?v=200',
    'data-store.js?v=200',
    'data-ui-state.js?v=200',
    'health-diet.js?v=200',
    'health-weight.js?v=200',
    'health-exercise.js?v=200',
    'goal-plan.js?v=200',
    'routine-plan.js?v=200',
    'routine-library.js?v=200',
    'data-views.js?v=200',
    'data.js?v=200',
    'voice-engine.js?v=200',
    'voice-cache.js?v=200',
    'voice-webspeech-adapter.js?v=200',
    'voice-legado-adapter.js?v=200',
    'workout-voice.js?v=200',
    'strength-form.js?v=200',
    'weekly-plan.js?v=200',
    'action-history.js?v=200',
    'plan-chains.js?v=200',
    'plan-progression.js?v=200',
    'plan-store.js?v=200',
    'plan-feedback.js?v=200',
    'plan-cooldown.js?v=200',
    'plan-weekly.js?v=200',
    'plan-equipment.js?v=200',
    'plan-ai.js?v=200',
    'plan-ui.js?v=200',
    'plan-progression-pure.js?v=200',
    'plan-store-pure.js?v=200',
    'food-log.js?v=200',
    'advice-panel.js?v=200',
    'advice-rules.js?v=200',
    'plan-analytics.js?v=200',
    'advice-template-manager.js?v=200',
    'advice-render.js?v=200',
    'advice-prompt.js?v=200',
    'advice-stream-renderer.js?v=200',
    'backup.js?v=200',
    'sync-ui.js?v=200',
    'sync-adapters.js?v=200',
    'sync.js?v=200',
    'sync-pure.js?v=200',
    'sync-status.js?v=200',
    'workout-system.js?v=200',
    'workout-wakelock.js?v=200',
    'workout-media-session.js?v=200',
    'workout-pip.js?v=200',
    'workout-core.js?v=200',
    'workout-cardio-pure.js?v=200',
    'workout-cardio.js?v=200',
    'workout-engine.js?v=200',
    'workout-state.js?v=200',
    'app-update.js?v=200',
    'credential-fields.js?v=200',
    'sheet-drag.js?v=200',
    'm3e-ripple.js?v=200',
    'toast.js?v=200',
    'error-bus.js?v=200',
    'i18n.js?v=200',
    'a11y-focus-trap.js?v=200',
    'i18n/zh-CN.json?v=200',
    'i18n/en-US.json?v=200',
    'weekly-summary.js?v=200',
    'pr-tracker.js?v=200',
    'volume-heatmap.js?v=200',
    'swipe-actions.js?v=200',
    'health-profile.js?v=200',
    'report-metrics-pure.js?v=200',
    'report-panel.js?v=200',
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
