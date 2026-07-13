import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const LEGACY_ADVICE_ATTACH_KEYS = [
    '_adviceAnchorOffsetIn',
    '_adviceBubbleAnchors',
    '_adviceCurrentScrollY',
    '_adviceDebugLog',
    '_adviceMaxScrollY',
    '_adviceMessageList',
    '_adviceScrollContainer',
    '_adviceSetScrollY',
    '_handleAdviceStreamScroll',
    '_handleAdviceTopChromePull',
    '_handleAdviceTopChromeScroll',
    '_isVersionActive',
    'ADVICE_OUTPUT_TOKEN_BUDGET',
    'adviceConversationContext',
    'adviceMessageSummary',
    'adviceModelIconHtml',
    'adviceModelStarKey',
    'adviceModelThemeStyle',
    'adviceModelVisual',
    'adviceRangeStart',
    'advicePickerTaskId',
    'adviceRecordMatchesSearch',
    'adviceSavedPageScrollOffset',
    'adviceSavedScrollTop',
    'adviceSearchTimestamp',
    'applyAdviceTemplate',
    'applyAdviceTopChromeOffset',
    'applyPickerThemeFromCache',
    'autoResizeAdvicePrompt',
    'bindAdviceModelPickerActions',
    'bindAdviceRequestLifecycle',
    'bindAdviceScrollListener',
    'buildAdviceMessages',
    'buildAdviceTemplateVars',
    'cacheTrainingClassifications',
    'cancelAiAdvice',
    'captureAdviceDraft',
    'captureAdviceScroll',
    'chooseAdviceModel',
    'classifyAdviceFailure',
    'clearAdviceDraft',
    'clearAdviceSearch',
    'closeAdviceModelPicker',
    'closeTemplateManager',
    'copyAdviceMessage',
    'countAdviceMessages',
    'createTemplateDraft',
    'cycleAdviceVersion',
    'deleteAdviceVersion',
    'deleteAiAdviceMessage',
    'deleteTemplateById',
    'detectAdviceFocus',
    'DRAFT_KEY',
    'editTemplateById',
    'expandAdviceRenderWindow',
    'exportTemplates',
    'extractAdviceRoutineBlocks',
    'filterByAdviceRange',
    'findAdviceMessage',
    'findAssistantReplyForUser',
    'flushAdviceStreamRender',
    'getActiveAdviceTemplate',
    'getAdviceTemplates',
    'getAdviceVersionGroup',
    'getInsightCache',
    'handleTemplateImport',
    'hideAdviceNewMessageButton',
    'holdAdviceTopChrome',
    'importTemplates',
    'insightCacheKey',
    'isAdviceModelStarred',
    'isAdvicePageActive',
    'isEmptyAdviceAssistantMessage',
    'isMobileAdviceInput',
    'jumpAdviceToLatest',
    'loadAdviceSettings',
    'loadAdviceWindowFromColdStore',
    'measureAdviceTopChrome',
    'mergeAdviceSearchResults',
    'modelShortName',
    'mountAdviceVirtualList',
    'normalizeAdviceRoutine',
    'onAdvicePromptInput',
    'onAdvicePromptKeydown',
    'onAdviceSearchInput',
    'openAdviceModelPicker',
    'openAdviceRoutineSave',
    'openEditAdviceMessage',
    'openTemplateImport',
    'PAGE_SCROLL_KEY',
    'parsePromptTargetDate',
    'parseTrainingClassificationResponse',
    'pauseStreamForScroll',
    'pinAdviceVersion',
    'prepareAdviceVirtualState',
    'preserveAdviceScroll',
    'pruneAdviceVersionGroup',
    'pruneEmptyAdviceAssistantMessages',
    'refreshAdviceModelChip',
    'refreshAdviceModelPicker',
    'refreshAdviceSearchResults',
    'regenerateAdvice',
    'regenerateAdviceFromEditedUser',
    'releaseAdviceWakeLock',
    'renderAdviceErrorRecovery',
    'renderAdviceFilterControls',
    'renderAdviceMarkdown',
    'renderAdviceMessage',
    'renderAdviceMessages',
    'renderAdviceModelChip',
    'renderAdviceModelPicker',
    'renderAdvicePanel',
    'renderAdviceTopChromeInner',
    'renderAdviceVirtualShell',
    'renderAdviceVirtualSkeleton',
    'renderTemplateManagerContent',
    'requestAdviceWakeLock',
    'requestAiAdvice',
    'requestInsightAiAdvice',
    'rerenderAdvicePanel',
    'resetAdviceRenderWindow',
    'resetAdviceScrollOnEntry',
    'resetTemplateEditor',
    'resizeInsightBody',
    'resolveAdviceContexts',
    'resolveAdviceRecordsByIds',
    'restoreAdviceDraft',
    'restoreAdviceScroll',
    'resumeStreamFromScroll',
    'retryAdviceFrom',
    'runInsightAction',
    'saveAdviceRoutine',
    'saveAdviceSettings',
    'saveTemplateEditor',
    'scheduleAdviceStreamScroll',
    'SCROLL_KEY',
    'scrollAdviceToBottom',
    'scrollAdviceToLatest',
    'scrollAdviceToNextBubble',
    'scrollAdviceToPrevBubble',
    'scrollAdviceToTop',
    'searchAdviceWorkingSet',
    'selectAdviceTemplate',
    'sendAiAdvice',
    'setActiveAdviceVersion',
    'setAdviceContextMode',
    'setAdviceModelPickerScope',
    'setAdviceReasoningDepth',
    'setAdviceRange',
    'setAdviceStreamUiState',
    'setAdviceVirtualEmpty',
    'setInsightCache',
    'setTemplateEditorField',
    'SETTINGS_KEY',
    'showAdviceNewMessageButton',
    'stopActiveAdviceReply',
    'syncAdviceTopChromeToScroll',
    'toggleAdviceContext',
    'toggleAdviceContextPanel',
    'toggleAdviceHistorySearchScope',
    'toggleAdviceMessageExpanded',
    'toggleAdviceModelStar',
    'toggleAdviceSearch',
    'toggleAdviceStreamRender',
    'toggleAdviceV6Insights',
    'toggleAiInsight',
    'toggleTemplateManager',
    'updateAdviceSendState',
    'updateInsightAiBlock',
    'useAdvicePrompt',
    'visibleAdviceMessages',
];

