import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

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
            errorBus: { report() {}, event() {} }
        },
        document: {
            getElementById(id) {
                return elements.get(id) || null;
            }
        },
        console
    };
    sandbox.window.ai = sandbox.ai;
    vm.runInNewContext(`${aiSource}\nai;`, sandbox);
    sandbox.ai.call = async () => raw;
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
