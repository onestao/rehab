// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { buildReasoningOptions, isRetryableAiError } from '../ai-routing-pure.mjs';
import * as aiJsonPure from '../ai-json-pure.mjs';

const source = readFileSync(new URL('../ai-api.js', import.meta.url), 'utf8');

function loadApiWithRun(texts) {
    const queue = [...texts];
    const calls = [];
    const ai = {
        cfg: {},
        apiKeyFor() {
            return 'key';
        },
        resolveTaskConfig: true,
        getTaskRequestSequence() {
            return [
                {
                    enabled: true,
                    apiKey: 'key',
                    provider: 'openai',
                    profileId: 'p-main',
                    model: 'model-a',
                    modelId: 'model-a',
                    reasoningDepth: 'medium',
                    route: { fallbackMode: 'manual' },
                },
            ];
        },
    };
    const sandbox = {
        ai,
        window: {
            aiRoutingPure: { buildReasoningOptions, isRetryableAiError },
            aiJsonPure,
            toast: { show() {} },
        },
        fetch: async () => ({
            ok: true,
            status: 200,
            async text() {
                return '{}';
            },
            async json() {
                return {};
            },
        }),
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
    sandbox.ai.call = async (messages, maxTokens, opts = {}) => {
        calls.push({
            messages,
            maxTokens,
            opts,
            requireCompleteOutput: !!opts.requireCompleteOutput,
            routeOverride: opts.routeOverride || null,
        });
        if (!queue.length) throw new Error('unexpected extra model call');
        const next = queue.shift();
        if (next && typeof next === 'object' && next.throw) {
            const err = new Error(next.throw.message || 'fail');
            Object.assign(err, next.throw);
            throw err;
        }
        return typeof next === 'string' ? next : next.text;
    };
    // make run use our call path
    sandbox.ai.run = async (options = {}) => {
        // simplify: call only, with meta
        const effective = {
            profileId: 'p-main',
            modelId: options.routeOverride?.primary?.modelId || 'model-a',
            provider: 'openai',
            reasoningDepth: options.routeOverride?.reasoningDepth || 'medium',
            route: { fallbackMode: options.routeOverride?.fallbackMode || 'manual' },
        };
        try {
            const text = await sandbox.ai.call(options.messages || [], options.maxTokens || 2000, {
                ...options,
                requireCompleteOutput: options.requireCompleteOutput,
            });
            return options.returnMeta
                ? {
                      text,
                      meta: {
                          taskId: options.taskId,
                          profileId: effective.profileId,
                          provider: effective.provider,
                          modelId: effective.modelId,
                          reasoningDepth: effective.reasoningDepth,
                          fallback: { used: false, index: 0, mode: effective.route.fallbackMode },
                      },
                  }
                : text;
        } catch (error) {
            sandbox.ai._attachAiAttempt(error, {
                taskId: options.taskId,
                profileId: effective.profileId,
                modelId: effective.modelId,
                provider: effective.provider,
                reasoningDepth: effective.reasoningDepth,
            });
            throw error;
        }
    };
    return { ai: sandbox.ai, calls };
}

const goodObject = JSON.stringify({ actions: [{ name: '台阶下放', status: 'continued' }] });

test('runJson accepts strict JSON once', async () => {
    const { ai, calls } = loadApiWithRun([goodObject]);
    const value = await ai.runJson({
        taskId: 'rehab.weekly',
        messages: [{ role: 'user', content: 'x' }],
        maxTokens: 4000,
        parseOptions: { expected: 'object', shapeKeys: ['actions'] },
    });
    assert.equal(value.actions[0].name, '台阶下放');
    assert.equal(calls.length, 1);
});

test('runJson accepts fenced JSON once', async () => {
    const { ai, calls } = loadApiWithRun([`\`\`\`json\n${goodObject}\n\`\`\``]);
    const value = await ai.runJson({
        taskId: 'rehab.weekly',
        messages: [{ role: 'user', content: 'x' }],
        maxTokens: 4000,
        parseOptions: { expected: 'object', shapeKeys: ['actions'] },
    });
    assert.equal(value.actions[0].name, '台阶下放');
    assert.equal(calls.length, 1);
});

test('runJson extracts balanced object from noisy text once', async () => {
    const { ai, calls } = loadApiWithRun([`分析如下：${goodObject}\n完成`]);
    const value = await ai.runJson({
        taskId: 'rehab.weekly',
        messages: [{ role: 'user', content: 'x' }],
        maxTokens: 4000,
        parseOptions: { expected: 'object', shapeKeys: ['actions'] },
    });
    assert.equal(value.actions[0].name, '台阶下放');
    assert.equal(calls.length, 1);
});

test('runJson unwraps wrapperKeys once', async () => {
    const wrapped = JSON.stringify({ rehabWeekly: { actions: [{ name: '台阶下放' }] } });
    const { ai, calls } = loadApiWithRun([wrapped]);
    const value = await ai.runJson({
        taskId: 'rehab.weekly',
        messages: [{ role: 'user', content: 'x' }],
        maxTokens: 4000,
        parseOptions: {
            expected: 'object',
            shapeKeys: ['actions'],
            wrapperKeys: ['rehabWeekly', 'result'],
        },
    });
    assert.equal(value.actions[0].name, '台阶下放');
    assert.equal(calls.length, 1);
});

test('runJson retries truncated JSON and succeeds with same model and reasoning off', async () => {
    const { ai, calls } = loadApiWithRun(['{"actions":[', goodObject]);
    const retries = [];
    const value = await ai.runJson({
        taskId: 'rehab.weekly',
        messages: [
            { role: 'system', content: 'sys' },
            { role: 'user', content: 'x' },
        ],
        maxTokens: 2000,
        parseOptions: { expected: 'object', shapeKeys: ['actions'] },
        onRetry: (info) => retries.push(info),
    });
    assert.equal(value.actions[0].name, '台阶下放');
    assert.equal(calls.length, 2);
    assert.equal(retries[0]?.attempt, 2);
    assert.equal(calls[1].maxTokens, 4000);
    const retryRoute = calls[1].routeOverride || calls[1].opts?.routeOverride || {};
    assert.equal(retryRoute.reasoningDepth, 'off');
    assert.equal(retryRoute.fallbackMode, 'manual');
    assert.equal(Array.isArray(retryRoute.fallbacks) && retryRoute.fallbacks.length === 0, true);
    assert.equal(retryRoute.primary?.modelId, 'model-a');
    assert.equal(retryRoute.primary?.profileId, 'p-main');
    assert.match(String(calls[1].messages?.[0]?.content || ''), /只输出 JSON/);
});

test('runJson retries non-json analysis text then succeeds', async () => {
    const { ai, calls } = loadApiWithRun(['先分析一下用户意图……', goodObject]);
    const value = await ai.runJson({
        taskId: 'rehab.weekly',
        messages: [{ role: 'user', content: 'x' }],
        maxTokens: 4000,
        parseOptions: { expected: 'object', shapeKeys: ['actions'] },
    });
    assert.equal(value.actions[0].name, '台阶下放');
    assert.equal(calls.length, 2);
});

test('runJson retries missing shape keys then succeeds', async () => {
    const { ai, calls } = loadApiWithRun([JSON.stringify({ note: 'no actions' }), goodObject]);
    const value = await ai.runJson({
        taskId: 'rehab.weekly',
        messages: [{ role: 'user', content: 'x' }],
        maxTokens: 4000,
        parseOptions: { expected: 'object', shapeKeys: ['actions'] },
    });
    assert.equal(value.actions[0].name, '台阶下放');
    assert.equal(calls.length, 2);
});

test('runJson caps retry maxTokens at 8000', async () => {
    const { ai, calls } = loadApiWithRun(['{', goodObject]);
    await ai.runJson({
        taskId: 'rehab.weekly',
        messages: [{ role: 'user', content: 'x' }],
        maxTokens: 4000,
        parseOptions: { expected: 'object', shapeKeys: ['actions'] },
    });
    assert.equal(calls[1].maxTokens, 8000);

    const second = loadApiWithRun(['{', goodObject]);
    await second.ai.runJson({
        taskId: 'rehab.weekly',
        messages: [{ role: 'user', content: 'x' }],
        maxTokens: 9000,
        parseOptions: { expected: 'object', shapeKeys: ['actions'] },
    });
    assert.equal(second.calls[1].maxTokens, 8000);
});

test('runJson second failure has firstAttemptCode and retryAttempted', async () => {
    const { ai, calls } = loadApiWithRun(['{', '{']);
    await assert.rejects(
        () =>
            ai.runJson({
                taskId: 'rehab.weekly',
                messages: [{ role: 'user', content: 'x' }],
                maxTokens: 2000,
                parseOptions: { expected: 'object', shapeKeys: ['actions'] },
            }),
        (err) =>
            err.retryAttempted === true &&
            err.firstAttemptCode === 'AI_JSON_PARSE_FAILED' &&
            err.code === 'AI_JSON_PARSE_FAILED',
    );
    assert.equal(calls.length, 2);
});

test('runJson does not retry auth or blocked errors', async () => {
    for (const code of ['AI_OUTPUT_BLOCKED', 'AUTH', 'NETWORK_ERROR']) {
        const { ai, calls } = loadApiWithRun([
            {
                throw: { code, status: code === 'AUTH' ? 401 : undefined, message: 'nope' },
            },
        ]);
        await assert.rejects(
            () =>
                ai.runJson({
                    taskId: 'rehab.weekly',
                    messages: [{ role: 'user', content: 'x' }],
                    maxTokens: 2000,
                    parseOptions: { expected: 'object', shapeKeys: ['actions'] },
                }),
            (err) => err.code === code,
        );
        assert.equal(calls.length, 1, code);
    }
});

test('runJson returnMeta does not leak credentials', async () => {
    const { ai } = loadApiWithRun([goodObject]);
    const result = await ai.runJson({
        taskId: 'rehab.weekly',
        messages: [{ role: 'user', content: 'x' }],
        maxTokens: 2000,
        parseOptions: { expected: 'object', shapeKeys: ['actions'] },
        returnMeta: true,
    });
    assert.equal(result.value.actions[0].name, '台阶下放');
    assert.equal(result.meta.modelId, 'model-a');
    assert.equal(result.meta.taskId, 'rehab.weekly');
    assert.equal(result.meta.apiKey, undefined);
    assert.equal(JSON.stringify(result).includes('key'), false);
});

test('runJson treats actions null as shape mismatch and retries once', async () => {
    const { ai, calls } = loadApiWithRun([JSON.stringify({ actions: null }), goodObject]);
    const value = await ai.runJson({
        taskId: 'rehab.weekly',
        messages: [{ role: 'user', content: 'x' }],
        maxTokens: 2000,
        parseOptions: {
            expected: 'object',
            requiredKeys: ['actions'],
            fieldTypes: { actions: 'array' },
        },
    });
    assert.equal(value.actions[0].name, '台阶下放');
    assert.equal(calls.length, 2);
});

test('runJson second shape mismatch returns AI_JSON_SHAPE_MISMATCH', async () => {
    const { ai, calls } = loadApiWithRun([
        JSON.stringify({ actions: null }),
        JSON.stringify({ note: 'still wrong' }),
    ]);
    await assert.rejects(
        () =>
            ai.runJson({
                taskId: 'rehab.weekly',
                messages: [{ role: 'user', content: 'x' }],
                maxTokens: 2000,
                parseOptions: {
                    expected: 'object',
                    requiredKeys: ['actions'],
                    fieldTypes: { actions: 'array' },
                },
            }),
        (err) =>
            err.code === 'AI_JSON_SHAPE_MISMATCH' &&
            err.retryAttempted === true &&
            err.firstAttemptCode === 'AI_JSON_SHAPE_MISMATCH',
    );
    assert.equal(calls.length, 2);
});

test('runJson never exceeds two model calls', async () => {
    const { ai, calls } = loadApiWithRun(['{', '{', goodObject]);
    await assert.rejects(
        () =>
            ai.runJson({
                taskId: 'rehab.weekly',
                messages: [{ role: 'user', content: 'x' }],
                maxTokens: 2000,
                parseOptions: {
                    expected: 'object',
                    requiredKeys: ['actions'],
                    fieldTypes: { actions: 'array' },
                },
            }),
        (err) => err.retryAttempted === true,
    );
    assert.equal(calls.length, 2);
});

test('runJson content-blocked path does not retry', async () => {
    const { ai, calls } = loadApiWithRun([
        {
            throw: {
                code: 'AI_OUTPUT_BLOCKED',
                finishReason: 'content_filter',
                message: 'blocked',
            },
        },
        goodObject,
    ]);
    await assert.rejects(
        () =>
            ai.runJson({
                taskId: 'rehab.weekly',
                messages: [{ role: 'user', content: 'x' }],
                maxTokens: 2000,
                parseOptions: {
                    expected: 'object',
                    requiredKeys: ['actions'],
                    fieldTypes: { actions: 'array' },
                },
            }),
        (err) => err.code === 'AI_OUTPUT_BLOCKED',
    );
    assert.equal(calls.length, 1);
});

test('runJson aborts before retry when signal is aborted', async () => {
    const controller = new AbortController();
    const { ai, calls } = loadApiWithRun(['{', goodObject]);
    // Force first parse failure without abort, then abort before retry.
    const originalRun = ai.run.bind(ai);
    let n = 0;
    ai.run = async (options = {}) => {
        n += 1;
        if (n === 1) {
            const result = await originalRun(options);
            controller.abort();
            return result;
        }
        return originalRun(options);
    };
    await assert.rejects(
        () =>
            ai.runJson({
                taskId: 'rehab.weekly',
                messages: [{ role: 'user', content: 'x' }],
                maxTokens: 2000,
                signal: controller.signal,
                parseOptions: {
                    expected: 'object',
                    requiredKeys: ['actions'],
                    fieldTypes: { actions: 'array' },
                },
            }),
        (err) => err.code === 'AI_REQUEST_ABORTED',
    );
    assert.equal(calls.length, 1);
});

test('runJson fieldTypes reject wrong required field types', async () => {
    const { ai, calls } = loadApiWithRun([
        JSON.stringify({ summary: 1, highlights: [], suggestions: [] }),
        JSON.stringify({ summary: 'ok', highlights: ['a'], suggestions: ['b'] }),
    ]);
    const value = await ai.runJson({
        taskId: 'report.weight.weekly',
        messages: [{ role: 'user', content: 'x' }],
        maxTokens: 1800,
        parseOptions: {
            expected: 'object',
            requiredKeys: ['summary', 'highlights', 'suggestions'],
            fieldTypes: { summary: 'string', highlights: 'array', suggestions: 'array' },
        },
    });
    assert.equal(value.summary, 'ok');
    assert.equal(calls.length, 2);
});

test('bodyGoalPlan retries truncated plan JSON then succeeds without partial return', async () => {
    const plan = {
        fast: {
            days: 30,
            weeklyLoss: 0.8,
            dailyCal: 1800,
            deficit: 500,
            proteinGoal: 140,
            carbGoal: 180,
            fatGoal: 55,
            desc: '快',
        },
        moderate: {
            days: 50,
            weeklyLoss: 0.5,
            dailyCal: 1900,
            deficit: 400,
            proteinGoal: 130,
            carbGoal: 190,
            fatGoal: 55,
            desc: '稳',
        },
        slow: {
            days: 80,
            weeklyLoss: 0.3,
            dailyCal: 2000,
            deficit: 300,
            proteinGoal: 120,
            carbGoal: 200,
            fatGoal: 55,
            desc: '慢',
        },
        tips: ['多喝水'],
    };
    const { ai, calls } = loadApiWithRun(['{"fast":{"days":30', JSON.stringify(plan)]);
    const value = await ai.bodyGoalPlan({
        goalType: 'loss',
        currentWeight: 80,
        targetWeight: 72,
        activityLevel: 'moderate',
        dailyTrainMin: 40,
        weeklyFreq: 4,
        intensity: 'moderate',
        sportType: 'mixed',
    });
    assert.equal(value.fast.weeklyLoss, 0.8);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].routeOverride?.reasoningDepth, 'off');
});

