// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

function createElement(tagName = 'div') {
    const element = {
        tagName,
        id: '',
        className: '',
        textContent: '',
        type: '',
        dataset: {},
        children: [],
        _innerHTML: '',
        onclick: null,
        classList: {
            values: new Set(),
            add(value) { this.values.add(value); },
            remove(value) { this.values.delete(value); },
            contains(value) { return this.values.has(value); }
        },
        appendChild(child) {
            this.children.push(child);
            if (child.id) elements.set(child.id, child);
            return child;
        }
    };
    Object.defineProperty(element, 'innerHTML', {
        get() { return this._innerHTML; },
        set(value) {
            this._innerHTML = String(value || '');
            this.children = [];
        }
    });
    return element;
}

const elements = new Map();

function loadToast() {
    elements.clear();
    const sandbox = {
        window: {},
        document: {
            body: {
                appendChild(child) {
                    if (child.id) elements.set(child.id, child);
                    return child;
                }
            },
            createElement,
            getElementById(id) {
                return elements.get(id) || null;
            }
        },
        setTimeout: () => 1,
        clearTimeout: () => {}
    };
    vm.runInNewContext(readFileSync(new URL('../toast.js', import.meta.url), 'utf8'), sandbox);
    return sandbox.window.toast;
}

test('toast renders multiple action buttons and dispatches their callbacks', () => {
    const toast = loadToast();
    const clicked = [];

    toast.show('需要处理', 'info', {
        timeout: 5000,
        actions: [
            { label: '撤销', onClick: () => clicked.push('undo') },
            { label: '重试 AI', onClick: () => clicked.push('retry') }
        ]
    });

    const toastEl = elements.get('appToast');
    const buttons = toastEl.children.filter((child) => child.tagName === 'button');
    assert.deepEqual(buttons.map((button) => button.textContent), ['撤销', '重试 AI']);

    buttons[0].onclick();
    buttons[1].onclick();

    assert.deepEqual(clicked, ['undo', 'retry']);
    assert.equal(toastEl.classList.contains('show'), false);
});

test('toast keeps legacy single-action call shapes clickable', () => {
    const toast = loadToast();
    const clicked = [];

    toast.show('第三参对象', 'info', {
        timeout: 5000,
        action: '撤销',
        onAction: () => clicked.push('third-arg')
    });
    let toastEl = elements.get('appToast');
    let buttons = toastEl.children.filter((child) => child.tagName === 'button');
    assert.deepEqual(buttons.map((button) => button.textContent), ['撤销']);
    buttons[0].onclick();

    toast.show('第四参对象', 'success', 5000, {
        label: '撤销',
        onClick: () => clicked.push('fourth-arg')
    });
    toastEl = elements.get('appToast');
    buttons = toastEl.children.filter((child) => child.tagName === 'button');
    assert.deepEqual(buttons.map((button) => button.textContent), ['撤销']);
    buttons[0].onclick();

    assert.deepEqual(clicked, ['third-arg', 'fourth-arg']);
});
