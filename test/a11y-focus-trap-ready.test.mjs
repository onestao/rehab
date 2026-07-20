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

test('F-T2: modal open awaits focusTrap ready before display', () => {
    const ui = read('data-ui-state.js');
    // Prefer async _openModal body (H3 contract).
    let openStart = ui.indexOf('async _openModal({');
    if (openStart < 0) openStart = ui.indexOf('_openModal({');
    assert.ok(openStart > 0);
    const nextFn = ui.indexOf('\n        _confirmModal', openStart);
    const body = ui.slice(openStart, nextFn > openStart ? nextFn : openStart + 4000);
    assert.match(body, /ensureFocusTrapReady|loadAppScript\('a11y-focus-trap'\)/);
    assert.match(body, /await\s+this\.ensureFocusTrapReady|await\s+window\.loadAppScript\('a11y-focus-trap'\)/);
    // When trap is missing, must await ensure before append.
    const awaitIdx = body.search(/await\s+this\.ensureFocusTrapReady|await\s+window\.loadAppScript\('a11y-focus-trap'\)/);
    const appendIdx = body.indexOf('appendChild(modal)');
    assert.ok(awaitIdx >= 0 && appendIdx > awaitIdx, 'must await focus trap before appending modal when trap missing');
    // Fast path: do not force await when focusTrap already present (sync modal open).
    assert.match(body, /if\s*\(\s*!window\.focusTrap\?\.trap\s*\)|if\s*\(\s*!window\.focusTrap/);
    assert.match(body, /\.trap\(/);
});

test('F-T3: a11y module is in SW ASSETS for offline modals', () => {
    const sw = read('sw.js');
    assert.match(sw, /a11y-focus-trap\.js\?v=343/);
});

test('F-T4: focus trap implements Tab cycle Escape and release restore', () => {
    const trap = read('a11y-focus-trap.js');
    assert.match(trap, /function trap\(/);
    assert.match(trap, /function release\(/);
    assert.match(trap, /e\.key === 'Escape'|e\.key === \"Escape\"/);
    assert.match(trap, /e\.key !== 'Tab'|e\.key === 'Tab'/);
    assert.match(trap, /e\.shiftKey/);
    assert.match(trap, /state\.previous\?\.focus|previous\?\.focus/);
});
