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
const cacheVersion = swSource.match(/const CACHE = 'training-assistant-v([^']+)'/)?.[1];

function createHarness() {
    const listeners = new Map();
    const cacheEntries = new Map();
    const navigations = [];
    const location = new URL('https://example.test/');
    const cacheKey = (request) => typeof request === 'string' ? request : request.url;
    const clients = new Map(['client-a', 'client-b'].map((id) => {
        const client = {
            id,
            url: `https://example.test/index.html?tab=${id}`,
            postMessage() {},
            async navigate(url) {
                navigations.push(this.id);
                this.url = url;
                return this;
            }
        };
        return [id, client];
    }));
    const cache = {
        async add() {},
        async match(request) {
            return cacheEntries.get(cacheKey(request))?.clone() || null;
        },
        async put(request, response) {
            cacheEntries.set(cacheKey(request), response.clone());
        },
        async delete(request) {
            return cacheEntries.delete(cacheKey(request));
        },
        async keys() {
            return [...cacheEntries.keys()].map((url) => new Request(url));
        }
    };
    const caches = {
        async match(request) { return cache.match(request); },
        async open() { return cache; },
        async keys() { return []; },
        async delete() { return false; }
    };
    const self = {
        location,
        registration: { active: {}, scope: location.href },
        clients: {
            async claim() {},
            async get(id) { return clients.get(id) || null; },
            async matchAll() { return [...clients.values()]; }
        },
        async skipWaiting() {},
        addEventListener(type, listener) { listeners.set(type, listener); }
    };
    const context = {
        self,
        location,
        caches,
        URL,
        Request,
        Response,
        console,
        setTimeout,
        clearTimeout,
        fetch: async () => new Response('network')
    };
    context.globalThis = context;
    vm.createContext(context);
    const executableSource = swSource
        .replace(/const LEGACY_NAVIGATION_TIMEOUT_MS = \d+;/, 'const LEGACY_NAVIGATION_TIMEOUT_MS = 5;')
        .replace(/const LEGACY_NAVIGATION_GRACE_MS = \d+;/, 'const LEGACY_NAVIGATION_GRACE_MS = 0;')
        .replace(/const LEGACY_NAVIGATION_MAX_ROUNDS = \d+;/, 'const LEGACY_NAVIGATION_MAX_ROUNDS = 0;');
    vm.runInContext(executableSource, context, { filename: 'sw.js' });

    return {
        navigations,
        client(id) { return clients.get(id); },
        isDeferred(id) {
            return vm.runInContext(`clientDeferClientIds.has(${JSON.stringify(id)})`, context);
        },
        async dispatchMessage(data, sourceId = 'client-a') {
            const pending = [];
            listeners.get('message')({
                data,
                source: sourceId ? clients.get(sourceId) : undefined,
                waitUntil(value) { pending.push(Promise.resolve(value)); }
            });
            await Promise.all(pending);
        },
        async queue(sourceId) {
            context.testClient = clients.get(sourceId);
            await vm.runInContext('queueLegacyUpgradeNavigation(testClient)', context);
            delete context.testClient;
        },
        async migrate() {
            await vm.runInContext('navigateLegacyUpgradeClients()', context);
        }
    };
}

test('client defer blocks only that client and clear re-enables its hard navigation', async () => {
    const harness = createHarness();
    await harness.queue('client-a');
    await harness.queue('client-b');

    await harness.dispatchMessage({ type: 'UPDATE_DEFER_FOR_CLIENT', version: cacheVersion }, 'client-a');
    await harness.migrate();
    assert.deepEqual(harness.navigations, ['client-b']);

    await harness.dispatchMessage({ type: 'UPDATE_CLIENT_CLEAR', version: cacheVersion }, 'client-a');
    await harness.migrate();
    assert.deepEqual(harness.navigations, ['client-b', 'client-a']);
});

test('old-version clients can defer and clear themselves without mutating a sibling', async () => {
    const harness = createHarness();

    await harness.dispatchMessage({
        type: 'UPDATE_DEFER_FOR_CLIENT',
        version: 'old-release',
        clientId: 'client-a'
    }, 'client-b');
    assert.equal(harness.isDeferred('client-a'), false);
    assert.equal(harness.isDeferred('client-b'), true);

    await harness.dispatchMessage({
        type: 'UPDATE_DEFER_FOR_CLIENT',
        version: 'old-release',
        clientId: 'client-b'
    }, 'client-a');
    assert.equal(harness.isDeferred('client-a'), true);
    assert.equal(harness.isDeferred('client-b'), true);

    await harness.dispatchMessage({
        type: 'UPDATE_CLIENT_CLEAR',
        version: 'old-release',
        clientId: 'client-b'
    }, 'client-a');
    assert.equal(harness.isDeferred('client-a'), false);
    assert.equal(harness.isDeferred('client-b'), true);

    await harness.dispatchMessage({ type: 'UPDATE_CLIENT_CLEAR', clientId: 'client-b' }, null);
    assert.equal(harness.isDeferred('client-b'), true);

    await harness.dispatchMessage({ type: 'UPDATE_CLIENT_CLEAR', version: 'old-release' }, 'client-b');
    assert.equal(harness.isDeferred('client-b'), false);

    await harness.dispatchMessage({
        type: 'UPDATE_DEFER_FOR_CLIENT',
        version: 'old-release',
        clientId: 'client-b'
    }, null);
    assert.equal(harness.isDeferred('client-b'), false);
});

test('missing-version session aliases remain compatible', async () => {
    const harness = createHarness();

    await harness.dispatchMessage({ type: 'UPDATE_DEFER_FOR_SESSION' });
    assert.equal(harness.isDeferred('client-a'), true);

    await harness.dispatchMessage({ type: 'UPDATE_SESSION_CLEAR' });
    assert.equal(harness.isDeferred('client-a'), false);
});

test('PAGE_READY clears the reporting client defer state', async () => {
    const harness = createHarness();

    await harness.dispatchMessage({ type: 'UPDATE_DEFER_FOR_CLIENT', version: cacheVersion });
    assert.equal(harness.isDeferred('client-a'), true);

    await harness.dispatchMessage({ type: 'V327_PAGE_READY', version: cacheVersion });
    assert.equal(harness.isDeferred('client-a'), false);
});
