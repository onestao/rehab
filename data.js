const data = {
    DB_KEY: 'rehab_pro_universal_db',
    CFG_KEY: 'rehab_pro_universal_cfg',
    SCHEMA_VERSION: 3,
    db: {
        actions: [],
        routines: [],
        history: [],
        rate: 1.1,
        voice: { priority: 'online-first', engines: [], cache: true, timeoutMs: 4000 },
        cardio: { weight: 70, target: 30, type: 'walk' },
        health: { weights: [], foodLogs: [], exerciseLogs: [], reports: [], rehabWeekly: [], prescriptionActions: [], goalType: 'loss', bodyPlan: null, weightPlan: null, dietGoal: null, aiAdviceChat: [], weeklyGoalSessions: 5 },
        aiProfiles: [],
        aiActiveId: '',
        aiModels: [],
        aiTaskRoutes: {},
        aiTemplates: [],
        aiTemplateActiveId: '',
        aiTrash: [],
        aiRetryMode: 'versioned',
        prefs: { haptics: true, experiments: { miScaleBle: false } },
        weeklyPlan: {},
        aiCipher: null,
        libraryView: 'actions',
        libraryFilterTag: '',
        cache: { prByAction: {}, prUpdatedAt: 0 }
    },
    cfg: { mode: 'none', s3: {}, dav: {} },
    historyMonthOffset: 0,
    routineView: 'library',
    recordView: 'today',
    healthView: 'diet',
    weightRange: 'month',
    weightTrendRange: 'month',
    weightTrendAnchorKey: '',
    weightTrendGranularity: '',
    weightRecordRange: 'month',
    weightRecordAnchorKey: '',
    weightRecordGranularity: '',
    selectedCalendarDate: null,
    adviceModel: '__current__',
    historyColors: ['#2563eb', '#7c3aed', '#059669', '#f59e0b', '#e11d48', '#0891b2', '#9333ea', '#ea580c']
};

function dataModules() {
    return [
        window.dataRecords || {},
        window.dataSchema || {},
        window.dataUtils || {},
        window.dataStore || {},
        window.dataUiState || {},
        window.dataHealthDiet || {},
        window.dataHealthWeight || {},
        window.dataHealthExercise || {},
        window.dataHealthProfile || {},
        window['dataReport'] || {},
        window.dataGoalPlan || {},
        window.dataRoutinePlan || {},
        window.dataRoutineLibrary || {},
        window.dataHistoryView || {},
        window.dataWeeklySummary || {},
        window.dataViews || {},
        window.dataTodayViewCore || {},
        window.dataAiTemplates || {},
        window.adviceTemplateManager || {},
        window['dataPlanStore'] || {},
        window['dataPlanFeedback'] || {},
        window['dataPlanCooldown'] || {},
        window['dataPlanAutoAdjust'] || {},
        window['dataPlanWeekly'] || {},
        window['dataPlanAi'] || {},
        window['dataPlanEquipment'] || {},
        window['dataPlanUi'] || {}
    ];
}

function mergeDataModules() {
    const modules = dataModules();
    const runtimeState = new Map();

    modules.forEach((module) => {
        const keys = module?.__runtimeStateKeys;
        if (!Array.isArray(keys)) return;
        keys.forEach((key) => {
            if (typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(data, key)) return;
            runtimeState.set(key, data[key]);
        });
    });

    Object.assign(data, ...modules);
    runtimeState.forEach((value, key) => { data[key] = value; });
}

mergeDataModules();

const LAZY_RECORD_OPENERS = {
    openDietModal: {
        owner: 'dataHealthDiet',
        scripts: ['fooddb', 'health-diet', 'food-log'],
        label: '饮食记录'
    },
    openWeightModal: {
        owner: 'dataHealthWeight',
        scripts: ['health-weight'],
        label: '体重记录'
    },
    openExerciseModal: {
        owner: 'dataHealthExercise',
        scripts: ['health-exercise'],
        label: '运动记录'
    }
};

/** Plan UI methods exposed by first-paint hard onclick before plan-ui loads. */
const LAZY_PLAN_OPENERS = [
    'openNewPlanSheet',
    'openPlanTaskDrawer',
    'handlePlanTaskTap',
    'selectTodayPlan',
    'openPlanTodayAiSheet',
    'enhanceTodayPage'
];

const PLAN_FEATURE_FAIL_TOAST = '计划功能暂时未加载成功。请检查网络后重试，已保存的训练记录不会丢失。';

