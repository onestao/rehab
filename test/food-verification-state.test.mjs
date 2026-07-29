// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as foodEvidencePure from '../food-evidence-pure.mjs';

const source = readFileSync(new URL('../food-log.js', import.meta.url), 'utf8');

function load({ policy = { mode: 'required', fallback: 'fail' }, verifyResult = null } = {}) {
  const alerts = [];
  let saved = 0;
  const data = {
    db: { health: { foodLogs: [] } },
    escapeHtml: value => String(value ?? ''),
    generateRecordId: prefix => `${prefix}-1`,
    logicalDateKey: () => '2026-07-29',
    defaultDietMealForTime: () => 'lunch',
    saveAndBackup: () => { saved += 1; }
  };
  const window = {
    data,
    foodEvidencePure,
    ai: { getTaskNetworkPolicy: () => policy },
    foodEvidence: {
      policyFor: () => policy,
      async verify() { return verifyResult; }
    }
  };
  const document = { getElementById: () => null };
  vm.runInNewContext(source, {
    window, document, console, JSON, String, Number, Object, Array, Set, Date,
    alert: message => alerts.push(String(message))
  });
  return { data, alerts, saved: () => saved };
}

function seed(data, verification, evidence = null) {
  data._aiFoodResults = [{ name: '汉堡', grams: 200, cal: 500, pro: 20 }];
  data._aiFoodDrafts = [{ name: '汉堡', grams: 200, cal: 500, pro: 20 }];
  data._aiFoodEvidence = [evidence];
  data._aiFoodVerification = [verification];
  data._aiFoodSourceTask = 'food.text';
  data._aiFoodAdded = new Set();
}

test('required failure stays blocked after an ordinary edit', () => {
  const { data, alerts } = load();
  seed(data, foodEvidencePure.verificationStateFromEvidence({ status: 'unavailable' }, { required: true }), { status: 'unavailable' });
  data.updateAiFoodDraft(0, 'grams', '180');
  assert.equal(data._aiFoodEvidence[0], null);
  assert.equal(data._aiFoodVerification[0].state, 'invalidated');
  data.addSingleAiFood(0);
  assert.equal(data.db.health.foodLogs.length, 0);
  assert.match(alerts[0], /重新联网核实/);
});

test('editing verified food invalidates its evidence and save permission', () => {
  const { data } = load();
  const evidence = { status: 'verified', total: { nutrients: { cal: 500, pro: 20 } } };
  seed(data, foodEvidencePure.verificationStateFromEvidence(evidence, { required: true }), evidence);
  assert.equal(data.aiFoodSaveDecision(0, 'food.text').allowed, true);
  data.updateAiFoodDraft(0, 'cal', '450');
  assert.equal(data._aiFoodVerification[0].state, 'invalidated');
  assert.equal(data.aiFoodSaveDecision(0, 'food.text').allowed, false);
});

test('successful re-verification restores save permission', async () => {
  const evidence = { status: 'verified', total: { nutrients: { cal: 420, pro: 18, carb: 30, fat: 20 } } };
  const { data } = load({ verifyResult: evidence });
  seed(data, { required: true, state: 'invalidated', evidence: null });
  await data.verifyAiFood(0, { input: '麦当劳汉堡', sourceTask: 'food.text', silent: true });
  assert.equal(data._aiFoodVerification[0].state, 'verified');
  assert.equal(data.aiFoodSaveDecision(0, 'food.text').allowed, true);
  data.addSingleAiFood(0);
  assert.equal(data.db.health.foodLogs.length, 1);
  assert.equal(data.db.health.foodLogs[0].cal, 420);
});

test('bulk save reports skipped verification reasons', () => {
  const { data } = load();
  data._aiFoodResults = [{ name: '可保存', cal: 100 }, { name: '待核实', cal: 200 }];
  data._aiFoodDrafts = data._aiFoodResults.map(item => ({ ...item }));
  data._aiFoodEvidence = [null, null];
  data._aiFoodVerification = [
    { required: false, state: 'not-required', evidence: null },
    { required: true, state: 'invalidated', evidence: null }
  ];
  data._aiFoodSourceTask = 'food.text';
  data._aiFoodAdded = new Set();
  data.addAllAiFoods();
  assert.equal(data.db.health.foodLogs.length, 1);
  assert.equal(data._aiFoodAdded.has(0), true);
  assert.equal(data._aiFoodAdded.has(1), false);
});
