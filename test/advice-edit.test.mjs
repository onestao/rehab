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
        AbortController,
        DOMException,
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
        addEventListener: () => {},
        AbortController,
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
    /** @type {any} */
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
        SCROLL_KEY: context.__advicePanel.SCROLL_KEY,
        PAGE_SCROLL_KEY: context.__advicePanel.PAGE_SCROLL_KEY,
        save() {},
        render() {},
        rerenderAdvicePanel() {},
        softDeleteById(items, id) {
            const item = (items || []).find(entry => entry?.id === id);
            if (!item) return false;
            item.deleted = true;
            item.updatedAt = Date.now();
            return true;
        },
        clearAdviceDraft() {},
        setAdviceStreamUiState() {},
        scrollAdviceToLatest() {},
        pruneAdviceVersionGroup: context.__advicePanel.pruneAdviceVersionGroup,
        isEmptyAdviceAssistantMessage: context.__advicePanel.isEmptyAdviceAssistantMessage,
        pruneEmptyAdviceAssistantMessages: context.__advicePanel.pruneEmptyAdviceAssistantMessages,
        getAdviceVersionGroup: context.__advicePanel.getAdviceVersionGroup,
        _isVersionActive: context.__advicePanel._isVersionActive,
        findAdviceMessage: context.__advicePanel.findAdviceMessage,
        findAssistantReplyForUser: context.__advicePanel.findAssistantReplyForUser,
        adviceRangeStart: context.__advicePanel.adviceRangeStart,
        visibleAdviceMessages: context.__advicePanel.visibleAdviceMessages,
        prepareAdviceVirtualState: context.__advicePanel.prepareAdviceVirtualState,
        mountAdviceVirtualList: context.__advicePanel.mountAdviceVirtualList,
        setAdviceVirtualEmpty: context.__advicePanel.setAdviceVirtualEmpty,
        renderAdviceVirtualShell: context.__advicePanel.renderAdviceVirtualShell,
        renderAdviceVirtualSkeleton: context.__advicePanel.renderAdviceVirtualSkeleton,
        resolveAdviceRecordsByIds: context.__advicePanel.resolveAdviceRecordsByIds,
        findAdviceMessageIndexById: context.__advicePanel.findAdviceMessageIndexById,
        countAdviceMessages: context.__advicePanel.countAdviceMessages,
        resetAdviceRenderWindow: context.__advicePanel.resetAdviceRenderWindow,
        expandAdviceRenderWindow: context.__advicePanel.expandAdviceRenderWindow,
        adviceSavedScrollTop: context.__advicePanel.adviceSavedScrollTop,
        adviceSavedPageScrollOffset: context.__advicePanel.adviceSavedPageScrollOffset,
        restoreAdviceScroll: context.__advicePanel.restoreAdviceScroll,
        resetAdviceScrollOnEntry: context.__advicePanel.resetAdviceScrollOnEntry,
        _adviceMessageList: context.__advicePanel._adviceMessageList,
        _adviceScrollContainer: context.__advicePanel._adviceScrollContainer,
        _adviceCurrentScrollY: context.__advicePanel._adviceCurrentScrollY,
        _adviceMaxScrollY: context.__advicePanel._adviceMaxScrollY,
        _adviceSetScrollY: context.__advicePanel._adviceSetScrollY,
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
        refreshAdviceSearchResults: context.__advicePanel.refreshAdviceSearchResults,
        renderAdvicePanel: context.__advicePanel.renderAdvicePanel,
        renderAdviceMessage: () => '',
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
        cancelAiAdvice: context.__advicePanel.cancelAiAdvice,
        stopActiveAdviceReply: context.__advicePanel.stopActiveAdviceReply,
        updateAdviceSendState: context.__advicePanel.updateAdviceSendState,
        requestAdviceWakeLock: context.__advicePanel.requestAdviceWakeLock,
        releaseAdviceWakeLock: context.__advicePanel.releaseAdviceWakeLock,
        regenerateAdviceFromEditedUser: context.__advicePanel.regenerateAdviceFromEditedUser,
        retryAdviceFrom: context.__advicePanel.retryAdviceFrom
    };
    data.deleteAiAdviceMessage = context.__advicePanel.deleteAiAdviceMessage;
    data.preserveAdviceScroll = (fn) => fn();
    return data;
}

