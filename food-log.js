const foodLog = {
    attach(target) {
        Object.assign(target, {
            foodEntry: this.foodEntry,
            formatAiDraft: this.formatAiDraft,
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
            renderAiFoodEditor: this.renderAiFoodEditor,
            renderAiFoodResults: this.renderAiFoodResults,
            addSingleAiFood: this.addSingleAiFood,
            addAllAiFoods: this.addAllAiFoods,
            undoRecentAiFoodAdd: this.undoRecentAiFoodAdd,
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
        const grams = log.grams || 0;
        const calUnit = log.calUnit || 'kcal';
        const storedCalPer100g = Number(log.calPer100g || (grams ? Math.round((log.cal || 0) * 100 / grams) : 0));
        this._editingFoodDraft = {
            id,
            meal: log.meal || 'lunch',
            name: log.name || '',
            grams: grams,
            calUnit,
            calPer100g: storedCalPer100g || '',
            calInputPer100g: log.calInputPer100g || (storedCalPer100g ? this.convertFoodCaloriesValue(storedCalPer100g, 'kcal', calUnit) : ''),
            proPer100g: log.proPer100g || (grams ? Number(((log.pro || 0) * 100 / grams).toFixed(1)) : ''),
            carbPer100g: log.carbPer100g || (grams ? Number(((log.carb || 0) * 100 / grams).toFixed(1)) : ''),
            fatPer100g: log.fatPer100g || (grams ? Number(((log.fat || 0) * 100 / grams).toFixed(1)) : '')
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
        const calUnit = draft.calUnit || 'kcal';
        const calInputPer100g = Number(draft.calInputPer100g || 0);
        const calPer100g = this.parseFoodCaloriesToKcal(calInputPer100g, calUnit);
        const proPer100g = Number(draft.proPer100g || 0);
        const carbPer100g = Number(draft.carbPer100g || 0);
        const fatPer100g = Number(draft.fatPer100g || 0);
        if (!name) return alert('请输入食物名称');
        if (!grams || grams <= 0) return alert('请输入有效克数');
        if (!calInputPer100g || calInputPer100g <= 0 || !calPer100g) return alert('请输入有效热量');
        const prev = this.db.health.foodLogs[idx];
        this.db.health.foodLogs[idx] = {
            ...prev,
            meal: draft.meal || 'lunch',
            name,
            grams,
            calUnit,
            calInputPer100g: Number(calInputPer100g.toFixed(1)),
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
        const calInput = parseFloat(document.getElementById('foodCal')?.value);
        const calUnit = this._foodCalUnit || 'kj';
        const cal = this.parseFoodCaloriesToKcal(calInput, calUnit);
        const pro = parseFloat(document.getElementById('foodPro')?.value) || 0;
        const carb = parseFloat(document.getElementById('foodCarb')?.value) || 0;
        const fat = parseFloat(document.getElementById('foodFat')?.value) || 0;
        const meal = this._dietMeal || 'lunch';
        if (!name) return alert('请输入食物名称');
        if (!grams || grams <= 0) return alert('请输入食物重量');
        if (!calInput || calInput <= 0 || !cal) return alert('请先选择食物或填写每100g热量');
        const log = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            date: this.logicalDateKey(),
            meal,
            name,
            grams,
            cal: Math.round(cal * grams / 100),
            calUnit,
            calInputPer100g: Number(calInput.toFixed(1)),
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
        this._foodCalUnit = 'kj';
        this.syncFoodCalLabel?.();
        this.setFoodSource('');
        this._aiFoodResults = [];
        this._aiFoodDrafts = [];
        this._aiFoodAdded = null;
        const searchEl = document.getElementById('foodSearchSuggest');
        if (searchEl) searchEl.innerHTML = '';
        this.saveAndBackup();
    },

    deleteFoodLog(id) {
        this.db.health.foodLogs = (this.db.health.foodLogs || []).filter(f => f.id !== id);
        this.saveAndBackup();
    },

    todayFoodLogs() {
        const today = this.logicalDateKey();
        return (this.db.health.foodLogs || []).filter(f => f.date === today);
    },

    rememberRecentAiFoodAdd(logs) {
        const added = (logs || []).filter(Boolean);
        if (!added.length) return;
        this._recentAiFoodAdd = {
            ids: added.map(item => item.id),
            logs: added,
            expiresAt: Date.now() + 5000
        };
        if (window.toast?.show) {
            toast.show(`已添加 ${added.length} 项 AI 食物`, 'success', 5000, {
                label: '撤销',
                onClick: () => this.undoRecentAiFoodAdd()
            });
        }
    },

    undoRecentAiFoodAdd() {
        const recent = this._recentAiFoodAdd;
        if (!recent || !recent.ids?.length) return;
        if (Date.now() > Number(recent.expiresAt || 0)) {
            this._recentAiFoodAdd = null;
            return;
        }
        const ids = new Set(recent.ids);
        this.db.health.foodLogs = (this.db.health.foodLogs || []).filter(item => !ids.has(item.id));
        this._recentAiFoodAdd = null;
        this.saveAndBackup();
        toast?.show?.('已撤销最近一次 AI 添加', 'info', 2400);
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
        this._foodCalUnit = 'kcal';
        this.syncFoodCalLabel?.();
        if (document.getElementById('foodCal')) document.getElementById('foodCal').value = item.cal;
        if (document.getElementById('foodPro')) document.getElementById('foodPro').value = item.pro || 0;
        if (document.getElementById('foodCarb')) document.getElementById('foodCarb').value = item.carb || 0;
        if (document.getElementById('foodFat')) document.getElementById('foodFat').value = item.fat || 0;
        if (document.getElementById('foodGrams')) document.getElementById('foodGrams').value = '';
        document.getElementById('foodSearchSuggest').innerHTML = '';
        this._aiFoodResults = [];
        this._aiFoodDrafts = [];
        this._aiFoodAdded = null;
        this.setFoodSource(item.cat === '自定义' ? '自定义食物库' : '本地食物库');
        this.updateFoodComputedPreview();
    },

    onFoodSearchInput() {
        const kw = document.getElementById('foodName')?.value?.trim() || '';
        const results = fooddb.searchAll(kw);
        const el = document.getElementById('foodSearchSuggest');
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
        const calInput = parseFloat(document.getElementById('foodCal')?.value) || 0;
        const cal = this.parseFoodCaloriesToKcal(calInput, this._foodCalUnit || 'kj');
        const pro = parseFloat(document.getElementById('foodPro')?.value) || 0;
        const carb = parseFloat(document.getElementById('foodCarb')?.value) || 0;
        const fat = parseFloat(document.getElementById('foodFat')?.value) || 0;
        const el = document.getElementById('foodComputed');
        if (!el) return;
        if (!grams || !calInput || !cal) { el.textContent = '输入食物和重量后自动计算'; return; }
        const kcal = Math.round(cal * grams / 100);
        const p = (pro * grams / 100).toFixed(1);
        const c = (carb * grams / 100).toFixed(1);
        const f = (fat * grams / 100).toFixed(1);
        const unitText = (this._foodCalUnit || 'kj') === 'kj' ? `（由 ${Number(calInput.toFixed(1))} kJ/100g 自动换算）` : '';
        el.textContent = `本次记录：${kcal} kcal${unitText} · 蛋白 ${p}g · 碳水 ${c}g · 脂肪 ${f}g`;
    },

    foodSourceTag() {
        if (!this._foodSource) return '';
        return `<span class="food-source-tag">${this._foodSource}</span>`;
    },

    async aiParseFood() {
        const textarea = document.getElementById('foodAiText');
        const manualInput = document.getElementById('foodName');
        const text = (textarea?.value?.trim() || manualInput?.value?.trim() || '');
        if (!text) {
            if (textarea) { textarea.focus(); textarea.placeholder = '请先输入食物描述'; }
            const statusEl = document.getElementById('foodAiStatus');
            if (statusEl) statusEl.textContent = '请先输入食物描述';
            setTimeout(() => { if (textarea) textarea.placeholder = '说说你这顿吃了什么，例如：鸡胸肉饭加一杯豆浆'; }, 3000);
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
            if (statusEl) statusEl.textContent = 'AI 识别失败: ' + (window.toast ? toast.sanitize(e) : e.message);
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
        const el = document.getElementById('foodAiResults');
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
        const meal = this._dietMeal || 'lunch';
        const addedLog = this.aiFoodLog(item, meal, idx);
        this.db.health.foodLogs.push(addedLog);
        this._aiFoodAdded.add(idx);
        this.renderAiFoodResults();
        this.rememberRecentAiFoodAdd([addedLog]);
        this.saveAndBackup();
    },

    addAllAiFoods() {
        const items = this._aiFoodDrafts || this._aiFoodResults || [];
        if (items.length === 0) return;
        if (!this._aiFoodAdded) this._aiFoodAdded = new Set();
        const meal = this._dietMeal || 'lunch';
        const addedNow = [];
        const addedLogs = [];
        items.forEach((item, idx) => {
            if (this._aiFoodAdded.has(idx)) return;
            const entry = this.foodEntry(item);
            if (!entry.name) return;
            addedNow.push(idx);
            const addedLog = this.aiFoodLog(entry, meal, idx);
            addedLogs.push(addedLog);
            this.db.health.foodLogs.push(addedLog);
        });
        addedNow.forEach(idx => {
            this._aiFoodAdded.add(idx);
        });
        this.renderAiFoodResults();
        const statusEl = document.getElementById('foodAiStatus');
        if (statusEl) statusEl.textContent = addedNow.length ? `已添加 ${addedNow.length} 项 AI 食物` : '这些 AI 食物已全部添加';
        this.rememberRecentAiFoodAdd(addedLogs);
        this.saveAndBackup();
    },

    aiFoodLog(item, meal, idx = 0) {
        const grams = Number(item.grams || 0);
        const cal = Number(item.cal || 0);
        const pro = Number(item.pro || 0);
        const carb = Number(item.carb || 0);
        const fat = Number(item.fat || 0);
        return {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${idx}`,
            date: this.logicalDateKey(),
            meal,
            name: item.name || 'AI 识别食物',
            grams,
            cal: Math.round(cal),
            calPer100g: grams ? Math.round(cal * 100 / grams) : 0,
            pro,
            carb,
            fat,
            proPer100g: grams ? Number((pro * 100 / grams).toFixed(1)) : 0,
            carbPer100g: grams ? Number((carb * 100 / grams).toFixed(1)) : 0,
            fatPer100g: grams ? Number((fat * 100 / grams).toFixed(1)) : 0,
            createdAt: new Date().toISOString()
        };
    },

    clearAiResults() {
        this._aiFoodResults = [];
        this._aiFoodDrafts = [];
        this._aiFoodAdded = null;
        const el = document.getElementById('foodAiResults');
        if (el) el.innerHTML = '';
        const statusEl = document.getElementById('foodAiStatus');
        if (statusEl) statusEl.textContent = '';
    },

    applyAiFood(item) {
        if (document.getElementById('foodName')) document.getElementById('foodName').value = item.name;
        if (document.getElementById('foodGrams')) document.getElementById('foodGrams').value = item.grams || '';
        this._foodCalUnit = 'kcal';
        this.syncFoodCalLabel?.();
        if (document.getElementById('foodCal')) document.getElementById('foodCal').value = item.cal || '';
        if (document.getElementById('foodPro')) document.getElementById('foodPro').value = item.pro || 0;
        if (document.getElementById('foodCarb')) document.getElementById('foodCarb').value = item.carb || 0;
        if (document.getElementById('foodFat')) document.getElementById('foodFat').value = item.fat || 0;
        document.getElementById('foodSearchSuggest').innerHTML = '';
        this.setFoodSource('AI 识别结果');
        this.updateFoodComputedPreview();
    }
};

if (typeof window !== 'undefined' && window.data) foodLog.attach(window.data);
