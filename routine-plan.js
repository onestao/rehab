// @ts-nocheck
(function () {
    window.dataRoutinePlan = {
        _planActions() {
            return this.activeRecords(this.db.actions).filter(a => !a.libOnly);
        },

        _cloneRoutineActionsForPlan(actions = []) {
            return JSON.parse(JSON.stringify(actions || [])).map(a => ({
                ...a,
                libOnly: false,
                deleted: false,
                updatedAt: Date.now()
            }));
        },

        _replacePlanActions(actions = []) {
            const libraryActions = this.activeRecords(this.db.actions || []).filter(a => a.libOnly === true);
            this.db.actions = libraryActions.concat(this._cloneRoutineActionsForPlan(actions));
        },

        planMatchesRoutine(routine) {
            const planActions = this._planActions();
            const routineActions = Array.isArray(routine?.actions) ? routine.actions : [];
            if (!planActions.length || planActions.length !== routineActions.length) return false;
            return routineActions.every((routineAction, index) => {
                const planAction = planActions[index];
                if (!planAction) return false;
                const routineId = routineAction.id || routineAction.sourceActionId || '';
                const planSourceId = planAction.sourceActionId || planAction.id || '';
                const idMatches = routineId && planSourceId && routineId === planSourceId;
                const nameMatches = String(planAction.name || '').trim() === String(routineAction.name || '').trim();
                return idMatches || nameMatches;
            });
        },

        _readActionForm() {
            const readInt = (id, fallback) => {
                const raw = document.getElementById(id)?.value;
                if (raw === '' || raw == null) return fallback;
                const parsed = parseInt(raw, 10);
                return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
            };
            return {
                name: document.getElementById('name').value || '未命名',
                sets: Math.max(1, readInt('sets', 3)),
                reps: Math.max(0, readInt('reps', 12)),
                work: Math.max(0, readInt('work', 0)),
                repRest: readInt('repRest', 30),
                actionRest: readInt('actionRest', 90),
                groupRest: readInt('groupRest', 120),
                switchRest: 3,
                isAlt: document.getElementById('isAlt').checked,
                phase: document.getElementById('actionPhase')?.value || 'main',
                tags: []
            };
        },

        addAction() {
            const a = {
                ...this._readActionForm(),
                id: this.generateRecordId('action'),
                libOnly: false,
                updatedAt: Date.now(),
                deleted: false
            };
            this.db.actions.push(a);
            this.db.lastActionDraft = {
                sets: a.sets,
                reps: a.reps,
                work: a.work,
                repRest: a.repRest,
                actionRest: a.actionRest,
                groupRest: a.groupRest
            };
            this.save();
            document.getElementById('name').value = '';
            window.haptics?.light?.();
        },

        saveCurrentActionToLibrary() {
            const name = document.getElementById('name').value.trim();
            if (!name) {
                this._confirmModal({
                    title: '缺少名称',
                    icon: 'info',
                    message: '请先输入动作名称。',
                    okText: '知道了',
                    cancelText: '',
                    onOk: () => { try { document.getElementById('name')?.focus?.(); } catch {} }
                });
                return;
            }
            const a = {
                ...this._readActionForm(),
                name,
                libOnly: true,
                id: this.generateRecordId('action'),
                updatedAt: Date.now(),
                deleted: false
            };
            this.db.actions.push(a);
            this.db.libraryView = 'actions';
            this.saveAndBackup?.() || this.save();
            window.haptics?.light?.();
            if (window.toast?.show) toast.show(`"${name}" 已存入动作库`, 'success');
        },

        openRoutineLibraryFromWorkout() {
            if (!this.db) this.db = {};
            this.db.libraryView = 'routines';
            this.showWorkoutLibrary?.();
        },

        openActionLibraryFromWorkout() {
            if (!this.db) this.db = {};
            this.db.libraryView = 'actions';
            const profileNav = Array.from(document.querySelectorAll('.nav-item'))
                .find(btn => (btn.getAttribute('onclick') || '').includes("'profile'"));
            ui.tab('profile', profileNav);
            requestAnimationFrame(() => {
                this.setRoutineView?.('library');
                this.setLibraryView?.('actions', { smooth: false });
                window.scrollTo?.({ top: 0, behavior: 'smooth' });
                document.getElementById('profileContent')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
            });
        },

        focusManualActionInput() {
            const input = document.getElementById('name');
            input?.focus?.();
            input?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
        },

        renderWorkoutPlanToolbar() {
            return `<div class="workout-plan-toolbar">
                <button class="md-btn md-btn-tonal" onclick="data.openRoutineLibraryFromWorkout()" type="button">
                    <span class="material-symbols-rounded">library_books</span> 方案库
                </button>
                <button class="md-btn md-btn-tonal" onclick="data.openActionLibraryFromWorkout()" type="button">
                    <span class="material-symbols-rounded">inventory_2</span> 动作库
                </button>
                <button class="md-btn md-btn-tonal" onclick="data.focusManualActionInput()" type="button">
                    <span class="material-symbols-rounded">add</span> 手动添加
                </button>
                <button class="icon-btn" onclick="weeklyPlan.pickDay(weeklyPlan.todayKey())" type="button" aria-label="绑定今天周计划" title="绑定今天周计划">
                    <span class="material-symbols-rounded">calendar_month</span>
                </button>
            </div>`;
        },

        deleteAction(id) {
            if (!id) return;
            if (!this.softDeleteById(this.db.actions, id)) return;
            this.save();
        },

        renderActions() {
            const list = document.getElementById('currentActionList');
            if (!list) return;
            const planActions = this._planActions();
            if (!planActions.length) {
                list.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">playlist_add</span>
                    <p>还没有动作，添加一个开始吧</p>
                </div>`;
                return;
            }
            const phases = [['warmup','暖身'],['main','正式'],['cooldown','放松']];
            list.innerHTML = phases.map(([key, label]) => {
                const items = this.db.actions.map((a, i) => ({ a, i })).filter(x => !x.a.deleted && !x.a.libOnly && (x.a.phase || 'main') === key);
                if (!items.length) return '';
                return `<div class="action-phase-group"><div class="action-phase-head">${label} · ${items.length}个</div>${items.map(({a, i}) => `
                <div class="list-item">
                    <div class="sort-btns">
                        <button class="sort-btn" onclick="data.move(${i},-1)"><span class="material-symbols-rounded">expand_less</span></button>
                        <button class="sort-btn" onclick="data.move(${i},1)"><span class="material-symbols-rounded">expand_more</span></button>
                    </div>
                    <div style="flex:1;min-width:0">
                        <strong>${this.escapeHtml(a.name || '未命名动作')}</strong>
                        <small>${a.sets}组 &middot; ${a.reps}次 &middot; ${a.work}s</small>
                        <div class="item-chip">组休${a.actionRest}s &middot; 项休${a.groupRest}s${a.isAlt ? ' &middot; 双侧' : ''}</div>
                    </div>
                    <button class="save-lib-btn" onclick="data.savePlanActionToLibrary('${a.id}')" title="存入动作库" aria-label="存入动作库"><span class="material-symbols-rounded">bookmark_add</span></button>
                    <button class="save-lib-btn" onclick="actionHistory.openFor(decodeURIComponent('${encodeURIComponent(a.name || '')}'))" title="查看历史曲线" aria-label="查看历史曲线"><span class="material-symbols-rounded">monitoring</span></button>
                    <button class="delete-btn" onclick="data.deleteAction('${a.id}')"><span class="material-symbols-rounded">delete</span></button>
                </div>`).join('')}</div>`;
            }).join('');
        },

        renderWorkoutPlanCard() {
            const el = document.getElementById('workoutPlanCard');
            if (!el) return;
            const actions = this._planActions();
            const routines = this.activeRecords(this.db.routines);
            const recentRoutines = routines.slice(-3).reverse();
            const actionCount = actions.length;

            const todayBanner = window.weeklyPlan?.renderTodayBanner?.() || '';
            const toolbar = this.renderWorkoutPlanToolbar();

            if (actionCount === 0 && routines.length === 0) {
                el.innerHTML = `
                ${todayBanner}
                <div class="md-card workout-plan-card workout-plan-empty">
                    ${toolbar}
                    <div class="workout-plan-empty-icon">
                        <span class="material-symbols-rounded">fitness_center</span>
                    </div>
                    <div class="workout-plan-empty-text">
                        <strong>还没有动作</strong>
                        <p>使用上方工具条导入方案、打开动作库或手动添加。</p>
                    </div>
                </div>`;
                return;
            }

            if (actionCount === 0 && routines.length > 0) {
                el.innerHTML = `
                ${todayBanner}
                <div class="md-card workout-plan-card workout-plan-import">
                    ${toolbar}
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
                                    <small>${r.actions.length} 个动作 · ${totalSets} 组 · ${this.escapeHtml(r.created || '')}</small>
                                </div>
                                <span class="material-symbols-rounded">upload</span>
                            </div>`;
                        }).join('')}
                    </div>
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
            ${todayBanner}
            <div class="md-card workout-plan-card">
                ${toolbar}
                <div class="workout-plan-head">
                    <div class="workout-plan-info">
                        <span class="cardio-kicker">当前计划</span>
                        <h3>${actionCount} 个动作 · ${totalSets} 组</h3>
                        <small>预计 ${estMinutes} 分钟 · 约 ${totalReps} 次</small>
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

        move(i, d) {
            if (i + d >= 0 && i + d < this.db.actions.length) {
                [this.db.actions[i], this.db.actions[i + d]] = [this.db.actions[i + d], this.db.actions[i]];
                this.touchRecord(this.db.actions[i]);
                this.touchRecord(this.db.actions[i + d]);
                this.save();
            }
        }
    };
})();
