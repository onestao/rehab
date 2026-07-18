// @ts-nocheck
const CACHE = 'training-assistant-v328';
const CACHE_ASSET_REVISION = 'cb0925cbc333c1ae020f3bb2ea1aef7cddb53131f7bad5a9f8c5e99cedeec34c';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=328',
    'assets/app-icon.svg',
    'assets/material-symbols-rounded.woff2',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=328',
    // Lazy CSS: loaded on profile or records/training entry, still precached for offline use.
    'css-src/42-health-profile.css?v=328',
    'theme.js?v=328',
    'haptics.js?v=328',
    'fooddb.js?v=328',
    'food-ai-normalizer-pure.js?v=328',
    'render-safe.js?v=328',
    'nav-stack.js?v=328',
    'app-route.js?v=328',
    'data-utils-pure.js?v=328',
    'action-identity.js?v=328',
    'data-utils.js?v=328',
    'data-records.js?v=328',
    'data-schema.js?v=328',
    'storage/idb.js?v=328',
    'storage/idb-collections.js?v=328',
    'storage/idb-advice-collections.js?v=328',
    'storage/migrate.js?v=328',
    'advice-virtual-list.js?v=328',
    'data-store.js?v=328',
    'data-ui-state.js?v=328',
    'data-views.js?v=328',
    'data.js?v=328',
    'health-summary-pure.js?v=328',
    'ai-model-catalog-pure.mjs?v=328',
    'ai-routing-pure.mjs?v=328',
    'ai-routing.js?v=328',
    'ai-model-visual.js?v=328',
    'ai-task-settings.js?v=328',
    'ai-provider-manager.js?v=328',
    'report-version-pure.js?v=328',
    'plan-chains.js?v=328',
    'plan-progression.js?v=328',
    'rehab-policy.js?v=328',
    'plan-store.js?v=328',
    'plan-feedback.js?v=328',
    'plan-cooldown.js?v=328',
    'plan-weekly.js?v=328',
    'plan-equipment.js?v=328',
    'plan-ui.js?v=328',
    'rehab-progression-pure.js?v=328',
    'plan-store-pure.js?v=328',
    'backup-import-pure.js?v=328',
    'backup-ring-pure.js?v=328',
    'backup.js?v=328',
    'sync-ui.js?v=328',
    'sync-adapters.js?v=328',
    'sync.js?v=328',
    'sync-pure.js?v=328',
    'sync-status.js?v=328',
    'workout-system.js?v=328',
    'workout-wakelock.js?v=328',
    'workout-media-session.js?v=328',
    'workout-pip.js?v=328',
    'workout-core.js?v=328',
    'workout-cardio-pure.js?v=328',
    'workout-cardio.js?v=328',
    'workout-engine.js?v=328',
    'workout-state.js?v=328',
    'app-update.js?v=328',
    'sheet-drag.js?v=328',
    'm3e-ripple.js?v=328',
    'toast.js?v=328',
    'error-bus.js?v=328',
    'i18n.js?v=328',
    'a11y-focus-trap.js?v=328',
    'i18n/zh-CN.json?v=328',
    'i18n/en-US.json?v=328',
    'manifest.json'
    , 'favicon.ico'
];

let voiceTtsHosts = new Set();
const RUNTIME_CACHE_FIRST_ASSETS = new Set([
    'assets/heic2any.min.js'
]);
const RELEASE_READY_KEY = `__release_ready__?v=${CACHE_VERSION}`;
const LEGACY_UPGRADE_NAVIGATION_PATH = '__legacy_upgrade_navigation__';
const LEGACY_NAVIGATION_TIMEOUT_MS = 5000;
const LEGACY_NAVIGATION_GRACE_MS = 3000;
let releasePrecachePromise = null;
let legacyMigrationPromise = null;
let legacyMigrationTimer = null;
const legacyNavigationAttempts = new Map();

async function isReleaseCacheReady() {
    const cache = await caches.open(CACHE);
    return !!(await cache.match(RELEASE_READY_KEY));
}

