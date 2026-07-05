// node scripts/edge-perf-smoke.mjs [--url=http://127.0.0.1:8080/index.html]
// Optional budgets: --max-scripts=70 --max-resources=95 --max-long-task-ms=180 --max-transfer-kb=1000
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '..');

function argValue(name, fallback = '') {
    const prefix = `--${name}=`;
    const hit = process.argv.slice(2).find(arg => arg.startsWith(prefix));
    return hit ? hit.slice(prefix.length) : fallback;
}

function numericOption(name, envName, fallback) {
    const raw = argValue(name, process.env[envName] || String(fallback));
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
}

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
    /** @type {string[]} */
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
    ].filter((value) => typeof value === 'string' && value.length > 0);
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
        if (typeof WebSocket !== 'function') {
            throw new Error('This script requires a Node.js runtime with global WebSocket support.');
        }
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

async function launchBrowser(url) {
    const browserPath = findBrowser();
    if (!browserPath) {
        throw new Error('Microsoft Edge or Chrome was not found. Set EDGE_PATH or CHROME_PATH to run this smoke.');
    }
    const debugPort = await freePort();
    const profileDir = path.join(root, 'build', `edge-perf-profile-${Date.now()}`);
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
    return { child, browser, page, profileDir, url };
}

async function collectMetrics(page, url, waitMs) {
    const requests = new Map();
    const exceptions = [];
    page.on('Network.responseReceived', (event) => {
        requests.set(event.requestId, {
            url: event.response?.url || '',
            type: event.type || '',
            status: event.response?.status || 0,
            encodedDataLength: 0
        });
    });
    page.on('Network.loadingFinished', (event) => {
        const item = requests.get(event.requestId);
        if (item) item.encodedDataLength = Number(event.encodedDataLength || 0);
    });
    page.on('Runtime.exceptionThrown', (event) => {
        exceptions.push(event.exceptionDetails?.text || event.exceptionDetails?.exception?.description || 'runtime exception');
    });
    await page.send('Page.enable');
    await page.send('Network.enable');
    await page.send('Runtime.enable');
    await page.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `
            window.__edgePerfLongTasks = [];
            try {
                new PerformanceObserver((list) => {
                    window.__edgePerfLongTasks.push(...list.getEntries().map((entry) => ({
                        name: entry.name,
                        startTime: entry.startTime,
                        duration: entry.duration,
                        attribution: (entry.attribution || []).map((item) => ({
                            name: item.name || '',
                            entryType: item.entryType || '',
                            startTime: item.startTime || 0,
                            duration: item.duration || 0,
                            containerType: item.containerType || '',
                            containerSrc: item.containerSrc || '',
                            containerId: item.containerId || '',
                            containerName: item.containerName || ''
                        }))
                    })));
                }).observe({ type: 'longtask', buffered: true });
            } catch {}
        `
    });
    const loaded = page.waitFor('Page.loadEventFired');
    await page.send('Page.navigate', { url });
    await loaded;
    await waitForRuntime(page, `performance.getEntriesByName('boot:first-render', 'measure').length > 0`, 15000)
        .catch(() => {});
    await delay(waitMs);
    const result = await page.send('Runtime.evaluate', {
        returnByValue: true,
        expression: `(() => {
            const resources = performance.getEntriesByType('resource').map((entry) => ({
                name: entry.name,
                initiatorType: entry.initiatorType,
                transferSize: entry.transferSize || 0,
                startTime: entry.startTime || 0,
                responseEnd: entry.responseEnd || 0,
                duration: entry.duration || 0
            }));
            const scriptUrls = new Set(resources.filter((entry) => entry.initiatorType === 'script').map((entry) => entry.name));
            document.querySelectorAll('script[src]').forEach((script) => scriptUrls.add(script.src));
            const transferSize = resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
            return {
                resources,
                resourceCount: resources.length,
                scriptCount: scriptUrls.size,
                transferSize,
                longTasks: window.__edgePerfLongTasks || [],
                bootMeasures: performance.getEntriesByType('measure')
                    .filter((entry) => entry.name.startsWith('boot:'))
                    .map((entry) => ({ name: entry.name, duration: entry.duration })),
                fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
                largestResources: resources
                    .slice()
                    .sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0))
                    .slice(0, 8),
                slowestResources: resources
                    .slice()
                    .sort((a, b) => (b.duration || 0) - (a.duration || 0))
                    .slice(0, 8)
            };
        })()`
    });
    const metrics = result.result?.value || {};
    metrics.networkTransferSize = [...requests.values()].reduce((sum, item) => sum + Number(item.encodedDataLength || 0), 0);
    metrics.exceptions = exceptions;
    return metrics;
}

