/**
 * FIND-16: unified dependency closure validator (PAGE_DEPS + prereqs + SW + gates).
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
    return readFileSync(path.join(root, rel), 'utf8');
}

function extractObjectArrayBlock(html, name) {
    const start = html.indexOf(`const ${name}`);
    assert.ok(start >= 0, `${name} missing`);
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
    return html.slice(brace, end);
}

function parseStringArrayMap(body) {
    /** @type {Record<string, string[]>} */
    const map = {};
    // Keys may be quoted or bare identifiers (PAGE_DEPS uses bare keys).
    const re = /['"]?([A-Za-z0-9_./-]+)['"]?\s*:\s*\[([^\]]*)\]/g;
    let match;
    while ((match = re.exec(body))) {
        map[match[1]] = match[2]
            .split(',')
            .map((s) => s.replace(/['"\s]/g, ''))
            .filter(Boolean);
    }
    return map;
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

function findCycles(prereqs) {
    const cycles = [];
    const visiting = new Set();
    const visited = new Set();
    const stack = [];

    function dfs(node) {
        if (visiting.has(node)) {
            const idx = stack.indexOf(node);
            cycles.push(stack.slice(idx).concat(node));
            return;
        }
        if (visited.has(node)) return;
        visiting.add(node);
        stack.push(node);
        for (const dep of prereqs[node] || []) dfs(dep);
        stack.pop();
        visiting.delete(node);
        visited.add(node);
    }

    for (const key of Object.keys(prereqs)) dfs(key);
    return cycles;
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
    const noQuery = asset.split('?')[0];
    return noQuery.replace(/\.(js|mjs|css|json|html|ico|svg|woff2)$/i, '');
}

function fileExistsForModule(name) {
    const candidates = [
        `${name}.js`,
        `${name}.mjs`,
        name.endsWith('.js') ? name : null,
        name.endsWith('.mjs') ? name : null
    ].filter(Boolean);
    return candidates.some((rel) => existsSync(path.join(root, rel)));
}

test('FIND-16: PAGE_DEPS pages have acyclic prereq closures', () => {
    const html = read('index.html');
    const pageDeps = parseStringArrayMap(extractObjectArrayBlock(html, 'PAGE_DEPS'));
    const prereqs = parseStringArrayMap(extractObjectArrayBlock(html, 'SCRIPT_PREREQUISITES'));
    assert.ok(pageDeps.today, 'PAGE_DEPS.today required');
    assert.ok(pageDeps.profile, 'PAGE_DEPS.profile required');

    const cycles = findCycles(prereqs);
    assert.deepEqual(cycles, [], `cyclic prerequisites: ${JSON.stringify(cycles)}`);

    for (const [page, roots] of Object.entries(pageDeps)) {
        const closure = expandClosure(roots, prereqs);
        assert.ok(closure.length >= roots.length, `${page} closure empty`);
        const missingFiles = closure.filter((name) => !fileExistsForModule(name));
        assert.deepEqual(
            missingFiles,
            [],
            `${page} deps missing on disk: ${missingFiles.join(', ')}`
        );
    }
});

test('FIND-16: Today essential offline closure is in SW ASSETS', () => {
    const html = read('index.html');
    const sw = read('sw.js');
    const pageDeps = parseStringArrayMap(extractObjectArrayBlock(html, 'PAGE_DEPS'));
    const prereqs = parseStringArrayMap(extractObjectArrayBlock(html, 'SCRIPT_PREREQUISITES'));
    const closure = expandClosure(pageDeps.today, prereqs);
    const assetBases = new Set(extractAssets(sw).map(baseName));
    const missing = closure.filter((name) => !assetBases.has(name));
    assert.deepEqual(missing, [], `Today closure missing from SW: ${missing.join(', ')}`);
});

test('FIND-16: Today PAGE_DEPS must not silently include full Profile AI chain', () => {
    const html = read('index.html');
    const pageDeps = parseStringArrayMap(extractObjectArrayBlock(html, 'PAGE_DEPS'));
    const today = new Set(pageDeps.today || []);
    // Profile-only accidental path that masked the v343 bug.
    for (const forbidden of ['ai-task-settings', 'ai-provider-manager', 'ai-models', 'ai-api']) {
        assert.equal(
            today.has(forbidden),
            false,
            `Today must not hard-depend on ${forbidden}; use ensureAiPickerRuntime instead`
        );
    }
});

test('FIND-16: feature readiness gates declare real APIs after load', () => {
    const data = read('data.js');
    assert.match(data, /ensureAiPickerRuntime/);
    assert.match(data, /getMethodOwnerRegistry/);
    assert.match(data, /__isPlanFeatureGateStub/);
    assert.match(data, /__isLazyRecordOpenerStub/);
    assert.match(data, /mountInlinePickers/);
    assert.match(data, /listSelectableModels/);
});

test('FIND-16: SCRIPT_PREREQUISITES keys referenced by PAGE_DEPS resolve', () => {
    const html = read('index.html');
    const pageDeps = parseStringArrayMap(extractObjectArrayBlock(html, 'PAGE_DEPS'));
    const prereqs = parseStringArrayMap(extractObjectArrayBlock(html, 'SCRIPT_PREREQUISITES'));
    const allRoots = Object.values(pageDeps).flat();
    for (const rootName of allRoots) {
        // Root may have empty prereq list; that is fine. Unknown keys are OK if file exists.
        assert.ok(fileExistsForModule(rootName), `PAGE_DEPS root missing file: ${rootName}`);
        for (const dep of prereqs[rootName] || []) {
            assert.ok(fileExistsForModule(dep), `prereq missing file: ${rootName} → ${dep}`);
        }
    }
});
