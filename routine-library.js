// @ts-nocheck
(function () {
    window.dataRoutineLibrary = {
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
                isAlt: document.getElementById('isAlt').checked,
                phase: document.getElementById('actionPhase')?.value || 'main',
                tags: [],
                id: this.generateRecordId('action'),
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
        },

        saveRoutine() {
            const nameInput = document.getElementById('newRoutineName');
            const name = nameInput.value.trim();
            if (!name) return alert('请输入方案名称');
            const actions = this.activeRecords(this.db.actions);
            if (actions.length === 0) return alert('请先添加训练动作');
            const tagsInput = document.getElementById('routineTagsInput');
            const tags = tagsInput ? tagsInput.value.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];
            const routine = {
                name,
                actions: JSON.parse(JSON.stringify(actions)).map(a => {
                    const action = this.ensureRecordMeta(a, 'routine-action', Date.now());
                    if (!action.sourceActionId) action.sourceActionId = a.id;
                    return action;
                }),
                tags,
                created: new Date().toLocaleDateString(),
                id: this.generateRecordId('routine'),
                updatedAt: Date.now(),
                deleted: false
            };
            this.db.routines.push(routine);
            nameInput.value = '';
            if (tagsInput) tagsInput.value = '';
            this.save();
            alert('方案 "' + name + '" 已保存');
        },

        loadRoutine(idx) {
            const routines = this.activeRecords(this.db.routines);
            const r = routines[idx];
            if (!r) return;
            const hasActions = this.activeRecords(this.db.actions).length > 0;
            if (!hasActions) {
                this.db.actions = JSON.parse(JSON.stringify(r.actions));
                this.save();
                ui.tab('workout', document.querySelector('.nav-item'));
                return;
            }
            const choice = confirm(`当前已有 ${this.activeRecords(this.db.actions).length} 个动作。\n点"确定"=替换，点"取消"=追加`);
            if (choice) {
                this.db.actions = JSON.parse(JSON.stringify(r.actions));
            } else {
                this.db.actions = this.db.actions.concat(JSON.parse(JSON.stringify(r.actions)));
            }
            this.save();
            ui.tab('workout', document.querySelector('.nav-item'));
        },

        deleteRoutine(idx) {
            const routine = this.activeRecords(this.db.routines)[idx];
            if (!routine) return;
            this.softDeleteById(this.db.routines, routine.id);
            this.save();
        },

        duplicateRoutine(idx) {
            const src = this.activeRecords(this.db.routines)[idx];
            if (!src) return;
            const copy = JSON.parse(JSON.stringify(src));
            copy.name = copy.name + ' (副本)';
            copy.created = new Date().toLocaleDateString();
            copy.id = this.generateRecordId('routine');
            copy.updatedAt = Date.now();
            copy.deleted = false;
            this.db.routines.push(copy);
            this.save();
            this.showWorkoutLibrary();
            this.renderWorkoutPlanCard();
        },

        deleteAction(id) {
            if (!id) return;
            if (!this.softDeleteById(this.db.actions, id)) return;
            this.save();
        },

        renderActions() {
            const list = document.getElementById('currentActionList');
            if (!list) return;
            if (!this.activeRecords(this.db.actions).length) {
                list.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">playlist_add</span>
                    <p>还没有动作，添加一个开始吧</p>
                </div>`;
                return;
            }
            const phases = [['warmup','暖身'],['main','正式'],['cooldown','放松']];
            list.innerHTML = phases.map(([key, label]) => {
                const items = this.db.actions.map((a, i) => ({ a, i })).filter(x => !x.a.deleted && (x.a.phase || 'main') === key);
                if (!items.length) return '';
                return `<div class="action-phase-group"><div class="action-phase-head">${label} · ${items.length}个</div>${items.map(({a, i}) => `
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
                    <button class="delete-btn" onclick="data.deleteAction('${a.id}')"><span class="material-symbols-rounded">delete</span></button>
                </div>`).join('')}</div>`;
            }).join('');
        },

        renderWorkoutPlanCard() {
            const el = document.getElementById('workoutPlanCard');
            if (!el) return;
            const actions = this.activeRecords(this.db.actions);
            const routines = this.activeRecords(this.db.routines);
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

            const routines = this.activeRecords(this.db.routines || []);
            const actions = this.activeRecords(this.db.actions || []);
            const libraryView = this.normalizeLibraryView?.(this.db.libraryView) || 'actions';
            const segment = `<div class="library-segment-wrap" style="margin:0 0 8px">
                <div class="library-segment" role="tablist" aria-label="训练页导入视图">
                    <button class="library-segment-btn ${libraryView === 'actions' ? 'active' : ''}" onclick="data.showWorkoutLibraryPane('actions')" type="button"><span class="material-symbols-rounded">fitness_center</span><span class="library-segment-label">动作库</span></button>
                    <button class="library-segment-btn ${libraryView === 'routines' ? 'active' : ''}" onclick="data.showWorkoutLibraryPane('routines')" type="button"><span class="material-symbols-rounded">bookmark_border</span><span class="library-segment-label">方案库</span></button>
                    <span class="library-segment-indicator ${libraryView === 'routines' ? 'is-routines' : 'is-actions'}" aria-hidden="true"></span>
                </div>
            </div>`;

            if (libraryView === 'actions') {
                if (!actions.length) {
                    el.innerHTML = segment + `
                    <div class="empty-state" style="padding:24px 16px">
                        <span class="material-symbols-rounded">fitness_center</span>
                        <p>动作库为空</p>
                        <small>先在训练页添加动作，或从方案库中保存单个动作</small>
                    </div>`;
                } else {
                    el.innerHTML = segment + `
                    <div class="workout-lib-list">
                        ${actions.map(a => `<div class="workout-lib-item">
                            <div class="workout-lib-item-main" onclick="data.addActionFromLibrary('${a.id}')">
                                <div class="workout-lib-item-info">
                                    <strong>${this.escapeHtml(a.name || '未命名动作')}</strong>
                                    <small>${a.sets || 1}组 · ${a.reps || 1}次 · ${a.work || 5}s${a.isAlt ? ' · 双侧' : ''}</small>
                                </div>
                                <span class="material-symbols-rounded">add</span>
                            </div>
                            <div class="workout-lib-item-actions">
                                <button class="md-btn md-btn-tonal" onclick="event.stopPropagation();data.duplicateActionFromLibrary('${a.id}')" aria-label="复制动作" title="复制动作" style="padding:0;height:28px;min-width:28px">
                                    <span class="material-symbols-rounded" style="font-size:16px">content_copy</span>
                                </button>
                                <button class="delete-btn" onclick="event.stopPropagation();data.deleteActionFromLibrary('${a.id}')" aria-label="删除动作">
                                    <span class="material-symbols-rounded">delete</span>
                                </button>
                            </div>
                        </div>`).join('')}
                    </div>`;
                }
            } else if (!routines.length) {
                el.innerHTML = segment + `
                <div class="empty-state" style="padding:24px 16px">
                    <span class="material-symbols-rounded">bookmark_border</span>
                    <p>方案库为空</p>
                    <small>先在训练页添加动作并存入方案库</small>
                </div>`;
            } else {
                el.innerHTML = segment + `
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
                                <button class="md-btn md-btn-tonal" onclick="event.stopPropagation();data.duplicateRoutine(${i})" aria-label="复制方案" title="复制方案" style="padding:0;height:28px;min-width:28px">
                                    <span class="material-symbols-rounded" style="font-size:16px">content_copy</span>
                                </button>
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

        showWorkoutLibraryPane(view) {
            if (!this.db) this.db = {};
            this.db.libraryView = ['actions', 'routines'].includes(view) ? view : 'actions';
            this.showWorkoutLibrary();
        },

        addActionFromLibrary(actionId) {
            const action = this.findActionById(actionId);
            if (!action || action.deleted) return;
            const copy = JSON.parse(JSON.stringify(action));
            copy.id = this.generateRecordId('action');
            copy.deleted = false;
            copy.updatedAt = Date.now();
            this.db.actions.push(copy);
            this.save();
            this.closeWorkoutLibrary();
            ui.tab('workout', document.querySelector('.nav-item'));
        },

        saveActionFromRoutine(routineId, actionIndex) {
            const routine = this.findRoutineById(routineId);
            if (!routine || routine.deleted) return;
            const source = (routine.actions || [])[actionIndex];
            if (!source) return;
            const copy = JSON.parse(JSON.stringify(source));
            copy.id = this.generateRecordId('action');
            copy.sourceActionId = source.sourceActionId || source.id;
            copy.deleted = false;
            copy.updatedAt = Date.now();
            if (!Array.isArray(copy.tags)) copy.tags = [];
            this.db.actions.push(copy);
            this.save();
            if (window.toast?.show) toast.show(`已保存动作：${copy.name || '未命名动作'}`, 'success');
            this.renderRoutines();
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
            const routine = this.activeRecords(this.db.routines)[idx];
            if (!routine) return;
            if (!confirm('确定删除方案 "' + routine.name + '"？')) return;
            this.deleteRoutine(idx);
            this.showWorkoutLibrary();
            this.renderWorkoutPlanCard();
        },

        renderProfileIdentityCard() {
            const history = this.activeRecords(this.db.history || []);
            const totalSessions = history.length;

            let firstDate = null;
            for (const h of history) {
                const d = this.parseHistoryDate(h.date);
                if (d && (!firstDate || d < firstDate)) firstDate = d;
            }
            const weeksTraining = firstDate
                ? Math.max(1, Math.floor((Date.now() - firstDate.getTime()) / (7 * 86400000)))
                : 0;

            const monday = new Date();
            monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
            monday.setHours(0, 0, 0, 0);

            const weekHistory = history.filter(h => {
                const d = this.parseHistoryDate(h.date);
                return d && d >= monday;
            });
            const weekExerciseLogs = this.activeRecords(this.db.health?.exerciseLogs || []).filter(e => {
                const d = e.date ? this.dateFromKey(e.date) : null;
                return d && d >= monday;
            });
            const cardioTypes = new Set(['walk', 'brisk_walk', 'jog', 'run', 'cycling', 'swim', 'elliptical', 'rowing', 'battle_rope', 'spin_bike', 'cardio']);
            const cardioSessions = weekHistory.filter(h => h.type === 'cardio').length
                + weekExerciseLogs.filter(e => cardioTypes.has(e.type || '')).length;
            const strengthSessions = weekHistory.filter(h => h.type !== 'cardio').length
                + weekExerciseLogs.filter(e => !cardioTypes.has(e.type || '')).length;
            const weekDone = cardioSessions + strengthSessions;
            const weekGoal = Number(this.db.health?.weeklyGoalSessions) || 5;
            const trainPct = Math.min(100, Math.round((weekDone / weekGoal) * 100));

            const goal = this.db.health?.dietGoal;
            const isGain = goal?.goalType === 'gain';
            // weeklyChange/weeklyLoss is stored as magnitude (positive); goalType conveys direction.
            const target = Math.abs(Number(goal?.weeklyChange || goal?.weeklyLoss || 0));
            const targetSigned = isGain ? target : -target;

            // sortedWeights() returns weights sorted ascending (oldest -> newest); enforce explicitly
            // so identity-card weight deltas don't silently flip sign if the helper sort order changes.
            const sortedW = (this.sortedWeights?.() || []).slice().sort(
                (a, b) => this.dateFromKey(a.date) - this.dateFromKey(b.date)
            );
            const weekWeights = sortedW.filter(w => {
                const d = this.dateFromKey(w.date);
                return d && d >= monday;
            });
            let weightDelta = null;
            if (weekWeights.length >= 2) {
                weightDelta = weekWeights[weekWeights.length - 1].weight - weekWeights[0].weight;
            } else if (weekWeights.length === 1) {
                const prev = sortedW.filter(w => this.dateFromKey(w.date) < monday).slice(-1)[0];
                if (prev) weightDelta = weekWeights[0].weight - prev.weight;
            }

            let weightPct = null;
            if (weightDelta !== null && target > 0 && targetSigned !== 0) {
                const towards = Math.max(0, weightDelta / targetSigned);
                weightPct = Math.min(100, Math.round(towards * 100));
            }

            let weightColor = 'neutral';
            if (weightDelta !== null && target > 0) {
                weightColor = (weightDelta * targetSigned >= 0) ? 'positive' : 'negative';
            }

            const weightArrow = weightDelta === null ? ''
                : (weightDelta > 0.05 ? '↑' : weightDelta < -0.05 ? '↓' : '→');
            const weightText = weightDelta === null ? '--'
                : `${weightDelta > 0 ? '+' : ''}${weightDelta.toFixed(1)} kg ${weightArrow}`;
            const goalText = !goal ? '未设目标'
                : `目标 ${isGain ? '+' : '-'}${Math.abs(target).toFixed(1)}/周`;

            const titleText = weeksTraining
                ? `坚持训练 ${weeksTraining} 周`
                : '开启训练之旅';

            return `<div class="md-card identity-card">
                <div class="identity-row">
                    <span class="material-symbols-rounded identity-icon">fitness_center</span>
                    <div class="identity-text">
                        <strong>${titleText}</strong>
                        <small>累计 ${totalSessions} 次</small>
                    </div>
                    <button class="md-btn md-btn-tonal identity-action"
                            onclick="data.setRoutineView('weightloss')" type="button">
                        <span class="material-symbols-rounded">tune</span>
                        调整目标
                    </button>
                </div>
                <div class="identity-metrics">
                    <div class="identity-metric">
                        <div class="identity-metric-head">
                            <span class="material-symbols-rounded">exercise</span>
                            <span>本周训练</span>
                        </div>
                        <b>${weekDone}/${weekGoal} 次</b>
                        <div class="identity-training-split">
                            <span>有氧 <strong>${cardioSessions}</strong></span>
                            <span>无氧/康复 <strong>${strengthSessions}</strong></span>
                        </div>
                        <div class="identity-bar" role="progressbar"
                             aria-valuenow="${trainPct}" aria-valuemin="0" aria-valuemax="100">
                            <i style="width:${trainPct}%"></i>
                        </div>
                    </div>
                    <div class="identity-metric weight-${weightColor}">
                        <div class="identity-metric-head">
                            <span class="material-symbols-rounded">monitor_weight</span>
                            <span>本周体重</span>
                        </div>
                        <b>${weightText}</b>
                        <small>${goalText}</small>
                        ${weightPct !== null
                            ? `<div class="identity-bar" role="progressbar"
                                    aria-valuenow="${weightPct}" aria-valuemin="0" aria-valuemax="100">
                                    <i style="width:${weightPct}%"></i>
                                </div>`
                            : ''}
                    </div>
                </div>
            </div>`;
        },

        renderProfilePage() {
            const overview = document.getElementById('profileOverview');
            const content  = document.getElementById('profileContent');
            const settings = document.getElementById('profileSettings');

            if (overview) overview.innerHTML = this.renderProfileIdentityCard();

            this.routineView = this.normalizeRoutineView?.(this.routineView) || 'library';
            const view = this.routineView;
            const direction = this._routineSwipeDirection || '';
            this._routineSwipeDirection = '';

            const tabs = [
                ['library',    'bookmarks',     '库'],
                ['weightloss', 'trending_down', '目标指导'],
                ['ai',         'psychology',    'AI'],
                ['sync',       'cloud_sync',    '同步'],
            ];
            const tabBar = `<div class="record-tabs profile-tabs" role="tablist" aria-label="我的视图">
                ${tabs.map(([k, i, l]) => `<button class="record-tab ${view === k ? 'active' : ''}" data-routine-view="${k}" onclick="data.setRoutineView('${k}')" type="button" role="tab" aria-selected="${view === k}"><span class="material-symbols-rounded">${i}</span><span class="profile-tab-label">${l}</span></button>`).join('')}
            </div>`;

            if (!content) return;

            const showSettings = view === 'ai' || view === 'sync';
            if (settings) {
                settings.classList.toggle('hidden', !showSettings);
                settings.classList.toggle('profile-view-forward', direction === 'next');
                settings.classList.toggle('profile-view-back', direction === 'prev');
                const aiCard   = settings.querySelector('[data-settings="ai"]');
                const syncCard = settings.querySelector('[data-settings="sync"]');
                aiCard?.classList.toggle('hidden',   view !== 'ai');
                syncCard?.classList.toggle('hidden', view !== 'sync');
            }

            this.bindProfileSwipe?.(content);
            content.classList.remove('hidden');
            content.classList.toggle('profile-view-forward', direction === 'next');
            content.classList.toggle('profile-view-back', direction === 'prev');
            if (view === 'library') {
                content.innerHTML = tabBar + this.renderLibrarySegment() + this.renderLibraryDeck();
                requestAnimationFrame(() => {
                    this.syncLibraryDeckPosition?.(false);
                    this.updateLibraryTabActive?.();
                    this.updateLibrarySwipeEffects?.();
                });
            } else if (view === 'weightloss') {
                content.innerHTML = tabBar + this.renderWeightLossPlanCard();
            } else {
                content.innerHTML = tabBar;
            }
            clearTimeout(this._routineViewAnimationTimer);
            this._routineViewAnimationTimer = setTimeout(() => {
                content.classList.remove('profile-view-forward', 'profile-view-back');
                settings?.classList.remove('profile-view-forward', 'profile-view-back');
            }, 360);
        },

        renderRoutines() {
            this.renderProfilePage();
        },

        normalizeTagText(tag) {
            return String(tag || '').trim();
        },

        collectLibraryTags() {
            const actionTags = this.activeRecords(this.db.actions || []).flatMap(a => Array.isArray(a.tags) ? a.tags : []);
            const routineTags = this.activeRecords(this.db.routines || []).flatMap(r => Array.isArray(r.tags) ? r.tags : []);
            return [...new Set([...actionTags, ...routineTags].map(t => this.normalizeTagText(t)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
        },

        renderLibraryTagChips(tags, activeTag) {
            if (!tags.length) return '';
            return `<div class="library-tag-chips">
                <button class="routine-tag-chip md-btn md-btn-tonal${!activeTag ? ' active' : ''}" onclick="data.setLibraryFilterTag('')" type="button">全部</button>
                ${tags.map(t => `<button class="routine-tag-chip md-btn md-btn-tonal${activeTag===t ? ' active' : ''}" onclick="data.setLibraryFilterTag('${this.escapeHtml(t)}')" type="button">${this.escapeHtml(t)}</button>`).join('')}
            </div>`;
        },

        renderLibrarySegment() {
            const view = this.normalizeLibraryView?.(this.db.libraryView) || 'actions';
            return `<div class="library-segment-wrap">
                <div class="library-segment" role="tablist" aria-label="库视图">
                    <button class="library-segment-btn ${view === 'actions' ? 'active' : ''}" data-library-view="actions" role="tab" aria-selected="${view === 'actions'}" onclick="data.setLibraryView('actions')" type="button"><span class="material-symbols-rounded">fitness_center</span><span class="library-segment-label">动作库</span></button>
                    <button class="library-segment-btn ${view === 'routines' ? 'active' : ''}" data-library-view="routines" role="tab" aria-selected="${view === 'routines'}" onclick="data.setLibraryView('routines')" type="button"><span class="material-symbols-rounded">bookmarks</span><span class="library-segment-label">方案库</span></button>
                    <span class="library-segment-indicator ${view === 'routines' ? 'is-routines' : 'is-actions'}" aria-hidden="true"></span>
                </div>
            </div>`;
        },

        renderLibraryDeck() {
            return `<div id="librarySwipeDeck" class="library-swipe-deck" onscroll="data.onLibraryDeckScroll(this)">
                <section class="library-swipe-page" data-library-page="actions">${this.renderActionLibrary()}</section>
                <section class="library-swipe-page" data-library-page="routines">${this.renderRoutineLibraryPane()}</section>
            </div>`;
        },

        findActionById(actionId) {
            return (this.db.actions || []).find(a => a && a.id === actionId);
        },

        renameActionFromLibrary(actionId) {
            const action = this.findActionById(actionId);
            if (!action || action.deleted) return;
            const next = prompt('动作名称', action.name || '');
            if (next == null) return;
            const name = String(next).trim();
            if (!name) return;
            action.name = name;
            this.touchRecord(action);
            this.save();
            this.renderRoutines();
        },

        editActionFromLibrary(actionId) {
            const action = this.findActionById(actionId);
            if (!action || action.deleted) return;
            const sample = [action.sets || 1, action.reps || 1, action.work || 5, action.repRest || 2, action.actionRest || 10, action.groupRest || 15, action.phase || 'main', action.isAlt ? 1 : 0].join(',');
            const raw = prompt('编辑动作参数：sets,reps,work,repRest,actionRest,groupRest,phase,isAlt(0/1)', sample);
            if (raw == null) return;
            const parts = String(raw).split(',').map(s => s.trim());
            if (parts.length < 8) return alert('参数数量不足');
            action.sets = Math.max(1, parseInt(parts[0], 10) || 1);
            action.reps = Math.max(1, parseInt(parts[1], 10) || 1);
            action.work = Math.max(1, parseInt(parts[2], 10) || 1);
            action.repRest = Math.max(0, parseInt(parts[3], 10) || 0);
            action.actionRest = Math.max(0, parseInt(parts[4], 10) || 0);
            action.groupRest = Math.max(0, parseInt(parts[5], 10) || 0);
            action.phase = ['warmup', 'main', 'cooldown'].includes(parts[6]) ? parts[6] : 'main';
            action.isAlt = parts[7] === '1' || /^true$/i.test(parts[7]);
            this.touchRecord(action);
            this.save();
            this.renderRoutines();
        },

        duplicateActionFromLibrary(actionId) {
            const action = this.findActionById(actionId);
            if (!action || action.deleted) return;
            const copy = JSON.parse(JSON.stringify(action));
            copy.id = this.generateRecordId('action');
            copy.name = `${copy.name || '未命名'} (副本)`;
            copy.deleted = false;
            copy.updatedAt = Date.now();
            this.db.actions.push(copy);
            this.save();
            this.renderRoutines();
        },

        deleteActionFromLibrary(actionId) {
            const action = this.findActionById(actionId);
            if (!action || action.deleted) return;
            const refs = this.countActionReferences?.(actionId, this.activeRecords(this.db.routines || [])) || 0;
            const msg = refs > 0
                ? `${refs} 个方案在使用此动作，确认删除？删除后方案内快照仍保留。`
                : `确定删除动作「${action.name || '未命名'}」？`;
            if (!confirm(msg)) return;
            this.deleteAction(actionId);
            this.renderRoutines();
        },

        editActionTags(actionId) {
            const action = this.findActionById(actionId);
            if (!action || action.deleted) return;
            const current = Array.isArray(action.tags) ? action.tags.join(', ') : '';
            const raw = prompt('动作标签（逗号分隔）', current);
            if (raw == null) return;
            action.tags = [...new Set(String(raw).split(/[,，]/).map(t => this.normalizeTagText(t)).filter(Boolean))];
            this.touchRecord(action);
            this.save();
            this.renderRoutines();
        },

        renderActionLibrary() {
            const actions = this.activeRecords(this.db.actions || []);
            const tags = this.collectLibraryTags();
            const activeTag = this.normalizeTagText(this.db.libraryFilterTag || '');
            const filtered = activeTag ? actions.filter(a => (a.tags || []).includes(activeTag)) : actions;
            if (!actions.length) {
                return `<div class="empty-state"><span class="material-symbols-rounded">fitness_center</span><p>暂无动作</p><small>在训练页添加动作后可在这里管理</small></div>`;
            }
            return `${this.renderLibraryTagChips(tags, activeTag)}
                <div class="library-list action-library-list">
                ${filtered.map(a => `<div class="library-card action-card">
                    <div class="library-card-head">
                        <div style="flex:1;min-width:0">
                            <strong>${this.escapeHtml(a.name || '未命名动作')}</strong>
                            <small>${a.sets || 1}组 × ${a.reps || 1}次 · ${a.work || 5}s · ${a.phase || 'main'}${a.isAlt ? ' · 双侧' : ''}</small>
                            ${Array.isArray(a.tags) && a.tags.length ? `<div class="library-inline-tags">${a.tags.map(t => `<span>${this.escapeHtml(t)}</span>`).join('')}</div>` : ''}
                        </div>
                    </div>
                    <div class="library-card-actions">
                        <button class="md-btn md-btn-tonal" onclick="data.renameActionFromLibrary('${a.id}')" type="button"><span class="material-symbols-rounded">edit</span>改名</button>
                        <button class="md-btn md-btn-tonal" onclick="data.editActionFromLibrary('${a.id}')" type="button"><span class="material-symbols-rounded">tune</span>编辑</button>
                        <button class="md-btn md-btn-tonal" onclick="data.editActionTags('${a.id}')" type="button"><span class="material-symbols-rounded">bookmark_add</span>标签</button>
                        <button class="md-btn md-btn-tonal" onclick="data.duplicateActionFromLibrary('${a.id}')" type="button"><span class="material-symbols-rounded">content_copy</span>复制</button>
                        <button class="md-btn md-btn-tonal" onclick="data.deleteActionFromLibrary('${a.id}')" type="button"><span class="material-symbols-rounded">delete</span>删除</button>
                    </div>
                </div>`).join('')}
                </div>`;
        },

        findRoutineById(routineId) {
            return (this.db.routines || []).find(r => r && r.id === routineId);
        },

        renameRoutineFromLibrary(routineId) {
            const routine = this.findRoutineById(routineId);
            if (!routine || routine.deleted) return;
            const next = prompt('方案名称', routine.name || '');
            if (next == null) return;
            const name = String(next).trim();
            if (!name) return;
            routine.name = name;
            this.touchRecord(routine);
            this.save();
            this.renderRoutines();
        },

        editRoutineTags(routineId) {
            const routine = this.findRoutineById(routineId);
            if (!routine || routine.deleted) return;
            const current = Array.isArray(routine.tags) ? routine.tags.join(', ') : '';
            const raw = prompt('方案标签（逗号分隔）', current);
            if (raw == null) return;
            routine.tags = [...new Set(String(raw).split(/[,，]/).map(t => this.normalizeTagText(t)).filter(Boolean))];
            this.touchRecord(routine);
            this.save();
            this.renderRoutines();
        },

        loadRoutineById(routineId) {
            const routines = this.activeRecords(this.db.routines || []);
            const idx = routines.findIndex(r => r.id === routineId);
            if (idx < 0) return;
            this.loadRoutine(idx);
        },

        duplicateRoutineById(routineId) {
            const routines = this.activeRecords(this.db.routines || []);
            const idx = routines.findIndex(r => r.id === routineId);
            if (idx < 0) return;
            this.duplicateRoutine(idx);
            this.renderRoutines();
        },

        deleteRoutineById(routineId) {
            const routines = this.activeRecords(this.db.routines || []);
            const idx = routines.findIndex(r => r.id === routineId);
            if (idx < 0) return;
            if (!confirm(`确定删除方案 "${routines[idx].name}"？`)) return;
            this.deleteRoutine(idx);
            this.renderRoutines();
        },

        moveRoutineAction(routineId, actionIndex, delta) {
            const routine = this.findRoutineById(routineId);
            if (!routine || routine.deleted) return;
            const list = routine.actions || [];
            const next = actionIndex + delta;
            if (next < 0 || next >= list.length) return;
            [list[actionIndex], list[next]] = [list[next], list[actionIndex]];
            this.touchRecord(routine);
            this.save();
            this.renderRoutines();
        },

        removeRoutineAction(routineId, actionIndex) {
            const routine = this.findRoutineById(routineId);
            if (!routine || routine.deleted) return;
            if (!Array.isArray(routine.actions) || !routine.actions[actionIndex]) return;
            routine.actions.splice(actionIndex, 1);
            this.touchRecord(routine);
            this.save();
            this.renderRoutines();
        },

        replaceRoutineAction(routineId, actionIndex) {
            const routine = this.findRoutineById(routineId);
            if (!routine || routine.deleted) return;
            const actions = this.activeRecords(this.db.actions || []);
            if (!actions.length) return;
            const options = actions.map((a, idx) => `${idx + 1}. ${a.name}`).join('\n');
            const pick = prompt(`输入要替换成的动作序号：\n${options}`, '1');
            if (pick == null) return;
            const idx = Math.max(1, Math.min(actions.length, parseInt(pick, 10) || 1)) - 1;
            const src = JSON.parse(JSON.stringify(actions[idx]));
            src.sourceActionId = src.id;
            routine.actions[actionIndex] = src;
            this.touchRecord(routine);
            this.save();
            this.renderRoutines();
        },

        deriveRoutineFromLibrary(routineId) {
            const routine = this.findRoutineById(routineId);
            if (!routine || routine.deleted) return;
            const name = prompt('新方案名称', `${routine.name || '方案'} (派生)`);
            if (name == null) return;
            const trimmed = String(name).trim();
            if (!trimmed) return;
            const copy = JSON.parse(JSON.stringify(routine));
            copy.name = trimmed;
            copy.id = this.generateRecordId('routine');
            copy.created = new Date().toLocaleDateString();
            copy.updatedAt = Date.now();
            copy.deleted = false;
            this.db.routines.push(copy);
            this.save();
            this.renderRoutines();
        },

        renderRoutineLibraryPane() {
            const routines = this.activeRecords(this.db.routines || []);
            const tags = this.collectLibraryTags();
            const activeTag = this.normalizeTagText(this.db.libraryFilterTag || '');
            const filtered = activeTag ? routines.filter(r => (r.tags || []).includes(activeTag)) : routines;
            if (!routines.length) {
                return `<div class="empty-state"><span class="material-symbols-rounded">bookmark_border</span><p>暂无方案</p><small>在训练页可保存当前计划到方案库</small></div>`;
            }
            return `${this.renderLibraryTagChips(tags, activeTag)}
                <div class="library-list routine-library-list">
                ${filtered.map(r => {
                    const expanded = this.isCollapsed('routine_lib_' + r.id, true) === false;
                    const rtTags = Array.isArray(r.tags) ? r.tags : [];
                    return `<div class="routine-card library-card">
                        <div class="routine-card-head" onclick="data.toggleCollapse('routine_lib_${r.id}')">
                            <div style="flex:1;min-width:0">
                                <strong>${this.escapeHtml(r.name || '未命名方案')}</strong>
                                <small>${(r.actions || []).length}个动作 ${r.created ? '&middot; ' + this.escapeHtml(r.created) : ''}</small>
                                ${rtTags.length ? `<div class="library-inline-tags">${rtTags.map(t => `<span>${this.escapeHtml(t)}</span>`).join('')}</div>` : ''}
                            </div>
                            <span class="routine-expand-icon material-symbols-rounded">${expanded ? 'expand_less' : 'expand_more'}</span>
                        </div>
                        ${expanded ? `<div class="routine-action-list">
                            ${(r.actions || []).map((a, ai) => `<div class="routine-action-item">
                                <span class="routine-action-idx">${ai + 1}</span>
                                <span>${this.escapeHtml(a.name || '未命名动作')}</span>
                                <small>${a.sets || 1}组×${a.reps || 1}次·${a.work || 5}s</small>
                                <div class="routine-inline-actions">
                                    <button class="icon-btn" onclick="event.stopPropagation();data.moveRoutineAction('${r.id}', ${ai}, -1)" type="button" aria-label="上移"><span class="material-symbols-rounded">expand_less</span></button>
                                    <button class="icon-btn" onclick="event.stopPropagation();data.moveRoutineAction('${r.id}', ${ai}, 1)" type="button" aria-label="下移"><span class="material-symbols-rounded">expand_more</span></button>
                                    <button class="icon-btn" onclick="event.stopPropagation();data.replaceRoutineAction('${r.id}', ${ai})" type="button" aria-label="替换"><span class="material-symbols-rounded">swap_horiz</span></button>
                                    <button class="icon-btn" onclick="event.stopPropagation();data.saveActionFromRoutine('${r.id}', ${ai})" type="button" aria-label="保存到动作库"><span class="material-symbols-rounded">bookmark_add</span></button>
                                    <button class="icon-btn" onclick="event.stopPropagation();data.removeRoutineAction('${r.id}', ${ai})" type="button" aria-label="删除"><span class="material-symbols-rounded">delete</span></button>
                                </div>
                            </div>`).join('')}
                            <div class="library-card-actions">
                                <button class="md-btn md-btn-tonal" onclick="event.stopPropagation();data.loadRoutineById('${r.id}')" type="button"><span class="material-symbols-rounded">upload</span>载入</button>
                                <button class="md-btn md-btn-tonal" onclick="event.stopPropagation();data.renameRoutineFromLibrary('${r.id}')" type="button"><span class="material-symbols-rounded">edit</span>改名</button>
                                <button class="md-btn md-btn-tonal" onclick="event.stopPropagation();data.editRoutineTags('${r.id}')" type="button"><span class="material-symbols-rounded">bookmark_add</span>标签</button>
                                <button class="md-btn md-btn-tonal" onclick="event.stopPropagation();data.deriveRoutineFromLibrary('${r.id}')" type="button"><span class="material-symbols-rounded">add_circle</span>派生</button>
                                <button class="md-btn md-btn-tonal" onclick="event.stopPropagation();data.deleteRoutineById('${r.id}')" type="button"><span class="material-symbols-rounded">delete</span>删除</button>
                            </div>
                        </div>` : ''}
                    </div>`;
                }).join('')}
                </div>`;
        },

        renderRoutineLibrary() {
            return this.renderRoutineLibraryPane();
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
