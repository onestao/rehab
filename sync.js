// @ts-nocheck
/**
 * @typedef {'none' | 's3' | 'webdav'} SyncMode
 * @typedef {{ endpoint?: string, region?: string, bucket?: string, key?: string, secret?: string }} SyncS3Config
 * @typedef {{ url?: string, user?: string, pass?: string, path?: string }} SyncDavConfig
 * @typedef {{ mode?: SyncMode, s3?: SyncS3Config, dav?: SyncDavConfig }} SyncConfig
 */

function computeRetryDelay(attempt, opts = {}) {
    const baseDelay = Number(opts.baseDelay || 800);
    const factor = Number(opts.factor || 2);
    const jitter = Number(opts.jitter || 0.2);
    const base = baseDelay * (factor ** Math.max(0, attempt - 1));
    const delta = base * jitter;
    return Math.max(0, Math.round(base + delta));
}

function isRetryableError(error) {
    const status = Number(error && typeof error === 'object' && 'status' in error ? error.status : 0);
    if (status === 429 || status >= 500) return true;
    if (status >= 400 && status < 500) return false;
    const message = String(error && typeof error === 'object' && 'message' in error ? error.message : error || '');
    return /fetch|network|timeout|load failed|failed to fetch/i.test(message);
}

function mergeAdviceVersions(localVersions, remoteVersions) {
    const map = new Map();
    (localVersions || []).forEach(item => {
        if (!item?.id) return;
        map.set(item.id, item);
    });
    (remoteVersions || []).forEach(item => {
        if (!item?.id) return;
        const current = map.get(item.id);
        if (!current) {
            map.set(item.id, item);
            return;
        }
        const currentTs = Number(current.createdAt || 0);
        const nextTs = Number(item.createdAt || 0);
        if (nextTs >= currentTs) map.set(item.id, item);
    });
    return Array.from(map.values()).sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
}

function mergeAdviceRecord(local, remote) {
    const lTs = Number(local?.updatedAt || 0);
    const rTs = Number(remote?.updatedAt || 0);
    const base = rTs >= lTs ? { ...local, ...remote } : { ...remote, ...local };
    base.versions = mergeAdviceVersions(local?.versions || [], remote?.versions || []);
    if (rTs >= lTs) {
        base.activeVersionId = remote?.activeVersionId || base.activeVersionId || '';
        base.pinnedVersionId = remote?.pinnedVersionId || base.pinnedVersionId || '';
    } else {
        base.activeVersionId = local?.activeVersionId || base.activeVersionId || '';
        base.pinnedVersionId = local?.pinnedVersionId || base.pinnedVersionId || '';
    }
    base.updatedAt = Math.max(lTs, rTs);
    return base;
}

