// @ts-nocheck
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(root, '../..');

function loadPlaywright() {
    const candidates = [
        path.join(repoRoot, 'node_modules', 'playwright', 'package.json'),
        path.join(root, 'node_modules', 'playwright', 'package.json'),
        path.join(repoRoot, '.claude', 'tools', 'playwright', 'node_modules', 'playwright', 'package.json')
    ];
    for (const pkg of candidates) {
        if (!existsSync(pkg)) continue;
        try { return createRequire(pkg)('playwright'); } catch {}
    }
    return createRequire(path.join(repoRoot, 'package.json'))('playwright');
}

async function freePort() {
    return await new Promise((resolve, reject) => {
        const server = net.createServer();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            server.close(() => resolve(typeof address === 'object' && address ? address.port : 0));
        });
    });
}

function mime(file) {
    if (file.endsWith('.js') || file.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
    if (file.endsWith('.css')) return 'text/css; charset=utf-8';
    if (file.endsWith('.woff2')) return 'font/woff2';
    return 'text/html; charset=utf-8';
}

async function startServer() {
    const server = createServer(async (req, res) => {
        try {
            const pathname = decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname);
            if (pathname === '/__test__') {
                res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
                res.end('<!doctype html><html><body></body></html>');
                return;
            }
            const file = path.resolve(root, `.${pathname}`);
            if (!file.startsWith(root) || !(await stat(file)).isFile()) throw new Error('not found');
            res.writeHead(200, { 'content-type': mime(file), 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
            createReadStream(file).pipe(res);
        } catch {
            res.writeHead(404, { 'content-type': 'text/plain' });
            res.end('not found');
        }
    });
    const port = await freePort();
    await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
    return { server, base: `http://127.0.0.1:${port}` };
}

async function withPage(viewport, run) {
    const { server, base } = await startServer();
    const pw = loadPlaywright();
    let browser;
    let channel = process.env.AUDIT_CHANNEL || 'msedge';
    try { browser = await pw.chromium.launch({ channel, headless: true }); }
    catch (error) {
        if (process.env.AUDIT_CHANNEL || !String(error?.message || '').includes("distribution 'msedge' is not found")) throw error;
        channel = 'chromium';
        browser = await pw.chromium.launch({ headless: true });
    }
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.goto(`${base}/__test__`);
    try { return await run(page, context, base, channel); }
    finally { await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve)); }
}

async function loadModules(page, base, names) {
    for (const name of names) {
        await page.addScriptTag({ url: `${base}/${name}`, type: name.endsWith('.mjs') ? 'module' : undefined });
        if (name.endsWith('.mjs')) await page.waitForFunction(() => !!window.searchPolicyPure);
    }
}

function shell(base) {
    return `<!doctype html><html><head><link rel="stylesheet" href="${base}/build/generated.css"></head><body>
        <div id="aiTaskSettingsMatrix"></div>
        <div id="aiModelCacheStatus"></div>
        <div id="searchProviderManager" class="hidden" aria-hidden="true"><div id="searchProviderManagerBody"></div></div>
        <div id="searchProviderSummary"></div>
        <div id="aiModelPickerSheet" class="hidden"><div class="md-modal-sheet-card"><div class="md-modal-head"><strong></strong></div><div id="aiModelPickerContent"></div></div></div>
        <div id="persistedEvidence"></div>
    </body></html>`;
}

test('provider manager exposes Sprint 2 providers and correct credential fields', async () => {
    await withPage({ width: 390, height: 844 }, async (page, _context, base) => {
        await page.setContent(shell(base));
        await page.evaluate(() => {
            window.searchStore = {
                async init() {}, getProviders: () => [], apiKeyFor: () => '',
                async saveProvider() {}, async archiveProvider() {}, async removeProvider() {}, async moveProvider() {}
            };
            window.searchRegistry = { nativeCapabilityState: () => ({ usable: false, reason: 'test', actions: [] }) };
            window.searchAdapters = { async test() {} };
            window.ai = {};
        });
        await loadModules(page, base, ['search-policy-pure.mjs', 'search-settings.js']);
        await page.evaluate(() => {
            document.getElementById('searchProviderManager').classList.remove('hidden');
            window.searchSettings.edit({ id: 'new', name: 'New', type: 'tavily', enabled: true, options: {} });
        });
        const options = await page.locator('select[name="类型"] option').allTextContents();
        for (const label of ['Exa', 'Jina Search / Reader', 'Serper', 'DuckDuckGo Instant Answers（实验）']) assert.ok(options.includes(label), label);
        await page.locator('select[name="类型"]').selectOption('duckduckgo');
        assert.equal(await page.locator('input[name^="API Key"]').evaluate(node => node.closest('label').hidden), true);
        await page.locator('select[name="类型"]').selectOption('jina');
        assert.equal(await page.locator('input[name^="API Key"]').evaluate(node => node.closest('label').hidden), false);
    });
});

