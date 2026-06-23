// @ts-nocheck
(function () {
    if (window.dataPlanStore) return;

    const PREF_DEFAULTS = {
        stage: 'unset',
        customStageLabel: '',
        equipment: [],
        customEquipment: [],
        cooldownMode: 'attached',
        askOnEdit: 'always',
        askBeforeProgression: true,
        showCooldownDock: true,
        showWeeklyDock: true
    };
    const PLAN_TYPES = ['rehab', 'cut', 'bulk', 'maintenance', 'custom'];

    function planTypeMeta(type = 'rehab', title = '') {
        const key = PLAN_TYPES.includes(type) ? type : 'rehab';
        const map = {
            rehab: { label: '康复计划', taskLabel: '康复任务', cooldownLabel: '放松', icon: 'self_improvement', className: 'is-rehab' },
            cut: { label: '减脂日程', taskLabel: '减脂任务', cooldownLabel: '拉伸', icon: 'local_fire_department', className: 'is-cut' },
            bulk: { label: '增肌日程', taskLabel: '增肌任务', cooldownLabel: '整理组', icon: 'fitness_center', className: 'is-bulk' },
            maintenance: { label: '综合训练', taskLabel: '训练任务', cooldownLabel: '放松', icon: 'health_and_safety', className: 'is-maintenance' },
            custom: { label: title || '自定义计划', taskLabel: '任务', cooldownLabel: '放松', icon: 'event_note', className: 'is-custom' }
        };
        return map[key];
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function esc(value) {
        return window.renderSafe?.escapeHtml ? window.renderSafe.escapeHtml(value) : String(value ?? '');
    }

    function uniq(values = []) {
        return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))];
    }

    function normalizeTaskCategory(value = 'main') {
        const raw = String(value || '').trim().toLowerCase();
        if (['warmup', 'warm-up', '热身'].includes(raw)) return 'warmup';
        if (['cooldown', 'cool-down', 'stretch', 'stretching', '拉伸', '放松'].includes(raw)) return 'cooldown';
        return 'main';
    }

    function normalizeTaskFeedback(feedback = {}, defaultDoneAt = 0) {
        if (!feedback || typeof feedback !== 'object') return null;
        const painScoreRaw = Number(feedback.painScore ?? feedback.painLevel ?? feedback.pain ?? NaN);
        const wantsContinue = feedback.wantsContinue === true ? true : feedback.wantsContinue === false ? false : null;
        return {
            rpe: [1, 2, 3, 4, 5].includes(Number(feedback.rpe)) ? Number(feedback.rpe) : null,
            painScore: Number.isFinite(painScoreRaw) ? Math.max(0, Math.min(10, painScoreRaw)) : null,
            painPart: String(feedback.painPart || feedback.painBodyPart || feedback.painLocation || ''),
            wantsContinue,
            noIncrease: !!(feedback.noIncrease || feedback.dontIncrease),
            keepNextTime: !!feedback.keepNextTime,
            unsuitable: !!feedback.unsuitable,
            note: String(feedback.note || ''),
            doneAt: Number(feedback.doneAt || defaultDoneAt || 0)
        };
    }

    function normalizeCustomEquipment(values = []) {
        return (Array.isArray(values) ? values : [])
            .map((item) => {
                if (typeof item === 'string') {
                    const label = item.trim();
                    return label ? { id: `custom_${label}`, label, icon: 'inventory_2' } : null;
                }
                if (!item || typeof item !== 'object') return null;
                const label = String(item.label || item.name || '').trim();
                if (!label) return null;
                const id = String(item.id || `custom_${label}`).trim();
                return {
                    id,
                    label,
                    icon: String(item.icon || 'inventory_2').trim() || 'inventory_2'
                };
            })
            .filter(Boolean)
            .filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index);
    }

    function todayKey(date = new Date()) {
        return window.data?.dateKey ? data.dateKey(date) : new Date(date).toISOString().slice(0, 10);
    }

    function normalizePrefs(raw = {}) {
        const stage = ['unset', 'post_op', 'post_op_4w', 'post_op_8w', 'cutting', 'bulking', 'maintenance', 'chronic', 'custom'].includes(raw?.stage)
            ? raw.stage
            : 'unset';
        return {
            ...PREF_DEFAULTS,
            ...(raw && typeof raw === 'object' ? raw : {}),
            stage,
            customStageLabel: String(raw?.customStageLabel || ''),
            equipment: uniq(raw?.equipment),
            customEquipment: normalizeCustomEquipment(raw?.customEquipment)
        };
    }

    const api = {
        planTodayExpanded: false,
        activeRun: null,
        lastProgressionSuggestion: null,
        selectedPlanId: '',
        planTypeMeta,

        ensurePlanPrefs() {
            this.db.prefs = this.db.prefs && typeof this.db.prefs === 'object' ? this.db.prefs : {};
            if (!this.db.prefs.plan && this.db.prefs.rehab) {
                this.db.prefs.plan = normalizePrefs(this.db.prefs.rehab);
                delete this.db.prefs.rehab;
            } else {
                this.db.prefs.plan = normalizePrefs(this.db.prefs.plan);
                delete this.db.prefs.rehab;
            }
            return this.db.prefs.plan;
        },

        ensurePlanBootstrap() {
            this.ensurePlanPrefs();
            this.db.dailyPlans = Array.isArray(this.db.dailyPlans) ? this.db.dailyPlans : [];
            this.db.progressionChains = Array.isArray(this.db.progressionChains) ? this.db.progressionChains : [];
            if (!this.db.progressionChains.length && window.planChains?.builtin?.length) {
                this.db.progressionChains = window.planChains.builtin.map((chain) => ({
                    ...clone(chain),
                    updatedAt: Date.now(),
                    deleted: false
                }));
            }
            this.db.dailyPlans = this.db.dailyPlans.map((plan) => this.ensureDailyPlanShape(plan, { save: false }));
        },

        ensureDailyPlanShape(plan = {}, options = {}) {
            const nowTs = Number(options.nowTs || Date.now());
            const legacySource = plan.source === 'rehab-center';
            const type = PLAN_TYPES.includes(plan.type) ? plan.type : 'rehab';
            const title = String(plan.title || planTypeMeta(type).label);
            const items = (Array.isArray(plan.items) ? plan.items : []).map((item) => this.ensureTaskShape({ ...item, planType: item.planType || type }, { nowTs, planType: type }));
            const next = {
                id: plan.id || this.generateRecordId('daily-plan'),
                date: String(plan.date || todayKey()),
                type,
                title,
                source: legacySource ? 'manual' : (['ai', 'manual', 'imported'].includes(plan.source) ? plan.source : 'manual'),
                notes: String(plan.notes || ''),
                items,
                pendingCooldowns: uniq(plan.pendingCooldowns).filter((id) => items.some((item) => item.id === id)),
                createdAt: Number(plan.createdAt || nowTs),
                updatedAt: Number(plan.updatedAt || nowTs),
                deleted: !!plan.deleted,
                __fieldUpdatedAt: plan.__fieldUpdatedAt && typeof plan.__fieldUpdatedAt === 'object' ? plan.__fieldUpdatedAt : {}
            };
            this.ensureRecordMeta(next, 'daily-plan', nowTs);
            return next;
        },

        ensureTaskShape(item = {}, options = {}) {
            const nowTs = Number(options.nowTs || Date.now());
            const spec = item?.spec && typeof item.spec === 'object' ? item.spec : {};
            const meta = window.planPolicy?.actionMetaForName?.(`${item.name || ''} ${item.aiReasoning || ''}`) || {};
            let reps = Math.max(0, Number(spec.reps || 0));
            const work = Math.max(0, Number(spec.work || 0));
            // 计时/保持型动作（reps=0 但 work>0）需要至少 1 次循环，否则训练引擎会直接跳过
            if (reps <= 0 && work > 0) reps = 1;
            const invalidSpec = !item.deleted && (reps <= 0 && work <= 0);
            const next = {
                id: item.id || this.generateRecordId('daily-task'),
                name: String(item.name || '未命名任务'),
                planType: PLAN_TYPES.includes(item.planType) ? item.planType : (PLAN_TYPES.includes(options.planType) ? options.planType : 'rehab'),
                category: normalizeTaskCategory(item.category || item.phase || item.type || meta.categoryHint),
                spec: {
                    sets: Math.max(1, Number(spec.sets || 1)),
                    reps,
                    work,
                    repRest: Math.max(0, Number(spec.repRest || 0)),
                    actionRest: Math.max(0, Number(spec.actionRest || 0)),
                    isAlt: !!spec.isAlt,
                    ...(spec.mode ? { mode: String(spec.mode) } : {}),
                    ...(spec.weight != null ? { weight: Number(spec.weight || 0) } : {})
                },
                chainId: item.chainId ? String(item.chainId) : (meta.chainId || ''),
                actionKey: String(item.actionKey || meta.actionKey || ''),
                canonicalName: String(item.canonicalName || meta.canonicalName || item.name || ''),
                progressionGroup: String(item.progressionGroup || meta.progressionGroup || ''),
                progressionLevel: Number(item.progressionLevel ?? meta.progressionLevel ?? 0),
                invalidSpec,
                currentLevel: item.currentLevel == null ? null : Math.max(1, Number(item.currentLevel || 1)),
                status: ['todo', 'in-progress', 'done', 'skipped'].includes(item.status) ? item.status : 'todo',
                doneSets: Math.max(0, Number(item.doneSets || 0)),
                feedback: normalizeTaskFeedback(item.feedback, 0),
                cooldownRefs: uniq(item.cooldownRefs),
                userOverride: !!item.userOverride,
                requiresUserConfirm: !!item.requiresUserConfirm,
                userConfirmed: item.requiresUserConfirm ? item.userConfirmed === true : item.userConfirmed !== false,
                policy: item.policy && typeof item.policy === 'object' ? { ...item.policy } : null,
                excludeFromPr: item.excludeFromPr !== false,
                aiReasoning: String(item.aiReasoning || ''),
                durationEstHint: String(item.durationEstHint || ''),
                updatedAt: Number(item.updatedAt || nowTs),
                deleted: !!item.deleted,
                __fieldUpdatedAt: item.__fieldUpdatedAt && typeof item.__fieldUpdatedAt === 'object' ? item.__fieldUpdatedAt : {}
            };
            this.ensureRecordMeta(next, 'daily-task', nowTs);
            return next;
        },

        createDailyPlan(input = {}, options = {}) {
            this.ensurePlanBootstrap();
            const plan = this.ensureDailyPlanShape({
                source: 'manual',
                date: todayKey(),
                notes: '',
                items: [],
                pendingCooldowns: [],
                ...clone(input)
            });
            const existingIndex = this.db.dailyPlans.findIndex((item) => item.id === plan.id || (!item.deleted && item.date === plan.date && (item.type || 'rehab') === plan.type));
            if (existingIndex >= 0) this.db.dailyPlans[existingIndex] = plan;
            else this.db.dailyPlans.unshift(plan);
            this.touchRecord(plan, ['date', 'type', 'title', 'items', 'notes', 'source', 'pendingCooldowns']);
            if (options.save !== false) this.save({ render: options.render !== false });
            return plan;
        },

        saveDailyPlan(plan = {}, options = {}) {
            this.ensurePlanBootstrap();
            const next = this.ensureDailyPlanShape(plan);
            const index = this.db.dailyPlans.findIndex((item) => item.id === next.id || (!item.deleted && item.date === next.date && (item.type || 'rehab') === next.type));
            if (index >= 0) this.db.dailyPlans[index] = next;
            else this.db.dailyPlans.unshift(next);
            this.touchRecord(next, ['date', 'type', 'title', 'items', 'notes', 'source', 'pendingCooldowns']);
            if (options.save !== false) this.save();
            return next;
        },

        getDailyPlan(date = todayKey()) {
            this.ensurePlanBootstrap();
            return this.activeRecords(this.db.dailyPlans).find((plan) => plan.date === date) || null;
        },

        getDailyPlans(date = todayKey()) {
            this.ensurePlanBootstrap();
            return this.activeRecords(this.db.dailyPlans).filter((plan) => plan.date === date);
        },

        getTodayDailyPlan() {
            return this.getTodayDailyPlans?.()[0] || null;
        },

        getTodayDailyPlans(date = todayKey()) {
            return this.getDailyPlans(date);
        },

        ensureTodayPlan() {
            let plan = this.getTodayDailyPlan();
            if (!plan) {
                plan = this.createDailyPlan({
                    date: todayKey(),
                    source: 'manual',
                    type: 'rehab',
                    title: '康复计划',
                    items: this.seedTasksFromPrefs()
                }, { render: false });
            }
            return plan;
        },

        seedTasksFromPrefs() {
            const prefs = this.ensurePlanPrefs();
            const equipment = new Set(prefs.equipment || []);
            const chains = this.activeRecords(this.db.progressionChains || []).filter((chain) => !chain.applicableTypes?.length || chain.applicableTypes.includes('rehab')).slice(0, 4);
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
            found.task.feedback = normalizeTaskFeedback(feedback, Date.now());
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

        aggregateCompletionRate(plans = this.getTodayDailyPlans?.() || []) {
            const list = Array.isArray(plans) ? plans : [];
            const rates = list.map((plan) => this.completionRate(plan));
            const done = rates.reduce((sum, item) => sum + Number(item.done || 0), 0);
            const total = rates.reduce((sum, item) => sum + Number(item.total || 0), 0);
            return { done, total, rate: total ? done / total : 0 };
        },

        pendingCooldownCount(plan = this.getTodayDailyPlan()) {
            return Array.isArray(plan?.pendingCooldowns) ? plan.pendingCooldowns.length : 0;
        },

        buildFeedbackHistory(chainId = '', taskRef = {}) {
            const refMeta = window.planPolicy?.actionMetaForName?.(`${taskRef.name || ''} ${taskRef.aiReasoning || ''}`) || {};
            const ref = {
                ...taskRef,
                chainId: chainId || taskRef.chainId || refMeta.chainId || '',
                actionKey: taskRef.actionKey || refMeta.actionKey || '',
                progressionGroup: taskRef.progressionGroup || refMeta.progressionGroup || ''
            };
            return this.activeRecords(this.db.dailyPlans || [])
                .flatMap((plan) => (plan.items || []).map((item) => ({ plan, item })))
                .filter(({ item }) => {
                    if (!item || !item.feedback?.rpe) return false;
                    const itemMeta = window.planPolicy?.actionMetaForName?.(`${item.name || ''} ${item.aiReasoning || ''}`) || {};
                    const itemActionKey = item.actionKey || itemMeta.actionKey || '';
                    const itemGroup = item.progressionGroup || itemMeta.progressionGroup || '';
                    return (ref.chainId && item.chainId === ref.chainId)
                        || (ref.actionKey && itemActionKey === ref.actionKey)
                        || (ref.progressionGroup && itemGroup === ref.progressionGroup)
                        || window.planPolicy?.itemsMatch?.(item, ref);
                })
                .sort((a, b) => Number(a.item.feedback?.doneAt || 0) - Number(b.item.feedback?.doneAt || 0))
                .map(({ item }) => item.feedback);
        },

        maybeApplyProgression(planId, taskId) {
            const { plan, task } = this.findTask(planId, taskId);
            if (!plan || !task) return null;
            const meta = window.planPolicy?.actionMetaForName?.(`${task.name || ''} ${task.aiReasoning || ''}`) || {};
            const chainId = task.chainId || meta.chainId || '';
            if (!chainId) return null;
            const chain = this.activeRecords(this.db.progressionChains || []).find((item) => item.id === chainId) || window.planChains?.find?.(chainId);
            if (!chain) return null;
            const result = window.planProgression?.evaluate?.({
                taskItem: task,
                chain,
                history: this.buildFeedbackHistory(chainId, task),
                userOverride: task.userOverride
            }) || null;
            const decision = result?.decision || result?.suggestion || 'hold';
            if (!result || ['hold', 'maintain'].includes(decision)) return result;
            this.lastProgressionSuggestion = { planId, taskId, result };
            const apply = () => {
                if (result.targetLevel && result.targetLevel !== task.currentLevel) {
                    task.chainId = chainId;
                    task.currentLevel = result.targetLevel;
                    const target = (chain.levels || []).find((item) => Number(item.lv) === Number(result.targetLevel));
                    if (target?.name) task.name = target.name;
                }
                const suggestedSpec = result.suggestedSpec || result.fallbackSpec;
                if (suggestedSpec) {
                    task.spec = { ...task.spec, ...suggestedSpec };
                }
                this.touchRecord(task, ['chainId', 'currentLevel', 'name', 'spec']);
                this.touchRecord(plan, ['items']);
                this.save();
                window.toast?.show?.(result.reason, 'success');
            };
            if (this.ensurePlanPrefs().askBeforeProgression) {
                this._confirmModal?.({
                    title: '进阶建议',
                    icon: ['progress', 'volume-up', 'upgrade'].includes(decision) ? 'trending_up' : 'trending_down',
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

        cancelDailyPlan(planId, options = {}) {
            this.ensurePlanBootstrap();
            const plan = this.activeRecords(this.db.dailyPlans || []).find((item) => item.id === planId);
            if (!plan) return false;
            const planDate = plan.date;
            plan.deleted = true;
            plan.pendingCooldowns = [];
            this.touchRecord(plan, ['deleted', 'pendingCooldowns']);
            if (this.selectedPlanId === planId) {
                const next = this.activeRecords(this.db.dailyPlans || []).find((item) => item.id !== planId && item.date === planDate);
                this.selectedPlanId = next?.id || '';
            }
            if (this.activeRun?.planId === planId) {
                if (this.activeRun.previousPlan && this._replacePlanActions) this._replacePlanActions(this.activeRun.previousPlan);
                this.activeRun = null;
                this.updatePlanWorkoutBanner?.();
            }
            if (options.save !== false) this.save({ render: options.render !== false });
            return true;
        },

        moveTask(planId, taskId, targetDate) {
            const { plan, task } = this.findTask(planId, taskId);
            if (!plan || !task || !targetDate) return false;
            plan.items = (plan.items || []).filter((item) => item.id !== taskId);
            this.touchRecord(plan, ['items']);
            let target = this.getDailyPlans(targetDate).find((item) => (item.type || 'rehab') === (plan.type || 'rehab'));
            if (!target) target = this.createDailyPlan({ date: targetDate, type: plan.type || 'rehab', title: plan.title || planTypeMeta(plan.type).label, source: 'manual', items: [] });
            target.items.push(this.ensureTaskShape({ ...clone(task), status: 'todo', doneSets: 0, feedback: null }));
            this.touchRecord(target, ['items']);
            this.save();
            return true;
        },

        deleteTask(planId, taskId) {
            const { plan, task } = this.findTask(planId, taskId);
            if (!plan || !task) return false;
            task.deleted = true;
            plan.pendingCooldowns = (plan.pendingCooldowns || []).filter((id) => id !== taskId);
            this.touchRecord(task, ['deleted']);
            const activeItems = (plan.items || []).filter((item) => item && !item.deleted);
            if (!activeItems.length) {
                const planDate = plan.date;
                plan.deleted = true;
                plan.pendingCooldowns = [];
                if (this.selectedPlanId === planId) {
                    const next = this.activeRecords(this.db.dailyPlans || []).find((item) => item.id !== planId && item.date === planDate);
                    this.selectedPlanId = next?.id || '';
                }
                if (this.activeRun?.planId === planId) {
                    if (this.activeRun.previousPlan && this._replacePlanActions) this._replacePlanActions(this.activeRun.previousPlan);
                    this.activeRun = null;
                    this.updatePlanWorkoutBanner?.();
                }
                this.touchRecord(plan, ['items', 'pendingCooldowns', 'deleted']);
            } else {
                this.touchRecord(plan, ['items', 'pendingCooldowns']);
            }
            this.save();
            return true;
        },

        todayKey,
        esc
    };

    window.dataPlanStore = api;
})();
