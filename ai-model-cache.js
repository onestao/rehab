// @ts-nocheck
Object.assign(ai, {
    normalizeProvider(provider = '') {
        return String(provider || '').trim() || 'openai';
    },

    providerLabel(provider = '') {
        const key = this.normalizeProvider(provider);
        return ({ openai: 'OpenAI', 'openai-responses': 'Responses', claude: 'Claude', gemini: 'Gemini' })[key] || key;
    },

    isModelEnabled(model = {}) {
        return model?.enabled !== false;
    },

    async loadModelCatalogPure() {
        if (window.aiModelCatalogPure) return window.aiModelCatalogPure;
        if (!this._modelCatalogPurePromise) {
            this._modelCatalogPurePromise = import('./ai-model-catalog-pure.mjs').then(module => {
                window.aiModelCatalogPure = window.aiModelCatalogPure || module;
                return window.aiModelCatalogPure;
            });
        }
        return this._modelCatalogPurePromise;
    },

    async persistModelCache() {
        await this.idbSet(this.MODELS_KEY, JSON.stringify(this.models || []));
        try { localStorage.setItem(this.MODELS_KEY, JSON.stringify(this.models || [])); } catch {}
        try { window.dispatchEvent(new CustomEvent('ai:catalog-changed')); } catch {}
    },

    replaceModelSnapshot(profileId, incoming = [], context = {}) {
        const helper = window.aiModelCatalogPure;
        if (!helper?.replaceDiscoveredModelsForProfile) return this.models || [];
        this.models = helper.replaceDiscoveredModelsForProfile(this.models || [], incoming, {
            ...context,
            profileId
        });
        return this.models;
    },

    async clearCurrentModelCache(includeManual = false) {
        return this.clearModelCache(this.cfg.activeProfileId || '', includeManual);
    },

    async clearCurrentProfileModelCache(includeManual = false) {
        return this.clearCurrentModelCache(includeManual);
    },

    async clearAllModelCache(includeManual = false) {
        return this.clearModelCache('', includeManual);
    },

    async clearAllModelCaches(includeManual = false) {
        return this.clearAllModelCache(includeManual);
    },

    async migrateLegacyModelCache() {
        if (!(this.models || []).some(model => !model?.profileId)) return this.models || [];
        const helper = await this.loadModelCatalogPure();
        if (!helper?.migrateLegacyModelCatalog) return this.models || [];
        this.models = helper.migrateLegacyModelCatalog(this.models || [], this.cfg.profiles || []);
        await this.persistModelCache();
        return this.models;
    },

    async clearModelCache(profileId = '', includeManual = false) {
        const helper = await this.loadModelCatalogPure();
        if (!helper?.clearModelCatalog) return;
        this.models = helper.clearModelCatalog(this.models || [], { profileId, includeManual });
        await this.persistModelCache();
        this.renderModels?.(this.models, false);
        const statusEl = document.getElementById('aiFetchStatus');
        if (statusEl) statusEl.textContent = profileId ? '已清除当前连接的模型缓存' : '已清除全部模型缓存';
    },

    setFormProvider(provider = '') {
        const normalized = this.normalizeProvider(provider);
        const select = document.getElementById('aiProvider');
        if (select) select.value = normalized;
        this.cfg.provider = normalized;
    },

    async toggleModelEnabled(id, provider = '', profileId = '') {
        const normalizedProvider = this.normalizeProvider(provider || this.cfg.provider || 'openai');
        const targetProfileId = String(profileId || this.cfg.activeProfileId || '');
        const idx = (this.models || []).findIndex(model => {
            const sameProfile = model.profileId
                ? String(model.profileId) === targetProfileId
                : this.normalizeProvider(model.provider) === normalizedProvider;
            return sameProfile && String(model.id || '') === String(id || '');
        });
        if (idx < 0) return;
        const nextEnabled = this.models[idx].enabled === false;
        this.models[idx] = { ...this.models[idx], profileId: this.models[idx].profileId || targetProfileId, provider: normalizedProvider, enabled: nextEnabled };
        await this.persistModelCache();
        this.renderModels?.(this.models, false);
        const statusEl = document.getElementById('aiFetchStatus');
        if (statusEl) statusEl.textContent = nextEnabled ? '已启用' : '已隐藏';
    },

    mergeModelCache(existing = [], incoming = []) {
        const map = new Map();
        const add = (model) => {
            const provider = this.normalizeProvider(model?.provider);
            const profileId = String(model?.profileId || '').trim();
            const id = String(model?.id || '').trim();
            if (!id) return;
            const key = `${profileId || `legacy:${provider}`}::${id}`;
            const previous = map.get(key);
            const enabled = model?.enabled === false ? false : (model?.enabled === true ? true : (previous?.enabled ?? true));
            map.set(key, { ...previous, ...model, profileId, provider, id, enabled });
        };
        (Array.isArray(existing) ? existing : []).forEach(add);
        (Array.isArray(incoming) ? incoming : []).forEach(add);
        return Array.from(map.values()).sort((a, b) => {
            const profileOrder = String(a.profileId || '').localeCompare(String(b.profileId || ''));
            if (profileOrder !== 0) return profileOrder;
            return String(a.id || '').localeCompare(String(b.id || ''));
        });
    }
});
