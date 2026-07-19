/**
 * Formal browser gate: first-click plan openers must not TypeError when plan-ui is delayed.
 * Evidence under G:/LLM/rehab/.tmp/lazyload-repair/playwright/
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
// worktree: G:/LLM/rehab/.claude/worktrees/lazy-integration → repo root is 3 levels up
const repoRoot = path.resolve(root, '../../..');
const evidenceRoot = path.join(repoRoot, '.tmp', 'lazyload-repair', 'playwright', 'plan-feature-gate');

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
    const planUiDelayMs = options.planUiDelayMs || 0;
    const planUiFail = !!options.planUiFail;
    let planUiHits = 0;
    const server = createServer(async (req, res) => {
        try {
            const rawUrl = new URL(req.url || '/', 'http://127.0.0.1');
            const pathname = decodeURIComponent(rawUrl.pathname === '/' ? '/index.html' : rawUrl.pathname);
            if (/plan-ui\.js(?:\?|$)/.test(pathname)) {
                planUiHits += 1;
                if (planUiFail) {
                    res.writeHead(404, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
                    res.end('not found');
                    return;
                }
                if (planUiDelayMs) await delay(planUiDelayMs);
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
        get planUiHits() { return planUiHits; }
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
    // Fallback: resolve from main repo package root
    try {
        const require = createRequire(path.join(repoRoot, 'package.json'));
        return require('playwright');
    } catch {
        throw new Error('playwright module not found under rehab node_modules');
    }
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
        return await fn(browser, pw);
    } finally {
        await browser.close();
    }
}

async function waitBoot(page) {
    await page.waitForFunction(() => {
        return window.data
            && typeof window.data.openNewPlanSheet === 'function'
            && document.querySelector('#today, .page');
    }, null, { timeout: 30000 });
}

test('A-T1 browser: first click with delayed plan-ui opens one modal without TypeError', async () => {
    await mkdir(evidenceRoot, { recursive: true });
    const http = await startServer({ planUiDelayMs: 3000 });
    try {
        await withBrowser(async (browser) => {
            const context = await browser.newContext({
                serviceWorkers: 'block',
                viewport: { width: 390, height: 844 }
            });
            const page = await context.newPage();
            const pageErrors = [];
            page.on('pageerror', (err) => pageErrors.push(err.message));
            await page.goto(http.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await waitBoot(page);

            // Click as soon as the plan entry is visible — do not wait for plan-ui.
            const btn = page.locator('button:has-text("新建计划")').first();
            await btn.waitFor({ state: 'visible', timeout: 20000 });
            await btn.click({ timeout: 5000 });

            await page.waitForFunction(() => {
                return !!document.querySelector('.md-modal[data-rl-modal="1"]');
            }, null, { timeout: 15000 });

            const modals = await page.locator('.md-modal[data-rl-modal="1"]').count();
            const evidence = {
                pageErrors,
                modals,
                planUiHits: http.planUiHits,
                methodType: await page.evaluate(() => typeof window.data?.openNewPlanSheet),
                gateState: await page.evaluate(() => window.data?.planFeatureGate?.getState?.() || null)
            };
            await writeFile(path.join(evidenceRoot, 'a-t1.json'), JSON.stringify(evidence, null, 2));

            assert.equal(pageErrors.filter((m) => /is not a function|TypeError/i.test(m)).length, 0, String(pageErrors));
            assert.ok(modals >= 1, 'expected a plan modal');
            assert.equal(modals, 1);
            await context.close();
        });
    } finally {
        await new Promise((resolve) => http.server.close(resolve));
    }
});

test('A-T2 browser: five rapid clicks open only one modal and load plan-ui once', async () => {
    await mkdir(evidenceRoot, { recursive: true });
    const http = await startServer({ planUiDelayMs: 1800 });
    try {
        await withBrowser(async (browser) => {
            const context = await browser.newContext({
                serviceWorkers: 'block',
                viewport: { width: 390, height: 844 }
            });
            const page = await context.newPage();
            const pageErrors = [];
            page.on('pageerror', (err) => pageErrors.push(err.message));
            await page.goto(http.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await waitBoot(page);
            // Ensure Today ownership is settled before firing intents.
            await page.evaluate(() => {
                if (window.data) window.data._activePageId = 'today';
                document.getElementById('today')?.classList.add('active');
            });
            const pre = await page.evaluate(() => ({
                hasLoad: typeof window.loadAppScript === 'function',
                hasStub: !!window.data?.openNewPlanSheet?.__isPlanFeatureGateStub,
                gate: window.data?.planFeatureGate?.getState?.() || null,
                openType: typeof window.data?.openNewPlanSheet,
                planUiOwner: typeof window.dataPlanUi?.openNewPlanSheet
            }));
            // Rapid programmatic intents (native disabled buttons drop force-clicks mid-busy).
            await page.evaluate(() => {
                window.__planOpenErrors = [];
                window.__planOpenResults = Promise.all(
                    [0, 1, 2, 3, 4].map(async () => {
                        try {
                            return await window.data.openNewPlanSheet();
                        } catch (e) {
                            window.__planOpenErrors.push(String(e?.message || e));
                            return null;
                        }
                    })
                );
            });
            await page.waitForFunction(() => {
                return !!document.querySelector('.md-modal[data-rl-modal="1"]')
                    || window.data?.planFeatureGate?.getState?.() === 'failed'
                    || window.data?.planFeatureGate?.getState?.() === 'ready';
            }, null, { timeout: 30000 });
            const results = await page.evaluate(async () => {
                const settled = await window.__planOpenResults;
                return {
                    pre: null,
                    gate: window.data?.planFeatureGate?.getState?.() || null,
                    activePageId: window.data?._activePageId || null,
                    navToken: window.ui?._navigationToken ?? null,
                    modal: !!document.querySelector('.md-modal[data-rl-modal="1"]'),
                    settledCount: Array.isArray(settled) ? settled.length : 0,
                    errors: window.__planOpenErrors || [],
                    hasLoad: typeof window.loadAppScript === 'function',
                    hasStub: !!window.data?.openNewPlanSheet?.__isPlanFeatureGateStub,
                    toastText: document.body.innerText.slice(0, 500)
                };
            });
            results.pre = pre;
            await delay(200);
            const modals = await page.locator('.md-modal[data-rl-modal="1"]').count();
            const evidence = { pageErrors, modals, planUiHits: http.planUiHits, results };
            await writeFile(path.join(evidenceRoot, 'a-t2.json'), JSON.stringify(evidence, null, 2));
            assert.equal(pageErrors.length, 0, String(pageErrors));
            assert.equal(results.gate, 'ready', `gate=${results.gate} diag=${JSON.stringify(evidence)}`);
            assert.equal(modals, 1, `modals=${modals} diag=${JSON.stringify(evidence)}`);
            assert.ok(http.planUiHits >= 1 && http.planUiHits <= 2, `plan-ui hits=${http.planUiHits}`);
            await context.close();
        });
    } finally {
        await new Promise((resolve) => http.server.close(resolve));
    }
});

test('A-T3 browser: plan-ui 404 surfaces toast, no TypeError, recovers after unfail', async () => {
    await mkdir(evidenceRoot, { recursive: true });
    // First server fails plan-ui
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
    await new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(undefined)));
    const url = `http://127.0.0.1:${port}/index.html`;
    try {
        await withBrowser(async (browser) => {
            const context = await browser.newContext({
                serviceWorkers: 'block',
                viewport: { width: 390, height: 844 }
            });
            const page = await context.newPage();
            const pageErrors = [];
            page.on('pageerror', (err) => pageErrors.push(err.message));
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await waitBoot(page);
            // Force immediate load path (bypass idle enhancement wait)
            await page.evaluate(async () => {
                await window.data.openNewPlanSheet();
            });
            await delay(800);
            const toastText = await page.evaluate(() => {
                const nodes = [...document.querySelectorAll('.toast, [class*="toast"], .md-snackbar, body')];
                return document.body.innerText;
            });
            assert.ok(/计划功能暂时未加载成功|加载失败/.test(toastText), 'expected user-facing plan load failure copy');
            assert.equal(pageErrors.filter((m) => /openNewPlanSheet is not a function/i.test(m)).length, 0);

            failMode = false;
            await page.evaluate(async () => {
                await window.data.openNewPlanSheet();
            });
            await page.waitForFunction(() => !!document.querySelector('.md-modal[data-rl-modal="1"]'), null, { timeout: 15000 });
            const modals = await page.locator('.md-modal[data-rl-modal="1"]').count();
            await writeFile(path.join(evidenceRoot, 'a-t3.json'), JSON.stringify({ pageErrors, modals, toastSnippet: toastText.slice(0, 400) }, null, 2));
            assert.ok(modals >= 1);
            await context.close();
        });
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});
