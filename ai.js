const ai = {
    KEY: 'rehab_pro_ai_cfg',
    MODELS_KEY: 'rehab_pro_ai_models',
    cfg: {
        activeProfileId: '',
        profiles: [],
        provider: 'openai',
        model: '',
        baseUrl: '',
        enabled: false
    },
    models: [],

    init() {
        this.cfg = { activeProfileId: '', profiles: [], provider: 'openai', model: '', baseUrl: '', enabled: false };
        this.models = [];
        // 1) 从 localStorage 恢复
        try {
            const saved = localStorage.getItem(this.KEY);
            if (saved) this.cfg = { ...this.cfg, ...JSON.parse(saved) };
        } catch {}
        try {
            const savedModels = localStorage.getItem(this.MODELS_KEY);
            if (savedModels) this.models = JSON.parse(savedModels);
        } catch {}
        // 2) 如果 localStorage 为空，尝试从 data.db 恢复
        if ((!this.cfg.profiles || !this.cfg.profiles.length) && data.db?.aiProfiles?.length) {
            this.cfg.profiles = data.db.aiProfiles;
            this.cfg.activeProfileId = data.db.aiActiveId || this.cfg.profiles[0]?.id || '';
            this.persist();
        }
        if ((!this.models || !this.models.length) && data.db?.aiModels?.length) {
            this.models = data.db.aiModels;
            localStorage.setItem(this.MODELS_KEY, JSON.stringify(this.models));
        }
        this.cfg.profiles = this.cfg.profiles || [];
        if (!this.cfg.activeProfileId && this.cfg.profiles.length) {
            this.cfg.activeProfileId = this.cfg.profiles[0].id;
        }
        this.loadActiveProfileToForm();
        this.syncUI();
        this.checkEncrypted();
    },

    // --- Storage helper ---
    lsGet(key) { try { return localStorage.getItem(key) || ''; } catch { return ''; } },
    lsSet(key, val) { try { localStorage.setItem(key, val); } catch {} },
    lsDel(key) { try { localStorage.removeItem(key); } catch {} },

    // --- Profiles ---
    currentFormProfile(forceNew = false) {
        const activeId = !forceNew && this.cfg.activeProfileId ? this.cfg.activeProfileId : `profile_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        return {
            id: activeId,
            name: (document.getElementById('aiProfileName')?.value || '').trim() || '未命名配置',
            provider: document.getElementById('aiProvider')?.value || 'openai',
            baseUrl: (document.getElementById('aiBaseUrl')?.value || '').trim().replace(/\/+$/, ''),
            model: (document.getElementById('aiModel')?.value || '').trim(),
            apiKey: (document.getElementById('aiApiKey')?.value || '').trim() || this.apiKeyFor(this.cfg.activeProfileId)
        };
    },

    apiKeyKey(id) { return `rehab_pro_ai_key_${id}`; },
    apiKeyFor(id) { return id ? (this.lsGet(this.apiKeyKey(id)) || '') : ''; },

    saveProfile(forceNew = false) {
        const profile = this.currentFormProfile(forceNew);
        if (!profile.baseUrl) return alert('请填写 Base URL');
        if (!profile.model) return alert('请填写或选择模型');
        if (!profile.apiKey) return alert('请填写 API Key');
        const idx = this.cfg.profiles.findIndex(p => p.id === profile.id);
        const meta = { id: profile.id, name: profile.name, provider: profile.provider, baseUrl: profile.baseUrl, model: profile.model };
        if (idx >= 0) this.cfg.profiles[idx] = meta;
        else this.cfg.profiles.push(meta);
        this.cfg.activeProfileId = profile.id;
        this.cfg.provider = profile.provider;
        this.cfg.baseUrl = profile.baseUrl;
        this.cfg.model = profile.model;
        this.cfg.enabled = true;
        this.lsSet(this.apiKeyKey(profile.id), profile.apiKey);
        if (document.getElementById('aiApiKey')) document.getElementById('aiApiKey').value = '';
        this.persist();
        this.syncToDataDb();
        this.syncUI();
        alert(forceNew ? '已另存为新档案' : 'AI 档案已保存');
    },

    saveCurrentProfile() { this.saveProfile(false); },
    saveAsNewProfile() { this.saveProfile(true); },

    deleteCurrentProfile() {
        const id = this.cfg.activeProfileId;
        if (!id) return;
        this.cfg.profiles = this.cfg.profiles.filter(p => p.id !== id);
        this.lsDel(this.apiKeyKey(id));
        this.cfg.activeProfileId = this.cfg.profiles[0]?.id || '';
        this.loadActiveProfileToForm();
        this.persist();
        this.syncToDataDb();
        this.syncUI();
    },

    selectProfile(id) {
        this.cfg.activeProfileId = id || '';
        this.loadActiveProfileToForm();
        this.persist();
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

    persist() {
        this.lsSet(this.KEY, JSON.stringify({
            activeProfileId: this.cfg.activeProfileId,
            profiles: this.cfg.profiles,
            provider: this.cfg.provider,
            model: this.cfg.model,
            baseUrl: this.cfg.baseUrl,
            enabled: this.cfg.enabled
        }));
    },

    syncToDataDb() {
        if (!data.db) return;
        data.db.aiProfiles = this.cfg.profiles || [];
        data.db.aiActiveId = this.cfg.activeProfileId || '';
        data.db.aiModels = this.models || [];
        data.save();
    },

    checkEncrypted() {
        const el = document.getElementById('aiDecryptSection');
        if (el) el.classList.toggle('hidden', !data.db?.encryptedAi);
    },

    syncUI() {
        const p = document.getElementById('aiProvider');
        const b = document.getElementById('aiBaseUrl');
        const m = document.getElementById('aiModel');
        const n = document.getElementById('aiProfileName');
        const select = document.getElementById('aiProfileSelect');
        const current = this.cfg.profiles.find(x => x.id === this.cfg.activeProfileId);
        if (p) p.value = this.cfg.provider || 'openai';
        if (b) b.value = this.cfg.baseUrl || '';
        if (m) m.value = this.cfg.model || '';
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

    // --- Model Fetching ---
    async fetchModels() {
        const baseUrl = (document.getElementById('aiBaseUrl')?.value || '').trim().replace(/\/+$/, '');
        const profileId = this.cfg.activeProfileId || 'temp';
        const apiKey = (document.getElementById('aiApiKey')?.value || '').trim() || this.apiKeyFor(profileId);
        const provider = document.getElementById('aiProvider')?.value || 'openai';
        if (!baseUrl) return alert('请先填写 Base URL');
        if (!apiKey) return alert('请先填写 API Key');
        const statusEl = document.getElementById('aiFetchStatus');
        if (statusEl) statusEl.textContent = '获取模型列表中...';
        try {
            let models = [];
            if (provider === 'gemini') models = await this.fetchGeminiModels(baseUrl, apiKey);
            else models = await this.fetchOpenAIModels(baseUrl, apiKey);
            this.models = models.map(m => ({ ...m, provider }));
            this.lsSet(this.MODELS_KEY, JSON.stringify(this.models));
            this.syncToDataDb();
            this.renderModels(this.models, false);
            if (statusEl) statusEl.textContent = `已获取 ${models.length} 个模型`;
        } catch (e) {
            if (statusEl) statusEl.textContent = '获取失败: ' + e.message;
        }
    },

    async fetchOpenAIModels(baseUrl, apiKey) {
        const res = await fetch(`${baseUrl}/models`, { headers: { 'Authorization': `Bearer ${apiKey}` } });
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        return (json.data || json.models || []).map(m => ({ id: m.id || m.name || '', vision: this.isVisionModel(m.id || m.name || '') }))
            .sort((a, b) => a.vision === b.vision ? a.id.localeCompare(b.id) : (a.vision ? -1 : 1));
    },

    async fetchGeminiModels(baseUrl, apiKey) {
        const res = await fetch(`${baseUrl}/models?key=${apiKey}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        return (json.models || []).map(m => {
            const id = (m.name || '').replace('models/', '');
            return { id, displayName: m.displayName || id, vision: this.isVisionModel(id) || (m.supportedGenerationMethods || []).includes('generateContent') };
        }).sort((a, b) => a.vision === b.vision ? a.id.localeCompare(b.id) : (a.vision ? -1 : 1));
    },

    isVisionModel(id) {
        const s = String(id).toLowerCase();
        return /vision|gpt-4o|gpt-4-turbo|gemini-1\.5|gemini-2|gemini-pro-vision|claude-3|llava|moondream|pixtral|qwen-vl|minicpm-v/.test(s);
    },

    showCachedModels() {
        if (this.models.length) this.renderModels(this.models, false);
    },

    renderModels(models, keepHidden = false) {
        const container = document.getElementById('aiModelList');
        if (!container) return;
        if (models.length === 0) {
            container.innerHTML = '<div class="ai-model-empty">未获取到模型</div>';
            if (!keepHidden) container.classList.remove('hidden');
            return;
        }
        const currentProvider = document.getElementById('aiProvider')?.value || this.cfg.provider || 'openai';
        const filtered = models.filter(m => (m.provider || currentProvider) === currentProvider);
        const vision = filtered.filter(m => m.vision);
        const normal = filtered.filter(m => !m.vision);
        const section = (title, list) => list.length ? `
            <div class="ai-model-group">
                <div class="ai-model-group-title">${title}</div>
                ${list.map(m => `
                    <button class="ai-model-item ${m.vision ? 'has-vision' : ''}" onclick="ai.selectModel('${m.id.replace(/'/g, "\\'")}')">
                        <span class="ai-model-name">${m.id}</span>
                        ${m.vision ? '<span class="ai-vision-badge"><span class="material-symbols-rounded">visibility</span>视觉</span>' : ''}
                    </button>
                `).join('')}
            </div>` : '';
        container.innerHTML = `${section('可处理图片', vision)}${section('文本模型', normal)}`;
        if (!keepHidden) container.classList.remove('hidden');
    },

    selectModel(id) {
        document.getElementById('aiModel').value = id;
        this.cfg.model = id;
        const idx = this.cfg.profiles.findIndex(p => p.id === this.cfg.activeProfileId);
        if (idx >= 0) this.cfg.profiles[idx].model = id;
        this.persist();
        this.syncToDataDb();
        const container = document.getElementById('aiModelList');
        if (container) container.classList.add('hidden');
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
            (cfg.profiles || []).forEach(p => { if (p.apiKey) this.lsSet(this.apiKeyKey(p.id), p.apiKey); });
            this.models = cfg.models || this.models;
            this.lsSet(this.MODELS_KEY, JSON.stringify(this.models));
            this.loadActiveProfileToForm();
            this.persist();
            this.syncToDataDb();
            document.getElementById('aiDecryptPass').value = '';
            this.syncUI();
            alert('AI 配置档案已恢复');
        } catch {
            alert('解密失败：密码错误或数据损坏');
        }
    },

    // --- API Calls ---
    async call(messages, maxTokens = 2000) {
        if (!this.cfg.enabled) throw new Error('请先在设置中配置 AI 接口');
        const key = this.apiKeyFor(this.cfg.activeProfileId);
        if (!key) throw new Error('请先在当前 AI 配置中填写 API Key');
        const url = `${this.cfg.baseUrl}/chat/completions`;
        const body = { model: this.cfg.model, messages, temperature: 0.3, max_tokens: maxTokens };
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` }, body: JSON.stringify(body) });
        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            throw new Error(`AI 请求失败: ${res.status} ${txt.slice(0, 120)}`);
        }
        const d = await res.json();
        return d.choices?.[0]?.message?.content || '';
    },

    async parseFood(text) {
        const prompt = `你是营养师助手。用户描述了食物，请严格只返回 JSON 数组，不要其他文字。\n每个元素格式：{"name":"食物名","grams":克数,"cal":热量kcal,"pro":蛋白质g,"carb":碳水g,"fat":脂肪g}\n如果用户没给克数，用常见份量估算。\n用户描述：${text}`;
        const raw = await this.call([
            { role: 'system', content: '你是营养师助手，只返回纯 JSON 数组，不要 markdown，不要解释。' },
            { role: 'user', content: prompt }
        ]);
        const match = raw.match(/\[[\s\S]*\]/);
        if (!match) throw new Error('AI 返回格式异常');
        return JSON.parse(match[0]);
    },

    async weightLossPlan(params) {
        const { currentWeight, targetWeight, activityLevel, dailyTrainMin, height, weeklyFreq, intensity, sportType } = params;
        const diff = currentWeight - targetWeight;
        const intensityMap = { light: '低强度(散步/瑜伽)', moderate: '中等强度(慢跑/游泳)', vigorous: '高强度(HIIT/快速跑)' };
        const sportMap = { strength: '力量训练', cardio: '有氧运动', mixed: '力量+有氧混合', flexibility: '拉伸/瑜伽' };
        const prompt = `你是运动营养师。请为用户制定减重计划。\n用户信息：\n- 当前体重：${currentWeight} kg\n- 目标体重：${targetWeight} kg（需减 ${diff.toFixed(1)} kg）\n- 身高：${height || '未知'} cm\n- 日常活动水平：${activityLevel}\n- 每次运动时间：${dailyTrainMin} 分钟\n- 每周运动次数：${weeklyFreq} 次\n- 运动强度：${intensityMap[intensity] || intensity}\n- 主要运动项目：${sportMap[sportType] || sportType}\n\n请严格只返回如下 JSON，不要其他文字：\n{\n  "fast": { "days": 天数, "weeklyLoss": 每周减重kg, "dailyCal": 建议每日摄入kcal, "deficit": 每日热量缺口kcal, "desc": "一句话说明" },\n  "moderate": { "days": 天数, "weeklyLoss": 每周减重kg, "dailyCal": 建议每日摄入kcal, "deficit": 每日热量缺口kcal, "desc": "一句话说明" },\n  "slow": { "days": 天数, "weeklyLoss": 每周减重kg, "dailyCal": 建议每日摄入kcal, "deficit": 每日热量缺口kcal, "desc": "一句话说明" },\n  "tips": ["建议1", "建议2", "建议3"]\n}`;
        const raw = await this.call([
            { role: 'system', content: '你是运动营养师，只返回纯 JSON，不要 markdown，不要解释。' },
            { role: 'user', content: prompt }
        ]);
        const match = raw.match(/\{[\s\S]*"fast"[\s\S]*\}/);
        if (!match) throw new Error('AI 返回格式异常');
        return JSON.parse(match[0]);
    }
};
