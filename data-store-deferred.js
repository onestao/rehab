// @ts-nocheck
(function () {
    window.dataStoreDeferred = {
        async runStorageMigration(options) {
            if (typeof window.loadAppScript === 'function') {
                await Promise.all([
                    window.loadAppScript('storage/idb-collections'),
                    window.loadAppScript('storage/idb-advice-collections')
                ]);
            }
            const localAdapter = window.storageMigrate.createLocalAdapter?.({ dbKey: options.dbKey })
                || this.createLocalStorageAdapter();
            window.errorBus?.event?.('storage.migration', 'start:deferred', {
                targetVersion: Number(options.targetVersion || 2)
            });
            const migration = await window.storageMigrate.migrateLocalToIdb(options, localAdapter);
            window.errorBus?.event?.('storage.migration', migration.ok ? 'success:deferred' : 'failed:deferred', {
                targetVersion: Number(options.targetVersion || 2),
                reason: migration.reason || ''
            });
            if (!migration.ok) return migration;
            if (typeof window.storageMigrate.createIdbAdapter === 'function') {
                this._storage = window.storageMigrate.createIdbAdapter(options);
                this._storageMode = 'idb';
                await Promise.resolve(this._storage.write(this.DB_KEY, this.db));
                if (this.cfg) await Promise.resolve(this._storage.write(this.CFG_KEY, this.cfg));
            }
            return migration;
        },

        async loadRecentAdviceColdStart() {
            if (!this.advice) return;
            const recentAdvice = await this.advice.getRecent(50);
            if (recentAdvice && recentAdvice.length > 0) {
                const localAdvice = Array.isArray(this.db.health.aiAdviceChat) ? this.db.health.aiAdviceChat : [];
                const recentChronological = recentAdvice.slice().reverse();
                this.db.health.aiAdviceChat = this.advice._mergeChronological(localAdvice, recentChronological);
                this.advice.workingSet = this.db.health.aiAdviceChat;
                this.advice.setActiveRecords(this.activeRecords(this.db.health.aiAdviceChat || []), 'recent');
            }
            this.advice.initSearchWorker?.();
        }
    };
})();
