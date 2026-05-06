const foodLog = {
    attach(target) {
        Object.assign(target, {
            addFoodLog: this.addFoodLog,
            deleteFoodLog: this.deleteFoodLog,
            startEditFoodLog: this.startEditFoodLog,
            cancelEditFoodLog: this.cancelEditFoodLog,
            saveEditFoodLog: this.saveEditFoodLog,
            todayFoodLogs: this.todayFoodLogs,
            todayCalories: this.todayCalories,
            todayMacros: this.todayMacros,
            applyFoodItem: this.applyFoodItem,
            onFoodSearchInput: this.onFoodSearchInput,
            autoFillFoodByName: this.autoFillFoodByName,
            updateFoodComputedPreview: this.updateFoodComputedPreview,
            foodSourceTag: this.foodSourceTag,
            aiParseFood: this.aiParseFood,
            updateAiFoodDraft: this.updateAiFoodDraft,
            renderAiFoodResults: this.renderAiFoodResults,
            addSingleAiFood: this.addSingleAiFood,
            addAllAiFoods: this.addAllAiFoods,
            aiFoodLog: this.aiFoodLog,
            clearAiResults: this.clearAiResults,
            applyAiFood: this.applyAiFood
        });
    },

    foodEntry(item = {}) {
        return {
            name: item.name || '',
            grams: Number(item.grams || 0),
            cal: Number(item.cal || 0),
            pro: Number(item.pro || 0),
            carb: Number(item.carb || 0),
            fat: Number(item.fat || 0)
        };
    },

    formatAiDraft(item = {}) {
        const entry = this.foodEntry(item);
        return {
            ...entry,
            grams: entry.grams || '',
            cal: entry.cal || '',
            pro: entry.pro || '',
            carb: entry.carb || '',
            fat: entry.fat || ''
        };
    },

    startEditFoodLog(id) {
        const log = (this.db.health.foodLogs || []).find(item => item.id === id);
        if (!log) return;
        this._editingFoodLogId = id;
        this._editingFoodDraft = {
            id,
            meal: log.meal || 'lunch',
            name: log.name || '',
            grams: log.grams || '',
            calPer100g: log.calPer100g || '',
            proPer100g: log.proPer100g || '',
            carbPer100g: log.carbPer100g || '',
            fatPer100g: log.fatPer100g || ''
        };
        this.render();
    },

    cancelEditFoodLog() {
        this._editingFoodLogId = null;
        this._editingFoodDraft = null;
        this.render();
    },

    saveEditFoodLog(id) {
        const draft = this._editingFoodDraft;
        if (!draft || draft.id !== id) return;
        const idx = (this.db.health.foodLogs || []).findIndex(item => item.id === id);
        if (idx < 0) return;
        const name = String(draft.name || '').trim();
        const grams = Number(draft.grams || 0);
        const calPer100g = Number(draft.calPer100g || 0);
        const proPer100g = Number(draft.proPer100g || 0);
        const carbPer100g = Number(draft.carbPer100g || 0);
        const fatPer100g = Number(draft.fatPer100g || 0);
        if (!name) return alert('请输入食物名称');
        if (!grams || grams <= 0) return alert('请输入有效克数');
        if (!calPer100g || calPer100g <= 0) return alert('请输入有效热量');
        const prev = this.db.health.foodLogs[idx];
        this.db.health.foodLogs[idx] = {
            ...prev,
            meal: draft.meal || 'lunch',
            name,
            grams,
            calPer100g,
            proPer100g,
            carbPer100g,
            fatPer100g,
            cal: Math.round(calPer100g * grams / 100),
            pro: Number((proPer100g * grams / 100).toFixed(1)),
            carb: Number((carbPer100g * grams / 100).toFixed(1)),
            fat: Number((fatPer100g * grams / 100).toFixed(1))
        };
        this._editingFoodLogId = null;
        this._editingFoodDraft = null;
        this.saveAndBackup();
    },

    addFoodLog() {
        const name = document.getElementById('foodName')?.value?.trim();
        const grams = parseFloat(document.getElementById('foodGrams')?.value);
        const cal = parseFloat(document.getElementById('foodCal')?.value);
        const pro = parseFloat(document.getElementById('foodPro')?.value) || 0;
        const carb = parseFloat(document.getElementById('foodCarb')?.value) || 0;
        const fat = parseFloat(document.getElementById('foodFat')?.value) || 0;
        const meal = document.getElementById('foodMeal')?.value || 'lunch';
        if (!name) return alert('请输入食物名称');
        if (!grams || grams <= 0) return alert('请输入食物重量');
        if (!cal || cal <= 0) return alert('请先选择食物或填写每100g热量');
        const log = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            date: this.dateKey(new Date()),
            meal,
            name,
            grams,
            cal: Math.round(cal * grams / 100),
            calPer100g: cal,
            pro: Number((pro * grams / 100).toFixed(1)),
            carb: Number((carb * grams / 100).toFixed(1)),
            fat: Number((fat * grams / 100).toFixed(1)),
            proPer100g: pro,
            carbPer100g: carb,
            fatPer100g: fat,
            createdAt: new Date().toISOString()
        };
        this.db.health.foodLogs.push(log);
        if (document.getElementById('foodName')) document.getElementById('foodName').value = '';
        if (document.getElementById('foodGrams')) document.getElementById('foodGrams').value = '';
        if (document.getElementById('foodCal')) document.getElementById('foodCal').value = '';
        if (document.getElementById('foodPro')) document.getElementById('foodPro').value = '';
        if (document.getElementById('foodCarb')) document.getElementById('foodCarb').value = '';
        if (document.getElementById('foodFat')) document.getElementById('foodFat').value = '';
        this.setFoodSource('');
        this._aiFoodResults = [];
        this._aiFoodDrafts = [];
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

    todayMacros() {
        return this.todayFoodLogs().reduce((acc, f) => {
            acc.pro += Number(f.pro || 0);
            acc.carb += Number(f.carb || 0);
            acc.fat += Number(f.fat || 0);
            return acc;
        }, { pro: 0, carb: 0, fat: 0 });
    },

    applyFoodItem(id) {
        const item = fooddb.getAll().find(f => f.id === id);
        if (!item) return;
        if (document.getElementById('foodName')) document.getElementById('foodName').value = item.name;
        if (document.getElementById('foodCal')) document.getElementById('foodCal').value = item.cal;
        if (document.getElementById('foodPro')) document.getElementById('foodPro').value = item.pro || 0;
        if (document.getElementById('foodCarb')) document.getElementById('foodCarb').value = item.carb || 0;
        if (document.getElementById('foodFat')) document.getElementById('foodFat').value = item.fat || 0;
        if (document.getElementById('foodGrams')) document.getElementById('foodGrams').value = '';
        document.getElementById('foodSearchResults').innerHTML = '';
        this._aiFoodResults = [];
        this._aiFoodDrafts = [];
        this._aiFoodAdded = null;
        this.setFoodSource(item.cat === '自定义' ? '自定义食物库' : '本地食物库');
        this.updateFoodComputedPreview();
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

    autoFillFoodByName() {
        const kw = document.getElementById('foodName')?.value?.trim() || '';
        if (!kw) return;
        const exact = fooddb.getAll().find(i => i.name === kw);
        if (exact) this.applyFoodItem(exact.id);
    },

    updateFoodComputedPreview() {
        const grams = parseFloat(document.getElementById('foodGrams')?.value) || 0;
        const cal = parseFloat(document.getElementById('foodCal')?.value) || 0;
        const pro = parseFloat(document.getElementById('foodPro')?.value) || 0;
        const carb = parseFloat(document.getElementById('foodCarb')?.value) || 0;
        const fat = parseFloat(document.getElementById('foodFat')?.value) || 0;
        const el = document.getElementById('foodComputed');
        if (!el) return;
        if (!grams || !cal) { el.textContent = '输入食物和重量后自动计算'; return; }
        const kcal = Math.round(cal * grams / 100);
        const p = (pro * grams / 100).toFixed(1);
        const c = (carb * grams / 100).toFixed(1);
        const f = (fat * grams / 100).toFixed(1);
        el.textContent = `本次记录：${kcal} kcal · 蛋白 ${p}g · 碳水 ${c}g · 脂肪 ${f}g`;
    },

    foodSourceTag() {
        if (!this._foodSource) return '';
        return `<span class="food-source-tag">${this._foodSource}</span>`;
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
            this._aiFoodAdded = new Set();
            this._aiFoodDrafts = items.map(item => this.formatAiDraft(item));
            this.renderAiFoodResults();
            if (statusEl) statusEl.textContent = `AI 已识别 ${items.length} 项，点击逐个添加或批量添加`;
        } catch (e) {
            if (statusEl) statusEl.textContent = 'AI 识别失败: ' + e.message;
        }
    },

    updateAiFoodDraft(idx, field, value) {
        const drafts = this._aiFoodDrafts || [];
        if (!drafts[idx]) return;
        drafts[idx][field] = value;
    },

    renderAiFoodEditor(idx) {
        const draft = this._aiFoodDrafts?.[idx] || this.formatAiDraft(this._aiFoodResults?.[idx] || {});
        return `<div class="food-inline-edit-grid">
            <div class="md-field"><input type="text" value="${this.escapeHtml(draft.name)}" oninput="data.updateAiFoodDraft(${idx}, 'name', this.value)" placeholder=" "><label>食物</label></div>
            <div class="md-field"><input type="number" value="${draft.grams}" oninput="data.updateAiFoodDraft(${idx}, 'grams', this.value)" placeholder=" "><label>克数</label></div>
            <div class="md-field"><input type="number" value="${draft.cal}" oninput="data.updateAiFoodDraft(${idx}, 'cal', this.value)" placeholder=" "><label>kcal</label></div>
            <div class="md-field"><input type="number" value="${draft.pro}" oninput="data.updateAiFoodDraft(${idx}, 'pro', this.value)" placeholder=" "><label>蛋白</label></div>
            <div class="md-field"><input type="number" value="${draft.carb}" oninput="data.updateAiFoodDraft(${idx}, 'carb', this.value)" placeholder=" "><label>碳水</label></div>
            <div class="md-field"><input type="number" value="${draft.fat}" oninput="data.updateAiFoodDraft(${idx}, 'fat', this.value)" placeholder=" "><label>脂肪</label></div>
        </div>`;
    },

    renderAiFoodResults() {
        const items = this._aiFoodResults || [];
        const el = document.getElementById('foodSearchResults');
        if (!el) return;
        if (items.length === 0) { el.innerHTML = ''; return; }
        el.innerHTML = `
            <button class="food-result-item food-add-all" onclick="data.addAllAiFoods()"><span class="material-symbols-rounded">done_all</span><span>全部添加</span><small>${items.filter((_, idx) => !(this._aiFoodAdded && this._aiFoodAdded.has(idx))).length}/${items.length} 项 · ${items.reduce((s, i) => s + (i.cal || 0), 0)} kcal</small></button>
            ${items.map((item, idx) => {
                const added = this._aiFoodAdded && this._aiFoodAdded.has(idx);
                const draft = this._aiFoodDrafts?.[idx] || this.formatAiDraft(item);
                return `<div class="food-ai-result-card ${added ? 'food-added' : ''}">
                    <div class="food-result-item food-ai-result">
                        <span>${this.escapeHtml(draft.name || item.name)} ${draft.grams ? draft.grams + 'g' : ''}</span>
                        <small>${draft.cal || 0} kcal${draft.pro ? ' · 蛋白' + draft.pro + 'g' : ''}</small>
                        ${added
                            ? '<span class="food-added-badge">已添加</span>'
                            : `<button class="food-add-btn" onclick="data.addSingleAiFood(${idx})"><span class="material-symbols-rounded">add</span></button>`}
                    </div>
                    ${!added ? this.renderAiFoodEditor(idx) : ''}
                </div>`;
            }).join('')}`;
    },

    addSingleAiFood(idx) {
        const item = this.foodEntry(this._aiFoodDrafts?.[idx] || this._aiFoodResults?.[idx] || {});
        if (!item.name) return alert('请输入食物名称');
        if (!this._aiFoodAdded) this._aiFoodAdded = new Set();
        if (this._aiFoodAdded.has(idx)) return;
        const meal = document.getElementById('foodMeal')?.value || 'lunch';
        this.db.health.foodLogs.push(this.aiFoodLog(item, meal, idx));
        this._aiFoodAdded.add(idx);
        this.renderAiFoodResults();
        this.save();
    },

    addAllAiFoods() {
        const items = this._aiFoodDrafts || this._aiFoodResults || [];
        if (items.length === 0) return;
        if (!this._aiFoodAdded) this._aiFoodAdded = new Set();
        const meal = document.getElementById('foodMeal')?.value || 'lunch';
        const addedNow = [];
        items.forEach((item, idx) => {
            if (this._aiFoodAdded.has(idx)) return;
            const entry = this.foodEntry(item);
            if (!entry.name) return;
            addedNow.push(idx);
            this.db.health.foodLogs.push(this.aiFoodLog(entry, meal, idx));
        });
        addedNow.forEach(idx => {
            this._aiFoodAdded.add(idx);
        });
        this.renderAiFoodResults();
        const statusEl = document.getElementById('foodAiStatus');
        if (statusEl) statusEl.textContent = addedNow.length ? `已添加 ${addedNow.length} 项 AI 食物` : '这些 AI 食物已全部添加';
        this.saveAndBackup();
    },

    aiFoodLog(item, meal, idx = 0) {
        const grams = Number(item.grams || 0);
        const cal = Number(item.cal || 0);
        return {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${idx}`,
            date: this.dateKey(new Date()),
            meal,
            name: item.name || 'AI 识别食物',
            grams,
            cal: Math.round(cal),
            calPer100g: grams ? Math.round(cal * 100 / grams) : 0,
            pro: Number(item.pro || 0),
            carb: Number(item.carb || 0),
            fat: Number(item.fat || 0),
            createdAt: new Date().toISOString()
        };
    },

    clearAiResults() {
        this._aiFoodResults = [];
        this._aiFoodDrafts = [];
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
        if (document.getElementById('foodPro')) document.getElementById('foodPro').value = item.pro || 0;
        if (document.getElementById('foodCarb')) document.getElementById('foodCarb').value = item.carb || 0;
        if (document.getElementById('foodFat')) document.getElementById('foodFat').value = item.fat || 0;
        document.getElementById('foodSearchResults').innerHTML = '';
        this.setFoodSource('AI 识别结果');
        this.updateFoodComputedPreview();
    }
};

if (typeof window !== 'undefined' && window.data) foodLog.attach(window.data);
