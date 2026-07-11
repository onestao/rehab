import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('context AI icons keep flex centering after the Material Symbols stylesheet loads', () => {
    const css = read('css-src/38-record-page.css');
    assert.match(css, /\.context-ai-icon\s*\{[^}]*display:\s*inline-flex !important;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;[^}]*line-height:\s*1;/s);
});

test('weight overview icon keeps its flex centering contract', () => {
    const css = read('css-src/17-record-tabs-health.css');
    assert.match(css, /\.material-symbols-rounded\.weight-icon\s*\{[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;[^}]*line-height:\s*1;/s);
});

test('AI coach content fills the page and pushes the sticky composer to the nav edge', () => {
    assert.match(read('index.html'), /id="ai-coach" class="page ai-coach-page"/);

    const adviceCss = read('css-src/46-advice-ai.css');
    assert.match(adviceCss, /#ai-coach\.ai-coach-page\.active\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s);
    assert.match(adviceCss, /#ai-coach\.ai-coach-page\.active\s*>\s*#aiCoachContent\s*\{[^}]*flex:\s*1 0 auto;[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s);

    const v6Css = read('css-src/54-v6-ai.css');
    assert.match(v6Css, /\.advice-v6-page\s*\{[^}]*display:\s*flex;[^}]*flex:\s*1 0 auto;[^}]*flex-direction:\s*column;/s);
    assert.match(v6Css, /\.advice-composer-stack\s*\{[^}]*position:\s*sticky;[^}]*margin:\s*auto -14px -14px;/s);
});
