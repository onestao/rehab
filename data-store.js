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

        createLocalStorageAdapter() {
            return {
                mode: 'localStorage',
                read(key) {
                    const raw = localStorage.getItem(key);
                    if (!raw) return null;
                    return JSON.parse(raw);
                },
                write(key, value) {
                    localStorage.setItem(key, JSON.stringify(value));
                },
                flushSync(key, value) {
                    localStorage.setItem(key, JSON.stringify(value));
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
