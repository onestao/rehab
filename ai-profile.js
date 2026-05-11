Object.assign(ai, {
    // --- Profiles ---
    currentFormProfile(forceNew = false) {
        const activeId = !forceNew && this.cfg.activeProfileId ? this.cfg.activeProfileId : `profile_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        return {
            id: activeId,
            name: (document.getElementById('aiProfileName')?.value || '').trim() || '未命名配置',
            provider: document.getElementById('aiProvider')?.value || 'openai',
            baseUrl: (document.getElementById('aiBaseUrl')?.value || '').trim().replace(/\/+$/, ''),
            model: (document.getElementById('aiModel')?.value || '').trim(),
            apiKey: (document.getElementById('aiApiKey')?.value || '').trim() || this.apiKeyFor(activeId)
        };
    },

    apiKeyKey(id) { return `rehab_pro_ai_key_${id}`; },
    apiKeyForLegacy(id) {
        if (!id) return '';
        try { return localStorage.getItem(this.apiKeyKey(id)) || ''; } catch { return ''; }
    },
    apiKeyFor(id) { return id ? (this.keyMap[id] || '') : ''; },

    async persistKeyMap() {
        await this.idbSet(this.KEYS_KEY, JSON.stringify(this.keyMap));
        try { localStorage.setItem(this.KEYS_KEY, JSON.stringify(this.keyMap)); } catch {}
    },

    async saveProfile(forceNew = false) {
        const profile = this.currentFormProfile(forceNew);
        if (!profile.baseUrl) return alert('请填写 Base URL');
        if (!profile.model) return alert('请填写或选择模型');
        if (!profile.apiKey) return alert('请填写 API Key');

        const idx = this.cfg.profiles.findIndex(p => p.id === profile.id);
        const meta = {
            id: profile.id,
            name: profile.name,
            provider: profile.provider,
            baseUrl: profile.baseUrl,
            model: profile.model
        };
        if (idx >= 0) this.cfg.profiles[idx] = meta;
        else this.cfg.profiles.push(meta);

        this.cfg.activeProfileId = profile.id;
        this.cfg.provider = profile.provider;
        this.cfg.baseUrl = profile.baseUrl;
        this.cfg.model = profile.model;
        this.cfg.enabled = true;

        this.keyMap[profile.id] = profile.apiKey;
        await this.persistKeyMap();
        await this.persist();
        this.persistDataDb(false);
        this.syncUI();
        alert(forceNew ? '已另存为新档案' : 'AI 档案已保存');
    },

    saveCurrentProfile() { return this.saveProfile(false); },
    saveAsNewProfile() { return this.saveProfile(true); },

    async deleteCurrentProfile() {
        const id = this.cfg.activeProfileId;
        if (!id) return;
        this.cfg.profiles = this.cfg.profiles.filter(p => p.id !== id);
        delete this.keyMap[id];
        await this.persistKeyMap();
        await this.idbDelete(this.apiKeyKey(id));
        try { localStorage.removeItem(this.apiKeyKey(id)); } catch {}
        this.cfg.activeProfileId = this.cfg.profiles[0]?.id || '';
        this.loadActiveProfileToForm();
        await this.persist();
        this.persistDataDb(false);
        this.syncUI();
    },

    async selectProfile(id) {
        this.cfg.activeProfileId = id || '';
        this.loadActiveProfileToForm();
        await this.persist();
        this.persistDataDb(false);
        this.syncUI();
    },

    loadActiveProfileToForm() {
        const profile = this.cfg.profiles.find(p => p.id === this.cfg.activeProfileId);
        if (profile) {
            this.cfg.provider = profile.provider || 'openai';
            this.cfg.baseUrl = profile.baseUrl || '';
            this.cfg.model = profile.model || '';
            this.cfg.enabled = !!(profile.baseUrl && profile.model);
        } else {
            this.cfg.provider = 'openai';
            this.cfg.baseUrl = '';
            this.cfg.model = '';
            this.cfg.enabled = false;
        }
    },

    async persist() {
        const payload = JSON.stringify({
            activeProfileId: this.cfg.activeProfileId,
            profiles: this.cfg.profiles,
            provider: this.cfg.provider,
            model: this.cfg.model,
            baseUrl: this.cfg.baseUrl,
            enabled: this.cfg.enabled
        });
        await this.idbSet(this.KEY, payload);
        try { localStorage.setItem(this.KEY, payload); } catch {}
    },

    persistDataDb(render = true) {
        this.syncToDataDb();
        if (typeof data === 'undefined' || !data.db) return;
        if (render && typeof data.save === 'function') {
            data.save();
            return;
        }
        try { localStorage.setItem(data.DB_KEY, JSON.stringify(data.db)); } catch {}
    },

    syncToDataDb() {
        if (typeof data === 'undefined' || !data.db) return;
        data.db.aiProfiles = this.cfg.profiles || [];
        data.db.aiActiveId = this.cfg.activeProfileId || '';
        data.db.aiModels = this.models || [];
    },

    checkEncrypted() {
        const el = document.getElementById('aiDecryptSection');
        if (el) el.classList.toggle('hidden', !data.db?.encryptedAi);
    },

    syncUI() {
        const p = document.getElementById('aiProvider');
        const b = document.getElementById('aiBaseUrl');
        const m = document.getElementById('aiModel');
        const k = document.getElementById('aiApiKey');
        const n = document.getElementById('aiProfileName');
        const select = document.getElementById('aiProfileSelect');
        const current = this.cfg.profiles.find(x => x.id === this.cfg.activeProfileId);
        if (p) p.value = this.cfg.provider || 'openai';
        if (b) b.value = this.cfg.baseUrl || '';
        if (m) m.value = this.cfg.model || '';
        if (k) k.value = this.apiKeyFor(this.cfg.activeProfileId) || '';
        if (n) n.value = current?.name || '';
        if (select) {
            const options = this.cfg.profiles.length
                ? this.cfg.profiles.map(pr => `<option value="${pr.id}" ${pr.id === this.cfg.activeProfileId ? 'selected' : ''}>${pr.name} (${pr.provider || 'openai'})</option>`).join('')
                : '<option value="">未保存配置</option>';
            select.innerHTML = options;
        }
        const status = document.getElementById('aiStatus');
        if (status) {
            status.textContent = this.cfg.enabled ? '已配置' : '未配置';
            status.className = 'ai-status ' + (this.cfg.enabled ? 'ai-ready' : 'ai-off');
        }
        if (this.models.length) this.renderModels(this.models, true);
        this.checkEncrypted();
    },
    // --- Encryption (AES-GCM + PBKDF2) ---
    async deriveKey(password, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    },
    toB64(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))); },
    fromB64(b64) { return Uint8Array.from(atob(b64), c => c.charCodeAt(0)); },

    async encryptData(plaintext, password) {
        const enc = new TextEncoder();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await this.deriveKey(password, salt);
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
        return { s: this.toB64(salt), i: this.toB64(iv), d: this.toB64(encrypted) };
    },

    async decryptData(obj, password) {
        const key = await this.deriveKey(password, this.fromB64(obj.s));
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.fromB64(obj.i) }, key, this.fromB64(obj.d));
        return new TextDecoder().decode(decrypted);
    },

    async exportToSync() {
        const password = document.getElementById('aiEncryptPass')?.value;
        if (!password || password.length < 4) return alert('请输入至少4位的加密密码');
        const profiles = this.cfg.profiles.map(p => ({ ...p, apiKey: this.apiKeyFor(p.id) }));
        const payload = JSON.stringify({ activeProfileId: this.cfg.activeProfileId, profiles, models: this.models });
        try {
            data.db.encryptedAi = await this.encryptData(payload, password);
            data.save();
            document.getElementById('aiEncryptPass').value = '';
            alert('所有 AI 配置档案已加密并存入同步数据');
        } catch (e) { alert('加密失败: ' + e.message); }
    },

    async importFromSync() {
        const password = document.getElementById('aiDecryptPass')?.value;
        if (!password) return alert('请输入解密密码');
        if (!data.db?.encryptedAi) return alert('未找到加密的 AI 配置');
        try {
            const plaintext = await this.decryptData(data.db.encryptedAi, password);
            const cfg = JSON.parse(plaintext);
            this.cfg.profiles = (cfg.profiles || []).map(p => ({ id: p.id, name: p.name, provider: p.provider, baseUrl: p.baseUrl, model: p.model }));
            this.cfg.activeProfileId = cfg.activeProfileId || this.cfg.profiles[0]?.id || '';
            this.keyMap = {};
            (cfg.profiles || []).forEach(p => { if (p.apiKey) this.keyMap[p.id] = p.apiKey; });
            await this.persistKeyMap();
            this.models = cfg.models || this.models;
            await this.idbSet(this.MODELS_KEY, JSON.stringify(this.models));
            try { localStorage.setItem(this.MODELS_KEY, JSON.stringify(this.models)); } catch {}
            this.loadActiveProfileToForm();
            await this.persist();
            this.persistDataDb(false);
            document.getElementById('aiDecryptPass').value = '';
            this.syncUI();
            alert('AI 配置档案已恢复');
        } catch {
            alert('解密失败：密码错误或数据损坏');
        }
    },
});