test('browser adapters send provider-specific requests without ambient cookies', async () => {
    await withPage({ width: 390, height: 844 }, async (page, context, base) => {
        await page.setContent(shell(base));
        await context.addCookies([
            { name: 'ambient', value: 'secret', domain: 'api.exa.ai', path: '/', secure: true },
            { name: 'ambient', value: 'secret', domain: 'google.serper.dev', path: '/', secure: true }
        ]);
        const seen = [];
        const payloads = {
            'api.exa.ai': { results: [{ title: 'Exa', url: 'https://example.com/exa', summary: 'x' }] },
            's.jina.ai': { data: [{ title: 'Jina', url: 'https://example.com/jina', description: 'x' }] },
            'google.serper.dev': { organic: [{ title: 'Serper', link: 'https://example.com/serper', snippet: 'x' }] },
            'api.duckduckgo.com': { Heading: 'DDG', AbstractURL: 'https://example.com/ddg', AbstractText: 'x', RelatedTopics: [] }
        };
        await page.route(/https:\/\/(api\.exa\.ai|s\.jina\.ai|google\.serper\.dev|api\.duckduckgo\.com)\//, async route => {
            const request = route.request();
            const host = new URL(request.url()).hostname;
            seen.push({ host, method: request.method(), headers: request.headers() });
            await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(payloads[host]) });
        });
        await page.evaluate(() => {
            window.searchStore = { apiKeyFor: () => 'test-key' };
            window.searchRegistry = { effectiveDomains: () => [], mark() {} };
        });
        await loadModules(page, base, ['search-policy-pure.mjs', 'search-adapters.js']);
        const lengths = await page.evaluate(async () => {
            const types = ['exa', 'jina', 'serper', 'duckduckgo'];
            return await Promise.all(types.map(type => window.searchAdapters.search({ id: type, type, region: 'US', options: { maxResults: 5, timeoutMs: 4000 } }, 'test query', { policy: { sourcePolicy: 'any' } }).then(items => items.length)));
        });
        assert.deepEqual(lengths, [1, 1, 1, 1]);
        assert.deepEqual(seen.map(item => [item.host, item.method]).sort(), [
            ['api.exa.ai', 'POST'], ['s.jina.ai', 'GET'], ['google.serper.dev', 'POST'], ['api.duckduckgo.com', 'GET']
        ].sort());
        assert.equal(seen.some(item => 'cookie' in item.headers), false);
        assert.equal(seen.find(item => item.host === 'api.exa.ai').headers['x-api-key'], 'test-key');
        assert.equal(seen.find(item => item.host === 'google.serper.dev').headers['x-api-key'], 'test-key');
    });
});

