// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadPlanPolicy() {
    const code = readFileSync(new URL('../rehab-policy.js', import.meta.url), 'utf8');
    const sandbox = { window: {}, console };
    vm.runInNewContext(code, sandbox);
    return sandbox.window.planPolicy;
}

test('bridge names map to one progression chain in the expected order', () => {
    const policy = loadPlanPolicy();
    const basic = policy.actionMetaForName('基础臀桥');
    const brick = policy.actionMetaForName('夹砖臀桥');
    const pelvic = policy.actionMetaForName('骨盆内收夹砖臀桥');

    assert.equal(basic.progressionGroup, 'bridge-adduction');
    assert.equal(brick.progressionGroup, 'bridge-adduction');
    assert.equal(pelvic.progressionGroup, 'bridge-adduction');
    assert.deepEqual([basic.progressionLevel, brick.progressionLevel, pelvic.progressionLevel], [1, 2, 3]);
    assert.equal(policy.itemsMatch('基础臀桥', '夹砖臀桥'), true);
    assert.equal(policy.itemsExactMatch('基础臀桥', '夹砖臀桥'), false);
});

test('conditional single-leg bridge is cautious and needs user confirmation', () => {
    const policy = loadPlanPolicy();
    const action = policy.classifyPrescriptionAction({
        name: '单腿臀桥',
        rawDescription: '如果感觉哪一侧不稳，可以增加单腿臀桥加强'
    });

    assert.equal(action.policyType, 'cautious');
    assert.equal(action.requiresUserConfirm, true);
    assert.equal(action.canAutoAdd, false);
});

test('pressure avoidance notes do not block progressed bridge prescriptions', () => {
    const policy = loadPlanPolicy();
    const action = policy.classifyPrescriptionAction({
        name: '基础臀桥',
        status: 'continued',
        rawDescription: '基础臀桥已按进度进阶为夹砖臀桥，强化骨盆内收控制。请注意左侧大粗隆避免直接受压，穿运动鞋进行站立训练。'
    });
    const blocked = policy.classifyPrescriptionAction({
        name: '夹砖臀桥',
        status: 'continued',
        rawDescription: '避免夹砖臀桥，先暂停该动作。'
    });

    assert.equal(action.policyType, 'preferred');
    assert.equal(action.canonicalName, '夹砖臀桥');
    assert.equal(action.canAutoAdd, true);
    assert.equal(blocked.policyType, 'blocked');
});

test('plan policy keeps AI progressed bridge when safety note says avoid pressure', () => {
    const policy = loadPlanPolicy();
    const db = {
        dailyPlans: [],
        health: {
            rehabWeekly: [{
                weekStart: '2026-06-23',
                actions: [{
                    name: '基础臀桥',
                    status: 'continued',
                    rawDescription: '基础臀桥已按进度进阶为夹砖臀桥，强化骨盆内收控制。请注意左侧大粗隆避免直接受压，穿运动鞋进行站立训练。',
                    spec: { sets: 2, reps: 12, work: 3 }
                }]
            }]
        }
    };
    const policyDebug = [];
    const plans = policy.sanitizeGeneratedPlans([{
        date: '2026-06-23',
        type: 'rehab',
        items: [
            { name: '刷子轻抚阔筋膜张肌感觉激活', category: 'warmup' },
            { name: '泡沫轴放松臀中肌与大腿前外侧', category: 'warmup' },
            { name: '靠墙夹砖闭眼平衡', category: 'main' },
            { name: '单腿站立外展', category: 'main' },
            { name: '夹砖臀桥', category: 'main', spec: { sets: 2, reps: 12, work: 3 } },
            { name: '四肢抬起压毛巾', category: 'main' },
            { name: '髂胫束/阔筋膜张肌拉伸', category: 'cooldown' },
            { name: '臀肌拉伸', category: 'cooldown' }
        ]
    }], {
        db,
        sourcePlans: db.dailyPlans,
        targetDate: '2026-06-23',
        types: ['rehab'],
        ensureTaskShape: (item) => item,
        onDebug: (entry) => policyDebug.push(entry)
    });

    const names = plans[0].items.map((item) => item.name);
    assert.equal(names.length, 8);
    assert.ok(names.includes('夹砖臀桥'));
    assert.equal(names.includes('基础臀桥'), false);
    assert.equal(policyDebug[0].removedBlocked.length, 0);
});

test('plan policy can keep blocked AI candidates for user confirmation', () => {
    const policy = loadPlanPolicy();
    const db = {
        dailyPlans: [],
        health: {
            rehabWeekly: [{
                weekStart: '2026-06-24',
                actions: [{ name: '侧卧夹毛巾抬腿', status: 'dropped', rawDescription: '昨日反馈不适合，暂停该动作' }]
            }]
        }
    };
    const policyDebug = [];
    const plans = policy.sanitizeGeneratedPlans([{
        date: '2026-06-24',
        type: 'rehab',
        items: [{ name: '侧卧夹毛巾抬腿', category: 'main', spec: { sets: 2, reps: 10, work: 3 } }]
    }], {
        db,
        targetDate: '2026-06-24',
        types: ['rehab'],
        ensureTaskShape: (item) => item,
        keepBlockedAsConfirm: true,
        onDebug: (entry) => policyDebug.push(entry)
    });

    const candidate = plans[0].items[0];
    assert.equal(plans[0].items.length, 1);
    assert.equal(candidate.name, '侧卧夹毛巾抬腿');
    assert.equal(candidate.requiresUserConfirm, true);
    assert.equal(candidate.userConfirmed, false);
    assert.equal(candidate.policy.blocked, true);
    assert.match(candidate.aiReasoning, /暂停\/避免记录冲突/);
    assert.equal(policyDebug[0].removedBlocked.length, 0);
    assert.equal(policyDebug[0].keptBlockedForConfirm.length, 1);
});

