// @ts-nocheck
import assert from 'node:assert/strict';
import test from 'node:test';

await import(`../ai-task-settings.js?test=${Date.now()}`);

const helpers = globalThis.aiTaskSettings._test;

test('normalizes array and object task definitions', () => {
    assert.deepEqual(
        helpers.normalizeTaskDefinitions({
            'food.text': { label: 'Food text', hint: 'Fast parse' },
            empty: null
        }),
        [
            { id: 'food.text', label: 'Food text', hint: 'Fast parse', description: 'Fast parse' },
            { id: 'empty', label: 'empty', description: '' }
        ]
    );
    assert.equal(helpers.normalizeTaskDefinitions([{ taskId: 'plan.week', name: 'Week plan' }])[0].id, 'plan.week');
});

test('model labels include connection identity for duplicate model ids', () => {
    const first = { profileId: 'p1', profileName: 'OpenRouter', modelId: 'shared-model' };
    const second = { profileId: 'p2', profileName: 'SiliconFlow', modelId: 'shared-model' };
    assert.equal(helpers.modelKey(first), 'p1::shared-model');
    assert.equal(helpers.modelKey(second), 'p2::shared-model');
    assert.equal(helpers.modelOptionLabel(first), 'OpenRouter \u00b7 shared-model');
    assert.equal(helpers.modelOptionLabel(second), 'SiliconFlow \u00b7 shared-model');
});

test('unknown reasoning depth falls back to auto', () => {
    assert.equal(helpers.normalizeReasoningDepth('HIGH'), 'high');
    assert.equal(helpers.normalizeReasoningDepth('unsupported'), 'auto');
    assert.equal(helpers.normalizeReasoningDepth(null), 'auto');
});
