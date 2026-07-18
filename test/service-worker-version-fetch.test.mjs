// @ts-nocheck
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDir, '..');
const swSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

function requestUrl(input) {
    return typeof input === 'string' ? input : input.url;
}

function createFetchHarness({
    workerVersion = '326',
    cachedResponse = null,
    hasActiveWorker = false,
    addError = null,
    clients: clientSpecs = [{ id: 'legacy-client', url: 'https://example.test/index.html' }],
    oldCacheNames = [],
    maxRounds = 1000
} = {}) {
    const listeners = new Map();
    const matches = [];
    const opens = [];
    const puts = [];
    const fetches = [];
    const messages = [];
    const adds = [];
    const cacheEntries = new Map();
    const navigations = [];
    const deletedCaches = [];
    const cacheNames = new Set(oldCacheNames);
    const navigationErrors = new Map();
    const navigationHandlers = new Map();
    const events = [];
    let claims = 0;
    let releaseReady = false;
    let skipWaitingCalls = 0;
    const location = new URL('https://example.test/');
    const cacheKey = (request) => requestUrl(request);
    const clients = new Map(clientSpecs.map((spec) => {
        const client = {
            id: spec.id,
            url: spec.url,
            postMessage(value) { messages.push(value); },
            async navigate(url) {
                navigations.push({ clientId: this.id, url });
                const handler = navigationHandlers.get(this.id);
                if (handler) return handler.call(this, url);
                const error = navigationErrors.get(this.id);
                if (error) throw error;
                this.url = url;
                return this;
            }
        };
        if (spec.navigateError) navigationErrors.set(spec.id, spec.navigateError);
        if (spec.navigate) navigationHandlers.set(spec.id, spec.navigate);
        return [client.id, client];
    }));
    const client = clients.values().next().value;
    const caches = {
        async match(request) {
            matches.push(request);
            return cachedResponse?.clone?.() || cachedResponse;
        },
        async open(name) {
            opens.push(name);
            cacheNames.add(name);
            return {
                async add(asset) {
                    events.push(`add:${asset}`);
                    if (addError) throw addError;
                    adds.push(asset);
                },
                async match(request) {
                    if (String(request).includes('__release_ready__') && releaseReady) return new Response('ready', { status: 200 });
                    return cacheEntries.get(cacheKey(request))?.clone?.() || null;
                },
                async put(request, response) {
                    if (String(request).includes('__release_ready__')) releaseReady = true;
                    else {
                        cacheEntries.set(cacheKey(request), response.clone());
                        puts.push({ request, response });
                    }
                },
                async delete(request) { return cacheEntries.delete(cacheKey(request)); },
                async keys() { return [...cacheEntries.keys()].map((url) => new Request(url)); }
            };
        },
        async keys() { return [...cacheNames]; },
        async delete(name) {
            deletedCaches.push(name);
            return cacheNames.delete(name);
        }
    };
    const self = {
        location,
        registration: { active: hasActiveWorker ? {} : null },
        clients: {
            async claim() { claims += 1; },
            async get(id) { return clients.get(id) || null; },
            async matchAll({ type } = {}) {
                const all = [...clients.values()];
                if (type && type !== 'window') return [];
                return all;
            }
        },
        async skipWaiting() { skipWaitingCalls += 1; events.push('skipWaiting'); },
        addEventListener(type, listener) { listeners.set(type, listener); }
    };
    const context = {
        self,
        location,
        caches,
        URL,
        Request,
        Response,
        Set,
        console,
        setTimeout,
        clearTimeout,
        fetch(input, options = {}) {
            fetches.push({ input, options });
            return Promise.resolve(new Response(`network:${requestUrl(input)}`, { status: 200 }));
        }
    };
    context.globalThis = context;
    vm.createContext(context);
    const source = swSource
        .replace(
            /const CACHE = 'training-assistant-v\d+';/,
            `const CACHE = 'training-assistant-v${workerVersion}';`
        )
        .replace(/const LEGACY_NAVIGATION_TIMEOUT_MS = \d+;/, 'const LEGACY_NAVIGATION_TIMEOUT_MS = 5;')
        .replace(/const LEGACY_NAVIGATION_GRACE_MS = \d+;/, 'const LEGACY_NAVIGATION_GRACE_MS = 1;')
        .replace(
            /const LEGACY_NAVIGATION_MAX_ROUNDS = \d+;/,
            `const LEGACY_NAVIGATION_MAX_ROUNDS = ${Number(maxRounds) || 1000};`
        );
    vm.runInContext(source, context, { filename: 'sw.js' });

    return {
        matches,
        opens,
        puts,
        fetches,
        messages,
        adds,
        events,
        navigations,
        deletedCaches,
        cacheNames,
        get claims() { return claims; },
        get skipWaitingCalls() { return skipWaitingCalls; },
        async dispatchInstall() {
            let pending;
            listeners.get('install')({ waitUntil(value) { pending = Promise.resolve(value); } });
            await pending;
        },
        async dispatchActivate() {
            let pending;
            listeners.get('activate')({ waitUntil(value) { pending = Promise.resolve(value); } });
            await pending;
        },
        async dispatchMessage(data, source = client) {
            let pending = Promise.resolve();
            listeners.get('message')({
                data,
                source,
                waitUntil(value) { pending = Promise.resolve(value); }
            });
            await pending;
        },
        client(id) { return clients.get(id) || null; },
        removeClient(id) {
            clients.delete(id);
            navigationErrors.delete(id);
            navigationHandlers.delete(id);
        },
        setNavigateError(id, error) {
            if (error) navigationErrors.set(id, error);
            else navigationErrors.delete(id);
        },
        setNavigateHandler(id, handler) {
            if (handler) navigationHandlers.set(id, handler);
            else navigationHandlers.delete(id);
        },
        async flush() {
            for (let index = 0; index < 32; index += 1) await Promise.resolve();
        },
        async waitForMigration() {
            // Soft refresh waits LEGACY_NAVIGATION_GRACE_MS (patched to 1ms) before hard navigate.
            await new Promise((resolve) => setTimeout(resolve, 40));
            await this.flush();
            await new Promise((resolve) => setTimeout(resolve, 20));
            await this.flush();
        },
        async waitForMaxRoundsExhaustion() {
            // Budget is small in these tests (maxRounds=2). Drive enough timer ticks
            // for scheduleLegacyUpgradeMigration to hit the force re-eval exit.
            for (let index = 0; index < 8; index += 1) {
                await new Promise((resolve) => setTimeout(resolve, 30));
                await this.flush();
            }
        },
        pendingLegacyClientIds() {
            return [...cacheEntries.keys()]
                .filter((url) => url.includes('__legacy_upgrade_navigation__'))
                .map((url) => new URL(url).searchParams.get('client'))
                .sort();
        },
        async dispatch(url) {
            const request = new Request(url);
            let responsePromise;
            listeners.get('fetch')({
                request,
                respondWith(value) { responsePromise = Promise.resolve(value); }
            });
            assert.ok(responsePromise, `fetch handler should respond to ${url}`);
            return { request, response: await responsePromise };
        }
    };
}

