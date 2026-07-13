import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css-src/52-v6-workout.css', import.meta.url), 'utf8');

function extractKeyframes(src, name) {
  const m = src.match(new RegExp(`@keyframes\\s+${name}\\s*\\{([\\s\\S]*?)\\}`));
  assert.ok(m, `missing keyframes ${name}`);
  return m[1];
}

test('playBtn remains unique with stable onclick/ARIA and wrapper aura', () => {
  assert.equal((html.match(/id="playBtn"/g) || []).length, 1);
  assert.match(html, /class="fab-play-shell"/);
  assert.match(html, /class="fab-play-aura"[^>]*aria-hidden="true"/);
  assert.match(html, /id="playBtn"[^>]*onclick="workout\.toggle\(\)"/);
  assert.match(html, /id="playBtn"[^>]*aria-label="/);
  assert.match(html, /id="playIcon"/);
  assert.match(html, /class="fab-label"/);
});

test('fab-glow no longer drives continuous box-shadow on fab-play', () => {
  const fabRule = css.match(/\.fab-play\s*\{[^}]*\}/)?.[0] || '';
  assert.doesNotMatch(fabRule, /animation:\s*fab-glow/);
  assert.match(css, /\.fab-play-aura[\s\S]*animation:\s*fab-aura-glow\s+2\.5s/);
  const body = extractKeyframes(css, 'fab-aura-glow');
  assert.doesNotMatch(body, /box-shadow|filter|backdrop-filter/);
  assert.match(body, /opacity|transform/);
});

test('orb animations remain transform-only and timer panel is isolated', () => {
  assert.match(css, /\.timer-panel[\s\S]*isolation:\s*isolate/);
  assert.match(css, /\.timer-panel::before[\s\S]*animation:\s*orb\s+8s/);
  assert.match(css, /\.timer-panel::after[\s\S]*animation:\s*orb\s+10s/);
  // orb keyframes live in 50-v6-ui.css and are transform-only; local infinite aura is composited
  const ui = readFileSync(new URL('../css-src/50-v6-ui.css', import.meta.url), 'utf8');
  const orb = extractKeyframes(ui, 'orb');
  assert.doesNotMatch(orb, /box-shadow|filter|backdrop-filter/);
  assert.match(orb, /transform/);
});