async function loadAppScripts(names = []) {
    if (typeof window.loadAppScript !== 'function') {
        throw new Error('模块加载器尚未就绪，请稍后重试');
    }
    const unique = [...new Set(names)].filter(Boolean);
    await Promise.all(unique.map(name => window.loadAppScript(name)));
    data.refreshModules?.();
}

function currentActivePageId() {
    return data._activePageId
        || document.querySelector?.('.page.active')?.id
        || '';
}

function currentNavigationGeneration() {
    const token = window.ui?._navigationToken;
    return Number.isFinite(token) ? token : 0;
}

function resolvePlanMethod(actionName) {
    const fromOwner = window.dataPlanUi?.[actionName];
    if (typeof fromOwner === 'function' && fromOwner !== data[actionName]) return fromOwner;
    const merged = data[actionName];
    if (typeof merged === 'function' && !merged.__isPlanFeatureGateStub) return merged;
    if (typeof fromOwner === 'function') return fromOwner;
    return null;
}

function createPlanFeatureGate() {
    const gate = {
        state: 'unloaded',
        _loadPromise: null,
        _pendingByAction: Object.create(null),
        _intentSeq: 0,

        getState() {
            return this.state;
        },

        async ensureReady() {
            if (this.state === 'ready' && LAZY_PLAN_OPENERS.every((name) => resolvePlanMethod(name))) {
                return true;
            }
            if (this._loadPromise) return this._loadPromise;

            this.state = 'loading';
            this._loadPromise = (async () => {
                if (typeof window.loadAppScript !== 'function') {
                    throw new Error('模块加载器尚未就绪');
                }
                await window.loadAppScript('plan-ui');
                data.refreshModules?.();
                const missing = LAZY_PLAN_OPENERS.filter((name) => !resolvePlanMethod(name));
                if (missing.length) {
                    throw new Error(`计划模块未注册: ${missing.join(', ')}`);
                }
                this.state = 'ready';
                return true;
            })().catch((error) => {
                this.state = 'failed';
                this._loadPromise = null;
                throw error;
            }).finally(() => {
                if (this.state === 'ready') this._loadPromise = null;
            });

            return this._loadPromise;
        },

        async run(actionName, args = [], context = {}) {
            const implNow = resolvePlanMethod(actionName);
            if (implNow) return implNow.apply(data, args);

            // Single-flight: rapid clicks share one load + one replay.
            const existing = this._pendingByAction[actionName];
            if (existing) return existing.promise;

            const intentId = ++this._intentSeq;
            const routeAtClick = context.routeAtClick || currentActivePageId() || 'today';
            const navigationGeneration = context.navigationGeneration ?? currentNavigationGeneration();
            const intent = {
                intentId,
                actionName,
                args,
                routeAtClick,
                navigationGeneration,
                status: 'loading',
                createdAt: Date.now(),
                promise: null
            };

            // Reserve the slot synchronously before any await so concurrent callers join.
            const promise = (async () => {
                const busyKey = actionName;
                data.beginActionBusy?.(busyKey, '加载中');
                try {
                    await this.ensureReady();
                    const active = currentActivePageId() || '';
                    // Empty active means route not yet resolved — do not treat as navigated-away.
                    const stillSameRoute = !routeAtClick || !active || active === routeAtClick;
                    const gen = currentNavigationGeneration();
                    // Cancel only when a real tab navigation advanced the token after the click.
                    const generationOk = !navigationGeneration
                        || navigationGeneration === 0
                        || gen === 0
                        || gen === navigationGeneration;
                    if (!stillSameRoute || !generationOk) {
                        intent.status = 'cancelled';
                        return undefined;
                    }
                    const impl = resolvePlanMethod(actionName);
                    if (!impl) throw new Error(`计划方法未就绪: ${actionName}`);
                    intent.status = 'done';
                    return impl.apply(data, intent.args);
                } catch (error) {
                    intent.status = 'failed';
                    this.state = 'failed';
                    window.errorBus?.report?.(`plan-feature.${actionName}`, error);
                    window.toast?.show?.(PLAN_FEATURE_FAIL_TOAST, 'error');
                    return undefined;
                } finally {
                    data.endActionBusy?.(busyKey);
                    if (this._pendingByAction[actionName]?.intentId === intentId) {
                        delete this._pendingByAction[actionName];
                    }
                }
            })();

            intent.promise = promise;
            this._pendingByAction[actionName] = intent;
            return promise;
        }
    };
    return gate;
}

