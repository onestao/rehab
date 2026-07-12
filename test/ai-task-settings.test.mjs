// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

await import(`../ai-model-visual.js?test=${Date.now()}`);
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

test('compact model control shows the selected model name beside the shared icon', () => {
    const source = readFileSync(new URL('../ai-task-settings.js', import.meta.url), 'utf8');
    const block = source.match(/function createCompactModelControl[\s\S]*?return button;/)?.[0] || '';
    assert.match(block, /modelVisualNode\(selected(?:, visual)?\)/);
    assert.match(block, /ai-compact-model-name/);
    assert.match(block, /registerCompactModelLabel\(button, name\)/);
});

test('compact model labels remove only known vendor prefixes and preserve version syntax', () => {
    assert.equal(helpers.compactModelName({ modelId: 'claude-sonnet-4.6' }), 'sonnet-4.6');
    assert.equal(helpers.compactModelName({ modelId: 'gpt-5-5' }), '5-5');
    assert.equal(helpers.compactModelName({ modelId: 'gpt-5.6-sol' }), '5.6-sol');
    assert.equal(helpers.compactModelName({ modelId: 'grok-4.5' }), 'grok-4.5');
    assert.equal(helpers.compactModelName({ modelId: 'deepseek-v4-flash' }), 'v4-flash');
    assert.equal(helpers.compactModelName({ modelId: 'gemini pro preview' }), 'pro preview');
    assert.equal(helpers.compactModelName({ modelId: 'qwen-3-vl-plus' }), 'qwen-3-vl-plus');
    assert.equal(helpers.compactModelName({ modelId: 'doubao-seed-1.6' }), 'doubao-seed-1.6');
    assert.equal(helpers.compactModelName({ modelId: 'kimi-k2' }), 'kimi-k2');
    assert.equal(helpers.compactModelName({ modelId: 'minimax-m2.5' }), 'minimax-m2.5');
    assert.equal(helpers.compactModelName({ modelId: 'mimo-v2' }), 'mimo-v2');
    assert.equal(helpers.compactModelName({ modelId: 'glm-4.7' }), 'glm-4.7');
    assert.notEqual(helpers.compactModelName({ modelId: 'gpt-5-5' }), helpers.compactModelName({ modelId: 'gpt-5.5' }));
    assert.equal(helpers.compactModelName({ modelId: 'custom-nebula-pro-preview' }), 'custom-nebula-pro-preview');
});

test('compact model label fitting keeps the abbreviation and progressively shrinks it', () => {
    const source = readFileSync(new URL('../ai-task-settings.js', import.meta.url), 'utf8');
    assert.match(source, /\[12, 11, 10\]\.some\(size/);
    assert.match(source, /label\.scrollWidth <= label\.clientWidth \+ 1/);
});

test('custom display names remain unchanged while full identity keeps the model id', () => {
    const model = { profileName: 'OpenRouter', modelId: 'gpt-5.6-sol', displayName: '论文分析' };
    assert.equal(helpers.compactModelName(model), '论文分析');
    assert.equal(helpers.modelOptionLabel(model), 'OpenRouter · 论文分析 · gpt-5.6-sol');
});

test('diet picker keeps its compact model label visible on narrow screens', () => {
    const dietCss = readFileSync(new URL('../css-src/18-health-diet.css', import.meta.url), 'utf8');
    assert.doesNotMatch(dietCss, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.diet-ai-model-control\s+\.ai-compact-model-name\s*\{[\s\S]*?display:\s*none/);
    assert.match(dietCss, /grid-template-columns:\s*minmax\(112px, 1fr\) minmax\(0, clamp\(152px, 46vw, 206px\)\)/);
    assert.match(dietCss, /\.diet-ai-model-control\s+\.ai-model-connection-mark\s*\{[\s\S]*?width:\s*20px/);
});

test('compact model control applies the selected model visual theme', () => {
    const source = readFileSync(new URL('../ai-task-settings.js', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../css-src/20-settings-ai.css', import.meta.url), 'utf8');
    const block = source.match(/function createCompactModelControl[\s\S]*?return button;/)?.[0] || '';

    assert.match(block, /resolveModelVisual\(selected\)/);
    assert.match(block, /--ai-model-control-bg/);
    assert.match(block, /--ai-model-control-color/);
    assert.match(css, /background:\s*var\(--ai-model-control-bg/);
    assert.match(css, /color:\s*var\(--ai-model-control-color/);
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
