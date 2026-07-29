// @ts-nocheck
import * as aiJsonPure from '../ai-json-pure.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const aiApiSource = readFileSync(new URL('../ai-api.js', import.meta.url), 'utf8');
const foodLogSource = readFileSync(new URL('../food-log.js', import.meta.url), 'utf8');
const healthDietSource = readFileSync(new URL('../health-diet.js', import.meta.url), 'utf8');

function createSandbox(elements = {}) {
    const timerCallbacks = [];
    const sandbox = {
        AbortController,
        clearTimeout() {},
        Date,
        ai: {},
        console,
        document: {
            createElement: () => ({ appendChild() {}, className: '', textContent: '' }),
            createTextNode: (text) => ({ textContent: text }),
            getElementById: (id) => elements[id] || null,
        },
        setTimeout: (callback) => {
            timerCallbacks.push(callback);
            return timerCallbacks.length;
        },
        window: {
            data: { db: {} },
            dataAiTemplates: null,
            errorBus: { event() {}, report() {} },
            haptics: { error() {}, light() {}, success() {} },
            toast: { sanitize: (error) => String(error?.message || error || ''), show() {} },
            aiJsonPure: aiJsonPure.default || aiJsonPure,
        },
    };
    sandbox.globalThis = sandbox;
    sandbox.toast = sandbox.window.toast;
    sandbox.aiJsonPure = sandbox.window.aiJsonPure;
    vm.createContext(sandbox);
    vm.runInContext(aiApiSource, sandbox);
    sandbox.window.ai = sandbox.ai;
    sandbox.timerCallbacks = timerCallbacks;
    return sandbox;
}

test('food.text carries request-scoped routeOverride from the text entry to ai.run', async () => {
    const textarea = { value: '鸡胸肉 150g', focus() {}, placeholder: '' };
    const status = { textContent: '待识别' };
    const sandbox = createSandbox({ foodAiText: textarea, foodAiStatus: status });
    vm.runInContext(`${foodLogSource}\nthis.__foodLog = foodLog;`, sandbox);

    const routeOverride = Object.freeze({ profileId: 'backup-profile', modelId: 'backup-text' });
    const runCalls = [];
    let setTaskRouteCalls = 0;
    sandbox.ai.resolveTaskConfig = () => ({ enabled: true });
    sandbox.ai.getEffectiveConfig = () => ({ enabled: true });
    sandbox.ai.setTaskRoute = () => {
        setTaskRouteCalls += 1;
    };
    sandbox.ai.run = async (options) => {
        runCalls.push(options);
        return '[{"name":"鸡胸肉","grams":150,"cal":248,"pro":46,"carb":0,"fat":5}]';
    };

    const data = {
        ...sandbox.__foodLog,
        ensureAiRuntime: async () => sandbox.ai,
        normalizeAiFoodItems: (items) => items,
        formatAiDraft: (item) => ({ ...item }),
        renderAiFoodResults() {},
    };
    await data.aiParseFood({ routeOverride });

    assert.equal(runCalls.length, 1);
    assert.equal(runCalls[0].taskId, 'food.text');
    assert.deepEqual(runCalls[0].routeOverride, routeOverride);
    assert.match(runCalls[0].messages[1].content, /鸡胸肉 150g/);
    assert.equal(textarea.value, '鸡胸肉 150g');
    assert.equal(setTaskRouteCalls, 0);
});

