/**
 * H2 unit: browser vs PWA back semantics + stack frame close order.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadNav({ standalone = false } = {}) {
    const history = {
        /** @type {any} */
        state: null,
        /** @type {any[]} */
        stack: [],
        /** @type {number[]} */
        goCalls: [],
        replaceState(state) { this.state = state; },
        pushState(state) {
            this.state = state;
            this.stack.push(state);
        },
        back() {
            this.stack.pop();
            this.state = this.stack[this.stack.length - 1] || { navRoot: true, navIndex: 0 };
        },
        go(delta) {
            this.goCalls.push(delta);
            const count = Math.max(0, -Number(delta || 0));
            this.stack.splice(Math.max(0, this.stack.length - count), count);
            this.state = this.stack[this.stack.length - 1] || { navRoot: true, navIndex: 0 };
        }
    };
    const closed = [];
    const context = {
        console,
        history,
        window: {
            matchMedia(q) {
                return {
                    matches: standalone && (String(q).includes('standalone') || String(q).includes('minimal-ui'))
                };
            },
            navigator: { standalone },
            addEventListener() {},
            ui: {
                _activateTab() {}
            },
            workout: { isPlaying: false },
            workoutSystem: null
        },
        document: {
            querySelector() { return null; }
        },
        setTimeout(fn) { fn(); return 1; }
    };
    context.window.history = history;
    context.window.window = context.window;
    context.window.document = context.document;
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(root, 'nav-stack.js'), 'utf8'), context);
    const nav = context.window.navStack;
    nav.init();
    return { nav, history, closed, context };
}

test('H2 unit: browser mode allows root leave without infinite push', () => {
    const { nav, history } = loadNav({ standalone: false });
    assert.equal(nav.mode, 'browser');
    const pushesBefore = history.stack.length;
    nav._onPopState({});
    // At root in browser mode: no forced re-push.
    assert.equal(history.stack.length, pushesBefore);
});

test('H2 unit: pwa mode re-pushes root on pop at today', () => {
    const { nav, history } = loadNav({ standalone: true });
    assert.equal(nav.mode, 'pwa');
    const pushesBefore = history.stack.length;
    nav._onPopState({});
    assert.ok(history.stack.length > pushesBefore || history.state?.navRoot === true);
});

test('H2 unit: popstate closes top modal frame first', () => {
    const { nav } = loadNav({ standalone: false });
    let modalClosed = false;
    nav.push({
        type: 'tab',
        id: 'profile',
        close: () => true
    });
    nav.push({
        type: 'modal',
        id: 'sheet-1',
        close: () => {
            modalClosed = true;
            return true;
        }
    });
    assert.equal(nav.top().type, 'modal');
    nav._onPopState({});
    assert.equal(modalClosed, true);
    assert.equal(nav.top().type, 'tab');
});

test('H2 unit: source documents browser vs pwa contract', () => {
    const src = fs.readFileSync(path.join(root, 'nav-stack.js'), 'utf8');
    assert.match(src, /mode:\s*'browser'|mode = isStandaloneDisplay/);
    assert.match(src, /pwa/);
    assert.match(src, /isStandaloneDisplay/);
});


test('Android back closes nested settings panel before its manager', () => {
    const { nav } = loadNav({ standalone: false });
    const closed = [];
    nav.open('modal', 'searchProviderManager', () => { closed.push('manager'); return true; });
    nav.open('panel', 'searchProviderEditor', () => { closed.push('editor'); return true; });

    nav._onPopState({});
    assert.deepEqual(closed, ['editor']);
    assert.equal(nav.top().id, 'searchProviderManager');

    nav._onPopState({});
    assert.deepEqual(closed, ['editor', 'manager']);
    assert.equal(nav.top().id, 'today');
});

test('explicit close of a settings manager clears its nested panel in one history jump', () => {
    const { nav, history } = loadNav({ standalone: false });
    let managerClosed = 0;
    let editorClosed = 0;
    nav.open('modal', 'aiProviderManager', () => { managerClosed += 1; return true; });
    nav.open('panel', 'aiProviderManagerPanel', () => { editorClosed += 1; return true; });

    assert.equal(nav.close('modal', 'aiProviderManager'), true);
    assert.equal(managerClosed, 1);
    assert.equal(editorClosed, 0, 'closing the manager owns cleanup of its internal panel DOM');
    assert.equal(nav.top().id, 'today');
    assert.deepEqual(history.goCalls, [-2]);
});

test('reopening the same layer refreshes its close callback without duplicate frames', () => {
    const { nav } = loadNav({ standalone: false });
    const closed = [];
    nav.open('modal', 'themeSheet', () => { closed.push('old'); return true; });
    nav.open('modal', 'themeSheet', () => { closed.push('new'); return true; });
    assert.equal(nav.stack.filter(entry => entry.id === 'themeSheet').length, 1);
    nav._onPopState({});
    assert.deepEqual(closed, ['new']);
});