test('bodyGoalPlan second failure does not return partial plan', async () => {
    const { ai, calls } = loadApiWithRun(['{', '{']);
    await assert.rejects(
        () =>
            ai.bodyGoalPlan({
                goalType: 'loss',
                currentWeight: 80,
                targetWeight: 72,
                activityLevel: 'moderate',
                dailyTrainMin: 40,
                weeklyFreq: 4,
                intensity: 'moderate',
                sportType: 'mixed',
            }),
        (err) => err.retryAttempted === true && !err.fast && !err.moderate,
    );
    assert.equal(calls.length, 2);
});

test('runJson forwards onProgress on both attempts', async () => {
    const progress = [];
    const { ai, calls } = loadApiWithRun(['{', goodObject]);
    const originalRun = ai.run.bind(ai);
    ai.run = async (options = {}) => {
        options.onProgress?.({ stage: 'request', attempt: calls.length + 1 });
        return originalRun(options);
    };
    await ai.runJson({
        taskId: 'food.vision',
        messages: [{ role: 'user', content: 'x' }],
        maxTokens: 2000,
        parseOptions: {
            expected: 'object',
            requiredKeys: ['actions'],
            fieldTypes: { actions: 'array' },
        },
        onProgress: (info) => progress.push(info),
    });
    assert.equal(calls.length, 2);
    assert.equal(progress.filter((p) => p.stage === 'request').length, 2);
});

