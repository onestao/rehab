const DEFAULT_CRITICAL_SOURCES = ['pre-pull', 'pre-import'];
const DEFAULT_MAX_COUNT = 10;
const DEFAULT_QUOTA_LOW_COUNT = 3;
const DEFAULT_MIN_KEEP = 3;
const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;

function snapshotTime(item = {}) {
    return Number(item.createdAt || 0);
}

function snapshotId(item = {}) {
    return item?.id;
}

function sortSnapshotsNewestFirst(items = []) {
    return [...(Array.isArray(items) ? items : [])].sort((a, b) => snapshotTime(b) - snapshotTime(a));
}

function sortSnapshotsOldestFirst(items = []) {
    return [...(Array.isArray(items) ? items : [])].sort((a, b) => snapshotTime(a) - snapshotTime(b));
}

function newestBySource(items = [], sources = DEFAULT_CRITICAL_SOURCES) {
    const sourceSet = new Set(sources);
    const seenSources = new Set();
    const protectedIds = new Set();
    for (const item of sortSnapshotsNewestFirst(items)) {
        const source = String(item?.source || '');
        if (!sourceSet.has(source) || seenSources.has(source)) continue;
        seenSources.add(source);
        protectedIds.add(snapshotId(item));
    }
    return protectedIds;
}

function planBackupRingPrune(items = [], options = {}) {
    const snapshots = sortSnapshotsNewestFirst(items).filter((item) => snapshotId(item) != null);
    const criticalSources = options.criticalSources || DEFAULT_CRITICAL_SOURCES;
    const targetCount = options.quotaLow
        ? Number(options.quotaLowCount || DEFAULT_QUOTA_LOW_COUNT)
        : Number(options.maxCount || DEFAULT_MAX_COUNT);
    const minKeep = Math.max(1, Number(options.minKeep || DEFAULT_MIN_KEEP));
    const maxBytes = Number(options.maxBytes || DEFAULT_MAX_BYTES);
    const protectedIds = newestBySource(snapshots, criticalSources);

    if (snapshots[0]) protectedIds.add(snapshotId(snapshots[0]));

    const keepIds = new Set(protectedIds);
    for (const item of snapshots) {
        if (keepIds.size >= Math.max(targetCount, protectedIds.size, minKeep)) break;
        keepIds.add(snapshotId(item));
    }

    if (Number.isFinite(maxBytes) && maxBytes > 0) {
        let totalBytes = snapshots
            .filter((item) => keepIds.has(snapshotId(item)))
            .reduce((sum, item) => sum + Number(item?.size || 0), 0);
        for (const item of sortSnapshotsOldestFirst(snapshots)) {
            const id = snapshotId(item);
            if (!keepIds.has(id) || protectedIds.has(id) || keepIds.size <= minKeep) continue;
            if (totalBytes <= maxBytes) break;
            keepIds.delete(id);
            totalBytes -= Number(item?.size || 0);
        }
    }

    const keepItems = snapshots.filter((item) => keepIds.has(snapshotId(item)));
    const deleteItems = snapshots.filter((item) => !keepIds.has(snapshotId(item)));
    return {
        keepItems,
        deleteItems,
        deleteIds: deleteItems.map(snapshotId),
        protectedIds: [...protectedIds]
    };
}

const backupRingPure = {
    sortSnapshotsNewestFirst,
    sortSnapshotsOldestFirst,
    planBackupRingPrune
};

if (typeof window !== 'undefined') {
    window.backupRingPure = window.backupRingPure || backupRingPure;
}

export {
    sortSnapshotsNewestFirst,
    sortSnapshotsOldestFirst,
    planBackupRingPrune,
    backupRingPure
};

export default backupRingPure;
