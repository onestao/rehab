import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';

test('aiPricing.estimate computes cost when price exists', () => {
    const code = readFileSync(path.join(process.cwd(), 'ai-pricing.js'), 'utf8');
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    const p = sandbox.window.aiPricing;
    assert.ok(p);
    const out = p.estimate({ in: 1000, out: 1000 }, 'openai', 'gpt-4o-mini');
    assert.ok(out.costUsd > 0);
    assert.equal(typeof out.costUsd, 'number');
});
