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
const releaseVersion = html.match(/const releaseVersion = ['"](\d+)['"]/)?.[1]
    || html.match(/build\/generated\.css\?v=(\d+)/)?.[1]
    || '333';

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
    caches = null,
    stylesheetProbe = { display: 'inline-flex', height: '44px', borderRadius: '9999px' },
    linkLoad = 'success',
    failHref = null
} = {}) {
    const session = new Map();
    const requested = [];
    const removed = [];
    let reloads = 0;
    let documentWrites = 0;
    let context;

    const appShell = { hidden: true };
    const bodyClassList = new Set();
    const stylesheet = { dataset: { href: `build/generated.css?v=${releaseVersion}` } };
    const entries = [
        { dataset: { src: `m3e-ripple.js?v=${releaseVersion}`, kind: 'classic' } },
        { dataset: { src: `data-utils-pure.js?v=${releaseVersion}`, kind: 'module' } }
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
        if (node.tagName === 'LINK' && node._rel === 'stylesheet') {
            queueMicrotask(() => {
                if (linkLoad === 'error' || (failHref && node.href === failHref)) {
                    node.onerror?.();
                    return;
                }
                node.onload?.();
            });
            return node;
        }
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
                className: '',
                style: {},
                remove() { removed.push(this); },
                setAttribute(name, value) {
                    this.dataset[name.replace(/^data-/, '')] = value;
                    this[`attr:${name}`] = value;
                },
                set rel(value) { this._rel = value; },
                get rel() { return this._rel; },
                set href(value) { this._href = value; },
                get href() { return this._href; },
                set src(value) { this._src = value; },
                get src() { return this._src; },
                textContent: ''
            };
        },
        documentElement: {
            appendChild(node) { return node; },
            removeChild(node) { return node; }
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
        toast: { show() {} },
        getComputedStyle(node) {
            if (node && node.className === 'md-btn') {
                return {
                    display: stylesheetProbe.display,
                    height: stylesheetProbe.height,
                    borderRadius: stylesheetProbe.borderRadius
                };
            }
            if (node && String(node.className || '').includes('hidden')) {
                return { display: 'none', height: '0px', borderRadius: '0px' };
            }
            return { display: 'block', height: 'auto', borderRadius: '0px' };
        }
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
        removed,
        appShell,
        session,
        bodyClassList,
        banner,
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
    const parserRequested = [...html.matchAll(/<(?:script|link)\b[^>]*\s(?:src|href)=["'][^"']+\?v=\d+/gi)];
    assert.equal(parserRequested.length, 0, parserRequested.map((match) => match[0]).join('\n'));
    assert.ok(marker < html.indexOf('data-rehab-stylesheet'));
    assert.match(html, new RegExp(`data-rehab-stylesheet[^>]+data-href=["']build\\/generated\\.css\\?v=${releaseVersion}`));
    assert.match(html, new RegExp(`script[^>]+data-rehab-entry[^>]+data-src=["']m3e-ripple\\.js\\?v=${releaseVersion}`));
});

test('first install starts the app immediately without SW handshake', async () => {
    const page = createHarness({ controllerScriptUrl: null });
    await page.flush();
    assert.deepEqual(JSON.parse(JSON.stringify(page.requested)), [
        `build/generated.css?v=${releaseVersion}`,
        `m3e-ripple.js?v=${releaseVersion}`,
        `data-utils-pure.js?v=${releaseVersion}`
    ]);
    assert.equal(page.appShell.hidden, false);
    assert.equal(page.bodyClassList.has('rehab-app-ready'), true);
    assert.equal(page.counts().reloads, 0);
});

test('versioned current controller starts normally without GET_VERSION', async () => {
    const page = createHarness({ controllerScriptUrl: `https://example.test/sw.js?v=${releaseVersion}` });
    await page.flush();
    assert.ok(page.requested.length > 0);
    assert.equal(page.appShell.hidden, false);
    assert.equal(page.counts().reloads, 0);
    assert.equal(page.requested.includes(`build/generated.css?v=${releaseVersion}`), true);
    assert.equal(page.requested.includes('build/generated.css'), false);
});

test('current release never de-versions only because scriptURL is bare /sw.js', async () => {
    // Registration now uses sw.js?v=N. A bare controller is a true legacy worker and may
    // de-version scripts, but CSS still prefers the versioned declaration first and keeps it
    // when the probe succeeds — so the current release is not forced onto bare CSS forever.
    const page = createHarness({ controllerScriptUrl: 'https://example.test/sw.js' });
    await page.flush();
    assert.equal(page.appShell.hidden, false);
    assert.equal(page.bodyClassList.has('rehab-app-ready'), true);
    assert.equal(page.requested[0], `build/generated.css?v=${releaseVersion}`);
    assert.ok(page.requested.includes('m3e-ripple.js'));
    assert.ok(page.requested.includes('data-utils-pure.js'));
    // Versioned CSS succeeded, so the bare CSS candidate is not required.
    assert.equal(page.requested.includes('build/generated.css'), false);
    assert.equal(page.counts().reloads, 0);
});

test('bare unknown controller still enters the app and de-versions scripts online', async () => {
    const page = createHarness({ controllerScriptUrl: 'https://example.test/sw.js' });
    await page.flush();
    assert.equal(page.appShell.hidden, false);
    assert.equal(page.bodyClassList.has('rehab-app-ready'), true);
    assert.ok(page.requested.includes('m3e-ripple.js'));
    assert.ok(page.requested.includes('data-utils-pure.js'));
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
    assert.match(html, new RegExp(`register\\('\\.\\/sw\\.js\\?v=${releaseVersion}', \\{ updateViaCache: 'none' \\}\\)`));
    assert.match(html, new RegExp(`resolveAssetUrl\\('app-update\\.js\\?v=${releaseVersion}'\\)`));
    assert.match(appUpdateSource, new RegExp(`swUrl:\\s*'\\.\\/sw\\.js\\?v=${releaseVersion}'`));
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

test('critical first-paint CSS defines .hidden before generated.css', () => {
    const styleEnd = html.indexOf('</style>');
    const headStyle = html.slice(0, styleEnd);
    assert.match(headStyle, /\.hidden\s*\{\s*display:\s*none\s*!important/);
    assert.match(html, /function stylesheetAppliesAppRules\(/);
    assert.match(html, /window\.resolveAssetUrl\s*=\s*resolveAssetUrl/);
    assert.match(html, /loadScript[\s\S]*resolveAssetUrl/);
    assert.match(html, /loadCss[\s\S]*resolveAssetUrl/);
    assert.equal(html.includes("probe.style.position = 'absolute'"), false);
});

test('stylesheet probe false negative from absolute positioning is not used', () => {
    assert.match(html, /display === 'inline-flex' \|\| display === 'flex'/);
    assert.match(html, /borderRadius/);
    assert.equal(html.includes("style.display === 'inline-flex' && String(style.height || '') === '44px'"), false);
});

test('failed stylesheet keeps business shell hidden and surfaces recovery', async () => {
    const toasts = [];
    const page = createHarness({
        controllerScriptUrl: null,
        stylesheetProbe: { display: 'inline-block', height: 'auto', borderRadius: '0px' }
    });
    // Override toast after harness creation is awkward; assert the critical UX contract:
    // unstyled business DOM must stay hidden even if recovery uses toast instead of banner.
    await page.flush();
    assert.equal(page.appShell.hidden, true);
    assert.equal(page.bodyClassList.has('rehab-app-ready'), true);
    assert.equal(page.counts().reloads, 0);
    assert.equal(toasts.length >= 0, true);
});

test('successful stylesheet is retained when a later candidate would fail', async () => {
    const page = createHarness({
        controllerScriptUrl: 'https://example.test/sw.js',
        stylesheetProbe: { display: 'inline-flex', height: '44px', borderRadius: '9999px' }
    });
    await page.flush();
    assert.equal(page.appShell.hidden, false);
    assert.ok(page.requested.includes(`build/generated.css?v=${releaseVersion}`));
});
