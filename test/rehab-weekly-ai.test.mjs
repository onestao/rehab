// @ts-nocheck
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';
import * as aiJsonPure from '../ai-json-pure.mjs';

async function loadRehabWeeklyHarness(rawOrHandler) {
    const aiSource = await readFile(new URL('../ai-api.js', import.meta.url), 'utf8');
    const profileSource = await readFile(new URL('../health-profile.js', import.meta.url), 'utf8');
    const routingSource = await readFile(new URL('../ai-routing.js', import.meta.url), 'utf8');
    const elements = new Map([
        ['rehabPrescriptionText', { value: '台阶下放 3 组，每组 10 次，本周继续观察疼痛。' }],
        ['rehabWeekStart', { value: '2026-07-06' }],
        ['rehabVisitDate', { value: '2026-07-07' }],
        ['rehabParseBtn', { disabled: false, innerHTML: '' }],
    ]);
    const statuses = [];
    const calls = [];
    const errorReports = [];
    const sandbox = {
        ai: {
            cfg: {
                profiles: [
                    {
                        id: 'p1',
                        name: 'main',
                        provider: 'openai',
                        baseUrl: 'https://x',
                        enabled: true,
                        model: 'm1',
                    },
                ],
                taskRoutes: {},
                model: 'm1',
                provider: 'openai',
                baseUrl: 'https://x',
                activeProfileId: 'p1',
            },
            models: [
                {
                    id: 'm1',
                    profileId: 'p1',
                    displayName: 'M1',
                    capabilities: { text: true, json: true },
                },
            ],
            apiKeyFor() {
                return 'k';
            },
        },
        window: {
            dataAiTemplates: null,
            haptics: { success() {} },
            errorBus: {
                report(scope, err, meta) {
                    errorReports.push({ scope, err, meta });
                },
                event() {},
            },
            aiRoutingPure: null,
            aiJsonPure: aiJsonPure.default || aiJsonPure,
            toast: { show() {} },
        },
        document: {
            getElementById(id) {
                return elements.get(id) || null;
            },
        },
        console,
    };
    sandbox.window.ai = sandbox.ai;
    sandbox.window.aiJsonPure = aiJsonPure.default || aiJsonPure;
    sandbox.aiJsonPure = sandbox.window.aiJsonPure;
    vm.runInNewContext(`${aiSource}\nai;`, sandbox);
    // minimal routing pure stubs so task defs can attach if needed
    sandbox.window.aiRoutingPure = {
        resolveTaskRoute(cfg, taskId, override) {
            return {
                taskId,
                primary: override?.primary || { profileId: 'p1', modelId: 'm1' },
                reasoningDepth: override?.reasoningDepth || 'off',
                fallbackMode: override?.fallbackMode || 'manual',
                fallbacks: override?.fallbacks || [],
            };
        },
        buildFallbackSequence(route) {
            return [route.primary].filter(Boolean);
        },
        isRetryableAiError() {
            return false;
        },
        manualFallbackTarget(v) {
            return v || null;
        },
        requiredCapabilityState() {
            return { status: 'compatible', missing: [], incompatible: [] };
        },
        normalizeTaskRegistry() {
            return {};
        },
    };
    vm.runInNewContext(`${routingSource}`, sandbox);
    sandbox.ai.call = async (messages, maxTokens, opts = {}) => {
        calls.push({ messages, maxTokens, opts });
        if (typeof rawOrHandler === 'function')
            return rawOrHandler({ messages, maxTokens, opts, calls });
        return rawOrHandler;
    };
    // ensure run() uses call with meta for runJson
    sandbox.ai.run = async (options = {}) => {
        const text = await sandbox.ai.call(
            options.messages || [],
            options.maxTokens || 2000,
            options,
        );
        if (options.returnMeta) {
            return {
                text,
                meta: {
                    taskId: options.taskId,
                    profileId: options.routeOverride?.primary?.profileId || 'p1',
                    provider: 'openai',
                    modelId: options.routeOverride?.primary?.modelId || 'm1',
                    reasoningDepth: options.routeOverride?.reasoningDepth || 'off',
                    fallback: { used: false, index: 0, mode: 'manual' },
                },
            };
        }
        return text;
    };
    vm.runInNewContext(`${profileSource}\nwindow.dataHealthProfile;`, sandbox);

    const profile = sandbox.window.dataHealthProfile;
    const host = {
        ...profile,
        db: {
            health: {
                profile: { conditions: [], examResults: [], preferences: {} },
                rehabWeekly: [],
            },
        },
        rehabWeekStart: () => '2026-07-06',
        logicalDateKey: () => '2026-07-07',
        buildRehabActionFingerprint: () => '',
        latestRehabWeekly: () => [],
        setRehabParsePending(pending) {
            const btn = elements.get('rehabParseBtn');
            if (btn) btn.disabled = !!pending;
        },
        setRehabParseStatus(text, type) {
            statuses.push({ text, type });
        },
        renderRehabWeeklyDraft() {},
        openRehabWeeklyStep(id) {
            this._openedRehabStep = id;
        },
        ensureAiRuntime: async () => sandbox.ai,
    };
    return { host, statuses, calls, errorReports, elements, ai: sandbox.ai, routing: sandbox.ai };
}

