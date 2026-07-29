import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function extractBetween(source, start, end) {
    const startIndex = source.indexOf(start);
    assert.notEqual(startIndex, -1, `${start} should exist`);
    const endIndex = source.indexOf(end, startIndex);
    assert.notEqual(endIndex, -1, `${end} should exist after ${start}`);
    return source.slice(startIndex, endIndex);
}

function flushMicrotasks() {
    return new Promise(resolve => setImmediate(resolve));
}

function createLoaderHarness() {
    const appended = [];
    const timers = new Map();
    let nextTimerId = 1;
    const window = {
        setTimeout(callback, delay) {
            const id = nextTimerId++;
            timers.set(id, { callback, delay, cleared: false });
            return id;
        },
        clearTimeout(id) {
            const timer = timers.get(id);
            if (timer) timer.cleared = true;
        }
    };
    const document = {
        createElement(tag) {
            assert.equal(tag, 'script');
            return {
                dataset: {},
                onload: null,
                onerror: null,
                removed: false,
                remove() { this.removed = true; }
            };
        },
        head: {
            appendChild(node) { appended.push(node); }
        }
    };
    const context = {
        window,
        document,
        URLSearchParams,
        console
    };
    context.globalThis = context;
    vm.createContext(context);

    const runWhenIdle = extractBetween(html, 'function runWhenIdle', 'function scriptLoadTimeoutMs');
    const scriptLoadTimeoutMs = extractBetween(html, 'function scriptLoadTimeoutMs', 'function schedulePostRenderUtilityLoad');
    const loadScript = extractBetween(html, 'function loadScript', 'window.loadAppScript = loadScript;');
    vm.runInContext(`
        const SCRIPT_LOAD_TIMEOUT_MS = 12000;
        const _loaded = new Set();
        const _loadingPromises = new Map();
        const MODULE_SCRIPTS = new Set();
        const MJS_SCRIPTS = new Set();
        const SCRIPT_PREREQUISITES = {};
        ${runWhenIdle}
        ${scriptLoadTimeoutMs}
        ${loadScript}
        window.__loaderTest = { loadScript, runWhenIdle, _loaded, _loadingPromises };
    `, context);

    return {
        window,
        appended,
        timers,
        api: window.__loaderTest,
        runTimer(id) {
            const timer = timers.get(id);
            assert.ok(timer, `timer ${id} should exist`);
            if (!timer.cleared) timer.callback();
        },
        timerByDelay(delay) {
            return [...timers.entries()].find(([, timer]) => timer.delay === delay && !timer.cleared);
        }
    };
}

test('loadScript clears a failed node and promise so a second attempt can succeed', async () => {
    const harness = createLoaderHarness();
    const first = harness.api.loadScript('retryable');
    await flushMicrotasks();
    const firstNode = harness.appended[0];

    firstNode.onerror();
    await assert.rejects(first, /Failed to load script: retryable/);
    assert.equal(firstNode.removed, true);
    assert.equal(firstNode.onload, null);
    assert.equal(firstNode.onerror, null);
    assert.equal(harness.api._loadingPromises.has('retryable'), false);

    const second = harness.api.loadScript('retryable');
    assert.notEqual(second, first);
    await flushMicrotasks();
    const secondNode = harness.appended[1];
    assert.ok(secondNode);
    secondNode.onload();
    await second;

    assert.equal(harness.api._loaded.has('retryable'), true);
    assert.equal(harness.api._loadingPromises.has('retryable'), false);
});

test('loadScript timeout ignores late events and leaves the module retryable', async () => {
    const harness = createLoaderHarness();
    harness.window.__APP_SCRIPT_LOAD_TIMEOUT_MS__ = 25;
    const first = harness.api.loadScript('late-module');
    await flushMicrotasks();
    const firstNode = harness.appended[0];
    const lateLoad = firstNode.onload;
    const lateError = firstNode.onerror;
    const timers = harness.timerByDelay(25);
    assert.ok(timers);
    const [timerId] = timers;

    harness.runTimer(timerId);
    await assert.rejects(first, /Timed out loading script: late-module/);
    assert.equal(firstNode.removed, true);
    assert.equal(harness.api._loaded.has('late-module'), false);
    assert.equal(harness.api._loadingPromises.has('late-module'), false);

    lateLoad();
    lateError();
    await flushMicrotasks();
    assert.equal(harness.api._loaded.has('late-module'), false);

    const retry = harness.api.loadScript('late-module');
    await flushMicrotasks();
    const retryNode = harness.appended[1];
    retryNode.onload();
    await retry;
    assert.equal(harness.api._loaded.has('late-module'), true);
});