function attachPlanFeatureGate() {
    data.planFeatureGate = data.planFeatureGate || createPlanFeatureGate();
    const gate = data.planFeatureGate;
    // If a previous load already registered real methods, mark ready.
    if (LAZY_PLAN_OPENERS.every((name) => resolvePlanMethod(name))) {
        gate.state = 'ready';
    }

    LAZY_PLAN_OPENERS.forEach((actionName) => {
        if (resolvePlanMethod(actionName) && typeof data[actionName] === 'function' && !data[actionName].__isPlanFeatureGateStub) {
            return;
        }
        if (typeof data[actionName] === 'function' && data[actionName].__isPlanFeatureGateStub) return;

        const stub = function (...args) {
            return data.planFeatureGate.run(actionName, args, {
                routeAtClick: currentActivePageId() || 'today',
                navigationGeneration: currentNavigationGeneration()
            });
        };
        stub.__isPlanFeatureGateStub = true;
        data[actionName] = stub;
    });
}

function attachPlanAliases() {
    // Weekly dock: never silent no-op; load plan-ui (pulls plan-weekly) then open once.
    data.openPlanWeeklySheet = data.openPlanWeeklySheet || async function (...args) {
        if (typeof window.planWeekly?.open === 'function') {
            return window.planWeekly.open.apply(window.planWeekly, args);
        }
        if (!data.beginActionBusy?.('openPlanWeeklySheet', '加载中')) return;
        try {
            if (typeof window.loadAppScript === 'function') {
                // plan-ui lists plan-weekly as prerequisite; either path is fine.
                try {
                    await window.loadAppScript('plan-weekly');
                } catch {
                    await window.loadAppScript('plan-ui');
                }
            }
            data.refreshModules?.();
            if (typeof window.planWeekly?.open === 'function') {
                return window.planWeekly.open.apply(window.planWeekly, args);
            }
            window.toast?.show?.('近期计划功能暂时未加载成功。请检查网络后重试。', 'error');
        } catch (e) {
            window.errorBus?.report?.('lazy-plan.openPlanWeeklySheet', e);
            window.toast?.show?.('近期计划功能暂时未加载成功。请检查网络后重试。', 'error');
        } finally {
            data.endActionBusy?.('openPlanWeeklySheet');
        }
    };
    data.openPlanAiSheet = data.openPlanAiSheet || async function (...args) {
        if (typeof window.dataPlanAi?.openPlanAiSheet === 'function') {
            return window.dataPlanAi.openPlanAiSheet.apply(data, args);
        }
        if (!data.beginActionBusy?.('openPlanAiSheet', '加载中')) return;
        try {
            if (typeof window.loadAppScript === 'function' && !window.dataPlanAi?.openPlanAiSheet) {
                await window.loadAppScript('plan-ai');
            }
            data.refreshModules?.();
            const open = window.dataPlanAi?.openPlanAiSheet;
            if (typeof open === 'function') return open.apply(data, args);
            window.toast?.show?.('AI 计划模块尚未加载完成，请稍后重试。', 'error');
        } catch (e) {
            window.errorBus?.report?.('lazy-plan.openPlanAiSheet', e);
            window.toast?.show?.('AI 计划加载失败，请稍后重试。', 'error');
        } finally {
            data.endActionBusy?.('openPlanAiSheet');
        }
    };
    data.renderPlanEquipmentPanel = data.renderPlanEquipmentPanel || data.renderPlanEquipmentCard;
}

function attachLazyRecordOpeners() {
    Object.entries(LAZY_RECORD_OPENERS).forEach(([method, cfg]) => {
        if (typeof window[cfg.owner]?.[method] === 'function') return;
        data[method] = async function (...args) {
            if (typeof window[cfg.owner]?.[method] === 'function') {
                return window[cfg.owner][method].apply(this, args);
            }
            if (!data.beginActionBusy?.(method, '加载中')) return;
            try {
                data._lazyRecordLoadPromises = data._lazyRecordLoadPromises || {};
                const key = cfg.scripts.join('|');
                if (!data._lazyRecordLoadPromises[key]) {
                    data._lazyRecordLoadPromises[key] = loadAppScripts(cfg.scripts)
                        .finally(() => { delete data._lazyRecordLoadPromises[key]; });
                }
                await data._lazyRecordLoadPromises[key];
                const open = window[cfg.owner]?.[method];
                if (typeof open === 'function') return open.apply(this, args);
                throw new Error(`${cfg.label}模块未注册`);
            } catch (e) {
                window.errorBus?.report?.(`lazy-record.${method}`, e);
                window.toast?.show?.(`${cfg.label}加载失败，请稍后重试。`, 'error');
            } finally {
                data.endActionBusy?.(method);
            }
        };
    });
}

