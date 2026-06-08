// @ts-nocheck
const CACHE = 'training-assistant-v243';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=243',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=243',
    'workout-readiness.js?v=243',
    'css-src/42-health-profile.css?v=243',
    'theme.js?v=243',
    'haptics.js?v=243',
    'fooddb.js?v=243',
    'ai-store.js?v=243',
    'ai-vision-pure.mjs?v=243',
    'ai-profile.js?v=243',
    'ai-models.js?v=243',
    'ai-api.js?v=243',
    'ai-pricing.js?v=243',
    'ai-templates.js?v=243',
    'render-safe.js?v=243',
    'nav-stack.js?v=243',
    'data-utils-pure.js?v=243',
    'data-utils.js?v=243',
    'data-records.js?v=243',
    'data-schema.js?v=243',
    'storage/idb.js?v=243',
    'storage/idb-collections.js?v=243',
    'storage/migrate.js?v=243',
    'data-store.js?v=243',
    'data-ui-state.js?v=243',
    'health-diet.js?v=243',
    'health-weight.js?v=243',
    'health-exercise.js?v=243',
    'goal-plan.js?v=243',
    'routine-plan.js?v=243',
    'routine-library.js?v=243',
    'data-views.js?v=243',
    'data.js?v=243',
    'voice-engine.js?v=243',
    'voice-cache.js?v=243',
    'voice-webspeech-adapter.js?v=243',
    'voice-legado-adapter.js?v=243',
    'workout-voice.js?v=243',
    'strength-form.js?v=243',
    'weekly-plan.js?v=243',
    'action-history.js?v=243',
    'plan-chains.js?v=243',
    'plan-progression.js?v=243',
    'plan-store.js?v=243',
    'plan-feedback.js?v=243',
    'plan-cooldown.js?v=243',
    'plan-weekly.js?v=243',
    'plan-equipment.js?v=243',
    'plan-ai-pure.js?v=243',
    'plan-ai.js?v=243',
    'plan-ui.js?v=243',
    'plan-progression-pure.js?v=243',
    'plan-store-pure.js?v=243',
    'food-log.js?v=243',
    'advice-panel.js?v=243',
    'coach-context.js?v=243',
    'advice-rules.js?v=243',
    'plan-analytics.js?v=243',
    'advice-template-manager.js?v=243',
    'advice-render.js?v=243',
    'advice-attachments.js?v=243',
    'advice-prompt.js?v=243',
    'advice-stream-renderer.js?v=243',
    'backup.js?v=243',
    'sync-ui.js?v=243',
    'sync-adapters.js?v=243',
    'sync.js?v=243',
    'sync-pure.js?v=243',
    'sync-status.js?v=243',
    'workout-system.js?v=243',
    'workout-wakelock.js?v=243',
    'workout-media-session.js?v=243',
    'workout-pip.js?v=243',
    'workout-core.js?v=243',
    'workout-cardio-pure.js?v=243',
    'workout-cardio.js?v=243',
    'workout-engine.js?v=243',
    'workout-state.js?v=243',
    'app-update.js?v=243',
    'credential-fields.js?v=243',
    'sheet-drag.js?v=243',
    'mi-scale-pure.js?v=243',
    'mi-scale-web-bluetooth.js?v=243',
    'm3e-ripple.js?v=243',
    'toast.js?v=243',
    'error-bus.js?v=243',
    'i18n.js?v=243',
    'a11y-focus-trap.js?v=243',
    'i18n/zh-CN.json?v=243',
    'i18n/en-US.json?v=243',
    'weekly-summary.js?v=243',
    'pr-tracker.js?v=243',
    'volume-heatmap.js?v=243',
    'swipe-actions.js?v=243',
    'health-profile.js?v=243',
    'report-metrics-pure.js?v=243',
    'report-panel.js?v=243',
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

async function fetchNavigation(request) {
    try {
        const res = await fetch(request, { cache: 'no-store' });
        if (res && res.ok) {
            const cache = await caches.open(CACHE);
            cache.put('index.html', res.clone()).catch(() => {});
        }
        return res;
    } catch (err) {
        const cached = await caches.match('index.html') || await caches.match('./index.html') || await caches.match('/index.html');
        if (cached) return cached;
        throw err;
    }
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
        event.respondWith(fetchNavigation(event.request));
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
