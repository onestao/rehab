/**
 * Formal browser gate: cold Today must mount diet/plan AI model pickers
 * without visiting Profile. Evidence under G:/LLM/rehab/.tmp/today-ai-picker-v343/
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '..');
const repoRoot = path.resolve(root, '../../..');
const evidenceRoot = path.join(root, '.tmp', 'today-ai-picker-v343', 'playwright');

const AI_SEED = {
    KEY: 'rehab_pro_ai_cfg',
    MODELS_KEY: 'rehab_pro_ai_models',
    KEYS_KEY: 'rehab_pro_ai_keys',
    IDB_NAME: 'rehab_ai_store',
    IDB_STORE: 'kv',
    cfg: {
        activeProfileId: 'p-main',
        enabled: true,
        provider: 'openai',
        model: 'gpt-text',
        baseUrl: 'https://example.test/v1',
        profiles: [
            {
                id: 'p-main',
                name: 'Main OpenAI',
                provider: 'openai',
                model: 'gpt-text',
                baseUrl: 'https://example.test/v1',
                enabled: true,
                archived: false
            }
        ],
        taskRoutes: {
            'food.text': {
                primary: { profileId: 'p-main', modelId: 'gpt-text' },
                reasoningDepth: 'off',
                fallbackMode: 'manual',
                fallbacks: []
            },
            'food.vision': {
                primary: { profileId: 'p-main', modelId: 'gpt-vision' },
                reasoningDepth: 'low',
                fallbackMode: 'manual',
                fallbacks: []
            },
            'plan.week': {
                primary: { profileId: 'p-main', modelId: 'gpt-plan' },
                reasoningDepth: 'high',
                fallbackMode: 'manual',
                fallbacks: []
            },
            'plan.today': {
                primary: { profileId: 'p-main', modelId: 'gpt-plan' },
                reasoningDepth: 'medium',
                fallbackMode: 'manual',
                fallbacks: []
            }
        }
    },
    models: [
        {
            id: 'gpt-text',
            profileId: 'p-main',
            displayName: 'Text Model',
            capabilities: { text: true, json: true, streaming: true }
        },
        {
            id: 'gpt-vision',
            profileId: 'p-main',
            displayName: 'Vision Model',
            capabilities: { text: true, json: true, vision: true }
        },
        {
            id: 'gpt-plan',
            profileId: 'p-main',
            displayName: 'Plan Model',
            capabilities: { text: true, json: true, streaming: true }
        }
    ],
    keys: {
        'p-main': 'test-key-not-real'
    }
};

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
    const require = createRequire(path.join(repoRoot, 'package.json'));
    return require('playwright');
}

async function startServer(options = {}) {
    const failOncePaths = new Set(options.failOncePaths || []);
    const alwaysFailPaths = new Set(options.alwaysFailPaths || []);
    const failedOnce = new Set();
    const hits = [];
    const server = createServer(async (req, res) => {
        try {
            const rawUrl = new URL(req.url || '/', 'http://127.0.0.1');
            const pathname = decodeURIComponent(rawUrl.pathname === '/' ? '/index.html' : rawUrl.pathname);
            hits.push(pathname);
            const basename = path.basename(pathname.split('?')[0]);
            if (alwaysFailPaths.has(basename) || alwaysFailPaths.has(pathname)) {
                res.writeHead(404, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
                res.end('not found');
                return;
            }
            if ((failOncePaths.has(basename) || failOncePaths.has(pathname)) && !failedOnce.has(basename)) {
                failedOnce.add(basename);
                res.writeHead(404, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
                res.end('not found');
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
    await new Promise((resolve) => {
        server.listen(port, '127.0.0.1', () => resolve(undefined));
    });
    return {
        server,
        url: `http://127.0.0.1:${port}/index.html`,
        hits,
        failedOnce,
        clearFailOnce() {
            failOncePaths.clear();
            failedOnce.clear();
        }
    };
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

async function seedAiStorage(page) {
    await page.addInitScript((seed) => {
        const openDb = () => /** @type {Promise<IDBDatabase>} */ (new Promise((resolve, reject) => {
            const req = indexedDB.open(seed.IDB_NAME, 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(seed.IDB_STORE)) {
                    db.createObjectStore(seed.IDB_STORE);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        }));
        const put = (db, key, value) => /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
            const tx = db.transaction(seed.IDB_STORE, 'readwrite');
            tx.objectStore(seed.IDB_STORE).put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        }));
        window.__rehabSeedAi = async () => {
            localStorage.setItem(seed.KEY, JSON.stringify(seed.cfg));
            localStorage.setItem(seed.MODELS_KEY, JSON.stringify(seed.models));
            localStorage.setItem(seed.KEYS_KEY, JSON.stringify(seed.keys));
            try {
                const db = await openDb();
                if (db) {
                    await put(db, seed.KEY, JSON.stringify(seed.cfg));
                    await put(db, seed.MODELS_KEY, JSON.stringify(seed.models));
                    await put(db, seed.KEYS_KEY, JSON.stringify(seed.keys));
                    db.close();
                }
            } catch {
                // localStorage fallback is enough for picker visibility
            }
        };
    }, AI_SEED);
}