test('rehab.weekly task definition is registered with local picker and off reasoning', async () => {
    const routingSource = await readFile(new URL('../ai-routing.js', import.meta.url), 'utf8');
    assert.match(routingSource, /id:\s*['"]rehab\.weekly['"]/);
    assert.match(routingSource, /group:\s*['"]康复['"]/);
    assert.match(routingSource, /defaultReasoningDepth:\s*['"]off['"]/);
    assert.match(routingSource, /localPicker:\s*true/);
    assert.match(routingSource, /requiredCapabilities:\s*\[[^\]]*['"]text['"][^\]]*['"]json['"]/);
});

test('rehab weekly sheet markup includes data-ai-task-picker for rehab.weekly', async () => {
    const profileSource = await readFile(new URL('../health-profile.js', import.meta.url), 'utf8');
    assert.match(profileSource, /data-ai-task-picker=["']rehab\.weekly["']/);
    assert.match(profileSource, /rehab-ai-model-control/);
    assert.match(profileSource, /mountInlinePickers/);
});

test('parseRehabWeeklyWithAi uses runJson with rehab.weekly task and shape options', async () => {
    const payload = JSON.stringify({
        weekStart: '2026-07-06',
        visitDate: '2026-07-07',
        actions: [
            {
                name: '台阶下放',
                status: 'continued',
                confidence: 88,
                spec: { sets: 3, reps: 10, mode: 'reps', actionRest: 45 },
            },
        ],
    });
    const { host, statuses, calls } = await loadRehabWeeklyHarness(payload);
    await host.parseRehabWeeklyWithAi();
    // After ensure, patch was on sandbox - re-check via calls from runJson->run->call
    assert.equal(host._rehabWeeklyDraft.actions[0].name, '台阶下放');
    assert.equal(host._openedRehabStep, 'rehabStepDiff');
    assert.equal(statuses.at(-1).type, 'ok');
    assert.ok(calls.length >= 1);
    assert.equal(
        calls[0].opts.taskId || calls[0].maxTokens,
        calls[0].opts.taskId ? 'rehab.weekly' : 4000,
    );
});

test('rehab weekly parser accepts noisy and wrapped AI JSON responses', async () => {
    const cases = [
        '结果：{"weekStart":"2026-07-06","visitDate":"2026-07-07","actions":[{"name":"台阶下放","status":"continued","confidence":88,"spec":{"sets":3,"reps":10,"mode":"reps","actionRest":45}}]}\n调试：{"format":"ok"}',
        '```json\n{"rehabWeekly":{"weekStart":"2026-07-06","visitDate":"2026-07-07","actions":[{"name":"台阶下放","status":"continued","confidence":88,"spec":{"sets":3,"reps":10,"mode":"reps","actionRest":45}}]}}\n```',
    ];

    for (const raw of cases) {
        const { host, statuses } = await loadRehabWeeklyHarness(raw);
        await host.parseRehabWeeklyWithAi();

        assert.equal(host._rehabWeeklyDraft.actions[0].name, '台阶下放');
        assert.equal(host._openedRehabStep, 'rehabStepDiff');
        assert.equal(statuses.at(-1).type, 'ok');
    }
});

test('rehab weekly auto-retry updates status and succeeds without saving partial draft', async () => {
    let n = 0;
    const good = JSON.stringify({
        weekStart: '2026-07-06',
        visitDate: '2026-07-07',
        actions: [
            {
                name: '台阶下放',
                status: 'continued',
                confidence: 90,
                spec: { sets: 3, reps: 10, mode: 'reps' },
            },
        ],
    });
    const { host, statuses, calls, elements } = await loadRehabWeeklyHarness(() => {
        n += 1;
        return n === 1 ? '{"actions":[' : good;
    });
    const inputBefore = elements.get('rehabPrescriptionText').value;
    await host.parseRehabWeeklyWithAi();
    assert.equal(calls.length, 2);
    assert.ok(statuses.some((s) => String(s.text).includes('重新生成')));
    assert.equal(host._rehabWeeklyDraft.actions[0].name, '台阶下放');
    assert.equal(elements.get('rehabPrescriptionText').value, inputBefore);
    assert.equal(elements.get('rehabParseBtn').disabled, false);
});

test('rehab weekly final failure keeps input, clears no draft write, restores button', async () => {
    const { host, statuses, elements, errorReports } = await loadRehabWeeklyHarness(() => '{');
    host._rehabWeeklyDraft = { keep: true, actions: [{ name: 'existing' }] };
    const inputBefore = elements.get('rehabPrescriptionText').value;
    await host.parseRehabWeeklyWithAi();
    assert.equal(elements.get('rehabPrescriptionText').value, inputBefore);
    assert.equal(host._rehabWeeklyDraft.keep, true);
    assert.equal(host._openedRehabStep, undefined);
    assert.equal(elements.get('rehabParseBtn').disabled, false);
    assert.equal(statuses.at(-1).type, 'error');
    assert.ok(errorReports.length >= 1);
    assert.equal(errorReports[0].scope, 'ai-rehab-weekly');
});

test('rehab weekly actions null retries then succeeds', async () => {
    let n = 0;
    const good = JSON.stringify({
        weekStart: '2026-07-06',
        visitDate: '2026-07-07',
        actions: [
            {
                name: '台阶下放',
                status: 'continued',
                confidence: 90,
                spec: { sets: 3, reps: 10, mode: 'reps' },
            },
        ],
    });
    const { host, calls, statuses, elements } = await loadRehabWeeklyHarness(() => {
        n += 1;
        return n === 1 ? JSON.stringify({ actions: null }) : good;
    });
    const inputBefore = elements.get('rehabPrescriptionText').value;
    await host.parseRehabWeeklyWithAi();
    assert.equal(calls.length, 2);
    assert.equal(host._rehabWeeklyDraft.actions[0].name, '台阶下放');
    assert.equal(elements.get('rehabPrescriptionText').value, inputBefore);
    assert.ok(statuses.some((s) => String(s.text).includes('重新生成')));
});

test('rehab weekly errorBus metadata excludes prescription and AI output', async () => {
    const { host, errorReports, elements } = await loadRehabWeeklyHarness(
        () => '{SENSITIVE_AI_OUTPUT_BODY',
    );
    elements.get('rehabPrescriptionText').value = 'SENSITIVE_REHAB_INPUT_XYZ';
    host._rehabWeeklyDraft = { keep: true, actions: [{ name: 'existing' }] };
    await host.parseRehabWeeklyWithAi();
    assert.ok(errorReports.length >= 1);
    const report = errorReports[0];
    const meta = report.meta || {};
    const err = report.err || {};
    const metaBlob = JSON.stringify(meta);
    const errBlob = JSON.stringify(err, Object.getOwnPropertyNames(err));
    const queueBlob = JSON.stringify(errorReports);
    assert.equal(
        Object.keys(meta).sort().join(','),
        ['code', 'finishReason', 'modelId', 'phase', 'retryAttempted'].sort().join(','),
    );
    for (const blob of [metaBlob, errBlob, queueBlob]) {
        assert.equal(blob.includes('SENSITIVE_REHAB_INPUT_XYZ'), false);
        assert.equal(blob.includes('SENSITIVE_AI_OUTPUT_BODY'), false);
        assert.equal(blob.includes('rawSnippet'), false);
        assert.equal(blob.includes('inputSnippet'), false);
        assert.equal(blob.includes('"body"'), false);
        assert.equal(blob.includes('cause'), false);
        assert.equal(blob.includes('prompt'), false);
        assert.equal(blob.includes('response'), false);
    }
    assert.equal(err.body, undefined);
    assert.equal(err.cause, undefined);
    assert.equal(host._rehabWeeklyDraft.keep, true);
});

test('rehab weekly without runJson reports AI_JSON_RUNTIME_UNAVAILABLE and keeps input', async () => {
    const { host, errorReports, elements, statuses } = await loadRehabWeeklyHarness(
        () => '{"actions":[]}',
    );
    const textarea = elements.get('rehabPrescriptionText');
    textarea.value = '虚构动作：台阶下放 3组×10次';
    host._rehabWeeklyDraft = { actions: [{ name: 'existing-draft' }] };
    host.ensureAiRuntime = async () => ({ call: async () => ({ actions: [] }) }); // no runJson
    await host.parseRehabWeeklyWithAi();
    assert.equal(textarea.value, '虚构动作：台阶下放 3组×10次');
    assert.equal(host._rehabWeeklyDraft?.actions?.[0]?.name, 'existing-draft');
    assert.ok(errorReports.length >= 1);
    const report = errorReports[0];
    assert.equal(report.scope, 'ai-rehab-weekly');
    assert.equal(report.err?.code || report.meta?.code, 'AI_JSON_RUNTIME_UNAVAILABLE');
    assert.ok(
        statuses.some((s) => /JSON 运行时|刷新|不可用|解析失败|失败/.test(String(s.text || ''))) ||
            /JSON 运行时|刷新|不可用|解析失败|失败/.test(String(report.err?.message || '')),
    );
});
