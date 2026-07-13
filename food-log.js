// @ts-nocheck
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
            normalizeAiFoodItems: this.normalizeAiFoodItems,
            normalizeFoodAlias: this.normalizeFoodAlias,
            foodLogNutritionPer100g: this.foodLogNutritionPer100g,
            buildFoodAliasLookup: this.buildFoodAliasLookup,
            groupHistoricalFoods: this.groupHistoricalFoods,
            parseFoodAliasGroups: this.parseFoodAliasGroups,
            requestFoodAliasGroups: this.requestFoodAliasGroups,
            historicalFoodSuggestions: this.historicalFoodSuggestions,
            applyHistoricalFoodItem: this.applyHistoricalFoodItem,
            aiDedupeFoodHistory: this.aiDedupeFoodHistory,
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
            rememberRecentAiFoodAdd: this.rememberRecentAiFoodAdd,
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
            fat: Number(item.fat || 0),
            fiber: Number(item.fiber || 0),
            sugar: Number(item.sugar || 0),
            sodium: Number(item.sodium || 0),
            saturatedFat: Number(item.saturatedFat || item.satFat || 0),
            ingredients: Array.isArray(item.ingredients) ? item.ingredients.map(v => String(v || '').trim()).filter(Boolean) : [],
            cooking: String(item.cooking || item.cookingMethod || '').trim(),
            source: String(item.source || '').trim(),
            confidence: item.confidence === undefined ? '' : Number(item.confidence || 0),
            note: String(item.note || '').trim()
        };
    },

    formatAiDraft(item = {}) {
        const entry = this.foodEntry(item);
        const numberOrBlank = value => Number.isFinite(Number(value)) ? value : '';
        return {
            ...entry,
            grams: entry.grams || '',
            cal: numberOrBlank(entry.cal),
            pro: numberOrBlank(entry.pro),
            carb: numberOrBlank(entry.carb),
            fat: numberOrBlank(entry.fat)
        };
    },

    startEditFoodLog(id) {
        const log = this.activeRecords(this.db.health.foodLogs || []).find(item => item.id === id);
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
            fat: Number((fatPer100g * grams / 100).toFixed(1)),
            deleted: false,
            updatedAt: Date.now()
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
        const meal = this._dietMeal || this.defaultDietMealForTime?.() || 'lunch';
        if (!name) return alert('请输入食物名称');
        if (!grams || grams <= 0) return alert('请输入食物重量');
        if (!calInput || calInput <= 0 || !cal) return alert('请先选择食物或填写每100g热量');
        const log = {
            id: this.generateRecordId('food'),
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
            sourceLabel: this._foodSource || '',
            source: this._foodSource ? 'selected-food-source' : 'manual',
            createdAt: new Date().toISOString(),
            updatedAt: Date.now(),
            deleted: false
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
        this.deleteWithUndo(this.db.health.foodLogs, id, {
            save: () => this.saveAndBackup(),
            render: () => this.renderHistory?.()
        });
    },

    todayFoodLogs() {
        const today = this.logicalDateKey();
        return this.activeRecords(this.db.health.foodLogs || []).filter(f => f.date === today);
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
        (this.db.health.foodLogs || []).forEach(item => {
            if (!item || !ids.has(item.id)) return;
            item.deleted = true;
            item.updatedAt = Date.now();
        });
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

    normalizeFoodAlias(value) {
        return String(value || '').trim().toLowerCase().replace(/[\s\u3000·・,，、()（）\[\]【】]/g, '');
    },

    foodLogNutritionPer100g(log) {
        const grams = Number(log?.grams || 0);
        const cal = Number(log?.calPer100g || (grams ? (Number(log.cal || 0) * 100 / grams) : 0));
        if (!cal) return null;
        return {
            cal: Number(cal.toFixed(1)),
            pro: Number(Number(log.proPer100g ?? (grams ? (Number(log.pro || 0) * 100 / grams) : 0)).toFixed(1)),
            carb: Number(Number(log.carbPer100g ?? (grams ? (Number(log.carb || 0) * 100 / grams) : 0)).toFixed(1)),
            fat: Number(Number(log.fatPer100g ?? (grams ? (Number(log.fat || 0) * 100 / grams) : 0)).toFixed(1))
        };
    },

    buildFoodAliasLookup() {
        const lookup = new Map();
        (this.db.health?.foodAliasGroups || []).forEach(group => {
            const canonical = String(group?.canonical || '').trim();
            if (!canonical || !Array.isArray(group.aliases)) return;
            group.aliases.forEach(alias => {
                const key = this.normalizeFoodAlias(alias);
                if (key) lookup.set(key, canonical);
            });
            const canonicalKey = this.normalizeFoodAlias(canonical);
            if (canonicalKey) lookup.set(canonicalKey, canonical);
        });
        return lookup;
    },

    groupHistoricalFoods(logs, keyword) {
        const kw = this.normalizeFoodAlias(keyword);
        const aliasLookup = this.buildFoodAliasLookup();
        const groups = new Map();
        logs.forEach(log => {
            const name = String(log?.name || '').trim();
            const normalizedName = this.normalizeFoodAlias(name);
            if (!name || (!normalizedName.includes(kw) && !kw.includes(normalizedName))) return;
            const nutrition = this.foodLogNutritionPer100g(log);
            if (!nutrition) return;
            const canonical = aliasLookup.get(normalizedName) || name;
            const canonicalKey = this.normalizeFoodAlias(canonical);
            const group = groups.get(canonicalKey) || { canonical, names: new Set(), entries: [] };
            group.names.add(name);
            group.entries.push({ log, nutrition });
            groups.set(canonicalKey, group);
        });
        return [...groups.values()].map(group => {
            const entries = group.entries;
            const latest = entries[0]?.log || {};
            const avg = field => Number((entries.reduce((sum, item) => sum + Number(item.nutrition[field] || 0), 0) / entries.length).toFixed(1));
            return {
                name: group.canonical,
                aliases: [...group.names],
                grams: Number(latest.grams || 0),
                cal: avg('cal'),
                pro: avg('pro'),
                carb: avg('carb'),
                fat: avg('fat'),
                date: latest.date || '',
                meal: latest.meal || '',
                mergedCount: group.names.size,
                entryCount: entries.length
            };
        });
    },

    parseFoodAliasGroups(raw, inputNames = []) {
        const match = String(raw || '').match(/\[[\s\S]*\]/);
        if (!match) throw new Error('AI 返回格式异常');
        const parsed = JSON.parse(match[0]);
        const inputSet = new Set(inputNames);
        return (Array.isArray(parsed) ? parsed : []).map(group => {
            const aliases = [...new Set((group?.aliases || []).map(name => String(name || '').trim()).filter(name => inputSet.has(name)))];
            const canonical = String(group?.canonical || aliases[0] || '').trim();
            return { canonical, aliases };
        }).filter(group => group.canonical && group.aliases.length >= 2);
    },

    async requestFoodAliasGroups(names = []) {
        const input = [...new Set((names || []).map(name => String(name || '').trim()).filter(Boolean))].slice(0, 120);
        if (input.length < 2) return [];
        const aiClient = await this.ensureAiRuntime?.() || window.ai;
        if (!aiClient?.call) throw new Error('AI 模块未加载完成');
        const tpl = window.dataAiTemplates;
        const prefResult = tpl?.buildPromptMessages('food_alias_merge', {}, window.data?.db) || {};
        const sysMsg = prefResult.messages?.find(m => m.role === 'system')?.content || '只返回纯 JSON 数组，不要 markdown，不要解释。';
        const prompt = `合并同一种食物的历史名称。canonical 用简洁中文名，aliases 只能来自输入。只返回 JSON 数组：[{"canonical":"标准名","aliases":["原名1","原名2"]}]\n输入：${JSON.stringify(input)}`;
        const raw = await aiClient.call([
            { role: 'system', content: sysMsg },
            { role: 'user', content: prompt }
        ], 900);
        return this.parseFoodAliasGroups(raw, input);
    },

    historicalFoodSuggestions(keyword, limit = 8) {
        const kw = this.normalizeFoodAlias(keyword);
        if (!kw) return [];
        const seen = new Set();
        const logs = this.activeRecords(this.db.health?.foodLogs || []).slice().reverse();
        const grouped = this.groupHistoricalFoods(logs, keyword).filter(item => item.mergedCount > 1);
        const suggestions = [];
        for (const item of grouped) {
            const key = `group|${this.normalizeFoodAlias(item.name)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            suggestions.push(item);
            if (suggestions.length >= limit) return suggestions;
        }
        for (const log of logs) {
            const name = String(log?.name || '').trim();
            const normalizedName = this.normalizeFoodAlias(name);
            if (!name || (!normalizedName.includes(kw) && !kw.includes(normalizedName))) continue;
            if (grouped.some(group => group.aliases.includes(name))) continue;
            const nutrition = this.foodLogNutritionPer100g(log);
            if (!nutrition) continue;
            const key = [
                normalizedName,
                Math.round(nutrition.cal),
                nutrition.pro.toFixed(1),
                nutrition.carb.toFixed(1),
                nutrition.fat.toFixed(1)
            ].join('|');
            if (seen.has(key)) continue;
            seen.add(key);
            suggestions.push({
                name,
                aliases: [name],
                grams: Number(log.grams || 0),
                cal: nutrition.cal,
                pro: nutrition.pro,
                carb: nutrition.carb,
                fat: nutrition.fat,
                date: log.date || '',
                meal: log.meal || '',
                mergedCount: 1,
                entryCount: 1
            });
            if (suggestions.length >= limit) break;
        }
        return suggestions;
    },

    applyHistoricalFoodItem(index) {
        const item = (this._foodHistorySuggestions || [])[Number(index)];
        if (!item) return;
        const nameEl = document.getElementById('foodName');
        const gramsEl = document.getElementById('foodGrams');
        if (nameEl) nameEl.value = item.name;
        if (gramsEl && !gramsEl.value && item.grams) gramsEl.value = item.grams;
        this._foodCalUnit = 'kcal';
        this.syncFoodCalLabel?.();
        if (document.getElementById('foodCal')) document.getElementById('foodCal').value = item.cal || '';
        if (document.getElementById('foodPro')) document.getElementById('foodPro').value = item.pro || 0;
        if (document.getElementById('foodCarb')) document.getElementById('foodCarb').value = item.carb || 0;
        if (document.getElementById('foodFat')) document.getElementById('foodFat').value = item.fat || 0;
        const suggestEl = document.getElementById('foodSearchSuggest');
        if (suggestEl) suggestEl.innerHTML = '';
        this._aiFoodResults = [];
        this._aiFoodDrafts = [];
        this._aiFoodAdded = null;
        this.setFoodSource('历史记录');
        this.updateFoodComputedPreview();
    },

    async aiDedupeFoodHistory() {
        const statusEl = document.getElementById('foodDedupeStatus');
        const setStatus = (text) => { if (statusEl) statusEl.textContent = text; };
        const logs = this.activeRecords(this.db.health?.foodLogs || []);
        const names = [...new Set(logs.map(log => String(log?.name || '').trim()).filter(Boolean))];
        if (names.length < 2) {
            setStatus('历史食物名称不足，暂不需要合并');
            return;
        }
        let aiClient = null;
        try {
            aiClient = await this.ensureAiRuntime?.() || window.ai;
        } catch (e) {
            window.errorBus?.report?.('food.aiDedupe.load', e);
            setStatus('AI 模块加载失败，请稍后重试');
            return;
        }
        const effective = aiClient?.getEffectiveConfig?.() || aiClient?.cfg || {};
        if (!effective.enabled || typeof aiClient?.call !== 'function') {
            setStatus('请先在设置中配置 AI 后再合并历史同类项');
            window.toast?.show?.('请先在设置中配置 AI', 'info');
            return;
        }
        setStatus('AI 正在分析历史食物名称...');
        try {
            const groups = await this.requestFoodAliasGroups(names);
            const existing = Array.isArray(this.db.health.foodAliasGroups) ? this.db.health.foodAliasGroups : [];
            const byCanonical = new Map(existing.map(group => [this.normalizeFoodAlias(group.canonical), { ...group, aliases: [...(group.aliases || [])] }]));
            groups.forEach(group => {
                const aliases = [...new Set((group.aliases || []).map(name => String(name || '').trim()).filter(Boolean))];
                if (aliases.length < 2) return;
                const canonical = String(group.canonical || aliases[0]).trim();
                const key = this.normalizeFoodAlias(canonical);
                const prev = byCanonical.get(key) || { canonical, aliases: [] };
                prev.aliases = [...new Set([...(prev.aliases || []), canonical, ...aliases])];
                prev.canonical = canonical;
                prev.updatedAt = Date.now();
                byCanonical.set(key, prev);
            });
            this.db.health.foodAliasGroups = [...byCanonical.values()].filter(group => group.aliases?.length >= 2);
            this.onFoodSearchInput();
            this.saveAndBackup();
            setStatus(groups.length ? `已合并 ${groups.length} 组历史同类项` : 'AI 未发现可确定合并的同类项');
            window.toast?.show?.(groups.length ? `已合并 ${groups.length} 组历史同类项` : '未发现可合并项', groups.length ? 'success' : 'info');
        } catch (e) {
            const message = window.toast ? toast.sanitize(e) : String(e?.message || e);
            setStatus(`AI 合并失败：${message}`);
            window.toast?.show?.(`AI 合并失败：${message}`, 'error');
        }
    },

    onFoodSearchInput() {
        const kw = document.getElementById('foodName')?.value?.trim() || '';
        const results = fooddb.searchAll(kw);
        const historyResults = this.historicalFoodSuggestions(kw);
        this._foodHistorySuggestions = historyResults;
        const el = document.getElementById('foodSearchSuggest');
        if (!el) return;
        if (!kw || (results.length === 0 && historyResults.length === 0)) { el.innerHTML = ''; return; }
        const esc = this.escapeHtml || window.renderSafe?.escapeHtml || (v => String(v ?? ''));
        const historyHtml = historyResults.map((item, idx) => {
            const gramsText = item.grams ? ` · 上次 ${Number(item.grams)}g` : '';
            const dateText = item.date ? ` · ${item.date}` : '';
            const mergeText = item.mergedCount > 1 ? ` · 合并${item.mergedCount}名/${item.entryCount}次` : '';
            return `<button class="food-result-item food-history-result" onclick="data.applyHistoricalFoodItem(${idx})"><span>${esc(item.name)}</span><small>历史${dateText}${gramsText}${mergeText} · ${Number(item.cal || 0)} kcal/100g</small></button>`;
        }).join('');
        const libraryHtml = results.map(item =>
            `<button class="food-result-item" onclick="data.applyFoodItem('${esc(item.id)}')"><span>${esc(item.name)}</span><small>${Number(item.cal || 0)} kcal/100g</small></button>`
        ).join('');
        el.innerHTML = historyHtml + libraryHtml;
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

    normalizeAiFoodItems(items = []) {
        const normalized = globalThis.foodAiNormalizer?.normalize?.(items) || [];
        const details = normalized.normalizationDiagnostics;
        const incomplete = details?.items?.filter(item => item.missingFields.length || item.recoveredFields.length) || [];
        if ((incomplete.length || details?.outputCount !== details?.inputCount) && typeof window !== 'undefined') {
            window.errorBus?.event?.('ai-food-schema', 'normalization-partial', {
                inputCount: details?.inputCount || 0,
                outputCount: details?.outputCount || 0,
                items: incomplete
            });
        }
        return normalized;
    },

    async aiParseFood(options = {}) {
        if (this._aiFoodParseBusy) return;
        const textarea = document.getElementById('foodAiText');
        const manualInput = document.getElementById('foodName');
        const text = String(options?.text ?? textarea?.value?.trim() ?? manualInput?.value?.trim() ?? '').trim();
        if (!text) {
            if (textarea) { textarea.focus(); textarea.placeholder = '请先输入食物描述'; }
            const statusEl = document.getElementById('foodAiStatus');
            if (statusEl) statusEl.textContent = '请先输入食物描述';
            setTimeout(() => { if (textarea) textarea.placeholder = '说说你这顿吃了什么，例如：鸡胸肉饭加一杯豆浆'; }, 3000);
            return;
        }
        const statusEl = document.getElementById('foodAiStatus');
        if (statusEl) statusEl.textContent = '正在加载 AI 模块...';
        this._aiFoodParseBusy = true;
        try {
            const aiClient = await this.ensureAiRuntime?.() || window.ai;
            const effective = aiClient?.getEffectiveConfig?.() || aiClient?.cfg || {};
            if (!effective.enabled || typeof aiClient?.parseFood !== 'function') {
                if (statusEl) statusEl.textContent = '请先在设置中配置 AI 接口';
                return alert('请先在设置中配置 AI 接口');
            }
            if (statusEl) statusEl.textContent = 'AI 分析中...';
            const parseOptions = options?.routeOverride ? { routeOverride: options.routeOverride } : undefined;
            const items = this.normalizeAiFoodItems(await aiClient.parseFood(text, parseOptions));
            if (!items.length) throw new Error('未识别到食物');
            const incompleteCount = items.normalizationDiagnostics?.items?.filter(item => item.missingFields.length)?.length || 0;
            this._aiFoodResults = items;
            this._aiFoodAdded = new Set();
            this._aiFoodDrafts = items.map(item => this.formatAiDraft(item));
            this.renderAiFoodResults();
            if (statusEl) statusEl.textContent = incompleteCount
                ? `AI 已识别 ${items.length} 项，其中 ${incompleteCount} 项有空字段，请检查后添加`
                : `AI 已识别 ${items.length} 项，点击逐个添加或批量添加`;
        } catch (e) {
            const message = window.toast ? toast.sanitize(e) : String(e?.message || e);
            window.errorBus?.report?.('ai-food', e, {
                phase: 'parse-text',
                code: e?.code || '',
                inputSnippet: text.slice(0, 160),
                rawSnippet: String(e?.body || '').slice(0, 240)
            });
            if (statusEl) statusEl.textContent = 'AI 识别失败: ' + message;
            const fallback = e?.aiFallback;
            const target = fallback?.taskId === 'food.text'
                ? window.aiRoutingPure?.manualFallbackTarget?.(fallback.target)
                : null;
            if (target && window.toast?.show) {
                let used = false;
                toast.show('主模型不可用，可使用备用模型重试', 'error', 8000, {
                    label: '使用备用模型重试',
                    onClick: () => {
                        if (used) return Promise.resolve();
                        used = true;
                        return this.aiParseFood({ text, routeOverride: target });
                    }
                });
            }
        } finally {
            this._aiFoodParseBusy = false;
        }
    },

    updateAiFoodDraft(idx, field, value) {
        const drafts = this._aiFoodDrafts || [];
        if (!drafts[idx]) return;
        drafts[idx][field] = value;
    },

    renderAiFoodEditor(idx) {
        const draft = this._aiFoodDrafts?.[idx] || this.formatAiDraft(this._aiFoodResults?.[idx] || {});
        const safeValue = value => this.escapeHtml(String(value ?? ''));
        return `<div class="food-inline-edit-grid">
            <div class="md-field"><input type="text" value="${this.escapeHtml(draft.name)}" oninput="data.updateAiFoodDraft(${idx}, 'name', this.value)" placeholder=" "><label>食物</label></div>
            <div class="md-field"><input type="number" value="${safeValue(draft.grams)}" oninput="data.updateAiFoodDraft(${idx}, 'grams', this.value)" placeholder=" "><label>克数</label></div>
            <div class="md-field"><input type="number" value="${safeValue(draft.cal)}" oninput="data.updateAiFoodDraft(${idx}, 'cal', this.value)" placeholder=" "><label>kcal</label></div>
            <div class="md-field"><input type="number" value="${safeValue(draft.pro)}" oninput="data.updateAiFoodDraft(${idx}, 'pro', this.value)" placeholder=" "><label>蛋白</label></div>
            <div class="md-field"><input type="number" value="${safeValue(draft.carb)}" oninput="data.updateAiFoodDraft(${idx}, 'carb', this.value)" placeholder=" "><label>碳水</label></div>
            <div class="md-field"><input type="number" value="${safeValue(draft.fat)}" oninput="data.updateAiFoodDraft(${idx}, 'fat', this.value)" placeholder=" "><label>脂肪</label></div>
        </div>`;
    },

    renderAiFoodResults() {
        const items = this._aiFoodResults || [];
        const el = document.getElementById('foodAiResults');
        if (!el) return;
        if (items.length === 0) { el.innerHTML = ''; return; }
        const drafts = items.map((item, idx) => this._aiFoodDrafts?.[idx] || this.formatAiDraft(item));
        const totalCal = drafts.reduce((sum, item) => sum + Number(item.cal || 0), 0);
        el.innerHTML = `
            <button class="food-result-item food-add-all" onclick="data.addAllAiFoods()"><span class="material-symbols-rounded">done_all</span><span>全部添加</span><small>${items.filter((_, idx) => !(this._aiFoodAdded && this._aiFoodAdded.has(idx))).length}/${items.length} 项 · ${this.escapeHtml(String(totalCal))} kcal</small></button>
            ${items.map((item, idx) => {
                const added = this._aiFoodAdded && this._aiFoodAdded.has(idx);
                const draft = drafts[idx];
                const gramsText = draft.grams ? ' ' + this.escapeHtml(String(draft.grams)) + 'g' : '';
                const summary = `${this.escapeHtml(String(draft.cal || 0))} kcal${draft.pro ? ' · 蛋白' + this.escapeHtml(String(draft.pro)) + 'g' : ''}`;
                return `<div class="food-ai-result-card ${added ? 'food-added' : ''}">
                    <div class="food-result-item food-ai-result">
                        <span>${this.escapeHtml(draft.name || item.name)}${gramsText}</span>
                        <small>${summary}</small>
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
        const meal = this._dietMeal || this.defaultDietMealForTime?.() || 'lunch';
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
        const meal = this._dietMeal || this.defaultDietMealForTime?.() || 'lunch';
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
            id: this.generateRecordId(`ai-food-${idx}`),
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
            fiber: Number(item.fiber || 0),
            sugar: Number(item.sugar || 0),
            sodium: Number(item.sodium || 0),
            saturatedFat: Number(item.saturatedFat || 0),
            ingredients: item.ingredients || [],
            cooking: item.cooking || '',
            source: item.source || 'ai-food-parse',
            sourceLabel: 'AI 识别结果',
            confidence: item.confidence || '',
            note: item.note || '',
            createdAt: new Date().toISOString(),
            updatedAt: Date.now(),
            deleted: false
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