async function waitBoot(page) {
    await page.waitForFunction(() => {
        return window.data
            && typeof window.data.openDietModal === 'function'
            && typeof window.loadAppScript === 'function'
            && document.querySelector('#today');
    }, null, { timeout: 30000 });
}

async function bootColdToday(page, httpUrl) {
    await seedAiStorage(page);
    await page.goto(httpUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(async () => {
        await window.__rehabSeedAi?.();
    });
    // Reload so AI storage is present before app boot, still without visiting Profile.
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitBoot(page);
    await page.evaluate(() => {
        if (window.data) window.data._activePageId = 'today';
        document.getElementById('today')?.classList.add('active');
        document.getElementById('profile')?.classList.remove('active');
        window.__profileActivated = false;
        const originalEnsure = window.ensureDeps;
        if (typeof originalEnsure === 'function') {
            window.ensureDeps = async function (pageId, options) {
                if (pageId === 'profile') window.__profileActivated = true;
                return originalEnsure.call(this, pageId, options);
            };
        }
    });
}

function assertStayedOnToday(snapshot) {
    assert.equal(snapshot.activePageId, 'today');
    assert.equal(snapshot.profileActive, false);
    assert.equal(snapshot.profileActivated, false);
}

async function pageNavSnapshot(page) {
    return page.evaluate(() => ({
        activePageId: window.data?._activePageId
            || document.querySelector('.page.active')?.id
            || null,
        profileActive: !!document.getElementById('profile')?.classList.contains('active'),
        profileActivated: !!window.__profileActivated,
        hasAiTaskSettings: !!window.aiTaskSettings,
        hasAi: !!window.ai,
        aiReadyFlag: !!window.data?._aiRuntimeReady,
        gateState: window.data?._aiPickerRuntimeGate?.state || null
    }));
}

async function waitForPickerButton(page, taskId, timeout = 20000) {
    await page.waitForFunction((id) => {
        const host = document.querySelector(`[data-ai-task-picker="${id}"]`)
            || (id.startsWith('plan.') ? document.getElementById('planAiTaskPicker') : null);
        if (!host) return false;
        return !!host.querySelector('button.ai-compact-model');
    }, taskId, { timeout });
}

test('source contract: Today does not load full AI PAGE_DEPS but openers use readiness gate', () => {
    const html = readFileSync(path.join(root, 'index.html'), 'utf8');
    const data = readFileSync(path.join(root, 'data.js'), 'utf8');
    const healthDiet = readFileSync(path.join(root, 'health-diet.js'), 'utf8');
    const planAi = readFileSync(path.join(root, 'plan-ai.js'), 'utf8');
    const todayDeps = html.match(/today:\s*\[([^\]]+)\]/)?.[1] || '';

    assert.match(todayDeps, /history-view/);
    assert.match(todayDeps, /today-view-core/);
    assert.doesNotMatch(todayDeps, /ai-task-settings/);
    assert.doesNotMatch(todayDeps, /ai-api/);
    assert.match(data, /ensureAiPickerRuntime/);
    assert.match(healthDiet, /mountDietAiPickers/);
    assert.match(planAi, /mountPlanAiPickerReady/);
    assert.doesNotMatch(planAi, /window\.aiTaskSettings\?\.mountPlanAiPicker\?\.\(\)/);
});

