// @ts-nocheck

async function sha256Hex(str) {
    const buf = new TextEncoder().encode(str);
    const h = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function gzipBlob(text) {
    return await new Response(
        new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
    ).blob();
}

async function ungzipText(blob) {
    return await new Response(
        blob.stream().pipeThrough(new DecompressionStream('gzip'))
    ).text();
}

const backup = {
    async buildArchive() {
        if (typeof data.flush === 'function') await data.flush();
        if (!data.db || typeof data.db !== 'object') {
            throw new Error('数据为空，无法构建归档');
        }
        const dbStr = JSON.stringify(data.db);
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
            schemaVersion: data.db.schemaVersion || data.SCHEMA_VERSION || 1,
            itemCounts: {
                actions: data.db.actions?.length || 0,
                routines: data.db.routines?.length || 0,
                history: data.db.history?.length || 0,
                food: data.db.health?.foodLogs?.length || 0,
                exercise: data.db.health?.exerciseLogs?.length || 0,
                weight: data.db.health?.weights?.length || 0
            },
            checksum,
            db: data.db
        };
        const jsonStr = JSON.stringify(payload);
        const blob = await gzipBlob(jsonStr);
        const ts = new Date().toISOString().replace(/[:\-\.]/g, '').slice(0, 19);
        const filename = `rehab-${ts}-${checksum.slice(0, 8)}.json.gz`;
        return { blob, filename, checksum, payload };
    },

    async snapshotToRing(blob, filename, source) {
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

                    doPrune().then(resolve).catch((err) => { db.close(); resolve(); });
                };
                tx.onerror = () => { db.close(); reject(tx.error); };
            };
            req.onerror = () => reject(req.error);
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
                        data.normalizeDb();
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
        } catch (e) {
            alert('导出备份失败: ' + e.message);
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
        try {
            await this.buildArchive().then(({ blob, filename }) =>
                this.snapshotToRing(blob, filename, 'pre-import')
            ).catch(e => console.warn('pre-import snapshot failed', e));

            let text;
            if (file.name.endsWith('.gz')) {
                const buf = await file.arrayBuffer();
                const gzBlob = new Blob([buf]);
                text = await ungzipText(gzBlob);
            } else {
                text = await file.text();
            }

            const json = JSON.parse(text);
            const nextDb = json?.db && typeof json.db === 'object' ? json.db : json;
            if (!nextDb || typeof nextDb !== 'object') throw new Error('文件格式不正确');

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

            if (!confirm('导入后会覆盖当前本地数据，是否继续？')) return;

            data.db = nextDb;
            if (window.storageMigrate?.migrateAdviceToVersioned) {
                data.db = window.storageMigrate.migrateAdviceToVersioned(data.db);
            }
            data.normalizeDb();
            data.save({ render: false });
            await data.flush();
            if (typeof ai !== 'undefined') await ai.init({ saveData: true, renderData: false });
            if (typeof syncStatus !== 'undefined') syncStatus.render();
            data.render();
            alert('备份导入成功');
        } catch (e) {
            alert('备份导入失败: ' + e.message);
        } finally {
            if (event?.target) event.target.value = '';
        }
    }
};

if (typeof window !== 'undefined') window.backup = backup;
