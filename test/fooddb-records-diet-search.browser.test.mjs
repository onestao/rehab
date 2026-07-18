// Chromium/Edge regression: records-page diet modal must load fooddb before search.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '..');

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
    if (file.endsWith('.ico')) return 'image/x-icon';
    if (file.endsWith('.png')) return 'image/png';
    if (file.endsWith('.webp')) return 'image/webp';
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
    await new Promise(resolve => {
        server.listen(port, '127.0.0.1', () => resolve(undefined));
    });
    return { server, url: `http://127.0.0.1:${port}/index.html` };
}

function findBrowser() {
    const candidates = [
        process.env.EDGE_PATH || '',
        process.env.CHROME_PATH || '',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/microsoft-edge',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser'
    ].filter(Boolean);
    return candidates.find(file => existsSync(file)) || '';
}

async function fetchJson(url, timeoutMs = 10000) {
    const started = Date.now();
    let lastError = null;
    while (Date.now() - started < timeoutMs) {
        try {
            const res = await fetch(url);
            if (res.ok) return await res.json();
        } catch (e) {
            lastError = e;
        }
        await delay(100);
    }
    throw lastError || new Error(`Timed out fetching ${url}`);
}

class CdpClient {
    constructor(ws) {
        this.ws = ws;
        this.nextId = 1;
        this.pending = new Map();
        this.listeners = new Map();
        ws.addEventListener('message', (event) => {
            const msg = JSON.parse(String(event.data));
            if (msg.id && this.pending.has(msg.id)) {
                const { resolve, reject } = this.pending.get(msg.id);
                this.pending.delete(msg.id);
                if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
                else resolve(msg.result || {});
                return;
            }
            if (msg.method) {
                const list = this.listeners.get(msg.method) || [];
                list.forEach(fn => fn(msg.params || {}));
            }
        });
    }

    static async connect(url) {
        const ws = new WebSocket(url);
        await new Promise((resolve, reject) => {
            ws.addEventListener('open', resolve, { once: true });
            ws.addEventListener('error', reject, { once: true });
        });
        return new CdpClient(ws);
    }

    on(method, fn) {
        if (!this.listeners.has(method)) this.listeners.set(method, []);
        this.listeners.get(method).push(fn);
    }

    send(method, params = {}) {
        const id = this.nextId++;
        this.ws.send(JSON.stringify({ id, method, params }));
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
        });
    }

    waitFor(method, timeoutMs = 30000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeoutMs);
            const fn = (params) => {
                clearTimeout(timer);
                const list = this.listeners.get(method) || [];
                this.listeners.set(method, list.filter(item => item !== fn));
                resolve(params);
            };
            this.on(method, fn);
        });
    }

    close() {
        this.ws.close();
    }
}

