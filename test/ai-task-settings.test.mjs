// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('inline picker mount guard suppresses duplicate observer mounts', () => {
    const host = { dataset: {} };
    assert.equal(helpers.shouldMountInlinePicker(host, 'plan.today'), true);
    host.dataset.aiTaskPickerMountingFor = 'plan.today';
    assert.equal(helpers.shouldMountInlinePicker(host, 'plan.today'), false);
    delete host.dataset.aiTaskPickerMountingFor;
    host.dataset.aiTaskPickerMountedFor = 'plan.today';
    assert.equal(helpers.shouldMountInlinePicker(host, 'plan.today'), false);
    assert.equal(helpers.shouldMountInlinePicker(host, 'plan.week'), true);
});

test('plan AI picker inserts beside nested modal actions', () => {
    const body = {};
    const actionParent = {};
    const actions = { parentElement: actionParent };

    assert.deepEqual(helpers.resolveInsertionTarget(body, actions), {
        parent: actionParent,
        before: actions
    });
    assert.deepEqual(helpers.resolveInsertionTarget(body, null), {
        parent: body,
        before: null
    });
});

test('plan AI picker mounts explicitly instead of on every body mutation', () => {
    const settingsSource = readFileSync(new URL('../ai-task-settings.js', import.meta.url), 'utf8');
    const planSource = readFileSync(new URL('../plan-ai.js', import.meta.url), 'utf8');
    const observerBody = settingsSource.match(/new MutationObserver\(records => \{([\s\S]*?)\n\s*\}\);/)?.[1] || '';

    assert.doesNotMatch(observerBody, /mountPlanAiPicker/);
    assert.match(settingsSource, /ai:ready[\s\S]*?mountInlinePickers\(document, \{ force: true \}\)/);
    assert.match(planSource, /window\.aiTaskSettings\?\.mountPlanAiPicker\?\.\(\)/);
});
