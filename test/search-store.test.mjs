// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as searchPolicyPure from '../search-policy-pure.mjs';

const source = readFileSync(new URL('../search-store.js', import.meta.url), 'utf8');

test('saving provider metadata with a blank key preserves the existing secret', async () => {
  const root = {
    searchPolicyPure,
    ai: { cfg: {}, async persist() {}, persistDataDb() {}, async idbSet() {} },
    addEventListener() {}
  };
  const context = { window: root, localStorage: { setItem() {}, getItem() { return null; } }, JSON, Object, String, Error };
  vm.runInNewContext(source, context);
  root.searchStore.config = searchPolicyPure.normalizeSearchConfig({ searchProviders: [{ id: 'one', type: 'brave', name: 'One' }] });
  root.searchStore.keyMap = { one: 'existing-secret' };
  await root.searchStore.saveProvider({ id: 'one', type: 'brave', name: 'Renamed' }, '');
  assert.equal(root.searchStore.apiKeyFor('one'), 'existing-secret');
  await root.searchStore.removeProvider('one');
  assert.equal(root.searchStore.apiKeyFor('one'), '');
});
