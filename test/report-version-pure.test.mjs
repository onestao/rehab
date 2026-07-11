import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL('../report-version-pure.js', import.meta.url), 'utf8'), context);
const versions = context.window.reportVersionPure;

test('legacy report normalization is idempotent and lossless', () => {
    const legacy = { id: 'r1', generatedAt: '2026-01-01T00:00:00.000Z', content: 'old', ai: { summary: 'old', model: 'm1' } };
    const once = versions.normalizeRecord(legacy, 1);
    const twice = versions.normalizeRecord(once, 2);
    assert.equal(once.versions.length, 1);
    assert.equal(once.versions[0].ai.summary, 'old');
    assert.deepEqual(twice, once);
});

test('append keeps the latest three versions and activates the newest', () => {
    let record = { id: 'r1' };
    for (let i = 1; i <= 4; i++) record = versions.appendVersion(record, { id: `v${i}`, content: String(i) }, i);
    assert.equal(JSON.stringify(record.versions.map(v => v.id)), JSON.stringify(['v2', 'v3', 'v4']));
    assert.equal(versions.activeVersion(record).content, '4');
    assert.equal(versions.cycle(record, -1).activeVersionId, 'v3');
});

test('metaFromResult accepts current strings and future metadata results', () => {
    assert.equal(JSON.stringify(versions.metaFromResult('hello', { model: 'fallback' })), JSON.stringify({ text: 'hello', model: 'fallback', profileId: '', reasoningEffort: '', fallback: null }));
    assert.equal(JSON.stringify(versions.metaFromResult({ text: 'hello', meta: { modelId: 'm2', profileId: 'p2', reasoningDepth: 'high', fallback: { used: true } } })), JSON.stringify({
        text: 'hello', model: 'm2', profileId: 'p2', reasoningEffort: 'high', fallback: { used: true }
    }));
});

test('remove deletes the active version and selects a remaining neighbor', () => {
    const record = { id: 'r1', versions: [{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }], activeVersionId: 'v2' };
    const next = versions.removeVersion(record, 'v2');
    assert.equal(JSON.stringify(next.versions.map(version => version.id)), JSON.stringify(['v1', 'v3']));
    assert.equal(next.activeVersionId, 'v3');
});
