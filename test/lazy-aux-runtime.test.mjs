import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import path from 'node:path';

function read(file) {
    return readFileSync(path.join(process.cwd(), file), 'utf8');
}

test('focus trap installs once and can retro-attach open modals', () => {
    const source = read('a11y-focus-trap.js');
    assert.match(source, /__installed/);
    assert.match(source, /attachOpenModals/);
    assert.match(source, /themeSheet/);
    assert.match(source, /voiceSettingsSheet/);

    const listeners = [];
    const themeSheet = {
        classList: { contains: (name) => name === 'hidden' ? false : false },
        getAttribute: (name) => name === 'aria-hidden' ? 'false' : null,
        querySelector: () => ({ focus() {}, click() {} }),
        querySelectorAll: () => [],
        contains: () => false,
        focus() {},
        offsetParent: {}
    };
    const context = {
        console,
        document: {
            readyState: 'complete',
            getElementById(id) { return id === 'themeSheet' ? themeSheet : null; },
            querySelector() { return null; },
            querySelectorAll() { return []; },
            addEventListener(type, handler) { listeners.push([type, handler]); },
            removeEventListener() {},
            activeElement: null
        },
        window: {
            getComputedStyle() { return { display: 'block', visibility: 'visible' }; }
        }
    };
    context.globalThis = context;
    context.window.focusTrap = undefined;
    context.document.defaultView = context.window;
    vm.createContext(context);
    vm.runInContext(read('a11y-focus-trap.js'), context);
    const first = context.window.focusTrap;
    vm.runInContext(read('a11y-focus-trap.js'), context);
    assert.equal(context.window.focusTrap, first);
    assert.equal(typeof first.attachOpenModals, 'function');
    assert.ok(listeners.some(([type]) => type === 'keydown'));
});

test('haptics syncs immediately when document is already complete', () => {
    const calls = [];
    const input = { id: 'hapticsEnabled', checked: false };
    const context = {
        console,
        document: {
            readyState: 'complete',
            getElementById(id) { return id === 'hapticsEnabled' ? input : null; },
            addEventListener() {}
        },
        window: {
            addEventListener(type) { calls.push(type); },
            data: { db: { prefs: { haptics: false } }, save() {} },
            ui: { syncSwitchAria() {} }
        },
        navigator: { vibrate() {} },
        HTMLInputElement: class HTMLInputElement {}
    };
    context.globalThis = context;
    context.window.window = context.window;
    context.data = context.window.data;
    vm.createContext(context);
    vm.runInContext(read('haptics.js'), context);
    assert.equal(input.checked, false);
    assert.equal(calls.includes('load'), false);

    // second install path still resyncs
    context.window.data.db.prefs.haptics = true;
    vm.runInContext(read('haptics.js'), context);
    assert.equal(input.checked, true);
});

test('haptics registers one-time load listener while document is loading', () => {
    const loadHandlers = [];
    const input = { id: 'hapticsEnabled', checked: true };
    const context = {
        console,
        document: {
            readyState: 'loading',
            getElementById(id) { return id === 'hapticsEnabled' ? input : null; },
            addEventListener() {}
        },
        window: {
            addEventListener(type, handler, opts) {
                if (type === 'load') loadHandlers.push({ handler, opts });
            },
            data: { db: { prefs: { haptics: false } }, save() {} },
            ui: { syncSwitchAria() {} }
        },
        navigator: { vibrate() {} },
        HTMLInputElement: class HTMLInputElement {}
    };
    context.globalThis = context;
    context.window.window = context.window;
    context.data = context.window.data;
    vm.createContext(context);
    vm.runInContext(read('haptics.js'), context);
    assert.equal(loadHandlers.length, 1);
    assert.equal(loadHandlers[0].opts?.once, true);
    loadHandlers[0].handler();
    assert.equal(input.checked, false);
});


