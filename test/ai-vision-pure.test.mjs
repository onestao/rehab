import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { analyzeVisionModel, classifyVisionError, splitVisionKeywords } from '../ai-vision-pure.mjs';

const whitelist = JSON.parse(await readFile(new URL('../assets/vision-models.json', import.meta.url), 'utf8'));

test('matches provider whitelist and high resolution labels', () => {
    assert.deepEqual(analyzeVisionModel('gpt-5.4-mini', 'openai', whitelist), {
        vision: true,
        highRes: false,
        isImageGen: false,
        source: 'provider'
    });
    assert.equal(analyzeVisionModel('claude-opus-4-7', 'claude', whitelist).highRes, true);
    assert.equal(analyzeVisionModel('gemini-3.1-pro', 'gemini', whitelist).vision, true);
});

test('openai compatible provider includes common VL model families', () => {
    assert.equal(analyzeVisionModel('qwen3-vl-plus', 'openai', whitelist).vision, true);
    assert.equal(analyzeVisionModel('glm-5v-turbo', 'openai-responses', whitelist).vision, true);
});

test('image generation blacklist overrides vision keywords', () => {
    const result = analyzeVisionModel('nano-banana-pro-vision', 'openai', whitelist);
    assert.equal(result.isImageGen, true);
    assert.equal(result.vision, false);
});

test('unknown models remain usable but unverified until custom keywords match', () => {
    assert.equal(analyzeVisionModel('foo-bar-vlm-2099', 'openai', whitelist).vision, true);
    assert.equal(analyzeVisionModel('foo-bar-2099', 'openai', whitelist).vision, false);
    assert.equal(analyzeVisionModel('foo-bar-2099', 'openai', whitelist, 'foo-bar').vision, true);
    assert.deepEqual(splitVisionKeywords(' foo-bar, ,baz '), ['foo-bar', 'baz']);
});

test('classifies diet photo vision errors', () => {
    assert.equal(classifyVisionError({ status: 401, body: 'bad key' }).message, '鉴权失败，请检查 API Key');
    assert.equal(classifyVisionError({ status: 404, body: 'not found' }).message, '接口路径错误，请检查 Base URL');
    assert.equal(classifyVisionError({ status: 429 }).message, '请求过快或额度用尽');
    assert.equal(classifyVisionError({ code: 'HEIC_DECODE_FAILED' }).message, '照片解码失败，请换一张或改用 JPEG');
    assert.equal(classifyVisionError({ code: 'AI_TIMEOUT' }).type, 'timeout');
    const unsupported = classifyVisionError({ status: 400, body: 'unsupported image modality' });
    assert.equal(unsupported.type, 'unsupported_vision');
    assert.equal(unsupported.cacheVisionFailure, true);
});
