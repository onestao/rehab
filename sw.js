// @ts-nocheck
const CACHE = 'training-assistant-v184';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'build/generated.css?v=184',
    'css-src/42-health-profile.css?v=184',
    'theme.js?v=184',
    'haptics.js?v=184',
    'fooddb.js?v=184',
    'ai-store.js?v=184',
    'ai-vision-pure.mjs?v=184',
    'ai-profile.js?v=184',
    'ai-models.js?v=184',
    'ai-api.js?v=184',
    'ai-pricing.js?v=184',
    'ai-templates.js?v=184',
    'render-safe.js?v=184',
    'nav-stack.js?v=184',
    'data-utils-pure.js?v=184',
    'data-utils.js?v=184',
    'data-records.js?v=184',
    'data-schema.js?v=184',
    'storage/idb.js?v=184',
    'storage/idb-collections.js?v=184',
    'storage/migrate.js?v=184',
    'data-store.js?v=184',
    'data-ui-state.js?v=184',
    'health-diet.js?v=184',
    'health-weight.js?v=184',
    'health-exercise.js?v=184',
    'goal-plan.js?v=184',
    'routine-plan.js?v=184',
    'routine-library.js?v=184',
    'data-views.js?v=184',
    'data.js?v=184',
    'voice-engine.js?v=184',
    'voice-cache.js?v=184',
    'voice-webspeech-adapter.js?v=184',
    'voice-legado-adapter.js?v=184',
    'workout-voice.js?v=184',
    'strength-form.js?v=184',
    'weekly-plan.js?v=184',
    'action-history.js?v=184',
    'plan-chains.js?v=184',
    'plan-progression.js?v=184',
    'plan-store.js?v=184',
    'plan-feedback.js?v=184',
    'plan-cooldown.js?v=184',
    'plan-weekly.js?v=184',
    'plan-equipment.js?v=184',
    'plan-ai.js?v=184',
    'plan-ui.js?v=184',
    'plan-progression-pure.js?v=184',
    'plan-store-pure.js?v=184',
    'food-log.js?v=184',
    'advice-panel.js?v=184',
    'advice-template-manager.js?v=184',
    'advice-render.js?v=184',
    'advice-prompt.js?v=184',
    'advice-stream-renderer.js?v=184',
    'backup.js?v=184',
    'sync-ui.js?v=184',
    'sync-adapters.js?v=184',
    'sync.js?v=184',
    'sync-pure.js?v=184',
    'sync-status.js?v=184',
    'workout-system.js?v=184',
    'workout-wakelock.js?v=184',
    'workout-media-session.js?v=184',
    'workout-pip.js?v=184',
    'workout-core.js?v=184',
    'workout-cardio-pure.js?v=184',
    'workout-cardio.js?v=184',
    'workout-engine.js?v=184',
    'workout-state.js?v=184',
    'app-update.js?v=184',
    'credential-fields.js?v=184',
    'sheet-drag.js?v=184',
    'm3e-ripple.js?v=184',
    'toast.js?v=184',
    'error-bus.js?v=184',
    'i18n.js?v=184',
    'a11y-focus-trap.js?v=184',
    'i18n/zh-CN.json?v=184',
    'i18n/en-US.json?v=184',
    'weekly-summary.js?v=184',
    'pr-tracker.js?v=184',
    'volume-heatmap.js?v=184',
    'swipe-actions.js?v=184',
    'health-profile.js?v=184',
    'report-metrics-pure.js?v=184',
    'report-panel.js?v=184',
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
