import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { normalizeCatalogModel } from '../ai-model-catalog-pure.mjs';
import { requiredCapabilityState } from '../ai-routing-pure.mjs';

const source = await readFile(new URL('../ai-provider-manager.js', import.meta.url), 'utf8');
const pickerSource = await readFile(new URL('../ai-task-settings.js', import.meta.url), 'utf8');

test('provider manager exposes archived restore and pending migration flows', () => {
    assert.match(source, /showArchived/);
    assert.match(source, /async restore\(profileId\)/);
    assert.match(source, /renderMigration\(body, title\)/);
    assert.match(source, /migrationStatus: 'confirmed'/);
});

test('permanent provider deletion clears legacy credentials and repairs active profile', () => {
    assert.match(source, /idbDelete\(root\.ai\.apiKeyKey\(profileId\)\)/);
    assert.match(source, /localStorage\.removeItem\(root\.ai\.apiKeyKey\(profileId\)\)/);
    assert.match(source, /cfg\.activeProfileId === profileId/);
});

test('model picker renders actionable empty and explicit invalid states', () => {
    assert.match(pickerSource, /unavailableReason\(route, models\)/);
    assert.match(pickerSource, /\u7ba1\u7406\u4f9b\u5e94\u5546/);
    assert.match(pickerSource, /model\?\.family/);
});

test('manual model metadata normalizes known labels while preserving custom labels as unknown', async () => {
    const prompts = [
        'Lab/Model-01',
        'Research model',
        '  Research Family  ',
        ' Vision, vision, JSON, custom-tag, CUSTOM-TAG, , custom two '
    ];
    let pickerRefreshes = 0;
    const context = {
        prompt: () => prompts.shift() ?? '',
        document: { getElementById: () => null },
        window: {
            addEventListener: () => {},
            ai: {
                models: [],
                findProfile: profileId => profileId === 'profile-a'
                    ? { id: 'profile-a', provider: 'openai', baseUrl: 'https://api.example.test/v1' }
                    : null,
                loadModelCatalogPure: async () => ({ normalizeCatalogModel }),
                persistModelCache: async () => {}
            },
            aiTaskSettings: { render: () => { pickerRefreshes += 1; } }
        }
    };
    vm.runInNewContext(source, context);
    const manager = context.window.aiProviderManager;
    manager.renderModelsPanel = () => {};

    await manager.addManual('profile-a', {});

    assert.equal(prompts.length, 0);
    assert.equal(pickerRefreshes, 1);
    assert.equal(context.window.ai.models.length, 1);
    const [model] = context.window.ai.models;
    assert.equal(model.id, 'Lab/Model-01');
    assert.equal(model.family, 'Research Family');
    assert.equal(model.capabilities.vision, true);
    assert.equal(model.capabilities.json, true);
    assert.equal(model.capabilities['custom-tag'], null);
    assert.equal(model.capabilities['custom two'], null);
    assert.equal(Object.hasOwn(model, 'manualUnknownCapabilities'), false);
    assert.equal(requiredCapabilityState(['custom-tag'], model.capabilities).status, 'unknown');
});
