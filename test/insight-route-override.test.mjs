// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { manualFallbackTarget } from '../ai-routing-pure.mjs';

const adviceSource = readFileSync(new URL('../advice-panel.js', import.meta.url), 'utf8');

function createInsightHarness(run, overrides = {}) {
    const block = { className: '', innerHTML: '' };
    let setTaskRouteCalls = 0;
    const toastCalls = [];
    const ai = {
        cfg: { enabled: true },
        getEffectiveConfig: () => ({ enabled: true }),
        run,
        setTaskRoute: () => { setTaskRouteCalls += 1; },
        ...overrides.ai
    };
    const sandbox = {
        ai,
        console,
        document: { getElementById: (id) => id === 'aiInsightLlmBlock' ? block : null, querySelector: () => null },
        localStorage: { getItem: () => null, setItem() {} },
        navigator: { maxTouchPoints: 0 },
        performance: { now: () => 0 },
        requestAnimationFrame: (fn) => fn(),
        sessionStorage: { getItem: () => null, removeItem() {}, setItem() {} },
        window: {
            ai,
            aiRoutingPure: { manualFallbackTarget },
            dataAiTemplates: null,
            haptics: {},
            matchMedia: () => ({ matches: false, addEventListener() {} }),
            toast: { sanitize: (error) => String(error?.message || error || ''), show: (...args) => toastCalls.push(args) }
        }
    };
    sandbox.globalThis = sandbox;
    sandbox.toast = sandbox.window.toast;
    vm.createContext(sandbox);
    vm.runInContext(`${adviceSource}\nthis.__advicePanel = advicePanel;`, sandbox);
    const originalContext = {
        planTitle: '原计划',
        planProgress: '1/3',
        nextItemName: '靠墙深蹲',
        metrics: { proIntake: 40, calIntake: 800 },
        analysis: { unknownTrainingLabels: [], pushPullRatio: '推1' }
    };
    const data = {
        ...sandbox.__advicePanel,
        _lastInsightCtx: originalContext,
        db: { health: {} },
        logicalDateKey: () => '2026-07-12',
        getInsightCache: overrides.getInsightCache || (() => null),
        setInsightCache: overrides.setInsightCache || function setInsightCache(key, day, html, payload) { this.savedInsight = { key, day, html, payload }; },
        updateInsightAiBlock(html) { block.innerHTML = html; },
        parseTrainingClassificationResponse: (text) => ({ advice: text, classifications: [] }),
        renderAdviceMarkdown: (text) => `<p>${text}</p>`,
        escapeHtml: (text) => String(text ?? ''),
        resizeInsightBody() {}
    };
    return { block, data, originalContext, setTaskRouteCalls: () => setTaskRouteCalls, toastCalls };
}

test('insight.quick carries routeOverride to ai.run without changing the primary task route', async () => {
    const runCalls = [];
    const harness = createInsightHarness(async (options) => {
        runCalls.push(options);
        return '保持轻量训练。';
    });
    const routeOverride = Object.freeze({ profileId: 'backup-profile', modelId: 'backup-insight' });

    await harness.data.requestInsightAiAdvice({ force: true, routeOverride });

    assert.equal(runCalls.length, 1);
    assert.equal(runCalls[0].taskId, 'insight.quick');
    assert.deepEqual(runCalls[0].routeOverride, routeOverride);
    assert.match(runCalls[0].messages[1].content, /原计划/);
    assert.equal(harness.data._lastInsightCtx.planTitle, harness.originalContext.planTitle);
    assert.equal(harness.setTaskRouteCalls(), 0);
});

test('insight.quick fallback exposes a retry action that preserves the fallback target', async () => {
    const target = Object.freeze({ profileId: 'backup-profile', modelId: 'backup-insight' });
    let retryOptions = null;
    let retryCalls = 0;
    const harness = createInsightHarness(async () => {
        const error = new Error('insight failed');
        error.aiFallback = { taskId: 'insight.quick', target };
        throw error;
    });
    await harness.data.requestInsightAiAdvice({ force: true });
    const retry = harness.toastCalls.find(([, type]) => type === 'error')?.[2]?.onAction;
    harness.data.requestInsightAiAdvice = (options) => { retryCalls += 1; retryOptions = options; };
    const firstRetry = retry?.();
    const duplicateRetry = retry?.();
    await firstRetry;
    await duplicateRetry;

    assert.equal(typeof retry, 'function');
    assert.equal(retryCalls, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(retryOptions)), { force: true, routeOverride: target });
    assert.equal(harness.setTaskRouteCalls(), 0);
    assert.equal(harness.originalContext.planTitle, '原计划');
});

test('insight cache key isolates effective profile and model identity', () => {
    const harness = createInsightHarness(async () => 'unused');
    const primary = harness.data.insightCacheKey(harness.originalContext, '2026-07-12', { profileId: 'profile-a', modelId: 'shared-model' });
    const otherProfile = harness.data.insightCacheKey(harness.originalContext, '2026-07-12', { profileId: 'profile-b', modelId: 'shared-model' });
    const otherModel = harness.data.insightCacheKey(harness.originalContext, '2026-07-12', { profileId: 'profile-a', modelId: 'other-model' });

    assert.notEqual(primary, otherProfile);
    assert.notEqual(primary, otherModel);
});

