export function buildHistoryStoreConfig() {
    return {
        storeName: 'history',
        keyPath: 'id',
        indexes: [
            { name: 'byUpdatedAt', keyPath: 'updatedAt', unique: false },
            { name: 'byDateKey', keyPath: 'dayKey', unique: false }
        ]
    };
}

export function prepareHistoryForStore(record) {
    if (!record || typeof record !== 'object') return null;
    if (!record.id) return null;
    return {
        ...record,
        updatedAt: Number(record.updatedAt) || Date.now(),
        deleted: !!record.deleted,
        dayKey: record.dayKey || record.date || ''
    };
}

export function migrateHistoryArrayToStoreRecords(array) {
    if (!Array.isArray(array)) return [];
    const result = [];
    for (let i = 0; i < array.length; i++) {
        const prepared = prepareHistoryForStore(array[i]);
        if (prepared) result.push(prepared);
    }
    return result;
}

export function computeHistoryListHash(records) {
    if (!Array.isArray(records) || records.length === 0) return '0:0';
    const first = records[0];
    const last = records[records.length - 1];
    return records.length + ':' + Number(first?.updatedAt || 0) + ':' + Number(last?.updatedAt || 0);
}