test('runJson second-attempt Abort returns AI_REQUEST_ABORTED with two calls', async () => {
    const controller = new AbortController();
    let n = 0;
    const { ai, calls } = loadApiWithRun([
        '{',
        {
            throw: { message: 'aborted', code: 'AI_REQUEST_ABORTED', name: 'AbortError' },
        },
    ]);
    const originalRun = ai.run.bind(ai);
    ai.run = async (options = {}) => {
        n += 1;
        if (n === 2) controller.abort();
        return originalRun(options);
    };
    await assert.rejects(
        () =>
            ai.runJson({
                taskId: 'rehab.weekly',
                messages: [{ role: 'user', content: 'x' }],
                maxTokens: 2000,
                signal: controller.signal,
                parseOptions: {
                    expected: 'object',
                    requiredKeys: ['actions'],
                    fieldTypes: { actions: 'array' },
                },
            }),
        (err) =>
            err.code === 'AI_REQUEST_ABORTED' &&
            err.retryAttempted === true &&
            String(err.aiAttempt?.modelId || '') === 'model-a',
    );
    assert.equal(calls.length, 2);
});

test('runJson second-attempt AI_CANCELLED preserves production cancel code', async () => {
    const { ai, calls } = loadApiWithRun([
        '{',
        {
            throw: { message: 'AI_CANCELLED', code: 'AI_CANCELLED', name: 'AbortError' },
        },
    ]);
    // Keep first parse fail, second is production-style cancel code from call().
    await assert.rejects(
        () =>
            ai.runJson({
                taskId: 'rehab.weekly',
                messages: [{ role: 'user', content: 'x' }],
                maxTokens: 1000,
                parseOptions: {
                    expected: 'object',
                    requiredKeys: ['actions'],
                    fieldTypes: { actions: 'array' },
                },
            }),
        (err) =>
            err.code === 'AI_CANCELLED' &&
            err.retryAttempted === true &&
            String(err.firstAttemptCode || '') !== '' &&
            String(err.aiAttempt?.modelId || '') === 'model-a' &&
            err.body === undefined,
    );
    assert.equal(calls.length, 2);
});

