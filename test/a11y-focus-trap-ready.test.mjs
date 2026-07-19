/**
 * Phase F: focus trap must not depend solely on +2s idle utility load.
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

test('F-T1: a11y-focus-trap is loaded immediately in schedulePostRenderUtilityLoad', () => {
    const html = read('index.html');
    const start = html.indexOf('function schedulePostRenderUtilityLoad');
    assert.ok(start > 0);
    const body = html.slice(start, start + 900);
    assert.match(body, /loadScript\('a11y-focus-trap'\)/);
    // Must not wait only inside the delayed idle bundle for a11y.
    const idleBlock = body.slice(body.indexOf('setTimeout'));
    assert.doesNotMatch(
        idleBlock,
        /loadScript\('a11y-focus-trap'\)/,
        'a11y-focus-trap must not be deferred solely into +2s idle batch'
    );
    assert.match(idleBlock, /loadScript\('haptics'\)/);
    assert.match(idleBlock, /loadScript\('sheet-drag'\)/);
});

test('F-T2: modal open ensures focusTrap, loading script if missing', () => {
    const ui = read('data-ui-state.js');
    const openStart = ui.indexOf('_openModal({');
    assert.ok(openStart > 0);
    // Include full modal open body through onMount (focus trap is near the end).
    const nextFn = ui.indexOf('\n        _confirmModal', openStart);
    const body = ui.slice(openStart, nextFn > openStart ? nextFn : openStart + 4000);
    assert.match(body, /focusTrap/);
    assert.match(body, /loadAppScript\('a11y-focus-trap'\)/);
    assert.match(body, /\.trap\(/);
});

test('F-T3: a11y module is in SW ASSETS for offline modals', () => {
    const sw = read('sw.js');
    assert.match(sw, /a11y-focus-trap\.js\?v=335/);
});
