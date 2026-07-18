// @ts-nocheck
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync, rmSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'G:/LLM/rehab/node_modules/playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executablePath = process.env.CHROMIUM_PATH || 'C:/Users/YING/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const port = Number(process.env.REHAB_BROWSER_PORT || 4195);
const origin = `http://127.0.0.1:${port}`;
const profileRoot = path.join(root, '.tmp-verify-v333-styles');
const releaseVersion = (await import('node:fs')).readFileSync(path.join(root, 'sw.js'), 'utf8').match(/training-assistant-v(\d+)/)?.[1] || '333';

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
    const file = path.resolve(root, `.${relative}`);
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

function cleanProfile(name) {
    mkdirSync(profileRoot, { recursive: true });
    const profilePath = path.join(profileRoot, name);
    if (existsSync(profilePath)) rmSync(profilePath, { recursive: true, force: true });
    return profilePath;
}

async function styleContract(page) {
    return page.evaluate(async () => {
        const links = [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => ({
            href: link.href,
            sheet: Boolean(link.sheet),
            disabled: link.disabled,
            media: link.media
        }));
        const sheets = [...document.styleSheets].map((sheet) => {
            let rules = null;
            let error = null;
            try { rules = sheet.cssRules?.length ?? null; }
            catch (e) { error = String(e && e.message || e); }
            return { href: sheet.href, rules, error, disabled: sheet.disabled };
        });
        const button = document.querySelector('.md-btn');
        const style = button ? getComputedStyle(button) : null;
        const icon = document.querySelector('.material-symbols-rounded');
        const iconStyle = icon ? getComputedStyle(icon) : null;
        let cssProbe = null;
        const cssUrl = links.find((l) => /generated\.css/.test(l.href))?.href;
        if (cssUrl) {
            const res = await fetch(cssUrl, { cache: 'no-store' });
            const text = await res.text();
            cssProbe = {
                url: cssUrl,
                status: res.status,
                contentType: res.headers.get('content-type'),
                length: text.length,
                looksLikeHtml: /^\s*</.test(text) || /<!doctype|<html/i.test(text)
            };
        }
        return {
            ready: document.body.classList.contains('rehab-app-ready'),
            controller: navigator.serviceWorker.controller?.scriptURL || null,
            cacheKeys: await caches.keys().catch(() => []),
            links,
            sheets,
            button: style ? {
                display: style.display,
                height: style.height,
                borderRadius: style.borderRadius,
                background: style.backgroundColor,
                fontFamily: style.fontFamily
            } : null,
            icon: icon && iconStyle ? {
                text: icon.textContent?.trim() || '',
                fontFamily: iconStyle.fontFamily
            } : null,
            cssProbe,
            resolveAssetUrl: typeof window.resolveAssetUrl === 'function'
                ? window.resolveAssetUrl(`build/generated.css?v=${document.documentElement.dataset.v || ''}`)
                : null
        };
    });
}

function assertStyled(label, evidence) {
    if (!evidence.ready) throw new Error(`${label}: not ready`);
    if (!evidence.links.some((link) => /generated\.css/.test(link.href) && link.sheet)) {
        throw new Error(`${label}: generated.css link missing/unapplied: ${JSON.stringify(evidence.links)}`);
    }
    if (!evidence.cssProbe || evidence.cssProbe.status !== 200) {
        throw new Error(`${label}: css probe failed: ${JSON.stringify(evidence.cssProbe)}`);
    }
    if (!/text\/css/i.test(evidence.cssProbe.contentType || '')) {
        throw new Error(`${label}: bad content-type: ${JSON.stringify(evidence.cssProbe)}`);
    }
    if (evidence.cssProbe.looksLikeHtml) {
        throw new Error(`${label}: css body is HTML`);
    }
    if (!evidence.button) throw new Error(`${label}: no .md-btn`);
    if (!(evidence.button.display === 'inline-flex' || evidence.button.display === 'flex')) {
        throw new Error(`${label}: button display defaulted: ${JSON.stringify(evidence.button)}`);
    }
    if (evidence.button.height !== '44px') {
        throw new Error(`${label}: button height defaulted: ${JSON.stringify(evidence.button)}`);
    }
    if (!(evidence.button.borderRadius === '9999px' || parseFloat(evidence.button.borderRadius) >= 20)) {
        throw new Error(`${label}: button radius defaulted: ${JSON.stringify(evidence.button)}`);
    }
    if (evidence.icon && /^(fitness_center|skip_next|system_update|directions_run)$/.test(evidence.icon.text || '')) {
        // text content can still be ligature codepoints; font-family must be Material Symbols
        if (!/Material Symbols/i.test(evidence.icon.fontFamily || '')) {
            throw new Error(`${label}: material symbols font missing: ${JSON.stringify(evidence.icon)}`);
        }
    }
    const ruleCount = evidence.sheets
        .filter((sheet) => sheet.href && /generated\.css/.test(sheet.href))
        .reduce((sum, sheet) => sum + (Number(sheet.rules) || 0), 0);
    // Cross-origin-like opaque sheets may hide cssRules; accept either countable rules or applied styles.
    if (ruleCount === 0 && !evidence.button) {
        throw new Error(`${label}: no stylesheet rules visible`);
    }
    return true;
}

