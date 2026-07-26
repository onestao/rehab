// @ts-nocheck
(function () {
    window.dataHealthExercise = {
        openExerciseModal(...args) {
            return window.dataUiState?.openExerciseModal?.apply(this, args);
        },

        manualExerciseTypeOptions() {
            const cardio = window.cardioPure?.cardioTypes || {
                walk: { name: '步行', met: 3.5 },
                run: { name: '跑步', met: 9.8 },
                cycling: { name: '骑行', met: 6.8 },
                swim: { name: '游泳', met: 7.0 }
            };
            return [
                ...Object.entries(cardio).map(([type, info]) => [type, `${info.name}${info.met ? ` ${info.met} MET` : ''}`]),
                ['strength', '力量训练 (无氧)'],
                ['stretch', '拉伸/瑜伽'],
                ['custom', '自定义运动']
            ];
        },

        renderManualExerciseTypeOptions(value = 'walk') {
            const current = String(value || 'walk');
            return this.manualExerciseTypeOptions()
                .map(([type, label]) => `<option value="${this.escapeHtml(type)}" ${current === type ? 'selected' : ''}>${this.escapeHtml(label)}</option>`)
                .join('');
        },

        normalizeExerciseLibraryName(value = '') {
            return String(value || '').trim().replace(/[\s·•、，。；;:：()（）【】\[\]{}"'_-]+/g, '').toLowerCase();
        },

        exerciseLibraryActions(kind = '') {
            const normalizeCategory = (value) => window.actionTaxonomy?.normalizeActionNature?.(value) || '';
            return this.activeRecords(this.db.actions || []).filter((action) => {
                if (!action || action.libOnly !== true || !action.exerciseLogEnabled) return false;
                const category = normalizeCategory(action.category);
                if (kind === 'cardio') return category === 'cardio' && Number(action.met || 0) > 0;
                if (kind === 'strength') return category === 'training';
                return true;
            });
        },

        cardioTypeOptionsFromLibrary() {
            return this.exerciseLibraryActions('cardio').reduce((acc, action) => {
                acc[`action:${action.id}`] = {
                    name: action.name || '自定义有氧',
                    met: Number(action.met || 0)
                };
                return acc;
            }, {});
        },

        fillExerciseLibrarySelect(select, kind = '') {
            if (!select) return;
            const actions = this.exerciseLibraryActions(kind);
            const current = select.value || '';
            select.textContent = '';
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = '从动作库选择';
            select.appendChild(placeholder);
            actions.forEach((action) => {
                const option = document.createElement('option');
                option.value = action.id;
                const category = this.actionCategoryLabel?.(action.category) || '';
                const met = Number(action.met || 0);
                option.textContent = [action.name || '未命名动作', category, met > 0 ? `${met} MET` : ''].filter(Boolean).join(' · ');
                select.appendChild(option);
            });
            select.value = actions.some((action) => action.id === current) ? current : '';
            select.disabled = actions.length === 0;
        },

        refreshExerciseLibrarySelects() {
            this.fillExerciseLibrarySelect(document.getElementById('manualExerciseLibraryAction'), '');
            this.fillExerciseLibrarySelect(document.getElementById('slLibraryAction'), 'strength');
        },

        manualExerciseMet(type = '', sourceAction = null) {
            const actionMet = Number(sourceAction?.met || 0);
            if (Number.isFinite(actionMet) && actionMet > 0) return actionMet;
            const builtin = window.cardioPure?.cardioTypes?.[type];
            return Number(builtin?.met || 0);
        },

        upsertExerciseLibraryAction(input = {}) {
            const name = String(input.name || '').trim();
            if (!name) return null;
            this.db.actions = Array.isArray(this.db.actions) ? this.db.actions : [];
            const sourceId = String(input.sourceActionId || '').trim();
            const key = this.normalizeExerciseLibraryName(name);
            let action = sourceId ? (this.findActionById?.(sourceId) || this.db.actions.find((item) => item && item.id === sourceId)) : null;
            if (!action) {
                action = this.activeRecords(this.db.actions).find((item) => item.libOnly === true && this.normalizeExerciseLibraryName(item.name) === key);
            }
            if (!action) {
                action = {
                    id: this.generateRecordId('action'),
                    name,
                    libOnly: true,
                    createdAt: new Date().toISOString(),
                    deleted: false
                };
                this.db.actions.push(action);
            }
            action.name = name;
            action.libOnly = true;
            action.exerciseLogEnabled = true;
            action.category = window.actionTaxonomy?.normalizeActionNature?.(input.category || action.category || '') || input.category || action.category || '';
            action.met = Math.max(0, Number(input.met || action.met || 0));
            action.sets = Math.max(1, Number(input.sets || action.sets || 1));
            action.reps = Math.max(1, Number(input.reps || action.reps || 1));
            action.work = Math.max(1, Number(input.work || action.work || 5));
            action.weightKg = Math.max(0, Number(input.weightKg || action.weightKg || 0));
            action.phase = ['warmup', 'main', 'cooldown'].includes(action.phase) ? action.phase : 'main';
            action.updatedAt = Date.now();
            this.touchRecord?.(action, ['name', 'category', 'exerciseLogEnabled', 'met', 'sets', 'reps', 'work', 'weightKg']);
            return action;
        },

        applyExerciseLibraryAction(actionId) {
            const action = this.findActionById?.(actionId) || (this.db.actions || []).find((item) => item && item.id === actionId);
            if (!action || action.deleted) return;
            const type = window.actionTaxonomy?.natureToExerciseLogType?.(action.category) || 'custom';
            const typeEl = document.getElementById('manualExerciseType');
            if (typeEl) typeEl.value = type;
            this.toggleManualCustomExercise(type);
            const nameEl = document.getElementById('manualExerciseCustom');
            if (nameEl) nameEl.value = action.name || '';
            const weightEl = document.getElementById('manualExerciseWeight');
            if (weightEl) weightEl.value = action.weightKg ? String(action.weightKg) : '';
            const setsEl = document.getElementById('manualExerciseSets');
            if (setsEl) setsEl.value = action.sets ? String(action.sets) : '';
            const repsEl = document.getElementById('manualExerciseReps');
            if (repsEl) repsEl.value = action.reps ? String(action.reps) : '';
            const select = document.getElementById('manualExerciseLibraryAction');
            if (select) select.value = action.id;
        },

        applyStrengthLogLibraryAction(actionId) {
            const action = this.findActionById?.(actionId) || (this.db.actions || []).find((item) => item && item.id === actionId);
            if (!action || action.deleted) return;
            const setValue = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.value = value == null ? '' : String(value);
            };
            setValue('slName', action.name || '');
            setValue('slWeight', action.weightKg ? action.weightKg : '');
            setValue('slSets', action.sets || '');
            setValue('slReps', action.reps || '');
            setValue('slMinutes', action.defaultMinutes || '');
            const select = document.getElementById('slLibraryAction');
            if (select) select.value = action.id;
        },

        strengthLoadLabel(entry = {}) {
            const weight = Number(entry.weightKg || 0);
            return weight > 0 ? `${weight}kg` : '自重';
        },

        addStrengthLog() {
            const date = this.logicalDateKey();
            const name = document.getElementById('slName')?.value?.trim() || '';
            const weightKg = parseFloat(document.getElementById('slWeight')?.value) || 0;
            const sets = parseInt(document.getElementById('slSets')?.value) || 0;
            const repsPerSet = parseInt(document.getElementById('slReps')?.value) || 0;
            const minutes = parseInt(document.getElementById('slMinutes')?.value) || 0;
            const note = document.getElementById('slNote')?.value?.trim() || '';
            const sourceActionId = document.getElementById('slLibraryAction')?.value || '';
            const remember = !!document.getElementById('slSaveToLibrary')?.checked;
            if (!name) return alert('请输入动作名称');
            if (sets <= 0 || repsPerSet <= 0) return alert('请输入组数与每组次数');
            const bodyWeight = (this.sortedWeights?.().slice(-1)[0]?.weight) || 70;
            const estMin = minutes || Math.max(1, sets * 1.5);
            const calories = Math.round(5.0 * bodyWeight * (estMin / 60));
            this.db.health.exerciseLogs.push({
                id: this.generateRecordId('exercise'),
                date,
                type: 'strength',
                customName: name,
                weightKg,
                sets,
                repsPerSet,
                minutes: estMin,
                calories,
                distance: 0,
                note,
                sourceActionId,
                createdAt: new Date().toISOString(),
                updatedAt: Date.now(),
                deleted: false
            });
            if (remember) this.upsertExerciseLibraryAction({ name, category: 'training', weightKg, sets, reps: repsPerSet, sourceActionId });
            ['slName','slWeight','slSets','slReps','slMinutes','slNote','slLibraryAction'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
            const rememberEl = document.getElementById('slSaveToLibrary');
            if (rememberEl) rememberEl.checked = false;
            const prDiff = window.prTracker?.refresh?.(this.db)?.diff || [];
            this.saveAndBackup();
            const actionDiff = prDiff.find(item => item.action === name);
            if (actionDiff && window.toast?.show) {
                toast.show(`💪 新 PR：${name} ${this.strengthLoadLabel({ weightKg })} × ${repsPerSet}`, 'success', 3200);
            }
        },
        todayTrainingCalories() {
            const today = this.logicalDateKey();
            const autoCal = this.activeRecords(this.db.history)
                .filter(h => this.historyDayKey(h) === today)
                .reduce((sum, h) => sum + (h.cardio?.calories || 0), 0);
            const manualCal = this.activeRecords(this.db.health.exerciseLogs || [])
                .filter(e => e.date === today)
                .reduce((sum, e) => sum + (e.calories || 0), 0);
            return autoCal + manualCal;
        },

        addManualExercise() {
            const date = this.logicalDateKey();
            const type = document.getElementById('manualExerciseType')?.value || 'walk';
            const customName = document.getElementById('manualExerciseCustom')?.value?.trim() || '';
            const minutes = parseInt(document.getElementById('manualExerciseMinutes')?.value) || 0;
            let calories = parseInt(document.getElementById('manualExerciseCalories')?.value) || 0;
            const distance = parseFloat(document.getElementById('manualExerciseDistance')?.value) || 0;
            const note = document.getElementById('manualExerciseNote')?.value?.trim() || '';
            const weightKg = parseFloat(document.getElementById('manualExerciseWeight')?.value) || 0;
            const sets = parseInt(document.getElementById('manualExerciseSets')?.value) || 0;
            const repsPerSet = parseInt(document.getElementById('manualExerciseReps')?.value) || 0;
            const sourceActionId = document.getElementById('manualExerciseLibraryAction')?.value || '';
            const sourceAction = sourceActionId ? this.findActionById?.(sourceActionId) : null;
            const met = this.manualExerciseMet(type, sourceAction);
            const remember = !!document.getElementById('manualExerciseSaveToLibrary')?.checked;
            let savedMinutes = minutes;
            if (type === 'custom' && !customName) { alert('请输入自定义运动名称'); return false; }
            if (type === 'strength') {
                if (!customName) { alert('请输入力量训练动作名称'); return false; }
                if (sets <= 0 || repsPerSet <= 0) { alert('请输入组数与每组次数'); return false; }
                if (!calories) {
                    const bodyWeight = (this.sortedWeights?.().slice(-1)[0]?.weight) || 70;
                    const estMin = minutes || Math.max(1, sets * 1.5);
                    savedMinutes = estMin;
                    calories = Math.round(5.0 * bodyWeight * (estMin / 60));
                }
            } else {
                if (minutes <= 0) { alert('请输入有效运动时长'); return false; }
                if (!calories && met > 0) {
                    const bodyWeight = (this.sortedWeights?.().slice(-1)[0]?.weight) || 70;
                    calories = Math.round(met * bodyWeight * (minutes / 60));
                }
            }
            this.db.health.exerciseLogs.push({
                id: this.generateRecordId('exercise'),
                date,
                type,
                customName,
                weightKg: type === 'strength' ? weightKg : 0,
                sets: type === 'strength' ? sets : 0,
                repsPerSet: type === 'strength' ? repsPerSet : 0,
                minutes: savedMinutes,
                calories,
                distance,
                note,
                sourceActionId,
                met,
                createdAt: new Date().toISOString(),
                updatedAt: Date.now(),
                deleted: false
            });
            if (remember) {
                const label = customName || this.exerciseLabel(type, { customName });
                this.upsertExerciseLibraryAction({
                    name: label,
                    category: window.actionTaxonomy?.exerciseLogTypeToNature?.(type, met) || 'other',
                    met,
                    weightKg,
                    sets: sets || 1,
                    reps: repsPerSet || 1,
                    sourceActionId
                });
            }
            const customEl = document.getElementById('manualExerciseCustom');
            if (customEl) customEl.value = '';
            const libraryEl = document.getElementById('manualExerciseLibraryAction');
            if (libraryEl) libraryEl.value = '';
            const rememberEl = document.getElementById('manualExerciseSaveToLibrary');
            if (rememberEl) rememberEl.checked = false;
            document.getElementById('manualExerciseMinutes').value = '';
            document.getElementById('manualExerciseCalories').value = '';
            document.getElementById('manualExerciseDistance').value = '';
            document.getElementById('manualExerciseNote').value = '';
            const wf = document.getElementById('manualExerciseWeight');
            const sf = document.getElementById('manualExerciseSets');
            const rf = document.getElementById('manualExerciseReps');
            if (wf) wf.value = '';
            if (sf) sf.value = '';
            if (rf) rf.value = '';
            this.saveAndBackup();
            return true;
        },

        deleteManualExercise(id) {
            this.deleteWithUndo(this.db.health.exerciseLogs, id, {
                save: () => this.saveAndBackup(),
                render: () => this.renderHistory?.()
            });
        },

        todayExerciseLogs() {
            const today = this.logicalDateKey();
            return this.activeRecords(this.db.health.exerciseLogs || []).filter(e => e.date === today);
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
                ${items.length ? `<div class="manual-ex-list">${items.map(e => this._editingExerciseId === e.id ? this.renderManualExerciseEditor(e) : `<div class="day-detail-item"><span class="record-icon material-symbols-rounded">${this.sportIcon(this.exerciseLabel(e.type, e))}</span><span>${this.exerciseLabel(e.type, e)}${e.type === 'strength' ? ` ${this.strengthLoadLabel(e)} × ${e.sets ?? 0} × ${e.repsPerSet ?? 0}` : ''} ${e.minutes} 分钟${e.calories ? ` · ${e.calories} kcal` : ''}${e.distance ? ` · ${e.distance}km` : ''}</span><button class="food-log-action-btn" onclick="data.startEditManualExercise('${e.id}')" aria-label="编辑这条运动记录"><span class="material-symbols-rounded">edit</span></button><button class="delete-btn" onclick="data.deleteManualExercise('${e.id}')"><span class="material-symbols-rounded">delete</span></button></div>`).join('')}</div>` : ''}
            </div>
        </div>`;
        },

        toggleManualCustomExercise(type) {
            const field = document.getElementById('manualExerciseCustomField');
            const isStrength = type === 'strength';
            if (field) {
                field.classList.toggle('hidden', type !== 'custom' && !isStrength);
                const label = field.querySelector('label');
                if (label) label.textContent = isStrength ? '动作名称' : '自定义运动名称';
            }
            const wf = document.getElementById('manualExerciseWeightField');
            const sf = document.getElementById('manualExerciseSetsField');
            const rf = document.getElementById('manualExerciseRepsField');
            if (wf) wf.classList.toggle('hidden', !isStrength);
            if (sf) sf.classList.toggle('hidden', !isStrength);
            if (rf) rf.classList.toggle('hidden', !isStrength);
        },

        startEditManualExercise(id) {
            const log = this.activeRecords(this.db.health.exerciseLogs || []).find(e => e.id === id);
            if (!log) return;
            this._editingExerciseId = id;
            this._editingExerciseDraft = {
                id,
                type: log.type || 'walk',
                customName: log.customName || '',
                weightKg: log.weightKg || '',
                sets: log.sets || '',
                repsPerSet: log.repsPerSet || '',
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
            if (draft.type !== 'strength' && minutes <= 0) return alert('请输入有效运动时长');
            this.db.health.exerciseLogs[idx] = {
                ...this.db.health.exerciseLogs[idx],
                type: draft.type,
                customName: draft.customName,
                weightKg: draft.type === 'strength' ? (parseFloat(draft.weightKg) || 0) : 0,
                sets: draft.type === 'strength' ? (parseInt(draft.sets) || 0) : 0,
                repsPerSet: draft.type === 'strength' ? (parseInt(draft.repsPerSet) || 0) : 0,
                minutes,
                calories,
                distance,
                note: draft.note,
                deleted: false,
                updatedAt: Date.now()
            };
            this._editingExerciseId = null;
            this._editingExerciseDraft = null;
            this.saveAndBackup();
        },

        renderManualExerciseEditor(e) {
            const draft = this._editingExerciseDraft || {
                type: e.type || 'walk',
                customName: e.customName || '',
                weightKg: e.weightKg || '',
                sets: e.sets || '',
                repsPerSet: e.repsPerSet || '',
                minutes: e.minutes || '',
                calories: e.calories || '',
                distance: e.distance || '',
                note: e.note || ''
            };
            const isStrength = draft.type === 'strength';
            return `<div class="diet-log-editor">
            <div class="food-inline-edit-grid">
                <div class="md-field"><select onchange="data._editingExerciseDraft.type=this.value">${this.renderManualExerciseTypeOptions(draft.type)}</select><label>运动种类</label></div>
                ${isStrength ? `<div class="md-field"><input type="number" value="${draft.weightKg}" oninput="data._editingExerciseDraft.weightKg=this.value" step="0.5" placeholder=" "><label>外加负重 kg</label></div>
                <div class="md-field"><input type="number" value="${draft.sets}" oninput="data._editingExerciseDraft.sets=this.value" placeholder=" "><label>组数</label></div>
                <div class="md-field"><input type="number" value="${draft.repsPerSet}" oninput="data._editingExerciseDraft.repsPerSet=this.value" placeholder=" "><label>每组次数</label></div>` : ''}
                <div class="md-field"><input type="number" value="${draft.minutes}" oninput="data._editingExerciseDraft.minutes=this.value" placeholder=" "><label>时长 分钟</label></div>
                <div class="md-field"><input type="number" value="${draft.calories}" oninput="data._editingExerciseDraft.calories=this.value" placeholder=" "><label>热量 kcal</label></div>
                <div class="md-field"><input type="number" value="${draft.distance}" oninput="data._editingExerciseDraft.distance=this.value" step="0.1" placeholder=" "><label>距离 km</label></div>
                <div class="md-field span-full"><input type="text" value="${this.escapeHtml(draft.note || '')}" oninput="data._editingExerciseDraft.note=this.value" placeholder=" "><label>备注</label></div>
            </div>
            <div class="food-inline-actions food-edit-actions">
                <button class="md-btn md-btn-tonal" onclick="data.cancelEditManualExercise()">取消</button>
                <button class="md-btn md-btn-filled" onclick="data.saveEditManualExercise('${e.id}')"><span class="material-symbols-rounded">save</span> 保存</button>
            </div>
        </div>`;
        }
    };
})();