test('old worker passes a newer versioned asset straight to network without touching its cache', async () => {
    const harness = createFetchHarness({ workerVersion: '326' });
    const { request, response } = await harness.dispatch('https://example.test/history-view.js?v=334');

    assert.equal(await response.text(), 'network:https://example.test/history-view.js?v=334');
    assert.equal(harness.fetches.length, 1);
    assert.equal(harness.fetches[0].input, request);
    assert.equal(harness.fetches[0].options.cache, 'no-store');
    assert.equal(harness.fetches[0].options.credentials, 'same-origin');
    assert.deepEqual(harness.matches, []);
    assert.deepEqual(harness.opens, []);
    assert.deepEqual(harness.puts, []);
    assert.doesNotMatch(requestUrl(harness.fetches[0].input), /[?&]v=326(?:&|$)/);
});

test('current-version asset keeps cache-first and original request semantics', async () => {
    const harness = createFetchHarness({ workerVersion: '326' });
    const { request, response } = await harness.dispatch('https://example.test/history-view.js?v=326');

    assert.equal(await response.text(), 'network:https://example.test/history-view.js?v=326');
    assert.deepEqual(harness.matches, [request]);
    assert.equal(harness.fetches[0].input, request);
    assert.equal(harness.fetches[0].options.cache, 'no-store');
    assert.deepEqual(harness.opens, ['training-assistant-v326']);
    assert.equal(harness.puts[0].request, request);
});

test('current-version asset returns an exact cache hit', async () => {
    const harness = createFetchHarness({
        workerVersion: '326',
        cachedResponse: new Response('cached-v326', { status: 200 })
    });
    const { request, response } = await harness.dispatch('https://example.test/history-view.js?v=326');

    assert.equal(await response.text(), 'cached-v326');
    assert.deepEqual(harness.matches, [request]);
    assert.deepEqual(harness.fetches, []);
    assert.deepEqual(harness.opens, []);
    assert.deepEqual(harness.puts, []);
});

