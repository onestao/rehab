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

function extractBarrier() {
    const startMarker = '/* APP_STARTUP_VERSION_BARRIER_BEGIN */';
    const endMarker = '/* APP_STARTUP_VERSION_BARRIER_END */';
    const start = html.indexOf(startMarker);
    const end = html.indexOf(endMarker, start);
    assert.notEqual(start, -1, 'startup barrier start marker should exist');
    assert.notEqual(end, -1, 'startup barrier end marker should exist');
    return html.slice(start + startMarker.length, end);
}

function createHarness({
    controllerVersion = null,
    registrationError = null,
    precacheReady = true,
    href = 'https://example.test/',
    controllerScriptUrl = null,
    activeScriptUrl = null,
    suppressVersionResponse = false
} = {}) {
    const listeners = new Map();
    const timers = new Map();
    const session = new Map();
    const requested = [];
    let nextTimer = 1;
    let registrations = 0;
    let updates = 0;
    let reloads = 0;
    let activeControllerVersion = controllerVersion;
    let activeControllerScriptUrl = controllerScriptUrl;
    if (activeControllerScriptUrl == null && activeControllerVersion && activeControllerVersion !== 'unknown') {
        activeControllerScriptUrl = `https://example.test/sw.js?v=${activeControllerVersion}`;
    }
    let activePrecacheReady = precacheReady;
    let prepares = 0;
    let context;

    const status = { textContent: '' };
    const detail = { textContent: '', hidden: true };
    const retry = { hidden: true };
    const barrier = { hidden: false, dataset: {} };
    const appShell = { hidden: true };
    const stylesheet = { dataset: { href: 'build/generated.css?v=327' } };
    const entries = [
        { dataset: { src: 'm3e-ripple.js?v=327', kind: 'classic' } },
        { dataset: { src: 'data-utils-pure.js?v=327', kind: 'module' } }
    ];
    const main = { textContent: 'window.__rehabStartApplication = async () => { globalThis.__appBooted = true; };' };

    const serviceWorker = {
        get controller() {
            if (activeControllerVersion === null) return null;
            return {
                scriptURL: activeControllerScriptUrl || '',
                postMessage(message) {
                    if (activeControllerVersion === 'unknown' || suppressVersionResponse) return;
                    if (message.type === 'GET_VERSION') {
                        queueMicrotask(() => emit('message', {
                            data: { type: 'VERSION', requestId: message.requestId, version: activeControllerVersion, precacheReady: activePrecacheReady }
                        }));
                        return;
                    }
                    if (message.type === 'PREPARE_RELEASE') {
                        prepares += 1;
                        activePrecacheReady = true;
                        queueMicrotask(() => emit('message', {
                            data: { type: 'RELEASE_READY', requestId: message.requestId, version: activeControllerVersion }
                        }));
                    }
                }
            };
        },
        addEventListener(type, callback) {
            const group = listeners.get(type) || new Set();
            group.add(callback);
            listeners.set(type, group);
        },
        removeEventListener(type, callback) {
            listeners.get(type)?.delete(callback);
        },
        async getRegistration() {
            return { active: activeScriptUrl ? { scriptURL: activeScriptUrl } : null };
        },
        async register() {
            registrations += 1;
            if (registrationError) throw registrationError;
            return {
                active: activeScriptUrl ? { scriptURL: activeScriptUrl } : null,
                async update() { updates += 1; }
            };
        }
    };

    function emit(type, event = {}) {
        for (const callback of [...(listeners.get(type) || [])]) callback(event);
    }

    const document = {
        readyState: 'complete',
        head: { appendChild: append },
        body: { appendChild: append, classList: { add() {}, remove() {} } },
        addEventListener() {},
        querySelector(selector) {
            if (selector === '[data-rehab-stylesheet]') return stylesheet;
            return null;
        },
        querySelectorAll(selector) {
            return selector === 'script[data-rehab-entry]' ? entries : [];
        },
        getElementById(id) {
            return {
                startupBarrier: barrier,
                startupBarrierStatus: status,
                startupBarrierDetail: detail,
                startupBarrierRetry: retry,
                appShell,
                'rehab-app-main': main
            }[id] || null;
        },
        createElement(tag) {
            return {
                tagName: tag.toUpperCase(),
                dataset: {},
                remove() {},
                set rel(value) { this._rel = value; },
                set href(value) { this._href = value; },
                get href() { return this._href; },
                set src(value) { this._src = value; },
                get src() { return this._src; },
                textContent: ''
            };
        }
    };

    function append(node) {
        if (node.href) requested.push(node.href);
        if (node.src) requested.push(node.src);
        if (node.textContent && !node.src) vm.runInContext(node.textContent, context);
        queueMicrotask(() => node.onload?.());
        return node;
    }

    const historyUrls = [];
    const window = {
        document,
        sessionStorage: {
            getItem(key) { return session.has(key) ? session.get(key) : null; },
            setItem(key, value) { session.set(key, String(value)); }
        },
        location: { href, reload() { reloads += 1; } },
        history: { state: null, replaceState(_state, _title, url) { historyUrls.push(url); } },
        setTimeout(callback, delay) {
            const id = nextTimer++;
            timers.set(id, { callback, delay });
            return id;
        },
        clearTimeout(id) { timers.delete(id); }
    };
    context = { window, document, navigator: { serviceWorker }, console, Promise, queueMicrotask, URL };
    context.globalThis = context;
    window.window = window;
    vm.createContext(context);
    vm.runInContext(extractBarrier(), context, { filename: 'startup-barrier.js' });

    return {
        requested,
        status,
        detail,
        retry,
        barrier,
        appShell,
        session,
        historyUrls,
        counts() { return { registrations, updates, reloads }; },
        prepares() { return prepares; },
        hasListener(type) { return (listeners.get(type)?.size || 0) > 0; },
        async flush() {
            for (let index = 0; index < 32; index += 1) await Promise.resolve();
        },
        runTimer(delay) {
            const found = [...timers].find(([, timer]) => timer.delay === delay);
            assert.ok(found, `timer ${delay} should exist`);
            timers.delete(found[0]);
            found[1].callback();
        },
        switchController(version) {
            activeControllerVersion = version;
            activeControllerScriptUrl = `https://example.test/sw.js?v=${version}`;
            activePrecacheReady = false;
            emit('controllerchange');
        }
    };
}

