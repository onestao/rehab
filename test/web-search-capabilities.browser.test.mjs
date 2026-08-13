// @ts-nocheck
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(root, '../..');
const materialIcons = readFileSync(path.join(root, 'build', 'icons.txt'), 'utf8').trim().split(/\r?\n/).filter(Boolean);
const indexSource = readFileSync(path.join(root, 'index.html'), 'utf8');
const criticalStyle = indexSource.match(/<style>([\s\S]*?)<\/style>/)?.[1] || '';
const releaseVersion = indexSource.match(/const releaseVersion = ['"](\d+)['"]/)?.[1] || '';

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

for (const width of [360, 390]) {
    test(`search provider manager stays compact at ${width}px`, async () => {
        await withPage({ width, height: 844 }, async (page, _context, base) => {
            await page.setContent(shell(base));
            await page.waitForFunction(() => [...document.styleSheets].some(sheet => {
                try { return sheet.href?.includes('/build/generated.css') && sheet.cssRules.length > 0; } catch { return false; }
            }));
            await page.evaluate(() => {
                const providers = [
                    { id: 'one', name: 'Tavily', type: 'tavily', enabled: true, archived: false, options: {} },
                    { id: 'two', name: 'Exa Backup', type: 'exa', enabled: true, archived: false, options: {} },
                ];
                window.searchStore = {
                    async init() {}, getProviders: () => providers, apiKeyFor: () => '',
                    async saveProvider() {}, async archiveProvider() {}, async removeProvider() {}, async moveProvider() {},
                };
                window.searchRegistry = { nativeCapabilityState: () => ({ usable: false, reason: 'test', actions: [] }) };
                window.searchAdapters = { async test() {} };
                window.ai = {};
            });
            await loadModules(page, base, ['search-policy-pure.mjs', 'search-settings.js']);
            await page.evaluate(() => window.searchSettings.open());
            await page.waitForSelector('.search-provider-row');

            const listLayout = await page.locator('.search-provider-row').first().evaluate(row => {
                const rect = row.getBoundingClientRect();
                const meta = row.querySelector('.search-provider-meta').getBoundingClientRect();
                const actions = row.querySelector('.search-provider-actions').getBoundingClientRect();
                const buttons = [...row.querySelectorAll('.search-provider-order-btn')].map(node => node.getBoundingClientRect());
                return {
                    overflow: row.scrollWidth - row.clientWidth,
                    rect: { top: rect.top, bottom: rect.bottom, right: rect.right },
                    meta: { top: meta.top, bottom: meta.bottom, right: meta.right },
                    actions: { top: actions.top, bottom: actions.bottom, left: actions.left, right: actions.right },
                    buttonYs: buttons.map(button => Math.round(button.y)),
                    hasCaptions: !!row.querySelector('.ai-task-order-caption'),
                };
            });
            assert.ok(listLayout.overflow <= 1, JSON.stringify(listLayout));
            assert.ok(listLayout.actions.left >= listLayout.meta.right - 1, JSON.stringify(listLayout));
            assert.ok(listLayout.actions.top >= listLayout.rect.top - 1 && listLayout.actions.bottom <= listLayout.rect.bottom + 1, JSON.stringify(listLayout));
            assert.equal(new Set(listLayout.buttonYs).size, 1);
            assert.equal(listLayout.hasCaptions, false);
            assert.ok(listLayout.actions.right <= width + 1, JSON.stringify(listLayout));

            await page.locator('.search-provider-manage-btn').first().click();
            await page.waitForSelector('.search-provider-form');
            const formLayout = await page.locator('.search-provider-form').evaluate(form => {
                const rect = form.getBoundingClientRect();
                const visibleFields = [...form.querySelectorAll('.search-provider-field')].filter(field => !field.hidden);
                const fieldRects = visibleFields.map(field => {
                    const box = field.getBoundingClientRect();
                    const label = field.querySelector('.search-provider-field-label')?.getBoundingClientRect();
                    const control = field.querySelector('.search-provider-control')?.getBoundingClientRect();
                    return {
                        box: { x: box.x, y: box.y, right: box.right, bottom: box.bottom },
                        label: label && { x: label.x, y: label.y, right: label.right, bottom: label.bottom },
                        control: control && { x: control.x, y: control.y, right: control.right, bottom: control.bottom },
                    };
                });
                const utility = [...form.querySelectorAll('.search-provider-form-actions > .md-btn:not(.search-provider-save)')].map(button => button.getBoundingClientRect());
                const save = form.querySelector('.search-provider-save').getBoundingClientRect();
                const key = form.querySelector('input[type="password"]');
                return {
                    overflow: form.scrollWidth - form.clientWidth,
                    rect: { x: rect.x, right: rect.right },
                    fieldRects,
                    firstRowYs: fieldRects.slice(0, 2).map(field => Math.round(field.box.y)),
                    labelsInside: fieldRects.every(field => field.label && field.label.y >= field.box.y && field.label.bottom <= field.box.bottom && field.control.y >= field.box.y && field.control.bottom <= field.box.bottom),
                    utilityYs: utility.map(button => Math.round(button.y)),
                    save: { x: save.x, right: save.right, width: save.width },
                    keyPlaceholder: key?.placeholder || '',
                    legacyFields: form.querySelectorAll('.md-field').length,
                };
            });
            assert.ok(formLayout.overflow <= 1, JSON.stringify(formLayout));
            assert.equal(new Set(formLayout.firstRowYs).size, 1, JSON.stringify(formLayout));
            assert.equal(formLayout.labelsInside, true, JSON.stringify(formLayout));
            assert.equal(new Set(formLayout.utilityYs).size, 1, JSON.stringify(formLayout));
            assert.ok(formLayout.save.width >= (formLayout.rect.right - formLayout.rect.x) - 2, JSON.stringify(formLayout));
            assert.ok(formLayout.keyPlaceholder.length > 0);
            assert.equal(formLayout.legacyFields, 0);
        });
    });
}

test('Android back unwinds search service editor before closing settings manager', async () => {
    await withPage({ width: 390, height: 844 }, async (page, _context, base) => {
        await page.setContent(shell(base));
        await page.evaluate(() => {
            const providers = [{ id: 'one', name: 'Tavily', type: 'tavily', enabled: true, archived: false, options: {} }];
            window.searchStore = {
                async init() {}, getProviders: () => providers, apiKeyFor: () => '',
                async saveProvider() {}, async archiveProvider() {}, async removeProvider() {}, async moveProvider() {},
            };
            window.searchRegistry = { nativeCapabilityState: () => ({ usable: false, reason: 'test', actions: [] }) };
            window.searchAdapters = { async test() {} };
            window.ai = {};
        });
        await loadModules(page, base, ['nav-stack.js', 'search-policy-pure.mjs', 'search-settings.js']);
        await page.evaluate(() => {
            window.navStack.init();
            window.searchSettings.open();
        });
        await page.waitForSelector('.search-provider-row');
        await page.locator('.search-provider-manage-btn').click();
        await page.waitForSelector('.search-provider-form');
        assert.equal(await page.locator('#searchProviderManager').getAttribute('aria-hidden'), 'false');

        await page.evaluate(() => history.back());
        await page.waitForSelector('.search-provider-row');
        assert.equal(await page.locator('.search-provider-form').count(), 0);
        assert.equal(await page.locator('#searchProviderManager').getAttribute('aria-hidden'), 'false');
        assert.equal(await page.evaluate(() => window.navStack.top().id), 'searchProviderManager');

        await page.evaluate(() => history.back());
        await page.waitForFunction(() => document.getElementById('searchProviderManager')?.classList.contains('hidden'));
        assert.equal(await page.locator('#searchProviderManager').getAttribute('aria-hidden'), 'true');
        assert.equal(await page.evaluate(() => window.navStack.top().id), 'today');
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

test('local Material Symbols subset renders every collected icon as a ligature', async () => {
    await withPage({ width: 390, height: 844 }, async (page, _context, base) => {
        await page.setContent(shell(base));
        const result = await page.evaluate(async icons => {
            await document.fonts.load('24px "Material Symbols Rounded"');
            await document.fonts.ready;
            const host = document.createElement('div');
            host.style.cssText = 'position:fixed;left:-10000px;top:0;white-space:nowrap';
            document.body.append(host);
            const measure = text => {
                const node = document.createElement('span');
                node.className = 'material-symbols-rounded';
                node.style.cssText = 'display:inline-block;width:auto;max-width:none;font-size:24px;line-height:1;white-space:nowrap';
                node.textContent = text;
                host.append(node);
                const value = { text, width: node.getBoundingClientRect().width, fontFamily: getComputedStyle(node).fontFamily };
                node.remove();
                return value;
            };
            return {
                loaded: document.fonts.check('24px "Material Symbols Rounded"'),
                bogus: measure('definitely_not_an_icon'),
                icons: icons.map(measure)
            };
        }, materialIcons);
        assert.equal(result.loaded, true);
        assert.ok(result.bogus.width > 30, JSON.stringify(result.bogus));
        const missing = result.icons.filter(item => item.width > 30 || !/Material Symbols Rounded/i.test(item.fontFamily));
        assert.deepEqual(missing, []);
        assert.equal(result.icons.length, materialIcons.length);
    });
});


test('manual dark shell keeps inherited prescription text on semantic colors', async () => {
    await withPage({ width: 390, height: 844 }, async (page, _context, base) => {
        await page.setContent(`<!doctype html><html data-theme-mode="dark"><head><style>${criticalStyle}</style><link rel="stylesheet" href="${base}/build/generated.css"></head><body>
            <div class="library-card prescription-action-card">
                <label class="prescription-merge-check"><input type="checkbox"><span></span></label>
                <button class="prescription-action-main" type="button"><strong>90/90髋内外旋</strong><small>髋 · continued</small></button>
            </div>
        </body></html>`);
        await page.waitForFunction(() => [...document.styleSheets].some(sheet => {
            try { return sheet.href?.includes('/build/generated.css') && sheet.cssRules.length > 0; } catch { return false; }
        }));
        await page.waitForTimeout(900);
        const colors = await page.evaluate(() => {
            const rootStyle = getComputedStyle(document.documentElement);
            const bodyStyle = getComputedStyle(document.body);
            const titleStyle = getComputedStyle(document.querySelector('.prescription-action-main strong'));
            return {
                body: bodyStyle.color,
                title: titleStyle.color,
                background: bodyStyle.backgroundColor,
                onSurface: rootStyle.getPropertyValue('--md-sys-on-surface').trim(),
                surface: rootStyle.getPropertyValue('--md-sys-surface').trim(),
            };
        });
        const expectedText = await page.evaluate(color => {
            const probe = document.createElement('span');
            probe.style.color = color;
            document.body.append(probe);
            const value = getComputedStyle(probe).color;
            probe.remove();
            return value;
        }, colors.onSurface);
        const expectedSurface = await page.evaluate(color => {
            const probe = document.createElement('span');
            probe.style.backgroundColor = color;
            document.body.append(probe);
            const value = getComputedStyle(probe).backgroundColor;
            probe.remove();
            return value;
        }, colors.surface);
        assert.equal(colors.body, expectedText);
        assert.equal(colors.title, expectedText);
        assert.equal(colors.background, expectedSurface);
    });
});



test('dark workout timer keeps readable text when on-primary is dark', async () => {
    await withPage({ width: 390, height: 844 }, async (page, _context, base) => {
        await page.setContent(`<!doctype html><html data-theme-mode="dark" style="--md-sys-on-primary:#001122"><head><link rel="stylesheet" href="${base}/build/generated.css"></head><body>
            <section id="workout" class="page">
                <div class="md-card timer-panel">
                    <div id="statusText">READY</div>
                    <div id="mainTime">00</div>
                    <div id="subText">计划 · 康复 · 侧卧髋外展基础</div>
                    <div class="timer-stats">
                        <div class="stat-item"><span class="stat-label">总用时</span><b>00:00</b></div>
                        <div class="stat-item"><span class="stat-label">组数</span><b>0/0</b></div>
                        <div class="stat-item"><span class="stat-label">次数</span><b>0/0</b></div>
                    </div>
                </div>
                <div class="mode-tabs"><button class="mode-tab">有氧</button><button class="mode-tab active">力量</button></div>
            </section>
        </body></html>`);
        await page.waitForFunction(() => [...document.styleSheets].some(sheet => {
            try { return sheet.href?.includes('/build/generated.css') && sheet.cssRules.length > 0; } catch { return false; }
        }));
        const result = await page.evaluate(() => {
            const read = selector => {
                const style = getComputedStyle(document.querySelector(selector));
                return { color: style.color, opacity: Number(style.opacity) };
            };
            return {
                status: read('#statusText'),
                time: read('#mainTime'),
                sub: read('#subText'),
                label: read('.stat-label'),
                value: read('.stat-item b'),
            };
        });
        for (const key of ['status', 'time', 'sub', 'label', 'value']) {
            assert.equal(result[key].opacity, 1, `${key}: ${JSON.stringify(result[key])}`);
            const channels = (result[key].color.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
            assert.ok(channels.length === 3 && Math.min(...channels) >= 180, `${key}: ${JSON.stringify(result[key])}`);
        }
    });
});

test('search provider order controls render versioned arrow ligatures', async () => {
    await withPage({ width: 390, height: 844 }, async (page, _context, base) => {
        const fontRequests = [];
        page.on('request', request => {
            if (request.url().includes('material-symbols-rounded.woff2')) fontRequests.push(request.url());
        });
        await page.setContent(shell(base));
        await page.waitForFunction(() => [...document.styleSheets].some(sheet => {
            try { return sheet.href?.includes('/build/generated.css') && sheet.cssRules.length > 0; } catch { return false; }
        }));
        await page.evaluate(() => {
            const providers = [
                { id: 'one', name: 'Tavily', type: 'tavily', enabled: true, archived: false },
                { id: 'two', name: 'Exa', type: 'exa', enabled: true, archived: false },
            ];
            window.searchStore = {
                async init() {}, getProviders: () => providers, apiKeyFor: () => '',
                async saveProvider() {}, async archiveProvider() {}, async removeProvider() {}, async moveProvider() {},
            };
            window.searchRegistry = { nativeCapabilityState: () => ({ usable: false, reason: 'test', actions: [] }) };
            window.searchAdapters = { async test() {} };
            window.ai = {};
        });
        await loadModules(page, base, ['search-policy-pure.mjs', 'search-settings.js']);
        await page.evaluate(async () => {
            window.searchSettings.open();
            await document.fonts.load('24px "Material Symbols Rounded"');
            await document.fonts.ready;
        });
        const icons = await page.locator('.search-provider-order-btn .material-symbols-rounded').evaluateAll(nodes => nodes.map(node => {
            const style = getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            return { text: node.textContent, fontFamily: style.fontFamily, width: rect.width, scrollWidth: node.scrollWidth };
        }));
        assert.deepEqual(new Set(icons.map(icon => icon.text)), new Set(['arrow_upward', 'arrow_downward']));
        assert.ok(icons.every(icon => /Material Symbols Rounded/i.test(icon.fontFamily)), JSON.stringify(icons));
        assert.ok(icons.every(icon => icon.width <= 24 && icon.scrollWidth <= 24), JSON.stringify(icons));
        assert.ok(fontRequests.some(url => new URL(url).searchParams.get('v') === releaseVersion), JSON.stringify(fontRequests));
    });
});
