// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

await import(`../ai-model-visual.js?test=${Date.now()}`);
await import(`../ai-task-settings.js?test=${Date.now()}`);

const helpers = globalThis.aiTaskSettings._test;
const taskSettingsCode = readFileSync(new URL('../ai-task-settings.js', import.meta.url), 'utf8');

class FakeElement {
    constructor(tagName = 'div', options = {}) {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.dataset = {};
        this.style = { setProperty() {} };
        this.attributes = {};
        this.className = '';
        this.isFragment = options.fragment === true;
        this._textContent = options.textContent;
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

    get textContent() {
        if (this._textContent != null) return this._textContent;
        return this.children.map(child => child?.textContent || '').join('');
    }

    set textContent(value) {
        this._textContent = String(value);
        this.children = [];
    }

    append(...children) {
        this._textContent = null;
        children.forEach(child => {
            if (child?.isFragment) this.children.push(...child.children);
            else if (child != null) this.children.push(child);
        });
    }

    replaceChildren(...children) {
        this.children = [];
        this._textContent = null;
        this.append(...children);
    }

    setAttribute(name, value) {
        this.attributes[name] = String(value);
    }

    addEventListener(type, listener) {
        this._listeners[type] = listener;
    }
}

function collectTaskIds(node) {
    return (node?.children || []).flatMap(child => [
        ...(child?.dataset?.taskId ? [child.dataset.taskId] : []),
        ...collectTaskIds(child)
    ]);
}

function findElements(node, predicate) {
    return [
        ...(predicate(node) ? [node] : []),
        ...(node?.children || []).flatMap(child => findElements(child, predicate))
    ];
}

function createMemoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    const writes = [];
    return {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) {
            writes.push(String(key));
            values.set(key, String(value));
        },
        keys() { return [...values.keys()]; },
        writes
    };
}

function loadTaskSettingsUi(definitions, options = {}) {
    const container = options.container || new FakeElement('div');
    const quickSheet = new FakeElement('div');
    const quickSheetCard = new FakeElement('div');
    const quickSheetHeading = new FakeElement('strong');
    const quickSheetClose = new FakeElement('button');
    const quickSheetBody = new FakeElement('div');
    quickSheetClose.focus = () => {};
    quickSheet.querySelector = selector => ({
        '.md-modal-sheet-card': quickSheetCard,
        '.md-modal-head strong': quickSheetHeading,
        '[data-modal-close]': quickSheetClose
    })[selector] || null;
    const calls = [];
    const document = {
        readyState: 'loading',
        fonts: { ready: Promise.resolve() },
        getElementById(id) {
            if (id === 'aiTaskSettingsMatrix') return container;
            if (id === 'aiModelPickerSheet') return quickSheet;
            if (id === 'aiModelPickerContent') return quickSheetBody;
            return null;
        },
        createElement(tagName) { return new FakeElement(tagName); },
        createDocumentFragment() { return new FakeElement('#fragment', { fragment: true }); },
        createTextNode(content) { return new FakeElement('#text', { textContent: String(content) }); },
        addEventListener() {}
    };
    const root = {
        document,
        ai: {
            async getTaskDefinitions() { calls.push('getTaskDefinitions'); return definitions; },
            async getTaskRoute(taskId) { calls.push(`getTaskRoute:${taskId}`); return options.routes?.[taskId] || {}; },
            async listSelectableModels(taskId) { calls.push(`listSelectableModels:${taskId}`); return options.models?.[taskId] || []; },
            async setTaskRoute(...args) { return options.setTaskRoute?.(...args); }
        },
        aiModelVisual: {
            modelLabelCandidates(model = {}) {
                const name = String(model.modelId || model.id || model.displayName || '模型');
                return { full: name, compact: name, custom: false, id: name };
            },
            resolve() { return { iconSrcs: [], mark: 'AI', theme: {} }; }
        },
        ResizeObserver: class ResizeObserver { observe() {} },
        requestAnimationFrame(callback) { callback(); },
        addEventListener() {},
        dispatchEvent() {}
    };
    root.window = root;
    const sandbox = {
        window: root,
        document,
        localStorage: options.storage || createMemoryStorage(),
        CustomEvent: class CustomEvent {}
    };
    vm.runInNewContext(taskSettingsCode, sandbox);
    return { api: root.aiTaskSettings, calls, container, quickSheet, quickSheetBody };
}