test('food.text fallback action retries the captured input once without saving the route', async () => {
    const textarea = { value: '牛肉面一碗', focus() {}, placeholder: '' };
    const status = { textContent: '待识别' };
    const sandbox = createSandbox({ foodAiText: textarea, foodAiStatus: status });
    vm.runInContext(`${foodLogSource}\nthis.__foodLog = foodLog;`, sandbox);

    const target = Object.freeze({ profileId: 'backup-profile', modelId: 'backup-text' });
    const parseCalls = [];
    const toastCalls = [];
    let setTaskRouteCalls = 0;
    sandbox.window.aiRoutingPure = {
        manualFallbackTarget: (value) => (value === target ? target : null),
    };
    sandbox.window.toast.show = (...args) => toastCalls.push(args);
    sandbox.ai.resolveTaskConfig = () => ({ enabled: true });
    sandbox.ai.getEffectiveConfig = () => ({ enabled: true });
    sandbox.ai.setTaskRoute = () => {
        setTaskRouteCalls += 1;
    };
    sandbox.ai.parseFood = async (text, options) => {
        parseCalls.push({ text, options });
        if (parseCalls.length === 1) {
            const error = new Error('主模型暂时不可用');
            error.aiFallback = { taskId: 'food.text', target };
            throw error;
        }
        return [{ name: '牛肉面', grams: 500, cal: 650 }];
    };

    const data = {
        ...sandbox.__foodLog,
        ensureAiRuntime: async () => sandbox.ai,
        normalizeAiFoodItems: (items) => items,
        formatAiDraft: (item) => ({ ...item }),
        renderAiFoodResults() {},
    };

    await data.aiParseFood();
    assert.equal(parseCalls.length, 1);
    assert.equal(toastCalls.length, 1);
    const action = toastCalls[0][3];
    assert.equal(action.label, '使用备用模型重试');

    await Promise.all([action.onClick(), action.onClick()]);

    assert.equal(parseCalls.length, 2);
    assert.equal(parseCalls[1].text, '牛肉面一碗');
    assert.deepEqual(parseCalls[1].options.routeOverride, target);
    assert.equal(textarea.value, '牛肉面一碗');
    assert.equal(setTaskRouteCalls, 0);
});

test('food.text ordinary failures do not expose an unconfirmed fallback action', async () => {
    const textarea = { value: '早餐', focus() {}, placeholder: '' };
    const sandbox = createSandbox({ foodAiText: textarea, foodAiStatus: { textContent: '' } });
    vm.runInContext(`${foodLogSource}\nthis.__foodLog = foodLog;`, sandbox);

    const toastCalls = [];
    sandbox.window.toast.show = (...args) => toastCalls.push(args);
    sandbox.ai.getEffectiveConfig = () => ({ enabled: true });
    sandbox.ai.parseFood = async () => {
        throw new SyntaxError('AI 返回格式异常');
    };
    const data = {
        ...sandbox.__foodLog,
        ensureAiRuntime: async () => sandbox.ai,
        normalizeAiFoodItems: (items) => items,
        renderAiFoodResults() {},
    };

    await data.aiParseFood();

    assert.equal(toastCalls.length, 0);
});

test('food.vision carries the same in-memory image and routeOverride to ai.run', async () => {
    const sandbox = createSandbox();
    sandbox.window.aiVisionPure = {
        classifyVisionError: (error) => ({
            type: 'unknown',
            message: error?.message || '',
            isErrorToast: true,
        }),
    };
    vm.runInContext(healthDietSource, sandbox);

    const routeOverride = Object.freeze({ profileId: 'backup-profile', modelId: 'backup-vision' });
    const imageFile = Object.freeze({ name: 'meal.jpg', type: 'image/jpeg' });
    const runCalls = [];
    const clearedFailures = [];
    let setTaskRouteCalls = 0;
    sandbox.ai.resolveTaskConfig = () => ({ enabled: true });
    sandbox.ai.getEffectiveConfig = () => ({
        enabled: true,
        provider: 'openai',
        model: 'vision-model',
    });
    sandbox.ai._isHeicFile = () => false;
    sandbox.ai.clearVisionFailure = (...args) => clearedFailures.push(args);
    sandbox.ai.setTaskRoute = () => {
        setTaskRouteCalls += 1;
    };
    sandbox.ai.run = async (options) => {
        runCalls.push(options);
        return {
            text: '[{"name":"米饭","grams":150,"cal":174,"pro":4,"carb":39,"fat":1}]',
            meta: { provider: 'backup-provider', modelId: 'backup-vision' },
        };
    };

    const data = {
        ...sandbox.window.dataHealthDiet,
        _aiFoodEvidence: [{ id: 'stale-text-evidence' }],
        ensureAiRuntime: async () => sandbox.ai,
        getDietPhotoSupportInfo: () => ({ supported: true }),
        setDietPhotoStatus() {},
        normalizeAiFoodItems: (items) => items,
        formatAiDraft: (item) => ({ ...item }),
        renderAiFoodResults() {},
        dietPhotoTitle: () => '拍照识别',
    };
    await data.handleDietPhoto(imageFile, { routeOverride });

    assert.equal(runCalls.length, 1);
    assert.equal(runCalls[0].taskId, 'food.vision');
    assert.deepEqual(runCalls[0].routeOverride, routeOverride);
    assert.equal(runCalls[0].imageFile, imageFile);
    assert.equal(runCalls[0].returnMeta, true);
    assert.deepEqual(clearedFailures, [['backup-provider', 'backup-vision']]);
    assert.deepEqual(data._aiFoodEvidence, [null]);
    assert.equal(setTaskRouteCalls, 0);
});

