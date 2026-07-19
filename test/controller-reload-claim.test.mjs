// @ts-nocheck
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDir, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appUpdateSource = fs.readFileSync(path.join(root, 'app-update.js'), 'utf8');

function extractBetween(source, start, end) {
    const from = source.indexOf(start);
    assert.notEqual(from, -1, `missing start marker: ${start}`);
    const to = source.indexOf(end, from);
    assert.notEqual(to, -1, `missing end marker: ${end}`);
    return source.slice(from, to);
}

function createClaimHarness() {
    const sessionStorage = new Map();
    const windowObj = {
        sessionStorage: {
            getItem(key) { return sessionStorage.has(key) ? sessionStorage.get(key) : null; },
            setItem(key, value) { sessionStorage.set(key, String(value)); }
        },
        history: {
            state: null,
            replaceState(state) { this.state = state; }
        }
    };
    const context = {
        window: windowObj,
        history: windowObj.history
    };
    context.globalThis = context;
    windowObj.window = windowObj;
    const block = extractBetween(html, 'function claimServiceWorkerReload', 'window.claimServiceWorkerReload');
    vm.runInNewContext(`${block}\nwindow.claimServiceWorkerReload = claimServiceWorkerReload;`, context);
    return {
        claim: (key) => context.window.claimServiceWorkerReload(key),
        sessionStorage,
        claimedMap: () => context.window.__rehabSwControllerReloadClaimed
    };
}

function createAppUpdateHarness({
    controllerScriptURL = 'https://example.test/sw.js?v=342',
    scriptSources = ['https://example.test/data.js?v=342']
} = {}) {
    const reloads = [];
    const documentScripts = scriptSources.map((src) => ({ src }));
    const windowObj = {
        location: {
            href: 'https://example.test/index.html',
            reload() { reloads.push('reload'); }
        },
        errorBus: { event() {}, report() {} },
        claimServiceWorkerReload: null
    };
    const navigatorObj = {
        serviceWorker: {
            controller: controllerScriptURL ? { scriptURL: controllerScriptURL } : null,
            addEventListener() {},
            removeEventListener() {}
        }
    };
    const documentObj = {
        scripts: documentScripts,
        getElementById() { return null; }
    };
    const context = {
        window: windowObj,
        document: documentObj,
        navigator: navigatorObj,
        URL,
        Object,
        console
    };
    context.globalThis = context;
    windowObj.window = windowObj;
    vm.createContext(context);
    vm.runInContext(appUpdateSource, context, { filename: 'app-update.js' });
    return {
        appUpdate: context.window.appUpdate || context.appUpdate,
        reloads,
        claim() {
            return (context.window.appUpdate || context.appUpdate).claimControllerReload();
        },
        needsReload() {
            return (context.window.appUpdate || context.appUpdate).documentNeedsControllerReload();
        }
    };
}

test('claimServiceWorkerReload is per-document and does not use shared sessionStorage', () => {
    const first = createClaimHarness();
    const second = createClaimHarness();
    const key = 'rehab-sw-controller-reload-v342';

    assert.equal(first.claim(key), true);
    assert.equal(first.claim(key), false, 'same document cannot claim twice');
    assert.equal(second.claim(key), true, 'sibling document/tab can still claim');
    assert.equal(first.sessionStorage.size, 0);
    assert.equal(second.sessionStorage.size, 0);
    assert.equal(first.claimedMap()[key], true);
    assert.equal(second.claimedMap()[key], true);
});

test('appUpdate claim fallback stays per-instance, never session-wide', () => {
    const tabA = createAppUpdateHarness();
    const tabB = createAppUpdateHarness();
    assert.equal(tabA.claim(), true);
    assert.equal(tabA.claim(), false);
    assert.equal(tabB.claim(), true);
});

