// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { buildReasoningOptions } from '../ai-routing-pure.mjs';
import * as aiJsonPure from '../ai-json-pure.mjs';

const source = readFileSync(new URL('../ai-api.js', import.meta.url), 'utf8');

function loadApi(fetchImpl) {
    const requests = [];
    const ai = {
        cfg: {},
        apiKeyFor() {
            return 'key';
        },
    };
    const sandbox = {
        ai,
        window: {
            aiRoutingPure: { buildReasoningOptions },
            aiJsonPure: aiJsonPure.default || aiJsonPure,
        },
        fetch: async (url, options) => {
            const body = options?.body ? JSON.parse(options.body) : null;
            requests.push({ url, body });
            return fetchImpl(url, options, requests.length);
        },
        console,
        TypeError,
        setTimeout,
        clearTimeout,
        TextDecoder,
        AbortController,
    };
    sandbox.window.aiJsonPure = aiJsonPure.default || aiJsonPure;
    sandbox.aiJsonPure = sandbox.window.aiJsonPure;
    vm.runInNewContext(source, sandbox);
    return { ai, requests };
}

function jsonResponse(payload) {
    return {
        ok: true,
        status: 200,
        async text() {
            return JSON.stringify(payload);
        },
        async json() {
            return payload;
        },
    };
}

test('OpenAI Responses incomplete max_output_tokens throws AI_OUTPUT_TRUNCATED in strict mode', async () => {
    const { ai } = loadApi(() =>
        jsonResponse({
            status: 'incomplete',
            incomplete_details: { reason: 'max_output_tokens' },
            output_text: '{"actions":[{"name":"台阶',
        }),
    );
    await assert.rejects(
        () =>
            ai._callOpenAIResponses(
                [{ role: 'user', content: 'x' }],
                1000,
                'key',
                false,
                null,
                {
                    provider: 'openai-responses',
                    baseUrl: 'https://example.test/v1',
                    model: 'gpt-5',
                },
                null,
                { requireCompleteOutput: true },
            ),
        (err) => err.code === 'AI_OUTPUT_TRUNCATED',
    );
});

test('OpenAI Responses complete payload returns text under strict mode', async () => {
    const { ai } = loadApi(() =>
        jsonResponse({
            status: 'completed',
            output_text: '{"ok":true}',
        }),
    );
    const text = await ai._callOpenAIResponses(
        [{ role: 'user', content: 'x' }],
        1000,
        'key',
        false,
        null,
        {
            provider: 'openai-responses',
            baseUrl: 'https://example.test/v1',
            model: 'gpt-5',
        },
        null,
        { requireCompleteOutput: true },
    );
    assert.equal(text, '{"ok":true}');
});

test('OpenAI Chat finish_reason length throws AI_OUTPUT_TRUNCATED in strict mode', async () => {
    const { ai } = loadApi(() =>
        jsonResponse({
            choices: [{ finish_reason: 'length', message: { content: '{"a":' } }],
        }),
    );
    await assert.rejects(
        () =>
            ai._callOpenAIChat(
                [{ role: 'user', content: 'x' }],
                1000,
                'key',
                false,
                null,
                {
                    provider: 'openai',
                    baseUrl: 'https://example.test/v1',
                    model: 'gpt-5',
                },
                null,
                { requireCompleteOutput: true },
            ),
        (err) => err.code === 'AI_OUTPUT_TRUNCATED',
    );
});

test('Claude stop_reason max_tokens throws AI_OUTPUT_TRUNCATED in strict mode', async () => {
    const { ai } = loadApi(() =>
        jsonResponse({
            stop_reason: 'max_tokens',
            content: [{ type: 'text', text: '{"a":' }],
        }),
    );
    await assert.rejects(
        () =>
            ai._callClaude(
                [{ role: 'user', content: 'x' }],
                1000,
                'key',
                false,
                null,
                {
                    provider: 'claude',
                    baseUrl: 'https://example.test/v1',
                    model: 'claude-4',
                },
                null,
                { requireCompleteOutput: true },
            ),
        (err) => err.code === 'AI_OUTPUT_TRUNCATED',
    );
});

test('Gemini finishReason MAX_TOKENS throws AI_OUTPUT_TRUNCATED in strict mode', async () => {
    const { ai } = loadApi(() =>
        jsonResponse({
            candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"a":' }] } }],
        }),
    );
    await assert.rejects(
        () =>
            ai._callGemini(
                [{ role: 'user', content: 'x' }],
                1000,
                'key',
                false,
                null,
                {
                    provider: 'gemini',
                    baseUrl: 'https://example.test/v1beta',
                    model: 'gemini-2.5',
                },
                null,
                { requireCompleteOutput: true },
            ),
        (err) => err.code === 'AI_OUTPUT_TRUNCATED',
    );
});