function loadAdviceRenderHarness() {
    const context = {
        window: {},
        document: {
            querySelector: () => null,
            createElement: () => ({ innerHTML: '', content: {}, childNodes: [] }),
            createTreeWalker: () => ({ nextNode: () => false })
        },
        NodeFilter: { SHOW_TEXT: 4 },
        requestAnimationFrame: (fn) => fn(),
        getComputedStyle: () => ({ overflowY: 'visible' }),
        advicePanel: {}
    };
    context.window = context;
    context.globalThis = context;
    vm.createContext(context);
    const code = fs.readFileSync(new URL('../advice-render.js', import.meta.url), 'utf8');
    vm.runInContext(`${code}\nthis.__adviceRender = advicePanel;`, context);
    const data = context.__adviceRender;
    data.logicalDateKey = () => '2026-05-30';
    data.parseHistoryDate = (value) => new Date(value || '2026-05-30T00:00:00.000Z');
    data.escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

/** @returns {{ context: any, data: any }} */
function loadCoachContextHarness(overrides = {}) {
    const context = {
        window: {
            matchMedia: () => ({ matches: false, addEventListener: () => {} }),
            dataAiTemplates: null
        },
        document: {
            getElementById: () => null,
            querySelector: () => null
        },
        localStorage: { getItem: () => null, setItem: () => {} },
        requestAnimationFrame: (fn) => fn(),
        navigator: { maxTouchPoints: 0 },
        ai: { overrideModel: null, call: async () => '' }
    };
    context.globalThis = context;
    vm.createContext(context);
    const advicePanelCode = fs.readFileSync(new URL('../advice-panel.js', import.meta.url), 'utf8');
    vm.runInContext(`${advicePanelCode}\nthis.__advicePanel = advicePanel;`, context);
    /** @type {any} */
    const data = {
        db: {
            history: [],
            health: {
                foodLogs: [],
                weights: [],
                exerciseLogs: [{
                    id: 'exercise-1',
                    date: '2026-05-30',
                    type: 'strength',
                    customName: '哑铃卧推',
                    minutes: 18,
                    calories: 95,
                    distance: 0,
                    weightKg: 20,
                    sets: 4,
                    repsPerSet: 10,
                    note: '右肩无痛',
                    deleted: false
                }],
                rehabWeekly: [],
                reports: [{
                    id: 'report-1',
                    kind: 'weekly',
                    periodStart: '2026-05-24',
                    periodEnd: '2026-05-30',
                    ai: { summary: '本周训练稳定', highlights: ['完成率高'], suggestions: ['增加拉伸'] },
                    deleted: false
                }],
                dietGoal: { dailyCal: 2100, goalType: 'gain', protein: 150 },
                bodyPlan: { goalType: 'gain', targetWeight: 75, weeklyChangeKg: 0.25 },
                weightPlan: { startWeight: 70, targetWeight: 75, days: 120 },
                weeklyGoalSessions: 4,
                aiAdviceChat: []
            },
            actions: [{ id: 'action-1', name: '俯卧撑', tags: ['push'], libOnly: false, deleted: false }],
            routines: [{ id: 'routine-1', name: '上肢康复', actions: [{ name: '弹力带外旋' }], deleted: false }],
            dailyPlans: [{
                id: 'plan-1',
                date: '2026-05-30',
                type: 'rehab',
                title: '今日康复计划',
                source: 'ai',
                notes: '避免疼痛动作',
                items: [{
                    id: 'task-1',
                    name: '肩胛后缩',
                    status: 'todo',
                    currentLevel: 2,
                    spec: { sets: 3, reps: 12, work: 3 },
                    feedback: { rpe: 2, note: '轻松' },
                    aiReasoning: '稳定肩胛',
                    deleted: false
                }],
                deleted: false
            }],
            weeklyPlan: { sat: 'routine-1' },
            aiTemplates: [],
            aiTemplateActiveId: ''
        },
        adviceRange: 'today',
        adviceContextMode: 'auto',
        adviceContexts: { diet: false, training: true, weight: false, goal: false },
        activeRecords(items) { return (items || []).filter(item => !item.deleted); },
        parseHistoryDate(value) { return new Date(value || '2026-05-30T00:00:00.000Z'); },
        dateKey(date) { return new Date(date).toISOString().slice(0, 10); },
        dateFromKey(value) { return new Date(`${value}T00:00:00.000Z`); },
        logicalDayStart() { return new Date('2026-05-30T00:00:00.000Z'); },
        logicalDateKey() { return '2026-05-30'; },
        historyDayKey(entry) { return entry.dayKey || '2026-05-30'; },
        historyNames(entry) { return (entry.actions || []).map(action => action.name || '未命名'); },
        sortedWeights() { return []; },
        exerciseLabel(type = '', entry = /** @type {any} */ (null)) {
            if (type === 'strength' && entry?.customName) return entry.customName;
            return type || '运动';
        },
        adviceConversationContext: () => [],
        getActiveAdviceTemplate: () => null,
        buildAdviceTemplateVars: context.__advicePanel.buildAdviceTemplateVars,
        applyAdviceTemplate: context.__advicePanel.applyAdviceTemplate,
        ...overrides
    };
    context.window.adviceTemplateManager = {
        getActiveAdviceTemplate() { return this.db.aiTemplates?.find(template => template.id === this.db.aiTemplateActiveId) || this.db.aiTemplates?.[0] || null; }
    };
    Object.assign(data, {
        adviceRangeStart: context.__advicePanel.adviceRangeStart,
        buildAdviceMessages: null,
        parsePromptTargetDate: null
    });
    context.window.data = data;
    const coachContextCode = fs.readFileSync(new URL('../coach-context.js', import.meta.url), 'utf8');
    vm.runInContext(coachContextCode, context);
    return { context, data };
}

test('AI advice prompt includes manual exercise records without health-exercise module', () => {
    const { data } = loadCoachContextHarness();

    const messages = data.buildAdviceMessages('分析今天训练', 'test-model');
    const userContent = messages.find(message => message.role === 'user')?.content || '';

    assert.match(userContent, /【今日手动运动】/);
    assert.match(userContent, /哑铃卧推/);
    assert.match(userContent, /18分钟/);
    assert.match(userContent, /95 kcal/);
    assert.match(userContent, /20kg/);
    assert.match(userContent, /4组/);
    assert.match(userContent, /10次/);
    assert.match(userContent, /右肩无痛/);
});

test('AI advice prompt includes plans goals libraries and reports', () => {
    const { data } = loadCoachContextHarness({
        adviceContexts: { diet: true, training: true, weight: true, goal: true }
    });

    const messages = data.buildAdviceMessages('结合我的计划和目标分析今天', 'test-model');
    const userContent = messages.find(message => message.role === 'user')?.content || '';

    assert.match(userContent, /【今日训练计划】/);
    assert.match(userContent, /今日康复计划/);
    assert.match(userContent, /肩胛后缩/);
    assert.match(userContent, /RPE2/);
    assert.match(userContent, /【周计划绑定】/);
    assert.match(userContent, /周六｜上肢康复/);
    assert.match(userContent, /【当前动作计划】/);
    assert.match(userContent, /俯卧撑/);
    assert.match(userContent, /【方案库摘要】/);
    assert.match(userContent, /弹力带外旋/);
    assert.match(userContent, /【目标与计划】/);
    assert.match(userContent, /每周训练目标:4次/);
    assert.match(userContent, /targetWeight/);
    assert.match(userContent, /【近期报告摘要】/);
    assert.match(userContent, /本周训练稳定/);
});

test('custom advice template can access manual exercise variables', () => {
    const { data } = loadCoachContextHarness({
        db: {
            history: [],
            health: {
                foodLogs: [],
                weights: [],
                exerciseLogs: [{
                    id: 'exercise-1',
                    date: '2026-05-30',
                    type: 'strength',
                    customName: '哑铃卧推',
                    minutes: 18,
                    calories: 95,
                    weightKg: 20,
                    sets: 4,
                    repsPerSet: 10,
                    deleted: false
                }],
                rehabWeekly: [],
                dietGoal: null,
                aiAdviceChat: []
            },
            aiTemplates: [{ id: 'tpl-1', system: '系统', user: '手动运动：{manualExercises}\n今日：{todayManualExercises}\n问题：{prompt}' }],
            aiTemplateActiveId: 'tpl-1'
        },
        getActiveAdviceTemplate() { return this.db.aiTemplates[0]; }
    });

    const messages = data.buildAdviceMessages('分析今天训练', 'test-model');
    const userContent = messages.find(message => message.role === 'user')?.content || '';

    assert.match(userContent, /手动运动：- 2026-05-30｜哑铃卧推/);
    assert.match(userContent, /今日：- 2026-05-30｜哑铃卧推/);
    assert.doesNotMatch(userContent, /\{manualExercises\}/);
    assert.doesNotMatch(userContent, /\{todayManualExercises\}/);
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

test('retrying an active answer makes the new answer active and removes empty versions', async () => {
    const data = loadAdvicePanelHarness();
    data.db.health.aiAdviceChat.push({
        id: 'a-empty',
        role: 'assistant',
        content: '   ',
        at: '2026-05-30T00:00:02.000Z',
        deleted: false,
        updatedAt: 2,
        replyToId: 'a1',
        versionIdx: 1,
        versionActive: false
    });

    await data.retryAdviceFrom(1, 'a1');

    const oldAnswer = data.db.health.aiAdviceChat.find(msg => msg.id === 'a1');
    const emptyAnswer = data.db.health.aiAdviceChat.find(msg => msg.id === 'a-empty');
    const newAnswer = data.db.health.aiAdviceChat.find(msg => msg.id === 'advice-pending-new');

    assert.equal(oldAnswer.versionActive, false);
    assert.equal(emptyAnswer.deleted, true);
    assert.equal(newAnswer.content, 'new answer');
    assert.equal(newAnswer.replyToId, 'a1');
    assert.equal(newAnswer.versionActive, true);
    assert.equal(newAnswer.versionIdx, 1);
});

test('advice virtual state keeps all visible ids without window slicing', () => {
    const data = loadAdvicePanelHarness();
    const messages = Array.from({ length: 120 }, (_, idx) => ({
        id: `m${idx}`,
        role: idx % 2 ? 'assistant' : 'user',
        content: `message ${idx}`,
        at: `2026-05-30T00:${String(idx % 60).padStart(2, '0')}:00.000Z`,
        deleted: false,
        updatedAt: idx
    }));

    data.advice = {
        mode: 'recent',
        version: 0,
        activeIdsRef: [],
        setActiveRecords(records, mode) {
            this.mode = mode;
            this.version += 1;
            this.activeIdsRef = records.map(record => record.id);
            return { mode: this.mode, version: this.version, activeIdsRef: this.activeIdsRef };
        }
    };
    const first = data.prepareAdviceVirtualState(messages, 'today', { mount: false });

    assert.equal(first.activeIdsRef.length, 120);
    assert.equal(first.activeIdsRef[0], 'm0');
    assert.equal(first.activeIdsRef.at(-1), 'm119');

    const firstRef = first.activeIdsRef;
    const next = data.prepareAdviceVirtualState(messages.slice(0, 2), 'search', { mount: false });

    assert.notEqual(next.activeIdsRef, firstRef);
    assert.deepEqual(next.activeIdsRef, ['m0', 'm1']);
});

test('advice virtual search snapshot does not hide early matches', () => {
    const data = loadAdvicePanelHarness();
    data.adviceSearchQuery = 'early';
    const messages = Array.from({ length: 120 }, (_, idx) => ({ id: `m${idx}`, content: idx === 0 ? 'early match' : 'other' }));

    data.advice = {
        mode: 'search',
        version: 0,
        activeIdsRef: [],
        setActiveRecords(records, mode) {
            this.mode = mode;
            this.version += 1;
            this.activeIdsRef = records.map(record => record.id);
            return { mode: this.mode, version: this.version, activeIdsRef: this.activeIdsRef };
        }
    };
    const snapshot = data.prepareAdviceVirtualState(messages, 'search', { mount: false });

    assert.equal(snapshot.activeIdsRef.length, 120);
    assert.equal(snapshot.activeIdsRef[0], 'm0');
});

test('advice panel keeps short ranges in the normal chat flow', () => {
    const data = loadAdvicePanelHarness();
    let virtualCalls = 0;
    let groupedMessages = [];
    data.__context.window.adviceVirtualList = { mountVirtualList: () => { virtualCalls += 1; } };
    data.advice = {
        mode: 'today',
        activeIdsRef: ['u1', 'a1'],
        getItem() { return null; }
    };
    data._adviceVirtualFallbackRecords = [
        { id: 'u1', role: 'user', content: 'question', deleted: false },
        { id: 'a1', role: 'assistant', content: 'answer', deleted: false }
    ];
    data.renderAdviceMessage = () => { throw new Error('short ranges should render date groups'); };
    data.renderAdviceMessages = (messages) => {
        groupedMessages = messages;
        return `<section class="advice-date-group">${messages.map(msg => msg.content).join('|')}</section>`;
    };
    const list = { dataset: {}, innerHTML: '' };

    const controller = data.mountAdviceVirtualList(list);

    assert.equal(controller, null);
    assert.equal(virtualCalls, 0);
    assert.match(list.innerHTML, /advice-date-group/);
    assert.deepEqual(groupedMessages.map(msg => msg.idx), [0, 1]);
    assert.equal(list.dataset.adviceVirtualActive, undefined);
});

test('advice virtual rows include full date metadata when rendered without groups', () => {
    const data = loadAdvicePanelHarness();
    let virtualOptions = /** @type {any} */ (null);
    data.__context.window.adviceVirtualList = {
        mountVirtualList: (_list, options) => {
            virtualOptions = options;
            return { destroy() {} };
        }
    };
    data.advice = {
        mode: 'all',
        activeIdsRef: Array.from({ length: 181 }, (_, idx) => `m${idx}`),
        getItem() { return null; }
    };
    data._adviceVirtualFallbackRecords = Array.from({ length: 181 }, (_, idx) => ({
        id: `m${idx}`,
        role: idx % 2 ? 'assistant' : 'user',
        content: `message ${idx}`,
        at: '2026-05-30T00:00:00.000Z'
    }));
    data.renderAdviceMessage = (msg) => msg.showDateMeta ? '<div>date meta</div>' : '<div>missing date</div>';
    data.renderAdviceMessages = () => '<div class="empty-state"></div>';
    const list = { dataset: {}, innerHTML: '' };

    const controller = data.mountAdviceVirtualList(list);
    const options = virtualOptions;
    assert.ok(options);
    const html = options.renderItem({ id: 'm180', role: 'assistant', content: 'answer', at: '2026-05-30T00:00:00.000Z' }, 180, false, '');

    assert.ok(controller);
    assert.match(html, /date meta/);
    assert.equal(list.dataset.adviceVirtualActive, 'true');
});

test('rerenderAdvicePanel refreshes range controls as well as messages', () => {
    const data = loadAdvicePanelHarness();
    data.rerenderAdvicePanel = data.__context.__advicePanel.rerenderAdvicePanel;
    data.renderAdviceTopChromeInner = () => '<div>top</div>';
    data.renderAdviceFilterControls = () => '<button class="advice-pill active">7天</button>';
    data.refreshAdviceModelChip = () => {};
    data.autoResizeAdvicePrompt = () => {};
    data.bindAdviceAttachmentControls = () => {};
    data.updateAdviceSendState = () => {};
    data.holdAdviceTopChrome = () => {};
    let refreshed = false;
    data.refreshAdviceSearchResults = () => { refreshed = true; };

    const list = { scrollTop: 0, scrollHeight: 200, clientHeight: 100 };
    const chromeInner = { innerHTML: '' };
    const filterBar = { innerHTML: '' };
    data._adviceMessageList = () => list;
    data.__context.document = {
        getElementById: () => null,
        querySelector(selector) {
            if (selector === '.advice-top-chrome-inner') return chromeInner;
            if (selector === '.advice-v6-filter-bar') return filterBar;
            return null;
        }
    };

    data.rerenderAdvicePanel();

    assert.equal(chromeInner.innerHTML, '<div>top</div>');
    assert.equal(filterBar.innerHTML, '<button class="advice-pill active">7天</button>');
    assert.equal(refreshed, true);
});

test('advice history search requires two characters before cold scan', async () => {
    const data = loadAdvicePanelHarness();
    const list = { innerHTML: '' };
    const summary = { textContent: '' };
    let searchCalls = 0;
    data.__context.document = {
        getElementById(id) { return id === 'adviceMessageSummary' ? summary : null; },
        querySelector() { return null; }
    };
    data._adviceMessageList = () => list;
    data.adviceSearchQuery = 'a';
    data.__context.window.dataStore = data.__context.dataStore = {
        advice: {
            async search() { searchCalls++; return []; },
            async count() { return 0; }
        }
    };

    await data.refreshAdviceSearchResults();

    assert.equal(searchCalls, 0);
    assert.match(list.innerHTML, /输入至少 2 个字符/);
    assert.match(summary.textContent, /不会预加载/);
});

test('advice history search cold scans only a small result window', async () => {
    const data = loadAdvicePanelHarness();
    const list = { innerHTML: '' };
    const summary = { textContent: '' };
    const calls = [];
    data.__context.document = {
        getElementById(id) { return id === 'adviceMessageSummary' ? summary : null; },
        querySelector() { return null; }
    };
    data._adviceMessageList = () => list;
    data.renderAdviceMessages = () => '';
    data.renderAdviceMessage = (msg) => `rendered:${msg.id};`;
    data.adviceSearchQuery = 'knee';
    data.__context.window.dataStore = data.__context.dataStore = {
        advice: {
            async search(keyword, limit) {
                calls.push({ keyword, limit });
                return Array.from({ length: limit }, (_, idx) => ({
                    id: `m${idx}`,
                    role: idx % 2 ? 'assistant' : 'user',
                    content: `knee ${idx}`,
                    at: '2026-05-30T00:00:00.000Z',
                    deleted: false
                }));
            },
            async count() { throw new Error('search should not count full history'); }
        }
    };

    await data.refreshAdviceSearchResults();

    assert.deepEqual(calls, [{ keyword: 'knee', limit: 20 }]);
    assert.match(list.innerHTML, /^rendered:/);
    assert.match(summary.textContent, /显示前 20 条/);
});

test('advice history search ignores stale cold results after query changes', async () => {
    const data = loadAdvicePanelHarness();
    const list = { innerHTML: '' };
    const summary = { textContent: '' };
    /** @type {() => void} */
    let releaseOldSearch = () => { throw new Error('old search was not started'); };
    data.__context.document = {
        getElementById(id) { return id === 'adviceMessageSummary' ? summary : null; },
        querySelector() { return null; }
    };
    data._adviceMessageList = () => list;
    data.renderAdviceMessages = () => '';
    data.renderAdviceMessage = (msg) => `rendered:${msg.id};`;
    data.__context.window.dataStore = data.__context.dataStore = {
        advice: {
            search(keyword) {
                if (keyword === 'old') {
                    return new Promise(resolve => { releaseOldSearch = () => resolve(/** @type {any[]} */ ([{ id: 'old-result', role: 'user', content: 'old', at: '2026-05-30T00:00:00.000Z' }])); });
                }
                return Promise.resolve([{ id: 'new-result', role: 'user', content: 'new', at: '2026-05-30T00:00:00.000Z' }]);
            },
            async count() { return 0; }
        }
    };

    data.adviceSearchQuery = 'old';
    const oldSearch = data.refreshAdviceSearchResults();
    data.adviceSearchQuery = 'new';
    await data.refreshAdviceSearchResults();
    releaseOldSearch();
    await oldSearch;

    assert.equal(list.innerHTML, 'rendered:new-result;');
    assert.match(summary.textContent, /new/);
    assert.doesNotMatch(summary.textContent, /old/);
});

test('deleting an advice message refreshes without dataStore advice count API', async () => {
    const data = loadAdvicePanelHarness();
    const list = { innerHTML: '' };
    const summary = { textContent: '' };
    data.__context.document = {
        getElementById(id) { return id === 'adviceMessageSummary' ? summary : null; },
        querySelector() { return null; }
    };
    data.__context.window.dataStore = data.__context.dataStore = {};
    data._adviceMessageList = () => list;
    data.renderAdviceMessages = () => '';
    data.renderAdviceMessage = (msg) => `rendered:${msg.id};`;
    data.adviceRange = 'all';
    data.adviceSearchQuery = '';
    data.deleteWithUndo = function deleteWithUndo(items, id, options) {
        this.softDeleteById(items, id);
        options.save.call(this);
        options.render.call(this);
        return true;
    };
    let saved = false;
    data.saveAndBackup = () => { saved = true; };

    data.deleteAiAdviceMessage(0, 'u1');
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.equal(saved, true);
    assert.equal(data.db.health.aiAdviceChat[0].deleted, true);
    assert.equal(list.innerHTML, 'rendered:a1;');
    assert.match(summary.textContent, /共 0 轮建议/);
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

test('advice entry restore resets stale scroll instead of restoring middle position', () => {
    const data = loadAdvicePanelHarness();
    const removed = [];
    const scrollCalls = [];
    const list = { scrollTop: 48, closest: () => ({}) };
    const scroller = { scrollTop: 56, scrollHeight: 900, clientHeight: 360 };
    let topChromeOffset = null;
    let syncs = 0;

    data.__context.sessionStorage = {
        getItem(key) { return key === data.SCROLL_KEY ? '56' : '24'; },
        setItem() {},
        removeItem(key) { removed.push(key); }
    };
    data._adviceMessageList = () => list;
    data._adviceScrollContainer = () => scroller;
    data._adviceSetScrollY = (target, y, smooth) => {
        scrollCalls.push({ target, y, smooth });
        target.scrollTop = y;
    };
    data.applyAdviceTopChromeOffset = (_list, offset) => { topChromeOffset = offset; };
    data.syncAdviceTopChromeToScroll = () => { syncs += 1; };
    data._adviceResetOnNextRender = true;
    data._adviceScrollTop = 56;
    data._advicePageScrollOffset = 24;

    data.restoreAdviceScroll();

    assert.equal(data._adviceResetOnNextRender, false);
    assert.equal(data._adviceScrollTop, 0);
    assert.equal(data._advicePageScrollOffset, 0);
    assert.equal(scroller.scrollTop, 0);
    assert.equal(list.scrollTop, 0);
    assert.equal(topChromeOffset, 0);
    assert.equal(syncs, 1);
    assert.deepEqual(scrollCalls.map(call => [call.y, call.smooth]), [[0, false]]);
    assert.deepEqual(removed.sort(), [data.PAGE_SCROLL_KEY, data.SCROLL_KEY].sort());
});

test('assistant message actions are compact icons without share button', () => {
    const data = loadAdviceRenderHarness();

    const html = data.renderAdviceMessage({
        id: 'a1',
        role: 'assistant',
        content: 'answer',
        at: '2026-05-30T00:00:01.000Z',
        idx: 1
    });

    assert.match(html, /aria-label="AI 回答操作"/);
    assert.match(html, /aria-label="复制"/);
    assert.match(html, /aria-label="重试"/);
    assert.match(html, /content_copy/);
    assert.doesNotMatch(html, />分享</);
    assert.doesNotMatch(html, /shareAdviceMessage/);
});

test('ungrouped advice bubbles can show the full message date', () => {
    const data = loadAdviceRenderHarness();

    const html = data.renderAdviceMessage({
        id: 'u-date',
        role: 'user',
        content: 'question from another day',
        at: '2026-05-30T08:05:00.000Z',
        idx: 0,
        showDateMeta: true
    });

    assert.match(html, /2026-05-30/);
    assert.match(html, /question from another day/);
});

test('advice version switcher renders after content instead of header', () => {
    const data = loadAdviceRenderHarness();

    const html = data.renderAdviceMessage({
        id: 'a2',
        role: 'assistant',
        content: 'new answer',
        at: '2026-05-30T00:00:02.000Z',
        idx: 2,
        replyToId: 'a1',
        versionIdx: 1,
        versionGroup: [
            { id: 'a1', versionIdx: 0 },
            { id: 'a2', versionIdx: 1 }
        ]
    });
    const headerEnd = html.indexOf('</div>', html.indexOf('advice-bubble-head'));
    const switcherIndex = html.indexOf('class="advice-version-switcher"');
    const actionsIndex = html.indexOf('advice-bubble-actions');
    const deleteIndex = html.indexOf('aria-label="删除当前版本"');
    const contentIndex = html.indexOf('advice-bubble-content');

    assert.ok(switcherIndex > headerEnd);
    assert.ok(switcherIndex > contentIndex);
    assert.ok(switcherIndex > actionsIndex);
    assert.ok(switcherIndex > deleteIndex);
    assert.doesNotMatch(html, /delete_sweep/);
});

test('touch intent pauses follow mode without freezing stream renderer', () => {
    const data = loadAdvicePanelHarness();
    data._adviceSending = true;
    data._adviceUserScrollPaused = false;
    data._adviceStreamUi = 'streaming';
    data.setAdviceStreamUiState = (state) => { data._adviceStreamUi = state; };
    data.showAdviceNewMessageButton = () => {};
    let paused = false;
    data._activeStreamRenderer = { pause: () => { paused = true; }, resume: () => {} };

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

    assert.equal(data._adviceStreamUi, 'streaming');
    assert.equal(data._adviceUserScrollPaused, true);
    assert.equal(paused, false);
});

test('cancelAiAdvice immediately freezes UI and preserves partial assistant reply', async () => {
    const data = loadAdvicePanelHarness();
    data.db.health.aiAdviceChat = [];
    const button = {
        disabled: true,
        classList: { toggle(name, enabled) { this[name] = enabled; } },
        attrs: {},
        setAttribute(name, value) { this.attrs[name] = value; },
        querySelector: () => ({ textContent: '' })
    };
    data.__context.document.getElementById = (id) => {
        if (id === 'advicePrompt') return { value: '' };
        if (id !== 'adviceSendBtn') return null;
        return button;
    };
    data.__context.ai.callStream = async (_messages, _maxTokens, onToken, opts) => {
        onToken('partial', 'partial answer');
        await new Promise((resolve, reject) => {
            opts.signal.addEventListener('abort', () => {
                onToken(' late', 'partial answer late');
                reject(Object.assign(new Error('AI_CANCELLED'), { code: 'AI_CANCELLED' }));
            }, { once: true });
        });
    };
    let saveCount = 0;
    data.save = () => { saveCount += 1; };

    const sendPromise = data.sendAiAdvice('stop this');
    assert.equal(data._adviceSending, true);
    assert.equal(data.cancelAiAdvice(), true);
    assert.equal(data._adviceSending, false);
    assert.equal(button.attrs.onclick, 'data.sendAiAdvice()');
    await sendPromise;

    const stopped = data.db.health.aiAdviceChat.find(msg => msg.role === 'assistant');
    assert.equal(stopped.stopped, true);
    assert.equal(stopped.error, false);
    assert.equal(stopped.content, 'partial answer');
    assert.equal(stopped.errorInfo.type, 'user_cancelled');
    assert.equal(data._adviceSending, false);
    assert.ok(saveCount >= 1);
});

test('attachment updateAdviceSendState keeps stop button while advice is sending', () => {
    const data = loadAdvicePanelHarness();
    const button = {
        disabled: true,
        classList: { toggle(name, enabled) { this[name] = enabled; } },
        attrs: {},
        title: '',
        setAttribute(name, value) { this.attrs[name] = value; },
        querySelector: () => ({ textContent: '' })
    };
    data.__context.document.getElementById = (id) => {
        if (id === 'adviceSendBtn') return button;
        if (id === 'advicePrompt') return { value: '' };
        return null;
    };
    data.__context.window.advicePanel = data.__context.__advicePanel;
    data.__context.window.data = data;
    data.__context.window.renderSafe = { escapeHtml: data.escapeHtml };
    const code = fs.readFileSync(new URL('../advice-attachments.js', import.meta.url), 'utf8');
    vm.runInContext(code, data.__context);
    Object.assign(data, data.__context.window.adviceAttachments);

    data._adviceSending = true;
    data.updateAdviceSendState();

    assert.equal(button.disabled, false);
    assert.equal(button.classList['is-stopping'], true);
    assert.equal(button.attrs.onclick, 'data.cancelAiAdvice()');
    assert.equal(button.attrs['aria-label'], '停止生成');
});