test('documentNeedsControllerReload skips reload when scripts already match target version', () => {
    const current = createAppUpdateHarness({
        controllerScriptURL: 'https://example.test/sw.js?v=342',
        scriptSources: ['https://example.test/data.js?v=342']
    });
    assert.equal(current.needsReload(), false);

    const stale = createAppUpdateHarness({
        controllerScriptURL: 'https://example.test/sw.js?v=342',
        scriptSources: ['https://example.test/data.js?v=328']
    });
    assert.equal(stale.needsReload(), true);
});

test('page paths never delete training-assistant caches; they only send versioned PAGE_READY', () => {
    assert.match(html, /type:\s*['"]V327_PAGE_READY['"]/);
    assert.match(html, /version:\s*releaseVersion/);
    assert.match(appUpdateSource, /type:\s*['"]V327_PAGE_READY['"]/);
    assert.match(appUpdateSource, /version:\s*this\.version/);

    // Residual prune must stay SW-owned. Page code may still open caches for legacy shell
    // restore (match only), but must not call caches.delete on training-assistant keys.
    const ack = extractBetween(html, 'function acknowledgeReleasePage', 'function whenDocumentReady');
    assert.doesNotMatch(ack, /caches\.delete/);
    assert.doesNotMatch(ack, /training-assistant-v'\s*\+\s*releaseVersion/);

    const reloadBind = extractBetween(appUpdateSource, 'bindControllerReload(hadController)', 'showRefreshRequired');
    assert.doesNotMatch(reloadBind, /caches\.delete/);
    assert.doesNotMatch(reloadBind, /training-assistant-v'\s*\+\s*this\.version/);

    assert.doesNotMatch(html, /indexedDB\.deleteDatabase|localStorage\.clear\s*\(/);
    assert.doesNotMatch(appUpdateSource, /indexedDB\.deleteDatabase|localStorage\.clear\s*\(/);
});

test('document purity helper rejects mixed dual-tab residual state', async () => {
    const source = fs.readFileSync(
        path.join(root, 'scripts', 'verify-non-blocking-update-browser.mjs'),
        'utf8'
    );
    assert.ok(source.includes('function documentIsPureV333'));
    assert.ok(source.includes('dual.documentPure?.[0] === true'));
    assert.ok(source.includes('dual.documentPure?.[1] === true'));
    assert.ok(source.includes('sw\\.js\\?v=333'));
    assert.ok(source.includes('generated\\.css\\?v=333'));

    const start = source.indexOf('function isVersionedAsset');
    const end = source.indexOf('async function waitForFromVersion');
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    const helpers = source.slice(start, end);
    const context = {
        module: { exports: {} },
        exports: {},
        RegExp,
        String,
        Array
    };
    vm.runInNewContext(
        `${helpers}\nmodule.exports = { isVersionedAsset, documentIsPureV333 };`,
        context
    );
    const { documentIsPureV333 } = context.module.exports;

    const pure = {
        version: '333',
        precacheReady: true,
        ready: true,
        activePage: 'today',
        upgradeMarker: null,
        controller: 'http://127.0.0.1/sw.js?v=333',
        cacheKeys: ['training-assistant-v333'],
        scriptSources: ['http://127.0.0.1/data.js?v=333'],
        stylesheetHrefs: ['http://127.0.0.1/build/generated.css?v=333'],
        resourceUrls: ['http://127.0.0.1/data.js?v=333', 'http://127.0.0.1/build/generated.css?v=333'],
        styleProbe: { display: 'inline-flex', height: '44px', borderRadius: '9999px' }
    };
    assert.equal(documentIsPureV333(pure), true);

    const mixed = {
        ...pure,
        controller: 'http://127.0.0.1/sw.js',
        scriptSources: ['http://127.0.0.1/data.js?v=328'],
        stylesheetHrefs: ['http://127.0.0.1/build/generated.css'],
        resourceUrls: ['http://127.0.0.1/data.js?v=328']
    };
    assert.equal(documentIsPureV333(mixed), false);
});
