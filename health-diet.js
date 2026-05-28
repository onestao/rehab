// @ts-nocheck
(function () {
    let _aiPhotoBusy = false;

    function sanitizeMessage(value) {
        return window.toast?.sanitize ? toast.sanitize(value) : String(value?.message || value || '');
    }

    function setButtonContent(button, icon, text, spinning = false) {
        if (!button) return;
        button.textContent = '';
        const iconEl = document.createElement('span');
        iconEl.className = `material-symbols-rounded${spinning ? ' diet-photo-spin' : ''}`;
        iconEl.textContent = icon;
        button.appendChild(iconEl);
        button.appendChild(document.createTextNode(` ${text}`));
    }

    window.dataHealthDiet = {
        getDietPhotoSupportInfo() {
            const cfg = window.ai?.getEffectiveConfig?.() || window.ai?.cfg || {};
            const provider = String(cfg.provider || '').toLowerCase();
            const model = String(cfg.model || '').toLowerCase();
            if (!cfg.enabled) return { supported: false, reason: '请先填写 Base URL 和模型' };
            if (!cfg.apiKey) return { supported: false, reason: '请先在当前 AI 配置中填写 API Key' };
            if (!window.aiVisionPure?.isKnownDietPhotoProvider?.(provider)) return { supported: false, reason: '当前提供商暂不支持拍照识别' };
            const verdict = window.ai?.analyzeVisionModel?.(model, provider) || { vision: false, isImageGen: false, highRes: false };
            if (verdict.isImageGen) return { supported: false, reason: '图像生成模型不能用于拍照识别', verdict };
            const failure = window.ai?.getVisionFailure?.(provider, model);
            if (failure) return { supported: true, warning: `上次识别失败：${failure.reason}，仍可重试`, verdict, failure };
            if (!verdict.vision) return { supported: true, warning: '该模型未在视觉白名单中，识别可能失败但可尝试', verdict };
            return { supported: true, reason: '拍照识别', verdict };
        },

        dietPhotoTitle() {
            const info = this.getDietPhotoSupportInfo();
            return info.warning || info.reason || '拍照识别';
        },

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

        renderDietModalContent() {
            const mode = this._dietInputMode || this.db.health.dietInputMode || 'ai';
            const meal = this._dietMeal || 'lunch';
            const mealBtn = (key, label) => `<button class="diet-meal-pill ${meal === key ? 'active' : ''}" onclick="data.setDietMeal('${key}')" type="button">${this.escapeHtml(label)}</button>`;
            const photoInfo = this.getDietPhotoSupportInfo();
            const photoTitle = this.escapeHtml(this.dietPhotoTitle());
            return `
                <div class="diet-mode-tabs" style="margin-bottom:10px">
                    <button class="diet-mode-tab ${mode === 'ai' ? 'active' : ''}" data-mode="ai" onclick="data.setDietInputMode('ai')" type="button"><span class="material-symbols-rounded">auto_awesome</span> AI</button>
                    <button class="diet-mode-tab ${mode === 'manual' ? 'active' : ''}" data-mode="manual" onclick="data.setDietInputMode('manual')" type="button"><span class="material-symbols-rounded">edit_note</span> 手动</button>
                </div>
                <div class="diet-meal-selector" style="margin-bottom:10px">
                    ${mealBtn('breakfast', '早餐')}${mealBtn('lunch', '午餐')}${mealBtn('dinner', '晚餐')}${mealBtn('snack', '加餐')}
                </div>
                <div id="foodAiArea" class="diet-ai-entry ${mode === 'ai' ? '' : 'hidden'}">
                    <textarea id="foodAiText" class="diet-ai-input" placeholder="说说你这顿吃了什么，例如：鸡胸肉饭加一杯豆浆" oninput="data.autoResizeDietInput(this)"></textarea>
                    <div class="diet-ai-actions">
                        <button class="md-btn md-btn-filled" onclick="data.aiParseFood()" type="button"><span class="material-symbols-rounded">auto_awesome</span> 文本识别</button>
                        <button id="dietPhotoButton" class="md-btn md-btn-tonal" onclick="data.triggerDietPhoto()" type="button" title="${photoTitle}"><span class="material-symbols-rounded">visibility</span> 拍照识别</button>
                        <input id="dietPhotoInput" class="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" onchange="data.handleDietPhoto(this.files?.[0])">
                    </div>
                    <small id="foodAiStatus" class="food-ai-status"></small>
                    <div id="foodAiResults"></div>
                </div>
                <div id="foodManualArea" class="${mode === 'manual' ? '' : 'hidden'}">
                    <div class="md-grid modal-grid">
                        <div class="md-field span-full"><input id="foodName" type="text" placeholder=" " oninput="data.onFoodSearchInput()" onblur="data.autoFillFoodByName()"><label>食物</label></div>
                        <div id="foodSearchSuggest" class="span-full"></div>
                        <div class="md-field"><input id="foodGrams" type="number" step="1" placeholder=" " oninput="data.updateFoodComputedPreview()"><label>克数</label></div>
                        <div class="md-field"><select id="foodCalUnit" onchange="data.changeFoodCalUnit(this.value)"><option value="kj">千焦 kJ</option><option value="kcal">千卡 kcal</option></select><label>热量单位</label></div>
                        <div class="md-field"><input id="foodCal" type="number" step="0.1" placeholder=" " oninput="data.updateFoodComputedPreview()"><label id="foodCalLabel">千焦 kJ/100g</label></div>
                        <div class="md-field"><input id="foodPro" type="number" step="0.1" placeholder=" " oninput="data.updateFoodComputedPreview()"><label>蛋白/100g</label></div>
                        <div class="md-field"><input id="foodCarb" type="number" step="0.1" placeholder=" " oninput="data.updateFoodComputedPreview()"><label>碳水/100g</label></div>
                        <div class="md-field"><input id="foodFat" type="number" step="0.1" placeholder=" " oninput="data.updateFoodComputedPreview()"><label>脂肪/100g</label></div>
                        <small id="foodCalUnitHint" class="span-full"></small>
                        <small id="foodComputed" class="span-full">输入食物和重量后自动计算</small>
                    </div>
                    <div class="md-row modal-actions">
                        <button class="md-btn md-btn-tonal" onclick="data.closeDietModal()" type="button">取消</button>
                        <button class="md-btn md-btn-filled" onclick="data.addFoodLog()" type="button"><span class="material-symbols-rounded">save</span> 保存记录</button>
                    </div>
                </div>
            `;
        },

        async openDietModal() {
            const modal = document.getElementById('dietModal');
            const content = document.getElementById('dietModalContent');
            if (!modal || !content) return;
            content.innerHTML = this.renderDietModalContent();
            this.syncFoodCalLabel?.();
            this.setDietInputMode(this._dietInputMode || this.db.health.dietInputMode || 'ai');
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
            window.navStack?.replaceOrPush?.({
                type: 'modal',
                id: 'dietModal',
                close: () => this.closeDietModalInternal()
            });
            window.ai?.loadVisionWhitelist?.().then(() => {
                const button = document.getElementById('dietPhotoButton');
                if (button) button.title = this.dietPhotoTitle();
            }).catch(() => {});
        },

        closeDietModal() {
            if (!window.navStack?.requestClose?.('modal')) this.closeDietModalInternal();
        },

        closeDietModalInternal() {
            const modal = document.getElementById('dietModal');
            modal?.classList.add('hidden');
            modal?.setAttribute('aria-hidden', 'true');
            return true;
        },

        isDietPhotoAiSupported() {
            return !!this.getDietPhotoSupportInfo().supported;
        },

        triggerDietPhoto() {
            if (_aiPhotoBusy) return;
            const info = this.getDietPhotoSupportInfo();
            if (!info.supported) {
                this.setDietPhotoStatus('blocked', info.reason || '当前 AI 配置不可用');
                window.toast?.show?.(info.reason || '当前 AI 配置不可用', 'info');
                return;
            }
            document.getElementById('dietPhotoInput')?.click?.();
        },

        setDietPhotoStatus(stage, text, onCancel = null) {
            const statusEl = document.getElementById('foodAiStatus');
            if (!statusEl) return;
            statusEl.textContent = text || '';
            statusEl.dataset.stage = stage || '';
            if (onCancel) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'food-ai-cancel';
                btn.textContent = '取消';
                btn.onclick = onCancel;
                statusEl.appendChild(btn);
            }
        },

        async handleDietPhoto(file) {
            const inputEl = document.getElementById('dietPhotoInput');
            const button = document.getElementById('dietPhotoButton');
            if (!file) return;
            if (_aiPhotoBusy) return;
            const support = this.getDietPhotoSupportInfo();
            if (!support.supported) {
                this.setDietPhotoStatus('failed', support.reason || '当前 AI 配置不可用');
                window.toast?.show?.(support.reason || '当前 AI 配置不可用', 'info');
                if (inputEl) inputEl.value = '';
                return;
            }
            if (!window.ai?.parseFoodFromImage) {
                this.setDietPhotoStatus('failed', '当前版本未接入图片识别');
                window.toast?.show?.('当前版本未接入图片识别', 'info');
                if (inputEl) inputEl.value = '';
                return;
            }
            _aiPhotoBusy = true;
            const cfg = window.ai?.getEffectiveConfig?.() || {};
            const isHeic = window.ai?._isHeicFile?.(file);
            const controller = new AbortController();
            this._dietPhotoAbortController = controller;
            if (button) {
                button.disabled = true;
                setButtonContent(button, 'progress_activity', '识别中…', true);
            }
            this.setDietPhotoStatus('selected', '已选择照片，准备处理', () => controller.abort());
            window.haptics?.light?.();
            window.toast?.show?.('正在识别照片…', 'info');
            try {
                const items = await window.ai.parseFoodFromImage(file, {
                    signal: controller.signal,
                    timeoutMs: isHeic ? 45000 : 30000,
                    onProgress: ({ stage }) => {
                        if (stage === 'heic') this.setDietPhotoStatus('decode', '正在处理 HEIC 照片…', () => controller.abort());
                        else if (stage === 'resize') this.setDietPhotoStatus('resize', '正在压缩照片…', () => controller.abort());
                        else if (stage === 'request') this.setDietPhotoStatus('request', '正在请求 AI 识别…', () => controller.abort());
                        else if (stage === 'parse') this.setDietPhotoStatus('parse', '正在解析识别结果…');
                    }
                });
                if (!items || !items.length) throw new Error('未识别到食物');
                this._aiFoodResults = items;
                this._aiFoodAdded = new Set();
                const format = typeof this.formatAiDraft === 'function' ? this.formatAiDraft.bind(this) : (v => v);
                this._aiFoodDrafts = items.map(item => format(item));
                this.renderAiFoodResults?.();
                this.setDietPhotoStatus('done', `AI 已识别 ${items.length} 项，点击逐个添加或批量添加`);
                window.ai?.clearVisionFailure?.(cfg.provider, cfg.model);
                window.haptics?.success?.();
                window.toast?.show?.(`识别到 ${items.length} 项食物`, 'success');
            } catch (e) {
                const classified = window.aiVisionPure?.classifyVisionError?.(e) || { type: 'unknown', message: sanitizeMessage(e), isErrorToast: true };
                if (classified.cacheVisionFailure) window.ai?.markVisionFailure?.(cfg.provider, cfg.model, classified.message);
                if (classified.type === 'cancelled') {
                    this.setDietPhotoStatus('cancelled', '已取消');
                    return;
                }
                const message = sanitizeMessage(classified.message || e);
                this.setDietPhotoStatus(classified.type || 'failed', `识别失败：${message}`);
                window.haptics?.error?.();
                if (classified.isErrorToast !== false) window.toast?.show?.(`识别失败：${message}`, 'error');
            } finally {
                _aiPhotoBusy = false;
                this._dietPhotoAbortController = null;
                if (button) {
                    button.disabled = false;
                    setButtonContent(button, 'visibility', '拍照识别');
                    button.title = this.dietPhotoTitle();
                }
                if (inputEl) inputEl.value = '';
            }
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
            const name = this.escapeHtml(f.name || '未命名食物');
            const grams = f.grams ? ` ${this.escapeHtml(f.grams)}g` : '';
            return `<div class="diet-log-item">
            <div class="diet-log-main">
                <span class="diet-log-name">${name}${grams}</span>
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
            const safeNumberValue = value => this.escapeHtml(value ?? '');
            return `<div class="diet-log-editor">
            <div class="food-inline-edit-grid">
                <div class="md-field"><select onchange="data._editingFoodDraft.meal=this.value"><option value="breakfast" ${draft.meal === 'breakfast' ? 'selected' : ''}>早餐</option><option value="lunch" ${draft.meal === 'lunch' ? 'selected' : ''}>午餐</option><option value="dinner" ${draft.meal === 'dinner' ? 'selected' : ''}>晚餐</option><option value="snack" ${draft.meal === 'snack' ? 'selected' : ''}>加餐</option></select><label>餐次</label></div>
                <div class="md-field"><input type="text" value="${this.escapeHtml(draft.name)}" oninput="data._editingFoodDraft.name=this.value" placeholder=" "><label>食物</label></div>
                <div class="md-field"><input type="number" value="${safeNumberValue(draft.grams)}" oninput="data._editingFoodDraft.grams=this.value" placeholder=" "><label>克数</label></div>
                <div class="md-field"><select onchange="data.changeEditingFoodCalUnit(this.value)"><option value="kj" ${draft.calUnit === 'kj' ? 'selected' : ''}>千焦 kJ</option><option value="kcal" ${draft.calUnit === 'kcal' ? 'selected' : ''}>千卡 kcal</option></select><label>热量单位</label></div>
                <div class="md-field"><input type="number" step="0.1" value="${safeNumberValue(draft.calInputPer100g)}" oninput="data.updateEditingFoodCalInput(this.value)" placeholder=" "><label>${this.escapeHtml(this.foodCalLabel ? this.foodCalLabel(draft.calUnit) : '千卡 kcal/100g')}</label></div>
                <div class="md-field"><input type="number" value="${safeNumberValue(draft.proPer100g)}" oninput="data._editingFoodDraft.proPer100g=this.value" placeholder=" "><label>蛋白/100g</label></div>
                <div class="md-field"><input type="number" value="${safeNumberValue(draft.carbPer100g)}" oninput="data._editingFoodDraft.carbPer100g=this.value" placeholder=" "><label>碳水/100g</label></div>
                <div class="md-field"><input type="number" value="${safeNumberValue(draft.fatPer100g)}" oninput="data._editingFoodDraft.fatPer100g=this.value" placeholder=" "><label>脂肪/100g</label></div>
            </div>
            <div class="food-inline-actions food-edit-actions">
                <button class="md-btn md-btn-tonal" onclick="data.cancelEditFoodLog()">取消</button>
                <button class="md-btn md-btn-filled" onclick="data.saveEditFoodLog('${f.id}')"><span class="material-symbols-rounded">save</span> 保存</button>
            </div>
        </div>`;
        },

        setDietInputMode(mode) {
            this._dietInputMode = mode || 'ai';
            this.db.health.dietInputMode = this._dietInputMode;
            const manualArea = document.getElementById('foodManualArea');
            const aiArea = document.getElementById('foodAiArea');
            if (manualArea) manualArea.classList.toggle('hidden', mode !== 'manual');
            if (aiArea) aiArea.classList.toggle('hidden', mode !== 'ai');
            if (mode === 'manual') this.clearAiResults?.();
            document.querySelectorAll('.diet-mode-tab').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === mode);
            });
            this.save?.();
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
