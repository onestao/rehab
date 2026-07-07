import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();

test('toast action remains clickable while toast shell ignores stray taps', () => {
    const css = readFileSync(join(root, 'css-src/30-components-toast.css'), 'utf8');

    assert.match(css, /\.app-toast\s*\{[^}]*pointer-events:\s*none/s);
    assert.match(css, /\.app-toast-text\s*\{[^}]*min-width:\s*0/s);
    assert.match(css, /\.app-toast-action\s*\{[^}]*pointer-events:\s*auto/s);
});
