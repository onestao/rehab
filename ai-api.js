Object.assign(ai, {
    // --- API Calls (统一入口，按 provider 分发) ---
    async call(messages, maxTokens = 2000) {
        if (!this.cfg.enabled) throw new Error('请先在设置中配置 AI 接口');
        const key = this.apiKeyFor(this.cfg.activeProfileId);
        if (!key) throw new Error('请先在当前 AI 配置中填写 API Key');
        const provider = this.cfg.provider || 'openai';
        if (provider === 'claude')           return this._callClaude(messages, maxTokens, key, false);
        if (provider === 'openai-responses') return this._callOpenAIResponses(messages, maxTokens, key, false);
        if (provider === 'gemini')           return this._callGemini(messages, maxTokens, key, false);
        return this._callOpenAIChat(messages, maxTokens, key, false);
    },

    async callStream(messages, maxTokens = 2000, onChunk = () => {}) {
        if (!this.cfg.enabled) throw new Error('请先在设置中配置 AI 接口');
        const key = this.apiKeyFor(this.cfg.activeProfileId);
        if (!key) throw new Error('请先在当前 AI 配置中填写 API Key');
        const provider = this.cfg.provider || 'openai';
        if (provider === 'claude')           return this._callClaude(messages, maxTokens, key, true, onChunk);
        if (provider === 'openai-responses') return this._callOpenAIResponses(messages, maxTokens, key, true, onChunk);
        if (provider === 'gemini')           return this._callGemini(messages, maxTokens, key, true, onChunk);
        return this._callOpenAIChat(messages, maxTokens, key, true, onChunk);
    },

    // ---------- OpenAI Chat Completions ----------
    async _callOpenAIChat(messages, maxTokens, key, stream, onChunk) {
        const url = `${this.cfg.baseUrl}/chat/completions`;
        const body = { model: this.cfg.model, messages, temperature: 0.3, max_tokens: maxTokens };
        if (stream) body.stream = true;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            throw new Error(`AI 请求失败: ${res.status} ${txt.slice(0, 120)}`);
        }
        if (!stream) {
            const raw = await res.text();
            try {
                const d = JSON.parse(raw);
                return d.choices?.[0]?.message?.content || '';
            } catch {
                let content = '';
                const parts = raw.split(/\r?\n/);
                for (const line of parts) {
                    if (!line.startsWith('data:')) continue;
                    const payload = line.slice(5).trim();
                    if (!payload || payload === '[DONE]') continue;
                    try {
                        const json = JSON.parse(payload);
                        content += json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content ?? '';
                    } catch {}
                }
                if (content) return content;
                throw new Error('AI 返回格式异常');
            }
        }
        return this._readSSE(res, onChunk, (json) =>
            json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content ?? ''
        );
    },

    // ---------- OpenAI Responses API（最新 /v1/responses） ----------
    async _callOpenAIResponses(messages, maxTokens, key, stream, onChunk) {
        const url = `${this.cfg.baseUrl}/responses`;
        const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
        const input = messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role,
            content: [{ type: m.role === 'assistant' ? 'output_text' : 'input_text', text: m.content }]
        }));
        const body = {
            model: this.cfg.model,
            input,
            max_output_tokens: maxTokens,
            temperature: 0.3
        };
        if (sys) body.instructions = sys;
        if (stream) body.stream = true;

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            throw new Error(`AI 请求失败: ${res.status} ${txt.slice(0, 120)}`);
        }
        if (!stream) {
            const d = await res.json();
            if (d.output_text) return d.output_text;
            let txt = '';
            for (const item of (d.output || [])) {
                for (const c of (item.content || [])) {
                    if (c.type === 'output_text' || c.type === 'text') txt += c.text || '';
                }
            }
            return txt;
        }
        return this._readSSE(res, onChunk, (json) => {
            if (json.type === 'response.output_text.delta') return json.delta || '';
            return '';
        });
    },

    // ---------- Anthropic Claude Messages API ----------
    async _callClaude(messages, maxTokens, key, stream, onChunk) {
        const url = `${this.cfg.baseUrl}/messages`;
        const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
        const msgs = messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content
        }));
        const body = {
            model: this.cfg.model,
            messages: msgs,
            max_tokens: maxTokens,
            temperature: 0.3
        };
        if (sys) body.system = sys;
        if (stream) body.stream = true;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            throw new Error(`AI 请求失败: ${res.status} ${txt.slice(0, 120)}`);
        }
        if (!stream) {
            const d = await res.json();
            return (d.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
        }
        return this._readSSE(res, onChunk, (json) => {
            if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
                return json.delta.text || '';
            }
            return '';
        });
    },

    // ---------- Gemini ----------
    async _callGemini(messages, maxTokens, key, stream, onChunk) {
        const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
        const contents = messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));
        const action = stream ? `streamGenerateContent?alt=sse&key=${key}` : `generateContent?key=${key}`;
        const url = `${this.cfg.baseUrl}/models/${this.cfg.model}:${action}`;
        const body = {
            contents,
            generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
            ...(sys ? { systemInstruction: { parts: [{ text: sys }] } } : {})
        };
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            throw new Error(`AI 请求失败: ${res.status} ${txt.slice(0, 120)}`);
        }
        if (!stream) {
            const d = await res.json();
            return d.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
        }
        return this._readSSE(res, onChunk, (json) =>
            json.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || ''
        );
    },

    // ---------- 通用 SSE 读取 ----------
    async _readSSE(res, onChunk, extract) {
        if (!res.body) {
            const text = await res.text();
            try {
                const d = JSON.parse(text);
                const t = extract(d);
                if (t) onChunk(t, t);
                return t;
            } catch { return ''; }
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '', full = '';
        const flush = (chunk) => {
            const parts = chunk.split(/\r?\n/).filter(Boolean);
            for (const part of parts) {
                if (!part.startsWith('data:')) continue;
                const payload = part.slice(5).trim();
                if (!payload || payload === '[DONE]') continue;
                try {
                    const json = JSON.parse(payload);
                    const delta = extract(json);
                    if (!delta) continue;
                    full += delta;
                    onChunk(delta, full);
                } catch {}
            }
        };
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split(/\r?\n\r?\n/);
            buffer = events.pop() || '';
            for (const event of events) flush(event);
        }
        if (buffer) flush(buffer);
        return full;
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
        return this.bodyGoalPlan({ ...params, goalType: 'loss' });
    },

    async bodyGoalPlan(params) {
        const { goalType = 'loss', currentWeight, targetWeight, activityLevel, dailyTrainMin, height, weeklyFreq, intensity, sportType, experience, gender = 'male', age = 30 } = params;
        const isGain = goalType === 'gain';
        const diff = isGain ? (targetWeight - currentWeight) : (currentWeight - targetWeight);
        const activityMap = {
            sedentary: '久坐：办公/学习为主，少于5000步/日',
            light: '轻度活动：少量走动，5000-8000步/日',
            moderate: '中等活动：经常走动或站立，8000-12000步/日',
            active: '高强度活动：体力劳动或超过12000步/日'
        };
        const intensityMap = {
            light: '低强度：轻松，可完整说话',
            moderate: '中等强度：明显出汗，可短句交流',
            vigorous: '高强度：很喘，难以连续说话'
        };
        const sportMap = { strength: '力量训练', cardio: '有氧运动', mixed: '力量+有氧混合', flexibility: '拉伸/瑜伽' };
        const experienceMap = {
            beginner: '新手：系统力量训练少于6个月',
            intermediate: '中级：规律训练6个月-2年',
            advanced: '高级：规律训练超过2年，有周期化经验'
        };
        let prompt;
        if (isGain) {
            prompt = `你是运动营养师。请为用户制定增肌计划。\n用户信息：\n- 当前体重：${currentWeight} kg\n- 目标体重：${targetWeight} kg（需增 ${diff.toFixed(1)} kg）\n- 身高：${height || '未知'} cm\n- 日常活动水平：${activityMap[activityLevel] || activityLevel}\n- 每次运动时间：${dailyTrainMin} 分钟\n- 每周运动次数：${weeklyFreq} 次\n- 运动强度：${intensityMap[intensity] || intensity}\n- 主要运动项目：${sportMap[sportType] || sportType}\n- 训练经验：${experienceMap[experience] || experience || '未知'}
- 用户性别：${gender === 'female' ? '女' : '男'}，年龄：${age} 岁。请使用 Mifflin-St Jeor 公式：
  - 男：BMR = 10*体重(kg) + 6.25*身高(cm) - 5*年龄 + 5
  - 女：BMR = 10*体重(kg) + 6.25*身高(cm) - 5*年龄 - 161
  计算 BMR 后再乘以活动系数得到 TDEE，最终热量基于 TDEE 调整。\n\n请严格只返回如下 JSON，不要其他文字：\n{\n  "conservative": { "days": 天数, "weeklyChange": 每周增重kg, "dailyCal": 建议每日摄入kcal, "calorieDelta": 每日热量盈余kcal, "proteinGoal": 蛋白质目标g, "carbGoal": 碳水目标g, "fatGoal": 脂肪目标g, "desc": "一句话说明" },\n  "moderate": { "days": 天数, "weeklyChange": 每周增重kg, "dailyCal": 建议每日摄入kcal, "calorieDelta": 每日热量盈余kcal, "proteinGoal": 蛋白质目标g, "carbGoal": 碳水目标g, "fatGoal": 脂肪目标g, "desc": "一句话说明" },\n  "aggressive": { "days": 天数, "weeklyChange": 每周增重kg, "dailyCal": 建议每日摄入kcal, "calorieDelta": 每日热量盈余kcal, "proteinGoal": 蛋白质目标g, "carbGoal": 碳水目标g, "fatGoal": 脂肪目标g, "desc": "一句话说明" },\n  "tips": ["建议1", "建议2", "建议3"]\n}`;
        } else {
            prompt = `你是运动营养师。请为用户制定减重计划。\n用户信息：\n- 当前体重：${currentWeight} kg\n- 目标体重：${targetWeight} kg（需减 ${diff.toFixed(1)} kg）\n- 身高：${height || '未知'} cm\n- 日常活动水平：${activityMap[activityLevel] || activityLevel}\n- 每次运动时间：${dailyTrainMin} 分钟\n- 每周运动次数：${weeklyFreq} 次\n- 运动强度：${intensityMap[intensity] || intensity}\n- 主要运动项目：${sportMap[sportType] || sportType}\n- 用户性别：${gender === 'female' ? '女' : '男'}，年龄：${age} 岁。请使用 Mifflin-St Jeor 公式：\n  - 男：BMR = 10*体重(kg) + 6.25*身高(cm) - 5*年龄 + 5\n  - 女：BMR = 10*体重(kg) + 6.25*身高(cm) - 5*年龄 - 161\n  计算 BMR 后再乘以活动系数得到 TDEE，最终热量基于 TDEE 调整。\n\n请严格只返回如下 JSON，不要其他文字：\n{\n  "fast": { "days": 天数, "weeklyLoss": 每周减重kg, "dailyCal": 建议每日摄入kcal, "deficit": 每日热量缺口kcal, "proteinGoal": 蛋白质目标g, "carbGoal": 碳水目标g, "fatGoal": 脂肪目标g, "desc": "一句话说明" },\n  "moderate": { "days": 天数, "weeklyLoss": 每周减重kg, "dailyCal": 建议每日摄入kcal, "deficit": 每日热量缺口kcal, "proteinGoal": 蛋白质目标g, "carbGoal": 碳水目标g, "fatGoal": 脂肪目标g, "desc": "一句话说明" },\n  "slow": { "days": 天数, "weeklyLoss": 每周减重kg, "dailyCal": 建议每日摄入kcal, "deficit": 每日热量缺口kcal, "proteinGoal": 蛋白质目标g, "carbGoal": 碳水目标g, "fatGoal": 脂肪目标g, "desc": "一句话说明" },\n  "tips": ["建议1", "建议2", "建议3"]\n}`;
        }
        const raw = await this.call([
            { role: 'system', content: '你是运动营养师，只返回纯 JSON，不要 markdown，不要解释。' },
            { role: 'user', content: prompt }
        ]);
        const match = raw.match(/\{[\s\S]*"tips"[\s\S]*\}/);
        if (!match) throw new Error('AI 返回格式异常');
        return JSON.parse(match[0]);
    }
});
