// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import actionTaxonomy, { normalizePlanPhase } from '../action-taxonomy-pure.js';

function loadPlanAutoAdjust(options = {}) {
    const policyCode = readFileSync(new URL('../rehab-policy.js', import.meta.url), 'utf8');
    const code = readFileSync(new URL('../plan-auto-adjust.js', import.meta.url), 'utf8');
    const sandbox = {
        window: {
            actionTaxonomy,
            toast: options.toast || { show() {} },
            data: { dateKey: () => '2026-06-23' }
        },
        data: { dateKey: () => '2026-06-23' },
        console
    };
    vm.runInNewContext(policyCode, sandbox);
    vm.runInNewContext(code, sandbox);
    sandbox.window.dataPlanAutoAdjust.__testWindow = sandbox.window;
    return sandbox.window.dataPlanAutoAdjust;
}

function createContext(api, db) {
    let nextId = 1;
    const ctx = {
        ...api,
        db,
        activeRecords(list) {
            return (list || []).filter((item) => item && !item.deleted);
        },
        logicalDateKey() {
            return '2026-06-22';
        },
        dateKey() {
            return '2026-06-22';
        },
        planTypeMeta(type = 'rehab') {
            return { label: type === 'rehab' ? '康复计划' : '训练计划' };
        },
        ensureTaskShape(item = {}, options = {}) {
            const spec = item.spec || {};
            return {
                id: item.id || `task-${nextId++}`,
                name: String(item.name || '未命名任务'),
                planType: item.planType || options.planType || 'rehab',
                category: normalizePlanPhase(item.category),
                spec: {
                    sets: Math.max(1, Number(spec.sets || 1)),
                    reps: Math.max(0, Number(spec.reps || 0)),
                    work: Math.max(0, Number(spec.work || 0)),
                    repRest: Math.max(0, Number(spec.repRest || 0)),
                    actionRest: Math.max(0, Number(spec.actionRest || 0)),
                    isAlt: !!spec.isAlt,
                    ...(spec.mode ? { mode: String(spec.mode) } : {})
                },
                status: ['todo', 'done', 'skipped', 'in-progress'].includes(item.status) ? item.status : 'todo',
                doneSets: Math.max(0, Number(item.doneSets || 0)),
                feedback: item.feedback || null,
                userOverride: !!item.userOverride,
                excludeFromPr: item.excludeFromPr !== false,
                requiresUserConfirm: !!item.requiresUserConfirm,
                userConfirmed: item.requiresUserConfirm ? item.userConfirmed === true : item.userConfirmed !== false,
                actionKey: item.actionKey || '',
                canonicalName: item.canonicalName || '',
                progressionGroup: item.progressionGroup || '',
                progressionLevel: Number(item.progressionLevel || 0),
                chainId: item.chainId || '',
                policy: item.policy || null,
                aiReasoning: String(item.aiReasoning || ''),
                updatedAt: Number(item.updatedAt || 0),
                deleted: !!item.deleted
            };
        },
        ensureDailyPlanShape(plan = {}) {
            const type = plan.type || 'rehab';
            return {
                id: plan.id || `plan-${nextId++}`,
                date: plan.date,
                type,
                title: plan.title || '康复计划',
                source: plan.source || 'ai',
                notes: String(plan.notes || ''),
                items: (plan.items || []).map((item) => ctx.ensureTaskShape({ ...item, planType: type }, { planType: type })),
                deleted: !!plan.deleted
            };
        },
        saveDailyPlan(plan) {
            const index = this.db.dailyPlans.findIndex((item) => item.date === plan.date && (item.type || 'rehab') === (plan.type || 'rehab'));
            if (index >= 0) this.db.dailyPlans[index] = plan;
            else this.db.dailyPlans.unshift(plan);
        },
        save() {
            this.saved = true;
        },
        createPlanAdjustmentBatch(input = {}) {
            const batch = { id: `adj-${(this.db.planAdjustments || []).length + 1}`, ...input };
            this.db.planAdjustments = [batch, ...(this.db.planAdjustments || [])];
            return batch;
        },
        render() {
            this.rendered = true;
        },
        async ensureAutoPlanAiReady() {
            throw new Error('AI parse failed in test');
        }
    };
    return ctx;
}

