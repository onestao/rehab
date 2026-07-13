// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as aiRoutingPure from '../ai-routing-pure.mjs';
import * as planAiPure from '../plan-ai-pure.mjs';

const planAiSource = readFileSync(new URL('../plan-ai.js', import.meta.url), 'utf8');

function createHarness(options = {}) {
    const promptInput = { value: '保留疼痛反馈，安排轻量训练' };
    const runStreamCalls = [];
    const toastCalls = [];
    let setTaskRouteCalls = 0;
    const ai = {
        call: async () => '',
        runStream: async (...args) => {
            runStreamCalls.push(args);
            return options.runStream?.(...args) ?? '{}';
        },
        setTaskRoute: () => { setTaskRouteCalls += 1; }
    };
    const sandbox = {
        ai,
        console,
        document: {
            getElementById: (id) => id === 'planAiPrompt' ? promptInput : null,
            querySelector: () => null,
            querySelectorAll: () => []
        },
        window: {
            ai,
            actionIdentity: {},
            aiRoutingPure,
            planAiPure,
            planPolicy: { isProtectedPlanTask: () => false },
            toast: { show: (...args) => toastCalls.push(args), sanitize: (error) => String(error?.message || error || '') }
        }
    };
    sandbox.globalThis = sandbox;
    sandbox.toast = sandbox.window.toast;
    vm.createContext(sandbox);
    vm.runInContext(planAiSource, sandbox);
    const data = {
        ...sandbox.window.dataPlanAi,
        _planAiMode: 'today',
        _planAiTypes: ['rehab'],
        _planAiConditionIds: ['condition-knee'],
        _planAiTemporaryConditions: ['上下楼疼痛'],
        _pendingPlanAiPlans: [{ title: '用户编辑中的预览' }],
        db: { dailyPlans: [], history: [], health: {} },
        logicalDateKey: () => '2026-07-12',
        buildPlanAiContext: (mode, prompt) => `${mode}:${prompt}`,
        validatePlanAiPayload: () => ({ ok: true, errors: [] }),
        parsePlanAiPayload: () => ({ ok: true, plans: [{ type: 'rehab', date: '2026-07-12', items: [] }] }),
        previewPlanAiPlans(plans) { this.previewCalls = (this.previewCalls || 0) + 1; this.previewedPlans = plans; },
        setPlanAiPending() {},
        setPlanAiStatus() {}
    };
    return { data, promptInput, routeCalls: runStreamCalls, toastCalls, setTaskRouteCalls: () => setTaskRouteCalls };
}

for (const [mode, taskId] of [['today', 'plan.today'], ['week', 'plan.week']]) {
    test(`${taskId} carries routeOverride through submitPlanAi to ai.runStream`, async () => {
        const harness = createHarness();
        const routeOverride = Object.freeze({ profileId: 'backup-profile', modelId: `backup-${mode}` });
        const originalTypes = [...harness.data._planAiTypes];

        await harness.data.submitPlanAi(mode, { routeOverride });

        assert.equal(harness.routeCalls.length, 1);
        assert.equal(harness.routeCalls[0][0], taskId);
        assert.deepEqual(harness.routeCalls[0][4]?.routeOverride, routeOverride);
        assert.equal(harness.promptInput.value, '保留疼痛反馈，安排轻量训练');
        assert.deepEqual(harness.data._planAiTypes, originalTypes);
        assert.equal(harness.setTaskRouteCalls(), 0);
    });
}

test('plan fallback action retries once with safe target and preserves sheet state', async () => {
    const target = Object.freeze({ profileId: 'backup-profile', modelId: 'backup-plan' });
    let requestCount = 0;
    const harness = createHarness({
        runStream: async () => {
            requestCount += 1;
            if (requestCount === 1) {
                const error = new Error('primary failed');
                error.aiFallback = { taskId: 'plan.today', target };
                throw error;
            }
            return { text: '{}', meta: { taskId: 'plan.today', profileId: target.profileId, modelId: target.modelId } };
        }
    });
    const originalPreview = harness.data._pendingPlanAiPlans;
    const originalTypes = [...harness.data._planAiTypes];
    const originalConditions = [...harness.data._planAiConditionIds];
    const originalTemporaryConditions = [...harness.data._planAiTemporaryConditions];

    await harness.data.submitPlanAi('today');

    assert.equal(harness.data.previewCalls || 0, 0);
    assert.equal(harness.data._pendingPlanAiPlans, originalPreview);
    assert.equal(harness.promptInput.value, '保留疼痛反馈，安排轻量训练');
    assert.deepEqual(harness.data._planAiTypes, originalTypes);
    assert.deepEqual(harness.data._planAiConditionIds, originalConditions);
    assert.deepEqual(harness.data._planAiTemporaryConditions, originalTemporaryConditions);

    const fallbackToast = harness.toastCalls.find(([, type, config]) => type === 'error' && config?.action === '使用备用模型重试');
    const retry = fallbackToast?.[2]?.onAction;
    assert.equal(typeof retry, 'function');

    const firstRetry = retry();
    const duplicateRetry = retry();
    await firstRetry;
    await duplicateRetry;

    assert.equal(harness.routeCalls.length, 2);
    assert.deepEqual(harness.routeCalls[1][4]?.routeOverride, target);
    assert.equal(harness.data.previewCalls, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(harness.data._lastPlanAiMeta)), {
        taskId: 'plan.today',
        profileId: target.profileId,
        modelId: target.modelId
    });
    assert.equal(harness.promptInput.value, '保留疼痛反馈，安排轻量训练');
    assert.deepEqual(harness.data._planAiTypes, originalTypes);
    assert.deepEqual(harness.data._planAiConditionIds, originalConditions);
    assert.deepEqual(harness.data._planAiTemporaryConditions, originalTemporaryConditions);
    assert.equal(harness.setTaskRouteCalls(), 0);
});