test('unversioned same-origin requests retain network-first behavior', async () => {
    const harness = createFetchHarness({ workerVersion: '326' });
    const { request, response } = await harness.dispatch('https://example.test/manifest.json');

    assert.equal(await response.text(), 'network:https://example.test/manifest.json');
    assert.equal(harness.fetches[0].input, request);
    assert.deepEqual(harness.matches, []);
    assert.deepEqual(harness.opens, ['training-assistant-v326']);
    assert.equal(harness.puts[0].request, request);
});

test('worker reports its cache version and release readiness through the startup handshake', async () => {
    const harness = createFetchHarness({ workerVersion: '334' });
    await harness.dispatchMessage({ type: 'GET_VERSION', requestId: 'boot-1' });
    assert.deepEqual(JSON.parse(JSON.stringify(harness.messages)), [{ type: 'VERSION', requestId: 'boot-1', version: '334', precacheReady: false }]);
});

test('upgrade install stays waiting and does not request release assets before an explicit update', async () => {
    const harness = createFetchHarness({ workerVersion: '334', hasActiveWorker: true });
    await harness.dispatchInstall();
    assert.equal(harness.skipWaitingCalls, 0);
    assert.equal(harness.adds.length, 0);

    await harness.dispatchMessage({ type: 'PREPARE_RELEASE', requestId: 'prepare-1' });
    assert.ok(harness.adds.includes('build/generated.css?v=334'));
    assert.ok(harness.adds.includes('plan-ui.js?v=334'));
    assert.deepEqual(JSON.parse(JSON.stringify(harness.messages)), [{ type: 'RELEASE_READY', requestId: 'prepare-1', version: '334' }]);
});

test('first install still precaches release assets without forcing a page reload', async () => {
    const harness = createFetchHarness({ workerVersion: '334', hasActiveWorker: false });
    await harness.dispatchInstall();
    assert.equal(harness.skipWaitingCalls, 1);
    assert.ok(harness.adds.includes('build/generated.css?v=334'));
    assert.ok(harness.adds.includes('plan-ui.js?v=334'));
});

test('legacy v326 SKIP_WAITING prepares before activation, then navigates that old client once', async () => {
    const harness = createFetchHarness({ workerVersion: '334', hasActiveWorker: true });
    await harness.dispatchInstall();
    await harness.dispatchMessage({ type: 'SKIP_WAITING' });

    assert.ok(harness.adds.includes('build/generated.css?v=334'));
    assert.ok(harness.adds.includes('plan-ui.js?v=334'));
    assert.equal(harness.skipWaitingCalls, 1);
    assert.equal(harness.events.at(-1), 'skipWaiting');

    await harness.dispatchActivate();
    await harness.waitForMigration();
    assert.equal(harness.claims, 1);
    assert.equal(harness.navigations.length, 1);
    assert.match(harness.navigations[0].url, /__rehab_upgrade=334/);

    await harness.dispatchActivate();
    await harness.waitForMigration();
    assert.equal(harness.navigations.length, 1, 'a persisted legacy marker is deleted before navigation');
});

