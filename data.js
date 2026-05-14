const data = {
    DB_KEY: 'rehab_pro_universal_db',
    CFG_KEY: 'rehab_pro_universal_cfg',
    SCHEMA_VERSION: 2,
    db: { actions: [], routines: [], history: [], rate: 1.1, cardio: { weight: 70, target: 30, type: 'walk' }, health: { weights: [], foodLogs: [], exerciseLogs: [], goalType: 'loss', bodyPlan: null, weightPlan: null, dietGoal: null, aiAdviceChat: [] }, aiProfiles: [], aiActiveId: '', aiModels: [] },
    cfg: { mode: 'none', s3: {}, dav: {} },
    historyMonthOffset: 0,
    routineView: 'library',
    recordView: 'today',
    healthView: 'diet',
    weightRange: 'month',
    selectedCalendarDate: null,
    adviceModel: '__current__',
    historyColors: ['#2563eb', '#7c3aed', '#059669', '#f59e0b', '#e11d48', '#0891b2', '#9333ea', '#ea580c']
};

Object.assign(
    data,
    window.dataUtils || {},
    window.dataStore || {},
    window.dataUiState || {},
    window.dataHealthDiet || {},
    window.dataHealthWeight || {},
    window.dataHealthExercise || {},
    window.dataHealthProfile || {},
    window.dataGoalPlan || {},
    window.dataRoutineLibrary || {},
    window.dataHistoryView || {},
    window.dataWeeklySummary || {},
    window.dataViews || {}
);

data.refreshModules = function () {
    Object.assign(data,
        window.dataUtils || {},
        window.dataStore || {},
        window.dataUiState || {},
        window.dataHealthDiet || {},
        window.dataHealthWeight || {},
        window.dataHealthExercise || {},
        window.dataHealthProfile || {},
        window.dataGoalPlan || {},
        window.dataRoutineLibrary || {},
        window.dataHistoryView || {},
        window.dataWeeklySummary || {},
        window.dataViews || {}
    );
};

if (typeof window !== 'undefined') window.data = data;