test('runJson second-attempt HTTP error keeps original status/code and safe aiAttempt', async () => {
    const { ai, calls } = loadApiWithRun([
        '{',
        {
            throw: {
                message: 'AI 请求失败: 429 rate limit',
                code: 'AI_HTTP_ERROR',
                status: 429,
                finishReason: 'rate_limit',
            },
        },
    ]);
    await assert.rejects(
        () =>
            ai.runJson({
                taskId: 'rehab.weekly',
                messages: [{ role: 'user', content: 'x' }],
                maxTokens: 2000,
                parseOptions: {
                    expected: 'object',
                    requiredKeys: ['actions'],
                    fieldTypes: { actions: 'array' },
                },
            }),
        (err) =>
            err.status === 429 &&
            err.code === 'AI_HTTP_ERROR' &&
            err.retryAttempted === true &&
            err.firstAttemptCode === 'AI_JSON_PARSE_FAILED' &&
            String(err.aiAttempt?.modelId || '') === 'model-a' &&
            err.body === undefined &&
            !String(err.message || '').includes('重新生成后仍未返回有效 JSON'),
    );
    assert.equal(calls.length, 2);
});

test('runJson second-attempt content block keeps AI_OUTPUT_BLOCKED without wrap message', async () => {
    const { ai, calls } = loadApiWithRun([
        '{',
        {
            throw: {
                message: 'AI 输出被内容安全策略拦截',
                code: 'AI_OUTPUT_BLOCKED',
                finishReason: 'content_filter',
            },
        },
    ]);
    await assert.rejects(
        () =>
            ai.runJson({
                taskId: 'rehab.weekly',
                messages: [{ role: 'user', content: 'x' }],
                maxTokens: 2000,
                parseOptions: {
                    expected: 'object',
                    requiredKeys: ['actions'],
                    fieldTypes: { actions: 'array' },
                },
            }),
        (err) =>
            err.code === 'AI_OUTPUT_BLOCKED' &&
            err.finishReason === 'content_filter' &&
            err.retryAttempted === true &&
            String(err.aiAttempt?.modelId || '') === 'model-a',
    );
    assert.equal(calls.length, 2);
});

