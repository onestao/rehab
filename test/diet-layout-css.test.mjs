import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const readRootFile = path => readFileSync(join(root, path), 'utf8');

test('diet inline editor keeps cancel readable and save flexible on narrow screens', () => {
    const css = readRootFile('css-src/18-health-diet.css');

    const inlineActionsIndex = css.indexOf('.food-inline-actions {');
    const editOverrideIndex = css.indexOf('.food-inline-actions.food-edit-actions');

    assert.notEqual(inlineActionsIndex, -1);
    assert.ok(editOverrideIndex > inlineActionsIndex);
    assert.match(css, /\.food-inline-actions\.food-edit-actions\s*\{[^}]*display:\s*grid/s);
    assert.match(css, /\.food-inline-actions\.food-edit-actions\s*\{[^}]*grid-template-columns:\s*minmax\(76px,\s*max-content\)\s*minmax\(0,\s*1fr\)/s);
    assert.match(css, /\.food-edit-actions \.md-btn-tonal\s*\{[^}]*min-width:\s*76px/s);
    assert.match(css, /\.food-edit-actions \.md-btn-filled\s*\{[^}]*width:\s*100%/s);
});

test('expanded collapsible cards and records swipe deck do not clip tall diet content', () => {
    const recordHealthCss = readRootFile('css-src/17-record-tabs-health.css');
    const v6RecordsCss = readRootFile('css-src/53-v6-records.css');

    assert.match(recordHealthCss, /\.collapsible-card:not\(\.collapsed\) \.collapse-content\s*\{[^}]*max-height:\s*none/s);
    assert.match(recordHealthCss, /\.collapsible-card:not\(\.collapsed\) \.collapse-content\s*\{[^}]*overflow:\s*visible/s);
    assert.match(v6RecordsCss, /\.health-swipe-deck\s*\{[^}]*overflow-y:\s*visible/s);
});
