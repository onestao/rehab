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
            this.restoreActionDraft();
            if (window.cardio) cardio.initUI();
        },

        restoreActionDraft() {
            const draft = this.db.lastActionDraft;
            if (!draft) return;
            const fields = { sets: 'sets', reps: 'reps', work: 'work', repRest: 'repRest', actionRest: 'actionRest', groupRest: 'groupRest' };
            Object.entries(fields).forEach(([key, id]) => {
                const el = document.getElementById(id);
                if (el && draft[key] != null) el.value = draft[key];
            });
        },

        normalizeDb() {
            this.db.schemaVersion = Math.max(Number(this.db.schemaVersion) || 0, this.SCHEMA_VERSION);
            this.db.cardio = { weight: 70, target: 30, type: 'walk', ...(this.db.cardio || {}) };
            this.db.health = { weights: [], foodLogs: [], exerciseLogs: [], goalType: 'loss', bodyPlan: null, weightPlan: null, dietGoal: null, aiAdviceChat: [], ...(this.db.health || {}) };
            this.db.health.weights = this.db.health.weights || [];
            this.db.health.foodLogs = this.db.health.foodLogs || [];
            this.db.health.exerciseLogs = this.db.health.exerciseLogs || [];
            this.db.health.aiAdviceChat = this.db.health.aiAdviceChat || [];
            this.db.health.dietInputMode = this.db.health.dietInputMode || 'ai';
            this.db.lastModified = this.db.lastModified || 0;
            this.db.deviceId = this.db.deviceId || `dev-${Math.random().toString(36).slice(2,10)}`;
            this.db.lastActionDraft = this.db.lastActionDraft || null;
            this.db.actualSetsBuffer = this.db.actualSetsBuffer || [];
            this.db.onboarded = !!this.db.onboarded;
            this.db.aiProfiles = this.db.aiProfiles || [];
            this.db.aiActiveId = this.db.aiActiveId || '';
            this.db.aiModels = this.db.aiModels || [];
            (this.db.actions || []).forEach(a => { if (!a.phase) a.phase = 'main'; });
            (this.db.routines || []).forEach(r => (r.actions || []).forEach(a => { if (!a.phase) a.phase = 'main'; }));
        },

        migrateLegacy() {
            const legacy = ['rp_v31_db', 'rp_v28_db', 'rp_v21_main'];
            for (let key of legacy) {
                let old = localStorage.getItem(key);
                if (old) { this.db = JSON.parse(old); this.save(); break; }
            }
        },

        save() {
            this.db.lastModified = Date.now();
            this.db.deviceId = this.db.deviceId || `dev-${Math.random().toString(36).slice(2,10)}`;
            localStorage.setItem(this.DB_KEY, JSON.stringify(this.db));
            this.render();
        },

        async saveAndBackup() {
            this.save();
            await sync.autoBackup('history');
        }
    };
})();
