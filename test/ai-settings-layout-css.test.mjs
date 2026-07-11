import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const css = readFileSync(join(process.cwd(), 'css-src/20-settings-ai.css'), 'utf8');

test('supplier summary uses an existing surface token for its background', () => {
    assert.match(css, /\.ai-provider-summary\s*\{[^}]*background:\s*var\(--md-sys-surface-container-low\)/s);
    assert.doesNotMatch(css, /\.ai-provider-summary\s*\{[^}]*--md-sys-color-surface-container-low/s);
});

test('functional model controls use stable aligned columns', () => {
    assert.match(css, /\.ai-task-quick-controls\s*\{[^}]*display:\s*grid/s);
    assert.match(css, /\.ai-task-quick-controls\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*44px\s*44px/s);
    assert.match(css, /\.ai-compact-model\s*\{[^}]*width:\s*100%/s);
});

test('model picker has one immediate touch scroll surface', () => {
    assert.match(css, /\.md-modal-sheet-card\.ai-task-quick-card\s*\{[^}]*overflow:\s*hidden/s);
    assert.match(css, /\.ai-task-quick-body\s*\{[^}]*min-height:\s*0/s);
    assert.match(css, /\.ai-task-quick-body\s*\{[^}]*touch-action:\s*pan-y/s);
    assert.match(css, /\.ai-task-quick-body\s*\{[^}]*-webkit-overflow-scrolling:\s*touch/s);
});
