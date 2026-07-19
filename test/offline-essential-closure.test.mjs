/**
 * Phase D: essential offline Today closure must be ⊆ SW ASSETS (FIND-05).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
    return readFileSync(path.join(root, rel), 'utf8');
}

function extractPageDepsToday(html) {
    const m = html.match(/today:\s*\[([^\]]+)\]/);
    assert.ok(m, 'PAGE_DEPS.today missing');
    return m[1]
        .split(',')
        .map((s) => s.replace(/['"\s]/g, ''))
        .filter(Boolean);
}

function extractScriptPrerequisites(html) {
    const start = html.indexOf('const SCRIPT_PREREQUISITES');
    assert.ok(start > 0, 'SCRIPT_PREREQUISITES missing');
    const brace = html.indexOf('{', start);
    let depth = 0;
    let end = brace;
    for (; end < html.length; end += 1) {
        const ch = html[end];
        if (ch === '{') depth += 1;
        else if (ch === '}') {
            depth -= 1;
            if (depth === 0) {
                end += 1;
                break;
            }
        }
    }
    const body = html.slice(brace, end);
    /** @type {Record<string, string[]>} */
    const map = {};
    const re = /['"]([^'"]+)['"]\s*:\s*\[([^\]]*)\]/g;
    let match;
    while ((match = re.exec(body))) {
        map[match[1]] = match[2]
            .split(',')
            .map((s) => s.replace(/['"\s]/g, ''))
            .filter(Boolean);
    }
    return map;
}

function extractAssets(swSource) {
    const start = swSource.indexOf('const ASSETS');
    assert.ok(start >= 0, 'ASSETS missing');
    const open = swSource.indexOf('[', start);
    const close = swSource.indexOf('];', open);
    const body = swSource.slice(open, close + 1);
    const assets = [];
    const re = /['"]([^'"]+)['"]/g;
    let match;
    while ((match = re.exec(body))) assets.push(match[1]);
    return assets;
}

function baseName(asset) {
    // 'history-view.js?v=336' -> 'history-view'
    // 'ai-model-catalog-pure.mjs?v=336' -> 'ai-model-catalog-pure'
    // 'storage/idb.js?v=336' -> 'storage/idb'
    const noQuery = asset.split('?')[0];
    return noQuery.replace(/\.(js|mjs|css|json|html|ico|svg|woff2)$/i, '');
}

function expandClosure(roots, prereqs) {
    const seen = new Set();
    const queue = [...roots];
    while (queue.length) {
        const name = queue.shift();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        for (const dep of prereqs[name] || []) {
            if (!seen.has(dep)) queue.push(dep);
        }
    }
    return [...seen];
}

test('D-T1: PAGE_DEPS.today closure is precached in SW ASSETS', () => {
    const html = read('index.html');
    const sw = read('sw.js');
    const today = extractPageDepsToday(html);
    const prereqs = extractScriptPrerequisites(html);
    const closure = expandClosure(today, prereqs);
    const assets = extractAssets(sw);
    const assetBases = new Set(assets.map(baseName));

    assert.ok(today.includes('history-view'), 'today must depend on history-view');
    assert.ok(today.includes('today-view-core'), 'today must depend on today-view-core');
    assert.ok(closure.includes('health-summary-pure'), 'history-view/today-view-core prereq health-summary-pure');

    const missing = closure.filter((name) => !assetBases.has(name));
    assert.deepEqual(
        missing,
        [],
        `Today essential modules missing from ASSETS: ${missing.join(', ')}`
    );
    assert.ok(
        assets.some((a) => a.startsWith('history-view.js')),
        'history-view.js must appear explicitly in ASSETS (FIND-05)'
    );
});

test('D-T2: core boot shell assets remain precached', () => {
    const sw = read('sw.js');
    const assets = extractAssets(sw);
    const required = [
        'index.html',
        'data.js',
        'today-view-core.js',
        'health-summary-pure.js',
        'history-view.js',
        'workout-system.js',
        'workout-engine.js',
        'app-update.js',
        'a11y-focus-trap.js',
        'nav-stack.js',
        'app-route.js'
    ];
    for (const name of required) {
        assert.ok(
            assets.some((a) => a === name || a.startsWith(`${name}?`) || a.startsWith(name)),
            `missing essential asset: ${name}`
        );
    }
});

test('D-T3: offline contract does not require bloating every lazy page script', () => {
    // Records/AI-only modules may stay runtime-fetched; essential today loop must not.
    const sw = read('sw.js');
    const assets = extractAssets(sw);
    const assetBases = new Set(assets.map(baseName));
    // Intentionally NOT requiring every records/AI dep — document the boundary.
    assert.equal(assetBases.has('history-view'), true);
    assert.equal(assetBases.has('advice-panel'), false, 'advice-panel should stay out of essential precache');
});
