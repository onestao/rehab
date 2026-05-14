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
                actions: JSON.parse(JSON.stringify(actions)).map(a => this.ensureRecordMeta(a, 'routine-action', Date.now())),
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

            const routines = this.activeRecords(this.db.routines);
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

        renderProfilePage() {
            const overview = document.getElementById('profileOverview');
            const content = document.getElementById('profileContent');
            const settings = document.getElementById('profileSettings');
            if (overview) overview.innerHTML = (this.renderWeeklySummaryCard?.() || '') + this.renderRoutineOverview();
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
            const routineCount = this.activeRecords(this.db.routines).length;
            const actionCount = this.activeRecords(this.db.actions).length;
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
            const routines = this.activeRecords(this.db.routines);
            if (routines.length === 0) {
                return `<div class="empty-state"><span class="material-symbols-rounded">bookmark_border</span><p>暂无保存的方案</p></div>`;
            }
            const allTags = [...new Set(routines.flatMap(r => r.tags || []))];
            const filterTag = this._routineFilterTag || '';
            const filtered = filterTag ? routines.filter(r => (r.tags || []).includes(filterTag)) : routines;
            return `${allTags.length ? `<div class="routine-tag-chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
                <button class="routine-tag-chip md-btn md-btn-tonal${!filterTag ? ' active' : ''}" onclick="data._routineFilterTag='';data.renderRoutines()" type="button" style="font-size:12px;padding:2px 10px">全部</button>
                ${allTags.map(t => `<button class="routine-tag-chip md-btn md-btn-tonal${filterTag===t ? ' active' : ''}" onclick="data._routineFilterTag='${this.escapeHtml(t)}';data.renderRoutines()" type="button" style="font-size:12px;padding:2px 10px">${this.escapeHtml(t)}</button>`).join('')}
            </div>` : ''}
            ${filtered.map((r, ri) => {
                const i = routines.indexOf(r);
                const expanded = this.isCollapsed('routine_' + i, true) === false;
                const tags = r.tags || [];
                return `<div class="routine-card">
                <div class="routine-card-head" onclick="data.toggleCollapse('routine_${i}')">
                    <div style="flex:1;min-width:0">
                        <strong>${r.name}</strong>
                        <small>${r.actions.length}个动作 &middot; ${r.created}</small>
                        ${tags.length ? `<div style="margin-top:2px">${tags.map(t => `<span style="display:inline-block;font-size:10px;padding:1px 6px;border-radius:8px;background:var(--md-sys-secondary-container);color:var(--md-sys-on-secondary-container);margin-right:4px">${this.escapeHtml(t)}</span>`).join('')}</div>` : ''}
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
                        <button class="md-btn md-btn-tonal" style="padding:0 14px;height:32px;font-size:12px" onclick="event.stopPropagation();data.duplicateRoutine(${i})"><span class="material-symbols-rounded" style="font-size:16px">content_copy</span> 复制</button>
                        <button class="delete-btn" onclick="event.stopPropagation();data.deleteRoutine(${i})"><span class="material-symbols-rounded">delete</span></button>
                    </div>
                </div>` : ''}
            </div>`;
            }).join('')}`;
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