async function runClean(name) {
    const profile = cleanProfile(name);
    const context = await chromium.launchPersistentContext(profile, {
        executablePath,
        headless: true,
        viewport: { width: 480, height: 900 },
        userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36'
    });
    const page = context.pages()[0] || await context.newPage();
    const consoleMessages = [];
    page.on('console', (msg) => {
        if (/generated\.css unavailable|应用样式/i.test(msg.text())) consoleMessages.push(msg.text());
    });
    await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.body.classList.contains('rehab-app-ready'), null, { timeout: 30000 });
    await wait(2500);
    // Reload once SW can control the page.
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.body.classList.contains('rehab-app-ready'), null, { timeout: 30000 });
    await wait(2500);
    const evidence = await styleContract(page);
    await page.screenshot({ path: path.join(profileRoot, `${name}.png`), fullPage: true });
    await context.close();
    assertStyled(name, evidence);
    if (consoleMessages.length) throw new Error(`${name}: unexpected css warnings: ${consoleMessages.join(' | ')}`);
    return evidence;
}

await new Promise((resolve) => server.listen(port, resolve));
const results = {};
try {
    results.clean = await runClean('clean-v333');
    // reopen same profile
    {
        const profile = path.join(profileRoot, 'clean-v333');
        const context = await chromium.launchPersistentContext(profile, {
            executablePath,
            headless: true,
            viewport: { width: 480, height: 900 },
            userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36'
        });
        const page = context.pages()[0] || await context.newPage();
        await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => document.body.classList.contains('rehab-app-ready'), null, { timeout: 30000 });
        await wait(2000);
        const evidence = await styleContract(page);
        await page.screenshot({ path: path.join(profileRoot, 'reopen-v333.png'), fullPage: true });
        await context.close();
        assertStyled('reopen-v333', evidence);
        results.reopen = evidence;
    }
    // offline with cache
    {
        const profile = path.join(profileRoot, 'clean-v333');
        const context = await chromium.launchPersistentContext(profile, {
            executablePath,
            headless: true,
            viewport: { width: 480, height: 900 },
            userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36'
        });
        const page = context.pages()[0] || await context.newPage();
        // Ensure SW is controlling while online, then go offline for the next navigation.
        await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => document.body.classList.contains('rehab-app-ready') && !!navigator.serviceWorker.controller, null, { timeout: 30000 });
        await wait(1000);
        await context.setOffline(true);
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => document.body.classList.contains('rehab-app-ready'), null, { timeout: 30000 });
        await wait(2000);
        const evidence = await styleContract(page);
        await page.screenshot({ path: path.join(profileRoot, 'offline-v333.png'), fullPage: true });
        await context.close();
        assertStyled('offline-v333', evidence);
        results.offline = evidence;
    }
} finally {
    server.close();
}

writeFileSync(path.join(profileRoot, 'results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify({
    releaseVersion,
    cleanController: results.clean.controller,
    cleanCss: results.clean.cssProbe,
    cleanButton: results.clean.button,
    cleanIcon: results.clean.icon,
    reopenController: results.reopen.controller,
    offlineButton: results.offline.button,
    ok: true
}, null, 2));
