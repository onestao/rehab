const backup = {
    exportData() {
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
        a.download = `rehab-backup-${data.dateKey(new Date())}.json`;
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
            data.normalizeDb();
            localStorage.setItem(data.DB_KEY, JSON.stringify(data.db));
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
