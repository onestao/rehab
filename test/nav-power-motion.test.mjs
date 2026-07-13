import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../css-src/56-v6-nav.css', import.meta.url), 'utf8');

test('nav keeps blur and gains compositor isolation', () => {
  assert.match(css, /backdrop-filter:\s*blur\(24px\)\s+saturate\(180%\)/);
  assert.match(css, /-webkit-backdrop-filter:\s*blur\(24px\)\s+saturate\(180%\)/);
  assert.match(css, /isolation:\s*isolate/);
  assert.match(css, /contain:\s*paint|transform:\s*translateZ\(0\)/);
});

test('nav transitions stay narrow and continuous paint animations stay banned', () => {
  assert.doesNotMatch(css, /transition:\s*all\b/);
  assert.doesNotMatch(css, /animation:[^;]*(infinite)/);
  assert.doesNotMatch(css, /@keyframes[\s\S]*(box-shadow|filter|backdrop-filter)/);
});
