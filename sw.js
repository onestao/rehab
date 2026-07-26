// @ts-nocheck
const CACHE = 'training-assistant-v374';
const CACHE_ASSET_REVISION = 'd8a093226133589176e21c906e010edb892dc8474b464801710c586e7031c5e5';
const CACHE_VERSION = CACHE.replace(/^training-assistant-v/, '');
const ASSETS = [
    'index.html',
    'build/generated.css?v=374',
    'assets/app-icon.svg',
    'assets/material-symbols-rounded.woff2',
    'assets/screenshots/android-today.svg',
    'assets/screenshots/android-workout.svg',
    'pwa-support.js?v=374',
    // Lazy CSS: loaded on profile or records/training entry, still precached for offline use.
    'css-src/42-health-profile.css?v=374',
    'theme.js?v=374',
    'haptics.js?v=374',
    'fooddb.js?v=374',
    'food-ai-normalizer-pure.js?v=374',
    'render-safe.js?v=374',
    'nav-stack.js?v=374',
    'app-route.js?v=374',
    'data-utils-pure.js?v=374',
    'action-taxonomy-pure.js?v=374',
    'action-identity.js?v=374',
    'data-utils.js?v=374',
    'data-records.js?v=374',
    'data-schema.js?v=374',
    'storage/idb.js?v=374',
    'storage/idb-collections.js?v=374',
    'storage/idb-advice-collections.js?v=374',
    'storage/migrate.js?v=374',
    'advice-virtual-list.js?v=374',
    'data-store.js?v=374',
    'data-store-deferred.js?v=374',
    'data-ui-core.js?v=374',
    'data-ui-state.js?v=374',
    'data-views.js?v=374',
    'data.js?v=374',
    'health-summary-pure.js?v=374',
    // Today essential: PAGE_DEPS.today requires history-view (FIND-05).
    'history-view.js?v=374',
    'today-view-core.js?v=374',
    'ai-model-catalog-pure.mjs?v=374',
    'ai-routing-pure.mjs?v=374',
    'ai-json-pure.mjs?v=374',
    'ai-routing.js?v=374',
    'ai-model-visual.js?v=374',
    'ai-task-settings.js?v=374',
    'ai-provider-manager.js?v=374',
    'report-version-pure.js?v=374',
    'plan-chains.js?v=374',
    'plan-progression.js?v=374',
    'rehab-policy.js?v=374',
    'plan-store.js?v=374',
    'plan-feedback.js?v=374',
    'plan-cooldown.js?v=374',
    'plan-weekly.js?v=374',
    'plan-equipment.js?v=374',
    'plan-ui.js?v=374',
    'rehab-progression-pure.js?v=374',
    'plan-store-pure.js?v=374',
    'backup-import-pure.js?v=374',
    'backup-ring-pure.js?v=374',
    'backup.js?v=374',
    'sync-ui.js?v=374',
    'sync-adapters.js?v=374',
    'sync.js?v=374',
    'sync-pure.js?v=374',
    'sync-status.js?v=374',
    'workout-system.js?v=374',
    'workout-wakelock.js?v=374',
    'workout-media-session.js?v=374',
    'workout-pip.js?v=374',
    'workout-core.js?v=374',
    'workout-cardio-pure.js?v=374',
    'workout-cardio.js?v=374',
    'workout-engine.js?v=374',
    'workout-state.js?v=374',
    'app-update.js?v=374',
    'sheet-drag.js?v=374',
    'm3e-ripple.js?v=374',
    'toast.js?v=374',
    'error-bus.js?v=374',
    'i18n.js?v=374',
    'a11y-focus-trap.js?v=374',
    'i18n/zh-CN.json?v=374',
    'i18n/en-US.json?v=374',
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
const LEGACY_NAVIGATION_MAX_ROUNDS = 12;
let releasePrecachePromise = null;
let legacyMigrationPromise = null;
let legacyMigrationTimer = null;
let legacyMigrationRounds = 0;
let cleanupOldCachesPromise = null;
const legacyNavigationAttempts = new Map();
const pageReadyClientIds = new Set();
/** Clients with update-sensitive work — hard navigate must not interrupt them. */
const clientDeferClientIds = new Set();

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

async function queueLegacyUpgradeNavigationForAllClients() {
    // Every open tab must migrate independently. Queuing only e.source leaves
    // sibling tabs on the old document while the new worker/cache are already active.
    const clientsApi = self.clients;
    if (!clientsApi || typeof clientsApi.matchAll !== 'function') return;
    const windows = await clientsApi.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all((windows || []).map((client) => queueLegacyUpgradeNavigation(client)));
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
    if (clientId) pageReadyClientIds.add(clientId);
    if (!clientId) return;
    const cache = await caches.open(CACHE);
    await cache.delete(legacyUpgradeNavigationRequest(clientId));
}

async function pruneStaleLegacyUpgradeMarkers() {
    const cache = await caches.open(CACHE);
    const queued = await legacyUpgradeNavigationRequests(cache);
    await Promise.all(queued.map(async (request) => {
        const clientId = new URL(request.url).searchParams.get('client');
        if (!clientId) {
            await cache.delete(request);
            return;
        }
        const client = await self.clients.get(clientId);
        if (!client) {
            await cache.delete(request);
            return;
        }
        // A live client that already reported PAGE_READY for this release no longer
        // needs a forced navigate (typical after controllerchange reload changes id).
        if (pageReadyClientIds.has(clientId)) {
            await cache.delete(request);
        }
    }));
}

async function clearAllLegacyUpgradeMarkers() {
    const cache = await caches.open(CACHE);
    const queued = await legacyUpgradeNavigationRequests(cache);
    await Promise.all(queued.map((request) => cache.delete(request)));
}

async function allLiveClientsPageReady() {
    const clientsApi = self.clients;
    if (!clientsApi || typeof clientsApi.matchAll !== 'function') return false;
    const windows = await clientsApi.matchAll({ type: 'window', includeUncontrolled: true });
    if (!windows || !windows.length) return false;
    return windows.every((client) => pageReadyClientIds.has(String(client.id || '')));
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

        // Skip clients that already paint the current release (apply-tab controllerchange
        // reload). Keep the marker until PAGE_READY so a half-upgraded tab is retried.
        try {
            const currentUrl = new URL(client.url || '');
            if (currentUrl.searchParams.get('__rehab_upgrade') === CACHE_VERSION) {
                return 'already-upgrading';
            }
        } catch {}

        if (pageReadyClientIds.has(clientId)) {
            await cache.delete(request);
            return 'already-ready';
        }

        // Prefer soft refresh. Controlled legacy pages (v326+) already reload once on
        // controllerchange; a simultaneous client.navigate produced the dual-tab nav=2
        // mixed-count failure. Soft-notify first, hard-navigate only if the client is
        // still live without PAGE_READY after the grace window.
        notifyLegacyRefreshRequired(client);

        let liveUrl = '';
        try { liveUrl = String(client.url || ''); } catch { liveUrl = ''; }
        const fallbackUrl = await response.text();
        const candidate = liveUrl || fallbackUrl;
        const target = legacyUpgradeUrl(candidate);

        await new Promise((resolve) => setTimeout(resolve, LEGACY_NAVIGATION_GRACE_MS));

        if (pageReadyClientIds.has(clientId)) {
            await cache.delete(request);
            return 'soft-ready';
        }
        // Active training / drafts: never hard-navigate this tab. Keep marker + soft notify
        // so it upgrades only after the client clears deferral (session end / save).
        if (clientDeferClientIds.has(clientId)) {
            const stillDeferred = await self.clients.get(clientId);
            if (stillDeferred) notifyLegacyRefreshRequired(stillDeferred);
            return 'deferred-for-session';
        }
        const stillAfterGrace = await self.clients.get(clientId);
        if (!stillAfterGrace || typeof stillAfterGrace.navigate !== 'function') {
            await cache.delete(request);
            return 'soft-gone';
        }
        try {
            const stillUrl = new URL(stillAfterGrace.url || '');
            if (stillUrl.searchParams.get('__rehab_upgrade') === CACHE_VERSION) {
                return 'already-upgrading';
            }
        } catch {}

        let timeoutId = null;
        const navigation = Promise.resolve()
            .then(() => stillAfterGrace.navigate(target))
            .then(async (navigated) => {
                if (timeoutId !== null) clearTimeout(timeoutId);
                // Keep the marker until PAGE_READY (or client disappearance). Deleting it
                // on navigate resolve races dual-tab cache cleanup: the peer can appear
                // "marker-free" while its replacement document is still booting.
                if (pageReadyClientIds.has(clientId)) {
                    await cache.delete(request);
                    return navigated === null ? 'navigated-null-ready' : 'resolved-ready';
                }
                return navigated === null ? 'navigated-null' : 'resolved';
            }, (error) => {
                if (timeoutId !== null) clearTimeout(timeoutId);
                console.warn('[sw] legacy client navigation will retry', clientId, error && error.message);
                notifyLegacyRefreshRequired(stillAfterGrace);
                return 'rejected';
            });
        const timeout = new Promise((resolve) => {
            timeoutId = setTimeout(() => {
                void (async () => {
                    const still = await self.clients.get(clientId);
                    if (!still) {
                        await cache.delete(request);
                        resolve('timeout-gone');
                        return;
                    }
                    if (pageReadyClientIds.has(clientId)) {
                        await cache.delete(request);
                        resolve('timeout-ready');
                        return;
                    }
                    notifyLegacyRefreshRequired(still);
                    resolve('timeout');
                })();
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

function scheduleLegacyUpgradeMigration(delayMs = LEGACY_NAVIGATION_GRACE_MS) {
    if (legacyMigrationTimer !== null) return;
    if (legacyMigrationRounds >= LEGACY_NAVIGATION_MAX_ROUNDS) return;
    legacyMigrationTimer = setTimeout(() => {
        legacyMigrationTimer = null;
        legacyMigrationRounds += 1;
        void (async () => {
            try {
                await pruneStaleLegacyUpgradeMarkers();
                if (await allLiveClientsPageReady()) {
                    await clearAllLegacyUpgradeMarkers();
                    await cleanupOldCachesIfLegacyMigrationComplete();
                    return;
                }
                await migrateLegacyUpgradeClients();
                await pruneStaleLegacyUpgradeMarkers();
                if (await allLiveClientsPageReady()) {
                    await clearAllLegacyUpgradeMarkers();
                }
                const cleaned = await cleanupOldCachesIfLegacyMigrationComplete();
                if (cleaned) return;
                if (legacyMigrationRounds >= LEGACY_NAVIGATION_MAX_ROUNDS) {
                    // Stop auto-navigation after the budget. force only re-evaluates and
                    // drops markers for clients that already disappeared — live non-ready
                    // tabs keep their marker + legacy cache until PAGE_READY, gone, or a
                    // later explicit evaluation (no infinite polling, no forced delete).
                    await cleanupOldCachesIfLegacyMigrationComplete({ force: true });
                    return;
                }
                scheduleLegacyUpgradeMigration(Math.max(LEGACY_NAVIGATION_TIMEOUT_MS, LEGACY_NAVIGATION_GRACE_MS));
            } catch (error) {
                console.warn('[sw] legacy migration failed', error && error.message);
                if (legacyMigrationRounds < LEGACY_NAVIGATION_MAX_ROUNDS) {
                    scheduleLegacyUpgradeMigration(Math.max(LEGACY_NAVIGATION_TIMEOUT_MS, LEGACY_NAVIGATION_GRACE_MS));
                }
            }
        })();
    }, Math.max(0, Number(delayMs) || 0));
}

function isLegacyTrainingCache(name) {
    return name !== CACHE && String(name || '').startsWith('training-assistant-');
}

async function deleteLegacyTrainingCaches() {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => isLegacyTrainingCache(key)).map((key) => caches.delete(key)));
}

async function cleanupOldCachesIfLegacyMigrationComplete(options = {}) {
    // Single-flight: concurrent PAGE_READY / activate / schedule paths must share one
    // evaluation so one call cannot delete while another still sees live markers.
    //
    // force=true is an idempotent re-evaluation: re-enumerate live clients and drop
    // markers for clients that already disappeared (or already reported PAGE_READY).
    // It never overrides live non-ready safety — old caches stay while any live
    // window is mid-migration.
    if (cleanupOldCachesPromise) return cleanupOldCachesPromise;
    cleanupOldCachesPromise = (async () => {
        // force is accepted for API compatibility (max-round / explicit re-eval) but
        // intentionally unused as a safety bypass: live readiness always wins.
        void options;
        await pruneStaleLegacyUpgradeMarkers();
        const cache = await caches.open(CACHE);
        const clientsApi = self.clients;
        const windows = (clientsApi && typeof clientsApi.matchAll === 'function')
            ? await clientsApi.matchAll({ type: 'window', includeUncontrolled: true })
            : [];
        const liveIds = new Set((windows || []).map((client) => String(client.id || '')).filter(Boolean));
        const queued = await legacyUpgradeNavigationRequests(cache);
        let liveMarkers = 0;
        await Promise.all(queued.map(async (request) => {
            const clientId = new URL(request.url).searchParams.get('client');
            // Drop markers for gone clients, ready clients, or malformed entries.
            if (!clientId || !liveIds.has(clientId) || pageReadyClientIds.has(clientId)) {
                await cache.delete(request);
                return;
            }
            liveMarkers += 1;
        }));

        // Live non-ready migration markers are authoritative: a sibling tab still
        // mid-migration must keep the previous training-assistant cache offline.
        if (liveMarkers > 0) return false;

        // Soft-reload races can drop the old clientId/marker before the replacement
        // document posts PAGE_READY. While any live window is not ready for this
        // release, retain legacy caches.
        if (windows && windows.length) {
            const allReady = windows.every((client) => pageReadyClientIds.has(String(client.id || '')));
            if (!allReady) return false;
        }

        if (await allLiveClientsPageReady() || !windows || !windows.length) {
            await clearAllLegacyUpgradeMarkers();
        }
        if ((await legacyUpgradeNavigationRequests(cache)).length) return false;
        await deleteLegacyTrainingCaches();
        return true;
    })().finally(() => {
        cleanupOldCachesPromise = null;
    });
    return cleanupOldCachesPromise;
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
        // Claim first so pages can observe the new controller. Re-queue every
        // window client after claim (waiting-worker matchAll can miss siblings).
        // Only schedule navigation after requeue settles; never await navigate().
        await self.clients.claim();
        const keys = await caches.keys();
        const hasLegacyCaches = keys.some((key) => key !== CACHE && String(key).startsWith('training-assistant-v'));
        const cache = await caches.open(CACHE);
        const alreadyQueued = await legacyUpgradeNavigationRequests(cache);
        if (hasLegacyCaches || alreadyQueued.length) {
            try {
                await queueLegacyUpgradeNavigationForAllClients();
            } catch (error) {
                console.warn('[sw] legacy requeue failed', error && error.message);
            }
            // Immediate pass for sibling tabs; grace pass covers apply-tab reload races.
            scheduleLegacyUpgradeMigration(0);
        }
        // Cleanup only removes old caches when no markers remain; never waits on navigate.
        await cleanupOldCachesIfLegacyMigrationComplete();
    })());
});

