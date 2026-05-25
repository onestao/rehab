import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadPlanEquipment() {
  const code = readFileSync(new URL('../plan-equipment.js', import.meta.url), 'utf8');
  const sandbox = {
    window: {
      renderSafe: {
        escapeHtml(value) {
          return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        }
      },
      toast: { show() {} },
      haptics: { light() {} }
    },
    document: {},
    requestAnimationFrame() {}
  };
  vm.runInNewContext(code, sandbox);
  return sandbox.window.dataPlanEquipment;
}

function createContext(api) {
  const prefs = { equipment: [], customEquipment: [] };
  return {
    ...api,
    escapeHtml: (value) => String(value ?? ''),
    ensurePlanPrefs: () => prefs,
    save() {},
    renderProfilePage() {},
    refreshPlanEquipmentSheet() {},
    prefs
  };
}

test('custom equipment is added, selected, and rendered with delegated actions', () => {
  const api = loadPlanEquipment();
  const ctx = createContext(api);

  assert.equal(api.addCustomPlanEquipment.call(ctx, '瑜伽砖'), true);
  assert.equal(ctx.prefs.customEquipment.length, 1);
  assert.equal(ctx.prefs.customEquipment[0].label, '瑜伽砖');
  assert.deepEqual(Array.from(ctx.prefs.equipment), [ctx.prefs.customEquipment[0].id]);

  const html = api.renderPlanEquipmentSheetBody.call(ctx);
  assert.match(html, /data-plan-equipment-add/);
  assert.match(html, /data-plan-equipment-toggle=/);
  assert.match(html, /data-plan-equipment-delete=/);
});