test('normalizes array and object task definitions', () => {
    assert.deepEqual(
        helpers.normalizeTaskDefinitions({
            'food.text': { label: 'Food text', hint: 'Fast parse' },
            empty: null
        }),
        [
            { id: 'food.text', label: 'Food text', hint: 'Fast parse', description: 'Fast parse' },
            { id: 'empty', label: 'empty', description: '' }
        ]
    );
    assert.equal(helpers.normalizeTaskDefinitions([{ taskId: 'plan.week', name: 'Week plan' }])[0].id, 'plan.week');
});

test('task settings render grouped containers instead of a flat task-row list', async () => {
    const { api, container } = loadTaskSettingsUi([
        { id: 'plan.today', label: '安排', group: '训练计划', requiredCapabilities: ['text', 'json'] },
        { id: 'advice.chat', label: '同步聊天', group: '建议', requiredCapabilities: ['text'] },
        { id: 'plan.week', label: '周计划', group: '训练计划', requiredCapabilities: ['text', 'json'] }
    ]);

    await api.render();

    assert.equal(
        container.children.some(node => node.dataset.taskId),
        false,
        'task rows must be nested inside their group containers rather than appended directly'
    );
    assert.equal(container.children.length, 2);
    assert.deepEqual(
        container.children.map(group => group.children[0]?.textContent),
        ['训练计划', '建议'],
        'groups must keep the first-seen registry order rather than sorting by label'
    );
    assert.deepEqual(
        container.children.map(group => collectTaskIds(group)),
        [['plan.today', 'plan.week'], ['advice.chat']]
    );
    assert.equal(container.children[0].textContent.includes('训练计划'), true);
    assert.equal(container.children[1].textContent.includes('建议'), true);
});

test('localPicker false prevents an inline picker from loading route or model choices', async () => {
    const { api, calls } = loadTaskSettingsUi([
        { id: 'food.text', label: '文字食物解析', group: '饮食', localPicker: false, requiredCapabilities: ['text'] }
    ]);
    const host = new FakeElement('div');
    host.dataset.aiTaskPicker = 'food.text';
    host.append(new FakeElement('span', { textContent: '已有宿主内容' }));
    const scope = {
        matches() { return false; },
        querySelectorAll() { return [host]; }
    };

    api.mountInlinePickers(scope);
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(calls.filter(call => call === 'getTaskDefinitions').length, 1);
    assert.equal(calls.filter(call => call.startsWith('getTaskRoute:')).length, 0);
    assert.equal(calls.filter(call => call.startsWith('listSelectableModels:')).length, 0);
    assert.equal(host.dataset.aiTaskPickerMountedFor, undefined);
    assert.equal(host.dataset.aiTaskPickerMountingFor, undefined);
    assert.equal(host.textContent, '已有宿主内容');
});

test('unknown inline picker tasks do not load routes or change their host', async () => {
    const { api, calls } = loadTaskSettingsUi([
        { id: 'food.text', label: '文字食物解析', group: '饮食' }
    ]);
    const host = new FakeElement('div');
    host.append(new FakeElement('span', { textContent: '已有宿主内容' }));

    await api.mountInlinePicker(host, 'missing.task');

    assert.deepEqual(calls, ['getTaskDefinitions']);
    assert.equal(host.dataset.aiTaskPickerMountedFor, undefined);
    assert.equal(host.dataset.aiTaskPickerMountingFor, undefined);
    assert.equal(host.textContent, '已有宿主内容');
});

