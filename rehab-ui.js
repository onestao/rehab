// @ts-nocheck
(function () {
    if (window.dataRehabUi?.renderRehabTodaySection) return;

    function navButton(pageId) {
        return Array.from(document.querySelectorAll('.nav-item')).find((btn) => (btn.getAttribute('onclick') || '').includes(`'${pageId}'`));
    }

    function formatTime(ts) {
        if (!ts) return '';
        return new Date(Number(ts)).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }

    function taskSort(task) {
        const order = { 'in-progress': 0, todo: 1, done: 2, skipped: 3 };
        return order[task?.status] ?? 9;
    }

    window.dataRehabUi = Object.assign(window.dataRehabUi || {}, {
        renderRehabTodaySection() {
            const plan = this.ensureTodayPlan?.();
            if (!plan) return '';
            const completion = this.completionRate?.(plan) || { done: 0, total: 0, rate: 0 };
            const items = (plan.items || []).filter((item) => !item.deleted).sort((a, b) => taskSort(a) - taskSort(b));
            const current = items.find((item) => item.status === 'in-progress') || items.find((item) => item.status === 'todo') || null;
            const nextTodo = items.filter((item) => item.status === 'todo').slice(0, 3);
            const sections = {
                todo: items.filter((item) => item.status === 'todo' || item.status === 'in-progress'),
                done: items.filter((item) => item.status === 'done'),
                skipped: items.filter((item) => item.status === 'skipped')
            };
            return `<div class="md-card rehab-today-card ${this.rehabTodayExpanded ? 'is-expanded' : ''}">
                <div class="rehab-today-head">
                    <div>
                        <span class="cardio-kicker">康复计划</span>
                        <h3>${completion.done}/${completion.total || 0} 已完成</h3>
                        <small>${plan.notes ? this.escapeHtml(plan.notes) : '今天按计划完成主项，结束后补一次体感反馈'}</small>
                    </div>
                    <span class="material-symbols-rounded">health_and_safety</span>
                </div>
                <div class="rehab-progress">
                    <i style="width:${Math.round((completion.rate || 0) * 100)}%"></i>
                </div>
                ${!this.rehabTodayExpanded ? `
                    <div class="rehab-current-block">
                        <strong>${current ? this.escapeHtml(current.name || '暂无任务') : '暂无任务'}</strong>
                        <small>${current ? `${current.status === 'in-progress' ? '进行中' : '下一项'} · ${current.spec.sets}组 · ${current.spec.reps || current.spec.work + '秒'}` : '稍后从 AI 或手动添加'}</small>
                    </div>
                    <div class="rehab-compact-list">
                        ${nextTodo.map((task, index) => this.renderRehabTaskRow(plan.id, task, index + 1, true)).join('') || '<div class="rehab-empty">今天的康复主项已经排空</div>'}
                    </div>
                    <button class="rehab-expand-btn" type="button" onclick="data.toggleRehabTodayExpanded()">展开全部 ${items.length} 项 <span class="material-symbols-rounded">expand_more</span></button>
                ` : `
                    ${[['待做', 'todo', sections.todo], ['已完成', 'done', sections.done], ['已跳过', 'skipped', sections.skipped]].map(([label, key, list]) => `
                        <section class="rehab-section rehab-section-${key}">
                            <div class="rehab-section-head"><strong>${label}</strong><small>${list.length}</small></div>
                            ${list.length ? list.map((task, index) => this.renderRehabTaskRow(plan.id, task, index + 1, false)).join('') : '<div class="rehab-empty">暂无</div>'}
                        </section>
                    `).join('')}
                    <button class="rehab-expand-btn" type="button" onclick="data.toggleRehabTodayExpanded()">收起列表 <span class="material-symbols-rounded">expand_less</span></button>
                `}
                ${this.renderRehabManualStrip()}
            </div>`;
        },

        renderRehabTaskRow(planId, task, index, compact = false) {
            const doneMeta = task.feedback?.doneAt ? `<small>${formatTime(task.feedback.doneAt)} · ${this.escapeHtml(task.feedback?.note || '')}</small>` : '';
            return `<div class="rehab-task-row ${task.status === 'done' ? 'is-done' : ''} ${task.status === 'in-progress' ? 'is-current' : ''}">
                <button class="rehab-task-main" type="button" onclick="data.handleRehabTaskTap('${planId}','${task.id}')">
                    <span class="rehab-task-order">${index}</span>
                    <span class="rehab-task-body">
                        <strong>${this.escapeHtml(task.name || '未命名任务')}</strong>
                        <small>${task.spec.sets}组 · ${task.spec.reps > 0 ? `${task.spec.reps}次` : `${task.spec.work}秒`}${task.currentLevel ? ` · Lv${task.currentLevel}` : ''}${task.userOverride ? ' · 已锁定' : ''}</small>
                        ${!compact && doneMeta}
                    </span>
                </button>
                <div class="rehab-task-actions">
                    <button class="md-icon-btn" type="button" onclick="event.stopPropagation();data.openRehabTaskEdit('${planId}','${task.id}')" aria-label="编辑参数"><span class="material-symbols-rounded">tune</span></button>
                    <button class="md-icon-btn" type="button" onclick="event.stopPropagation();data.markRehabTaskDone('${planId}','${task.id}')" aria-label="手动完成"><span class="material-symbols-rounded">done</span></button>
                    <button class="md-icon-btn" type="button" onclick="event.stopPropagation();data.openRehabTaskMenu('${planId}','${task.id}')" aria-label="更多"><span class="material-symbols-rounded">more_vert</span></button>
                </div>
            </div>`;
        },

        renderRehabManualStrip() {
            return `<div class="rehab-manual-strip">
                <div class="rehab-manual-divider">┄ 手动记录 ┄</div>
                <div class="rehab-manual-actions">
                    <button class="md-chip rehab-manual-chip" type="button" data-rehab-quick="strength" onclick="data.openRehabQuickRecord('strength')">💪 力量</button>
                    <button class="md-chip rehab-manual-chip" type="button" data-rehab-quick="cardio" onclick="data.openRehabQuickRecord('cardio')">🏃 有氧</button>
                    <button class="md-chip rehab-manual-chip" type="button" data-rehab-quick="weight" onclick="data.openRehabQuickRecord('weight')">⚖️ 体重</button>
                    <button class="md-chip rehab-manual-chip" type="button" data-rehab-quick="diet" onclick="data.openRehabQuickRecord('diet')">🍱 饮食</button>
                </div>
            </div>`;
        },

        toggleRehabTodayExpanded() {
            this.rehabTodayExpanded = !this.rehabTodayExpanded;
            this.renderTodayPage?.();
        },

        openRehabQuickRecord(type) {
            if (type === 'weight') return this.openWeightModal?.();
            if (type === 'diet') return this.openDietModal?.();
            if (type === 'cardio') return this.openExerciseModal?.();
            if (type === 'strength') {
                ui.tab('workout', navButton('workout'));
                requestAnimationFrame(() => {
                    window.workout?.setMode?.('strengthLog');
                    document.getElementById('slName')?.focus?.();
                });
            }
        },

        openRehabTaskEdit(planId, taskId) {
            const { task } = this.findTask?.(planId, taskId) || {};
            if (!task) return;
            const current = task.spec || {};
            this._openModal?.({
                title: '调整任务参数',
                icon: 'tune',
                bodyHtml: `
                    <div class="md-grid modal-grid" style="gap:10px">
                        <div class="md-field"><input id="rehabEditSets" type="number" placeholder=" " value="${Number(current.sets || 1)}"><label>组数</label></div>
                        <div class="md-field"><input id="rehabEditReps" type="number" placeholder=" " value="${Number(current.reps || 0)}"><label>次数</label></div>
                        <div class="md-field"><input id="rehabEditWork" type="number" placeholder=" " value="${Number(current.work || 0)}"><label>时长（秒）</label></div>
                        <div class="md-field"><input id="rehabEditRest" type="number" placeholder=" " value="${Number(current.actionRest || 0)}"><label>组间休息</label></div>
                    </div>`,
                actionsHtml: `
                    <button class="md-btn" type="button" data-modal-close>取消</button>
                    <button class="md-btn md-btn-filled" type="button" onclick="data.saveRehabTaskEdit('${planId}','${taskId}')">保存</button>
                `
            });
        },

        saveRehabTaskEdit(planId, taskId) {
            const { plan, task } = this.findTask?.(planId, taskId) || {};
            if (!plan || !task) return;
            task.spec = {
                ...task.spec,
                sets: Math.max(1, Number(document.getElementById('rehabEditSets')?.value || task.spec.sets || 1)),
                reps: Math.max(0, Number(document.getElementById('rehabEditReps')?.value || task.spec.reps || 0)),
                work: Math.max(0, Number(document.getElementById('rehabEditWork')?.value || task.spec.work || 0)),
                actionRest: Math.max(0, Number(document.getElementById('rehabEditRest')?.value || task.spec.actionRest || 0))
            };
            const prefs = this.ensureRehabPrefs?.() || {};
            if (prefs.askOnEdit === 'lock_default') task.userOverride = true;
            if (prefs.askOnEdit === 'pass_default') task.userOverride = false;
            this.touchRecord(task, ['spec', 'userOverride']);
            this.touchRecord(plan, ['items']);
            this.save();
            this._closeActiveModal?.();
        },

        markRehabTaskDone(planId, taskId) {
            this.updateItemStatus?.(planId, taskId, 'done');
            this.openRehabFeedback?.(planId, taskId);
            this.render?.();
        },

        openRehabTaskMenu(planId, taskId) {
            const { task } = this.findTask?.(planId, taskId) || {};
            if (!task) return;
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowKey = this.dateKey(tomorrow);
            this._openModal?.({
                title: this.escapeHtml(task.name || '任务'),
                icon: 'more_vert',
                bodyHtml: `<div class="weekly-plan-picker">
                    <button class="model-picker-row" type="button" onclick="data.moveRehabTaskTo('${planId}','${taskId}','${this.logicalDateKey?.() || this.dateKey(new Date())}')"><span class="material-symbols-rounded">today</span><span class="model-picker-main"><strong>移到今天</strong><small>回到当前日期执行</small></span></button>
                    <button class="model-picker-row" type="button" onclick="data.moveRehabTaskTo('${planId}','${taskId}','${tomorrowKey}')"><span class="material-symbols-rounded">event</span><span class="model-picker-main"><strong>移到明天</strong><small>延后一天执行</small></span></button>
                    <button class="model-picker-row" type="button" onclick="data.toggleRehabTaskLock('${planId}','${taskId}')"><span class="material-symbols-rounded">${task.userOverride ? 'lock_open' : 'lock'}</span><span class="model-picker-main"><strong>${task.userOverride ? '取消锁定' : '锁定任务'}</strong><small>锁定后 AI 不覆盖</small></span></button>
                    <button class="model-picker-row" type="button" onclick="data.deleteRehabTaskConfirm('${planId}','${taskId}')"><span class="material-symbols-rounded">delete</span><span class="model-picker-main"><strong>删除任务</strong><small>软删除，可同步</small></span></button>
                </div>`,
                actionsHtml: `<button class="md-btn" type="button" data-modal-close>关闭</button>`
            });
        },

        moveRehabTaskTo(planId, taskId, targetDate) {
            this.moveTask?.(planId, taskId, targetDate);
            this._closeActiveModal?.();
            this.render?.();
        },

        toggleRehabTaskLock(planId, taskId) {
            const { task } = this.findTask?.(planId, taskId) || {};
            if (!task) return;
            this.lockItem?.(planId, taskId, !task.userOverride);
            this._closeActiveModal?.();
            this.render?.();
        },

        deleteRehabTaskConfirm(planId, taskId) {
            this.deleteTask?.(planId, taskId);
            this._closeActiveModal?.();
            this.render?.();
        },

        async handleRehabTaskTap(planId, taskId) {
            const { task } = this.findTask?.(planId, taskId) || {};
            if (!task) return;
            if (window.workout?.isPlaying) {
                const ok = confirm('正在训练，切换到康复任务？');
                if (!ok) return;
                window.workout.stop?.();
            }
            await this.runRehabTask(planId, taskId);
        },

        buildWorkoutActionFromRehabTask(task, options = {}) {
            const spec = task.spec || {};
            return {
                id: `rehab-run-${task.id}`,
                sourceActionId: task.id,
                name: options.asCooldown ? `康复·放松·${task.name}` : `康复·${task.name}`,
                sets: Math.max(1, Number(spec.sets || 1)),
                reps: Math.max(0, Number(spec.reps || 0)),
                work: Math.max(0, Number(spec.work || 0)),
                repRest: Math.max(0, Number(spec.repRest || 0)),
                actionRest: Math.max(0, Number(spec.actionRest || 0)),
                groupRest: Math.max(0, Number(spec.actionRest || 0)),
                switchRest: 3,
                isAlt: !!spec.isAlt,
                phase: options.asCooldown ? 'cooldown' : 'main',
                libOnly: false,
                deleted: false,
                updatedAt: Date.now(),
                rehab: true,
                excludeFromPr: true
            };
        },

        async runRehabTask(planId, taskId, options = {}) {
            const { plan, task } = this.findTask?.(planId, taskId) || {};
            if (!plan || !task) return;
            this.updateItemStatus?.(planId, taskId, 'in-progress', {}, { save: false });
            const previousPlan = JSON.parse(JSON.stringify(this._planActions?.() || []));
            this.activeRun = {
                planId,
                taskId,
                previousPlan,
                queueFollowup: !!options.queueFollowup,
                asCooldown: !!options.asCooldown
            };
            this._replacePlanActions?.([this.buildWorkoutActionFromRehabTask(task, options)]);
            this.save();
            await ui.tab('workout', navButton('workout'));
            requestAnimationFrame(() => {
                window.workout?.setMode?.('strength');
                this.renderWorkoutPlanCard?.();
                this.renderActions?.();
                this.updateRehabWorkoutBanner?.();
                if (!window.workout?.isPlaying) window.workout?.toggle?.();
            });
        },

        updateRehabWorkoutBanner() {
            const banner = document.getElementById('rehabWorkoutBanner');
            if (!banner) return;
            const ctx = this.activeRun;
            if (!ctx) {
                banner.classList.add('hidden');
                banner.innerHTML = '';
                return;
            }
            const { plan, task } = this.findTask?.(ctx.planId, ctx.taskId) || {};
            if (!plan || !task) return;
            const completion = this.completionRate?.(plan) || { done: 0, total: 0 };
            banner.classList.remove('hidden');
            banner.innerHTML = `<span class="material-symbols-rounded">health_and_safety</span><strong>康复任务 · ${this.escapeHtml(task.name || '')}</strong><small>${completion.done}/${completion.total || 0} 完成</small>`;
        },

        handleRehabWorkoutFinished(historyRecord) {
            const ctx = this.activeRun;
            if (!ctx) return;
            const { plan, task } = this.findTask?.(ctx.planId, ctx.taskId) || {};
            if (!plan || !task) {
                this.activeRun = null;
                this.updateRehabWorkoutBanner?.();
                return;
            }
            historyRecord.rehab = true;
            historyRecord.rehabPlanId = ctx.planId;
            historyRecord.rehabTaskId = ctx.taskId;
            historyRecord.rehabCooldown = !!ctx.asCooldown;
            this.updateItemStatus?.(ctx.planId, ctx.taskId, 'done', { doneSets: Number(task.spec?.sets || 1) }, { save: false });
            if (ctx.previousPlan) this._replacePlanActions?.(ctx.previousPlan);
            this.save();
            this.updateRehabWorkoutBanner?.();
            const queueFollowup = !!ctx.queueFollowup;
            const planId = ctx.planId;
            const isCooldown = !!ctx.asCooldown;
            this._rehabSaveRoutineManualStop = !!historyRecord.manualStop;
            this.activeRun = null;
            if (!isCooldown) this.openRehabFeedback?.(planId, ctx.taskId);
            else if (!queueFollowup) this.maybePromptSaveRehabRoutine?.({ manualStop: !!historyRecord.manualStop });
            if (queueFollowup) {
                const next = this.getTodayDailyPlan?.()?.pendingCooldowns?.[0];
                if (next) {
                    setTimeout(() => this.runQueuedCooldown?.(next), 500);
                } else if (isCooldown) {
                    this.maybePromptSaveRehabRoutine?.({ manualStop: !!historyRecord.manualStop });
                }
            }
        },

        maybePromptSaveRehabRoutine(options = {}) {
            const plan = this.getTodayDailyPlan?.();
            if (!plan) return;
            const completion = this.completionRate?.(plan) || { rate: 0, done: 0, total: 0 };
            if (!completion.total || completion.rate < 0.8) {
                this._rehabSaveRoutineManualStop = false;
                return;
            }
            const hour = new Date().getHours();
            const manualStop = !!(options === true || options.force || options.manualStop || this._rehabSaveRoutineManualStop);
            this._rehabSaveRoutineManualStop = false;
            if (!manualStop && hour < 23) return;
            if (plan.rehabRoutineSavedAt || plan.rehabRoutineDismissedAt) return;
            this._openModal?.({
                title: '保存为方案',
                icon: 'bookmark_add',
                bodyHtml: `<div class="rehab-save-routine-sheet">
                    <p>今日康复 ${completion.done}/${completion.total} 完成，存为方案？</p>
                    <small>保存后会进入方案库，并带有康复标记。</small>
                </div>`,
                actionsHtml: `
                    <button class="md-btn" type="button" data-rehab-save-dismiss>不用</button>
                    <button class="md-btn md-btn-tonal" type="button" data-rehab-save-rename>改名后存</button>
                    <button class="md-btn md-btn-filled" type="button" data-rehab-save-default>默认存</button>
                `,
                onMount: (root, close) => {
                    root.querySelector('[data-rehab-save-dismiss]')?.addEventListener('click', () => {
                        plan.rehabRoutineDismissedAt = Date.now();
                        this.touchRecord(plan, ['rehabRoutineDismissedAt']);
                        this.save();
                        close();
                    });
                    root.querySelector('[data-rehab-save-default]')?.addEventListener('click', () => {
                        this.saveRehabPlanAsRoutine();
                        close();
                    });
                    root.querySelector('[data-rehab-save-rename]')?.addEventListener('click', () => {
                        close();
                        this._textPromptModal?.({
                            title: '方案名称',
                            icon: 'edit',
                            label: '方案名称',
                            initialValue: `康复计划 ${plan.date}`,
                            okText: '保存',
                            cancelText: '取消',
                            onOk: (name) => this.saveRehabPlanAsRoutine(name)
                        });
                    });
                }
            });
        },

        saveRehabPlanAsRoutine(name = '') {
            const plan = this.getTodayDailyPlan?.();
            if (!plan) return;
            const routineName = name || `康复计划 ${plan.date}`;
            if (plan.rehabRoutineSavedAt) {
                window.toast?.show?.('今天的康复计划已保存过', 'info');
                return;
            }
            const actions = (plan.items || []).filter((item) => !item.deleted).map((item) => this.buildWorkoutActionFromRehabTask(item, { asCooldown: item.category === 'cooldown' }));
            const routine = {
                name: routineName,
                rehab: true,
                rehabPlanId: plan.id,
                actions,
                tags: ['康复计划'],
                created: new Date().toLocaleDateString(),
                id: this.generateRecordId('routine'),
                updatedAt: Date.now(),
                deleted: false
            };
            this.db.routines.push(routine);
            plan.rehabRoutineSavedAt = Date.now();
            plan.rehabRoutineId = routine.id;
            this.touchRecord(plan, ['rehabRoutineSavedAt', 'rehabRoutineId']);
            this.save();
            window.toast?.show?.(`已存入方案库：${routineName}`, 'success');
        },

        bindRehabQuickRepeat() {
            if (this._rehabQuickRepeatBound) return;
            this._rehabQuickRepeatBound = true;
            let timer = 0;
            let targetType = '';
            document.addEventListener('pointerdown', (event) => {
                const btn = event.target?.closest?.('.rehab-manual-chip');
                if (!btn) return;
                targetType = btn.getAttribute('data-rehab-quick') || '';
                timer = window.setTimeout(() => this.openRehabQuickRepeat(targetType), 1000);
            }, true);
            const clear = () => {
                clearTimeout(timer);
                timer = 0;
                targetType = '';
            };
            document.addEventListener('pointerup', clear, true);
            document.addEventListener('pointercancel', clear, true);
            document.addEventListener('pointerleave', clear, true);
        },

        openRehabQuickRepeat(type) {
            if (!type) return;
            const rows = type === 'weight'
                ? this.sortedWeights?.().slice(-5).reverse().map((item) => ({
                    title: `${Number(item.weight || 0).toFixed(1)} kg`,
                    meta: item.note || item.date,
                    onClick: () => {
                        this.openWeightModal?.();
                        setTimeout(() => {
                            const input = document.getElementById('weightInput');
                            if (input) input.value = String(item.weight || '');
                        }, 80);
                    }
                }))
                : type === 'diet'
                    ? this.activeRecords(this.db.health.foodLogs || []).slice(-5).reverse().map((item) => ({
                        title: item.name || '饮食记录',
                        meta: `${item.cal || 0} kcal`,
                        onClick: () => this.openDietModal?.()
                    }))
                    : type === 'cardio'
                        ? this.activeRecords(this.db.health.exerciseLogs || []).slice(-5).reverse().map((item) => ({
                            title: this.exerciseLabel?.(item.type, item) || '有氧',
                            meta: `${item.minutes || 0} 分钟`,
                            onClick: () => this.openExerciseModal?.()
                        }))
                        : this.activeRecords(this.db.history || []).slice(-5).reverse().map((item) => ({
                            title: this.historyNames?.(item)?.[0] || '力量记录',
                            meta: `${Math.round((item.duration || 0) / 60)} 分钟`,
                            onClick: () => this.openRehabQuickRecord('strength')
                        }));
            if (!rows.length) return;
            this._openModal?.({
                title: '快速重复',
                icon: 'history',
                bodyHtml: rows.map((row) => `<button class="model-picker-row" type="button"><span class="material-symbols-rounded">history</span><span class="model-picker-main"><strong>${this.escapeHtml(row.title || '')}</strong><small>${this.escapeHtml(row.meta || '')}</small></span></button>`).join(''),
                actionsHtml: '<button class="md-btn" type="button" data-modal-close>关闭</button>',
                onMount: (root, close) => {
                    root.querySelectorAll('.model-picker-row').forEach((btn, index) => {
                        btn.addEventListener('click', () => {
                            rows[index]?.onClick?.();
                            close();
                        });
                    });
                }
            });
        }
    });
})();
