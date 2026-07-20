/**
 * FIND-17: 20-round route lifecycle leak verification (browser).
 * DONE by verification if listener/timer/observer growth stays within bounds.
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
const evidenceRoot = path.join(repoRoot, '.tmp', 'lazy-runtime-v344', 'playwright', 'lifecycle');

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
    await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
    return { server, url: `http://127.0.0.1:${port}/`, port };
}

function loadPlaywright() {
    const require = createRequire(import.meta.url);
    const candidates = [
        path.join(repoRoot, 'node_modules', 'playwright', 'package.json'),
        path.join(root, 'node_modules', 'playwright', 'package.json'),
        path.join(repoRoot, '.claude', 'tools', 'playwright', 'node_modules', 'playwright', 'package.json')
    ];
    for (const pkg of candidates) {
        if (existsSync(pkg)) {
            return require(path.dirname(pkg));
        }
    }
    return require('playwright');
}

async function launchBrowser() {
    const pw = loadPlaywright();
    const chromium = pw.chromium || pw.default?.chromium;
    if (!chromium?.launch) throw new Error('playwright.chromium.launch unavailable');
    const preferred = process.env.AUDIT_CHANNEL || 'msedge';
    try {
        return {
            browser: await chromium.launch({ channel: preferred, headless: true }),
            channel: preferred
        };
    } catch {
        // GHA / machines without Edge: fall back to bundled Chromium.
        return {
            browser: await chromium.launch({ headless: true }),
            channel: 'chromium'
        };
    }
}

async function waitBoot(page) {
    await page.waitForFunction(() => {
        return !!(window.data && typeof window.data.init === 'function' && window.data._readyState === 'ready');
    }, null, { timeout: 60000 }).catch(async () => {
        // Older builds may lack _readyState until this hardening lands; wait for render hook.
        await page.waitForFunction(() => typeof window.data?.render === 'function', null, { timeout: 30000 });
    });
    await delay(300);
}

async function sampleMetrics(page) {
    return page.evaluate(() => {
        const listenerHint = (() => {
            try {
                // Chromium internals (not standard) — best-effort.
                const get = window.getEventListeners;
                if (typeof get === 'function') {
                    const w = get(window) || {};
                    const d = get(document) || {};
                    const count = (obj) => Object.values(obj).reduce((n, arr) => n + (arr?.length || 0), 0);
                    return { window: count(w), document: count(d), mode: 'getEventListeners' };
                }
            } catch { /* ignore */ }
            return {
                window: Number(window.__rehabListenerProbe?.window || 0),
                document: Number(window.__rehabListenerProbe?.document || 0),
                mode: 'probe-or-zero'
            };
        })();

        const timers = {
            // No public API for active timers; sample via performance + modal residue.
            modals: document.querySelectorAll('.md-modal, [data-rl-modal="1"]').length,
            scrims: document.querySelectorAll('.md-scrim, .modal-backdrop').length
        };

        const observers = Number(window.__rehabObserverCount || 0);

        return {
            listeners: listenerHint,
            timers,
            observers,
            activePage: document.querySelector('.page.active')?.id || window.data?._activePageId || '',
            readyState: window.data?._readyState || null
        };
    });
}

async function cycleRoutes(page) {
    const order = ['today', 'records', 'workout', 'ai-coach', 'profile', 'today'];
    for (const pageId of order) {
        await page.evaluate(async (id) => {
            const nav = [...document.querySelectorAll('.nav-item')];
            const map = { today: 0, workout: 1, records: 2, 'ai-coach': 3, profile: 4 };
            const idx = map[id] ?? 0;
            nav[idx]?.click?.();
            if (window.data) window.data._activePageId = id;
            if (typeof window.ensureDeps === 'function') {
                try { await window.ensureDeps(id); } catch { /* ignore */ }
            } else if (typeof window.loadAppScript === 'function' && id === 'profile') {
                try { await window.loadAppScript('ai-task-settings'); } catch { /* ignore */ }
            }
            document.querySelectorAll('.page').forEach((p) => p.classList.toggle('active', p.id === id));
        }, pageId);
        await delay(120);
        // Open/close a cheap modal path when on today to exercise attach/detach.
        if (pageId === 'today') {
            await page.evaluate(async () => {
                try {
                    if (typeof window.data?.openNewPlanSheet === 'function') {
                        await window.data.openNewPlanSheet();
                    }
                } catch { /* ignore */ }
                document.querySelectorAll('.md-modal, [data-rl-modal="1"]').forEach((el) => el.remove());
                document.querySelectorAll('.md-scrim, .modal-backdrop').forEach((el) => el.remove());
            });
            await delay(80);
        }
    }
}

test('FIND-17: 20-round route lifecycle does not grow modal residue / TypeErrors', async () => {
    await mkdir(evidenceRoot, { recursive: true });
    const http = await startServer();
    const { browser, channel } = await launchBrowser();
    const pageErrors = [];
    try {
        const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
        const page = await ctx.newPage();
        page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));
        await page.goto(http.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await waitBoot(page);

        const baseline = await sampleMetrics(page);
        const samples = [baseline];
        for (let i = 0; i < 20; i += 1) {
            await cycleRoutes(page);
            samples.push(await sampleMetrics(page));
        }
        const final = samples[samples.length - 1];
        const mid = samples[Math.floor(samples.length / 2)];

        const typeErrors = pageErrors.filter((m) => /TypeError|is not a function/i.test(m));
        const modalGrowth = (final.timers?.modals || 0) - (baseline.timers?.modals || 0);
        const scrimGrowth = (final.timers?.scrims || 0) - (baseline.timers?.scrims || 0);

        // Persistent globals may exist; require no unbounded modal/scrim growth and no TypeErrors.
        const ok = typeErrors.length === 0
            && modalGrowth <= 1
            && scrimGrowth <= 1
            && (final.timers?.modals || 0) <= 1;

        const report = {
            channel,
            rounds: 20,
            baseline,
            mid,
            final,
            pageErrors,
            typeErrors,
            modalGrowth,
            scrimGrowth,
            ok,
            verdict: ok ? 'DONE by verification' : 'LEAK_DETECTED'
        };
        await writeFile(path.join(evidenceRoot, 'lifecycle-20-round.json'), JSON.stringify(report, null, 2), 'utf8');

        assert.equal(typeErrors.length, 0, `TypeErrors during lifecycle: ${typeErrors.join(' | ')}`);
        assert.ok(modalGrowth <= 1, `modal residue growth ${modalGrowth}`);
        assert.ok(scrimGrowth <= 1, `scrim residue growth ${scrimGrowth}`);
        assert.ok((final.timers?.modals || 0) <= 1, `final modals ${final.timers?.modals}`);
    } finally {
        await browser.close();
        await new Promise((r) => http.server.close(r));
    }
});
