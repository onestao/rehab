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

Object.assign(
    data,
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
);

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

async function loadAppScripts(names = []) {
    if (typeof window.loadAppScript !== 'function') {
        throw new Error('模块加载器尚未就绪，请稍后重试');
    }
    const unique = [...new Set(names)].filter(Boolean);
    await Promise.all(unique.map(name => window.loadAppScript(name)));
    data.refreshModules?.();
}

function attachPlanAliases() {
    data.openPlanWeeklySheet = data.openPlanWeeklySheet || function (...args) {
        return window['planWeekly']?.open?.(...args);
    };
    data.openPlanAiSheet = data.openPlanAiSheet || async function (...args) {
        if (typeof window.loadAppScript === 'function' && !window.dataPlanAi?.openPlanAiSheet) {
            await window.loadAppScript('plan-ai');
        }
        data.refreshModules?.();
        const open = window.dataPlanAi?.openPlanAiSheet;
        if (typeof open === 'function') return open.apply(data, args);
        window.toast?.show?.('AI 计划模块尚未加载完成，请稍后重试。', 'error');
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
            }
        };
    });
}

attachPlanAliases();
attachLazyRecordOpeners();

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
    Object.assign(data,
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
    );
    attachPlanAliases();
    attachLazyRecordOpeners();
    window.advicePanel?.attach?.(data);
    window['planAiDebug']?.install?.();
};

if (typeof window !== 'undefined') window.data = data;
