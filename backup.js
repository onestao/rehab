// @ts-nocheck

async function sha256Hex(str) {
    const buf = new TextEncoder().encode(str);
    if (!globalThis.crypto?.subtle?.digest) return sha256HexFallback(buf);
    const h = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function sha256HexFallback(bytes) {
    const k = [
        0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
        0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
        0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
        0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
        0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
        0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
        0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
        0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];
    const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const msg = [...bytes, 0x80];
    while ((msg.length % 64) !== 56) msg.push(0);
    const bitLen = bytes.length * 8;
    const high = Math.floor(bitLen / 0x100000000);
    const low = bitLen >>> 0;
    msg.push((high >>> 24) & 255, (high >>> 16) & 255, (high >>> 8) & 255, high & 255);
    msg.push((low >>> 24) & 255, (low >>> 16) & 255, (low >>> 8) & 255, low & 255);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    const w = new Array(64);
    for (let i = 0; i < msg.length; i += 64) {
        for (let t = 0; t < 16; t++) {
            const j = i + t * 4;
            w[t] = ((msg[j] << 24) | (msg[j + 1] << 16) | (msg[j + 2] << 8) | msg[j + 3]) >>> 0;
        }
        for (let t = 16; t < 64; t++) {
            const s0 = (rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3)) >>> 0;
            const s1 = (rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10)) >>> 0;
            w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
        }
        let [a, b, c, d, e, f, g, hh] = h;
        for (let t = 0; t < 64; t++) {
            const s1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
            const ch = ((e & f) ^ (~e & g)) >>> 0;
            const temp1 = (hh + s1 + ch + k[t] + w[t]) >>> 0;
            const s0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
            const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
            const temp2 = (s0 + maj) >>> 0;
            hh = g; g = f; f = e; e = (d + temp1) >>> 0;
            d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
        }
        h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
        h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }
    return h.map(v => v.toString(16).padStart(8, '0')).join('');
}

async function gzipBlob(text) {
    const blob = await new Response(
        new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
    ).blob();
    return new Blob([blob], { type: 'application/gzip' });
}

async function ungzipText(blob) {
    if (typeof DecompressionStream !== 'function') {
        throw new Error('当前浏览器不支持解压 .gz 备份，请升级 Chrome 或导入未压缩 .json 备份');
    }
    return await new Response(
        blob.stream().pipeThrough(new DecompressionStream('gzip'))
    ).text();
}

function isGzipBackupFile(file, bytes) {
    const name = String(file?.name || '').toLowerCase();
    const type = String(file?.type || '').toLowerCase();
    return name.endsWith('.gz')
        || name.endsWith('.gzip')
        || type === 'application/gzip'
        || type === 'application/x-gzip'
        || type === 'application/gzip-compressed'
        || type === 'application/octet-stream+gzip'
        || type.includes('gzip')
        || (!!bytes && bytes[0] === 0x1f && bytes[1] === 0x8b);
}

async function readBackupFileText(file) {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf.slice(0, 2));
    if (isGzipBackupFile(file, bytes)) {
        return await ungzipText(new Blob([buf], { type: file.type || 'application/gzip' }));
    }
    return new TextDecoder().decode(buf);
}

function backupCounts(dbObj = {}) {
    const health = dbObj.health || {};
    return {
        actions: dbObj.actions?.length || 0,
        routines: dbObj.routines?.length || 0,
        history: dbObj.history?.length || 0,
        dailyPlans: dbObj.dailyPlans?.length || 0,
        food: health.foodLogs?.length || 0,
        exercise: health.exerciseLogs?.length || 0,
        weight: health.weights?.length || 0,
        rehabWeekly: health.rehabWeekly?.length || 0,
        advice: health.aiAdviceChat?.length || 0
    };
}

