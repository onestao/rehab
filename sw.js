// @ts-nocheck
const CACHE = 'training-assistant-v148';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'build/generated.css?v=148',
    'css-src/42-health-profile.css?v=148',
    'theme.js?v=148',
    'haptics.js?v=148',
    'fooddb.js?v=148',
    'ai-store.js?v=148',
    'ai-vision-pure.mjs?v=148',
    'ai-profile.js?v=148',
    'ai-models.js?v=148',
    'ai-api.js?v=148',
    'ai-pricing.js?v=148',
    'ai-templates.js?v=148',
    'render-safe.js?v=148',
    'nav-stack.js?v=148',
    'data-utils-pure.js?v=148',
    'data-utils.js?v=148',
    'data-records.js?v=148',
    'data-schema.js?v=148',
    'storage/idb.js?v=148',
    'storage/migrate.js?v=148',
    'data-store.js?v=148',
    'data-ui-state.js?v=148',
    'health-diet.js?v=148',
    'health-weight.js?v=148',
    'health-exercise.js?v=148',
    'goal-plan.js?v=148',
    'routine-plan.js?v=148',
    'routine-library.js?v=148',
    'data-views.js?v=148',
    'data.js?v=148',
    'voice-engine.js?v=148',
    'voice-cache.js?v=148',
    'voice-webspeech-adapter.js?v=148',
    'voice-legado-adapter.js?v=148',
    'workout-voice.js?v=148',
    'strength-form.js?v=148',
    'weekly-plan.js?v=148',
    'action-history.js?v=148',
    'plan-chains.js?v=148',
    'plan-progression.js?v=148',
    'plan-store.js?v=148',
    'plan-feedback.js?v=148',
    'plan-cooldown.js?v=148',
    'plan-weekly.js?v=148',
    'plan-equipment.js?v=148',
    'plan-ai.js?v=148',
    'plan-ui.js?v=148',
    'plan-progression-pure.js?v=148',
    'plan-store-pure.js?v=148',
    'food-log.js?v=148',
    'advice-panel.js?v=148',
    'advice-template-manager.js?v=148',
    'advice-render.js?v=148',
    'advice-prompt.js?v=148',
    'advice-stream-renderer.js?v=148',
    'backup.js?v=148',
    'sync-ui.js?v=148',
    'sync-adapters.js?v=148',
    'sync.js?v=148',
    'sync-pure.js?v=148',
    'sync-status.js?v=148',
    'workout-system.js?v=148',
    'workout-wakelock.js?v=148',
    'workout-media-session.js?v=148',
    'workout-pip.js?v=148',
    'workout-core.js?v=148',
    'workout-cardio-pure.js?v=148',
    'workout-cardio.js?v=148',
    'workout-engine.js?v=148',
    'workout-state.js?v=148',
    'app-update.js?v=148',
    'credential-fields.js?v=148',
    'sheet-drag.js?v=148',
    'toast.js?v=148',
    'error-bus.js?v=148',
    'i18n.js?v=148',
    'a11y-focus-trap.js?v=148',
    'i18n/zh-CN.json?v=148',
    'i18n/en-US.json?v=148',
    'weekly-summary.js?v=148',
    'pr-tracker.js?v=148',
    'volume-heatmap.js?v=148',
    'onboarding.js?v=148',
    'swipe-actions.js?v=148',
    'health-profile.js?v=148',
    'report-metrics-pure.js?v=148',
    'report-panel.js?v=148',
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
