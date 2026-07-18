import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_COMMIT = 'e40b29b4bc4a3715d0739880b0dc3dd882da1753';

const TODAY_CSS = 'css-src/51-v6-today.css';
const WORKOUT_CSS = 'css-src/52-v6-workout.css';
const UI_KEYFRAMES_CSS = 'css-src/50-v6-ui.css';

const NEW_KEYFRAMES = [
  'hero-aura-breathe',
  'ring-aura-breathe',
  'tl-dot-aura-pulse',
  'fab-aura-glow'
];

const CONTINUOUS_BINDINGS = [
  { file: TODAY_CSS, selector: '.hero-motion-aura', keyframe: 'hero-aura-breathe' },
  { file: TODAY_CSS, selector: '.ring-motion-aura', keyframe: 'ring-aura-breathe' },
  { file: TODAY_CSS, selector: '.tl-item.now .tl-dot::after', keyframe: 'tl-dot-aura-pulse' },
  { file: WORKOUT_CSS, selector: '.fab-play-aura', keyframe: 'fab-aura-glow' },
  { file: WORKOUT_CSS, selector: '.timer-panel::before', keyframe: 'orb' },
  { file: WORKOUT_CSS, selector: '.timer-panel::after', keyframe: 'orb' }
];

const FORBIDDEN_HOST_ANIMATIONS = [
  { file: TODAY_CSS, selector: '.hero', banned: ['glass-breathe'] },
  { file: TODAY_CSS, selector: '.ring', banned: ['ring-breathe'] },
  { file: TODAY_CSS, selector: '.tl-item.now .tl-dot', banned: ['pulse'] },
  { file: WORKOUT_CSS, selector: '.fab-play', banned: ['fab-glow'] }
];

const FROZEN_PATHS = [
  'workout-core.js',
  'workout-system.js',
  'workout-cardio.js',
  'workout-pip.js',
  'css-src/41-m3e-effects.css',
  'css-src/37-dark-mode.css',
  'css-src/54-v6-ai.css',
  'css-src/55-v6-profile.css',
  'css-src/99-custom-overrides.css',
  '.size-limit.cjs'
];

const PAINT_PROPS = ['box-shadow', 'filter', 'backdrop-filter', '-webkit-backdrop-filter', '-webkit-filter'];
const ALLOWED_ANIM_PROPS = new Set([
  'opacity',
  'transform',
  'transform-origin',
  'offset-path',
  'offset-distance',
  'offset-rotate',
  'translate',
  'scale',
  'rotate'
]);

function readRepo(relPath) {
  return readFileSync(path.join(ROOT, relPath), 'utf8');
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function normalizeSelector(selector) {
  return selector.replace(/\s+/g, ' ').trim();
}

function extractKeyframes(css, name) {
  const source = stripComments(css);
  const re = new RegExp(`@keyframes\\s+${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*\\{`, 'g');
  const match = re.exec(source);
  assert.ok(match, `missing @keyframes ${name}`);
  let i = match.index + match[0].length;
  let depth = 1;
  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    i += 1;
  }
  assert.equal(depth, 0, `unbalanced @keyframes ${name}`);
  return source.slice(match.index + match[0].length, i - 1);
}

function splitDeclarations(block) {
  return block
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((decl) => {
      const idx = decl.indexOf(':');
      if (idx < 0) return null;
      return {
        prop: decl.slice(0, idx).trim().toLowerCase(),
        value: decl.slice(idx + 1).trim()
      };
    })
    .filter(Boolean);
}

function assertComposableKeyframes(body, name) {
  const frames = body.match(/(?:from|to|\d+(?:\.\d+)?%|[\d\s%,.]+)\{([^{}]*)\}/gi) || [];
  assert.ok(frames.length > 0, `@keyframes ${name} has no frames`);
  for (const frame of frames) {
    const open = frame.indexOf('{');
    const close = frame.lastIndexOf('}');
    const decls = splitDeclarations(frame.slice(open + 1, close));
    for (const { prop } of decls) {
      assert.ok(
        ALLOWED_ANIM_PROPS.has(prop),
        `@keyframes ${name} animates forbidden property: ${prop}`
      );
      assert.ok(
        !PAINT_PROPS.includes(prop),
        `@keyframes ${name} must not animate paint-heavy property: ${prop}`
      );
    }
  }
}

function extractRuleBlocks(css, selector) {
  const source = stripComments(css);
  const target = normalizeSelector(selector);
  const blocks = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = re.exec(source))) {
    const selectors = match[1]
      .split(',')
      .map((part) => normalizeSelector(part))
      .filter(Boolean);
    if (selectors.includes(target)) {
      blocks.push(match[2]);
    }
  }
  return blocks;
}

function animationNamesFromValue(value) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const tokens = part.split(/\s+/).filter(Boolean);
      return tokens.find((token) => !/^(infinite|forwards|backwards|both|none|normal|reverse|alternate|alternate-reverse|linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end|running|paused|[\d.]+m?s|[\d.]+%|steps?\(.*\))$/i.test(token) && !token.startsWith('var(')) || '';
    })
    .filter(Boolean);
}

