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

    var STORE_NAME = 'ai_messages';

    var adviceCollections = {
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

        getAllIds: function () {
            return window.storageIdb.open().then(function (db) {
                return new Promise(function (resolve, reject) {
                    var tx = db.transaction(STORE_NAME, 'readonly');
                    var store = tx.objectStore(STORE_NAME);
                    // Open cursor on 'byUpdatedAt' to maintain chronological order
                    var request = store.index('byUpdatedAt').openCursor(null, 'next');
                    var ids = [];
                    request.onsuccess = function () {
                        var cursor = request.result;
                        if (!cursor) {
                            txDone(tx).then(function () { resolve(ids); }, function () { resolve(ids); });
                            return;
                        }
                        if (cursor.value && !cursor.value.deleted && !(cursor.value.role === 'assistant' && cursor.value.versionActive === false)) {
                            ids.push(cursor.value.id);
                        }
                        cursor.continue();
                    };
                    request.onerror = function () { reject(request.error || new Error('IDB cursor failed')); };
                });
            });
        },

        getByIds: function (ids) {
            if (!Array.isArray(ids) || !ids.length) return Promise.resolve([]);
            return window.storageIdb.open().then(function (db) {
                var tx = db.transaction(STORE_NAME, 'readonly');
                var store = tx.objectStore(STORE_NAME);
                var promises = ids.map(function (id) { return requestToPromise(store.get(id)); });
                return Promise.all(promises).then(function (results) {
                    return txDone(tx).then(function () { return results; });
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

        getById: function (id) {
            if (!id) return Promise.resolve(null);
            return window.storageIdb.open().then(function (db) {
                var tx = db.transaction(STORE_NAME, 'readonly');
                var store = tx.objectStore(STORE_NAME);
                return requestToPromise(store.get(id)).then(function (result) {
                    return txDone(tx).then(function () { return result || null; });
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
        },

        search: function (keyword, limit) {
            limit = limit || 100;
            if (!keyword) return Promise.resolve([]);
            var term = keyword.toLowerCase();
            return window.storageIdb.open().then(function (db) {
                return new Promise(function (resolve, reject) {
                    var tx = db.transaction(STORE_NAME, 'readonly');
                    var store = tx.objectStore(STORE_NAME);
                    var index = store.index('byUpdatedAt'); // Sort by newest first
                    var results = [];
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
                        var record = cursor.value;
                        if (record && !record.deleted) {
                            var contentMatch = record.content && record.content.toLowerCase().indexOf(term) > -1;
                            var modelMatch = record.model && record.model.toLowerCase().indexOf(term) > -1;
                            var roleMatch = record.role && record.role.toLowerCase().indexOf(term) > -1;
                            if (contentMatch || modelMatch || roleMatch) {
                                results.push(record);
                                collected++;
                            }
                        }
                        cursor.continue();
                    };
                    request.onerror = function () { reject(request.error || new Error('IDB search cursor failed')); };
                });
            });
        }
    };

    if (typeof window !== 'undefined') window.adviceCollections = adviceCollections;
})();
