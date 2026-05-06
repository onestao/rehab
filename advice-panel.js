const advicePanel = {
    attach(target) {
        Object.assign(target, {
            sendAiAdvice: this.sendAiAdvice,
            deleteAiAdviceMessage: this.deleteAiAdviceMessage,
            renderAdviceMessages: this.renderAdviceMessages,
            renderAdviceMessage: this.renderAdviceMessage,
            renderAdvicePanel: this.renderAdvicePanel
        });
    },

    async sendAiAdvice() {
        if (!ai.cfg.enabled) return alert('请先在设置中配置 AI');
        const input = document.getElementById('advicePrompt');
        const prompt = input?.value?.trim();
        if (!prompt) return;
        const history = this.db.history.slice(0, 20);
        const foods = this.todayFoodLogs();
        const weights = this.sortedWeights().slice(-12);
        const exerciseLogs = this.todayExerciseLogs();
        const macros = this.todayMacros();
        const dietGoal = this.db.health.dietGoal || {};
        const model = document.getElementById('adviceModel')?.value || ai.cfg.model;
        const sys = '你是训练与营养健康顾问。基于用户记录给出简洁、可执行的建议。不要输出markdown表格。';
        const user = `用户提问：${prompt}\n\n最近训练记录：${JSON.stringify(history)}\n今日饮食记录：${JSON.stringify(foods)}\n今日宏量营养：${JSON.stringify(macros)}\n当前饮食目标：${JSON.stringify(dietGoal)}\n最近体重记录：${JSON.stringify(weights)}\n今日手动运动：${JSON.stringify(exerciseLogs)}`;
        const oldModel = ai.cfg.model;
        ai.cfg.model = model;
        const statusEl = document.getElementById('adviceStatus');
        if (statusEl) statusEl.textContent = 'AI 分析中...';
        try {
            const reply = await ai.call([{ role: 'system', content: sys }, { role: 'user', content: user }], 1800);
            this.db.health.aiAdviceChat.push({ role: 'user', content: prompt, at: new Date().toISOString() });
            this.db.health.aiAdviceChat.push({ role: 'assistant', content: reply, at: new Date().toISOString(), model });
            input.value = '';
            this.save();
            if (statusEl) statusEl.textContent = '分析完成';
            this.render();
        } catch (e) {
            if (statusEl) statusEl.textContent = '分析失败: ' + e.message;
        } finally {
            ai.cfg.model = oldModel;
        }
    },

    deleteAiAdviceMessage(idx) {
        const messages = this.db.health.aiAdviceChat || [];
        if (idx < 0 || idx >= messages.length) return;
        messages.splice(idx, 1);
        this.db.health.aiAdviceChat = messages;
        this.saveAndBackup();
    },

    renderAdviceMessages(messages) {
        if (!messages.length) return '<div class="empty-state" style="padding:12px"><p>还没有 AI 建议</p></div>';
        const groups = messages.reduce((acc, msg, idx) => {
            const date = this.dateKey(this.parseHistoryDate(msg.at));
            if (!acc[date]) acc[date] = [];
            acc[date].push({ ...msg, idx });
            return acc;
        }, {});
        return Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(date => {
            const collapsed = this.isCollapsed(`advice_${date}`, date !== this.dateKey(new Date()));
            const list = groups[date];
            return `<section class="advice-date-group ${collapsed ? 'collapsed' : ''}">
                <button class="advice-date-head" onclick="data.toggleCollapse('advice_${date}')" type="button">
                    <span class="material-symbols-rounded">event_note</span>
                    <strong>${date}</strong>
                    <small>${list.length} 条</small>
                    <span class="material-symbols-rounded">${collapsed ? 'expand_more' : 'expand_less'}</span>
                </button>
                <div class="advice-date-content">
                    ${list.map(msg => this.renderAdviceMessage(msg)).join('')}
                </div>
            </section>`;
        }).join('');
    },

    renderAdviceMessage(msg) {
        const label = msg.role === 'user' ? '我' : 'AI';
        const time = this.parseHistoryDate(msg.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const model = msg.model ? ` · ${this.escapeHtml(msg.model)}` : '';
        const content = this.escapeHtml(msg.content).replace(/\n/g, '<br>');
        return `<div class="advice-bubble ${msg.role}">
            <div class="advice-bubble-head">
                <b>${label}<small>${time}${model}</small></b>
                <button class="advice-delete-btn" onclick="data.deleteAiAdviceMessage(${msg.idx})" aria-label="删除这条建议"><span class="material-symbols-rounded">delete</span></button>
            </div>
            <p>${content}</p>
        </div>`;
    },

    renderAdvicePanel() {
        const messages = this.db.health.aiAdviceChat || [];
        const modelOptions = (ai.models && ai.models.length ? ai.models : [{ id: ai.cfg.model || '当前配置模型' }]);
        return `<div class="md-card advice-main-card">
            <div class="panel-head">
                <div>
                    <span class="cardio-kicker">AI 分析建议</span>
                    <h3>基于训练 / 饮食 / 体重数据</h3>
                    <small>${messages.length ? `已生成 ${Math.floor(messages.length / 2)} 轮建议` : '可选择模型并提问'}</small>
                </div>
            </div>
            <div class="advice-panel">
                <div class="md-field"><select id="adviceModel">${modelOptions.map(m => `<option value="${m.id}" ${m.id === ai.cfg.model ? 'selected' : ''}>${m.id}</option>`).join('')}</select><label>分析模型</label></div>
                <div class="advice-chat-list">${this.renderAdviceMessages(messages)}</div>
                <div class="md-field span-full"><input type="text" id="advicePrompt" placeholder=" "><label>向 AI 提问，例如：我最近减重停滞的原因是什么？</label></div>
                <div class="advice-actions"><button class="md-btn md-btn-filled" onclick="data.sendAiAdvice()"><span class="material-symbols-rounded">send</span> 获取建议</button><div id="adviceStatus" class="food-ai-status"></div></div>
            </div>
        </div>`;
    }
};

if (typeof window !== 'undefined' && window.data) advicePanel.attach(window.data);
