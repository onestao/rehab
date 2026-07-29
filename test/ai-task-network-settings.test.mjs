// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../search-settings.js', import.meta.url), 'utf8');

function load() {
  const storage = new Map();
  const document = {
    createElement() { return { append() {}, addEventListener() {}, classList: { add() {}, remove() {} }, setAttribute() {} }; },
    createTextNode(value) { return { textContent: String(value) }; },
    getElementById() { return null; }
  };
  const root = { document, addEventListener() {} };
  root.window = root;
  const localStorage = {
    getItem(key) { return storage.get(key) || null; },
    setItem(key, value) { storage.set(key, String(value)); }
  };
  vm.runInNewContext(source, { window: root, document, localStorage, console, String, Number, Array, Object, Set, Map, JSON, Date });
  return root.searchSettings._test;
}

test('sequential provider selection always uses the latest task state', () => {
  const api = load();
  let ids = [];
  ids = api.updateProviderSelection(ids, 'one', true);
  ids = api.updateProviderSelection(ids, 'two', true);
  assert.deepEqual(Array.from(ids), ['one', 'two']);
  ids = api.updateProviderSelection(ids, 'one', false);
  assert.deepEqual(Array.from(ids), ['two']);
});

test('task provider order moves without losing references', () => {
  const api = load();
  assert.deepEqual(Array.from(api.moveProviderSelection(['one', 'two', 'three'], 'three', -1)), ['one', 'three', 'two']);
  assert.deepEqual(Array.from(api.moveProviderSelection(['one', 'two', 'three'], 'one', 1)), ['two', 'one', 'three']);
});

test('network privacy copy is task-specific and onboarding is one-time', () => {
  const api = load();
  assert.match(api.privacyCopy('food.vision'), /餐品、品牌、地区、规格/);
  assert.match(api.privacyCopy('rehab.weekly'), /康复处方文本/);
  assert.doesNotMatch(api.privacyCopy('rehab.weekly'), /餐品/);
  assert.equal(api.shouldShowOnboarding('off', 'auto', false), true);
  assert.equal(api.shouldShowOnboarding('off', 'required', true), false);
  assert.equal(api.shouldShowOnboarding('auto', 'required', false), false);
});
