// @ts-nocheck
const ai = {
    KEY: 'rehab_pro_ai_cfg',
    MODELS_KEY: 'rehab_pro_ai_models',
    KEYS_KEY: 'rehab_pro_ai_keys',
    IDB_NAME: 'rehab_ai_store',
    IDB_VERSION: 1,
    IDB_STORE: 'kv',
    cfg: {
        activeProfileId: '',
        profiles: [],
        provider: 'openai',
        model: '',
        baseUrl: '',
        enabled: false
    },
    models: [],
    keyMap: {},
    dbPromise: null,

    async init(options = {}) {
        const { saveData = true, renderData = false } = options;
        this.cfg = {
            activeProfileId: '',
            profiles: [],
            provider: 'openai',
            model: '',
            baseUrl: '',
            enabled: false
        };
        this.models = [];
        this.keyMap = {};

        await this.initDb();

        // 1) 先从 IndexedDB 恢复（主来源）
        try {
            const saved = await this.idbGet(this.KEY);
            if (saved) this.cfg = { ...this.cfg, ...JSON.parse(saved) };
        } catch {}
        try {
            const savedModels = await this.idbGet(this.MODELS_KEY);
            if (savedModels) this.models = JSON.parse(savedModels);
        } catch {}
        try {
            const savedKeys = await this.idbGet(this.KEYS_KEY);
            if (savedKeys) this.keyMap = JSON.parse(savedKeys);
        } catch {}

        // 2) 回退到 localStorage（兼容旧版本 / IndexedDB 不可用）
        if (!this.cfg.profiles?.length) {
            try {
                const saved = localStorage.getItem(this.KEY);
                if (saved) this.cfg = { ...this.cfg, ...JSON.parse(saved) };
            } catch {}
        }
        if (!this.models?.length) {
            try {
                const savedModels = localStorage.getItem(this.MODELS_KEY);
                if (savedModels) this.models = JSON.parse(savedModels);
            } catch {}
        }
        if (!Object.keys(this.keyMap).length) {
            try {
                const savedKeys = localStorage.getItem(this.KEYS_KEY);
                if (savedKeys) this.keyMap = JSON.parse(savedKeys);
            } catch {}
        }

        // 3) 从主数据回退。这样即使单独的 AI 存储被清理，也能恢复档案、Base URL、模型等非敏感配置。
        if ((!this.cfg.profiles || !this.cfg.profiles.length) && typeof data !== 'undefined' && data.db?.aiProfiles?.length) {
            this.cfg.profiles = data.db.aiProfiles;
            this.cfg.activeProfileId = data.db.aiActiveId || this.cfg.profiles[0]?.id || '';
        }
        if ((!this.models || !this.models.length) && typeof data !== 'undefined' && data.db?.aiModels?.length) {
            this.models = data.db.aiModels;
        }

        // 4) 兼容旧 per-profile localStorage key
        (this.cfg.profiles || []).forEach(p => {
            const legacy = this.apiKeyForLegacy(p.id);
            if (legacy && !this.keyMap[p.id]) this.keyMap[p.id] = legacy;
        });

        this.cfg.profiles = Array.isArray(this.cfg.profiles) ? this.cfg.profiles : [];
        this.models = Array.isArray(this.models) ? this.models : [];
        this.keyMap = this.keyMap && typeof this.keyMap === 'object' ? this.keyMap : {};
        if (!this.cfg.activeProfileId && this.cfg.profiles.length) {
            this.cfg.activeProfileId = this.cfg.profiles[0].id;
        }

        this.loadActiveProfileToForm();
        await this.persist();
        await this.persistKeyMap();
        if (saveData) this.persistDataDb(renderData);
        this.syncUI();
        this.checkEncrypted();
        try { window.dispatchEvent(new CustomEvent('ai:ready')); } catch {}
    },

    // --- IndexedDB ---
    initDb() {
        if (this.dbPromise) return this.dbPromise;
        this.dbPromise = new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) {
                resolve(null);
                return;
            }
            const req = indexedDB.open(this.IDB_NAME, this.IDB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(this.IDB_STORE)) {
                    db.createObjectStore(this.IDB_STORE);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        }).catch(() => null);
        return this.dbPromise;
    },

    async idbGet(key) {
        const db = await this.initDb();
        if (!db) return '';
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.IDB_STORE, 'readonly');
            const store = tx.objectStore(this.IDB_STORE);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result || '');
            req.onerror = () => reject(req.error);
        }).catch(() => '');
    },

    async idbSet(key, value) {
        const db = await this.initDb();
        if (!db) return;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.IDB_STORE, 'readwrite');
            const store = tx.objectStore(this.IDB_STORE);
            store.put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        }).catch(() => {});
    },

    async idbDelete(key) {
        const db = await this.initDb();
        if (!db) return;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.IDB_STORE, 'readwrite');
            const store = tx.objectStore(this.IDB_STORE);
            store.delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        }).catch(() => {});
    },
};

if (typeof window !== 'undefined') window.ai = ai;