function doneItem(input) {
    return {
        category: 'main',
        status: 'done',
        doneSets: input.spec?.sets || 1,
        updatedAt: 100,
        feedback: { rpe: input.rpe || 2, note: '', doneAt: input.doneAt || 100 },
        ...input
    };
}

test('auto-adjust fallback preserves recovery structure and respects prescription caution', async () => {
    const toastCalls = [];
    const api = loadPlanAutoAdjust({
        toast: { show: (...args) => toastCalls.push(args) }
    });
    const db = {
        dailyPlans: [{
            id: 'source-plan',
            date: '2026-06-22',
            type: 'rehab',
            title: '康复计划',
            items: [
                doneItem({ name: '髋部热身', category: 'warmup', spec: { sets: 1, reps: 8, work: 3 }, rpe: 1 }),
                doneItem({ name: '单腿站立外展', spec: { sets: 2, reps: 12, work: 3 }, rpe: 2 }),
                doneItem({ name: '靠墙深蹲', spec: { sets: 2, reps: 10, work: 3 }, rpe: 1 }),
                doneItem({ name: '动态哥本哈根侧桥', spec: { sets: 2, reps: 8, work: 5 }, rpe: 1 }),
                { name: '臀中肌泡沫轴放松', category: 'cooldown', status: 'todo', spec: { sets: 1, reps: 1, work: 45 } }
            ]
        }],
        health: {
            rehabWeekly: [{
                weekStart: '2026-06-15',
                actions: [
                    { name: '单腿站立外展', status: 'watch', needsReview: true, confidence: 70, spec: { sets: 2, reps: 12, work: 3 } },
                    { name: '动态哥本哈根侧桥', status: 'dropped', coachNote: '暂停' },
                    { name: '夹砖臀桥', status: 'continued', confidence: 95, spec: { sets: 2, reps: 12, work: 3 } }
                ]
            }]
        }
    };
    const ctx = createContext(api, db);

    const applied = await api.autoAdjustNextDayPlans.call(ctx, { sourceDate: '2026-06-22', targetDate: '2026-06-23' });

    assert.equal(applied, true);
    const plan = db.dailyPlans.find((item) => item.date === '2026-06-23');
    assert.ok(plan);
    assert.equal(db.lastPlanAutoAdjust.fallback, true);
    assert.equal(db.lastPlanAutoAdjust.mode, 'local-fallback');
    assert.match(db.lastPlanAutoAdjust.fallbackReason, /AI parse failed/);
    assert.equal(db.planAdjustments.length, 1);
    assert.equal(db.planAdjustments[0].status, 'applied');
    assert.equal(db.lastPlanAutoAdjust.batchId, db.planAdjustments[0].id);
    const fallbackToast = toastCalls.find(([message]) => /AI 调整失败/.test(message));
    assert.ok(fallbackToast);
    assert.deepEqual(JSON.parse(JSON.stringify(fallbackToast[2].actions.map((action) => action.label))), ['撤销', '重试 AI']);
    let retryOptions = null;
    ctx.autoAdjustNextDayPlans = (retry) => { retryOptions = retry; };
    fallbackToast[2].actions[1].onClick();
    assert.deepEqual(JSON.parse(JSON.stringify(retryOptions)), { sourceDate: '2026-06-22', targetDate: '2026-06-23', force: true });

    const names = Array.from(plan.items.map((item) => item.name));
    assert.deepEqual(names, ['髋部热身', '单腿站立外展', '靠墙深蹲', '夹砖臀桥', '臀中肌泡沫轴放松']);
    assert.equal(names.includes('动态哥本哈根侧桥'), false);

    const warmup = plan.items.find((item) => item.name === '髋部热身');
    assert.equal(warmup.category, 'warmup');
    assert.equal(warmup.spec.sets, 1);
    assert.equal(warmup.spec.reps, 8);
    assert.match(warmup.aiReasoning, /热身动作仅沿用/);

    const cautious = plan.items.find((item) => item.name === '单腿站立外展');
    assert.equal(cautious.spec.sets, 2);
    assert.equal(cautious.spec.reps, 12);
    assert.match(cautious.aiReasoning, /待确认|条件性|不自动加量/);

    const progressed = plan.items.find((item) => item.name === '靠墙深蹲');
    assert.equal(progressed.spec.sets, 3);
    assert.equal(progressed.spec.reps, 12);
    assert.match(progressed.aiReasoning, /太轻/);

    const prescription = plan.items.find((item) => item.name === '夹砖臀桥');
    assert.equal(prescription.category, 'main');
    assert.match(prescription.aiReasoning, /处方动作/);

    const cooldown = plan.items.find((item) => item.name === '臀中肌泡沫轴放松');
    assert.equal(cooldown.category, 'cooldown');
    assert.equal(cooldown.spec.work, 45);
    assert.match(cooldown.aiReasoning, /保留冷却/);
});

