// @ts-nocheck
const CACHE = 'training-assistant-v132';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'build/generated.css?v=132',
    'css-src/42-health-profile.css?v=132',
    'theme.js?v=132',
    'haptics.js?v=132',
    'fooddb.js?v=132',
    'ai-store.js?v=132',
    'ai-profile.js?v=132',
    'ai-models.js?v=132',
    'ai-api.js?v=132',
    'ai-pricing.js?v=132',
    'ai-templates.js?v=132',
    'render-safe.js?v=132',
    'nav-stack.js?v=132',
    'data-utils-pure.js?v=132',
    'data-utils.js?v=132',
    'data-records.js?v=132',
    'data-schema.js?v=132',
    'storage/idb.js?v=132',
    'storage/migrate.js?v=132',
    'data-store.js?v=132',
    'data-ui-state.js?v=132',
    'health-diet.js?v=132',
    'health-weight.js?v=132',
    'health-exercise.js?v=132',
    'goal-plan.js?v=132',
    'routine-plan.js?v=132',
    'routine-library.js?v=132',
    'data-views.js?v=132',
    'data.js?v=132',
    'voice-engine.js?v=132',
    'voice-cache.js?v=132',
    'voice-webspeech-adapter.js?v=132',
    'voice-legado-adapter.js?v=132',
    'workout-voice.js?v=132',
    'strength-form.js?v=132',
    'weekly-plan.js?v=132',
    'action-history.js?v=132',
    'rehab-chains.js?v=132',
    'rehab-progression.js?v=132',
    'rehab-store.js?v=132',
    'rehab-feedback.js?v=132',
    'rehab-cooldown.js?v=132',
    'rehab-weekly.js?v=132',
    'rehab-equipment.js?v=132',
    'rehab-ai.js?v=132',
    'rehab-dock.js?v=132',
    'rehab-ui.js?v=132',
    'rehab-progression-pure.js?v=132',
    'rehab-store-pure.js?v=132',
    'food-log.js?v=132',
    'advice-panel.js?v=132',
    'advice-template-manager.js?v=132',
    'advice-render.js?v=132',
    'advice-prompt.js?v=132',
    'advice-stream-renderer.js?v=132',
    'backup.js?v=132',
    'sync-ui.js?v=132',
    'sync-adapters.js?v=132',
    'sync.js?v=132',
    'sync-pure.js?v=132',
    'sync-status.js?v=132',
    'workout-system.js?v=132',
    'workout-wakelock.js?v=132',
    'workout-media-session.js?v=132',
    'workout-pip.js?v=132',
    'workout-core.js?v=132',
    'workout-cardio-pure.js?v=132',
    'workout-cardio.js?v=132',
    'workout-engine.js?v=132',
    'workout-state.js?v=132',
    'app-update.js?v=132',
    'credential-fields.js?v=132',
    'sheet-drag.js?v=132',
    'toast.js?v=132',
    'error-bus.js?v=132',
    'i18n.js?v=132',
    'a11y-focus-trap.js?v=132',
    'i18n/zh-CN.json?v=132',
    'i18n/en-US.json?v=132',
    'weekly-summary.js?v=132',
    'pr-tracker.js?v=132',
    'volume-heatmap.js?v=132',
    'onboarding.js?v=132',
    'swipe-actions.js?v=132',
    'health-profile.js?v=132',
    'report-metrics-pure.js?v=132',
    'report-panel.js?v=132',
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