test('T1 diet text picker cold Today without Profile', async () => {
    await mkdir(evidenceRoot, { recursive: true });
    const http = await startServer();
    try {
        await withBrowser(async (browser) => {
            const context = await browser.newContext({
                serviceWorkers: 'block',
                viewport: { width: 390, height: 844 }
            });
            const page = await context.newPage();
            const pageErrors = [];
            page.on('pageerror', (err) => pageErrors.push(err.message));
            await bootColdToday(page, http.url);

            await page.locator('button[data-q="diet"], button:has-text("记饮食")').first().click({ timeout: 10000 });
            await page.waitForSelector('#dietModal:not(.hidden)', { timeout: 15000 });
            await waitForPickerButton(page, 'food.text');

            const evidence = {
                ...await pageNavSnapshot(page),
                pageErrors,
                foodTextButton: await page.locator('[data-ai-task-picker="food.text"] button.ai-compact-model').count(),
                foodTextLabel: await page.locator('[data-ai-task-picker="food.text"] button.ai-compact-model').first().innerText().catch(() => ''),
                scriptHits: http.hits.filter((h) => /ai-task-settings|ai-api|ai-store/.test(h))
            };
            await writeFile(path.join(evidenceRoot, 't1-diet-text.json'), JSON.stringify(evidence, null, 2));

            assertStayedOnToday(evidence);
            assert.equal(evidence.foodTextButton, 1);
            assert.match(evidence.foodTextLabel, /Text Model|gpt-text|Main/i);
            assert.equal(pageErrors.filter((m) => /TypeError|is not a function/i.test(m)).length, 0);
            await context.close();
        });
    } finally {
        await new Promise((resolve) => http.server.close(resolve));
    }
});

test('T2 diet vision picker cold Today without Profile', async () => {
    await mkdir(evidenceRoot, { recursive: true });
    const http = await startServer();
    try {
        await withBrowser(async (browser) => {
            const context = await browser.newContext({
                serviceWorkers: 'block',
                viewport: { width: 390, height: 844 }
            });
            const page = await context.newPage();
            await bootColdToday(page, http.url);
            await page.locator('button[data-q="diet"], button:has-text("记饮食")').first().click({ timeout: 10000 });
            await page.waitForSelector('#dietModal:not(.hidden)', { timeout: 15000 });
            await waitForPickerButton(page, 'food.vision');

            await page.locator('[data-ai-task-picker="food.vision"] button.ai-compact-model').first().click();
            await page.waitForSelector('#aiModelPickerSheet:not(.hidden)', { timeout: 10000 });

            const evidence = {
                ...await pageNavSnapshot(page),
                foodVisionButton: await page.locator('[data-ai-task-picker="food.vision"] button.ai-compact-model').count(),
                sheetOpen: await page.locator('#aiModelPickerSheet:not(.hidden)').count(),
                sheetRows: await page.locator('#aiModelPickerContent .ai-task-model-row, #aiModelPickerContent .ai-task-model-main').count()
            };
            await writeFile(path.join(evidenceRoot, 't2-diet-vision.json'), JSON.stringify(evidence, null, 2));

            assertStayedOnToday(evidence);
            assert.equal(evidence.foodVisionButton, 1);
            assert.ok(evidence.sheetOpen >= 1);
            assert.ok(evidence.sheetRows >= 1);
            await context.close();
        });
    } finally {
        await new Promise((resolve) => http.server.close(resolve));
    }
});

