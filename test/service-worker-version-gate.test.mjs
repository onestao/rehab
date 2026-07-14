import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDir, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const appUpdate = fs.readFileSync(path.join(root, 'app-update.js'), 'utf8');

function extractBetween(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.notEqual(start, -1, `${startMarker} should exist`);
    assert.notEqual(end, -1, `${endMarker} should exist after ${startMarker}`);
    return source.slice(start, end);
}

function createRegistrationHarness({ hasController, session }) {
    const listeners = new Map();
    const timers = [];
    let reloads = 0;
    let registrations = 0;
    let updates = 0;
    const sessionStorage = {
        getItem(key) { return session.has(key) ? session.get(key) : null; },
        setItem(key, value) { session.set(key, String(value)); }
    };
    const serviceWorker = {
        controller: hasController ? {} : null,
        addEventListener(type, callback, options = {}) {
            listeners.set(type, { callback, once: !!options.once });
        },
        register() {
            registrations += 1;
            return Promise.resolve({ update() { updates += 1; return Promise.resolve(); } });
        }
    };
    const window = {
        sessionStorage,
        location: { href: 'https://example.test/', reload() { reloads += 1; } },
        setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; }
    };
    const context = {
        window,
        navigator: { serviceWorker },
        history: { state: null, replaceState() {} },
        errorBus: { event() {}, report() {} },
        runWhenIdle(callback) { callback({ didTimeout: false, timeRemaining: () => 0 }); }
    };
    const block = extractBetween(html, 'function claimServiceWorkerReload', 'function idlePreloadEnabled');
    vm.runInNewContext(`${block};globalThis.__schedule = scheduleServiceWorkerRegistration;`, context);
    return {
        schedule: context.__schedule,
        async flush() { await Promise.resolve(); await Promise.resolve(); },
        runTimers() {
            while (timers.length) timers.shift().callback();
        },
        emit(type) {
            const listener = listeners.get(type);
            if (!listener) return;
            if (listener.once) listeners.delete(type);
            listener.callback();
        },
        hasListener(type) { return listeners.has(type); },
        counts() { return { reloads, registrations, updates }; }
    };
}

test('release assets and controller reload keys are consistently v326', () => {
    assert.match(sw, /training-assistant-v326/);
    assert.match(sw, /const CACHE_ASSET_REVISION = '[a-f0-9]{64}'/);
    assert.doesNotMatch(sw, /training-assistant-v325|\?v=325/);
    assert.doesNotMatch(html, /\?v=325|rehab-sw-controller-reload-v325/);
    assert.doesNotMatch(appUpdate, /version:\s*['"]325['"]|rehab-sw-controller-reload-v325/);
    assert.match(html, /rehab-sw-controller-reload-v326/);
    assert.match(appUpdate, /version:\s*['"]326['"]/);
    assert.match(appUpdate, /rehab-sw-controller-reload-v326/);
});

test('plan precache membership stays unchanged while query versions advance', () => {
    const expected = [
        'plan-chains.js',
        'plan-progression.js',
        'rehab-policy.js',
        'plan-store.js',
        'plan-feedback.js',
        'plan-cooldown.js',
        'plan-weekly.js',
        'plan-equipment.js',
        'plan-ui.js'
    ];
    const assetsBlock = sw.match(/const ASSETS = \[([\s\S]*?)\];/)?.[1] || '';
    const actual = expected.filter((asset) => assetsBlock.includes(`'${asset}?v=326'`));
    assert.deepEqual(actual, expected);
});

test('existing controller reloads once per release version', async () => {
    const session = new Map();
    const firstPage = createRegistrationHarness({ hasController: true, session });
    firstPage.schedule();
    await firstPage.flush();
    assert.equal(firstPage.hasListener('controllerchange'), true);
    firstPage.emit('controllerchange');
    firstPage.emit('controllerchange');
    assert.deepEqual(firstPage.counts(), { reloads: 1, registrations: 1, updates: 1 });

    const reloadedPage = createRegistrationHarness({ hasController: true, session });
    reloadedPage.schedule();
    await reloadedPage.flush();
    reloadedPage.emit('controllerchange');
    assert.equal(reloadedPage.counts().reloads, 0);
});

test('first service worker installation does not reload', async () => {
    const page = createRegistrationHarness({ hasController: false, session: new Map() });
    page.schedule();
    assert.equal(page.hasListener('controllerchange'), false);
    page.runTimers();
    await page.flush();
    assert.deepEqual(page.counts(), { reloads: 0, registrations: 1, updates: 1 });
});

test('startup registration does not execute app-update', () => {
    const registration = extractBetween(html, 'function scheduleServiceWorkerRegistration', 'function idlePreloadEnabled');
    assert.doesNotMatch(registration, /loadScript\(['"]app-update['"]\)/);
    assert.match(registration, /serviceWorker\.register\(['"]sw\.js['"]/);
});

test('version gate rejects a changed cache-managed asset without a bump', () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'rehab-version-gate-'));
    const script = path.join(root, 'scripts', 'bump-version.js');
    const placeholder = '0'.repeat(64);
    fs.writeFileSync(path.join(fixture, 'sw.js'), `const CACHE = 'training-assistant-v326';\nconst CACHE_ASSET_REVISION = '${placeholder}';\nconst ASSETS = ['index.html', 'chunk.js?v=326'];\n`);
    fs.writeFileSync(path.join(fixture, 'index.html'), `<script src="chunk.js?v=326"></script><script>const key='rehab-sw-controller-reload-v326';</script>`);
    fs.writeFileSync(path.join(fixture, 'app-update.js'), `const appUpdate={version:'326',key:'rehab-sw-controller-reload-v326'};`);
    fs.writeFileSync(path.join(fixture, 'chunk.js'), 'window.fixtureChunk = 1;\n');

    const env = { ...process.env, REHAB_VERSION_ROOT: fixture };
    const printed = spawnSync(process.execPath, [script, '--print-cache-revision'], { encoding: 'utf8', env });
    assert.equal(printed.status, 0, printed.stderr);
    const revision = printed.stdout.trim();
    const fixtureSw = fs.readFileSync(path.join(fixture, 'sw.js'), 'utf8').replace(placeholder, revision);
    fs.writeFileSync(path.join(fixture, 'sw.js'), fixtureSw);

    const before = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8', env });
    assert.equal(before.status, 0, before.stderr);

    fs.writeFileSync(path.join(fixture, 'chunk.js'), 'window.fixtureChunk = 2;\n');
    const after = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8', env });
    assert.notEqual(after.status, 0);
    assert.match(after.stderr, /cache-managed asset fingerprint changed without a version bump/);
});
