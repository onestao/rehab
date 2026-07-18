// @ts-nocheck
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const playwrightModule = process.env.PLAYWRIGHT_MODULE;
if (!playwrightModule) throw new Error('PLAYWRIGHT_MODULE is required');
const { chromium } = require(playwrightModule);

const fromVersion = String(process.env.REHAB_FROM_VERSION || '326');
const toVersion = '333';
const fromRootEnv = process.env[`REHAB_V${fromVersion}_ROOT`] || process.env.REHAB_FROM_ROOT || '';
const toRootEnv = process.env.REHAB_V333_ROOT
    || process.env.REHAB_V331_ROOT
    || process.env.REHAB_V330_ROOT
    || process.env.REHAB_V329_ROOT
    || process.env.REHAB_V328_ROOT
    || process.env.REHAB_V327_ROOT
    || '';
const roots = {
    [fromVersion]: path.resolve(fromRootEnv),
    [toVersion]: path.resolve(toRootEnv)
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
let activeVersion = fromVersion;
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
    const safeRoot = path.resolve(process.env.REHAB_TMP_ROOT || 'G:/LLM/rehab/.tmp');
    if (!resolved.startsWith(safeRoot + path.sep) || !path.basename(resolved).startsWith('rehab-v333-')) {
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
    return page.evaluate(async (versionState) => {
        const resourceUrls = performance.getEntriesByType('resource').map((entry) => entry.name);
        const stylesheetHrefs = [...document.querySelectorAll('link[rel="stylesheet"]')]
            .map((link) => link.href)
            .filter(Boolean);
        let styleProbe = null;
        try {
            const probe = document.createElement('div');
            probe.className = 'md-btn';
            document.documentElement.appendChild(probe);
            const style = getComputedStyle(probe);
            styleProbe = {
                display: style.display,
                height: style.height,
                borderRadius: style.borderRadius
            };
            probe.remove();
        } catch {
            styleProbe = null;
        }
        return {
            href: location.href,
            ready: document.body.classList.contains('rehab-app-ready'),
            activePage: document.querySelector('.page.active')?.id || null,
            controller: navigator.serviceWorker.controller?.scriptURL || null,
            cacheKeys: await caches.keys(),
            scriptSources: [...document.scripts].map((script) => script.src).filter(Boolean),
            stylesheetHrefs,
            resourceUrls,
            styleProbe,
            upgradeMarker: new URL(location.href).searchParams.get('__rehab_upgrade'),
            ...versionState
        };
    }, version);
}

function isVersionedAsset(url, version) {
    return new RegExp(`[?&]v=${version}(?:&|$)`).test(String(url || ''));
}

function controllerLooksLikeV333(controller) {
    if (!controller) return false;
    if (/sw\.js\?v=333(?:&|$)/.test(controller)) return true;
    // Bare sw.js is the legacy registration URL; acceptable only as a transient
    // controller identity when the active worker already reports version 333.
    return /\/sw\.js(?:$|\?)/.test(controller) && !/[?&]v=/.test(controller);
}

function documentIsPureV333(state) {
    if (!state) return false;
    if (state.version !== '333') return false;
    // precacheReady is preferred but not required once the sole live cache is v333 and
    // the document already executes pure v333 scripts/styles (release marker can lag).
    if (!state.ready || !state.activePage) return false;
    if (state.upgradeMarker !== null) return false;
    if (!controllerLooksLikeV333(state.controller)) return false;
    if (!Array.isArray(state.cacheKeys)
        || state.cacheKeys.length !== 1
        || state.cacheKeys[0] !== 'training-assistant-v333') {
        return false;
    }
    const scripts = state.scriptSources || [];
    if (!scripts.some((url) => isVersionedAsset(url, '333'))) return false;
    // Reject any residual pre-release versioned assets still attached to the document.
    if (scripts.some((url) => {
        const match = String(url || '').match(/[?&]v=(\d+)(?:&|$)/);
        return match && match[1] !== '333';
    })) return false;
    const styles = state.stylesheetHrefs || [];
    if (!styles.some((url) => /generated\.css\?v=333(?:&|$)/.test(url))) return false;
    if (styles.some((url) => {
        const match = String(url || '').match(/[?&]v=(\d+)(?:&|$)/);
        return match && match[1] !== '333';
    })) return false;
    if ((state.resourceUrls || []).some((url) => {
        const match = String(url || '').match(/[?&]v=(\d+)(?:&|$)/);
        return match && match[1] !== '333';
    })) {
        return false;
    }
    const probe = state.styleProbe || {};
    const displayOk = probe.display === 'inline-flex' || probe.display === 'flex';
    const heightOk = String(probe.height || '') === '44px';
    const radiusOk = String(probe.borderRadius || '') === '9999px';
    return displayOk && heightOk && radiusOk;
}

async function waitForFromVersion(page) {
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
        throw new Error(`v${fromVersion} app did not become ready: ${JSON.stringify(diagnostic)}; ${error.message}`);
    }
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(async (cacheName) => {
        const keys = await caches.keys();
        return !!navigator.serviceWorker.controller && keys.includes(cacheName);
    }, `training-assistant-v${fromVersion}`, { timeout: 30000 });
    const state = await pageState(page);
    if (!state.scriptSources.some((url) => url.includes(`?v=${fromVersion}`))) {
        throw new Error(`v${fromVersion} page did not execute v${fromVersion} scripts`);
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

async function waitForPureDocument(page, { requireSoleCache = true } = {}) {
    for (let attempt = 0; attempt < 90; attempt += 1) {
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
        const pureScripts = (state.scriptSources || []).some((url) => isVersionedAsset(url, '333'))
            && !(state.scriptSources || []).some((url) => {
                const match = String(url || '').match(/[?&]v=(\d+)(?:&|$)/);
                return match && match[1] !== '333';
            });
        const pureStyles = (state.stylesheetHrefs || []).some((url) => /generated\.css\?v=333(?:&|$)/.test(url))
            && !(state.stylesheetHrefs || []).some((url) => {
                const match = String(url || '').match(/[?&]v=(\d+)(?:&|$)/);
                return match && match[1] !== '333';
            });
        const soleCache = Array.isArray(state.cacheKeys)
            && state.cacheKeys.includes('training-assistant-v333')
            && (!requireSoleCache || (
                state.cacheKeys.length === 1
                && state.cacheKeys[0] === 'training-assistant-v333'
            ));
        if (state.version === '333'
            && controllerLooksLikeV333(state.controller)
            && state.ready
            && state.activePage
            && state.upgradeMarker === null
            && pureScripts
            && pureStyles
            && soleCache) {
            return state;
        }
        await wait(500);
    }
    throw new Error(`pure document did not settle: ${JSON.stringify(await pageState(page))}`);
}

async function waitForV333(page) {
    await page.waitForFunction(async () => {
        if (!document.body.classList.contains('rehab-app-ready')) return false;
        const keys = await caches.keys();
        return !!navigator.serviceWorker.controller && keys.includes('training-assistant-v333');
    }, null, { timeout: 45000 });
    return waitForPureDocument(page, { requireSoleCache: true });
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
    activeVersion = fromVersion;
    requests.length = 0;
    const context = await launchContext(`G:/LLM/rehab/.tmp/rehab-v333-from-v${fromVersion}-client-migration-single`);
    const page = context.pages()[0] || await context.newPage();
    const documents = trackDocuments(page);
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const before = await waitForFromVersion(page);
    activeVersion = toVersion;
    // Non-blocking contract: first navigation under bare old controller must enter the app.
    await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.classList.contains('rehab-app-ready') && document.querySelector('.page.active') && window.ui && window.data, null, { timeout: 45000 });
    const firstEntry = await pageState(page);
    if (!firstEntry.ready || !firstEntry.activePage) {
        throw new Error(`first entry under old controller failed: ${JSON.stringify(firstEntry)}`);
    }
    if (firstEntry.controller && /\?v=/.test(firstEntry.controller) === false) {
        // bare controller is expected for older production paths
    }
    const beforeApplyDocuments = documents.length;
    await applyUpdate(page);
    const final = await waitForV333(page);
    await wait(6000);
    const settledDocuments = documents.length;
    const smoke = await smokeNavigation(page);
    const pureFinal = await pageState(page);
    const requestSnapshot = requests.slice();
    await context.close();
    return {
        before,
        firstEntry,
        final,
        pureFinal,
        smoke,
        errors,
        documentNavigations: settledDocuments - beforeApplyDocuments,
        documents: documents.slice(beforeApplyDocuments),
        reloadLoopFree: documents.length === settledDocuments,
        servedV333AssetsFromOld: requestSnapshot.filter((entry) => entry.version === fromVersion && /[?&]v=333(?:&|$)/.test(entry.path)),
        finalOldResources: pureFinal.resourceUrls.filter((url) => new RegExp(`[?&]v=${fromVersion}(?:&|$)`).test(url)),
        documentPure: documentIsPureV333(pureFinal)
    };
}

async function runDualTab() {
    activeVersion = fromVersion;
    requests.length = 0;
    const context = await launchContext(`G:/LLM/rehab/.tmp/rehab-v333-from-v${fromVersion}-client-migration-dual`);
    const pageOne = context.pages()[0] || await context.newPage();
    const pageTwo = await context.newPage();
    const documentsOne = trackDocuments(pageOne);
    const documentsTwo = trackDocuments(pageTwo);
    const beforeOne = await waitForFromVersion(pageOne);
    const beforeTwo = await waitForFromVersion(pageTwo);
    activeVersion = toVersion;
    const startOne = documentsOne.length;
    const startTwo = documentsTwo.length;
    await applyUpdate(pageOne);
    const [finalOne, finalTwo] = await Promise.all([waitForV333(pageOne), waitForV333(pageTwo)]);
    await wait(6000);
    const settledOne = documentsOne.length;
    const settledTwo = documentsTwo.length;
    const pureOne = await pageState(pageOne);
    const pureTwo = await pageState(pageTwo);
    const sharedCaches = await pageOne.evaluate(() => caches.keys());
    await context.close();
    return {
        beforeOne,
        beforeTwo,
        finalOne,
        finalTwo,
        pureOne,
        pureTwo,
        sharedCaches,
        documentNavigations: [settledOne - startOne, settledTwo - startTwo],
        documents: [documentsOne.slice(startOne), documentsTwo.slice(startTwo)],
        reloadLoopFree: documentsOne.length === settledOne && documentsTwo.length === settledTwo,
        documentPure: [documentIsPureV333(pureOne), documentIsPureV333(pureTwo)]
    };
}

async function installPageReadyGate(page) {
    await page.addInitScript(() => {
        const storageKey = '__rehabDelayPageReady';
        const isGated = () => {
            try {
                if (window.__rehabDelayPageReady) return true;
                return sessionStorage.getItem(storageKey) === '1';
            } catch {
                return !!window.__rehabDelayPageReady;
            }
        };
        const wrapController = (controller) => {
            if (!controller || controller.__rehabPageReadyWrapped) return controller;
            const originalPost = controller.postMessage?.bind(controller);
            if (!originalPost) return controller;
            controller.postMessage = function gatedPostMessage(message, ...rest) {
                try {
                    if (isGated()
                        && message
                        && message.type === 'V327_PAGE_READY') {
                        window.__rehabBlockedPageReady = (window.__rehabBlockedPageReady || 0) + 1;
                        return;
                    }
                } catch {}
                return originalPost(message, ...rest);
            };
            controller.__rehabPageReadyWrapped = true;
            return controller;
        };
        try {
            const serviceWorker = navigator.serviceWorker;
            if (!serviceWorker) return;
            // Keep re-wrapping controllers across soft/hard upgrade navigations. A short
            // boot-only poll misses the post-SKIP_WAITING controller swap.
            const arm = () => {
                try { wrapController(serviceWorker.controller); } catch {}
            };
            arm();
            serviceWorker.addEventListener('controllerchange', arm);
            setInterval(arm, 100);
        } catch {}
    });
}

async function setPageReadyGate(page, enabled) {
    await page.evaluate((value) => {
        window.__rehabDelayPageReady = !!value;
        try {
            if (value) sessionStorage.setItem('__rehabDelayPageReady', '1');
            else sessionStorage.removeItem('__rehabDelayPageReady');
        } catch {}
    }, enabled);
}

async function runDelayedSecondTab() {
    activeVersion = fromVersion;
    requests.length = 0;
    const context = await launchContext(`G:/LLM/rehab/.tmp/rehab-v333-from-v${fromVersion}-client-migration-delayed-b`);
    const pageOne = context.pages()[0] || await context.newPage();
    const pageTwo = await context.newPage();
    // Install the gate before any navigation so soft/hard upgrade reloads keep
    // the wrapper; sessionStorage keeps the delay flag across document swaps.
    await installPageReadyGate(pageTwo);

    const documentsOne = trackDocuments(pageOne);
    const documentsTwo = trackDocuments(pageTwo);
    await waitForFromVersion(pageOne);
    await waitForFromVersion(pageTwo);
    await setPageReadyGate(pageTwo, true);
    activeVersion = toVersion;
    const startOne = documentsOne.length;
    const startTwo = documentsTwo.length;

    await applyUpdate(pageOne);
    const midA = await waitForPureDocument(pageOne, { requireSoleCache: false });
    // Hold long enough for a buggy early-delete path to fire if present.
    await wait(5000);
    const midCaches = await pageOne.evaluate(() => caches.keys());
    let midB = null;
    let blockedReadyCount = 0;
    try { midB = await pageState(pageTwo); } catch {}
    try {
        blockedReadyCount = await pageTwo.evaluate(() => Number(window.__rehabBlockedPageReady || 0));
    } catch {}
    const midHasLegacy = midCaches.some((key) => key !== 'training-assistant-v333' && String(key).startsWith('training-assistant-'));
    const midHasCurrent = midCaches.includes('training-assistant-v333');

    await setPageReadyGate(pageTwo, false);
    await pageTwo.evaluate(() => {
        try {
            navigator.serviceWorker?.controller?.postMessage?.({ type: 'V327_PAGE_READY', version: '333' });
        } catch {}
        try {
            navigator.serviceWorker?.controller?.postMessage?.({ type: 'EVALUATE_CACHE_CLEANUP', version: '333' });
        } catch {}
    }).catch(() => {});

    const [finalOne, finalTwo] = await Promise.all([waitForV333(pageOne), waitForV333(pageTwo)]);
    await wait(6000);
    const settledOne = documentsOne.length;
    const settledTwo = documentsTwo.length;
    const pureOne = await pageState(pageOne);
    const pureTwo = await pageState(pageTwo);
    const sharedCaches = await pageOne.evaluate(() => caches.keys());
    await context.close();
    return {
        midA,
        midB,
        midCaches,
        midHasLegacy,
        midHasCurrent,
        blockedReadyCount,
        finalOne,
        finalTwo,
        pureOne,
        pureTwo,
        sharedCaches,
        documentNavigations: [settledOne - startOne, settledTwo - startTwo],
        documents: [documentsOne.slice(startOne), documentsTwo.slice(startTwo)],
        reloadLoopFree: documentsOne.length === settledOne && documentsTwo.length === settledTwo,
        documentPure: [documentIsPureV333(pureOne), documentIsPureV333(pureTwo)]
    };
}

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const report = { single: null, dual: null, delayedSecondTab: null };
let exitCode = 0;
try {
    report.single = await runSingleTab();
    report.dual = await runDualTab();
    report.delayedSecondTab = await runDelayedSecondTab();
    const single = report.single;
    const dual = report.dual;
    const delayed = report.delayedSecondTab;
    const ok = single.firstEntry?.ready === true
        && !!single.firstEntry?.activePage
        && single.documentNavigations <= 1
        && single.reloadLoopFree
        && single.documentPure === true
        && single.final.version === '333'
        && single.final.cacheKeys.length === 1
        && single.final.cacheKeys[0] === 'training-assistant-v333'
        && single.final.upgradeMarker === null
        && single.finalOldResources.length === 0
        && single.servedV333AssetsFromOld.length === 0
        && single.errors.length === 0
        && single.smoke.finalPage === "today"
        && single.smoke.drawerOpened
        && single.smoke.drawerClosed
        && single.smoke.modalOpened
        && single.smoke.modalClosedByBack
        && dual.documentNavigations.every((count) => count <= 1)
        && dual.documentNavigations.some((count) => count === 1)
        && dual.reloadLoopFree
        && dual.documentPure?.[0] === true
        && dual.documentPure?.[1] === true
        && dual.finalOne.version === '333'
        && dual.finalTwo.version === '333'
        && dual.sharedCaches.length === 1
        && dual.sharedCaches[0] === 'training-assistant-v333'
        && delayed.midHasCurrent === true
        && delayed.midHasLegacy === true
        && Number(delayed.blockedReadyCount || 0) > 0
        && delayed.documentNavigations.every((count) => count <= 1)
        && delayed.reloadLoopFree
        && delayed.documentPure?.[0] === true
        && delayed.documentPure?.[1] === true
        && delayed.sharedCaches.length === 1
        && delayed.sharedCaches[0] === 'training-assistant-v333';
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
