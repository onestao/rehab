// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    PLAN_PREF_DEFAULTS,
    normalizePlanPrefs,
    migratePlanPrefs,
    createDailyPlanRecord,
    upsertDailyPlan,
    getPlanByDate,
    getPlansByDate,
    updateItemStatus,
    addFeedback,
    lockItem,
    completionRate,
    aggregateCompletionRate,
    softDeletePlan,
    cancelDailyPlan,
    normalizeProgressionChain
} from '../plan-store-pure.js';

test('normalizes plan prefs with defaults', () => {
    const prefs = normalizePlanPrefs({
        equipment: ['band', 'band', 'custom_瑜伽砖'],
        customEquipment: [
            { id: 'custom_瑜伽砖', label: '瑜伽砖' },
            { id: 'custom_瑜伽砖', label: '瑜伽砖重复' }
        ],
        showWeeklyDock: false
    });
    assert.deepEqual(prefs, {
        ...PLAN_PREF_DEFAULTS,
        equipment: ['band', 'custom_瑜伽砖'],
        customEquipment: [{ id: 'custom_瑜伽砖', label: '瑜伽砖', icon: 'inventory_2' }],
        showWeeklyDock: false
    });
});

test('create and fetch daily plan by date', () => {
    const plan = createDailyPlanRecord({
        id: 'plan-1',
        date: '2026-05-24',
        items: [{ id: 'task-1', name: '桥式', spec: { sets: 3, reps: 12 }, chainId: 'chain-1', progressionHistory: [{ rpe: 2, doneAt: 100 }] }]
    }, { nowTs: 100 });
    const list = upsertDailyPlan([], plan, { nowTs: 100 });
    assert.equal(list.length, 1);
    const fetched = getPlanByDate(list, '2026-05-24');
    assert.equal(fetched.id, 'plan-1');
    assert.equal(fetched.items[0].chainId, 'chain-1');
    assert.deepEqual(fetched.items[0].progressionHistory, [{ rpe: 2, doneAt: 100 }]);
});

test('update item status marks completion and keeps metadata', () => {
    const plan = createDailyPlanRecord({
        id: 'plan-1',
        date: '2026-05-24',
        items: [{ id: 'task-1', name: '桥式', spec: { sets: 3, reps: 12 } }]
    }, { nowTs: 100 });
    const { plans, changed } = updateItemStatus([plan], 'plan-1', 'task-1', 'done', {}, { nowTs: 200 });
    assert.equal(changed.after.status, 'done');
    assert.equal(changed.after.doneSets, 3);
    assert.equal(plans[0].updatedAt, 200);
});

test('add feedback writes nested feedback payload', () => {
    const plan = createDailyPlanRecord({
        id: 'plan-1',
        date: '2026-05-24',
        items: [{ id: 'task-1', name: '桥式', spec: { sets: 3, reps: 12 } }]
    }, { nowTs: 100 });
    const { plans } = addFeedback([plan], 'plan-1', 'task-1', { rpe: 3, note: '可控', doneAt: 300 }, { nowTs: 300 });
    assert.deepEqual(plans[0].items[0].feedback, { rpe: 3, note: '可控', doneAt: 300 });
});

test('lock item sets user override flag', () => {
    const plan = createDailyPlanRecord({
        id: 'plan-1',
        date: '2026-05-24',
        items: [{ id: 'task-1', name: '桥式', spec: { sets: 3, reps: 12 } }]
    }, { nowTs: 100 });
    const { plans } = lockItem([plan], 'plan-1', 'task-1', true, { nowTs: 400 });
    assert.equal(plans[0].items[0].userOverride, true);
});

test('completion rate excludes cooldown items', () => {
    const plan = createDailyPlanRecord({
        id: 'plan-1',
        date: '2026-05-24',
        items: [
            { id: 'task-1', name: '桥式', status: 'done', spec: { sets: 3, reps: 12 } },
            { id: 'task-2', name: '放松', category: 'cooldown', status: 'todo', spec: { sets: 1, work: 30 } }
        ]
    }, { nowTs: 100 });
    assert.deepEqual(completionRate(plan), { done: 1, total: 1, rate: 1 });
});