test('legacy client migrations isolate navigation failures and retain v326 cache until retry succeeds', async () => {
    const harness = createFetchHarness({
        workerVersion: '334',
        hasActiveWorker: true,
        oldCacheNames: ['training-assistant-v326'],
        clients: [
            { id: 'legacy-success', url: 'https://example.test/index.html?tab=one' },
            { id: 'legacy-retry', url: 'https://example.test/index.html?tab=two', navigateError: new Error('navigation failed') }
        ]
    });

    await harness.dispatchMessage({ type: 'SKIP_WAITING' }, harness.client('legacy-success'));
    await harness.dispatchMessage({ type: 'SKIP_WAITING' }, harness.client('legacy-retry'));
    await harness.dispatchActivate();
    await harness.waitForMigration();

    // Auto-retry may attempt the failing client more than once before PAGE_READY.
    const firstPass = harness.navigations.map(({ clientId }) => clientId);
    assert.equal(firstPass.includes('legacy-success'), true);
    assert.equal(firstPass.includes('legacy-retry'), true);
    assert.equal(firstPass.filter((id) => id === 'legacy-success').length, 1);
    // Soft-refresh success no longer drops the marker until PAGE_READY; both clients
    // remain queued after the first migration pass when only hard-nav is attempted.
    assert.deepEqual(harness.pendingLegacyClientIds(), ['legacy-retry', 'legacy-success']);
    assert.equal(harness.claims, 1);
    assert.equal(harness.cacheNames.has('training-assistant-v326'), true);
    assert.match(harness.navigations.find((entry) => entry.clientId === 'legacy-success').url, /[?&]tab=one(?:&|$)/);
    assert.match(harness.navigations.find((entry) => entry.clientId === 'legacy-success').url, /__rehab_upgrade=334/);

    harness.setNavigateError('legacy-retry', null);
    const beforeRetry = harness.navigations.length;
    await harness.dispatchMessage({ type: 'V327_PAGE_READY', version: '334' }, harness.client('legacy-success'));
    await harness.waitForMigration();

    const afterRetry = harness.navigations.slice(beforeRetry).map(({ clientId }) => clientId);
    assert.equal(afterRetry.includes('legacy-retry'), true);
    assert.deepEqual(harness.pendingLegacyClientIds(), ['legacy-retry']);
    // A ready alone must not retire the shared offline cache while B is still live.
    assert.equal(harness.cacheNames.has('training-assistant-v326'), true);
    assert.deepEqual(harness.deletedCaches, []);

    await harness.dispatchMessage({ type: 'V327_PAGE_READY', version: '334' }, harness.client('legacy-retry'));
    await harness.waitForMigration();
    assert.deepEqual(harness.pendingLegacyClientIds(), []);
    assert.equal(harness.cacheNames.has('training-assistant-v326'), false);
    assert.deepEqual(harness.deletedCaches, ['training-assistant-v326']);
});

test('a permanently pending legacy navigation cannot block claim or activation', async () => {
    const never = new Promise(() => {});
    const harness = createFetchHarness({
        workerVersion: '334',
        hasActiveWorker: true,
        oldCacheNames: ['training-assistant-v326'],
        clients: [
            { id: 'legacy-success', url: 'https://example.test/index.html?tab=one' },
            { id: 'legacy-pending', url: 'https://example.test/index.html?tab=two', navigate: () => never }
        ]
    });

    await harness.dispatchMessage({ type: 'SKIP_WAITING' }, harness.client('legacy-success'));
    await harness.dispatchMessage({ type: 'SKIP_WAITING' }, harness.client('legacy-pending'));

    let activated = false;
    const activateDone = harness.dispatchActivate().then(() => { activated = true; });
    // Activate must finish without awaiting client.navigate(). A short timer is enough
    // for claim/requeue microtasks; an indefinitely pending navigate would still hang.
    await Promise.race([
        activateDone,
        new Promise((resolve) => setTimeout(resolve, 40))
    ]);

    assert.equal(activated, true, 'activate must not wait for an indefinitely pending navigate()');
    assert.equal(harness.claims, 1);
    assert.deepEqual(harness.pendingLegacyClientIds().sort(), ["legacy-pending", "legacy-success"]);
    assert.equal(harness.cacheNames.has("training-assistant-v326"), true);

    await harness.waitForMigration();
    const firstPass = harness.navigations.map(({ clientId }) => clientId);
    assert.equal(firstPass.includes('legacy-success'), true);
    assert.equal(firstPass.includes('legacy-pending'), true);
    assert.equal(firstPass.filter((id) => id === 'legacy-success').length, 1);
    // Hard-nav resolve no longer deletes markers; both stay until PAGE_READY/gone.
    assert.deepEqual(harness.pendingLegacyClientIds(), ['legacy-pending', 'legacy-success']);
    assert.equal(harness.cacheNames.has('training-assistant-v326'), true);

    harness.setNavigateHandler('legacy-pending', async function navigate(url) {
        this.url = url;
        return this;
    });
    await harness.dispatchMessage({ type: 'V327_PAGE_READY', version: '334' }, harness.client('legacy-success'));
    await harness.waitForMigration();

    const pendingNavs = harness.navigations.filter((entry) => entry.clientId === 'legacy-pending');
    assert.ok(pendingNavs.length >= 1, 'pending client must eventually receive a hard navigate');
    assert.equal(firstPass.filter((id) => id === 'legacy-success').length, 1);
    assert.deepEqual(harness.pendingLegacyClientIds(), ['legacy-pending']);
    // Hard navigate of B must not retire shared caches before B reports PAGE_READY.
    assert.equal(harness.cacheNames.has('training-assistant-v326'), true);

    await harness.dispatchMessage({ type: 'V327_PAGE_READY', version: '334' }, harness.client('legacy-pending'));
    await harness.waitForMigration();
    assert.deepEqual(harness.pendingLegacyClientIds(), []);
    assert.equal(harness.cacheNames.has('training-assistant-v326'), false);
});

