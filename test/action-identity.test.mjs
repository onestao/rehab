// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    addPrescriptionActionRelation,
    ensurePrescriptionActionCatalog,
    mergePrescriptionActions,
    normalizePrescriptionActionName,
    setPrescriptionActionLinkedAction
} from '../action-identity.js';

test('ensurePrescriptionActionCatalog creates user-visible standard identities', () => {
    const db = {
        health: {
            rehabWeekly: [
                {
                    weekStart: '2026-06-01',
                    actions: [
                        { actionId: 'ra-old', name: '靠墙蹲', status: 'continued', spec: { sets: 3, reps: 0, work: 30 } }
                    ]
                },
                {
                    weekStart: '2026-06-08',
                    actions: [
                        { actionId: 'ra-new', name: '靠墙静蹲', status: 'progressed', progressesFrom: 'ra-old', spec: { sets: 3, reps: 0, work: 40 } }
                    ]
                }
            ],
            prescriptionActions: []
        }
    };

    const catalog = ensurePrescriptionActionCatalog(db, { nowTs: 1000 });

    assert.equal(catalog.length, 2);
    const oldAction = db.health.rehabWeekly[0].actions[0];
    const newAction = db.health.rehabWeekly[1].actions[0];
    assert.ok(oldAction.prescriptionActionId);
    assert.ok(newAction.prescriptionActionId);
    const progressed = catalog.find((item) => item.id === newAction.prescriptionActionId);
    assert.equal(progressed.displayName, '靠墙静蹲');
    assert.deepEqual(progressed.regressionIds, [oldAction.prescriptionActionId]);
});

test('mergePrescriptionActions preserves aliases and rewrites weekly references', () => {
    const db = {
        health: {
            rehabWeekly: [
                { weekStart: '2026-06-01', actions: [{ actionId: 'ra-1', name: '靠墙蹲' }] },
                { weekStart: '2026-06-08', actions: [{ actionId: 'ra-2', name: '靠墙静蹲' }] }
            ],
            prescriptionActions: []
        }
    };
    ensurePrescriptionActionCatalog(db, { nowTs: 1000 });
    const ids = db.health.prescriptionActions.map((item) => item.id);
    const target = mergePrescriptionActions(db, ids[0], [ids[1]], { displayName: '靠墙静蹲', nowTs: 2000 });

    assert.equal(target.displayName, '靠墙静蹲');
    assert.ok(target.aliases.includes('靠墙蹲'));
    assert.ok(target.aliases.includes('靠墙静蹲'));
    assert.equal(db.health.rehabWeekly[0].actions[0].prescriptionActionId, target.id);
    assert.equal(db.health.rehabWeekly[1].actions[0].prescriptionActionId, target.id);
    assert.equal(db.health.prescriptionActions.filter((item) => !item.deleted).length, 1);
});

test('relations and linked library actions stay separate from merge', () => {
    const db = {
        health: {
            prescriptionActions: [
                { id: 'pa-basic', displayName: '基础臀桥' },
                { id: 'pa-brick', displayName: '夹砖臀桥' }
            ],
            rehabWeekly: []
        }
    };

    setPrescriptionActionLinkedAction(db, 'pa-basic', 'lib-bridge', { nowTs: 1000 });
    addPrescriptionActionRelation(db, 'pa-basic', 'pa-brick', 'progression', { nowTs: 1000 });

    const basic = db.health.prescriptionActions.find((item) => item.id === 'pa-basic');
    const brick = db.health.prescriptionActions.find((item) => item.id === 'pa-brick');
    assert.equal(basic.linkedActionId, 'lib-bridge');
    assert.deepEqual(basic.progressionIds, ['pa-brick']);
    assert.deepEqual(brick.regressionIds, ['pa-basic']);
});

test('normalizePrescriptionActionName folds punctuation for search', () => {
    assert.equal(normalizePrescriptionActionName(' 靠墙-静蹲（低角度） '), '靠墙静蹲低角度');
});