test('normalizes warmup main and cooldown categories', () => {
    const plan = createDailyPlanRecord({
        id: 'plan-1',
        date: '2026-05-24',
        items: [
            { id: 'task-1', name: '动态热身', category: 'warmup', spec: { sets: 1, work: 60 } },
            { id: 'task-2', name: '深蹲', category: 'main', spec: { sets: 3, reps: 10 } },
            { id: 'task-3', name: '股四头肌拉伸', category: 'stretching', spec: { sets: 1, work: 30 } }
        ]
    }, { nowTs: 100 });
    assert.deepEqual(plan.items.map((item) => item.category), ['warmup', 'main', 'cooldown']);
});

test('soft delete plan keeps record but marks deleted', () => {
    const plan = createDailyPlanRecord({ id: 'plan-1', date: '2026-05-24' }, { nowTs: 100 });
    const plans = softDeletePlan([plan], 'plan-1', { nowTs: 500 });
    assert.equal(plans[0].deleted, true);
    assert.equal(plans[0].updatedAt, 500);
});

test('cancel daily plan soft deletes and clears pending cooldowns', () => {
    const plan = createDailyPlanRecord({
        id: 'plan-1',
        date: '2026-05-24',
        pendingCooldowns: ['task-1'],
        items: [{ id: 'task-1', name: '拉伸', category: 'cooldown', spec: { sets: 1, work: 30 } }]
    }, { nowTs: 100 });
    const plans = cancelDailyPlan([plan], 'plan-1', { nowTs: 500 });
    assert.equal(plans[0].deleted, true);
    assert.deepEqual(plans[0].pendingCooldowns, []);
    assert.equal(plans[0].updatedAt, 500);
});

test('normalize progression chain keeps required equipment arrays', () => {
    const chain = normalizeProgressionChain({
        id: 'chain-1',
        group: '桥式',
        levels: [{ lv: 1, name: '桥式', requiredEquipment: ['band', 'band'] }]
    }, { nowTs: 100 });
    assert.deepEqual(chain.levels[0].requiredEquipment, ['band']);
});

test('same date allows different plan types without overwriting', () => {
    const rehab = createDailyPlanRecord({ id: 'plan-rehab', date: '2026-05-24', type: 'rehab' }, { nowTs: 100 });
    const bulk = createDailyPlanRecord({ id: 'plan-bulk', date: '2026-05-24', type: 'bulk' }, { nowTs: 100 });
    const list = upsertDailyPlan(upsertDailyPlan([], rehab, { nowTs: 100 }), bulk, { nowTs: 101 });
    assert.equal(list.length, 2);
    assert.deepEqual(getPlansByDate(list, '2026-05-24').map((plan) => plan.type).sort(), ['bulk', 'rehab']);
    assert.equal(getPlanByDate(list, '2026-05-24').date, '2026-05-24');
});

test('legacy prefs.rehab migrates to prefs.plan idempotently', () => {
    const migrated = migratePlanPrefs({ prefs: { rehab: { equipment: ['band'], stage: 'post_op_4w' } } });
    assert.equal(migrated.prefs.rehab, undefined);
    assert.deepEqual(migrated.prefs.plan.equipment, ['band']);
    const again = migratePlanPrefs(migrated);
    assert.deepEqual(again, migrated);
});

test('legacy rehab-center source becomes manual rehab plan', () => {
    const plan = createDailyPlanRecord({ id: 'legacy', date: '2026-05-24', source: 'rehab-center' }, { nowTs: 100 });
    assert.equal(plan.source, 'manual');
    assert.equal(plan.type, 'rehab');
});

test('aggregate completion summarizes multiple plans', () => {
    const rehab = createDailyPlanRecord({
        id: 'plan-rehab',
        type: 'rehab',
        items: [{ id: 'task-1', status: 'done', spec: { sets: 1, reps: 1 } }]
    }, { nowTs: 100 });
    const bulk = createDailyPlanRecord({
        id: 'plan-bulk',
        type: 'bulk',
        items: [{ id: 'task-2', status: 'todo', spec: { sets: 1, reps: 1 } }]
    }, { nowTs: 100 });
    assert.deepEqual(aggregateCompletionRate([rehab, bulk]), { done: 1, total: 2, rate: 0.5 });
});
