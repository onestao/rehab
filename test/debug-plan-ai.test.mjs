import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadDebugPlanAi() {
    const code = readFileSync(new URL('../debug-plan-ai.js', import.meta.url), 'utf8');
    const events = [];
    const sandbox = {
        window: {
            errorBus: {
                enabled: false,
                enableDebug() { this.enabled = true; },
                isDebugEnabled() { return this.enabled; },
                event(scope, type, meta) { events.push({ scope, type, meta }); },
                listDebug() { return events.map((event, index) => ({ t: index + 1, ...event })); }
            },
            planAiPure: {
                normalizeAiCategory(value = 'main') {
                    return String(value || 'main');
                }
            },
            dataPlanAi: {
                previewPlanAiPlans(plans) {
                    this._pendingPlanAiPlans = plans;
                    return 'previewed';
                },
                confirmPlanAiPlans() {
                    return 'saved';
                },
                collectPlanAiPreviewPlans() {
                    return this._pendingPlanAiPlans || [];
                }
            },
            data: {
                db: { dailyPlans: [] }
            }
        },
        console
    };
    vm.runInNewContext(code, sandbox);
    return { sandbox, events };
}

test('plan AI debug stays inert until explicitly enabled', () => {
    const { sandbox, events } = loadDebugPlanAi();
    const original = sandbox.window.dataPlanAi.previewPlanAiPlans;

    sandbox.window.dataPlanAi.previewPlanAiPlans([{ type: 'rehab', items: [] }]);

    assert.equal(events.length, 0);
    assert.equal(sandbox.window.dataPlanAi.previewPlanAiPlans, original);
});

test('plan AI debug lazily patches preview and confirm diagnostics', () => {
    const { sandbox, events } = loadDebugPlanAi();
    const api = sandbox.window.dataPlanAi;
    const plans = [{
        date: '2026-05-25',
        type: 'rehab',
        title: 'AI rehab',
        items: [{
            name: 'AI action',
            category: 'main',
            requiresUserConfirm: true,
            userConfirmed: false,
            spec: { sets: 2, reps: 8, work: 3, actionRest: 30, mode: 'reps' }
        }]
    }];

    sandbox.window.planAiDebug.enable();
    assert.equal('__planAiDebugOriginal' in api.previewPlanAiPlans, true);

    assert.equal(api.previewPlanAiPlans.call(api, plans), 'previewed');
    assert.equal(api.confirmPlanAiPlans.call(api), 'saved');

    assert.deepEqual(events.map((event) => event.type), [
        'debug:enabled',
        'preview:open:start',
        'preview:open:done',
        'confirm:start',
        'confirm:finish'
    ]);
    assert.equal(events[1].scope, 'plan-ai');
    assert.equal(events[1].meta.before[0].confirmRequired, 1);
    assert.equal(events[3].meta.plans[0].samples[0].name, 'AI action');
});

test('plan AI debug can be disabled and unpatches methods', () => {
    const { sandbox, events } = loadDebugPlanAi();
    const api = sandbox.window.dataPlanAi;

    sandbox.window.planAiDebug.enable();
    sandbox.window.planAiDebug.disable();
    api.previewPlanAiPlans([{ type: 'rehab', items: [] }]);

    assert.deepEqual(events.map((event) => event.type), ['debug:enabled']);
    assert.equal('__planAiDebugPatched' in api.previewPlanAiPlans, false);
});