function loadAdvicePanel() {
    const code = readFileSync(path.join(process.cwd(), 'advice-panel.js'), 'utf8');
    const context = {
        window: {
            addEventListener() {},
            matchMedia() { return { matches: false, addEventListener() {} }; },
        },
        document: {
            addEventListener() {},
            getElementById() { return null; },
            querySelector() { return null; },
        },
        localStorage: { getItem() { return null; }, setItem() {} },
        sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
        navigator: { maxTouchPoints: 0 },
        requestAnimationFrame(fn) { fn(); },
    };
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(`${code}\nthis.__advicePanel = advicePanel;`, context);
    return { panel: context.__advicePanel, context };
}

/** @returns {{ host: any, context: any }} */
function attachPanel(extra = {}) {
    const { panel, context } = loadAdvicePanel();
    /** @type {any} */
    const host = {
        db: { health: { aiAdviceChat: [] } },
        ...extra,
    };
    panel.attach(host);
    return { host, context };
}

function getPath(root, pathParts) {
    return pathParts.reduce((value, part) => value?.[part], root);
}

function createMemoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); }
    };
}

test('advice panel attach keeps the legacy flat function contract', () => {
    const { host } = attachPanel();

    const actualKeys = Object.keys(host)
        .filter(key => !['db', 'adviceApi', '_adviceRequestLifecycleBound'].includes(key))
        .sort();

    assert.deepEqual(actualKeys, [...LEGACY_ADVICE_ATTACH_KEYS].sort());
});

test('advice panel attach preserves the existing cold-history advice store slot', () => {
    const existingAdviceStore = { getPage() {}, count() {}, workingSet: [] };
    const { host } = attachPanel({ advice: existingAdviceStore });

    assert.equal(host.advice, existingAdviceStore);
    assert.equal(typeof host.adviceApi, 'object');
});

