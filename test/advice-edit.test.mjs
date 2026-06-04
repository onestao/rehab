import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadAdvicePanelHarness() {
    const context = {
        window: {},
        document: { querySelector: () => null, getElementById: () => null },
        localStorage: { getItem: () => null, setItem: () => {} },
        sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        requestAnimationFrame: (fn) => fn(),
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
    const data = {
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
        adviceConversationContext: context.__advicePanel.adviceConversationContext,
        sendAiAdvice: context.__advicePanel.sendAiAdvice,
        regenerateAdviceFromEditedUser: context.__advicePanel.regenerateAdviceFromEditedUser
    };
    return data;
}

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