test('food.vision fallback reuses the same File once with a fresh controller and never saves the route', async () => {
    const sandbox = createSandbox();
    const controllers = [];
    sandbox.AbortController = class {
        constructor() {
            this.signal = { aborted: false };
            controllers.push(this);
        }
        abort() {
            this.signal.aborted = true;
        }
    };
    sandbox.window.aiVisionPure = {
        classifyVisionError: (error) => ({
            type: 'network',
            message: error.message,
            isErrorToast: true,
        }),
    };
    vm.runInContext(healthDietSource, sandbox);

    const target = Object.freeze({ profileId: 'backup-profile', modelId: 'backup-vision' });
    const imageFile = Object.freeze({ name: 'meal.jpg', type: 'image/jpeg' });
    const parseCalls = [];
    const toastCalls = [];
    let setTaskRouteCalls = 0;
    sandbox.window.aiRoutingPure = {
        manualFallbackTarget: (value) => (value === target ? target : null),
    };
    sandbox.window.toast.show = (...args) => toastCalls.push(args);
    sandbox.ai.getEffectiveConfig = () => ({
        enabled: true,
        provider: 'openai',
        model: 'primary-vision',
    });
    sandbox.ai._isHeicFile = () => false;
    sandbox.ai.setTaskRoute = () => {
        setTaskRouteCalls += 1;
    };
    sandbox.ai.parseFoodFromImage = async (file, options) => {
        parseCalls.push({ file, options });
        if (parseCalls.length === 1) {
            throw Object.assign(new Error('主模型暂时不可用'), {
                aiFallback: { taskId: 'food.vision', target },
            });
        }
        options.onResolvedMeta?.({ provider: 'backup-provider', modelId: 'backup-vision' });
        return [{ name: '米饭', grams: 150, cal: 174, pro: 4, carb: 39, fat: 1 }];
    };

    const data = {
        ...sandbox.window.dataHealthDiet,
        ensureAiRuntime: async () => sandbox.ai,
        getDietPhotoSupportInfo: () => ({ supported: true }),
        setDietPhotoStatus() {},
        normalizeAiFoodItems: (items) => items,
        formatAiDraft: (item) => ({ ...item }),
        renderAiFoodResults() {},
        dietPhotoTitle: () => '拍照识别',
    };

    await data.handleDietPhoto(imageFile);
    const fallbackToast = toastCalls.find((call) => call[3]?.label === '使用备用模型重试');
    assert.ok(fallbackToast);
    await Promise.all([fallbackToast[3].onClick(), fallbackToast[3].onClick()]);

    assert.equal(parseCalls.length, 2);
    assert.equal(parseCalls[0].file, imageFile);
    assert.equal(parseCalls[1].file, imageFile);
    assert.deepEqual(parseCalls[1].options.routeOverride, target);
    assert.equal(controllers.length, 2);
    assert.notEqual(controllers[0], controllers[1]);
    assert.equal(setTaskRouteCalls, 0);
});

test('food.vision fallback releases its File when the toast expires', async () => {
    const sandbox = createSandbox();
    sandbox.window.aiVisionPure = {
        classifyVisionError: (error) => ({
            type: 'network',
            message: error.message,
            isErrorToast: true,
        }),
    };
    vm.runInContext(healthDietSource, sandbox);

    const target = Object.freeze({ profileId: 'backup-profile', modelId: 'backup-vision' });
    const imageFile = Object.freeze({ name: 'meal.jpg', type: 'image/jpeg' });
    const toastCalls = [];
    let parseCalls = 0;
    sandbox.window.aiRoutingPure = { manualFallbackTarget: () => target };
    sandbox.window.toast.show = (...args) => toastCalls.push(args);
    sandbox.ai.getEffectiveConfig = () => ({
        enabled: true,
        provider: 'openai',
        model: 'primary-vision',
    });
    sandbox.ai._isHeicFile = () => false;
    sandbox.ai.parseFoodFromImage = async () => {
        parseCalls += 1;
        throw Object.assign(new Error('主模型暂时不可用'), {
            aiFallback: { taskId: 'food.vision', target },
        });
    };

    const data = {
        ...sandbox.window.dataHealthDiet,
        ensureAiRuntime: async () => sandbox.ai,
        getDietPhotoSupportInfo: () => ({ supported: true }),
        setDietPhotoStatus() {},
        dietPhotoTitle: () => '拍照识别',
    };
    await data.handleDietPhoto(imageFile);
    const fallbackToast = toastCalls.find((call) => call[3]?.label === '使用备用模型重试');
    assert.ok(fallbackToast);
    sandbox.timerCallbacks.at(-1)();
    await fallbackToast[3].onClick();
    assert.equal(parseCalls, 1);
});

