import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const markup = readFileSync('advice-panel.js', 'utf8');
const attachments = readFileSync('advice-attachments.js', 'utf8');
const taskSettings = readFileSync('ai-task-settings.js', 'utf8');
const cachedIcons = new Set(readFileSync('build/icons.txt', 'utf8').split(/\r?\n/).filter(Boolean));
const baseCss = readFileSync('css-src/46-advice-ai.css', 'utf8');
const v6Css = readFileSync('css-src/54-v6-ai.css', 'utf8');

test('compact model chip is arrowless and blends into the composer surface', () => {
    assert.doesNotMatch(markup, /advice-model-chip-arrow/);
    assert.doesNotMatch(baseCss, /\.advice-model-chip-arrow/);
    assert.doesNotMatch(v6Css, /\.advice-model-chip-arrow/);
    assert.match(v6Css, /\.advice-model-picker\.advice-model-chip \{[^}]*border: 0;[^}]*background: transparent;[^}]*box-shadow: none;/s);
    assert.match(v6Css, /\.advice-model-picker \.advice-model-mark \{[^}]*background: transparent;/s);
});

test('model switch success relies on the refreshed icon instead of a blocking toast', () => {
    assert.doesNotMatch(markup, /已切换至/);
    assert.match(markup, /refreshAdviceModelChip\?\.\(\)/);
});

test('attachment controls use the local image-add icon instead of a window icon', () => {
    assert.match(attachments, /const IMAGE_ICON_MARKUP = '<svg class="advice-image-icon"/);
    assert.match(attachments, /<path d="M19 3H5/);
    assert.doesNotMatch(attachments, /material-symbols-rounded">picture_in_picture_alt/);
    assert.doesNotMatch(attachments, /material-symbols-rounded">visibility/);
    assert.match(v6Css, /\.advice-image-icon \{[^}]*fill: currentColor;/s);
    for (const icon of ['clinical_notes', 'upload_file']) {
        assert.ok(cachedIcons.has(icon), `${icon} must exist in the local icon cache`);
    }
});

test('composer reasoning states use icon names available in the local cache', () => {
    assert.match(taskSettings, /value: 'off',[^\n]*icon: 'block'/);
    for (const icon of ['auto_awesome', 'block', 'self_improvement', 'psychology', 'tips_and_updates']) {
        assert.ok(cachedIcons.has(icon), `${icon} must exist in the local icon cache`);
    }
});

test('monochrome cached model icons are softened and inverted only in dark mode', () => {
    for (const key of ['openai', 'grok', 'kimi', 'mimo', 'generic']) {
        assert.match(v6Css, new RegExp(`\\.advice-model-${key}`));
    }
    assert.match(v6Css, /\.advice-model-icon \{ opacity: \.72; \}/);
    assert.match(v6Css, /@media \(prefers-color-scheme: dark\)[\s\S]*?:root:not\(\[data-theme-mode="light"\]\)[^}]*filter: invert\(1\);/);
    assert.match(v6Css, /\[data-theme-mode="dark"\][^}]*filter: invert\(1\);/);
});
