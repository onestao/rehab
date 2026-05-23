// @ts-nocheck
(function () {
    const DB_NAME = 'rehab_voice_cache';
    const STORE = 'blobs';
    const VERSION = 1;
    const TTL_MS = 30 * 24 * 60 * 60 * 1000;

    let dbPromise = null;

    function openDb() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) {
                reject(new Error('IndexedDB unavailable'));
                return;
            }
            const req = indexedDB.open(DB_NAME, VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error || new Error('voice cache open failed'));
        });
        return dbPromise;
    }

    function txStore(db, mode) {
        return db.transaction(STORE, mode).objectStore(STORE);
    }

    function requestToPromise(req) {
        return new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error || new Error('voice cache request failed'));
        });
    }

    async function get(key) {
        const db = await openDb();
        const record = await requestToPromise(txStore(db, 'readonly').get(key));
        if (!record) return null;
        if (Date.now() - Number(record.createdAt || 0) > TTL_MS) {
            await remove(key);
            return null;
        }
        return record.blob || null;
    }

    async function put(key, blob) {
        if (!key || !blob) return;
        const db = await openDb();
        await requestToPromise(txStore(db, 'readwrite').put({ key, blob, createdAt: Date.now() }));
    }

    async function remove(key) {
        const db = await openDb();
        await requestToPromise(txStore(db, 'readwrite').delete(key));
    }

    async function clear() {
        const db = await openDb();
        await requestToPromise(txStore(db, 'readwrite').clear());
    }

    function keyFor(engine, text, opts = {}) {
        return [
            String(engine?.id || engine?.name || 'legado'),
            String(text || ''),
            String(opts.rate ?? ''),
            String(opts.pitch ?? '')
        ].join('|');
    }

    window.voiceCache = { get, put, remove, clear, keyFor, TTL_MS };
})();