test('T3 plan week picker cold Today without Profile', async () => {
    await mkdir(evidenceRoot, { recursive: true });
    const http = await startServer();
    try {
        await withBrowser(async (browser) => {
            const context = await browser.newContext({
                serviceWorkers: 'block',
                viewport: { width: 390, height: 844 }
            });
            const page = await context.newPage();
            await bootColdToday(page, http.url);

            // Week plan AI path: openNewPlanSheet('week') → createSelectedPlans('week')
            await page.evaluate(async () => {
                if (typeof window.data.openNewPlanSheet === 'function') {
                    await window.data.openNewPlanSheet('week');
                }
            });
            await page.waitForFunction(() => {
                return !!document.querySelector('.md-modal[data-rl-modal="1"]')
                    || !!document.querySelector('button:has-text("AI 7天")');
            }, null, { timeout: 20000 }).catch(() => {});

            const weekBtn = page.locator('button:has-text("AI 7天"), button:has-text("AI")').filter({ hasText: /7|周|week/i }).first();
            if (await weekBtn.count()) {
                await weekBtn.click({ timeout: 10000 });
            } else {
                await page.evaluate(async () => {
                    await window.data.createSelectedPlans?.('week');
                    if (typeof window.data.openPlanAiSheet === 'function') {
                        await window.data.openPlanAiSheet('week', ['rehab']);
                    }
                });
            }

            await page.waitForSelector('#planAiSheet:not(.hidden)', { timeout: 20000 });
            await waitForPickerButton(page, 'plan.week');

            const evidence = {
                ...await pageNavSnapshot(page),
                planMode: await page.evaluate(() => window.data?._planAiMode || null),
                hostTask: await page.evaluate(() => document.getElementById('planAiTaskPicker')?.dataset?.aiTaskPicker || null),
                planButton: await page.locator('#planAiTaskPicker button.ai-compact-model').count(),
                planLabel: await page.locator('#planAiTaskPicker button.ai-compact-model').first().innerText().catch(() => ''),
                selectable: await page.evaluate(() => {
                    try {
                        return (window.ai?.listSelectableModels?.('plan.week') || []).map((m) => m.modelId);
                    } catch {
                        return [];
                    }
                })
            };
            await writeFile(path.join(evidenceRoot, 't3-plan-week.json'), JSON.stringify(evidence, null, 2));

            assertStayedOnToday(evidence);
            assert.equal(evidence.planMode, 'week');
            assert.equal(evidence.hostTask, 'plan.week');
            assert.equal(evidence.planButton, 1);
            assert.ok(evidence.selectable.includes('gpt-plan'));
            await context.close();
        });
    } finally {
        await new Promise((resolve) => http.server.close(resolve));
    }
});

