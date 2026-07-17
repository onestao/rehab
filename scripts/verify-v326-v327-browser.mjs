// @ts-nocheck
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const playwrightModule = process.env.PLAYWRIGHT_MODULE;
if (!playwrightModule) throw new Error('PLAYWRIGHT_MODULE is required');
const { chromium } = require(playwrightModule);

const roots = {
    '326': path.resolve(process.env.REHAB_V326_ROOT || ''),
    '327': path.resolve(process.env.REHAB_V327_ROOT || '')
};
for (const [version, root] of Object.entries(roots)) {
    if (!root || !existsSync(path.join(root, 'index.html'))) {
        throw new Error(`invalid v${version} root: ${root}`);
    }
}

const executablePath = process.env.CHROMIUM_PATH;
if (!executablePath || !existsSync(executablePath)) throw new Error('CHROMIUM_PATH is required');
const port = Number(process.env.REHAB_BROWSER_PORT || 4175);
const origin = `http://127.0.0.1:${port}`;
const requests = [];
let activeVersion = '326';
const mime = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2'
};

const server = createServer((req, res) => {
    const url = new URL(req.url || '/', origin);
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const root = roots[activeVersion];
    const file = path.resolve(root, `.${relative}`);
    requests.push({
        version: activeVersion,
        method: req.method,
        path: `${url.pathname}${url.search}`
    });
    if ((!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html'))
        || !existsSync(file)
        || statSync(file).isDirectory()) {
        res.writeHead(404, { 'cache-control': 'no-store' });
        res.end('not found');
        return;
    }
    res.writeHead(200, {
        'content-type': mime[path.extname(file)] || 'application/octet-stream',
        'cache-control': 'no-store',
        'service-worker-allowed': '/'
    });
    createReadStream(file).pipe(res);
});

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanProfile(profilePath) {
    const resolved = path.resolve(profilePath);
    const safeRoot = path.resolve('C:/tmp');
    if (!resolved.startsWith(safeRoot + path.sep) || !path.basename(resolved).startsWith('rehab-v327-')) {
        throw new Error(`refusing to remove unsafe profile path: ${resolved}`);
    }
    if (existsSync(resolved)) rmSync(resolved, { recursive: true, force: true });
}

function trackDocuments(page) {
    const documents = [];
    page.on('request', (request) => {
        if (request.isNavigationRequest()
            && request.resourceType() === 'document'
            && request.frame() === page.mainFrame()) {
            documents.push(request.url());
        }
    });
    return documents;
}

async function queryVersion(page) {
    return page.evaluate(async () => {
        const serviceWorker = navigator.serviceWorker;
        const controller = serviceWorker.controller;
        if (!controller) return { version: null, precacheReady: false };
        const requestId = `browser-${Date.now()}-${Math.random()}`;
        return new Promise((resolve) => {
            const finish = (value) => {
                clearTimeout(timer);
                serviceWorker.removeEventListener('message', onMessage);
                resolve(value);
            };
            const onMessage = (event) => {
                if (event.data?.type !== 'VERSION' || event.data.requestId !== requestId) return;
                finish({
                    version: String(event.data.version || ''),
                    precacheReady: event.data.precacheReady === true
                });
            };
            const timer = setTimeout(() => finish({ version: null, precacheReady: false }), 1500);
            serviceWorker.addEventListener('message', onMessage);
            controller.postMessage({ type: 'GET_VERSION', requestId });
        });
    });
}

async function pageState(page) {
    const version = await queryVersion(page);
    return page.evaluate(async (versionState) => ({
        href: location.href,
        ready: document.body.classList.contains("rehab-app-ready"),
        activePage: document.querySelector('.page.active')?.id || null,
        controller: navigator.serviceWorker.controller?.scriptURL || null,
        cacheKeys: await caches.keys(),
        scriptSources: [...document.scripts].map((script) => script.src).filter(Boolean),
        resourceUrls: performance.getEntriesByType('resource').map((entry) => entry.name),
        upgradeMarker: new URL(location.href).searchParams.get('__rehab_upgrade'),
        ...versionState
    }), version);
}

async function waitForV326(page) {
    await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
    try {
        await page.waitForFunction(() => document.querySelector(".page.active") && window.ui && window.data, null, { timeout: 30000 });
    } catch (error) {
        const diagnostic = await page.evaluate(async () => ({
            href: location.href,
            bodyClass: document.body.className,
            status: document.getElementById('startupBarrierStatus')?.textContent || '',
            detail: document.getElementById('startupBarrierDetail')?.textContent || '',
            retryVisible: document.getElementById('startupBarrierRetry')?.hidden === false,
            controller: navigator.serviceWorker.controller?.scriptURL || null,
            caches: await caches.keys(),
            scripts: [...document.scripts].map((script) => script.src).filter(Boolean)
        }));
        throw new Error(`v326 app did not become ready: ${JSON.stringify(diagnostic)}; ${error.message}`);
    }
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(async () => {
        const keys = await caches.keys();
        return !!navigator.serviceWorker.controller && keys.includes('training-assistant-v326');
    }, null, { timeout: 30000 });
    const state = await pageState(page);
    if (!state.scriptSources.some((url) => url.includes('?v=326'))) {
        throw new Error('v326 page did not execute v326 scripts');
    }
    return state;
}

async function openUpdateUi(page) {
    await page.locator('.nav-item').nth(4).click();
    await page.waitForFunction(() => document.getElementById('profile')?.classList.contains('active'), null, { timeout: 30000 });
    const check = page.locator('#profileUpdateCheckBtn');
    await check.waitFor({ state: 'visible', timeout: 30000 });
    await check.click();
    const banner = page.locator('#appUpdateBanner');
    await banner.waitFor({ state: 'visible', timeout: 30000 });
    return banner;
}

async function applyUpdate(page) {
    const banner = await openUpdateUi(page);
    await banner.locator('button').last().click();
}

async function waitForV327(page) {
    await page.waitForFunction(async () => {
        if (!document.body.classList.contains('rehab-app-ready')) return false;
        const keys = await caches.keys();
        return !!navigator.serviceWorker.controller && keys.includes('training-assistant-v327');
    }, null, { timeout: 45000 });
    for (let attempt = 0; attempt < 30; attempt += 1) {
        let state;
        try {
            state = await pageState(page);
        } catch (error) {
            if (/Execution context was destroyed|navigation/i.test(String(error?.message || error))) {
                await wait(250);
                continue;
            }
            throw error;
        }
        if (state.version === '327'
            && state.precacheReady
            && state.cacheKeys.length === 1
            && state.cacheKeys[0] === 'training-assistant-v327') {
            return state;
        }
        await wait(500);
    }
    throw new Error(`v327 did not settle: ${JSON.stringify(await pageState(page))}`);
}

async function smokeNavigation(page) {
    const nav = page.locator('.nav-item');
    await nav.nth(2).click();
    await page.waitForFunction(() => document.getElementById('records')?.classList.contains('active'), null, { timeout: 30000 });
    await nav.nth(3).click();
    await page.waitForFunction(() => document.getElementById('ai-coach')?.classList.contains('active'), null, { timeout: 30000 });
    await nav.nth(0).click();
    await page.waitForFunction(() => document.getElementById('today')?.classList.contains('active'), null, { timeout: 30000 });

    await page.evaluate(() => {
        const plan = {
            id: 'browser-plan',
            title: 'Browser plan',
            type: 'rehab',
            items: [{
                id: 'browser-task',
                name: 'Browser task',
                status: 'todo',
                category: 'main',
                spec: { sets: 2, reps: 8 }
            }]
        };
        window.data.db.dailyPlans = [plan];
        window.data.openPlanTaskDrawer(plan.id);
        window.data.openPlanTaskMenu(plan.id, plan.items[0].id);
    });
    const drawer = page.locator('#planTaskDrawer');
    const visibleModal = page.locator('.md-modal[data-rl-modal="1"]:not(.hidden)').last();
    await drawer.waitFor({ state: 'attached', timeout: 10000 });
    await visibleModal.waitFor({ state: 'visible', timeout: 10000 });
    await page.evaluate(() => history.back());
    await visibleModal.waitFor({ state: 'hidden', timeout: 10000 });
    const modalClosedByBack = true;
    await page.evaluate(() => window.data.closePlanTaskDrawer());
    await drawer.waitFor({ state: 'detached', timeout: 10000 });
    const drawerClosed = true;
    return {
        finalPage: await page.evaluate(() => document.querySelector('.page.active')?.id || null),
        drawerOpened: true,
        drawerClosed,
        modalOpened: true,
        modalClosedByBack
    };
}

async function launchContext(profilePath) {
    cleanProfile(profilePath);
    return chromium.launchPersistentContext(profilePath, {
        headless: true,
        executablePath,
        args: ['--disable-features=TranslateUI', '--no-sandbox'],
        serviceWorkers: 'allow'
    });
}

async function runSingleTab() {
    activeVersion = '326';
    requests.length = 0;
    const context = await launchContext('C:/tmp/rehab-v327-client-migration-single');
    const page = context.pages()[0] || await context.newPage();
    const documents = trackDocuments(page);
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const before = await waitForV326(page);
    activeVersion = '327';
    const beforeApplyDocuments = documents.length;
    await applyUpdate(page);
    const final = await waitForV327(page);
    await wait(6000);
    const settledDocuments = documents.length;
    const smoke = await smokeNavigation(page);
    const requestSnapshot = requests.slice();
    await context.close();
    return {
        before,
        final,
        smoke,
        errors,
        documentNavigations: settledDocuments - beforeApplyDocuments,
        documents: documents.slice(beforeApplyDocuments),
        reloadLoopFree: documents.length === settledDocuments,
        servedV327AssetsFromV326: requestSnapshot.filter((entry) => entry.version === '326' && /[?&]v=327(?:&|$)/.test(entry.path)),
        finalV326Resources: final.resourceUrls.filter((url) => /[?&]v=326(?:&|$)/.test(url))
    };
}

async function runDualTab() {
    activeVersion = '326';
    requests.length = 0;
    const context = await launchContext('C:/tmp/rehab-v327-client-migration-dual');
    const pageOne = context.pages()[0] || await context.newPage();
    const pageTwo = await context.newPage();
    const documentsOne = trackDocuments(pageOne);
    const documentsTwo = trackDocuments(pageTwo);
    const beforeOne = await waitForV326(pageOne);
    const beforeTwo = await waitForV326(pageTwo);
    activeVersion = '327';
    const startOne = documentsOne.length;
    const startTwo = documentsTwo.length;
    await applyUpdate(pageOne);
    const [finalOne, finalTwo] = await Promise.all([waitForV327(pageOne), waitForV327(pageTwo)]);
    await wait(6000);
    const settledOne = documentsOne.length;
    const settledTwo = documentsTwo.length;
    const sharedCaches = await pageOne.evaluate(() => caches.keys());
    await context.close();
    return {
        beforeOne,
        beforeTwo,
        finalOne,
        finalTwo,
        sharedCaches,
        documentNavigations: [settledOne - startOne, settledTwo - startTwo],
        documents: [documentsOne.slice(startOne), documentsTwo.slice(startTwo)],
        reloadLoopFree: documentsOne.length === settledOne && documentsTwo.length === settledTwo
    };
}

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const report = { single: null, dual: null };
let exitCode = 0;
try {
    report.single = await runSingleTab();
    report.dual = await runDualTab();
    const single = report.single;
    const dual = report.dual;
    const ok = single.documentNavigations === 1
        && single.reloadLoopFree
        && single.final.version === '327'
        && single.final.precacheReady
        && single.final.cacheKeys.length === 1
        && single.final.cacheKeys[0] === 'training-assistant-v327'
        && single.final.upgradeMarker === null
        && single.finalV326Resources.length === 0
        && single.servedV327AssetsFromV326.length === 0
        && single.errors.length === 0
        && single.smoke.finalPage === "today"
        && single.smoke.drawerOpened
        && single.smoke.drawerClosed
        && single.smoke.modalOpened
        && single.smoke.modalClosedByBack
        && dual.documentNavigations.every((count) => count === 1)
        && dual.reloadLoopFree
        && dual.finalOne.version === '327'
        && dual.finalTwo.version === '327'
        && dual.finalOne.precacheReady
        && dual.finalTwo.precacheReady
        && dual.sharedCaches.length === 1
        && dual.sharedCaches[0] === 'training-assistant-v327';
    if (!ok) exitCode = 2;
} catch (error) {
    report.error = String(error?.stack || error);
    report.requests = requests.slice(-100);
    exitCode = 1;
} finally {
    server.close();
}
writeFileSync('browser-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);
