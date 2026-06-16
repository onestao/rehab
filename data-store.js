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
            await this._initAdviceApi();
            // recentAdvice loading logic is now handled internally by advice query planner.
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

        async _initAdviceApi() {
            const self = this;
            
            // Clean legacy sync working set
            if (self.db.health && Array.isArray(self.db.health.aiAdviceChat) && self.db.health.aiAdviceChat.length > 50) {
                self.db.health.aiAdviceChat = self.db.health.aiAdviceChat.slice(-50);
                self._dbDirty = true;
            }

            const SEGMENT_SIZE = 100;
            const MAX_SEGMENTS = 8;
            
            let allTimelineIds = [];
            if (window.adviceCollections && typeof window.adviceCollections.getAllIds === 'function') {
                allTimelineIds = await window.adviceCollections.getAllIds();
            } else if (self.db.health.aiAdviceChat) {
                allTimelineIds = self.db.health.aiAdviceChat.map(function(r) { return r.id; });
            }

            this.advice = {
                mode: 'timeline', // 'timeline' | 'search'
                version: 1,
                activeIdsRef: [].concat(allTimelineIds),
                
                // State variables for Query Planner & LRU
                _filteredIds: [],
                _timelineIds: allTimelineIds,
                _lruCache: new Map(), // segmentId -> Map(id -> record)
                _fetchingSegments: new Set(),
                
                // Emergency state machine: NORMAL, DEGRADED, RECOVERY
                _telemetryState: 'NORMAL',
                _consecutiveMisses: 0,
                _lastEmergencySync: 0,
                _lastIndexRequested: 0,
                _lastTimeRequested: Date.now(),
                _adaptiveLagBudget: 1,

                // -----------------------------------------
                // View Model / PURE Resolver
                // -----------------------------------------
                
                /**
                 * Pure sync resolver for Virtual List.
                 * NEVER performs IO. Returns skeleton if segment is missed.
                 * Checks renderVersion for lag budget.
                 */
                getItem(index, renderVersion) {
                    const lag = this.version - renderVersion;
                    const isHardMismatch = lag < 0; // Negative lag means renderVersion is from future? Shouldn't happen unless restarted
                    
                    // Adaptive Lag Budget Check
                    if (isHardMismatch || lag > this._adaptiveLagBudget) {
                        return { skeleton: true, id: 'skel-stale-' + index, _stale: true };
                    }
                    
                    const id = this.activeIdsRef[index];
                    if (!id) return null;

                    const segmentId = Math.floor(index / SEGMENT_SIZE);
                    const segmentData = this._lruCache.get(segmentId);
                    
                    // Trigger Query Planner async (fire and forget I/O)
                    this._queryPlanner(index, segmentId);

                    if (segmentData && segmentData.has(id)) {
                        this._consecutiveMisses = 0; // reset
                        return segmentData.get(id);
                    }
                    
                    // SKELETON MISS
                    this._recordSkeletonHit();
                    return { skeleton: true, id: 'skel-' + id };
                },

                // -----------------------------------------
                // Query Planning & Adaptive Strategies
                // -----------------------------------------

                _queryPlanner(index, currentSegmentId) {
                    // 1. Calculate Velocity & Update Lag Budget
                    const now = Date.now();
                    const deltaT = now - this._lastTimeRequested;
                    if (deltaT > 0 && deltaT < 1000) {
                        const deltaIdx = Math.abs(index - this._lastIndexRequested);
                        const velocity = deltaIdx / deltaT; // items per ms
                        
                        // Dual-rate Smoothing (Hysteresis)
                        if (velocity > 0.05) {
                            // Fast path: rapid adaptation to avoid lag
                            this._adaptiveLagBudget = Math.min(3, this._adaptiveLagBudget + 0.5);
                        } else {
                            // Slow path: gradual decay to maintain stability
                            this._adaptiveLagBudget = Math.max(1, this._adaptiveLagBudget - 0.05);
                        }
                    } else if (deltaT >= 1000) {
                        this._adaptiveLagBudget = 1; // reset when idle
                    }
                    this._lastIndexRequested = index;
                    this._lastTimeRequested = now;

                    // 2. Prefetch Logic ( +2 ahead/behind )
                    this._prefetchSegment(currentSegmentId);
                    
                    // Determine scroll direction (heuristic based on near edges of segment)
                    const offsetInSegment = index % SEGMENT_SIZE;
                    if (offsetInSegment > (SEGMENT_SIZE * 0.7)) {
                        this._prefetchSegment(currentSegmentId + 1);
                        this._prefetchSegment(currentSegmentId + 2);
                    } else if (offsetInSegment < (SEGMENT_SIZE * 0.3)) {
                        this._prefetchSegment(currentSegmentId - 1);
                        this._prefetchSegment(currentSegmentId - 2);
                    } else {
                        // In middle, prefetch both adjacents
                        this._prefetchSegment(currentSegmentId + 1);
                        this._prefetchSegment(currentSegmentId - 1);
                    }
                },

                _recordSkeletonHit() {
                    this._consecutiveMisses++;
                    if (this._consecutiveMisses > 10 && this._telemetryState === 'NORMAL') {
                        const now = Date.now();
                        // Cooldown check (prevent IO storm)
                        if (now - this._lastEmergencySync > 2000) {
                            this._telemetryState = 'DEGRADED';
                            this._lastEmergencySync = now;
                            this._triggerEmergencyPrefetch();
                        }
                    }
                },

                _triggerEmergencyPrefetch() {
                    console.warn('[AI Query Planner] Emergency Prefetch Triggered!');
                    const currentSegmentId = Math.floor(this._lastIndexRequested / SEGMENT_SIZE);
                    this._prefetchSegment(currentSegmentId, true);
                    this._prefetchSegment(currentSegmentId + 1, true);
                    this._prefetchSegment(currentSegmentId - 1, true);
                    this._telemetryState = 'RECOVERY';
                    setTimeout(() => {
                        this._telemetryState = 'NORMAL';
                        this._consecutiveMisses = 0;
                    }, 1000);
                },

                _prefetchSegment(segmentId, force = false) {
                    if (segmentId < 0) return;
                    
                    // Ensure bounds
                    const maxSegId = Math.floor(this.activeIdsRef.length / SEGMENT_SIZE);
                    if (segmentId > maxSegId) return;

                    if (!force && this._lruCache.has(segmentId)) {
                        // Refresh LRU order (delete and re-add)
                        const val = this._lruCache.get(segmentId);
                        this._lruCache.delete(segmentId);
                        this._lruCache.set(segmentId, val);
                        return;
                    }

                    if (this._fetchingSegments.has(segmentId)) return;
                    this._fetchingSegments.add(segmentId);

                    // Resolve IDs for this segment from activeIdsRef
                    const startIdx = segmentId * SEGMENT_SIZE;
                    const idsToFetch = this.activeIdsRef.slice(startIdx, startIdx + SEGMENT_SIZE);

                    if (idsToFetch.length === 0) {
                        this._fetchingSegments.delete(segmentId);
                        return;
                    }

                    if (!window.adviceCollections) {
                        this._fetchingSegments.delete(segmentId);
                        return;
                    }

                    // Perform IO
                    window.adviceCollections.getByIds(idsToFetch).then(results => {
                        const segmentMap = new Map();
                        results.forEach(record => {
                            if (record && record.id) segmentMap.set(record.id, record);
                        });

                        // Enforce LRU bounds
                        if (this._lruCache.size >= MAX_SEGMENTS) {
                            const oldestKey = this._lruCache.keys().next().value;
                            this._lruCache.delete(oldestKey);
                        }

                        this._lruCache.set(segmentId, segmentMap);
                        this._fetchingSegments.delete(segmentId);
                        
                        // Notify UI to re-render if it was missing these items
                        window.dispatchEvent(new CustomEvent('aiAdvice:segmentLoaded', { detail: { segmentId } }));
                    }).catch(err => {
                        console.error('[AI Query Planner] Segment fetch failed:', err);
                        this._fetchingSegments.delete(segmentId);
                    });
                },

                // -----------------------------------------
                // State Mutations (Immutable Snapshots)
                // -----------------------------------------

                setMode(mode) {
                    if (this.mode === mode) return;
                    this.mode = mode;
                    this.version++;
                    this.activeIdsRef = [].concat(mode === 'search' ? this._filteredIds : this._timelineIds);
                },

                setSearchResults(filteredIds) {
                    this._filteredIds = filteredIds;
                    if (this.mode === 'search') {
                        this.version++;
                        this.activeIdsRef = [].concat(this._filteredIds);
                    }
                },

                append(record) {
                    if (!record || typeof record !== 'object') return;
                    if (!record.id) record.id = self.generateRecordId('advice');
                    if (!record.updatedAt) record.updatedAt = Date.now();
                    if (typeof record.deleted !== 'boolean') record.deleted = false;
                    
                    // Update Timeline
                    this._timelineIds.push(record.id);
                    
                    // Inject into currently active LRU segment if applicable (last segment)
                    const segmentId = Math.floor((this._timelineIds.length - 1) / SEGMENT_SIZE);
                    if (!this._lruCache.has(segmentId)) {
                        this._lruCache.set(segmentId, new Map());
                    }
                    this._lruCache.get(segmentId).set(record.id, record);

                    // Trigger IDB Save
                    if (window.adviceCollections) {
                        window.adviceCollections.append(record).catch(e => console.warn('advice.append fail', e));
                    }
                    
                    // Snapshot Immutability Update
                    if (this.mode === 'timeline') {
                        this.version++;
                        this.activeIdsRef = [].concat(this._timelineIds);
                    }
                    
                    // Keep workingSet updated for sync layer compatibility
                    self.db.health.aiAdviceChat.push(record);
                    if (self.db.health.aiAdviceChat.length > 50) {
                        self.db.health.aiAdviceChat = self.db.health.aiAdviceChat.slice(-50);
                    }
                    self._dbDirty = true;
                },

                update(record) {
                    if (!record || !record.id) return;
                    
                    // Update LRU if present
                    for (let segmentMap of this._lruCache.values()) {
                        if (segmentMap.has(record.id)) {
                            segmentMap.set(record.id, record);
                            break;
                        }
                    }
                    
                    // Trigger IDB Save
                    if (window.adviceCollections) {
                        window.adviceCollections.update(record).catch(e => console.warn('advice.update fail', e));
                    }
                    
                    // Update workingSet
                    const idx = self.db.health.aiAdviceChat.findIndex(r => r && r.id === record.id);
                    if (idx >= 0) {
                        self.db.health.aiAdviceChat[idx] = record;
                        self._dbDirty = true;
                    }

                    // Snapshot version bump to trigger re-render
                    this.version++;
                },

                deleteById(id) {
                    // Remove from timeline array
                    this._timelineIds = this._timelineIds.filter(tid => tid !== id);
                    if (this.mode === 'timeline') {
                        this.activeIdsRef = [].concat(this._timelineIds);
                    } else {
                        this._filteredIds = this._filteredIds.filter(tid => tid !== id);
                        this.activeIdsRef = [].concat(this._filteredIds);
                    }
                    
                    // Remove from LRU
                    for (let segmentMap of this._lruCache.values()) {
                        if (segmentMap.has(id)) {
                            segmentMap.delete(id);
                            break;
                        }
                    }

                    if (window.adviceCollections) {
                        // We need a deleteById in adviceCollections! Let's just use update with deleted flag.
                        window.adviceCollections.getById(id).then(r => {
                            if (r) {
                                r.deleted = true;
                                r.updatedAt = Date.now();
                                window.adviceCollections.update(r);
                            }
                        });
                    }
                    
                    const idx = self.db.health.aiAdviceChat.findIndex(r => r && r.id === id);
                    if (idx >= 0) {
                        self.db.health.aiAdviceChat.splice(idx, 1);
                        self._dbDirty = true;
                    }

                    this.version++;
                    return true;
                },

                // Compatibility stubs for sync.js and old code
                getRecent(limit) {
                    limit = limit || 50;
                    const recentIds = this._timelineIds.slice(-limit);
                    return window.adviceCollections ? window.adviceCollections.getByIds(recentIds) : Promise.resolve([]);
                },
                getAll() {
                    return window.adviceCollections ? window.adviceCollections.getAll() : Promise.resolve([]);
                },
                flush() {
                    return Promise.resolve(); // Handled individually now
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
