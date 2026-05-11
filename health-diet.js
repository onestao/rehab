(function () {
    window.dataHealthDiet = {
        setFoodSource(label = '') {
            this._foodSource = label;
            const el = document.getElementById('foodSourceHint');
            if (el) {
                el.textContent = label ? `当前营养来源：${label}，你仍可手动修改` : '输入食物后可从食物库或 AI 自动填充营养';
                el.classList.toggle('active', !!label);
            }
        },

        syncFoodCalLabel() {
            const unit = this._foodCalUnit || 'kj';
            const label = document.getElementById('foodCalLabel');
            if (label) label.textContent = this.foodCalLabel(unit);
            const hint = document.getElementById('foodCalUnitHint');
            if (hint) hint.textContent = unit === 'kj'
                ? '输入千焦后会自动换算为 kcal 保存和统计'
                : '输入千卡后会直接按 kcal 保存和统计';
            const select = document.getElementById('foodCalUnit');
            if (select && select.value !== unit) select.value = unit;
        },

        changeFoodCalUnit(unit) {
            const nextUnit = unit === 'kcal' ? 'kcal' : 'kj';
            const input = document.getElementById('foodCal');
            if (input && input.value) {
                const converted = this.convertFoodCaloriesValue(input.value, this._foodCalUnit || 'kj', nextUnit);
                input.value = converted === '' ? '' : String(converted);
            }
            this._foodCalUnit = nextUnit;
            this.syncFoodCalLabel();
            this.updateFoodComputedPreview?.();
        },

        updateEditingFoodCalInput(value) {
            if (!this._editingFoodDraft) return;
            this._editingFoodDraft.calInputPer100g = value;
            this._editingFoodDraft.calPer100g = this.parseFoodCaloriesToKcal(value, this._editingFoodDraft.calUnit || 'kcal');
        },

        changeEditingFoodCalUnit(unit) {
            if (!this._editingFoodDraft) return;
            const nextUnit = unit === 'kj' ? 'kj' : 'kcal';
            const prevUnit = this._editingFoodDraft.calUnit || 'kcal';
            this._editingFoodDraft.calInputPer100g = this.convertFoodCaloriesValue(this._editingFoodDraft.calInputPer100g, prevUnit, nextUnit);
            this._editingFoodDraft.calUnit = nextUnit;
            this.render();
        },

        defaultDietGoals() {
            const goal = this.db.health.dietGoal || {};
            const cal = Number(goal.dailyCal || 0);
            const goalType = goal.goalType || this.db.health.goalType || 'loss';
            if (goalType === 'gain' && cal) {
                const latest = this.sortedWeights().slice(-1)[0];
                const bodyWeight = latest?.weight || 70;
                const pro = Number(goal.proteinGoal || Math.round(bodyWeight * 1.8));
                const fat = Number(goal.fatGoal || Math.round(cal * 0.25 / 9));
                const carb = Number(goal.carbGoal || Math.max(0, Math.round((cal - pro * 4 - fat * 9) / 4)));
                return { cal, pro, carb, fat };
            }
            return {
                cal,
                pro: Number(goal.proteinGoal || (cal ? Math.round(cal * 0.3 / 4) : 90)),
                carb: Number(goal.carbGoal || (cal ? Math.round(cal * 0.4 / 4) : 180)),
                fat: Number(goal.fatGoal || (cal ? Math.round(cal * 0.3 / 9) : 55))
            };
        },

        currentGoalType() {
            return this.db.health.dietGoal?.goalType || this.db.health.goalType || 'loss';
        },

        isGainMode() {
            return this.currentGoalType() === 'gain';
        },

        renderDietPanel() {
            const todayLogs = this.todayFoodLogs();
            const totalCal = this.todayCalories();
            const macros = this.todayMacros();
            const goals = this.defaultDietGoals();
            const mealGroups = { breakfast: [], lunch: [], dinner: [], snack: [] };
            todayLogs.forEach(f => { (mealGroups[f.meal] || mealGroups.snack).push(f); });
            const mealNames = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
            const collapsed = this.isCollapsed('dietPanel', false);
            return `<div class="md-card diet-card collapsible-card ${collapsed ? 'collapsed' : ''}">
            <button class="diet-head collapsible-head-btn" onclick="data.toggleCollapse('dietPanel')" type="button" aria-expanded="${!collapsed}">
                <div>
                    <span class="cardio-kicker">饮食记录</span>
                    <h3>${totalCal} kcal</h3>
                    <small>今日摄入 · ${todayLogs.length} 条记录</small>
                </div>
                ${this.foodSourceTag()}
                <span class="collapse-btn"><span class="material-symbols-rounded">${collapsed ? 'expand_more' : 'expand_less'}</span></span>
            </button>
            <div class="macro-summary macro-progress-grid">
                <div class="macro-card protein">
                    <div class="macro-head"><b>${macros.pro.toFixed(1)}g</b><small>蛋白 / 目标 ${goals.pro}g</small></div>
                    <div class="macro-track"><span style="width:${this.ratio(macros.pro, goals.pro)}%"></span></div>
                </div>
                <div class="macro-card carb">
                    <div class="macro-head"><b>${macros.carb.toFixed(1)}g</b><small>碳水 / 目标 ${goals.carb}g</small></div>
                    <div class="macro-track"><span style="width:${this.ratio(macros.carb, goals.carb)}%"></span></div>
                </div>
                <div class="macro-card fat">
                    <div class="macro-head"><b>${macros.fat.toFixed(1)}g</b><small>脂肪 / 目标 ${goals.fat}g</small></div>
                    <div class="macro-track"><span style="width:${this.ratio(macros.fat, goals.fat)}%"></span></div>
                </div>
            </div>
            <div class="collapse-content">
            <button class="md-btn md-btn-filled" onclick="data.openDietModal()" type="button" style="margin:4px 0 8px"><span class="material-symbols-rounded">add</span> 添加饮食</button>
            ${Object.entries(mealGroups).map(([key, items]) => {
                if (items.length === 0) return '';
                const subTotal = items.reduce((s, f) => s + f.cal, 0);
                const mealCollapsed = this.isCollapsed(`diet_meal_${key}`, items.length > 3);
                return `<div class="diet-meal-group ${mealCollapsed ? 'collapsed' : ''}">
                    <button class="diet-meal-head" onclick="data.toggleCollapse('diet_meal_${key}')" type="button">
                        <span class="material-symbols-rounded">restaurant</span>
                        <strong>${mealNames[key]}</strong>
                        <small>${items.length} 条 · ${subTotal} kcal</small>
                        <span class="material-symbols-rounded">${mealCollapsed ? 'expand_more' : 'expand_less'}</span>
                    </button>
                    <div class="diet-meal-content">
                        ${items.map(f => this._editingFoodLogId === f.id ? this.renderDietLogEditor(f) : this.renderDietLogItem(f)).join('')}
                    </div>
                </div>`;
            }).join('')}


            </div>
        </div>`;
        },

        renderDietLogItem(f) {
            return `<div class="diet-log-item">
            <div class="diet-log-main">
                <span class="diet-log-name">${f.name}${f.grams ? ' ' + f.grams + 'g' : ''}</span>
                <b class="diet-log-cal">${f.cal} kcal</b>
            </div>
            <div class="diet-log-sub">
                <small>P${Number(f.pro || 0).toFixed(0)} · C${Number(f.carb || 0).toFixed(0)} · F${Number(f.fat || 0).toFixed(0)}</small>
                <div class="diet-log-actions">
                    <button class="food-log-action-btn" onclick="data.startEditFoodLog('${f.id}')" aria-label="编辑"><span class="material-symbols-rounded">edit</span></button>
                    <button class="delete-btn" onclick="data.deleteFoodLog('${f.id}')"><span class="material-symbols-rounded">delete</span></button>
                </div>
            </div>
        </div>`;
        },

        renderDietLogEditor(f) {
            const draft = this._editingFoodDraft || {
                id: f.id,
                meal: f.meal || 'lunch',
                name: f.name || '',
                grams: f.grams || '',
                calUnit: f.calUnit || 'kcal',
                calInputPer100g: f.calInputPer100g || f.calPer100g || '',
                calPer100g: f.calPer100g || '',
                proPer100g: f.proPer100g || '',
                carbPer100g: f.carbPer100g || '',
                fatPer100g: f.fatPer100g || ''
            };
            return `<div class="diet-log-editor">
            <div class="food-inline-edit-grid">
                <div class="md-field"><select onchange="data._editingFoodDraft.meal=this.value"><option value="breakfast" ${draft.meal === 'breakfast' ? 'selected' : ''}>早餐</option><option value="lunch" ${draft.meal === 'lunch' ? 'selected' : ''}>午餐</option><option value="dinner" ${draft.meal === 'dinner' ? 'selected' : ''}>晚餐</option><option value="snack" ${draft.meal === 'snack' ? 'selected' : ''}>加餐</option></select><label>餐次</label></div>
                <div class="md-field"><input type="text" value="${this.escapeHtml(draft.name)}" oninput="data._editingFoodDraft.name=this.value" placeholder=" "><label>食物</label></div>
                <div class="md-field"><input type="number" value="${draft.grams}" oninput="data._editingFoodDraft.grams=this.value" placeholder=" "><label>克数</label></div>
                <div class="md-field"><select onchange="data.changeEditingFoodCalUnit(this.value)"><option value="kj" ${draft.calUnit === 'kj' ? 'selected' : ''}>千焦 kJ</option><option value="kcal" ${draft.calUnit === 'kcal' ? 'selected' : ''}>千卡 kcal</option></select><label>热量单位</label></div>
                <div class="md-field"><input type="number" step="0.1" value="${draft.calInputPer100g}" oninput="data.updateEditingFoodCalInput(this.value)" placeholder=" "><label>${this.foodCalLabel ? this.foodCalLabel(draft.calUnit) : '千卡 kcal/100g'}</label></div>
                <div class="md-field"><input type="number" value="${draft.proPer100g}" oninput="data._editingFoodDraft.proPer100g=this.value" placeholder=" "><label>蛋白/100g</label></div>
                <div class="md-field"><input type="number" value="${draft.carbPer100g}" oninput="data._editingFoodDraft.carbPer100g=this.value" placeholder=" "><label>碳水/100g</label></div>
                <div class="md-field"><input type="number" value="${draft.fatPer100g}" oninput="data._editingFoodDraft.fatPer100g=this.value" placeholder=" "><label>脂肪/100g</label></div>
            </div>
            <div class="food-inline-actions">
                <button class="md-btn md-btn-tonal" onclick="data.cancelEditFoodLog()">取消</button>
                <button class="md-btn md-btn-filled" onclick="data.saveEditFoodLog('${f.id}')"><span class="material-symbols-rounded">save</span> 保存</button>
            </div>
        </div>`;
        },

        setDietInputMode(mode) {
            this._dietInputMode = mode || 'ai';
            const manualArea = document.getElementById('foodManualArea');
            if (manualArea) manualArea.classList.toggle('hidden', mode !== 'manual');
            document.querySelectorAll('.diet-mode-tab').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === mode);
            });
        },

        setGoalType(type) {
            this.db.health.goalType = type;
            this.saveAndBackup();
            this.renderHistory();
        },

        setDietMeal(meal) {
            this._dietMeal = meal || 'lunch';
            const select = document.getElementById('foodMeal');
            if (select) select.value = meal;
            document.querySelectorAll('.diet-meal-pill').forEach(btn => {
                btn.classList.toggle('active', btn.textContent === { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' }[meal]);
            });
        },

        autoResizeDietInput(el) {
            if (!el) return;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
        },

        useFoodAiText(text) {
            const input = document.getElementById('foodAiText');
            if (!input) return;
            input.value = text;
            this.autoResizeDietInput(input);
            input.focus();
        }
    };
})();
