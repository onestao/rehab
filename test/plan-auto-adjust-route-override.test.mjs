// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const policySource = readFileSync(new URL('../rehab-policy.js', import.meta.url), 'utf8');
const autoAdjustSource = readFileSync(new URL('../plan-auto-adjust.js', import.meta.url), 'utf8');

function loadAutoAdjust(toastCalls = [], runStreamCalls = []) {
    let setTaskRouteCalls = 0;
    const sandbox = {
        console,
        window: {
            ai: {
                runStream: async (...args) => {
                    runStreamCalls.push(args);
                    return '{}';
                },
                setTaskRoute: () => { setTaskRouteCalls += 1; }
            },
            aiRoutingPure: {
                manualFallbackTarget(value) {
                    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
                    const profile = Object.getOwnPropertyDescriptor(value, 'profileId');
                    const model = Object.getOwnPropertyDescriptor(value, 'modelId');
                    if (!profile || !model || !('value' in profile) || !('value' in model)) return null;
                    const profileId = typeof profile.value === 'string' ? profile.value.trim() : '';
                    const modelId = typeof model.value === 'string' ? model.value.trim() : '';
                    if (!profileId || !modelId || [...profileId, ...modelId].some((character) => {
                        const code = character.charCodeAt(0);
                        return code < 32 || code === 127;
                    })) return null;
                    return Object.freeze({ profileId, modelId });
                }
            },
            data: { dateKey: () => '2026-07-12' },
            toast: { show: (...args) => toastCalls.push(args) }
        }
    };
    sandbox.data = sandbox.window.data;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(policySource, sandbox);
    vm.runInContext(autoAdjustSource, sandbox);
    return {
        api: sandbox.window.dataPlanAutoAdjust,
        sandbox,
        setTaskRouteCalls: () => setTaskRouteCalls
    };
}

function completedSourcePlan() {
    return {
        id: 'source-plan',
        date: '2026-07-12',
        type: 'rehab',
        items: [{
            id: 'done-task',
            name: '靠墙深蹲',
            category: 'main',
            status: 'done',
            doneSets: 2,
            spec: { sets: 2, reps: 10, work: 3 },
            feedback: { rpe: 2, doneAt: 100 },
            updatedAt: 100
        }]
    };
}

test('plan.adjust carries routeOverride to ai.runStream while rebuilding from current state', async () => {
    const runStreamCalls = [];
    const { api, setTaskRouteCalls } = loadAutoAdjust([], runStreamCalls);
    const routeOverride = Object.freeze({ profileId: 'backup-profile', modelId: 'backup-adjust' });
    const sourcePlans = [completedSourcePlan()];
    const ctx = {
        ...api,
        db: { dailyPlans: [], health: { rehabWeekly: [] } },
        activeRecords: (list) => (list || []).filter((item) => item && !item.deleted),
        buildFeedbackHistory: () => [],
        buildPlanAiContext: () => 'CURRENT_STATE_MARKER',
        parsePlanAiPayload: () => ({ ok: true, plans: [{ type: 'rehab', date: '2026-07-13', items: [] }] })
    };

    await api.generateAutoAdjustedPlans.call(ctx, {
        sourceDate: '2026-07-12',
        targetDate: '2026-07-13',
        sourcePlans,
        types: ['rehab'],
        routeOverride
    });

    assert.equal(runStreamCalls.length, 1);
    assert.equal(runStreamCalls[0][0], 'plan.adjust');
    assert.deepEqual(runStreamCalls[0][4]?.routeOverride, routeOverride);
    assert.match(runStreamCalls[0][1][1].content, /CURRENT_STATE_MARKER/);
    assert.equal(setTaskRouteCalls(), 0);
});

test('plan.adjust fallback action retries with its target and does not persist the route', async () => {
    const toastCalls = [];
    const { api, sandbox, setTaskRouteCalls } = loadAutoAdjust(toastCalls);
    const target = Object.freeze({ profileId: 'backup-profile', modelId: 'backup-adjust' });
    const sourcePlan = completedSourcePlan();
    const db = { dailyPlans: [sourcePlan], health: { rehabWeekly: [] } };
    const ctx = {
        ...api,
        db,
        activeRecords: (list) => (list || []).filter((item) => item && !item.deleted),
        logicalDateKey: () => '2026-07-12',
        ensureAutoPlanAiReady: async () => {},
        generateAutoAdjustedPlans: async () => {
            const error = new Error('primary failed');
            error.aiFallback = { taskId: 'plan.adjust', target };
            throw error;
        },
        sanitizeAutoAdjustedPlans: (plans) => plans,
        applyAutoAdjustedPlans: () => true
    };

    await api.autoAdjustNextDayPlans.call(ctx, { sourceDate: '2026-07-12', targetDate: '2026-07-13' });
    const fallbackToast = toastCalls.find(([message]) => /AI 调整失败/.test(message));
    const retryAction = fallbackToast?.[2]?.actions?.find((action) => action.label === '重试 AI');
    let retryOptions = null;
    ctx.autoAdjustNextDayPlans = (options) => { retryOptions = options; };
    retryAction?.onClick();

    assert.ok(retryAction);
    assert.deepEqual(JSON.parse(JSON.stringify(retryOptions)), {
        sourceDate: '2026-07-12',
        targetDate: '2026-07-13',
        force: true,
        routeOverride: target
    });
    assert.equal(db.dailyPlans[0], sourcePlan);
    assert.equal(setTaskRouteCalls(), 0);
    assert.equal(sandbox.window.ai.setTaskRoute !== undefined, true);
});