async function precacheReleaseAssets() {
    if (!releasePrecachePromise) {
        releasePrecachePromise = (async () => {
            const cache = await caches.open(CACHE);
            await Promise.all(ASSETS.map((asset) => cache.add(asset)));
            await cache.put(RELEASE_READY_KEY, new Response(CACHE_ASSET_REVISION, {
                headers: { 'content-type': 'text/plain' }
            }));
        })().catch((error) => {
            releasePrecachePromise = null;
            throw error;
        });
    }
    return releasePrecachePromise;
}

function legacyUpgradeNavigationRequest(clientId) {
    const base = self.registration?.scope || `${location.origin}/`;
    const url = new URL(LEGACY_UPGRADE_NAVIGATION_PATH, base);
    url.searchParams.set('client', clientId);
    url.searchParams.set('v', CACHE_VERSION);
    return new Request(url.href);
}

async function queueLegacyUpgradeNavigation(source) {
    const clientId = String(source?.id || '');
    const clientUrl = String(source?.url || '');
    if (!clientId || !clientUrl) return;
    const cache = await caches.open(CACHE);
    await cache.put(legacyUpgradeNavigationRequest(clientId), new Response(clientUrl, {
        headers: { 'content-type': 'text/plain' }
    }));
}

function legacyUpgradeUrl(urlText) {
    const url = new URL(urlText);
    url.searchParams.set('__rehab_upgrade', CACHE_VERSION);
    return url.href;
}

async function legacyUpgradeNavigationRequests(cache) {
    const requests = await cache.keys();
    return requests.filter((request) => {
        const url = new URL(request.url);
        return url.pathname.endsWith(LEGACY_UPGRADE_NAVIGATION_PATH)
            && url.searchParams.get('v') === CACHE_VERSION;
    });
}

async function acknowledgeV327Page(source) {
    const clientId = String(source?.id || '');
    if (!clientId) return;
    const cache = await caches.open(CACHE);
    await cache.delete(legacyUpgradeNavigationRequest(clientId));
}

function notifyLegacyRefreshRequired(client) {
    client?.postMessage?.({
        type: 'UPDATE_REFRESH_REQUIRED',
        version: CACHE_VERSION,
        message: "\u66f4\u65b0\u5df2\u5b8c\u6210\uff0c\u8bf7\u5237\u65b0\u9875\u9762"
    });
}

async function navigateLegacyUpgradeClient(cache, request) {
    const response = await cache.match(request);
    if (!response) return 'missing-marker';

    const clientId = new URL(request.url).searchParams.get('client');
    if (!clientId) {
        await cache.delete(request);
        return 'missing-client-id';
    }
    if (legacyNavigationAttempts.has(clientId)) return legacyNavigationAttempts.get(clientId);

    const attempt = (async () => {
        const client = await self.clients.get(clientId);
        if (!client || typeof client.navigate !== 'function') {
            await cache.delete(request);
            return 'client-gone';
        }

        const fallbackUrl = await response.text();
        let timeoutId = null;
        const navigation = Promise.resolve()
            .then(() => client.navigate(legacyUpgradeUrl(client.url || fallbackUrl)))
            .then(async () => {
                if (timeoutId !== null) clearTimeout(timeoutId);
                await cache.delete(request);
                return 'resolved';
            }, (error) => {
                if (timeoutId !== null) clearTimeout(timeoutId);
                console.warn('[sw] legacy client navigation will retry', clientId, error && error.message);
                notifyLegacyRefreshRequired(client);
                return 'rejected';
            });
        const timeout = new Promise((resolve) => {
            timeoutId = setTimeout(() => {
                notifyLegacyRefreshRequired(client);
                resolve('timeout');
            }, LEGACY_NAVIGATION_TIMEOUT_MS);
        });
        return Promise.race([navigation, timeout]);
    })().finally(() => {
        legacyNavigationAttempts.delete(clientId);
    });
    legacyNavigationAttempts.set(clientId, attempt);
    return attempt;
}

async function navigateLegacyUpgradeClients() {
    const cache = await caches.open(CACHE);
    const queued = await legacyUpgradeNavigationRequests(cache);

    // Each legacy client migrates independently. Keep a marker until navigation
    // succeeds or that client disappears so one failure cannot block claim/retry.
    await Promise.allSettled(queued.map((request) => navigateLegacyUpgradeClient(cache, request)));
}

