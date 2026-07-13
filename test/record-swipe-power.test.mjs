import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadUiState() {
  const code = readFileSync(new URL('../data-ui-state.js', import.meta.url), 'utf8');
  const sandbox = { window: {}, console, document: {
    getElementById() { return null; },
    querySelectorAll() { return []; }
  }, clearTimeout, setTimeout };
  vm.runInNewContext(code, sandbox);
  return sandbox.window.dataUiState;
}

const css38 = readFileSync(new URL('../css-src/38-record-page.css', import.meta.url), 'utf8');
const css53 = readFileSync(new URL('../css-src/53-v6-records.css', import.meta.url), 'utf8');
const src = readFileSync(new URL('../data-ui-state.js', import.meta.url), 'utf8');

test('swipe deck marks only one active page matching healthView', () => {
  const api = loadUiState();
  const ctx = {
    ...api,
    healthView: 'weight',
    healthViewOrder() { return ['diet', 'weight', 'training', 'calendar']; },
    renderHealthViewByKey(view) { return `<div class="md-card">${view}</div>`; }
  };
  const html = api.renderHealthSwipeDeck.call(ctx);
  const actives = [...html.matchAll(/class="health-swipe-page([^"]*)"/g)].map((m) => m[1]);
  assert.equal(actives.filter((c) => c.includes('is-active')).length, 1);
  assert.match(html, /data-health-page="weight"[^>]*data-health-active="true"|class="health-swipe-page is-active"[^>]*data-health-page="weight"/);
  assert.match(html, /data-health-page="diet"[^>]*data-health-active="false"|class="health-swipe-page"[^>]*data-health-page="diet"/);
});

test('scroll settle path sets and clears is-swiping and syncs active', () => {
  assert.match(src, /deck\.classList\.add\('is-swiping'\)/);
  assert.match(src, /deck\.classList\.remove\('is-swiping'\)/);
  assert.match(src, /setTimeout\(\(\)\s*=>\s*\{[\s\S]*80\)/);
  assert.match(src, /syncHealthSwipeActive/);
  assert.match(src, /scrollToHealthView[\s\S]*syncHealthSwipeActive\(view\)/);
});

test('offscreen cards skip m3e entry animation and will-change is swipe-scoped', () => {
  assert.match(css38, /\.health-swipe-page:not\(\.is-active\)\s+\.md-card\s*\{[\s\S]*animation:\s*none/);
  assert.match(css53, /\.health-swipe-page:not\(\.is-active\)\s+\.md-card\s*\{[\s\S]*animation:\s*none/);
  const permanentPageRule = css38.match(/\.health-swipe-page\s*\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.doesNotMatch(permanentPageRule, /will-change:\s*transform,\s*opacity/);
  assert.match(css38, /\.health-swipe-deck\.is-swiping\s+\.health-swipe-page\s*\{[\s\S]*will-change:\s*transform,\s*opacity/);
  assert.match(css38, /scroll-snap-type:\s*x\s+mandatory/);
  assert.match(css38, /transform-origin:\s*center\s+top/);
});
