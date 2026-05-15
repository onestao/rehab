import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';

test('dataAiTemplates.normalizeTemplates preserves ids and strings', () => {
    const code = readFileSync(path.join(process.cwd(), 'ai-templates.js'), 'utf8');
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    const t = sandbox.window.dataAiTemplates;
    const list = t.normalizeTemplates([{ id: 'x', name: 'n', scenario: 's', system: 1, user: 2, vars: ['a'] }]);
    assert.equal(list[0].id, 'x');
    assert.equal(list[0].system, '1');
    assert.equal(list[0].user, '2');
    assert.deepEqual(list[0].vars, ['a']);
});