function migrateLegacyUpgradeClients() {
    if (!legacyMigrationPromise) {
        legacyMigrationPromise = navigateLegacyUpgradeClients().finally(() => {
            legacyMigrationPromise = null;
        });
    }
    return legacyMigrationPromise;
}

function scheduleLegacyUpgradeMigration() {
    if (legacyMigrationTimer !== null) return;
    legacyMigrationTimer = setTimeout(() => {
        legacyMigrationTimer = null;
        void migrateLegacyUpgradeClients()
            .then(() => cleanupOldCachesIfLegacyMigrationComplete())
            .catch((error) => console.warn('[sw] legacy migration failed', error && error.message));
    }, LEGACY_NAVIGATION_GRACE_MS);
}

async function cleanupOldCachesIfLegacyMigrationComplete() {
    const cache = await caches.open(CACHE);
    if ((await legacyUpgradeNavigationRequests(cache)).length) return false;
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    return true;
}

self.addEventListener('install', (e) => {
    e.waitUntil((async () => {
        // A first install is safe to activate immediately. An update must remain waiting
        // until its caller has prepared the release and explicitly requests activation.
        if (!self.registration.active) {
            await precacheReleaseAssets();
            await self.skipWaiting();
        }
    })());
});

self.addEventListener('activate', (e) => {
    e.waitUntil((async () => {
        // Claim first so the legacy page's existing controllerchange handler can
        // reload immediately. Navigation is a bounded, non-blocking fallback.
        await self.clients.claim();
        scheduleLegacyUpgradeMigration();
        await cleanupOldCachesIfLegacyMigrationComplete();
    })());
});

self.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SKIP_WAITING') {
        e.waitUntil((async () => {
            try {
                await precacheReleaseAssets();
                if (e.data.source !== 'startup-barrier-v327') await queueLegacyUpgradeNavigation(e.source);
                await self.skipWaiting();
            } catch (error) {
                e.source?.postMessage?.({
                    type: 'RELEASE_FAILED',
                    version: CACHE_VERSION,
                    message: '新版资源准备失败，请检查网络后重试'
                });
            }
        })());
    }
    if (e.data && e.data.type === 'GET_VERSION' && e.source && typeof e.source.postMessage === 'function') {
        e.waitUntil((async () => {
            e.source.postMessage({
                type: 'VERSION',
                requestId: e.data.requestId,
                version: CACHE_VERSION,
                precacheReady: await isReleaseCacheReady()
            });
        })());
    }
    if (e.data && e.data.type === 'PREPARE_RELEASE' && e.source && typeof e.source.postMessage === 'function') {
        e.waitUntil((async () => {
            try {
                await precacheReleaseAssets();
                e.source.postMessage({ type: 'RELEASE_READY', requestId: e.data.requestId, version: CACHE_VERSION });
            } catch (error) {
                e.source.postMessage({
                    type: 'RELEASE_FAILED',
                    requestId: e.data.requestId,
                    version: CACHE_VERSION,
                    message: '新版资源准备失败，请检查网络后重试'
                });
            }
        })());
    }
    if (e.data && e.data.type === 'V327_PAGE_READY') {
        e.waitUntil((async () => {
            await acknowledgeV327Page(e.source);
            await cleanupOldCachesIfLegacyMigrationComplete();
            scheduleLegacyUpgradeMigration();
        })());
    }
    if (e.data && e.data.type === 'VOICE_TTS_HOSTS') {
        voiceTtsHosts = new Set((e.data.hosts || []).map(host => String(host || '').toLowerCase()).filter(Boolean));
    }
});

function isVersionedAsset(url) {
    return url.searchParams.has('v');
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
        if (url.searchParams.get('v') !== CACHE_VERSION) {
            event.respondWith(fetch(event.request, { credentials: 'same-origin', cache: 'no-store' }));
            return;
        }
        // Cache-first for hashed assets: avoids slow waterfall on tab switch.
        event.respondWith((async () => {
            const cached = await caches.match(event.request);
            if (cached) return cached;
            try {
                const res = await fetch(event.request, { credentials: 'same-origin', cache: 'no-store' });
                if (res && res.ok) {
                    const clone = res.clone();
                    const cache = await caches.open(CACHE);
                    await cache.put(event.request, clone).catch(() => {});
                }
                return res;
            } catch (err) {
                const fallback = await caches.match(event.request);
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
