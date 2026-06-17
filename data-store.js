// @ts-nocheck
(function () {
    window.dataStore = {
        STORAGE_VERSION_KEY: 'storageVersion',
        STORAGE_TARGET_VERSION: 4,
        MIGRATION_FAILED_KEY: 'migration.failed',
        FLUSH_DEBOUNCE_MS: 300,
        _storage: null,
        _storageMode: 'localStorage',
        _flushHooksBound: false,
        _persistTimer: null,
        _pendingPersistPromise: null,
        _resolvePersist: null,
        _rejectPersist: null,
        _dbDirty: false,
        _quotaWarned: false,

        /** Try localStorage.setItem; on QuotaExceededError run eviction once and retry.
         *  Returns true on success, false on permanent failure. */
        safeLocalStorageSet(key, serialized) {
            try {
                localStorage.setItem(key, serialized);
                return true;
            } catch (e) {
                const isQuota = e && (e.name === 'QuotaExceededError' || e.code === 22 || /quota/i.test(e.message || ''));
                if (!isQuota) throw e;
                // Evict oldest AI chat messages to free space, then retry once.
                this._evictAiChatForQuota();
                try {
                    localStorage.setItem(key, serialized);
                    return true;
                } catch (_) {
                    window.errorBus?.report?.('storage', e, { op: 'setItem', key });
                    return false;
                }
            }
        },

        /** Trim aiAdviceChat to the last 100 messages and show a one-time toast. */
        _evictAiChatForQuota() {
            try {
                const chat = this.db?.health?.aiAdviceChat;
                if (Array.isArray(chat) && chat.length > 100) {
                    this.db.health.aiAdviceChat = chat.slice(-100);
                }
                if (!this._quotaWarned) {
                    this._quotaWarned = true;
                    if (window.toast && typeof toast.show === 'function') {
                        toast.show('存储空间已满，已自动清理部分 AI 对话记录', 'warn');
                    }
                }
            } catch (_) {}
        },

        createLocalStorageAdapter() {
            const store = this;
            return {
                mode: 'localStorage',
                read(key) {
                    const raw = localStorage.getItem(key);
                    if (!raw) return null;
                    return JSON.parse(raw);
                },
                write(key, value) {
                    store.safeLocalStorageSet(key, JSON.stringify(value));
                },
                flushSync(key, value) {
                    store.safeLocalStorageSet(key, JSON.stringify(value));
                },
                remove(key) {
                    localStorage.removeItem(key);
                }
            };
        },

        resolveStorageAdapter() {
            if (this._storage) return this._storage;
            this._storage = this.createLocalStorageAdapter();
            return this._storage;
        },

        async init() {
            const started = Date.now();
            window.errorBus?.event?.('storage', 'init:start');
            if (window.storageMigrate && typeof window.storageMigrate.createAdapter === 'function') {
                const migrationResult = await window.storageMigrate.createAdapter({
                    dbKey: this.DB_KEY,
                    cfgKey: this.CFG_KEY,
                    storageVersionKey: this.STORAGE_VERSION_KEY,
                    migrationFailedKey: this.MIGRATION_FAILED_KEY,
                    targetVersion: this.STORAGE_TARGET_VERSION
                });
                this._storage = migrationResult.adapter;
                this._storageMode = migrationResult.mode;
                window.errorBus?.event?.('storage', 'adapter:resolved', {
                    mode: migrationResult.mode,
                    migrationOk: !!migrationResult.migration?.ok,
                    migrationReason: migrationResult.migration?.reason || ''
                });
                if (migrationResult.migration && !migrationResult.migration.ok && migrationResult.migration.reason) {
                    if (window.toast) toast.show(`迁移失败，继续使用本地存储：${migrationResult.migration.reason}`, 'error');
                }
            } else {
                this._storage = this.createLocalStorageAdapter();
                this._storageMode = this._storage.mode;
            }

            const storage = this.resolveStorageAdapter();
            const localDb = await Promise.resolve(storage.read(this.DB_KEY));
            const localCfg = await Promise.resolve(storage.read(this.CFG_KEY));
            if (localDb) this.db = localDb;
            else await this.migrateLegacy();
            if (window.storageMigrate?.migrateAdviceToVersioned) {
                this.db = window.storageMigrate.migrateAdviceToVersioned(this.db);
            }
            if (localCfg) this.cfg = localCfg;
            this.normalizeDb();
            this._initHistoryApi();
            this._initAdviceApi();
            try {
                const recentAdvice = await this.advice.getRecent(50);
                if (recentAdvice && recentAdvice.length > 0) {
                    const localAdvice = Array.isArray(this.db.health.aiAdviceChat) ? this.db.health.aiAdviceChat : [];
                    const recentChronological = recentAdvice.slice().reverse();
                    this.db.health.aiAdviceChat = this.advice._mergeChronological(localAdvice, recentChronological);
                    this.advice.workingSet = this.db.health.aiAdviceChat;
                }
                this.advice.setActiveRecords(this.activeRecords(this.db.health.aiAdviceChat || []), 'recent');
                this.advice.initSearchWorker?.();
            } catch (e) { console.error('Load recent advice failed', e); }
            this.bindFlushHooks();
            if (window.sync && typeof sync.initUI === 'function') sync.initUI();
            if (typeof ai !== 'undefined') await ai.init({ saveData: true, renderData: false });
            this.render();
            this.restoreActionDraft();
            if (window.cardio) cardio.initUI();
            window.errorBus?.event?.('storage', 'init:success', {
                mode: this._storageMode,
                elapsedMs: Date.now() - started,
                hasDb: !!localDb,
                hasCfg: !!localCfg,
                schemaVersion: Number(this.db?.schemaVersion || 0),
                counts: this.storageDebugCounts?.()
            });

            setTimeout(() => {
                if (window.sync) {
                    sync.processRetryQueue?.().catch(() => {});
                }
            }, 3000);
        },

        restoreActionDraft() {
            const draft = this.db.lastActionDraft;
            if (!draft) return;
            const fields = { sets: 'sets', reps: 'reps', work: 'work', repRest: 'repRest', actionRest: 'actionRest', groupRest: 'groupRest' };
            Object.entries(fields).forEach(([key, id]) => {
                const el = document.getElementById(id);
                if (el && draft[key] != null) el.value = draft[key];
            });
        },

        storageDebugCounts() {
            const health = this.db?.health || {};
            return {
                actions: this.db?.actions?.length || 0,
                routines: this.db?.routines?.length || 0,
                history: this.db?.history?.length || 0,
                dailyPlans: this.db?.dailyPlans?.length || 0,
                food: health.foodLogs?.length || 0,
                exercise: health.exerciseLogs?.length || 0,
                weight: health.weights?.length || 0,
                advice: health.aiAdviceChat?.length || 0
            };
        },

        _initHistoryApi() {
            const self = this;
            this.history = {
                append(record) {
                    if (!record || typeof record !== 'object') return;
                    if (!record.id) record.id = self.generateRecordId('history');
                    if (!record.updatedAt) record.updatedAt = Date.now();
                    if (typeof record.deleted !== 'boolean') record.deleted = false;
                    self.db.history.unshift(record);
                    if (window.storageCollections) {
                        window.storageCollections.append(record).catch(function (e) {
                            console.warn('history.append store write failed', e);
                        });
                    }
                },
                update(record) {
                    if (!record || !record.id) return;
                    const idx = self.db.history.findIndex(function (r) { return r && r.id === record.id; });
                    if (idx >= 0) self.db.history[idx] = record;
                    if (window.storageCollections) {
                        window.storageCollections.update(record).catch(function (e) {
                            console.warn('history.update store write failed', e);
                        });
                    }
                },
                deleteById(id) {
                    const record = self.db.history.find(function (r) { return r && r.id === id; });
                    if (!record || record.deleted) return false;
                    record.deleted = true;
                    record.updatedAt = Date.now();
                    if (window.storageCollections) {
                        window.storageCollections.update(record).catch(function (e) {
                            console.warn('history.deleteById store write failed', e);
                        });
                    }
                    return true;
                },
                queryRecent(limit) {
                    limit = typeof limit === 'number' ? limit : 10;
                    if (window.storageCollections) {
                        return window.storageCollections.getPage(0, limit).catch(function () {
                            return self.activeRecords(self.db.history).slice(0, limit);
                        });
                    }
                    return Promise.resolve(self.activeRecords(self.db.history).slice(0, limit));
                },
                getAll() {
                    if (window.storageCollections) {
                        return window.storageCollections.getAll().catch(function () {
                            return self.db.history || [];
                        });
                    }
                    return Promise.resolve(self.db.history || []);
                },
                count() {
                    if (window.storageCollections) {
                        return window.storageCollections.count().catch(function () {
                            return (self.db.history || []).length;
                        });
                    }
                    return Promise.resolve((self.db.history || []).length);
                }
            };
        },

        _initAdviceApi() {
            const self = this;
            if (!self.db.health) self.db.health = {};
            if (!Array.isArray(self.db.health.aiAdviceChat)) self.db.health.aiAdviceChat = [];

            function adviceTimestamp(record) {
                const updatedAt = Number(record?.updatedAt || 0);
                if (Number.isFinite(updatedAt) && updatedAt > 0) return updatedAt;
                const at = new Date(record?.at || record?.date || 0).getTime();
                return Number.isFinite(at) ? at : 0;
            }

            function mergeChronological() {
                const byId = new Map();
                Array.from(arguments).forEach(function (records) {
                    (Array.isArray(records) ? records : []).forEach(function (record) {
                        if (!record || !record.id) return;
                        byId.set(record.id, record);
                    });
                });
                return Array.from(byId.values()).sort(function (a, b) {
                    return adviceTimestamp(a) - adviceTimestamp(b);
                });
            }

            function localSearch(records, keyword, limit) {
                const max = Math.max(1, Number(limit) || 20);
                const term = String(keyword || '').trim().toLowerCase();
                if (!term) return [];
                return self.activeRecords(records || []).filter(function (record) {
                    return [record.content, record.model, record.provider, record.role, record.id, record.at]
                        .some(function (value) { return String(value || '').toLowerCase().includes(term); });
                }).sort(function (a, b) { return adviceTimestamp(b) - adviceTimestamp(a); }).slice(0, max);
            }

            let adviceApi = null;
            const virtualStore = window.adviceVirtualList?.createStore?.({
                cacheCapacity: 6,
                segmentSize: 100,
                missThreshold: 3,
                cooldownMs: 700,
                fetchByIds: function (ids) { return adviceApi.getByIds(ids); }
            }) || null;
            const searchClient = window.adviceVirtualList?.createSearchWorkerClient?.({ workerUrl: 'advice-search.worker.js' }) || null;

            adviceApi = {
                workingSet: self.db.health.aiAdviceChat || [],
                mode: virtualStore?.mode || 'recent',
                version: virtualStore?.version || 0,
                activeIdsRef: virtualStore?.activeIdsRef || [],
                virtualStore,
                searchClient,
                _timestamp: adviceTimestamp,
                _mergeChronological: mergeChronological,
                _syncVirtualSnapshot(snapshot) {
                    if (!snapshot) return snapshot;
                    this.mode = snapshot.mode;
                    this.version = snapshot.version;
                    this.activeIdsRef = snapshot.activeIdsRef || [];
                    return snapshot;
                },
                initSearchWorker() {
                    if (!this.searchClient) return;
                    this.searchClient.init(self.activeRecords(this.workingSet || []));
                },
                setActiveIds(ids, mode, seedRecords) {
                    if (!this.virtualStore) {
                        this.mode = mode || this.mode || 'recent';
                        this.version = Number(this.version || 0) + 1;
                        this.activeIdsRef = (Array.isArray(ids) ? ids : []).slice();
                        return { mode: this.mode, version: this.version, activeIdsRef: this.activeIdsRef };
                    }
                    return this._syncVirtualSnapshot(this.virtualStore.setActiveIds(ids, mode, seedRecords));
                },
                setActiveRecords(records, mode) {
                    const clean = self.activeRecords(records || []);
                    if (!this.virtualStore) return this.setActiveIds(clean.map(function (record) { return record.id; }), mode, clean);
                    return this._syncVirtualSnapshot(this.virtualStore.setActiveRecords(clean, mode));
                },
                getItem(index, renderVersion) {
                    if (this.virtualStore) return this.virtualStore.getItem(index, renderVersion);
                    const id = this.activeIdsRef[Math.max(0, Number(index) || 0)];
                    return self.activeRecords(this.workingSet || []).find(function (record) { return record.id === id; }) || { skeleton: true, id: 'skel-' + index };
                },
                prefetchAround(rangeOrIndex, radius, reason) {
                    return this.virtualStore?.prefetchAround?.(rangeOrIndex, radius, reason) || Promise.resolve([]);
                },
                append(record) {
                    if (!record || typeof record !== 'object') return;
                    if (!record.id) record.id = self.generateRecordId('advice');
                    if (!record.updatedAt) record.updatedAt = Date.now();
                    if (typeof record.deleted !== 'boolean') record.deleted = false;
                    this.workingSet.push(record);
                    self.db.health.aiAdviceChat = this.workingSet;
                    this._syncVirtualSnapshot(this.virtualStore?.upsertRecord?.(record));
                    this.searchClient?.add?.(record);
                    if (window.adviceCollections) {
                        window.adviceCollections.append(record).catch(function (e) {
                            console.warn('advice.append store write failed', e);
                        });
                    }
                },
                update(record) {
                    if (!record || !record.id) return;
                    const idx = this.workingSet.findIndex(function (r) { return r && r.id === record.id; });
                    if (idx >= 0) this.workingSet[idx] = record;
                    else if (!record.deleted) this.workingSet.push(record);
                    self.db.health.aiAdviceChat = this.workingSet;
                    this._syncVirtualSnapshot(this.virtualStore?.upsertRecord?.(record));
                    this.searchClient?.update?.(record);
                    if (window.adviceCollections) {
                        window.adviceCollections.update(record).catch(function (e) {
                            console.warn('advice.update store write failed', e);
                        });
                    }
                },
                deleteById(id) {
                    const record = this.workingSet.find(function (r) { return r && r.id === id; });
                    if (!record || record.deleted) return false;
                    record.deleted = true;
                    record.updatedAt = Date.now();
                    this._syncVirtualSnapshot(this.virtualStore?.deleteId?.(id));
                    this.searchClient?.remove?.(id);
                    if (window.adviceCollections) {
                        window.adviceCollections.update(record).catch(function (e) {
                            console.warn('advice.deleteById store write failed', e);
                        });
                    }
                    return true;
                },
                getRecent(limit) {
                    limit = typeof limit === 'number' ? limit : 50;
                    if (window.adviceCollections) {
                        return window.adviceCollections.getPage(0, limit).catch(function () {
                            return self.activeRecords(adviceApi.workingSet).slice(-limit).reverse();
                        });
                    }
                    return Promise.resolve(self.activeRecords(this.workingSet).slice(-limit).reverse());
                },
                getPage(offset, limit) {
                    if (window.adviceCollections) return window.adviceCollections.getPage(offset, limit);
                    return Promise.resolve([]);
                },
                getAllIds() {
                    if (window.adviceCollections?.getAllIds) {
                        return window.adviceCollections.getAllIds().catch(function () {
                            return self.activeRecords(adviceApi.workingSet).sort(function (a, b) { return adviceTimestamp(a) - adviceTimestamp(b); }).map(function (record) { return record.id; });
                        });
                    }
                    return Promise.resolve(self.activeRecords(this.workingSet).sort(function (a, b) { return adviceTimestamp(a) - adviceTimestamp(b); }).map(function (record) { return record.id; }));
                },
                getByIds(ids) {
                    const requested = (Array.isArray(ids) ? ids : []).map(function (id) { return String(id || '').trim(); }).filter(Boolean);
                    if (!requested.length) return Promise.resolve([]);
                    const byId = new Map();
                    self.activeRecords(this.workingSet || []).forEach(function (record) { byId.set(record.id, record); });
                    const missing = requested.filter(function (id) { return !byId.has(id); });
                    const finish = function () { return requested.map(function (id) { return byId.get(id); }).filter(Boolean); };
                    if (!missing.length || !window.adviceCollections?.getByIds) return Promise.resolve(finish());
                    return window.adviceCollections.getByIds(missing).then(function (records) {
                        self.activeRecords(records || []).forEach(function (record) { byId.set(record.id, record); });
                        return finish();
                    }).catch(function () { return finish(); });
                },
                getById(id) {
                    return this.getByIds([id]).then(function (records) { return records[0] || null; });
                },
                getAll() {
                    if (window.adviceCollections) {
                        return window.adviceCollections.getAll().catch(function () { return adviceApi.workingSet || []; });
                    }
                    return Promise.resolve(this.workingSet || []);
                },
                count() {
                    if (window.adviceCollections) {
                        return window.adviceCollections.count().catch(function () { return (adviceApi.workingSet || []).length; });
                    }
                    return Promise.resolve((this.workingSet || []).length);
                },
                async searchIds(keyword, limit) {
                    const term = String(keyword || '').trim();
                    if (!term) return [];
                    try {
                        if (this.searchClient) {
                            const result = await this.searchClient.search(term, limit || 20);
                            if (Array.isArray(result.results)) return result.results;
                        }
                    } catch (e) {
                        console.warn('advice.searchIds worker fallback', e);
                    }
                    const records = await this.search(term, limit || 20);
                    return records.map(function (record) { return record.id; });
                },
                search(keyword, limit) {
                    if (window.adviceCollections) {
                        return window.adviceCollections.search(keyword, limit).catch(function () {
                            return localSearch(adviceApi.workingSet, keyword, limit);
                        });
                    }
                    return Promise.resolve(localSearch(this.workingSet, keyword, limit));
                },
                flush() {
                    if (!window.adviceCollections || !this.workingSet || !this.workingSet.length) return Promise.resolve();
                    return window.adviceCollections.putMany(this.workingSet).catch(function (e) {
                        console.warn('advice.flush store write failed', e);
                    });
                }
            };
            this.advice = adviceApi;
            adviceApi.setActiveRecords(adviceApi.workingSet, 'recent');
        },

        purgeBefore(ts, retentionMs = 30 * 24 * 60 * 60 * 1000) {
            const lastSyncAt = Number((window.syncStatus && (syncStatus.lastSyncAt || syncStatus.meta?.lastSuccessAt))
                ? new Date(syncStatus.lastSyncAt || syncStatus.meta.lastSuccessAt).getTime()
                : 0);
            if (!lastSyncAt) return { purged: 0, skipped: 'unsynced' };
            const cutoff = Date.now() - retentionMs;
            if (Number(ts) > cutoff) return { purged: 0, skipped: 'retention' };

            const entities = [
                this.db.actions,
                this.db.routines,
                this.db.history,
                this.db.health.weights,
                this.db.health.foodLogs,
                this.db.health.exerciseLogs,
                this.db.health.reports,
                this.db.health.rehabWeekly,
                this.db.health.aiAdviceChat
            ];
            let purged = 0;
            entities.forEach((list, idx) => {
                if (!Array.isArray(list)) return;
                const next = list.filter(item => !(item?.deleted && Number(item.updatedAt || 0) <= Number(ts)));
                purged += list.length - next.length;
                entities[idx] = next;
            });
            [
                this.db.actions,
                this.db.routines,
                this.db.history,
                this.db.health.weights,
                this.db.health.foodLogs,
                this.db.health.exerciseLogs,
                this.db.health.reports,
                this.db.health.rehabWeekly,
                this.db.health.aiAdviceChat
            ] = entities;
            if (purged > 0) this.save({ render: false });
            return { purged };
        },

        async migrateLegacy() {
            const legacy = ['rp_v31_db', 'rp_v28_db', 'rp_v21_main'];
            const storage = this.resolveStorageAdapter();
            for (let key of legacy) {
                const old = await Promise.resolve(storage.read(key));
                if (!old) continue;
                this.db = old;
                this.flushSync();
                window.errorBus?.event?.('storage', 'legacy:migrated', { key, counts: this.storageDebugCounts?.() });
                break;
            }
        },

        bindFlushHooks() {
            if (this._flushHooksBound || typeof window === 'undefined') return;
            this._flushHooksBound = true;
            window.addEventListener('pagehide', () => this.flushSync());
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') this.flushSync();
            });
        },

        ensurePersistPromise() {
            if (this._pendingPersistPromise) return this._pendingPersistPromise;
            this._pendingPersistPromise = new Promise((resolve, reject) => {
                this._resolvePersist = resolve;
                this._rejectPersist = reject;
            });
            return this._pendingPersistPromise;
        },

        clearPersistState() {
            this._pendingPersistPromise = null;
            this._resolvePersist = null;
            this._rejectPersist = null;
        },

        schedulePersist() {
            this.ensurePersistPromise();
            clearTimeout(this._persistTimer);
            this._persistTimer = setTimeout(() => {
                this.flush().catch((e) => {
                    if (window.toast) toast.show(`数据保存失败：${toast.sanitize(e)}`, 'error');
                    else console.error('flush failed', e);
                });
            }, this.FLUSH_DEBOUNCE_MS);
        },

        save(options = {}) {
            const shouldRender = options.render !== false;
            this.db.lastModified = Math.max(Date.now(), Number(this.db.lastModified || 0) + 1);
            this.db.deviceId = this.db.deviceId || `dev-${Math.random().toString(36).slice(2,10)}`;
            this._dbDirty = true;
            this.flushSync();
            this.schedulePersist();
            if (shouldRender) this.render();
            if (options.sync !== false && window.sync && typeof sync.scheduleAutoPush === 'function') {
                try { sync.scheduleAutoPush(); } catch (e) { console.warn('scheduleAutoPush failed', e); }
            }
        },

        persistCfg() {
            Promise.resolve(this.resolveStorageAdapter().write(this.CFG_KEY, this.cfg)).catch((e) => {
                if (window.toast) toast.show(`配置保存失败：${toast.sanitize(e)}`, 'error');
                else console.error('persistCfg failed', e);
            });
        },

        flushSync() {
            const storage = this.resolveStorageAdapter();
            try {
                storage.flushSync(this.DB_KEY, this.db);
                if (this.cfg) storage.flushSync(this.CFG_KEY, this.cfg);
            } catch (e) {
                window.errorBus?.event?.('storage', 'flushSync:failed', { mode: this._storageMode, error: e });
                if (window.toast) toast.show(`本地快照写入失败：${toast.sanitize(e)}`, 'error');
                else console.error('flushSync failed', e);
            }
        },

        async flush() {
            if (!this._dbDirty && !this._pendingPersistPromise) return;
            const started = Date.now();
            clearTimeout(this._persistTimer);
            this._persistTimer = null;
            this.ensurePersistPromise();
            try {
                if (this._dbDirty) {
                    await Promise.resolve(this.resolveStorageAdapter().write(this.DB_KEY, this.db));
                    this._dbDirty = false;
                    window.errorBus?.event?.('storage', 'flush:success', { mode: this._storageMode, elapsedMs: Date.now() - started, counts: this.storageDebugCounts?.() });
                    if (window.sync && typeof sync.scheduleAutoPush === 'function') {
                        try { sync.scheduleAutoPush(); } catch {}
                    }
                }
                if (this.advice && typeof this.advice.flush === 'function') {
                    await this.advice.flush();
                }
                this._resolvePersist?.();
            } catch (e) {
                window.errorBus?.event?.('storage', 'flush:failed', { mode: this._storageMode, elapsedMs: Date.now() - started, error: e });
                this._rejectPersist?.(e);
                throw e;
            } finally {
                this.clearPersistState();
            }
        },

        async saveAndBackup() {
            this.save();
            await this.flush();
            if (window.sync && typeof sync.scheduleAutoPush === 'function') {
                try { sync.scheduleAutoPush({ debounceMs: 0 }); } catch (e) { console.warn('scheduleAutoPush skipped', e); }
            }
        }
    };
})();
