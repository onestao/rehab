// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { manualFallbackTarget } from '../ai-routing-pure.mjs';

const aiApiSource = readFileSync(new URL('../ai-api.js', import.meta.url), 'utf8');
const goalPlanSource = readFileSync(new URL('../goal-plan.js', import.meta.url), 'utf8');

const validPlan = Object.freeze({
    fast: { weeklyLoss: 0.8 },
    moderate: { weeklyLoss: 0.5 },
    slow: { weeklyLoss: 0.25 },
    tips: ['保持记录']
});

function createHarness() {
    const fields = {
        planCurrentWeight: { value: '80' },
        planTargetWeight: { value: '72' },
        planHeight: { value: '178' },
        planActivity: { value: 'moderate' },
        planTrainMin: { value: '45' },
        planWeeklyFreq: { value: '4' },
        planIntensity: { value: 'moderate' },
        planSportType: { value: 'mixed' },
        planExperience: { value: 'intermediate' },
        planStatus: { textContent: '待生成' }
    };
    const toastCalls = [];
    const alerts = [];
    const toast = {
        sanitize: (error) => String(error?.message || error || ''),
        show: (...args) => toastCalls.push(args)
    };
    const sandbox = {
        ai: {},
        alert: (message) => alerts.push(message),
        console,
        document: { getElementById: (id) => fields[id] || null },
        window: {
            aiRoutingPure: { manualFallbackTarget },
            data: { db: {} },
            dataAiTemplates: null,
            toast
        }
    };
    sandbox.globalThis = sandbox;
    sandbox.toast = toast;
    vm.createContext(sandbox);
    vm.runInContext(aiApiSource, sandbox);
    vm.runInContext(goalPlanSource, sandbox);
    sandbox.window.ai = sandbox.ai;

    let saveCalls = 0;
    let renderCalls = 0;
    const data = {
        ...sandbox.window.dataGoalPlan,
        db: { health: { goalType: 'loss', profile: {}, weights: [] } },
        save() { saveCalls += 1; },
        renderHistory() { renderCalls += 1; }
    };
    return {
        sandbox,
        data,
        fields,
        toastCalls,
        alerts,
        saveCalls: () => saveCalls,
        renderCalls: () => renderCalls
    };
}

test('goal.body carries a safe request-scoped override without changing result shape or saved route', async () => {
    const harness = createHarness();
    const runCalls = [];
    let setTaskRouteCalls = 0;
    harness.sandbox.ai.resolveTaskConfig = () => ({ enabled: true });
    harness.sandbox.ai.setTaskRoute = () => { setTaskRouteCalls += 1; };
    harness.sandbox.ai.run = async (options) => {
        runCalls.push(options);
        return JSON.stringify(validPlan);
    };

    const routeOverride = Object.freeze({ profileId: ' backup-profile ', modelId: ' backup-goal ', apiKey: 'secret' });
    await harness.data.requestWeightLossPlan({ routeOverride });

    assert.equal(runCalls.length, 1);
    assert.equal(runCalls[0].taskId, 'goal.body');
    assert.deepEqual(JSON.parse(JSON.stringify(runCalls[0].routeOverride)), {
        profileId: 'backup-profile',
        modelId: 'backup-goal'
    });
    assert.doesNotMatch(JSON.stringify(runCalls[0].routeOverride), /secret|apiKey/);
    assert.match(runCalls[0].messages[1].content, /当前体重：80 kg/);
    assert.equal(harness.data.db.health.bodyPlan.fast.weeklyLoss, 0.8);
    assert.equal(harness.data.db.health.bodyPlan.fast.pace, 'fast');
    assert.deepEqual(Array.from(harness.data.db.health.bodyPlan.tips), ['保持记录']);
    assert.equal(harness.saveCalls(), 1);
    assert.equal(harness.renderCalls(), 1);
    assert.equal(setTaskRouteCalls, 0);
});

test('weightLossPlan forwards backward-compatible request options to bodyGoalPlan', async () => {
    const harness = createHarness();
    const params = { currentWeight: 80, targetWeight: 72 };
    const options = { routeOverride: { profileId: 'profile', modelId: 'model' } };
    let received = null;
    harness.sandbox.ai.bodyGoalPlan = async (...args) => {
        received = args;
        return validPlan;
    };

    const result = await harness.sandbox.ai.weightLossPlan(params, options);

    assert.equal(received[0].goalType, 'loss');
    assert.equal(received[0].currentWeight, 80);
    assert.equal(received[1], options);
    assert.equal(result, validPlan);
});

