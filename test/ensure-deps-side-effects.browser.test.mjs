/**
 * C-T1 browser: rapid tab switches must not leave workout side effects on Today.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '..');
const repoRoot = path.resolve(root, '../../..');
const evidenceRoot = path.join(repoRoot, '.tmp', 'lazyload-repair', 'playwright', 'ensure-deps-side-effects');

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function freePort() {
    return await new Promise((resolve, reject) => {
        const server = net.createServer();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            const port = typeof address === 'object' && address ? address.port : 0;
            server.close(() => resolve(port));
        });
    });
}

function mimeFor(file) {
    if (file.endsWith('.html')) return 'text/html; charset=utf-8';
    if (file.endsWith('.js') || file.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
    if (file.endsWith('.css')) return 'text/css; charset=utf-8';
    if (file.endsWith('.json') || file.endsWith('.webmanifest')) return 'application/json; charset=utf-8';
    if (file.endsWith('.svg')) return 'image/svg+xml';
    if (file.endsWith('.png')) return 'image/png';
    if (file.endsWith('.woff2')) return 'font/woff2';
    return 'application/octet-stream';
}

async function startServer(options = {}) {
    const workoutDelayMs = options.workoutDelayMs || 0;
    let workoutHits = 0;
    const server = createServer(async (req, res) => {
        try {
            const rawUrl = new URL(req.url || '/', 'http://127.0.0.1');
            const pathname = decodeURIComponent(rawUrl.pathname === '/' ? '/index.html' : rawUrl.pathname);
            if (/workout-engine\.js(?:\?|$)/.test(pathname) || /workout-system\.js(?:\?|$)/.test(pathname) || /workout-core\.js(?:\?|$)/.test(pathname)) {
                workoutHits += 1;
                if (workoutDelayMs) await delay(workoutDelayMs);
            }
            const resolved = path.resolve(root, `.${pathname}`);
            if (!resolved.startsWith(root)) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }
            const info = await stat(resolved);
            if (!info.isFile()) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }
            res.writeHead(200, {
                'content-type': mimeFor(resolved),
                'cache-control': 'no-store'
            });
            createReadStream(resolved).pipe(res);
        } catch {
            res.writeHead(404);
            res.end('Not found');
        }
    });
    const port = await freePort();
    await new Promise((resolve) => {
        server.listen(port, '127.0.0.1', () => resolve(undefined));
    });
    return {
        server,
        url: `http://127.0.0.1:${port}/index.html`,
        get workoutHits() { return workoutHits; }
    };
}

function loadPlaywright() {
    const candidates = [
        path.join(repoRoot, 'node_modules', 'playwright', 'package.json'),
        path.join(root, 'node_modules', 'playwright', 'package.json'),
        path.join(repoRoot, '.claude', 'tools', 'playwright', 'node_modules', 'playwright', 'package.json')
    ];
    for (const pkg of candidates) {
        if (!existsSync(pkg)) continue;
        try {
            const require = createRequire(pkg);
            return require('playwright');
        } catch {
            // next
        }
    }
    const require = createRequire(path.join(repoRoot, 'package.json'));
    return require('playwright');
}

async function withBrowser(fn) {
    const pw = loadPlaywright();
    const chromium = pw.chromium || pw.default?.chromium;
    if (!chromium?.launch) throw new Error('playwright.chromium.launch unavailable');
    const browser = await chromium.launch({
        channel: process.env.AUDIT_CHANNEL || 'msedge',
        headless: true
    });
    try {
        return await fn(browser);
    } finally {
        await browser.close();
    }
}

test('C-T1 browser: Today→Workout→Records→Today cancelled workout does not force strength mode', async () => {
    await mkdir(evidenceRoot, { recursive: true });
    const http = await startServer({ workoutDelayMs: 1800 });
    try {
        await withBrowser(async (browser) => {
            const context = await browser.newContext({
                serviceWorkers: 'block',
                viewport: { width: 390, height: 844 }
            });
            const page = await context.newPage();
            await page.goto(http.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForFunction(() => window.ui && window.data && document.querySelector('#today'), null, { timeout: 30000 });

            // Instrument side-effect markers before rapid navigation.
            await page.evaluate(() => {
                window.__sideFx = { setMode: [], swipeInit: 0, workoutStateInit: 0 };
                const wrap = (obj, key, bucket) => {
                    if (!obj || typeof obj[key] !== 'function') return;
                    const orig = obj[key].bind(obj);
                    obj[key] = (...args) => {
                        window.__sideFx[bucket] = (window.__sideFx[bucket] || 0) + 1;
                        if (bucket === 'setMode') window.__sideFx.setMode.push(args[0]);
                        return orig(...args);
                    };
                };
                // Patch after modules may load via Proxy on window.
                const watch = setInterval(() => {
                    if (window.workout) wrap(window.workout, 'setMode', 'setMode');
                    if (window.swipeActions) wrap(window.swipeActions, 'init', 'swipeInit');
                    if (window.workoutState) wrap(window.workoutState, 'init', 'workoutStateInit');
                }, 20);
                window.__sideFxWatch = watch;
            });

            // Fire overlapping navigations: workout load is delayed; finish on today.
            await page.evaluate(async () => {
                const nav = [...document.querySelectorAll('.nav-item')];
                const p1 = window.ui.tab('workout', nav[1]);
                await new Promise((r) => setTimeout(r, 80));
                const p2 = window.ui.tab('records', nav[2]);
                await new Promise((r) => setTimeout(r, 80));
                const p3 = window.ui.tab('today', nav[0]);
                await Promise.allSettled([p1, p2, p3]);
            });
            await delay(2500);

            const snap = await page.evaluate(() => {
                clearInterval(window.__sideFxWatch);
                return {
                    active: document.querySelector('.page.active')?.id || null,
                    activePageId: window.data?._activePageId || null,
                    mode: window.workout?.mode || window.workoutState?.mode || null,
                    sideFx: window.__sideFx || null,
                    hasSwipe: !!window.swipeActions,
                    hasWorkoutState: !!window.workoutState,
                    token: window.ui?._navigationToken
                };
            });
            await writeFile(path.join(evidenceRoot, 'c-t1.json'), JSON.stringify({ snap, workoutHits: http.workoutHits }, null, 2));

            assert.equal(snap.active, 'today');
            assert.equal(snap.activePageId, 'today');
            // Cancelled workout path must not have applied strength mode side effect.
            // (If workout was never activated, setMode stays empty.)
            assert.ok(
                !snap.sideFx?.setMode?.length || snap.active === 'today',
                `unexpected setMode while landing on today: ${JSON.stringify(snap.sideFx)}`
            );
            // Stronger: if we never stayed on workout, setMode should not run.
            assert.equal((snap.sideFx?.setMode || []).length, 0, `setMode must not run for cancelled workout: ${JSON.stringify(snap)}`);
            assert.equal(snap.sideFx?.swipeInit || 0, 0, 'swipeActions.init must not run for cancelled workout');
            assert.equal(snap.sideFx?.workoutStateInit || 0, 0, 'workoutState.init must not run for cancelled workout');
            await context.close();
        });
    } finally {
        await new Promise((resolve) => http.server.close(resolve));
    }
});
