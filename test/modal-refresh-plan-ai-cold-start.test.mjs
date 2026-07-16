// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as actionIdentity from '../action-identity.js';
import * as planAiPure from '../plan-ai-pure.mjs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

class FakeElement {
    constructor(tagName = 'div') {
        this.tagName = String(tagName).toUpperCase();
        this.id = '';
        this.className = '';
        this.children = [];
        this.parentElement = null;
        this.attributes = {};
        this.dataset = {};
        this.disabled = false;
        this._listeners = {};
        this._innerHTML = '';
        this._closeButtons = [];
        const classes = new Set();
        this.classList = {
            add: (...values) => values.forEach(value => classes.add(value)),
            remove: (...values) => values.forEach(value => classes.delete(value)),
            contains: value => classes.has(value),
            toggle: (value, force) => {
                const enabled = force == null ? !classes.has(value) : Boolean(force);
                if (enabled) classes.add(value); else classes.delete(value);
                return enabled;
            }
        };
    }

    set innerHTML(value) {
        this._innerHTML = String(value || '');
        this._closeButtons = [];
        const closeCount = (this._innerHTML.match(/data-modal-close/g) || []).length;
        for (let index = 0; index < closeCount; index += 1) {
            const button = new FakeElement('button');
            button.setAttribute('data-modal-close', '');
            this._closeButtons.push(button);
        }
    }

    get innerHTML() {
        return this._innerHTML;
    }

    appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        return child;
    }

    remove() {
        if (this.parentElement) {
            this.parentElement.children = this.parentElement.children.filter(child => child !== this);
        }
        this.parentElement = null;
    }

    setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name === 'id') this.id = String(value);
        if (name.startsWith('data-')) {
            const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
            this.dataset[key] = String(value);
        }
    }

    getAttribute(name) {
        return this.attributes[name] ?? null;
    }

    removeAttribute(name) {
        delete this.attributes[name];
    }

    addEventListener(type, listener) {
        this._listeners[type] = listener;
    }

    click() {
        this._listeners.click?.({ preventDefault() {}, stopPropagation() {} });
    }

    focus() {}

    querySelectorAll(selector) {
        if (selector === '[data-modal-close]') return this._closeButtons;
        return [];
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function createRuntime() {
    const executedScripts = [];
    const loadRequests = [];
    const errors = [];
    const toasts = [];
    const focusEvents = [];
    const pendingLoads = [];
    let refreshCalls = 0;
    const body = new FakeElement('body');
    let taskEditButtonVisible = false;
    const taskEditButton = new FakeElement('button');
    taskEditButton.setAttribute('onclick', "event.stopPropagation();data.openPlanTaskEdit('plan-1','task-1')");
    const document = {
        body,
        activeElement: new FakeElement('button'),
        createElement(tagName) { return new FakeElement(tagName); },
        addEventListener() {},
        querySelector(selector) {
            if (selector === '.md-modal[data-rl-modal="1"]') {
                return body.children.find(node => node.getAttribute('data-rl-modal') === '1') || null;
            }
            return null;
        },
        querySelectorAll(selector) {
            if (selector === '[onclick*="openPlanTaskEdit"]') {
                return taskEditButtonVisible ? [taskEditButton] : [];
            }
            return [];
        },
        getElementById(id) { return body.children.find(node => node.id === id) || null; }
    };
    const history = {
        state: {},
        pushState(state) { this.state = state; },
        replaceState(state) { this.state = state; },
        back() {}
    };
    const window = {
        actionIdentity,
        planAiPure,
        addEventListener() {},
        focusTrap: {
            trap(root) { focusEvents.push(['trap', root]); },
            release() { focusEvents.push(['release']); }
        },
        errorBus: { report(scope, error, meta) { errors.push({ scope, error, meta }); } },
        toast: { show(message, type) { toasts.push({ message, type }); } },
        loadAppScript(name) {
            loadRequests.push(name);
            return new Promise((resolve, reject) => pendingLoads.push({ name, resolve, reject }));
        }
    };
    const context = {
        window,
        document,
        history,
        console,
        Element: FakeElement,
        HTMLElement: FakeElement,
        requestAnimationFrame(callback) { callback(); },
        setTimeout(callback) { callback(); return 0; },
        clearTimeout() {}
    };
    context.globalThis = context;
    vm.createContext(context);

    const execute = (file) => {
        executedScripts.push(file);
        vm.runInContext(read(file), context, { filename: file });
    };
    execute('rehab-policy.js');
    execute('nav-stack.js');
    execute('data-ui-state.js');
    execute('plan-ui.js');
    execute('data.js');

    const plan = {
        id: 'plan-1',
        title: '今日康复',
        type: 'rehab',
        items: [{
            id: 'task-1',
            name: '肩关节活动',
            status: 'todo',
            category: 'main',
            spec: { sets: 2, reps: 8 },
            requiresUserConfirm: true,
            userConfirmed: false
        }]
    };
    const data = window.data;
    data.db.dailyPlans = [plan];
    data.escapeHtml = escapeHtml;
    data.activeRecords = (records) => (records || []).filter(record => record && !record.deleted);
    data.findTask = (planId, taskId) => {
        const foundPlan = data.db.dailyPlans.find(item => item.id === planId);
        return { plan: foundPlan, task: foundPlan?.items.find(item => item.id === taskId) };
    };
    data.dateKey = () => '2026-07-17';
    data.logicalDateKey = () => '2026-07-16';
    data.planTypeMeta = () => ({ label: '康复', icon: 'self_improvement' });
    data.updateItemStatus = () => {};
    data.render = () => {};
    data.save = () => {};
    data.touchRecord = () => {};
    data.ensurePlanPrefs = () => ({});
    const refreshModules = data.refreshModules;
    data.refreshModules = function (...args) {
        refreshCalls += 1;
        return refreshModules.apply(this, args);
    };

    taskEditButton.addEventListener('click', () => {
        taskEditButton.pendingClick = data.openPlanTaskEdit(plan.id, plan.items[0].id);
    });

    return {
        data,
        plan,
        window,
        document,
        taskEditButton,
        executedScripts,
        loadRequests,
        errors,
        toasts,
        focusEvents,
        get refreshCalls() { return refreshCalls; },
        openTaskMenu() {
            data.openPlanTaskDrawer(plan.id);
            assert.ok(document.getElementById('planTaskDrawer'), 'task drawer should open from a clean today start');
            data.openPlanTaskMenu(plan.id, plan.items[0].id);
            const menu = document.querySelector('.md-modal[data-rl-modal="1"]');
            assert.match(menu?.innerHTML || '', /data\.openPlanTaskEdit/);
            taskEditButtonVisible = true;
            return menu;
        },
        resolveNextPlanAiLoad() {
            const pending = pendingLoads.shift();
            assert.equal(pending?.name, 'plan-ai');
            execute('plan-ai.js');
            pending.resolve();
        },
        rejectNextPlanAiLoad(error = new Error('plan-ai unavailable')) {
            const pending = pendingLoads.shift();
            assert.equal(pending?.name, 'plan-ai');
            pending.reject(error);
        }
    };
}

function modalEntries(runtime) {
    return runtime.window.navStack.stack.filter(entry => entry.type === 'modal');
}

test('plan-ai cold start preserves active modal state across refresh and removes the old nav entry', async () => {
    const runtime = createRuntime();
    assert.equal(runtime.window.dataPlanAi, undefined, 'plan-ai must not be preloaded');

    const taskMenu = runtime.openTaskMenu();
    runtime.taskEditButton.click();
    const editPromise = runtime.taskEditButton.pendingClick;

    assert.equal(runtime.taskEditButton.disabled, true, 'lazy edit button should be disabled while loading');
    assert.equal(runtime.taskEditButton.getAttribute('aria-busy'), 'true');
    assert.deepEqual(runtime.loadRequests, ['plan-ai']);
    assert.equal(runtime.executedScripts.includes('plan-ai.js'), false, 'the loader has not resolved yet');
    assert.equal(runtime.executedScripts.includes('routine-library.js'), false);

    runtime.resolveNextPlanAiLoad();
    await editPromise;

    const editModal = runtime.document.querySelector('.md-modal[data-rl-modal="1"]');
    assert.ok(editModal);
    assert.match(editModal.innerHTML, /编辑计划动作/);
    assert.notEqual(editModal, taskMenu);
    assert.equal(taskMenu.parentElement, null, 'the old task menu should be removed');
    assert.equal(runtime.data._activeModalEl, editModal, 'refresh must keep the active modal reference');
    assert.equal(typeof runtime.window.dataPlanAi.searchPlanActionChoices, 'function', 'the real plan-ai module should execute');
    assert.deepEqual(runtime.loadRequests, ['plan-ai']);
    assert.equal(runtime.executedScripts.includes('plan-ai.js'), true);
    assert.equal(runtime.refreshCalls, 1, 'the loaded module must be merged through the real refreshModules implementation');
    assert.equal(runtime.executedScripts.includes('routine-library.js'), false, 'today cold start must not execute routine-library');
    assert.equal(modalEntries(runtime).length, 1, 'the task-menu nav entry must be replaced, not left stale');
    assert.equal(runtime.taskEditButton.disabled, false, 'busy state should recover after loading');
    assert.equal(runtime.taskEditButton.getAttribute('aria-busy'), null);

    assert.equal(runtime.window.navStack.requestClose('modal'), true, 'one back action should close the edit modal');
    assert.equal(runtime.document.querySelector('.md-modal[data-rl-modal="1"]'), null);
    assert.equal(modalEntries(runtime).length, 0, 'one back action must leave no stale task-menu entry');
    assert.equal(runtime.window.navStack.requestClose('modal'), false, 'a second back action must not be needed for a stale modal');
});

test('plan-ai cold-start failure restores task-menu edit feedback and allows retry', async () => {
    const runtime = createRuntime();
    runtime.openTaskMenu();

    runtime.taskEditButton.click();
    const failedAttempt = runtime.taskEditButton.pendingClick;
    assert.equal(runtime.taskEditButton.disabled, true);
    runtime.rejectNextPlanAiLoad();
    await failedAttempt;

    assert.equal(runtime.window.dataPlanAi, undefined, 'a failed load must not register plan-ai');
    assert.equal(runtime.refreshCalls, 0, 'failed loads must not refresh modules');
    assert.equal(runtime.taskEditButton.disabled, false, 'the failed attempt should re-enable editing');
    assert.equal(runtime.taskEditButton.getAttribute('aria-busy'), null);
    assert.equal(modalEntries(runtime).length, 1, 'the task menu remains the only modal after failure');
    assert.equal(runtime.toasts.at(-1)?.type, 'error');
    assert.equal(runtime.errors.at(-1)?.scope, 'lazy-plan.openPlanTaskEdit');

    runtime.taskEditButton.click();
    const retryAttempt = runtime.taskEditButton.pendingClick;
    assert.equal(runtime.taskEditButton.disabled, true, 'retry should show loading feedback again');
    runtime.resolveNextPlanAiLoad();
    await retryAttempt;

    assert.deepEqual(runtime.loadRequests, ['plan-ai', 'plan-ai']);
    assert.equal(runtime.refreshCalls, 1, 'the successful retry must use the real refreshModules implementation');
    assert.match(runtime.document.querySelector('.md-modal[data-rl-modal="1"]')?.innerHTML || '', /编辑计划动作/);
    assert.equal(modalEntries(runtime).length, 1, 'retry must also replace the old task-menu entry');
    assert.equal(runtime.executedScripts.includes('routine-library.js'), false);
});
