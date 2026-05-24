// @ts-nocheck
(function () {
    if (window.dataRehabStore) return;

    const PREF_DEFAULTS = {
        stage: 'unset',
        equipment: [],
        cooldownMode: 'attached',
        askOnEdit: 'always',
        askBeforeProgression: true,
        showCooldownDock: true,
        showWeeklyDock: true
    };

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function esc(value) {
        return window.renderSafe?.escapeHtml ? window.renderSafe.escapeHtml(value) : String(value ?? '');
    }

    function uniq(values = []) {
        return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))];
    }

    function todayKey(date = new Date()) {
        return window.data?.dateKey ? data.dateKey(date) : new Date(date).toISOString().slice(0, 10);
    }

    function normalizePrefs(raw = {}) {
        return {
            ...PREF_DEFAULTS,
            ...(raw && typeof raw === 'object' ? raw : {}),
            equipment: uniq(raw?.equipment)
        };
    }

    const api = {
        rehabTodayExpanded: false,
        activeRun: null,
        lastProgressionSuggestion: null,

        ensureRehabPrefs() {
            this.db.prefs = this.db.prefs && typeof this.db.prefs === 'object' ? this.db.prefs : {};
            this.db.prefs.rehab = normalizePrefs(this.db.prefs.rehab);
            return this.db.prefs.rehab;
        },

        ensureRehabBootstrap() {
            this.ensureRehabPrefs();
            this.db.dailyPlans = Array.isArray(this.db.dailyPlans) ? this.db.dailyPlans : [];
            this.db.progressionChains = Array.isArray(this.db.progressionChains) ? this.db.progressionChains : [];
            if (!this.db.progressionChains.length && window.rehabChains?.builtin?.length) {
                this.db.progressionChains = window.rehabChains.builtin.map((chain) => ({
                    ...clone(chain),
                    updatedAt: Date.now(),
                    deleted: false
                }));
            }
        },

        ensureDailyPlanShape(plan = {}, options = {}) {
            const nowTs = Number(options.nowTs || Date.now());
            const items = (Array.isArray(plan.items) ? plan.items : []).map((item) => this.ensureTaskShape(item, { nowTs }));
            const next = {
                id: plan.id || this.generateRecordId('rehab-plan'),
                date: String(plan.date || todayKey()),
                source: ['ai', 'manual', 'rehab-center'].includes(plan.source) ? plan.source : 'manual',
                notes: String(plan.notes || ''),
                items,
                pendingCooldowns: uniq(plan.pendingCooldowns).filter((id) => items.some((item) => item.id === id)),
                createdAt: Number(plan.createdAt || nowTs),
                updatedAt: Number(plan.updatedAt || nowTs),
                deleted: !!plan.deleted,
                __fieldUpdatedAt: plan.__fieldUpdatedAt && typeof plan.__fieldUpdatedAt === 'object' ? plan.__fieldUpdatedAt : {}
            };
            this.ensureRecordMeta(next, 'rehab-plan', nowTs);
            return next;
        },

        ensureTaskShape(item = {}, options = {}) {
            const nowTs = Number(options.nowTs || Date.now());
            const spec = item?.spec && typeof item.spec === 'object' ? item.spec : {};
            const next = {
                id: item.id || this.generateRecordId('rehab-task'),
                name: String(item.name || '未命名任务'),
                category: item.category === 'cooldown' ? 'cooldown' : 'main',
                spec: {
                    sets: Math.max(1, Number(spec.sets || 1)),
                    reps: Math.max(0, Number(spec.reps || 0)),
                    work: Math.max(0, Number(spec.work || 0)),
                    repRest: Math.max(0, Number(spec.repRest || 0)),
                    actionRest: Math.max(0, Number(spec.actionRest || 0)),
                    isAlt: !!spec.isAlt,
                    ...(spec.weight != null ? { weight: Number(spec.weight || 0) } : {})
                },
                chainId: item.chainId ? String(item.chainId) : '',
                currentLevel: item.currentLevel == null ? null : Math.max(1, Number(item.currentLevel || 1)),
                status: ['todo', 'in-progress', 'done', 'skipped'].includes(item.status) ? item.status : 'todo',
                doneSets: Math.max(0, Number(item.doneSets || 0)),
                feedback: item.feedback && typeof item.feedback === 'object'
                    ? {
                        rpe: [1, 2, 3, 4, 5].includes(Number(item.feedback.rpe)) ? Number(item.feedback.rpe) : null,
                        note: String(item.feedback.note || ''),
                        doneAt: Number(item.feedback.doneAt || 0)
                    }
                    : null,
                cooldownRefs: uniq(item.cooldownRefs),
                userOverride: !!item.userOverride,
                excludeFromPr: item.excludeFromPr !== false,
                aiReasoning: String(item.aiReasoning || ''),
                durationEstHint: String(item.durationEstHint || ''),
                updatedAt: Number(item.updatedAt || nowTs),
                deleted: !!item.deleted,
                __fieldUpdatedAt: item.__fieldUpdatedAt && typeof item.__fieldUpdatedAt === 'object' ? item.__fieldUpdatedAt : {}
            };
            this.ensureRecordMeta(next, 'rehab-task', nowTs);
            return next;
        },

        createDailyPlan(input = {}, options = {}) {
            this.ensureRehabBootstrap();
            const plan = this.ensureDailyPlanShape({
                source: 'manual',
                date: todayKey(),
                notes: '',
                items: [],
                pendingCooldowns: [],
                ...clone(input)
            });
            const existingIndex = this.db.dailyPlans.findIndex((item) => item.id === plan.id || (!item.deleted && item.date === plan.date));
            if (existingIndex >= 0) this.db.dailyPlans[existingIndex] = plan;
            else this.db.dailyPlans.unshift(plan);
            this.touchRecord(plan, ['date', 'items', 'notes', 'source', 'pendingCooldowns']);
            if (options.save !== false) this.save({ render: options.render !== false });
            return plan;
        },

        saveDailyPlan(plan = {}, options = {}) {
            this.ensureRehabBootstrap();
            const next = this.ensureDailyPlanShape(plan);
            const index = this.db.dailyPlans.findIndex((item) => item.id === next.id || (!item.deleted && item.date === next.date));
            if (index >= 0) this.db.dailyPlans[index] = next;
            else this.db.dailyPlans.unshift(next);
            this.touchRecord(next, ['date', 'items', 'notes', 'source', 'pendingCooldowns']);
            if (options.save !== false) this.save();
            return next;
        },

        getDailyPlan(date = todayKey()) {
            this.ensureRehabBootstrap();
            return this.activeRecords(this.db.dailyPlans).find((plan) => plan.date === date) || null;
        },

        getTodayDailyPlan() {
            return this.getDailyPlan(todayKey());
        },

        ensureTodayPlan() {
            let plan = this.getTodayDailyPlan();
            if (!plan) {
                plan = this.createDailyPlan({
                    date: todayKey(),
                    source: 'manual',
                    items: this.seedTasksFromPrefs()
                }, { render: false });
            }
            return plan;
        },

        seedTasksFromPrefs() {
            const prefs = this.ensureRehabPrefs();
            const equipment = new Set(prefs.equipment || []);
            const chains = this.activeRecords(this.db.progressionChains || []).slice(0, 4);
            return chains.map((chain) => {
                const levels = Array.isArray(chain.levels) ? chain.levels : [];
                const level = levels.find((item) => (item.requiredEquipment || []).every((name) => equipment.has(name))) || levels[0];
                const isHold = /保持|静蹲|站立/.test(level?.name || '');
                return this.ensureTaskShape({
                    name: level?.name || chain.group,
                    category: 'main',
                    chainId: chain.id,
                    currentLevel: Number(level?.lv || 1),
                    spec: isHold
                        ? { sets: 3, reps: 0, work: 30, repRest: 30, actionRest: 90, isAlt: false }
                        : { sets: 3, reps: 12, work: 0, repRest: 20, actionRest: 90, isAlt: false },
                    cooldownRefs: [],
                    excludeFromPr: true
                });
            });
        },

        findTask(planId, taskId) {
            const plan = this.activeRecords(this.db.dailyPlans).find((item) => item.id === planId);
            if (!plan) return { plan: null, task: null };
            const task = (plan.items || []).find((item) => item.id === taskId && !item.deleted) || null;
            return { plan, task };
        },

        updateItemStatus(planId, taskId, status, extra = {}, options = {}) {
            const found = this.findTask(planId, taskId);
            if (!found.plan || !found.task) return null;
            found.task.status = status;
            if (status === 'done') {
                found.task.doneSets = Math.max(Number(found.task.doneSets || 0), Number(extra.doneSets || found.task.spec?.sets || 1));
            } else if (extra.doneSets != null) {
                found.task.doneSets = Math.max(0, Number(extra.doneSets || 0));
            }
            Object.assign(found.task, extra || {});
            this.touchRecord(found.task, ['status', 'doneSets', ...Object.keys(extra || {})]);
            this.touchRecord(found.plan, ['items']);
            if (options.save !== false) this.save();
            return found.task;
        },

        addFeedback(planId, taskId, feedback = {}, options = {}) {
            const found = this.findTask(planId, taskId);
            if (!found.plan || !found.task) return null;
            found.task.feedback = {
                rpe: [1, 2, 3, 4, 5].includes(Number(feedback.rpe)) ? Number(feedback.rpe) : null,
                note: String(feedback.note || ''),
                doneAt: Number(feedback.doneAt || Date.now())
            };
            this.touchRecord(found.task, ['feedback']);
            this.touchRecord(found.plan, ['items']);
            if (options.save !== false) this.save();
            return found.task.feedback;
        },

        lockItem(planId, taskId, locked = true, options = {}) {
            const found = this.findTask(planId, taskId);
            if (!found.plan || !found.task) return null;
            found.task.userOverride = !!locked;
            this.touchRecord(found.task, ['userOverride']);
            this.touchRecord(found.plan, ['items']);
            if (options.save !== false) this.save();
            return found.task;
        },

        completionRate(plan = this.getTodayDailyPlan()) {
            const items = (plan?.items || []).filter((item) => item && !item.deleted && item.category !== 'cooldown');
            if (!items.length) return { done: 0, total: 0, rate: 0 };
            const done = items.filter((item) => item.status === 'done').length;
            return { done, total: items.length, rate: done / items.length };
        },

        pendingCooldownCount(plan = this.getTodayDailyPlan()) {
            return Array.isArray(plan?.pendingCooldowns) ? plan.pendingCooldowns.length : 0;
        },

        buildFeedbackHistory(chainId = '') {
            return this.activeRecords(this.db.dailyPlans || [])
                .flatMap((plan) => (plan.items || []).map((item) => ({ plan, item })))
                .filter(({ item }) => item && item.chainId === chainId && item.feedback?.rpe)
                .map(({ item }) => item.feedback);
        },

        maybeApplyProgression(planId, taskId) {
            const { plan, task } = this.findTask(planId, taskId);
            if (!plan || !task || !task.chainId) return null;
            const chain = this.activeRecords(this.db.progressionChains || []).find((item) => item.id === task.chainId) || window.rehabChains?.find?.(task.chainId);
            if (!chain) return null;
            const result = window.rehabProgression?.evaluate?.({
                taskItem: task,
                chain,
                history: this.buildFeedbackHistory(task.chainId),
                userOverride: task.userOverride
            }) || null;
            if (!result || result.suggestion === 'maintain') return result;
            this.lastProgressionSuggestion = { planId, taskId, result };
            const apply = () => {
                if (result.targetLevel && result.targetLevel !== task.currentLevel) {
                    task.currentLevel = result.targetLevel;
                    const target = (chain.levels || []).find((item) => Number(item.lv) === Number(result.targetLevel));
                    if (target?.name) task.name = target.name;
                }
                if (result.fallbackSpec) {
                    task.spec = { ...task.spec, ...result.fallbackSpec };
                }
                this.touchRecord(task, ['currentLevel', 'name', 'spec']);
                this.touchRecord(plan, ['items']);
                this.save();
                window.toast?.show?.(result.reason, 'success');
            };
            if (this.ensureRehabPrefs().askBeforeProgression) {
                this._confirmModal?.({
                    title: '进阶建议',
                    icon: result.suggestion === 'upgrade' ? 'trending_up' : 'trending_down',
                    message: result.reason,
                    okText: '应用',
                    cancelText: '稍后',
                    onOk: apply
                });
            } else {
                apply();
            }
            return result;
        },

        queueCooldown(planId, taskId, options = {}) {
            const { plan } = this.findTask(planId, taskId);
            if (!plan) return;
            plan.pendingCooldowns = uniq([...(plan.pendingCooldowns || []), taskId]);
            this.touchRecord(plan, ['pendingCooldowns']);
            if (options.save !== false) this.save();
        },

        dequeueCooldown(planId, taskId, options = {}) {
            const { plan } = this.findTask(planId, taskId);
            if (!plan) return;
            plan.pendingCooldowns = (plan.pendingCooldowns || []).filter((id) => id !== taskId);
            this.touchRecord(plan, ['pendingCooldowns']);
            if (options.save !== false) this.save();
        },

        moveTask(planId, taskId, targetDate) {
            const { plan, task } = this.findTask(planId, taskId);
            if (!plan || !task || !targetDate) return false;
            plan.items = (plan.items || []).filter((item) => item.id !== taskId);
            this.touchRecord(plan, ['items']);
            let target = this.getDailyPlan(targetDate);
            if (!target) target = this.createDailyPlan({ date: targetDate, source: 'manual', items: [] });
            target.items.push(this.ensureTaskShape({ ...clone(task), status: 'todo', doneSets: 0, feedback: null }));
            this.touchRecord(target, ['items']);
            this.save();
            return true;
        },

        deleteTask(planId, taskId) {
            const { plan, task } = this.findTask(planId, taskId);
            if (!plan || !task) return false;
            task.deleted = true;
            this.touchRecord(task, ['deleted']);
            this.touchRecord(plan, ['items']);
            this.save();
            return true;
        },

        todayKey,
        esc
    };

    window.dataRehabStore = api;
})();
