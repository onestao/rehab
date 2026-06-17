/* global FlexSearch */
importScripts('./lib/flexsearch.light.js');

const FlexSearchRuntime = /** @type {any} */ (self).FlexSearch || /** @type {any} */ (globalThis).FlexSearch;

const DB_NAME = 'rehab_pro_storage';
const AI_MESSAGES_STORE_NAME = 'ai_messages';
const DB_VERSION = 4;
const BATCH_SIZE = 100;

let stage1Cache = new Map();
let stage1Meta = new Map();
let index = null;
let indexingStarted = false;
let isIndexingComplete = false;
let searchVersion = 0;

self.onmessage = async event => {
    const msg = event.data || {};
    const { type, payload = {} } = msg;
    try {
        if (type === 'INIT') await handleInit(payload);
        else if (type === 'SEARCH') handleSearch(payload);
        else if (type === 'ADD' || type === 'UPDATE') handleUpsert(payload.record || payload);
        else if (type === 'REMOVE') handleRemove(payload.id);
    } catch (err) {
        self.postMessage({ type: 'ERROR', payload: { type, message: err?.message || String(err) } });
    }
};

function createIndex() {
    if (index) return index;
    index = new FlexSearchRuntime.Index({ tokenize: 'forward', resolution: 9, minlength: 2 });
    return index;
}

function textForRecord(record) {
    if (!record || record.deleted) return '';
    if (record.role === 'assistant' && record.versionActive === false) return '';
    return [
        record.content,
        record.model,
        record.provider,
        record.role,
        record.id,
        record.at,
        record.date
    ].map(value => String(value || '')).join(' ').trim();
}

function timestampForRecord(record) {
    const updatedAt = Number(record?.updatedAt || 0);
    if (Number.isFinite(updatedAt) && updatedAt > 0) return updatedAt;
    const at = new Date(record?.at || record?.date || 0).getTime();
    return Number.isFinite(at) ? at : 0;
}

function stageRecord(record) {
    const id = String(record?.id || '').trim();
    const text = textForRecord(record);
    if (!id || !text) return;
    stage1Cache.set(id, text.toLowerCase());
    stage1Meta.set(id, timestampForRecord(record));
}

async function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result);
    });
}

function readAllMessages() {
    return openDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(AI_MESSAGES_STORE_NAME, 'readonly');
        const store = tx.objectStore(AI_MESSAGES_STORE_NAME);
        const req = store.getAll();
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result || []);
    }));
}

async function handleInit(payload = {}) {
    if (indexingStarted) return;
    indexingStarted = true;
    createIndex();
    self.postMessage({ type: 'STATUS', payload: { state: 'STAGE1_START' } });

    const snapshot = Array.isArray(payload.snapshot) ? payload.snapshot : [];
    snapshot.forEach(stageRecord);
    self.postMessage({ type: 'STATUS', payload: { state: 'STAGE1_DONE', size: stage1Cache.size } });

    let records = snapshot;
    try {
        const idbRecords = await readAllMessages();
        if (idbRecords.length) {
            records = idbRecords;
            stage1Cache = new Map();
            stage1Meta = new Map();
            records.forEach(stageRecord);
            self.postMessage({ type: 'STATUS', payload: { state: 'IDB_STAGE1_DONE', size: stage1Cache.size } });
        }
    } catch (err) {
        self.postMessage({ type: 'STATUS', payload: { state: 'IDB_SKIPPED', message: err?.message || String(err) } });
    }

    buildIndexProgressively(records);
}

function buildIndexProgressively(records = []) {
    let cursor = 0;
    const clean = (records || []).filter(record => record && !record.deleted && record.id);

    function processBatch() {
        const end = Math.min(cursor + BATCH_SIZE, clean.length);
        for (; cursor < end; cursor++) {
            const record = clean[cursor];
            const text = textForRecord(record);
            if (text) index.add(String(record.id), text);
        }
        if (cursor < clean.length) {
            setTimeout(processBatch, 10);
            return;
        }
        isIndexingComplete = true;
        searchVersion += 1;
        self.postMessage({ type: 'STATUS', payload: { state: 'STAGE2_DONE', size: clean.length, version: searchVersion } });
    }

    processBatch();
}

function handleSearch(payload = {}) {
    const requestId = payload.requestId;
    const query = String(payload.query || '').trim();
    const term = query.toLowerCase();
    const limit = Math.max(1, Number(payload.limit || 20));
    let results = [];

    if (query && isIndexingComplete && index) {
        results = index.search(query, limit * 2);
    }
    if (!results.length && term) {
        results = [];
        for (const [id, text] of stage1Cache.entries()) {
            if (!text.includes(term)) continue;
            results.push(id);
        }
    }

    results = Array.from(new Set(results))
        .sort((a, b) => (stage1Meta.get(b) || 0) - (stage1Meta.get(a) || 0))
        .slice(0, limit);

    self.postMessage({
        type: 'SEARCH_RESULT',
        payload: { requestId, query, results, version: searchVersion, complete: isIndexingComplete }
    });
}

function handleUpsert(record) {
    const id = String(record?.id || '').trim();
    if (!id) return;
    handleRemove(id);
    if (record.deleted) return;
    stageRecord(record);
    const text = textForRecord(record);
    if (index && text) index.add(id, text);
    searchVersion += 1;
}

function handleRemove(id) {
    const key = String(id || '').trim();
    if (!key) return;
    stage1Cache.delete(key);
    stage1Meta.delete(key);
    try { index?.remove?.(key); } catch {}
    searchVersion += 1;
}
