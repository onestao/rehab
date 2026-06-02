import test from 'node:test';
import assert from 'node:assert/strict';

let miScalePure;
try {
    miScalePure = await import('../mi-scale-pure.js');
} catch {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    miScalePure = require('../mi-scale-pure.js');
}

const { parseServiceData, computeBmi, MI_SCALE_SERVICE_UUID } = miScalePure;

test('MI_SCALE_SERVICE_UUID is 0xFE95', () => {
    assert.equal(MI_SCALE_SERVICE_UUID, 0xFE95);
});

test('parseServiceData returns null for empty or short input', () => {
    assert.equal(parseServiceData(null), null);
    assert.equal(parseServiceData([]), null);
    assert.equal(parseServiceData(new Uint8Array(12)), null);
});

test('parseServiceData parses Mi Body Composition Scale 15-byte fixture', () => {
    const raw15 = new Uint8Array([27, 24, 2, 166, 230, 7, 2, 11, 17, 34, 7, 186, 1, 60, 55]);
    const result = parseServiceData(raw15);
    assert.ok(result, 'result should not be null');
    assert.equal(result.weight, 70.7);
    assert.equal(result.stabilized, true);
    assert.equal(result.hasImpedance, true);
    assert.equal(result.impedance, 442);
    assert.ok(result.measuredAt, 'measuredAt should be set');
    assert.equal(result.measuredAt.getFullYear(), 2022);
    assert.equal(result.measuredAt.getMonth(), 1);
    assert.equal(result.measuredAt.getDate(), 11);
    assert.equal(result.measuredAt.getHours(), 17);
    assert.equal(result.measuredAt.getMinutes(), 34);
});

test('parseServiceData parses 13-byte payload directly', () => {
    const raw13 = new Uint8Array([2, 166, 230, 7, 2, 11, 17, 34, 7, 186, 1, 60, 55]);
    const result = parseServiceData(raw13);
    assert.ok(result);
    assert.equal(result.weight, 70.7);
    assert.equal(result.stabilized, true);
    assert.equal(result.hasImpedance, true);
    assert.equal(result.impedance, 442);
});

test('parseServiceData detects unstable weight', () => {
    const bytes = new Uint8Array([2, 0x00, 230, 7, 2, 11, 17, 34, 7, 0, 0, 60, 55]);
    const result = parseServiceData(bytes);
    assert.ok(result, 'result should not be null even for unstable');
    assert.equal(result.weight, 70.7);
    assert.equal(result.stabilized, false);
    assert.equal(result.hasImpedance, false);
});

test('parseServiceData detects impedance without stabilization', () => {
    const bytes = new Uint8Array([2, 0x02, 230, 7, 2, 11, 17, 34, 7, 186, 1, 60, 55]);
    const result = parseServiceData(bytes);
    assert.ok(result);
    assert.equal(result.stabilized, false);
    assert.equal(result.hasImpedance, true);
});

test('parseServiceData returns null for zero weight', () => {
    const bytes = new Uint8Array([2, 166, 230, 7, 2, 11, 17, 34, 7, 186, 1, 0, 0]);
    const result = parseServiceData(bytes);
    assert.equal(result, null);
});

test('computeBmi calculates correctly', () => {
    assert.equal(computeBmi(70.7, 175), 23.1);
    assert.equal(computeBmi(60, 165), 22.0);
    assert.equal(computeBmi(0, 175), 0);
    assert.equal(computeBmi(70, 0), 0);
    assert.equal(computeBmi(-1, 175), 0);
});