test('inline pickers still mount for omitted or explicit true localPicker metadata', async () => {
    const { api, calls } = loadTaskSettingsUi([
        { id: 'food.text', label: '文字食物解析', group: '饮食' },
        { id: 'food.vision', label: '食物照片识别', group: '饮食', localPicker: true }
    ]);
    const defaultHost = new FakeElement('div');
    const enabledHost = new FakeElement('div');

    await api.mountInlinePicker(defaultHost, 'food.text');
    await api.mountInlinePicker(enabledHost, 'food.vision');

    assert.deepEqual(calls, [
        'getTaskDefinitions',
        'getTaskRoute:food.text',
        'listSelectableModels:food.text',
        'getTaskDefinitions',
        'getTaskRoute:food.vision',
        'listSelectableModels:food.vision'
    ]);
    assert.equal(defaultHost.dataset.aiTaskPickerMountedFor, 'food.text');
    assert.equal(enabledHost.dataset.aiTaskPickerMountedFor, 'food.vision');
});

test('model labels include connection identity for duplicate model ids', () => {
    const first = { profileId: 'p1', profileName: 'OpenRouter', modelId: 'shared-model' };
    const second = { profileId: 'p2', profileName: 'SiliconFlow', modelId: 'shared-model' };
    assert.equal(helpers.modelKey(first), 'p1::shared-model');
    assert.equal(helpers.modelKey(second), 'p2::shared-model');
    assert.equal(helpers.modelOptionLabel(first), 'OpenRouter \u00b7 shared-model');
    assert.equal(helpers.modelOptionLabel(second), 'SiliconFlow \u00b7 shared-model');
});

test('shared task picker keeps profile-qualified favorites and task-scoped recents unique', async () => {
    const storage = createMemoryStorage({
        'rehab.ai.modelFavorites.v2': JSON.stringify(['p-favorite::shared']),
        'rehab.ai.modelRecents.v1': JSON.stringify({
            'advice.chat': ['p-favorite::shared', 'p-recent::shared', 'p-deleted::removed'],
            'advice.vision': ['p-vision::vision']
        })
    });
    const models = {
        'advice.chat': [
            { profileId: 'p-normal', profileName: 'Normal', modelId: 'ordinary' },
            { profileId: 'p-favorite', profileName: 'Favorite', modelId: 'shared' },
            { profileId: 'p-recent', profileName: 'Recent', modelId: 'shared' },
            { profileId: 'p-fourth', profileName: 'Fourth', modelId: 'fourth' }
        ],
        'advice.vision': [{ profileId: 'p-vision', profileName: 'Vision', modelId: 'vision' }]
    };
    const { api, quickSheetBody } = loadTaskSettingsUi([
        { id: 'advice.chat', label: '聊天' },
        { id: 'advice.vision', label: '识图' }
    ], { models, storage });
    const chatHost = new FakeElement('div');

    await api.mountInlinePicker(chatHost, 'advice.chat');
    const chatTrigger = findElements(chatHost, node => node.className === 'ai-compact-model')[0];
    assert.ok(chatTrigger);
    assert.doesNotThrow(() => chatTrigger._listeners.click());

    const choices = findElements(quickSheetBody, node => node.className === 'ai-task-model-main');
    const choiceLabel = choice => choice.children[1]?.children[0]?.textContent;
    assert.deepEqual(choices.map(choiceLabel), ['shared', 'shared', 'ordinary', 'fourth']);
    assert.equal(choices.filter(choice => choiceLabel(choice) === 'shared').length, 2);
    assert.equal(quickSheetBody.textContent.includes('removed'), false);

    const choose = async (profileName, modelId) => {
        const choice = choices.find(candidate => candidate.children[1]?.children[1]?.textContent === profileName
            && choiceLabel(candidate) === modelId);
        assert.ok(choice, `${profileName} · ${modelId} should be selectable exactly once`);
        await choice._listeners.click();
    };
    await choose('Favorite', 'shared');
    await choose('Recent', 'shared');
    await choose('Normal', 'ordinary');
    await choose('Fourth', 'fourth');
    await choose('Recent', 'shared');
    await new Promise(resolve => setImmediate(resolve));

    const visionHost = new FakeElement('div');
    await api.mountInlinePicker(visionHost, 'advice.vision');
    const visionTrigger = findElements(visionHost, node => node.className === 'ai-compact-model')[0];
    visionTrigger._listeners.click();
    const visionChoice = findElements(quickSheetBody, node => node.className === 'ai-task-model-main')[0];
    await visionChoice._listeners.click();
    await new Promise(resolve => setImmediate(resolve));

    const recents = JSON.parse(storage.getItem('rehab.ai.modelRecents.v1'));
    assert.deepEqual(recents['advice.chat'], ['p-recent::shared', 'p-fourth::fourth', 'p-normal::ordinary']);
    assert.deepEqual(recents['advice.vision'], ['p-vision::vision']);
});

