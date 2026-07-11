import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const markup = readFileSync('advice-panel.js', 'utf8');
const baseCss = readFileSync('css-src/46-advice-ai.css', 'utf8');
const v6Css = readFileSync('css-src/54-v6-ai.css', 'utf8');

test('compact model chip arrow class is positioned by both CSS layers', () => {
    assert.match(markup, /class="material-symbols-rounded advice-model-chip-arrow"/);
    assert.match(baseCss, /\.advice-model-chip-arrow/);
    assert.match(v6Css, /\.ai-input \.advice-model-picker \.advice-model-chip-arrow/);
    assert.match(v6Css, /\.advice-model-mark \{[^}]*flex: none;/);
});
