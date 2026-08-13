import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

function readRootFile(file) {
    return readFileSync(path.join(process.cwd(), file), 'utf8');
}

function extractBlock(source, start, end) {
    const startIndex = source.indexOf(start);
    assert.notEqual(startIndex, -1, `${start} should exist`);
    const endIndex = source.indexOf(end, startIndex);
    assert.notEqual(endIndex, -1, `${end} should exist after ${start}`);
    return source.slice(startIndex, endIndex);
}

test('today keeps quick record modules lazy until the user taps a record action', () => {
    const html = readRootFile('index.html');
    const todayDeps = html.match(/today:\s*\[([^\]]*)\]/)?.[1] || '';

    assert.match(todayDeps, /'history-view'/);
    assert.match(todayDeps, /'today-view-core'/);
    assert.doesNotMatch(todayDeps, /'plan-ui'|'health-diet'|'health-weight'|'health-exercise'|'food-log'/);
    assert.match(html, /function scheduleTodayEnhancementLoad\(\)/);
});

test('food AI recognition lazily loads the AI runtime before touching window.ai', () => {
    const foodLog = readRootFile('food-log.js');
    const data = readRootFile('data.js');
    const healthDiet = readRootFile('health-diet.js');

    assert.match(data, /ensureAiRuntime/);
    assert.match(data, /ensureAiPickerRuntime/);
    assert.match(foodLog, /ensureAiRuntime/);
    assert.match(healthDiet, /ensureAiRuntime\(\{ vision: true \}\)/);
    assert.match(healthDiet, /mountDietAiPickers|ensureAiPickerRuntime/);
    assert.doesNotMatch(foodLog, /\bai\.cfg|\bai\.parseFood/);
});

test('service worker awaits runtime cache writes and keeps heavy lazy modules out of install precache', () => {
    const sw = readRootFile('sw.js');
    const precacheAssets = sw.match(/const ASSETS = \[([\s\S]*?)\];/)?.[1] || '';

    assert.match(sw, /await cache\.put\(request, clone\)\.catch/);
    for (const asset of [
        'assets/heic2any.min.js',
        'plan-ai.js',
        'plan-auto-adjust.js',
        'routine-library.js',
        'weekly-summary.js',
        'report-panel.js',
        'ai-api.js',
        'ai-store.js',
        'ai-profile.js',
        'ai-models.js',
        'ai-vision-pure.mjs'
    ]) {
        assert.doesNotMatch(precacheAssets, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
});

test('edge performance smoke script is available as an explicit npm script', () => {
    const packageJson = JSON.parse(readRootFile('package.json'));
    const scriptPath = path.join(process.cwd(), 'scripts', 'edge-perf-smoke.mjs');
    const script = readRootFile('scripts/edge-perf-smoke.mjs');

    assert.equal(existsSync(scriptPath), true);
    assert.equal(packageJson.scripts['perf:edge'], 'node scripts/edge-perf-smoke.mjs');
    assert.match(script, /Runtime\.consoleAPICalled/);
    assert.match(script, /console errors:/);
});

test('material symbols use a preloaded local font without a delayed remote swap', () => {
    const html = readRootFile('index.html');
    const head = extractBlock(html, '<head>', '</head>');
    const css = readRootFile('css-src/02-base.css');

    assert.doesNotMatch(html, /fonts\.googleapis\.com|scheduleMaterialSymbolsLoad/);
    assert.match(head, /rel="preload"[^>]+data-rehab-font-preload[^>]+data-href="assets\/material-symbols-rounded\.woff2\?v=\d+"[^>]+as="font"/);
    assert.match(css, /@font-face[\s\S]*material-symbols-rounded\.woff2/);
    assert.equal(
        readRootFile('assets/material-symbols-icons.txt').trim(),
        readRootFile('build/icons.csv').trim(),
        'the bundled Material Symbols subset must cover every collected icon'
    );
});

test('weight modal loads without pulling Bluetooth code into the interaction path', () => {
    const html = readRootFile('index.html');

    assert.doesNotMatch(html, /'health-weight':\s*\[[^\]]*mi-scale/);
    assert.match(html, /'mi-scale-web-bluetooth':\s*\['mi-scale-pure'\]/);
    assert.match(html, /MODULE_SCRIPTS[^;]*'mi-scale-pure'/);
});

test('history-view still preloads health-summary-pure for lightweight today diet summaries', () => {
    const html = readRootFile('index.html');
    const historyPrereq = html.match(/'history-view':\s*\[([^\]]*)\]/)?.[1] || '';
    const todayCorePrereq = html.match(/'today-view-core':\s*\[([^\]]*)\]/)?.[1] || '';
    const todayDepsLiteral = html.match(/today:\s*(\[[^\]]*\])/)?.[1] || '';

    assert.equal(todayDepsLiteral.replace(/\s+/g, ''), "['history-view','today-view-core']");
    assert.match(historyPrereq, /'health-summary-pure'/);
    assert.match(todayCorePrereq, /'health-summary-pure'/);
    assert.doesNotMatch(todayDepsLiteral, /'health-diet'|'food-log'|'plan-ui'/);
    assert.doesNotMatch(historyPrereq, /'health-diet'|'food-log'/);
});

test('food-log always loads fooddb first so manual diet search cannot hit ReferenceError', () => {
    const html = readRootFile('index.html');
    const data = readRootFile('data.js');
    const foodLog = readRootFile('food-log.js');
    const foodLogPrereq = html.match(/'food-log':\s*\[([^\]]*)\]/)?.[1] || '';

    assert.match(foodLog, /\bfooddb\.(searchAll|getAll)\b/);
    assert.match(foodLogPrereq, /'food-ai-normalizer-pure'/);
    assert.match(foodLogPrereq, /'fooddb'/);
    assert.match(data, /openDietModal:\s*\{[\s\S]*?scripts:\s*\[[^\]]*'fooddb'[^\]]*\]/);
    assert.doesNotMatch(foodLog, /window\.fooddb/);
});