function backupPreviewText(label, dbObj, meta = {}) {
    const counts = backupCounts(dbObj);
    return `${label}\n\n` + [
        `导出时间：${meta.exportedAt ? new Date(meta.exportedAt).toLocaleString() : '未知'}`,
        `schemaVersion：${meta.schemaVersion || dbObj?.schemaVersion || '未知'}`,
        `动作：${counts.actions}`,
        `方案：${counts.routines}`,
        `训练记录：${counts.history}`,
        `每日计划：${counts.dailyPlans}`,
        `饮食：${counts.food}`,
        `手动运动：${counts.exercise}`,
        `体重：${counts.weight}`,
        `康复周处方：${counts.rehabWeekly}`,
        `AI 对话：${counts.advice}`,
        meta.checksum ? `checksum：${String(meta.checksum).slice(0, 16)}...` : ''
    ].filter(Boolean).join('\n');
}

const backup = {
    async buildArchive() {
        const started = Date.now();
        window.errorBus?.event?.('backup', 'build:start');
        if (typeof data.flush === 'function') await data.flush();
        if (!data.db || typeof data.db !== 'object') {
            throw new Error('数据为空，无法构建归档');
        }
        let dbToExport = data.db;
        if (window.adviceCollections) {
            try {
                const allAdvice = await window.adviceCollections.getAll();
                if (allAdvice && allAdvice.length > 0) {
                    dbToExport = Object.assign({}, data.db, {
                        health: Object.assign({}, data.db.health || {}, {
                            aiAdviceChat: allAdvice
                        })
                    });
                }
            } catch (err) {
                console.warn('[backup] failed to get full advice for export', err);
            }
        }

        const dbStr = JSON.stringify(dbToExport);
        const sizeMB = dbStr.length / (1024 * 1024);
        if (sizeMB > 8) console.warn('[backup] db over 8MB, consider purge');
        const checksum = await sha256Hex(dbStr);
        await new Promise(r => {
            if (typeof requestIdleCallback === 'function') requestIdleCallback(r);
            else setTimeout(r, 0);
        });
        const payload = {
            app: '训练助手',
            exportedAt: new Date().toISOString(),
            schemaVersion: dbToExport.schemaVersion || data.SCHEMA_VERSION || 1,
            itemCounts: {
                actions: dbToExport.actions?.length || 0,
                routines: dbToExport.routines?.length || 0,
                history: dbToExport.history?.length || 0,
                dailyPlans: dbToExport.dailyPlans?.length || 0,
                food: dbToExport.health?.foodLogs?.length || 0,
                exercise: dbToExport.health?.exerciseLogs?.length || 0,
                weight: dbToExport.health?.weights?.length || 0,
                advice: dbToExport.health?.aiAdviceChat?.length || 0
            },
            checksum,
            db: dbToExport
        };
        const jsonStr = JSON.stringify(payload);
        const blob = await gzipBlob(jsonStr);
        const ts = new Date().toISOString().replace(/[:\-\.]/g, '').slice(0, 19);
        const filename = `rehab-${ts}-${checksum.slice(0, 8)}.json.gz`;
        window.errorBus?.event?.('backup', 'build:success', {
            elapsedMs: Date.now() - started,
            blobBytes: blob.size || 0,
            jsonBytes: jsonStr.length,
            checksumPrefix: checksum.slice(0, 8),
            itemCounts: payload.itemCounts
        });
        return { blob, filename, checksum, payload };
    },

    async snapshotToRing(blob, filename, source) {
        const started = Date.now();
        window.errorBus?.event?.('backup', 'ring:start', { source, blobBytes: blob?.size || 0 });
        const MAX_RING_COUNT = 10;
        const MAX_RING_BYTES = 50 * 1024 * 1024;
        const CRITICAL_SOURCES = new Set(['pre-pull', 'pre-import']);

        if (navigator.storage?.persist) {
            navigator.storage.persist().catch(() => {});
        }

        return new Promise((resolve, reject) => {
            const req = indexedDB.open('rehab_backup_ring', 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('snapshots')) {
                    const store = db.createObjectStore('snapshots', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };
            req.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction('snapshots', 'readwrite');
                const store = tx.objectStore('snapshots');
                store.add({
                    createdAt: Date.now(),
                    source: source || 'manual',
                    filename: filename || '',
                    size: blob?.size || 0,
                    checksum: '',
                    blob
                });
                tx.oncomplete = () => {
                    const doPrune = async () => {
                        let totalBytes = 0;
                        const allItems = await new Promise((res, rej) => {
                            const readTx = db.transaction('snapshots', 'readonly');
                            const readStore = readTx.objectStore('snapshots');
                            const r = readStore.getAll();
                            r.onsuccess = () => res(r.result || []);
                            r.onerror = () => rej(r.error);
                        });

                        let quotaLow = false;
                        if (navigator.storage?.estimate) {
                            try {
                                const est = await navigator.storage.estimate();
                                if (est.quota && est.usage > est.quota * 0.9) quotaLow = true;
                            } catch {}
                        }

                        const targetCount = quotaLow ? 3 : MAX_RING_COUNT;
                        allItems.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

                        const toDelete = [];
                        const keptSources = new Set();

                        for (const item of allItems) {
                            if (toDelete.length >= allItems.length - targetCount) {
                                toDelete.push(item);
                                continue;
                            }
                            totalBytes += item.size || 0;
                            if (totalBytes > MAX_RING_BYTES && toDelete.length < allItems.length - 3) {
                                toDelete.push(item);
                                continue;
                            }
                            if (CRITICAL_SOURCES.has(item.source)) {
                                keptSources.add(item.source);
                            }
                        }

                        const protectedItems = [];
                        const deletable = [];
                        for (const item of toDelete) {
                            if (CRITICAL_SOURCES.has(item.source) && !keptSources.has(item.source)) {
                                keptSources.add(item.source);
                                protectedItems.push(item);
                            } else {
                                deletable.push(item);
                            }
                        }

                        const finalDelete = [...protectedItems.length ? [] : toDelete.filter(i => !CRITICAL_SOURCES.has(i.source)), ...deletable];

                        if (finalDelete.length > 0) {
                            const delTx = db.transaction('snapshots', 'readwrite');
                            const delStore = delTx.objectStore('snapshots');
                            for (const item of finalDelete) {
                                delStore.delete(item.id);
                            }
                            await new Promise((res, rej) => {
                                delTx.oncomplete = () => res();
                                delTx.onerror = () => rej(delTx.error);
                            });
                        }
                        db.close();
                    };

                    doPrune().then(() => {
                        window.errorBus?.event?.('backup', 'ring:success', { source, elapsedMs: Date.now() - started, blobBytes: blob?.size || 0 });
                        resolve();
                    }).catch((err) => {
                        window.errorBus?.event?.('backup', 'ring:pruneFailed', { source, elapsedMs: Date.now() - started, error: err });
                        db.close(); resolve();
                    });
                };
                tx.onerror = () => { window.errorBus?.event?.('backup', 'ring:failed', { source, elapsedMs: Date.now() - started, error: tx.error }); db.close(); reject(tx.error); };
            };
            req.onerror = () => { window.errorBus?.event?.('backup', 'ring:failed', { source, elapsedMs: Date.now() - started, error: req.error }); reject(req.error); };
        });
    },

    async listRingSnapshots() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('rehab_backup_ring', 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('snapshots')) {
                    const store = db.createObjectStore('snapshots', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };
            req.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction('snapshots', 'readonly');
                const store = tx.objectStore('snapshots');
                const allReq = store.getAll();
                allReq.onsuccess = () => {
                    db.close();
                    const items = (allReq.result || [])
                        .map(r => ({
                            id: r.id,
                            createdAt: r.createdAt,
                            source: r.source,
                            filename: r.filename,
                            size: r.size,
                            checksum: r.checksum
                        }))
                        .sort((a, b) => b.createdAt - a.createdAt);
                    resolve(items);
                };
                allReq.onerror = () => { db.close(); reject(allReq.error); };
            };
            req.onerror = () => reject(req.error);
        });
    },

    async restoreFromRing(id) {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('rehab_backup_ring', 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('snapshots')) {
                    const store = db.createObjectStore('snapshots', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };
            req.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction('snapshots', 'readonly');
                const store = tx.objectStore('snapshots');
                const getReq = store.get(id);
                getReq.onsuccess = async () => {
                    db.close();
                    const record = getReq.result;
                    if (!record || !record.blob) {
                        reject(new Error('快照不存在'));
                        return;
                    }
                    try {
                        const text = await ungzipText(record.blob);
                        const json = JSON.parse(text);
                        const nextDb = json.db || json;
                        if (!nextDb || typeof nextDb !== 'object') {
                            throw new Error('快照数据格式无效');
                        }
                        data.db = nextDb;
                        if (window.storageMigrate?.migrateAdviceToVersioned) {
                            data.db = window.storageMigrate.migrateAdviceToVersioned(data.db);
                        }
                        if (window.adviceCollections && Array.isArray(data.db.health?.aiAdviceChat)) {
                            await window.adviceCollections.clear();
                            await window.adviceCollections.putMany(data.db.health.aiAdviceChat);
                            if (data.db.health.aiAdviceChat.length > 50) {
                                data.db.health.aiAdviceChat = data.db.health.aiAdviceChat.slice(-50);
                            }
                        }
                        data.normalizeDb();
                        if (typeof data._initAdviceApi === 'function') {
                            await data._initAdviceApi();
                        }
                        data.save({ render: false });
                        await data.flush();
                        data.render();
                        resolve(true);
                    } catch (err) {
                        reject(err);
                    }
                };
                getReq.onerror = () => { db.close(); reject(getReq.error); };
            };
            req.onerror = () => reject(req.error);
        });
    },

    async exportData() {
        const started = Date.now();
        window.errorBus?.event?.('backup', 'export:start');
        try {
            const { blob, filename } = await this.buildArchive();
            await this.snapshotToRing(blob, filename, 'manual');
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            window.errorBus?.event?.('backup', 'export:success', { elapsedMs: Date.now() - started, blobBytes: blob.size || 0 });
        } catch (e) {
            window.errorBus?.event?.('backup', 'export:failed', { elapsedMs: Date.now() - started, error: e });
            alert('导出备份失败: ' + e.message);
        }
    },

    async previewCurrentData() {
        try {
            if (typeof data.flush === 'function') await data.flush();
            alert(backupPreviewText('当前本地数据预览', data.db, {
                exportedAt: new Date().toISOString(),
                schemaVersion: data.db.schemaVersion || data.SCHEMA_VERSION || 1
            }));
        } catch (e) {
            alert('预览失败: ' + e.message);
        }
    },

    async exportCSV(kind) {
        if (typeof data.flush === 'function') await data.flush();
        let rows = [];
        if (kind === 'food') {
            rows.push(['date','meal','name','grams','cal','pro','carb','fat']);
            (data.db.health.foodLogs||[]).forEach(f =>
                rows.push([f.date,f.meal,f.name,f.grams,f.cal,f.pro,f.carb,f.fat]));
        } else if (kind === 'exercise') {
            rows.push(['date','type','name','minutes','calories','distance','weightKg','sets','reps']);
            (data.db.health.exerciseLogs||[]).forEach(e =>
                rows.push([e.date,e.type,e.customName||'',e.minutes,e.calories,e.distance||0,
                           e.weightKg||'',e.sets||'',e.repsPerSet||'']));
        }
        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${kind}-${data.logicalDateKey()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    promptImport() {
        if (window.workout?.isPlaying) return alert('训练进行中无法导入备份');
        document.getElementById('backupImportInput')?.click();
    },

    async importFile(event) {
        const file = event?.target?.files?.[0];
        if (!file) return;
        const started = Date.now();
        window.errorBus?.event?.('backup', 'import:start', { fileBytes: file.size || 0, fileType: file.type || '' });
        try {
            await this.buildArchive().then(({ blob, filename }) =>
                this.snapshotToRing(blob, filename, 'pre-import')
            ).catch(e => console.warn('pre-import snapshot failed', e));

            const text = await readBackupFileText(file);

            const json = JSON.parse(text);
            const nextDb = json?.db && typeof json.db === 'object' ? json.db : json;
            if (!nextDb || typeof nextDb !== 'object') throw new Error('文件格式不正确');

            const preview = backupPreviewText(`即将导入：${file.name || '备份文件'}`, nextDb, json || {});
            if (!confirm(`${preview}\n\n导入前已自动创建本地回滚快照。是否继续？`)) return;

            if (json.checksum && typeof json.checksum === 'string') {
                const nextDbStr = JSON.stringify(nextDb);
                const recomputed = await sha256Hex(nextDbStr);
                if (recomputed !== json.checksum) {
                    throw new Error('备份文件校验失败：checksum 不匹配');
                }
            }

            if (json.schemaVersion && json.schemaVersion > (data.SCHEMA_VERSION || 1)) {
                if (!confirm(`备份文件 schemaVersion(${json.schemaVersion}) 高于本地(${data.SCHEMA_VERSION || 1})，导入可能导致兼容问题，是否继续？`)) {
                    return;
                }
            }

            if (json.itemCounts && typeof json.itemCounts === 'object') {
                const localCounts = {
                    actions: data.db.actions?.length || 0,
                    routines: data.db.routines?.length || 0,
                    history: data.db.history?.length || 0,
                    food: data.db.health?.foodLogs?.length || 0,
                    exercise: data.db.health?.exerciseLogs?.length || 0,
                    weight: data.db.health?.weights?.length || 0
                };
                for (const [k, v] of Object.entries(json.itemCounts)) {
                    const local = localCounts[k] || 0;
                    if (local > 0 && Number(v || 0) < local * 0.5) {
                        if (!confirm(`远端 ${k} 数量(${v})远小于本地(${local})，导入后将丢失大量数据，是否继续？`)) {
                            return;
                        }
                    }
                }
            }

            if (!confirm('最后确认：导入后会覆盖当前本地数据，是否继续？')) return;

            data.db = nextDb;
            if (window.storageMigrate?.migrateAdviceToVersioned) {
                data.db = window.storageMigrate.migrateAdviceToVersioned(data.db);
            }
            if (window.adviceCollections && Array.isArray(data.db.health?.aiAdviceChat)) {
                await window.adviceCollections.clear();
                await window.adviceCollections.putMany(data.db.health.aiAdviceChat);
                if (data.db.health.aiAdviceChat.length > 50) {
                    data.db.health.aiAdviceChat = data.db.health.aiAdviceChat.slice(-50);
                }
            }
            data.normalizeDb();
            if (typeof data._initAdviceApi === 'function') {
                await data._initAdviceApi();
            }
            data.save({ render: false });
            await data.flush();
            if (typeof ai !== 'undefined') await ai.init({ saveData: true, renderData: false });
            if (typeof syncStatus !== 'undefined') syncStatus.render();
            data.render();
            window.errorBus?.event?.('backup', 'import:success', { elapsedMs: Date.now() - started, fileBytes: file.size || 0, itemCounts: backupCounts(nextDb) });
            alert('备份导入成功');
        } catch (e) {
            window.errorBus?.event?.('backup', 'import:failed', { elapsedMs: Date.now() - started, fileBytes: file.size || 0, error: e });
            alert('备份导入失败: ' + e.message);
        } finally {
            if (event?.target) event.target.value = '';
        }
    },

    isGzipBackupFile,
    readBackupFileText,
    backupCounts,
    backupPreviewText,
    sha256Hex
};

if (typeof window !== 'undefined') window.backup = backup;