test('auto-adjust sanitizer filters blocked actions and caps categories', () => {
    const api = loadPlanAutoAdjust();
    const db = {
        dailyPlans: [],
        health: {
            rehabWeekly: [{
                weekStart: '2026-06-15',
                actions: [
                    { name: '动态哥本哈根侧桥', status: 'dropped', coachNote: '暂停' },
                    { name: '单腿臀桥', status: 'watch', needsReview: true, confidence: 60 }
                ]
            }]
        }
    };
    const ctx = createContext(api, db);
    const plans = api.sanitizeAutoAdjustedPlans.call(ctx, [{
        date: '2026-06-23',
        type: 'rehab',
        items: [
            { name: '动态哥本哈根侧桥', category: 'main', spec: { sets: 2, reps: 8 } },
            { name: '热身1', category: 'warmup', spec: { sets: 1, reps: 8 } },
            { name: '热身2', category: 'warmup', spec: { sets: 1, reps: 8 } },
            { name: '热身3', category: 'warmup', spec: { sets: 1, reps: 8 } },
            { name: '单腿臀桥', category: 'main', spec: { sets: 2, reps: 10 }, aiReasoning: '今日反馈轻松' },
            { name: '主项2', category: 'main', spec: { sets: 2, reps: 10 } },
            { name: '主项3', category: 'main', spec: { sets: 2, reps: 10 } },
            { name: '主项4', category: 'main', spec: { sets: 2, reps: 10 } },
            { name: '主项5', category: 'main', spec: { sets: 2, reps: 10 } },
            { name: '主项6', category: 'main', spec: { sets: 2, reps: 10 } },
            { name: '主项7', category: 'main', spec: { sets: 2, reps: 10 } },
            { name: '放松1', category: 'cooldown', spec: { sets: 1, work: 30 } },
            { name: '放松2', category: 'cooldown', spec: { sets: 1, work: 30 } },
            { name: '放松3', category: 'cooldown', spec: { sets: 1, work: 30 } }
        ]
    }], { sourceDate: '2026-06-22', targetDate: '2026-06-23', types: ['rehab'] });

    assert.equal(plans.length, 1);
    assert.equal(plans[0].items.some((item) => item.name === '动态哥本哈根侧桥'), false);
    assert.equal(plans[0].items.filter((item) => item.category === 'warmup').length, 2);
    assert.equal(plans[0].items.filter((item) => item.category === 'main').length, 6);
    assert.equal(plans[0].items.filter((item) => item.category === 'cooldown').length, 2);
    assert.match(plans[0].items.find((item) => item.name === '单腿臀桥').aiReasoning, /观察|待确认|用户确认|条件性/);
});