test('a v334 page-ready event acknowledges its queued marker before activation fallback navigation', async () => {
    const harness = createFetchHarness({ workerVersion: '334', hasActiveWorker: true });
    await harness.dispatchMessage({ type: 'SKIP_WAITING' });
    await harness.dispatchMessage({ type: 'V327_PAGE_READY', version: '334' });
    await harness.dispatchActivate();
    await harness.waitForMigration();

    assert.equal(harness.navigations.length, 0);
    assert.deepEqual(harness.pendingLegacyClientIds(), []);
});

test('SKIP_WAITING queues every open window client, not only the source tab', async () => {
    const harness = createFetchHarness({
        workerVersion: '334',
        hasActiveWorker: true,
        clients: [
            { id: 'apply-tab', url: 'https://example.test/index.html?tab=apply' },
            { id: 'sibling-tab', url: 'https://example.test/index.html?tab=sibling' }
        ]
    });

    await harness.dispatchMessage({ type: 'SKIP_WAITING' }, harness.client('apply-tab'));
    await harness.dispatchActivate();
    await harness.waitForMigration();

    assert.deepEqual(
        harness.navigations.map(({ clientId }) => clientId).sort(),
        ['apply-tab', 'sibling-tab']
    );
    assert.match(harness.navigations.find((entry) => entry.clientId === 'sibling-tab').url, /__rehab_upgrade=334/);
    assert.match(harness.navigations.find((entry) => entry.clientId === 'sibling-tab').url, /[?&]tab=sibling(?:&|$)/);
});

test('PAGE_READY without matching version leaves the migration marker intact', async () => {
    const harness = createFetchHarness({
        workerVersion: '334',
        hasActiveWorker: true,
        oldCacheNames: ['training-assistant-v326'],
        clients: [{
            id: 'stale-doc',
            url: 'https://example.test/index.html',
            navigateError: new Error('hold-marker')
        }]
    });
    await harness.dispatchMessage({ type: 'SKIP_WAITING' }, harness.client('stale-doc'));
    await harness.dispatchMessage({ type: 'V327_PAGE_READY', version: '328' }, harness.client('stale-doc'));
    await harness.dispatchMessage({ type: 'V327_PAGE_READY' }, harness.client('stale-doc'));
    await harness.dispatchActivate();
    await harness.waitForMigration();

    // Wrong/missing version must not clear the marker or retire the old offline cache.
    assert.deepEqual(harness.pendingLegacyClientIds(), ['stale-doc']);
    assert.equal(harness.cacheNames.has('training-assistant-v326'), true);
    assert.deepEqual(harness.deletedCaches, []);
});

test('one ready dual-tab client retains legacy cache and sibling marker', async () => {
    const harness = createFetchHarness({
        workerVersion: '334',
        hasActiveWorker: true,
        oldCacheNames: ['training-assistant-v333', 'training-assistant-v334'],
        clients: [
            {
                id: 'client-a',
                url: 'https://example.test/index.html?tab=a',
                navigateError: new Error('hold-marker')
            },
            {
                id: 'client-b',
                url: 'https://example.test/index.html?tab=b',
                navigateError: new Error('hold-marker')
            }
        ]
    });

    await harness.dispatchMessage({ type: 'SKIP_WAITING' }, harness.client('client-a'));
    await harness.dispatchActivate();
    await harness.waitForMigration();

    assert.deepEqual(harness.pendingLegacyClientIds(), ['client-a', 'client-b']);
    await harness.dispatchMessage({ type: 'V327_PAGE_READY', version: '334' }, harness.client('client-a'));
    await harness.flush();

    assert.deepEqual(harness.pendingLegacyClientIds(), ['client-b']);
    assert.equal(harness.cacheNames.has('training-assistant-v333'), true);
    assert.equal(harness.cacheNames.has('training-assistant-v334'), true);
    assert.deepEqual(harness.deletedCaches, []);
});

