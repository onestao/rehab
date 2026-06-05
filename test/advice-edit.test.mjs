import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadAdvicePanelHarness() {
    const context = {
        window: {},
        document: {
            /** @returns {any} */
            querySelector: () => null,
            /** @returns {any} */
            getElementById: () => null
        },
        localStorage: { getItem: () => null, setItem: () => {} },
        sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        requestAnimationFrame: (fn) => fn(),
        setTimeout: () => 0,
        clearTimeout: () => {},
        navigator: { maxTouchPoints: 0 },
        performance: { now: () => 0 },
        ai: {
            cfg: { enabled: true, model: 'test-model', provider: 'test-provider' },
            getEffectiveConfig() {
                return { enabled: true, model: 'test-model', provider: 'test-provider' };
            },
            async callStream() {
                return 'new answer';
            }
        }
    };
    context.window = {
        matchMedia: () => ({ matches: false, addEventListener: () => {} }),
        adviceStreamRenderer: null,
        haptics: { light: () => {} }
    };
    context.globalThis = context;
    vm.createContext(context);
    const code = fs.readFileSync(new URL('../advice-panel.js', import.meta.url), 'utf8');
    vm.runInContext(`${code}\nthis.__advicePanel = advicePanel;`, context);
    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const data = {
        __context: context,
        db: {
            health: {
                aiAdviceChat: /** @type {any[]} */ ([
                    { id: 'u1', role: 'user', content: 'old question', at: '2026-05-30T00:00:00.000Z', deleted: false, updatedAt: 1 },
                    { id: 'a1', role: 'assistant', content: 'old answer', at: '2026-05-30T00:00:01.000Z', deleted: false, updatedAt: 1, versionIdx: 0, versionActive: true }
                ])
            },
            aiTrash: []
        },
        activeRecords(items) { return (items || []).filter(item => !item.deleted); },
        generateRecordId(prefix) { return `${prefix}-new`; },
        parseHistoryDate(value) { return new Date(value || '2026-05-30T00:00:00.000Z'); },
        logicalDayStart() { return new Date('2026-05-30T00:00:00.000Z'); },
        logicalDateKey(date = new Date('2026-05-30T00:00:00.000Z')) { return new Date(date).toISOString().slice(0, 10); },
        buildAdviceMessages(prompt) { return [{ role: 'user', content: prompt }]; },
        save() {},
        render() {},
        clearAdviceDraft() {},
        setAdviceStreamUiState() {},
        scrollAdviceToLatest() {},
        pruneAdviceVersionGroup: context.__advicePanel.pruneAdviceVersionGroup,
        getAdviceVersionGroup: context.__advicePanel.getAdviceVersionGroup,
        _isVersionActive: context.__advicePanel._isVersionActive,
        findAssistantReplyForUser: context.__advicePanel.findAssistantReplyForUser,
        adviceRangeStart: context.__advicePanel.adviceRangeStart,
        visibleAdviceMessages: context.__advicePanel.visibleAdviceMessages,
        visibleAdviceWindowMessages: context.__advicePanel.visibleAdviceWindowMessages,
        resetAdviceRenderWindow: context.__advicePanel.resetAdviceRenderWindow,
        expandAdviceRenderWindow: context.__advicePanel.expandAdviceRenderWindow,
        _adviceMessageList: context.__advicePanel._adviceMessageList,
        bindAdviceScrollListener: context.__advicePanel.bindAdviceScrollListener,
        _handleAdviceStreamScroll: context.__advicePanel._handleAdviceStreamScroll,
        isAdvicePageActive: () => true,
        captureAdviceScroll: () => {},
        _handleAdviceTopChromeScroll: () => {},
        _handleAdviceTopChromePull: () => {},
        syncAdviceTopChromeToScroll: () => {},
        applyAdviceTopChromeOffset: () => {},
        pauseStreamForScroll: context.__advicePanel.pauseStreamForScroll,
        adviceConversationContext: context.__advicePanel.adviceConversationContext,
        renderAdvicePanel: context.__advicePanel.renderAdvicePanel,
        renderAdviceMessages: () => '',
        renderAdviceFilterControls: () => '',
        renderAdviceModelChip: () => '',
        renderAdviceAttachmentChips: () => '',
        renderAdviceAttachmentInputs: () => '',
        renderAdviceAttachmentControls: () => '',
        restoreAdviceDraft: () => '',
        todayMacros: () => ({ pro: 0, carb: 0, fat: 0 }),
        sortedWeights: () => [],
        diagnoseInsight: () => null,
        buildPlanAnalytics: () => ({}),
        escapeHtml,
        sendAiAdvice: context.__advicePanel.sendAiAdvice,
        regenerateAdviceFromEditedUser: context.__advicePanel.regenerateAdviceFromEditedUser
    };
    return data;
}

test('coach context reattaches advice message builder after lazy load', () => {
    const data = {
        db: { health: { aiAdviceChat: [] } },
        adviceRangeStart: () => '',
        activeRecords: (items) => items || [],
        sortedWeights: () => [],
        logicalDateKey: () => '2026-05-30',
        loadAdviceSettings() {}
    };
    const context = {
        window: {
            data,
            matchMedia: () => ({ matches: false, addEventListener: () => {} })
        },
        document: {
            getElementById: () => null,
            querySelector: () => null
        },
        localStorage: { getItem: () => null, setItem: () => {} },
        requestAnimationFrame: (fn) => fn(),
        navigator: { maxTouchPoints: 0 }
    };
    context.globalThis = context;
    vm.createContext(context);

    const advicePanelCode = fs.readFileSync(new URL('../advice-panel.js', import.meta.url), 'utf8');
    vm.runInContext(advicePanelCode, context);
    assert.equal(typeof data.buildAdviceMessages, 'undefined');

    const coachContextCode = fs.readFileSync(new URL('../coach-context.js', import.meta.url), 'utf8');
    vm.runInContext(coachContextCode, context);

    assert.equal(typeof data.buildAdviceMessages, 'function');
});

