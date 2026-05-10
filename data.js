const data = {
    DB_KEY: 'rehab_pro_universal_db',
    CFG_KEY: 'rehab_pro_universal_cfg',
    SCHEMA_VERSION: 2,
    db: { actions: [], routines: [], history: [], rate: 1.1, cardio: { weight: 70, target: 30, type: 'walk' }, health: { weights: [], foodLogs: [], exerciseLogs: [], goalType: 'loss', bodyPlan: null, weightPlan: null, dietGoal: null, aiAdviceChat: [] }, aiProfiles: [], aiActiveId: '', aiModels: [] },
    cfg: { mode: 'none', s3: {}, dav: {} },
    historyMonthOffset: 0,
    routineView: 'library',
    recordView: 'today',
    healthView: 'diet',
    weightRange: 'month',
    selectedCalendarDate: null,
    adviceModel: '__current__',
    historyColors: ['#2563eb', '#7c3aed', '#059669', '#f59e0b', '#e11d48', '#0891b2', '#9333ea', '#ea580c'],

    async init() {
        const localDb = localStorage.getItem(this.DB_KEY);
        const localCfg = localStorage.getItem(this.CFG_KEY);
        if (localDb) this.db = JSON.parse(localDb);
        else this.migrateLegacy();
        if (localCfg) this.cfg = JSON.parse(localCfg);
        this.normalizeDb();
        sync.initUI();
        if (typeof ai !== 'undefined') await ai.init({ saveData: true, renderData: false });
        this.render();
        if (window.cardio) cardio.initUI();
    },

    normalizeDb() {
        this.db.schemaVersion = Math.max(Number(this.db.schemaVersion) || 0, this.SCHEMA_VERSION);
        this.db.cardio = { weight: 70, target: 30, type: 'walk', ...(this.db.cardio || {}) };
        this.db.health = { weights: [], foodLogs: [], exerciseLogs: [], goalType: 'loss', bodyPlan: null, weightPlan: null, dietGoal: null, aiAdviceChat: [], ...(this.db.health || {}) };
        this.db.health.weights = this.db.health.weights || [];
        this.db.health.foodLogs = this.db.health.foodLogs || [];
        this.db.health.exerciseLogs = this.db.health.exerciseLogs || [];
        this.db.health.aiAdviceChat = this.db.health.aiAdviceChat || [];
        this.db.aiProfiles = this.db.aiProfiles || [];
        this.db.aiActiveId = this.db.aiActiveId || '';
        this.db.aiModels = this.db.aiModels || [];
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

    setFoodSource(label = '') {
        this._foodSource = label;
        const el = document.getElementById('foodSourceHint');
        if (el) {
            el.textContent = label ? `当前营养来源：${label}，你仍可手动修改` : '输入食物后可从食物库或 AI 自动填充营养';
            el.classList.toggle('active', !!label);
        }
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
        if (this._collapse[id] === undefined) {
            this._collapse[id] = id === 'dietPanel' ? true : false;
        } else {
            this._collapse[id] = !this._collapse[id];
        }
        this.render();
    },

    isCollapsed(id, defaultState = true) {
        this._collapse = this._collapse || {};
        return this._collapse[id] ?? defaultState;
    },

    escapeHtml(value = '') {
        return String(value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
    },

    setWeightRange(range) {
        this.weightRange = range;
        this.renderHistory();
    },

    addWeight() {
        const date = document.getElementById('modalWeightDate').value || this.dateKey(new Date());
        const weight = parseFloat(document.getElementById('modalWeightValue').value);
        const note = document.getElementById('modalWeightNote').value.trim();
        const height = parseFloat(document.getElementById('modalHeight').value);
        if (!weight || weight <= 0) return alert('请输入有效体重');
        this.db.health = this.db.health || { weights: [] };
        this.db.health.weights = this.db.health.weights || [];
        if (height > 0) this.db.health.height = height;
        this.db.health.weights.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            date,
            weight,
            note,
            createdAt: new Date().toISOString()
        });
        this.db.health.weights.sort((a, b) => new Date(b.date) - new Date(a.date));
        document.getElementById('modalWeightValue').value = '';
        document.getElementById('modalWeightNote').value = '';
        this.closeWeightModal();
        this.saveAndBackup();
    },

    openWeightModal() {
        document.getElementById('modalWeightDate').value = this.dateKey(new Date());
        document.getElementById('modalHeight').value = this.db.health.height || '';
        document.getElementById('weightModal').classList.remove('hidden');
    },

    closeWeightModal() {
        document.getElementById('weightModal').classList.add('hidden');
    },

    // --- Diet Modal ---
    openDietModal() {
        const el = document.getElementById('dietModalContent');
        if (el) el.innerHTML = this.renderDietModalContent();
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
            '<div class="md-field"><input type="number" id="foodCal" step="1" placeholder=" " oninput="data.updateFoodComputedPreview()"><label>kcal/100g</label></div>' +
            '<div class="md-field"><input type="number" id="foodPro" step="0.1" placeholder=" " oninput="data.updateFoodComputedPreview()"><label>蛋白/100g</label></div>' +
            '<div class="md-field"><input type="number" id="foodCarb" step="0.1" placeholder=" " oninput="data.updateFoodComputedPreview()"><label>碳水/100g</label></div>' +
            '<div class="md-field"><input type="number" id="foodFat" step="0.1" placeholder=" " oninput="data.updateFoodComputedPreview()"><label>脂肪/100g</label></div>' +
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

    deleteWeight(id) {
        this.db.health.weights = (this.db.health.weights || []).filter(w => w.id !== id);
        this.saveAndBackup();
    },

    todayTrainingCalories() {
        const today = this.dateKey(new Date());
        const autoCal = this.db.history
            .filter(h => this.dateKey(this.parseHistoryDate(h.date)) === today)
            .reduce((sum, h) => sum + (h.cardio?.calories || 0), 0);
        const manualCal = (this.db.health.exerciseLogs || [])
            .filter(e => e.date === today)
            .reduce((sum, e) => sum + (e.calories || 0), 0);
        return autoCal + manualCal;
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

    ratio(value, total) {
        if (!total || total <= 0) return 0;
        return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
    },

    addManualExercise() {
        const date = this.dateKey(new Date());
        const type = document.getElementById('manualExerciseType')?.value || 'walk';
        const customName = document.getElementById('manualExerciseCustom')?.value?.trim() || '';
        const minutes = parseInt(document.getElementById('manualExerciseMinutes')?.value) || 0;
        const calories = parseInt(document.getElementById('manualExerciseCalories')?.value) || 0;
        const distance = parseFloat(document.getElementById('manualExerciseDistance')?.value) || 0;
        const note = document.getElementById('manualExerciseNote')?.value?.trim() || '';
        if (type === 'custom' && !customName) return alert('请输入自定义运动名称');
        if (minutes <= 0) return alert('请输入有效运动时长');
        this.db.health.exerciseLogs.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            date,
            type,
            customName,
            minutes,
            calories,
            distance,
            note,
            createdAt: new Date().toISOString()
        });
        const customEl = document.getElementById('manualExerciseCustom');
        if (customEl) customEl.value = '';
        document.getElementById('manualExerciseMinutes').value = '';
        document.getElementById('manualExerciseCalories').value = '';
        document.getElementById('manualExerciseDistance').value = '';
        document.getElementById('manualExerciseNote').value = '';
        this.saveAndBackup();
    },

    deleteManualExercise(id) {
        this.db.health.exerciseLogs = (this.db.health.exerciseLogs || []).filter(e => e.id !== id);
        this.saveAndBackup();
    },

    todayExerciseLogs() {
        const today = this.dateKey(new Date());
        return (this.db.health.exerciseLogs || []).filter(e => e.date === today);
    },

    // --- Weight Loss Plan ---
    async requestWeightLossPlan() {
        const goalType = this.db.health.goalType || 'loss';
        const isGain = goalType === 'gain';
        const latest = this.sortedWeights().slice(-1)[0];
        const currentWeight = parseFloat(document.getElementById('planCurrentWeight')?.value) || latest?.weight;
        const targetWeight = parseFloat(document.getElementById('planTargetWeight')?.value);
        const height = parseFloat(document.getElementById('planHeight')?.value);
        const activityLevel = document.getElementById('planActivity')?.value || 'sedentary';
        const dailyTrainMin = parseInt(document.getElementById('planTrainMin')?.value) || 30;
        const weeklyFreq = parseInt(document.getElementById('planWeeklyFreq')?.value) || 3;
        const intensity = document.getElementById('planIntensity')?.value || 'moderate';
        const sportType = document.getElementById('planSportType')?.value || (isGain ? 'strength' : 'mixed');
        const experience = document.getElementById('planExperience')?.value || 'beginner';
        if (!currentWeight || currentWeight <= 0) return alert('请先填写当前体重');
        if (!targetWeight || targetWeight <= 0) return alert('请输入目标体重');
        if (!isGain && targetWeight >= currentWeight) return alert('减重目标体重需低于当前体重');
        if (isGain && targetWeight <= currentWeight) return alert('增肌目标体重需高于当前体重');
        const statusEl = document.getElementById('planStatus');
        if (statusEl) statusEl.textContent = 'AI 分析中...';
        try {
            const plan = await ai.bodyGoalPlan({ goalType, currentWeight, targetWeight, activityLevel, dailyTrainMin, height, weeklyFreq, intensity, sportType, experience });
            const normalized = this.normalizeBodyPlan(plan, { currentWeight, targetWeight }, goalType);
            this.db.health.bodyPlan = normalized;
            this.db.health.weightPlan = normalized;
            this.save();
            if (statusEl) statusEl.textContent = 'AI 方案已生成，请选择';
            this.renderHistory();
        } catch (e) {
            if (statusEl) statusEl.textContent = '生成失败: ' + e.message;
            alert('AI 方案生成失败: ' + e.message);
        }
    },

    normalizeBodyPlan(plan, meta, goalType) {
        const isGain = goalType === 'gain';
        const diff = isGain
            ? Math.max(0, (meta.targetWeight || 0) - (meta.currentWeight || 0))
            : Math.max(0, (meta.currentWeight || 0) - (meta.targetWeight || 0));
        const fixed = { ...plan, goalType, meta };
        const paceKeys = isGain ? ['conservative', 'moderate', 'aggressive'] : ['fast', 'moderate', 'slow'];
        paceKeys.forEach(key => {
            const p = fixed[key];
            if (!p) return;
            if (isGain) {
                const weeklyChange = Math.max(0.1, Number(p.weeklyChange) || (key === 'aggressive' ? 0.5 : key === 'moderate' ? 0.3 : 0.15));
                const weeks = diff > 0 ? diff / weeklyChange : 0;
                const days = Math.max(7, Math.round(weeks * 7));
                fixed[key] = {
                    ...p,
                    pace: key,
                    weeklyChange: Number(weeklyChange.toFixed(2)),
                    days,
                    dailyCal: Math.round(Number(p.dailyCal) || 0),
                    calorieDelta: Math.round(Number(p.calorieDelta) || 0),
                    proteinGoal: Math.round(Number(p.proteinGoal) || 0),
                    carbGoal: Math.round(Number(p.carbGoal) || 0),
                    fatGoal: Math.round(Number(p.fatGoal) || 0)
                };
            } else {
                const weeklyLoss = Math.max(0.1, Number(p.weeklyLoss) || (key === 'fast' ? 0.8 : key === 'moderate' ? 0.5 : 0.25));
                const weeks = diff > 0 ? diff / weeklyLoss : 0;
                const days = Math.max(7, Math.round(weeks * 7));
                fixed[key] = {
                    ...p,
                    pace: key,
                    weeklyLoss: Number(weeklyLoss.toFixed(2)),
                    days,
                    dailyCal: Math.round(Number(p.dailyCal) || 0),
                    deficit: Math.round(Number(p.deficit) || 0),
                    proteinGoal: Math.round(Number(p.proteinGoal) || 0),
                    carbGoal: Math.round(Number(p.carbGoal) || 0),
                    fatGoal: Math.round(Number(p.fatGoal) || 0)
                };
            }
        });
        return fixed;
    },

    applyWeightLossPlan(pace) {
        const goalType = this.db.health.goalType || 'loss';
        const plan = this.db.health.bodyPlan || this.db.health.weightPlan;
        if (!plan || !plan[pace]) return alert('请先生成 AI 方案');
        const p = plan[pace];
        const isGain = goalType === 'gain';
        this.db.health.dietGoal = {
            goalType,
            pace,
            dailyCal: p.dailyCal,
            calorieDelta: isGain ? p.calorieDelta : undefined,
            deficit: isGain ? undefined : p.deficit,
            weeklyChange: isGain ? p.weeklyChange : undefined,
            weeklyLoss: isGain ? undefined : p.weeklyLoss,
            days: p.days,
            proteinGoal: p.proteinGoal || (isGain ? Math.round(p.dailyCal * 0.3 / 4) : Math.round(p.dailyCal * 0.3 / 4)),
            carbGoal: p.carbGoal || (isGain ? Math.round(p.dailyCal * 0.45 / 4) : Math.round(p.dailyCal * 0.4 / 4)),
            fatGoal: p.fatGoal || (isGain ? Math.round(p.dailyCal * 0.25 / 9) : Math.round(p.dailyCal * 0.3 / 9)),
            appliedAt: new Date().toISOString()
        };
        this.saveAndBackup();
        const paceLabel = isGain
            ? (pace === 'conservative' ? '精益' : pace === 'moderate' ? '稳定' : '进取')
            : (pace === 'fast' ? '快速' : pace === 'moderate' ? '中等' : '慢速');
        alert(`已应用${paceLabel}${isGain ? '增肌' : '减重'}方案：每日 ${p.dailyCal} kcal`);
        this.renderHistory();
    },

    render() {
        this.renderActions();
        this.renderWorkoutPlanCard();
        this.renderTodayPage();
        this.renderRecordsPage();
        this.renderAiCoachPage();
        this.renderProfilePage();
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

    renderWorkoutPlanCard() {
        const el = document.getElementById('workoutPlanCard');
        if (!el) return;
        const actions = this.db.actions;
        const routines = this.db.routines;
        const recentRoutines = routines.slice(-3).reverse();
        const actionCount = actions.length;

        if (actionCount === 0 && routines.length === 0) {
            el.innerHTML = `
                <div class="md-card workout-plan-card workout-plan-empty">
                    <div class="workout-plan-empty-icon">
                        <span class="material-symbols-rounded">fitness_center</span>
                    </div>
                    <div class="workout-plan-empty-text">
                        <strong>还没有训练计划</strong>
                        <p>从运动库导入一个方案，或手动添加动作开始训练</p>
                    </div>
                    <div class="workout-plan-empty-actions">
                        <button class="md-btn md-btn-filled" onclick="data.showWorkoutLibrary()">
                            <span class="material-symbols-rounded">library_books</span> 从运动库导入
                        </button>
                        <button class="md-btn md-btn-tonal" onclick="document.getElementById('name').focus()">
                            <span class="material-symbols-rounded">add</span> 手动添加
                        </button>
                    </div>
                </div>`;
            return;
        }

        if (actionCount === 0 && routines.length > 0) {
            el.innerHTML = `
                <div class="md-card workout-plan-card workout-plan-import">
                    <div class="workout-plan-import-head">
                        <div>
                            <span class="cardio-kicker">训练计划</span>
                            <h3>选择方案开始训练</h3>
                            <small>${routines.length} 个方案可用</small>
                        </div>
                        <span class="material-symbols-rounded workout-plan-icon">library_books</span>
                    </div>
                    <div class="workout-plan-recent">
                        ${recentRoutines.map((r, i) => {
                            const realIdx = routines.length - 1 - i;
                            const totalSets = r.actions.reduce((s, a) => s + (a.sets || 1), 0);
                            return `<div class="workout-plan-recent-item" onclick="data.loadRoutine(${realIdx})">
                                <div class="workout-plan-recent-info">
                                    <strong>${this.escapeHtml(r.name)}</strong>
                                    <small>${r.actions.length} 个动作 · ${totalSets} 组 · ${r.created || ''}</small>
                                </div>
                                <span class="material-symbols-rounded">upload</span>
                            </div>`;
                        }).join('')}
                    </div>
                    <button class="md-btn md-btn-tonal workout-plan-lib-btn" onclick="data.showWorkoutLibrary()">
                        <span class="material-symbols-rounded">library_books</span> 查看全部方案
                    </button>
                </div>`;
            return;
        }

        const totalSets = actions.reduce((s, a) => s + (a.sets || 1), 0);
        const totalReps = actions.reduce((s, a) => s + (a.sets || 1) * (a.reps || 1), 0);
        const estMinutes = Math.round(actions.reduce((s, a) => {
            const workTime = (a.sets || 1) * (a.reps || 1) * (a.work || 5);
            const restTime = ((a.sets || 1) - 1) * (a.repRest || 2) + (a.actionRest || 10);
            return s + workTime + restTime;
        }, 0) / 60);

        el.innerHTML = `
            <div class="md-card workout-plan-card">
                <div class="workout-plan-head">
                    <div class="workout-plan-info">
                        <span class="cardio-kicker">当前计划</span>
                        <h3>${actionCount} 个动作 · ${totalSets} 组</h3>
                        <small>预计 ${estMinutes} 分钟 · 约 ${totalReps} 次</small>
                    </div>
                    <div class="workout-plan-actions-top">
                        <button class="icon-btn" onclick="data.showWorkoutLibrary()" aria-label="从运动库导入" title="从运动库导入">
                            <span class="material-symbols-rounded">library_books</span>
                        </button>
                    </div>
                </div>
                ${recentRoutines.length > 0 ? `
                <div class="workout-plan-switch">
                    <small>快速切换：</small>
                    <div class="workout-plan-chips">
                        ${recentRoutines.map((r, i) => {
                            const realIdx = routines.length - 1 - i;
                            return `<button class="workout-plan-chip" onclick="data.loadRoutine(${realIdx})" title="${this.escapeHtml(r.name)}">
                                <span class="material-symbols-rounded">swap_horiz</span> ${this.escapeHtml(r.name)}
                            </button>`;
                        }).join('')}
                    </div>
                </div>` : ''}
            </div>`;
    },

    showWorkoutLibrary() {
        const el = document.getElementById('workoutLibraryContent');
        const sheet = document.getElementById('workoutLibrarySheet');
        if (!el || !sheet) return;

        const routines = this.db.routines;
        if (routines.length === 0) {
            el.innerHTML = `
                <div class="empty-state" style="padding:24px 16px">
                    <span class="material-symbols-rounded">bookmark_border</span>
                    <p>运动库为空</p>
                    <small>先在训练页添加动作并存入方案库</small>
                </div>`;
        } else {
            el.innerHTML = `
                <div class="workout-lib-list">
                    ${routines.map((r, i) => {
                        const totalSets = r.actions.reduce((s, a) => s + (a.sets || 1), 0);
                        const estMinutes = Math.round(r.actions.reduce((s, a) => {
                            const workTime = (a.sets || 1) * (a.reps || 1) * (a.work || 5);
                            const restTime = ((a.sets || 1) - 1) * (a.repRest || 2) + (a.actionRest || 10);
                            return s + workTime + restTime;
                        }, 0) / 60);
                        return `<div class="workout-lib-item">
                            <div class="workout-lib-item-main" onclick="data.loadRoutineFromLib(${i})">
                                <div class="workout-lib-item-info">
                                    <strong>${this.escapeHtml(r.name)}</strong>
                                    <small>${r.actions.length} 个动作 · ${totalSets} 组 · 约 ${estMinutes} 分钟${r.created ? ' · ' + r.created : ''}</small>
                                </div>
                                <span class="material-symbols-rounded">upload</span>
                            </div>
                            <div class="workout-lib-item-actions">
                                <button class="delete-btn" onclick="event.stopPropagation();data.deleteRoutineFromLib(${i})" aria-label="删除方案">
                                    <span class="material-symbols-rounded">delete</span>
                                </button>
                            </div>
                        </div>`;
                    }).join('')}
                </div>`;
        }

        sheet.classList.remove('hidden');
        sheet.setAttribute('aria-hidden', 'false');
    },

    closeWorkoutLibrary() {
        const sheet = document.getElementById('workoutLibrarySheet');
        if (sheet) {
            sheet.classList.add('hidden');
            sheet.setAttribute('aria-hidden', 'true');
        }
    },

    loadRoutineFromLib(idx) {
        this.loadRoutine(idx);
        this.closeWorkoutLibrary();
    },

    deleteRoutineFromLib(idx) {
        if (!confirm('确定删除方案 "' + this.db.routines[idx]?.name + '"？')) return;
        this.deleteRoutine(idx);
        this.showWorkoutLibrary();
        this.renderWorkoutPlanCard();
    },

    renderTodayPage() {
        const overview = document.getElementById('todayOverview');
        const quickActions = document.getElementById('todayQuickActions');
        const timeline = document.getElementById('todayTimeline');
        const aiCard = document.getElementById('todayAiCard');
        if (overview) overview.innerHTML = this.renderRecordOverview();
        if (quickActions) quickActions.innerHTML = this.renderRecordQuickActions();
        if (timeline) timeline.innerHTML = this.renderTodayTimeline();
        if (aiCard) aiCard.innerHTML = this.renderContextAiCard('today');
    },

    renderDietPage() {
        const content = document.getElementById('dietContent');
        const aiCard = document.getElementById('dietAiCard');
        if (content) content.innerHTML = this.renderDietPanel();
        if (aiCard) aiCard.innerHTML = this.renderContextAiCard('diet');
        requestAnimationFrame(() => this.autoResizeDietInput?.());
    },

    renderRecordsPage() {
        const overview = document.getElementById('recordsOverview');
        const content = document.getElementById('recordsContent');
        if (overview) overview.innerHTML = '';
        if (content) {
            content.innerHTML = `
                ${this.renderHealthTabs()}
                ${this.renderHealthSwipeDeck()}`;
        }
        requestAnimationFrame(() => {
            this.syncHealthDeckPosition(false);
            this.updateHealthSwipeEffects();
            if (this.healthView === 'diet') this.autoResizeDietInput?.();
        });
    },

    renderHealthTabs() {
        const tabs = [
            ['weight', 'monitor_weight', '体重'],
            ['diet', 'restaurant', '饮食'],
            ['training', 'fitness_center', '训练记录'],
            ['calendar', 'calendar_month', '记录日历']
        ];
        return `<div class="record-tabs record-tabs-scroll" role="tablist" aria-label="健康记录视图">${tabs.map(([key, icon, label]) => `<button class="record-tab ${this.healthView === key ? 'active' : ''}" data-health-view="${key}" onclick="data.scrollToHealthView('${key}')" type="button"><span class="material-symbols-rounded">${icon}</span>${label}</button>`).join('')}</div>`;
    },

    healthViewOrder() {
        return ['weight', 'diet', 'training', 'calendar'];
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
        deck.scrollTo({ left: index * deck.clientWidth, behavior: 'smooth' });
        if (view === 'diet') requestAnimationFrame(() => this.autoResizeDietInput?.());
    },

    syncHealthDeckPosition(smooth = false) {
        const deck = document.getElementById('healthSwipeDeck');
        if (!deck) return;
        const order = this.healthViewOrder();
        const index = Math.max(0, order.indexOf(this.healthView));
        deck.scrollTo({ left: index * deck.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
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
    },

    renderHealthView() {
        switch (this.healthView) {
            case 'weight':
                return this.renderWeightPanel() + this.renderContextAiCard('weight');
            case 'training':
                return this.renderManualExercisePanel() +
                    '<div class="record-section-title">最近训练记录</div>' +
                    this.renderRecentHistoryList(5) +
                    this.renderContextAiCard('exercise');
            case 'calendar':
                return '<div class="record-section-title">记录日历</div>' +
                    this.renderHistoryCalendar() +
                    this.renderCalendarDayDetail() +
                    '<div class="record-section-title">历史明细</div>' +
                    this.renderHistoryList();
            case 'diet':
            default:
                return this.renderDietPanel() + this.renderContextAiCard('diet');
        }
    },

    renderAiCoachPage() {
        const content = document.getElementById('aiCoachContent');
        if (content) {
            content.innerHTML = this.renderAdvicePanel();
            requestAnimationFrame(() => this.autoResizeAdvicePrompt?.());
        }
    },

    renderProfilePage() {
        const overview = document.getElementById('profileOverview');
        const content = document.getElementById('profileContent');
        const settings = document.getElementById('profileSettings');
        if (overview) overview.innerHTML = this.renderRoutineOverview();
        if (content) {
            const isSettings = this.routineView === 'settings';
            if (settings) settings.classList.toggle('hidden', !isSettings);
            if (!isSettings) {
                content.classList.remove('hidden');
                content.innerHTML = `
                    <div class="record-tabs" role="tablist" aria-label="我的视图">
                        <button class="record-tab ${this.routineView === 'library' ? 'active' : ''}" onclick="data.setRoutineView('library')"><span class="material-symbols-rounded">bookmarks</span>动作组库</button>
                        <button class="record-tab ${this.routineView === 'weightloss' ? 'active' : ''}" onclick="data.setRoutineView('weightloss')"><span class="material-symbols-rounded">trending_down</span>目标指导</button>
                        <button class="record-tab ${this.routineView === 'settings' ? 'active' : ''}" onclick="data.setRoutineView('settings')"><span class="material-symbols-rounded">settings</span>设置</button>
                    </div>
                    ${this.routineView === 'library' ? this.renderRoutineLibrary() : this.renderWeightLossPlanCard()}`;
            } else {
                content.innerHTML = `
                    <div class="record-tabs" role="tablist" aria-label="我的视图">
                        <button class="record-tab" onclick="data.setRoutineView('library')"><span class="material-symbols-rounded">bookmarks</span>动作组库</button>
                        <button class="record-tab" onclick="data.setRoutineView('weightloss')"><span class="material-symbols-rounded">trending_down</span>目标指导</button>
                        <button class="record-tab active" onclick="data.setRoutineView('settings')"><span class="material-symbols-rounded">settings</span>设置</button>
                    </div>`;
                content.classList.remove('hidden');
            }
        }
    },

    renderRoutines() {
        this.renderProfilePage();
    },

    renderRoutineOverview() {
        const routineCount = this.db.routines.length;
        const actionCount = this.db.actions.length;
        const goal = this.db.health.dietGoal;
        return `<div class="md-card hero-card routines-hero">
            <div class="hero-kicker">方案总览</div>
            <div class="hero-title-row">
                <div>
                    <h3>${routineCount} 个方案</h3>
                    <p>${goal ? `当前${goal.goalType === 'gain' ? '增肌' : '减重'}方案：${goal.dailyCal} kcal / 日` : '可在此管理训练动作库与 AI 目标方案'}</p>
                </div>
                <span class="hero-icon material-symbols-rounded">inventory_2</span>
            </div>
            <div class="hero-stat-row">
                <div class="hero-stat"><b>${actionCount}</b><small>当前动作</small></div>
                <div class="hero-stat"><b>${routineCount}</b><small>已存方案</small></div>
                <div class="hero-stat"><b>${goal?.weeklyChange || goal?.weeklyLoss || '--'}</b><small>目标 kg/周</small></div>
            </div>
        </div>`;
    },

    renderRoutineLibrary() {
        if (this.db.routines.length === 0) {
            return `<div class="empty-state"><span class="material-symbols-rounded">bookmark_border</span><p>暂无保存的方案</p></div>`;
        }
        return this.db.routines.map((r, i) => {
            const expanded = this.isCollapsed('routine_' + i, true) === false;
            return `<div class="routine-card">
                <div class="routine-card-head" onclick="data.toggleCollapse('routine_${i}')">
                    <div style="flex:1;min-width:0">
                        <strong>${r.name}</strong>
                        <small>${r.actions.length}个动作 &middot; ${r.created}</small>
                    </div>
                    <span class="routine-expand-icon material-symbols-rounded">${expanded ? 'expand_less' : 'expand_more'}</span>
                </div>
                ${expanded ? `<div class="routine-action-list">
                    ${r.actions.map((a, ai) => `<div class="routine-action-item">
                        <span class="routine-action-idx">${ai + 1}</span>
                        <span>${a.name}</span>
                        <small>${a.sets}组×${a.reps}次·${a.work}s</small>
                    </div>`).join('')}
                    <div class="routine-card-actions">
                        <button class="md-btn md-btn-tonal" style="padding:0 14px;height:32px;font-size:12px" onclick="event.stopPropagation();data.loadRoutine(${i})"><span class="material-symbols-rounded" style="font-size:16px">upload</span> 载入</button>
                        <button class="delete-btn" onclick="event.stopPropagation();data.deleteRoutine(${i})"><span class="material-symbols-rounded">delete</span></button>
                    </div>
                </div>` : ''}
            </div>`;
        }).join('');
    },

    renderWeightLossPlanCard() {
        return this.renderWeightLossPanel();
    },

    renderHistory() {
        this.renderTodayPage();
        this.renderRecordsPage();
        this.renderProfilePage();
    },
    renderRecordOverview() {
        const today = this.dateKey(new Date());
        const weight = (this.db.health.weights || []).find(w => w.date === today) || this.sortedWeights().slice(-1)[0];
        const intake = this.todayCalories();
        const exerciseCal = this.todayTrainingCalories();
        const macros = this.todayMacros();
        const goalCal = this.db.health.dietGoal?.dailyCal || 0;
        const goals = this.defaultDietGoals();
        const progress = goalCal ? Math.min(100, Math.round((intake / goalCal) * 100)) : 0;
        const remaining = goalCal ? goalCal - intake : 0;
        const monthNum = Number(today.slice(5, 7));
        const dayNum = Number(today.slice(8, 10));
        const weekdays = ['周日','周一','周二','周三','周四','周五','周六'];
        const weekday = weekdays[new Date(today).getDay()];
        let status = '', hint = '';
        if (goalCal) {
            if (remaining >= 500) { status = '空间充足'; hint = '还可摄入约 ' + remaining + ' kcal，优先补蛋白和蔬菜'; }
            else if (remaining >= 150) { status = '节奏良好'; hint = '还可摄入约 ' + remaining + ' kcal，晚餐建议清淡均衡'; }
            else if (remaining >= 0) { status = '接近目标'; hint = '已接近目标，控制油脂和零食'; }
            else { status = '已超出目标'; hint = '已超出 ' + Math.abs(remaining) + ' kcal，可增加散步或低强度活动'; }
        }
        return `<div class="md-card hero-card record-overview-card">
            <div class="record-overview-top">
                <div class="record-overview-date">
                    <span class="hero-kicker">今日总览</span>
                    <h3>${monthNum}月${dayNum}日 ${weekday}</h3>
                    ${weight ? `<p>体重 ${weight.weight.toFixed(1)} kg</p>` : ''}
                </div>
                ${goalCal ? `<div class="today-focus-ring" style="--progress:${progress}"><div><b>${progress}%</b><small>摄入</small></div></div>` : ''}
            </div>
            <div class="record-overview-stats">
                <div class="record-overview-stat"><b>${intake}${goalCal ? `/${goalCal}` : ''}</b><small>摄入 kcal</small></div>
                <div class="record-overview-stat"><b>${exerciseCal}</b><small>消耗 kcal</small></div>
                <div class="record-overview-stat"><b>${macros.pro.toFixed(0)}/${goals.pro}</b><small>蛋白 g</small></div>
            </div>
            ${goalCal ? `<div class="today-focus-hint"><b>${status}</b><p>${hint}</p></div>` : ''}
        </div>`;
    },
    renderRecordQuickActions() {
        const aiPrompt = this.isGainMode()
            ? '请以增肌目标为前提，分析我今天的饮食、训练和体重记录，并给出今晚或明天的调整建议'
            : '请分析我今天的饮食、训练和体重记录，并给出今晚或明天的调整建议';
        return `<div class="record-quick-actions">
            <button class="record-quick-btn" onclick="data.openDietModal()"><span class="material-symbols-rounded">restaurant</span><span>记饮食</span></button>
            <button class="record-quick-btn" onclick="data.openExerciseModal()"><span class="material-symbols-rounded">fitness_center</span><span>记运动</span></button>
            <button class="record-quick-btn" onclick="data.openWeightModal()"><span class="material-symbols-rounded">monitor_weight</span><span>记体重</span></button>
            <button class="record-quick-btn record-quick-btn-ai" onclick="data.askContextAi('today','${aiPrompt}')"><span class="material-symbols-rounded">psychology</span><span>问 AI</span></button>
        </div>`;
    },
    renderRecordTabs() {
        const tabs = [['today','today','今日'],['diet','restaurant','饮食'],['exercise','fitness_center','运动'],['weight','monitor_weight','体重'],['calendar','calendar_month','日历']];
        return `<div class="record-tabs record-tabs-scroll" role="tablist" aria-label="记录视图">${tabs.map(([key, icon, label]) => `<button class="record-tab ${this.recordView === key ? 'active' : ''}" onclick="data.setRecordView('${key}')"><span class="material-symbols-rounded">${icon}</span>${label}</button>`).join('')}</div>`;
    },
    renderRecordView() {
        switch (this.recordView) {
            case 'diet': return this.renderDietView();
            case 'exercise': return this.renderExerciseView();
            case 'weight': return this.renderWeightView();
            case 'calendar': return this.renderCalendarView();
            case 'today': default: return this.renderTodayView();
        }
    },
    renderTodayView() { return `${this.renderTodayTimeline()}${this.renderContextAiCard('today')}`; },
    renderTodayTimeline() {
        const today = this.dateKey(new Date());
        const entries = this.db.history.filter(h => this.dateKey(this.parseHistoryDate(h.date)) === today);
        const foods = (this.db.health.foodLogs || []).filter(f => f.date === today);
        const exercises = (this.db.health.exerciseLogs || []).filter(e => e.date === today);
        const weight = (this.db.health.weights || []).find(w => w.date === today);
        const items = [];
        const mealGroups = { breakfast: [], lunch: [], dinner: [], snack: [] };
        foods.forEach(f => (mealGroups[f.meal] || mealGroups.snack).push(f));
        const mealOrder = { breakfast: 1, lunch: 2, dinner: 3, snack: 4 };
        const mealNames = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
        Object.entries(mealGroups).forEach(([meal, list]) => {
            if (!list.length) return;
            const totalCal = list.reduce((s, f) => s + Number(f.cal || 0), 0);
            const totalPro = list.reduce((s, f) => s + Number(f.pro || 0), 0);
            const totalCarb = list.reduce((s, f) => s + Number(f.carb || 0), 0);
            const totalFat = list.reduce((s, f) => s + Number(f.fat || 0), 0);
            const names = list.map(f => f.name).slice(0, 3).join('、') + (list.length > 3 ? '等' + list.length + '项' : '');
            items.push({ order: mealOrder[meal] || 5, sk: list[0]?.createdAt || '', icon: 'restaurant', label: mealNames[meal] || '加餐', detail: totalCal + ' kcal', meta: 'P' + totalPro.toFixed(0) + ' C' + totalCarb.toFixed(0) + ' F' + totalFat.toFixed(0) + ' · ' + list.length + '项', sub: names, type: 'diet' });
        });
        entries.forEach(h => {
            const mins = Math.floor(h.duration / 60), secs = h.duration % 60;
            const names = this.historyNames(h).join('、');
            const cal = Math.round(h.cardio?.calories || 0);
            items.push({ order: 5, sk: h.date || '', icon: this.historyIcon(h), label: names || '训练', detail: mins+'分'+secs+'秒', meta: cal ? cal+' kcal' : (h.actions?.length||0)+' 个动作', type: 'training' });
        });
        exercises.forEach(e => {
            items.push({ order: 6, sk: e.createdAt || '', icon: this.sportIcon(this.exerciseLabel(e.type, e)), label: this.exerciseLabel(e.type, e), detail: e.minutes+' 分钟', meta: e.calories ? e.calories+' kcal' : '', type: 'exercise' });
        });
        if (weight) items.push({ order: 0, sk: '0', icon: 'monitor_weight', label: '体重记录', detail: weight.weight.toFixed(1)+' kg', meta: weight.note || '', type: 'weight' });
        if (!items.length) return '<div class="md-card today-timeline-empty"><div class="empty-state" style="padding:24px 16px"><span class="material-symbols-rounded">timeline</span><p>今天还没有记录，使用上方快捷按钮开始记录</p></div></div>';
        items.sort((a, b) => a.order - b.order || String(a.sk).localeCompare(String(b.sk)));
        return '<div class="md-card today-timeline-card"><div class="today-timeline-header"><span class="material-symbols-rounded">timeline</span><strong>今日时间线</strong><small>' + items.length + ' 条</small></div><div class="today-timeline-list">' + items.map(it => '<div class="today-timeline-item today-timeline-' + it.type + '"><span class="today-timeline-icon material-symbols-rounded">' + it.icon + '</span><div class="today-timeline-body"><div class="today-timeline-main"><strong>' + it.label + '</strong><span>' + it.detail + '</span></div>' + (it.meta ? '<small>' + it.meta + '</small>' : '') + (it.sub ? '<span class="today-timeline-sub">' + it.sub + '</span>' : '') + '</div></div>').join('') + '</div></div>';
    },
    renderDietView() { return this.renderDietPanel() + this.renderContextAiCard('diet'); },
    renderExerciseView() { return this.renderManualExercisePanel() + '<div class="record-section-title">最近训练记录</div>' + this.renderRecentHistoryList(5) + this.renderContextAiCard('exercise'); },
    renderRecentHistoryList(limit = 5) {
        if (!this.db.history.length) return '<div class="empty-state"><span class="material-symbols-rounded">event_note</span><p>暂无训练记录</p></div>';
        const sorted = [...this.db.history].sort((a, b) => this.parseHistoryDate(b.date) - this.parseHistoryDate(a.date)).slice(0, limit);
        return '<div class="recent-history-list">' + sorted.map(h => {
            const mins = Math.floor(h.duration / 60), secs = h.duration % 60;
            const names = this.historyNames(h).join('、');
            const meta = h.type === 'cardio' ? Math.round(h.cardio.calories||0)+' kcal' : h.actions.length+'个动作';
            const ri = this.db.history.indexOf(h);
            return '<div class="list-item"><span class="record-icon material-symbols-rounded">' + this.historyIcon(h) + '</span><div style="flex:1;min-width:0"><strong>' + h.date + '</strong><small>' + mins + '分' + secs + '秒 · ' + meta + '</small><div class="item-chip">' + (names.length > 20 ? names.slice(0, 20) + '...' : names) + '</div></div><button class="delete-btn" onclick="data.deleteHistory(' + ri + ')"><span class="material-symbols-rounded">delete</span></button></div>';
        }).join('') + (this.db.history.length > limit ? '<button class="md-btn md-btn-tonal" style="margin:8px auto;display:flex" onclick="data.setRecordView(\'calendar\')"><span class="material-symbols-rounded">calendar_month</span> 查看全部记录</button>' : '') + '</div>';
    },
    renderWeightView() { return this.renderWeightPanel() + this.renderContextAiCard('weight'); },
    renderCalendarView() { return this.renderHistoryCalendar() + this.renderCalendarDayDetail() + '<div class="record-section-title">记录明细</div>' + this.renderHistoryList(); },
    renderContextAiCard(context) {
        if (!ai.cfg.enabled) return '';
        const prompts = this.contextAiPrompts(context);
        return '<div class="md-card context-ai-card"><div class="context-ai-head"><div><span class="cardio-kicker">AI 建议</span><h3>' + this.contextAiTitle(context) + '</h3></div><span class="material-symbols-rounded">psychology</span></div><div class="context-ai-actions">' + prompts.map(p => '<button class="md-btn md-btn-tonal context-ai-btn" onclick="data.askContextAi(\'' + context + '\',\'' + this.escapeHtml(p.prompt) + '\')">' + p.label + '</button>').join('') + '</div></div>';
    },
    contextAiTitle(context) { return { today: '综合分析', diet: '饮食分析', exercise: '训练分析', weight: '体重分析', calendar: '日历分析' }[context] || 'AI 分析'; },
    contextAiPrompts(context) {
        const isGain = this.isGainMode();
        return {
            today: [{ label: '分析今天', prompt: '请分析我今天的饮食、训练和体重记录，并给出今晚或明天的调整建议' }, { label: '晚餐建议', prompt: '根据今天已经摄入的饮食和目标，给我晚餐建议' }, { label: '明日调整', prompt: '根据今天记录，帮我安排明天的饮食和训练重点' }],
            diet: [{ label: '饮食分析', prompt: '请分析我今天和最近的饮食结构，重点看热量和蛋白质是否达标' }, { label: '补蛋白建议', prompt: '我今天蛋白质够不够？如果不够，建议怎么补' }, { label: '热量控制', prompt: '请根据我的饮食记录判断热量控制是否合理' }],
            exercise: [{ label: '训练强度', prompt: '请分析我最近训练频率和强度是否合理' }, { label: '恢复建议', prompt: '根据最近训练记录，帮我安排一次恢复训练' }, { label: '训练调整', prompt: '我应该增加还是减少训练量？请结合记录判断' }],
            weight: isGain
                ? [{ label: '增肌趋势', prompt: '请分析我最近体重趋势，判断增肌进展是否正常' }, { label: '停滞原因', prompt: '如果我最近增肌停滞，请结合饮食和训练记录分析原因' }, { label: '目标调整', prompt: '请根据我的体重趋势调整增肌热量和训练建议' }]
                : [{ label: '趋势分析', prompt: '请分析我最近体重趋势，并判断减重是否正常' }, { label: '停滞原因', prompt: '如果我最近减重停滞，请结合饮食和训练记录分析原因' }, { label: '目标调整', prompt: '请根据我的体重趋势调整热量和运动建议' }],
            calendar: [{ label: '分析选中日', prompt: '请分析我选中日期当天的饮食、训练和体重记录' }, { label: '本月总结', prompt: '请总结我这个月的训练、饮食和体重变化' }]
        }[context] || [{ label: '分析今天', prompt: '请分析我今天的记录' }];
    },
    askContextAi(context, prompt) {
        if (!ai.cfg.enabled) return alert('请先在设置中配置 AI');
        this.routineView = 'advice';
        const nav = document.querySelectorAll('.nav-item')[3];
        ui.tab('ai-coach', nav);
        requestAnimationFrame(() => {
            const input = document.getElementById('advicePrompt');
            if (input) { input.value = prompt; this.onAdvicePromptInput?.(input); this.sendAiAdvice(prompt); }
        });
    },

    renderTodayActionHero() {
        const today = this.dateKey(new Date());
        const weight = (this.db.health.weights || []).find(w => w.date === today) || this.sortedWeights().slice(-1)[0];
        const intake = this.todayCalories();
        const exerciseCal = this.todayTrainingCalories();
        const goalCal = this.db.health.dietGoal?.dailyCal || 0;
        const net = intake - exerciseCal;
        const progress = goalCal ? Math.min(100, Math.round((intake / goalCal) * 100)) : 0;
        const remaining = goalCal ? goalCal - intake : 0;
        const monthNum = Number(today.slice(5, 7));
        const dayNum = Number(today.slice(8, 10));
        const weekdays = ['周日','周一','周二','周三','周四','周五','周六'];
        const weekday = weekdays[new Date(today).getDay()];
        let status = '';
        let hint = '';
        if (goalCal) {
            if (this.isGainMode()) {
                if (remaining >= 500) { status = '摄入不足'; hint = `距离增肌目标还差约 ${remaining} kcal，建议加一餐主食、牛奶或蛋白质`; }
                else if (remaining >= 150) { status = '接近目标'; hint = `还差约 ${remaining} kcal，可补一份蛋白和碳水`; }
                else if (remaining >= -200) { status = '达成良好'; hint = '今日热量接近增肌目标，注意睡眠和训练恢复'; }
                else { status = '略高于目标'; hint = `今日超过目标约 ${Math.abs(remaining)} kcal，明天恢复正常摄入即可`; }
            } else {
                if (remaining >= 500) { status = '空间充足'; hint = `还可摄入约 ${remaining} kcal，优先补蛋白和蔬菜`; }
                else if (remaining >= 150) { status = '节奏良好'; hint = `还可摄入约 ${remaining} kcal，晚餐建议清淡均衡`; }
                else if (remaining >= 0) { status = '接近目标'; hint = '已接近目标，控制油脂和零食'; }
                else { status = '已超出目标'; hint = `已超出 ${Math.abs(remaining)} kcal，可增加散步或低强度活动`; }
            }
        }
        return `<div class="md-card hero-card today-focus-card">
            <div class="today-focus-row">
                <div class="today-focus-text">
                    <span class="hero-kicker">今日行动</span>
                    <h3>${monthNum}月${dayNum}日 ${weekday}</h3>
                    <p>${weight ? `当前体重 ${weight.weight.toFixed(1)} kg` : '记录饮食、训练和体重，形成今日闭环'}</p>
                </div>
                ${goalCal ? `<div class="today-focus-ring" style="--progress:${progress}"><div><b>${progress}%</b><small>摄入进度</small></div></div>` : `<span class="hero-icon material-symbols-rounded">monitoring</span>`}
            </div>
            <div class="today-focus-energy">
                <strong>${intake}${goalCal ? ` / ${goalCal}` : ''} kcal</strong>
                <span>${goalCal ? (remaining >= 0 ? `还可摄入 ${remaining} kcal` : `已超出 ${Math.abs(remaining)} kcal`) : '设置目标后显示进度'}</span>
            </div>
            ${goalCal ? `<div class="today-focus-hint"><b>${status}</b><p>${hint}</p></div>` : ''}
        </div>`;
    },

    renderDailyActions() { return this.renderRecordView(); },
    renderFitnessCalendar() { return this.renderCalendarView(); },

    renderHistoryList() {
        if (this.db.history.length === 0) {
            return `<div class="empty-state"><span class="material-symbols-rounded">event_note</span><p>暂无训练记录，完成一次训练后自动记录</p></div>`;
        }
        const groups = {};
        this.db.history.forEach((h, i) => {
            const d = this.parseHistoryDate(h.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push({ h, i });
        });
        const currentMonth = this.dateKey(new Date()).slice(0, 7);
        return Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(key => {
            const [y, m] = key.split('-');
            const items = groups[key];
            const totalMin = Math.round(items.reduce((s, { h }) => s + (h.duration || 0), 0) / 60);
            const collapsed = this.isCollapsed(`history_month_${key}`, key !== currentMonth);
            return `<section class="history-month-group ${collapsed ? 'collapsed' : ''}">
                <button class="history-month-head" onclick="data.toggleCollapse('history_month_${key}')" type="button">
                    <span class="material-symbols-rounded">calendar_month</span>
                    <strong>${y}年${Number(m)}月</strong>
                    <small>${items.length} 次 · ${totalMin} 分钟</small>
                    <span class="material-symbols-rounded">${collapsed ? 'expand_more' : 'expand_less'}</span>
                </button>
                <div class="history-month-content">
                    ${(() => {
                        const sorted = [...items].sort((a, b) => {
                            const da = this.parseHistoryDate(a.h.date);
                            const db2 = this.parseHistoryDate(b.h.date);
                            return db2 - da || b.i - a.i;
                        });
                        const recentItems = sorted.slice(0, 3);
                        const olderItems = sorted.slice(3);
                        const olderCollapsed = this.isCollapsed(`history_month_older_${key}`, true);
                        const renderOne = ({ h, i }) => {
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
                        };
                        let html = recentItems.map(renderOne).join('');
                        if (olderItems.length > 0) {
                            html += `<div class="history-older-group ${olderCollapsed ? 'collapsed' : ''}">
                                <button class="history-older-head" onclick="data.toggleCollapse('history_month_older_${key}')" type="button">
                                    <span class="material-symbols-rounded">expand_more</span>
                                    <small>还有 ${olderItems.length} 条更早记录</small>
                                </button>
                                <div class="history-older-content">
                                    ${olderItems.map(renderOne).join('')}
                                </div>
                            </div>`;
                        }
                        return html;
                    })()}
                </div>
            </section>`;
        }).join('');
    },

    renderTodaySummary() {
        const today = this.dateKey(new Date());
        const entries = this.db.history.filter(h => this.dateKey(this.parseHistoryDate(h.date)) === today);
        const manualExercises = this.todayExerciseLogs();
        const minutes = Math.round(entries.reduce((sum, h) => sum + (h.duration || 0), 0) / 60) + manualExercises.reduce((sum, e) => sum + (e.minutes || 0), 0);
        const calories = Math.round(entries.reduce((sum, h) => sum + (h.cardio?.calories || 0), 0)) + manualExercises.reduce((sum, e) => sum + (e.calories || 0), 0);
        const names = this.uniqueActionNames(entries);
        const intake = this.todayCalories();
        const macros = this.todayMacros();
        const net = intake - calories;
        return `<div class="md-card daily-summary-card">
            <div class="daily-stat"><span class="material-symbols-rounded">timer</span><b>${minutes}</b><small>训练分钟</small></div>
            <div class="daily-stat"><span class="material-symbols-rounded">local_fire_department</span><b>${calories}</b><small>运动消耗</small></div>
            <div class="daily-stat"><span class="material-symbols-rounded">restaurant</span><b>${intake}</b><small>摄入 kcal</small></div>
            <div class="daily-stat"><span class="material-symbols-rounded">balance</span><b>${net > 0 ? '+' : ''}${net}</b><small>净热量</small></div>
            <div class="daily-stat"><span class="material-symbols-rounded">fitness_center</span><b>${names.length}</b><small>项目数</small></div>
            <div class="daily-stat"><span class="material-symbols-rounded">egg_alt</span><b>${macros.pro.toFixed(0)}</b><small>蛋白 g</small></div>
        </div>`;
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
                <div class="md-field"><input type="number" value="${draft.calPer100g}" oninput="data._editingFoodDraft.calPer100g=this.value" placeholder=" "><label>kcal/100g</label></div>
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

    renderManualExercisePanel() {
        const collapsed = this.isCollapsed('exercisePanel', true);
        const items = this.todayExerciseLogs();
        const total = items.reduce((s, e) => s + (e.calories || 0), 0);
        return `<div class="md-card collapsible-card ${collapsed ? 'collapsed' : ''}">
            <button class="panel-head collapsible-head-btn" onclick="data.toggleCollapse('exercisePanel')" type="button" aria-expanded="${!collapsed}">
                <div>
                    <span class="cardio-kicker">手动运动</span>
                    <h3>${items.length} 条记录</h3>
                    <small>今日手动运动消耗 ${total} kcal</small>
                </div>
                <span class="collapse-btn"><span class="material-symbols-rounded">${collapsed ? 'expand_more' : 'expand_less'}</span></span>
            </button>
            <div class="collapse-content">
                <button class="md-btn md-btn-filled" onclick="data.openExerciseModal()" type="button" style="margin:4px 0 8px"><span class="material-symbols-rounded">add</span> 添加运动</button>
                ${items.length ? `<div class="manual-ex-list">${items.map(e => this._editingExerciseId === e.id ? this.renderManualExerciseEditor(e) : `<div class="day-detail-item"><span class="record-icon material-symbols-rounded">${this.sportIcon(this.exerciseLabel(e.type, e))}</span><span>${this.exerciseLabel(e.type, e)} ${e.minutes} 分钟${e.calories ? ` · ${e.calories} kcal` : ''}${e.distance ? ` · ${e.distance}km` : ''}</span><button class="food-log-action-btn" onclick="data.startEditManualExercise('${e.id}')" aria-label="编辑这条运动记录"><span class="material-symbols-rounded">edit</span></button><button class="delete-btn" onclick="data.deleteManualExercise('${e.id}')"><span class="material-symbols-rounded">delete</span></button></div>`).join('')}</div>` : ''}
            </div>
        </div>`;
    },

    toggleManualCustomExercise(type) {
        const field = document.getElementById('manualExerciseCustomField');
        if (field) field.classList.toggle('hidden', type !== 'custom');
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
    },

    startEditManualExercise(id) {
        const log = (this.db.health.exerciseLogs || []).find(e => e.id === id);
        if (!log) return;
        this._editingExerciseId = id;
        this._editingExerciseDraft = {
            id,
            type: log.type || 'walk',
            customName: log.customName || '',
            minutes: log.minutes || '',
            calories: log.calories || '',
            distance: log.distance || '',
            note: log.note || ''
        };
        this.render();
    },

    cancelEditManualExercise() {
        this._editingExerciseId = null;
        this._editingExerciseDraft = null;
        this.render();
    },

    saveEditManualExercise(id) {
        const draft = this._editingExerciseDraft;
        if (!draft || draft.id !== id) return;
        const idx = (this.db.health.exerciseLogs || []).findIndex(e => e.id === id);
        if (idx < 0) return;
        const minutes = parseInt(draft.minutes) || 0;
        const calories = parseInt(draft.calories) || 0;
        const distance = parseFloat(draft.distance) || 0;
        if (minutes <= 0) return alert('请输入有效运动时长');
        this.db.health.exerciseLogs[idx] = {
            ...this.db.health.exerciseLogs[idx],
            type: draft.type,
            customName: draft.customName,
            minutes,
            calories,
            distance,
            note: draft.note
        };
        this._editingExerciseId = null;
        this._editingExerciseDraft = null;
        this.saveAndBackup();
    },

    renderManualExerciseEditor(e) {
        const draft = this._editingExerciseDraft || {
            type: e.type || 'walk',
            customName: e.customName || '',
            minutes: e.minutes || '',
            calories: e.calories || '',
            distance: e.distance || '',
            note: e.note || ''
        };
        return `<div class="diet-log-editor">
            <div class="food-inline-edit-grid">
                <div class="md-field"><select onchange="data._editingExerciseDraft.type=this.value"><option value="walk" ${draft.type === 'walk' ? 'selected' : ''}>步行</option><option value="run" ${draft.type === 'run' ? 'selected' : ''}>跑步</option><option value="cycling" ${draft.type === 'cycling' ? 'selected' : ''}>骑行</option><option value="swim" ${draft.type === 'swim' ? 'selected' : ''}>游泳</option><option value="battle_rope" ${draft.type === 'battle_rope' ? 'selected' : ''}>战绳</option><option value="spin_bike" ${draft.type === 'spin_bike' ? 'selected' : ''}>动感单车</option><option value="strength" ${draft.type === 'strength' ? 'selected' : ''}>力量训练</option><option value="stretch" ${draft.type === 'stretch' ? 'selected' : ''}>拉伸/瑜伽</option><option value="custom" ${draft.type === 'custom' ? 'selected' : ''}>自定义</option></select><label>运动种类</label></div>
                <div class="md-field"><input type="number" value="${draft.minutes}" oninput="data._editingExerciseDraft.minutes=this.value" placeholder=" "><label>时长 分钟</label></div>
                <div class="md-field"><input type="number" value="${draft.calories}" oninput="data._editingExerciseDraft.calories=this.value" placeholder=" "><label>热量 kcal</label></div>
                <div class="md-field"><input type="number" value="${draft.distance}" oninput="data._editingExerciseDraft.distance=this.value" step="0.1" placeholder=" "><label>距离 km</label></div>
                <div class="md-field span-full"><input type="text" value="${this.escapeHtml(draft.note || '')}" oninput="data._editingExerciseDraft.note=this.value" placeholder=" "><label>备注</label></div>
            </div>
            <div class="food-inline-actions">
                <button class="md-btn md-btn-tonal" onclick="data.cancelEditManualExercise()">取消</button>
                <button class="md-btn md-btn-filled" onclick="data.saveEditManualExercise('${e.id}')"><span class="material-symbols-rounded">save</span> 保存</button>
            </div>
        </div>`;
    },

    renderWeightLossPanel() {
        const goalType = this.db.health.goalType || 'loss';
        const isGain = goalType === 'gain';
        const plan = this.db.health.bodyPlan || this.db.health.weightPlan;
        const goal = this.db.health.dietGoal;
        const latest = this.sortedWeights().slice(-1)[0];
        const currentWeight = latest?.weight || '';
        const diffText = plan?.meta ? (isGain
            ? `+${(plan.meta.targetWeight - plan.meta.currentWeight).toFixed(1)} kg`
            : `-${(plan.meta.currentWeight - plan.meta.targetWeight).toFixed(1)} kg`) : '';
        const paceLabel = goal ? (isGain
            ? (goal.pace === 'conservative' ? '精益' : goal.pace === 'moderate' ? '稳定' : '进取')
            : (goal.pace === 'fast' ? '快速' : goal.pace === 'moderate' ? '中等' : '慢速')) : '';
        const weeklyLabel = goal ? (isGain
            ? `${goal.weeklyChange || (plan?.[goal.pace]?.weeklyChange) || '--'} kg/周`
            : `${goal.weeklyLoss || (plan?.[goal.pace]?.weeklyLoss) || '--'} kg/周`) : '';
        return `<div class="md-card weightloss-card ${isGain ? 'goal-gain' : 'goal-loss'}">
            <div class="weightloss-head">
                <div>
                    <span class="cardio-kicker">${isGain ? 'AI 增肌指导' : 'AI 减重指导'}</span>
                    <h3>${isGain ? '制定增肌计划' : '制定减重计划'}</h3>
                    <small>${goal ? `当前方案：${paceLabel} · 每日 ${goal.dailyCal} kcal · 目标${diffText}` : '填写信息后 AI 帮你生成方案'}</small>
                </div>
                <span class="material-symbols-rounded weightloss-icon">${isGain ? 'fitness_center' : 'trending_down'}</span>
            </div>
            <div class="goal-mode-tabs">
                <button class="goal-mode-tab ${!isGain ? 'active' : ''}" onclick="data.setGoalType('loss')" type="button"><span class="material-symbols-rounded">trending_down</span>减重</button>
                <button class="goal-mode-tab ${isGain ? 'active' : ''}" onclick="data.setGoalType('gain')" type="button"><span class="material-symbols-rounded">fitness_center</span>增肌</button>
            </div>
            <div class="weightloss-form">
                <div class="md-grid weightloss-grid">
                    <div class="md-field"><input type="number" id="planCurrentWeight" step="0.1" value="${currentWeight || ''}" placeholder=" "><label>当前体重 kg</label></div>
                    <div class="md-field"><input type="number" id="planTargetWeight" step="0.1" placeholder=" "><label>目标体重 kg</label></div>
                    <div class="md-field"><input type="number" id="planHeight" step="1" placeholder=" "><label>身高 cm</label></div>
                    <div class="md-field"><select id="planActivity"><option value="sedentary">久坐</option><option value="light">轻度活动</option><option value="moderate">中等活动</option><option value="active">高强度活动</option></select><label>日常活动水平</label></div>
                    <div class="md-field"><input type="number" id="planTrainMin" value="30" step="5" placeholder=" "><label>每次运动分钟</label></div>
                    <div class="md-field"><input type="number" id="planWeeklyFreq" value="${isGain ? 4 : 3}" step="1" min="0" max="7" placeholder=" "><label>每周运动次数</label></div>
                    <div class="md-field"><select id="planIntensity"><option value="light">低强度</option><option value="moderate" ${!isGain ? 'selected' : ''}>中等强度</option><option value="vigorous" ${isGain ? 'selected' : ''}>高强度</option></select><label>运动强度</label></div>
                    <div class="md-field"><select id="planSportType"><option value="strength" ${isGain ? 'selected' : ''}>力量训练</option><option value="cardio">有氧运动</option><option value="mixed" ${!isGain ? 'selected' : ''}>力量+有氧混合</option><option value="flexibility">拉伸/瑜伽</option></select><label>主要运动项目</label></div>
                    ${isGain ? `<div class="md-field span-full"><select id="planExperience"><option value="beginner">新手</option><option value="intermediate">中级</option><option value="advanced">高级</option></select><label>训练经验</label></div>` : ''}
                </div>
                <button class="md-btn md-btn-filled" onclick="data.requestWeightLossPlan()"><span class="material-symbols-rounded">psychology</span> AI 生成${isGain ? '增肌' : '减重'}方案</button>
                <div id="planStatus" class="food-ai-status"></div>
            </div>
            <details class="goal-guide">
                <summary><span class="material-symbols-rounded">help</span> 如何选择活动水平、强度和经验</summary>
                <div class="goal-guide-content">
                    <div>
                        <b>日常活动水平</b>
                        <p>不包含专门训练，只看工作、通勤和日常走动。</p>
                        <ul>
                            <li><b>久坐</b> — 办公/学习为主，&lt;5000步/日</li>
                            <li><b>轻度</b> — 少量走动，5000-8000步/日</li>
                            <li><b>中等</b> — 经常走动或站立，8000-12000步/日</li>
                            <li><b>高强度</b> — 体力劳动或&gt;12000步/日</li>
                        </ul>
                    </div>
                    <div>
                        <b>训练强度</b>
                        <ul>
                            <li><b>低强度</b> — 轻松，可完整说话</li>
                            <li><b>中等强度</b> — 明显出汗，可短句交流</li>
                            <li><b>高强度</b> — 很喘，难以连续说话</li>
                        </ul>
                    </div>
                    ${isGain ? `<div>
                        <b>训练经验</b>
                        <ul>
                            <li><b>新手</b> — 系统力量训练少于6个月</li>
                            <li><b>中级</b> — 规律训练6个月-2年</li>
                            <li><b>高级</b> — 规律训练超过2年，有周期化经验</li>
                        </ul>
                    </div>` : ''}
                </div>
            </details>
            ${plan ? `<div class="weightloss-options">
                ${isGain
                    ? ['conservative', 'moderate', 'aggressive'].map(pace => {
                        const p = plan[pace];
                        if (!p) return '';
                        const isActive = goal?.pace === pace;
                        const label = pace === 'conservative' ? '精益增肌' : pace === 'moderate' ? '稳定增肌' : '进取增肌';
                        return `<div class="weightloss-option ${isActive ? 'active' : ''}" onclick="data.applyWeightLossPlan('${pace}')">
                            <div class="weightloss-option-head">
                                <b>${label}</b>
                                ${isActive ? '<span class="item-chip">当前方案</span>' : ''}
                            </div>
                            <div class="weightloss-option-stats">
                                <span>+${p.weeklyChange || 0} kg/周</span>
                                <span>${p.days} 天</span>
                                <b>${p.dailyCal} kcal/日</b>
                            </div>
                            <small>${p.desc || ''}</small>
                        </div>`;
                    }).join('')
                    : ['fast', 'moderate', 'slow'].map(pace => {
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
        const h = this.db.health.height || 0;
        const bmi = (latest && h > 0) ? (latest.weight / ((h / 100) ** 2)) : 0;
        const bmiInfo = bmi > 0 ? this.bmiCategory(bmi) : null;
        const recentWeights = weights.slice(-8).reverse();
        const historyCollapsed = this.isCollapsed('weightHistory', true);
        return `<div class="md-card weight-card">
            <div class="weight-head">
                <div>
                    <span class="cardio-kicker">体重管理</span>
                    <h3>${latest ? `${latest.weight.toFixed(1)} kg` : '-- kg'}</h3>
                    <small>${latest ? `${latest.date}${delta ? ` · 较上次 ${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg` : ''}` : '点击下方添加第一条体重记录'}</small>
                </div>
                <span class="material-symbols-rounded weight-icon">monitor_weight</span>
            </div>
            <div class="bmi-row">
                <button class="md-btn md-btn-tonal weight-open-btn" onclick="data.openWeightModal()"><span class="material-symbols-rounded">edit_note</span> 记录体重</button>
                ${bmiInfo ? `<div class="bmi-display">
                    <span class="bmi-value">${bmi.toFixed(1)}</span>
                    <span class="bmi-label" style="color:${bmiInfo.color}">${bmiInfo.label}</span>
                    <span class="bmi-range">BMI ${bmiInfo.range}</span>
                </div>` : '<div class="bmi-display bmi-empty"><small>填写身高计算 BMI</small></div>'}
            </div>
            <div class="weight-range-tabs">
                ${['week','month','year'].map(r => `<button class="weight-range ${this.weightRange === r ? 'active' : ''}" onclick="data.setWeightRange('${r}')">${r === 'week' ? '周' : r === 'month' ? '月' : '年'}</button>`).join('')}
            </div>
            ${this.renderWeightChart()}
            <div class="weight-analysis">
                <div><b>${analysis.avgText}</b><small>日均变化</small></div>
                <div><b>${analysis.trend}</b><small>阶段判断</small></div>
            </div>
            ${recentWeights.length ? `<div class="weight-history-card ${historyCollapsed ? 'collapsed' : ''}">
                <button class="weight-history-head" onclick="data.toggleCollapse('weightHistory')" type="button">
                    <span class="material-symbols-rounded">history</span>
                    <strong>近期记录</strong>
                    <small>${recentWeights.length} 条</small>
                    <span class="material-symbols-rounded">${historyCollapsed ? 'expand_more' : 'expand_less'}</span>
                </button>
                <div class="weight-history-content">
                    ${this.renderWeightList(recentWeights)}
                </div>
            </div>` : ''}
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

    saveHeight(val) {
        const h = parseFloat(val);
        if (h > 0) { this.db.health.height = h; localStorage.setItem(this.DB_KEY, JSON.stringify(this.db)); this.renderHistory(); }
    },

    bmiCategory(bmi) {
        if (bmi < 18.5) return { label: '偏瘦', color: '#0891b2', range: '< 18.5' };
        if (bmi < 24) return { label: '正常', color: '#059669', range: '18.5 - 24' };
        if (bmi < 28) return { label: '偏胖', color: '#f59e0b', range: '24 - 28' };
        return { label: '肥胖', color: '#e11d48', range: '≥ 28' };
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
        const byDate = this.groupCalendarActivitiesByDate();
        const cells = [];
        for (let i = 0; i < leading; i++) cells.push('<div class="calendar-day empty"></div>');
        for (let day = 1; day <= days; day++) {
            const key = this.dateKey(new Date(year, month, day));
            const entries = byDate[key] || [];
            const names = entries.map(e => e.name).filter(Boolean).slice(0, 3);
            const totalMin = Math.round(entries.reduce((sum, e) => sum + (e.minutes || 0), 0));
            const isSelected = this.selectedCalendarDate === key;
            cells.push(`
                <div class="calendar-day ${entries.length ? 'has-record' : ''} ${isSelected ? 'selected' : ''}" onclick="data.selectCalendarDate('${key}')">
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
        const names = [...new Set(Object.values(this.groupCalendarActivitiesByDate()).flat().map(e => e.name))].slice(0, 6);
        if (names.length === 0) return '';
        return `
            <div class="calendar-legend">
                ${names.map(name => `<span><i style="background:${this.actionColor(name)}"></i>${name}</span>`).join('')}
            </div>`;
    },

    renderCalendarDayDetail() {
        if (!this.selectedCalendarDate) return '';
        const date = this.selectedCalendarDate;
        const entries = this.db.history.filter(h => this.dateKey(this.parseHistoryDate(h.date)) === date);
        const foods = (this.db.health.foodLogs || []).filter(f => f.date === date);
        const manualExercises = (this.db.health.exerciseLogs || []).filter(e => e.date === date);
        const weight = (this.db.health.weights || []).find(w => w.date === date);
        const totalMin = Math.round(entries.reduce((s, h) => s + (h.duration || 0), 0) / 60 + manualExercises.reduce((s, e) => s + (e.minutes || 0), 0));
        const totalCal = Math.round(entries.reduce((s, h) => s + (h.cardio?.calories || 0), 0) + manualExercises.reduce((s, e) => s + (e.calories || 0), 0));
        const foodCal = foods.reduce((s, f) => s + (f.cal || 0), 0);
        const foodPro = foods.reduce((s, f) => s + Number(f.pro || 0), 0);
        const foodCarb = foods.reduce((s, f) => s + Number(f.carb || 0), 0);
        const foodFat = foods.reduce((s, f) => s + Number(f.fat || 0), 0);
        const mealNames = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
        if (entries.length === 0 && foods.length === 0 && manualExercises.length === 0 && !weight) {
            return `<div class="md-card day-detail-card">
                <div class="day-detail-head"><span class="material-symbols-rounded">event</span><strong>${date}</strong><button class="icon-btn" onclick="data.selectCalendarDate('${date}')"><span class="material-symbols-rounded">close</span></button></div>
                <div class="empty-state" style="padding:20px"><p>当天暂无记录</p></div>
            </div>`;
        }
        return `<div class="md-card day-detail-card">
            <div class="day-detail-head"><span class="material-symbols-rounded">event</span><strong>${date}</strong><button class="icon-btn" onclick="data.selectCalendarDate('${date}')"><span class="material-symbols-rounded">close</span></button></div>
            <div class="day-detail-stats">
                <span>${totalMin} 分钟训练</span>
                ${totalCal ? `<span>${totalCal} kcal 运动消耗</span>` : ''}
                ${foodCal ? `<span>${foodCal} kcal 摄入</span>` : ''}
                ${weight ? `<span>${weight.weight.toFixed(1)} kg</span>` : ''}
            </div>
            ${entries.length ? `<div class="day-detail-section"><b>训练</b>${entries.map(h => {
                const icon = this.historyIcon(h);
                const names = this.historyNames(h).join('、');
                const mins = Math.floor(h.duration / 60);
                const secs = h.duration % 60;
                return `<div class="day-detail-item"><span class="record-icon material-symbols-rounded">${icon}</span><span>${names}</span><small>${mins}分${secs}秒${h.cardio ? ' · ' + Math.round(h.cardio.calories || 0) + ' kcal' : ''}</small></div>`;
            }).join('')}</div>` : ''}
            ${foods.length ? `<div class="day-detail-section"><b>饮食 · ${foodCal} kcal · P${foodPro.toFixed(0)} C${foodCarb.toFixed(0)} F${foodFat.toFixed(0)}</b>${foods.map(f => {
                return `<div class="day-detail-item"><span class="food-tag">${mealNames[f.meal] || f.meal}</span><span>${f.name}${f.grams ? ' ' + f.grams + 'g' : ''}</span><small>${f.cal} kcal · P${Number(f.pro || 0).toFixed(0)} C${Number(f.carb || 0).toFixed(0)} F${Number(f.fat || 0).toFixed(0)}</small></div>`;
            }).join('')}</div>` : ''}
            ${manualExercises.length ? `<div class="day-detail-section"><b>手动运动</b>${manualExercises.map(e => `<div class="day-detail-item"><span class="record-icon material-symbols-rounded">${this.sportIcon(this.exerciseLabel(e.type, e))}</span><span>${this.exerciseLabel(e.type, e)} ${e.minutes} 分钟${e.note ? ' · ' + this.escapeHtml(e.note) : ''}</span><small>${e.calories || 0} kcal</small></div>`).join('')}</div>` : ''}
            ${weight ? `<div class="day-detail-section"><b>体重</b><div class="day-detail-item"><span class="material-symbols-rounded" style="font-size:18px">monitor_weight</span><span>${weight.weight.toFixed(1)} kg</span>${weight.note ? `<small>${weight.note}</small>` : ''}</div></div>` : ''}
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

    groupCalendarActivitiesByDate() {
        const map = {};
        (this.db.history || []).forEach(h => {
            const key = this.dateKey(this.parseHistoryDate(h.date));
            if (!map[key]) map[key] = [];
            this.historyNames(h).forEach((name, idx) => {
                map[key].push({ name, minutes: idx === 0 ? (h.duration || 0) / 60 : 0, source: 'history' });
            });
        });
        (this.db.health.exerciseLogs || []).forEach(e => {
            if (!e.date) return;
            if (!map[e.date]) map[e.date] = [];
            const name = this.exerciseLabel(e.type, e);
            map[e.date].push({ name, minutes: Number(e.minutes || 0), source: 'manual' });
        });
        return map;
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
        if (/战绳|battle/.test(text)) return 'waterfall_chart';
        if (/动感单车|spin/.test(text)) return 'pedal_bike';
        if (/swim|游泳/.test(text)) return 'pool';
        if (/row|划船/.test(text)) return 'rowing';
        if (/elliptical|椭圆/.test(text)) return 'exercise';
        if (/拉伸|伸展|stretch/.test(text)) return 'self_improvement';
        if (/深蹲|蹲|腿|臀|squat/.test(text)) return 'accessibility_new';
        if (/肩|臂|手|推|拉|胸|背/.test(text)) return 'fitness_center';
        if (/核心|腹|腰|平板|plank/.test(text)) return 'sports_gymnastics';
        return 'fitness_center';
    },

    exerciseLabel(type = '', entry = null) {
        if (type === 'custom') return entry?.customName || entry?.note || '自定义运动';
        const map = {
            walk: '步行',
            run: '跑步',
            cycling: '骑行',
            swim: '游泳',
            battle_rope: '战绳',
            spin_bike: '动感单车',
            strength: '力量训练',
            stretch: '拉伸/瑜伽'
        };
        return map[type] || type || '运动';
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

if (typeof window !== 'undefined') window.data = data;