test('generic task picker stably orders valid favorites, current-task recents, then connection families without render writes', async () => {
    const storage = createMemoryStorage({
        'rehab.ai.modelFavorites.v2': JSON.stringify([
            'p-favorite::shared',
            'p-deleted::missing',
            'p-second-favorite::second'
        ]),
        'rehab.ai.modelRecents.v1': JSON.stringify({
            'plan.today': ['p-favorite::shared', 'p-recent::shared', 'p-stale::gone'],
            'plan.week': ['p-week::weekly']
        })
    });
    const models = {
        'plan.today': [
            { profileId: 'p-zeta', profileName: 'Zeta', modelId: 'plain', family: '' },
            { profileId: 'p-second-favorite', profileName: 'Second Favorite', modelId: 'second', family: 'text' },
            { profileId: 'p-alpha-vision', profileName: 'Alpha', modelId: 'vision', family: 'vision' },
            { profileId: 'p-recent', profileName: 'Recent', modelId: 'shared', family: 'text' },
            { profileId: 'p-favorite', profileName: 'Favorite', modelId: 'shared', family: 'text' },
            { profileId: 'p-alpha-text', profileName: 'Alpha', modelId: 'text', family: 'text' }
        ]
    };
    const saves = [];
    const { api, quickSheetBody } = loadTaskSettingsUi([{ id: 'plan.today', label: '今日计划' }], {
        models,
        storage,
        async setTaskRoute(taskId, route) { saves.push({ taskId, route }); }
    });
    const host = new FakeElement('div');

    await api.mountInlinePicker(host, 'plan.today');
    findElements(host, node => node.className === 'ai-compact-model')[0]._listeners.click();

    const choices = findElements(quickSheetBody, node => node.className === 'ai-task-model-main');
    const identity = choice => `${choice.children[1]?.children[1]?.textContent}::${choice.children[1]?.children[0]?.textContent}`;
    assert.deepEqual(choices.map(identity), [
        'Favorite::shared',
        'Second Favorite::second',
        'Recent::shared',
        'Zeta::plain',
        'Alpha::vision',
        'Alpha::text'
    ]);
    assert.deepEqual(
        findElements(quickSheetBody, node => node.className === 'ai-task-model-section-title').map(node => node.textContent),
        ['收藏模型', '最近使用', 'Zeta · 其他', 'Alpha · vision', 'Alpha · text']
    );
    assert.equal(choices.filter(choice => identity(choice).endsWith('::shared')).length, 2, 'same modelId across profiles stays distinct');
    assert.equal(quickSheetBody.textContent.includes('missing'), false);
    assert.equal(quickSheetBody.textContent.includes('gone'), false);
    assert.deepEqual(storage.writes, [], 'rendering must not clean or rewrite preference storage');

    choices[2]._listeners.click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(saves.length, 1);
    assert.deepEqual(JSON.parse(storage.getItem('rehab.ai.modelRecents.v1'))['plan.today'], [
        'p-recent::shared',
        'p-favorite::shared',
        'p-stale::gone'
    ]);
});