test('editing a user advice prompt inserts a new active answer version after the original prompt', async () => {
    const data = loadAdvicePanelHarness();

    await data.regenerateAdviceFromEditedUser('u1', 'new question');

    assert.equal(data.db.health.aiAdviceChat[0].content, 'new question');
    assert.deepEqual(data.db.health.aiAdviceChat.map(msg => msg.id), ['u1', 'advice-pending-new', 'a1']);
    assert.equal(data.db.health.aiAdviceChat[1].content, 'new answer');
    assert.equal(data.db.health.aiAdviceChat[1].replyToId, 'a1');
    assert.equal(data.db.health.aiAdviceChat[1].versionIdx, 1);
    assert.equal(data.db.health.aiAdviceChat[1].versionActive, true);
    assert.equal(data.db.health.aiAdviceChat[2].versionActive, false);
});

test('advice conversation context excludes inactive overwritten answer versions', () => {
    const data = loadAdvicePanelHarness();
    data.db.health.aiAdviceChat[1].versionActive = false;
    data.db.health.aiAdviceChat.splice(1, 0, {
        id: 'a2',
        role: 'assistant',
        content: 'active answer',
        at: '2026-05-30T00:00:02.000Z',
        deleted: false,
        updatedAt: 2,
        replyToId: 'a1',
        versionIdx: 1,
        versionActive: true
    });

    const context = data.adviceConversationContext();

    assert.equal(JSON.stringify(context.map(msg => msg.content)), JSON.stringify(['old question', 'active answer']));
});

test('advice message window renders recent history by default and can expand', () => {
    const data = loadAdvicePanelHarness();
    const messages = Array.from({ length: 120 }, (_, idx) => ({
        id: `m${idx}`,
        role: idx % 2 ? 'assistant' : 'user',
        content: `message ${idx}`,
        at: `2026-05-30T00:${String(idx % 60).padStart(2, '0')}:00.000Z`,
        deleted: false,
        updatedAt: idx
    }));

    data.resetAdviceRenderWindow();
    const first = data.visibleAdviceWindowMessages(messages);

    assert.equal(first.messages.length, 80);
    assert.equal(first.hiddenCount, 40);
    assert.equal(first.messages[0].id, 'm40');

    data.rerenderAdvicePanel = () => {};
    data.expandAdviceRenderWindow();
    const expanded = data.visibleAdviceWindowMessages(messages);

    assert.equal(expanded.messages.length, 120);
    assert.equal(expanded.hiddenCount, 0);
});

test('advice message window does not hide search matches', () => {
    const data = loadAdvicePanelHarness();
    data.adviceSearchQuery = 'early';
    const messages = Array.from({ length: 120 }, (_, idx) => ({ id: `m${idx}`, content: idx === 0 ? 'early match' : 'other' }));

    const windowed = data.visibleAdviceWindowMessages(messages);

    assert.equal(windowed.messages.length, 120);
    assert.equal(windowed.hiddenCount, 0);
});

test('v6 advice panel does not reuse legacy nested chat scroll class', () => {
    const data = loadAdvicePanelHarness();

    const html = data.renderAdvicePanel();

    assert.match(html, /class="ai-msg-list advice-v6-chat-list"/);
    assert.doesNotMatch(html, /class="ai-msg-list advice-chat-list"/);
});

test('advice message list selector prefers v6 chat list over legacy chat list', () => {
    const data = loadAdvicePanelHarness();
    const v6 = { id: 'v6' };
    const legacy = { id: 'legacy' };
    const originalDocument = data.__context.document;
    try {
        data.__context.document = {
            getElementById() { return null; },
            querySelector(selector) {
                if (selector === '#ai-coach .advice-v6-chat-list') return v6;
                if (selector === '.advice-chat-list') return legacy;
                return null;
            }
        };

        assert.equal(data._adviceMessageList(), v6);
    } finally {
        data.__context.document = originalDocument;
    }
});

test('advice panel attach exposes v6 message list helper for runtime scrolling', () => {
    const data = loadAdvicePanelHarness();

    assert.equal(typeof data._adviceMessageList, 'function');
});

test('touch intent marks stream as user-paused when user scrolls away', () => {
    const data = loadAdvicePanelHarness();
    data._adviceSending = true;
    data._adviceUserScrollPaused = false;
    data._adviceStreamUi = 'streaming';
    data.setAdviceStreamUiState = (state) => { data._adviceStreamUi = state; };
    data.showAdviceNewMessageButton = () => {};
    data._activeStreamRenderer = { pause: () => {}, resume: () => {} };

    data._adviceScrollContainer = () => ({
        scrollHeight: 2000,
        clientHeight: 600,
        scrollTop: 0,
        addEventListener: (name, fn) => { if (name === 'touchmove') data.__touchMove = fn; },
        removeEventListener: () => {}
    });
    data._adviceMessageList = () => ({
        scrollTop: 0,
        scrollHeight: 2000,
        clientHeight: 600,
        closest: () => ({ querySelector: () => null, addEventListener: () => {} })
    });

    data.bindAdviceScrollListener();
    data._adviceUserScrollIntent = true;
    data._handleAdviceStreamScroll({ scrollHeight: 2000, clientHeight: 600, scrollTop: 200 });

    assert.equal(data._adviceStreamUi, 'paused');
    assert.equal(data._adviceUserScrollPaused, true);
});