test('plan.adjust retry re-reads dates, source feedback and protected target state without duplicate writes', async () => {
    const toastCalls = [];
    const { api, sandbox, setTaskRouteCalls } = loadAutoAdjust(toastCalls);
    const target = { profileId: ' backup-profile ', modelId: ' backup-adjust ', apiKey: 'must-not-propagate' };
    const firstSource = completedSourcePlan();
    const db = { dailyPlans: [firstSource], health: { rehabWeekly: [] }, planAdjustments: [] };
    let logicalDate = '2026-07-12';
    let readyCalls = 0;
    let generationCalls = 0;
    const observations = [];
    const ctx = {
        ...api,
        db,
        activeRecords: (list) => (list || []).filter((item) => item && !item.deleted),
        logicalDateKey: () => logicalDate,
        ensureAutoPlanAiReady: async () => { readyCalls += 1; },
        generateAutoAdjustedPlans: async (options) => {
            generationCalls += 1;
            observations.push({
                sourceDate: options.sourceDate,
                targetDate: options.targetDate,
                routeOverride: options.routeOverride,
                sourceIds: options.sourcePlans.map((plan) => plan.id),
                targetItems: (db.dailyPlans.find((plan) => plan.date === options.targetDate)?.items || []).map((item) => item.name)
            });
            if (generationCalls === 1) {
                const error = new Error('primary failed');
                error.aiFallback = { taskId: 'plan.adjust', target };
                throw error;
            }
            return [{
                date: options.targetDate,
                type: 'bulk',
                source: 'ai',
                title: 'AI 明日计划',
                items: [{ name: 'AI 新动作', category: 'main', spec: { sets: 2, reps: 8, work: 3 } }]
            }];
        },
        sanitizeAutoAdjustedPlans: (plans) => plans,
        ensureTaskShape: (item) => ({ ...item, status: item.status || 'todo', spec: item.spec || {} }),
        ensureDailyPlanShape: (plan) => ({ ...plan, items: (plan.items || []).map((item) => ctx.ensureTaskShape(item)) }),
        saveDailyPlan(plan) {
            const index = db.dailyPlans.findIndex((item) => item.date === plan.date && (item.type || 'rehab') === (plan.type || 'rehab'));
            if (index >= 0) db.dailyPlans[index] = plan;
            else db.dailyPlans.push(plan);
        },
        createPlanAdjustmentBatch(input) {
            const batch = { id: `batch-${db.planAdjustments.length + 1}`, ...input };
            db.planAdjustments.push(batch);
            return batch;
        },
        save() {},
        render() {}
    };

    await api.autoAdjustNextDayPlans.call(ctx, { reason: 'training-complete' });
    const fallbackToast = toastCalls.find(([message]) => /AI 调整失败/.test(message));
    const retryAction = fallbackToast?.[2]?.actions?.find((action) => action.label === '重试 AI');

    logicalDate = '2026-07-13';
    db.dailyPlans.push({
        ...completedSourcePlan(),
        id: 'fresh-source',
        date: '2026-07-13',
        type: 'bulk',
        items: [{ ...completedSourcePlan().items[0], name: '新反馈动作', feedback: { rpe: 5, doneAt: 200 } }]
    });
    db.dailyPlans.push({
        id: 'fresh-target',
        date: '2026-07-14',
        type: 'bulk',
        source: 'ai',
        items: [{ name: '用户刚锁定动作', category: 'main', userOverride: true, spec: { sets: 1, reps: 6, work: 3 } }]
    });

    const retryPromise = retryAction?.onClick();
    const duplicateResult = retryAction?.onClick();
    await retryPromise;

    assert.equal(duplicateResult, null);
    assert.equal(readyCalls, 2);
    assert.equal(generationCalls, 2);
    assert.deepEqual(observations[1], {
        sourceDate: '2026-07-13',
        targetDate: '2026-07-14',
        routeOverride: { profileId: 'backup-profile', modelId: 'backup-adjust' },
        sourceIds: ['fresh-source'],
        targetItems: ['用户刚锁定动作']
    });
    const targetPlan = db.dailyPlans.find((plan) => plan.id === 'fresh-target');
    assert.deepEqual(JSON.parse(JSON.stringify(targetPlan.items.map((item) => item.name))), ['用户刚锁定动作', 'AI 新动作']);
    assert.equal(db.planAdjustments.length, 2);
    assert.equal(setTaskRouteCalls(), 0);
    assert.equal(sandbox.window.ai.setTaskRoute !== undefined, true);
});
