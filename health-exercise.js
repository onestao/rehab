// @ts-nocheck
(function () {
    window.dataHealthExercise = {
        addStrengthLog() {
            const date = this.logicalDateKey();
            const name = document.getElementById('slName')?.value?.trim() || '';
            const weightKg = parseFloat(document.getElementById('slWeight')?.value) || 0;
            const sets = parseInt(document.getElementById('slSets')?.value) || 0;
            const repsPerSet = parseInt(document.getElementById('slReps')?.value) || 0;
            const minutes = parseInt(document.getElementById('slMinutes')?.value) || 0;
            const note = document.getElementById('slNote')?.value?.trim() || '';
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
                createdAt: new Date().toISOString(),
                updatedAt: Date.now(),
                deleted: false
            });
            ['slName','slWeight','slSets','slReps','slMinutes','slNote'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
            this.saveAndBackup();
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
                createdAt: new Date().toISOString(),
                updatedAt: Date.now(),
                deleted: false
            });
            const customEl = document.getElementById('manualExerciseCustom');
            if (customEl) customEl.value = '';
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
            this.softDeleteById(this.db.health.exerciseLogs, id);
            this.saveAndBackup();
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
                ${items.length ? `<div class="manual-ex-list">${items.map(e => this._editingExerciseId === e.id ? this.renderManualExerciseEditor(e) : `<div class="day-detail-item"><span class="record-icon material-symbols-rounded">${this.sportIcon(this.exerciseLabel(e.type, e))}</span><span>${this.exerciseLabel(e.type, e)}${e.type === 'strength' && e.weightKg ? ` ${e.weightKg}kg × ${e.sets ?? 0} × ${e.repsPerSet ?? 0}` : ''} ${e.minutes} 分钟${e.calories ? ` · ${e.calories} kcal` : ''}${e.distance ? ` · ${e.distance}km` : ''}</span><button class="food-log-action-btn" onclick="data.startEditManualExercise('${e.id}')" aria-label="编辑这条运动记录"><span class="material-symbols-rounded">edit</span></button><button class="delete-btn" onclick="data.deleteManualExercise('${e.id}')"><span class="material-symbols-rounded">delete</span></button></div>`).join('')}</div>` : ''}
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
                <div class="md-field"><select onchange="data._editingExerciseDraft.type=this.value"><option value="walk" ${draft.type === 'walk' ? 'selected' : ''}>步行</option><option value="run" ${draft.type === 'run' ? 'selected' : ''}>跑步</option><option value="cycling" ${draft.type === 'cycling' ? 'selected' : ''}>骑行</option><option value="swim" ${draft.type === 'swim' ? 'selected' : ''}>游泳</option><option value="battle_rope" ${draft.type === 'battle_rope' ? 'selected' : ''}>战绳</option><option value="spin_bike" ${draft.type === 'spin_bike' ? 'selected' : ''}>动感单车</option><option value="strength" ${draft.type === 'strength' ? 'selected' : ''}>力量训练</option><option value="stretch" ${draft.type === 'stretch' ? 'selected' : ''}>拉伸/瑜伽</option><option value="custom" ${draft.type === 'custom' ? 'selected' : ''}>自定义</option></select><label>运动种类</label></div>
                ${isStrength ? `<div class="md-field"><input type="number" value="${draft.weightKg}" oninput="data._editingExerciseDraft.weightKg=this.value" step="0.5" placeholder=" "><label>负重 kg</label></div>
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
