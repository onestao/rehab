import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadDebugTools({ persisted = false } = {}) {
    const code = readFileSync(new URL('../debug-tools.js', import.meta.url), 'utf8');
    /** @type {Map<string, any>} */
    const elements = new Map();
    /** @type {Map<string, string>} */
    const store = new Map(persisted ? [['rehab_debug_tools', '1']] : []);
    const calls = /** @type {any} */ ({
        load: [],
        planEnable: 0,
        planDisable: 0,
        errorEnable: 0,
        errorDisable: 0,
        toast: [],
        reports: [],
        profileRenders: 0,
        adviceRenders: 0
    });

    /** @param {string} tagName */
    function makeElement(tagName) {
        const el = /** @type {any} */ ({
            tagName: String(tagName || '').toUpperCase(),
            _id: '',
            children: [],
            style: {},
            dataset: {},
            parentNode: null,
            textContent: '',
            value: '',
            appendChild(child) {
                this.children.push(child);
                child.parentNode = this;
                if (child.id) elements.set(child.id, child);
                return child;
            },
            remove() {
                if (this.id) elements.delete(this.id);
                if (this.parentNode) {
                    this.parentNode.children = this.parentNode.children.filter(child => child !== this);
                    this.parentNode = null;
                }
            },
            select() {},
            click() {}
        });
        Object.defineProperty(el, 'id', {
            get() {
                return this._id;
            },
            set(value) {
                if (this._id) elements.delete(this._id);
                this._id = String(value || '');
                if (this._id) elements.set(this._id, this);
            }
        });
        return el;
    }

    const body = makeElement('body');
    const document = {
        title: '',
        body,
        createElement: makeElement,
        getElementById(id) {
            return elements.get(id) || null;
        },
        execCommand() {
            return true;
        }
    };
    const host = {
        _debugToolsEnabled: false,
        renderProfilePage() {
            calls.profileRenders += 1;
        },
        rerenderAdvicePanel() {
            calls.adviceRenders += 1;
        }
    };
    const localStorage = {
        getItem(key) {
            return store.get(key) || null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        },
        removeItem(key) {
            store.delete(key);
        }
    };
    const window = {
        data: host,
        navigator: {},
        loadAppScript(name) {
            calls.load.push(name);
            return Promise.resolve();
        },
        planAiDebug: {
            enable() {
                calls.planEnable += 1;
            },
            disable() {
                calls.planDisable += 1;
            }
        },
        errorBus: {
            enableDebug() {
                calls.errorEnable += 1;
            },
            disableDebug() {
                calls.errorDisable += 1;
            },
            getDebugScopeFilter() {
                return '';
            },
            list() {
                return [];
            },
            listDebug() {
                return [];
            },
            report(scope, err, meta) {
                calls.reports.push({ scope, message: String(err?.message || err), meta });
            }
        },
        toast: {
            show(message) {
                calls.toast.push(message);
            }
        },
        alert(message) {
            calls.alert = message;
        }
    };
    const sandbox = {
        window,
        document,
        localStorage,
        navigator: window.navigator,
        console,
        Date,
        JSON,
        Promise,
        Map,
        Blob: class Blob {},
        URL: {
            createObjectURL() {
                return 'blob:debug';
            },
            revokeObjectURL() {}
        },
        setTimeout(fn) {
            fn();
            return 1;
        }
    };
    vm.runInNewContext(code, sandbox);
    return { tools: window.debugTools, host, calls, elements, store };
}

test('debug tools init stays inert until persisted debug is enabled', async () => {
    const { tools, host, calls, elements } = loadDebugTools();

    const enabled = await tools.init(host);

    assert.equal(enabled, false);
    assert.equal(host._debugToolsEnabled, false);
    assert.deepEqual(calls.load, []);
    assert.equal(elements.has('adviceDebugFab'), false);
});

test('debug tools toggle lazily loads debug extensions and cleans up on disable', async () => {
    const { tools, host, calls, elements, store } = loadDebugTools();

    const enabled = await tools.toggle(host);

    assert.equal(enabled, true);
    assert.equal(host._debugToolsEnabled, true);
    assert.equal(store.get('rehab_debug_tools'), '1');
    assert.deepEqual(calls.load, ['debug-plan-ai']);
    assert.equal(calls.planEnable, 1);
    assert.equal(calls.errorEnable, 1);
    assert.equal(elements.has('adviceDebugFab'), true);

    const disabled = await tools.toggle(host);

    assert.equal(disabled, false);
    assert.equal(host._debugToolsEnabled, false);
    assert.equal(store.has('rehab_debug_tools'), false);
    assert.equal(calls.planDisable, 1);
    assert.equal(calls.errorDisable, 1);
    assert.equal(elements.has('adviceDebugFab'), false);
});

test('debug tools lets future debug extensions join the same lifecycle', async () => {
    const { tools, host } = loadDebugTools();
    const events = [];

    tools.registerExtension({
        name: 'custom-debug',
        enable() {
            events.push('enable');
        },
        disable() {
            events.push('disable');
        }
    });

    await tools.toggle(host);
    await tools.toggle(host);

    assert.deepEqual(events, ['enable', 'disable']);
});
