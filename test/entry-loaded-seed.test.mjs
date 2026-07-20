/**
 * FIND-15: sync data-rehab-entry list must match _loaded seed.
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

function baseNameFromSrc(src) {
    const noQuery = src.split('?')[0];
    return noQuery.replace(/\.(js|mjs)$/i, '');
}

function extractEntries(html) {
    // Only real tags in the document head/body — ignore comments / string examples.
    const re = /<script\b[^>]*\bdata-rehab-entry\b[^>]*\bdata-src=["']([^"']+)["'][^>]*>/gi;
    const entries = [];
    let m;
    while ((m = re.exec(html))) {
        const tag = m[0];
        const src = m[1];
        if (!src || src === '...' || src.includes('...')) continue;
        const kind = tag.match(/\bdata-kind=["']([^"']+)["']/i)?.[1] || 'classic';
        entries.push({ src, kind, base: baseNameFromSrc(src) });
    }
    return entries;
}

function extractLoadedSeed(html) {
    const m = html.match(/const _loaded = new Set\(\[([^\]]+)\]\)/);
    assert.ok(m, '_loaded seed Set missing');
    return m[1]
        .split(',')
        .map((s) => s.replace(/['"\s]/g, ''))
        .filter(Boolean);
}

function extractNamedSet(html, name) {
    const re = new RegExp(`const ${name} = new Set\\(\\[([^\\]]*)\\]\\)`);
    const m = html.match(re);
    if (!m) return [];
    return m[1]
        .split(',')
        .map((s) => s.replace(/['"\s]/g, ''))
        .filter(Boolean);
}

test('FIND-15: every data-rehab-entry base is in _loaded seed', () => {
    const html = read('index.html');
    const entries = extractEntries(html);
    const seed = new Set(extractLoadedSeed(html));
    assert.ok(entries.length >= 15, `expected many sync entries, got ${entries.length}`);
    const missing = entries.map((e) => e.base).filter((b) => !seed.has(b));
    assert.deepEqual(missing, [], `_loaded seed missing entries: ${missing.join(', ')}`);
});

test('FIND-15: _loaded seed has no phantom modules absent from entries', () => {
    const html = read('index.html');
    const entryBases = new Set(extractEntries(html).map((e) => e.base));
    const seed = extractLoadedSeed(html);
    const phantoms = seed.filter((b) => !entryBases.has(b));
    assert.deepEqual(phantoms, [], `_loaded phantoms not in entries: ${phantoms.join(', ')}`);
});

test('FIND-15: module-kind entries are listed in MODULE_SCRIPTS', () => {
    const html = read('index.html');
    const entries = extractEntries(html);
    const moduleScripts = new Set(extractNamedSet(html, 'MODULE_SCRIPTS'));
    const moduleEntries = entries.filter((e) => e.kind === 'module').map((e) => e.base);
    for (const base of moduleEntries) {
        assert.ok(
            moduleScripts.has(base),
            `module entry ${base} missing from MODULE_SCRIPTS`
        );
    }
});

test('FIND-15: seed includes shell + data boot chain', () => {
    const html = read('index.html');
    const seed = new Set(extractLoadedSeed(html));
    for (const name of [
        'm3e-ripple',
        'toast',
        'error-bus',
        'i18n',
        'theme',
        'render-safe',
        'nav-stack',
        'app-route',
        'data',
        'sync-status'
    ]) {
        assert.ok(seed.has(name), `seed missing ${name}`);
    }
});
