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

    function createLocalAdapter() {
        return {
            mode: 'localStorage',
            read(key) {
                return safeParse(localStorage.getItem(key), key);
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
    }

    function createIdbAdapter() {
        function readLocalSnapshot(key) {
            try {
                return safeParse(localStorage.getItem(key), key);
            } catch (_) {
                return null;
            }
        }

        function isNewerSnapshot(localValue, idbValue) {
            if (!localValue || Object.prototype.toString.call(localValue) !== '[object Object]') return false;
            if (!idbValue || Object.prototype.toString.call(idbValue) !== '[object Object]') return true;
            return Number(localValue.lastModified || 0) > Number(idbValue.lastModified || 0);
        }

        return {
            mode: 'idb',
            async read(key) {
                const idbValue = await window.storageIdb.get(key);
                const localSnapshot = readLocalSnapshot(key);
                if (isNewerSnapshot(localSnapshot, idbValue)) {
                    await window.storageIdb.set(key, localSnapshot);
                    return localSnapshot;
                }
                return idbValue;
            },
            async write(key, value) {
                localStorage.setItem(key, JSON.stringify(value));
                await window.storageIdb.set(key, value);
            },
            flushSync(key, value) {
                localStorage.setItem(key, JSON.stringify(value));
            },
            async remove(key) {
                await window.storageIdb.remove(key);
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
                return {
                    adapter: localAdapter,
                    mode: 'localStorage',
                    migration: { ok: false, reason: 'IndexedDB 不可用，继续使用 localStorage' }
                };
            }

            let migration;
            try {
                migration = await this.migrateLocalToIdb(options, localAdapter);
            } catch (e) {
                const reason = e && e.message ? e.message : '迁移流程异常';
                localStorage.setItem(options.migrationFailedKey, reason);
                localStorage.removeItem(options.storageVersionKey);
                try { await window.storageIdb.destroy(); } catch (_) {}
                migration = { ok: false, reason: reason };
            }
            if (!migration.ok) {
                return { adapter: localAdapter, mode: 'localStorage', migration: migration };
            }
            return { adapter: createIdbAdapter(), mode: 'idb', migration: migration };
        },

        async migrateLocalToIdb(options, localAdapter) {
            const dbKey = options.dbKey;
            const cfgKey = options.cfgKey;
            const storageVersionKey = options.storageVersionKey;
            const migrationFailedKey = options.migrationFailedKey;
            const targetVersion = Number(options.targetVersion || 2);
            const currentVersion = Number(localStorage.getItem(storageVersionKey) || 0);

            if (currentVersion >= targetVersion) {
                return { ok: true, reason: '' };
            }

            const sourceDbRaw = localStorage.getItem(dbKey);
            const sourceCfgRaw = localStorage.getItem(cfgKey);
            const sourceDb = localAdapter.read(dbKey);
            const sourceCfg = localAdapter.read(cfgKey);

            try {
                await window.storageIdb.open();
                if (sourceDb != null) await window.storageIdb.set(dbKey, sourceDb);
                if (sourceCfg != null) await window.storageIdb.set(cfgKey, sourceCfg);

                const targetDb = await window.storageIdb.get(dbKey);
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

                localStorage.setItem(storageVersionKey, String(targetVersion));
                localStorage.removeItem(migrationFailedKey);
                return { ok: true, reason: '' };
            } catch (e) {
                const reason = e && e.message ? e.message : '未知迁移错误';
                localStorage.setItem(migrationFailedKey, reason);
                localStorage.removeItem(storageVersionKey);
                try { await window.storageIdb.destroy(); } catch (_) {}
                if (sourceDbRaw != null) localStorage.setItem(dbKey, sourceDbRaw);
                if (sourceCfgRaw != null) localStorage.setItem(cfgKey, sourceCfgRaw);
                return { ok: false, reason: reason };
            }
        }
    };

    if (typeof window !== 'undefined') window.storageMigrate = storageMigrate;
})();
