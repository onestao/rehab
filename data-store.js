(function () {
    window.dataStore = {
        async init() {
            const localDb = localStorage.getItem(this.DB_KEY);
            const localCfg = localStorage.getItem(this.CFG_KEY);
            if (localDb) this.db = JSON.parse(localDb);
            else this.migrateLegacy();
            if (localCfg) this.cfg = JSON.parse(localCfg);
            this.normalizeDb();
            sync.initUI();
            if (typeof ai !== 'undefined') await ai.init({ saveData: true, renderData: false });
            this.render();
            if (window.cardio) cardio.initUI();
        },

        normalizeDb() {
            this.db.schemaVersion = Math.max(Number(this.db.schemaVersion) || 0, this.SCHEMA_VERSION);
            this.db.cardio = { weight: 70, target: 30, type: 'walk', ...(this.db.cardio || {}) };
            this.db.health = { weights: [], foodLogs: [], exerciseLogs: [], goalType: 'loss', bodyPlan: null, weightPlan: null, dietGoal: null, aiAdviceChat: [], ...(this.db.health || {}) };
            this.db.health.weights = this.db.health.weights || [];
            this.db.health.foodLogs = this.db.health.foodLogs || [];
            this.db.health.exerciseLogs = this.db.health.exerciseLogs || [];
            this.db.health.aiAdviceChat = this.db.health.aiAdviceChat || [];
            this.db.aiProfiles = this.db.aiProfiles || [];
            this.db.aiActiveId = this.db.aiActiveId || '';
            this.db.aiModels = this.db.aiModels || [];
        },

        migrateLegacy() {
            const legacy = ['rp_v31_db', 'rp_v28_db', 'rp_v21_main'];
            for (let key of legacy) {
                let old = localStorage.getItem(key);
                if (old) { this.db = JSON.parse(old); this.save(); break; }
            }
        },

        save() {
            localStorage.setItem(this.DB_KEY, JSON.stringify(this.db));
            this.render();
        },

        async saveAndBackup() {
            this.save();
            await sync.autoBackup('history');
        }
    };
})();
