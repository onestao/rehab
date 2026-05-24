// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    REHAB_PREF_DEFAULTS,
    normalizeRehabPrefs,
    createDailyPlanRecord,
    upsertDailyPlan,
    getPlanByDate,
    updateItemStatus,
    addFeedback,
    lockItem,
    completionRate,
    softDeletePlan,
    normalizeProgressionChain
} from '../rehab-store-pure.js';

test('normalizes rehab prefs with defaults', () => {
    const prefs = normalizeRehabPrefs({ equipment: ['band', 'band'], showWeeklyDock: false });
    assert.deepEqual(prefs, {
        ...REHAB_PREF_DEFAULTS,
        equipment: ['band'],
        showWeeklyDock: false
    });
});

test('create and fetch daily plan by date', () => {
    const plan = createDailyPlanRecord({
        id: 'plan-1',
        date: '2026-05-24',
        items: [{ id: 'task-1', name: '桥式', spec: { sets: 3, reps: 12 } }]
    }, { nowTs: 100 });
    const list = upsertDailyPlan([], plan, { nowTs: 100 });
    assert.equal(list.length, 1);
    assert.equal(getPlanByDate(list, '2026-05-24').id, 'plan-1');
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

test('soft delete plan keeps record but marks deleted', () => {
    const plan = createDailyPlanRecord({ id: 'plan-1', date: '2026-05-24' }, { nowTs: 100 });
    const plans = softDeletePlan([plan], 'plan-1', { nowTs: 500 });
    assert.equal(plans[0].deleted, true);
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
