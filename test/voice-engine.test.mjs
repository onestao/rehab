import test from 'node:test';
import assert from 'node:assert/strict';
import {
    parseLegadoConfig,
    parseLegadoConfigWithWarnings,
    renderUrl,
    resolveEngineChain
} from '../voice-engine.js';

test('parseLegadoConfig accepts a single object and parses string header JSON', () => {
    const [engine] = parseLegadoConfig({
        name: 'Azure-晓晓',
        url: 'https://x.example/api/tts?text={{speakText}}',
        header: '{"User-Agent":"legado"}',
        contentType: 'audio/mpeg'
    });
    assert.equal(engine.name, 'Azure-晓晓');
    assert.equal(engine.url.includes('{{speakText}}'), true);
    assert.deepEqual(engine.header, { 'User-Agent': 'legado' });
    assert.equal(engine.contentType, 'audio/mpeg');
});

test('parseLegadoConfig accepts arrays and reports invalid header as warning', () => {
    const result = parseLegadoConfigWithWarnings(JSON.stringify([
        { name: 'a', url: 'https://a.example/tts', header: '{bad' },
        { name: 'b', url: 'https://b.example/tts' }
    ]));
    assert.equal(result.engines.length, 2);
    assert.deepEqual(result.engines[0].header, {});
    assert.equal(result.warnings.length, 1);
});

test('parseLegadoConfig rejects invalid JSON and missing url', () => {
    assert.throws(() => parseLegadoConfig('{bad'), /JSON/);
    assert.throws(() => parseLegadoConfig({ name: 'missing' }), /url/);
});

test('renderUrl replaces Legado text, speed, and pitch placeholders', () => {
    const cfg = {
        url: 'https://x.example/tts?a={{speakText}}&b={{java.encodeURI(speakText)}}&c={{foo speakText bar}}&r={{speakSpeed}}&p={{speakPitch}}&again={{speakText}}'
    };
    const out = renderUrl(cfg, { text: '中文 & space 😀', rate: 1, pitch: 1 });
    const encoded = encodeURIComponent('中文 & space 😀');
    assert.equal(out.includes(`a=${encoded}`), true);
    assert.equal(out.includes(`b=${encoded}`), true);
    assert.equal(out.includes(`c=${encoded}`), true);
    assert.equal(out.includes(`again=${encoded}`), true);
    assert.equal(out.includes('r=0'), true);
    assert.equal(out.includes('p=0'), true);
});

test('renderUrl maps speech rate to Legado -50 to 50 scale', () => {
    const cfg = { url: 'https://x.example/tts?speed={{speakSpeed}}' };
    assert.equal(renderUrl(cfg, { text: 'x', rate: 1 }), 'https://x.example/tts?speed=0');
    assert.equal(renderUrl(cfg, { text: 'x', rate: 2 }), 'https://x.example/tts?speed=50');
    assert.equal(renderUrl(cfg, { text: 'x', rate: 0.5 }), 'https://x.example/tts?speed=-25');
});

test('renderUrl supports safe speakSpeed and speakPitch arithmetic expressions', () => {
    const cfg = { url: 'https://x.example/tts?rate={{speakSpeed/19}}&pitch={{(speakPitch+10)/2}}' };
    assert.equal(renderUrl(cfg, { text: 'x', rate: 2, pitch: 1 }), 'https://x.example/tts?rate=2.631579&pitch=5');
});

test('renderUrl leaves unsupported numeric expressions untouched instead of executing code', () => {
    const cfg = { url: 'https://x.example/tts?rate={{alert(speakSpeed)}}' };
    assert.equal(renderUrl(cfg, { text: 'x', rate: 2 }), 'https://x.example/tts?rate={{alert(speakSpeed)}}');
});

test('resolveEngineChain returns the expected priority order', () => {
    const engines = [{ id: 'l1', url: 'https://a.example' }, { id: 'l2', url: 'https://b.example' }];
    assert.deepEqual(resolveEngineChain('online-first', engines).map(x => x.id), ['l1', 'l2', 'webspeech']);
    assert.deepEqual(resolveEngineChain('local-first', engines).map(x => x.id), ['webspeech', 'l1', 'l2']);
    assert.deepEqual(resolveEngineChain('online-only', engines).map(x => x.id), ['l1', 'l2']);
    assert.deepEqual(resolveEngineChain('local-only', engines).map(x => x.id), ['webspeech']);
});

test('renderUrl keeps URLs valid with spaces, ampersands, CJK, and emoji text', () => {
    const url = renderUrl({ url: 'https://x.example/tts?text={{speakText}}' }, { text: '肩部 放松 & 呼吸 😀', rate: 1 });
    assert.doesNotThrow(() => new URL(url));
    assert.equal(url.includes('肩部'), false);
    assert.equal(url.includes(' '), false);
    assert.equal(url.includes('& 呼吸'), false);
});