test('loadScript is single-flight while a module is pending', async () => {
    const harness = createLoaderHarness();
    const first = harness.api.loadScript('shared-module');
    const second = harness.api.loadScript('shared-module');

    assert.equal(second, first);
    await flushMicrotasks();
    assert.equal(harness.appended.length, 1);
    harness.appended[0].onload();
    await Promise.all([first, second]);
});

function extractScriptPrerequisites() {
    const match = html.match(/const SCRIPT_PREREQUISITES = \{[\s\S]*?\n {8}\};/);
    assert.ok(match, 'SCRIPT_PREREQUISITES should exist in index.html');
    return match[0];
}

function createLoaderHarnessWithRealPrerequisites() {
    const appended = [];
    const timers = new Map();
    let nextTimerId = 1;
    const window = {
        setTimeout(callback, delay) {
            const id = nextTimerId++;
            timers.set(id, { callback, delay, cleared: false });
            return id;
        },
        clearTimeout(id) {
            const timer = timers.get(id);
            if (timer) timer.cleared = true;
        }
    };
    const document = {
        createElement(tag) {
            assert.equal(tag, 'script');
            return {
                dataset: {},
                onload: null,
                onerror: null,
                removed: false,
                remove() { this.removed = true; }
            };
        },
        head: {
            appendChild(node) { appended.push(node); }
        }
    };
    const context = {
        window,
        document,
        URLSearchParams,
        console
    };
    context.globalThis = context;
    vm.createContext(context);

    const runWhenIdle = extractBetween(html, 'function runWhenIdle', 'function scriptLoadTimeoutMs');
    const scriptLoadTimeoutMs = extractBetween(html, 'function scriptLoadTimeoutMs', 'function schedulePostRenderUtilityLoad');
    const loadScript = extractBetween(html, 'function loadScript', 'window.loadAppScript = loadScript;');
    const prerequisites = extractScriptPrerequisites();
    vm.runInContext(`
        const SCRIPT_LOAD_TIMEOUT_MS = 12000;
        const _loaded = new Set();
        const _loadingPromises = new Map();
        const MODULE_SCRIPTS = new Set();
        const MJS_SCRIPTS = new Set();
        ${prerequisites}
        ${runWhenIdle}
        ${scriptLoadTimeoutMs}
        ${loadScript}
        window.__loaderTest = { loadScript, runWhenIdle, _loaded, _loadingPromises, SCRIPT_PREREQUISITES };
    `, context);

    return {
        window,
        appended,
        timers,
        api: window.__loaderTest,
        srcNames() {
            return appended.map(node => String(node.src || '').split('?')[0]);
        },
        nodesFor(name) {
            const file = `${name}.js`;
            return appended.filter(node => String(node.src || '').split('?')[0] === file);
        },
        complete(name) {
            const nodes = this.nodesFor(name);
            assert.ok(nodes.length, `${name} should have been requested`);
            nodes.forEach(node => node.onload?.());
        },
        fail(name) {
            const nodes = this.nodesFor(name);
            assert.ok(nodes.length, `${name} should have been requested`);
            nodes.forEach(node => node.onerror?.());
        }
    };
}

test('food-log waits for database, normalizer, and evidence UI before executing', async () => {
    const harness = createLoaderHarnessWithRealPrerequisites();
    const load = harness.api.loadScript('food-log');
    await flushMicrotasks();

    assert.deepEqual(new Set(harness.srcNames()), new Set([
        'food-ai-normalizer-pure.js',
        'fooddb.js',
        'search-evidence-ui.js'
    ]));
    assert.equal(harness.nodesFor('food-log').length, 0);

    harness.complete('food-ai-normalizer-pure');
    await flushMicrotasks();
    assert.equal(harness.nodesFor('food-log').length, 0);

    harness.complete('search-evidence-ui');
    await flushMicrotasks();
    assert.equal(harness.nodesFor('food-log').length, 0);

    harness.complete('fooddb');
    await flushMicrotasks();
    assert.equal(harness.nodesFor('food-log').length, 1);

    harness.complete('food-log');
    await load;
    assert.equal(harness.api._loaded.has('food-log'), true);
    assert.equal(harness.api._loaded.has('fooddb'), true);
});

test('food-log concurrent loads request fooddb only once', async () => {
    const harness = createLoaderHarnessWithRealPrerequisites();
    const first = harness.api.loadScript('food-log');
    const second = harness.api.loadScript('food-log');
    assert.equal(second, first);
    await flushMicrotasks();

    assert.equal(harness.nodesFor('fooddb').length, 1);
    assert.equal(harness.nodesFor('food-ai-normalizer-pure').length, 1);
    assert.equal(harness.nodesFor('search-evidence-ui').length, 1);
    assert.equal(harness.nodesFor('food-log').length, 0);

    harness.complete('fooddb');
    harness.complete('food-ai-normalizer-pure');
    harness.complete('search-evidence-ui');
    await flushMicrotasks();
    assert.equal(harness.nodesFor('food-log').length, 1);

    harness.complete('food-log');
    await Promise.all([first, second]);
    assert.equal(harness.nodesFor('fooddb').length, 1);
    assert.equal(harness.nodesFor('food-log').length, 1);
});

