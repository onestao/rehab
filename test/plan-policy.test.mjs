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
