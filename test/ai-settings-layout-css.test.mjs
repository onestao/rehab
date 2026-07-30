import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const css = readFileSync(join(process.cwd(), 'css-src/20-settings-ai.css'), 'utf8');
const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
const taskSettings = readFileSync(join(process.cwd(), 'ai-task-settings.js'), 'utf8');
const searchSettings = readFileSync(join(process.cwd(), 'search-settings.js'), 'utf8');

test('supplier summary uses an existing surface token for its background', () => {
    assert.match(css, /\.ai-provider-summary\s*\{[^}]*background:\s*var\(--md-sys-surface-container-low\)/s);
    assert.doesNotMatch(css, /\.ai-provider-summary\s*\{[^}]*--md-sys-color-surface-container-low/s);
});

test('functional model controls keep all utility controls on one mobile row', () => {
    assert.match(css, /\.ai-task-quick-controls\s*\{[^}]*display:\s*grid/s);
    assert.match(css, /\.ai-task-quick-controls\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto/s);
    assert.match(css, /\.ai-task-utility-controls\s*\{[^}]*flex-wrap:\s*nowrap/s);
    assert.match(css, /\.ai-compact-model\s*\{[^}]*width:\s*100%/s);
    assert.match(taskSettings, /const utility = el\('div', 'ai-task-utility-controls'\)/);
    assert.match(taskSettings, /quick\.append\(utility\)/);
});

test('network and provider icon controls expose visible captions', () => {
    assert.match(taskSettings, /\['search', '\\u6309\\u9700\\u641c'\]/);
    assert.match(taskSettings, /\['verified', '\\u5148\\u6838\\u5b9e'\]/);
    assert.match(taskSettings, /dataset\.label/);
    assert.match(css, /\.ai-task-utility-controls > button::after\s*\{[^}]*content:\s*attr\(data-label\)/s);
    assert.match(taskSettings, /icon\('tune'\)/);
    assert.match(searchSettings, /ai-task-network-order-btn/);
    assert.match(searchSettings, /search-provider-order-btn/);
    assert.match(searchSettings, /ai-task-order-caption/);
});

test('model picker has one immediate touch scroll surface', () => {
    assert.match(css, /\.md-modal-sheet-card\.ai-task-quick-card\s*\{[^}]*overflow:\s*hidden/s);
    assert.match(css, /\.ai-task-quick-body\s*\{[^}]*min-height:\s*0/s);
    assert.match(css, /\.ai-task-quick-body\s*\{[^}]*touch-action:\s*pan-y/s);
    assert.match(css, /\.ai-task-quick-body\s*\{[^}]*-webkit-overflow-scrolling:\s*touch/s);
});

test('AI settings expose a bounded configurable inactivity timeout', () => {
    assert.match(html, /id="aiRequestTimeoutSeconds"/);
    assert.match(html, /id="aiRequestTimeoutSeconds"[^>]*min="30"[^>]*max="900"[^>]*value="300"/);
    assert.match(html, /onchange="ai\.setRequestTimeoutSeconds\(this\.value\)"/);
});