test('focus trap prefers topmost voice import, covers profile, and keeps keyboard loop', () => {
    const handlers = new Map();
    const opener = { focused: 0, focus() { this.focused += 1; } };
    function makeModal() {
        const modal = { open: true };
        const first = { focused: 0, offsetParent: {}, focus() { this.focused += 1; document.activeElement = this; } };
        const last = { focused: 0, offsetParent: {}, focus() { this.focused += 1; document.activeElement = this; } };
        const close = { clicks: 0, click() { this.clicks += 1; } };
        Object.assign(modal, {
            first, last, close,
            classList: { contains(name) { return name === 'hidden' ? !modal.open : false; } },
            getAttribute(name) { return name === 'aria-hidden' ? (modal.open ? 'false' : 'true') : null; },
            querySelector(selector) { return selector === '[data-modal-close]' ? close : null; },
            querySelectorAll() { return [first, last]; },
            contains(node) { return node === first || node === last; },
            focus() {}
        });
        return modal;
    }
    const settings = makeModal();
    const voiceImport = makeModal();
    const profile = makeModal();
    const document = {
        readyState: 'complete',
        activeElement: opener,
        getElementById(id) {
            return { voiceSettingsSheet: settings, voiceImportDialog: voiceImport, profileModal: profile }[id] || null;
        },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        addEventListener(type, handler) { handlers.set(type, handler); },
        removeEventListener(type, handler) { if (handlers.get(type) === handler) handlers.delete(type); }
    };
    const context = { console, document, window: { getComputedStyle() { return { display: 'block', visibility: 'visible' }; } } };
    context.globalThis = context;
    context.window.window = context.window;
    context.window.document = document;
    vm.createContext(context);
    vm.runInContext(read('a11y-focus-trap.js'), context);
    assert.equal(document.activeElement, voiceImport.first);
    document.activeElement = voiceImport.last;
    let prevented = 0;
    handlers.get('keydown')({ key: 'Tab', shiftKey: false, preventDefault() { prevented += 1; } });
    assert.equal(document.activeElement, voiceImport.first);
    handlers.get('keydown')({ key: 'Tab', shiftKey: true, preventDefault() { prevented += 1; } });
    assert.equal(document.activeElement, voiceImport.last);
    handlers.get('keydown')({ key: 'Escape', preventDefault() {} });
    assert.equal(voiceImport.close.clicks, 1);
    assert.equal(prevented, 2);
    context.window.focusTrap.release();
    assert.equal(opener.focused, 1);
    voiceImport.open = false;
    settings.open = false;
    document.activeElement = opener;
    context.window.focusTrap.attachOpenModals();
    assert.equal(document.activeElement, profile.first);
});

test('haptics disables unsupported switches and restores capability state', () => {
    const attrs = {};
    const input = {
        id: 'hapticsEnabled',
        checked: true,
        disabled: false,
        setAttribute(name, value) { attrs[name] = value; }
    };
    let ariaCalls = 0;
    const context = {
        console,
        document: {
            readyState: 'complete',
            getElementById(id) { return id === 'hapticsEnabled' ? input : null; },
            addEventListener() {}
        },
        window: {
            addEventListener() {},
            data: { db: { prefs: { haptics: true } }, save() {} },
            ui: { syncSwitchAria() { ariaCalls += 1; } }
        },
        navigator: {},
        HTMLInputElement: class HTMLInputElement {}
    };
    context.globalThis = context;
    context.window.window = context.window;
    context.data = context.window.data;
    vm.createContext(context);
    vm.runInContext(read('haptics.js'), context);
    assert.equal(input.checked, true);
    assert.equal(input.disabled, true);
    assert.equal(attrs['aria-disabled'], 'true');
    context.navigator.vibrate = () => true;
    context.window.haptics.syncToggle();
    assert.equal(input.checked, true);
    assert.equal(input.disabled, false);
    assert.equal(attrs['aria-disabled'], 'false');
    assert.equal(ariaCalls, 2);
});

test('action busy CSS belongs to the global button domain', () => {
    const buttons = read('css-src/14-components-buttons.css');
    const today = read('css-src/51-v6-today.css');
    assert.match(buttons, /\.record-quick-btn\.is-action-busy/);
    assert.match(buttons, /\.pvf-action\.is-action-busy/);
    assert.doesNotMatch(today, /is-action-busy/);
});
