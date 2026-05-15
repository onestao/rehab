// @ts-nocheck
const backup = {
    async exportData() {
        if (typeof data.flush === 'function') await data.flush();
        const payload = {
            exportedAt: new Date().toISOString(),
            schemaVersion: data.db.schemaVersion || data.SCHEMA_VERSION || 1,
            app: '训练助手',
            db: data.db
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rehab-backup-${data.logicalDateKey()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
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
            const text = await file.text();
            const json = JSON.parse(text);
            const nextDb = json?.db && typeof json.db === 'object' ? json.db : json;
            if (!nextDb || typeof nextDb !== 'object') throw new Error('文件格式不正确');
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
