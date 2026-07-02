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
    'detectAdviceModelProvider',
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
    'iconFallbackSrcs',
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
    'MODEL_ICONS',
    'modelShortName',
    'modelThemeFor',
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
    'providerHashHue',
    'providerIcon',
    'providerKeyForModel',
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
    'setAdviceModel',
    'setAdviceModelPickerScope',
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
