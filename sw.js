// @ts-nocheck
const CACHE = 'training-assistant-v300';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=300',
    'assets/app-icon.svg',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=300',
    'workout-readiness.js?v=300',
    // Lazy CSS: loaded on profile or records/training entry, still precached for offline use.
    'css-src/42-health-profile.css?v=300',
    'theme.js?v=300',
    'haptics.js?v=300',
    'fooddb.js?v=300',
    'ai-store.js?v=300',
    'ai-vision-pure.mjs?v=300',
    'ai-profile.js?v=300',
    'ai-model-cache.js?v=300',
    'ai-models.js?v=300',
    'ai-api.js?v=300',
    'ai-pricing.js?v=300',
    'ai-templates.js?v=300',
    'render-safe.js?v=300',
    'nav-stack.js?v=300',
    'app-route.js?v=300',
    'data-utils-pure.js?v=300',
    'action-identity.js?v=300',
    'data-utils.js?v=300',
    'data-records.js?v=300',
    'data-schema.js?v=300',
    'storage/idb.js?v=300',
    'storage/idb-collections.js?v=300',
    'storage/idb-advice-collections.js?v=300',
    'storage/migrate.js?v=300',
    'advice-virtual-list.js?v=300',
    'data-store.js?v=300',
    'data-ui-state.js?v=300',
    'health-diet.js?v=300',
    'health-weight.js?v=300',
    'health-exercise.js?v=300',
    'goal-plan.js?v=300',
    'routine-plan.js?v=300',
    'routine-library.js?v=300',
    'data-views.js?v=300',
    'data.js?v=300',
    'voice-engine.js?v=300',
    'voice-cache.js?v=300',
    'voice-webspeech-adapter.js?v=300',
    'voice-legado-adapter.js?v=300',
    'workout-voice.js?v=300',
    'strength-form.js?v=300',
    'weekly-plan.js?v=300',
    'action-history.js?v=300',
    'plan-chains.js?v=300',
    'plan-progression.js?v=300',
    'rehab-policy.js?v=300',
    'plan-store.js?v=300',
    'plan-feedback.js?v=300',
    'plan-cooldown.js?v=300',
    'plan-auto-adjust.js?v=300',
    'plan-weekly.js?v=300',
    'plan-equipment.js?v=300',
    'plan-ai-pure.js?v=300',
    'plan-ai.js?v=300',
    'plan-ui.js?v=300',
    'rehab-progression-pure.js?v=300',
    'plan-store-pure.js?v=300',
    'food-log.js?v=300',
    'lib/virtual-core.umd.js?v=300',
    'lib/flexsearch.light.js?v=300',
    'lib/flexsearch.light.js',
    'advice-search.worker.js',
    'advice-search.worker.js?v=300',
    'advice-panel.js?v=300',
    'coach-context.js?v=300',
    'advice-rules.js?v=300',
    'plan-analytics.js?v=300',
    'advice-template-manager.js?v=300',
    'advice-render.js?v=300',
    'advice-attachments.js?v=300',
    'advice-prompt.js?v=300',
    'advice-stream-renderer.js?v=300',
    'backup-import-pure.js?v=300',
    'backup-ring-pure.js?v=300',
    'backup.js?v=300',
    'sync-ui.js?v=300',
    'sync-adapters.js?v=300',
    'sync.js?v=300',
    'sync-pure.js?v=300',
    'sync-status.js?v=300',
    'workout-system.js?v=300',
    'workout-wakelock.js?v=300',
    'workout-media-session.js?v=300',
    'workout-pip.js?v=300',
    'workout-core.js?v=300',
    'workout-cardio-pure.js?v=300',
    'workout-cardio.js?v=300',
    'workout-engine.js?v=300',
    'workout-state.js?v=300',
    'app-update.js?v=300',
    'credential-fields.js?v=300',
    'sheet-drag.js?v=300',
    'mi-scale-pure.js?v=300',
    'mi-scale-web-bluetooth.js?v=300',
    'm3e-ripple.js?v=300',
    'toast.js?v=300',
    'error-bus.js?v=300',
    'i18n.js?v=300',
    'a11y-focus-trap.js?v=300',
    'i18n/zh-CN.json?v=300',
    'i18n/en-US.json?v=300',
    'weekly-summary.js?v=300',
    'pr-tracker.js?v=300',
    'volume-heatmap.js?v=300',
    'swipe-actions.js?v=300',
    'health-profile.js?v=300',
    'report-metrics-pure.js?v=300',
    'report-panel.js?v=300',
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