test('automatic fallback insight is cached only under the actual response identity', async () => {
    const writes = [];
    const primary = { profileId: 'primary-profile', modelId: 'primary-model' };
    const fallback = { profileId: 'fallback-profile', modelId: 'fallback-model' };
    const harness = createInsightHarness(async () => ({
        text: '备用模型建议',
        meta: { taskId: 'insight.quick', ...fallback, fallback: { used: true, index: 1, mode: 'automatic' } }
    }), {
        ai: { resolveTaskConfig: () => ({ enabled: true, ...primary }) },
        setInsightCache(key, day, html, payload) { writes.push({ key, day, html, payload }); }
    });

    await harness.data.requestInsightAiAdvice({ force: true });

    const primaryKey = harness.data.insightCacheKey(harness.originalContext, '2026-07-12', primary);
    const fallbackKey = harness.data.insightCacheKey(harness.originalContext, '2026-07-12', fallback);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].key, fallbackKey);
    assert.notEqual(writes[0].key, primaryKey);
});

test('insight failures and empty responses never populate cache', async () => {
    const writes = [];
    const emptyHarness = createInsightHarness(async () => ({
        text: '   ',
        meta: { taskId: 'insight.quick', profileId: 'profile-a', modelId: 'model-a' }
    }), { setInsightCache(...args) { writes.push(args); } });
    await emptyHarness.data.requestInsightAiAdvice({ force: true });

    const failedHarness = createInsightHarness(async () => { throw new Error('offline'); }, {
        setInsightCache(...args) { writes.push(args); }
    });
    await failedHarness.data.requestInsightAiAdvice({ force: true });

    assert.equal(writes.length, 0);
});

test('force bypasses a matching cache but normal requests keep using it', async () => {
    let runCalls = 0;
    let cacheReads = 0;
    const harness = createInsightHarness(async () => {
        runCalls += 1;
        return { text: '强制刷新建议', meta: { taskId: 'insight.quick', profileId: 'profile-a', modelId: 'model-a' } };
    }, {
        ai: { resolveTaskConfig: () => ({ enabled: true, profileId: 'profile-a', modelId: 'model-a' }) },
        getInsightCache() {
            cacheReads += 1;
            return { html: '<p>缓存建议</p>' };
        }
    });

    await harness.data.requestInsightAiAdvice();
    assert.equal(runCalls, 0);
    assert.equal(cacheReads, 1);

    await harness.data.requestInsightAiAdvice({ force: true });
    assert.equal(runCalls, 1);
    assert.equal(cacheReads, 1);
});

test('quick insight request does not enter chat, attachment, or version workflows', async () => {
    const harness = createInsightHarness(async () => ({
        text: '仅更新快速洞察',
        meta: { taskId: 'insight.quick', profileId: 'profile-a', modelId: 'model-a' }
    }));
    const chat = [{ id: 'chat-1', role: 'user', content: '保持不变' }];
    const attachment = { id: 'memory-image', kind: 'image', file: { name: 'memory-only.png' } };
    let chatCalls = 0;
    let attachmentCalls = 0;
    let versionCalls = 0;
    harness.data.db.health.aiAdviceChat = chat;
    harness.data._adviceAttachments = [attachment];
    harness.data.sendAiAdvice = () => { chatCalls += 1; };
    harness.data.prepareAdviceAttachmentsForRequest = () => { attachmentCalls += 1; };
    harness.data.setActiveAdviceVersion = () => { versionCalls += 1; };

    await harness.data.requestInsightAiAdvice({ force: true });

    assert.equal(chatCalls, 0);
    assert.equal(attachmentCalls, 0);
    assert.equal(versionCalls, 0);
    assert.equal(harness.data.db.health.aiAdviceChat, chat);
    assert.equal(harness.data._adviceAttachments[0], attachment);
});

test('cross-task fallback targets expose no insight retry action', async () => {
    const harness = createInsightHarness(async () => {
        throw Object.assign(new Error('failed'), {
            aiFallback: { taskId: 'advice.chat', target: { profileId: 'profile-a', modelId: 'model-a' } }
        });
    });
    await harness.data.requestInsightAiAdvice({ force: true });
    const action = harness.toastCalls.find(([, type]) => type === 'error')?.[2]?.onAction;
    assert.equal(action, undefined);
});

test('insight fallback retry strips credentials from an otherwise valid target', async () => {
    let retryOptions;
    const harness = createInsightHarness(async () => {
        throw Object.assign(new Error('failed'), {
            aiFallback: { taskId: 'insight.quick', target: { profileId: 'profile-a', modelId: 'model-a', apiKey: 'secret' } }
        });
    });
    await harness.data.requestInsightAiAdvice({ force: true });
    const action = harness.toastCalls.find(([, type]) => type === 'error')?.[2]?.onAction;
    harness.data.requestInsightAiAdvice = (options) => { retryOptions = options; };
    await action?.();

    assert.deepEqual(JSON.parse(JSON.stringify(retryOptions)), {
        force: true,
        routeOverride: { profileId: 'profile-a', modelId: 'model-a' }
    });
    assert.doesNotMatch(JSON.stringify(retryOptions), /secret|apiKey/);
});
