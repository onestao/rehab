(function () {
    window.dataHealthExercise = {
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
        }
    };
})();
