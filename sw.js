// @ts-nocheck
const CACHE = 'training-assistant-v149';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'build/generated.css?v=149',
    'css-src/42-health-profile.css?v=149',
    'theme.js?v=149',
    'haptics.js?v=149',
    'fooddb.js?v=149',
    'ai-store.js?v=149',
    'ai-vision-pure.mjs?v=149',
    'ai-profile.js?v=149',
    'ai-models.js?v=149',
    'ai-api.js?v=149',
    'ai-pricing.js?v=149',
    'ai-templates.js?v=149',
    'render-safe.js?v=149',
    'nav-stack.js?v=149',
    'data-utils-pure.js?v=149',
    'data-utils.js?v=149',
    'data-records.js?v=149',
    'data-schema.js?v=149',
    'storage/idb.js?v=149',
    'storage/migrate.js?v=149',
    'data-store.js?v=149',
    'data-ui-state.js?v=149',
    'health-diet.js?v=149',
    'health-weight.js?v=149',
    'health-exercise.js?v=149',
    'goal-plan.js?v=149',
    'routine-plan.js?v=149',
    'routine-library.js?v=149',
    'data-views.js?v=149',
    'data.js?v=149',
    'voice-engine.js?v=149',
    'voice-cache.js?v=149',
    'voice-webspeech-adapter.js?v=149',
    'voice-legado-adapter.js?v=149',
    'workout-voice.js?v=149',
    'strength-form.js?v=149',
    'weekly-plan.js?v=149',
    'action-history.js?v=149',
    'plan-chains.js?v=149',
    'plan-progression.js?v=149',
    'plan-store.js?v=149',
    'plan-feedback.js?v=149',
    'plan-cooldown.js?v=149',
    'plan-weekly.js?v=149',
    'plan-equipment.js?v=149',
    'plan-ai.js?v=149',
    'plan-ui.js?v=149',
    'plan-progression-pure.js?v=149',
    'plan-store-pure.js?v=149',
    'food-log.js?v=149',
    'advice-panel.js?v=149',
    'advice-template-manager.js?v=149',
    'advice-render.js?v=149',
    'advice-prompt.js?v=149',
    'advice-stream-renderer.js?v=149',
    'backup.js?v=149',
    'sync-ui.js?v=149',
    'sync-adapters.js?v=149',
    'sync.js?v=149',
    'sync-pure.js?v=149',
    'sync-status.js?v=149',
    'workout-system.js?v=149',
    'workout-wakelock.js?v=149',
    'workout-media-session.js?v=149',
    'workout-pip.js?v=149',
    'workout-core.js?v=149',
    'workout-cardio-pure.js?v=149',
    'workout-cardio.js?v=149',
    'workout-engine.js?v=149',
    'workout-state.js?v=149',
    'app-update.js?v=149',
    'credential-fields.js?v=149',
    'sheet-drag.js?v=149',
    'toast.js?v=149',
    'error-bus.js?v=149',
    'i18n.js?v=149',
    'a11y-focus-trap.js?v=149',
    'i18n/zh-CN.json?v=149',
    'i18n/en-US.json?v=149',
    'weekly-summary.js?v=149',
    'pr-tracker.js?v=149',
    'volume-heatmap.js?v=149',
    'onboarding.js?v=149',
    'swipe-actions.js?v=149',
    'health-profile.js?v=149',
    'report-metrics-pure.js?v=149',
    'report-panel.js?v=149',
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
