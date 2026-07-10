// @ts-nocheck
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import {
    clearModelCatalog,
    endpointFingerprint,
    migrateLegacyModelCatalog,
    normalizeCatalogModel,
    replaceDiscoveredModelsForProfile
} from '../ai-model-catalog-pure.mjs';

test('refreshing a profile replaces only its discovered snapshot', () => {
    const existing = [
        { profileId: 'p1', provider: 'openai', id: 'shared', source: 'discovered', enabled: false },
        { profileId: 'p1', provider: 'openai', id: 'manual-only', source: 'manual' },
        { profileId: 'p2', provider: 'openai', id: 'shared', source: 'discovered' }
    ];

    const result = replaceDiscoveredModelsForProfile(existing, [
        { id: 'new-model', owned_by: 'vendor-a' }
    ], {
        profileId: 'p1',
        provider: 'openai',
        baseUrl: 'https://one.example/v1',
        fetchedAt: '2026-07-10T10:00:00.000Z'
    });

    assert.deepEqual(result.map(model => `${model.profileId}::${model.id}`), [
        'p1::manual-only',
        'p1::new-model',
        'p2::shared'
    ]);
    assert.equal(result.find(model => model.id === 'manual-only').source, 'manual');
    assert.equal(result.find(model => model.profileId === 'p2').id, 'shared');
});

test('refresh preserves local enabled state for a rediscovered model', () => {
    const result = replaceDiscoveredModelsForProfile([
        { profileId: 'p1', provider: 'openai', id: 'same', source: 'discovered', enabled: false }
    ], [{ id: 'same' }], {
        profileId: 'p1', provider: 'openai', baseUrl: 'https://one.example/v1'
    });

    assert.equal(result[0].enabled, false);
});

test('migrates provider-only models only when the provider maps to one profile', () => {
    const legacy = [
        { provider: 'claude', id: 'claude-sonnet' },
        { provider: 'openai', id: 'shared' }
    ];
    const profiles = [
        { id: 'claude-main', provider: 'claude', baseUrl: 'https://claude.example/v1' },
        { id: 'openai-a', provider: 'openai', baseUrl: 'https://a.example/v1' },
        { id: 'openai-b', provider: 'openai', baseUrl: 'https://b.example/v1' }
    ];

    const result = migrateLegacyModelCatalog(legacy, profiles);
    assert.equal(result[0].profileId, 'claude-main');
    assert.equal(result[0].migrationStatus, 'migrated');
    assert.equal(result[1].profileId, '');
    assert.equal(result[1].migrationStatus, 'needs-refresh');
});

test('clears discovered cache for one profile or all profiles while preserving manual models', () => {
    const models = [
        { profileId: 'p1', id: 'a', source: 'discovered' },
        { profileId: 'p1', id: 'manual', source: 'manual' },
        { profileId: 'p2', id: 'b', source: 'discovered' }
    ];

    assert.deepEqual(clearModelCatalog(models, { profileId: 'p1' }).map(model => model.id), ['manual', 'b']);
    assert.deepEqual(clearModelCatalog(models).map(model => model.id), ['manual']);
    assert.deepEqual(clearModelCatalog(models, { includeManual: true }), []);
});

test('normalizes discovered metadata and binds it to the endpoint fingerprint', () => {
    const fetchedAt = '2026-07-10T10:00:00.000Z';
    const model = normalizeCatalogModel({
        id: 'gpt-4o-mini',
        owned_by: 'OpenAI',
        input_modalities: ['text', 'image'],
        capabilities: { streaming: true, json: true }
    }, {
        profileId: 'p1',
        provider: 'openai',
        baseUrl: 'https://API.Example.test/v1/',
        fetchedAt
    });

    assert.equal(model.profileId, 'p1');
    assert.equal(model.vendor, 'OpenAI');
    assert.equal(model.owned_by, 'OpenAI');
    assert.equal(model.iconKey, 'openai');
    assert.deepEqual(model.capabilities, {
        text: true,
        vision: true,
        streaming: true,
        json: true,
        reasoning: undefined
    });
    assert.equal(model.sizeTier, 'small');
    assert.equal(model.fetchedAt, fetchedAt);
    assert.equal(model.lastSeenAt, fetchedAt);
    assert.equal(model.endpointFingerprint, endpointFingerprint('https://api.example.test/v1'));
    assert.notEqual(model.endpointFingerprint, endpointFingerprint('https://other.example.test/v1'));
});

test('runtime cache methods replace and clear the active profile catalog', async () => {
    const source = await readFile(new URL('../ai-model-cache.js', import.meta.url), 'utf8');
    const persisted = [];
    const context = {
        ai: {
            cfg: { activeProfileId: 'p1', provider: 'openai', profiles: [] },
            models: [
                { profileId: 'p1', id: 'old', source: 'discovered' },
                { profileId: 'p2', id: 'other', source: 'discovered' }
            ],
            async idbSet(key, value) { persisted.push([key, value]); }
        },
        document: { getElementById: () => null },
        localStorage: { setItem() {} },
        window: {
            aiModelCatalogPure: {
                clearModelCatalog,
                endpointFingerprint,
                migrateLegacyModelCatalog,
                normalizeCatalogModel,
                replaceDiscoveredModelsForProfile
            }
        }
    };
    vm.runInNewContext(source, context);

    const isolated = context.ai.mergeModelCache([], [
        { profileId: 'p1', provider: 'openai', id: 'shared' },
        { profileId: 'p2', provider: 'openai', id: 'shared' }
    ]);
    assert.equal(isolated.length, 2);

    context.ai.replaceModelSnapshot('p1', [{ id: 'fresh' }], {
        provider: 'openai', baseUrl: 'https://one.example/v1'
    });
    assert.deepEqual(context.ai.models.map(model => `${model.profileId}::${model.id}`), ['p1::fresh', 'p2::other']);

    await context.ai.clearCurrentModelCache();
    assert.deepEqual(context.ai.models.map(model => model.id), ['other']);
    assert.equal(persisted.length, 1);
});

test('runtime migration leaves ambiguous provider-only cache unbound', async () => {
    const source = await readFile(new URL('../ai-model-cache.js', import.meta.url), 'utf8');
    const context = {
        ai: {
            cfg: {
                activeProfileId: 'claude-main',
                profiles: [
                    { id: 'claude-main', provider: 'claude', baseUrl: 'https://claude.example/v1' },
                    { id: 'oa', provider: 'openai', baseUrl: 'https://a.example/v1' },
                    { id: 'ob', provider: 'openai', baseUrl: 'https://b.example/v1' }
                ]
            },
            models: [
                { provider: 'claude', id: 'sonnet' },
                { provider: 'openai', id: 'shared' }
            ],
            async idbSet() {}
        },
        document: { getElementById: () => null },
        localStorage: { setItem() {} },
        window: {
            aiModelCatalogPure: {
                clearModelCatalog,
                endpointFingerprint,
                migrateLegacyModelCatalog,
                normalizeCatalogModel,
                replaceDiscoveredModelsForProfile
            }
        }
    };
    vm.runInNewContext(source, context);

    await context.ai.migrateLegacyModelCache();
    assert.equal(context.ai.models[0].profileId, 'claude-main');
    assert.equal(context.ai.models[1].profileId, '');
    assert.equal(context.ai.models[1].migrationStatus, 'needs-refresh');
});