test('food.vision records failures against the request-scoped model without retaining the File', async () => {
    const sandbox = createSandbox();
    sandbox.window.aiVisionPure = {
        classifyVisionError: (error) => ({
            type: 'unsupported',
            message: error.message,
            isErrorToast: true,
            cacheVisionFailure: true,
        }),
    };
    vm.runInContext(healthDietSource, sandbox);

    const routeOverride = Object.freeze({ profileId: 'backup-profile', modelId: 'backup-vision' });
    const imageFile = Object.freeze({ name: 'private-meal.jpg', type: 'image/jpeg' });
    const failureCalls = [];
    sandbox.ai.resolveTaskConfig = (_taskId, override) => ({
        enabled: true,
        provider: override === routeOverride ? 'backup-provider' : 'primary-provider',
        modelId: override?.modelId || 'primary-vision',
    });
    sandbox.ai._isHeicFile = () => false;
    sandbox.ai.markVisionFailure = (...args) => failureCalls.push(args);
    sandbox.ai.parseFoodFromImage = async () => {
        throw new Error('模型不支持图片');
    };

    const data = {
        ...sandbox.window.dataHealthDiet,
        ensureAiRuntime: async () => sandbox.ai,
        getDietPhotoSupportInfo: () => ({ supported: true }),
        setDietPhotoStatus() {},
        dietPhotoTitle: () => '拍照识别',
    };
    await data.handleDietPhoto(imageFile, { routeOverride });

    assert.deepEqual(failureCalls, [['backup-provider', 'backup-vision', '模型不支持图片']]);
    assert.equal(failureCalls.flat().includes(imageFile), false);
});

test('food.vision cancellation exposes no fallback and does not persist or log the File', async () => {
    const sandbox = createSandbox();
    const imageFile = Object.freeze({ name: 'private-meal.jpg', type: 'image/jpeg' });
    const persisted = [];
    const reported = [];
    const synced = [];
    const backedUp = [];
    const logs = [];
    const toastCalls = [];
    sandbox.console = {
        log: (...args) => logs.push(args),
        warn: (...args) => logs.push(args),
        error: (...args) => logs.push(args),
    };
    sandbox.window.data.db = { health: {} };
    sandbox.window.errorBus = {
        event: (...args) => reported.push(args),
        report: (...args) => reported.push(args),
    };
    sandbox.window.sync = { push: (...args) => synced.push(args) };
    sandbox.window.backup = { export: (...args) => backedUp.push(args) };
    sandbox.localStorage = { getItem: () => null, setItem: (...args) => persisted.push(args) };
    sandbox.window.aiVisionPure = {
        classifyVisionError: () => ({ type: 'cancelled', message: '已取消', isErrorToast: false }),
    };
    sandbox.window.toast.show = (...args) => toastCalls.push(args);
    sandbox.ai.getEffectiveConfig = () => ({
        enabled: true,
        provider: 'openai',
        model: 'primary-vision',
    });
    sandbox.ai._isHeicFile = () => false;
    sandbox.ai.parseFoodFromImage = async () => {
        throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    };
    vm.runInContext(healthDietSource, sandbox);

    const data = {
        ...sandbox.window.dataHealthDiet,
        ensureAiRuntime: async () => sandbox.ai,
        getDietPhotoSupportInfo: () => ({ supported: true }),
        setDietPhotoStatus() {},
        dietPhotoTitle: () => '拍照识别',
    };
    await data.handleDietPhoto(imageFile);

    assert.equal(
        toastCalls.some((call) => call[3]?.label === '使用备用模型重试'),
        false,
    );
    assert.equal(JSON.stringify(sandbox.window.data.db).includes(imageFile.name), false);
    assert.deepEqual(persisted, []);
    assert.deepEqual(reported, []);
    assert.deepEqual(synced, []);
    assert.deepEqual(backedUp, []);
    assert.deepEqual(logs, []);
});
