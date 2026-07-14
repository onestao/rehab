import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import path from 'node:path';

function read(file) {
    return readFileSync(path.join(process.cwd(), file), 'utf8');
}

test('health full css is requested only on real health intent', () => {
    const state = read('data-ui-state.js');
    assert.match(state, /requestHealthProfileCss\(/);
    assert.match(state, /bindHealthCssIntent\(/);
    assert.match(state, /pointerdown/);
    assert.match(state, /focusin/);
    assert.match(state, /swipe-start/);
    assert.match(state, /data-health-view="training"/);
    assert.match(state, /ensureHealthViewCss\(view\)/);
    // still only loads 42-health-profile for training view helper
    assert.match(state, /if \(view !== 'training'\) return;/);
    assert.doesNotMatch(state, /setInterval\(/);
    assert.doesNotMatch(state, /new MutationObserver|new ResizeObserver/);
});

test('plain records/diet entry helpers do not preload health css outside training path', () => {
    const state = read('data-ui-state.js');
    const ensure = state.slice(state.indexOf('ensureHealthViewCss'), state.indexOf('requestHealthProfileCss'));
    assert.match(ensure, /view !== 'training'/);
    assert.doesNotMatch(ensure, /view === 'diet'|view === 'weight'|view === 'calendar'/);
});
