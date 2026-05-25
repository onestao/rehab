// @ts-nocheck
(function () {
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

    var STORE_NAME = 'history';

    var storageCollections = {
        putMany: function (records) {
            if (!Array.isArray(records) || !records.length) return Promise.resolve();
            return window.storageIdb.open().then(function (db) {
                var tx = db.transaction(STORE_NAME, 'readwrite');
                var store = tx.objectStore(STORE_NAME);
                for (var i = 0; i < records.length; i++) {
                    store.put(records[i]);
                }
                return txDone(tx);
            });
        },

        getAll: function () {
            return window.storageIdb.open().then(function (db) {
                var tx = db.transaction(STORE_NAME, 'readonly');
                var store = tx.objectStore(STORE_NAME);
                return requestToPromise(store.getAll()).then(function (results) {
                    return txDone(tx).then(function () { return results || []; });
                });
            });
        },

        getSince: function (ts) {
            return window.storageIdb.open().then(function (db) {
                var tx = db.transaction(STORE_NAME, 'readonly');
                var store = tx.objectStore(STORE_NAME);
                var index = store.index('byUpdatedAt');
                var range = IDBKeyRange.lowerBound(ts, true);
                return requestToPromise(index.getAll(range)).then(function (results) {
                    return txDone(tx).then(function () { return results || []; });
                });
            });
        },

        getPage: function (offset, limit) {
            return window.storageIdb.open().then(function (db) {
                return new Promise(function (resolve, reject) {
                    var tx = db.transaction(STORE_NAME, 'readonly');
                    var store = tx.objectStore(STORE_NAME);
                    var index = store.index('byUpdatedAt');
                    var results = [];
                    var skipped = 0;
                    var collected = 0;
                    var finished = false;
                    var request = index.openCursor(null, 'prev');
                    request.onsuccess = function () {
                        var cursor = request.result;
                        if (!cursor || collected >= limit) {
                            if (!finished) {
                                finished = true;
                                txDone(tx).then(function () { resolve(results); }, function () { resolve(results); });
                            }
                            return;
                        }
                        if (skipped < offset) { skipped++; cursor.continue(); return; }
                        results.push(cursor.value);
                        collected++;
                        cursor.continue();
                    };
                    request.onerror = function () { reject(request.error || new Error('IDB cursor failed')); };
                });
            });
        },

        append: function (record) {
            if (!record || !record.id) return Promise.resolve();
            return window.storageIdb.open().then(function (db) {
                var tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).put(record);
                return txDone(tx);
            });
        },

        update: function (record) {
            if (!record || !record.id) return Promise.resolve();
            return window.storageIdb.open().then(function (db) {
                var tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).put(record);
                return txDone(tx);
            });
        },

        deleteByIds: function (ids) {
            if (!Array.isArray(ids) || !ids.length) return Promise.resolve();
            return window.storageIdb.open().then(function (db) {
                var tx = db.transaction(STORE_NAME, 'readwrite');
                var store = tx.objectStore(STORE_NAME);
                for (var i = 0; i < ids.length; i++) {
                    store.delete(ids[i]);
                }
                return txDone(tx);
            });
        },

        clear: function () {
            return window.storageIdb.open().then(function (db) {
                var tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).clear();
                return txDone(tx);
            });
        },

        count: function () {
            return window.storageIdb.open().then(function (db) {
                var tx = db.transaction(STORE_NAME, 'readonly');
                return requestToPromise(tx.objectStore(STORE_NAME).count()).then(function (count) {
                    return txDone(tx).then(function () { return count || 0; });
                });
            });
        }
    };

    if (typeof window !== 'undefined') window.storageCollections = storageCollections;
})();
