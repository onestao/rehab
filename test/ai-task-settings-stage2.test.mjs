// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const code = readFileSync(new URL('../ai-task-settings.js', import.meta.url), 'utf8');

function memoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    const writes = [];
    return {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { writes.push(key); values.set(key, String(value)); },
        keys() { return [...values.keys()]; },
        writes
    };
}

function load(storage) {
    const root = {
        document: { readyState: 'loading', addEventListener() {}, getElementById() { return null; } },
        addEventListener() {},
        aiModelVisual: { resolve() { return { iconSrcs: [], theme: {} }; } }
    };
    root.window = root;
    vm.runInNewContext(code, { window: root, document: root.document, localStorage: storage, CustomEvent: class CustomEvent {} });
    return root.aiTaskSettings;
}

class PickerElement {
    constructor(tagName = 'div', content = '') {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.dataset = {};
        this.style = { setProperty() {} };
        this.attributes = {};
        this.className = '';
        this._textContent = content;
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
    get textContent() { return this._textContent || this.children.map(child => child?.textContent || '').join(''); }
    set textContent(value) { this._textContent = String(value); this.children = []; }
    append(...children) { this._textContent = ''; this.children.push(...children.filter(child => child != null)); }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    addEventListener(type, listener) { this._listeners[type] = listener; }
    focus() {}
}

function findPickerElements(node, predicate) {
    return [...(predicate(node) ? [node] : []), ...(node?.children || []).flatMap(child => findPickerElements(child, predicate))];
}

async function loadPicker(storage, setTaskRoute) {
    const container = new PickerElement('div');
    const sheet = new PickerElement('div');
    const card = new PickerElement('div');
    const heading = new PickerElement('strong');
    const close = new PickerElement('button');
    const body = new PickerElement('div');
    const toasts = [];
    sheet.querySelector = selector => ({ '.md-modal-sheet-card': card, '.md-modal-head strong': heading, '[data-modal-close]': close })[selector] || null;
    const document = {
        readyState: 'loading',
        fonts: { ready: Promise.resolve() },
        getElementById(id) { return ({ aiModelPickerSheet: sheet, aiModelPickerContent: body })[id] || null; },
        createElement(tagName) { return new PickerElement(tagName); },
        createTextNode(content) { return new PickerElement('#text', String(content)); },
        addEventListener() {}
    };
    const root = {
        document,
        ai: {
            async getTaskDefinitions() { return [{ id: 'plan.today', label: '今日计划' }]; },
            async getTaskRoute() { return {}; },
            async listSelectableModels() { return [{ profileId: 'p1', profileName: 'Primary', modelId: 'model-1', capabilityState: 'compatible' }]; },
            setTaskRoute
        },
        aiModelVisual: { resolve() { return { iconSrcs: [], mark: 'AI', theme: {} }; } },
        toast: { show(...args) { toasts.push(args); } },
        ResizeObserver: class ResizeObserver { observe() {} },
        requestAnimationFrame(callback) { callback(); },
        addEventListener() {},
        dispatchEvent() {}
    };
    root.window = root;
    vm.runInNewContext(code, { window: root, document, localStorage: storage, CustomEvent: class CustomEvent {} });
    await root.aiTaskSettings.mountInlinePicker(container, 'plan.today');
    findPickerElements(container, node => node.className.includes('ai-compact-model'))[0]._listeners.click();
    const choice = findPickerElements(body, node => node.className === 'ai-task-model-main')[0];
    return { choice, sheet, toasts };
}

test('shared favorites and recents expose defensive profile-qualified task-scoped values', () => {
    const storage = memoryStorage({
        'rehab.ai.modelFavorites.v2': JSON.stringify(['p1::shared', 'p1::shared', 'invalid']),
        'rehab.ai.modelRecents.v1': JSON.stringify({
            'advice.chat': ['p-chat::one', 'p-chat::two', 'p-chat::one', 'p-chat::three', 'p-chat::four'],
            'advice.vision': ['p-vision::image']
        })
    });
    const api = load(storage);
    assert.deepEqual([...api.favoriteKeys()], ['p1::shared']);
    assert.deepEqual(Array.from(api.recentKeysForTask('advice.chat')), ['p-chat::one', 'p-chat::two', 'p-chat::three']);
    assert.deepEqual(Array.from(api.recentKeysForTask('advice.vision')), ['p-vision::image']);
    const favorites = api.favoriteKeys();
    favorites.add('local::mutation');
    assert.deepEqual([...api.favoriteKeys()], ['p1::shared']);
});

test('rememberRecent keeps three stable entries per task without adding storage keys', () => {
    const storage = memoryStorage({
        'rehab.ai.modelFavorites.v2': '[]',
        'rehab.ai.modelRecents.v1': JSON.stringify({ 'advice.vision': ['p-vision::image'] })
    });
    const api = load(storage);
    api.rememberRecent('advice.chat', { profileId: 'p-chat', modelId: 'one' });
    api.rememberRecent('advice.chat', { profileId: 'p-chat', modelId: 'two' });
    api.rememberRecent('advice.chat', { profileId: 'p-chat', modelId: 'three' });
    api.rememberRecent('advice.chat', { profileId: 'p-chat', modelId: 'one' });
    api.rememberRecent('', { profileId: 'bad', modelId: 'ignored' });
    const recents = JSON.parse(storage.getItem('rehab.ai.modelRecents.v1'));
    assert.deepEqual(recents['advice.chat'], ['p-chat::one', 'p-chat::three', 'p-chat::two']);
    assert.deepEqual(recents['advice.vision'], ['p-vision::image']);
    assert.deepEqual(storage.keys().sort(), ['rehab.ai.modelFavorites.v2', 'rehab.ai.modelRecents.v1']);
});

test('preference facade degrades safely for malformed or unavailable storage', () => {
    const malformed = load(memoryStorage({
        'rehab.ai.modelFavorites.v2': JSON.stringify({ bad: true }),
        'rehab.ai.modelRecents.v1': '{broken'
    }));
    assert.deepEqual([...malformed.favoriteKeys()], []);
    assert.deepEqual(Array.from(malformed.recentKeysForTask('advice.chat')), []);
    const blocked = load({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
    assert.doesNotThrow(() => blocked.favoriteKeys());
    assert.doesNotThrow(() => blocked.recentKeysForTask('advice.chat'));
    assert.doesNotThrow(() => blocked.rememberRecent('advice.chat', { profileId: 'p', modelId: 'm' }));
});

test('compact picker records recents and toasts only after one successful route save', async () => {
    const pendingStorage = memoryStorage();
    let saveCalls = 0;
    let resolveSave;
    const pending = await loadPicker(pendingStorage, () => {
        saveCalls += 1;
        return new Promise(resolve => { resolveSave = resolve; });
    });
    const first = pending.choice._listeners.click();
    const duplicate = pending.choice._listeners.click();
    assert.equal(saveCalls, 1);
    assert.deepEqual(pendingStorage.writes, []);
    assert.deepEqual(pending.toasts, []);
    assert.equal(pending.sheet.classList.contains('hidden'), false);
    resolveSave();
    await Promise.all([first, duplicate]);
    assert.deepEqual(pendingStorage.writes, ['rehab.ai.modelRecents.v1']);
    assert.deepEqual(pending.toasts, [['已切换至 model-1', 'success']]);
    assert.equal(pending.sheet.classList.contains('hidden'), true);

    const rejectedStorage = memoryStorage();
    const rejected = await loadPicker(rejectedStorage, () => Promise.reject(new Error('route save failed')));
    await assert.rejects(Promise.resolve(rejected.choice._listeners.click()), /route save failed/);
    assert.deepEqual(rejectedStorage.writes, []);
    assert.deepEqual(rejected.toasts, []);
    assert.equal(rejected.sheet.classList.contains('hidden'), false);
});
