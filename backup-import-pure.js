// @ts-nocheck
function backupCounts(dbObj = {}) {
    const health = dbObj.health || {};
    return {
        actions: dbObj.actions?.length || 0,
        routines: dbObj.routines?.length || 0,
        history: dbObj.history?.length || 0,
        dailyPlans: dbObj.dailyPlans?.length || 0,
        food: health.foodLogs?.length || 0,
        exercise: health.exerciseLogs?.length || 0,
        weight: health.weights?.length || 0,
        rehabWeekly: health.rehabWeekly?.length || 0,
        prescriptionActions: health.prescriptionActions?.length || 0,
        advice: health.aiAdviceChat?.length || 0
    };
}

function itemCountsFromMeta(meta = {}, nextDb = {}) {
    return meta.itemCounts && typeof meta.itemCounts === 'object'
        ? meta.itemCounts
        : backupCounts(nextDb);
}

function buildBackupImportPlan(options = {}) {
    const meta = options.meta || {};
    const nextDb = options.nextDb || {};
    const localDb = options.localDb || {};
    const localSchemaVersion = Number(options.localSchemaVersion || 1);
    const schemaVersion = Number(meta.schemaVersion || nextDb.schemaVersion || 0);
    const remoteCounts = itemCountsFromMeta(meta, nextDb);
    const localCounts = backupCounts(localDb);
    const countRisks = Object.entries(remoteCounts).flatMap(([key, value]) => {
        const local = Number(localCounts[key] || 0);
        const remote = Number(value || 0);
        if (local > 0 && remote < local * 0.5) {
            return [{
                key,
                local,
                remote,
                message: `远端 ${key} 数量(${remote})远小于本地(${local})，导入后将丢失大量数据，是否继续？`
            }];
        }
        return [];
    });
    const schemaRisk = schemaVersion > localSchemaVersion
        ? {
            remote: schemaVersion,
            local: localSchemaVersion,
            message: `备份文件 schemaVersion(${schemaVersion}) 高于本地(${localSchemaVersion})，导入可能导致兼容问题，是否继续？`
        }
        : null;

    return {
        fileName: String(options.fileName || ''),
        checksumStatus: options.checksumStatus || 'missing',
        schemaRisk,
        countRisks,
        remoteCounts,
        localCounts,
        needsInitialConfirm: true,
        needsFinalConfirm: true,
        needsSchemaConfirm: !!schemaRisk,
        needsCountConfirm: countRisks.length > 0
    };
}

const backupImportPure = {
    backupCounts,
    buildBackupImportPlan
};

if (typeof window !== 'undefined') {
    window.backupImportPure = window.backupImportPure || backupImportPure;
}

export {
    backupCounts,
    buildBackupImportPlan,
    backupImportPure
};

export default backupImportPure;
