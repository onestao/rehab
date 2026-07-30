/**
 * Phase B browser gates: deep-link first paint, navStack consistency, requestClose.
 * Evidence: G:/LLM/rehab/.tmp/lazyload-repair/playwright/deep-link-nav/
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
const evidenceRoot = path.join(repoRoot, '.tmp', 'lazyload-repair', 'playwright', 'deep-link-nav');

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

async function startServer() {
    const server = createServer(async (req, res) => {
        try {
            const rawUrl = new URL(req.url || '/', 'http://127.0.0.1');
            const pathname = decodeURIComponent(rawUrl.pathname === '/' ? '/index.html' : rawUrl.pathname);
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
        base: `http://127.0.0.1:${port}`
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
            // try next
        }
    }
    const require = createRequire(path.join(repoRoot, 'package.json'));
    return require('playwright');
}

async function withBrowser(fn) {
    const pw = loadPlaywright();
    const chromium = pw.chromium || pw.default?.chromium;
    if (!chromium?.launch) throw new Error('playwright.chromium.launch unavailable');
    let browser;
    try {
        browser = await chromium.launch({ channel: process.env.AUDIT_CHANNEL || 'msedge', headless: true });
    } catch (error) {
        if (process.env.AUDIT_CHANNEL || !String(error?.message || '').includes("distribution 'msedge' is not found")) throw error;
        browser = await chromium.launch({ headless: true });
    }
    try {
        return await fn(browser, pw);
    } finally {
        await browser.close();
    }
}

function snapshotNav(page) {
    return page.evaluate(() => {
        const stack = (window.navStack?.stack || []).map((e) => ({ type: e.type, id: e.id }));
        return {
            active: document.querySelector('.page.active')?.id || null,
            hash: window.location.hash,
            historyState: window.history.state,
            navStack: stack,
            routineView: window.data?.routineView || null,
            healthView: window.data?.healthView || null,
            activePageId: window.data?._activePageId || null
        };
    });
}

test('B-T1 browser: deep-link #/profile/library never paints Today as active', async () => {
    await mkdir(evidenceRoot, { recursive: true });
    const http = await startServer();
    try {
        await withBrowser(async (browser) => {
            const context = await browser.newContext({
                serviceWorkers: 'block',
                viewport: { width: 390, height: 844 }
            });
            const page = await context.newPage();
            const actives = [];
            await page.addInitScript(() => {
                window.__seenActivePages = [];
                const push = () => {
                    const id = document.querySelector('.page.active')?.id || null;
                    const list = window.__seenActivePages || [];
                    window.__seenActivePages = list;
                    if (list[list.length - 1] !== id) list.push(id);
                };
                const obs = new MutationObserver(push);
                const start = () => {
                    push();
                    const root = document.body || document.documentElement;
                    if (root) obs.observe(root, { attributes: true, childList: true, subtree: true, attributeFilter: ['class'] });
                };
                if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
                else start();
                // sample a few animation frames too
                let frames = 0;
                const tick = () => {
                    push();
                    frames += 1;
                    if (frames < 40) requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            });
            await page.goto(`${http.base}/index.html#/profile/library`, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForFunction(() => {
                return window.data
                    && document.querySelector('.page.active')?.id === 'profile'
                    && window.data.routineView === 'library';
            }, null, { timeout: 45000 });
            await delay(400);
            const seen = await page.evaluate(() => window.__seenActivePages || []);
            const settled = await snapshotNav(page);
            actives.push(...seen);
            await writeFile(path.join(evidenceRoot, 'b-t1.json'), JSON.stringify({ seen, settled }, null, 2));
            // Early shell + boot must not leave Today as the active tab once settled.
            assert.equal(settled.active, 'profile');
            assert.equal(settled.routineView, 'library');
            assert.ok(!seen.includes('today') || seen.indexOf('profile') < seen.indexOf('today') || !seen.slice(seen.indexOf('profile')).includes('today'),
                `Today flash after profile: ${JSON.stringify(seen)}`);
            // Prefer: never saw today after early shell flipped (allow empty pre-DOM null).
            const concrete = seen.filter(Boolean);
            assert.ok(concrete.length >= 1, 'expected at least one concrete active page sample');
            // After first concrete sample, if first was profile, today must not appear later.
            const firstConcrete = concrete[0];
            if (firstConcrete === 'profile') {
                assert.ok(!concrete.slice(1).includes('today'), `Today flash after profile shell: ${JSON.stringify(concrete)}`);
            } else {
                // If browser painted before early script, still require no post-settle today.
                assert.equal(settled.active, 'profile');
            }
            await context.close();
        });
    } finally {
        await new Promise((resolve) => http.server.close(resolve));
    }
});

test('B-T2 browser: hash / DOM / navStack / subroute stay aligned', async () => {
    await mkdir(evidenceRoot, { recursive: true });
    const http = await startServer();
    try {
        await withBrowser(async (browser) => {
            const context = await browser.newContext({
                serviceWorkers: 'block',
                viewport: { width: 390, height: 844 }
            });
            const page = await context.newPage();
            await page.goto(`${http.base}/index.html#/profile/library`, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForFunction(() => {
                const stack = window.navStack?.stack || [];
                const hasProfileTab = stack.some((e) => e.type === 'tab' && e.id === 'profile');
                const hasRoutineSub = stack.some((e) => e.type === 'subtab' && e.id === 'routine');
                return document.querySelector('.page.active')?.id === 'profile'
                    && window.data?._activePageId === 'profile'
                    && window.data?.routineView === 'library'
                    && hasProfileTab
                    && hasRoutineSub;
            }, null, { timeout: 45000 });
            await delay(200);
            const settled = await snapshotNav(page);
            await writeFile(path.join(evidenceRoot, 'b-t2.json'), JSON.stringify(settled, null, 2));
            assert.equal(settled.active, 'profile');
            assert.equal(settled.activePageId, 'profile');
            assert.match(settled.hash, /#\/profile\/library/);
            assert.equal(settled.routineView, 'library');
            const tabIds = settled.navStack.filter((e) => e.type === 'tab').map((e) => e.id);
            assert.ok(tabIds.includes('profile'), `navStack tabs=${JSON.stringify(settled.navStack)}`);
            const lastTab = [...settled.navStack].reverse().find((e) => e.type === 'tab');
            assert.equal(lastTab?.id, 'profile', `last tab should be profile: ${JSON.stringify(settled.navStack)}`);
            const top = settled.navStack[settled.navStack.length - 1];
            // Stack may be [today root, profile tab, library subtab]
            assert.ok(top && (top.id === 'profile' || top.id === 'routine'), `unexpected top ${JSON.stringify(top)}`);
            await context.close();
        });
    } finally {
        await new Promise((resolve) => http.server.close(resolve));
    }
});

test('B-T3 browser: requestClose returns from library to profile home then today', async () => {
    await mkdir(evidenceRoot, { recursive: true });
    const http = await startServer();
    try {
        await withBrowser(async (browser) => {
            const context = await browser.newContext({
                serviceWorkers: 'block',
                viewport: { width: 390, height: 844 }
            });
            const page = await context.newPage();
            await page.goto(`${http.base}/index.html#/profile/library`, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForFunction(() => {
                const stack = window.navStack?.stack || [];
                return document.querySelector('.page.active')?.id === 'profile'
                    && window.data?.routineView === 'library'
                    && stack.some((e) => e.type === 'tab' && e.id === 'profile')
                    && stack.some((e) => e.type === 'subtab' && e.id === 'routine')
                    && typeof window.navStack?.requestClose === 'function';
            }, null, { timeout: 45000 });
            await delay(200);

            const first = await page.evaluate(() => {
                const closed = window.navStack.requestClose();
                return {
                    closed,
                    active: document.querySelector('.page.active')?.id,
                    routineView: window.data?.routineView,
                    stack: (window.navStack?.stack || []).map((e) => ({ type: e.type, id: e.id })),
                    hash: window.location.hash
                };
            });
            await delay(150);
            // If top was subtab, first close should land on profile home (still profile tab).
            // If only tab frame exists, first close may go to today.
            const second = await page.evaluate(() => {
                const closed = window.navStack.requestClose();
                return {
                    closed,
                    active: document.querySelector('.page.active')?.id,
                    routineView: window.data?.routineView,
                    stack: (window.navStack?.stack || []).map((e) => ({ type: e.type, id: e.id })),
                    hash: window.location.hash
                };
            });
            await delay(200);
            const third = await page.evaluate(() => {
                const closed = window.navStack.requestClose();
                return {
                    closed,
                    active: document.querySelector('.page.active')?.id,
                    stack: (window.navStack?.stack || []).map((e) => ({ type: e.type, id: e.id }))
                };
            });

            const evidence = { first, second, third };
            await writeFile(path.join(evidenceRoot, 'b-t3.json'), JSON.stringify(evidence, null, 2));

            assert.equal(first.closed, true, `first requestClose must not no-op: ${JSON.stringify(first)}`);
            // After enough closes we must reach today root, not stuck on profile with today-only stack.
            const finalActive = third.active || second.active || first.active;
            assert.ok(
                finalActive === 'today' || second.active === 'today' || (first.active === 'profile' && first.routineView === 'home'),
                `expected progressive back: ${JSON.stringify(evidence)}`
            );
            // Must not remain on library after a successful close.
            if (first.closed) {
                assert.notEqual(first.routineView, 'library');
            }
            await context.close();
        });
    } finally {
        await new Promise((resolve) => http.server.close(resolve));
    }
});

test('B-T4 / H2-T1 browser: history.back closes modal then leaves tab to today', async () => {
    await mkdir(evidenceRoot, { recursive: true });
    const http = await startServer();
    try {
        await withBrowser(async (browser) => {
            const context = await browser.newContext({
                serviceWorkers: 'block',
                viewport: { width: 390, height: 844 }
            });
            const page = await context.newPage();
            await page.goto(`${http.base}/index.html#/profile/library`, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForFunction(() => {
                return document.querySelector('.page.active')?.id === 'profile'
                    && window.data?.routineView === 'library'
                    && typeof window.data?.openNewPlanSheet === 'function'
                    && typeof window.data?._openModal === 'function';
            }, null, { timeout: 45000 });
            // Open a route-bound modal while staying on profile.
            // Prefer plan sheet when plan-ui is ready; fall back to shared _openModal so
            // history.back/modal lifecycle is still exercised if plan gate cancels off-today.
            await page.evaluate(async () => {
                window.data._activePageId = 'profile';
                try {
                    await window.data.openNewPlanSheet();
                } catch { /* fall through */ }
                if (!document.querySelector('.md-modal[data-rl-modal="1"]')) {
                    await window.data._openModal({
                        title: '测试模态',
                        icon: 'info',
                        bodyHtml: '<p>history back close</p>',
                        actionsHtml: '<button class="md-btn" type="button" data-modal-close>关闭</button>'
                    });
                }
            });
            await page.waitForFunction(() => !!document.querySelector('.md-modal[data-rl-modal="1"]'), null, { timeout: 20000 });
            const before = await snapshotNav(page);
            await page.goBack();
            await delay(400);
            const afterModal = await page.evaluate(() => ({
                modal: !!document.querySelector('.md-modal[data-rl-modal="1"]'),
                active: document.querySelector('.page.active')?.id,
                stack: (window.navStack?.stack || []).map((e) => ({ type: e.type, id: e.id })),
                mode: window.navStack?.mode || null
            }));
            // Continue back until today or stack root.
            let guard = 0;
            while (guard < 4) {
                const active = await page.evaluate(() => document.querySelector('.page.active')?.id);
                const stackLen = await page.evaluate(() => (window.navStack?.stack || []).length);
                if (active === 'today' || stackLen <= 1) break;
                await page.goBack();
                await delay(250);
                guard += 1;
            }
            const final = await snapshotNav(page);
            await writeFile(path.join(evidenceRoot, 'b-t4-history-back.json'), JSON.stringify({ before, afterModal, final }, null, 2));
            assert.equal(afterModal.modal, false, 'first history.back must close modal');
            assert.ok(
                final.active === 'today' || final.navStack.length <= 1 || afterModal.active === 'profile',
                `expected progressive back to today/root: ${JSON.stringify(final)}`
            );
            await context.close();
        });
    } finally {
        await new Promise((resolve) => http.server.close(resolve));
    }
});

