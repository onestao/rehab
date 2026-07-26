import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';
import * as aiJsonPure from '../ai-json-pure.mjs';
import actionTaxonomy from '../action-taxonomy-pure.js';

async function loadRehabWeeklyHarness(raw) {
    const aiSource = await readFile(new URL('../ai-api.js', import.meta.url), 'utf8');
    const profileSource = await readFile(new URL('../health-profile.js', import.meta.url), 'utf8');
    const elements = new Map([
        ['rehabPrescriptionText', { value: '台阶下放 3 组，每组 10 次，本周继续观察疼痛。' }],
        ['rehabWeekStart', { value: '2026-07-06' }],
        ['rehabVisitDate', { value: '2026-07-07' }]
    ]);
    const statuses = [];
    const sandbox = {
        ai: {},
        window: {
            dataAiTemplates: null,
            haptics: { success() {} },
            errorBus: { report() {}, event() {} },
            aiJsonPure: aiJsonPure.default || aiJsonPure
        },
        document: {
            getElementById(id) {
                return elements.get(id) || null;
            }
        },
        console
    };
    sandbox.window.ai = sandbox.ai;
    sandbox.window.aiJsonPure = aiJsonPure.default || aiJsonPure;
    sandbox.aiJsonPure = sandbox.window.aiJsonPure;
    vm.runInNewContext(`${aiSource}\nai;`, sandbox);
    sandbox.ai.call = async () => raw;
    sandbox.ai.run = async (options = {}) => {
        const text = await sandbox.ai.call(options.messages || [], options.maxTokens || 2000, options);
        return options.returnMeta
            ? {
                text,
                meta: {
                    taskId: options.taskId || 'rehab.weekly',
                    profileId: 'p1',
                    provider: 'openai',
                    modelId: 'm1',
                    reasoningDepth: 'off',
                    fallback: { used: false, index: 0, mode: 'manual' }
                }
            }
            : text;
    };
    vm.runInNewContext(`${profileSource}\nwindow.dataHealthProfile;`, sandbox);

    const profile = sandbox.window.dataHealthProfile;
    const host = {
        ...profile,
        db: {
            health: {
                profile: { conditions: [], examResults: [], preferences: {} },
                rehabWeekly: []
            }
        },
        rehabWeekStart: () => '2026-07-06',
        logicalDateKey: () => '2026-07-07',
        buildRehabActionFingerprint: () => '',
        latestRehabWeekly: () => [],
        setRehabParsePending() {},
        setRehabParseStatus(text, type) {
            statuses.push({ text, type });
        },
        renderRehabWeeklyDraft() {},
        openRehabWeeklyStep(id) {
            this._openedRehabStep = id;
        }
    };
    return { host, statuses };
}

test('retroactive link treats normalized body part aliases as the same part', async () => {
    const profileSource = await readFile(new URL('../health-profile.js', import.meta.url), 'utf8');
    // sameBodyPart 放宽依赖 taxonomy 的 normalizeBodyPart；不注入会静默走退化路径。
    const sandbox = { window: { actionTaxonomy }, console };
    vm.runInNewContext(`${profileSource}\nwindow.dataHealthProfile;`, sandbox);
    // latestRehabWeekly 返回新在前；「膝盖」与「膝」字面不等，归一化后应视为同部位而自动建链。
    const weeks = [
        { weekStart: '2026-07-13', actions: [{ actionId: 'ra-new', name: '靠墙静蹲', bodyPart: '膝盖' }] },
        { weekStart: '2026-07-06', actions: [{ actionId: 'ra-old', name: '靠墙静蹲', bodyPart: '膝' }] }
    ];
    const host = { ...sandbox.window.dataHealthProfile, latestRehabWeekly: () => weeks };

    const result = host.buildRetroactiveLinks();

    assert.equal(result.stats.auto, 1);
    assert.equal(result.autoLinked[0].fromId, 'ra-old');
    assert.equal(result.autoLinked[0].confidence, 'high');
    assert.equal(weeks[0].actions[0].progressesFrom, 'ra-old');
});

test('rehab weekly parser accepts noisy and wrapped AI JSON responses', async () => {
    const cases = [
        '结果：{"weekStart":"2026-07-06","visitDate":"2026-07-07","actions":[{"name":"台阶下放","status":"continued","confidence":88,"spec":{"sets":3,"reps":10,"mode":"reps","actionRest":45}}]}\n调试：{"format":"ok"}',
        '```json\n{"rehabWeekly":{"weekStart":"2026-07-06","visitDate":"2026-07-07","actions":[{"name":"台阶下放","status":"continued","confidence":88,"spec":{"sets":3,"reps":10,"mode":"reps","actionRest":45}}]}}\n```'
    ];

    for (const raw of cases) {
        const { host, statuses } = await loadRehabWeeklyHarness(raw);
        await host.parseRehabWeeklyWithAi();

        assert.equal(host._rehabWeeklyDraft.actions[0].name, '台阶下放');
        assert.equal(host._openedRehabStep, 'rehabStepDiff');
        assert.equal(statuses.at(-1).type, 'ok');
    }
});
