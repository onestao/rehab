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
test('fallback order prefers color and mono CDN before local assets', () => {
    const sources = visual.iconFallbackSrcs('openai');
    assert.match(sources[0], /openai-color\.svg$/);
    assert.match(sources[1], /openai\.svg$/);
    assert.equal(sources.at(-1), 'assets/model-icons/generic.svg');
});
