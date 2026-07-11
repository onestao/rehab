// @ts-nocheck
const CACHE = 'training-assistant-v314';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=314',
    'assets/app-icon.svg',
    'assets/material-symbols-rounded.woff2',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=314',
    // Lazy CSS: loaded on profile or records/training entry, still precached for offline use.
    'css-src/42-health-profile.css?v=314',
    'theme.js?v=314',
    'haptics.js?v=314',
    'fooddb.js?v=314',
    'render-safe.js?v=314',
    'nav-stack.js?v=314',
    'app-route.js?v=314',
    'data-utils-pure.js?v=314',
    'action-identity.js?v=314',
    'data-utils.js?v=314',
    'data-records.js?v=314',
    'data-schema.js?v=314',
    'storage/idb.js?v=314',
    'storage/idb-collections.js?v=314',
    'storage/idb-advice-collections.js?v=314',
    'storage/migrate.js?v=314',
    'advice-virtual-list.js?v=314',
    'data-store.js?v=314',
    'data-ui-state.js?v=314',
    'data-views.js?v=314',
    'data.js?v=314',
    'ai-model-catalog-pure.mjs?v=314',
    'ai-routing-pure.mjs?v=314',
    'ai-routing.js?v=314',
    'ai-model-visual.js?v=314',
    'ai-task-settings.js?v=314',
    'ai-provider-manager.js?v=314',
    'report-version-pure.js?v=314',
    'plan-chains.js?v=314',
    'plan-progression.js?v=314',
    'rehab-policy.js?v=314',
    'plan-store.js?v=314',
    'plan-feedback.js?v=314',
    'plan-cooldown.js?v=314',
    'plan-weekly.js?v=314',
    'plan-equipment.js?v=314',
    'plan-ui.js?v=314',
    'rehab-progression-pure.js?v=314',
    'plan-store-pure.js?v=314',
    'backup-import-pure.js?v=314',
    'backup-ring-pure.js?v=314',
    'backup.js?v=314',
    'sync-ui.js?v=314',
    'sync-adapters.js?v=314',
    'sync.js?v=314',
    'sync-pure.js?v=314',
    'sync-status.js?v=314',
    'workout-system.js?v=314',
    'workout-wakelock.js?v=314',
    'workout-media-session.js?v=314',
    'workout-pip.js?v=314',
    'workout-core.js?v=314',
    'workout-cardio-pure.js?v=314',
    'workout-cardio.js?v=314',
    'workout-engine.js?v=314',
    'workout-state.js?v=314',
    'app-update.js?v=314',
    'sheet-drag.js?v=314',
    'm3e-ripple.js?v=314',
    'toast.js?v=314',
    'error-bus.js?v=314',
    'i18n.js?v=314',
    'a11y-focus-trap.js?v=314',
    'i18n/zh-CN.json?v=314',
    'i18n/en-US.json?v=314',
    'manifest.json'
    , 'favicon.ico'
];

let voiceTtsHosts = new Set();
const RUNTIME_CACHE_FIRST_ASSETS = new Set([
    'assets/heic2any.min.js'
]);

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

function isRuntimeCacheFirstAsset(url) {
    const pathname = url.pathname.replace(/^\/+/, '');
    if (RUNTIME_CACHE_FIRST_ASSETS.has(pathname)) return true;
    return [...RUNTIME_CACHE_FIRST_ASSETS].some((asset) => pathname.endsWith('/' + asset));
}

async function fetchRuntimeCacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const res = await fetch(request, { credentials: 'same-origin', cache: 'no-store' });
        if (res && res.ok) {
            const clone = res.clone();
            const cache = await caches.open(CACHE);
            await cache.put(request, clone).catch(() => {});
        }
        return res;
    } catch (err) {
        const fallback = await caches.match(request);
        if (fallback) return fallback;
        throw err;
    }
}

async function fetchNavigation(request) {
    try {
        const res = await fetch(request, { cache: 'no-store' });
        if (res && res.ok) {
            const cache = await caches.open(CACHE);
            await cache.put('index.html', res.clone()).catch(() => {});
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

    if (isRuntimeCacheFirstAsset(url)) {
        event.respondWith(fetchRuntimeCacheFirst(event.request));
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
                    await cache.put(cacheKey, clone).catch(() => {});
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
                await cache.put(event.request, clone).catch(() => {});
            }
            return res;
        } catch (err) {
            const cached = await caches.match(event.request);
            if (cached) return cached;
            throw err;
        }
    })());
});
