// @ts-nocheck
(function () {
    window.dataStore = {
        STORAGE_VERSION_KEY: 'storageVersion',
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
            if (window.storageMigrate && typeof window.storageMigrate.createAdapter === 'function') {
                const migrationResult = await window.storageMigrate.createAdapter({
                    dbKey: this.DB_KEY,
                    cfgKey: this.CFG_KEY,
                    storageVersionKey: this.STORAGE_VERSION_KEY,
                    migrationFailedKey: this.MIGRATION_FAILED_KEY,
                    targetVersion: this.SCHEMA_VERSION
                });
                this._storage = migrationResult.adapter;
                this._storageMode = migrationResult.mode;
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
            this.bindFlushHooks();
            if (window.sync && typeof sync.initUI === 'function') sync.initUI();
            if (typeof ai !== 'undefined') await ai.init({ saveData: true, renderData: false });
            this.render();
            this.restoreActionDraft();
            if (window.cardio) cardio.initUI();
            if (window.onboarding && !this.db.onboarded) onboarding.show();

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

        normalizeDb() {
            const nowTs = Date.now();
            this.db.schemaVersion = Math.max(Number(this.db.schemaVersion) || 0, this.SCHEMA_VERSION);
            this.db.cardio = { weight: 70, target: 30, type: 'walk', ...(this.db.cardio || {}) };
            this.db.health = { weights: [], foodLogs: [], exerciseLogs: [], goalType: 'loss', bodyPlan: null, weightPlan: null, dietGoal: null, aiAdviceChat: [], weeklyGoalSessions: 5, ...(this.db.health || {}) };
            this.db.actions = (this.db.actions || []).map(a => this.ensureRecordMeta(a, 'action', nowTs));
            this.db.routines = (this.db.routines || []).map(r => {
                this.ensureRecordMeta(r, 'routine', nowTs);
                r.actions = (r.actions || []).map(a => {
                    const action = this.ensureRecordMeta(a, 'routine-action', Number(r.updatedAt || nowTs));
                    if (!action.sourceActionId && action.id) action.sourceActionId = action.id;
                    return action;
                });
                return r;
            });
            this.db.history = (this.db.history || []).map(h => {
                this.ensureRecordMeta(h, 'history', nowTs);
                h.actions = (h.actions || []).map(a => this.ensureRecordMeta(a, 'history-action', Number(h.updatedAt || nowTs)));
                return h;
            });
            this.db.health.weights = (this.db.health.weights || []).map(item => this.ensureRecordMeta(item, 'weight', nowTs));
            this.db.health.foodLogs = (this.db.health.foodLogs || []).map(item => this.ensureRecordMeta(item, 'food', nowTs));
            this.db.health.exerciseLogs = (this.db.health.exerciseLogs || []).map(item => this.ensureRecordMeta(item, 'exercise', nowTs));
            this.db.health.aiAdviceChat = (this.db.health.aiAdviceChat || []).map(item => this.ensureRecordMeta(item, 'advice', nowTs));
            this.db.actions = this.db.actions.map(a => {
                a.tags = Array.isArray(a.tags) ? a.tags.filter(Boolean) : [];
                return a;
            });
            this.db.aiTemplates = Array.isArray(this.db.aiTemplates) ? this.db.aiTemplates : [];
            this.db.aiTemplateActiveId = this.db.aiTemplateActiveId || '';
            this.db.aiTrash = Array.isArray(this.db.aiTrash) ? this.db.aiTrash : [];
            const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
            this.db.aiTrash = this.db.aiTrash.filter(item => Number(item?.deletedAt || 0) >= cutoff);
            this.db.aiRetryMode = this.db.aiRetryMode || 'versioned';
            this.db.aiCipher = this.db.aiCipher && typeof this.db.aiCipher === 'object' ? this.db.aiCipher : null;
            if (!this.db.aiCipher && this.db.encryptedAi && typeof this.db.encryptedAi === 'object') {
                this.db.aiCipher = { id: 'ai-cipher', payload: this.db.encryptedAi, updatedAt: nowTs, deleted: false };
            }
            if (this.db.aiCipher?.payload) this.db.encryptedAi = this.db.aiCipher.payload;
            this.db.cache = this.db.cache && typeof this.db.cache === 'object' ? this.db.cache : {};
            this.db.cache.prByAction = this.db.cache.prByAction && typeof this.db.cache.prByAction === 'object' ? this.db.cache.prByAction : {};
            this.db.cache.prUpdatedAt = Number(this.db.cache.prUpdatedAt || 0);
            this.db.health.dietInputMode = this.db.health.dietInputMode || 'ai';
            this.db.health.profile = this.ensureRecordMeta(this.db.health.profile || {}, 'profile', nowTs);
            this.db.health.profile.gender = this.db.health.profile.gender || 'male';
            this.db.health.profile.age = this.db.health.profile.age || null;
            this.db.health.profile.conditions = this.db.health.profile.conditions || [];
            this.db.health.profile.allergies = this.db.health.profile.allergies || [];
            this.db.health.profile.preferences = this.db.health.profile.preferences || { equipment: [], sports: [] };
            this.db.health.profile.vitals = this.db.health.profile.vitals || { restingHR: null };
            this.db.health.dayCutoffHour = Number(this.db.health.dayCutoffHour ?? this.dayCutoffHour ?? 4) || 4;
            this.dayCutoffHour = this.db.health.dayCutoffHour;
            this.db.lastModified = this.db.lastModified || 0;
            this.db.deviceId = this.db.deviceId || `dev-${Math.random().toString(36).slice(2,10)}`;
            this.db.lastActionDraft = this.db.lastActionDraft || null;
            this.db.actualSetsBuffer = this.db.actualSetsBuffer || [];
            this.db.onboarded = !!this.db.onboarded;
            this.db.aiProfiles = this.db.aiProfiles || [];
            this.db.aiActiveId = this.db.aiActiveId || '';
            this.db.aiModels = this.db.aiModels || [];
            this.db.libraryView = ['actions', 'routines'].includes(this.db.libraryView) ? this.db.libraryView : 'actions';
            this.db.libraryFilterTag = typeof this.db.libraryFilterTag === 'string' ? this.db.libraryFilterTag : '';
            this.db.syncMeta = this.db.syncMeta || {};
            this.db.syncMeta.lastSyncAt = Number(this.db.syncMeta.lastSyncAt || 0);
            this.db.syncMeta.lastIncrementalTs = Number(this.db.syncMeta.lastIncrementalTs || 0);
            this.db.syncMeta.etags = this.db.syncMeta.etags || {};
            this.db.syncMeta.pendingQueue = Array.isArray(this.db.syncMeta.pendingQueue) ? this.db.syncMeta.pendingQueue : [];
            this.db.syncMeta.lastArchiveDate = this.db.syncMeta.lastArchiveDate || '';
            this.db.syncMeta.lastArchiveChecksum = this.db.syncMeta.lastArchiveChecksum || '';
            this.db.syncMeta.conflictLog = Array.isArray(this.db.syncMeta.conflictLog) ? this.db.syncMeta.conflictLog : [];
            this.db.actions.forEach(a => { if (!a.phase) a.phase = 'main'; });
            this.db.routines.forEach(r => (r.actions || []).forEach(a => { if (!a.phase) a.phase = 'main'; }));
            if (window.dataAiTemplates && typeof window.dataAiTemplates.ensureDefaultTemplates === 'function') {
                window.dataAiTemplates.ensureDefaultTemplates(this.db);
            }
        },

        generateRecordId(prefix = 'rec') {
            return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        },

        ensureRecordMeta(record, prefix = 'rec', fallbackTs = Date.now()) {
            if (!record || typeof record !== 'object') return record;
            if (!record.id) record.id = this.generateRecordId(prefix);
            const ts = Number(record.updatedAt || 0);
            record.updatedAt = Number.isFinite(ts) && ts > 0 ? ts : Number(fallbackTs || Date.now());
            record.deleted = !!record.deleted;
            return record;
        },

        touchRecord(record, changedFields = null) {
            if (!record || typeof record !== 'object') return;
            if (!record.id) record.id = this.generateRecordId('rec');
            const now = Date.now();
            record.updatedAt = now;
            if (typeof record.deleted !== 'boolean') record.deleted = false;
            if (Array.isArray(changedFields) && changedFields.length) {
                record.__fieldUpdatedAt = record.__fieldUpdatedAt || {};
                const iso = new Date(now).toISOString();
                changedFields.forEach(k => { record.__fieldUpdatedAt[k] = iso; });
            }
        },

        activeRecords(list) {
            return (list || []).filter(item => item && !item.deleted);
        },

        softDeleteById(list, id) {
            const record = (list || []).find(item => item && item.id === id);
            if (!record) return false;
            record.deleted = true;
            record.updatedAt = Date.now();
            return true;
        },

        restoreById(list, id) {
            const record = (list || []).find(item => item && item.id === id);
            if (!record) return false;
            record.deleted = false;
            record.updatedAt = Date.now();
            return true;
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
            this.db.lastModified = Date.now();
            this.db.deviceId = this.db.deviceId || `dev-${Math.random().toString(36).slice(2,10)}`;
            this._dbDirty = true;
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
                if (window.toast) toast.show(`本地快照写入失败：${toast.sanitize(e)}`, 'error');
                else console.error('flushSync failed', e);
            }
        },

        async flush() {
            if (!this._dbDirty && !this._pendingPersistPromise) return;
            clearTimeout(this._persistTimer);
            this._persistTimer = null;
            this.ensurePersistPromise();
            try {
                if (this._dbDirty) {
                    await Promise.resolve(this.resolveStorageAdapter().write(this.DB_KEY, this.db));
                    this._dbDirty = false;
                    if (window.sync && typeof sync.scheduleAutoPush === 'function') {
                        try { sync.scheduleAutoPush(); } catch {}
                    }
                }
                this._resolvePersist?.();
            } catch (e) {
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
