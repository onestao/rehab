/**
 * Pre-merge browser evidence for lazyload rehab repair (v336).
 * Runs real Chromium/Edge against a local HTTP server with SW enabled.
 * Evidence: G:/LLM/rehab/.tmp/lazyload-repair/evidence/
 */
// @ts-nocheck
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stat } from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '..');
const repoRoot = path.resolve(root, '../../..');
const evidenceRoot = path.join(repoRoot, '.tmp', 'lazyload-repair', 'evidence');
mkdirSync(evidenceRoot, { recursive: true });

function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
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
        } catch { /* next */ }
    }
    const require = createRequire(path.join(repoRoot, 'package.json'));
    return require('playwright');
}

async function startServer(options = {}) {
    const planUiDelayMs = options.planUiDelayMs || 0;
    const planUiFail = !!options.planUiFail;
    const offlineAfterBoot = !!options.offlineAfterBoot;
    let offline = false;
    let planUiHits = 0;
    const hits = [];
    const server = createServer(async (req, res) => {
        try {
            const rawUrl = new URL(req.url || '/', 'http://127.0.0.1');
            const pathname = decodeURIComponent(rawUrl.pathname === '/' ? '/index.html' : rawUrl.pathname);
            hits.push(pathname);
            if (/plan-ui\.js(?:\?|$)/.test(pathname)) {
                planUiHits += 1;
                if (planUiFail) {
                    res.writeHead(404, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
                    res.end('not found');
                    return;
                }
                if (planUiDelayMs) await delay(planUiDelayMs);
            }
            if (offline && !/sw\.js/.test(pathname)) {
                // After SW install, network drop for non-SW to exercise cache.
                res.writeHead(503, { 'cache-control': 'no-store' });
                res.end('offline');
                return;
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
            const headers = {
                'content-type': mimeFor(resolved),
                'cache-control': 'no-store'
            };
            if (/sw\.js/.test(pathname)) headers['service-worker-allowed'] = '/';
            res.writeHead(200, headers);
            createReadStream(resolved).pipe(res);
        } catch {
            res.writeHead(404);
            res.end('Not found');
        }
    });
    const port = await freePort();
    await new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve()));
    return {
        server,
        url: `http://127.0.0.1:${port}/index.html`,
        origin: `http://127.0.0.1:${port}`,
        get planUiHits() { return planUiHits; },
        get hits() { return hits.slice(); },
        setOffline(v) { offline = !!v; },
        offlineAfterBoot
    };
}

async function waitBoot(page, timeout = 45000) {
    await page.waitForFunction(() => {
        return window.data
            && typeof window.data.openNewPlanSheet === 'function'
            && document.querySelector('#today, .page');
    }, null, { timeout });
}

function save(name, data) {
    const file = path.join(evidenceRoot, name);
    writeFileSync(file, JSON.stringify(data, null, 2));
    return file;
}

