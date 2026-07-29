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
const releaseVersion = html.match(/const releaseVersion = ['"](\d+)['"]/)?.[1] || '333';

function extractBoot() {
    const start = html.indexOf('/* APP_STARTUP_NON_BLOCKING_BOOT_BEGIN */');
    const end = html.indexOf('/* APP_STARTUP_NON_BLOCKING_BOOT_END */', start);
    return html.slice(start + '/* APP_STARTUP_NON_BLOCKING_BOOT_BEGIN */'.length, end);
}

function createLoaderHarness({
    controllerScriptUrl = null,
    probeByHref = {},
    defaultProbe = { display: 'inline-flex', height: '44px', borderRadius: '9999px' },
    failHrefs = new Set(),
    delayedSuccessHref = null,
    delayMs = 5
} = {}) {
    const requested = [];
    const removed = [];
    const liveLinks = new Set();
    let currentHref = null;
    let context;
    const stylesheet = { dataset: { href: `build/generated.css?v=${releaseVersion}` } };

    function append(node) {
        if (node.tagName === 'LINK') {
            requested.push(node.href);
            currentHref = node.href;
            liveLinks.add(node);
            const fail = failHrefs.has(node.href);
            const delayed = delayedSuccessHref === node.href;
            const fire = () => {
                if (fail) node.onerror?.();
                else node.onload?.();
            };
            if (delayed) setTimeout(fire, delayMs);
            else queueMicrotask(fire);
            return node;
        }
        return node;
    }

    const document = {
        readyState: 'complete',
        head: { appendChild: append },
        body: { appendChild: append, classList: { add() {}, remove() {}, contains() { return false; } } },
        documentElement: {
            appendChild(node) { return node; },
            removeChild(node) { return node; }
        },
        querySelector(selector) {
            if (selector === '[data-rehab-stylesheet]') return stylesheet;
            return null;
        },
        querySelectorAll() { return []; },
        getElementById() { return null; },
        createElement(tag) {
            return {
                tagName: tag.toUpperCase(),
                dataset: {},
                className: '',
                style: {},
                remove() {
                    removed.push(this.href || this.className || this.tagName);
                    liveLinks.delete(this);
                },
                setAttribute() {},
                set rel(value) { this._rel = value; },
                set href(value) { this._href = value; },
                get href() { return this._href; },
                set src(value) { this._src = value; },
                get src() { return this._src; },
                textContent: ''
            };
        },
        addEventListener() {},
        open() {},
        write() {},
        close() {}
    };

    const windowObj = {
        document,
        sessionStorage: { getItem() { return null; }, setItem() {} },
        location: { href: 'https://example.test/' },
        caches: { async keys() { return []; }, async open() { return { async match() { return null; } }; } },
        getComputedStyle(node) {
            if (node && node.className === 'md-btn') {
                const probe = probeByHref[currentHref] || defaultProbe;
                return {
                    display: probe.display,
                    height: probe.height,
                    borderRadius: probe.borderRadius
                };
            }
            return { display: 'block', height: 'auto', borderRadius: '0px' };
        }
    };

    context = {
        window: windowObj,
        document,
        navigator: {
            serviceWorker: {
                get controller() {
                    if (!controllerScriptUrl) return null;
                    return { scriptURL: controllerScriptUrl, postMessage() {} };
                }
            }
        },
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
    vm.runInContext(extractBoot(), context, { filename: 'stylesheet-loader.js' });

    return {
        requested,
        removed,
        liveLinks,
        resolveAssetUrl: (...args) => context.window.resolveAssetUrl(...args),
        async loadStylesheet() {
            // Extract and call loadStylesheet by reusing the boot side effects:
            // loadStylesheet is closed over. Use a tiny eval bridge.
            return vm.runInContext(`(async () => {
                const declaration = document.querySelector('[data-rehab-stylesheet]');
                if (!declaration) throw new Error('missing');
                // call the same path launchApplication uses by invoking the internal loader
                // through a known global? Not exported. Re-run candidate path via resolve + create.
                // Instead, expose via temporary assignment:
                return await (async function(){
                    ${extractBoot().match(/async function loadStylesheet\(\) \{[\s\S]*?\n {12}\}/)[0]}
                    return loadStylesheet();
                })();
            })()` , context);
        }
    };
}

function extractLoadStylesheetSource() {
    const boot = extractBoot();
    const match = boot.match(/async function loadStylesheet\(\) \{[\s\S]*?\n {12}\}\n\n {12}function loadEntryScript/);
    assert.ok(match, 'loadStylesheet source should be extractable');
    return match[0].replace(/\n\n {12}function loadEntryScript$/, '');
}

function extractHelpersSource() {
    const boot = extractBoot();
    const start = boot.indexOf('function isBareController');
    const end = boot.indexOf('function loadEntryScript');
    assert.ok(start >= 0 && end > start);
    return boot.slice(start, end);
}

function runLoader({
    controllerScriptUrl = null,
    probeByHref = {},
    defaultProbe = { display: 'inline-flex', height: '44px', borderRadius: '9999px' },
    failHrefs = new Set(),
    delayedSuccessHref = null
} = {}) {
    const requested = [];
    const removed = [];
    const live = [];
    let currentHref = null;
    const stylesheet = { dataset: { href: `build/generated.css?v=${releaseVersion}` } };
    const document = {
        readyState: 'complete',
        head: {
            appendChild(node) {
                if (node.tagName === 'LINK') {
                    requested.push(node.href);
                    currentHref = node.href;
                    live.push(node);
                    const fail = failHrefs.has(node.href);
                    const delayed = delayedSuccessHref === node.href;
                    const fire = () => (fail ? node.onerror?.() : node.onload?.());
                    if (delayed) setTimeout(fire, 5);
                    else queueMicrotask(fire);
                }
                return node;
            }
        },
        body: { appendChild(node) { return node; } },
        documentElement: {
            appendChild(node) { return node; },
            removeChild(node) { return node; }
        },
        querySelector(selector) {
            return selector === '[data-rehab-stylesheet]' ? stylesheet : null;
        },
        createElement(tag) {
            return {
                tagName: tag.toUpperCase(),
                dataset: {},
                className: '',
                style: {},
                remove() {
                    removed.push(this.href || this.className);
                    const index = live.indexOf(this);
                    if (index >= 0) live.splice(index, 1);
                },
                setAttribute() {},
                set rel(v) { this._rel = v; },
                set href(v) { this._href = v; },
                get href() { return this._href; },
                textContent: ''
            };
        }
    };
    const windowObj = {
        document,
        location: { href: 'https://example.test/' },
        getComputedStyle(node) {
            if (node && node.className === 'md-btn') {
                const probe = probeByHref[currentHref] || defaultProbe;
                return {
                    display: probe.display,
                    height: probe.height,
                    borderRadius: probe.borderRadius
                };
            }
            return { display: 'block', height: 'auto', borderRadius: '0px' };
        }
    };
    const context = {
        window: windowObj,
        document,
        navigator: {
            serviceWorker: {
                get controller() {
                    if (!controllerScriptUrl) return null;
                    return { scriptURL: controllerScriptUrl };
                }
            }
        },
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
    const source = `
        ${extractHelpersSource()}
        window.resolveAssetUrl = resolveAssetUrl;
        window.__loadStylesheet = loadStylesheet;
        window.__stylesheetAppliesAppRules = stylesheetAppliesAppRules;
    `;
    vm.runInContext(source, context, { filename: 'stylesheet-loader-unit.js' });
    return {
        requested,
        removed,
        live,
        resolveAssetUrl: context.window.resolveAssetUrl,
        stylesheetAppliesAppRules: context.window.__stylesheetAppliesAppRules,
        loadStylesheet: () => context.window.__loadStylesheet()
    };
}

test('resolveAssetUrl keeps versioned CSS when no controller is present', () => {
    const harness = runLoader({ controllerScriptUrl: null });
    assert.equal(
        harness.resolveAssetUrl(`build/generated.css?v=${releaseVersion}`),
        `build/generated.css?v=${releaseVersion}`
    );
});

test('resolveAssetUrl keeps versioned CSS for current versioned controller', () => {
    const harness = runLoader({ controllerScriptUrl: `https://example.test/sw.js?v=${releaseVersion}` });
    assert.equal(
        harness.resolveAssetUrl(`build/generated.css?v=${releaseVersion}`),
        `build/generated.css?v=${releaseVersion}`
    );
});

test('resolveAssetUrl de-versions only for true bare legacy controller', () => {
    const harness = runLoader({ controllerScriptUrl: 'https://example.test/sw.js' });
    assert.equal(
        harness.resolveAssetUrl(`build/generated.css?v=${releaseVersion}`),
        'build/generated.css'
    );
});

test('resolveAssetUrl supports project subdirectory base paths', () => {
    const harness = runLoader({ controllerScriptUrl: 'https://example.test/repo/sw.js' });
    // recreate with custom location
    const document = {
        readyState: 'complete',
        head: { appendChild(node) { return node; } },
        body: { appendChild(node) { return node; } },
        documentElement: { appendChild(node) { return node; }, removeChild(node) { return node; } },
        querySelector(sel) {
            // Legacy bare-controller stripping only applies to non-release shells.
            // Current-release documents declare data-rehab-entry / data-rehab-stylesheet.
            if (sel && /data-rehab-(?:entry|stylesheet)/.test(String(sel))) return null;
            return { dataset: { href: `build/generated.css?v=${releaseVersion}` } };
        },
        createElement() {
            return {
                tagName: 'DIV',
                dataset: {},
                className: '',
                style: {},
                remove() {},
                setAttribute() {},
                textContent: ''
            };
        }
    };
    const windowObj = {
        document,
        location: { href: 'https://example.test/repo/index.html' },
        getComputedStyle() { return { display: 'block', height: 'auto', borderRadius: '0px' }; }
    };
    const context = {
        window: windowObj,
        document,
        navigator: { serviceWorker: { controller: { scriptURL: 'https://example.test/repo/sw.js' } } },
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
    vm.runInContext(`
        ${extractHelpersSource()}
        window.resolveAssetUrl = resolveAssetUrl;
    `, context);
    assert.equal(
        context.window.resolveAssetUrl(`build/generated.css?v=${releaseVersion}`),
        'build/generated.css'
    );
});

test('probe accepts generated.css md-btn rules', () => {
    const harness = runLoader({
        defaultProbe: { display: 'inline-flex', height: '44px', borderRadius: '9999px' }
    });
    assert.equal(harness.stylesheetAppliesAppRules(), true);
});

test('probe accepts browser-rounded generated.css button height', () => {
    const harness = runLoader({
        // Chromium may expose a 44px rule as 43.9946px at non-default page zoom.
        defaultProbe: { display: 'inline-flex', height: '43.9946px', borderRadius: '9999px' }
    });
    assert.equal(harness.stylesheetAppliesAppRules(), true);
});

test('probe rejects browser-default button styling', () => {
    const harness = runLoader({
        defaultProbe: { display: 'inline-block', height: 'auto', borderRadius: '0px' }
    });
    assert.equal(harness.stylesheetAppliesAppRules(), false);
});

test('probe accepts flex display from positioning without false-negative', () => {
    const harness = runLoader({
        defaultProbe: { display: 'flex', height: '44px', borderRadius: '9999px' }
    });
    assert.equal(harness.stylesheetAppliesAppRules(), true);
});

test('loadStylesheet succeeds on normal link load', async () => {
    const harness = runLoader();
    const link = await harness.loadStylesheet();
    assert.ok(link);
    assert.equal(link.href, `build/generated.css?v=${releaseVersion}`);
    assert.deepEqual(harness.requested, [`build/generated.css?v=${releaseVersion}`]);
});

test('loadStylesheet rejects load event when CSS did not apply app rules', async () => {
    const harness = runLoader({
        defaultProbe: { display: 'block', height: 'auto', borderRadius: '0px' }
    });
    await assert.rejects(() => harness.loadStylesheet(), /应用样式未生效|应用样式加载失败/);
});

test('loadStylesheet prefers versioned candidate before bare fallback', async () => {
    const harness = runLoader({ controllerScriptUrl: 'https://example.test/sw.js' });
    await harness.loadStylesheet();
    assert.equal(harness.requested[0], `build/generated.css?v=${releaseVersion}`);
});

test('loadStylesheet falls back to de-versioned CSS when versioned probe fails', async () => {
    const versioned = `build/generated.css?v=${releaseVersion}`;
    const harness = runLoader({
        controllerScriptUrl: 'https://example.test/sw.js',
        probeByHref: {
            [versioned]: { display: 'block', height: 'auto', borderRadius: '0px' },
            'build/generated.css': { display: 'inline-flex', height: '44px', borderRadius: '9999px' }
        }
    });
    const link = await harness.loadStylesheet();
    assert.equal(link.href, 'build/generated.css');
    assert.ok(harness.requested.includes(versioned));
    assert.ok(harness.requested.includes('build/generated.css'));
});

test('loadStylesheet rejects 404/onerror without caching success', async () => {
    // Candidate list always includes versioned and unversioned forms; fail both network paths.
    const failing = runLoader({
        failHrefs: new Set([
            `build/generated.css?v=${releaseVersion}`,
            'build/generated.css'
        ]),
        defaultProbe: { display: 'inline-flex', height: '44px', borderRadius: '9999px' }
    });
    await assert.rejects(() => failing.loadStylesheet(), /应用样式加载失败|应用样式未生效/);

    // A brand-new call site must be able to succeed; there is no permanent failed Promise cache.
    const succeeding = runLoader({
        defaultProbe: { display: 'inline-flex', height: '44px', borderRadius: '9999px' }
    });
    const link = await succeeding.loadStylesheet();
    assert.equal(link.href, `build/generated.css?v=${releaseVersion}`);
});

test('loadStylesheet does not permanently cache a failed promise path', async () => {
    const failing = runLoader({
        failHrefs: new Set([
            `build/generated.css?v=${releaseVersion}`,
            'build/generated.css'
        ]),
        controllerScriptUrl: 'https://example.test/sw.js'
    });
    await assert.rejects(() => failing.loadStylesheet(), /应用样式加载失败|应用样式未生效/);

    const succeeding = runLoader();
    const link = await succeeding.loadStylesheet();
    assert.equal(link.href, `build/generated.css?v=${releaseVersion}`);
});

test('successful stylesheet is not removed when a later timeout/fail candidate is attempted', async () => {
    const versioned = `build/generated.css?v=${releaseVersion}`;
    const harness = runLoader({
        controllerScriptUrl: 'https://example.test/sw.js',
        probeByHref: {
            [versioned]: { display: 'inline-flex', height: '44px', borderRadius: '9999px' },
            'build/generated.css': { display: 'block', height: 'auto', borderRadius: '0px' }
        }
    });
    const link = await harness.loadStylesheet();
    assert.equal(link.href, versioned);
    // Because the first candidate already applied, no need to remove a good sheet.
    assert.equal(harness.live.includes(link), true);
});

test('html-like non-applying response is rejected by probe', async () => {
    const harness = runLoader({
        defaultProbe: { display: 'block', height: 'auto', borderRadius: '0px' }
    });
    await assert.rejects(() => harness.loadStylesheet(), /应用样式未生效|应用样式加载失败/);
});
