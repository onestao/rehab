import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import path from 'node:path';

function read(file) {
    return readFileSync(path.join(process.cwd(), file), 'utf8');
}

test('today shell seeds static skeleton and keeps fixed quick action order', () => {
    const source = read('data-views.js');
    assert.match(source, /ensureTodayShellSkeleton/);
    assert.match(source, /today-shell-skeleton|today-quick-skeleton/);
    assert.match(source, /记体重[\s\S]*记饮食[\s\S]*记运动[\s\S]*问 AI/);
    assert.match(source, /is-placeholder/);
    assert.doesNotMatch(source, /shimmer|skeleton-shimmer|setInterval\(/);
});

test('history, today-view-core and plan-ui quick actions share weight-diet-cardio-ai order', () => {
    const history = read('history-view.js');
    const core = read('today-view-core.js');
    const plan = read('plan-ui.js');
    const historyDock = history.slice(history.indexOf('renderRecordQuickActions'), history.indexOf('renderTodayTimeline'));
    const coreDock = core.slice(core.indexOf('renderTodayActionDock'), core.indexOf('updateTodayV6Greet'));
    const planDock = plan.slice(plan.indexOf('renderTodayActionDock'), plan.indexOf('renderTodayAiReminder'));
    for (const chunk of [historyDock, coreDock, planDock]) {
        const weight = chunk.indexOf('记体重');
        const diet = chunk.indexOf('记饮食');
        const cardio = chunk.indexOf('记运动');
        const ai = chunk.indexOf('问 AI');
        assert.ok(weight >= 0 && diet > weight && cardio > diet && ai > cardio);
    }
});

test('renderTodayPage fills existing slots without inventing a new root structure', () => {
    const elements = {
        todayOverview: { innerHTML: '', dataset: {}, removeAttribute() {} },
        todayQuickActions: { innerHTML: '', dataset: {}, removeAttribute() {} },
        todayPlanStatus: { innerHTML: '', dataset: {}, removeAttribute() {} },
        todayDietStatus: { innerHTML: '', dataset: {}, removeAttribute() {} },
        todayTimeline: { innerHTML: '', dataset: {}, removeAttribute() {} },
        todayAiCard: { innerHTML: '', dataset: {}, removeAttribute() {} }
    };
    const context = {
        console,
        document: {
            readyState: 'complete',
            getElementById(id) {
                return elements[id] || null;
            },
            querySelector() { return { id: 'today' }; },
            querySelectorAll() { return []; },
            addEventListener() {},
            removeEventListener() {}
        },
        window: {
            addEventListener() {},
            removeEventListener() {}
        },
        elements
    };
    context.globalThis = context;
    context.window.document = context.document;
    context.window.window = context.window;
    context.document.defaultView = context.window;
    vm.createContext(context);
    vm.runInContext(read('data-views.js'), context);

    context.window.dataViews.ensureTodayShellSkeleton();
    assert.match(elements.todayQuickActions.innerHTML, /记体重[\s\S]*记饮食[\s\S]*记运动[\s\S]*问 AI/);
    assert.match(elements.todayOverview.innerHTML, /今日概览/);
    assert.equal(elements.todayQuickActions.dataset.todayShell, 'skeleton');

    const host = {
        renderPlanTodaySection() { return '<div class="hero" id="hero-ready">ready</div>'; },
        renderTodayActionDock() {
            return '<div class="quick-dock"><button data-q="weight">记体重</button><button data-q="diet">记饮食</button><button data-q="cardio">记运动</button><button data-q="ai">问 AI</button></div>';
        },
        renderTodayV6PlanCard() { return '<div class="plan-card">plan</div>'; },
        renderTodayV6DietCard() { return '<div class="diet-card">diet</div>'; },
        renderTodayTimeline() { return '<div class="timeline">timeline</div>'; },
        renderTodayAiReminder() { return '<div class="ai">ai</div>'; },
        bindPlanQuickRepeat() {},
        updateTodayV6Greet() {}
    };
    context.window.data = host;
    context.window.dataViews.renderTodayPage.call(host);

    assert.match(elements.todayOverview.innerHTML, /hero-ready/);
    assert.match(elements.todayQuickActions.innerHTML, /data-q="weight"[\s\S]*data-q="diet"[\s\S]*data-q="cardio"[\s\S]*data-q="ai"/);
    assert.equal(elements.todayOverview.dataset.todayShell, 'ready');
});


test('renderTodayPage preserves focused and busy quick-action nodes', () => {
    const buttons = ['weight', 'diet', 'cardio', 'ai'].map((key) => ({
        dataset: { q: key },
        disabled: key === 'weight',
        textContent: key === 'weight' ? '加载中' : key
    }));
    const focused = buttons[0];
    let quickWrites = 0;
    const quickActions = {
        dataset: { todayShell: 'ready' },
        querySelectorAll(selector) { return selector === '[data-q]' ? buttons : []; },
        removeAttribute() {}
    };
    Object.defineProperty(quickActions, 'innerHTML', {
        get() { return '<div class="quick-dock">ready</div>'; },
        set() { quickWrites += 1; }
    });
    const elements = {
        todayOverview: { innerHTML: '', dataset: {}, removeAttribute() {} },
        todayQuickActions: quickActions,
        todayPlanStatus: { innerHTML: '', dataset: {}, removeAttribute() {} },
        todayDietStatus: { innerHTML: '', dataset: {}, removeAttribute() {} },
        todayTimeline: { innerHTML: '', dataset: {}, removeAttribute() {} },
        todayAiCard: { innerHTML: '', dataset: {}, removeAttribute() {} }
    };
    const context = {
        console,
        document: {
            readyState: 'complete',
            activeElement: focused,
            getElementById(id) { return elements[id] || null; },
            querySelector() { return { id: 'today' }; },
            querySelectorAll() { return []; },
            addEventListener() {},
            removeEventListener() {}
        },
        window: { addEventListener() {}, removeEventListener() {} }
    };
    context.globalThis = context;
    context.window.window = context.window;
    context.window.document = context.document;
    vm.createContext(context);
    vm.runInContext(read('data-views.js'), context);
    context.window.data = {
        renderPlanTodaySection() { return '<div>overview</div>'; },
        renderTodayActionDock() {
            return '<div class="quick-dock"><button data-q="weight">记体重</button><button data-q="diet">记饮食</button><button data-q="cardio">记运动</button><button data-q="ai">问 AI</button></div>';
        },
        renderTodayV6PlanCard() { return '<div>plan</div>'; },
        renderTodayV6DietCard() { return '<div>diet</div>'; },
        renderTodayTimeline() { return '<div>timeline</div>'; },
        renderTodayAiReminder() { return '<div>ai</div>'; },
        bindPlanQuickRepeat() {},
        updateTodayV6Greet() {}
    };
    context.window.dataViews.renderTodayPage();
    assert.equal(quickWrites, 0);
    assert.equal(context.document.activeElement, focused);
    assert.equal(buttons[0].disabled, true);
    assert.equal(buttons[0].textContent, '加载中');
});
