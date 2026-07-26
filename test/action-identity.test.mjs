// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import actionTaxonomy from '../action-taxonomy-pure.js';
import {
    addPrescriptionActionRelation,
    ensurePrescriptionActionCatalog,
    mergePrescriptionActions,
    normalizePrescriptionActionName,
    setPrescriptionActionLinkedAction
} from '../action-identity.js';

function categoryDb(category) {
    return {
        health: {
            rehabWeekly: [
                { weekStart: '2026-07-20', actions: [{ actionId: 'ra-1', name: '夹砖臀桥', category }] }
            ],
            prescriptionActions: []
        }
    };
}

test('处方 category：taxonomy 可用时归一化且幂等，识别不了保留原文', () => {
    globalThis.window = { actionTaxonomy };
    try {
        const db = categoryDb('力量');
        ensurePrescriptionActionCatalog(db, { nowTs: 1000 });
        assert.equal(db.health.prescriptionActions[0].category, 'training');
        ensurePrescriptionActionCatalog(db, { nowTs: 2000 });
        assert.equal(db.health.prescriptionActions[0].category, 'training');

        const rawDb = categoryDb('医生手写的特殊分类');
        ensurePrescriptionActionCatalog(rawDb, { nowTs: 1000 });
        assert.equal(rawDb.health.prescriptionActions[0].category, '医生手写的特殊分类');
    } finally {
        delete globalThis.window;
    }
});

test('处方 category：无 taxonomy 环境保持原文，不抛错', () => {
    const db = categoryDb('力量');
    ensurePrescriptionActionCatalog(db, { nowTs: 1000 });
    assert.equal(db.health.prescriptionActions[0].category, '力量');
});

function progressionDb(action = {}) {
    return {
        health: {
            rehabWeekly: [
                { weekStart: '2026-07-20', actions: [{ actionId: 'ra-1', name: '夹砖臀桥', ...action }] }
            ],
            prescriptionActions: []
        }
    };
}

const progressionPolicyStub = {
    actionMetaForName(name) {
        return String(name || '').includes('夹砖臀桥')
            ? { progressionGroup: 'bridge-adduction', progressionLevel: 2 }
            : { progressionGroup: '', progressionLevel: 0 };
    }
};

test('进阶链回填：planPolicy 词典知识落入处方目录，空值回填且重复 ensure 幂等', () => {
    globalThis.window = { actionTaxonomy, planPolicy: progressionPolicyStub };
    try {
        const db = progressionDb();
        ensurePrescriptionActionCatalog(db, { nowTs: 1000 });
        assert.equal(db.health.prescriptionActions[0].progressionGroup, 'bridge-adduction');
        assert.equal(db.health.prescriptionActions[0].progressionLevel, 2);

        const first = JSON.parse(JSON.stringify(db.health.prescriptionActions));
        ensurePrescriptionActionCatalog(db, { nowTs: 1000 });
        assert.deepEqual(JSON.parse(JSON.stringify(db.health.prescriptionActions)), first);
    } finally {
        delete globalThis.window;
    }
});

test('进阶链回填：已有 progressionGroup/progressionLevel 不被词典覆盖', () => {
    globalThis.window = { actionTaxonomy, planPolicy: progressionPolicyStub };
    try {
        const db = progressionDb({ progressionGroup: 'user-defined-group', progressionLevel: 5 });
        ensurePrescriptionActionCatalog(db, { nowTs: 1000 });
        assert.equal(db.health.prescriptionActions[0].progressionGroup, 'user-defined-group');
        assert.equal(db.health.prescriptionActions[0].progressionLevel, 5);

        // 只有 level 已有值而 group 为空：group 回填、已有 level 保留。
        const levelOnly = progressionDb({ progressionLevel: 3 });
        ensurePrescriptionActionCatalog(levelOnly, { nowTs: 1000 });
        assert.equal(levelOnly.health.prescriptionActions[0].progressionGroup, 'bridge-adduction');
        assert.equal(levelOnly.health.prescriptionActions[0].progressionLevel, 3);
    } finally {
        delete globalThis.window;
    }
});

test('进阶链回填：planPolicy 未加载（boot 阶段）时静默跳过，不抛错不回填', () => {
    globalThis.window = { actionTaxonomy };
    try {
        const db = progressionDb();
        ensurePrescriptionActionCatalog(db, { nowTs: 1000 });
        assert.equal(db.health.prescriptionActions[0].progressionGroup, '');
        assert.equal(db.health.prescriptionActions[0].progressionLevel, 0);
    } finally {
        delete globalThis.window;
    }
});

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
