import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

await import(`../ai-model-visual.js?test=${Date.now()}`);

const visual = globalThis.aiModelVisual;
const settingsSource = readFileSync(new URL('../ai-task-settings.js', import.meta.url), 'utf8');
const adviceSource = readFileSync(new URL('../advice-render.js', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const serviceWorkerSource = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

test('shared resolver covers common brands and honors safe explicit icon keys', () => {
    assert.equal(visual.resolve({ modelId: 'gpt-5.5', dark: false }).key, 'openai');
    assert.equal(visual.resolve({ modelId: 'claude-sonnet-4', dark: false }).key, 'claude');
    assert.equal(visual.resolve({ modelId: 'gpt-5', iconKey: 'qwen', dark: false }).key, 'qwen');
});

test('shared resolver keeps unsafe icon keys on the generic bundled fallback', () => {
    const value = visual.resolve({ modelId: '<unknown>', iconKey: '<script>', dark: false });
    assert.equal(value.key, 'generic');
    assert.equal(value.iconSrcs.at(-1), 'assets/model-icons/generic.svg');
});

test('shared resolver prefers bundled assets and supports local-only compact controls', () => {
    const sources = visual.iconFallbackSrcs('openai');
    assert.equal(sources[0], 'assets/model-icons/openai.svg');
    assert.match(sources[1], /openai-color\.svg$/);
    assert.equal(sources.at(-1), 'assets/model-icons/generic.svg');
    assert.deepEqual(visual.resolve({ modelId: 'gpt-5.6-sol', local: true }).iconSrcs, ['assets/model-icons/openai.svg']);
});

test('settings and Advice runtime paths delegate to the shared resolver after legacy removal', () => {
    const adviceRuntimeResolver = adviceSource.match(/adviceModelVisual\(model = ''[\s\S]*?\n\s*},/)?.[0] || '';
    assert.match(settingsSource, /root\.aiModelVisual\.resolve\(/);
    assert.match(adviceRuntimeResolver, /window\.aiModelVisual\.resolve\(/);
    assert.doesNotMatch(adviceRuntimeResolver, /legacyAdviceModelVisual|_legacyModelVisual/);
    assert.doesNotMatch(adviceSource, /LEGACY_MODEL_ICON|legacyAdviceModelVisual|_legacyModelVisual/);
});

test('lazy loading declares the visual resolver before both consumers', () => {
    assert.match(indexSource, /'ai-model-visual'\s*:\s*\[\]/);
    assert.match(indexSource, /'ai-task-settings'\s*:\s*\[[^\]]*'ai-model-visual'/);
    assert.match(indexSource, /'advice-render'\s*:\s*\[[^\]]*'ai-model-visual'/);
});

test('service worker precaches the versioned shared visual module', () => {
    assert.match(serviceWorkerSource, /'ai-model-visual\.js\?v=\d+'/);
});
