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

    async persistModelCache() {
        await this.idbSet(this.MODELS_KEY, JSON.stringify(this.models || []));
        try { localStorage.setItem(this.MODELS_KEY, JSON.stringify(this.models || [])); } catch {}
        this.persistDataDb(false);
    },

    setFormProvider(provider = '') {
        const normalized = this.normalizeProvider(provider);
        const select = document.getElementById('aiProvider');
        if (select) select.value = normalized;
        this.cfg.provider = normalized;
    },

    async toggleModelEnabled(id, provider = '') {
        const normalizedProvider = this.normalizeProvider(provider || this.cfg.provider || 'openai');
        const idx = (this.models || []).findIndex(model => this.normalizeProvider(model.provider) === normalizedProvider && String(model.id || '') === String(id || ''));
        if (idx < 0) return;
        const nextEnabled = this.models[idx].enabled === false;
        this.models[idx] = { ...this.models[idx], provider: normalizedProvider, enabled: nextEnabled };
        await this.persistModelCache();
        this.renderModels?.(this.models, false);
        const statusEl = document.getElementById('aiFetchStatus');
        if (statusEl) statusEl.textContent = nextEnabled ? '已启用' : '已隐藏';
    },

    mergeModelCache(existing = [], incoming = []) {
        const map = new Map();
        const add = (model) => {
            const provider = this.normalizeProvider(model?.provider);
            const id = String(model?.id || '').trim();
            if (!id) return;
            const key = `${provider}::${id}`;
            const previous = map.get(key);
            const enabled = model?.enabled === false ? false : (model?.enabled === true ? true : (previous?.enabled ?? true));
            map.set(key, { ...previous, ...model, provider, id, enabled });
        };
        (Array.isArray(existing) ? existing : []).forEach(add);
        (Array.isArray(incoming) ? incoming : []).forEach(add);
        return Array.from(map.values()).sort((a, b) => {
            const providerOrder = this.normalizeProvider(a.provider).localeCompare(this.normalizeProvider(b.provider));
            if (providerOrder !== 0) return providerOrder;
            return String(a.id || '').localeCompare(String(b.id || ''));
        });
    }
});