test('auto-adjust applies future-only progression suggestion to cloned future task', async () => {
    const api = loadPlanAutoAdjust();
    const db = {
        dailyPlans: [{
            id: 'source-plan',
            date: '2026-06-22',
            type: 'rehab',
            title: '康复计划',
            items: [
                doneItem({
                    name: '基础臀桥',
                    chainId: 'bridge-chain',
                    currentLevel: 1,
                    actionKey: 'bridge-basic',
                    canonicalName: '基础臀桥',
                    progressionGroup: 'bridge-adduction',
                    progressionLevel: 1,
                    spec: { sets: 3, reps: 12, work: 3 },
                    rpe: 1,
                    nextProgressionSuggestion: {
                        appliesTo: 'future-only',
                        decision: 'progress',
                        phase: 'ready-to-progress',
                        targetLevel: 2,
                        targetName: '夹砖臀桥',
                        suggestedSpec: { sets: 3, reps: 12, work: 3 },
                        reason: '连续太轻，建议进入下一阶动作'
                    }
                })
            ]
        }],
        progressionChains: [{
            id: 'bridge-chain',
            levels: [{ lv: 1, name: '基础臀桥' }, { lv: 2, name: '夹砖臀桥' }]
        }],
        health: { rehabWeekly: [] }
    };
    const ctx = createContext(api, db);

    const applied = await api.autoAdjustNextDayPlans.call(ctx, { sourceDate: '2026-06-22', targetDate: '2026-06-23' });

    assert.equal(applied, true);
    assert.equal(db.dailyPlans.find((item) => item.id === 'source-plan').items[0].name, '基础臀桥');
    const plan = db.dailyPlans.find((item) => item.date === '2026-06-23');
    assert.equal(plan.items[0].name, '夹砖臀桥');
    assert.equal(plan.items[0].actionKey, 'bridge-brick');
    assert.equal(plan.items[0].canonicalName, '夹砖臀桥');
    assert.equal(plan.items[0].progressionGroup, 'bridge-adduction');
    assert.equal(plan.items[0].progressionLevel, 2);
    assert.match(plan.items[0].aiReasoning, /下次建议/);
});

test('auto-adjust AI prompt uses confirmed target AI plan as adjustment baseline', async () => {
    const api = loadPlanAutoAdjust();
    const db = {
        dailyPlans: [{
            id: 'source-plan',
            date: '2026-06-22',
            type: 'rehab',
            title: '今日康复计划',
            items: [
                doneItem({ name: '基础臀桥', spec: { sets: 2, reps: 12, work: 3 }, rpe: 4 })
            ]
        }, {
            id: 'target-ai',
            date: '2026-06-23',
            type: 'rehab',
            source: 'ai',
            title: '明日 AI 康复计划',
            items: [{
                id: 'target-task',
                name: '明日侧卧髋外展',
                category: 'main',
                status: 'todo',
                spec: { sets: 2, reps: 12, work: 3 },
                requiresUserConfirm: true,
                userConfirmed: true
            }]
        }],
        health: { rehabWeekly: [] }
    };
    const ctx = createContext(api, db);
    let prompt = '';
    let contextCall = null;
    ctx.buildPlanAiContext = (mode, extra, types, options) => {
        contextCall = { mode, extra, types, options };
        return extra;
    };
    ctx.parsePlanAiPayload = () => ({
        ok: true,
        plans: [{ date: '2026-06-23', type: 'rehab', title: '明日 AI 康复计划', items: [{ name: '明日侧卧髋外展', category: 'main', spec: { sets: 2, reps: 10, work: 3 } }] }]
    });
    api.__testWindow.ai = {
        runStream: async (_taskId, messages) => {
            prompt = messages[1].content;
            return '{}';
        }
    };

    const plans = await api.generateAutoAdjustedPlans.call(ctx, {
        sourceDate: '2026-06-22',
        targetDate: '2026-06-23',
        sourcePlans: [db.dailyPlans[0]],
        types: ['rehab']
    });

    assert.equal(plans.length, 1);
    assert.equal(contextCall.options.targetDate, '2026-06-23');
    assert.match(prompt, /已有已确认AI/);
    assert.match(prompt, /禁整套重写/);
    assert.match(prompt, /目标AI/);
    assert.match(prompt, /明日侧卧髋外展/);
});

