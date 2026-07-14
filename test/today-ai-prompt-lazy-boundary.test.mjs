import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import path from 'node:path';

function loadHistoryView() {
    const context = {
        console,
        window: {},
        module: { exports: {} },
        exports: {}
    };
    context.globalThis = context;
    context.window.window = context.window;
    vm.createContext(context);
    vm.runInContext(
        readFileSync(path.join(process.cwd(), 'history-view.js'), 'utf8'),
        context
    );
    return context.window.dataHistoryView;
}

test('today AI prompts render without health-diet isGainMode', () => {
    const history = loadHistoryView();
    const host = {
        ...history,
        db: {
            aiProfiles: [{ id: 'p1' }],
            aiActiveId: 'p1',
            health: {
                // no goalType fields on purpose
                dietGoal: null
            }
        },
        contextAiTitle: history.contextAiTitle,
        contextAiDescription: history.contextAiDescription
    };

    assert.equal(typeof host.isGainMode, 'undefined');
    assert.doesNotThrow(() => host.contextAiPrompts('today'));
    assert.doesNotThrow(() => {
        const html = host.renderContextAiCard('today');
        assert.match(html, /context-ai-card/);
        assert.match(html, /分析今天/);
    });
});

test('gain goal data keeps bulk-oriented prompts without loading health-diet', () => {
    const history = loadHistoryView();
    const host = {
        ...history,
        db: {
            aiProfiles: [{ id: 'p1' }],
            aiActiveId: 'p1',
            health: {
                goalType: 'gain',
                dietGoal: { goalType: 'gain', dailyCal: 2800 }
            }
        }
    };

    assert.equal(typeof host.isGainMode, 'undefined');
    const prompts = host.contextAiPrompts('today');
    assert.equal(prompts[0].prompt.includes('增肌'), true);
    const weight = host.contextAiPrompts('weight');
    assert.equal(weight.some((item) => item.label.includes('增肌') || item.prompt.includes('增肌')), true);
});

test('loss goal data keeps cut-oriented prompts without loading health-diet', () => {
    const history = loadHistoryView();
    const host = {
        ...history,
        db: {
            aiProfiles: [{ id: 'p1' }],
            aiActiveId: 'p1',
            health: {
                goalType: 'loss',
                dietGoal: { goalType: 'loss', dailyCal: 1800 }
            }
        }
    };

    const prompts = host.contextAiPrompts('today');
    assert.equal(prompts[0].prompt.includes('增肌'), false);
    const weight = host.contextAiPrompts('weight');
    assert.equal(weight.some((item) => item.prompt.includes('减重') || item.label.includes('趋势')), true);
});

test('prefers dietGoal.goalType over health.goalType like currentGoalType', () => {
    const history = loadHistoryView();
    const host = {
        ...history,
        db: {
            health: {
                goalType: 'loss',
                dietGoal: { goalType: 'gain' }
            }
        }
    };
    const prompts = host.contextAiPrompts('weight');
    assert.equal(prompts[0].prompt.includes('增肌'), true);
});

test('existing isGainMode still wins when health-diet has been loaded', () => {
    const history = loadHistoryView();
    let calls = 0;
    const host = {
        ...history,
        db: {
            health: {
                goalType: 'loss',
                dietGoal: { goalType: 'loss' }
            }
        },
        isGainMode() {
            calls += 1;
            return true;
        }
    };
    const prompts = host.contextAiPrompts('today');
    assert.equal(calls, 1);
    assert.equal(prompts[0].prompt.includes('增肌'), true);
});
