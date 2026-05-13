const syncStatus = {
    META_KEY: 'rehab_sync_meta',
    meta: { state: 'local', detail: '', lastAttemptAt: '', lastSuccessAt: '', lastErrorAt: '', mode: 'none', lastSyncAt: '', pendingCount: 0, lastError: '' },
    lastSyncAt: '',
    pendingCount: 0,
    lastError: '',

    init() {
        try {
            const saved = localStorage.getItem(this.META_KEY);
            if (saved) this.meta = { ...this.meta, ...JSON.parse(saved) };
        } catch {}
        this.meta.mode = data.cfg.mode || this.meta.mode || 'none';
        this.refreshFromDbSyncMeta();
        this.patchSync();
        this.render();
    },

    patchSync() {
        if (!window.sync || sync.__statusPatched) return;
        sync.__statusPatched = true;
        const baseSetStatus = sync.setStatus.bind(sync);
        sync.setStatus = (state, detail = '') => {
            baseSetStatus(state, detail);
            this.record(state, detail);
        };

        const baseSaveConfig = sync.saveConfig.bind(sync);
        sync.saveConfig = () => {
            baseSaveConfig();
            this.meta.mode = data.cfg.mode || 'none';
            this.persist();
            this.render();
        };
    },

    record(state, detail = '') {
        const now = new Date().toISOString();
        this.meta.state = state;
        this.meta.detail = detail || this.meta.detail || '';
        this.meta.mode = data.cfg.mode || 'none';
        if (state === 'syncing') this.meta.lastAttemptAt = now;
        if (state === 'cloud') {
            this.meta.lastSuccessAt = now;
            this.meta.lastSyncAt = now;
            this.meta.lastError = '';
            this.meta.detail = detail || '最近一次同步成功';
        }
        if (state === 'error') {
            this.meta.lastErrorAt = now;
            this.meta.lastError = detail || '最近一次同步失败';
            this.meta.detail = detail || '最近一次同步失败';
        }
        this.refreshFromDbSyncMeta();
        this.persist();
        this.render();
    },

    refreshFromDbSyncMeta() {
        const pending = Number(data?.db?.syncMeta?.pendingQueue?.length || 0);
        this.meta.pendingCount = pending;
        this.lastSyncAt = this.meta.lastSyncAt || this.meta.lastSuccessAt || '';
        this.pendingCount = this.meta.pendingCount;
        this.lastError = this.meta.lastError || '';
    },

    persist() {
        try { localStorage.setItem(this.META_KEY, JSON.stringify(this.meta)); } catch {}
    },

    formatTime(value) {
        if (!value) return '暂无';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '暂无' : date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    },

    render() {
        this.refreshFromDbSyncMeta();
        const el = document.getElementById('syncDetailStatus');
        if (!el) return;
        el.innerHTML = `
            <div class="sync-meta-item"><strong>同步方式</strong><span>${this.meta.mode === 'none' ? '仅本地' : this.meta.mode === 's3' ? 'S3' : 'WebDAV'}</span></div>
            <div class="sync-meta-item"><strong>最近同步</strong><span>${this.formatTime(this.lastSyncAt)}</span></div>
            <div class="sync-meta-item"><strong>待重试</strong><span>${this.pendingCount}</span></div>
            <div class="sync-meta-item"><strong>最近错误</strong><span>${this.lastError ? this.lastError : '暂无'}</span></div>
            <div class="sync-meta-item sync-meta-wide"><strong>状态</strong><span>${this.meta.detail || (this.meta.state === 'cloud' ? '云端同步正常' : this.meta.state === 'error' ? '同步失败' : '本地模式')}</span></div>`;
    }
};

if (typeof window !== 'undefined') window.syncStatus = syncStatus;