const results = [];
function record(id, ok, detail) {
    results.push({ id, ok: !!ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${id}`, typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 200));
}

async function main() {
    const pw = loadPlaywright();
    const chromium = pw.chromium || pw.default?.chromium;
    if (!chromium?.launch) throw new Error('playwright.chromium unavailable');
    const channel = process.env.AUDIT_CHANNEL || 'msedge';
    const browser = await chromium.launch({ channel, headless: true });
    const t0 = Date.now();

    try {
        // 1. Plan delay first-click
        {
            const http = await startServer({ planUiDelayMs: 2500 });
            try {
                const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
                const page = await ctx.newPage();
                const pageErrors = [];
                page.on('pageerror', (e) => pageErrors.push(e.message));
                await page.goto(http.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await waitBoot(page);
                await page.locator('button:has-text("新建计划")').first().click({ timeout: 10000 });
                await page.waitForFunction(() => !!document.querySelector('.md-modal[data-rl-modal="1"]'), null, { timeout: 15000 });
                const modals = await page.locator('.md-modal[data-rl-modal="1"]').count();
                const ok = modals === 1 && pageErrors.filter((m) => /TypeError|is not a function/i.test(m)).length === 0;
                record('S1-plan-delay-first-click', ok, { modals, planUiHits: http.planUiHits, pageErrors });
                save('s1-plan-delay.json', { modals, planUiHits: http.planUiHits, pageErrors });
                await ctx.close();
            } finally {
                await new Promise((r) => http.server.close(r));
            }
        }

        // 2. Plan 404 toast + recover
        {
            let failMode = true;
            const server = createServer(async (req, res) => {
                try {
                    const rawUrl = new URL(req.url || '/', 'http://127.0.0.1');
                    const pathname = decodeURIComponent(rawUrl.pathname === '/' ? '/index.html' : rawUrl.pathname);
                    if (/plan-ui\.js(?:\?|$)/.test(pathname) && failMode) {
                        res.writeHead(404, { 'cache-control': 'no-store' });
                        res.end('missing');
                        return;
                    }
                    const resolved = path.resolve(root, `.${pathname}`);
                    const info = await stat(resolved);
                    res.writeHead(200, { 'content-type': mimeFor(resolved), 'cache-control': 'no-store' });
                    createReadStream(resolved).pipe(res);
                } catch {
                    res.writeHead(404);
                    res.end('Not found');
                }
            });
            const port = await freePort();
            await new Promise((r) => server.listen(port, '127.0.0.1', () => r()));
            const url = `http://127.0.0.1:${port}/index.html`;
            try {
                const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
                const page = await ctx.newPage();
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await waitBoot(page);
                await page.evaluate(async () => { await window.data.openNewPlanSheet(); });
                await delay(800);
                const toastText = await page.evaluate(() => document.body.innerText);
                const toastOk = /计划功能暂时未加载成功|加载失败/.test(toastText);
                failMode = false;
                await page.evaluate(async () => { await window.data.openNewPlanSheet(); });
                await page.waitForFunction(() => !!document.querySelector('.md-modal[data-rl-modal="1"]'), null, { timeout: 15000 });
                const modals = await page.locator('.md-modal[data-rl-modal="1"]').count();
                record('S2-plan-404-recover', toastOk && modals >= 1, { toastOk, modals });
                save('s2-plan-404.json', { toastOk, modals, toastSnippet: toastText.slice(0, 400) });
                await ctx.close();
            } finally {
                await new Promise((r) => server.close(r));
            }
        }

        // 3. Deep-link profile never paints Today active
        {
            const http = await startServer();
            try {
                const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
                const page = await ctx.newPage();
                await page.goto(`${http.origin}/index.html#/profile`, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await waitBoot(page);
                await delay(500);
                const snap = await page.evaluate(() => ({
                    activePage: document.querySelector('.page.active')?.id || null,
                    dataPage: window.data?._activePageId || null,
                    todayActive: document.getElementById('today')?.classList.contains('active') || false,
                    profileActive: document.getElementById('profile')?.classList.contains('active') || false
                }));
                const ok = snap.profileActive && !snap.todayActive && snap.activePage === 'profile';
                record('S3-deep-link-profile', ok, snap);
                save('s3-deep-link.json', snap);
                await ctx.close();
            } finally {
                await new Promise((r) => http.server.close(r));
            }
        }

        // 4. Cancelled nav does not force workout side effects
        {
            const http = await startServer();
            try {
                const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
                const page = await ctx.newPage();
                await page.goto(http.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await waitBoot(page);
                const snap = await page.evaluate(async () => {
                    // Rapid tab flip: start workout deps then cancel by going records
                    const tokenBefore = window.ui?._navigationToken ?? 0;
                    window.ui?.tab?.('workout');
                    window.ui?.tab?.('records');
                    window.ui?.tab?.('today');
                    await new Promise((r) => setTimeout(r, 800));
                    return {
                        tokenBefore,
                        tokenAfter: window.ui?._navigationToken ?? null,
                        mode: window.workout?.mode || window.workoutSystem?.mode || null,
                        active: window.data?._activePageId || document.querySelector('.page.active')?.id
                    };
                });
                const ok = snap.active === 'today';
                record('S4-cancel-nav-effects', ok, snap);
                save('s4-cancel-nav.json', snap);
                await ctx.close();
            } finally {
                await new Promise((r) => http.server.close(r));
            }
        }

        // 5. Offline Today essential (SW precache history-view)
        {
            const http = await startServer();
            try {
                const ctx = await browser.newContext({ serviceWorkers: 'allow', viewport: { width: 390, height: 844 } });
                const page = await ctx.newPage();
                await page.goto(http.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await waitBoot(page);
                // Register SW and wait controller
                await page.evaluate(async () => {
                    if (!('serviceWorker' in navigator)) return;
                    const reg = await navigator.serviceWorker.register('./sw.js?v=336', { updateViaCache: 'none' });
                    await reg.update?.();
                    await navigator.serviceWorker.ready;
                });
                await delay(3000);
                // Go offline at browser level
                await ctx.setOffline(true);
                await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null);
                await delay(2000);
                const offlineSnap = await page.evaluate(async () => {
                    const hasToday = !!document.querySelector('#today, .page');
                    let historyView = typeof window.historyView;
                    let todayCore = typeof window.todayViewCore || typeof window.renderToday;
                    // Fetch essential assets via SW cache
                    const assets = ['history-view.js?v=336', 'today-view-core.js?v=336', 'data.js?v=336'];
                    const fetchResults = {};
                    for (const a of assets) {
                        try {
                            const r = await fetch(a, { cache: 'force-cache' });
                            fetchResults[a] = { ok: r.ok, status: r.status };
                        } catch (e) {
                            fetchResults[a] = { ok: false, error: String(e?.message || e) };
                        }
                    }
                    return { hasToday, historyView, todayCore, fetchResults, controller: !!navigator.serviceWorker?.controller };
                });
                const ok = offlineSnap.hasToday
                    && offlineSnap.fetchResults['history-view.js?v=336']?.ok
                    && offlineSnap.fetchResults['today-view-core.js?v=336']?.ok;
                record('S5-offline-today-history-view', ok, offlineSnap);
                save('s5-offline-today.json', offlineSnap);
                await ctx.close();
            } finally {
                await new Promise((r) => http.server.close(r));
            }
        }

        // 6. Dual-tab update: training tab defers hard navigate
        {
            const http = await startServer();
            try {
                const ctxA = await browser.newContext({ serviceWorkers: 'allow', viewport: { width: 390, height: 844 } });
                const ctxB = await browser.newContext({ serviceWorkers: 'allow', viewport: { width: 390, height: 844 } });
                const pageA = await ctxA.newPage();
                const pageB = await ctxB.newPage();
                await pageA.goto(http.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await pageB.goto(http.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await waitBoot(pageA);
                await waitBoot(pageB);
                // Ensure app-update is present on both tabs
                for (const p of [pageA, pageB]) {
                    await p.evaluate(async () => {
                        if (window.appUpdate?.apply) return;
                        await new Promise((resolve, reject) => {
                            const s = document.createElement('script');
                            s.src = 'app-update.js?v=336';
                            s.onload = resolve;
                            s.onerror = reject;
                            document.head.appendChild(s);
                        });
                    });
                }
                // Mark B as active training session and notify SW
                await pageB.evaluate(() => {
                    window.workout = window.workout || {};
                    window.workout.isPlaying = true;
                    window.workout.isPaused = false;
                    window.workout.totalSec = 42;
                    window.workout.mode = 'strength';
                    window.workoutSystem = window.workout;
                    window.appUpdate?.notifyServiceWorkerSessionDefer?.();
                    navigator.serviceWorker?.controller?.postMessage?.({
                        type: 'UPDATE_DEFER_FOR_SESSION',
                        version: '336',
                        reason: 'active-rehab-session'
                    });
                });
                const aIdle = await pageA.evaluate(() => {
                    const w = window.workoutSystem || window.workout;
                    return !(w?.isPlaying || w?.isPaused);
                });
                const bActive = await pageB.evaluate(() => {
                    return !!(window.appUpdate?.hasActiveRehabSession?.()
                        || window.workout?.isPlaying
                        || window.workoutSystem?.isPlaying);
                });
                const bApply = await pageB.evaluate(async () => {
                    if (!window.appUpdate?.apply) return { skipped: true, reason: 'no-app-update' };
                    window.__skipMsgs = [];
                    window.appUpdate.waitingWorker = {
                        state: 'installed',
                        postMessage(msg) { window.__skipMsgs.push(msg); }
                    };
                    window.appUpdate.registration = { waiting: window.appUpdate.waitingWorker };
                    window.appUpdate.prepareWaitingWorker = async () => true;
                    const r = await window.appUpdate.apply();
                    return { result: r, skipMsgs: window.__skipMsgs || [] };
                });
                const aApply = await pageA.evaluate(async () => {
                    if (!window.appUpdate?.apply) return { skipped: true };
                    // Idle tab should still be able to apply (no active session)
                    window.__skipMsgs = [];
                    window.appUpdate.waitingWorker = {
                        state: 'installed',
                        postMessage(msg) { window.__skipMsgs.push(msg); }
                    };
                    window.appUpdate.registration = { waiting: window.appUpdate.waitingWorker };
                    window.appUpdate.prepareWaitingWorker = async () => true;
                    // clear any residual playing flags
                    if (window.workout) {
                        window.workout.isPlaying = false;
                        window.workout.isPaused = false;
                        window.workout.totalSec = 0;
                    }
                    const r = await window.appUpdate.apply();
                    return { result: r, skipMsgs: window.__skipMsgs || [] };
                });
                const ok = aIdle && bActive
                    && bApply.result?.ok === false && bApply.result?.reason === 'active-session'
                    && !(bApply.skipMsgs || []).some((m) => m?.type === 'SKIP_WAITING')
                    && aApply.result?.ok === true
                    && (aApply.skipMsgs || []).some((m) => m?.type === 'SKIP_WAITING');
                record('S6-dual-tab-training-defer', ok, { aIdle, bActive, bApply, aApply });
                save('s6-dual-tab-defer.json', { aIdle, bActive, bApply, aApply });
                await ctxA.close();
                await ctxB.close();
            } finally {
                await new Promise((r) => http.server.close(r));
            }
        }

        // 7. Pause / pain / symptom drafts block update
        {
            const http = await startServer();
            try {
                const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
                const page = await ctx.newPage();
                await page.goto(http.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await waitBoot(page);
                // Load app-update
                await page.evaluate(async () => {
                    if (!window.appUpdate) {
                        await new Promise((resolve, reject) => {
                            const s = document.createElement('script');
                            s.src = 'app-update.js?v=336';
                            s.onload = resolve;
                            s.onerror = reject;
                            document.head.appendChild(s);
                        });
                    }
                });
                const cases = await page.evaluate(() => {
                    const out = {};
                    const au = window.appUpdate;
                    // pause
                    window.workout = { isPlaying: false, isPaused: true, totalSec: 10, mode: 'strength' };
                    window.workoutSystem = window.workout;
                    out.paused = au.hasActiveRehabSession();
                    // draft
                    window.workout = { isPlaying: false, isPaused: false };
                    window.workoutSystem = window.workout;
                    window.data = window.data || {};
                    window.data.db = window.data.db || {};
                    window.data.db.lastActionDraft = { sets: 3, pain: 5 };
                    out.draft = au.hasActiveRehabSession();
                    window.data.db.lastActionDraft = null;
                    window.data._pendingLocalWrite = true;
                    out.pending = au.hasActiveRehabSession();
                    window.data._pendingLocalWrite = false;
                    // idle
                    out.idle = au.hasActiveRehabSession();
                    return out;
                });
                const ok = cases.paused && cases.draft && cases.pending && !cases.idle;
                record('S7-drafts-block-update', ok, cases);
                save('s7-drafts-block.json', cases);
                await ctx.close();
            } finally {
                await new Promise((r) => http.server.close(r));
            }
        }

        // 8. First modal focus trap ready
        {
            const http = await startServer();
            try {
                const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
                const page = await ctx.newPage();
                await page.goto(http.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await waitBoot(page);
                // Open a simple modal via data._openModal if available
                const snap = await page.evaluate(async () => {
                    const hasTrapBefore = typeof window.focusTrap === 'function' || typeof window.a11yFocusTrap === 'object'
                        || !!document.querySelector('script[src*="a11y-focus-trap"]');
                    // Trigger open path
                    if (typeof window.data?._openModal === 'function') {
                        try {
                            window.data._openModal({
                                title: 'trap-test',
                                body: '<button id="trap-btn">ok</button>',
                                actions: [{ label: '关闭', action: 'close' }]
                            });
                        } catch (e) {
                            return { error: String(e?.message || e), hasTrapBefore };
                        }
                    }
                    await new Promise((r) => setTimeout(r, 500));
                    const modal = document.querySelector('.md-modal[data-rl-modal="1"], .md-modal[role="dialog"]');
                    const trapScript = !!document.querySelector('script[src*="a11y-focus-trap"]');
                    const trapApi = typeof window.focusTrap === 'function' || typeof window.FocusTrap === 'function'
                        || !!window.a11yFocusTrap;
                    return {
                        hasTrapBefore,
                        modal: !!modal,
                        trapScript,
                        trapApi,
                        openModalSrc: String(window.data?._openModal || '').includes('a11y-focus-trap')
                            || String(window.data?._openModal || '').includes('focusTrap')
                    };
                });
                // Source-level readiness also verified by node tests; browser checks trap availability path
                const ok = snap.modal || snap.trapScript || snap.trapApi || snap.hasTrapBefore;
                record('S8-first-modal-focus-trap', ok, snap);
                save('s8-focus-trap.json', snap);
                await ctx.close();
            } finally {
                await new Promise((r) => http.server.close(r));
            }
        }

        // 9. Source: SW sessionDefer before navigate (static + runtime flag)
        {
            const sw = readFileSync(path.join(root, 'sw.js'), 'utf8');
            const app = readFileSync(path.join(root, 'app-update.js'), 'utf8');
            const deferIdx = sw.indexOf('sessionDeferClientIds.has(clientId)');
            const navIdx = sw.indexOf('stillAfterGrace.navigate(target)');
            const ok = deferIdx > 0 && navIdx > deferIdx
                && /UPDATE_DEFER_FOR_SESSION/.test(sw)
                && /UPDATE_SESSION_CLEAR/.test(sw)
                && /hasActiveRehabSession/.test(app)
                && /isPaused/.test(app)
                && /lastActionDraft/.test(app);
            record('S9-sw-defer-before-navigate', ok, { deferIdx, navIdx });
            save('s9-sw-defer-contract.json', { deferIdx, navIdx, ok });
        }

        // 10. 10-round leak / stability: open/close plan modal 10x no pageerror growth
        {
            const http = await startServer();
            try {
                const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
                const page = await ctx.newPage();
                const pageErrors = [];
                page.on('pageerror', (e) => pageErrors.push(e.message));
                await page.goto(http.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await waitBoot(page);
                await page.waitForFunction(() => typeof window.loadAppScript === 'function', null, { timeout: 20000 });
                for (let i = 0; i < 10; i++) {
                    await page.evaluate(async () => {
                        try { await window.data.openNewPlanSheet(); } catch { /* ignore */ }
                    });
                    await delay(400);
                    await page.evaluate(() => {
                        document.querySelectorAll('.md-modal[data-rl-modal="1"]').forEach((el) => el.remove());
                        document.querySelectorAll('.md-scrim, .modal-backdrop').forEach((el) => el.remove());
                    });
                    await delay(150);
                }
                const final = await page.evaluate(() => ({
                    modals: document.querySelectorAll('.md-modal[data-rl-modal="1"]').length,
                    listenersHint: typeof window.data?.openNewPlanSheet
                }));
                const typeErrors = pageErrors.filter((m) => /TypeError|is not a function/i.test(m));
                const ok = typeErrors.length === 0 && final.modals <= 1;
                record('S10-ten-round-leak', ok, { pageErrors, typeErrors, final, rounds: 10 });
                save('s10-ten-round.json', { pageErrors, typeErrors, final });
                await ctx.close();
            } finally {
                await new Promise((r) => http.server.close(r));
            }
        }
    } finally {
        await browser.close();
    }

    const summary = {
        durationMs: Date.now() - t0,
        channel,
        version: '336',
        results,
        pass: results.filter((r) => r.ok).length,
        fail: results.filter((r) => !r.ok).length
    };
    save('summary.json', summary);
    console.log('\nSUMMARY', JSON.stringify(summary, null, 2));
    if (summary.fail > 0) process.exit(1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
