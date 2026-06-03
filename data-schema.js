// @ts-nocheck
(function () {
    window.dataSchema = {
        normalizeDb() {
            const nowTs = Date.now();
            this.db.schemaVersion = Math.max(Number(this.db.schemaVersion) || 0, this.SCHEMA_VERSION);
            this.db.cardio = { weight: 70, target: 30, type: 'walk', ...(this.db.cardio || {}) };
            this.db.voice = window.voiceEngine?.normalizeVoiceConfig
                ? window.voiceEngine.normalizeVoiceConfig(this.db.voice)
                : { priority: 'online-first', engines: [], cache: true, timeoutMs: 4000, ...(this.db.voice || {}) };
            // health.reports item shape:
            // { id, kind:'weekly'|'monthly', periodStart, periodEnd, generatedAt, updatedAt, deleted,
            //   metrics:{ weight, training, diet, cardio }, ai:{ summary, highlights, suggestions, model, prompt_id } }
            this.db.health = { weights: [], foodLogs: [], exerciseLogs: [], reports: [], rehabWeekly: [], goalType: 'loss', bodyPlan: null, weightPlan: null, dietGoal: null, aiAdviceChat: [], aiInsightCache: null, trainingLabelClassifications: {}, foodAliasGroups: [], weeklyGoalSessions: 5, ...(this.db.health || {}) };
            this.db.actions = (this.db.actions || []).map(a => this.ensureRecordMeta(a, 'action', nowTs));
            this.db.routines = (this.db.routines || []).map(r => {
                this.ensureRecordMeta(r, 'routine', nowTs);
                r.actions = (r.actions || []).map(a => {
                    const action = this.ensureRecordMeta(a, 'routine-action', Number(r.updatedAt || nowTs));
                    if (!action.sourceActionId && action.id) action.sourceActionId = action.id;
                    return action;
                });
                return r;
            });
            this.db.history = (this.db.history || []).map(h => {
                this.ensureRecordMeta(h, 'history', nowTs);
                h.actions = (h.actions || []).map(a => this.ensureRecordMeta(a, 'history-action', Number(h.updatedAt || nowTs)));
                return h;
            });
            this.db.health.weights = (this.db.health.weights || []).map(item => this.ensureRecordMeta(item, 'weight', nowTs));
            this.db.health.foodLogs = (this.db.health.foodLogs || []).map(item => this.ensureRecordMeta(item, 'food', nowTs));
            this.db.health.exerciseLogs = (this.db.health.exerciseLogs || []).map(item => this.ensureRecordMeta(item, 'exercise', nowTs));
            this.db.health.reports = (this.db.health.reports || []).map(item => this.ensureRecordMeta(item, 'health-report', nowTs));
            this.db.health.rehabWeekly = (this.db.health.rehabWeekly || []).map(item => this.ensureRecordMeta(item, 'rehab-week', nowTs));
            this.db.health.aiAdviceChat = (this.db.health.aiAdviceChat || []).map(item => this.ensureRecordMeta(item, 'advice', nowTs));
            this.db.health.aiInsightCache = this.db.health.aiInsightCache && typeof this.db.health.aiInsightCache === 'object' ? this.ensureRecordMeta(this.db.health.aiInsightCache, 'ai-insight-cache', nowTs) : null;
            this.db.health.trainingLabelClassifications = this.db.health.trainingLabelClassifications && typeof this.db.health.trainingLabelClassifications === 'object' ? this.db.health.trainingLabelClassifications : {};
            this.db.health.foodAliasGroups = Array.isArray(this.db.health.foodAliasGroups) ? this.db.health.foodAliasGroups : [];
            this.db.actions = this.db.actions.map(a => {
                a.tags = Array.isArray(a.tags) ? a.tags.filter(Boolean) : [];
                if (typeof a.libOnly !== 'boolean') a.libOnly = false;
                return a;
            });
            this.db.aiTemplates = Array.isArray(this.db.aiTemplates) ? this.db.aiTemplates : [];
            this.db.aiTemplateActiveId = this.db.aiTemplateActiveId || '';
            this.db.aiPromptPrefs = this.db.aiPromptPrefs && typeof this.db.aiPromptPrefs === 'object' ? this.db.aiPromptPrefs : {};
            this.db.aiTrash = Array.isArray(this.db.aiTrash) ? this.db.aiTrash : [];
            const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
            this.db.aiTrash = this.db.aiTrash.filter(item => Number(item?.deletedAt || 0) >= cutoff);
            this.db.aiRetryMode = this.db.aiRetryMode || 'versioned';
            this.db.prefs = this.db.prefs && typeof this.db.prefs === 'object' ? this.db.prefs : {};
            if (typeof this.db.prefs.haptics !== 'boolean') this.db.prefs.haptics = true;
            this.db.prefs.experiments = this.db.prefs.experiments && typeof this.db.prefs.experiments === 'object' ? this.db.prefs.experiments : {};
            if (typeof this.db.prefs.experiments.miScaleBle !== 'boolean') this.db.prefs.experiments.miScaleBle = false;
            if (!this.db.prefs.plan && this.db.prefs.rehab) {
                this.db.prefs.plan = this.db.prefs.rehab;
                delete this.db.prefs.rehab;
            } else if (this.db.prefs.rehab) {
                delete this.db.prefs.rehab;
            }
            this.db.dailyPlans = Array.isArray(this.db.dailyPlans) ? this.db.dailyPlans.map(plan => this.ensureDailyPlanShape ? this.ensureDailyPlanShape(plan) : this.ensureRecordMeta(plan, 'daily-plan', nowTs)) : [];
            this.db.progressionChains = Array.isArray(this.db.progressionChains) ? this.db.progressionChains.map(chain => this.ensureRecordMeta(chain, 'plan-chain', nowTs)) : [];
            this.db.weeklyPlan = this.db.weeklyPlan && typeof this.db.weeklyPlan === 'object' ? this.db.weeklyPlan : {};
            this.db.aiCipher = this.db.aiCipher && typeof this.db.aiCipher === 'object' ? this.db.aiCipher : null;
            if (!this.db.aiCipher && this.db.encryptedAi && typeof this.db.encryptedAi === 'object') {
                this.db.aiCipher = { id: 'ai-cipher', payload: this.db.encryptedAi, updatedAt: nowTs, deleted: false };
            }
            if (this.db.aiCipher?.payload) this.db.encryptedAi = this.db.aiCipher.payload;
            this.db.cache = this.db.cache && typeof this.db.cache === 'object' ? this.db.cache : {};
            this.db.cache.prByAction = this.db.cache.prByAction && typeof this.db.cache.prByAction === 'object' ? this.db.cache.prByAction : {};
            this.db.cache.prUpdatedAt = Number(this.db.cache.prUpdatedAt || 0);
            this.db.health.dietInputMode = this.db.health.dietInputMode || 'ai';
            this.db.health.profile = this.ensureRecordMeta(this.db.health.profile || {}, 'profile', nowTs);
            this.db.health.profile.gender = this.db.health.profile.gender || 'male';
            this.db.health.profile.age = this.db.health.profile.age || null;
            this.db.health.profile.conditions = this.db.health.profile.conditions || [];
            this.db.health.profile.allergies = this.db.health.profile.allergies || [];
            this.db.health.profile.preferences = this.db.health.profile.preferences || { equipment: [], sports: [] };
            this.db.health.profile.vitals = this.db.health.profile.vitals || { restingHR: null };
            this.db.health.dayCutoffHour = Number(this.db.health.dayCutoffHour ?? this.dayCutoffHour ?? 4) || 4;
            this.dayCutoffHour = this.db.health.dayCutoffHour;
            this.db.lastModified = this.db.lastModified || 0;
            this.db.deviceId = this.db.deviceId || `dev-${Math.random().toString(36).slice(2,10)}`;
            this.db.lastActionDraft = this.db.lastActionDraft || null;
            this.db.actualSetsBuffer = this.db.actualSetsBuffer || [];
            this.db.onboarded = true;
            this.db.aiProfiles = this.db.aiProfiles || [];
            this.db.aiActiveId = this.db.aiActiveId || '';
            this.db.aiModels = this.db.aiModels || [];
            this.db.libraryView = ['actions', 'routines'].includes(this.db.libraryView) ? this.db.libraryView : 'actions';
            this.db.libraryFilterTag = typeof this.db.libraryFilterTag === 'string' ? this.db.libraryFilterTag : '';
            this.db.syncMeta = this.db.syncMeta || {};
            this.db.syncMeta.lastSyncAt = Number(this.db.syncMeta.lastSyncAt || 0);
            this.db.syncMeta.lastIncrementalTs = Number(this.db.syncMeta.lastIncrementalTs || 0);
            this.db.syncMeta.etags = this.db.syncMeta.etags || {};
            this.db.syncMeta.pendingQueue = Array.isArray(this.db.syncMeta.pendingQueue) ? this.db.syncMeta.pendingQueue : [];
            this.db.syncMeta.lastArchiveDate = this.db.syncMeta.lastArchiveDate || '';
            this.db.syncMeta.lastArchiveChecksum = this.db.syncMeta.lastArchiveChecksum || '';
            this.db.syncMeta.conflictLog = Array.isArray(this.db.syncMeta.conflictLog) ? this.db.syncMeta.conflictLog : [];
            this.db.actions.forEach(a => { if (!a.phase) a.phase = 'main'; });
            this.db.routines.forEach(r => (r.actions || []).forEach(a => { if (!a.phase) a.phase = 'main'; }));
            if (window.dataAiTemplates && typeof window.dataAiTemplates.ensureDefaultTemplates === 'function') {
                window.dataAiTemplates.ensureDefaultTemplates(this.db);
            }
        }
    };
})();
