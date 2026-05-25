// @ts-nocheck
const CACHE = 'training-assistant-v147';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'build/generated.css?v=147',
    'css-src/42-health-profile.css?v=147',
    'theme.js?v=147',
    'haptics.js?v=147',
    'fooddb.js?v=147',
    'ai-store.js?v=147',
    'ai-vision-pure.mjs?v=147',
    'ai-profile.js?v=147',
    'ai-models.js?v=147',
    'ai-api.js?v=147',
    'ai-pricing.js?v=147',
    'ai-templates.js?v=147',
    'render-safe.js?v=147',
    'nav-stack.js?v=147',
    'data-utils-pure.js?v=147',
    'data-utils.js?v=147',
    'data-records.js?v=147',
    'data-schema.js?v=147',
    'storage/idb.js?v=147',
    'storage/migrate.js?v=147',
    'data-store.js?v=147',
    'data-ui-state.js?v=147',
    'health-diet.js?v=147',
    'health-weight.js?v=147',
    'health-exercise.js?v=147',
    'goal-plan.js?v=147',
    'routine-plan.js?v=147',
    'routine-library.js?v=147',
    'data-views.js?v=147',
    'data.js?v=147',
    'voice-engine.js?v=147',
    'voice-cache.js?v=147',
    'voice-webspeech-adapter.js?v=147',
    'voice-legado-adapter.js?v=147',
    'workout-voice.js?v=147',
    'strength-form.js?v=147',
    'weekly-plan.js?v=147',
    'action-history.js?v=147',
    'plan-chains.js?v=147',
    'plan-progression.js?v=147',
    'plan-store.js?v=147',
    'plan-feedback.js?v=147',
    'plan-cooldown.js?v=147',
    'plan-weekly.js?v=147',
    'plan-equipment.js?v=147',
    'plan-ai.js?v=147',
    'plan-ui.js?v=147',
    'plan-progression-pure.js?v=147',
    'plan-store-pure.js?v=147',
    'food-log.js?v=147',
    'advice-panel.js?v=147',
    'advice-template-manager.js?v=147',
    'advice-render.js?v=147',
    'advice-prompt.js?v=147',
    'advice-stream-renderer.js?v=147',
    'backup.js?v=147',
    'sync-ui.js?v=147',
    'sync-adapters.js?v=147',
    'sync.js?v=147',
    'sync-pure.js?v=147',
    'sync-status.js?v=147',
    'workout-system.js?v=147',
    'workout-wakelock.js?v=147',
    'workout-media-session.js?v=147',
    'workout-pip.js?v=147',
    'workout-core.js?v=147',
    'workout-cardio-pure.js?v=147',
    'workout-cardio.js?v=147',
    'workout-engine.js?v=147',
    'workout-state.js?v=147',
    'app-update.js?v=147',
    'credential-fields.js?v=147',
    'sheet-drag.js?v=147',
    'toast.js?v=147',
    'error-bus.js?v=147',
    'i18n.js?v=147',
    'a11y-focus-trap.js?v=147',
    'i18n/zh-CN.json?v=147',
    'i18n/en-US.json?v=147',
    'weekly-summary.js?v=147',
    'pr-tracker.js?v=147',
    'volume-heatmap.js?v=147',
    'onboarding.js?v=147',
    'swipe-actions.js?v=147',
    'health-profile.js?v=147',
    'report-metrics-pure.js?v=147',
    'report-panel.js?v=147',
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