test('T5 single-flight concurrent diet open loads ai-task-settings once', async () => {
    await mkdir(evidenceRoot, { recursive: true });
    const http = await startServer();
    try {
        await withBrowser(async (browser) => {
            const context = await browser.newContext({
                serviceWorkers: 'block',
                viewport: { width: 390, height: 844 }
            });
            const page = await context.newPage();
            await bootColdToday(page, http.url);

            await page.evaluate(async () => {
                let pickerRuntimeCalls = 0;
                window.__pickerRuntimeCalls = pickerRuntimeCalls;
                const original = window.data.ensureAiRuntime?.bind(window.data);
                if (original) {
                    window.data.ensureAiRuntime = async function (...args) {
                        pickerRuntimeCalls += 1;
                        window.__pickerRuntimeCalls = pickerRuntimeCalls;
                        return original(...args);
                    };
                }
                await Promise.all([
                    window.data.openDietModal(),
                    window.data.openDietModal(),
                    window.data.openDietModal()
                ]);
            });
            await waitForPickerButton(page, 'food.text');

            const evidence = {
                ...await pageNavSnapshot(page),
                ensureAiRuntimeCalls: await page.evaluate(() => window.__pickerRuntimeCalls),
                gateState: await page.evaluate(() => window.data?._aiPickerRuntimeGate?.state || null),
                taskSettingsHits: http.hits.filter((h) => /ai-task-settings\.js/.test(h)).length,
                compactButtons: await page.locator('[data-ai-task-picker] button.ai-compact-model').count()
            };
            await writeFile(path.join(evidenceRoot, 't5-single-flight.json'), JSON.stringify(evidence, null, 2));

            assertStayedOnToday(evidence);
            assert.equal(evidence.gateState, 'ready');
            assert.equal(evidence.taskSettingsHits, 1);
            // ensureAiRuntime may be called once for shared promise; allow vision pass but not unbounded
            assert.ok(evidence.ensureAiRuntimeCalls >= 1 && evidence.ensureAiRuntimeCalls <= 3);
            assert.ok(evidence.compactButtons >= 2);
            await context.close();
        });
    } finally {
        await new Promise((resolve) => http.server.close(resolve));
    }
});

test('T6 failure shows Chinese error and retry remounts pickers', async () => {
    await mkdir(evidenceRoot, { recursive: true });
    const http = await startServer({ failOncePaths: ['ai-task-settings.js'] });
    try {
        await withBrowser(async (browser) => {
            const context = await browser.newContext({
                serviceWorkers: 'block',
                viewport: { width: 390, height: 844 }
            });
            const page = await context.newPage();
            await bootColdToday(page, http.url);

            await page.evaluate(async () => {
                await window.data.openDietModal();
            });
            await page.waitForFunction(() => {
                const hosts = Array.from(document.querySelectorAll('[data-ai-task-picker]'));
                return hosts.some((host) => /失败|未注册|加载|重试|404|Not found|error/i.test(host.textContent || ''))
                    || !!document.querySelector('.diet-ai-picker-retry');
            }, null, { timeout: 20000 });

            const failed = {
                ...await pageNavSnapshot(page),
                hostText: await page.locator('[data-ai-task-picker="food.text"]').innerText().catch(() => ''),
                hasRetry: await page.locator('.diet-ai-picker-retry').count(),
                blankHosts: await page.evaluate(() => {
                    return Array.from(document.querySelectorAll('[data-ai-task-picker]')).filter((n) => !n.childElementCount).length;
                })
            };
            await writeFile(path.join(evidenceRoot, 't6-failure.json'), JSON.stringify(failed, null, 2));
            assertStayedOnToday(failed);
            assert.equal(failed.blankHosts, 0);
            assert.ok(failed.hasRetry >= 1 || /失败|重试|未注册|加载/.test(failed.hostText));

            // Network recovered after fail-once; retry must succeed.
            await page.locator('.diet-ai-picker-retry').first().click({ timeout: 10000 });
            await waitForPickerButton(page, 'food.text');
            const recovered = {
                foodTextButton: await page.locator('[data-ai-task-picker="food.text"] button.ai-compact-model').count(),
                foodVisionButton: await page.locator('[data-ai-task-picker="food.vision"] button.ai-compact-model').count()
            };
            await writeFile(path.join(evidenceRoot, 't6-retry.json'), JSON.stringify(recovered, null, 2));
            assert.equal(recovered.foodTextButton, 1);
            assert.equal(recovered.foodVisionButton, 1);
            await context.close();
        });
    } finally {
        await new Promise((resolve) => http.server.close(resolve));
    }
});