attachPlanAliases();
attachLazyRecordOpeners();
attachPlanFeatureGate();

async function checkAppUpdate() {
    if (!data.beginActionBusy?.('checkAppUpdate', '检测中...')) return;
    try {
        if (!window.appUpdate?.checkNow) {
            if (typeof window.loadAppScript !== 'function') {
                window.toast?.show?.('更新模块加载器尚未就绪，请稍后重试。', 'error');
                return;
            }
            await window.loadAppScript('app-update');
        }
        if (window.appUpdate?.checkNow) {
            return await window.appUpdate.checkNow();
        }
        window.toast?.show?.('更新模块尚未就绪，请稍后重试。', 'error');
    } catch (e) {
        window.errorBus?.report?.('lazy-update.checkAppUpdate', e);
        window.toast?.show?.('更新模块加载失败，请稍后重试。', 'error');
    } finally {
        data.endActionBusy?.('checkAppUpdate');
    }
}

function attachStableUpdateCheck() {
    data.checkAppUpdate = checkAppUpdate;
}

attachStableUpdateCheck();

data.ensureAiRuntime = async function (options = {}) {
    if (!data._aiRuntimePromise) {
        data._aiRuntimePromise = (async () => {
            await loadAppScripts(['ai-store', 'ai-profile', 'ai-api']);
            const client = window.ai;
            if (!client) throw new Error('AI 模块未加载完成');
            if (typeof client.init === 'function' && !data._aiRuntimeReady) {
                await client.init({ saveData: true, renderData: false });
                data._aiRuntimeReady = true;
            }
            return client;
        })().catch((e) => {
            data._aiRuntimePromise = null;
            data._aiRuntimeReady = false;
            throw e;
        });
    }
    const client = await data._aiRuntimePromise;
    window.aiDebug?.patch?.();
    if (options.vision && !data._aiVisionRuntimeReady) {
        if (!data._aiVisionRuntimePromise) {
            data._aiVisionRuntimePromise = (async () => {
                await loadAppScripts(['ai-models']);
                await window.ai?.loadVisionWhitelist?.();
                data._aiVisionRuntimeReady = true;
                return window.ai;
            })().catch((e) => {
                data._aiVisionRuntimePromise = null;
                data._aiVisionRuntimeReady = false;
                throw e;
            });
        }
        await data._aiVisionRuntimePromise;
    }
    return client;
};

data.loadDebugTools = async function () {
    if (window.debugTools) return window.debugTools;
    if (typeof window.loadAppScript !== 'function') {
        window.toast?.show?.('调试工具加载器尚未就绪，请稍后重试。', 'error');
        return null;
    }
    try {
        await window.loadAppScript('debug-tools');
        return window.debugTools || null;
    } catch (e) {
        window.errorBus?.report?.('debug.tools', e);
        window.toast?.show?.('调试工具加载失败，请稍后重试。', 'error');
        return null;
    }
};

data.toggleDebugTools = async function () {
    const tools = await data.loadDebugTools?.();
    return tools?.toggle?.(data);
};

data.showAdviceDebugOverlay = async function () {
    const tools = await data.loadDebugTools?.();
    return tools?.showOverlay?.(data);
};

data.initDebugTools = function () {
    try {
        data._debugToolsEnabled = localStorage.getItem('rehab_debug_tools') === '1';
    } catch {
        data._debugToolsEnabled = false;
    }
    if (!data._debugToolsEnabled) return Promise.resolve(false);
    return data.loadDebugTools?.()
        .then((tools) => tools?.enable?.(data, { silent: true }))
        .catch((e) => window.errorBus?.report?.('debug.tools.init', e));
};

data.refreshModules = function () {
    mergeDataModules();

    attachPlanAliases();
    attachLazyRecordOpeners();
    attachPlanFeatureGate();
    attachStableUpdateCheck();
    window.advicePanel?.attach?.(data);
    window['planAiDebug']?.install?.();
};

if (typeof window !== 'undefined') window.data = data;
