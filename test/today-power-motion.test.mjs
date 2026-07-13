import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadPlanUi() {
  const policyCode = readFileSync(new URL('../rehab-policy.js', import.meta.url), 'utf8');
  const code = readFileSync(new URL('../plan-ui.js', import.meta.url), 'utf8');
  const sandbox = {
    window: {},
    console,
    document: { querySelectorAll() { return []; } },
    requestAnimationFrame(fn) { fn(); return 1; }
  };
  sandbox.window.workout = { isPlaying: false, setMode() {}, toggle() {} };
  sandbox.ui = { async tab() {} };
  vm.runInNewContext(policyCode, sandbox);
  vm.runInNewContext(code, sandbox);
  return sandbox.window.dataPlanUi;
}

function createContext(api, plans) {
  return {
    ...api,
    db: { dailyPlans: plans, health: { weights: [], dietGoal: { dailyCal: 2000 } } },
    selectedPlanId: plans[0]?.id || '',
    getTodayDailyPlans() { return plans; },
    ensureTodayPlan() { return plans[0] || null; },
    aggregateCompletionRate() { return { done: 1, total: 2, rate: 0.5 }; },
    completionRate() { return { done: 1, total: 2, rate: 0.5 }; },
    planTypeMeta(type = 'rehab') {
      return { label: type, taskLabel: type, icon: 'fitness_center' };
    },
    logicalDateKey() { return '2026-05-25'; },
    dateKey() { return '2026-05-25'; },
    dateFromKey(value) { return new Date(`${value}T00:00:00`); },
    activeRecords(list) { return list || []; },
    sortedWeights() { return []; },
    todayCalories() { return 1500; },
    todayMacros() { return { pro: 80, carb: 180, fat: 50 }; },
    defaultDietGoals() { return { pro: 100, carb: 250, fat: 70 }; },
    todayTrainingCalories() { return 0; },
    computeStreakDays() { return 3; },
    ensurePlanPrefs() { return { showWeeklyDock: true, showCooldownDock: true }; },
    pendingCooldownCount() { return 0; },
    escapeHtml(value) { return String(value ?? ''); },
    ratio(value, total) {
      return total ? Math.max(0, Math.min(100, Math.round((value / total) * 100))) : 0;
    }
  };
}

function readTodayCss() {
  return readFileSync(new URL('../css-src/51-v6-today.css', import.meta.url), 'utf8');
}

function extractKeyframes(css, name) {
  const re = new RegExp(`@keyframes\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`);
  const m = css.match(re);
  assert.ok(m, `missing @keyframes ${name}`);
  return m[1];
}

function assertComposable(body, name) {
  assert.doesNotMatch(body, /box-shadow|filter|backdrop-filter/, `${name} must not animate paint-heavy props`);
  assert.match(body, /opacity|transform/, `${name} should animate opacity/transform`);
}

test('hero and rings expose aria-hidden motion aura layers', () => {
  const api = loadPlanUi();
  const plans = [{ id: 'p1', type: 'rehab', title: '康复计划', items: [] }];
  const html = api.renderPlanTodaySection.call(createContext(api, plans));
  assert.match(html, /class="hero"/);
  assert.match(html, /class="hero-motion-aura"[^>]*aria-hidden="true"/);
  assert.match(html, /class="ring ring-train[\s\S]*class="ring-motion-aura"[^>]*aria-hidden="true"/);
  const diet = api.renderPlanIntakeRing.call(createContext(api, plans));
  assert.match(diet, /class="ring ring-diet"/);
  assert.match(diet, /class="ring-motion-aura"[^>]*aria-hidden="true"/);
  assert.match(diet, /--progress:\d+;/);
  assert.match(diet, /--pro-stop:/);
});

test('dynamic ring data and train onclick remain intact', () => {
  const api = loadPlanUi();
  const plans = [{ id: 'plan-x', type: 'bulk', title: '增肌', items: [] }];
  const html = api.renderPlanTodaySection.call(createContext(api, plans));
  assert.match(html, /openPlanTaskDrawer\('plan-x'\)|openNewPlanSheet\(\)/);
  assert.match(html, /--plan-progress:/);
  const diet = api.renderPlanIntakeRing.call(createContext(api, plans));
  assert.match(diet, /75%|[\d]+%/);
  assert.match(diet, /1500\/2000/);
});

test('today css stops infinite paint animations on hero and rings', () => {
  const css = readTodayCss();
  const heroBlock = css.match(/\.hero\s*\{[\s\S]*?\n\}/)?.[0] || '';
  const ringBlock = css.match(/\.ring\s*\{[\s\S]*?\n\}/)?.[0] || '';
  assert.doesNotMatch(heroBlock, /animation:\s*glass-breathe/);
  assert.doesNotMatch(ringBlock, /animation:\s*ring-breathe/);
  assert.match(css, /\.hero-motion-aura[\s\S]*animation:\s*hero-aura-breathe\s+6s/);
  assert.match(css, /\.ring-motion-aura[\s\S]*animation:\s*ring-aura-breathe\s+5\.4s/);
  assert.match(css, /\.ring-diet\s+\.ring-motion-aura\s*\{\s*animation-delay:\s*0\.6s/);
  assert.match(css, /\.tl-item\.now\s+\.tl-dot::after[\s\S]*animation:\s*tl-dot-aura-pulse\s+2s/);
  assert.doesNotMatch(css, /\.tl-item\.now\s+\.tl-dot\s*\{[^}]*animation:\s*pulse/);

  for (const name of ['hero-aura-breathe', 'ring-aura-breathe', 'tl-dot-aura-pulse']) {
    assertComposable(extractKeyframes(css, name), name);
  }
});