const sync = {
    INCREMENTAL_WINDOW_MS: 5 * 60 * 1000,
    COMPACTION_THRESHOLD: 50,
    REMOTE_SNAPSHOT: 'rehab_pro_data.json',
    REMOTE_MANIFEST: 'manifest.json',
    REMOTE_INCREMENTAL_DIR: 'incremental',
    RETRY_DEFAULTS: { retries: 3, baseDelay: 800, factor: 2, jitter: 0.2 },
    __pushTimer: null,
    __pushDebounceMs: 8000,

    scheduleAutoPush(opts = {}) {
        if (data.cfg.mode === 'none') return;
        const ms = Number(opts.debounceMs || this.__pushDebounceMs);
        clearTimeout(this.__pushTimer);
        this.__pushTimer = setTimeout(() => {
            this.autoBackup('auto-save').catch(e => console.warn('autoBackup failed', e));
        }, ms);
    },

    async sha256(s) {
        let input;
        if (s instanceof Uint8Array || s instanceof ArrayBuffer) {
            input = s instanceof ArrayBuffer ? new Uint8Array(s) : s;
        } else {
            input = new TextEncoder().encode(s);
        }
        const b = await crypto.subtle.digest('SHA-256', input);
        return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
    },

    async hmac(k, d) {
        const cK = typeof k === 'string' ? new TextEncoder().encode(k) : k;
        const key = await crypto.subtle.importKey('raw', cK, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(d));
    },

    getSyncMeta() {
        data.db.syncMeta = data.db.syncMeta || {};
        data.db.syncMeta.lastSyncAt = Number(data.db.syncMeta.lastSyncAt || 0);
        data.db.syncMeta.lastIncrementalTs = Number(data.db.syncMeta.lastIncrementalTs || 0);
        data.db.syncMeta.etags = data.db.syncMeta.etags || {};
        data.db.syncMeta.pendingQueue = Array.isArray(data.db.syncMeta.pendingQueue) ? data.db.syncMeta.pendingQueue : [];
        data.db.syncMeta.aiCipherLastResolvedAt = Number(data.db.syncMeta.aiCipherLastResolvedAt || 0);
        data.db.syncMeta.lastArchiveDate = data.db.syncMeta.lastArchiveDate || '';
        data.db.syncMeta.lastArchiveChecksum = data.db.syncMeta.lastArchiveChecksum || '';
        data.db.syncMeta.conflictLog = Array.isArray(data.db.syncMeta.conflictLog) ? data.db.syncMeta.conflictLog : [];
        return data.db.syncMeta;
    },

    async exportAiCipherBackup(payload) {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rehab-ai-cipher-backup-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    async resolveAiCipherConflict(localCipher, remoteCipher) {
        const localTs = Number(localCipher?.updatedAt || 0);
        const remoteTs = Number(remoteCipher?.updatedAt || 0);
        if (!localCipher) return remoteCipher;
        if (!remoteCipher) return localCipher;
        if (localTs === remoteTs) return remoteCipher;
        const useLocal = confirm(`检测到 AI 加密配置双端冲突。\n\n本地时间: ${new Date(localTs).toLocaleString()}\n远端时间: ${new Date(remoteTs).toLocaleString()}\n\n点击“确定”保留本地，点击“取消”保留远端。`);
        if (useLocal) return localCipher;
        const exportBackup = confirm('是否先导出本地 AI 加密配置 JSON 备份？');
        if (exportBackup) await this.exportAiCipherBackup(localCipher);
        return remoteCipher;
    },

    saveSyncMeta() {
        data.touchRecord(data.db.syncMeta);
        data.save({ render: false });
    },

    async _ensureWebdavDirs(remotePath) {
        const cfg = data.cfg.dav || {};
        const base = (cfg.url || '').trim().replace(/\/+$/, '');
        const root = this.davRoot();
        const cleanPath = String(remotePath || '').replace(/^\/+/, '');
        const fullBase = `${base}/${root ? `${root}/` : ''}`;
        const parts = cleanPath.split('/');
        let currentPath = '';
        for (let i = 0; i < parts.length - 1; i++) {
            currentPath += parts[i] + '/';
            try {
                const res = await fetch(`${fullBase}${currentPath}`, {
                    method: 'MKCOL',
                    headers: this.davHeaders()
                });
                if (res.status === 405 || res.status === 409) continue;
            } catch (e) {
                console.warn('MKCOL failed', currentPath, e);
            }
        }
    },

    async writeRawBlob(remotePath, blob, contentType = 'application/octet-stream') {
        if (data.cfg.mode === 's3') {
            return this._s3PutBlob(remotePath, blob, contentType);
        }
        if (data.cfg.mode === 'webdav') {
            await this._ensureWebdavDirs(remotePath);
            const res = await fetch(this.davUrl(remotePath), {
                method: 'PUT',
                headers: this.davHeaders({ 'Content-Type': contentType }),
                body: blob
            });
            if (!res.ok) throw new Error(`WebDAV PUT ${res.status}`);
            return res.headers.get('ETag') || '';
        }
        throw new Error('未配置同步模式');
    },

    async _s3PutBlob(remotePath, blob, contentType = 'application/octet-stream') {
        const { endpoint, region, bucket, key, secret } = data.cfg.s3 || {};
        if (!endpoint || !region || !bucket || !key || !secret) throw new Error('请完整填写 S3 参数');
        const host = new URL(endpoint).host;
        const path = `/${bucket}/${remotePath}`;
        const dt = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
        const date = dt.slice(0, 8);
        const buf = await blob.arrayBuffer();
        const hash = await this.sha256(new Uint8Array(buf));
        const canon = `PUT\n${path}\n\nhost:${host}\nx-amz-content-sha256:${hash}\nx-amz-date:${dt}\n\nhost;x-amz-content-sha256;x-amz-date\n${hash}`;
        const scope = `${date}/${region}/s3/aws4_request`;
        const stringToSign = `AWS4-HMAC-SHA256\n${dt}\n${scope}\n${await this.sha256(canon)}`;
        const kDate = await this.hmac('AWS4' + secret, date);
        const kRegion = await this.hmac(kDate, region);
        const kService = await this.hmac(kRegion, 's3');
        const kSigning = await this.hmac(kService, 'aws4_request');
        const sig = Array.from(new Uint8Array(await this.hmac(kSigning, stringToSign)))
            .map(x => x.toString(16).padStart(2, '0')).join('');

        return fetch(`${endpoint}${path}`, {
            method: 'PUT',
            headers: {
                Authorization: `AWS4-HMAC-SHA256 Credential=${key}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${sig}`,
                'x-amz-date': dt,
                'x-amz-content-sha256': hash,
                'Content-Type': contentType
            },
            body: buf
        });
    },

    remoteEntityMapFromDb(dbObj) {
        const db = dbObj || {};
        const health = db.health || {};
        return {
            actions: db.actions || [],
            routines: db.routines || [],
            history: db.history || [],
            weights: health.weights || [],
            foodLogs: health.foodLogs || [],
            exerciseLogs: health.exerciseLogs || [],
            healthProfile: health.profile && typeof health.profile === 'object' ? [health.profile] : [],
            aiAdviceChat: health.aiAdviceChat || [],
            aiCipher: db.aiCipher ? [db.aiCipher] : []
        };
    },

    remoteEntityMap() {
        return this.remoteEntityMapFromDb(data.db);
    },

    ensureManifestShape(raw) {
        const manifest = raw && typeof raw === 'object' ? raw : {};
        return {
            snapshotTs: Number(manifest.snapshotTs || 0),
            snapshotHash: String(manifest.snapshotHash || ''),
            lastIncrementalTs: Number(manifest.lastIncrementalTs || 0),
            entities: manifest.entities && typeof manifest.entities === 'object' ? manifest.entities : {},
            schemaVersion: Number(manifest.schemaVersion || data.SCHEMA_VERSION || 2)
        };
    },

    incrementalWindowTs(ts = Date.now()) {
        return Math.floor(Number(ts) / this.INCREMENTAL_WINDOW_MS) * this.INCREMENTAL_WINDOW_MS;
    },

    mergeRecordLists(localList, remoteList) {
        const merged = new Map();
        const pure = window.syncPure || {};
        const fieldwiseMerge = typeof pure.mergeRecordsFieldwise === 'function' ? pure.mergeRecordsFieldwise : null;
        (localList || []).forEach(item => {
            if (!item || !item.id) return;
            merged.set(item.id, item);
        });
        (remoteList || []).forEach(item => {
            if (!item || !item.id) return;
            const local = merged.get(item.id);
            if (!local) {
                merged.set(item.id, item);
                return;
            }
            const localTs = Number(local.updatedAt || 0);
            const remoteTs = Number(item.updatedAt || 0);
            if (item.versions || local.versions) {
                merged.set(item.id, mergeAdviceRecord(local, item));
                return;
            }
            if (fieldwiseMerge && Math.abs(remoteTs - localTs) < 60000 && (local.__fieldUpdatedAt || item.__fieldUpdatedAt)) {
                const fieldMerged = fieldwiseMerge(local, item);
                merged.set(item.id, fieldMerged);
                try {
                    const meta = this.getSyncMeta();
                    meta.conflictLog = Array.isArray(meta.conflictLog) ? meta.conflictLog : [];
                    meta.conflictLog.push({
                        id: item.id,
                        entity: '',
                        mergedAt: Date.now(),
                        fields: Object.keys(item.__fieldUpdatedAt || {})
                    });
                    if (meta.conflictLog.length > 50) meta.conflictLog = meta.conflictLog.slice(-50);
                } catch {}
                return;
            }
            if (remoteTs > localTs) merged.set(item.id, item);
        });
        return Array.from(merged.values());
    },

    getEntityRef(dbObj, entity) {
        const db = dbObj || data.db;
        switch (entity) {
            case 'actions':
                return {
                    get: () => db.actions || [],
                    set: (value) => { db.actions = value; }
                };
            case 'routines':
                return {
                    get: () => db.routines || [],
                    set: (value) => { db.routines = value; }
                };
            case 'history':
                return {
                    get: () => db.history || [],
                    set: (value) => { db.history = value; }
                };
            case 'weights':
                return {
                    get: () => (db.health || {}).weights || [],
                    set: (value) => {
                        db.health = db.health || {};
                        db.health.weights = value;
                    }
                };
            case 'foodLogs':
                return {
                    get: () => (db.health || {}).foodLogs || [],
                    set: (value) => {
                        db.health = db.health || {};
                        db.health.foodLogs = value;
                    }
                };
            case 'exerciseLogs':
                return {
                    get: () => (db.health || {}).exerciseLogs || [],
                    set: (value) => {
                        db.health = db.health || {};
                        db.health.exerciseLogs = value;
                    }
                };
            case 'healthProfile':
                return {
                    get: () => {
                        const profile = (db.health || {}).profile;
                        return profile && typeof profile === 'object' ? [profile] : [];
                    },
                    set: (value) => {
                        db.health = db.health || {};
                        const next = (value || []).find(item => item && !item.deleted) || (value || [])[0] || {};
                        db.health.profile = next;
                    }
                };
            case 'aiAdviceChat':
                return {
                    get: () => (db.health || {}).aiAdviceChat || [],
                    set: (value) => {
                        db.health = db.health || {};
                        db.health.aiAdviceChat = value;
                    }
                };
            case 'aiCipher':
                return {
                    get: () => db.aiCipher ? [db.aiCipher] : [],
                    set: (value) => {
                        db.aiCipher = (value || [])[0] || null;
                    }
                };
            default:
                return null;
        }
    },

    mergeEntityRecords(entity, remoteRecords) {
        const ref = this.getEntityRef(data.db, entity);
        if (!ref) return false;
        if (entity === 'aiCipher') {
            const local = ref.get()[0] || null;
            const remote = (remoteRecords || [])[0] || null;
            const meta = this.getSyncMeta();
            const localChangedSinceResolve = Number(local?.updatedAt || 0) > Number(meta.aiCipherLastResolvedAt || 0);
            const remoteChangedSinceResolve = Number(remote?.updatedAt || 0) > Number(meta.aiCipherLastResolvedAt || 0);
            if (local && remote && localChangedSinceResolve && remoteChangedSinceResolve && local.updatedAt !== remote.updatedAt) {
                return this.resolveAiCipherConflict(local, remote).then(chosen => {
                    ref.set(chosen ? [chosen] : []);
                    data.db.encryptedAi = chosen?.payload || null;
                    meta.aiCipherLastResolvedAt = Number(chosen?.updatedAt || Date.now());
                    this.saveSyncMeta();
                    return true;
                });
            }
            const merged = this.mergeRecordLists(ref.get(), remoteRecords || []);
            ref.set(merged);
            data.db.encryptedAi = merged?.[0]?.payload || null;
            meta.aiCipherLastResolvedAt = Number(merged?.[0]?.updatedAt || meta.aiCipherLastResolvedAt || 0);
            this.saveSyncMeta();
            return true;
        }
        const merged = this.mergeRecordLists(ref.get(), remoteRecords || []);
        ref.set(merged);
        return true;
    },

    async applySnapshot(remoteDb) {
        const pure = window.syncPure || {};

        const isWrapped = remoteDb && typeof remoteDb === 'object' && remoteDb.db && !Array.isArray(remoteDb.db);
        if (isWrapped) {
            const payload = remoteDb;
            if (pure.validatePayload) {
                const check = pure.validatePayload(payload, data.SCHEMA_VERSION || 1);
                if (!check.ok && check.code === 'SCHEMA_HIGHER') {
                    if (!confirm(`远端 schemaVersion 高于本地，导入可能导致兼容问题，是否继续？`)) {
                        throw new Error('用户拒绝远端覆盖');
                    }
                } else if (!check.ok) {
                    throw new Error(`远端数据校验失败：${check.reason}`);
                }
            } else if (payload.checksum && typeof payload.checksum === 'string') {
                const dbStr = JSON.stringify(payload.db);
                const recomputed = await this.sha256(dbStr);
                if (recomputed !== payload.checksum) {
                    throw new Error('远端快照校验失败：checksum 不匹配');
                }
            }
            if (payload.itemCounts && typeof payload.itemCounts === 'object') {
                const localDb = data.db;
                const remoteCounts = payload.itemCounts;
                let warns = [];
                if (pure.compareCounts) {
                    warns = pure.compareCounts(remoteCounts, localDb, 0.5);
                } else {
                    const map = {
                        actions:  () => localDb?.actions?.length || 0,
                        routines: () => localDb?.routines?.length || 0,
                        history:  () => localDb?.history?.length || 0,
                        food:     () => localDb?.health?.foodLogs?.length || 0,
                        exercise: () => localDb?.health?.exerciseLogs?.length || 0,
                        weight:   () => localDb?.health?.weights?.length || 0
                    };
                    for (const k of Object.keys(remoteCounts)) {
                        const r = Number(remoteCounts[k] || 0);
                        const lFn = map[k];
                        if (!lFn) continue;
                        const l = lFn();
                        if (l > 0 && r < l * 0.5) warns.push({ entity: k, remote: r, local: l });
                    }
                }
                for (const w of warns) {
                    if (!confirm(`远端 ${w.entity} 数量(${w.remote})远小于本地(${w.local})，继续覆盖可能导致数据丢失，是否继续？`)) {
                        throw new Error('用户拒绝远端覆盖');
                    }
                }
            }
            remoteDb = payload.db;
        }

        const remoteSchema = Number(remoteDb?.schemaVersion || 0);
        const localSchema = Number(data.SCHEMA_VERSION || 1);
        if (remoteSchema > 0 && remoteSchema < localSchema) {
            const gap = localSchema - remoteSchema;
            if (gap > 2) {
                if (!confirm(`远端数据版本过低(v${remoteSchema})，本地为 v${localSchema}，跨度较大可能导致兼容问题，是否继续覆盖？`)) {
                    throw new Error('用户拒绝远端覆盖');
                }
                try {
                    if (window.backup && typeof backup.buildArchive === 'function') {
                        const { blob, filename } = await backup.buildArchive();
                        await backup.snapshotToRing(blob, filename, 'pre-downgrade');
                    }
                } catch {}
            }
            if (window.storageMigrate?.runMigrations) {
                remoteDb = window.storageMigrate.runMigrations(remoteDb, remoteSchema, localSchema);
            }
        }

        try {
            if (window.backup && typeof backup.buildArchive === 'function') {
                const { blob, filename } = await backup.buildArchive();
                await backup.snapshotToRing(blob, filename, 'pre-pull');
            }
        } catch (e) {
            console.warn('pre-pull snapshot failed', e);
        }

        const localBefore = JSON.parse(JSON.stringify(data.db));
        data.db = remoteDb || {};
        data.normalizeDb();
        const entities = Object.keys(this.remoteEntityMap());
        entities.forEach(entity => {
            const localRef = this.getEntityRef(localBefore, entity);
            const remoteRef = this.getEntityRef(data.db, entity);
            if (!localRef || !remoteRef) return;
            remoteRef.set(this.mergeRecordLists(localRef.get(), remoteRef.get()));
        });
        data.normalizeDb();
    },

    async s3Req(method, remotePath, body = null, extraHeaders = {}) {
        const { endpoint, region, bucket, key, secret } = data.cfg.s3 || {};
        if (!endpoint || !region || !bucket || !key || !secret) throw new Error('请完整填写 S3 参数');
        const host = new URL(endpoint).host;
        const path = `/${bucket}/${remotePath}`;
        const dt = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
        const date = dt.slice(0, 8);
        const hash = body
            ? await this.sha256(body)
            : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
        const canon = `${method}\n${path}\n\nhost:${host}\nx-amz-content-sha256:${hash}\nx-amz-date:${dt}\n\nhost;x-amz-content-sha256;x-amz-date\n${hash}`;
        const scope = `${date}/${region}/s3/aws4_request`;
        const stringToSign = `AWS4-HMAC-SHA256\n${dt}\n${scope}\n${await this.sha256(canon)}`;
        const kDate = await this.hmac('AWS4' + secret, date);
        const kRegion = await this.hmac(kDate, region);
        const kService = await this.hmac(kRegion, 's3');
        const kSigning = await this.hmac(kService, 'aws4_request');
        const sig = Array.from(new Uint8Array(await this.hmac(kSigning, stringToSign)))
            .map(x => x.toString(16).padStart(2, '0')).join('');

        return fetch(`${endpoint}${path}`, {
            method,
            headers: {
                Authorization: `AWS4-HMAC-SHA256 Credential=${key}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${sig}`,
                'x-amz-date': dt,
                'x-amz-content-sha256': hash,
                'Content-Type': 'application/json',
                ...extraHeaders
            },
            body
        });
    },

    davRoot() {
        const cfg = data.cfg.dav || {};
        const raw = String(cfg.path || '').trim().replace(/^\/+|\/+$/g, '');
        if (!raw) return '';
        if (/\.json$/i.test(raw)) {
            const pos = raw.lastIndexOf('/');
            return pos >= 0 ? raw.slice(0, pos) : '';
        }
        return raw;
    },

    davUrl(remotePath) {
        const cfg = data.cfg.dav || {};
        const base = (cfg.url || '').trim().replace(/\/+$/, '');
        if (!base) throw new Error('请填写 WebDAV 地址');
        const root = this.davRoot();
        const cleanPath = String(remotePath || '').replace(/^\/+/, '');
        return `${base}/${root ? `${root}/` : ''}${cleanPath}`;
    },

    basicAuth(user, pass) {
        const bytes = new TextEncoder().encode(`${user || ''}:${pass || ''}`);
        let binary = '';
        bytes.forEach(b => { binary += String.fromCharCode(b); });
        return btoa(binary);
    },

    davHeaders(extraHeaders = {}) {
        const { user, pass } = data.cfg.dav || {};
        const headers = { 'Content-Type': 'application/json', ...extraHeaders };
        if (user || pass) headers.Authorization = `Basic ${this.basicAuth(user, pass)}`;
        return headers;
    },

    async davReq(method, remotePath, body = null, extraHeaders = {}) {
        return fetch(this.davUrl(remotePath), {
            method,
            headers: this.davHeaders(extraHeaders),
            body
        });
    },

    async syncReq(method, remotePath, body = null, extraHeaders = {}) {
        if (data.cfg.mode === 's3') return this.s3Req(method, remotePath, body, extraHeaders);
        if (data.cfg.mode === 'webdav') return this.davReq(method, remotePath, body, extraHeaders);
        throw new Error('请先选择并保存同步方式');
    },

    async fetchJson(remotePath, allow404 = false) {
        const res = await this.syncReq('GET', remotePath);
        if (res.status === 404 && allow404) return { data: null, etag: '' };
        if (!res.ok) throw new Error(`远端读取失败(${remotePath}): ${res.status}`);
        const etag = res.headers.get('ETag') || '';
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        const meta = this.getSyncMeta();
        meta.etags[remotePath] = etag;
        this.saveSyncMeta();
        return { data, etag };
    },

    queueRetry(item, reason) {
        const meta = this.getSyncMeta();
        const queue = meta.pendingQueue || [];
        queue.push({
            ...item,
            reason: reason || 'unknown',
            queuedAt: Date.now(),
            attempts: Number(item.attempts || 0) + 1
        });
        meta.pendingQueue = queue;
        this.saveSyncMeta();
    },

    async delay(ms) {
        await new Promise(resolve => setTimeout(resolve, ms));
    },

    async withRetry(fn, opts = {}) {
        const retries = Number(opts.retries ?? this.RETRY_DEFAULTS.retries);
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                if (!isRetryableError(error) || attempt >= retries) throw error;
                this.setStatus('syncing', `重试中… (${attempt}/${retries})`);
                await this.delay(computeRetryDelay(attempt, opts));
            }
        }
    },

    async writeJson(remotePath, payload, etagKey = remotePath) {
        const body = JSON.stringify(payload);
        let extraHeaders = {};
        const meta = this.getSyncMeta();
        const ifMatch = data.cfg.mode === 'webdav' ? (meta.etags[etagKey] || '') : '';
        if (ifMatch) extraHeaders['If-Match'] = ifMatch;
        const res = await this.syncReq('PUT', remotePath, body, extraHeaders);
        if (res.status === 412) {
            this.queueRetry({ remotePath, payload, etagKey }, 'etag_conflict');
            throw new Error(`写入冲突(${remotePath})，已加入重试队列`);
        }
        if (!res.ok) throw new Error(`远端写入失败(${remotePath}): ${res.status}`);
        const etag = res.headers.get('ETag') || '';
        meta.etags[etagKey] = etag;
        this.saveSyncMeta();
        return etag;
    },

    async processRetryQueue() {
        const meta = this.getSyncMeta();
        const queue = meta.pendingQueue || [];
        if (!queue.length) return;
        const limit = 20;
        const batch = queue.slice(0, limit);
        const tail = queue.slice(limit);
        const remain = [];
        for (let i = 0; i < batch.length; i++) {
            const item = batch[i];
            try {
                await this.withRetry(() => this.writeJson(item.remotePath, item.payload, item.etagKey || item.remotePath));
            } catch (e) {
                remain.push({ ...item, reason: e.message || item.reason, attempts: Number(item.attempts || 0) + 1 });
                // stop the batch on first failure
                meta.pendingQueue = remain.concat(batch.slice(i + 1)).concat(tail);
                this.saveSyncMeta();
                return;
            }
        }
        meta.pendingQueue = tail;
        this.saveSyncMeta();
    },

    diffChangesSince(ts) {
        const changes = {};
        const entities = this.remoteEntityMap();
        Object.keys(entities).forEach(entity => {
            changes[entity] = (entities[entity] || []).filter(item => Number(item.updatedAt || 0) > Number(ts || 0));
        });
        return changes;
    },

    manifestIncrementalCount(manifest) {
        const entities = manifest.entities || {};
        return Object.values(entities).reduce((sum, meta) => sum + Number(meta?.count || 0), 0);
    },

    async fullBackup(options = {}) {
        await data.flush();
        this.setStatus('syncing', options.quiet ? '正在重建快照' : '正在上传全量快照');
        const snapshotTs = Date.now();
        const snapshotBody = JSON.stringify(data.db);
        const snapshotHash = await this.sha256(snapshotBody);
        await this.withRetry(() => this.writeJson(this.REMOTE_SNAPSHOT, data.db, this.REMOTE_SNAPSHOT));
        const manifest = this.ensureManifestShape(options.baseManifest || null);
        manifest.snapshotTs = snapshotTs;
        manifest.snapshotHash = snapshotHash;
        manifest.lastIncrementalTs = snapshotTs;
        manifest.schemaVersion = Number(data.SCHEMA_VERSION || manifest.schemaVersion || 2);
        manifest.entities = Object.keys(this.remoteEntityMap()).reduce((acc, entity) => {
            acc[entity] = { lastTs: snapshotTs, count: 0, windows: [] };
            return acc;
        }, {});
        await this.withRetry(() => this.writeJson(this.REMOTE_MANIFEST, manifest, this.REMOTE_MANIFEST));
        const meta = this.getSyncMeta();
        meta.lastSyncAt = snapshotTs;
        meta.lastIncrementalTs = snapshotTs;
        this.saveSyncMeta();
        await this.processRetryQueue();
        this.setStatus('cloud', options.quiet ? '快照重建完成' : '全量备份完成');
    },

    async pushChanges() {
        try {
            await data.flush();
            this.setStatus('syncing', '正在上传增量变更');
            const remoteManifest = this.ensureManifestShape((await this.fetchJson(this.REMOTE_MANIFEST, true)).data);
            const localMeta = this.getSyncMeta();
            const sinceTs = Math.max(Number(localMeta.lastIncrementalTs || 0), Number(remoteManifest.lastIncrementalTs || 0));
            const changes = this.diffChangesSince(sinceTs);
            const changedEntities = Object.keys(changes).filter(entity => (changes[entity] || []).length > 0);
            if (!changedEntities.length) {
                this.setStatus('cloud', '没有待上传的增量变更');
                return;
            }

            const ts = this.incrementalWindowTs(Date.now());
            for (let i = 0; i < changedEntities.length; i++) {
                const entity = changedEntities[i];
                const payload = { ts, entity, records: changes[entity] };
                await this.withRetry(() => this.writeJson(`${this.REMOTE_INCREMENTAL_DIR}/${entity}/${ts}.json`, payload, `${this.REMOTE_INCREMENTAL_DIR}/${entity}/${ts}.json`));
                const entityMeta = remoteManifest.entities[entity] || { lastTs: 0, count: 0, windows: [] };
                entityMeta.lastTs = Math.max(Number(entityMeta.lastTs || 0), ts);
                entityMeta.windows = Array.from(new Set([...(entityMeta.windows || []), ts])).sort((a, b) => a - b);
                entityMeta.count = Number(entityMeta.windows.length);
                remoteManifest.entities[entity] = entityMeta;
            }
            remoteManifest.lastIncrementalTs = Math.max(Number(remoteManifest.lastIncrementalTs || 0), ts);
            remoteManifest.schemaVersion = Number(data.SCHEMA_VERSION || remoteManifest.schemaVersion || 2);
            await this.withRetry(() => this.writeJson(this.REMOTE_MANIFEST, remoteManifest, this.REMOTE_MANIFEST));

            localMeta.lastSyncAt = Date.now();
            localMeta.lastIncrementalTs = Number(remoteManifest.lastIncrementalTs || ts);
            this.saveSyncMeta();

            if (this.manifestIncrementalCount(remoteManifest) >= this.COMPACTION_THRESHOLD) {
                await this.fullBackup({ quiet: true, baseManifest: remoteManifest });
                return;
            }

            await this.processRetryQueue();

            try {
                const today = new Date();
                const ymd = today.toISOString().slice(0, 10);
                const meta2 = this.getSyncMeta();
                if (meta2.lastArchiveDate !== ymd) {
                    const { blob, filename, checksum } = await backup.buildArchive();
                    const yyyy = ymd.slice(0, 4), mm = ymd.slice(5, 7), dd = ymd.slice(8, 10);
                    const remotePath = `backup/${yyyy}/${mm}/${dd}/${filename}`;
                    await this.withRetry(() => this.writeRawBlob(remotePath, blob, 'application/gzip'));
                    meta2.lastArchiveDate = ymd;
                    meta2.lastArchiveChecksum = checksum;
                    this.saveSyncMeta();
                }
            } catch (e) {
                console.warn('daily archive failed', e);
            }

            this.setStatus('cloud', `增量上传完成（${changedEntities.length} 个实体）`);
        } catch (e) {
            this.setStatus('error', `增量上传失败: ${e.message}`);
            alert(`增量上传失败: ${e.message}`);
        }
    },

    async pullChanges() {
        try {
            await data.flush();
            this.setStatus('syncing', '正在拉取远端变更');
            const snapshotRes = await this.withRetry(() => this.fetchJson(this.REMOTE_SNAPSHOT, true));
            if (snapshotRes.data) {
                if (typeof snapshotRes.data === 'object' && Object.keys(snapshotRes.data).length === 0) {
                    console.warn('远端快照为空对象，跳过覆盖');
                } else {
                    await this.applySnapshot(snapshotRes.data);
                }
            }
            const manifest = this.ensureManifestShape((await this.withRetry(() => this.fetchJson(this.REMOTE_MANIFEST, true))).data);
            const meta = this.getSyncMeta();
            const startTs = Math.max(Number(meta.lastIncrementalTs || 0), Number(manifest.snapshotTs || 0));

            const replayTasks = [];
            Object.keys(manifest.entities || {}).forEach(entity => {
                const windows = (manifest.entities[entity] && manifest.entities[entity].windows) || [];
                windows
                    .filter(ts => Number(ts) > startTs)
                    .sort((a, b) => a - b)
                    .forEach(ts => replayTasks.push({ entity, ts: Number(ts) }));
            });
            replayTasks.sort((a, b) => a.ts - b.ts || a.entity.localeCompare(b.entity));

            for (let i = 0; i < replayTasks.length; i++) {
                const task = replayTasks[i];
                const remotePath = `${this.REMOTE_INCREMENTAL_DIR}/${task.entity}/${task.ts}.json`;
                const inc = await this.withRetry(() => this.fetchJson(remotePath, true));
                const records = inc.data && Array.isArray(inc.data.records) ? inc.data.records : [];
                await this.mergeEntityRecords(task.entity, records);
            }

            data.normalizeDb();
            data.save({ render: false });
            await data.flush();
            if (typeof ai !== 'undefined') await ai.init({ saveData: true, renderData: false });
            data.render();

            meta.lastSyncAt = Date.now();
            meta.lastIncrementalTs = Math.max(Number(meta.lastIncrementalTs || 0), Number(manifest.lastIncrementalTs || 0));
            this.saveSyncMeta();
            await this.processRetryQueue();
            this.setStatus('cloud', '拉取完成');
        } catch (e) {
            this.setStatus('error', `拉取失败: ${e.message}`);
            alert(`拉取失败: ${e.message}`);
        }
    },

    async verifyRemote() {
        if (data.cfg.mode === 'none') return { ok: false, reason: '未配置同步' };
        const res = await this.fetchJson(this.REMOTE_SNAPSHOT, true);
        if (!res.data) return { ok: false, reason: '远端无快照' };
        const localStr = JSON.stringify(res.data);
        const hash = await this.sha256(localStr);
        return { ok: true, hash, size: localStr.length, snapshotTs: Date.now() };
    },

    async fullRestore() {
        await this.pullChanges();
    },

    async push() {
        await this.pushChanges();
    },

    async pull() {
        await this.fullRestore();
    },

    async autoBackup(reason = 'auto') {
        if (data.cfg.mode === 'none') return;
        if (data.cfg.mode === 's3') {
            const { endpoint, region, bucket, key, secret } = data.cfg.s3 || {};
            if (!endpoint || !region || !bucket || !key || !secret) return;
        }
        if (data.cfg.mode === 'webdav') {
            const { url } = data.cfg.dav || {};
            if (!url) return;
        }
        try {
            await this.pushChanges();
        } catch (e) {
            console.warn('Auto incremental backup failed', reason, e);
        }
    },

    async flushQueue() {
        await this.processRetryQueue();
    },

    saveConfig() {
        data.cfg.mode = document.getElementById('syncMode').value;
        data.cfg.s3 = {
            endpoint: document.getElementById('s3Endpoint').value,
            region: document.getElementById('s3Region').value || 'us-east-1',
            bucket: document.getElementById('s3Bucket').value,
            key: document.getElementById('s3Key').value,
            secret: document.getElementById('s3Secret').value
        };
        data.cfg.dav = {
            url: document.getElementById('davUrl').value,
            user: document.getElementById('davUser').value,
            pass: document.getElementById('davPass').value,
            path: document.getElementById('davPath').value || 'training_assistant_data.json'
        };
        if (typeof data.persistCfg === 'function') data.persistCfg();
        this.setStatus(data.cfg.mode === 'none' ? 'local' : 'cloud', data.cfg.mode === 'none' ? '当前仅保存本地数据' : '同步配置已本地保存');
        alert('配置已本地保存');
    },

    setStatus(state, detail = '') {
        const el = document.getElementById('syncStatus');
        if (!el) return;
        const map = {
            local: ['cloud_off', '本地'],
            syncing: ['sync', '同步中'],
            cloud: ['cloud_done', '云端'],
            error: ['cloud_alert', '同步失败']
        };
        const pair = map[state] || map.local;
        const icon = pair[0];
        const label = pair[1];
        el.innerHTML = `<span class="material-symbols-rounded" style="font-size:14px">${icon}</span> ${label}`;
        el.dataset.state = state;
        el.dataset.detail = detail;
    },

    toggleFields(m) {
        document.getElementById('s3Fields').classList.toggle('hidden', m !== 's3');
        document.getElementById('webdavFields').classList.toggle('hidden', m !== 'webdav');
    },

    initUI() {
        data.cfg.s3 = data.cfg.s3 || {};
        data.cfg.dav = data.cfg.dav || {};
        document.getElementById('s3Endpoint').value = data.cfg.s3.endpoint || '';
        document.getElementById('s3Region').value = data.cfg.s3.region || 'us-east-1';
        document.getElementById('s3Bucket').value = data.cfg.s3.bucket || '';
        document.getElementById('s3Key').value = data.cfg.s3.key || '';
        document.getElementById('s3Secret').value = data.cfg.s3.secret || '';
        document.getElementById('davUrl').value = data.cfg.dav.url || '';
        document.getElementById('davUser').value = data.cfg.dav.user || '';
        document.getElementById('davPass').value = data.cfg.dav.pass || '';
        document.getElementById('davPath').value = data.cfg.dav.path || 'training_assistant_data.json';
        const mode = data.cfg.mode || 'none';
        document.getElementById('syncMode').value = mode;
        this.toggleFields(mode);
        this.setStatus(mode === 'none' ? 'local' : 'cloud');
        if (!this.__onlineBound) {
            this.__onlineBound = true;
            window.addEventListener('online', () => this.processRetryQueue());
            window.addEventListener('offline', () => this.setStatus('local', '网络离线'));
        }
    }
};

if (typeof window !== 'undefined') window.sync = sync;