test('adviceApi facade exposes a small stable surface that forwards to legacy methods', () => {
    const { host } = attachPanel();
    /** @type {Array<[string[], string]>} */
    const forwarded = [
        [['send'], 'sendAiAdvice'],
        [['cancel'], 'cancelAiAdvice'],
        [['render'], 'renderAdvicePanel'],
        [['search', 'toggle'], 'toggleAdviceSearch'],
        [['search', 'clear'], 'clearAdviceSearch'],
        [['search', 'refresh'], 'refreshAdviceSearchResults'],
        [['search', 'workingSet'], 'searchAdviceWorkingSet'],
        [['modelPicker', 'open'], 'openAdviceModelPicker'],
        [['modelPicker', 'close'], 'closeAdviceModelPicker'],
        [['modelPicker', 'choose'], 'chooseAdviceModel'],
        [['modelPicker', 'render'], 'renderAdviceModelPicker'],
        [['modelPicker', 'refresh'], 'refreshAdviceModelPicker'],
        [['version', 'getGroup'], 'getAdviceVersionGroup'],
        [['version', 'setActive'], 'setActiveAdviceVersion'],
        [['version', 'cycle'], 'cycleAdviceVersion'],
        [['version', 'pin'], 'pinAdviceVersion'],
        [['version', 'delete'], 'deleteAdviceVersion'],
    ];

    for (const [apiPath, legacyName] of forwarded) {
        host[legacyName] = (...args) => ({ legacyName, args, thisValue: host });
        const fn = getPath(host.adviceApi, apiPath);

        assert.equal(typeof fn, 'function', `${apiPath.join('.')} should be a function`);
        assert.deepEqual(fn('x', 2), { legacyName, args: ['x', 2], thisValue: host });
    }
});

test('AI coach records profile-qualified recents only after each task route saves', async () => {
    const storage = createMemoryStorage();
    const { host, context } = attachPanel();
    const routeCalls = [];
    let taskId = 'advice.chat';
    let resolveSave = null;
    context.localStorage = storage;
    context.window.localStorage = storage;
    context.window.aiTaskSettings = {
        rememberRecent(nextTaskId, model) {
            const stored = JSON.parse(storage.getItem('rehab.ai.modelRecents.v1') || '{}');
            stored[nextTaskId] = [`${model.profileId}::${model.modelId}`];
            storage.setItem('rehab.ai.modelRecents.v1', JSON.stringify(stored));
        }
    };
    context.ai = {
        cfg: {
            profiles: [
                { id: 'p-chat', provider: 'chat' },
                { id: 'p-vision', provider: 'vision' }
            ]
        },
        apiKeyFor() { return 'configured'; },
        getTaskRoute() { return { reasoningDepth: 'auto' }; },
        setTaskRoute(nextTaskId, route) {
            routeCalls.push({ taskId: nextTaskId, route });
            return new Promise(resolve => { resolveSave = resolve; });
        }
    };
    host.advicePickerTaskId = () => taskId;
    host.rerenderAdvicePanel = () => {};
    host.refreshAdviceModelChip = () => {};
    const completeSave = () => {
        if (typeof resolveSave !== 'function') throw new Error('route save was not scheduled');
        resolveSave();
    };

    host.chooseAdviceModel('p-chat', 'chat', 'shared-model');
    assert.equal(storage.getItem('rehab.ai.modelRecents.v1'), null, 'recent must wait for the route save');
    completeSave();
    await new Promise(resolve => setImmediate(resolve));

    taskId = 'advice.vision';
    host.chooseAdviceModel('p-vision', 'vision', 'shared-model');
    assert.deepEqual(JSON.parse(storage.getItem('rehab.ai.modelRecents.v1') || '{}'), {
        'advice.chat': ['p-chat::shared-model']
    });
    completeSave();
    await new Promise(resolve => setImmediate(resolve));

    assert.deepEqual(JSON.parse(JSON.stringify(routeCalls)), [
        { taskId: 'advice.chat', route: { reasoningDepth: 'auto', primary: { profileId: 'p-chat', modelId: 'shared-model' } } },
        { taskId: 'advice.vision', route: { reasoningDepth: 'auto', primary: { profileId: 'p-vision', modelId: 'shared-model' } } }
    ]);
    assert.deepEqual(JSON.parse(storage.getItem('rehab.ai.modelRecents.v1') || '{}'), {
        'advice.chat': ['p-chat::shared-model'],
        'advice.vision': ['p-vision::shared-model']
    });
});

test('AI coach does not record a recent model when task route save rejects', async () => {
    const { host, context } = attachPanel();
    const recentCalls = [];
    context.window.aiTaskSettings = {
        rememberRecent(taskId, model) { recentCalls.push({ taskId, model }); }
    };
    context.ai = {
        cfg: { profiles: [{ id: 'p-chat', provider: 'chat' }] },
        apiKeyFor() { return 'configured'; },
        getTaskRoute() { return {}; },
        setTaskRoute() { return Promise.reject(new Error('route save failed')); }
    };
    host.advicePickerTaskId = () => 'advice.chat';

    await assert.rejects(
        host.chooseAdviceModel('p-chat', 'chat', 'shared-model'),
        /route save failed/
    );
    assert.deepEqual(recentCalls, []);
});
