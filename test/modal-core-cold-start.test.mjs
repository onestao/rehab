// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

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
        this._listeners = {};
        this._innerHTML = '';
        this._closeButtons = [];
        this._okButton = null;
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
        if (this._innerHTML.includes('data-rl-ok')) {
            this._okButton = new FakeElement('button');
            this._okButton.setAttribute('data-rl-ok', '');
        } else {
            this._okButton = null;
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

    addEventListener(type, listener) {
        this._listeners[type] = listener;
    }

    click() {
        this._listeners.click?.({ preventDefault() {} });
    }

    focus() {}

    querySelectorAll(selector) {
        if (selector === '[data-modal-close]') return this._closeButtons;
        if (selector === '.model-picker-row') return [];
        return [];
    }

    querySelector(selector) {
        if (selector === '[data-rl-ok]') return this._okButton;
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

function createRuntime(options = {}) {
    const executedScripts = [];
    const loadRequests = [];
    const errors = [];
    const toasts = [];
    const navEvents = [];
    const focusEvents = [];
    const body = new FakeElement('body');
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
        querySelectorAll() { return []; },
        getElementById(id) { return body.children.find(node => node.id === id) || null; }
    };
    const window = {
        navStack: {
            push(entry) { navEvents.push(['push', entry.type]); },
            popType(type) { navEvents.push(['popType', type]); },
            requestClose(type) { navEvents.push(['requestClose', type]); return false; }
        },
        focusTrap: {
            trap(root) { focusEvents.push(['trap', root]); },
            release() { focusEvents.push(['release']); }
        },
        errorBus: { report(scope, error, meta) { errors.push({ scope, error, meta }); } },
        toast: { show(message, type) { toasts.push({ message, type }); } },
        dataPlanAi: { searchPlanActionChoices() {} },
        loadAppScript(name) {
            loadRequests.push(name);
            return Promise.reject(new Error(`unexpected lazy request: ${name}`));
        }
    };
    const context = {
        window,
        document,
        console,
        Element: FakeElement,
        HTMLElement: FakeElement,
        requestAnimationFrame(callback) { callback(); },
        setTimeout,
        clearTimeout
    };
    context.globalThis = context;
    vm.createContext(context);

    const execute = (file) => {
        executedScripts.push(file);
        vm.runInContext(read(file), context, { filename: file });
    };
    if (options.withUiState !== false) execute('data-ui-state.js');
    if (options.visit && options.visit !== 'today') execute('routine-library.js');
    execute('plan-ui.js');

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
    const modules = [window.dataUiState, window.dataRoutineLibrary, window.dataPlanUi].filter(Boolean);
    const data = Object.assign({}, ...modules, {
        db: { dailyPlans: [plan] },
        escapeHtml,
        activeRecords(records) { return (records || []).filter(record => record && !record.deleted); },
        findTask(planId, taskId) {
            const foundPlan = this.db.dailyPlans.find(item => item.id === planId);
            return { plan: foundPlan, task: foundPlan?.items.find(item => item.id === taskId) };
        },
        dateKey() { return '2026-07-17'; },
        logicalDateKey() { return '2026-07-16'; },
        planTypeMeta() { return { label: '康复' }; },
        updateItemStatus() {},
        render() {},
        save() {},
        touchRecord() {},
        ensurePlanPrefs() { return {}; }
    });
    window.data = data;
    context.data = data;
    return { data, plan, document, executedScripts, loadRequests, errors, toasts, navEvents, focusEvents };
}

test('today cold start opens task drawer and task menu without loading routine-library', () => {
    const runtime = createRuntime({ visit: 'today' });

    runtime.data.openPlanTaskDrawer(runtime.plan.id);
    assert.ok(runtime.document.getElementById('planTaskDrawer'));

    runtime.data.openPlanTaskMenu(runtime.plan.id, runtime.plan.items[0].id);
    const modal = runtime.document.querySelector('.md-modal[data-rl-modal="1"]');
    assert.ok(modal, 'task menu should open from a clean today start');
    assert.match(modal.innerHTML, /肩关节活动/);
    assert.equal(runtime.executedScripts.includes('routine-library.js'), false);
    assert.deepEqual(runtime.loadRequests, []);
});

test('modal core supports edit, cancel confirmation and guarded completion without profile', async () => {
    const runtime = createRuntime({ visit: 'today' });
    const taskId = runtime.plan.items[0].id;

    await runtime.data.openPlanTaskEdit(runtime.plan.id, taskId);
    assert.match(runtime.document.querySelector('.md-modal[data-rl-modal="1"]').innerHTML, /编辑计划动作/);

    runtime.data.cancelDailyPlanConfirm(runtime.plan.id);
    assert.match(runtime.document.querySelector('.md-modal[data-rl-modal="1"]').innerHTML, /取消今日计划/);

    runtime.data.markPlanTaskDone(runtime.plan.id, taskId);
    assert.match(runtime.document.querySelector('.md-modal[data-rl-modal="1"]').innerHTML, /确认并完成/);
    assert.deepEqual(runtime.loadRequests, []);
});

test('today task menu behavior is independent of prior route order', () => {
    for (const visit of ['today', 'records', 'profile', 'ai']) {
        const runtime = createRuntime({ visit });
        runtime.data.openPlanTaskMenu(runtime.plan.id, runtime.plan.items[0].id);
        assert.ok(
            runtime.document.querySelector('.md-modal[data-rl-modal="1"]'),
            `${visit} -> today should open the same task menu`
        );
    }
});

test('modal core keeps nav stack, focus trap, backdrop close and focus release behavior', () => {
    const runtime = createRuntime({ visit: 'today' });
    runtime.data.openPlanTaskMenu(runtime.plan.id, runtime.plan.items[0].id);
    const modal = runtime.document.querySelector('.md-modal[data-rl-modal="1"]');

    assert.deepEqual(runtime.navEvents[0], ['push', 'modal']);
    assert.ok(runtime.focusEvents.some(event => event[0] === 'trap'));
    modal.querySelectorAll('[data-modal-close]')[0].click();
    assert.equal(runtime.document.querySelector('.md-modal[data-rl-modal="1"]'), null);
    assert.ok(runtime.navEvents.some(event => event[0] === 'requestClose'));
    assert.ok(runtime.focusEvents.some(event => event[0] === 'release'));
});

test('missing required modal core fails explicitly instead of silently skipping the action', () => {
    const runtime = createRuntime({ visit: 'today' });
    delete runtime.data._openModal;

    assert.throws(
        () => runtime.data.openPlanTaskMenu(runtime.plan.id, runtime.plan.items[0].id),
        /_openModal|not a function/
    );
    assert.equal(runtime.document.querySelector('.md-modal[data-rl-modal="1"]'), null);
});

test('modal core has one owner and plan-ui has no hidden routine-library dependency', () => {
    const uiState = read('data-ui-state.js');
    const routine = read('routine-library.js');
    const planUi = read('plan-ui.js');
    const index = read('index.html');
    const errorBus = read('error-bus.js');
    const combinedOwners = `${uiState}\n${routine}`;

    for (const method of ['_openModal', '_confirmModal', '_closeActiveModal', '_closeActiveModalInternal']) {
        const definitions = combinedOwners.match(new RegExp(`\\n\\s*${method}\\s*\\(`, 'g')) || [];
        assert.equal(definitions.length, 1, `${method} must have one implementation`);
        assert.doesNotMatch(routine, new RegExp(`\\n\\s*${method}\\s*\\(`));
        assert.match(uiState, new RegExp(`\\n\\s*${method}\\s*\\(`));
    }

    assert.doesNotMatch(planUi, /this\._(?:openModal|confirmModal|closeActiveModal)\?\./);
    const planPrereqs = index.match(/'plan-ui':\s*\[([^\]]*)\]/)?.[1] || '';
    assert.doesNotMatch(planPrereqs, /routine-library/);
    assert.ok(index.indexOf('data-ui-state.js') < index.indexOf('data.js'));
    assert.doesNotMatch(`${uiState}\n${planUi}\n${routine}`, /new MutationObserver/);
    assert.match(errorBus, /window\.addEventListener\('error'/);
    assert.match(errorBus, /safeToast\(item\.message\)/);
});
