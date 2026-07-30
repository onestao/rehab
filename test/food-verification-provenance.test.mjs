// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as foodEvidencePure from '../food-evidence-pure.mjs';
import * as searchPolicyPure from '../search-policy-pure.mjs';

const evidenceSource = readFileSync(new URL('../food-evidence.js', import.meta.url), 'utf8');
const foodLogSource = readFileSync(new URL('../food-log.js', import.meta.url), 'utf8');
const healthDietSource = readFileSync(new URL('../health-diet.js', import.meta.url), 'utf8');

function urlsFromText(value) {
  const urls = [];
  for (const match of String(value || '').match(/https:\/\/[^\s<>"']+/g) || []) {
    const url = searchPolicyPure.safeFetchUrl(match);
    if (url && !urls.includes(url)) urls.push(url);
  }
  return Object.freeze(urls);
}

function harness(elements = {}) {
  const runCalls = [];
  const policy = { mode: 'required', execution: 'external-only', providerIds: [], fallback: 'fail' };
  const ai = {
    cfg: { taskRoutes: {} },
    getTaskNetworkPolicy: () => policy,
    getTaskRoute: () => ({ primary: { profileId: 'p1', modelId: 'm1' } }),
    async run(options) {
      runCalls.push(options);
      return { text: '', meta: { searchEvidence: [] } };
    }
  };
  const window = {
    ai,
    aiRoutingPure: { manualFallbackTarget: value => value },
    searchPolicyPure,
    searchToolLoop: { urlsFromText },
    foodEvidencePure
  };
  const context = {
    window,
    document: { getElementById: id => elements[id] || null },
    console, JSON, String, Number, Object, Array, Set, Date,
    alert() {}
  };
  vm.createContext(context);
  vm.runInContext(evidenceSource, context);
  vm.runInContext(`${foodLogSource}\nthis.__foodLog = foodLog;`, context);
  const candidate = {
    name: '候选 https://candidate.example/name',
    ingredients: ['导入 https://candidate.example/ingredient']
  };
  const data = {
    ...context.__foodLog,
    _aiFoodDrafts: [candidate],
    _aiFoodResults: [candidate],
    _aiFoodEvidence: [],
    _aiFoodVerification: [],
    _aiFoodSourceTask: 'food.text',
    renderAiFoodResults() {}
  };
  return { data, runCalls };
}

test('verifyAiFood explicit empty input cannot authorize candidate or stale textarea URLs', async () => {
  const { data, runCalls } = harness({
    foodAiText: { value: 'https://stale.example/textarea' }
  });
  await data.verifyAiFood(0, { input: '', sourceTask: 'food.text', silent: true });
  assert.equal(runCalls.length, 1);
  assert.deepEqual(Array.from(runCalls[0].userProvidedUrls), []);
  assert.equal(Object.isFrozen(runCalls[0].userProvidedUrls), true);
  assert.doesNotMatch(JSON.stringify(runCalls[0].userProvidedUrls), /candidate\.example|stale\.example/);
});

test('verifyAiFood without input or textarea cannot authorize candidate URLs', async () => {
  const { data, runCalls } = harness();
  await data.verifyAiFood(0, { sourceTask: 'food.text', silent: true });
  assert.equal(runCalls.length, 1);
  assert.deepEqual(Array.from(runCalls[0].userProvidedUrls), []);
  assert.equal(Object.isFrozen(runCalls[0].userProvidedUrls), true);
  assert.doesNotMatch(JSON.stringify(runCalls[0].userProvidedUrls), /candidate\.example/);
});


function visionHarness() {
  const runCalls = [];
  const policy = { mode: 'required', execution: 'external-only', providerIds: [], fallback: 'fail' };
  const candidate = {
    name: '图片候选 https://model.example/name',
    source: '模型来源 https://model.example/source',
    note: '模型备注 https://model.example/note',
    ingredients: ['模型配料 https://model.example/ingredient'],
    confidence: 95
  };
  const ai = {
    cfg: { taskRoutes: {} },
    getTaskNetworkPolicy: () => policy,
    getTaskRoute: () => ({ primary: { profileId: 'p1', modelId: 'm1' } }),
    resolveTaskConfig: () => ({ enabled: true, provider: 'openai', modelId: 'vision-model' }),
    _isHeicFile: () => false,
    async parseFoodFromImage() { return [candidate]; },
    clearVisionFailure() {},
    async run(options) {
      runCalls.push(options);
      return { text: '', meta: { searchEvidence: [] } };
    }
  };
  const elements = { foodAiText: { value: 'https://stale.example/unrelated' } };
  const window = {
    ai,
    aiRoutingPure: { manualFallbackTarget: value => value },
    searchPolicyPure,
    searchToolLoop: {
      urlsFromText,
      normalizeUserProvidedUrls(value) {
        return Object.freeze((Array.isArray(value) ? value : []).map(url => searchPolicyPure.safeFetchUrl(url)).filter(Boolean));
      }
    },
    foodEvidencePure,
    haptics: { light() {}, success() {}, error() {} },
    toast: { show() {}, sanitize: value => String(value?.message || value || '') }
  };
  const context = {
    window,
    document: {
      getElementById: id => elements[id] || null,
      createElement: () => ({ appendChild() {}, textContent: '', dataset: {} }),
      createTextNode: text => ({ textContent: text })
    },
    console, JSON, String, Number, Object, Array, Set, Date, AbortController, setTimeout, clearTimeout,
    alert() {}
  };
  vm.createContext(context);
  vm.runInContext(evidenceSource, context);
  vm.runInContext(`${foodLogSource}\nthis.__foodLog = foodLog;`, context);
  vm.runInContext(healthDietSource, context);
  const data = {
    ...context.__foodLog,
    ...window.dataHealthDiet,
    ensureAiRuntime: async () => ai,
    getDietPhotoSupportInfo: () => ({ supported: true }),
    setDietPhotoStatus() {},
    normalizeAiFoodItems: items => items,
    formatAiDraft: item => ({ ...item }),
    renderAiFoodResults() {},
    dietPhotoTitle: () => '拍照识别'
  };
  return { data, runCalls, candidate };
}

test('handleDietPhoto automatic verification keeps model URLs as query context but never authorization', async () => {
  const { data, runCalls } = visionHarness();
  await data.handleDietPhoto(Object.freeze({ name: 'meal.jpg', type: 'image/jpeg' }));
  assert.equal(runCalls.length, 1);
  assert.match(runCalls[0].messages[1].content, /model\.example/);
  assert.deepEqual(Array.from(runCalls[0].userProvidedUrls), []);
  assert.equal(Object.isFrozen(runCalls[0].userProvidedUrls), true);
});

test('manual verification of a photo result ignores unrelated stale text input', async () => {
  const { data, runCalls } = visionHarness();
  await data.handleDietPhoto(Object.freeze({ name: 'meal.jpg', type: 'image/jpeg' }));
  runCalls.length = 0;
  await data.verifyAiFood(0, { silent: true });
  assert.equal(runCalls.length, 1);
  assert.deepEqual(Array.from(runCalls[0].userProvidedUrls), []);
  assert.equal(Object.isFrozen(runCalls[0].userProvidedUrls), true);
  assert.doesNotMatch(runCalls[0].messages[1].content, /stale\.example/);
});