test('fooddb failure keeps food-log unloadable and retryable', async () => {
    const harness = createLoaderHarnessWithRealPrerequisites();
    const first = harness.api.loadScript('food-log');
    await flushMicrotasks();
    harness.complete('food-ai-normalizer-pure');
    harness.complete('search-evidence-ui');
    harness.fail('fooddb');
    await assert.rejects(first, /Failed to load script: fooddb/);
    await flushMicrotasks();

    assert.equal(harness.nodesFor('food-log').length, 0);
    assert.equal(harness.api._loaded.has('food-log'), false);
    assert.equal(harness.api._loaded.has('fooddb'), false);
    assert.equal(harness.api._loadingPromises.has('food-log'), false);
    assert.equal(harness.api._loadingPromises.has('fooddb'), false);

    const retry = harness.api.loadScript('food-log');
    assert.notEqual(retry, first);
    await flushMicrotasks();
    assert.equal(harness.nodesFor('fooddb').length, 2);
    assert.equal(harness.nodesFor('food-log').length, 0);

    harness.complete('fooddb');
    await flushMicrotasks();
    assert.equal(harness.nodesFor('food-log').length, 1);
    harness.complete('food-log');
    await retry;
    assert.equal(harness.api._loaded.has('food-log'), true);
});

test('runWhenIdle without requestIdleCallback yields once through a zero-delay timer', () => {
    const harness = createLoaderHarness();
    /** @type {any} */
    let received = null;
    const timerId = harness.api.runWhenIdle(deadline => { received = deadline; }, { timeout: 9000 });

    assert.equal(received, null);
    assert.equal(harness.timers.get(timerId).delay, 0);
    harness.runTimer(timerId);
    assert.ok(received);
    const delivered = /** @type {any} */ (received);
    assert.equal(delivered.didTimeout, false);
    assert.equal(delivered.timeRemaining(), 0);
});

function createTodayEnhancementHarness(initialPage) {
    let activePage = initialPage;
    const timers = [];
    const idleCallbacks = [];
    const loadCalls = [];
    const renderCalls = [];
    const loaded = new Set();
    const context = {
        window: {
            setTimeout(callback, delay) {
                timers.push({ callback, delay });
                return timers.length;
            }
        },
        document: {
            querySelector(selector) {
                assert.equal(selector, '.page.active');
                return { id: activePage };
            }
        },
        data: {
            refreshModules() { renderCalls.push('refresh'); },
            render(page) { renderCalls.push(page); },
            enhanceTodayPage() { renderCalls.push('enhance'); }
        },
        errorBus: { report() {} },
        runWhenIdle(callback) { idleCallbacks.push(callback); },
        loadScript(name) {
            loadCalls.push(name);
            loaded.add(name);
            return Promise.resolve();
        },
        _loaded: loaded,
        console
    };
    context.globalThis = context;
    vm.createContext(context);
    const source = extractBetween(html, 'function scheduleTodayEnhancementLoad', 'function bootPerfDebugEnabled');
    vm.runInContext(`${source}\nwindow.__scheduleTodayEnhancementLoad = scheduleTodayEnhancementLoad;`, context);
    return {
        schedule: context.window.__scheduleTodayEnhancementLoad,
        timers,
        idleCallbacks,
        loadCalls,
        renderCalls,
        setActivePage(page) { activePage = page; },
        runNextTimer() { timers.shift().callback(); },
        runNextIdle() { idleCallbacks.shift()(); }
    };
}

for (const deepLinkPage of ['records', 'ai-coach']) {
    test(`today enhancement can be scheduled after starting on ${deepLinkPage}`, async () => {
        const harness = createTodayEnhancementHarness(deepLinkPage);

        const staleSchedule = harness.schedule();
        harness.runNextTimer();
        harness.runNextIdle();
        await staleSchedule;
        assert.deepEqual(harness.loadCalls, []);

        harness.setActivePage('today');
        const returnSchedule = harness.schedule();
        harness.runNextTimer();
        harness.runNextIdle();
        await returnSchedule;

        assert.deepEqual(harness.loadCalls, ['plan-ui']);
        assert.deepEqual(harness.renderCalls, ['refresh', 'enhance']);
        assert.ok(!harness.renderCalls.includes('today'), 'enhancement must not full-render today');
    });
}

test('idle preload does not warm health profile CSS without a real health intent', () => {
    const idleBlock = extractBetween(html, "bootMark('boot:idle-preload:start');", 'logBootPerfSummary();');
    assert.doesNotMatch(idleBlock, /warmLazyCss\(['\"]42-health-profile['\"]\)/);
});
