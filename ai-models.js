// @ts-nocheck
Object.assign(ai, {
    VISION_MODELS_URL: 'assets/vision-models.json',

    async loadVisionWhitelist(force = false) {
        if (this.visionWhitelist && !force) return this.visionWhitelist;
        try {
            const res = await fetch(this.VISION_MODELS_URL, { cache: 'force-cache' });
            if (res.ok) this.visionWhitelist = await res.json();
        } catch {}
        this.visionWhitelist = this.visionWhitelist || { providers: {}, keywords: [], high_res_models: [], exclude_image_gen: [] };
        return this.visionWhitelist;
    },

    visionExtraKeywords() {
        const cfg = this.getEffectiveConfig ? this.getEffectiveConfig() : this.cfg;
        return cfg?.extraVisionKeywords || this.cfg?.extraVisionKeywords || '';
    },

    analyzeVisionModel(id, provider = '') {
        const helper = window.aiVisionPure;
        if (!helper?.analyzeVisionModel) {
            return { vision: this.isVisionModel(id), highRes: false, isImageGen: false, source: 'legacy' };
        }
        return helper.analyzeVisionModel(id, provider || this.cfg?.provider || 'openai', this.visionWhitelist || {}, this.visionExtraKeywords());
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
            await this.loadVisionWhitelist();
            let models = [];
            if (provider === 'gemini') models = await this.fetchGeminiModels(baseUrl, apiKey);
            else if (provider === 'claude') models = await this.fetchClaudeModels(baseUrl, apiKey);
            else models = await this.fetchOpenAIModels(baseUrl, apiKey);
            this.models = models.map(m => ({ ...m, provider }));
            await this.idbSet(this.MODELS_KEY, JSON.stringify(this.models));
            try { localStorage.setItem(this.MODELS_KEY, JSON.stringify(this.models)); } catch {}
            this.persistDataDb(false);
            this.renderModels(this.models, false);
            if (statusEl) statusEl.textContent = `已获取 ${models.length} 个模型`;
        } catch (e) {
            if (statusEl) statusEl.textContent = '获取失败: ' + (window.toast ? toast.sanitize(e) : e.message);
        }
    },

    async fetchOpenAIModels(baseUrl, apiKey) {
        const res = await fetch(`${baseUrl}/models`, { headers: { 'Authorization': `Bearer ${apiKey}` } });
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        return (json.data || json.models || []).map(m => {
            const id = m.id || m.name || '';
            const verdict = this.analyzeVisionModel(id, 'openai');
            return { id, vision: verdict.vision || this.inferVisionFromModelMeta(m), highRes: verdict.highRes, isImageGen: verdict.isImageGen };
        })
            .sort((a, b) => a.isImageGen === b.isImageGen ? (a.vision === b.vision ? a.id.localeCompare(b.id) : (a.vision ? -1 : 1)) : (a.isImageGen ? 1 : -1));
    },

    inferVisionFromModelMeta(model) {
        try {
            if (!model || typeof model !== 'object') return false;
            if (model.vision === true) return true;
            const modalities = [];
            const pushArr = (v) => {
                if (!v) return;
                if (Array.isArray(v)) v.forEach(x => modalities.push(String(x || '')));
                else modalities.push(String(v));
            };
            pushArr(model.modalities);
            pushArr(model.input_modalities);
            pushArr(model.inputModalities);
            pushArr(model.output_modalities);
            pushArr(model.outputModalities);
            if (model.capabilities && typeof model.capabilities === 'object') {
                if (model.capabilities.vision === true) return true;
                pushArr(model.capabilities.modalities);
                pushArr(model.capabilities.input_modalities);
                pushArr(model.capabilities.inputModalities);
            }
            const hasImage = modalities.map(s => s.toLowerCase()).some(s => s.includes('image') || s.includes('vision') || s.includes('multimodal'));
            if (hasImage) return true;
        } catch {}
        return false;
    },

    async fetchGeminiModels(baseUrl, apiKey) {
        const res = await fetch(`${baseUrl}/models?key=${apiKey}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        return (json.models || []).map(m => {
            const id = (m.name || '').replace('models/', '');
            const verdict = this.analyzeVisionModel(id, 'gemini');
            return { id, displayName: m.displayName || id, vision: verdict.vision || (m.supportedGenerationMethods || []).includes('generateContent'), highRes: verdict.highRes, isImageGen: verdict.isImageGen };
        }).sort((a, b) => a.isImageGen === b.isImageGen ? (a.vision === b.vision ? a.id.localeCompare(b.id) : (a.vision ? -1 : 1)) : (a.isImageGen ? 1 : -1));
    },

    async fetchClaudeModels(baseUrl, apiKey) {
        const res = await fetch(`${baseUrl}/models`, {
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            }
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        return (json.data || json.models || []).map(m => ({
            id: m.id || m.name || '',
            displayName: m.display_name || m.id || '',
            ...this.analyzeVisionModel(m.id || m.name || '', 'claude')
        })).sort((a, b) => a.isImageGen === b.isImageGen ? (a.vision === b.vision ? a.id.localeCompare(b.id) : (a.vision ? -1 : 1)) : (a.isImageGen ? 1 : -1));
    },

    isVisionModel(id) {
        const verdict = this.analyzeVisionModel ? this.analyzeVisionModel(id, this.cfg?.provider || 'openai') : null;
        if (verdict && verdict.isImageGen) return false;
        if (verdict && verdict.vision) return true;
        const s = String(id).toLowerCase();
        return /vision|gpt-4o|gpt-4-turbo|gpt-4\.1|gemini-1\.5|gemini-2|gemini-3|gemini-pro-vision|claude-3|claude-4|claude-5|llava|moondream|pixtral|qwen-vl|qwen3-vl|glm-4v|glm-5v|minicpm-v/.test(s);
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
        const esc = window.renderSafe?.escapeHtml || (v => String(v ?? ''));
        const filtered = models.filter(m => (m.provider || currentProvider) === currentProvider).map(m => {
            const verdict = this.analyzeVisionModel(m.id, m.provider || currentProvider);
            return { ...m, vision: !!(m.vision || verdict.vision), highRes: !!(m.highRes || verdict.highRes), isImageGen: !!(m.isImageGen || verdict.isImageGen) };
        });
        const vision = filtered.filter(m => m.vision && !m.isImageGen);
        const imageGen = filtered.filter(m => m.isImageGen);
        const normal = filtered.filter(m => !m.vision && !m.isImageGen);
        const badge = (m) => {
            if (m.isImageGen) return '<span class="ai-vision-badge ai-vision-badge-imagegen"><span class="material-symbols-rounded">palette</span>图像生成</span>';
            if (m.vision) return `<span class="ai-vision-badge"><span class="material-symbols-rounded">visibility</span>视觉</span>${m.highRes ? '<span class="ai-vision-badge ai-vision-badge-highres">高分辨率</span>' : ''}`;
            return '<span class="ai-vision-badge ai-vision-badge-unverified">视觉未验证</span>';
        };
        const section = (title, list) => list.length ? `
            <div class="ai-model-group">
                <div class="ai-model-group-title">${title}</div>
                ${list.map(m => `
                    <button class="ai-model-item ${m.vision ? 'has-vision' : ''} ${m.isImageGen ? 'is-imagegen' : ''}" data-model="${esc(m.id)}" onclick="ai.selectModel(this.dataset.model)">
                        <span class="ai-model-name">${esc(m.id)}</span>
                        ${badge(m)}
                    </button>
                `).join('')}
            </div>` : '';
        container.innerHTML = `${section('可处理图片', vision)}${section('视觉未验证', normal)}${section('图像生成', imageGen)}`;
        if (!keepHidden) container.classList.remove('hidden');
        if (!this.visionWhitelist) {
            this.loadVisionWhitelist().then(() => this.renderModels(models, true)).catch(() => {});
        }
    },

    async selectModel(id) {
        const input = document.getElementById('aiModel');
        if (input) input.value = id;
        this.cfg.model = id;
        const idx = this.cfg.profiles.findIndex(p => p.id === this.cfg.activeProfileId);
        if (idx >= 0) this.cfg.profiles[idx].model = id;
        await this.persist();
        this.persistDataDb(false);
        const container = document.getElementById('aiModelList');
        if (container) container.classList.add('hidden');
    },
});