test('generic task picker ignores malformed current-task recent records without throwing or rewriting storage', async () => {
    const storage = createMemoryStorage({
        'rehab.ai.modelFavorites.v2': JSON.stringify([]),
        'rehab.ai.modelRecents.v1': JSON.stringify({ 'plan.today': 'p-bad::not-an-array' })
    });
    const { api, quickSheetBody } = loadTaskSettingsUi([{ id: 'plan.today', label: '今日计划' }], {
        storage,
        models: { 'plan.today': [{ profileId: 'p-valid', profileName: 'Valid', modelId: 'text', family: 'text' }] }
    });
    const host = new FakeElement('div');

    await api.mountInlinePicker(host, 'plan.today');
    const trigger = findElements(host, node => node.className === 'ai-compact-model')[0];

    assert.doesNotThrow(() => trigger._listeners.click());
    assert.equal(findElements(quickSheetBody, node => node.className === 'ai-task-model-main').length, 1);
    assert.deepEqual(storage.writes, []);
});

test('shared model preference facade exposes defensive profile-qualified copies', () => {
    const storage = createMemoryStorage({
        'rehab.ai.modelFavorites.v2': JSON.stringify(['p-favorite::shared', 'p-favorite::shared']),
        'rehab.ai.modelRecents.v1': JSON.stringify({
            'advice.chat': ['p-chat::one', 'p-chat::two', 'p-chat::one', 'p-chat::three', 'p-chat::four'],
            'advice.vision': ['p-vision::image']
        })
    });
    const { api } = loadTaskSettingsUi([], { storage });

    assert.equal(typeof api.favoriteKeys, 'function');
    assert.equal(typeof api.recentKeysForTask, 'function');
    assert.equal(typeof api.rememberRecent, 'function');

    const favorites = api.favoriteKeys();
    assert.deepEqual([...favorites], ['p-favorite::shared']);
    favorites.add('p-local::mutation');
    assert.deepEqual([...api.favoriteKeys()], ['p-favorite::shared']);

    const chatRecents = api.recentKeysForTask('advice.chat');
    assert.deepEqual(Array.from(chatRecents), ['p-chat::one', 'p-chat::two', 'p-chat::three']);
    chatRecents.push('p-local::mutation');
    assert.deepEqual(Array.from(api.recentKeysForTask('advice.chat')), ['p-chat::one', 'p-chat::two', 'p-chat::three']);
    assert.deepEqual(Array.from(api.recentKeysForTask('advice.vision')), ['p-vision::image']);
});

test('shared model preference facade safely isolates current-task recents without new keys', () => {
    const storage = createMemoryStorage({
        'rehab.ai.modelFavorites.v2': JSON.stringify(['p-favorite::shared']),
        'rehab.ai.modelRecents.v1': JSON.stringify({ 'advice.vision': ['p-vision::image'] })
    });
    const { api } = loadTaskSettingsUi([], { storage });

    api.rememberRecent('advice.chat', { profileId: 'p-chat', modelId: 'one' });
    api.rememberRecent('advice.chat', { profileId: 'p-chat', modelId: 'two' });
    api.rememberRecent('advice.chat', { profileId: 'p-chat', modelId: 'three' });
    api.rememberRecent('advice.chat', { profileId: 'p-chat', modelId: 'one' });
    api.rememberRecent('', { profileId: 'p-invalid', modelId: 'ignored' });
    api.rememberRecent('advice.chat', { profileId: 'p-invalid' });

    const recents = JSON.parse(storage.getItem('rehab.ai.modelRecents.v1'));
    assert.deepEqual(recents['advice.chat'], ['p-chat::one', 'p-chat::three', 'p-chat::two']);
    assert.deepEqual(recents['advice.vision'], ['p-vision::image']);
    assert.deepEqual(storage.keys().sort(), ['rehab.ai.modelFavorites.v2', 'rehab.ai.modelRecents.v1']);
    assert.deepEqual(storage.writes, [
        'rehab.ai.modelRecents.v1',
        'rehab.ai.modelRecents.v1',
        'rehab.ai.modelRecents.v1',
        'rehab.ai.modelRecents.v1'
    ]);
});

