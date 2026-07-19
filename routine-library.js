// @ts-nocheck
(function () {
    window.dataRoutineLibrary = {
        _textPromptModal({
            title,
            icon,
            label,
            placeholder,
            initialValue,
            okText,
            cancelText,
            onOk,
        }) {
            const escVal = (v) => this.escapeHtml(v || '');
            return this._openModal({
                title,
                icon,
                bodyHtml: `
                    <div class="md-field" style="margin:0">
                        <input id="rlPromptInput" type="text" placeholder=" " autocomplete="off" value="${escVal(initialValue)}">
                        <label>${this.escapeHtml(label || '')}</label>
                    </div>
                    ${placeholder ? `<div style="margin-top:6px;color:var(--md-sys-on-surface-variant);font-size:12px">${this.escapeHtml(placeholder)}</div>` : ''}
                `,
                actionsHtml: `
                    <button class="md-btn" type="button" data-modal-close>${this.escapeHtml(cancelText || '取消')}</button>
                    <button class="md-btn md-btn-filled" type="button" data-rl-ok>${this.escapeHtml(okText || '保存')}</button>
                `,
                onMount: (root, close) => {
                    const input = root.querySelector('#rlPromptInput');
                    input?.focus?.();
                    const commit = () => {
                        const val = String(input?.value ?? '').trim();
                        if (!val) return;
                        try {
                            onOk?.(val);
                        } finally {
                            close();
                        }
                    };
                    root.querySelector('[data-rl-ok]')?.addEventListener('click', (e) => {
                        e.preventDefault();
                        commit();
                    });
                    input?.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            commit();
                        }
                    });
                },
            });
        },

        saveRoutine() {
            const nameInput = document.getElementById('newRoutineName');
            const name = nameInput.value.trim();
            if (!name) {
                this._confirmModal({
                    title: '缺少名称',
                    icon: 'info',
                    message: '请输入方案名称。',
                    okText: '知道了',
                    cancelText: '',
                    onOk: () => {
                        try {
                            nameInput?.focus?.();
                        } catch {}
                    },
                });
                return;
            }
            const actions = this._planActions();
            if (actions.length === 0) {
                this._confirmModal({
                    title: '暂无动作',
                    icon: 'fitness_center',
                    message: '请先添加训练动作。',
                    okText: '知道了',
                    cancelText: '',
                });
                return;
            }
            const tagsInput = document.getElementById('routineTagsInput');
            const tags = tagsInput
                ? tagsInput.value
                      .split(/[,，]/)
                      .map((t) => t.trim())
                      .filter(Boolean)
                : [];
            const routine = {
                name,
                actions: JSON.parse(JSON.stringify(actions)).map((a) => {
                    const action = this.ensureRecordMeta(a, 'routine-action', Date.now());
                    if (!action.sourceActionId) action.sourceActionId = a.id;
                    return action;
                }),
                tags,
                created: new Date().toLocaleDateString(),
                id: this.generateRecordId('routine'),
                updatedAt: Date.now(),
                deleted: false,
            };
            this.db.routines.push(routine);
            nameInput.value = '';
            if (tagsInput) tagsInput.value = '';
            this.save();
            window.haptics?.light?.();
            if (window.toast?.show) {
                toast.show(`方案 "${name}" 已保存`, 'success');
            } else {
                this._confirmModal({
                    title: '已保存',
                    icon: 'check_circle',
                    message: `方案 "${name}" 已保存。`,
                    okText: '好的',
                    cancelText: '',
                });
            }
        },

        loadRoutine(idx) {
            const routines = this.activeRecords(this.db.routines);
            const r = routines[idx];
            if (!r) return;
            const hasActions = this._planActions().length > 0;
            if (!hasActions) {
                this._replacePlanActions(r.actions);
                this.save();
                ui.tab('workout', document.querySelector('.nav-item'));
                return;
            }
            const currentCount = this._planActions().length;
            return this._openModal({
                title: '导入方案',
                icon: 'library_books',
                bodyHtml: `
                    <div style="color:var(--md-sys-on-surface-variant);font-size:13px;line-height:1.45">
                        当前已有 <b style="color:var(--md-sys-on-surface)">${currentCount}</b> 个动作。<br>
                        选择导入方式：
                    </div>
                    <div style="margin-top:10px;display:grid;gap:8px">
                        <button class="md-btn md-btn-tonal" type="button" data-rl-import="append">
                            <span class="material-symbols-rounded">add</span> 追加到当前计划
                        </button>
                        <button class="md-btn md-btn-filled" type="button" data-rl-import="replace">
                            <span class="material-symbols-rounded">swap_horiz</span> 替换当前计划
                        </button>
                    </div>
                `,
                actionsHtml: `<button class="md-btn" type="button" data-modal-close>取消</button>`,
                onMount: (root, close) => {
                    const commit = (mode) => {
                        if (mode === 'replace') {
                            this._replacePlanActions(r.actions);
                        } else {
                            this.db.actions = this.db.actions.concat(
                                this._cloneRoutineActionsForPlan(r.actions),
                            );
                        }
                        this.save();
                        close();
                        ui.tab('workout', document.querySelector('.nav-item'));
                    };
                    root.querySelector('[data-rl-import="append"]')?.addEventListener(
                        'click',
                        (e) => {
                            e.preventDefault();
                            commit('append');
                        },
                    );
                    root.querySelector('[data-rl-import="replace"]')?.addEventListener(
                        'click',
                        (e) => {
                            e.preventDefault();
                            commit('replace');
                        },
                    );
                },
            });
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

        savePlanActionToLibrary(id) {
            const action = this.db.actions.find((a) => a.id === id && !a.deleted && !a.libOnly);
            if (!action) return;
            const copy = JSON.parse(JSON.stringify(action));
            copy.id = this.generateRecordId('action');
            copy.libOnly = true;
            copy.updatedAt = Date.now();
            copy.deleted = false;
            this.db.actions.push(copy);
            this.db.libraryView = 'actions';
            this.saveAndBackup?.() || this.save();
            if (window.toast?.show)
                toast.show(`"${copy.name || '未命名动作'}" 已存入动作库`, 'success');
        },

        showWorkoutLibrary() {
            const el = document.getElementById('workoutLibraryContent');
            const sheet = document.getElementById('workoutLibrarySheet');
            if (!el || !sheet) return;

            const routines = this.activeRecords(this.db.routines || []);
            const actions = this.activeRecords(this.db.actions || []);
            const prescriptionActions = this.prescriptionActionCatalog?.() || [];
            const libraryView = this.normalizeLibraryView?.(this.db.libraryView) || 'actions';
            const segment = `<div class="library-segment-wrap" style="margin:0 0 8px">
                <div class="library-segment" role="tablist" aria-label="训练页导入视图">
                    <button class="library-segment-btn ${libraryView === 'actions' ? 'active' : ''}" onclick="data.showWorkoutLibraryPane('actions')" type="button"><span class="material-symbols-rounded">inventory_2</span><span class="library-segment-label">动作库</span></button>
                    <button class="library-segment-btn ${libraryView === 'prescriptionActions' ? 'active' : ''}" onclick="data.showWorkoutLibraryPane('prescriptionActions')" type="button"><span class="material-symbols-rounded">clinical_notes</span><span class="library-segment-label">处方动作</span></button>
                    <button class="library-segment-btn ${libraryView === 'routines' ? 'active' : ''}" onclick="data.showWorkoutLibraryPane('routines')" type="button"><span class="material-symbols-rounded">library_books</span><span class="library-segment-label">方案库</span></button>
                    <span class="library-segment-indicator ${libraryView === 'routines' ? 'is-routines' : libraryView === 'prescriptionActions' ? 'is-prescription-actions' : 'is-actions'}" aria-hidden="true"></span>
                </div>
            </div>`;

            if (libraryView === 'actions') {
                if (!actions.length) {
                    el.innerHTML =
                        segment +
                        `
                    <div class="empty-state" style="padding:24px 16px">
                        <span class="material-symbols-rounded">fitness_center</span>
                        <p>动作库为空</p>
                        <small>先在训练页添加动作，或从方案库中保存单个动作</small>
                    </div>`;
                } else {
                    el.innerHTML =
                        segment +
                        `
                    <div class="workout-lib-list">
                        ${actions
                            .map(
                                (a) => `<div class="workout-lib-item">
                            <div class="workout-lib-item-main" onclick="data.addActionFromLibrary('${a.id}')">
                                <div class="workout-lib-item-info">
                                    <strong>${this.escapeHtml(a.name || '未命名动作')}</strong>
                                    <small>${[`${a.sets || 1}组`, `${a.reps || 1}次`, `${a.work || 5}s`, a.isAlt ? '双侧' : '', this.actionExerciseLogLabel?.(a)].filter(Boolean).join(' · ')}</small>
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
                        </div>`,
                            )
                            .join('')}
                    </div>`;
                }
            } else if (libraryView === 'prescriptionActions') {
                if (!prescriptionActions.length) {
                    el.innerHTML =
                        segment +
                        `
                    <div class="empty-state" style="padding:24px 16px">
                        <span class="material-symbols-rounded">clinical_notes</span>
                        <p>处方动作为空</p>
                        <small>录入康复周处方后会自动出现</small>
                    </div>`;
                } else {
                    el.innerHTML =
                        segment +
                        `
                    <div class="workout-lib-list">
                        ${prescriptionActions
                            .map(
                                (a) => `<div class="workout-lib-item">
                            <div class="workout-lib-item-main" onclick="data.addPrescriptionActionToPlan('${this.escapeHtml(a.id)}')">
                                <div class="workout-lib-item-info prescription-workout-info">
                                    <strong>${this.escapeHtml(a.displayName || '未命名处方动作')}</strong>
                                    <small>${[a.bodyPart || '', a.latestStatus ? this.rehabStatusLabel?.(a.latestStatus) || a.latestStatus : '', a.linkedActionId ? '已关联动作库' : '未关联动作库'].filter(Boolean).join(' · ')}</small>
                                </div>
                                <span class="material-symbols-rounded">add</span>
                            </div>
                        </div>`,
                            )
                            .join('')}
                    </div>`;
                }
            } else if (!routines.length) {
                el.innerHTML =
                    segment +
                    `
                <div class="empty-state" style="padding:24px 16px">
                    <span class="material-symbols-rounded">library_books</span>
                    <p>方案库为空</p>
                    <small>先在训练页添加动作并存入方案库</small>
                </div>`;
            } else {
                el.innerHTML =
                    segment +
                    `
                <div class="workout-lib-list">
                    ${routines
                        .map((r, i) => {
                            const totalSets = r.actions.reduce((s, a) => s + (a.sets || 1), 0);
                            const estMinutes = Math.round(
                                r.actions.reduce((s, a) => {
                                    const workTime = (a.sets || 1) * (a.reps || 1) * (a.work || 5);
                                    const restTime =
                                        ((a.sets || 1) - 1) * (a.repRest || 2) +
                                        (a.actionRest || 10);
                                    return s + workTime + restTime;
                                }, 0) / 60,
                            );
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
                        })
                        .join('')}
                </div>`;
            }

            sheet.classList.remove('hidden');
            sheet.setAttribute('aria-hidden', 'false');
        },

        showWorkoutLibraryPane(view) {
            if (!this.db) this.db = {};
            this.db.libraryView = ['actions', 'prescriptionActions', 'routines'].includes(view)
                ? view
                : 'actions';
            this.showWorkoutLibrary();
        },

        addPrescriptionActionToPlan(actionId) {
            const prescription = this.findPrescriptionActionById?.(actionId);
            if (!prescription) return;
            const linked = prescription.linkedActionId
                ? this.findActionById(prescription.linkedActionId)
                : null;
            const meta =
                window.planPolicy?.actionMetaForName?.(prescription.displayName || '') || {};
            const spec = linked
                ? {
                      sets: linked.sets || 1,
                      reps: linked.reps || 1,
                      work: linked.work || 5,
                      repRest: linked.repRest || 0,
                      actionRest: linked.actionRest || 30,
                      isAlt: !!linked.isAlt,
                      mode: linked.mode || (linked.isAlt ? 'alt-reps' : 'reps'),
                  }
                : prescription.defaultSpec || {
                      sets: 2,
                      reps: 10,
                      work: 3,
                      repRest: 0,
                      actionRest: 30,
                      isAlt: false,
                      mode: 'reps',
                  };
            const action = {
                id: this.generateRecordId('action'),
                name: prescription.displayName || linked?.name || '处方动作',
                sets: Math.max(1, Number(spec.sets || 1)),
                reps: Math.max(0, Number(spec.reps || 0)),
                work: Math.max(1, Number(spec.work || 3)),
                repRest: Math.max(0, Number(spec.repRest || 0)),
                actionRest: Math.max(0, Number(spec.actionRest || 30)),
                groupRest: linked?.groupRest || 15,
                phase: linked?.phase || 'main',
                category: linked?.category || prescription.category || '',
                bodyPart: linked?.bodyPart || prescription.bodyPart || '',
                isAlt: !!spec.isAlt,
                libOnly: false,
                deleted: false,
                updatedAt: Date.now(),
                sourceActionId: linked?.id || '',
                prescriptionActionId: prescription.id,
                actionKey: meta.actionKey || '',
                canonicalName: prescription.displayName || meta.canonicalName || '',
                progressionGroup: prescription.progressionGroup || meta.progressionGroup || '',
                progressionLevel: Number(
                    prescription.progressionLevel || meta.progressionLevel || 0,
                ),
                chainId: meta.chainId || '',
            };
            this.db.actions.push(action);
            this.save();
            this.closeWorkoutLibrary();
            ui.tab('workout', document.querySelector('.nav-item'));
        },

        addActionFromLibrary(actionId) {
            const action = this.findActionById(actionId);
            if (!action || action.deleted) return;
            const copy = JSON.parse(JSON.stringify(action));
            copy.id = this.generateRecordId('action');
            copy.libOnly = false;
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
            copy.libOnly = true;
            copy.deleted = false;
            copy.updatedAt = Date.now();
            if (!Array.isArray(copy.tags)) copy.tags = [];
            this.db.actions.push(copy);
            this.db.libraryView = 'actions';
            this.saveAndBackup?.() || this.save();
            if (window.toast?.show)
                toast.show(`已保存动作：${copy.name || '未命名动作'}`, 'success');
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
            this._confirmModal({
                title: '删除方案',
                icon: 'delete',
                message: `确定删除方案 "${routine.name || '未命名方案'}"？`,
                okText: '删除',
                cancelText: '取消',
                danger: true,
                onOk: () => {
                    this.deleteRoutine(idx);
                    this.showWorkoutLibrary();
                    this.renderWorkoutPlanCard();
                },
            });
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

            const weekStart = new Date();
            weekStart.setHours(0, 0, 0, 0);
            weekStart.setDate(weekStart.getDate() - 6);

            const weekHistory = history.filter((h) => {
                const d = this.parseHistoryDate(h.date);
                return d && d >= weekStart;
            });
            const weekExerciseLogs = this.activeRecords(this.db.health?.exerciseLogs || []).filter(
                (e) => {
                    const d = e.date ? this.dateFromKey(e.date) : null;
                    return d && d >= weekStart;
                },
            );
            const cardioTypes = new Set([
                'walk',
                'brisk_walk',
                'jog',
                'run',
                'cycling',
                'swim',
                'elliptical',
                'rowing',
                'battle_rope',
                'spin_bike',
                'cardio',
            ]);
            const cardioSessions =
                weekHistory.filter((h) => h.type === 'cardio').length +
                weekExerciseLogs.filter((e) => cardioTypes.has(e.type || '')).length;
            const strengthSessions =
                weekHistory.filter((h) => h.type !== 'cardio').length +
                weekExerciseLogs.filter((e) => !cardioTypes.has(e.type || '')).length;
            const weekDone = cardioSessions + strengthSessions;
            const weekGoal = Number(this.db.health?.weeklyGoalSessions) || 5;
            const trainPct = Math.min(100, Math.round((weekDone / weekGoal) * 100));

            const goal = this.db.health?.dietGoal;
            const isGain = goal?.goalType === 'gain';
            // weeklyChange/weeklyLoss is stored as magnitude (positive); goalType conveys direction.
            const target = Math.abs(Number(isGain ? goal?.weeklyChange : goal?.weeklyLoss) || 0);
            const targetSigned = isGain ? target : -target;

            // sortedWeights() returns weights sorted ascending (oldest -> newest); enforce explicitly
            // so identity-card weight deltas don't silently flip sign if the helper sort order changes.
            const sortedW = (this.sortedWeights?.() || [])
                .slice()
                .sort((a, b) => this.dateFromKey(a.date) - this.dateFromKey(b.date));
            const weekWeights = sortedW.filter((w) => {
                const d = this.dateFromKey(w.date);
                return d && d >= weekStart;
            });
            let weightDelta = null;
            if (weekWeights.length >= 2) {
                const head = weekWeights.slice(0, 2);
                const tail = weekWeights.slice(-2);
                const avg = (list) => list.reduce((sum, w) => sum + w.weight, 0) / list.length;
                weightDelta = avg(tail) - avg(head);
            } else if (weekWeights.length === 1) {
                const twoWeeksAgo = new Date(weekStart);
                twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 7);
                const prev = sortedW.find((w) => {
                    const d = this.dateFromKey(w.date);
                    return d && d >= twoWeeksAgo && d < weekStart;
                });
                if (prev) weightDelta = weekWeights[0].weight - prev.weight;
            }

            let weightPct = null;
            if (weightDelta !== null && target > 0 && targetSigned !== 0) {
                const earliestDate = weekWeights[0]?.date
                    ? this.dateFromKey(weekWeights[0].date)
                    : null;
                const elapsedDays = earliestDate
                    ? Math.min(
                          7,
                          Math.max(1, Math.ceil((Date.now() - earliestDate.getTime()) / 86400000)),
                      )
                    : 7;
                const proRatedTarget = targetSigned * (elapsedDays / 7);
                const towards = Math.max(0, weightDelta / proRatedTarget);
                weightPct = Math.min(100, Math.round(towards * 100));
            }

            let weightColor = 'neutral';
            if (weightDelta !== null && target > 0) {
                weightColor = weightDelta * targetSigned >= 0 ? 'positive' : 'negative';
            }

            const weightArrow =
                weightDelta === null
                    ? ''
                    : weightDelta > 0.1
                      ? '↑'
                      : weightDelta < -0.1
                        ? '↓'
                        : '→';
            const weightText =
                weightDelta === null
                    ? '--'
                    : `${weightDelta > 0 ? '+' : ''}${weightDelta.toFixed(2)} kg ${weightArrow}`;
            const goalText = !goal
                ? '未设目标'
                : `目标 ${isGain ? '+' : '-'}${Math.abs(target).toFixed(1)}/周`;

            const titleText = weeksTraining ? `坚持训练 ${weeksTraining} 周` : '开启训练之旅';

            const latestWeight = sortedW.length ? sortedW[sortedW.length - 1] : null;
            const height = this.db.profile?.height || '';
            const goalWeight = goal?.targetWeight || '';
            const profileSubtitle = goalWeight
                ? `${height ? '身高 ' + height + ' cm · ' : ''}目标体重 ${goalWeight} kg`
                : titleText;

            return `<div class="profile-hero">
                <div class="profile-hero-main">
                    <div class="avatar"><span class="material-symbols-rounded">monitoring</span></div>
                    <div class="profile-info">
                        <h2>训练档案</h2>
                        <small>${this.escapeHtml(profileSubtitle)}</small>
                    </div>
                </div>
                <div class="profile-stats">
                    <div class="ps-item"><b>${latestWeight ? Number(latestWeight.weight).toFixed(2) : '--'}</b><small>kg 当前</small></div>
                    <div class="ps-item"><b>${weightDelta !== null ? (weightDelta > 0 ? '+' : '') + weightDelta.toFixed(2) : '--'}</b><small>kg 7天</small></div>
                    <div class="ps-item"><b>${weekDone}/${weekGoal}</b><small>次/周</small></div>
                    <div class="ps-item"><b>${totalSessions}</b><small>累计</small></div>
                </div>
            </div>`;
        },

        renderProfilePage() {
            const overview = document.getElementById('profileOverview');
            const content = document.getElementById('profileContent');
            const settings = document.getElementById('profileSettings');

            this.routineView = this.normalizeRoutineView?.(this.routineView) || 'home';
            const view = this.routineView;
            const direction = this._routineSwipeDirection || '';
            this._routineSwipeDirection = '';

            if (overview) {
                overview.innerHTML =
                    view === 'home'
                        ? this.renderProfileIdentityCard() + this.renderProfileV6Cards()
                        : '';
                overview.classList.toggle('hidden', view !== 'home');
                if (view === 'home') {
                    Promise.resolve().then(() => this.refreshSwCacheName?.());
                }
            }

            if (!content) return;

            const showSettings = view === 'ai' || view === 'sync' || view === 'experiments';
            const showContent = view === 'library' || view === 'weightloss';
            if (settings) {
                settings.classList.toggle('hidden', !showSettings);
                const aiCard = settings.querySelector('[data-settings="ai"]');
                const syncCard = settings.querySelector('[data-settings="sync"]');
                const expCard = settings.querySelector('[data-settings="experiments"]');
                aiCard?.classList.toggle('hidden', view !== 'ai');
                syncCard?.classList.toggle('hidden', view !== 'sync');
                expCard?.classList.toggle('hidden', view !== 'experiments');
                settings.querySelectorAll('.profile-v6-back-row').forEach((el) => el.remove());
            }

            this.bindProfileSwipe?.(content);
            content.classList.toggle('hidden', !showContent);
            if (showContent) {
                const pageTitle = view === 'weightloss' ? '目标指导' : '方案 / 动作库';
                const backBtn = `<div class="profile-v6-back-row"><button class="profile-v6-back-btn" onclick="data.setRoutineView('home');data.renderProfilePage?.()" type="button" aria-label="返回"><span class="material-symbols-rounded">arrow_back</span></button><strong class="profile-v6-back-title">${pageTitle}</strong></div>`;
                if (view === 'library') {
                    content.innerHTML =
                        backBtn +
                        (this.renderPlanEquipmentCard?.() || '') +
                        this.renderLibrarySegment() +
                        this.renderLibraryDeck();
                    this.bindLibraryActions?.(content);
                    requestAnimationFrame(() => {
                        this.syncLibraryDeckPosition?.(false);
                        this.updateLibraryTabActive?.();
                        this.updateLibrarySwipeEffects?.();
                    });
                } else if (view === 'weightloss') {
                    content.innerHTML = backBtn + this.renderWeightLossPlanCard();
                }
            }
            if (showSettings) {
                const settingTitle =
                    view === 'ai' ? 'AI 设置' : view === 'sync' ? '云端同步' : '实验功能';
                const backBtn = `<div class="profile-v6-back-row"><button class="profile-v6-back-btn" onclick="data.setRoutineView('home');data.renderProfilePage?.()" type="button" aria-label="返回"><span class="material-symbols-rounded">arrow_back</span></button><strong class="profile-v6-back-title">${settingTitle}</strong></div>`;
                settings.insertAdjacentHTML('afterbegin', backBtn);
                this.syncExperimentSettingsUi?.();
            }
            clearTimeout(this._routineViewAnimationTimer);
            this._routineViewAnimationTimer = setTimeout(() => {
                content.classList.remove('profile-view-forward', 'profile-view-back');
                settings?.classList.remove('profile-view-forward', 'profile-view-back');
            }, 360);
        },

        bindLibraryActions(root) {
            if (!root || root.dataset.libraryActionsBound === '1') return;
            root.dataset.libraryActionsBound = '1';
            root.addEventListener('click', (event) => {
                const btn = event.target?.closest?.('[data-rl-action]');
                if (!btn || !root.contains(btn)) return;
                const action = btn.getAttribute('data-rl-action') || '';
                const routineId = btn.getAttribute('data-routine-id') || '';
                const actionIndex = Number(btn.getAttribute('data-action-index') || 0);

                event.preventDefault();
                if (action !== 'toggle-routine-collapse') event.stopPropagation();

                if (action === 'set-library-tag')
                    this.setLibraryFilterTag(btn.getAttribute('data-library-tag') || '');
                else if (action === 'toggle-routine-collapse')
                    this.toggleCollapse('routine_lib_' + routineId);
                else if (action === 'move-routine-action')
                    this.moveRoutineAction(
                        routineId,
                        actionIndex,
                        Number(btn.getAttribute('data-direction') || 0),
                    );
                else if (action === 'save-action-from-routine')
                    this.saveActionFromRoutine(routineId, actionIndex);
                else if (action === 'remove-routine-action')
                    this.removeRoutineAction(routineId, actionIndex);
                else if (action === 'load-routine') this.loadRoutineById(routineId);
                else if (action === 'rename-routine') this.renameRoutineFromLibrary(routineId);
                else if (action === 'edit-routine-tags') this.editRoutineTags(routineId);
                else if (action === 'derive-routine') this.deriveRoutineFromLibrary(routineId);
                else if (action === 'delete-routine') this.deleteRoutineById(routineId);
            });
        },

        renderProfileV6Cards() {
            const goal = this.db.health?.dietGoal;
            const goalType = goal?.goalType || this.db.health?.goalType || 'loss';
            const goalLabel =
                goalType === 'gain' ? '增肌' : goalType === 'maintain' ? '维持体重' : '减脂';
            const goalCal = goal?.dailyCal || 0;
            return `<div class="sect-head"><span class="t">设置</span></div>
            <div class="glass-card setting-list">
                <div class="setting-row" onclick="data.setRoutineView('ai')" role="button" tabindex="0">
                    <span class="material-symbols-rounded ico">psychology</span>
                    <div class="copy"><strong>AI 设置</strong><small>模型 / API Key</small></div>
                    <span class="material-symbols-rounded arrow">chevron_right</span>
                </div>
                <div class="setting-row" onclick="data.setRoutineView('sync')" role="button" tabindex="0">
                    <span class="material-symbols-rounded ico">cloud_sync</span>
                    <div class="copy"><strong>云端同步</strong><small>S3 / WebDAV</small></div>
                    <span class="material-symbols-rounded arrow">chevron_right</span>
                </div>
                <div class="setting-row" onclick="data.setRoutineView('experiments')" role="button" tabindex="0">
                    <span class="material-symbols-rounded ico">science</span>
                    <div class="copy"><strong>实验功能</strong><small>小米体重秤网页读取等不稳定能力</small></div>
                    <span class="material-symbols-rounded arrow">chevron_right</span>
                </div>
                <div class="setting-row" onclick="data.setRoutineView('weightloss')" role="button" tabindex="0">
                    <span class="material-symbols-rounded ico">flag</span>
                    <div class="copy"><strong>目标 &amp; 体型</strong><small>${this.escapeHtml(goalLabel)}${goalCal ? ' · ' + goalCal + ' kcal/日' : ''}</small></div>
                    <span class="material-symbols-rounded arrow">chevron_right</span>
                </div>
                <div class="setting-row" onclick="data.setRoutineView('library')" role="button" tabindex="0">
                    <span class="material-symbols-rounded ico">library_books</span>
                    <div class="copy"><strong>方案 / 动作库</strong><small>自定义动作与计划</small></div>
                    <span class="material-symbols-rounded arrow">chevron_right</span>
                </div>
                <div class="setting-row" onclick="data.toggleDebugTools?.()" role="button" tabindex="0">
                    <span class="material-symbols-rounded ico">bug_report</span>
                    <div class="copy"><strong>调试工具</strong><small>${this._debugToolsEnabled ? '已启用 · 全局错误 / console / 网络 / 导航 / 布局变化' : '点击启用全局诊断'}</small></div>
                    <span class="material-symbols-rounded arrow">chevron_right</span>
                </div>
            </div>
            ${this.renderProfileVersionFooter ? this.renderProfileVersionFooter() : ''}`;
        },

        renderProfileVersionFooter() {
            const version = this.detectAppVersion?.() || '';
            const cache =
                typeof caches !== 'undefined' && this._cachedSwName ? this._cachedSwName : '';
            const sub = cache
                ? `Service Worker · ${this.escapeHtml(cache)}`
                : 'Service Worker · (未注册)';
            const checking = !!window.appUpdate?.checking;
            const unsupported = typeof navigator === 'undefined' || !('serviceWorker' in navigator);
            return `<div class="profile-version-footer" id="profileVersionFooter">
                <div class="pvf-title">版本 ${this.escapeHtml(version || '--')}</div>
                <div class="pvf-sub">${sub}</div>
                <div class="pvf-actions">
                    <button type="button" class="pvf-action pvf-check" id="profileUpdateCheckBtn" onclick="data.checkAppUpdate?.()" ${checking || unsupported ? 'disabled' : ''}>
                        <span class="material-symbols-rounded">system_update</span><span class="pvf-check-label">${checking ? '检测中...' : '检测更新'}</span>
                    </button>
                    <button type="button" class="pvf-action pvf-copy" onclick="data.copyAppVersionInfo?.()">复制版本信息</button>
                </div>
            </div>`;
        },

        detectAppVersion() {
            // Read the ?v=N param from any of the cache-busted asset tags Kilo emits in index.html.
            try {
                const node = document.querySelector('script[src*="?v="], link[href*="?v="]');
                const src = node?.getAttribute('src') || node?.getAttribute('href') || '';
                const m = src.match(/[?&]v=([^&"'\s]+)/);
                if (m) return 'v' + m[1];
            } catch {}
            return '';
        },

        async refreshSwCacheName() {
            if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
            try {
                const reg = await navigator.serviceWorker.getRegistration();
                if (!reg) return;
                if (typeof caches !== 'undefined') {
                    const names = await caches.keys();
                    const main = names.find((n) => /training-assistant-/.test(n)) || names[0] || '';
                    if (main && main !== this._cachedSwName) {
                        this._cachedSwName = main;
                        const footer = document.getElementById('profileVersionFooter');
                        if (footer) footer.outerHTML = this.renderProfileVersionFooter();
                    }
                }
            } catch {}
        },

        copyAppVersionInfo() {
            const version = this.detectAppVersion?.() || '--';
            const cache = this._cachedSwName || '(unknown)';
            const ua = navigator.userAgent || '';
            const text = `app=${version}\nsw-cache=${cache}\nua=${ua}\ntime=${new Date().toISOString()}`;
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
                if (typeof toast?.show === 'function') toast.show('已复制版本信息');
            } catch (e) {
                if (typeof toast?.show === 'function')
                    toast.show('复制失败：' + e.message, 'error');
            }
        },

        renderRoutines() {
            this.renderProfilePage();
        },

        normalizeTagText(tag) {
            return String(tag || '').trim();
        },

        collectLibraryTags() {
            const actionTags = this.activeRecords(this.db.actions || []).flatMap((a) =>
                Array.isArray(a.tags) ? a.tags : [],
            );
            const routineTags = this.activeRecords(this.db.routines || []).flatMap((r) =>
                Array.isArray(r.tags) ? r.tags : [],
            );
            return [
                ...new Set(
                    [...actionTags, ...routineTags]
                        .map((t) => this.normalizeTagText(t))
                        .filter(Boolean),
                ),
            ].sort((a, b) => a.localeCompare(b, 'zh-CN'));
        },

        renderLibraryTagChips(tags, activeTag) {
            if (!tags.length) return '';
            return `<div class="library-tag-chips">
                <button class="routine-tag-chip md-btn md-btn-tonal${!activeTag ? ' active' : ''}" data-rl-action="set-library-tag" data-library-tag="" type="button">全部</button>
                ${tags.map((t) => `<button class="routine-tag-chip md-btn md-btn-tonal${activeTag === t ? ' active' : ''}" data-rl-action="set-library-tag" data-library-tag="${this.escapeHtml(t)}" type="button">${this.escapeHtml(t)}</button>`).join('')}
            </div>`;
        },

        renderLibrarySegment() {
            const view = this.normalizeLibraryView?.(this.db.libraryView) || 'actions';
            return `<div class="library-segment-wrap">
                <div class="library-segment" role="tablist" aria-label="库视图">
                    <button class="library-segment-btn ${view === 'actions' ? 'active' : ''}" data-library-view="actions" role="tab" aria-selected="${view === 'actions'}" onclick="data.setLibraryView('actions')" type="button"><span class="material-symbols-rounded">inventory_2</span><span class="library-segment-label">动作库</span></button>
                    <button class="library-segment-btn ${view === 'prescriptionActions' ? 'active' : ''}" data-library-view="prescriptionActions" role="tab" aria-selected="${view === 'prescriptionActions'}" onclick="data.setLibraryView('prescriptionActions')" type="button"><span class="material-symbols-rounded">clinical_notes</span><span class="library-segment-label">处方动作</span></button>
                    <button class="library-segment-btn ${view === 'routines' ? 'active' : ''}" data-library-view="routines" role="tab" aria-selected="${view === 'routines'}" onclick="data.setLibraryView('routines')" type="button"><span class="material-symbols-rounded">library_books</span><span class="library-segment-label">方案库</span></button>
                    <span class="library-segment-indicator ${view === 'routines' ? 'is-routines' : view === 'prescriptionActions' ? 'is-prescription-actions' : 'is-actions'}" aria-hidden="true"></span>
                </div>
            </div>`;
        },

        renderLibraryDeck() {
            return `<div id="librarySwipeDeck" class="library-swipe-deck" onscroll="data.onLibraryDeckScroll(this)">
                <section class="library-swipe-page" data-library-page="actions">${this.renderActionLibrary()}</section>
                <section class="library-swipe-page" data-library-page="prescriptionActions">${this.renderPrescriptionActionLibrary()}</section>
                <section class="library-swipe-page" data-library-page="routines">${this.renderRoutineLibraryPane()}</section>
            </div>`;
        },

        findActionById(actionId) {
            return (this.db.actions || []).find((a) => a && a.id === actionId);
        },

        exerciseLibraryActions(kind = '') {
            return this.activeRecords(this.db.actions || []).filter((action) => {
                if (!action || action.libOnly !== true || !action.exerciseLogEnabled) return false;
                const category = this.normalizeActionCategory(action.category);
                if (kind === 'cardio') return category === 'cardio' && Number(action.met || 0) > 0;
                if (kind === 'strength') return category !== 'cardio';
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

        actionCategoryOptions() {
            return [
                ['training', '训练'],
                ['stretch', '拉伸'],
                ['mobility', '活动度'],
                ['warmup', '热身'],
                ['recovery', '恢复'],
                ['cardio', '有氧'],
                ['other', '其他'],
            ];
        },

        normalizeActionCategory(value = '') {
            const raw = String(value || '')
                .trim()
                .toLowerCase();
            const map = {
                train: 'training',
                strength: 'training',
                main: 'training',
                训练: 'training',
                力量: 'training',
                stretch: 'stretch',
                cooldown: 'stretch',
                拉伸: 'stretch',
                放松: 'stretch',
                mobility: 'mobility',
                活动度: 'mobility',
                灵活性: 'mobility',
                warmup: 'warmup',
                热身: 'warmup',
                recovery: 'recovery',
                rehab: 'recovery',
                恢复: 'recovery',
                康复: 'recovery',
                cardio: 'cardio',
                有氧: 'cardio',
            };
            return (
                map[raw] || (this.actionCategoryOptions().some(([key]) => key === raw) ? raw : '')
            );
        },

        actionCategoryLabel(value = '') {
            const normalized = this.normalizeActionCategory(value);
            return this.actionCategoryOptions().find(([key]) => key === normalized)?.[1] || '';
        },

        actionExerciseLogLabel(action = {}) {
            if (!action.exerciseLogEnabled) return '';
            const category = this.normalizeActionCategory(action.category);
            const met = Number(action.met || 0);
            return category === 'cardio' && met > 0 ? `可记运动 · ${met} MET` : '可记运动';
        },

        renderActionCategoryOptions(value = '') {
            const current = this.normalizeActionCategory(value);
            return `<option value="">未分类</option>${this.actionCategoryOptions()
                .map(
                    ([key, label]) =>
                        `<option value="${this.escapeHtml(key)}" ${current === key ? 'selected' : ''}>${this.escapeHtml(label)}</option>`,
                )
                .join('')}`;
        },

        ensurePrescriptionActionLibrary() {
            this.db.health = this.db.health || {};
            if (window.actionIdentity?.ensurePrescriptionActionCatalog) {
                window.actionIdentity.ensurePrescriptionActionCatalog(this.db);
            }
            this.db.health.prescriptionActions = Array.isArray(this.db.health.prescriptionActions)
                ? this.db.health.prescriptionActions
                : [];
            return this.activeRecords(this.db.health.prescriptionActions || []);
        },

        prescriptionActionCatalog() {
            this.ensurePrescriptionActionLibrary();
            return (
                window.actionIdentity?.getPrescriptionActionCatalog?.(this.db) ||
                this.activeRecords(this.db.health?.prescriptionActions || [])
            );
        },

        findPrescriptionActionById(actionId) {
            return this.prescriptionActionCatalog().find((item) => item.id === actionId) || null;
        },

        prescriptionActionSearchText(action = {}) {
            return [
                action.displayName,
                action.name,
                ...(action.aliases || []),
                action.category,
                this.actionCategoryLabel?.(action.category),
                action.bodyPart,
                action.conditionLabel,
                action.notes,
            ]
                .map((value) => String(value || '').trim())
                .filter(Boolean)
                .join(' ');
        },

        filterPrescriptionActions(query = '') {
            const needle = String(query || this.db.prescriptionActionSearch || '')
                .trim()
                .toLowerCase();
            const normalized =
                window.actionIdentity?.normalizePrescriptionActionName?.(needle) || needle;
            return this.prescriptionActionCatalog().filter((action) => {
                if (!needle) return true;
                const text = this.prescriptionActionSearchText(action).toLowerCase();
                const compact =
                    window.actionIdentity?.normalizePrescriptionActionName?.(text) || text;
                return text.includes(needle) || compact.includes(normalized);
            });
        },

        setPrescriptionActionSearch(value = '') {
            this.db.prescriptionActionSearch = String(value || '').trim();
            this.save?.({ render: false });
            this.renderRoutines();
        },

        filterPrescriptionActionLibraryInput(value = '') {
            this.db.prescriptionActionSearch = String(value || '').trim();
            const list = document.querySelector('.prescription-action-list');
            if (!list) return;
            const needle = this.db.prescriptionActionSearch.toLowerCase();
            const normalized =
                window.actionIdentity?.normalizePrescriptionActionName?.(needle) || needle;
            list.querySelectorAll('[data-prescription-search-text]').forEach((card) => {
                const text = String(
                    card.getAttribute('data-prescription-search-text') || '',
                ).toLowerCase();
                const compact =
                    window.actionIdentity?.normalizePrescriptionActionName?.(text) || text;
                card.hidden = !!needle && !text.includes(needle) && !compact.includes(normalized);
            });
        },

        applyPrescriptionActionSearch() {
            const input = document.getElementById('prescriptionActionSearch');
            this.setPrescriptionActionSearch(input ? input.value : '');
        },

        renderPrescriptionActionLibrary() {
            const actions = this.prescriptionActionCatalog();
            const query = String(this.db.prescriptionActionSearch || '');
            const filtered = this.filterPrescriptionActions(query);
            if (!actions.length) {
                return `<div class="empty-state"><span class="material-symbols-rounded">clinical_notes</span><p>暂无处方动作</p><small>录入康复周处方后会自动生成标准动作</small></div>`;
            }
            const esc = (value) => this.escapeHtml(value || '');
            return `<div class="prescription-library-toolbar">
                    <div class="md-field prescription-search-field"><input id="prescriptionActionSearch" type="search" value="${esc(query)}" placeholder=" " onfocus="data.filterPrescriptionActionLibraryInput(this.value)" onclick="data.filterPrescriptionActionLibraryInput(this.value)" oninput="data.filterPrescriptionActionLibraryInput(this.value)" onkeydown="if(event.key==='Enter')data.setPrescriptionActionSearch(this.value)"><label>搜索处方动作</label></div>
                    <button class="md-icon-btn" type="button" onclick="data.applyPrescriptionActionSearch()" aria-label="搜索"><span class="material-symbols-rounded">search</span></button>
                    <button class="md-icon-btn" type="button" onclick="data.openAddPrescriptionActionModal()" aria-label="添加合并动作"><span class="material-symbols-rounded">add</span></button>
                    <button class="md-btn md-btn-tonal" type="button" onclick="data.openPrescriptionMergeModal()"><span class="material-symbols-rounded">compare_arrows</span>合并</button>
                </div>
                <div class="library-list prescription-action-list">
                    ${filtered
                        .map((action) => {
                            const linked = action.linkedActionId
                                ? this.findActionById(action.linkedActionId)
                                : null;
                            const relationCount =
                                (action.progressionIds || []).length +
                                (action.regressionIds || []).length;
                            const aliasCount = Math.max(0, (action.aliases || []).length - 1);
                            return `<div class="library-card prescription-action-card" data-prescription-search-text="${esc(this.prescriptionActionSearchText(action).toLowerCase())}">
                            <label class="prescription-merge-check"><input type="checkbox" data-prescription-merge-id="${esc(action.id)}"><span></span></label>
                            <button class="prescription-action-main" type="button" onclick="data.openPrescriptionActionDetail('${esc(action.id)}')">
                                <strong>${esc(action.displayName || action.name || '未命名处方动作')}</strong>
                                <small>${
                                    [
                                        this.actionCategoryLabel?.(action.category) || '',
                                        action.bodyPart || '',
                                        action.latestStatus
                                            ? this.rehabStatusLabel?.(action.latestStatus) ||
                                              action.latestStatus
                                            : '',
                                        linked ? `关联：${linked.name || '普通动作'}` : '',
                                        relationCount ? `${relationCount} 个进退阶` : '',
                                        aliasCount ? `${aliasCount} 个别名` : '',
                                    ]
                                        .filter(Boolean)
                                        .join(' · ') || '点开编辑标准名、关联和进退阶'
                                }</small>
                            </button>
                        </div>`;
                        })
                        .join('')}
                </div>`;
        },

        openAddPrescriptionActionModal() {
            return this._openModal({
                title: '添加处方动作',
                icon: 'add',
                bodyHtml: `<div class="md-field"><input id="prescriptionNewName" type="text" placeholder=" "><label>标准动作名</label></div>`,
                actionsHtml: `<button class="md-btn" type="button" data-modal-close>取消</button><button class="md-btn md-btn-filled" type="button" data-save-prescription-action>添加</button>`,
                onMount: (root, close) => {
                    const input = root.querySelector('#prescriptionNewName');
                    input?.focus?.();
                    root.querySelector('[data-save-prescription-action]')?.addEventListener(
                        'click',
                        (event) => {
                            event.preventDefault();
                            const name = String(input?.value || '').trim();
                            if (!name) return;
                            const nowTs = Date.now();
                            this.db.health = this.db.health || {};
                            this.db.health.prescriptionActions = Array.isArray(
                                this.db.health.prescriptionActions,
                            )
                                ? this.db.health.prescriptionActions
                                : [];
                            const existing = this.prescriptionActionCatalog().find(
                                (item) =>
                                    window.actionIdentity?.normalizePrescriptionActionName?.(
                                        item.displayName,
                                    ) ===
                                    window.actionIdentity?.normalizePrescriptionActionName?.(name),
                            );
                            if (!existing) {
                                this.db.health.prescriptionActions.push(
                                    window.actionIdentity.normalizePrescriptionAction(
                                        {
                                            displayName: name,
                                            aliases: [name],
                                            createdAt: nowTs,
                                            updatedAt: nowTs,
                                        },
                                        { nowTs },
                                    ),
                                );
                            }
                            this.saveAndBackup?.() || this.save();
                            close();
                            this.renderRoutines();
                        },
                    );
                },
            });
        },

        openPrescriptionMergeModal() {
            const selectedIds = Array.from(
                document.querySelectorAll('[data-prescription-merge-id]:checked'),
            )
                .map((input) => input.getAttribute('data-prescription-merge-id'))
                .filter(Boolean);
            const actions = this.filterPrescriptionActions();
            const esc = (value) => this.escapeHtml(value || '');
            return this._openModal({
                title: '合并处方动作',
                icon: 'compare_arrows',
                bodyHtml: `<div class="prescription-merge-modal">
                    <div class="prescription-library-toolbar in-modal">
                        <div class="md-field prescription-search-field"><input id="prescriptionMergeSearch" type="search" placeholder=" "><label>搜索要合并的动作</label></div>
                        <button class="md-icon-btn" type="button" data-merge-search aria-label="搜索"><span class="material-symbols-rounded">search</span></button>
                    </div>
                    <div id="prescriptionMergeList" class="prescription-merge-list">
                        ${actions.map((action) => `<label class="prescription-merge-row" data-merge-text="${esc(this.prescriptionActionSearchText(action).toLowerCase())}"><input type="checkbox" value="${esc(action.id)}" ${selectedIds.includes(action.id) ? 'checked' : ''}><span>${esc(action.displayName || '未命名处方动作')}</span></label>`).join('')}
                    </div>
                    <div class="md-field"><input id="prescriptionMergeName" type="text" placeholder=" "><label>合并后的标准动作名</label></div>
                </div>`,
                actionsHtml: `<button class="md-btn" type="button" data-modal-close>取消</button><button class="md-btn md-btn-filled" type="button" data-merge-prescription-actions>合并</button>`,
                onMount: (root, close) => {
                    const applySearch = () => {
                        const needle = String(
                            root.querySelector('#prescriptionMergeSearch')?.value || '',
                        )
                            .trim()
                            .toLowerCase();
                        root.querySelectorAll('[data-merge-text]').forEach((row) => {
                            row.hidden =
                                !!needle &&
                                !String(row.getAttribute('data-merge-text') || '').includes(needle);
                        });
                    };
                    root.querySelector('[data-merge-search]')?.addEventListener(
                        'click',
                        applySearch,
                    );
                    root.querySelector('#prescriptionMergeSearch')?.addEventListener(
                        'keydown',
                        (event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                applySearch();
                            }
                        },
                    );
                    root.querySelector('[data-merge-prescription-actions]')?.addEventListener(
                        'click',
                        (event) => {
                            event.preventDefault();
                            const ids = Array.from(
                                root.querySelectorAll('#prescriptionMergeList input:checked'),
                            ).map((input) => input.value);
                            if (ids.length < 2) {
                                window.toast?.show?.('至少选择两个处方动作', 'info');
                                return;
                            }
                            const displayName =
                                String(
                                    root.querySelector('#prescriptionMergeName')?.value || '',
                                ).trim() ||
                                this.findPrescriptionActionById(ids[0])?.displayName ||
                                '';
                            window.actionIdentity?.mergePrescriptionActions?.(
                                this.db,
                                ids[0],
                                ids.slice(1),
                                { displayName },
                            );
                            this.saveAndBackup?.() || this.save();
                            close();
                            this.renderRoutines();
                            window.toast?.show?.('已合并处方动作', 'success');
                        },
                    );
                },
            });
        },

        relationName(id) {
            return this.findPrescriptionActionById(id)?.displayName || '';
        },

        renderPrescriptionRelationPicker(action, relation) {
            const esc = (value) => this.escapeHtml(value || '');
            const inputId = `prescription-${relation}-search`;
            const title = relation === 'progression' ? '进阶动作' : '退阶动作';
            const ids =
                relation === 'progression'
                    ? action.progressionIds || []
                    : action.regressionIds || [];
            const candidates = this.prescriptionActionCatalog().filter(
                (item) => item.id !== action.id && !ids.includes(item.id),
            );
            return `<section class="prescription-detail-section">
                <h4>${title}</h4>
                <div class="prescription-relation-list">
                    ${ids.length ? ids.map((id) => `<span class="prescription-relation-pill">${esc(this.relationName(id) || id)}<button type="button" onclick="data.removePrescriptionRelation('${esc(action.id)}','${esc(id)}','${relation}')" aria-label="移除"><span class="material-symbols-rounded">close</span></button></span>`).join('') : '<small>未关联</small>'}
                </div>
                <div class="prescription-relation-combobox" data-relation-combobox>
                    <div class="prescription-library-toolbar in-modal">
                        <div class="md-field prescription-search-field"><input id="${inputId}" type="search" placeholder=" " onfocus="data.openPrescriptionRelationChoices('${inputId}')" onclick="data.openPrescriptionRelationChoices('${inputId}')" oninput="data.filterPrescriptionRelationChoices('${inputId}')"><label>搜索并选择${title}</label></div>
                        <button class="md-icon-btn" type="button" onclick="data.openPrescriptionRelationChoices('${inputId}')" aria-label="搜索"><span class="material-symbols-rounded">search</span></button>
                    </div>
                    <div class="prescription-relation-choices" role="listbox" aria-label="选择${title}">
                        ${
                            candidates.length
                                ? candidates
                                      .map((item) => {
                                          const searchText =
                                              this.prescriptionActionSearchText(item).toLowerCase();
                                          const label = item.displayName || '未命名处方动作';
                                          const aliasText = (item.aliases || [])
                                              .filter((name) => name && name !== item.displayName)
                                              .slice(0, 3)
                                              .join(' / ');
                                          return `<button class="prescription-relation-choice" type="button" data-relation-choice-text="${esc(searchText)}" onclick="data.addPrescriptionRelation('${esc(action.id)}','${esc(item.id)}','${relation}')">
                                <strong>${esc(label)}</strong>
                                ${aliasText ? `<small>${esc(aliasText)}</small>` : ''}
                            </button>`;
                                      })
                                      .join('')
                                : '<small class="prescription-relation-empty">没有可关联的动作</small>'
                        }
                    </div>
                </div>
            </section>`;
        },

        prescriptionRelationChoiceRoot(inputId) {
            const input = document.getElementById(inputId);
            const root =
                input?.closest?.('[data-relation-combobox]') ||
                input
                    ?.closest?.('.prescription-detail-section')
                    ?.querySelector?.('.prescription-relation-choices')?.parentElement ||
                input?.closest?.('.prescription-library-toolbar')?.parentElement;
            return {
                input,
                root,
                choices: root?.querySelector?.('.prescription-relation-choices') || null,
            };
        },

        openPrescriptionRelationChoices(inputId) {
            const { input, root, choices } = this.prescriptionRelationChoiceRoot(inputId);
            root?.classList.add('is-open');
            choices?.classList.add('is-open');
            input?.focus?.();
            this.filterPrescriptionRelationChoices(inputId);
        },

        filterPrescriptionRelationChoices(inputId) {
            const { input, root, choices } = this.prescriptionRelationChoiceRoot(inputId);
            const needle = String(input?.value || '')
                .trim()
                .toLowerCase();
            const normalized =
                window.actionIdentity?.normalizePrescriptionActionName?.(needle) || needle;
            root?.classList.add('is-open');
            choices?.classList.add('is-open');
            choices?.querySelectorAll?.('[data-relation-choice-text]')?.forEach((choice) => {
                const text = String(
                    choice.getAttribute('data-relation-choice-text') || '',
                ).toLowerCase();
                const compact =
                    window.actionIdentity?.normalizePrescriptionActionName?.(text) || text;
                choice.hidden = !!needle && !text.includes(needle) && !compact.includes(normalized);
            });
        },

        addPrescriptionRelation(actionId, targetId, relation) {
            targetId = String(targetId || '').trim();
            if (!targetId) return;
            window.actionIdentity?.addPrescriptionActionRelation?.(
                this.db,
                actionId,
                targetId,
                relation,
            );
            this.saveAndBackup?.() || this.save();
            this.openPrescriptionActionDetail(actionId);
        },

        removePrescriptionRelation(actionId, targetId, relation) {
            window.actionIdentity?.removePrescriptionActionRelation?.(
                this.db,
                actionId,
                targetId,
                relation,
            );
            this.saveAndBackup?.() || this.save();
            this.openPrescriptionActionDetail(actionId);
        },

        renderPrescriptionLinkedActionPicker(action) {
            const esc = (value) => this.escapeHtml(value || '');
            const linked = action.linkedActionId
                ? this.findActionById(action.linkedActionId)
                : null;
            const candidates = this.activeRecords(this.db.actions || []).filter(
                (item) => item.libOnly === true,
            );
            return `<section class="prescription-detail-section">
                <h4>关联普通动作</h4>
                <div class="prescription-relation-list">
                    ${linked ? `<span class="prescription-relation-pill">${esc(linked.name || '未命名动作')}<button type="button" onclick="data.setPrescriptionLinkedAction('${esc(action.id)}','')" aria-label="取消关联"><span class="material-symbols-rounded">close</span></button></span>` : '<small>未关联</small>'}
                </div>
                <div class="prescription-relation-combobox" data-linked-action-combobox>
                    <div class="prescription-library-toolbar in-modal">
                        <div class="md-field prescription-search-field"><input id="prescriptionLinkedActionSearch" type="search" placeholder=" " value="${esc(linked?.name || '')}" onfocus="data.openPrescriptionLinkedActionChoices()" onclick="data.openPrescriptionLinkedActionChoices()" oninput="data.filterPrescriptionLinkedActionChoices()"><label>搜索并选择动作库动作</label></div>
                        <button class="md-icon-btn" type="button" onclick="data.openPrescriptionLinkedActionChoices()" aria-label="搜索"><span class="material-symbols-rounded">search</span></button>
                    </div>
                    <div class="prescription-relation-choices" role="listbox" aria-label="选择普通动作">
                        ${
                            candidates.length
                                ? candidates
                                      .map((item) => {
                                          const meta = [
                                              item.name,
                                              item.category,
                                              this.actionCategoryLabel?.(item.category),
                                              item.bodyPart,
                                              ...(item.tags || []),
                                          ]
                                              .filter(Boolean)
                                              .join(' ')
                                              .toLowerCase();
                                          return `<button class="prescription-relation-choice" type="button" data-linked-action-choice-text="${esc(meta)}" onclick="data.setPrescriptionLinkedAction('${esc(action.id)}','${esc(item.id)}')">
                                <strong>${esc(item.name || '未命名动作')}</strong>
                                <small>${esc([this.actionCategoryLabel?.(item.category), item.bodyPart, ...(item.tags || [])].filter(Boolean).join(' · ') || '普通动作库')}</small>
                            </button>`;
                                      })
                                      .join('')
                                : '<small class="prescription-relation-empty">动作库暂无可关联动作</small>'
                        }
                    </div>
                </div>
            </section>`;
        },

        prescriptionLinkedActionChoiceRoot() {
            const input = document.getElementById('prescriptionLinkedActionSearch');
            const root =
                input?.closest?.('[data-linked-action-combobox]') ||
                input
                    ?.closest?.('.prescription-detail-section')
                    ?.querySelector?.('.prescription-relation-choices')?.parentElement ||
                input?.closest?.('.prescription-library-toolbar')?.parentElement;
            return {
                input,
                root,
                choices: root?.querySelector?.('.prescription-relation-choices') || null,
            };
        },

        openPrescriptionLinkedActionChoices() {
            const { input, root, choices } = this.prescriptionLinkedActionChoiceRoot();
            root?.classList.add('is-open');
            choices?.classList.add('is-open');
            input?.focus?.();
            this.filterPrescriptionLinkedActionChoices();
        },

        filterPrescriptionLinkedActionChoices() {
            const { input, root, choices } = this.prescriptionLinkedActionChoiceRoot();
            const needle = String(input?.value || '')
                .trim()
                .toLowerCase();
            const normalized =
                window.actionIdentity?.normalizePrescriptionActionName?.(needle) || needle;
            root?.classList.add('is-open');
            choices?.classList.add('is-open');
            choices?.querySelectorAll?.('[data-linked-action-choice-text]')?.forEach((choice) => {
                const text = String(
                    choice.getAttribute('data-linked-action-choice-text') || '',
                ).toLowerCase();
                const compact =
                    window.actionIdentity?.normalizePrescriptionActionName?.(text) || text;
                choice.hidden = !!needle && !text.includes(needle) && !compact.includes(normalized);
            });
        },

        setPrescriptionLinkedAction(actionId, linkedActionId = '') {
            window.actionIdentity?.setPrescriptionActionLinkedAction?.(
                this.db,
                actionId,
                linkedActionId,
            );
            this.saveAndBackup?.() || this.save();
            this.openPrescriptionActionDetail(actionId);
            window.toast?.show?.(linkedActionId ? '已关联普通动作' : '已取消关联', 'success');
        },

        closePrescriptionChoiceMenus(scope = document) {
            const root = scope?.querySelectorAll ? scope : document;
            root.querySelectorAll('.prescription-relation-combobox.is-open').forEach((box) => {
                box.classList.remove('is-open');
            });
            root.querySelectorAll('.prescription-relation-choices.is-open').forEach((choices) => {
                choices.classList.remove('is-open');
                choices.style.display = '';
            });
        },

        bindPrescriptionChoiceDismiss(root) {
            if (!root || root.dataset.prescriptionChoiceDismissBound === '1') return;
            root.dataset.prescriptionChoiceDismissBound = '1';
            const isInsideChoiceMenu = (target) =>
                !!target?.closest?.('.prescription-relation-combobox');
            root.addEventListener('click', (event) => {
                if (isInsideChoiceMenu(event.target)) return;
                this.closePrescriptionChoiceMenus(root);
            });
            root.addEventListener('focusin', (event) => {
                if (isInsideChoiceMenu(event.target)) return;
                this.closePrescriptionChoiceMenus(root);
            });
            root.addEventListener('keydown', (event) => {
                if (event.key !== 'Escape') return;
                this.closePrescriptionChoiceMenus(root);
            });
        },

        openPrescriptionActionDetail(actionId) {
            const action = this.findPrescriptionActionById(actionId);
            if (!action) return;
            const esc = (value) => this.escapeHtml(value || '');
            return this._openModal({
                title: '处方动作详情',
                icon: 'clinical_notes',
                bodyHtml: `<div class="prescription-detail">
                    <div class="md-field"><input id="prescriptionDisplayName" type="text" value="${esc(action.displayName)}" placeholder=" "><label>标准动作名</label></div>
                    <div class="prescription-meta-grid">
                        <div class="md-field"><select id="prescriptionCategory">${this.renderActionCategoryOptions(action.category)}</select><label>动作分类</label></div>
                        <div class="md-field"><input id="prescriptionBodyPart" type="text" value="${esc(action.bodyPart || '')}" placeholder=" "><label>训练部位</label></div>
                    </div>
                    ${this.renderPrescriptionLinkedActionPicker(action)}
                    <section class="prescription-detail-section">
                        <h4>别名 / 历史写法</h4>
                        <div class="prescription-alias-list">${(action.aliases || []).map((name) => `<span>${esc(name)}</span>`).join('')}</div>
                    </section>
                    ${this.renderPrescriptionRelationPicker(action, 'regression')}
                    ${this.renderPrescriptionRelationPicker(action, 'progression')}
                </div>`,
                actionsHtml: `<button class="md-btn" type="button" data-modal-close>关闭</button><button class="md-btn md-btn-filled" type="button" data-save-prescription-detail>保存</button>`,
                onMount: (root, close) => {
                    this.bindPrescriptionChoiceDismiss(root);
                    root.querySelector('[data-save-prescription-detail]')?.addEventListener(
                        'click',
                        (event) => {
                            event.preventDefault();
                            const target = (this.db.health?.prescriptionActions || []).find(
                                (item) => item.id === action.id,
                            );
                            if (!target) return;
                            target.displayName =
                                String(
                                    root.querySelector('#prescriptionDisplayName')?.value ||
                                        target.displayName,
                                ).trim() || target.displayName;
                            target.aliases = [
                                ...new Set(
                                    [target.displayName, ...(target.aliases || [])]
                                        .map((name) => String(name || '').trim())
                                        .filter(Boolean),
                                ),
                            ];
                            target.category = this.normalizeActionCategory(
                                root.querySelector('#prescriptionCategory')?.value ||
                                    target.category ||
                                    '',
                            );
                            target.bodyPart = String(
                                root.querySelector('#prescriptionBodyPart')?.value || '',
                            ).trim();
                            this.touchRecord?.(target, [
                                'displayName',
                                'aliases',
                                'category',
                                'bodyPart',
                            ]);
                            this.saveAndBackup?.() || this.save();
                            close();
                            this.renderRoutines();
                        },
                    );
                },
            });
        },

        renameActionFromLibrary(actionId) {
            const action = this.findActionById(actionId);
            if (!action || action.deleted) return;
            this._textPromptModal({
                title: '修改动作名称',
                icon: 'edit',
                label: '动作名称',
                initialValue: action.name || '',
                okText: '保存',
                cancelText: '取消',
                onOk: (name) => {
                    action.name = name;
                    this.touchRecord(action);
                    this.save();
                    this.renderRoutines();
                },
            });
        },

        editActionFromLibrary(actionId) {
            const action = this.findActionById(actionId);
            if (!action || action.deleted) return;
            const esc = (v) => (this.escapeHtml ? this.escapeHtml(v || '') : String(v || ''));
            return this._openModal({
                title: '编辑动作',
                icon: 'tune',
                bodyHtml: `
                    <div class="md-grid modal-grid" style="gap:10px">
                        <div class="md-field"><input id="rlAeSets" type="number" min="1" placeholder=" " value="${esc(String(action.sets || 1))}"><label>组数</label></div>
                        <div class="md-field"><input id="rlAeReps" type="number" min="1" placeholder=" " value="${esc(String(action.reps || 1))}"><label>次数</label></div>
                        <div class="md-field"><input id="rlAeWork" type="number" min="1" placeholder=" " value="${esc(String(action.work || 5))}"><label>单次秒数</label></div>
                        <div class="md-field"><input id="rlAeRepRest" type="number" min="0" placeholder=" " value="${esc(String(action.repRest ?? 2))}"><label>次休秒数</label></div>
                        <div class="md-field"><input id="rlAeActionRest" type="number" min="0" placeholder=" " value="${esc(String(action.actionRest ?? 10))}"><label>组休秒数</label></div>
                        <div class="md-field"><input id="rlAeGroupRest" type="number" min="0" placeholder=" " value="${esc(String(action.groupRest ?? 15))}"><label>项休秒数</label></div>
                        <div class="md-field">
                            <select id="rlAePhase" required>
                                <option value="warmup" ${(action.phase || 'main') === 'warmup' ? 'selected' : ''}>暖身</option>
                                <option value="main" ${(action.phase || 'main') === 'main' ? 'selected' : ''}>正式</option>
                                <option value="cooldown" ${(action.phase || 'main') === 'cooldown' ? 'selected' : ''}>放松</option>
                            </select>
                            <label>阶段</label>
                        </div>
                        <div class="md-field"><select id="rlAeCategory">${this.renderActionCategoryOptions(action.category)}</select><label>动作分类</label></div>
                        <div class="md-field"><input id="rlAeBodyPart" type="text" placeholder=" " value="${esc(action.bodyPart || '')}"><label>训练部位</label></div>
                        <div class="md-field" id="rlAeMetField"><input id="rlAeMet" type="number" min="0" step="0.1" placeholder=" " value="${esc(String(action.met || ''))}"><label>MET（有氧热量）</label></div>
                        <div style="grid-column:1/-1;display:flex;align-items:center;gap:10px;padding:4px 2px">
                            <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
                                <input id="rlAeIsAlt" type="checkbox" ${action.isAlt ? 'checked' : ''}>
                                <span style="color:var(--md-sys-on-surface)">双侧交替</span>
                            </label>
                            <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
                                <input id="rlAeExerciseLogEnabled" type="checkbox" ${action.exerciseLogEnabled ? 'checked' : ''}>
                                <span style="color:var(--md-sys-on-surface)">可在记运动调用</span>
                            </label>
                        </div>
                    </div>
                `,
                actionsHtml: `
                    <button class="md-btn" type="button" data-modal-close>取消</button>
                    <button class="md-btn md-btn-filled" type="button" data-rl-save>保存</button>
                `,
                onMount: (root, close) => {
                    const q = (sel) => root.querySelector(sel);
                    const syncMetField = () => {
                        const category = this.normalizeActionCategory(q('#rlAeCategory')?.value || '');
                        const enabled = !!q('#rlAeExerciseLogEnabled')?.checked;
                        q('#rlAeMetField')?.classList.toggle('hidden', category !== 'cardio' && !enabled);
                    };
                    q('#rlAeSets')?.focus?.();
                    q('#rlAeCategory')?.addEventListener('change', syncMetField);
                    q('#rlAeExerciseLogEnabled')?.addEventListener('change', syncMetField);
                    syncMetField();
                    q('[data-rl-save]')?.addEventListener('click', (e) => {
                        e.preventDefault();
                        action.sets = Math.max(1, parseInt(q('#rlAeSets')?.value, 10) || 1);
                        action.reps = Math.max(1, parseInt(q('#rlAeReps')?.value, 10) || 1);
                        action.work = Math.max(1, parseInt(q('#rlAeWork')?.value, 10) || 1);
                        action.repRest = Math.max(0, parseInt(q('#rlAeRepRest')?.value, 10) || 0);
                        action.actionRest = Math.max(
                            0,
                            parseInt(q('#rlAeActionRest')?.value, 10) || 0,
                        );
                        action.groupRest = Math.max(
                            0,
                            parseInt(q('#rlAeGroupRest')?.value, 10) || 0,
                        );
                        action.phase = ['warmup', 'main', 'cooldown'].includes(
                            q('#rlAePhase')?.value,
                        )
                            ? q('#rlAePhase').value
                            : 'main';
                        action.category = this.normalizeActionCategory(
                            q('#rlAeCategory')?.value || action.category || '',
                        );
                        action.bodyPart = String(q('#rlAeBodyPart')?.value || '').trim();
                        action.isAlt = !!q('#rlAeIsAlt')?.checked;
                        action.exerciseLogEnabled = !!q('#rlAeExerciseLogEnabled')?.checked;
                        action.met = Math.max(0, Number(q('#rlAeMet')?.value || 0));
                        this.touchRecord(action);
                        this.save();
                        window.cardio?.refreshTypeSelectors?.();
                        close();
                        this.renderRoutines();
                    });
                },
            });
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
            const refs =
                this.countActionReferences?.(
                    actionId,
                    this.activeRecords(this.db.routines || []),
                ) || 0;
            const msg =
                refs > 0
                    ? `${refs} 个方案在使用此动作，确认删除？删除后方案内快照仍保留。`
                    : `确定删除动作「${action.name || '未命名'}」？`;
            this._confirmModal({
                title: '删除动作',
                icon: 'delete',
                message: msg,
                okText: '删除',
                cancelText: '取消',
                danger: true,
                onOk: () => {
                    this.deleteAction(actionId);
                    this.renderRoutines();
                },
            });
        },

        editActionTags(actionId) {
            const action = this.findActionById(actionId);
            if (!action || action.deleted) return;
            const current = Array.isArray(action.tags) ? action.tags.join(', ') : '';
            return this._openModal({
                title: '编辑动作标签',
                icon: 'bookmark_add',
                bodyHtml: `
                    <div class="md-field" style="margin:0">
                        <input id="rlTagInput" type="text" placeholder=" " value="${this.escapeHtml(current)}" autocomplete="off">
                        <label>标签（逗号分隔）</label>
                    </div>
                    <div style="margin-top:6px;color:var(--md-sys-on-surface-variant);font-size:12px">示例：上肢, 肩, 拉伸</div>
                `,
                actionsHtml: `
                    <button class="md-btn" type="button" data-modal-close>取消</button>
                    <button class="md-btn md-btn-filled" type="button" data-rl-save>保存</button>
                `,
                onMount: (root, close) => {
                    const input = root.querySelector('#rlTagInput');
                    input?.focus?.();
                    const commit = () => {
                        action.tags = [
                            ...new Set(
                                String(input?.value || '')
                                    .split(/[,，]/)
                                    .map((t) => this.normalizeTagText(t))
                                    .filter(Boolean),
                            ),
                        ];
                        this.touchRecord(action);
                        this.save();
                        close();
                        this.renderRoutines();
                    };
                    root.querySelector('[data-rl-save]')?.addEventListener('click', (e) => {
                        e.preventDefault();
                        commit();
                    });
                    input?.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            commit();
                        }
                    });
                },
            });
        },

        renderActionLibrary() {
            const actions = this.activeRecords(this.db.actions || []).filter(
                (a) => a.libOnly === true,
            );
            const tags = this.collectLibraryTags();
            const activeTag = this.normalizeTagText(this.db.libraryFilterTag || '');
            const filtered = activeTag
                ? actions.filter((a) => (a.tags || []).includes(activeTag))
                : actions;
            if (!actions.length) {
                return `<div class="empty-state"><span class="material-symbols-rounded">fitness_center</span><p>暂无动作</p><small>在训练页添加动作后可在这里管理</small></div>`;
            }
            return `${this.renderLibraryTagChips(tags, activeTag)}
                <div class="library-list action-library-list">
                ${filtered
                    .map(
                        (a) => `<div class="library-card action-card">
                    <div class="library-card-head">
                        <div style="flex:1;min-width:0">
                            <strong>${this.escapeHtml(a.name || '未命名动作')}</strong>
                            <small>${[this.actionCategoryLabel?.(a.category), a.bodyPart, `${a.sets || 1}组 × ${a.reps || 1}次`, `${a.work || 5}s`, a.phase || 'main', a.isAlt ? '双侧' : '', this.actionExerciseLogLabel?.(a)].filter(Boolean).join(' · ')}</small>
                            ${Array.isArray(a.tags) && a.tags.length ? `<div class="library-inline-tags">${a.tags.map((t) => `<span>${this.escapeHtml(t)}</span>`).join('')}</div>` : ''}
                        </div>
                    </div>
                    <div class="library-card-actions">
                        <button class="md-btn md-btn-tonal" onclick="data.renameActionFromLibrary('${a.id}')" type="button"><span class="material-symbols-rounded">edit</span>改名</button>
                        <button class="md-btn md-btn-tonal" onclick="data.editActionFromLibrary('${a.id}')" type="button"><span class="material-symbols-rounded">tune</span>编辑</button>
                        <button class="md-btn md-btn-tonal" onclick="data.editActionTags('${a.id}')" type="button"><span class="material-symbols-rounded">bookmark_add</span>标签</button>
                        <button class="md-btn md-btn-tonal" onclick="data.duplicateActionFromLibrary('${a.id}')" type="button"><span class="material-symbols-rounded">content_copy</span>复制</button>
                        <button class="md-btn md-btn-tonal" onclick="data.deleteActionFromLibrary('${a.id}')" type="button"><span class="material-symbols-rounded">delete</span>删除</button>
                    </div>
                </div>`,
                    )
                    .join('')}
                </div>`;
        },

        findRoutineById(routineId) {
            return (this.db.routines || []).find((r) => r && r.id === routineId);
        },

        renameRoutineFromLibrary(routineId) {
            const routine = this.findRoutineById(routineId);
            if (!routine || routine.deleted) return;
            this._textPromptModal({
                title: '修改方案名称',
                icon: 'edit',
                label: '方案名称',
                initialValue: routine.name || '',
                okText: '保存',
                cancelText: '取消',
                onOk: (name) => {
                    routine.name = name;
                    this.touchRecord(routine);
                    this.save();
                    this.renderRoutines();
                },
            });
        },

        editRoutineTags(routineId) {
            const routine = this.findRoutineById(routineId);
            if (!routine || routine.deleted) return;
            const current = Array.isArray(routine.tags) ? routine.tags.join(', ') : '';
            return this._openModal({
                title: '编辑方案标签',
                icon: 'bookmark_add',
                bodyHtml: `
                    <div class="md-field" style="margin:0">
                        <input id="rlTagInput" type="text" placeholder=" " value="${this.escapeHtml(current)}" autocomplete="off">
                        <label>标签（逗号分隔）</label>
                    </div>
                `,
                actionsHtml: `
                    <button class="md-btn" type="button" data-modal-close>取消</button>
                    <button class="md-btn md-btn-filled" type="button" data-rl-save>保存</button>
                `,
                onMount: (root, close) => {
                    const input = root.querySelector('#rlTagInput');
                    input?.focus?.();
                    const commit = () => {
                        routine.tags = [
                            ...new Set(
                                String(input?.value || '')
                                    .split(/[,，]/)
                                    .map((t) => this.normalizeTagText(t))
                                    .filter(Boolean),
                            ),
                        ];
                        this.touchRecord(routine);
                        this.save();
                        close();
                        this.renderRoutines();
                    };
                    root.querySelector('[data-rl-save]')?.addEventListener('click', (e) => {
                        e.preventDefault();
                        commit();
                    });
                    input?.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            commit();
                        }
                    });
                },
            });
        },

        loadRoutineById(routineId) {
            const routines = this.activeRecords(this.db.routines || []);
            const idx = routines.findIndex((r) => r.id === routineId);
            if (idx < 0) return;
            this.loadRoutine(idx);
        },

        duplicateRoutineById(routineId) {
            const routines = this.activeRecords(this.db.routines || []);
            const idx = routines.findIndex((r) => r.id === routineId);
            if (idx < 0) return;
            this.duplicateRoutine(idx);
            this.renderRoutines();
        },

        deleteRoutineById(routineId) {
            const routines = this.activeRecords(this.db.routines || []);
            const idx = routines.findIndex((r) => r.id === routineId);
            if (idx < 0) return;
            this._confirmModal({
                title: '删除方案',
                icon: 'delete',
                message: `确定删除方案 "${routines[idx].name || '未命名方案'}"？`,
                okText: '删除',
                cancelText: '取消',
                danger: true,
                onOk: () => {
                    this.deleteRoutine(idx);
                    this.renderRoutines();
                },
            });
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
            const esc = (v) => (this.escapeHtml ? this.escapeHtml(v || '') : String(v || ''));
            return this._openModal({
                title: '替换为…',
                icon: 'swap_horiz',
                bodyHtml: `
                    <div style="display:grid;gap:8px;max-height:55vh;overflow:auto;padding-right:2px">
                        ${actions
                            .map(
                                (a, idx) => `
                            <button class="template-manager-item" type="button" data-rl-pick="${idx}" style="justify-content:flex-start">
                                <span class="material-symbols-rounded" style="font-size:20px;color:var(--md-sys-primary)">fitness_center</span>
                                <span class="template-manager-item-main" style="text-align:left">
                                    <strong>${esc(a.name || '未命名动作')}</strong>
                                    <small>${a.sets || 1}组 · ${a.reps || 1}次 · ${a.work || 5}s${a.isAlt ? ' · 双侧' : ''}</small>
                                </span>
                            </button>
                        `,
                            )
                            .join('')}
                    </div>
                `,
                actionsHtml: `<button class="md-btn" type="button" data-modal-close>取消</button>`,
                onMount: (root, close) => {
                    root.querySelectorAll('[data-rl-pick]').forEach((btn) => {
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            const idx = parseInt(btn.getAttribute('data-rl-pick'), 10);
                            const src = JSON.parse(JSON.stringify(actions[idx]));
                            src.sourceActionId = src.id;
                            routine.actions[actionIndex] = src;
                            this.touchRecord(routine);
                            this.save();
                            close();
                            this.renderRoutines();
                        });
                    });
                },
            });
        },

        deriveRoutineFromLibrary(routineId) {
            const routine = this.findRoutineById(routineId);
            if (!routine || routine.deleted) return;
            this._textPromptModal({
                title: '派生新方案',
                icon: 'add_circle',
                label: '新方案名称',
                initialValue: `${routine.name || '方案'} (派生)`,
                okText: '创建',
                cancelText: '取消',
                onOk: (trimmed) => {
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
            });
        },

        renderRoutineLibraryPane() {
            const routines = this.activeRecords(this.db.routines || []);
            const tags = this.collectLibraryTags();
            const activeTag = this.normalizeTagText(this.db.libraryFilterTag || '');
            const filtered = activeTag
                ? routines.filter((r) => (r.tags || []).includes(activeTag))
                : routines;
            if (!routines.length) {
                return `<div class="empty-state"><span class="material-symbols-rounded">library_books</span><p>暂无方案</p><small>在训练页可保存当前计划到方案库</small></div>`;
            }
            return `${this.renderLibraryTagChips(tags, activeTag)}
                <div class="library-list routine-library-list">
                ${filtered
                    .map((r) => {
                        const expanded = this.isCollapsed('routine_lib_' + r.id, true) === false;
                        const rtTags = Array.isArray(r.tags) ? r.tags : [];
                        const routineId = this.escapeHtml(r.id || '');
                        return `<div class="routine-card library-card">
                        <div class="routine-card-head" data-rl-action="toggle-routine-collapse" data-routine-id="${routineId}">
                            <div style="flex:1;min-width:0">
                                <strong>${this.escapeHtml(r.name || '未命名方案')}</strong>
                                <small>${(r.actions || []).length}个动作 ${r.created ? '&middot; ' + this.escapeHtml(r.created) : ''}</small>
                                ${rtTags.length ? `<div class="library-inline-tags">${rtTags.map((t) => `<span>${this.escapeHtml(t)}</span>`).join('')}</div>` : ''}
                            </div>
                            <span class="routine-expand-icon material-symbols-rounded">${expanded ? 'expand_less' : 'expand_more'}</span>
                        </div>
                        ${
                            expanded
                                ? `<div class="routine-action-list">
                            ${(r.actions || [])
                                .map(
                                    (a, ai) => `<div class="routine-action-item">
                                <span class="routine-action-idx">${ai + 1}</span>
                                <span class="routine-action-name">${this.escapeHtml(a.name || '未命名动作')}</span>
                                <small>${a.sets || 1}组×${a.reps || 1}次·${a.work || 5}s</small>
                                <div class="routine-inline-actions">
                                    <button class="icon-btn" data-rl-action="move-routine-action" data-routine-id="${routineId}" data-action-index="${ai}" data-direction="-1" type="button" aria-label="上移"><span class="material-symbols-rounded">expand_less</span></button>
                                    <button class="icon-btn" data-rl-action="move-routine-action" data-routine-id="${routineId}" data-action-index="${ai}" data-direction="1" type="button" aria-label="下移"><span class="material-symbols-rounded">expand_more</span></button>
                                    <button class="icon-btn" data-rl-action="save-action-from-routine" data-routine-id="${routineId}" data-action-index="${ai}" type="button" aria-label="保存到动作库"><span class="material-symbols-rounded">bookmark_add</span></button>
                                    <button class="icon-btn" data-rl-action="remove-routine-action" data-routine-id="${routineId}" data-action-index="${ai}" type="button" aria-label="删除"><span class="material-symbols-rounded">delete</span></button>
                                </div>
                            </div>`,
                                )
                                .join('')}
                            <div class="library-card-actions">
                                <button class="md-btn md-btn-tonal" data-rl-action="load-routine" data-routine-id="${routineId}" type="button"><span class="material-symbols-rounded">upload</span>载入</button>
                                <button class="md-btn md-btn-tonal" data-rl-action="rename-routine" data-routine-id="${routineId}" type="button"><span class="material-symbols-rounded">edit</span>改名</button>
                                <button class="md-btn md-btn-tonal" data-rl-action="edit-routine-tags" data-routine-id="${routineId}" type="button"><span class="material-symbols-rounded">bookmark_add</span>标签</button>
                                <button class="md-btn md-btn-tonal" data-rl-action="derive-routine" data-routine-id="${routineId}" type="button"><span class="material-symbols-rounded">add_circle</span>派生</button>
                                <button class="md-btn md-btn-tonal" data-rl-action="delete-routine" data-routine-id="${routineId}" type="button"><span class="material-symbols-rounded">delete</span>删除</button>
                            </div>
                        </div>`
                                : ''
                        }
                    </div>`;
                    })
                    .join('')}
                </div>`;
        },

        renderRoutineLibrary() {
            return this.renderRoutineLibraryPane();
        },
    };
})();
