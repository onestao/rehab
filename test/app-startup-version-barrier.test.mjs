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

function extractBoot() {
    const startMarker = '/* APP_STARTUP_NON_BLOCKING_BOOT_BEGIN */';
    const endMarker = '/* APP_STARTUP_NON_BLOCKING_BOOT_END */';
    const start = html.indexOf(startMarker);
    const end = html.indexOf(endMarker, start);
    assert.notEqual(start, -1, 'non-blocking boot start marker should exist');
    assert.notEqual(end, -1, 'non-blocking boot end marker should exist');
    return html.slice(start + startMarker.length, end);
}

function createHarness({
    controllerScriptUrl = null,
    href = 'https://example.test/',
    caches = null
} = {}) {
    const session = new Map();
    const requested = [];
    let reloads = 0;
    let documentWrites = 0;
    let context;

    const appShell = { hidden: true };
    const bodyClassList = new Set();
    const stylesheet = { dataset: { href: 'build/generated.css?v=328' } };
    const entries = [
        { dataset: { src: 'm3e-ripple.js?v=328', kind: 'classic' } },
        { dataset: { src: 'data-utils-pure.js?v=328', kind: 'module' } }
    ];
    const main = { textContent: 'window.__rehabStartApplication = async () => { globalThis.__appBooted = true; };' };
    const banner = {
        classList: {
            _hidden: true,
            contains(name) { return name === 'hidden' ? this._hidden : false; },
            add(name) { if (name === 'hidden') this._hidden = true; },
            remove(name) { if (name === 'hidden') this._hidden = false; }
        },
        querySelector() { return { textContent: '', onclick: null }; },
        querySelectorAll() { return []; }
    };

    const serviceWorker = {
        get controller() {
            if (!controllerScriptUrl) return null;
            return {
                scriptURL: controllerScriptUrl,
                postMessage() {
                    throw new Error('startup must not message controller for version handshake');
                }
            };
        },
        addEventListener() {},
        removeEventListener() {},
        async getRegistration() { return null; },
        async register() {
            throw new Error('startup must not register service worker');
        }
    };

    function append(node) {
        if (node.href) requested.push(node.href);
        if (node.src) requested.push(node.src);
        if (node.textContent && !node.src) vm.runInContext(node.textContent, context);
        queueMicrotask(() => node.onload?.());
        return node;
    }

    const document = {
        readyState: 'complete',
        head: { appendChild: append },
        body: {
            appendChild: append,
            classList: {
                add(name) { bodyClassList.add(name); },
                remove(name) { bodyClassList.delete(name); },
                contains(name) { return bodyClassList.has(name); }
            }
        },
        addEventListener() {},
        open() {},
        write() { documentWrites += 1; },
        close() {},
        querySelector(selector) {
            if (selector === '[data-rehab-stylesheet]') return stylesheet;
            return null;
        },
        querySelectorAll(selector) {
            return selector === 'script[data-rehab-entry]' ? entries : [];
        },
        getElementById(id) {
            return {
                appShell,
                appUpdateBanner: banner,
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

    const cacheStore = caches || new Map();
    const windowObj = {
        document,
        sessionStorage: {
            getItem(key) { return session.has(key) ? session.get(key) : null; },
            setItem(key, value) { session.set(key, String(value)); }
        },
        location: { href, reload() { reloads += 1; } },
        caches: {
            async keys() { return [...cacheStore.keys()]; },
            async open(name) {
                const entriesMap = cacheStore.get(name) || new Map();
                return {
                    async match(request) {
                        const key = typeof request === 'string' ? request : String(request);
                        const hit = entriesMap.get(key);
                        if (!hit) return null;
                        return { async text() { return hit; } };
                    }
                };
            }
        },
        toast: { show() {} }
    };
    context = {
        window: windowObj,
        document,
        navigator: { serviceWorker },
        console,
        Promise,
        queueMicrotask,
        URL,
        setTimeout,
        clearTimeout
    };
    context.globalThis = context;
    windowObj.window = windowObj;
    vm.createContext(context);
    vm.runInContext(extractBoot(), context, { filename: 'startup-non-blocking.js' });

    return {
        requested,
        appShell,
        session,
        bodyClassList,
        counts() { return { reloads, documentWrites }; },
        async flush() {
            for (let index = 0; index < 40; index += 1) await Promise.resolve();
        }
    };
}

test('non-blocking boot markers replace the old version barrier', () => {
    assert.match(html, /APP_STARTUP_NON_BLOCKING_BOOT_BEGIN/);
    assert.match(html, /APP_STARTUP_NON_BLOCKING_BOOT_END/);
    assert.equal(html.includes('APP_STARTUP_VERSION_BARRIER'), false);
    assert.equal(html.includes('startupBarrier'), false);
    assert.equal(html.includes('body:not(.rehab-app-ready)'), false);
    assert.equal(html.includes('GET_VERSION'), false);
    assert.equal(html.includes('无法确认当前离线版本'), false);
    assert.equal(html.includes('无法完成版本升级'), false);
});

test('startup executes before every versioned external business resource declaration', () => {
    const marker = html.indexOf('APP_STARTUP_NON_BLOCKING_BOOT_BEGIN');
    assert.ok(marker > 0);
    const parserRequested = [...html.matchAll(/<(?:script|link)\b[^>]*\s(?:src|href)=["'][^"']+\?v=328/gi)];
    assert.equal(parserRequested.length, 0, parserRequested.map((match) => match[0]).join('\n'));
    assert.ok(marker < html.indexOf('data-rehab-stylesheet'));
    assert.match(html, /data-rehab-stylesheet[^>]+data-href=["']build\/generated\.css\?v=328/);
    assert.match(html, /script[^>]+data-rehab-entry[^>]+data-src=["']m3e-ripple\.js\?v=328/);
});

test('first install starts the app immediately without SW handshake', async () => {
    const page = createHarness({ controllerScriptUrl: null });
    await page.flush();
    assert.deepEqual(JSON.parse(JSON.stringify(page.requested)), [
        'build/generated.css?v=328',
        'm3e-ripple.js?v=328',
        'data-utils-pure.js?v=328'
    ]);
    assert.equal(page.appShell.hidden, false);
    assert.equal(page.bodyClassList.has('rehab-app-ready'), true);
    assert.equal(page.counts().reloads, 0);
});

test('versioned v328 controller starts normally without GET_VERSION', async () => {
    const page = createHarness({ controllerScriptUrl: 'https://example.test/sw.js?v=328' });
    await page.flush();
    assert.ok(page.requested.length > 0);
    assert.equal(page.appShell.hidden, false);
    assert.equal(page.counts().reloads, 0);
    assert.equal(page.requested.includes('build/generated.css?v=328'), true);
});

test('bare unknown controller still enters the app and de-versions assets online', async () => {
    const page = createHarness({ controllerScriptUrl: 'https://example.test/sw.js' });
    await page.flush();
    assert.equal(page.appShell.hidden, false);
    assert.equal(page.bodyClassList.has('rehab-app-ready'), true);
    assert.deepEqual(JSON.parse(JSON.stringify(page.requested)), [
        'build/generated.css',
        'm3e-ripple.js',
        'data-utils-pure.js'
    ]);
    assert.equal(page.counts().reloads, 0);
});

test('legacy shell restore rewrites once when bare controller has an old cached shell', async () => {
    const caches = new Map([
        ['training-assistant-v316', new Map([
            ['index.html', '<!DOCTYPE html><html><body>legacy-shell-v316</body></html>']
        ])]
    ]);
    const page = createHarness({
        controllerScriptUrl: 'https://example.test/sw.js',
        caches
    });
    await page.flush();
    assert.equal(page.counts().documentWrites, 1);
    assert.equal(page.session.get('rehab-legacy-shell-restored'), '1');
    assert.equal(page.requested.length, 0);
});

test('service worker registration is scheduled only after first paint path', () => {
    assert.match(html, /function scheduleServiceWorkerRegistration\(\)/);
    assert.match(html, /requestIdleCallback/);
    assert.match(html, /register\('\.\/sw\.js', \{ updateViaCache: 'none' \}\)/);
    assert.match(html, /script\.src = 'app-update\.js\?v=328'/);
    const quietStart = html.indexOf('function scheduleServiceWorkerRegistration()');
    const quietEnd = html.indexOf('function idlePreloadEnabled()', quietStart);
    const quiet = html.slice(quietStart, quietEnd);
    assert.equal(quiet.includes('location.reload'), false);
    assert.equal(quiet.includes('SKIP_WAITING'), false);
    assert.equal(quiet.includes('GET_VERSION'), false);
});

test('app-update apply is user-confirmed and best-effort prepare then skip waiting', () => {
    assert.match(appUpdateSource, /async apply\(/);
    assert.match(appUpdateSource, /PREPARE_RELEASE/);
    assert.match(appUpdateSource, /SKIP_WAITING/);
    assert.match(appUpdateSource, /showRefreshRequired/);
    assert.match(appUpdateSource, /async checkNow\(/);
    assert.equal(appUpdateSource.includes('GET_VERSION'), false);
});