test('all dual-tab clients ready delete legacy caches and markers', async () => {
    const harness = createFetchHarness({
        workerVersion: '334',
        hasActiveWorker: true,
        oldCacheNames: ['training-assistant-v333', 'training-assistant-v334'],
        clients: [
            {
                id: 'client-a',
                url: 'https://example.test/index.html?tab=a',
                navigateError: new Error('hold-marker')
            },
            {
                id: 'client-b',
                url: 'https://example.test/index.html?tab=b',
                navigateError: new Error('hold-marker')
            }
        ]
    });

    await harness.dispatchMessage({ type: 'SKIP_WAITING' }, harness.client('client-a'));
    await harness.dispatchActivate();
    await harness.waitForMigration();

    await harness.dispatchMessage({ type: 'V327_PAGE_READY', version: '334' }, harness.client('client-a'));
    await harness.dispatchMessage({ type: 'V327_PAGE_READY', version: '334' }, harness.client('client-b'));
    await harness.flush();

    assert.deepEqual(harness.pendingLegacyClientIds(), []);
    assert.equal(harness.cacheNames.has('training-assistant-v333'), false);
    assert.equal(harness.cacheNames.has('training-assistant-v334'), true);
    assert.deepEqual(harness.deletedCaches, ['training-assistant-v333']);
});

test('gone dual-tab sibling allows legacy cache cleanup after ready peer', async () => {
    const harness = createFetchHarness({
        workerVersion: '334',
        hasActiveWorker: true,
        oldCacheNames: ['training-assistant-v333', 'training-assistant-v334'],
        clients: [
            {
                id: 'client-a',
                url: 'https://example.test/index.html?tab=a',
                navigateError: new Error('hold-marker')
            },
            {
                id: 'client-b',
                url: 'https://example.test/index.html?tab=b',
                navigateError: new Error('hold-marker')
            }
        ]
    });

    await harness.dispatchMessage({ type: 'SKIP_WAITING' }, harness.client('client-a'));
    await harness.dispatchActivate();
    await harness.waitForMigration();

    await harness.dispatchMessage({ type: 'V327_PAGE_READY', version: '334' }, harness.client('client-a'));
    await harness.flush();
    assert.equal(harness.cacheNames.has('training-assistant-v333'), true);

    harness.removeClient('client-b');
    await harness.dispatchMessage({ type: 'EVALUATE_CACHE_CLEANUP', version: '334' }, harness.client('client-a'));
    await harness.flush();

    assert.deepEqual(harness.pendingLegacyClientIds(), []);
    assert.equal(harness.cacheNames.has('training-assistant-v333'), false);
    assert.equal(harness.cacheNames.has('training-assistant-v334'), true);
    assert.deepEqual(harness.deletedCaches, ['training-assistant-v333']);
});

test('wrong-version PAGE_READY from one dual-tab client does not clear its marker or caches', async () => {
    const harness = createFetchHarness({
        workerVersion: '334',
        hasActiveWorker: true,
        oldCacheNames: ['training-assistant-v333', 'training-assistant-v334'],
        clients: [
            {
                id: 'client-a',
                url: 'https://example.test/index.html?tab=a',
                navigateError: new Error('hold-marker')
            },
            {
                id: 'client-b',
                url: 'https://example.test/index.html?tab=b',
                navigateError: new Error('hold-marker')
            }
        ]
    });

    await harness.dispatchMessage({ type: 'SKIP_WAITING' }, harness.client('client-a'));
    await harness.dispatchActivate();
    await harness.waitForMigration();

    await harness.dispatchMessage({ type: 'V327_PAGE_READY', version: '334' }, harness.client('client-a'));
    await harness.dispatchMessage({ type: 'V327_PAGE_READY', version: '333' }, harness.client('client-b'));
    await harness.dispatchMessage({ type: 'V327_PAGE_READY' }, harness.client('client-b'));
    await harness.flush();

    assert.deepEqual(harness.pendingLegacyClientIds(), ['client-b']);
    assert.equal(harness.cacheNames.has('training-assistant-v333'), true);
    assert.deepEqual(harness.deletedCaches, []);
});

