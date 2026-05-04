const data = {
    DB_KEY: 'rehab_pro_universal_db',
    CFG_KEY: 'rehab_pro_universal_cfg',
    db: { actions: [], routines: [], history: [], rate: 1.1, cardio: { weight: 70, target: 30, type: 'walk' }, health: { weights: [], foodLogs: [], weightPlan: null } },
    cfg: { mode: 'none', s3: {}, dav: {} },
    historyMonthOffset: 0,
    recordView: 'daily',
    weightRange: 'month',
    historyColors: ['#2563eb', '#7c3aed', '#059669', '#f59e0b', '#e11d48', '#0891b2', '#9333ea', '#ea580c'],

    init() {
        const localDb = localStorage.getItem(this.DB_KEY);
        const localCfg = localStorage.getItem(this.CFG_KEY);
        if (localDb) this.db = JSON.parse(localDb);
        else this.migrateLegacy();
        if (localCfg) this.cfg = JSON.parse(localCfg);
        this.db.cardio = { weight: 70, target: 30, type: 'walk', ...(this.db.cardio || {}) };
        this.db.health = { weights: [], foodLogs: [], weightPlan: null, ...(this.db.health || {}) };
        this.db.health.weights = this.db.health.weights || [];
        this.db.health.foodLogs = this.db.health.foodLogs || [];
        if (window.ai) ai.init();
        this.render();
        sync.initUI();
        if (window.cardio) cardio.initUI();
    },

    migrateLegacy() {
        const legacy = ['rp_v31_db', 'rp_v28_db', 'rp_v21_main'];
        for (let key of legacy) {
            let old = localStorage.getItem(key);
            if (old) { this.db = JSON.parse(old); this.save(); break; }
        }
    },

    save() {
        localStorage.setItem(this.DB_KEY, JSON.stringify(this.db));
        this.render();
    },

    async saveAndBackup() {
        this.save();
        await sync.autoBackup('history');
    },

    addAction() {
        const a = {
            name: document.getElementById('name').value || '未命名',
            sets: parseInt(document.getElementById('sets').value) || 1,
            reps: parseInt(document.getElementById('reps').value) || 1,
            work: parseInt(document.getElementById('work').value) || 5,
            repRest: parseInt(document.getElementById('repRest').value) || 2,
            actionRest: parseInt(document.getElementById('actionRest').value) || 10,
            groupRest: parseInt(document.getElementById('groupRest').value) || 15,
            switchRest: 3,
            isAlt: document.getElementById('isAlt').checked
        };
        this.db.actions.push(a);
        this.save();
        document.getElementById('name').value = '';
    },

    saveRoutine() {
        const nameInput = document.getElementById('newRoutineName');
        const name = nameInput.value.trim();
        if (!name) return alert('请输入方案名称');
        if (this.db.actions.length === 0) return alert('请先添加训练动作');
        this.db.routines.push({
            name,
            actions: JSON.parse(JSON.stringify(this.db.actions)),
            created: new Date().toLocaleDateString()
        });
        nameInput.value = '';
        this.save();
        alert('方案 "' + name + '" 已保存');
    },

    loadRoutine(idx) {
        const r = this.db.routines[idx];
        if (!r) return;
        this.db.actions = JSON.parse(JSON.stringify(r.actions));
        this.save();
        ui.tab('workout', document.querySelector('.nav-item'));
    },

    deleteRoutine(idx) {
        this.db.routines.splice(idx, 1);
        this.save();
    },

    deleteHistory(idx) {
        this.db.history.splice(idx, 1);
        this.save();
    },

    shiftHistoryMonth(delta) {
        this.historyMonthOffset += delta;
        this.renderHistory();
    },

    setRecordView(view) {
        this.recordView = view;
        this.renderHistory();
    },

    setWeightRange(range) {
        this.weightRange = range;
        this.renderHistory();
    },

    addWeight() {
        const date = document.getElementById('weightDate').value || this.dateKey(new Date());
        const weight = parseFloat(document.getElementById('weightValue').value);
        const note = document.getElementById('weightNote').value.trim();
        if (!weight || weight <= 0) return alert('请输入有效体重');
        this.db.health = this.db.health || { weights: [] };
        this.db.health.weights = this.db.health.weights || [];
        this.db.health.weights.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            date,
            weight,
            note,
            createdAt: new Date().toISOString()
        });
        this.db.health.weights.sort((a, b) => new Date(b.date) - new Date(a.date));
        document.getElementById('weightValue').value = '';
        document.getElementById('weightNote').value = '';
        this.saveAndBackup();
    },

    deleteWeight(id) {
        this.db.health.weights = (this.db.health.weights || []).filter(w => w.id !== id);
        this.saveAndBackup();
    },

    // --- Food Logging ---
    addFoodLog() {
        const name = document.getElementById('foodName')?.value?.trim();
        const grams = parseFloat(document.getElementById('foodGrams')?.value);
        const cal = parseFloat(document.getElementById('foodCal')?.value);
        const meal = document.getElementById('foodMeal')?.value || 'lunch';
        if (!name) return alert('请输入食物名称');
        if (!cal || cal <= 0) return alert('请输入有效热量');
        const log = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            date: this.dateKey(new Date()),
            meal,
            name,
            grams: grams || 0,
            cal: grams ? Math.round(cal * grams / 100) : Math.round(cal),
            calPer100g: grams ? cal : 0,
            createdAt: new Date().toISOString()
        };
        this.db.health.foodLogs.push(log);
        if (document.getElementById('foodName')) document.getElementById('foodName').value = '';
        if (document.getElementById('foodGrams')) document.getElementById('foodGrams').value = '';
        if (document.getElementById('foodCal')) document.getElementById('foodCal').value = '';
        this._aiFoodResults = [];
        this._aiFoodAdded = null;
        const searchEl = document.getElementById('foodSearchResults');
        if (searchEl) searchEl.innerHTML = '';
        this.saveAndBackup();
    },

    deleteFoodLog(id) {
        this.db.health.foodLogs = (this.db.health.foodLogs || []).filter(f => f.id !== id);
        this.saveAndBackup();
    },

    todayFoodLogs() {
        const today = this.dateKey(new Date());
        return (this.db.health.foodLogs || []).filter(f => f.date === today);
    },

    todayCalories() {
        return this.todayFoodLogs().reduce((sum, f) => sum + (f.cal || 0), 0);
    },

    todayTrainingCalories() {
        const today = this.dateKey(new Date());
        return this.db.history
            .filter(h => this.dateKey(this.parseHistoryDate(h.date)) === today)
            .reduce((sum, h) => sum + (h.cardio?.calories || 0), 0);
    },

    applyFoodItem(id) {
        const item = fooddb.getAll().find(f => f.id === id);
        if (!item) return;
        if (document.getElementById('foodName')) document.getElementById('foodName').value = item.name;
        if (document.getElementById('foodCal')) document.getElementById('foodCal').value = item.cal;
        if (document.getElementById('foodGrams')) document.getElementById('foodGrams').value = '';
        document.getElementById('foodSearchResults').innerHTML = '';
        this._aiFoodResults = [];
        this._aiFoodAdded = null;
    },

    onFoodSearchInput() {
        const kw = document.getElementById('foodName')?.value?.trim() || '';
        const results = fooddb.searchAll(kw);
        const el = document.getElementById('foodSearchResults');
        if (!el) return;
        if (!kw || results.length === 0) { el.innerHTML = ''; return; }
        el.innerHTML = results.map(item =>
            `<button class="food-result-item" onclick="data.applyFoodItem('${item.id}')"><span>${item.name}</span><small>${item.cal} kcal/100g</small></button>`
        ).join('');
    },

    async aiParseFood() {
        const input = document.getElementById('foodName');
        const text = input?.value?.trim();
        if (!text) {
            if (input) { input.focus(); input.placeholder = '例如：一碗米饭加一个鸡蛋'; }
            const statusEl = document.getElementById('foodAiStatus');
            if (statusEl) statusEl.textContent = '请先输入食物描述';
            setTimeout(() => { if (input) input.placeholder = ' '; }, 3000);
            return;
        }
        if (!ai.cfg.enabled) return alert('请先在设置中配置 AI 接口');
        const statusEl = document.getElementById('foodAiStatus');
        if (statusEl) statusEl.textContent = 'AI 分析中...';
        try {
            const items = await ai.parseFood(text);
            if (!items.length) throw new Error('未识别到食物');
            this._aiFoodResults = items;
            this.renderAiFoodResults();
            if (statusEl) statusEl.textContent = `AI 已识别 ${items.length} 项，点击逐个添加或批量添加`;
        } catch (e) {
            if (statusEl) statusEl.textContent = 'AI 识别失败: ' + e.message;
        }
    },

    renderAiFoodResults() {
        const items = this._aiFoodResults || [];
        const el = document.getElementById('foodSearchResults');
        if (!el) return;
        if (items.length === 0) { el.innerHTML = ''; return; }
        el.innerHTML = `
            <button class="food-result-item food-add-all" onclick="data.addAllAiFoods()"><span class="material-symbols-rounded">done_all</span><span>全部添加</span><small>${items.length} 项 · ${items.reduce((s, i) => s + (i.cal || 0), 0)} kcal</small></button>
            ${items.map((item, idx) => {
                const added = this._aiFoodAdded && this._aiFoodAdded.has(idx);
                return `<div class="food-result-item food-ai-result ${added ? 'food-added' : ''}">
                    <span>${item.name} ${item.grams ? item.grams + 'g' : ''}</span>
                    <small>${item.cal} kcal${item.pro ? ' · 蛋白' + item.pro + 'g' : ''}</small>
                    ${added
                        ? '<span class="food-added-badge">已添加</span>'
                        : `<button class="food-add-btn" onclick="data.addSingleAiFood(${idx})"><span class="material-symbols-rounded">add</span></button>`}
                </div>`;
            }).join('')}`;
    },

    addSingleAiFood(idx) {
        const items = this._aiFoodResults || [];
        const item = items[idx];
        if (!item) return;
        if (!this._aiFoodAdded) this._aiFoodAdded = new Set();
        const meal = document.getElementById('foodMeal')?.value || 'lunch';
        this.db.health.foodLogs.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${idx}`,
            date: this.dateKey(new Date()),
            meal,
            name: item.name,
            grams: item.grams || 0,
            cal: Math.round(item.cal || 0),
            calPer100g: item.grams ? Math.round(item.cal * 100 / item.grams) : 0,
            createdAt: new Date().toISOString()
        });
        this._aiFoodAdded.add(idx);
        this.renderAiFoodResults();
        this.save();
    },

    addAllAiFoods() {
        const items = this._aiFoodResults || [];
        if (items.length === 0) return;
        if (!this._aiFoodAdded) this._aiFoodAdded = new Set();
        const meal = document.getElementById('foodMeal')?.value || 'lunch';
        items.forEach((item, idx) => {
            if (this._aiFoodAdded.has(idx)) return;
            this.db.health.foodLogs.push({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${idx}`,
                date: this.dateKey(new Date()),
                meal,
                name: item.name,
                grams: item.grams || 0,
                cal: Math.round(item.cal || 0),
                calPer100g: item.grams ? Math.round(item.cal * 100 / item.grams) : 0,
                createdAt: new Date().toISOString()
            });
            this._aiFoodAdded.add(idx);
        });
        this.renderAiFoodResults();
        this.saveAndBackup();
    },

    clearAiResults() {
        this._aiFoodResults = [];
        this._aiFoodAdded = null;
        const el = document.getElementById('foodSearchResults');
        if (el) el.innerHTML = '';
        const statusEl = document.getElementById('foodAiStatus');
        if (statusEl) statusEl.textContent = '';
    },

    applyAiFood(item) {
        if (document.getElementById('foodName')) document.getElementById('foodName').value = item.name;
        if (document.getElementById('foodGrams')) document.getElementById('foodGrams').value = item.grams || '';
        if (document.getElementById('foodCal')) document.getElementById('foodCal').value = item.cal || '';
        document.getElementById('foodSearchResults').innerHTML = '';
    },

    // --- Weight Loss Plan ---
    async requestWeightLossPlan() {
        const latest = this.sortedWeights().slice(-1)[0];
        const currentWeight = latest?.weight || 70;
        const targetWeight = parseFloat(document.getElementById('planTargetWeight')?.value);
        const height = parseFloat(document.getElementById('planHeight')?.value);
        const activityLevel = document.getElementById('planActivity')?.value || 'sedentary';
        const dailyTrainMin = parseInt(document.getElementById('planTrainMin')?.value) || 30;
        const weeklyFreq = parseInt(document.getElementById('planWeeklyFreq')?.value) || 3;
        const intensity = document.getElementById('planIntensity')?.value || 'moderate';
        const sportType = document.getElementById('planSportType')?.value || 'mixed';
        if (!targetWeight || targetWeight <= 0) return alert('请输入目标体重');
        if (targetWeight >= currentWeight) return alert('目标体重需低于当前体重');
        const statusEl = document.getElementById('planStatus');
        if (statusEl) statusEl.textContent = 'AI 分析中...';
        try {
            const plan = await ai.weightLossPlan({ currentWeight, targetWeight, activityLevel, dailyTrainMin, height, weeklyFreq, intensity, sportType });
            this.db.health.weightPlan = plan;
            this.save();
            if (statusEl) statusEl.textContent = 'AI 方案已生成，请选择';
            this.renderHistory();
        } catch (e) {
            if (statusEl) statusEl.textContent = '生成失败: ' + e.message;
            alert('AI 减重方案生成失败: ' + e.message);
        }
    },

    applyWeightLossPlan(pace) {
        const plan = this.db.health.weightPlan;
        if (!plan || !plan[pace]) return alert('请先生成 AI 减重方案');
        const p = plan[pace];
        this.db.health.dietGoal = {
            pace,
            dailyCal: p.dailyCal,
            deficit: p.deficit,
            weeklyLoss: p.weeklyLoss,
            days: p.days,
            appliedAt: new Date().toISOString()
        };
        this.saveAndBackup();
        alert(`已应用${pace === 'fast' ? '快速' : pace === 'moderate' ? '中等' : '慢速'}方案：每日 ${p.dailyCal} kcal`);
        this.renderHistory();
    },

    render() {
        this.renderActions();
        this.renderRoutines();
        this.renderHistory();
    },

    renderActions() {
        const list = document.getElementById('currentActionList');
        if (!list) return;
        if (this.db.actions.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">playlist_add</span>
                    <p>还没有动作，添加一个开始吧</p>
                </div>`;
            return;
        }
        list.innerHTML = this.db.actions.map((a, i) => `
            <div class="list-item">
                <div class="sort-btns">
                    <button class="sort-btn" onclick="data.move(${i},-1)"><span class="material-symbols-rounded">expand_less</span></button>
                    <button class="sort-btn" onclick="data.move(${i},1)"><span class="material-symbols-rounded">expand_more</span></button>
                </div>
                <div style="flex:1;min-width:0">
                    <strong>${a.name}</strong>
                    <small>${a.sets}组 &middot; ${a.reps}次 &middot; ${a.work}s</small>
                    <div class="item-chip">组休${a.actionRest}s &middot; 项休${a.groupRest}s${a.isAlt ? ' &middot; 双侧' : ''}</div>
                </div>
                <button class="delete-btn" onclick="data.db.actions.splice(${i},1);data.save();"><span class="material-symbols-rounded">delete</span></button>
            </div>`).join('');
    },

    renderRoutines() {
        const list = document.getElementById('routineList');
        if (!list) return;
        if (this.db.routines.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">bookmark_border</span>
                    <p>暂无保存的方案</p>
                </div>`;
            return;
        }
        list.innerHTML = this.db.routines.map((r, i) => `
            <div class="list-item">
                <div style="flex:1;min-width:0">
                    <strong>${r.name}</strong>
                    <small>${r.actions.length}个动作 &middot; ${r.created}</small>
                </div>
                <button class="md-btn md-btn-tonal" style="flex:none;padding:0 14px;height:32px;font-size:12px" onclick="data.loadRoutine(${i})">载入</button>
                <button class="delete-btn" onclick="data.deleteRoutine(${i})"><span class="material-symbols-rounded">delete</span></button>
            </div>`).join('');
    },

    renderHistory() {
        const list = document.getElementById('historyList');
        if (!list) return;
        list.innerHTML = `
            <div class="record-tabs" role="tablist" aria-label="记录视图">
                <button class="record-tab ${this.recordView === 'daily' ? 'active' : ''}" onclick="data.setRecordView('daily')"><span class="material-symbols-rounded">today</span>每日行动</button>
                <button class="record-tab ${this.recordView === 'calendar' ? 'active' : ''}" onclick="data.setRecordView('calendar')"><span class="material-symbols-rounded">calendar_month</span>健身日历</button>
            </div>
            ${this.recordView === 'daily' ? this.renderDailyActions() : this.renderFitnessCalendar()}`;
    },

    renderDailyActions() {
        return `
            ${this.renderWeightPanel()}
            ${this.renderDietPanel()}
            ${this.renderWeightLossPanel()}
            <div class="record-section-title">今日行动</div>
            ${this.renderTodaySummary()}
            <div class="record-section-title">训练明细</div>
            ${this.renderHistoryList()}`;
    },

    renderFitnessCalendar() {
        return `
            ${this.renderHistoryCalendar()}
            <div class="record-section-title">记录明细</div>
            ${this.renderHistoryList()}`;
    },

    renderHistoryList() {
        if (this.db.history.length === 0) {
            return `<div class="empty-state"><span class="material-symbols-rounded">event_note</span><p>暂无训练记录，完成一次训练后自动记录</p></div>`;
        }
        return this.db.history.map((h, i) => {
            const mins = Math.floor(h.duration / 60);
            const secs = h.duration % 60;
            const names = this.historyNames(h).join('、');
            const meta = h.type === 'cardio'
                ? `${Math.round(h.cardio.calories || 0)} kcal &middot; ${h.cardio.weight || 0}kg`
                : `${h.actions.length}个动作`;
            const icon = this.historyIcon(h);
            return `<div class="list-item">
                <span class="record-icon material-symbols-rounded">${icon}</span>
                <div style="flex:1;min-width:0">
                    <strong>${h.date}</strong>
                    <small>${mins}分${secs}秒 &middot; ${meta}</small>
                    <div class="item-chip">${names.length > 20 ? names.slice(0, 20) + '...' : names}</div>
                </div>
                <button class="delete-btn" onclick="data.deleteHistory(${i})"><span class="material-symbols-rounded">delete</span></button>
            </div>`;
        }).join('');
    },

    renderTodaySummary() {
        const today = this.dateKey(new Date());
        const entries = this.db.history.filter(h => this.dateKey(this.parseHistoryDate(h.date)) === today);
        const minutes = Math.round(entries.reduce((sum, h) => sum + (h.duration || 0), 0) / 60);
        const calories = Math.round(entries.reduce((sum, h) => sum + (h.cardio?.calories || 0), 0));
        const names = this.uniqueActionNames(entries);
        const intake = this.todayCalories();
        const dietGoal = this.db.health.dietGoal;
        const goalCal = dietGoal?.dailyCal || 0;
        const net = intake - calories;
        return `<div class="md-card daily-summary-card">
            <div class="daily-stat"><span class="material-symbols-rounded">timer</span><b>${minutes}</b><small>训练分钟</small></div>
            <div class="daily-stat"><span class="material-symbols-rounded">local_fire_department</span><b>${calories}</b><small>运动消耗</small></div>
            <div class="daily-stat"><span class="material-symbols-rounded">restaurant</span><b>${intake}</b><small>摄入 kcal</small></div>
            <div class="daily-stat"><span class="material-symbols-rounded">balance</span><b>${net > 0 ? '+' : ''}${net}</b><small>净热量</small></div>
            ${goalCal ? `<div class="daily-stat goal-stat"><span class="material-symbols-rounded">flag</span><b>${goalCal}</b><small>目标 kcal</small></div>` : ''}
            <div class="daily-stat"><span class="material-symbols-rounded">fitness_center</span><b>${names.length}</b><small>项目数</small></div>
        </div>`;
    },

    renderDietPanel() {
        const todayLogs = this.todayFoodLogs();
        const totalCal = this.todayCalories();
        const mealGroups = { breakfast: [], lunch: [], dinner: [], snack: [] };
        todayLogs.forEach(f => { (mealGroups[f.meal] || mealGroups.snack).push(f); });
        const mealNames = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
        return `<div class="md-card diet-card">
            <div class="diet-head">
                <div>
                    <span class="cardio-kicker">饮食记录</span>
                    <h3>${totalCal} kcal</h3>
                    <small>今日摄入 · ${todayLogs.length} 条记录</small>
                </div>
                <span class="material-symbols-rounded diet-icon">restaurant</span>
            </div>
            <div class="diet-input-area">
                <div class="md-grid diet-input-grid">
                    <div class="md-field"><select id="foodMeal"><option value="breakfast">早餐</option><option value="lunch" selected>午餐</option><option value="dinner">晚餐</option><option value="snack">加餐</option></select><label>餐次</label></div>
                    <div class="md-field"><input type="number" id="foodGrams" step="1" placeholder=" "><label>克数</label></div>
                    <div class="md-field span-full"><input type="text" id="foodName" placeholder=" " oninput="data.onFoodSearchInput()"><label>食物名称</label></div>
                    <div class="md-field"><input type="number" id="foodCal" step="1" placeholder=" "><label>kcal/100g</label></div>
                    <div class="diet-btn-row">
                        <button class="md-btn md-btn-filled" onclick="data.addFoodLog()"><span class="material-symbols-rounded">add</span> 添加</button>
                        <button class="md-btn md-btn-tonal" onclick="data.aiParseFood()" title="AI 智能识别"><span class="material-symbols-rounded">psychology</span></button>
                    </div>
                </div>
                <div id="foodSearchResults" class="food-search-results"></div>
                <div id="foodAiStatus" class="food-ai-status"></div>
            </div>
            ${Object.entries(mealGroups).map(([key, items]) => {
                if (items.length === 0) return '';
                const subTotal = items.reduce((s, f) => s + f.cal, 0);
                return `<div class="diet-meal-group">
                    <div class="diet-meal-title">${mealNames[key]} <small>${subTotal} kcal</small></div>
                    ${items.map(f => `<div class="diet-log-item">
                        <span>${f.name}${f.grams ? ' ' + f.grams + 'g' : ''}</span>
                        <b>${f.cal} kcal</b>
                        <button class="delete-btn" onclick="data.deleteFoodLog('${f.id}')"><span class="material-symbols-rounded">delete</span></button>
                    </div>`).join('')}
                </div>`;
            }).join('')}
        </div>`;
    },

    renderWeightLossPanel() {
        const plan = this.db.health.weightPlan;
        const goal = this.db.health.dietGoal;
        const latest = this.sortedWeights().slice(-1)[0];
        const currentWeight = latest?.weight || '';
        return `<div class="md-card weightloss-card">
            <div class="weightloss-head">
                <div>
                    <span class="cardio-kicker">AI 减重指导</span>
                    <h3>制定减重计划</h3>
                    <small>${goal ? `当前方案：${goal.pace === 'fast' ? '快速' : goal.pace === 'moderate' ? '中等' : '慢速'} · 每日 ${goal.dailyCal} kcal` : '填写信息后 AI 帮你生成方案'}</small>
                </div>
                <span class="material-symbols-rounded weightloss-icon">trending_down</span>
            </div>
            <div class="weightloss-form">
                <div class="md-grid weightloss-grid">
                    <div class="md-field"><input type="number" id="planTargetWeight" step="0.1" placeholder=" "><label>目标体重 kg</label></div>
                    <div class="md-field"><input type="number" id="planHeight" step="1" placeholder=" "><label>身高 cm</label></div>
                    <div class="md-field"><select id="planActivity"><option value="sedentary">久坐</option><option value="light">轻度活动</option><option value="moderate">中等活动</option><option value="active">高强度活动</option></select><label>日常活动水平</label></div>
                    <div class="md-field"><input type="number" id="planTrainMin" value="30" step="5" placeholder=" "><label>每次运动分钟</label></div>
                    <div class="md-field"><input type="number" id="planWeeklyFreq" value="3" step="1" min="0" max="7" placeholder=" "><label>每周运动次数</label></div>
                    <div class="md-field"><select id="planIntensity"><option value="light">低强度</option><option value="moderate" selected>中等强度</option><option value="vigorous">高强度</option></select><label>运动强度</label></div>
                    <div class="md-field span-full"><select id="planSportType"><option value="strength">力量训练</option><option value="cardio">有氧运动</option><option value="mixed" selected>力量+有氧混合</option><option value="flexibility">拉伸/瑜伽</option></select><label>主要运动项目</label></div>
                </div>
                <button class="md-btn md-btn-filled" onclick="data.requestWeightLossPlan()"><span class="material-symbols-rounded">psychology</span> AI 生成减重方案</button>
                <div id="planStatus" class="food-ai-status"></div>
            </div>
            ${plan ? `<div class="weightloss-options">
                ${['fast', 'moderate', 'slow'].map(pace => {
                    const p = plan[pace];
                    if (!p) return '';
                    const isActive = goal?.pace === pace;
                    const label = pace === 'fast' ? '快速' : pace === 'moderate' ? '中等' : '慢速';
                    return `<div class="weightloss-option ${isActive ? 'active' : ''}" onclick="data.applyWeightLossPlan('${pace}')">
                        <div class="weightloss-option-head">
                            <b>${label}</b>
                            ${isActive ? '<span class="item-chip">当前方案</span>' : ''}
                        </div>
                        <div class="weightloss-option-stats">
                            <span>${p.weeklyLoss} kg/周</span>
                            <span>${p.days} 天</span>
                            <b>${p.dailyCal} kcal/日</b>
                        </div>
                        <small>${p.desc || ''}</small>
                    </div>`;
                }).join('')}
                ${plan.tips ? `<div class="weightloss-tips">${plan.tips.map(t => `<span><span class="material-symbols-rounded">check_circle</span>${t}</span>`).join('')}</div>` : ''}
            </div>` : ''}
        </div>`;
    },

    renderWeightPanel() {
        const weights = this.sortedWeights();
        const latest = weights[weights.length - 1];
        const previous = weights[weights.length - 2];
        const delta = latest && previous ? latest.weight - previous.weight : 0;
        const analysis = this.weightAnalysis();
        return `<div class="md-card weight-card">
            <div class="weight-head">
                <div>
                    <span class="cardio-kicker">体重管理</span>
                    <h3>${latest ? `${latest.weight.toFixed(1)} kg` : '-- kg'}</h3>
                    <small>${latest ? `${latest.date}${delta ? ` · 较上次 ${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg` : ''}` : '点击下方添加第一条体重记录'}</small>
                </div>
                <span class="material-symbols-rounded weight-icon">monitor_weight</span>
            </div>
            <div class="weight-input-row">
                <div class="md-field"><input type="date" id="weightDate" value="${this.dateKey(new Date())}" placeholder=" "><label>日期</label></div>
                <div class="md-field"><input type="number" id="weightValue" step="0.1" placeholder=" "><label>体重 kg</label></div>
                <div class="md-field span-full"><input type="text" id="weightNote" placeholder=" "><label>备注</label></div>
                <button class="md-btn md-btn-filled span-full" onclick="data.addWeight()"><span class="material-symbols-rounded">add</span> 添加体重记录</button>
            </div>
            <div class="weight-range-tabs">
                ${['week','month','year'].map(r => `<button class="weight-range ${this.weightRange === r ? 'active' : ''}" onclick="data.setWeightRange('${r}')">${r === 'week' ? '周' : r === 'month' ? '月' : '年'}</button>`).join('')}
            </div>
            ${this.renderWeightChart()}
            <div class="weight-analysis">
                <div><b>${analysis.avgText}</b><small>日均变化</small></div>
                <div><b>${analysis.trend}</b><small>阶段判断</small></div>
            </div>
            ${this.renderWeightList(weights.slice(-5).reverse())}
        </div>`;
    },

    renderWeightChart() {
        const points = this.weightPointsForRange();
        if (points.length < 2) return `<div class="weight-empty-chart"><span class="material-symbols-rounded">show_chart</span><p>至少需要 2 条记录生成曲线</p></div>`;
        const values = points.map(p => p.weight);
        const min = Math.min(...values) - 0.5;
        const max = Math.max(...values) + 0.5;
        const width = 320;
        const height = 150;
        const pad = 18;
        const coords = points.map((p, i) => {
            const x = pad + (i / (points.length - 1)) * (width - pad * 2);
            const y = height - pad - ((p.weight - min) / (max - min || 1)) * (height - pad * 2);
            return { ...p, x, y };
        });
        const path = coords.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        return `<div class="weight-chart-wrap">
            <svg class="weight-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="体重变化曲线">
                <path class="weight-grid-line" d="M${pad},${pad} H${width - pad} M${pad},${height / 2} H${width - pad} M${pad},${height - pad} H${width - pad}" />
                <path class="weight-line" d="${path}" />
                ${coords.map(p => `<circle class="weight-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4"><title>${p.date}: ${p.weight}kg</title></circle>`).join('')}
            </svg>
            <div class="weight-chart-labels"><span>${points[0].date.slice(5)}</span><span>${points[points.length - 1].date.slice(5)}</span></div>
        </div>`;
    },

    renderWeightList(weights) {
        if (weights.length === 0) return '';
        return `<div class="weight-list">
            ${weights.map(w => `<div class="weight-list-item"><span>${w.date}</span><b>${w.weight.toFixed(1)} kg</b><button class="delete-btn" onclick="data.deleteWeight('${w.id}')"><span class="material-symbols-rounded">delete</span></button></div>`).join('')}
        </div>`;
    },

    sortedWeights() {
        return [...(this.db.health?.weights || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
    },

    weightPointsForRange() {
        const days = this.weightRange === 'week' ? 7 : this.weightRange === 'month' ? 31 : 366;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        return this.sortedWeights().filter(w => new Date(w.date) >= cutoff);
    },

    weightAnalysis() {
        const points = this.weightPointsForRange();
        if (points.length < 2) return { avgText: '-- kg/日', trend: '记录不足' };
        const first = points[0];
        const last = points[points.length - 1];
        const days = Math.max(1, Math.round((new Date(last.date) - new Date(first.date)) / 86400000));
        const total = last.weight - first.weight;
        const avg = total / days;
        const trend = Math.abs(avg) < 0.01 ? '基本不变' : avg < 0 ? '下降趋势' : '上升趋势';
        return { avgText: `${avg > 0 ? '+' : ''}${avg.toFixed(2)} kg/日`, trend };
    },

    renderHistoryCalendar() {
        const view = new Date();
        view.setDate(1);
        view.setMonth(view.getMonth() + this.historyMonthOffset);
        const year = view.getFullYear();
        const month = view.getMonth();
        const first = new Date(year, month, 1);
        const days = new Date(year, month + 1, 0).getDate();
        const leading = (first.getDay() + 6) % 7;
        const byDate = this.groupHistoryByDate();
        const cells = [];
        for (let i = 0; i < leading; i++) cells.push('<div class="calendar-day empty"></div>');
        for (let day = 1; day <= days; day++) {
            const key = this.dateKey(new Date(year, month, day));
            const entries = byDate[key] || [];
            const names = this.uniqueActionNames(entries).slice(0, 3);
            const totalMin = Math.round(entries.reduce((sum, h) => sum + (h.duration || 0), 0) / 60);
            cells.push(`
                <div class="calendar-day ${entries.length ? 'has-record' : ''}">
                    <div class="calendar-day-head">
                        <span>${day}</span>
                        ${entries.length ? `<b>${totalMin}分</b>` : ''}
                    </div>
                    <div class="calendar-events">
                        ${names.map(name => `
                            <span class="calendar-event" style="--event-color:${this.actionColor(name)}"><span class="material-symbols-rounded">${this.sportIcon(name)}</span>${this.shortName(name)}</span>
                        `).join('')}
                    </div>
                </div>`);
        }
        return `
            <div class="md-card calendar-card">
                <div class="calendar-toolbar">
                    <button class="icon-btn" onclick="data.shiftHistoryMonth(-1)" aria-label="上个月"><span class="material-symbols-rounded">chevron_left</span></button>
                    <strong>${year}年 ${month + 1}月</strong>
                    <button class="icon-btn" onclick="data.shiftHistoryMonth(1)" aria-label="下个月"><span class="material-symbols-rounded">chevron_right</span></button>
                </div>
                <div class="calendar-weekdays">
                    ${['一', '二', '三', '四', '五', '六', '日'].map(d => `<span>${d}</span>`).join('')}
                </div>
                <div class="calendar-grid">${cells.join('')}</div>
                ${this.renderHistoryLegend()}
            </div>`;
    },

    renderHistoryLegend() {
        const names = this.uniqueActionNames(this.db.history).slice(0, 6);
        if (names.length === 0) return '';
        return `
            <div class="calendar-legend">
                ${names.map(name => `<span><i style="background:${this.actionColor(name)}"></i>${name}</span>`).join('')}
            </div>`;
    },

    groupHistoryByDate() {
        return this.db.history.reduce((map, h) => {
            const key = this.dateKey(this.parseHistoryDate(h.date));
            if (!map[key]) map[key] = [];
            map[key].push(h);
            return map;
        }, {});
    },

    parseHistoryDate(value) {
        const direct = new Date(value);
        if (!Number.isNaN(direct.getTime())) return direct;
        const match = String(value || '').match(/(\d{4})[\/\-年.](\d{1,2})[\/\-月.](\d{1,2})/);
        if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        return new Date();
    },

    dateKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    uniqueActionNames(entries) {
        const set = new Set();
        entries.forEach(h => this.historyNames(h).forEach(name => set.add(name)));
        return [...set];
    },

    historyNames(h) {
        if (h.type === 'cardio' && h.cardio) return [h.cardio.name || '有氧训练'];
        return (h.actions || []).map(a => a.name || '未命名');
    },

    historyIcon(h) {
        if (h.type === 'cardio' && h.cardio) return this.sportIcon(h.cardio.type || h.cardio.name);
        return this.sportIcon(this.historyNames(h)[0] || '');
    },

    sportIcon(name = '') {
        const text = String(name).toLowerCase();
        if (/walk|步行|快走/.test(text)) return 'directions_walk';
        if (/run|jog|跑|慢跑/.test(text)) return 'directions_run';
        if (/cycling|骑/.test(text)) return 'directions_bike';
        if (/swim|游泳/.test(text)) return 'pool';
        if (/row|划船/.test(text)) return 'rowing';
        if (/elliptical|椭圆/.test(text)) return 'exercise';
        if (/拉伸|伸展|stretch/.test(text)) return 'self_improvement';
        if (/深蹲|蹲|腿|臀|squat/.test(text)) return 'accessibility_new';
        if (/肩|臂|手|推|拉|胸|背/.test(text)) return 'fitness_center';
        if (/核心|腹|腰|平板|plank/.test(text)) return 'sports_gymnastics';
        return 'fitness_center';
    },

    actionColor(name) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
        return this.historyColors[hash % this.historyColors.length];
    },

    shortName(name) {
        return name.length > 4 ? name.slice(0, 4) : name;
    },

    move(i, d) {
        if (i + d >= 0 && i + d < this.db.actions.length) {
            [this.db.actions[i], this.db.actions[i + d]] = [this.db.actions[i + d], this.db.actions[i]];
            this.save();
        }
    }
};