test('startup barrier marks its own activation request and clears the one-shot legacy navigation marker', () => {
    assert.match(html, /type: 'SKIP_WAITING', source: 'startup-barrier-v327'/);
    assert.match(html, /__rehab_upgrade/);
    assert.match(html, /V327_PAGE_READY/);
});

test('startup barrier exposes a visible manual refresh fallback', () => {
    assert.match(html, /UPDATE_REFRESH_REQUIRED/);
    assert.match(html, /showRefreshFallback/);
    assert.match(html, /refreshButton\.onclick = \(\) => window\.location\.reload\(\)/);
});

test('startup barrier executes before every versioned external business resource declaration', () => {
    const marker = html.indexOf('APP_STARTUP_VERSION_BARRIER_BEGIN');
    assert.ok(marker > 0);
    const parserRequested = [...html.matchAll(/<(?:script|link)\b[^>]*\s(?:src|href)=["'][^"']+\?v=327/gi)];
    assert.equal(parserRequested.length, 0, parserRequested.map((match) => match[0]).join('\n'));
    assert.ok(marker < html.indexOf('data-rehab-stylesheet'));
    assert.match(html, /data-rehab-stylesheet[^>]+data-href=["']build\/generated\.css\?v=327/);
    assert.match(html, /script[^>]+data-rehab-entry[^>]+data-src=["']m3e-ripple\.js\?v=327/);
    assert.match(html, /body:not\(\.rehab-app-ready\) > :not\(#startupBarrier\)/);
});

test('first install starts normally without registration reload barrier', async () => {
    const page = createHarness({ controllerVersion: null });
    await page.flush();
    assert.deepEqual(page.counts(), { registrations: 0, updates: 0, reloads: 0 });
    assert.deepEqual(JSON.parse(JSON.stringify(page.requested)), ['build/generated.css?v=327', 'm3e-ripple.js?v=327', 'data-utils-pure.js?v=327']);
    assert.equal(page.appShell.hidden, false);
    assert.equal(page.barrier.hidden, true);
});

test('same-version v327 controller starts without update or reload', async () => {
    const page = createHarness({ controllerVersion: '327' });
    await page.flush();
    assert.deepEqual(page.counts(), { registrations: 0, updates: 0, reloads: 0 });
    assert.ok(page.requested.length > 0);
    assert.equal(page.prepares(), 0);
});

test('explicit v327 controller URL starts normally when GET_VERSION never replies', async () => {
    const page = createHarness({
        controllerVersion: '327',
        controllerScriptUrl: 'https://example.test/sw.js?v=327',
        suppressVersionResponse: true
    });
    await page.flush();
    assert.deepEqual(page.counts(), { registrations: 0, updates: 0, reloads: 0 });
    assert.ok(page.requested.length > 0);
    assert.equal(page.barrier.hidden, true);
    assert.equal(page.retry.hidden, true);
    assert.equal(page.hasListener('controllerchange'), false);
});

test('unrecognized controller URL does not immediately enter the old-worker upgrade path', async () => {
    const page = createHarness({ controllerVersion: 'unknown' });
    await page.flush();
    assert.deepEqual(page.counts(), { registrations: 0, updates: 0, reloads: 0 });
    assert.equal(page.hasListener('controllerchange'), false);
    page.runTimer(500);
    await page.flush();
    page.runTimer(500);
    await page.flush();
    assert.deepEqual(page.counts(), { registrations: 0, updates: 0, reloads: 0 });
    assert.equal(page.hasListener('controllerchange'), false);
    assert.equal(page.barrier.hidden, false);
    assert.equal(page.retry.hidden, false);
    assert.ok(page.detail.textContent.length > 0);
    assert.equal(page.requested.length, 0);
});

test('same-version controller repairs an interrupted release cache before starting', async () => {
    const page = createHarness({
        controllerVersion: '327',
        controllerScriptUrl: '',
        precacheReady: false
    });
    await page.flush();
    assert.deepEqual(page.counts(), { registrations: 0, updates: 0, reloads: 0 });
    assert.equal(page.prepares(), 1);
    assert.ok(page.requested.length > 0);
});

test('confirmed old controller blocks app resources until v327 takes control, then reloads once', async () => {
    const page = createHarness({
        controllerVersion: 'unknown',
        controllerScriptUrl: 'https://example.test/sw.js?v=326'
    });
    await page.flush();
    assert.equal(page.requested.length, 0);
    assert.deepEqual(page.counts(), { registrations: 1, updates: 1, reloads: 0 });
    assert.equal(page.requested.length, 0);
    page.switchController('327');
    await page.flush();
    assert.deepEqual(page.counts(), { registrations: 1, updates: 1, reloads: 1 });
    assert.equal(page.requested.length, 0);
    assert.equal(page.session.get('rehab-sw-controller-reload-v327'), '1');
    assert.equal(page.prepares(), 1);
});

test('legacy worker navigation marker starts after v327 claims without a second reload', async () => {
    const page = createHarness({
        controllerVersion: 'unknown',
        href: 'https://example.test/index.html?__rehab_upgrade=327'
    });
    await page.flush();
    page.switchController('327');
    await page.flush();

    assert.deepEqual(page.counts(), { registrations: 1, updates: 1, reloads: 0 });
    assert.equal(page.prepares(), 1);
    assert.ok(page.requested.length > 0);
    assert.deepEqual(page.historyUrls, ['https://example.test/index.html']);
});
test('registration failure remains visible and exposes a static retry', async () => {
    const page = createHarness({
        controllerVersion: 'unknown',
        controllerScriptUrl: 'https://example.test/sw.js?v=326',
        registrationError: new Error('offline')
    });
    await page.flush();
    assert.equal(page.barrier.hidden, false);
    assert.equal(page.retry.hidden, false);
    assert.match(page.status.textContent, /无法完成版本升级/);
    assert.match(page.detail.textContent, /offline/);
    assert.equal(page.requested.length, 0);
});

test('controller switch timeout stays on a non-blank retry screen', async () => {
    const page = createHarness({
        controllerVersion: 'unknown',
        controllerScriptUrl: 'https://example.test/sw.js?v=326'
    });
    await page.flush();
    page.runTimer(15000);
    await page.flush();
    assert.equal(page.barrier.hidden, false);
    assert.equal(page.retry.hidden, false);
    assert.match(page.status.textContent, /无法完成版本升级/);
    assert.equal(page.requested.length, 0);
    assert.deepEqual(page.counts(), { registrations: 1, updates: 1, reloads: 0 });
});
