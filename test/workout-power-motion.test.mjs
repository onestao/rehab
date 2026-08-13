import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css-src/52-v6-workout.css', import.meta.url), 'utf8');
const generated = readFileSync(new URL('../build/generated.css', import.meta.url), 'utf8');

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

test('play control keeps a static aura without continuous animation', () => {
  const fabRule = css.match(/\.fab-play\s*\{[^}]*\}/)?.[0] || '';
  assert.doesNotMatch(fabRule, /animation:\s*fab-glow/);
  assert.match(css, /\.fab-play-aura[\s\S]*opacity:\s*\.46/);
  assert.match(css, /\.fab-play-aura[\s\S]*transform:\s*scale\(1\.01\)/);
});

test('timer orbs stay visible but static while timer panel remains isolated', () => {
  assert.match(css, /\.timer-panel[\s\S]*isolation:\s*isolate/);
  assert.match(css, /\.timer-panel::before[\s\S]*transform:\s*translate\(4px,\s*-6px\)\s*scale\(1\.04\)/);
  assert.match(css, /\.timer-panel::after[\s\S]*transform:\s*translate\(3px,\s*-5px\)\s*scale\(1\.03\)/);
});

test('workout source and generated CSS ship no persistent page animation', () => {
  assert.doesNotMatch(css, /animation\s*:[^;]*\binfinite\b/);
  const start = generated.indexOf('/* --- V6 Workout');
  const end = generated.indexOf('/* --- V6 Records', start);
  assert.ok(start >= 0 && end > start, 'generated CSS must include the workout section');
  assert.doesNotMatch(generated.slice(start, end), /animation\s*:[^;]*\binfinite\b/);
});
