// @ts-nocheck
const CACHE = 'training-assistant-v203';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'build/generated.css?v=203',
    'css-src/42-health-profile.css?v=203',
    'theme.js?v=203',
    'haptics.js?v=203',
    'fooddb.js?v=203',
    'ai-store.js?v=203',
    'ai-vision-pure.mjs?v=203',
    'ai-profile.js?v=203',
    'ai-models.js?v=203',
    'ai-api.js?v=203',
    'ai-pricing.js?v=203',
    'ai-templates.js?v=203',
    'render-safe.js?v=203',
    'nav-stack.js?v=203',
    'data-utils-pure.js?v=203',
    'data-utils.js?v=203',
    'data-records.js?v=203',
    'data-schema.js?v=203',
    'storage/idb.js?v=203',
    'storage/idb-collections.js?v=203',
    'storage/migrate.js?v=203',
    'data-store.js?v=203',
    'data-ui-state.js?v=203',
    'health-diet.js?v=203',
    'health-weight.js?v=203',
    'health-exercise.js?v=203',
    'goal-plan.js?v=203',
    'routine-plan.js?v=203',
    'routine-library.js?v=203',
    'data-views.js?v=203',
    'data.js?v=203',
    'voice-engine.js?v=203',
    'voice-cache.js?v=203',
    'voice-webspeech-adapter.js?v=203',
    'voice-legado-adapter.js?v=203',
    'workout-voice.js?v=203',
    'strength-form.js?v=203',
    'weekly-plan.js?v=203',
    'action-history.js?v=203',
    'plan-chains.js?v=203',
    'plan-progression.js?v=203',
    'plan-store.js?v=203',
    'plan-feedback.js?v=203',
    'plan-cooldown.js?v=203',
    'plan-weekly.js?v=203',
    'plan-equipment.js?v=203',
    'plan-ai.js?v=203',
    'plan-ui.js?v=203',
    'plan-progression-pure.js?v=203',
    'plan-store-pure.js?v=203',
    'food-log.js?v=203',
    'advice-panel.js?v=203',
    'advice-rules.js?v=203',
    'plan-analytics.js?v=203',
    'advice-template-manager.js?v=203',
    'advice-render.js?v=203',
    'advice-prompt.js?v=203',
    'advice-stream-renderer.js?v=203',
    'backup.js?v=203',
    'sync-ui.js?v=203',
    'sync-adapters.js?v=203',
    'sync.js?v=203',
    'sync-pure.js?v=203',
    'sync-status.js?v=203',
    'workout-system.js?v=203',
    'workout-wakelock.js?v=203',
    'workout-media-session.js?v=203',
    'workout-pip.js?v=203',
    'workout-core.js?v=203',
    'workout-cardio-pure.js?v=203',
    'workout-cardio.js?v=203',
    'workout-engine.js?v=203',
    'workout-state.js?v=203',
    'app-update.js?v=203',
    'credential-fields.js?v=203',
    'sheet-drag.js?v=203',
    'm3e-ripple.js?v=203',
    'toast.js?v=203',
    'error-bus.js?v=203',
    'i18n.js?v=203',
    'a11y-focus-trap.js?v=203',
    'i18n/zh-CN.json?v=203',
    'i18n/en-US.json?v=203',
    'weekly-summary.js?v=203',
    'pr-tracker.js?v=203',
    'volume-heatmap.js?v=203',
    'swipe-actions.js?v=203',
    'health-profile.js?v=203',
    'report-metrics-pure.js?v=203',
    'report-panel.js?v=203',
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
