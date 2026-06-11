// @ts-nocheck
(function () {
    const DB_NAME = 'rehab_pro_storage';
    const STORE_NAME = 'kv';
    const HISTORY_STORE_NAME = 'history';
    const AI_MESSAGES_STORE_NAME = 'ai_messages';
    const DB_VERSION = 4;

    const migrations = {
        1: async function (db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        },
        2: async function () {},
        3: async function (db) {
            if (!db.objectStoreNames.contains(HISTORY_STORE_NAME)) {
                var store = db.createObjectStore(HISTORY_STORE_NAME, { keyPath: 'id' });
                store.createIndex('byUpdatedAt', 'updatedAt', { unique: false });
                store.createIndex('byDateKey', 'dayKey', { unique: false });
            }
        },
        4: async function (db) {
            if (!db.objectStoreNames.contains(AI_MESSAGES_STORE_NAME)) {
                var store = db.createObjectStore(AI_MESSAGES_STORE_NAME, { keyPath: 'id' });
                store.createIndex('byUpdatedAt', 'updatedAt', { unique: false });
                store.createIndex('byRole', 'role', { unique: false });
            }
        }
    };

    function requestToPromise(request) {
        return new Promise(function (resolve, reject) {
            request.onsuccess = function () { resolve(request.result); };
            request.onerror = function () { reject(request.error || new Error('IDB request failed')); };
        });
    }

    function txDone(tx) {
        return new Promise(function (resolve, reject) {
            tx.oncomplete = function () { resolve(); };
            tx.onerror = function () { reject(tx.error || new Error('IDB transaction failed')); };
            tx.onabort = function () { reject(tx.error || new Error('IDB transaction aborted')); };
        });
    }

    const storageIdb = {
        DB_NAME: DB_NAME,
        STORE_NAME: STORE_NAME,
        HISTORY_STORE_NAME: HISTORY_STORE_NAME,
        AI_MESSAGES_STORE_NAME: AI_MESSAGES_STORE_NAME,
        DB_VERSION: DB_VERSION,
        migrations: migrations,
        _openPromise: null,

        open() {
            if (this._openPromise) return this._openPromise;
            this._openPromise = new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = (event) => {
                    const db = request.result;
                    const tx = request.transaction;
                    const fromVersion = event.oldVersion || 0;
                    for (let version = fromVersion + 1; version <= DB_VERSION; version++) {
                        const migrate = migrations[version];
                        if (typeof migrate !== 'function') throw new Error('Missing migration step: ' + version);
                        migrate(db, tx);
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error || new Error('Open IndexedDB failed'));
            });
            return this._openPromise;
        },

        async get(key) {
            const db = await this.open();
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const value = await requestToPromise(store.get(key));
            await txDone(tx);
            return value == null ? null : value;
        },

        async set(key, value) {
            const db = await this.open();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(value, key);
            await txDone(tx);
        },

        async remove(key) {
            const db = await this.open();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(key);
            await txDone(tx);
        },

        async clear() {
            const db = await this.open();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).clear();
            await txDone(tx);
        },

        async destroy() {
            this._openPromise = null;
            await new Promise(function (resolve, reject) {
                const request = indexedDB.deleteDatabase(DB_NAME);
                request.onsuccess = function () { resolve(); };
                request.onerror = function () { reject(request.error || new Error('Delete IndexedDB failed')); };
                request.onblocked = function () { resolve(); };
            });
        }
    };

    if (typeof window !== 'undefined') window.storageIdb = storageIdb;
})();
