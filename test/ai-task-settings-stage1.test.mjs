// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const taskSettingsCode = readFileSync(new URL('../ai-task-settings.js', import.meta.url), 'utf8');

class FakeElement {
    constructor(tagName = 'div', textContent) {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.dataset = {};
        this.style = { setProperty() {} };
        this.attributes = {};
        this.className = '';
        this.hidden = false;
        this._textContent = textContent;
        this._listeners = {};
        const classes = new Set();
        this.classList = {
            add: (...names) => names.forEach(name => classes.add(name)),
            remove: (...names) => names.forEach(name => classes.delete(name)),
            contains: name => classes.has(name),
            toggle: (name, force) => {
                const next = force == null ? !classes.has(name) : Boolean(force);
                if (next) classes.add(name); else classes.delete(name);
                return next;
            }
        };
    }
    get textContent() { return this._textContent ?? this.children.map(child => child?.textContent || '').join(''); }
    set textContent(value) { this._textContent = String(value); this.children = []; }
    append(...children) {
        this._textContent = undefined;
        children.forEach(child => {
            if (child?.isFragment) this.children.push(...child.children);
            else if (child != null) this.children.push(child);
        });
    }
    replaceChildren(...children) { this.children = []; this._textContent = undefined; this.append(...children); }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    addEventListener(type, listener) { this._listeners[type] = listener; }
    focus() {}
}

function findElements(node, predicate) {
    return [...(predicate(node) ? [node] : []), ...(node?.children || []).flatMap(child => findElements(child, predicate))];
}

function loadTaskSettingsUi(definitions, options = {}) {
    const container = new FakeElement('div');
    const sheet = new FakeElement('div');
    const card = new FakeElement('div');
    const heading = new FakeElement('strong');
    const close = new FakeElement('button');
    const body = new FakeElement('div');
    sheet.querySelector = selector => ({ '.md-modal-sheet-card': card, '.md-modal-head strong': heading, '[data-modal-close]': close })[selector] || null;
    const calls = [];
    const document = {
        readyState: 'loading',
        fonts: { ready: Promise.resolve() },
        getElementById(id) {
            return ({ aiTaskSettingsMatrix: container, aiModelPickerSheet: sheet, aiModelPickerContent: body })[id] || null;
        },
        createElement(tagName) { return new FakeElement(tagName); },
        createDocumentFragment() { const fragment = new FakeElement('#fragment'); fragment.isFragment = true; return fragment; },
        createTextNode(content) { return new FakeElement('#text', String(content)); },
        addEventListener() {}
    };
    const root = {
        document,
        ai: {
            async getTaskDefinitions() { calls.push('definitions'); return definitions; },
            async getTaskRoute(taskId) { calls.push(`route:${taskId}`); return options.routes?.[taskId] || {}; },
            async listSelectableModels(taskId) { calls.push(`models:${taskId}`); return options.models?.[taskId] || []; },
            async setTaskRoute(...args) { return options.setTaskRoute?.(...args); }
        },
        aiModelVisual: {
            resolve() { return { iconSrcs: [], mark: 'AI', theme: {} }; }
        },
        ResizeObserver: class ResizeObserver { observe() {} },
        requestAnimationFrame(callback) { callback(); },
        addEventListener() {},
        dispatchEvent() {}
    };
    root.window = root;
    vm.runInNewContext(taskSettingsCode, {
        window: root,
        document,
        localStorage: options.storage || { getItem() { return null; }, setItem() {} },
        CustomEvent: class CustomEvent {}
    });
    return { api: root.aiTaskSettings, calls, container, sheet, body };
}

test('task settings preserve registry groups and first-seen task order', async () => {
    const { api, container } = loadTaskSettingsUi([
        { id: 'plan.today', label: '安排', group: '训练计划' },
        { id: 'advice.chat', label: '同步聊天', group: '建议' },
        { id: 'plan.week', label: '周计划', group: '训练计划' }
    ]);
    await api.render();
    assert.deepEqual(container.children.map(group => group.children[0]?.textContent), ['训练计划', '建议']);
    assert.deepEqual(container.children.map(group => findElements(group, node => node.dataset?.taskId).map(node => node.dataset.taskId)), [['plan.today', 'plan.week'], ['advice.chat']]);
});

test('localPicker false and unknown tasks leave inline hosts untouched', async () => {
    const { api, calls } = loadTaskSettingsUi([{ id: 'food.text', label: '食物', localPicker: false }]);
    const disabledHost = new FakeElement('div', '已有内容');
    const unknownHost = new FakeElement('div', '未知内容');
    await api.mountInlinePicker(disabledHost, 'food.text');
    await api.mountInlinePicker(unknownHost, 'missing.task');
    assert.deepEqual(calls, ['definitions', 'definitions']);
    assert.equal(disabledHost.textContent, '已有内容');
    assert.equal(unknownHost.textContent, '未知内容');
});

test('task model picker shows advisory capability states without filtering', async () => {
    const models = { 'advice.chat': [
        { profileId: 'p1', profileName: 'Compatible', modelId: 'text', capabilityState: 'compatible' },
        { profileId: 'p2', profileName: 'Unknown', modelId: 'unknown', capabilityState: 'unexpected' },
        { profileId: 'p3', profileName: 'Incompatible', modelId: 'bad', capabilityState: 'incompatible' }
    ] };
    const { api, body } = loadTaskSettingsUi([{ id: 'advice.chat', label: '聊天' }], { models });
    const host = new FakeElement('div');
    await api.mountInlinePicker(host, 'advice.chat');
    findElements(host, node => node.className.includes('ai-compact-model'))[0]._listeners.click();
    const choices = findElements(body, node => node.className === 'ai-task-model-main');
    assert.equal(choices.length, 3);
    assert.deepEqual(choices.map(choice => choice.dataset.capabilityState), ['compatible', 'unknown', 'incompatible']);
    assert.deepEqual(choices.map(choice => findElements(choice, node => node.className.startsWith('ai-task-model-capability'))[0]?.textContent), ['能力兼容', '能力未知', '能力不兼容']);
});

test('incompatible selection reuses the existing sheet and saves once only after confirmation', async () => {
    let saves = 0;
    const models = { 'advice.chat': [{ profileId: 'p1', profileName: 'Bad', modelId: 'bad', capabilityState: 'incompatible' }] };
    const { api, body } = loadTaskSettingsUi([{ id: 'advice.chat', label: '聊天' }], { models, async setTaskRoute() { saves += 1; } });
    const host = new FakeElement('div');
    await api.mountInlinePicker(host, 'advice.chat');
    findElements(host, node => node.className.includes('ai-compact-model'))[0]._listeners.click();
    await findElements(body, node => node.className === 'ai-task-model-main')[0]._listeners.click();
    assert.equal(saves, 0);
    const confirm = findElements(body, node => node.className.includes('ai-task-compatibility-confirm'))[0];
    assert.ok(confirm);
    await Promise.all([confirm._listeners.click(), confirm._listeners.click()]);
    assert.equal(saves, 1);
});
