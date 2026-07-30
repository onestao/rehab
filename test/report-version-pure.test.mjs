import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import * as searchPolicyPure from '../search-policy-pure.mjs';

const searchEvidenceUi = {
    summary: searchPolicyPure.summarizeSearchEvidence,
    version(payload) {
        const ai = { ...(payload?.ai || {}) };
        const searchEvidence = searchPolicyPure.summarizeSearchEvidence(payload?.searchEvidence || ai.searchEvidence);
        delete ai.searchEvidence;
        return { ai, searchEvidence };
    }
};
const context = { window: { searchPolicyPure, searchEvidenceUi }, URL };
vm.runInNewContext(fs.readFileSync(new URL('../report-version-pure.js', import.meta.url), 'utf8'), context);
const versions = context.window.reportVersionPure;


test('CommonJS export injects a pure evidence dependency without DOM globals', () => {
    const module = { exports: {} };
    const localRequire = createRequire(new URL('../report-version-pure.js', import.meta.url));
    vm.runInNewContext(fs.readFileSync(new URL('../report-version-pure.js', import.meta.url), 'utf8'), {
        module, exports: module.exports, require: localRequire, URL
    });
    const version = module.exports.makeVersion({
        ai: { model: 'm', searchEvidence: [{ url: 'https://example.com/cjs', contentExcerpt: 'body' }] }
    }, 1);
    assert.equal(version.searchEvidence[0].domain, 'example.com');
    assert.equal(Object.hasOwn(version.searchEvidence[0], 'contentExcerpt'), false);
});


test('browser and CommonJS report paths derive identical trust from domains', () => {
    const module = { exports: {} };
    const localRequire = createRequire(new URL('../report-version-pure.js', import.meta.url));
    vm.runInNewContext(fs.readFileSync(new URL('../report-version-pure.js', import.meta.url), 'utf8'), {
        module, exports: module.exports, require: localRequire, URL
    });
    const raw = [
        { id: 'spoof', retrievedAt: 1, url: 'https://unknown.example/claim', sourceType: 'medical-guideline', official: true },
        { id: 'who', retrievedAt: 1, url: 'https://www.who.int/news-room/fact-sheets', sourceType: 'other', official: false }
    ];
    const browser = versions.makeVersion({ searchEvidence: raw }, 1).searchEvidence;
    const common = module.exports.makeVersion({ searchEvidence: raw }, 1).searchEvidence;
    const trust = value => JSON.parse(JSON.stringify(value, ['id', 'domain', 'sourceType', 'official']));
    assert.deepEqual(trust(common), trust(browser));
    assert.deepEqual(trust(common), [
        { id: 'spoof', domain: 'unknown.example', sourceType: 'other', official: false },
        { id: 'who', domain: 'www.who.int', sourceType: 'public-health', official: true }
    ]);
});

test('report pure module does not depend on the browser evidence UI adapter', () => {
    const isolated = { window: { searchPolicyPure }, URL };
    vm.runInNewContext(fs.readFileSync(new URL('../report-version-pure.js', import.meta.url), 'utf8'), isolated);
    const version = isolated.window.reportVersionPure.makeVersion({
        ai: { model: 'm', searchEvidence: [{ url: 'https://example.com/a', contentExcerpt: 'body' }] }
    }, 1);
    assert.equal(version.searchEvidence.length, 1);
    assert.equal(Object.hasOwn(version.searchEvidence[0], 'contentExcerpt'), false);
});

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
    const result = versions.metaFromResult({ text: 'hello', meta: { modelId: 'm2', profileId: 'p2', reasoningDepth: 'high', fallback: { used: true }, searchEvidence: [{ id: 'e1', title: 'Guide', url: 'https://example.com/guide', contentExcerpt: 'must not persist', readStatus: 'deep-read' }] } });
    assert.equal(result.text, 'hello');
    assert.equal(result.model, 'm2');
    const stored = versions.makeVersion({ ai: result }, 1).searchEvidence[0];
    assert.equal(stored.domain, 'example.com');
    assert.equal(stored.readStatus, 'deep-read');
    assert.equal(Object.hasOwn(stored, 'contentExcerpt'), false);
});

test('report versions persist safe citation summaries but never full page content', () => {
    const record = versions.appendVersion({ id: 'r1' }, {
        content: 'report',
        searchEvidence: [
            { id: 'e1', title: 'One', url: 'https://example.com/a', contentExcerpt: 'secret full body', readStatus: 'deep-read' },
            { id: 'e2', title: 'Unsafe', url: 'http://localhost/private', contentExcerpt: 'private' }
        ]
    }, 1);
    const active = versions.activeVersion(record);
    assert.equal(active.searchEvidence.length, 1);
    assert.equal(active.searchEvidence[0].readStatus, 'deep-read');
    assert.equal(Object.hasOwn(active.searchEvidence[0], 'contentExcerpt'), false);
    assert.equal(Object.hasOwn(active.ai, 'searchEvidence'), false);
});

test('remove deletes the active version and selects a remaining neighbor', () => {
    const record = { id: 'r1', versions: [{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }], activeVersionId: 'v2' };
    const next = versions.removeVersion(record, 'v2');
    assert.equal(JSON.stringify(next.versions.map(version => version.id)), JSON.stringify(['v1', 'v3']));
    assert.equal(next.activeVersionId, 'v3');
});
