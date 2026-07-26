// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import actionTaxonomy from '../action-taxonomy-pure.js';
import {
    addPrescriptionActionRelation,
    applyAiBodyParts,
    ensurePrescriptionActionCatalog,
    findPrescriptionAction,
    getPrescriptionActionCatalog,
    listUnclassifiedBodyPartActions,
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

function bodyPartDb(action = {}) {
    return {
        health: {
            rehabWeekly: [
                { weekStart: '2026-07-20', actions: [{ actionId: 'ra-1', name: '台阶下放', ...action }] }
            ],
            prescriptionActions: []
        }
    };
}

test('部位多值：自由文本原文保留，bodyParts 派生为归一化枚举键，来源记为 user', () => {
    globalThis.window = { actionTaxonomy };
    try {
        const db = bodyPartDb({ bodyPart: '左膝内侧' });
        ensurePrescriptionActionCatalog(db, { nowTs: 1000 });
        const record = db.health.prescriptionActions[0];
        assert.equal(record.bodyPart, '左膝内侧', '用户/处方原文一字不改');
        assert.deepEqual(record.bodyParts, ['膝']);
        assert.equal(record.bodyPartsSource, 'user');

        // 一条自由文本可以带出多个部位，集合语义的下游才能同时命中。
        const multi = bodyPartDb({ bodyPart: '膝、踝' });
        ensurePrescriptionActionCatalog(multi, { nowTs: 1000 });
        assert.equal(multi.health.prescriptionActions[0].bodyPart, '膝、踝');
        assert.deepEqual(multi.health.prescriptionActions[0].bodyParts, ['膝', '踝']);

        // 识别不了的自由文本同样不丢原文，只是派生不出枚举键。
        const unknown = bodyPartDb({ bodyPart: '全身' });
        ensurePrescriptionActionCatalog(unknown, { nowTs: 1000 });
        assert.equal(unknown.health.prescriptionActions[0].bodyPart, '全身');
        assert.deepEqual(unknown.health.prescriptionActions[0].bodyParts, []);
    } finally {
        delete globalThis.window;
    }
});

test('部位词典兜底：没人标过部位时从动作名猜一次，明确标成 lexicon', () => {
    globalThis.window = { actionTaxonomy };
    try {
        // 「台阶下放」在词典里能推断出「膝」；猜测标成 lexicon，是三层优先级里最低的一层。
        const db = bodyPartDb();
        ensurePrescriptionActionCatalog(db, { nowTs: 1000 });
        assert.deepEqual(db.health.prescriptionActions[0].bodyParts, ['膝']);
        assert.equal(db.health.prescriptionActions[0].bodyPartsSource, 'lexicon');
        assert.equal(db.health.prescriptionActions[0].bodyPart, '', '自由文本原文没有就是没有，不倒填');

        // 词典也认不出来的动作名：留空数组 + 空来源，不臆造。
        const unknown = {
            health: {
                rehabWeekly: [{ weekStart: '2026-07-20', actions: [{ actionId: 'ra-x', name: '呼吸练习' }] }],
                prescriptionActions: []
            }
        };
        ensurePrescriptionActionCatalog(unknown, { nowTs: 1000 });
        assert.deepEqual(unknown.health.prescriptionActions[0].bodyParts, []);
        assert.equal(unknown.health.prescriptionActions[0].bodyPartsSource, '');
    } finally {
        delete globalThis.window;
    }
});

test('部位词典兜底：user/ai 已标过的记录不被词典改写，重复 ensure 幂等', () => {
    globalThis.window = { actionTaxonomy };
    try {
        // 用户写的自由文本「髋」与词典从名字猜的「膝」不同：user 层必须赢。
        const user = bodyPartDb({ bodyPart: '髋' });
        ensurePrescriptionActionCatalog(user, { nowTs: 1000 });
        assert.deepEqual(user.health.prescriptionActions[0].bodyParts, ['髋']);
        assert.equal(user.health.prescriptionActions[0].bodyPartsSource, 'user');

        const ai = bodyPartDb({ bodyParts: ['髋'], bodyPartsSource: 'ai' });
        ensurePrescriptionActionCatalog(ai, { nowTs: 1000 });
        assert.deepEqual(ai.health.prescriptionActions[0].bodyParts, ['髋']);
        assert.equal(ai.health.prescriptionActions[0].bodyPartsSource, 'ai');

        const db = bodyPartDb();
        ensurePrescriptionActionCatalog(db, { nowTs: 1000 });
        const first = JSON.parse(JSON.stringify(db.health.prescriptionActions));
        ensurePrescriptionActionCatalog(db, { nowTs: 1000 });
        ensurePrescriptionActionCatalog(db, { nowTs: 1000 });
        assert.deepEqual(JSON.parse(JSON.stringify(db.health.prescriptionActions)), first);
    } finally {
        delete globalThis.window;
    }
});

test('部位词典兜底：无 taxonomy 环境静默跳过推断，不抛错', () => {
    const db = bodyPartDb();
    ensurePrescriptionActionCatalog(db, { nowTs: 1000 });
    assert.deepEqual(db.health.prescriptionActions[0].bodyParts, []);
    assert.equal(db.health.prescriptionActions[0].bodyPartsSource, '');
});

test('部位多值：重复 ensure 幂等，深比较完全一致', () => {
    globalThis.window = { actionTaxonomy };
    try {
        ['左膝内侧', '膝、踝', '全身', ''].forEach((bodyPart) => {
            const db = bodyPartDb(bodyPart ? { bodyPart } : {});
            ensurePrescriptionActionCatalog(db, { nowTs: 1000 });
            const first = JSON.parse(JSON.stringify(db.health.prescriptionActions));
            ensurePrescriptionActionCatalog(db, { nowTs: 1000 });
            ensurePrescriptionActionCatalog(db, { nowTs: 1000 });
            assert.deepEqual(
                JSON.parse(JSON.stringify(db.health.prescriptionActions)),
                first,
                `bodyPart=${bodyPart || '<empty>'}`
            );
        });
    } finally {
        delete globalThis.window;
    }
});

test('部位多值：已有 bodyParts 不被自由文本覆盖，来源原样保留', () => {
    globalThis.window = { actionTaxonomy };
    try {
        // AI 分类层（阶段 B）会写入与自由文本不同的部位集合，ensure 不得把它擦回去。
        const db = bodyPartDb({ bodyPart: '左膝内侧', bodyParts: ['膝', '髋'], bodyPartsSource: 'ai' });
        ensurePrescriptionActionCatalog(db, { nowTs: 1000 });
        const record = db.health.prescriptionActions[0];
        assert.deepEqual(record.bodyParts, ['膝', '髋']);
        assert.equal(record.bodyPartsSource, 'ai');
        assert.equal(record.bodyPart, '左膝内侧');

        ensurePrescriptionActionCatalog(db, { nowTs: 2000 });
        assert.deepEqual(db.health.prescriptionActions[0].bodyParts, ['膝', '髋']);
        assert.equal(db.health.prescriptionActions[0].bodyPartsSource, 'ai');
    } finally {
        delete globalThis.window;
    }
});

test('部位多值：无 taxonomy 环境静默退化为空数组，不抛错也不丢已有数组', () => {
    const db = bodyPartDb({ bodyPart: '左膝内侧' });
    ensurePrescriptionActionCatalog(db, { nowTs: 1000 });
    assert.equal(db.health.prescriptionActions[0].bodyPart, '左膝内侧', '原文照旧不丢');
    assert.deepEqual(db.health.prescriptionActions[0].bodyParts, [], '推断能力缺失只留空，不臆造');

    const withParts = bodyPartDb({ bodyPart: '左膝内侧', bodyParts: ['膝'], bodyPartsSource: 'user' });
    ensurePrescriptionActionCatalog(withParts, { nowTs: 1000 });
    assert.deepEqual(withParts.health.prescriptionActions[0].bodyParts, ['膝']);
    assert.equal(withParts.health.prescriptionActions[0].bodyPartsSource, 'user');
});

function aiCatalogDb(record = {}) {
    return {
        health: {
            rehabWeekly: [],
            prescriptionActions: [
                {
                    id: 'pa-abduction',
                    displayName: '侧卧髋外展',
                    aliases: ['侧卧髋外展', '弹力带侧卧髋部外展'],
                    bodyParts: [],
                    bodyPartsSource: '',
                    updatedAt: 500,
                    ...record
                }
            ]
        }
    };
}

test('AI 部位回写：按 prescriptionActionId 命中，写入并标记来源为 ai', () => {
    globalThis.window = { actionTaxonomy };
    try {
        const db = aiCatalogDb();
        const written = applyAiBodyParts(
            db,
            [{ prescriptionActionId: 'pa-abduction', name: '随便写的名字', bodyParts: ['髋', '腰背'] }],
            { nowTs: 9000 }
        );
        const record = db.health.prescriptionActions[0];

        assert.equal(written, 1);
        assert.deepEqual(record.bodyParts, ['髋', '腰背']);
        assert.equal(record.bodyPartsSource, 'ai');
        assert.equal(record.updatedAt, 9000);
        // 字段级同步：改过的两个字段各自留下时间戳，跨端合并才不会被整条 updatedAt 淹没。
        assert.equal(record.__fieldUpdatedAt.bodyParts, new Date(9000).toISOString());
        assert.equal(record.__fieldUpdatedAt.bodyPartsSource, new Date(9000).toISOString());
    } finally {
        delete globalThis.window;
    }
});

test('AI 部位回写：没有 id 时按名称/别名索引命中（与 ensure 同一套匹配）', () => {
    globalThis.window = { actionTaxonomy };
    try {
        const byName = aiCatalogDb();
        assert.equal(applyAiBodyParts(byName, [{ name: '侧卧髋外展', bodyParts: ['髋'] }], { nowTs: 9000 }), 1);
        assert.deepEqual(byName.health.prescriptionActions[0].bodyParts, ['髋']);

        // 别名同样命中，且标点/大小写差异由 normalizePrescriptionActionName 折叠。
        const byAlias = aiCatalogDb();
        assert.equal(
            applyAiBodyParts(byAlias, [{ name: '弹力带-侧卧髋部外展（右）', bodyParts: ['髋'] }], { nowTs: 9000 }),
            0,
            '括号内容属于别名之外的新词，不该硬凑'
        );

        const exactAlias = aiCatalogDb();
        assert.equal(applyAiBodyParts(exactAlias, [{ name: '弹力带侧卧髋部外展', bodyParts: ['髋'] }], { nowTs: 9000 }), 1);
        assert.deepEqual(exactAlias.health.prescriptionActions[0].bodyParts, ['髋']);

        // 谁都对不上：不新建记录、不写入。
        const miss = aiCatalogDb();
        assert.equal(applyAiBodyParts(miss, [{ name: '完全不存在的动作', bodyParts: ['髋'] }], { nowTs: 9000 }), 0);
        assert.deepEqual(miss.health.prescriptionActions[0].bodyParts, []);
    } finally {
        delete globalThis.window;
    }
});

test('AI 部位回写：只填空不降级——user 不被覆盖，lexicon 可被覆盖', () => {
    globalThis.window = { actionTaxonomy };
    try {
        const user = aiCatalogDb({ bodyPart: '髋', bodyParts: ['髋'], bodyPartsSource: 'user' });
        assert.equal(applyAiBodyParts(user, [{ prescriptionActionId: 'pa-abduction', bodyParts: ['膝'] }], { nowTs: 9000 }), 0);
        assert.deepEqual(user.health.prescriptionActions[0].bodyParts, ['髋']);
        assert.equal(user.health.prescriptionActions[0].bodyPartsSource, 'user');
        assert.equal(user.health.prescriptionActions[0].updatedAt, 500, '跳过就不该动 updatedAt');

        // 词典猜的部位优先级最低，AI 分类结果可以纠正它。
        const lexicon = aiCatalogDb({ bodyParts: ['腰背'], bodyPartsSource: 'lexicon' });
        assert.equal(applyAiBodyParts(lexicon, [{ prescriptionActionId: 'pa-abduction', bodyParts: ['髋'] }], { nowTs: 9000 }), 1);
        assert.deepEqual(lexicon.health.prescriptionActions[0].bodyParts, ['髋']);
        assert.equal(lexicon.health.prescriptionActions[0].bodyPartsSource, 'ai');
    } finally {
        delete globalThis.window;
    }
});

test('AI 部位回写：非法部位被过滤，过滤后为空则整条跳过', () => {
    globalThis.window = { actionTaxonomy };
    try {
        // 解析层已把 AI 值严格收敛到枚举，这里是第二道防线：走 normalizeBodyParts，
        // 认得出的（'core' → 腰背）归一化，认不出的（'全身'、数字、null）直接丢。
        const mixed = aiCatalogDb();
        assert.equal(
            applyAiBodyParts(mixed, [{ prescriptionActionId: 'pa-abduction', bodyParts: ['髋', '全身', 'core', 42, null] }], { nowTs: 9000 }),
            1
        );
        assert.deepEqual(mixed.health.prescriptionActions[0].bodyParts, ['髋', '腰背']);

        ['全身', '编造的部位'].forEach((bad) => {
            const db = aiCatalogDb();
            assert.equal(applyAiBodyParts(db, [{ prescriptionActionId: 'pa-abduction', bodyParts: [bad] }], { nowTs: 9000 }), 0);
            assert.deepEqual(db.health.prescriptionActions[0].bodyParts, []);
            assert.equal(db.health.prescriptionActions[0].bodyPartsSource, '');
        });

        const empty = aiCatalogDb();
        assert.equal(applyAiBodyParts(empty, [{ prescriptionActionId: 'pa-abduction', bodyParts: [] }], { nowTs: 9000 }), 0);
        assert.equal(applyAiBodyParts(empty, [{ prescriptionActionId: 'pa-abduction' }], { nowTs: 9000 }), 0);
    } finally {
        delete globalThis.window;
    }
});

test('AI 部位回写：幂等——重复调用写入 0 条且数据深比较一致', () => {
    globalThis.window = { actionTaxonomy };
    try {
        const db = aiCatalogDb();
        const entries = [{ prescriptionActionId: 'pa-abduction', name: '侧卧髋外展', bodyParts: ['髋'] }];
        assert.equal(applyAiBodyParts(db, entries, { nowTs: 9000 }), 1);
        const first = JSON.parse(JSON.stringify(db.health.prescriptionActions));

        assert.equal(applyAiBodyParts(db, entries, { nowTs: 12000 }), 0);
        assert.equal(applyAiBodyParts(db, [{ prescriptionActionId: 'pa-abduction', bodyParts: ['膝'] }], { nowTs: 12000 }), 0);
        assert.deepEqual(JSON.parse(JSON.stringify(db.health.prescriptionActions)), first);
    } finally {
        delete globalThis.window;
    }
});

test('AI 部位回写：无 taxonomy 环境返回 0 且不抛错', () => {
    const db = aiCatalogDb();
    assert.equal(applyAiBodyParts(db, [{ prescriptionActionId: 'pa-abduction', bodyParts: ['髋'] }], { nowTs: 9000 }), 0);
    assert.deepEqual(db.health.prescriptionActions[0].bodyParts, []);
    assert.equal(db.health.prescriptionActions[0].bodyPartsSource, '');

    globalThis.window = { actionTaxonomy };
    try {
        // 空目录 / 空 entries / 畸形入参都只是无事发生。
        assert.equal(applyAiBodyParts({}, [{ name: '侧卧髋外展', bodyParts: ['髋'] }]), 0);
        assert.equal(applyAiBodyParts(aiCatalogDb(), []), 0);
        assert.equal(applyAiBodyParts(aiCatalogDb(), /** @type {any} */ (null)), 0);
    } finally {
        delete globalThis.window;
    }
});

function unclassifiedDb(records = []) {
    return { health: { rehabWeekly: [], prescriptionActions: records } };
}

test('待分类清单：只返回部位与来源双空的活记录，三种来源已标的都算已分类', () => {
    const db = unclassifiedDb([
        { id: 'pa-empty', displayName: '侧卧髋外展', aliases: ['侧卧髋外展', '弹力带侧卧髋部外展'], bodyParts: [], updatedAt: 100 },
        { id: 'pa-user', displayName: '靠墙静蹲', bodyParts: ['膝'], bodyPartsSource: 'user', updatedAt: 200 },
        { id: 'pa-ai', displayName: '踝泵', bodyParts: ['踝'], bodyPartsSource: 'ai', updatedAt: 300 },
        { id: 'pa-lexicon', displayName: '猫牛式', bodyParts: ['腰背'], bodyPartsSource: 'lexicon', updatedAt: 400 },
        { id: 'pa-missing', displayName: '呼吸练习', updatedAt: 50 },
        { id: 'pa-dead', displayName: '已删除动作', bodyParts: [], deleted: true, updatedAt: 900 }
    ]);

    const result = listUnclassifiedBodyPartActions(db);

    assert.deepEqual(result.actions.map((item) => item.id), ['pa-empty', 'pa-missing']);
    assert.equal(result.total, 2);
    assert.equal(result.truncated, false);
    // 别名一起给（去掉与 displayName 重复的那份）；没有别名时干脆不带这个键。
    assert.deepEqual(result.actions[0], {
        id: 'pa-empty',
        displayName: '侧卧髋外展',
        aliases: ['弹力带侧卧髋部外展']
    });
    assert.deepEqual(result.actions[1], { id: 'pa-missing', displayName: '呼吸练习' });
});

test('待分类清单：user 已表态但枚举装不下的空数组记录不列入，AI 也确实写不进去', () => {
    const db = unclassifiedDb([
        { id: 'pa-unspoken', displayName: '呼吸练习', bodyParts: [], bodyPartsSource: '', updatedAt: 100 },
        // 毒化场景：用户填「全身」派生出空数组 + user 来源。旧筛选每次都把它塞给 AI，
        // 而 applyAiBodyParts 因 source=user 永远拒写——死循环白占提示词名额。
        { id: 'pa-user-empty', displayName: '全身放松操', bodyPart: '全身', bodyParts: [], bodyPartsSource: 'user', updatedAt: 200 },
        { id: 'pa-ai', displayName: '踝泵', bodyParts: ['膝'], bodyPartsSource: 'ai', updatedAt: 300 }
    ]);

    const result = listUnclassifiedBodyPartActions(db);
    assert.deepEqual(result.actions.map((item) => item.id), ['pa-unspoken'], '谁都没表过态的才列');
    assert.equal(result.total, 1);
    assert.equal(result.truncated, false);

    // 互为印证：清单排除 user 空数组记录，正因 AI 分类结果确实写不进去。
    globalThis.window = { actionTaxonomy };
    try {
        assert.equal(
            applyAiBodyParts(db, [{ prescriptionActionId: 'pa-user-empty', bodyParts: ['膝'] }], { nowTs: 9000 }),
            0
        );
        const record = db.health.prescriptionActions[1];
        assert.deepEqual(record.bodyParts, []);
        assert.equal(record.bodyPartsSource, 'user');
        assert.equal(record.updatedAt, 200, '拒写就不该动 updatedAt');
    } finally {
        delete globalThis.window;
    }
});

test('待分类清单：超出上限按 updatedAt 倒序截断，并标出这一批不是全量', () => {
    const records = Array.from({ length: 45 }, (_, index) => ({
        id: `pa-${index}`,
        displayName: `动作${index}`,
        bodyParts: [],
        updatedAt: index
    }));

    const capped = listUnclassifiedBodyPartActions(unclassifiedDb(records));
    assert.equal(capped.actions.length, 40, '默认上限 40');
    assert.equal(capped.total, 45);
    assert.equal(capped.truncated, true, '刻意截断必须能被调用方看出来');
    assert.equal(capped.actions[0].id, 'pa-44', '最近更新的排前面');
    assert.equal(capped.actions[39].id, 'pa-5');

    const custom = listUnclassifiedBodyPartActions(unclassifiedDb(records), { limit: 3 });
    assert.deepEqual(custom.actions.map((item) => item.id), ['pa-44', 'pa-43', 'pa-42']);
    assert.equal(custom.truncated, true);

    const all = listUnclassifiedBodyPartActions(unclassifiedDb(records.slice(0, 40)));
    assert.equal(all.truncated, false, '正好不超上限就不算截断');
});

test('待分类清单：db 结构缺失或畸形时返回空批次，不抛错', () => {
    [undefined, {}, { health: {} }, { health: { prescriptionActions: null } }].forEach((db) => {
        assert.deepEqual(listUnclassifiedBodyPartActions(/** @type {any} */ (db)), {
            actions: [],
            total: 0,
            truncated: false
        });
    });
    // 没有名字的记录匹配不上任何目录条目，给了 AI 也没用，直接不发。
    assert.deepEqual(listUnclassifiedBodyPartActions(unclassifiedDb([{ id: 'pa-noname', bodyParts: [] }])).actions, []);
});

test('updatedAt 通胀回归：输入零变化的重复 ensure（次日开机）不 bump 时间戳', () => {
    globalThis.window = { actionTaxonomy };
    try {
        const db = bodyPartDb();
        ensurePrescriptionActionCatalog(db, { nowTs: 1000 });
        // 新建记录取当前 nowTs，不受还原逻辑影响。
        assert.equal(db.health.prescriptionActions[0].updatedAt, 1000);
        const first = JSON.parse(JSON.stringify(db.health.prescriptionActions));

        // 次日开机：nowTs 与上次相差远超同步的 60 秒字段级合并窗口，但输入零变化。
        // 通胀会让空记录在整记录 LWW 里胜出，覆写他端 AI 分类并回推。
        ensurePrescriptionActionCatalog(db, { nowTs: 999000 });
        assert.equal(db.health.prescriptionActions[0].updatedAt, 1000, '内容没变不得通胀 updatedAt');
        assert.deepEqual(JSON.parse(JSON.stringify(db.health.prescriptionActions)), first);
    } finally {
        delete globalThis.window;
    }
});

test('updatedAt 通胀回归：内容真实变化的记录才 bump，未受影响的记录保持原值', () => {
    globalThis.window = { actionTaxonomy };
    try {
        const db = {
            health: {
                rehabWeekly: [
                    {
                        weekStart: '2026-07-20',
                        actions: [
                            { actionId: 'ra-1', name: '靠墙静蹲' },
                            { actionId: 'ra-2', name: '踝泵' }
                        ]
                    }
                ],
                prescriptionActions: []
            }
        };
        ensurePrescriptionActionCatalog(db, { nowTs: 1000 });

        // 新一周带来既有动作的新写法（折叠成同名 → 记入别名）和一个全新动作。
        db.health.rehabWeekly.push({
            weekStart: '2026-07-27',
            actions: [
                { actionId: 'ra-3', name: '靠墙-静蹲' },
                { actionId: 'ra-4', name: '直腿抬高' }
            ]
        });
        ensurePrescriptionActionCatalog(db, { nowTs: 999000 });
        const byName = new Map(db.health.prescriptionActions.map((item) => [item.displayName, item]));
        assert.equal(byName.get('靠墙静蹲').updatedAt, 999000, '新增别名属于内容变化，要 bump 以便同步出去');
        assert.equal(byName.get('踝泵').updatedAt, 1000, '没被动到的记录保持原时间戳');
        assert.equal(byName.get('直腿抬高').updatedAt, 999000, '新建记录用当前 nowTs');
    } finally {
        delete globalThis.window;
    }
});

test('updatedAt 通胀回归：回填发生变化的那次 ensure 才 bump，此后幂等不再 bump', () => {
    // 首次 ensure 无 taxonomy：词典兜底静默跳过，记录部位留空。
    const db = bodyPartDb();
    ensurePrescriptionActionCatalog(db, { nowTs: 1000 });
    assert.equal(db.health.prescriptionActions[0].updatedAt, 1000);
    globalThis.window = { actionTaxonomy };
    try {
        // taxonomy 就绪后的开机：词典从「台阶下放」猜出「膝」，内容真变了 → bump 同步出去。
        ensurePrescriptionActionCatalog(db, { nowTs: 5000 });
        assert.deepEqual(db.health.prescriptionActions[0].bodyParts, ['膝']);
        assert.equal(db.health.prescriptionActions[0].updatedAt, 5000, '回填变化的那次要 bump');

        ensurePrescriptionActionCatalog(db, { nowTs: 999000 });
        assert.equal(db.health.prescriptionActions[0].updatedAt, 5000, '回填完成后幂等，不再 bump');
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

function mergeTombstoneDb() {
    return {
        health: {
            rehabWeekly: [
                { weekStart: '2026-06-01', actions: [{ actionId: 'ra-1', name: '靠墙蹲' }] },
                { weekStart: '2026-06-08', actions: [{ actionId: 'ra-2', name: '靠墙静蹲' }] }
            ],
            prescriptionActions: []
        }
    };
}

function mergeOnce(db, nowTs = 2000) {
    ensurePrescriptionActionCatalog(db, { nowTs: 1000 });
    const ids = db.health.prescriptionActions.map((item) => item.id);
    mergePrescriptionActions(db, ids[0], [ids[1]], { displayName: '靠墙静蹲', nowTs });
    return db.health.prescriptionActions.find((item) => item.deleted);
}

test('删除墓碑：合并产生的墓碑必须穿透目录重建（重启后仍能把删除同步出去）', () => {
    const db = mergeTombstoneDb();
    const tombstone = mergeOnce(db);
    assert.ok(tombstone, '合并必须留下墓碑，否则他端永远不知道这条被删了');
    const before = JSON.parse(JSON.stringify(tombstone));

    // 模拟重启：normalizeDb 每次开机都会重建目录，过去这一步把墓碑整个丢掉。
    ensurePrescriptionActionCatalog(db, { nowTs: 999000 });
    const after = db.health.prescriptionActions.find((item) => item.id === before.id);
    assert.ok(after, '墓碑被重建丢弃 → 他端记录诈尸并回推本地');
    assert.equal(after.deleted, true);
    assert.equal(after.updatedAt, before.updatedAt, '墓碑不该被 bump，否则制造无谓同步流量');
    assert.deepEqual(JSON.parse(JSON.stringify(after)), before, '墓碑原样保留，不经 normalize 改写');
    assert.equal(db.health.prescriptionActions.filter((item) => !item.deleted).length, 1);
    assert.equal(db.health.prescriptionActions.at(-1).id, before.id, '墓碑排在活记录之后');
});

test('删除墓碑：不泄漏到目录读取方（UI / AI 待分类清单）', () => {
    const db = mergeTombstoneDb();
    const tombstone = mergeOnce(db);
    ensurePrescriptionActionCatalog(db, { nowTs: 999000 });

    const catalog = getPrescriptionActionCatalog(db);
    assert.deepEqual(catalog.map((item) => item.deleted), [false]);
    assert.equal(findPrescriptionAction(db, tombstone.id), null);
    assert.deepEqual(
        listUnclassifiedBodyPartActions(db).actions.map((item) => item.id),
        catalog.map((item) => item.id),
        '墓碑不得白占提示词名额'
    );
});

test('删除墓碑：同 id 被重建成活记录时活记录优先，不出现同 id 两条', () => {
    // 他端的周记录还指着已删 id（合并尚未同步过去），同步回来后 ensure 会按 id 重建活记录。
    const db = {
        health: {
            rehabWeekly: [
                { weekStart: '2026-06-01', actions: [{ actionId: 'ra-1', name: '新写法动作', prescriptionActionId: 'pa-dead' }] }
            ],
            prescriptionActions: [{ id: 'pa-dead', displayName: '老动作', deleted: true, updatedAt: 500 }]
        }
    };
    ensurePrescriptionActionCatalog(db, { nowTs: 1000 });

    const hits = db.health.prescriptionActions.filter((item) => item.id === 'pa-dead');
    assert.equal(hits.length, 1, '同 id 只能有一条');
    assert.equal(hits[0].deleted, false, '被复活的活记录优先于墓碑');
});

test('删除墓碑：反复 ensure 与再次合并都不会丢失或增殖墓碑', () => {
    const db = mergeTombstoneDb();
    mergeOnce(db);
    ensurePrescriptionActionCatalog(db, { nowTs: 999000 });
    const first = JSON.parse(JSON.stringify(db.health.prescriptionActions));

    ensurePrescriptionActionCatalog(db, { nowTs: 1999000 });
    ensurePrescriptionActionCatalog(db, { nowTs: 2999000 });
    assert.deepEqual(
        JSON.parse(JSON.stringify(db.health.prescriptionActions)),
        first,
        '幂等：墓碑数量内容稳定，活记录 updatedAt 仍被还原不通胀'
    );

    // 第二次合并（另一对动作）不得把上一次的墓碑冲掉。
    db.health.rehabWeekly.push({
        weekStart: '2026-06-15',
        actions: [{ actionId: 'ra-3', name: '踝泵' }, { actionId: 'ra-4', name: '踝-泵动作' }]
    });
    ensurePrescriptionActionCatalog(db, { nowTs: 3000 });
    const extra = db.health.prescriptionActions.filter((item) => !item.deleted && item.displayName.startsWith('踝'));
    mergePrescriptionActions(db, extra[0].id, [extra[1].id], { nowTs: 4000 });
    ensurePrescriptionActionCatalog(db, { nowTs: 5000 });

    const tombIds = db.health.prescriptionActions.filter((item) => item.deleted).map((item) => item.id);
    assert.equal(tombIds.length, 2);
    assert.equal(new Set(tombIds).size, 2);
    assert.ok(tombIds.includes(first.at(-1).id), '早先的墓碑不能被后一次合并冲掉');
});

test('normalizePrescriptionActionName folds punctuation for search', () => {
    assert.equal(normalizePrescriptionActionName(' 靠墙-静蹲（低角度） '), '靠墙静蹲低角度');
});

test('墓碑穿透：加进阶关系也整体重写目录，同样不得冲掉墓碑', () => {
    globalThis.window = { actionTaxonomy };
    try {
        const db = {
            health: {
                rehabWeekly: [{
                    weekStart: '2026-06-08',
                    actions: [
                        { actionId: 'ra-1', name: '靠墙静蹲' },
                        { actionId: 'ra-2', name: '靠墙蹲' },
                        { actionId: 'ra-3', name: '踝泵' }
                    ]
                }],
                prescriptionActions: []
            }
        };
        ensurePrescriptionActionCatalog(db, { nowTs: 1000 });
        const live = getPrescriptionActionCatalog(db);
        const squats = live.filter((item) => item.displayName.includes('靠墙'));
        const squat = squats[0];
        const pump = live.find((item) => item.displayName === '踝泵');
        assert.equal(squats.length, 2, '前置条件：两种写法应各成一条');
        // 合并出一个墓碑，随后只加关系、不再 ensure —— addRelation 自己就会整体重写数组。
        mergePrescriptionActions(db, squat.id, [squats[1].id], { nowTs: 2000 });
        ensurePrescriptionActionCatalog(db, { nowTs: 3000 });
        const tombBefore = db.health.prescriptionActions.filter((item) => item.deleted);
        assert.equal(tombBefore.length, 1, '前置条件：合并后应有一个墓碑');

        addPrescriptionActionRelation(db, squat.id, pump.id, 'progression', { nowTs: 4000 });

        const tombAfter = db.health.prescriptionActions.filter((item) => item.deleted);
        assert.deepEqual(
            tombAfter.map((item) => item.id),
            tombBefore.map((item) => item.id),
            '加关系不得冲掉已有墓碑'
        );
        assert.equal(tombAfter[0].updatedAt, tombBefore[0].updatedAt, '墓碑时间戳不被改写');
        assert.equal(findPrescriptionAction(db, tombAfter[0].id), null, '墓碑仍不对外可见');
    } finally {
        delete globalThis.window;
    }
});