async function waitForRuntime(page, expression, timeoutMs) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        const result = await page.send('Runtime.evaluate', {
            expression,
            returnByValue: true
        });
        if (result.result?.value) return true;
        await delay(100);
    }
    throw new Error(`Timed out waiting for runtime expression: ${expression}`);
}

async function main() {
    const explicitUrl = argValue('url');
    const waitMs = numericOption('wait-ms', 'PERF_WAIT_MS', 500);
    const budgets = {
        scripts: numericOption('max-scripts', 'PERF_MAX_SCRIPTS', 70),
        resources: numericOption('max-resources', 'PERF_MAX_RESOURCES', 95),
        longTaskMs: numericOption('max-long-task-ms', 'PERF_MAX_LONG_TASK_MS', 180),
        transferKb: numericOption('max-transfer-kb', 'PERF_MAX_TRANSFER_KB', 1000)
    };
    let server = null;
    let browser = null;
    let profileDir = '';
    try {
        const local = explicitUrl ? { url: explicitUrl } : await startServer();
        server = local.server || null;
        browser = await launchBrowser(local.url);
        profileDir = browser.profileDir;
        const metrics = await collectMetrics(browser.page, local.url, waitMs);
        const resourceTransferKb = Math.round(Number(metrics.transferSize || 0) / 1024);
        const networkTransferKb = Math.round(Number(metrics.networkTransferSize || 0) / 1024);
        const transferKb = resourceTransferKb || networkTransferKb;
        const longTaskMs = Math.round((metrics.longTasks || []).reduce((sum, task) => sum + Number(task.duration || 0), 0));
        const failures = [];
        if (metrics.scriptCount > budgets.scripts) failures.push(`scripts ${metrics.scriptCount} > ${budgets.scripts}`);
        if (metrics.resourceCount > budgets.resources) failures.push(`resources ${metrics.resourceCount} > ${budgets.resources}`);
        if (longTaskMs > budgets.longTaskMs) failures.push(`long task total ${longTaskMs}ms > ${budgets.longTaskMs}ms`);
        if (transferKb > budgets.transferKb) failures.push(`transfer ${transferKb}KB > ${budgets.transferKb}KB`);
        if (metrics.exceptions?.length) failures.push(`runtime exceptions: ${metrics.exceptions.slice(0, 3).join(' | ')}`);
        console.log(JSON.stringify({
            url: local.url,
            scriptCount: metrics.scriptCount,
            resourceCount: metrics.resourceCount,
            longTaskCount: metrics.longTasks?.length || 0,
            longTaskMs,
            longTasks: (metrics.longTasks || []).map(task => ({
                startTime: Math.round(Number(task.startTime || 0)),
                duration: Math.round(Number(task.duration || 0)),
                attribution: task.attribution || []
            })),
            bootMeasures: metrics.bootMeasures,
            fcp: Math.round(metrics.fcp || 0),
            transferKb,
            resourceTransferKb,
            networkTransferKb,
            largestResources: metrics.largestResources,
            slowestResources: metrics.slowestResources,
            budgets
        }, null, 2));
        if (failures.length) {
            console.error(`edge-perf-smoke: FAIL\n${failures.map(item => `  - ${item}`).join('\n')}`);
            process.exitCode = 1;
        } else {
            console.log('edge-perf-smoke: OK');
        }
    } finally {
        try { browser?.page?.close(); } catch {}
        try { browser?.browser?.close(); } catch {}
        if (browser?.child && !browser.child.killed) browser.child.kill();
        if (server) await new Promise(resolve => server.close(resolve));
        if (profileDir) {
            for (let attempt = 0; attempt < 5; attempt += 1) {
                try {
                    await rm(profileDir, { recursive: true, force: true });
                    break;
                } catch (e) {
                    if (attempt === 4) console.warn(`edge-perf-smoke: profile cleanup skipped: ${e?.message || e}`);
                    await delay(150);
                }
            }
        }
    }
}

main().catch((error) => {
    console.error(`edge-perf-smoke: ERROR ${error?.message || error}`);
    process.exitCode = 1;
});