function continuousAnimationNames(css, selector) {
  const blocks = extractRuleBlocks(css, selector);
  assert.ok(blocks.length > 0, `missing rule for selector ${selector}`);
  const names = [];
  for (const block of blocks) {
    for (const { prop, value } of splitDeclarations(block)) {
      if (prop === 'animation' || prop === 'animation-name') {
        if (/\binfinite\b/i.test(value) || prop === 'animation-name') {
          names.push(...animationNamesFromValue(value));
        } else if (/\banimation\b/i.test(prop) && /\binfinite\b/i.test(block)) {
          names.push(...animationNamesFromValue(value));
        }
      }
    }
    // animation-name + animation-duration split form
    const decls = splitDeclarations(block);
    const hasInfinite = decls.some(({ prop, value }) =>
      (prop === 'animation' || prop === 'animation-iteration-count') && /\binfinite\b/i.test(value)
    );
    if (hasInfinite) {
      for (const { prop, value } of decls) {
        if (prop === 'animation' || prop === 'animation-name') {
          names.push(...animationNamesFromValue(value));
        }
      }
    }
  }
  return [...new Set(names)];
}

function assertSelectorNotBoundToBanned(css, selector, bannedNames) {
  const names = continuousAnimationNames(css, selector);
  for (const banned of bannedNames) {
    assert.ok(!names.includes(banned), `${selector} still binds continuous animation ${banned}`);
  }
  for (const name of names) {
    // Resolve keyframes from the same file first, then shared UI keyframes.
    let body = null;
    try {
      body = extractKeyframes(css, name);
    } catch {
      body = extractKeyframes(readRepo(UI_KEYFRAMES_CSS), name);
    }
    assertComposableKeyframes(body, `${selector} -> ${name}`);
  }
}

function changedFilesSinceBase() {
  const out = execFileSync(
    'git',
    ['diff', '--name-only', `${BASE_COMMIT}..HEAD`],
    { cwd: ROOT, encoding: 'utf8' }
  );
  return out
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

test('T1/T2 replacement keyframes only animate opacity/transform', () => {
  const today = readRepo(TODAY_CSS);
  const workout = readRepo(WORKOUT_CSS);
  for (const name of ['hero-aura-breathe', 'ring-aura-breathe', 'tl-dot-aura-pulse']) {
    assertComposableKeyframes(extractKeyframes(today, name), name);
  }
  assertComposableKeyframes(extractKeyframes(workout, 'fab-aura-glow'), 'fab-aura-glow');
  // orb remains shared and must stay transform-only for continuous use on timer orbs
  assertComposableKeyframes(extractKeyframes(readRepo(UI_KEYFRAMES_CSS), 'orb'), 'orb');
});

test('continuous motion selectors bind composited keyframes only', () => {
  for (const item of CONTINUOUS_BINDINGS) {
    const css = readRepo(item.file);
    const names = continuousAnimationNames(css, item.selector);
    assert.ok(names.includes(item.keyframe), `${item.selector} must bind ${item.keyframe}, got ${names.join(',') || '(none)'}`);
    let body;
    if (item.keyframe === 'orb') {
      body = extractKeyframes(readRepo(UI_KEYFRAMES_CSS), 'orb');
    } else {
      body = extractKeyframes(css, item.keyframe);
    }
    assertComposableKeyframes(body, `${item.selector} -> ${item.keyframe}`);
  }
});

test('legacy paint-heavy continuous animations are detached from hosts', () => {
  for (const item of FORBIDDEN_HOST_ANIMATIONS) {
    const css = readRepo(item.file);
    assertSelectorNotBoundToBanned(css, item.selector, item.banned);
  }
});

test('frozen product files stay untouched since BASE_COMMIT', () => {
  const changed = new Set(changedFilesSinceBase());
  for (const rel of FROZEN_PATHS) {
    if (rel === '.size-limit.cjs') {
      const baseline = execFileSync('git', ['show', `${BASE_COMMIT}:.size-limit.cjs`], {
        cwd: ROOT,
        encoding: 'utf8'
      }).replace("limit: '60 KB'", "limit: '61 KB'");
      const current = readRepo(rel).replace(/\r\n/g, '\n');
      // Allow the approved first-paint budget change plus the today-view-core records entry.
      const allowed = baseline
        .replace(
          "      'history-view.js',\n      'weekly-summary.js',",
          "      'history-view.js',\n      'today-view-core.js',\n      'weekly-summary.js',"
        )
        .replace(
          "    limit: '90 KB'\n  },\n  { name: 'routine-bundle'",
          "    limit: '90 KB'\n  },\n  {\n    name: 'today-view-core',\n    path: 'today-view-core.js',\n    limit: '18 KB'\n  },\n  { name: 'routine-bundle'"
        );
      assert.equal(current, allowed, 'only the approved first-paint budget + today-view-core size entries are allowed');
      continue;
    }
    assert.ok(!changed.has(rel), `frozen file changed: ${rel}`);
  }
  assert.ok(!changed.has('css-src/54-v6-ai.css'), 'AI page CSS must not change');
  assert.ok(!changed.has('css-src/55-v6-profile.css'), 'profile page CSS must not change');
});