test('plan policy treats prescription library matches as prescription actions', () => {
    const policy = loadPlanPolicy();
    const db = {
        dailyPlans: [],
        health: {
            rehabWeekly: [],
            prescriptionActions: [{
                id: 'pa-hip-abduction',
                displayName: '侧卧髋外展',
                aliases: ['侧卧髋外展', '弹力带侧卧髋部外展'],
                latestStatus: 'continued',
                defaultSpec: { sets: 3, reps: 12, work: 3 }
            }]
        }
    };

    const plans = policy.sanitizeGeneratedPlans([{
        date: '2026-06-27',
        type: 'rehab',
        items: [{
            name: '弹力带侧卧髋部外展',
            category: 'main',
            spec: { sets: 4, reps: 12, work: 3 },
            aiReasoning: '处方动作强化臀中肌'
        }]
    }], {
        db,
        targetDate: '2026-06-27',
        types: ['rehab'],
        ensureTaskShape: (item) => item
    });

    const item = plans[0].items[0];
    assert.equal(item.policy.source, 'prescription');
    assert.equal(item.requiresUserConfirm, false);
    assert.doesNotMatch(item.aiReasoning, /非医嘱新增动作/);
});

test('plan policy sanitizes oral prescription plans without losing legacy context', () => {
    const policy = loadPlanPolicy();
    const db = {
        dailyPlans: [{
            date: '2026-06-22',
            type: 'rehab',
            items: [
                { name: '基础臀桥', category: 'main', status: 'done', feedback: { rpe: 2, doneAt: 1 }, spec: { sets: 1, reps: 12, work: 5 } },
                { name: '臀中肌泡沫轴放松', category: 'cooldown', status: 'todo', spec: { sets: 1, reps: 1, work: 45 } }
            ]
        }],
        health: {
            rehabWeekly: [{
                weekStart: '2026-06-22',
                rawText: '夹砖臀桥 5秒12次一组，之前的动作都可以继续做，平时需要用泡沫轴放松大腿内侧和臀中肌',
                actions: [
                    { name: '夹砖臀桥', status: 'continued', spec: { sets: 1, reps: 12, work: 5 } },
                    { name: '动态哥本哈根侧桥', status: 'continued', spec: { sets: 1, reps: 12, work: 5 } }
                ]
            }]
        }
    };

    const plans = policy.sanitizeGeneratedPlans([{
        date: '2026-06-23',
        type: 'rehab',
        items: [
            { name: '基础臀桥', category: 'main', spec: { sets: 1, reps: 12, work: 5 } },
            { name: '怪异跳跃', category: 'main', spec: { sets: 3, reps: 20, work: 1 } }
        ]
    }], {
        db,
        sourcePlans: db.dailyPlans,
        targetDate: '2026-06-23',
        types: ['rehab'],
        ensureTaskShape: (item) => item
    });

    const items = plans[0].items;
    assert.equal(policy.buildPlanPolicyContext({ db }).legacyContinueAllowed, true);
    assert.equal(items.some((item) => item.name === '基础臀桥'), false);
    assert.ok(items.find((item) => item.name === '夹砖臀桥'));
    assert.ok(items.find((item) => item.name === '动态哥本哈根侧桥'));
    assert.ok(items.find((item) => item.name === '臀中肌泡沫轴放松'));

    const nonPrescription = items.find((item) => item.name === '怪异跳跃');
    assert.equal(nonPrescription.requiresUserConfirm, true);
    assert.equal(nonPrescription.userConfirmed, false);
    assert.match(nonPrescription.aiReasoning, /非医嘱新增动作/);
});

test('plan policy does not replace user-edited preview actions', () => {
    const policy = loadPlanPolicy();
    const db = {
        dailyPlans: [],
        health: {
            rehabWeekly: [{
                weekStart: '2026-06-24',
                actions: [{ name: '夹砖臀桥', status: 'continued', spec: { sets: 1, reps: 12, work: 5 } }]
            }]
        }
    };

    const plans = policy.sanitizeGeneratedPlans([{
        date: '2026-06-24',
        type: 'rehab',
        items: [{ name: '基础臀桥', category: 'main', userOverride: true, spec: { sets: 1, reps: 12, work: 5 } }]
    }], {
        db,
        targetDate: '2026-06-24',
        types: ['rehab'],
        ensureTaskShape: (item) => item,
        respectUserOverride: true
    });

    const items = plans[0].items;
    assert.ok(items.find((item) => item.name === '基础臀桥' && item.userOverride));
    assert.ok(items.find((item) => item.name === '夹砖臀桥'));
});