test('shared model preference facade degrades safely for unavailable or malformed storage', () => {
    const malformedStorage = createMemoryStorage({
        'rehab.ai.modelFavorites.v2': JSON.stringify({ unexpected: true }),
        'rehab.ai.modelRecents.v1': '{not json'
    });
    const malformed = loadTaskSettingsUi([], { storage: malformedStorage }).api;
    assert.deepEqual([...malformed.favoriteKeys()], []);
    assert.deepEqual(Array.from(malformed.recentKeysForTask('advice.chat')), []);
    assert.doesNotThrow(() => malformed.rememberRecent('advice.chat', { profileId: 'p-chat', modelId: 'one' }));

    const unavailableStorage = {
        getItem() { throw new Error('blocked'); },
        setItem() { throw new Error('blocked'); }
    };
    const unavailable = loadTaskSettingsUi([], { storage: unavailableStorage }).api;
    assert.doesNotThrow(() => unavailable.favoriteKeys());
    assert.doesNotThrow(() => unavailable.recentKeysForTask('advice.chat'));
    assert.doesNotThrow(() => unavailable.rememberRecent('advice.chat', { profileId: 'p-chat', modelId: 'one' }));
});

test('compact model control shows the selected model name beside the shared icon', () => {
    const source = readFileSync(new URL('../ai-task-settings.js', import.meta.url), 'utf8');
    const block = source.match(/function createCompactModelControl[\s\S]*?return button;/)?.[0] || '';
    assert.match(block, /modelVisualNode\(selected(?:, visual)?\)/);
    assert.match(block, /ai-compact-model-name/);
    assert.match(block, /registerCompactModelLabel\(button, name\)/);
});

test('compact model labels remove only known vendor prefixes and preserve version syntax', () => {
    assert.equal(helpers.compactModelName({ modelId: 'claude-sonnet-4.6' }), 'sonnet-4.6');
    assert.equal(helpers.compactModelName({ modelId: 'gpt-5-5' }), '5-5');
    assert.equal(helpers.compactModelName({ modelId: 'gpt-5.6-sol' }), '5.6-sol');
    assert.equal(helpers.compactModelName({ modelId: 'grok-4.5' }), 'grok-4.5');
    assert.equal(helpers.compactModelName({ modelId: 'deepseek-v4-flash' }), 'v4-flash');
    assert.equal(helpers.compactModelName({ modelId: 'gemini pro preview' }), 'pro preview');
    assert.equal(helpers.compactModelName({ modelId: 'qwen-3-vl-plus' }), 'qwen-3-vl-plus');
    assert.equal(helpers.compactModelName({ modelId: 'doubao-seed-1.6' }), 'doubao-seed-1.6');
    assert.equal(helpers.compactModelName({ modelId: 'kimi-k2' }), 'kimi-k2');
    assert.equal(helpers.compactModelName({ modelId: 'minimax-m2.5' }), 'minimax-m2.5');
    assert.equal(helpers.compactModelName({ modelId: 'mimo-v2' }), 'mimo-v2');
    assert.equal(helpers.compactModelName({ modelId: 'glm-4.7' }), 'glm-4.7');
    assert.notEqual(helpers.compactModelName({ modelId: 'gpt-5-5' }), helpers.compactModelName({ modelId: 'gpt-5.5' }));
    assert.equal(helpers.compactModelName({ modelId: 'custom-nebula-pro-preview' }), 'custom-nebula-pro-preview');
});

