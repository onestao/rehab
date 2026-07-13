// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

test('manual models preserve family and normalize custom capability labels as unknown', async () => {
    const code = readFileSync(new URL('../ai-models.js', import.meta.url), 'utf8');
    const prompts = ['论文助手', 'Research', 'vision, JSON, custom-lab, custom-lab'];
    const ai = {
        cfg: { activeProfileId: 'profile-1' },
        models: [],
        findProfile() { return { id: 'profile-1', provider: 'openai', baseUrl: 'https://example.invalid/v1' }; },
        async loadModelCatalogPure() {
            return { normalizeCatalogModel(model, context) { return { ...model, ...context }; } };
        },
        async persistModelCache() {},
        renderAddedModels() {}
    };
    const sandbox = {
        ai,
        window: { aiTaskSettings: { render() {} } },
        document: { getElementById(id) { return id === 'aiModel' ? { value: 'custom-model' } : null; } },
        prompt() { return prompts.shift(); },
        alert(message) { throw new Error(message); },
        confirm() { return true; },
        fetch() {}
    };
    vm.runInNewContext(code, sandbox);
    await ai.addManualModel();
    assert.equal(ai.models.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(ai.models[0])), {
        id: 'custom-model',
        displayName: '论文助手',
        family: 'Research',
        capabilities: { vision: true, json: true, 'custom-lab': null },
        profileId: 'profile-1',
        provider: 'openai',
        baseUrl: 'https://example.invalid/v1',
        source: 'manual'
    });
});