test('concurrent cleanup evaluations stay idempotent and safe', async () => {
    const harness = createFetchHarness({
        workerVersion: '334',
        hasActiveWorker: true,
        oldCacheNames: ['training-assistant-v333', 'training-assistant-v334'],
        clients: [
            {
                id: 'client-a',
                url: 'https://example.test/index.html?tab=a',
                navigateError: new Error('hold-marker')
            },
            {
                id: 'client-b',
                url: 'https://example.test/index.html?tab=b',
                navigateError: new Error('hold-marker')
            }
        ]
    });

    await harness.dispatchMessage({ type: 'SKIP_WAITING' }, harness.client('client-a'));
    await harness.dispatchActivate();
    await harness.waitForMigration();

    await Promise.all([
        harness.dispatchMessage({ type: 'V327_PAGE_READY', version: '334' }, harness.client('client-a')),
        harness.dispatchMessage({ type: 'EVALUATE_CACHE_CLEANUP', version: '334' }, harness.client('client-a')),
        harness.dispatchMessage({ type: 'EVALUATE_CACHE_CLEANUP', version: '334' }, harness.client('client-b'))
    ]);
    await harness.flush();

    assert.deepEqual(harness.pendingLegacyClientIds(), ['client-b']);
    assert.equal(harness.cacheNames.has('training-assistant-v333'), true);

    await Promise.all([
        harness.dispatchMessage({ type: 'V327_PAGE_READY', version: '334' }, harness.client('client-b')),
        harness.dispatchMessage({ type: 'EVALUATE_CACHE_CLEANUP', version: '334' }, harness.client('client-a')),
        harness.dispatchMessage({ type: 'EVALUATE_CACHE_CLEANUP', version: '334' }, harness.client('client-b'))
    ]);
    await harness.flush();

    assert.deepEqual(harness.pendingLegacyClientIds(), []);
    assert.equal(harness.cacheNames.has('training-assistant-v333'), false);
    assert.equal(harness.cacheNames.has('training-assistant-v334'), true);
    assert.deepEqual(harness.deletedCaches, ['training-assistant-v333']);
});

test('max migration rounds with live non-ready sibling keeps marker and legacy cache', async () => {
    const harness = createFetchHarness({
        workerVersion: '334',
        hasActiveWorker: true,
        maxRounds: 2,
        oldCacheNames: ['training-assistant-v333', 'training-assistant-v334'],
        clients: [
            {
                id: 'client-a',
                url: 'https://example.test/index.html?tab=a',
                navigateError: new Error('hold-marker')
            },
            {
                id: 'client-b',
                url: 'https://example.test/index.html?tab=b',
                navigateError: new Error('hold-marker')
            }
        ]
    });

    await harness.dispatchMessage({ type: 'SKIP_WAITING' }, harness.client('client-a'));
    await harness.dispatchActivate();
    await harness.waitForMigration();
    await harness.dispatchMessage({ type: 'V327_PAGE_READY', version: '334' }, harness.client('client-a'));
    await harness.flush();

    await harness.waitForMaxRoundsExhaustion();
    // force re-eval after budget must NOT treat live non-ready B as gone.
    assert.deepEqual(harness.pendingLegacyClientIds(), ['client-b']);
    assert.equal(harness.cacheNames.has('training-assistant-v333'), true);
    assert.equal(harness.cacheNames.has('training-assistant-v334'), true);
    assert.deepEqual(harness.deletedCaches, []);

    // Explicit force-style re-eval (max-round path / EVALUATE_CACHE_CLEANUP) still retains.
    await harness.dispatchMessage({ type: 'EVALUATE_CACHE_CLEANUP', version: '334' }, harness.client('client-a'));
    await harness.flush();
    assert.deepEqual(harness.pendingLegacyClientIds(), ['client-b']);
    assert.equal(harness.cacheNames.has('training-assistant-v333'), true);
    assert.deepEqual(harness.deletedCaches, []);
});

test('max migration rounds then sibling PAGE_READY retires only legacy cache', async () => {
    const harness = createFetchHarness({
        workerVersion: '334',
        hasActiveWorker: true,
        maxRounds: 2,
        oldCacheNames: ['training-assistant-v333', 'training-assistant-v334'],
        clients: [
            {
                id: 'client-a',
                url: 'https://example.test/index.html?tab=a',
                navigateError: new Error('hold-marker')
            },
            {
                id: 'client-b',
                url: 'https://example.test/index.html?tab=b',
                navigateError: new Error('hold-marker')
            }
        ]
    });

    await harness.dispatchMessage({ type: 'SKIP_WAITING' }, harness.client('client-a'));
    await harness.dispatchActivate();
    await harness.waitForMigration();
    await harness.dispatchMessage({ type: 'V327_PAGE_READY', version: '334' }, harness.client('client-a'));
    await harness.flush();
    await harness.waitForMaxRoundsExhaustion();

    assert.equal(harness.cacheNames.has('training-assistant-v333'), true);
    assert.deepEqual(harness.pendingLegacyClientIds(), ['client-b']);

    await harness.dispatchMessage({ type: 'V327_PAGE_READY', version: '334' }, harness.client('client-b'));
    await harness.flush();

    assert.deepEqual(harness.pendingLegacyClientIds(), []);
    assert.equal(harness.cacheNames.has('training-assistant-v333'), false);
    assert.equal(harness.cacheNames.has('training-assistant-v334'), true);
    assert.deepEqual(harness.deletedCaches, ['training-assistant-v333']);
});

