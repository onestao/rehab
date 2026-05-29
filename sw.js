// @ts-nocheck
const CACHE = 'training-assistant-v204';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'build/generated.css?v=204',
    'css-src/42-health-profile.css?v=204',
    'theme.js?v=204',
    'haptics.js?v=204',
    'fooddb.js?v=204',
    'ai-store.js?v=204',
    'ai-vision-pure.mjs?v=204',
    'ai-profile.js?v=204',
    'ai-models.js?v=204',
    'ai-api.js?v=204',
    'ai-pricing.js?v=204',
    'ai-templates.js?v=204',
    'render-safe.js?v=204',
    'nav-stack.js?v=204',
    'data-utils-pure.js?v=204',
    'data-utils.js?v=204',
    'data-records.js?v=204',
    'data-schema.js?v=204',
    'storage/idb.js?v=204',
    'storage/idb-collections.js?v=204',
    'storage/migrate.js?v=204',
    'data-store.js?v=204',
    'data-ui-state.js?v=204',
    'health-diet.js?v=204',
    'health-weight.js?v=204',
    'health-exercise.js?v=204',
    'goal-plan.js?v=204',
    'routine-plan.js?v=204',
    'routine-library.js?v=204',
    'data-views.js?v=204',
    'data.js?v=204',
    'voice-engine.js?v=204',
    'voice-cache.js?v=204',
    'voice-webspeech-adapter.js?v=204',
    'voice-legado-adapter.js?v=204',
    'workout-voice.js?v=204',
    'strength-form.js?v=204',
    'weekly-plan.js?v=204',
    'action-history.js?v=204',
    'plan-chains.js?v=204',
    'plan-progression.js?v=204',
    'plan-store.js?v=204',
    'plan-feedback.js?v=204',
    'plan-cooldown.js?v=204',
    'plan-weekly.js?v=204',
    'plan-equipment.js?v=204',
    'plan-ai.js?v=204',
    'plan-ui.js?v=204',
    'plan-progression-pure.js?v=204',
    'plan-store-pure.js?v=204',
    'food-log.js?v=204',
    'advice-panel.js?v=204',
    'advice-rules.js?v=204',
    'plan-analytics.js?v=204',
    'advice-template-manager.js?v=204',
    'advice-render.js?v=204',
    'advice-prompt.js?v=204',
    'advice-stream-renderer.js?v=204',
    'backup.js?v=204',
    'sync-ui.js?v=204',
    'sync-adapters.js?v=204',
    'sync.js?v=204',
    'sync-pure.js?v=204',
    'sync-status.js?v=204',
    'workout-system.js?v=204',
    'workout-wakelock.js?v=204',
    'workout-media-session.js?v=204',
    'workout-pip.js?v=204',
    'workout-core.js?v=204',
    'workout-cardio-pure.js?v=204',
    'workout-cardio.js?v=204',
    'workout-engine.js?v=204',
    'workout-state.js?v=204',
    'app-update.js?v=204',
    'credential-fields.js?v=204',
    'sheet-drag.js?v=204',
    'm3e-ripple.js?v=204',
    'toast.js?v=204',
    'error-bus.js?v=204',
    'i18n.js?v=204',
    'a11y-focus-trap.js?v=204',
    'i18n/zh-CN.json?v=204',
    'i18n/en-US.json?v=204',
    'weekly-summary.js?v=204',
    'pr-tracker.js?v=204',
    'volume-heatmap.js?v=204',
    'swipe-actions.js?v=204',
    'health-profile.js?v=204',
    'report-metrics-pure.js?v=204',
    'report-panel.js?v=204',
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
