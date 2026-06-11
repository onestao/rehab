// @ts-nocheck
(function () {
    function generateId(prefix) {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function ensureVersionMeta(version, fallbackTs) {
        const next = version && typeof version === 'object' ? { ...version } : {};
        if (!next.id) next.id = generateId('advice-ver');
        const created = Number(next.createdAt || fallbackTs);
        next.createdAt = Number.isFinite(created) ? created : fallbackTs;
        if (!next.status) next.status = 'done';
        return next;
    }

    function migrateAdviceToVersioned(db) {
        const next = db && typeof db === 'object' ? db : {};
        next.health = next.health && typeof next.health === 'object' ? next.health : {};
        const list = Array.isArray(next.health.aiAdviceChat) ? next.health.aiAdviceChat : [];
        const migrated = list.map(entry => {
            if (!entry || typeof entry !== 'object') return entry;
            if (Array.isArray(entry.versions)) return entry;
            const createdAt = Number(entry.createdAt || entry.updatedAt || Date.now());
            const version = ensureVersionMeta({
                createdAt,
                model: entry.model,
                promptSnapshot: entry.promptSnapshot,
                content: entry.content || '',
                status: entry.error ? 'error' : (entry.pending ? 'streaming' : 'done'),
                tokenUsage: entry.tokenUsage,
                costUsd: entry.costUsd,
                error: entry.error ? String(entry.errorMessage || entry.error || '') : undefined
            }, createdAt);
            const activeVersionId = entry.activeVersionId || version.id;
            return {
                ...entry,
                versions: [version],
                activeVersionId,
                updatedAt: Number(entry.updatedAt || createdAt),
                deletedAt: entry.deletedAt || null
            };
        });
        next.health.aiAdviceChat = migrated;
        next.schemaVersion = Math.max(Number(next.schemaVersion || 0), 3);
        return next;
    }
    function safeParse(raw, keyName) {
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (e) {
            throw new Error(keyName + ' JSON 解析失败');
        }
    }

    function stripInternalStorageFields(value) {
        if (!value || Object.prototype.toString.call(value) !== '[object Object]') return value;
        const next = JSON.parse(JSON.stringify(value));
        delete next.largeCollections;
        return next;
    }

    function collectFields(value, prefix, set) {
        if (value == null) return;
        if (Array.isArray(value)) {
            const arrayPath = prefix ? prefix + '[]' : '[]';
            set.add(arrayPath);
            for (let i = 0; i < value.length; i++) collectFields(value[i], arrayPath, set);
            return;
        }
        if (Object.prototype.toString.call(value) !== '[object Object]') return;
        const keys = Object.keys(value).sort();
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const path = prefix ? prefix + '.' + key : key;
            set.add(path);
            collectFields(value[key], path, set);
        }
    }

    function diffFieldSet(source, target) {
        const sourceSet = new Set();
        const targetSet = new Set();
        collectFields(source, '', sourceSet);
        collectFields(target, '', targetSet);
        const missing = [];
        const extra = [];
        sourceSet.forEach(function (item) { if (!targetSet.has(item)) missing.push(item); });
        targetSet.forEach(function (item) { if (!sourceSet.has(item)) extra.push(item); });
        return { missing: missing.sort(), extra: extra.sort() };
    }

    /** Wrapper around localStorage.setItem that silently handles QuotaExceededError.
     *  Delegates eviction to dataStore if available, then retries once. */
    function safeSet(key, serialized) {
        try {
            localStorage.setItem(key, serialized);
            return true;
        } catch (e) {
            const isQuota = e && (e.name === 'QuotaExceededError' || e.code === 22 || /quota/i.test(e.message || ''));
            if (!isQuota) throw e;
            try {
                if (window.dataStore && typeof window.dataStore._evictAiChatForQuota === 'function') {
                    window.dataStore._evictAiChatForQuota();
                }
                localStorage.setItem(key, serialized);
                return true;
            } catch (_) {
                window.errorBus?.report?.('storage.migrate', e, { op: 'setItem', key });
                return false;
            }
        }
    }

    function createLocalAdapter() {
        return {
            mode: 'localStorage',
            read(key) {
                return safeParse(localStorage.getItem(key), key);
            },
            write(key, value) {
                safeSet(key, JSON.stringify(value));
            },
            flushSync(key, value) {
                safeSet(key, JSON.stringify(value));
            },
            remove(key) {
                localStorage.removeItem(key);
            }
        };
    }

    function splitLargeCollections(db) {
        const source = stripInternalStorageFields(db) || {};
        source.health = source.health && typeof source.health === 'object' ? source.health : {};
        const history = Array.isArray(source.history) ? source.history : [];
        const advice = Array.isArray(source.health.aiAdviceChat) ? source.health.aiAdviceChat : [];
        source.history = [];
        source.health.aiAdviceChat = [];
        return { meta: source, history, advice };
    }

    function hydrateLargeCollections(meta, large) {
        const next = stripInternalStorageFields(meta) || {};
        next.health = next.health && typeof next.health === 'object' ? next.health : {};
        next.history = Array.isArray(large?.history) ? large.history : (Array.isArray(next.history) ? next.history : []);
        next.health.aiAdviceChat = Array.isArray(large?.advice) ? large.advice : (Array.isArray(next.health.aiAdviceChat) ? next.health.aiAdviceChat : []);
        return next;
    }

    function pickLargestCollection() {
        return Array.from(arguments)
            .filter(Array.isArray)
            .reduce(function (best, item) { return item.length > best.length ? item : best; }, []);
    }

    function recoverLargeCollections(meta, sources) {
        sources = sources || {};
        return hydrateLargeCollections(meta, {
            history: pickLargestCollection(
                meta?.history,
                sources.idbHistory,
                sources.localHistory,
                sources.legacyHistory,
                sources.idbMetaHistory
            ),
            advice: pickLargestCollection(
                meta?.health?.aiAdviceChat,
                sources.idbAdvice,
                sources.localAdvice,
                sources.legacyAdvice,
                sources.idbMetaAdvice
            )
        });
    }

    function largeKeys(dbKey) {
        return { history: dbKey + ':history', advice: dbKey + ':advice' };
    }

    function createIdbAdapter(options) {
        const dbKey = options?.dbKey;
        const keys = dbKey ? largeKeys(dbKey) : null;

        function readLocalSnapshot(key) {
            try {
                return safeParse(localStorage.getItem(key), key);
            } catch (_) {
                return null;
            }
        }

        function readLegacyFullSnapshot() {
            return dbKey ? readLocalSnapshot(dbKey + ':legacy-full') : null;
        }

        function isNewerSnapshot(localValue, idbValue) {
            if (!localValue || Object.prototype.toString.call(localValue) !== '[object Object]') return false;
            if (!idbValue || Object.prototype.toString.call(idbValue) !== '[object Object]') return true;
            return Number(localValue.lastModified || 0) > Number(idbValue.lastModified || 0);
        }

        async function readHistoryFromStore() {
            if (!window.storageCollections) return null;
            try {
                const count = await window.storageCollections.count();
                if (count > 0) {
                    return await window.storageCollections.getAll();
                }
            } catch (_) {}
            return null;
        }

        async function lazyMigrateHistoryToStore(historyArray) {
            if (!window.storageCollections || !Array.isArray(historyArray) || !historyArray.length) return;
            try {
                const existing = await window.storageCollections.count();
                if (existing > 0) return;
                await window.storageCollections.putMany(historyArray);
            } catch (_) {}
        }

        async function readHistoryHybrid() {
            const storeHistory = await readHistoryFromStore();
            if (storeHistory && storeHistory.length > 0) return storeHistory;
            const kvHistory = await window.storageIdb.get(keys.history);
            if (Array.isArray(kvHistory) && kvHistory.length > 0) {
                await lazyMigrateHistoryToStore(kvHistory);
                return kvHistory;
            }
            return null;
        }

        async function writeHistoryToStore(historyArray) {
            if (!window.storageCollections || !Array.isArray(historyArray)) return;
            try {
                await window.storageCollections.clear();
                if (historyArray.length > 0) {
                    await window.storageCollections.putMany(historyArray);
                }
            } catch (_) {}
        }

        return {
            mode: 'idb',
            async read(key) {
                const idbValue = await window.storageIdb.get(key);
                const localSnapshot = readLocalSnapshot(key);
                if (key === dbKey && idbValue) {
                    const storeOrKvHistory = await readHistoryHybrid();
                    const idbHistory = storeOrKvHistory || await window.storageIdb.get(keys.history);
                    const idbAdvice = await window.storageIdb.get(keys.advice);
                    const legacyFull = readLegacyFullSnapshot();
                    const hydrated = recoverLargeCollections(idbValue, {
                        idbHistory,
                        idbAdvice,
                        localHistory: localSnapshot?.history,
                        localAdvice: localSnapshot?.health?.aiAdviceChat,
                        legacyHistory: legacyFull?.history,
                        legacyAdvice: legacyFull?.health?.aiAdviceChat,
                        idbMetaHistory: idbValue.history,
                        idbMetaAdvice: idbValue.health?.aiAdviceChat
                    });
                    if (isNewerSnapshot(localSnapshot, hydrated)) {
                        const recoveredLocal = recoverLargeCollections(localSnapshot, {
                            idbHistory,
                            idbAdvice,
                            legacyHistory: legacyFull?.history,
                            legacyAdvice: legacyFull?.health?.aiAdviceChat,
                            idbMetaHistory: idbValue.history,
                            idbMetaAdvice: idbValue.health?.aiAdviceChat
                        });
                        const split = splitLargeCollections(recoveredLocal);
                        await window.storageIdb.set(key, split.meta);
                        await writeHistoryToStore(split.history);
                        await window.storageIdb.set(keys.advice, split.advice);
                        return recoveredLocal;
                    }
                    return hydrated;
                }
                if (isNewerSnapshot(localSnapshot, idbValue)) {
                    const legacyFull = readLegacyFullSnapshot();
                    const value = key === dbKey
                        ? recoverLargeCollections(localSnapshot, {
                            legacyHistory: legacyFull?.history,
                            legacyAdvice: legacyFull?.health?.aiAdviceChat
                        })
                        : localSnapshot;
                    if (key === dbKey) {
                        const split = splitLargeCollections(value);
                        await window.storageIdb.set(key, split.meta);
                        await writeHistoryToStore(split.history);
                        await window.storageIdb.set(keys.advice, split.advice);
                    } else {
                        await window.storageIdb.set(key, value);
                    }
                    return value;
                }
                return idbValue;
            },
            async write(key, value) {
                if (key === dbKey) {
                    const split = splitLargeCollections(value);
                    safeSet(key, JSON.stringify(split.meta));
                    await window.storageIdb.set(key, split.meta);
                    await writeHistoryToStore(split.history);
                    await window.storageIdb.set(keys.advice, split.advice);
                    return;
                }
                safeSet(key, JSON.stringify(value));
                await window.storageIdb.set(key, value);
            },
            flushSync(key, value) {
                if (key === dbKey) {
                    safeSet(key, JSON.stringify(splitLargeCollections(value).meta));
                    return;
                }
                safeSet(key, JSON.stringify(value));
            },
            async remove(key) {
                await window.storageIdb.remove(key);
                if (key === dbKey) {
                    if (window.storageCollections) {
                        try { await window.storageCollections.clear(); } catch (_) {}
                    }
                    await window.storageIdb.remove(keys.history);
                    await window.storageIdb.remove(keys.advice);
                }
            }
        };
    }

    const storageMigrate = {
        migrateAdviceToVersioned: migrateAdviceToVersioned,
        createLocalAdapter: createLocalAdapter,

        async createAdapter(options) {
            const localAdapter = createLocalAdapter();
            const hasIdb = typeof indexedDB !== 'undefined' && window.storageIdb;
            if (!hasIdb) {
                window.errorBus?.event?.('storage.migration', 'idb:unavailable');
                return {
                    adapter: localAdapter,
                    mode: 'localStorage',
                    migration: { ok: false, reason: 'IndexedDB 不可用，继续使用 localStorage' }
                };
            }

            let migration;
            try {
                window.errorBus?.event?.('storage.migration', 'start', { targetVersion: Number(options.targetVersion || 2) });
                migration = await this.migrateLocalToIdb(options, localAdapter);
                window.errorBus?.event?.('storage.migration', migration.ok ? 'success' : 'failed', {
                    targetVersion: Number(options.targetVersion || 2),
                    reason: migration.reason || ''
                });
            } catch (e) {
                const reason = e && e.message ? e.message : '迁移流程异常';
                window.errorBus?.event?.('storage.migration', 'exception', { targetVersion: Number(options.targetVersion || 2), error: e });
                localStorage.setItem(options.migrationFailedKey, reason);
                localStorage.removeItem(options.storageVersionKey);
                try { await window.storageIdb.destroy(); } catch (_) {}
                migration = { ok: false, reason: reason };
            }
            if (!migration.ok) {
                return { adapter: localAdapter, mode: 'localStorage', migration: migration };
            }
            return { adapter: createIdbAdapter(options), mode: 'idb', migration: migration };
        },

        async migrateLocalToIdb(options, localAdapter) {
            const dbKey = options.dbKey;
            const cfgKey = options.cfgKey;
            const storageVersionKey = options.storageVersionKey;
            const migrationFailedKey = options.migrationFailedKey;
            const targetVersion = Number(options.targetVersion || 2);
            const currentVersion = Number(localStorage.getItem(storageVersionKey) || 0);

            if (currentVersion >= targetVersion) {
                window.errorBus?.event?.('storage.migration', 'skip', { currentVersion, targetVersion });
                return { ok: true, reason: '' };
            }

            const sourceDbRaw = localStorage.getItem(dbKey);
            const sourceCfgRaw = localStorage.getItem(cfgKey);
            const sourceDb = stripInternalStorageFields(localAdapter.read(dbKey));
            const sourceCfg = localAdapter.read(cfgKey);

            try {
                await window.storageIdb.open();
                if (sourceDb != null) {
                    const split = splitLargeCollections(sourceDb);
                    window.errorBus?.event?.('storage.migration', 'split', {
                        historyCount: split.history.length,
                        adviceCount: split.advice.length,
                        schemaVersion: Number(sourceDb.schemaVersion || 0)
                    });
                    const keys = largeKeys(dbKey);
                    if (sourceDbRaw != null && !localStorage.getItem(dbKey + ':legacy-full')) {
                        safeSet(dbKey + ':legacy-full', sourceDbRaw);
                        safeSet(dbKey + ':legacy-full:createdAt', String(Date.now()));
                    }
                    await window.storageIdb.set(dbKey, split.meta);
                    await window.storageIdb.set(keys.history, split.history);
                    await window.storageIdb.set(keys.advice, split.advice);
                }
                if (sourceCfg != null) await window.storageIdb.set(cfgKey, sourceCfg);

                const keys = largeKeys(dbKey);
                const targetDbMeta = await window.storageIdb.get(dbKey);
                const targetDb = targetDbMeta == null ? null : hydrateLargeCollections(targetDbMeta, {
                    history: await window.storageIdb.get(keys.history),
                    advice: await window.storageIdb.get(keys.advice)
                });
                const targetCfg = await window.storageIdb.get(cfgKey);
                const dbDiff = diffFieldSet(sourceDb, targetDb);
                const cfgDiff = diffFieldSet(sourceCfg, targetCfg);
                const hasDbDiff = dbDiff.missing.length || dbDiff.extra.length;
                const hasCfgDiff = cfgDiff.missing.length || cfgDiff.extra.length;
                if (hasDbDiff || hasCfgDiff) {
                    throw new Error(
                        '迁移校验字段不一致'
                        + (hasDbDiff ? ' [db missing:' + dbDiff.missing.length + ', extra:' + dbDiff.extra.length + ']' : '')
                        + (hasCfgDiff ? ' [cfg missing:' + cfgDiff.missing.length + ', extra:' + cfgDiff.extra.length + ']' : '')
                    );
                }

                try { safeSet(storageVersionKey, String(targetVersion)); } catch {}
                localStorage.removeItem(migrationFailedKey);
                return { ok: true, reason: '' };
            } catch (e) {
                const reason = e && e.message ? e.message : '未知迁移错误';
                localStorage.setItem(migrationFailedKey, reason);
                localStorage.removeItem(storageVersionKey);
                try { await window.storageIdb.destroy(); } catch (_) {}
                if (sourceDbRaw != null) try { localStorage.setItem(dbKey, sourceDbRaw); } catch {}
                if (sourceCfgRaw != null) try { localStorage.setItem(cfgKey, sourceCfgRaw); } catch {}
                return { ok: false, reason: reason };
            }
        }
    };

    if (typeof window !== 'undefined') window.storageMigrate = storageMigrate;
})();
