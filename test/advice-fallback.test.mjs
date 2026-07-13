// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { manualFallbackTarget } from '../ai-routing-pure.mjs';

const FILE_SENTINEL = 'raw-file-bytes-must-stay-in-memory';
const BASE64_SENTINEL = 'data:image/png;base64,raw-attachment-must-not-persist';

function json(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function containsAttachmentPayload(value, file) {
    if (value === file) return true;
    try {
        const serialized = JSON.stringify(value);
        return serialized.includes(FILE_SENTINEL) || serialized.includes(BASE64_SENTINEL);
    } catch {
        return true;
    }
}

function fileFixture() {
    return Object.freeze({
        name: 'scan.png',
        type: 'image/png',
        size: 27,
        payload: FILE_SENTINEL
    });
}

function loadAdviceHarness() {
    const state = {
        calls: [],
        setTaskRouteCalls: [],
        toastCalls: [],
        unsafeWrites: [],
        savedSnapshots: [],
        /** @type {(call: any) => Promise<string>} */
        onInvoke: async () => 'answer'
    };
    const ai = {
        cfg: {
            enabled: true,
            model: 'primary-model',
            provider: 'primary-provider',
            activeProfileId: 'primary-profile',
            taskRoutes: {}
        },
        resolveTaskConfig(_taskId, routeOverride) {
            return {
                enabled: true,
                profileId: routeOverride?.profileId || 'primary-profile',
                model: routeOverride?.modelId || 'primary-model',
                provider: routeOverride?.profileId || 'primary-provider'
            };
        },
        analyzeVisionModel: () => ({ vision: true, isImageGen: false }),
        setTaskRoute(...args) {
            state.setTaskRouteCalls.push(args);
        },
        run(options = {}) {
            const call = { api: 'run', ...options };
            state.calls.push(call);
            return state.onInvoke(call);
        },
        runStream(taskId, messages, maxTokens, onToken = () => {}, options = {}) {
            const call = { api: 'runStream', ...options, taskId, messages, maxTokens, onToken };
            state.calls.push(call);
            return state.onInvoke(call);
        },
        async callStream(messages, maxTokens, onToken, options = {}) {
            const call = { api: 'callStream', ...options, taskId: 'advice.chat', messages, maxTokens, onToken };
            state.calls.push(call);
            return state.onInvoke(call);
        }
    };
    const context = {
        window: {},
        document: {
            visibilityState: 'visible',
            hidden: false,
            querySelector: () => null,
            getElementById: () => null,
            createElement: () => ({
                classList: { add() {}, remove() {} },
                setAttribute() {},
                addEventListener() {},
                appendChild() {},
                querySelector: () => null
            })
        },
        localStorage: {
            getItem: () => null,
            setItem(key, value) {
                if (containsAttachmentPayload([key, value], null)) state.unsafeWrites.push(['localStorage', key]);
            }
        },
        sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        requestAnimationFrame: (fn) => { fn(); return 1; },
        setTimeout: () => 0,
        clearTimeout: () => {},
        navigator: { maxTouchPoints: 0 },
        AbortController,
        DOMException,
        performance: { now: () => 0 },
        ai,
        toast: { sanitize: (error) => String(error?.message || error || '') }
    };
    context.window = {
        ai,
        aiRoutingPure: { manualFallbackTarget },
        toast: {
            show(...args) { state.toastCalls.push(args); },
            sanitize: context.toast.sanitize
        },
        errorBus: {
            event(...args) {
                if (containsAttachmentPayload(args, null)) state.unsafeWrites.push(['log', args[0]]);
            }
        },
        matchMedia: () => ({ matches: false, addEventListener() {} }),
        addEventListener() {},
        AbortController,
        adviceStreamRenderer: null,
        haptics: { light() {} }
    };
    context.globalThis = context;
    vm.createContext(context);
    const panelCode = fs.readFileSync(new URL('../advice-panel.js', import.meta.url), 'utf8');
    vm.runInContext(`${panelCode}\nthis.__advicePanel = advicePanel;`, context);
    const attachmentCode = fs.readFileSync(new URL('../advice-attachments.js', import.meta.url), 'utf8');
    vm.runInContext(attachmentCode, context);

    let nextId = 0;
    const data = {
        __context: context,
        __state: state,
        db: { health: { aiAdviceChat: [] }, aiTrash: [] },
        activeRecords(items) { return (items || []).filter(item => !item.deleted); },
        generateRecordId(prefix) { nextId += 1; return `${prefix}-${nextId}`; },
        buildAdviceMessages(prompt) { return [{ role: 'user', content: prompt }]; },
        classifyAdviceFailure(error) {
            return { content: 'AI request failed', info: { type: error?.code || 'network' } };
        },
        save() {
            const snapshot = JSON.stringify(this.db);
            state.savedSnapshots.push(snapshot);
            if (snapshot.includes(FILE_SENTINEL) || snapshot.includes(BASE64_SENTINEL)) {
                state.unsafeWrites.push(['data.db', snapshot]);
            }
        },
        syncAdviceRecords(payload) {
            if (containsAttachmentPayload(payload, null)) state.unsafeWrites.push(['sync', payload]);
        },
        exportAdviceBackup(payload) {
            if (containsAttachmentPayload(payload, null)) state.unsafeWrites.push(['backup', payload]);
        },
        softDeleteById(items, id) {
            const item = (items || []).find(entry => entry?.id === id);
            if (!item) return false;
            item.deleted = true;
            return true;
        },
        clearAdviceDraft() {},
        setAdviceStreamUiState() {},
        updateAdviceSendState() {},
        scrollAdviceToLatest() {},
        requestAdviceWakeLock() {},
        releaseAdviceWakeLock() {},
        rerenderAdvicePanel() {},
        scheduleAdviceStreamScroll() {},
        renderAdviceMarkdown(value) { return String(value || ''); },
        _adviceScrollContainer: () => null,
        _adviceMaxScrollY: () => 0,
        _adviceCurrentScrollY: () => 0,
        ADVICE_OUTPUT_TOKEN_BUDGET: context.__advicePanel.ADVICE_OUTPUT_TOKEN_BUDGET,
        ADVICE_AUTO_CONTINUE_LIMIT: context.__advicePanel.ADVICE_AUTO_CONTINUE_LIMIT,
        sendAiAdvice: context.__advicePanel.sendAiAdvice,
        cancelAiAdvice: context.__advicePanel.cancelAiAdvice,
        stopActiveAdviceReply: context.__advicePanel.stopActiveAdviceReply,
        retryAdviceFrom: context.__advicePanel.retryAdviceFrom,
        findAdviceMessage: context.__advicePanel.findAdviceMessage,
        isEmptyAdviceAssistantMessage: context.__advicePanel.isEmptyAdviceAssistantMessage,
        _isVersionActive: context.__advicePanel._isVersionActive,
        pruneEmptyAdviceAssistantMessages: context.__advicePanel.pruneEmptyAdviceAssistantMessages,
        pruneAdviceVersionGroup: context.__advicePanel.pruneAdviceVersionGroup,
        getAdviceVersionGroup: context.__advicePanel.getAdviceVersionGroup
    };
    Object.assign(data, context.window.adviceAttachments || {});
    context.window.data = data;
    return data;
}

function fallbackError(target = { profileId: 'fallback-profile', modelId: 'fallback-model' }, taskId = 'advice.chat') {
    return Object.assign(new Error('temporary upstream failure'), {
        code: 'NETWORK_ERROR',
        aiFallback: { taskId, target }
    });
}

test('advice.chat forwards request override to runStream without saving the task route', async () => {
    const data = loadAdviceHarness();
    const routeOverride = { profileId: 'temporary-profile', modelId: 'temporary-model' };

    await data.sendAiAdvice('question', { routeOverride });

    assert.equal(data.__state.calls.length, 1);
    assert.equal(data.__state.calls[0].api, 'runStream');
    assert.equal(data.__state.calls[0].taskId, 'advice.chat');
    assert.deepEqual(json(data.__state.calls[0].routeOverride), routeOverride);
    const answer = data.db.health.aiAdviceChat.find(message => message.role === 'assistant');
    assert.equal(answer.model, 'temporary-model');
    assert.equal(answer.provider, 'temporary-profile');
    assert.equal(answer.temporaryModel, true);
    assert.equal(data.__state.setTaskRouteCalls.length, 0);
});

test('advice.chat strips credentials and unrelated fields from a request override', async () => {
    const data = loadAdviceHarness();

    await data.sendAiAdvice('question', {
        routeOverride: {
            profileId: ' temporary-profile ',
            modelId: ' temporary-model ',
            apiKey: 'must-not-forward',
            reasoningDepth: 'high'
        }
    });

    assert.deepEqual(json(data.__state.calls[0].routeOverride), {
        profileId: 'temporary-profile', modelId: 'temporary-model'
    });
    assert.doesNotMatch(JSON.stringify(data.__state.calls[0].routeOverride), /apiKey|reasoningDepth|must-not-forward/);
    assert.equal(data.__state.setTaskRouteCalls.length, 0);
});

test('zero-output chat fallback retries the safe target without duplicating the user bubble', async () => {
    const data = loadAdviceHarness();
    const target = { profileId: 'fallback-profile', modelId: 'fallback-model' };
    let attempt = 0;
    data.__state.onInvoke = async () => {
        attempt += 1;
        if (attempt === 1) throw fallbackError(target);
        return 'recovered answer';
    };

    await data.sendAiAdvice('keep one question', { routeOverride: { profileId: 'first-profile', modelId: 'first-model' } });
    const failed = data.db.health.aiAdviceChat.find(message => message.role === 'assistant');
    const failedIndex = data.db.health.aiAdviceChat.indexOf(failed);
    await data.retryAdviceFrom(failedIndex, failed.id);

    const userMessages = data.db.health.aiAdviceChat.filter(message => message.role === 'user' && !message.deleted);
    const activeAnswers = data.db.health.aiAdviceChat.filter(message => message.role === 'assistant' && !message.deleted);
    const retriedCall = data.__state.calls.at(-1);
    const retriedAnswer = activeAnswers.find(message => message.id !== failed.id);
    assert.equal(userMessages.length, 1);
    assert.deepEqual(json(failed.aiFallback?.target), target);
    assert.deepEqual(json(retriedCall.routeOverride), target);
    assert.equal(retriedAnswer.replyToId, failed.id);
    assert.equal(retriedAnswer.versionIdx, 1);
    assert.equal(retriedAnswer.versionActive, true);
    assert.equal(failed.versionActive, false);
    assert.equal(data.__state.setTaskRouteCalls.length, 0);
});

test('chat fallback persists only a safe target and refresh retry keeps the original prompt', async () => {
    const firstSession = loadAdviceHarness();
    firstSession.__state.onInvoke = async () => {
        throw fallbackError({
            profileId: ' fallback-profile ',
            modelId: ' fallback-model ',
            apiKey: 'must-not-persist',
            provider: 'must-not-persist'
        });
    };

    await firstSession.sendAiAdvice('persist this question');
    const savedFailure = firstSession.db.health.aiAdviceChat.find(message => message.role === 'assistant');
    assert.deepEqual(json(savedFailure.aiFallback), {
        taskId: 'advice.chat',
        target: { profileId: 'fallback-profile', modelId: 'fallback-model' }
    });
    assert.doesNotMatch(JSON.stringify(savedFailure), /apiKey|must-not-persist/);

    const restored = loadAdviceHarness();
    restored.db = json(firstSession.db);
    restored.__state.onInvoke = async () => 'recovered after refresh';
    const restoredFailure = restored.db.health.aiAdviceChat.find(message => message.role === 'assistant');
    await restored.retryAdviceFrom(restored.db.health.aiAdviceChat.indexOf(restoredFailure), restoredFailure.id);

    assert.equal(restored.__state.calls.length, 1);
    assert.deepEqual(json(restored.__state.calls[0].routeOverride), {
        profileId: 'fallback-profile', modelId: 'fallback-model'
    });
    assert.deepEqual(json(restored.__state.calls[0].messages), [
        { role: 'user', content: 'persist this question' }
    ]);
    assert.equal(restored.db.health.aiAdviceChat.filter(message => message.role === 'user' && !message.deleted).length, 1);
});

test('malformed and cross-task fallback targets cannot start chat retry actions', async () => {
    let getterCalls = 0;
    for (const aiFallback of [
        { taskId: 'advice.chat', target: { profileId: 'profile-only' } },
        { taskId: 'food.text', target: { profileId: 'fallback-profile', modelId: 'fallback-model' } },
        Object.assign(Object.create({ taskId: 'food.text' }), {
            target: { profileId: 'fallback-profile', modelId: 'fallback-model' }
        }),
        Object.defineProperty({ taskId: 'advice.chat' }, 'target', {
            get() { getterCalls += 1; return { profileId: 'fallback-profile', modelId: 'fallback-model' }; }
        })
    ]) {
        const data = loadAdviceHarness();
        data.db.health.aiAdviceChat = [
            { id: 'user-1', role: 'user', content: 'question', deleted: false },
            { id: 'failed-1', role: 'assistant', content: 'failed', error: true, retryPrompt: 'question', aiFallback, deleted: false }
        ];

        await data.retryAdviceFrom(1, 'failed-1');

        assert.equal(data.__state.calls.length, 0);
        assert.equal(data.__state.setTaskRouteCalls.length, 0);
    }
    assert.equal(getterCalls, 0);
});

test('malformed and cross-task fallback errors never persist a chat action', async () => {
    for (const error of [
        fallbackError({ profileId: 'profile-only' }),
        fallbackError({ profileId: 'fallback-profile', modelId: 'fallback-model' }, 'food.text')
    ]) {
        const data = loadAdviceHarness();
        data.__state.onInvoke = async () => { throw error; };

        await data.sendAiAdvice('question');

        const failed = data.db.health.aiAdviceChat.find(message => message.role === 'assistant');
        assert.equal(failed.aiFallback, undefined);
        assert.equal(data.__state.setTaskRouteCalls.length, 0);
    }
});

test('failure retry remains accessible and a double trigger starts only one request', async () => {
    const data = loadAdviceHarness();
    data.db.health.aiAdviceChat = [
        { id: 'user-1', role: 'user', content: 'question', deleted: false },
        {
            id: 'failed-1',
            role: 'assistant',
            content: 'failed',
            error: true,
            retryPrompt: 'question',
            aiFallback: { target: { profileId: 'fallback-profile', modelId: 'fallback-model' } },
            versionIdx: 0,
            versionActive: true,
            deleted: false
        }
    ];
    let release;
    data.__state.onInvoke = () => new Promise(resolve => { release = resolve; });

    const first = data.retryAdviceFrom(1, 'failed-1');
    const second = data.retryAdviceFrom(1, 'failed-1');
    assert.equal(data.__state.calls.length, 1);
    release('answer');
    await Promise.all([first, second]);

    const renderContext = {
        window: {}, document: { querySelector: () => null, createElement: () => ({}) },
        NodeFilter: { SHOW_TEXT: 4 }, requestAnimationFrame: (fn) => fn(), getComputedStyle: () => ({ overflowY: 'visible' }), advicePanel: {}
    };
    renderContext.window = renderContext;
    renderContext.globalThis = renderContext;
    vm.createContext(renderContext);
    const renderCode = fs.readFileSync(new URL('../advice-render.js', import.meta.url), 'utf8');
    vm.runInContext(`${renderCode}\nthis.__render = advicePanel;`, renderContext);
    const renderer = renderContext.__render;
    renderer.parseHistoryDate = () => new Date('2026-01-01T00:00:00.000Z');
    renderer.logicalDateKey = () => '2026-01-01';
    renderer.renderAdviceMarkdown = (value) => String(value || '');
    renderer.escapeHtml = (value) => String(value || '');
    const html = renderer.renderAdviceMessage({ ...data.db.health.aiAdviceChat[1], idx: 1 }, true, '');
    assert.match(html, /aria-label="[^"]*重试[^"]*"/);
});

test('advice.vision fallback reuses the same in-memory File object', async () => {
    const data = loadAdviceHarness();
    const file = fileFixture();
    const initialOverride = { profileId: 'vision-primary-profile', modelId: 'vision-primary-model' };
    const fallbackTarget = { profileId: 'vision-fallback-profile', modelId: 'vision-fallback-model' };
    const attachment = {
        id: 'image-1', previewId: 'image-1', kind: 'image', label: '图片', name: file.name,
        mime: file.type, size: file.size, file, readable: true, status: 'ready', persisted: false
    };
    data._adviceAttachments = [attachment];
    data.__context.document.getElementById = (id) => id === 'advicePrompt' ? { value: 'inspect image' } : null;
    let attempt = 0;
    let releaseRetry;
    data.__state.onInvoke = async () => {
        attempt += 1;
        if (attempt === 1) throw fallbackError(fallbackTarget, 'advice.vision');
        return new Promise(resolve => { releaseRetry = resolve; });
    };

    await data.sendAiAdvice('', { routeOverride: initialOverride });
    const failed = data.db.health.aiAdviceChat.find(message => message.role === 'assistant');
    assert.equal(data.getAdviceAttachmentPayload(failed.id).attachments[0].file, file);
    const firstRetry = data.retryAdviceFrom(data.db.health.aiAdviceChat.indexOf(failed), failed.id);
    const secondRetry = data.retryAdviceFrom(data.db.health.aiAdviceChat.indexOf(failed), failed.id);

    assert.equal(data.__state.calls[0].taskId, 'advice.vision');
    assert.equal(data.__state.calls[1].taskId, 'advice.vision');
    assert.equal(data.__state.calls.length, 2);
    assert.equal(data.__state.calls[0].attachments[0].file, file);
    assert.equal(data.__state.calls[1].attachments[0].file, file);
    assert.deepEqual(json(data.__state.calls[0].routeOverride), initialOverride);
    assert.deepEqual(json(data.__state.calls[1].routeOverride), fallbackTarget);
    assert.equal(data.db.health.aiAdviceChat.filter(message => message.role === 'user' && !message.deleted).length, 1);
    assert.equal(data.__state.setTaskRouteCalls.length, 0);
    releaseRetry('vision recovered');
    await Promise.all([firstRetry, secondRetry]);
    assert.equal(data.getAdviceAttachmentPayload(failed.id), null);
});

test('vision failure never writes File, base64, or raw attachment objects to persistence or diagnostics', async () => {
    const data = loadAdviceHarness();
    const file = fileFixture();
    data._adviceAttachments = [{
        id: 'image-1', previewId: 'image-1', kind: 'image', label: '图片', name: file.name,
        mime: file.type, size: file.size, file, thumb: BASE64_SENTINEL, readable: true, status: 'ready', persisted: false
    }];
    data.__context.document.getElementById = (id) => id === 'advicePrompt' ? { value: 'inspect image' } : null;
    data.__state.onInvoke = async () => { throw fallbackError(undefined, 'advice.vision'); };

    await data.sendAiAdvice();

    assert.doesNotMatch(JSON.stringify(data.db), new RegExp(`${FILE_SENTINEL}|${BASE64_SENTINEL}`));
    assert.deepEqual(data.__state.unsafeWrites, []);
});

test('a refreshed vision failure without its memory payload asks for a new image and does not retry', async () => {
    const firstSession = loadAdviceHarness();
    const file = fileFixture();
    firstSession._adviceAttachments = [{
        id: 'image-1', previewId: 'image-1', kind: 'image', label: '图片', name: file.name,
        mime: file.type, size: file.size, file, readable: true, status: 'ready', persisted: false
    }];
    firstSession.__context.document.getElementById = (id) => id === 'advicePrompt' ? { value: 'inspect image' } : null;
    firstSession.__state.onInvoke = async () => { throw fallbackError(undefined, 'advice.vision'); };
    await firstSession.sendAiAdvice();

    const restored = loadAdviceHarness();
    restored.db = json(firstSession.db);
    const failed = restored.db.health.aiAdviceChat.find(message => message.role === 'assistant');
    await restored.retryAdviceFrom(restored.db.health.aiAdviceChat.indexOf(failed), failed.id);

    assert.equal(restored.__state.calls.length, 0);
    assert.match(restored.__state.toastCalls.flat().join(' '), /重新.*(附图|附件|图片)/);
});

test('automatic continuation keeps the initial task and immutable route override', async () => {
    const data = loadAdviceHarness();
    const routeOverride = { profileId: 'temporary-profile', modelId: 'temporary-model' };
    let attempt = 0;
    data.__state.onInvoke = async (call) => {
        attempt += 1;
        if (attempt === 1) {
            call.onToken('head ', 'head ', { finishReason: 'length', done: true });
            return 'head ';
        }
        call.onToken('tail', 'tail', { finishReason: 'stop', done: true });
        return 'tail';
    };

    const sending = data.sendAiAdvice('continue this', { routeOverride });
    routeOverride.modelId = 'mutated-after-send';
    await sending;

    assert.equal(data.__state.calls.length, 2);
    assert.deepEqual(data.__state.calls.map(call => call.taskId), ['advice.chat', 'advice.chat']);
    assert.deepEqual(data.__state.calls.map(call => json(call.routeOverride)), [
        { profileId: 'temporary-profile', modelId: 'temporary-model' },
        { profileId: 'temporary-profile', modelId: 'temporary-model' }
    ]);
});

test('an error after streamed content preserves the partial version and exposes no cross-model fallback', async () => {
    const data = loadAdviceHarness();
    data.__state.onInvoke = async (call) => {
        call.onToken('partial', 'partial answer', { finishReason: '', done: false });
        throw fallbackError();
    };

    await data.sendAiAdvice('question', {
        replyToId: 'answer-root',
        versionIdx: 2,
        versionActive: true,
        skipUserMessage: true,
        routeOverride: { profileId: 'first-profile', modelId: 'first-model' }
    });

    const answer = data.db.health.aiAdviceChat.find(message => message.role === 'assistant');
    assert.equal(answer.content, 'partial answer');
    assert.equal(answer.replyToId, 'answer-root');
    assert.equal(answer.versionIdx, 2);
    assert.equal(answer.versionActive, true);
    assert.equal(answer.aiFallback, undefined);
    assert.equal(answer.retryPrompt, undefined);
    assert.equal(data.__state.toastCalls.length, 0);
    assert.equal(data.db.health.aiAdviceChat.filter(message => message.role === 'assistant').length, 1);
});

test('continuation failure preserves the first segment and finish reason without creating fallback history', async () => {
    const data = loadAdviceHarness();
    let attempt = 0;
    data.__state.onInvoke = async (call) => {
        attempt += 1;
        if (attempt === 1) {
            call.onToken('head', 'head', { finishReason: 'length', done: true });
            return 'head';
        }
        throw fallbackError();
    };

    await data.sendAiAdvice('long answer');

    const answer = data.db.health.aiAdviceChat.find(message => message.role === 'assistant');
    assert.equal(answer.content, 'head');
    assert.equal(answer.finishReason, 'length');
    assert.equal(answer.aiFallback, undefined);
    assert.equal(data.db.health.aiAdviceChat.filter(message => message.role === 'assistant').length, 1);
});

test('cancelling vision generation releases composer attachments and stores no fallback payload', async () => {
    const data = loadAdviceHarness();
    const file = fileFixture();
    data._adviceAttachments = [{
        id: 'image-1', previewId: 'image-1', kind: 'image', label: '图片', name: file.name,
        mime: file.type, size: file.size, file, readable: true, status: 'ready', persisted: false
    }];
    data.__context.document.getElementById = (id) => id === 'advicePrompt' ? { value: 'inspect image' } : null;
    data.__state.onInvoke = (call) => new Promise((resolve, reject) => {
        call.signal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { code: 'AI_CANCELLED' })), { once: true });
    });

    const sending = data.sendAiAdvice();
    assert.equal(data.cancelAiAdvice(), true);
    await sending;

    const stopped = data.db.health.aiAdviceChat.find(message => message.role === 'assistant');
    assert.equal(stopped.stopped, true);
    assert.equal(stopped.aiFallback, undefined);
    assert.equal(data._adviceAttachments.length, 0);
    assert.equal(data._adviceAttachmentPayloads.size, 0);
    assert.doesNotMatch(JSON.stringify(data.db), new RegExp(FILE_SENTINEL));
    assert.deepEqual(data.__state.unsafeWrites, []);
});

test('successful vision generation releases its session-only attachment payload', async () => {
    const data = loadAdviceHarness();
    const file = fileFixture();
    data._adviceAttachments = [{
        id: 'image-1', previewId: 'image-1', kind: 'image', label: '图片', name: file.name,
        mime: file.type, size: file.size, file, readable: true, status: 'ready', persisted: false
    }];
    data.__context.document.getElementById = (id) => id === 'advicePrompt' ? { value: 'inspect image' } : null;

    await data.sendAiAdvice();

    assert.equal(data.__state.calls[0].attachments[0].file, file);
    assert.equal(data._adviceAttachmentPayloads.size, 0);
    assert.doesNotMatch(JSON.stringify(data.db), new RegExp(FILE_SENTINEL));
});
