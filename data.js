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

attachPlanAliases();

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
    window.advicePanel?.attach?.(data);
    window['planAiDebug']?.install?.();
};

if (typeof window !== 'undefined') window.data = data;
