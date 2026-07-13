import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = process.cwd();
const source = readFileSync(join(root, 'advice-panel.js'), 'utf8');
const css = readFileSync(join(root, 'css-src/48-advice-model-picker.css'), 'utf8');

function createMemoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); }
    };
}

function loadPanel(extra = {}) {
    /** @type {Record<string, any>} */
    const context = {
        window: { addEventListener() {}, matchMedia() { return { matches: false, addEventListener() {} }; } },
        document: { addEventListener() {}, getElementById() { return null; }, querySelector() { return null; } },
        localStorage: { getItem() { return null; }, setItem() {} },
        sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
        navigator: { maxTouchPoints: 1 },
        requestAnimationFrame(fn) { fn(); },
        ...extra
    };
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(`${source}\nthis.__panel = advicePanel;`, context);
    return context.__panel;
}

test('swipe resolver changes one scope only after a deliberate gesture', () => {
    const resolve = loadPanel()._test?.resolveAdviceModelSwipeScope;
    assert.equal(typeof resolve, 'function');
    assert.equal(resolve('current', -20, 320, -0.1), 'current');
    assert.equal(resolve('current', -110, 320, -0.4), 'others');
    assert.equal(resolve('others', -110, 320, -0.4), 'cached');
    assert.equal(resolve('others', 110, 320, 0.4), 'current');
    assert.equal(resolve('cached', -110, 320, -0.4), 'cached');
});

test('AI coach picker binds live pointer tracking and a sliding scope indicator', () => {
    assert.match(source, /advice-model-picker-content/);
    assert.match(source, /data-advice-model-swipe/);
    assert.match(source, /model-picker-tab-indicator/);
    assert.match(source, /model-picker-track/);
    assert.match(source, /ADVICE_MODEL_SCOPES\.map\(renderPage\)/);
    assert.match(source, /pointermove/);
    assert.match(source, /--model-picker-drag-x/);
    assert.match(source, /--model-picker-tab-progress/);
});

test('AI coach picker owns one vertical scroller while its page follows horizontal touch', () => {
    assert.match(css, /\.md-modal-sheet-card\.advice-model-picker-card\s*\{[^}]*overflow:\s*hidden/s);
    assert.match(css, /\.advice-model-picker-content\s*\{[^}]*overflow-y:\s*auto/s);
    assert.match(css, /\.model-picker-swipe-region\s*\{[^}]*touch-action:\s*pan-y/s);
    assert.match(css, /\.model-picker-page\s*\{[^}]*translate3d\(var\(--model-picker-drag-x/s);
    assert.match(css, /\.model-picker-track\s*\{[^}]*translate3d\(calc\(var\(--model-picker-scope-index/s);
    assert.match(css, /\.model-picker-swipe-region\.is-dragging \.model-picker-page\s*\{[^}]*transition:\s*none/s);
});

test('AI coach picker promotes shared favorites and active-task recents without duplicate or stale rows', () => {
    const storage = createMemoryStorage({
        'rehab.ai.modelFavorites.v2': JSON.stringify(['p-favorite::favorite']),
        'rehab.ai.modelRecents.v1': JSON.stringify({
            'advice.chat': ['p-chat::chat-only'],
            'advice.vision': ['p-favorite::favorite', 'p-recent::recent', 'p-deleted::missing']
        })
    });
    const ai = {
        cfg: {
            activeProfileId: 'p-normal',
            provider: 'normal',
            profiles: [
                { id: 'p-normal', provider: 'normal' },
                { id: 'p-favorite', provider: 'favorite' },
                { id: 'p-recent', provider: 'recent' },
                { id: 'p-chat', provider: 'chat' }
            ]
        },
        normalizeProvider(value = '') { return String(value || '').trim(); },
        resolveTaskConfig(taskId) {
            assert.equal(taskId, 'advice.vision');
            return { profileId: 'p-normal', provider: 'normal', model: 'normal', apiKey: 'configured' };
        },
        listSelectableModels() {
            return [
                { profileId: 'p-normal', profileName: 'Normal', provider: 'normal', modelId: 'normal', displayName: 'Normal' },
                { profileId: 'p-chat', profileName: 'Chat only', provider: 'chat', modelId: 'chat-only', displayName: 'Chat only' },
                { profileId: 'p-favorite', profileName: 'Favorite', provider: 'favorite', modelId: 'favorite', displayName: 'Favorite' },
                { profileId: 'p-recent', profileName: 'Recent', provider: 'recent', modelId: 'recent', displayName: 'Recent' }
            ];
        }
    };
    const panel = loadPanel({
        ai,
        localStorage: storage,
        window: {
            addEventListener() {},
            matchMedia() { return { matches: false, addEventListener() {} }; },
            aiTaskSettings: {
                favoriteKeys() { return new Set(['p-favorite::favorite']); },
                recentKeysForTask(taskId) {
                    assert.equal(taskId, 'advice.vision');
                    return ['p-favorite::favorite', 'p-recent::recent', 'p-deleted::missing'];
                }
            }
        }
    });
    panel.advicePickerTaskId = () => 'advice.vision';
    panel.escapeHtml = value => String(value ?? '');
    panel.adviceModelVisual = () => ({ key: 'generic' });
    panel.adviceModelThemeStyle = () => '';
    panel.adviceModelIconHtml = () => '';
    panel.adviceModelPickerScope = 'cached';

    const html = panel.renderAdviceModelPicker();
    const cachedPage = html.match(/<section[^>]*data-advice-model-page="cached"[\s\S]*?<\/section>/)?.[0] || '';
    const position = model => cachedPage.indexOf(`data-model="${model}"`);

    assert.ok(position('favorite') < position('recent'), 'favorite models should remain first');
    assert.ok(position('recent') < position('normal'), 'active task recents should precede ordinary models');
    assert.ok(position('normal') < position('chat-only'), 'chat recents must not be promoted while choosing a vision model');
    assert.equal((cachedPage.match(/data-advice-model-action="choose"[^>]*data-model="favorite"/g) || []).length, 1);
    assert.equal((cachedPage.match(/data-advice-model-action="choose"[^>]*data-model="recent"/g) || []).length, 1);
    assert.equal(cachedPage.includes('data-model="missing"'), false);
});