test('compact model label fitting keeps the abbreviation and progressively shrinks it', () => {
    const source = readFileSync(new URL('../ai-task-settings.js', import.meta.url), 'utf8');
    assert.match(source, /\[12, 11, 10\]\.some\(size/);
    assert.match(source, /label\.scrollWidth <= label\.clientWidth \+ 1/);
});

test('custom display names remain unchanged while full identity keeps the model id', () => {
    const model = { profileName: 'OpenRouter', modelId: 'gpt-5.6-sol', displayName: '论文分析' };
    assert.equal(helpers.compactModelName(model), '论文分析');
    assert.equal(helpers.modelOptionLabel(model), 'OpenRouter · 论文分析 · gpt-5.6-sol');
});

test('diet picker keeps its compact model label visible on narrow screens', () => {
    const dietCss = readFileSync(new URL('../css-src/18-health-diet.css', import.meta.url), 'utf8');
    assert.doesNotMatch(dietCss, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.diet-ai-model-control\s+\.ai-compact-model-name\s*\{[\s\S]*?display:\s*none/);
    assert.match(dietCss, /grid-template-columns:\s*minmax\(112px, 1fr\) minmax\(0, clamp\(152px, 46vw, 206px\)\)/);
    assert.match(dietCss, /\.diet-ai-model-control\s+\.ai-model-connection-mark\s*\{[\s\S]*?width:\s*20px/);
});

test('compact model control applies the selected model visual theme', () => {
    const source = readFileSync(new URL('../ai-task-settings.js', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../css-src/20-settings-ai.css', import.meta.url), 'utf8');
    const block = source.match(/function createCompactModelControl[\s\S]*?return button;/)?.[0] || '';

    assert.match(block, /resolveModelVisual\(selected\)/);
    assert.match(block, /--ai-model-control-bg/);
    assert.match(block, /--ai-model-control-color/);
    assert.match(css, /background:\s*var\(--ai-model-control-bg/);
    assert.match(css, /color:\s*var\(--ai-model-control-color/);
});

test('unknown reasoning depth falls back to auto', () => {
    assert.equal(helpers.normalizeReasoningDepth('HIGH'), 'high');
    assert.equal(helpers.normalizeReasoningDepth('unsupported'), 'auto');
    assert.equal(helpers.normalizeReasoningDepth(null), 'auto');
});

test('inline picker mount guard suppresses duplicate observer mounts', () => {
    const host = { dataset: {} };
    assert.equal(helpers.shouldMountInlinePicker(host, 'plan.today'), true);
    host.dataset.aiTaskPickerMountingFor = 'plan.today';
    assert.equal(helpers.shouldMountInlinePicker(host, 'plan.today'), false);
    delete host.dataset.aiTaskPickerMountingFor;
    host.dataset.aiTaskPickerMountedFor = 'plan.today';
    assert.equal(helpers.shouldMountInlinePicker(host, 'plan.today'), false);
    assert.equal(helpers.shouldMountInlinePicker(host, 'plan.week'), true);
});

test('plan AI picker inserts beside nested modal actions', () => {
    const body = {};
    const actionParent = {};
    const actions = { parentElement: actionParent };

    assert.deepEqual(helpers.resolveInsertionTarget(body, actions), {
        parent: actionParent,
        before: actions
    });
    assert.deepEqual(helpers.resolveInsertionTarget(body, null), {
        parent: body,
        before: null
    });
});

test('plan AI picker mounts explicitly instead of on every body mutation', () => {
    const settingsSource = readFileSync(new URL('../ai-task-settings.js', import.meta.url), 'utf8');
    const planSource = readFileSync(new URL('../plan-ai.js', import.meta.url), 'utf8');
    const observerBody = settingsSource.match(/new MutationObserver\(records => \{([\s\S]*?)\n\s*\}\);/)?.[1] || '';

    assert.doesNotMatch(observerBody, /mountPlanAiPicker/);
    assert.match(settingsSource, /ai:ready[\s\S]*?mountInlinePickers\(document, \{ force: true \}\)/);
    assert.match(settingsSource, /function mountPlanAiPicker\(options = \{\}\)/);
    assert.match(planSource, /mountPlanAiPickerReady/);
    assert.match(planSource, /mountPlanAiPicker\(\{\s*force:\s*true\s*\}\)/);
    assert.doesNotMatch(planSource, /window\.aiTaskSettings\?\.mountPlanAiPicker\?\.\(\)/);
});

test('task model picker presents capability states as text and keeps every state selectable', async () => {
    const models = {
        'advice.chat': [
            { profileId: 'profile-compatible', profileName: 'Compatible', modelId: 'text', capabilityState: 'compatible' },
            { profileId: 'profile-unknown', profileName: 'Unknown', modelId: 'unverified', capabilityState: 'unknown' },
            { profileId: 'profile-incompatible', profileName: 'Incompatible', modelId: 'visionless', capabilityState: 'incompatible' }
        ]
    };
    const { api, quickSheetBody } = loadTaskSettingsUi([{ id: 'advice.chat', label: '聊天' }], { models });
    const host = new FakeElement('div');

    await api.mountInlinePicker(host, 'advice.chat');
    findElements(host, node => node.className === 'ai-compact-model')[0]._listeners.click();

    const choices = findElements(quickSheetBody, node => node.className === 'ai-task-model-main');
    assert.equal(choices.length, 3, 'requiredCapabilities must remain advisory instead of filtering models');
    assert.deepEqual(choices.map(choice => choice.dataset.capabilityState), ['compatible', 'unknown', 'incompatible']);
    assert.deepEqual(
        choices.map(choice => findElements(choice, node => /^ai-task-model-capability /.test(node.className))[0]?.textContent),
        ['能力兼容', '能力未知', '能力不兼容']
    );
    assert.match(choices[0].attributes['aria-label'], /能力兼容/);
    assert.match(choices[1].attributes['aria-label'], /能力未知/);
    assert.match(choices[2].attributes['aria-label'], /能力不兼容/);
});

test('incompatible task model selection requires existing sheet confirmation and saves exactly once', async () => {
    let saves = 0;
    const models = {
        'advice.chat': [{ profileId: 'profile-incompatible', profileName: 'Incompatible', modelId: 'visionless', capabilityState: 'incompatible' }]
    };
    const { api, quickSheet, quickSheetBody } = loadTaskSettingsUi([{ id: 'advice.chat', label: '聊天' }], {
        models,
        async setTaskRoute() { saves += 1; }
    });
    const host = new FakeElement('div');

    await api.mountInlinePicker(host, 'advice.chat');
    const trigger = findElements(host, node => node.className === 'ai-compact-model')[0];
    trigger._listeners.click();
    const incompatible = findElements(quickSheetBody, node => node.className === 'ai-task-model-main')[0];
    await incompatible._listeners.click();

    assert.equal(saves, 0, 'opening confirmation must not persist a route');
    assert.equal(quickSheet.attributes['aria-hidden'], 'false');
    assert.match(quickSheetBody.textContent, /能力不兼容/);
    const cancel = findElements(quickSheetBody, node => node.className === 'md-btn ai-task-compatibility-cancel')[0];
    assert.ok(cancel, 'confirmation must reuse the existing sheet with an explicit cancel control');
    cancel._listeners.click();
    assert.equal(saves, 0, 'cancelling confirmation must not persist a route');

    trigger._listeners.click();
    const retry = findElements(quickSheetBody, node => node.className === 'ai-task-model-main')[0];
    await retry._listeners.click();
    const confirm = findElements(quickSheetBody, node => node.className === 'md-btn md-btn-filled ai-task-compatibility-confirm')[0];
    assert.ok(confirm, 'confirmation must expose an explicit continue action');
    await Promise.all([confirm._listeners.click(), confirm._listeners.click()]);
    assert.equal(saves, 1, 'confirmation double-click must not save more than once');
});

test('unknown capability state saves directly and untrusted labels remain text-only', async () => {
    let saves = 0;
    const hostileLabel = '<img src=x onerror=alert(1)>';
    const models = {
        'advice.chat': [{ profileId: 'profile-unknown', profileName: hostileLabel, modelId: hostileLabel, capabilityState: 'unexpected-value' }]
    };
    const { api, quickSheetBody } = loadTaskSettingsUi([{ id: 'advice.chat', label: '聊天' }], {
        models,
        async setTaskRoute() { saves += 1; }
    });
    const host = new FakeElement('div');

    await api.mountInlinePicker(host, 'advice.chat');
    findElements(host, node => node.className === 'ai-compact-model')[0]._listeners.click();
    const unknown = findElements(quickSheetBody, node => node.className === 'ai-task-model-main')[0];

    assert.equal(unknown.dataset.capabilityState, 'unknown');
    assert.match(unknown.attributes['aria-label'], /能力未知/);
    assert.equal(unknown.textContent.includes(hostileLabel), true);
    assert.equal(Object.hasOwn(unknown, 'innerHTML'), false);
    await unknown._listeners.click();
    assert.equal(saves, 1, 'unknown capability must remain selectable without confirmation');
});
