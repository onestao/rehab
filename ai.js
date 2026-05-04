const ai = {
    KEY: 'rehab_pro_ai_cfg',
    cfg: { provider: 'openai', model: '', baseUrl: '', enabled: false },
    models: [],

    init() {
        try {
            const saved = localStorage.getItem(this.KEY);
            if (saved) this.cfg = { ...this.cfg, ...JSON.parse(saved) };
        } catch {}
        this.checkEncrypted();
    },

    checkEncrypted() {
        const el = document.getElementById('aiDecryptSection');
        if (el) el.classList.toggle('hidden', !data.db?.encryptedAi);
    },

    saveConfig() {
        this.cfg.provider = document.getElementById('aiProvider').value || 'openai';
        this.cfg.baseUrl = (document.getElementById('aiBaseUrl').value || '').trim().replace(/\/+$/, '');
        const modelEl = document.getElementById('aiModel');
        this.cfg.model = (modelEl?.value || '').trim();
        this.cfg.enabled = !!(this.cfg.baseUrl && this.cfg.model);
        const keyEl = document.getElementById('aiApiKey');
        if (keyEl && keyEl.value.trim()) {
            localStorage.setItem('rehab_pro_ai_key', keyEl.value.trim());
            keyEl.value = '';
        }
        localStorage.setItem(this.KEY, JSON.stringify(this.cfg));
        this.syncUI();
        alert('AI 配置已保存到本地');
    },

    apiKey() { return localStorage.getItem('rehab_pro_ai_key') || ''; },

    syncUI() {
        const p = document.getElementById('aiProvider');
        const b = document.getElementById('aiBaseUrl');
        const m = document.getElementById('aiModel');
        if (p) p.value = this.cfg.provider || 'openai';
        if (b) b.value = this.cfg.baseUrl || '';
        if (m) m.value = this.cfg.model || '';
        const status = document.getElementById('aiStatus');
        if (status) {
            status.textContent = this.cfg.enabled ? '已配置' : '未配置';
            status.className = 'ai-status ' + (this.cfg.enabled ? 'ai-ready' : 'ai-off');
        }
        this.checkEncrypted();
    },

    // --- Model Fetching ---
    async fetchModels() {
        const baseUrl = (document.getElementById('aiBaseUrl')?.value || '').trim().replace(/\/+$/, '');
        const apiKey = (document.getElementById('aiApiKey')?.value || '').trim() || this.apiKey();
        const provider = document.getElementById('aiProvider')?.value || 'openai';
        if (!baseUrl) return alert('请先填写 Base URL');
        if (!apiKey) return alert('请先填写 API Key');
        const statusEl = document.getElementById('aiFetchStatus');
        if (statusEl) statusEl.textContent = '获取模型列表中...';
        try {
            let models = [];
            if (provider === 'gemini') {
                models = await this.fetchGeminiModels(baseUrl, apiKey);
            } else {
                models = await this.fetchOpenAIModels(baseUrl, apiKey);
            }
            this.models = models;
            this.renderModels(models);
            if (statusEl) statusEl.textContent = `已获取 ${models.length} 个模型`;
        } catch (e) {
            if (statusEl) statusEl.textContent = '获取失败: ' + e.message;
        }
    },

    async fetchOpenAIModels(baseUrl, apiKey) {
        const res = await fetch(`${baseUrl}/models`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        const list = (json.data || json.models || []).map(m => ({
            id: m.id || m.name || '',
            vision: this.isVisionModel(m.id || m.name || '')
        }));
        list.sort((a, b) => {
            if (a.vision !== b.vision) return a.vision ? -1 : 1;
            return a.id.localeCompare(b.id);
        });
        return list;
    },

    async fetchGeminiModels(baseUrl, apiKey) {
        const res = await fetch(`${baseUrl}/models?key=${apiKey}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        return (json.models || []).map(m => {
            const id = (m.name || '').replace('models/', '');
            return {
                id,
                displayName: m.displayName || id,
                vision: this.isVisionModel(id) || (m.supportedGenerationMethods || []).includes('generateContent'),
            };
        }).sort((a, b) => {
            if (a.vision !== b.vision) return a.vision ? -1 : 1;
            return a.id.localeCompare(b.id);
        });
    },

    isVisionModel(id) {
        const s = String(id).toLowerCase();
        return /vision|gpt-4o|gpt-4-turbo|gemini-1\.5|gemini-2|gemini-pro-vision|claude-3|llava|moondream|pixtral|qwen-vl|minicpm-v/.test(s);
    },

    renderModels(models) {
        const container = document.getElementById('aiModelList');
        if (!container) return;
        if (models.length === 0) {
            container.innerHTML = '<div class="ai-model-empty">未获取到模型</div>';
            container.classList.remove('hidden');
            return;
        }
        container.innerHTML = models.map(m => `
            <button class="ai-model-item ${m.vision ? 'has-vision' : ''}" onclick="ai.selectModel('${m.id.replace(/'/g, "\\'")}')">
                <span class="ai-model-name">${m.id}</span>
                ${m.vision ? '<span class="ai-vision-badge"><span class="material-symbols-rounded">visibility</span>视觉</span>' : ''}
            </button>
        `).join('');
        container.classList.remove('hidden');
    },

    selectModel(id) {
        document.getElementById('aiModel').value = id;
        this.cfg.model = id;
        const container = document.getElementById('aiModelList');
        if (container) container.classList.add('hidden');
    },

    // --- Encryption (AES-GCM + PBKDF2) ---
    async deriveKey(password, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    },

    toB64(buf) {
        return btoa(String.fromCharCode(...new Uint8Array(buf)));
    },

    fromB64(b64) {
        return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    },

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
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: this.fromB64(obj.i) },
            key,
            this.fromB64(obj.d)
        );
        return new TextDecoder().decode(decrypted);
    },

    async exportToSync() {
        const password = document.getElementById('aiEncryptPass')?.value;
        if (!password || password.length < 4) return alert('请输入至少4位的加密密码');
        const payload = JSON.stringify({
            p: this.cfg.provider,
            b: this.cfg.baseUrl,
            m: this.cfg.model,
            k: this.apiKey()
        });
        try {
            data.db.encryptedAi = await this.encryptData(payload, password);
            data.save();
            document.getElementById('aiEncryptPass').value = '';
            alert('AI 配置已加密并存入同步数据，其他设备输入密码即可恢复');
        } catch (e) { alert('加密失败: ' + e.message); }
    },

    async importFromSync() {
        const password = document.getElementById('aiDecryptPass')?.value;
        if (!password) return alert('请输入解密密码');
        if (!data.db?.encryptedAi) return alert('未找到加密的 AI 配置');
        try {
            const plaintext = await this.decryptData(data.db.encryptedAi, password);
            const cfg = JSON.parse(plaintext);
            this.cfg.provider = cfg.p || 'openai';
            this.cfg.baseUrl = cfg.b || '';
            this.cfg.model = cfg.m || '';
            this.cfg.enabled = !!(this.cfg.baseUrl && this.cfg.model);
            localStorage.setItem(this.KEY, JSON.stringify(this.cfg));
            if (cfg.k) localStorage.setItem('rehab_pro_ai_key', cfg.k);
            document.getElementById('aiDecryptPass').value = '';
            this.syncUI();
            alert('AI 配置已恢复');
        } catch (e) {
            alert('解密失败：密码错误或数据损坏');
        }
    },

    // --- API Calls ---
    async call(messages, maxTokens = 2000) {
        if (!this.cfg.enabled) throw new Error('请先在设置中配置 AI 接口');
        const key = this.apiKey();
        if (!key) throw new Error('请先在设置中填写 API Key');
        const url = `${this.cfg.baseUrl}/chat/completions`;
        const body = { model: this.cfg.model, messages, temperature: 0.3, max_tokens: maxTokens };
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify(body)
        });
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