async function launchBrowser() {
    const browserPath = findBrowser();
    if (!browserPath) {
        throw new Error('Microsoft Edge or Chrome was not found. Set EDGE_PATH or CHROME_PATH.');
    }
    const debugPort = await freePort();
    const profileDir = path.join(root, 'build', `fooddb-diet-profile-${Date.now()}`);
    await mkdir(profileDir, { recursive: true });
    const args = [
        '--headless=new',
        '--disable-gpu',
        '--disable-extensions',
        '--no-first-run',
        '--no-default-browser-check',
        `--remote-debugging-port=${debugPort}`,
        `--user-data-dir=${profileDir}`,
        'about:blank'
    ];
    const child = spawn(browserPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr.on('data', () => {});
    const version = await fetchJson(`http://127.0.0.1:${debugPort}/json/version`);
    const browser = await CdpClient.connect(version.webSocketDebuggerUrl);
    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
    const targets = await fetchJson(`http://127.0.0.1:${debugPort}/json/list`);
    const target = targets.find(item => item.id === targetId) || targets.find(item => item.type === 'page');
    if (!target?.webSocketDebuggerUrl) throw new Error('Could not create a browser page target.');
    const page = await CdpClient.connect(target.webSocketDebuggerUrl);
    return { child, browser, page, profileDir };
}

async function evaluate(page, expression, awaitPromise = true) {
    const result = await page.send('Runtime.evaluate', {
        expression,
        awaitPromise,
        returnByValue: true,
        userGesture: true
    });
    if (result.exceptionDetails) {
        const text = result.exceptionDetails.exception?.description
            || result.exceptionDetails.text
            || 'evaluate failed';
        throw new Error(text);
    }
    return result.result?.value;
}

async function waitFor(page, expression, timeoutMs = 20000) {
    const started = Date.now();
    let lastError = null;
    while (Date.now() - started < timeoutMs) {
        try {
            const value = await evaluate(page, expression, true);
            if (value) return value;
        } catch (e) {
            lastError = e;
        }
        await delay(100);
    }
    throw lastError || new Error(`Timed out waiting for: ${expression}`);
}

async function exerciseDietSearch(page, entry) {
    return evaluate(page, `(() => {
        const entry = ${JSON.stringify(entry)};
        const errors = [];
        const onError = (event) => {
            const msg = event?.error?.message || event?.message || String(event);
            errors.push(String(msg));
        };
        const onRejection = (event) => {
            const reason = event?.reason;
            errors.push(String(reason?.message || reason || 'unhandledrejection'));
        };
        window.addEventListener('error', onError);
        window.addEventListener('unhandledrejection', onRejection);

        const originalSearchAll = typeof fooddb !== 'undefined' && fooddb.searchAll
            ? fooddb.searchAll.bind(fooddb)
            : null;
        let searchCalls = 0;
        if (originalSearchAll) {
            fooddb.searchAll = function (...args) {
                searchCalls += 1;
                return originalSearchAll(...args);
            };
        }

        try {
            if (entry === 'records') {
                // records path loads health-diet + food-log via PAGE_DEPS; fooddb must come as prereq
            } else if (entry === 'today') {
                // today uses lazy openDietModal scripts including fooddb
            }

            if (typeof data.setDietInputMode === 'function') data.setDietInputMode('manual');
            const foodName = document.getElementById('foodName');
            if (!foodName) throw new Error('foodName input missing');
            foodName.value = '鸡';
            foodName.dispatchEvent(new Event('input', { bubbles: true }));
            data.onFoodSearchInput();

            const suggest = document.getElementById('foodSearchSuggest');
            const html = String(suggest?.innerHTML || '');
            const hasLibraryHit = /applyFoodItem\\(/.test(html) || /food-result-item/.test(html);

            let applied = false;
            const firstIdMatch = html.match(/applyFoodItem\\('([^']+)'\\)/);
            if (firstIdMatch) {
                data.applyFoodItem(firstIdMatch[1]);
                applied = document.getElementById('foodName')?.value === (fooddb.getById?.(firstIdMatch[1])?.name || document.getElementById('foodName')?.value);
            }

            // exact autofill path
            if (typeof fooddb !== 'undefined') {
                const exact = fooddb.getAll().find(item => item.name && item.name.includes('鸡'));
                if (exact) {
                    document.getElementById('foodName').value = exact.name;
                    data.autoFillFoodByName();
                }
            }

            const fooddbType = typeof fooddb;
            const scripts = [...document.querySelectorAll('script[src]')].map(s => s.src);
            const loadedFooddb = scripts.some(src => /fooddb\\.js(?:\\?|$)/.test(src));
            return {
                entry,
                fooddbType,
                loadedFooddb,
                searchCalls: originalSearchAll ? searchCalls : (fooddbType === 'object' ? 1 : 0),
                hasLibraryHit,
                applied,
                suggestHtml: html.slice(0, 300),
                errors: errors.filter(msg => /fooddb is not defined|ReferenceError/i.test(msg)),
                allErrors: errors.slice(0, 8)
            };
        } finally {
            if (originalSearchAll) fooddb.searchAll = originalSearchAll;
            window.removeEventListener('error', onError);
            window.removeEventListener('unhandledrejection', onRejection);
        }
    })()`);
}

test('records and today diet manual search load fooddb without ReferenceError', async (t) => {
    const browserPath = findBrowser();
    if (!browserPath) {
        t.skip('No Chromium/Edge binary available');
        return;
    }

    const { server, url } = await startServer();
    const runtime = await launchBrowser();
    const exceptions = [];
    try {
        const { page, child, browser, profileDir } = runtime;
        page.on('Runtime.exceptionThrown', (event) => {
            exceptions.push(event.exceptionDetails?.text || event.exceptionDetails?.exception?.description || 'runtime exception');
        });
        await page.send('Page.enable');
        await page.send('Runtime.enable');
        await page.send('Network.enable');

        const loaded = page.waitFor('Page.loadEventFired');
        await page.send('Page.navigate', { url });
        await loaded;
        await waitFor(page, `!!(window.data && window.ui && performance.getEntriesByName('boot:first-render', 'measure').length)`, 25000);

        // --- records path ---
        await evaluate(page, `ui.tab('records', document.querySelector('.nav-item[onclick*="records"]'))`);
        await waitFor(page, `document.getElementById('records')?.classList.contains('active')`, 15000);
        await waitFor(page, `typeof data.openDietModal === 'function' && typeof data.onFoodSearchInput === 'function'`, 20000);
        await evaluate(page, `data.openDietModal()`);
        await waitFor(page, `!!document.getElementById('foodName') && !document.getElementById('dietModal')?.classList.contains('hidden')`, 15000);
        await waitFor(page, `typeof fooddb !== 'undefined'`, 10000);
        const recordsResult = await exerciseDietSearch(page, 'records');
        assert.equal(recordsResult.fooddbType, 'object', `records fooddb type: ${recordsResult.fooddbType}`);
        assert.equal(recordsResult.loadedFooddb, true, 'records should request fooddb.js');
        assert.ok(recordsResult.searchCalls >= 1, 'records should call fooddb.searchAll');
        assert.ok(recordsResult.hasLibraryHit, `records suggestions empty: ${recordsResult.suggestHtml}`);
        assert.deepEqual(recordsResult.errors, [], `records fooddb errors: ${recordsResult.errors.join(' | ')}`);
        assert.equal(
            exceptions.some(msg => /fooddb is not defined/i.test(String(msg))),
            false,
            `records runtime exceptions: ${exceptions.join(' | ')}`
        );

        // close modal and exercise today lazy path in a clean navigation
        await evaluate(page, `data.closeDietModal?.() || data.closeDietModalInternal?.()`);
        await evaluate(page, `ui.tab('today', document.querySelector('.nav-item[onclick*="today"]'))`);
        await waitFor(page, `document.getElementById('today')?.classList.contains('active')`, 15000);
        await evaluate(page, `data.openDietModal()`);
        await waitFor(page, `!!document.getElementById('foodName') && !document.getElementById('dietModal')?.classList.contains('hidden')`, 15000);
        await waitFor(page, `typeof fooddb !== 'undefined' && typeof data.onFoodSearchInput === 'function'`, 15000);
        const todayResult = await exerciseDietSearch(page, 'today');
        assert.equal(todayResult.fooddbType, 'object', `today fooddb type: ${todayResult.fooddbType}`);
        assert.ok(todayResult.searchCalls >= 1, 'today should call fooddb.searchAll');
        assert.ok(todayResult.hasLibraryHit, `today suggestions empty: ${todayResult.suggestHtml}`);
        assert.deepEqual(todayResult.errors, [], `today fooddb errors: ${todayResult.errors.join(' | ')}`);

        child.kill('SIGTERM');
        browser.close();
        page.close();
        await rm(profileDir, { recursive: true, force: true }).catch(() => {});
    } finally {
        await new Promise(resolve => server.close(() => resolve(undefined)));
        try { runtime.child.kill('SIGTERM'); } catch {}
        try { runtime.browser.close(); } catch {}
        try { runtime.page.close(); } catch {}
        await rm(runtime.profileDir, { recursive: true, force: true }).catch(() => {});
    }
});