test('compatible proxy without finish status still returns text under strict mode', async () => {
    const { ai } = loadApi(() =>
        jsonResponse({
            choices: [{ message: { content: '{"ok":1}' } }],
        }),
    );
    const text = await ai._callOpenAIChat(
        [{ role: 'user', content: 'x' }],
        1000,
        'key',
        false,
        null,
        {
            provider: 'openai',
            baseUrl: 'https://example.test/v1',
            model: 'proxy-model',
        },
        null,
        { requireCompleteOutput: true },
    );
    assert.equal(text, '{"ok":1}');
});

test('requireCompleteOutput false keeps truncated OpenAI Responses text', async () => {
    const { ai } = loadApi(() =>
        jsonResponse({
            status: 'incomplete',
            incomplete_details: { reason: 'max_output_tokens' },
            output_text: '{"partial":true',
        }),
    );
    const text = await ai._callOpenAIResponses(
        [{ role: 'user', content: 'x' }],
        1000,
        'key',
        false,
        null,
        {
            provider: 'openai-responses',
            baseUrl: 'https://example.test/v1',
            model: 'gpt-5',
        },
        null,
        { requireCompleteOutput: false },
    );
    assert.equal(text, '{"partial":true');
});

test('content filter returns AI_OUTPUT_BLOCKED', async () => {
    const { ai } = loadApi(() =>
        jsonResponse({
            choices: [{ finish_reason: 'content_filter', message: { content: '' } }],
        }),
    );
    await assert.rejects(
        () =>
            ai._callOpenAIChat(
                [{ role: 'user', content: 'x' }],
                1000,
                'key',
                false,
                null,
                {
                    provider: 'openai',
                    baseUrl: 'https://example.test/v1',
                    model: 'gpt-5',
                },
                null,
                { requireCompleteOutput: true },
            ),
        (err) => err.code === 'AI_OUTPUT_BLOCKED',
    );
});

test('OpenAI Chat message.refusal returns AI_OUTPUT_BLOCKED', async () => {
    const { ai } = loadApi(() =>
        jsonResponse({
            choices: [
                {
                    finish_reason: 'stop',
                    message: { content: '', refusal: 'I cannot help with that.' },
                },
            ],
        }),
    );
    await assert.rejects(
        () =>
            ai._callOpenAIChat(
                [{ role: 'user', content: 'x' }],
                1000,
                'key',
                false,
                null,
                {
                    provider: 'openai',
                    baseUrl: 'https://example.test/v1',
                    model: 'gpt-5',
                },
                null,
                { requireCompleteOutput: true },
            ),
        (err) =>
            err.code === 'AI_OUTPUT_BLOCKED' &&
            err.finishReason === 'refusal' &&
            !String(err.message || '').includes('I cannot help') &&
            !String(err.body || '').includes('I cannot help'),
    );
});

test('OpenAI Responses refusal content item returns AI_OUTPUT_BLOCKED', async () => {
    const { ai } = loadApi(() =>
        jsonResponse({
            status: 'completed',
            output: [
                {
                    type: 'message',
                    content: [{ type: 'refusal', refusal: 'blocked topic' }],
                },
            ],
        }),
    );
    await assert.rejects(
        () =>
            ai._callOpenAIResponses(
                [{ role: 'user', content: 'x' }],
                1000,
                'key',
                false,
                null,
                {
                    provider: 'openai-responses',
                    baseUrl: 'https://example.test/v1',
                    model: 'gpt-5',
                },
                null,
                { requireCompleteOutput: true },
            ),
        (err) => err.code === 'AI_OUTPUT_BLOCKED' && err.finishReason === 'refusal',
    );
});

test('Gemini promptFeedback.blockReason returns AI_OUTPUT_BLOCKED', async () => {
    const { ai } = loadApi(() =>
        jsonResponse({
            promptFeedback: { blockReason: 'SAFETY' },
            candidates: [],
        }),
    );
    await assert.rejects(
        () =>
            ai._callGemini(
                [{ role: 'user', content: 'x' }],
                1000,
                'key',
                false,
                null,
                {
                    provider: 'gemini',
                    baseUrl: 'https://example.test/v1',
                    model: 'gemini',
                },
                null,
                { requireCompleteOutput: true },
            ),
        (err) => err.code === 'AI_OUTPUT_BLOCKED',
    );
});

test('Gemini SAFETY finishReason returns AI_OUTPUT_BLOCKED', async () => {
    const { ai } = loadApi(() =>
        jsonResponse({
            candidates: [{ finishReason: 'SAFETY', content: { parts: [{ text: '' }] } }],
        }),
    );
    await assert.rejects(
        () =>
            ai._callGemini(
                [{ role: 'user', content: 'x' }],
                1000,
                'key',
                false,
                null,
                {
                    provider: 'gemini',
                    baseUrl: 'https://example.test/v1',
                    model: 'gemini',
                },
                null,
                { requireCompleteOutput: true },
            ),
        (err) => err.code === 'AI_OUTPUT_BLOCKED' && err.finishReason === 'SAFETY',
    );
});