test('max migration rounds then sibling gone allows legacy cache cleanup', async () => {
    const harness = createFetchHarness({
        workerVersion: '334',
        hasActiveWorker: true,
        maxRounds: 2,
        oldCacheNames: ['training-assistant-v333', 'training-assistant-v334'],
        clients: [
            {
                id: 'client-a',
                url: 'https://example.test/index.html?tab=a',
                navigateError: new Error('hold-marker')
            },
            {
                id: 'client-b',
                url: 'https://example.test/index.html?tab=b',
                navigateError: new Error('hold-marker')
            }
        ]
    });

    await harness.dispatchMessage({ type: 'SKIP_WAITING' }, harness.client('client-a'));
    await harness.dispatchActivate();
    await harness.waitForMigration();
    await harness.dispatchMessage({ type: 'V327_PAGE_READY', version: '334' }, harness.client('client-a'));
    await harness.flush();
    await harness.waitForMaxRoundsExhaustion();

    assert.equal(harness.cacheNames.has('training-assistant-v333'), true);
    assert.deepEqual(harness.pendingLegacyClientIds(), ['client-b']);

    harness.removeClient('client-b');
    await harness.dispatchMessage({ type: 'EVALUATE_CACHE_CLEANUP', version: '334' }, harness.client('client-a'));
    await harness.flush();

    assert.deepEqual(harness.pendingLegacyClientIds(), []);
    assert.equal(harness.cacheNames.has('training-assistant-v333'), false);
    assert.equal(harness.cacheNames.has('training-assistant-v334'), true);
    assert.deepEqual(harness.deletedCaches, ['training-assistant-v333']);
});

test('concurrent force-style cleanup while sibling live non-ready never deletes early', async () => {
    const harness = createFetchHarness({
        workerVersion: '334',
        hasActiveWorker: true,
        maxRounds: 2,
        oldCacheNames: ['training-assistant-v333', 'training-assistant-v334'],
        clients: [
            {
                id: 'client-a',
                url: 'https://example.test/index.html?tab=a',
                navigateError: new Error('hold-marker')
            },
            {
                id: 'client-b',
                url: 'https://example.test/index.html?tab=b',
                navigateError: new Error('hold-marker')
            }
        ]
    });

    await harness.dispatchMessage({ type: 'SKIP_WAITING' }, harness.client('client-a'));
    await harness.dispatchActivate();
    await harness.waitForMigration();
    await harness.dispatchMessage({ type: 'V327_PAGE_READY', version: '334' }, harness.client('client-a'));
    await harness.flush();

    await Promise.all([
        harness.dispatchMessage({ type: 'EVALUATE_CACHE_CLEANUP', version: '334' }, harness.client('client-a')),
        harness.dispatchMessage({ type: 'EVALUATE_CACHE_CLEANUP', version: '334' }, harness.client('client-a')),
        harness.dispatchMessage({ type: 'EVALUATE_CACHE_CLEANUP', version: '334' }, harness.client('client-b'))
    ]);
    await harness.waitForMaxRoundsExhaustion();
    await Promise.all([
        harness.dispatchMessage({ type: 'EVALUATE_CACHE_CLEANUP', version: '334' }, harness.client('client-a')),
        harness.dispatchMessage({ type: 'EVALUATE_CACHE_CLEANUP', version: '334' }, harness.client('client-b'))
    ]);
    await harness.flush();

    assert.deepEqual(harness.pendingLegacyClientIds(), ['client-b']);
    assert.equal(harness.cacheNames.has('training-assistant-v333'), true);
    assert.equal(harness.cacheNames.has('training-assistant-v334'), true);
    assert.deepEqual(harness.deletedCaches, []);
});

test('legacy activation does not leave v326 half-upgraded when release preparation fails', async () => {
    const harness = createFetchHarness({ workerVersion: '334', hasActiveWorker: true, addError: new Error('offline') });
    await harness.dispatchMessage({ type: 'SKIP_WAITING' });

    assert.equal(harness.skipWaitingCalls, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(harness.messages)), [{
        type: 'RELEASE_FAILED',
        version: '334',
        message: '新版资源准备失败，请检查网络后重试'
    }]);
});
