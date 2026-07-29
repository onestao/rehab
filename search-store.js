// @ts-nocheck
// Credentials never enter ai.cfg/data.db. Metadata stays with AI configuration so
// ordinary backups remain useful without leaking API keys.
(function attachSearchStore(root) {
    const META_KEY = 'rehab_pro_search_cfg';
    const KEYS_KEY = 'rehab_pro_search_keys';

    function pure() { return root.searchPolicyPure; }
    function clone(value) { return JSON.parse(JSON.stringify(value)); }
    function normalizedConfig(value) {
        return pure()?.normalizeSearchConfig?.(value) || { searchSchemaVersion: 1, searchProviders: [], networkDefaults: { sourcePolicy: 'official-preferred', allowedDomains: [], maxToolCalls: 2, maxResultChars: 12000 } };
    }
    function cleanKeyMap(value) {
        const out = {};
        if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
        for (const [id, key] of Object.entries(value)) {
            if (/^[a-zA-Z0-9_-]{1,128}$/.test(id) && typeof key === 'string' && key.trim() && key.length <= 4096) out[id] = key.trim();
        }
        return out;
    }

    const store = {
        config: normalizedConfig(),
        keyMap: {},

        async init() {
            const ai = root.ai;
            let metadata = null;
            try { metadata = JSON.parse(await ai?.idbGet?.(META_KEY) || ''); } catch {}
            if (!metadata) {
                try { metadata = JSON.parse(localStorage.getItem(META_KEY) || ''); } catch {}
            }
            // ai.cfg is the durable non-secret mirror used by normal data sync.
            this.config = normalizedConfig(metadata || ai?.cfg?.searchConfig || {
                searchSchemaVersion: ai?.cfg?.searchSchemaVersion,
                searchProviders: ai?.cfg?.searchProviders,
                networkDefaults: ai?.cfg?.networkDefaults
            });
            try { this.keyMap = cleanKeyMap(JSON.parse(await ai?.idbGet?.(KEYS_KEY) || '')); } catch { this.keyMap = {}; }
            if (!Object.keys(this.keyMap).length) {
                try { this.keyMap = cleanKeyMap(JSON.parse(localStorage.getItem(KEYS_KEY) || '')); } catch {}
            }
            await this.persist();
            return this.getConfig();
        },

        getConfig() { return clone(this.config); },
        getProviders() { return this.config.searchProviders.map(clone); },
        apiKeyFor(id) { return this.keyMap[String(id || '')] || ''; },

        async persist() {
            const ai = root.ai;
            this.config = normalizedConfig(this.config);
            const encoded = JSON.stringify(this.config);
            await ai?.idbSet?.(META_KEY, encoded);
            try { localStorage.setItem(META_KEY, encoded); } catch {}
            if (ai?.cfg) {
                ai.cfg.searchSchemaVersion = this.config.searchSchemaVersion;
                ai.cfg.searchProviders = clone(this.config.searchProviders);
                ai.cfg.networkDefaults = clone(this.config.networkDefaults);
            }
            await ai?.persist?.();
            ai?.persistDataDb?.(false);
        },

        async persistKeyMap() {
            const encoded = JSON.stringify(cleanKeyMap(this.keyMap));
            await root.ai?.idbSet?.(KEYS_KEY, encoded);
            try { localStorage.setItem(KEYS_KEY, encoded); } catch {}
        },

        async saveProvider(provider, apiKey) {
            const list = this.getProviders();
            const index = list.findIndex(item => item.id === provider?.id);
            const next = pure()?.normalizeSearchProvider?.(provider, Math.max(0, index)) || null;
            if (!next) throw new Error('搜索服务配置无效');
            if (index >= 0) list[index] = next; else list.push(next);
            this.config = normalizedConfig({ ...this.config, searchProviders: list });
            if (typeof apiKey === 'string' && apiKey.trim()) {
                this.keyMap[next.id] = apiKey.trim();
                await this.persistKeyMap();
            }
            await this.persist();
            return clone(next);
        },

        async archiveProvider(id, archived = true) {
            const list = this.getProviders().map(provider => provider.id === id ? { ...provider, archived: !!archived } : provider);
            this.config = normalizedConfig({ ...this.config, searchProviders: list });
            await this.persist();
        },

        async moveProvider(id, delta = 0) {
            const list = this.getProviders();
            const index = list.findIndex(item => item.id === id);
            const target = Math.max(0, Math.min(list.length - 1, index + Math.sign(Number(delta) || 0)));
            if (index < 0 || target === index) return;
            [list[index], list[target]] = [list[target], list[index]];
            list.forEach((item, sortOrder) => { item.sortOrder = sortOrder; });
            this.config = normalizedConfig({ ...this.config, searchProviders: list });
            await this.persist();
        },

        async removeProvider(id) {
            const safeId = String(id || '');
            this.config = normalizedConfig({ ...this.config, searchProviders: this.getProviders().filter(item => item.id !== safeId) });
            delete this.keyMap[safeId];
            await this.persistKeyMap();
            await this.persist();
            // Remove only the affected external-provider references, never routes.
            const routes = root.ai?.cfg?.taskRoutes || {};
            for (const route of Object.values(routes)) {
                if (Array.isArray(route?.network?.providerIds)) route.network.providerIds = route.network.providerIds.filter(item => item !== safeId);
            }
            await root.ai?.persist?.();
            root.ai?.persistDataDb?.(false);
        },

        exportEncryptedPayload() { return { config: this.getConfig(), keyMap: cleanKeyMap(this.keyMap) }; },
        async importEncryptedPayload(payload = {}) {
            this.config = normalizedConfig(payload?.config);
            this.keyMap = cleanKeyMap(payload?.keyMap);
            await this.persistKeyMap();
            await this.persist();
        }
    };
    root.searchStore = store;
    root.addEventListener?.('ai:ready', () => { store.init().catch(() => {}); }, { once: true });
})(window);
