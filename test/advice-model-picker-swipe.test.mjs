import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = process.cwd();
const source = readFileSync(join(root, 'advice-panel.js'), 'utf8');
const css = readFileSync(join(root, 'css-src/48-advice-model-picker.css'), 'utf8');

function loadPanel() {
    const context = {
        window: { addEventListener() {}, matchMedia() { return { matches: false, addEventListener() {} }; } },
        document: { addEventListener() {}, getElementById() { return null; }, querySelector() { return null; } },
        localStorage: { getItem() { return null; }, setItem() {} },
        sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
        navigator: { maxTouchPoints: 1 },
        requestAnimationFrame(fn) { fn(); }
    };
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(`${source}\nthis.__panel = advicePanel;`, context);
    return context.__panel;
}

test('swipe resolver changes one scope only after a deliberate gesture', () => {
    const resolve = loadPanel()._test?.resolveAdviceModelSwipeScope;
    assert.equal(typeof resolve, 'function');
    assert.equal(resolve('current', -20, 320, -0.1), 'current');
    assert.equal(resolve('current', -110, 320, -0.4), 'others');
    assert.equal(resolve('others', -110, 320, -0.4), 'cached');
    assert.equal(resolve('others', 110, 320, 0.4), 'current');
    assert.equal(resolve('cached', -110, 320, -0.4), 'cached');
});

test('AI coach picker binds live pointer tracking and a sliding scope indicator', () => {
    assert.match(source, /advice-model-picker-content/);
    assert.match(source, /data-advice-model-swipe/);
    assert.match(source, /model-picker-tab-indicator/);
    assert.match(source, /model-picker-track/);
    assert.match(source, /ADVICE_MODEL_SCOPES\.map\(renderPage\)/);
    assert.match(source, /pointermove/);
    assert.match(source, /--model-picker-drag-x/);
    assert.match(source, /--model-picker-tab-progress/);
});

test('AI coach picker owns one vertical scroller while its page follows horizontal touch', () => {
    assert.match(css, /\.md-modal-sheet-card\.advice-model-picker-card\s*\{[^}]*overflow:\s*hidden/s);
    assert.match(css, /\.advice-model-picker-content\s*\{[^}]*overflow-y:\s*auto/s);
    assert.match(css, /\.model-picker-swipe-region\s*\{[^}]*touch-action:\s*pan-y/s);
    assert.match(css, /\.model-picker-page\s*\{[^}]*translate3d\(var\(--model-picker-drag-x/s);
    assert.match(css, /\.model-picker-track\s*\{[^}]*translate3d\(calc\(var\(--model-picker-scope-index/s);
    assert.match(css, /\.model-picker-swipe-region\.is-dragging \.model-picker-page\s*\{[^}]*transition:\s*none/s);
});