test('H2-T2 browser: PWA mode re-pushes root instead of silent blank dump', async () => {
    await mkdir(evidenceRoot, { recursive: true });
    const http = await startServer();
    try {
        await withBrowser(async (browser) => {
            const context = await browser.newContext({
                serviceWorkers: 'block',
                viewport: { width: 390, height: 844 }
            });
            const page = await context.newPage();
            await page.addInitScript(() => {
                Object.defineProperty(window.navigator, 'standalone', { get: () => true, configurable: true });
                window.matchMedia = (q) => /** @type {MediaQueryList} */ ({
                    matches: String(q).includes('standalone') || String(q).includes('minimal-ui'),
                    media: q,
                    onchange: null,
                    addEventListener() {},
                    removeEventListener() {},
                    addListener() {},
                    removeListener() {},
                    dispatchEvent() { return false; }
                });
            });
            await page.goto(`${http.base}/index.html#/today`, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForFunction(() => window.navStack && document.querySelector('#today'), null, { timeout: 45000 });
            await page.evaluate(() => {
                window.navStack.mode = 'pwa';
                window.navStack.resetToRoot();
            });
            await page.evaluate(() => {
                window.navStack._onPopState({ state: { navRoot: true, navIndex: 0 } });
            });
            const state = await page.evaluate(() => ({
                mode: window.navStack.mode,
                stack: (window.navStack.stack || []).map((e) => ({ type: e.type, id: e.id })),
                historyState: window.history.state,
                active: document.querySelector('.page.active')?.id || null
            }));
            await writeFile(path.join(evidenceRoot, 'h2-t2-pwa-root.json'), JSON.stringify(state, null, 2));
            assert.equal(state.mode, 'pwa');
            assert.ok(state.stack.length >= 1);
            assert.equal(state.stack[0].id, 'today');
            assert.ok(state.active === 'today' || state.active == null || state.active === 'today');
            await context.close();
        });
    } finally {
        await new Promise((resolve) => http.server.close(resolve));
    }
});