for (const width of [360, 390]) {
    test(`AI task controls remain one row at ${width}px`, async () => {
        await withPage({ width, height: 800 }, async (page, _context, base) => {
            await page.setContent(shell(base));
            await page.waitForFunction(() => [...document.styleSheets].some(sheet => {
                try { return sheet.href?.includes('/build/generated.css') && sheet.cssRules.length > 0; } catch { return false; }
            }));
            await page.evaluate(() => {
                window.aiModelVisual = {
                    modelLabelCandidates: model => ({ compact: model.displayName || model.modelId, full: model.displayName || model.modelId, custom: false, id: model.modelId }),
                    resolve: () => ({ mark: 'AI', iconSrcs: [], theme: {} })
                };
                window.searchStore = { getProviders: () => [] };
                window.searchRegistry = { nativeCapabilityState: () => ({ usable: true, reason: '可用', actions: [] }) };
                const route = { primary: { profileId: 'p', modelId: 'm' }, reasoningDepth: 'auto', fallbackMode: 'manual', fallbacks: [], network: { mode: 'auto', execution: 'external-first', sourcePolicy: 'any', fallback: 'local-estimate', providerIds: [], allowedDomains: [] } };
                window.ai = {
                    getTaskDefinitions: async () => [{ id: 'plan.today', label: '今日计划', group: '计划', allowFallbacks: true }],
                    getTaskRoute: async () => route,
                    listSelectableModels: async () => [{ profileId: 'p', modelId: 'm', displayName: 'GPT Test', provider: 'openai' }],
                    getTaskNetworkPolicy: () => route.network,
                    resolveTaskConfig: () => ({ provider: 'openai', network: route.network }),
                    setTaskRoute: async () => {}, findProfile: () => ({ enabled: true })
                };
            });
            await loadModules(page, base, ['search-policy-pure.mjs', 'search-settings.js', 'ai-task-settings.js']);
            await page.evaluate(() => window.aiTaskSettings.render());
            await page.waitForSelector('.ai-task-quick-controls');
            const layout = await page.locator('.ai-task-quick-controls').evaluate(node => {
                const buttons = [...node.querySelectorAll('.ai-task-utility-controls > button')].map(button => button.getBoundingClientRect());
                const box = node.getBoundingClientRect();
                const model = node.querySelector('.ai-compact-model')?.getBoundingClientRect();
                const utility = node.querySelector('.ai-task-utility-controls')?.getBoundingClientRect();
                return {
                    overflow: node.scrollWidth - node.clientWidth, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth,
                    right: box.right, width: box.width, model: model && { x: model.x, right: model.right, width: model.width },
                    utility: utility && { x: utility.x, right: utility.right, width: utility.width, scrollWidth: node.querySelector('.ai-task-utility-controls').scrollWidth },
                    buttons: buttons.map(rect => ({ x: rect.x, right: rect.right, width: rect.width })),
                    ys: buttons.map(rect => Math.round(rect.y)),
                    labels: [...node.querySelectorAll('.ai-task-utility-controls > button')].map(button => getComputedStyle(button, '::after').content)
                };
            });
            assert.ok(layout.overflow <= 1, JSON.stringify(layout));
            assert.ok(layout.right <= width + 1, `right=${layout.right}`);
            assert.equal(new Set(layout.ys).size, 1);
            assert.ok(layout.labels.some(label => label.includes('按需搜')));
            assert.ok(layout.labels.some(label => label.includes('设置')));
        });
    });
}

test('safe citation summary survives reload and renders summary/deep-read labels', async () => {
    await withPage({ width: 390, height: 844 }, async (page, _context, base) => {
        await page.setContent(shell(base));
        await loadModules(page, base, ['search-policy-pure.mjs', 'search-evidence-ui.js']);
        await page.evaluate(() => {
            const version = window.searchEvidenceUi.version({
                ai: { model: 'm', searchEvidence: [{ title: 'Guide', url: 'https://example.com/guide', contentExcerpt: 'full body must not persist', readStatus: 'deep-read' }] }
            });
            localStorage.setItem('browser-evidence-record', JSON.stringify(version));
        });
        await page.reload();
        await page.setContent(shell(base));
        await loadModules(page, base, ['search-policy-pure.mjs', 'search-evidence-ui.js']);
        const stored = await page.evaluate(() => {
            const value = JSON.parse(localStorage.getItem('browser-evidence-record'));
            document.getElementById('persistedEvidence').innerHTML = window.searchEvidenceUi.trail(value.searchEvidence, text => String(text).replace(/[&<>"']/g, ''));
            return value;
        });
        assert.equal(stored.searchEvidence.length, 1);
        assert.equal(Object.hasOwn(stored.searchEvidence[0], 'contentExcerpt'), false);
        assert.equal(Object.hasOwn(stored.ai, 'searchEvidence'), false);
        assert.equal(await page.locator('.search-source-read-status').textContent(), '已深读');
    });
});
