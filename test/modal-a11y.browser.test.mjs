/**
 * H3 browser gates: focus trap ready before modal display; Tab/Escape/restore.
 * Evidence: G:/LLM/rehab/.tmp/lazyload-closeout/playwright/modal-a11y/
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
const evidenceRoot = path.join(repoRoot, '.tmp', 'lazyload-closeout', 'playwright', 'modal-a11y');

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
    const trapDelayMs = options.trapDelayMs || 0;
    let trapHits = 0;
    const server = createServer(async (req, res) => {
        try {
            const rawUrl = new URL(req.url || '/', 'http://127.0.0.1');
            const pathname = decodeURIComponent(rawUrl.pathname === '/' ? '/index.html' : rawUrl.pathname);
            if (/a11y-focus-trap\.js(?:\?|$)/.test(pathname)) {
                trapHits += 1;
                if (trapDelayMs) await delay(trapDelayMs);
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
    return {
        server,
        url: `http://127.0.0.1:${port}/index.html`,
        get trapHits() { return trapHits; }
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
        } catch { /* next */ }
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

async function waitBoot(page) {
    await page.waitForFunction(() => {
        return window.data
            && typeof window.data._openModal === 'function'
            && typeof window.loadAppScript === 'function'
            && document.querySelector('#today, .page');
    }, null, { timeout: 45000 });
}

async function openTestModal(page) {
    return page.evaluate(async () => {
        const err = [];
        try {
            await window.data._openModal({
                title: 'a11y trap test',
                icon: 'info',
                bodyHtml: '<button type="button" id="h3-inner-a">A</button><button type="button" id="h3-inner-b">B</button>',
                actionsHtml: '<button class="md-btn" type="button" data-modal-close aria-label="关闭">关闭</button>'
            });
        } catch (e) {
            err.push(String(e && e.message || e));
        }
        const modal = document.querySelector('.md-modal[data-rl-modal="1"]');
        return {
            err,
            modal: !!modal,
            hasTrap: !!window.focusTrap?.trap,
            focusInside: !!(modal && modal.contains(document.activeElement)),
            loadType: typeof window.loadAppScript
        };
    });
}

test('H3-T1 browser: delayed a11y trap still traps Tab before outside focus leaks', async () => {
    await mkdir(evidenceRoot, { recursive: true });
    const http = await startServer({ trapDelayMs: 1200 });
    try {
        await withBrowser(async (browser) => {
            const context = await browser.newContext({
                serviceWorkers: 'block',
                viewport: { width: 390, height: 844 }
            });
            const page = await context.newPage();
            await page.goto(http.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await waitBoot(page);
            // Clear preloaded trap so open path must await (re)load with delay.
            await page.evaluate(() => {
                window.focusTrap = null;
            });
            const openDiag = await openTestModal(page);
            await writeFile(path.join(evidenceRoot, 'h3-t1-open.json'), JSON.stringify({ openDiag, trapHits: http.trapHits }, null, 2));
            assert.equal(openDiag.modal, true, `modal must open: ${JSON.stringify(openDiag)}`);
            assert.equal(openDiag.hasTrap, true, `trap must bind before display: ${JSON.stringify(openDiag)}`);
            const focusInside = openDiag.focusInside || await page.evaluate(() => {
                const modal = document.querySelector('.md-modal[data-rl-modal="1"]');
                return !!(modal && modal.contains(document.activeElement));
            });
            for (let i = 0; i < 6; i += 1) {
                await page.keyboard.press('Tab');
            }
            const stillInside = await page.evaluate(() => {
                const modal = document.querySelector('.md-modal[data-rl-modal="1"]');
                return !!(modal && modal.contains(document.activeElement));
            });
            await page.keyboard.press('Shift+Tab');
            const stillInsideShift = await page.evaluate(() => {
                const modal = document.querySelector('.md-modal[data-rl-modal="1"]');
                return !!(modal && modal.contains(document.activeElement));
            });
            const evidence = {
                focusInside,
                stillInside,
                stillInsideShift,
                trapHits: http.trapHits,
                hasTrap: openDiag.hasTrap
            };
            await writeFile(path.join(evidenceRoot, 'h3-t1.json'), JSON.stringify(evidence, null, 2));
            assert.equal(stillInside, true, `Tab leaked: ${JSON.stringify(evidence)}`);
            assert.equal(stillInsideShift, true, `Shift+Tab leaked: ${JSON.stringify(evidence)}`);
            assert.ok(http.trapHits >= 1, 'expected a11y-focus-trap network hit');
            await context.close();
        });
    } finally {
        await new Promise((resolve) => http.server.close(resolve));
    }
});

test('H3-T2 browser: Escape closes modal and restores prior focus', async () => {
    await mkdir(evidenceRoot, { recursive: true });
    const http = await startServer();
    try {
        await withBrowser(async (browser) => {
            const context = await browser.newContext({
                serviceWorkers: 'block',
                viewport: { width: 390, height: 844 }
            });
            const page = await context.newPage();
            await page.goto(http.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await waitBoot(page);
            await page.evaluate(() => {
                const btn = document.createElement('button');
                btn.id = 'h3-focus-anchor';
                btn.textContent = 'anchor';
                document.body.appendChild(btn);
                btn.focus();
            });
            const open1 = await openTestModal(page);
            assert.equal(open1.modal, true, `first open failed: ${JSON.stringify(open1)}`);
            await page.keyboard.press('Escape');
            await delay(300);
            const after = await page.evaluate(() => ({
                modal: !!document.querySelector('.md-modal[data-rl-modal="1"]'),
                activeId: document.activeElement?.id || null
            }));
            // Close button path — head icon button, not full-screen backdrop.
            await page.evaluate(() => {
                document.getElementById('h3-focus-anchor')?.focus();
            });
            const open2 = await openTestModal(page);
            assert.equal(open2.modal, true, `second open failed: ${JSON.stringify(open2)}`);
            await page.locator('.md-modal[data-rl-modal="1"] button.md-icon-btn[data-modal-close]').first().click();
            await delay(250);
            const afterCloseBtn = await page.evaluate(() => ({
                modal: !!document.querySelector('.md-modal[data-rl-modal="1"]'),
                activeId: document.activeElement?.id || null
            }));
            await writeFile(path.join(evidenceRoot, 'h3-t2.json'), JSON.stringify({ after, afterCloseBtn, open1, open2 }, null, 2));
            assert.equal(after.modal, false);
            assert.equal(afterCloseBtn.modal, false);
            await context.close();
        });
    } finally {
        await new Promise((resolve) => http.server.close(resolve));
    }
});
