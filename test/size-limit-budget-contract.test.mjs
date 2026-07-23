import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const config = require(path.join(root, '.size-limit.cjs'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function entry(name) {
    return config.find((item) => item.name === name);
}

function paths(item) {
    return Array.isArray(item?.path) ? item.path : [item?.path].filter(Boolean);
}

test('first-paint budget exactly matches synchronous data-rehab-entry scripts', () => {
    const bootScripts = [...html.matchAll(/<script\b[^>]*\bdata-rehab-entry\b[^>]*\bdata-src=["']([^"']+)/gi)]
        .map((match) => match[1].split(/[?#]/)[0]);
    assert.deepEqual(paths(entry('first-paint-critical-js')), bootScripts);
    assert.equal(entry('first-paint-critical-js')?.limit, '52 KB');
});

test('lazy and post-render scripts stay outside the first-paint budget', () => {
    const firstPaint = new Set(paths(entry('first-paint-critical-js')));
    const deferred = [
        'app-update.js',
        'data-ui-state.js',
        'pwa-support.js',
        'haptics.js',
        'a11y-focus-trap.js',
        'sheet-drag.js',
        'fooddb.js',
        'advice-virtual-list.js',
        'storage/idb-collections.js',
        'storage/idb-advice-collections.js',
        'credential-fields.js'
    ];
    for (const file of deferred) assert.equal(firstPaint.has(file), false, `${file} must stay deferred`);
});

test('deferred runtime areas retain dedicated size budgets', () => {
    assert.deepEqual(paths(entry('update-runtime')), ['app-update.js']);
    assert.deepEqual(paths(entry('page-ui-state')), ['data-ui-state.js']);
    assert.deepEqual(paths(entry('post-render-utilities')), [
        'pwa-support.js',
        'haptics.js',
        'a11y-focus-trap.js',
        'sheet-drag.js'
    ]);
    assert.deepEqual(paths(entry('deferred-storage')), [
        'data-store-deferred.js',
        'storage/idb-collections.js',
        'storage/idb-advice-collections.js'
    ]);
});