self.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SKIP_WAITING') {
        e.waitUntil((async () => {
            try {
                await precacheReleaseAssets();
                // script-url-normalize only promotes the versioned registration URL after the
                // release is already active; do not re-queue legacy navigations for that path.
                if (e.data.source !== 'startup-barrier-v327' && e.data.source !== 'script-url-normalize') {
                    legacyMigrationRounds = 0;
                    await queueLegacyUpgradeNavigationForAllClients();
                    // Source may be missing from matchAll in some harnesses; keep it queued.
                    await queueLegacyUpgradeNavigation(e.source);
                }
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
            // Only the current release may clear a migration marker. An old
            // document acknowledging readiness would drop a sibling tab's
            // pending navigate and leave a mixed worker/document state.
            if (String(e.data.version || '') !== CACHE_VERSION) {
                scheduleLegacyUpgradeMigration(0);
                return;
            }
            const readyId = String(e.source?.id || '');
            if (readyId) clientDeferClientIds.delete(readyId);
            await acknowledgeV327Page(e.source);
            // Ready only clears this client's marker. Old caches stay until every
            // live client is ready (or gone) — never on the first PAGE_READY alone.
            await cleanupOldCachesIfLegacyMigrationComplete();
            scheduleLegacyUpgradeMigration(0);
        })());
    }
    if (e.data && (e.data.type === 'UPDATE_DEFER_FOR_CLIENT' || e.data.type === 'UPDATE_DEFER_FOR_SESSION')) {
        e.waitUntil((async () => {
            const clientId = String(e.source?.id || '');
            if (!clientId) return;
            clientDeferClientIds.add(clientId);
            // Soft-notify only; do not hard-navigate while deferred.
            try {
                const client = await self.clients.get(clientId);
                if (client) notifyLegacyRefreshRequired(client);
            } catch {}
        })());
    }
    if (e.data && (e.data.type === 'UPDATE_CLIENT_CLEAR' || e.data.type === 'UPDATE_SESSION_CLEAR')) {
        e.waitUntil((async () => {
            const clientId = String(e.source?.id || '');
            if (!clientId) return;
            clientDeferClientIds.delete(clientId);
            // Deferral ended — re-evaluate pending legacy migrations for this client.
            scheduleLegacyUpgradeMigration(0);
        })());
    }
    if (e.data && e.data.type === 'EVALUATE_CACHE_CLEANUP') {
        e.waitUntil((async () => {
            if (String(e.data.version || '') !== CACHE_VERSION) return;
            await cleanupOldCachesIfLegacyMigrationComplete();
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