test('T7 early ai:ready does not block explicit mount after DOM create', async () => {
    await mkdir(evidenceRoot, { recursive: true });
    const http = await startServer();
    try {
        await withBrowser(async (browser) => {
            const context = await browser.newContext({
                serviceWorkers: 'block',
                viewport: { width: 390, height: 844 }
            });
            const page = await context.newPage();
            await bootColdToday(page, http.url);

            // Warm picker runtime and fire ai:ready before modal DOM exists.
            // Keep this single-flight: one evaluate avoids navigation races after SW/boot reload.
            await page.evaluate(async () => {
                await window.data.ensureAiPickerRuntime({ vision: true });
                window.dispatchEvent(new CustomEvent('ai:ready'));
                await new Promise((resolve) => setTimeout(resolve, 50));
                await window.data.openDietModal();
            });
            await page.waitForSelector('#dietModal:not(.hidden)', { timeout: 15000 });
            await waitForPickerButton(page, 'food.text');
            await waitForPickerButton(page, 'food.vision');

            const evidence = {
                ...await pageNavSnapshot(page),
                foodTextButton: await page.locator('[data-ai-task-picker="food.text"] button.ai-compact-model').count(),
                foodVisionButton: await page.locator('[data-ai-task-picker="food.vision"] button.ai-compact-model').count()
            };
            await writeFile(path.join(evidenceRoot, 't7-early-ready.json'), JSON.stringify(evidence, null, 2));
            assertStayedOnToday(evidence);
            assert.equal(evidence.foodTextButton, 1);
            assert.equal(evidence.foodVisionButton, 1);
            await context.close();
        });
    } finally {
        await new Promise((resolve) => http.server.close(resolve));
    }
});

test('T8 reopen remounts diet and plan pickers', async () => {
    await mkdir(evidenceRoot, { recursive: true });
    const http = await startServer();
    try {
        await withBrowser(async (browser) => {
            const context = await browser.newContext({
                serviceWorkers: 'block',
                viewport: { width: 390, height: 844 }
            });
            const page = await context.newPage();
            await bootColdToday(page, http.url);

            await page.evaluate(async () => {
                await window.data.openDietModal();
            });
            await waitForPickerButton(page, 'food.text');
            await page.evaluate(() => {
                window.data.closeDietModalInternal?.() || window.data.closeDietModal?.();
            });
            await page.waitForSelector('#dietModal.hidden, #dietModal[aria-hidden="true"]', { timeout: 10000 }).catch(() => {});
            await page.evaluate(async () => {
                await window.data.openDietModal();
            });
            await waitForPickerButton(page, 'food.text');
            await waitForPickerButton(page, 'food.vision');

            await page.evaluate(async () => {
                window.data.closeDietModalInternal?.();
                await window.data.openPlanAiSheet('week', ['rehab']);
            });
            await page.waitForSelector('#planAiSheet:not(.hidden)', { timeout: 15000 });
            await waitForPickerButton(page, 'plan.week');
            await page.evaluate(() => {
                window.data.closePlanAiSheet?.();
            });
            await page.evaluate(async () => {
                await window.data.openPlanAiSheet('week', ['rehab']);
            });
            await waitForPickerButton(page, 'plan.week');

            const evidence = {
                ...await pageNavSnapshot(page),
                foodTextButton: await page.locator('[data-ai-task-picker="food.text"] button.ai-compact-model').count(),
                planButton: await page.locator('#planAiTaskPicker button.ai-compact-model').count(),
                planTask: await page.evaluate(() => document.getElementById('planAiTaskPicker')?.dataset?.aiTaskPicker || null)
            };
            await writeFile(path.join(evidenceRoot, 't8-reopen.json'), JSON.stringify(evidence, null, 2));
            assertStayedOnToday(evidence);
            assert.equal(evidence.foodTextButton, 1);
            assert.equal(evidence.planButton, 1);
            assert.equal(evidence.planTask, 'plan.week');
            await context.close();
        });
    } finally {
        await new Promise((resolve) => http.server.close(resolve));
    }
});
