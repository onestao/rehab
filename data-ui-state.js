(function () {
    window.dataUiState = {
        shiftHistoryMonth(delta) {
            this.historyMonthOffset += delta;
            this.selectedCalendarDate = null;
            this.renderHistory();
        },

        selectCalendarDate(dateStr) {
            this.selectedCalendarDate = this.selectedCalendarDate === dateStr ? null : dateStr;
            this.renderHistory();
        },

        setRecordView(view) {
            this.recordView = view || 'today';
            this.captureAdviceDraft?.();
            this.renderHistory();
        },

        setHealthView(view) {
            this.scrollToHealthView(view || 'weight');
        },

        setRoutineView(view) {
            this.captureAdviceDraft?.();
            if (view === 'advice') {
                const nav = document.querySelectorAll('.nav-item')[3];
                if (nav) ui.tab('ai-coach', nav);
                return;
            }
            this.routineView = view;
            this.renderRoutines();
        },

        toggleCollapse(id) {
            this.captureAdviceDraft?.();
            this._collapse = this._collapse || {};
            const currentCollapsed = this.currentDomCollapseState(id);
            if (this._collapse[id] === undefined) {
                this._collapse[id] = currentCollapsed === null ? (id === 'dietPanel' ? true : false) : !currentCollapsed;
            } else {
                this._collapse[id] = !this._collapse[id];
            }
            if (this.applyCollapseStateToDom(id)) return;
            this.render();
        },

        currentDomCollapseState(id) {
            const container = this.findCollapseContainer(id);
            return container ? container.classList.contains('collapsed') : null;
        },

        applyCollapseStateToDom(id) {
            const container = this.findCollapseContainer(id);
            if (!container) return false;
            const button = this.findCollapseButton(id);
            const collapsed = !!this._collapse?.[id];
            container.classList.toggle('collapsed', collapsed);
            if (button?.classList.contains('collapsible-head-btn')) {
                button.setAttribute('aria-expanded', String(!collapsed));
            }
            const icons = Array.from(button?.querySelectorAll('.material-symbols-rounded') || []);
            const icon = icons.findLast?.(el => /^expand_(more|less)$/.test(el.textContent.trim()))
                || icons.reverse().find(el => /^expand_(more|less)$/.test(el.textContent.trim()));
            if (icon) icon.textContent = collapsed ? 'expand_more' : 'expand_less';
            return true;
        },

        findCollapseContainer(id) {
            const button = this.findCollapseButton(id);
            return button?.closest('.collapsible-card, .diet-meal-group, .history-month-group, .history-older-group, .weight-history-card') || null;
        },

        findCollapseButton(id) {
            const button = Array.from(document.querySelectorAll('button[onclick^="data.toggleCollapse"]'))
                .find(btn => {
                    const handler = btn.getAttribute('onclick') || '';
                    return handler.includes(`'${id}'`) || handler.includes(`\"${id}\"`);
                });
            return button || null;
        },

        isCollapsed(id, defaultState = true) {
            this._collapse = this._collapse || {};
            return this._collapse[id] ?? defaultState;
        },

        setWeightRange(range) {
            this.weightRange = range;
            this.renderHistory();
        },

        openWeightModal() {
            document.getElementById('modalWeightDate').value = this.dateKey(new Date());
            document.getElementById('modalHeight').value = this.db.health.height || '';
            document.getElementById('weightModal').classList.remove('hidden');
        },

        closeWeightModal() {
            document.getElementById('weightModal').classList.add('hidden');
        },

        openDietModal() {
            const el = document.getElementById('dietModalContent');
            if (el) el.innerHTML = this.renderDietModalContent();
            this._foodCalUnit = 'kj';
            this.syncFoodCalLabel?.();
            this.setFoodSource('');
            document.getElementById('dietModal').classList.remove('hidden');
            this._dietInputMode = 'ai';
        },

        closeDietModal() {
            document.getElementById('dietModal').classList.add('hidden');
            this.clearAiResults?.();
            this.renderHistory();
        },

        renderDietModalContent() {
            const meal = this._dietMeal || 'lunch';
            const meals = [['breakfast','早餐'],['lunch','午餐'],['dinner','晚餐'],['snack','加餐']];
            return '<div class="diet-modal-body">' +
                '<div class="diet-meal-selector">' + meals.map(([k,v]) => '<button class="diet-meal-pill' + (meal===k ? ' active' : '') + '" onclick="data.setDietMeal(\''+k+'\')" type="button">' + v + '</button>').join('') + '</div>' +
                '<div class="diet-mode-tabs" role="tablist"><button class="diet-mode-tab active" data-mode="ai" onclick="data.setDietInputMode(\'ai\')" type="button"><span class="material-symbols-rounded">psychology</span>AI录入</button><button class="diet-mode-tab" data-mode="manual" onclick="data.setDietInputMode(\'manual\')" type="button"><span class="material-symbols-rounded">edit</span>手动录入</button></div>' +
                '<div class="diet-ai-entry"><textarea id="foodAiText" class="diet-ai-input" rows="2" placeholder="描述这顿吃了什么..." oninput="data.autoResizeDietInput(this)"></textarea><button class="md-btn md-btn-filled diet-ai-run" onclick="data.aiParseFood()"><span class="material-symbols-rounded">psychology</span>AI识别</button></div>' +
                '<div id="foodSearchResults" class="food-search-results"></div><div id="foodAiStatus" class="food-ai-status"></div>' +
                '<div id="foodManualArea" class="diet-manual-area hidden"><div class="md-grid diet-input-grid">' +
                '<div class="md-field span-full"><input type="text" id="foodName" placeholder=" " oninput="data.onFoodSearchInput()" onblur="data.autoFillFoodByName()"><label>食物名称</label></div>' +
                '<div class="md-field"><input type="number" id="foodGrams" step="1" placeholder=" " oninput="data.updateFoodComputedPreview()"><label>克数</label></div>' +
                '<div class="md-field"><select id="foodCalUnit" onchange="data.changeFoodCalUnit(this.value)"><option value="kj" selected>千焦 kJ</option><option value="kcal">千卡 kcal</option></select><label>热量单位</label></div>' +
                '<div class="md-field"><input type="number" id="foodCal" step="0.1" placeholder=" " oninput="data.updateFoodComputedPreview()"><label id="foodCalLabel">千焦 kJ/100g</label></div>' +
                '<div class="md-field"><input type="number" id="foodPro" step="0.1" placeholder=" " oninput="data.updateFoodComputedPreview()"><label>蛋白/100g</label></div>' +
                '<div class="md-field"><input type="number" id="foodCarb" step="0.1" placeholder=" " oninput="data.updateFoodComputedPreview()"><label>碳水/100g</label></div>' +
                '<div class="md-field"><input type="number" id="foodFat" step="0.1" placeholder=" " oninput="data.updateFoodComputedPreview()"><label>脂肪/100g</label></div>' +
                '<div id="foodCalUnitHint" class="food-cal-hint span-full">输入千焦后会自动换算为 kcal 保存和统计</div>' +
                '<div id="foodComputed" class="food-computed span-full">输入食物和重量后自动计算</div>' +
                '<div id="foodSourceHint" class="food-source-hint span-full">输入食物后可从食物库或 AI 自动填充营养</div>' +
                '<div class="diet-btn-row"><button class="md-btn md-btn-filled" onclick="data.addFoodLog()"><span class="material-symbols-rounded">add</span> 添加</button><button class="md-btn md-btn-tonal" onclick="data.aiParseFood()"><span class="material-symbols-rounded">psychology</span></button></div>' +
                '</div></div></div>';
        },

        openExerciseModal() {
            const el = document.getElementById('exerciseModalContent');
            if (el) el.innerHTML = this.renderExerciseModalContent();
            document.getElementById('exerciseModal').classList.remove('hidden');
        },

        closeExerciseModal() {
            document.getElementById('exerciseModal').classList.add('hidden');
            this.renderHistory();
        },

        renderExerciseModalContent() {
            return '<div class="exercise-modal-body"><div class="md-grid exercise-grid">' +
                '<div class="md-field"><select id="manualExerciseType" onchange="data.toggleManualCustomExercise(this.value)"><option value="walk">步行</option><option value="run">跑步</option><option value="cycling">骑行</option><option value="swim">游泳</option><option value="battle_rope">战绳</option><option value="spin_bike">动感单车</option><option value="strength">力量训练</option><option value="stretch">拉伸/瑜伽</option><option value="custom">自定义运动</option></select><label>运动种类</label></div>' +
                '<div class="md-field hidden" id="manualExerciseCustomField"><input type="text" id="manualExerciseCustom" placeholder=" "><label>自定义运动名称</label></div>' +
                '<div class="md-field"><input type="number" id="manualExerciseMinutes" step="1" placeholder=" "><label>时长 分钟</label></div>' +
                '<div class="md-field"><input type="number" id="manualExerciseCalories" step="1" placeholder=" "><label>热量 kcal</label></div>' +
                '<div class="md-field"><input type="number" id="manualExerciseDistance" step="0.1" placeholder=" "><label>距离 km</label></div>' +
                '<div class="md-field span-full"><input type="text" id="manualExerciseNote" placeholder=" "><label>备注</label></div>' +
                '</div><button class="md-btn md-btn-filled" onclick="data.addExerciseFromModal()"><span class="material-symbols-rounded">add</span> 添加运动记录</button></div>';
        },

        addExerciseFromModal() {
            this.addManualExercise();
            ['manualExerciseCustom','manualExerciseMinutes','manualExerciseCalories','manualExerciseDistance','manualExerciseNote'].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
            var t = document.getElementById('manualExerciseType'); if (t) t.value = 'walk';
            var cf = document.getElementById('manualExerciseCustomField'); if (cf) cf.classList.add('hidden');
            if (typeof workout !== 'undefined' && workout.showToast) workout.showToast('运动记录已添加');
        },

        renderHealthTabs() {
            const tabs = [
                ['diet', 'restaurant', '饮食'],
                ['weight', 'monitor_weight', '体重'],
                ['training', 'fitness_center', '训练记录'],
                ['calendar', 'calendar_month', '记录日历']
            ];
            return `<div class="record-tabs record-tabs-scroll" role="tablist" aria-label="健康记录视图">${tabs.map(([key, icon, label]) => `<button class="record-tab ${this.healthView === key ? 'active' : ''}" data-health-view="${key}" onclick="data.scrollToHealthView('${key}')" type="button"><span class="material-symbols-rounded">${icon}</span>${label}</button>`).join('')}</div>`;
        },

        healthViewOrder() {
            return ['diet', 'weight', 'training', 'calendar'];
        },

        renderHealthSwipeDeck() {
            return `<div id="healthSwipeDeck" class="health-swipe-deck" onscroll="data.onHealthDeckScroll(this)">
            ${this.healthViewOrder().map(view => `<section class="health-swipe-page" data-health-page="${view}">${this.renderHealthViewByKey(view)}</section>`).join('')}
        </div>`;
        },

        renderHealthViewByKey(view) {
            const previous = this.healthView;
            this.healthView = view;
            const html = this.renderHealthView();
            this.healthView = previous;
            return html;
        },

        scrollToHealthView(view) {
            const order = this.healthViewOrder();
            const index = order.indexOf(view);
            if (index < 0) return;
            this.captureAdviceDraft?.();
            this.healthView = view;
            this.updateHealthTabActive();
            const deck = document.getElementById('healthSwipeDeck');
            if (!deck) {
                this.renderRecordsPage();
                return;
            }
            deck.scrollLeft = index * deck.clientWidth;
            if (view === 'diet') requestAnimationFrame(() => this.autoResizeDietInput?.());
        },

        syncHealthDeckPosition(smooth = false) {
            const deck = document.getElementById('healthSwipeDeck');
            if (!deck) return;
            const order = this.healthViewOrder();
            const index = Math.max(0, order.indexOf(this.healthView));
            const left = index * deck.clientWidth;
            if (smooth) deck.scrollTo({ left, behavior: 'smooth' });
            else deck.scrollLeft = left;
        },

        onHealthDeckScroll(deck) {
            this.updateHealthSwipeEffects(deck);
            clearTimeout(this._healthDeckScrollTimer);
            this._healthDeckScrollTimer = setTimeout(() => {
                const order = this.healthViewOrder();
                const index = Math.max(0, Math.min(order.length - 1, Math.round(deck.scrollLeft / deck.clientWidth)));
                const nextView = order[index];
                if (!nextView || nextView === this.healthView) return;
                this.healthView = nextView;
                this.updateHealthTabActive();
                if (nextView === 'diet') requestAnimationFrame(() => this.autoResizeDietInput?.());
            }, 80);
        },

        updateHealthSwipeEffects(deck = document.getElementById('healthSwipeDeck')) {
            if (!deck || !deck.clientWidth) return;
            const progress = deck.scrollLeft / deck.clientWidth;
            deck.querySelectorAll('.health-swipe-page').forEach((page, index) => {
                const distance = Math.min(1, Math.abs(progress - index));
                const scale = 1 - distance * 0.025;
                const opacity = 1 - distance * 0.16;
                const translateY = distance * 4;
                page.style.transform = `scale(${scale}) translateY(${translateY}px)`;
                page.style.opacity = String(opacity);
            });
        },

        updateHealthTabActive() {
            document.querySelectorAll('[data-health-view]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.healthView === this.healthView);
            });
        }
    };
})();
