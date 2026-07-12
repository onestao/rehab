import assert from 'node:assert/strict';
import test from 'node:test';
await import(`../ai-model-visual.js?test=${Date.now()}`);
const visual = globalThis.aiModelVisual;
test('resolves common brands and honors explicit icon key', () => {
    assert.equal(visual.resolve({ modelId: 'gpt-5.5', dark: false }).key, 'openai');
    assert.equal(visual.resolve({ modelId: 'claude-sonnet-4', dark: false }).key, 'claude');
    assert.equal(visual.resolve({ modelId: 'gpt-5', iconKey: 'qwen', dark: false }).key, 'qwen');
});
test('unknown unsafe icon keys use a stable generic fallback', () => {
    const value = visual.resolve({ modelId: '<unknown>', iconKey: '<script>', dark: false });
    assert.equal(value.key, 'generic');
    assert.equal(value.iconSrcs.at(-1), 'assets/model-icons/generic.svg');
});
test('fallback order prefers bundled local assets before network fallbacks', () => {
    const sources = visual.iconFallbackSrcs('openai');
    assert.equal(sources[0], 'assets/model-icons/openai.svg');
    assert.match(sources[1], /openai-color\.svg$/);
    assert.equal(sources.at(-1), 'assets/model-icons/generic.svg');
});

test('local compact visuals never depend on network icon fallbacks', () => {
    assert.deepEqual(visual.resolve({ modelId: 'gpt-5.6-sol', local: true }).iconSrcs, ['assets/model-icons/openai.svg']);
    assert.deepEqual(visual.resolve({ modelId: 'mistral-large-latest', local: true }).iconSrcs, ['assets/model-icons/generic.svg']);
});

test('compact labels cover current mainstream model naming families', () => {
    const cases = [
        ['gpt-5-5', '5-5'],
        ['gpt-5.5', '5.5'],
        ['gpt-5.6-sol', '5.6-sol'],
        ['gpt-5.1-codex-max', '5.1-codex-max'],
        ['o3-pro', 'o3-pro'],
        ['claude-opus-4-6-thinking', 'opus-4-6'],
        ['claude-sonnet-4-6', 'sonnet-4-6'],
        ['claude-haiku-4-5', 'haiku-4-5'],
        ['gemini-3.5-flash', '3.5-flash'],
        ['gemini-3.1-pro', '3.1-pro'],
        ['gemini-3.1-flash-lite', '3.1-flash-lite'],
        ['gemini-flash-latest', 'flash-latest'],
        ['gemini-2.5-flash-preview-09-2025', '2.5-flash-preview-09-2025'],
        ['grok-4.3', 'grok-4.3'],
        ['grok-4.5', 'grok-4.5'],
        ['grok-build-0.1', 'grok-build-0.1'],
        ['deepseek-v4-pro', 'v4-pro'],
        ['deepseek-v4-flash', 'v4-flash'],
        ['qwen3.7-max', 'qwen3.7-max'],
        ['qwen3.7-plus-2026-05-26', 'qwen3.7-plus-2026-05-26'],
        ['qwen3.6-flash', 'qwen3.6-flash'],
        ['kimi-k2.7-code', 'kimi-k2.7-code'],
        ['MiniMax-M2.7-highspeed', 'MiniMax-M2.7-highspeed'],
        ['mimo-v2.5-pro', 'mimo-v2.5-pro'],
        ['glm-5.2', 'glm-5.2'],
        ['Doubao-Seed-2.1-Turbo', 'Doubao-Seed-2.1-Turbo']
    ];
    cases.forEach(([id, expected]) => assert.equal(visual.compactModelName({ modelId: id }), expected, id));
});

test('compact labels preserve custom names, namespaces, separators, and unknown families', () => {
    assert.deepEqual(
        visual.modelLabelCandidates({ modelId: 'openai/gpt-5.6-sol' }),
        { full: 'openai/gpt-5.6-sol', compact: '5.6-sol', custom: false, id: 'openai/gpt-5.6-sol' }
    );
    assert.equal(visual.compactModelName({ modelId: 'models/gemini-3.5-flash' }), '3.5-flash');
    assert.equal(visual.compactModelName({ modelId: 'meta-llama/llama-3.3-70b-instruct' }), 'llama-3.3-70b-instruct');
    assert.equal(visual.compactModelName({ modelId: 'gpt_5_5' }), '5_5');
    assert.equal(visual.compactModelName({ modelId: 'gpt-5.5' }), '5.5');
    assert.equal(visual.compactModelName({ modelId: 'gemini pro preview' }), 'pro preview');
    assert.equal(visual.compactModelName({ modelId: 'gpt-5.6-sol', displayName: '论文分析' }), '论文分析');
    assert.equal(visual.compactModelName({ modelId: 'custom-nebula-pro-preview' }), 'custom-nebula-pro-preview');
});