test('runJson wrap failure carries safe aiAttempt.modelId without body/cause', async () => {
    const { ai, calls } = loadApiWithRun(['{', '{']);
    await assert.rejects(
        () =>
            ai.runJson({
                taskId: 'rehab.weekly',
                messages: [{ role: 'user', content: 'x' }],
                maxTokens: 2000,
                parseOptions: {
                    expected: 'object',
                    requiredKeys: ['actions'],
                    fieldTypes: { actions: 'array' },
                },
            }),
        (err) => {
            const blob = JSON.stringify(err, Object.getOwnPropertyNames(err));
            return (
                err.retryAttempted === true &&
                err.code === 'AI_JSON_PARSE_FAILED' &&
                String(err.aiAttempt?.modelId || '') === 'model-a' &&
                err.body === undefined &&
                err.cause === undefined &&
                !blob.includes('SENSITIVE') &&
                String(err.message || '').includes('重新生成后仍未返回有效 JSON')
            );
        },
    );
    assert.equal(calls.length, 2);
});

test('parseAiJsonPayload pure helper does not expose raw body field', () => {
    const result = aiJsonPure.parseAiJsonPayload('{not-json', {
        expected: 'object',
        requiredKeys: ['actions'],
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'AI_JSON_PARSE_FAILED');
    assert.equal('body' in result, false);
    assert.ok(result.outputLength > 0);
});

function loadProductionAiApi() {
    const sandbox = {
        ai: {
            cfg: {},
            apiKeyFor() {
                return 'key';
            },
            resolveTaskConfig: true,
            getTaskRequestSequence() {
                return [
                    {
                        enabled: true,
                        apiKey: 'key',
                        provider: 'openai',
                        profileId: 'p-main',
                        model: 'model-a',
                        modelId: 'model-a',
                        reasoningDepth: 'medium',
                        route: { fallbackMode: 'manual' },
                    },
                ];
            },
        },
        window: {
            aiRoutingPure: { buildReasoningOptions, isRetryableAiError },
            aiJsonPure: aiJsonPure.default || aiJsonPure,
            toast: { show() {} },
        },
        console,
        TypeError,
        setTimeout,
        clearTimeout,
        TextDecoder,
        AbortController,
    };
    sandbox.aiJsonPure = sandbox.window.aiJsonPure;
    vm.runInNewContext(source, sandbox);
    return { ai: sandbox.ai, sandbox };
}

test('_makeHttpAiError production path sets AI_HTTP_ERROR without raw body', () => {
    const { ai } = loadProductionAiApi();
    const err = ai._makeHttpAiError(502, '{"error":{"message":"provider secret leak"}}');
    assert.equal(err.code, 'AI_HTTP_ERROR');
    assert.equal(err.status, 502);
    assert.equal(err.body, undefined);
    assert.equal(err.bodyLength, String('{"error":{"message":"provider secret leak"}}').length);
    assert.equal(err.message, 'AI 请求失败: HTTP 502');
    assert.doesNotMatch(err.message, /secret|provider secret/i);
});

test('text call() honors timeoutMs and maps AbortError to AI_TIMEOUT', async () => {
    const { ai } = loadProductionAiApi();
    ai._effectiveConfigForRequest = () => ({
        enabled: true,
        apiKey: 'k',
        provider: 'openai',
        model: 'm',
        baseUrl: 'https://example.test',
    });
    // Production call() creates a timeout signal; force it aborted+timedOut before provider call.
    ai._makeTimeoutSignal = () => {
        const signal = {
            aborted: true,
            throwIfAborted() {
                const e = new Error('aborted');
                e.name = 'AbortError';
                throw e;
            },
            addEventListener() {},
            removeEventListener() {},
        };
        return {
            signal,
            wasTimeout: () => true,
            cleanup() {},
        };
    };
    await assert.rejects(
        () => ai.call([{ role: 'user', content: 'hi' }], 100, { timeoutMs: 1000 }),
        (err) => err?.code === 'AI_TIMEOUT' && !String(err?.message || '').includes('secret'),
    );
});