test('auto-adjust AI prompt includes surrounding body-part schedule when generating new target plan', async () => {
    const api = loadPlanAutoAdjust();
    const db = {
        dailyPlans: [{
            id: 'past-core',
            date: '2026-06-20',
            type: 'bulk',
            source: 'manual',
            items: [{ name: '平板支撑', category: 'main', status: 'done', spec: { sets: 3, reps: 0, work: 40 } }]
        }, {
            id: 'source-plan',
            date: '2026-06-22',
            type: 'rehab',
            title: '今日康复计划',
            items: [
                doneItem({ name: '靠墙深蹲', spec: { sets: 2, reps: 10, work: 3 }, rpe: 2 })
            ]
        }, {
            id: 'future-upper',
            date: '2026-06-25',
            type: 'bulk',
            source: 'ai',
            items: [{ name: '俯卧撑', category: 'main', status: 'todo', spec: { sets: 3, reps: 12, work: 3 } }]
        }],
        health: { rehabWeekly: [] }
    };
    const ctx = createContext(api, db);
    let prompt = '';
    ctx.buildPlanAiContext = (_mode, extra) => extra;
    ctx.parsePlanAiPayload = () => ({
        ok: true,
        plans: [{ date: '2026-06-23', type: 'rehab', title: '康复计划', items: [{ name: '臀桥', category: 'main', spec: { sets: 2, reps: 12, work: 3 } }] }]
    });
    api.__testWindow.ai = {
        runStream: async (_taskId, messages) => {
            prompt = messages[1].content;
            return '{}';
        }
    };

    await api.generateAutoAdjustedPlans.call(ctx, {
        sourceDate: '2026-06-22',
        targetDate: '2026-06-23',
        sourcePlans: [db.dailyPlans[1]],
        types: ['rehab']
    });

    assert.match(prompt, /无AI基线/);
    assert.match(prompt, /部位排程/);
    assert.match(prompt, /平板支撑/);
    assert.match(prompt, /俯卧撑/);
    assert.match(prompt, /核心\/躯干|上肢推\/肩胸/);
});

test('auto-adjust skips same-type manual target plans', () => {
    const api = loadPlanAutoAdjust();
    const db = {
        dailyPlans: [{
            id: 'manual-target',
            date: '2026-06-23',
            type: 'rehab',
            source: 'manual',
            title: '手工康复计划',
            items: [{
                id: 'manual-task',
                name: '手工臀桥',
                category: 'main',
                status: 'todo',
                actionKey: 'bridge-basic',
                progressionGroup: 'bridge-adduction',
                spec: { sets: 2, reps: 12, work: 3 }
            }]
        }],
        health: { rehabWeekly: [] }
    };
    const ctx = createContext(api, db);

    const applied = api.applyAutoAdjustedPlans.call(ctx, [{
        date: '2026-06-23',
        type: 'rehab',
        title: 'AI 康复计划',
        source: 'ai',
        items: [{
            name: 'AI 替换臀桥',
            category: 'main',
            status: 'todo',
            actionKey: 'bridge-basic',
            progressionGroup: 'bridge-adduction',
            spec: { sets: 3, reps: 12, work: 3 }
        }]
    }], { sourceDate: '2026-06-22', targetDate: '2026-06-23' });

    assert.equal(applied, false);
    assert.equal(db.dailyPlans.length, 1);
    assert.equal(db.dailyPlans[0].source, 'manual');
    assert.deepEqual(JSON.parse(JSON.stringify(db.dailyPlans[0].items.map((item) => item.name))), ['手工臀桥']);
});

test('missed detection returns unfinished unlocked main tasks as carry-over candidates', () => {
    const api = loadPlanAutoAdjust();
    const db = {
        dailyPlans: [{
            id: 'missed-plan',
            date: '2026-06-21',
            type: 'rehab',
            title: '康复计划',
            items: [
                { id: 'todo-1', name: '侧卧髋外展', category: 'main', status: 'todo', spec: { sets: 2, reps: 10, work: 3 }, prescriptionActionId: 'pa-1' },
                { id: 'done-1', name: '基础臀桥', category: 'main', status: 'done', spec: { sets: 2, reps: 10, work: 3 } },
                { id: 'locked-1', name: '锁定动作', category: 'main', status: 'todo', userOverride: true, spec: { sets: 2, reps: 10, work: 3 } },
                { id: 'cooldown-1', name: '泡沫轴放松', category: 'cooldown', status: 'todo', spec: { sets: 1, reps: 1, work: 30 } }
            ]
        }],
        health: { rehabWeekly: [] }
    };
    const ctx = createContext(api, db);

    const candidates = api.detectMissedPlanCandidates.call(ctx, { targetDate: '2026-06-23', types: ['rehab'] });

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].type, 'carry-over');
    assert.equal(candidates[0].risk, 'low');
    assert.equal(candidates[0].sourceTask.taskId, 'todo-1');
    assert.equal(candidates[0].targetTask.date, '2026-06-23');
});
