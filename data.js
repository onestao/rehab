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
        health: { weights: [], foodLogs: [], exerciseLogs: [], reports: [], goalType: 'loss', bodyPlan: null, weightPlan: null, dietGoal: null, aiAdviceChat: [], weeklyGoalSessions: 5 },
        aiProfiles: [],
        aiActiveId: '',
        aiModels: [],
        aiTemplates: [],
        aiTemplateActiveId: '',
        aiTrash: [],
        aiRetryMode: 'versioned',
        prefs: { haptics: true },
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
    weightRecordRange: 'month',
    weightRecordAnchorKey: '',
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
    window['dataPlanWeekly'] || {},
    window['dataPlanAi'] || {},
    window['dataPlanEquipment'] || {},
    window['dataPlanUi'] || {}
);

function attachPlanAliases() {
    data.openPlanWeeklySheet = data.openPlanWeeklySheet || function (...args) {
        return window['planWeekly']?.open?.(...args);
    };
    data.renderPlanEquipmentPanel = data.renderPlanEquipmentPanel || data.renderPlanEquipmentCard;
}

attachPlanAliases();

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
        window['dataPlanWeekly'] || {},
        window['dataPlanAi'] || {},
        window['dataPlanEquipment'] || {},
        window['dataPlanUi'] || {}
    );
    attachPlanAliases();
    window.advicePanel?.attach?.(data);
};

if (typeof window !== 'undefined') window.data = data;
