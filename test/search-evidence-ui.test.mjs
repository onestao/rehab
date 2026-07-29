// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../search-evidence-ui.js', import.meta.url), 'utf8');
const window = {};
vm.runInNewContext(source, { window, String, Number, Object, Array, Math });
const ui = window.searchEvidenceUi;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

test('DIY evidence renders explicit numeric changes for every modification kind', () => {
  assert.equal(ui.modificationText({ kind: 'remove', nutrients: { cal: 80, pro: 1 } }), '−80 kcal · 蛋白 −1 g');
  assert.equal(ui.modificationText({ kind: 'add', nutrients: { cal: 120, pro: 6 } }), '+120 kcal · 蛋白 +6 g');
  assert.equal(ui.modificationText({ kind: 'replace', replacedNutrients: { cal: 220 }, nutrients: { cal: 160 } }), '旧项 −220 + 新项 160 = 净 −60 kcal');
  assert.equal(ui.modificationText({ kind: 'portion', portionFactor: 0.5 }), '份量 ×0.5');
});

test('draft and saved evidence share base modification total and source rendering', () => {
  const evidence = {
    status: 'estimated', confidenceTier: 'database-estimate',
    base: { name: '汉堡', nutrients: { cal: 500, pro: 20 } },
    modifications: [{ kind: 'remove', label: '酱', nutrients: { cal: 80, pro: 1 } }],
    total: { nutrients: { cal: 420, pro: 19 } },
    assumptions: ['去除整份酱料'],
    evidence: [{ title: '官方页面', url: 'https://example.com/item', domain: 'example.com' }]
  };
  const draft = ui.foodDetails(evidence, 0, esc);
  const saved = ui.savedFood({ ...evidence, sources: evidence.evidence, evidence: undefined }, esc);
  for (const text of ['基础值', '−80 kcal · 蛋白 −1 g', '核算总量', '去除整份酱料', '官方页面']) {
    assert.match(draft, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(saved, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('evidence titles labels assumptions and URLs remain escaped', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const html = ui.foodDetails({
    status: 'needs-confirmation',
    base: { name: evil, nutrients: { cal: 1 } },
    modifications: [{ kind: 'add', label: evil, nutrients: { cal: 1 }, assumption: evil }],
    total: { nutrients: { cal: 2 } },
    assumptions: [evil],
    evidence: [{ title: evil, url: 'https://example.com/?q=%22%3E%3Cscript%3E', domain: 'example.com' }]
  }, 0, esc);
  assert.doesNotMatch(html, /<img|<script/i);
  assert.match(html, /&lt;img/);
  assert.match(html, /rel="noopener noreferrer"/);
});