test('goal.body fallback action retries once with current form values and never persists the route', async () => {
    const harness = createHarness();
    const runCalls = [];
    let setTaskRouteCalls = 0;
    const target = { profileId: ' backup-profile ', modelId: ' backup-goal ', token: 'secret' };
    harness.sandbox.ai.resolveTaskConfig = () => ({ enabled: true });
    harness.sandbox.ai.setTaskRoute = () => { setTaskRouteCalls += 1; };
    harness.sandbox.ai.run = async (options) => {
        runCalls.push(options);
        if (runCalls.length === 1) {
            const error = new Error('temporary');
            error.aiFallback = { taskId: 'goal.body', target };
            throw error;
        }
        return JSON.stringify(validPlan);
    };

    await harness.data.requestWeightLossPlan();
    const action = harness.toastCalls.at(-1)?.[3];
    assert.equal(action?.label, '使用备用模型重试');

    harness.fields.planCurrentWeight.value = '79';
    harness.fields.planTargetWeight.value = '70';
    harness.fields.planHeight.value = '176';
    const firstRetry = action.onClick();
    const secondRetry = action.onClick();
    assert.equal(firstRetry, secondRetry);
    await firstRetry;

    assert.equal(runCalls.length, 2);
    assert.deepEqual(JSON.parse(JSON.stringify(runCalls[1].routeOverride)), {
        profileId: 'backup-profile',
        modelId: 'backup-goal'
    });
    assert.match(runCalls[1].messages[1].content, /当前体重：79 kg/);
    assert.match(runCalls[1].messages[1].content, /目标体重：70 kg/);
    assert.match(runCalls[1].messages[1].content, /身高：176 cm/);
    assert.equal(harness.data.db.health.bodyPlan.meta.currentWeight, 79);
    assert.equal(harness.data.db.health.bodyPlan.meta.targetWeight, 70);
    assert.equal(harness.saveCalls(), 1);
    assert.equal(setTaskRouteCalls, 0);
});

test('goal.body JSON parse failure may expose only its configured safe manual fallback', async () => {
    const harness = createHarness();
    const runCalls = [];
    let setTaskRouteCalls = 0;
    harness.sandbox.ai.resolveTaskConfig = () => ({ enabled: true });
    harness.sandbox.ai.setTaskRoute = () => { setTaskRouteCalls += 1; };
    harness.sandbox.ai.getTaskRoute = (taskId) => {
        assert.equal(taskId, 'goal.body');
        return {
            fallbackMode: 'manual',
            fallbacks: [{ profileId: ' parsed-profile ', modelId: ' parsed-backup ', apiKey: 'secret' }]
        };
    };
    harness.sandbox.ai.run = async (options) => {
        runCalls.push(options);
        return runCalls.length === 1 ? 'not valid JSON' : JSON.stringify(validPlan);
    };

    await harness.data.requestWeightLossPlan();
    const action = harness.toastCalls.at(-1)?.[3];
    assert.equal(action?.label, '使用备用模型重试');
    await action.onClick();

    assert.equal(runCalls.length, 2);
    assert.deepEqual(JSON.parse(JSON.stringify(runCalls[1].routeOverride)), {
        profileId: 'parsed-profile',
        modelId: 'parsed-backup'
    });
    assert.equal(setTaskRouteCalls, 0);
    assert.equal(harness.saveCalls(), 1);
});

test('bodyGoalPlan gives structured JSON failures an explicit code and safe goal fallback', async () => {
    const harness = createHarness();
    harness.sandbox.ai.resolveTaskConfig = () => ({ enabled: true });
    harness.sandbox.ai.getTaskRoute = () => ({
        fallbackMode: 'manual',
        fallbacks: [{ profileId: ' profile ', modelId: ' model ', headers: { Authorization: 'secret' } }]
    });
    harness.sandbox.ai.run = async () => '{"tips": [}';

    await assert.rejects(
        harness.sandbox.ai.bodyGoalPlan({
            currentWeight: 80,
            targetWeight: 72,
            activityLevel: 'moderate',
            dailyTrainMin: 45,
            weeklyFreq: 4,
            intensity: 'moderate',
            sportType: 'mixed'
        }),
        (error) => {
            assert.equal(error.code, 'AI_JSON_PARSE_FAILED');
            assert.deepEqual(JSON.parse(JSON.stringify(error.aiFallback)), {
                taskId: 'goal.body',
                target: { profileId: 'profile', modelId: 'model' }
            });
            assert.doesNotMatch(JSON.stringify(error.aiFallback), /secret|headers|Authorization/);
            return true;
        }
    );
});

test('goal.body rejects unsafe or cross-task fallback targets', async () => {
    for (const aiFallback of [
        { taskId: 'food.text', target: { profileId: 'profile', modelId: 'model' } },
        { taskId: 'goal.body', target: Object.create({ profileId: 'profile', modelId: 'model' }) },
        { taskId: 'goal.body', target: { profileId: 'profile', modelId: 'model', constructor: 'polluted' } }
    ]) {
        const harness = createHarness();
        harness.sandbox.ai.resolveTaskConfig = () => ({ enabled: true });
        harness.sandbox.ai.run = async () => {
            const error = new Error('temporary');
            error.aiFallback = aiFallback;
            throw error;
        };

        await harness.data.requestWeightLossPlan();

        assert.equal(harness.toastCalls.length, 0);
        assert.equal(harness.alerts.length, 1);
        assert.equal(harness.saveCalls(), 0);
    }
});

