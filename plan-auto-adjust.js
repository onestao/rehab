// @ts-nocheck
(function () {
    if (window.dataPlanAutoAdjust) return;

    const PLAN_TYPES = ['rehab', 'cut', 'bulk', 'maintenance', 'custom'];
    const AUTO_KEY_PREFIX = 'plan-auto-next-day:';

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function dateOffset(baseKey, days) {
        const m = String(baseKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
        date.setDate(date.getDate() + days);
        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
        ].join('-');
    }

    function normalizePlanTypes(types = []) {
        const list = Array.isArray(types) ? types : [types];
        const normalized = list.map((type) => String(type || 'rehab')).filter((type) => PLAN_TYPES.includes(type));
        return [...new Set(normalized.length ? normalized : ['rehab'])];
    }

    function activeItems(plan = {}) {
        return (Array.isArray(plan.items) ? plan.items : []).filter((item) => item && !item.deleted);
    }

    function taskCategory(item = {}) {
        const raw = String(item.category || item.phase || 'main').trim().toLowerCase();
        if (['warmup', 'warm-up', '热身'].includes(raw)) return 'warmup';
        if (['cooldown', 'cool-down', 'stretch', 'stretching', '拉伸', '放松'].includes(raw)) return 'cooldown';
        return 'main';
    }

    function mainItems(plan = {}) {
        return activeItems(plan).filter((item) => taskCategory(item) !== 'cooldown');
    }

    function loadItems(plan = {}) {
        return activeItems(plan).filter((item) => taskCategory(item) === 'main');
    }

    function completion(plan = {}) {
        const items = mainItems(plan);
        if (!items.length) return { done: 0, total: 0, complete: false };
        const done = items.filter((item) => item.status === 'done').length;
        return { done, total: items.length, complete: done >= items.length };
    }

    function inferBodyPart(text = '') {
        const value = String(text || '').toLowerCase();
        if (/膝|踝|足|腿|臀|髋|深蹲|弓步|下肢|knee|ankle|leg|hip|glute|squat|lunge/.test(value)) return '下肢/髋膝踝';
        if (/肩|胸|推|俯卧撑|上肢|shoulder|chest|press|push/.test(value)) return '上肢推/肩胸';
        if (/背|划船|下拉|拉|row|pull|back/.test(value)) return '上肢拉/背';
        if (/核心|腹|腰|平板|躯干|core|abs|plank|trunk/.test(value)) return '核心/躯干';
        if (/有氧|跑|走|骑|游泳|cardio|run|walk|bike|cycling|swim/.test(value)) return '有氧';
        if (/拉伸|活动度|放松|mobility|stretch/.test(value)) return '活动度/放松';
        return '';
    }

    function taskMeta(item = {}) {
        return window.planPolicy?.actionMetaForName?.(`${item.name || ''} ${item.aiReasoning || ''}`) || {};
    }

    function itemBodyPart(item = {}) {
        const meta = taskMeta(item);
        return meta.bodyPart || inferBodyPart(`${item.bodyPart || ''} ${item.name || ''} ${item.feedback?.painPart || ''} ${item.feedback?.note || ''} ${item.aiReasoning || ''}`);
    }

    function findProgressionChain(ctx = {}, item = {}) {
        const meta = taskMeta(item);
        const chainId = item.chainId || meta.chainId || '';
        if (!chainId) return null;
        return (ctx.activeRecords?.(ctx.db?.progressionChains || []) || []).find((chain) => chain.id === chainId || chain.group === chainId)
            || window.planChains?.find?.(chainId)
            || window.planChains?.get?.(chainId)
            || null;
    }

    function feedbackStats(plans = []) {
        const rows = plans.flatMap((plan) => loadItems(plan).map((item) => ({ plan, item }))).filter(({ item }) => item.feedback?.rpe);
        const rpes = rows.map(({ item }) => Number(item.feedback?.rpe || 0)).filter(Boolean);
        const tooHard = rows.filter(({ item }) => Number(item.feedback?.rpe || 0) === 5);
        const easy = rows.filter(({ item }) => [1, 2].includes(Number(item.feedback?.rpe || 0)));
        const parts = (list) => [...new Set(list.map(({ item }) => itemBodyPart(item)).filter(Boolean))];
        return {
            count: rpes.length,
            maxRpe: rpes.length ? Math.max(...rpes) : 0,
            avgRpe: rpes.length ? Number((rpes.reduce((sum, value) => sum + value, 0) / rpes.length).toFixed(1)) : 0,
            tooHardParts: parts(tooHard),
            easyParts: parts(easy),
            notes: rows.map(({ item }) => `${item.name || '任务'}: RPE${item.feedback.rpe}${item.feedback.note ? ` ${item.feedback.note}` : ''}`).slice(0, 10)
        };
    }

    function recentRehabActions(db = {}) {
        return (db.health?.rehabWeekly || [])
            .filter((week) => week && !week.deleted)
            .slice()
            .sort((a, b) => String(b.weekStart || b.visitDate || '').localeCompare(String(a.weekStart || a.visitDate || '')) || Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
            .slice(0, 3)
            .flatMap((week) => (week.actions || []).map((action) => ({ week, action })))
            .filter(({ action }) => action && action.name);
    }

    function classifyPrescriptionAction(action = {}) {
        const shared = window.planPolicy?.classifyPrescriptionAction?.(action);
        if (shared) {
            return {
                ...shared,
                safetyLevel: shared.policyType === 'blocked'
                    ? 'blocked'
                    : shared.policyType === 'cautious'
                        ? 'cautious'
                        : shared.policyType === 'preferred'
                            ? 'preferred'
                            : 'baseline'
            };
        }
        const status = String(action.status || '').trim().toLowerCase();
        const confidence = Number(action.confidence == null ? 100 : action.confidence);
        const text = `${status} ${action.rawDescription || ''} ${action.coachNote || ''} ${action.name || ''}`.toLowerCase();
        const painLevel = Number(action.painLevel || 0);
        if (/dropped|avoid|暂停|停做|停止|避免|禁忌|不建议|不要/.test(text) || painLevel >= 4) {
            return {
                safetyLevel: 'blocked',
                canAutoAdd: false,
                canAutoProgress: false,
                reason: painLevel >= 4 ? '疼痛评分过高或处方要求暂停' : '处方明确暂停/避免'
            };
        }
        if (status === 'watch' || action.needsReview || (confidence > 0 && confidence < 80) || /watch|review|观察|待确认|复核|谨慎|如果|若|不稳|视情况|不适/.test(text)) {
            return {
                safetyLevel: 'cautious',
                canAutoAdd: false,
                canAutoProgress: false,
                reason: '处方为观察/待确认/条件性动作'
            };
        }
        if (status === 'new' || /新增|新动作/.test(text)) {
            return {
                safetyLevel: 'baseline',
                canAutoAdd: true,
                canAutoProgress: false,
                reason: '新处方动作按基准剂量安排'
            };
        }
        return {
            safetyLevel: 'preferred',
            canAutoAdd: true,
            canAutoProgress: true,
            reason: status || '最近康复处方'
        };
    }

    function isAvoidedAction(action = {}) {
        return classifyPrescriptionAction(action).safetyLevel === 'blocked';
    }

    function avoidedActionNames(db = {}) {
        return recentRehabActions(db)
            .filter(({ action }) => isAvoidedAction(action))
            .map(({ action }) => String(action.name || '').trim())
            .filter(Boolean);
    }

    function preferredPrescriptionActions(db = {}) {
        return recentRehabActions(db)
            .map(({ week, action }) => {
                const policy = classifyPrescriptionAction(action);
                return {
                    name: action.name || '',
                    status: action.status || 'continued',
                    bodyPart: action.bodyPart || inferBodyPart(`${action.name || ''} ${action.rawDescription || ''}`),
                    spec: action.spec || null,
                    coachNote: action.coachNote || '',
                    rawDescription: action.rawDescription || '',
                    painLevel: Number(action.painLevel || 0),
                    confidence: Number(action.confidence == null ? 100 : action.confidence),
                    needsReview: !!action.needsReview,
                    weekStart: week.weekStart || week.visitDate || '',
                    ...policy
                };
            })
            .filter((action) => action.safetyLevel !== 'blocked')
            .slice(0, 16);
    }

    function itemMatchesAny(item = {}, names = []) {
        const itemName = String(item.name || '').trim();
        if (!itemName) return false;
        return names.some((name) => window.planPolicy?.itemsMatch?.(item, name) || itemName.includes(name) || String(name || '').includes(itemName));
    }

    function findPrescriptionForItem(item = {}, actions = []) {
        const itemName = String(item.name || '').trim();
        if (!itemName) return null;
        return actions.find((action) => {
            const name = String(action.name || '').trim();
            return name && (window.planPolicy?.itemsMatch?.(item, action) || itemName.includes(name) || name.includes(itemName));
        }) || null;
    }

    function planItemsByCategory(plan = {}) {
        const items = activeItems(plan);
        return {
            warmup: items.filter((item) => taskCategory(item) === 'warmup'),
            main: items.filter((item) => taskCategory(item) === 'main'),
            cooldown: items.filter((item) => taskCategory(item) === 'cooldown')
        };
    }

    function capStructuredItems(items = {}) {
        const warmup = (items.warmup || []).slice(0, 2);
        const main = (items.main || []).slice(0, 6);
        const cooldown = (items.cooldown || []).slice(0, 2);
        return [...warmup, ...main, ...cooldown];
    }

    function errorSummary(error) {
        return String(error?.message || error || '未知错误').replace(/\s+/g, ' ').slice(0, 240);
    }

    function annotateGeneratedItem(item = {}, prescription = []) {
        const next = { ...item };
        const policy = findPrescriptionForItem(next, prescription);
        if (policy?.safetyLevel === 'cautious' && !/观察|待确认|不自动加量|谨慎/.test(String(next.aiReasoning || ''))) {
            next.aiReasoning = `${next.aiReasoning ? `${next.aiReasoning}；` : ''}处方为观察/待确认动作，自动调整仅保守安排，不应自动加量。`;
        }
        if (taskCategory(next) !== 'main' && /加量|进阶|提高/.test(String(next.aiReasoning || ''))) {
            next.aiReasoning = `${next.aiReasoning}；热身/冷却动作不会作为负荷进阶依据。`;
        }
        return next;
    }

    function lowerSpec(spec = {}) {
        const mode = String(spec.mode || 'reps');
        const isHold = mode === 'hold' || mode === 'alt-hold';
        return {
            ...spec,
            sets: Math.max(1, Math.round(Number(spec.sets || 1) - 1)),
            reps: isHold ? Math.max(1, Number(spec.reps || 1)) : Math.max(1, Math.round(Number(spec.reps || 1) * 0.75)),
            work: isHold ? Math.max(15, Math.round(Number(spec.work || 20) * 0.8)) : Math.max(2, Math.round(Number(spec.work || 3))),
            actionRest: Math.min(90, Math.max(30, Math.round(Number(spec.actionRest || 45) + 15)))
        };
    }

    function raiseSpec(spec = {}) {
        const mode = String(spec.mode || 'reps');
        const isHold = mode === 'hold' || mode === 'alt-hold';
        return {
            ...spec,
            sets: Math.min(6, Math.max(1, Math.round(Number(spec.sets || 1) + (Number(spec.sets || 1) < 3 ? 1 : 0)))),
            reps: isHold ? Math.max(1, Number(spec.reps || 1)) : Math.min(30, Math.max(1, Math.round(Number(spec.reps || 1) + 2))),
            work: isHold ? Math.min(60, Math.max(15, Math.round(Number(spec.work || 20) + 5))) : Math.max(2, Math.round(Number(spec.work || 3))),
            actionRest: Math.max(15, Math.round(Number(spec.actionRest || 45) - 5))
        };
    }

    function cloneForTomorrow(item = {}, stats = {}, options = {}) {
        const next = clone(item);
        delete next.id;
        delete next.nextProgressionSuggestion;
        next.status = 'todo';
        next.doneSets = 0;
        next.feedback = null;
        next.userOverride = false;
        const part = inferBodyPart(`${item.name || ''} ${item.aiReasoning || ''}`);
        const rpe = Number(item.feedback?.rpe || 0);
        const painScore = Number(item.feedback?.painScore ?? item.feedback?.painLevel ?? item.feedback?.pain ?? 0);
        const noIncrease = Boolean(item.feedback?.noIncrease || item.feedback?.dontIncrease);
        const keepNextTime = Boolean(item.feedback?.keepNextTime);
        const unsuitable = Boolean(item.feedback?.unsuitable);
        const wantsContinue = item.feedback?.wantsContinue !== false;
        const category = taskCategory(item);
        const policy = options.policy || null;
        const canAutoProgress = category === 'main' && policy?.canAutoProgress !== false && !options.preventProgression;
        if (category !== 'main') {
            next.aiReasoning = category === 'warmup'
                ? '本地保守调整：热身动作仅沿用，不根据 RPE 自动加量。'
                : '本地保守调整：保留冷却/放松动作，避免训练后恢复环节丢失。';
        } else if (policy?.safetyLevel === 'cautious') {
            next.aiReasoning = `本地保守调整：${policy.reason || '处方待确认'}，仅按原剂量沿用，不自动加量。`;
        } else if (unsuitable || wantsContinue === false) {
            next.spec = painScore >= 4 ? lowerSpec(next.spec || {}) : next.spec;
            next.aiReasoning = `本地保守调整：用户反馈${unsuitable ? '该动作不适合' : '不希望继续'}，明天不自动进阶${painScore >= 4 ? '并先降载' : '，等待用户确认'}。`;
            next.requiresUserConfirm = true;
            next.userConfirmed = false;
        } else if (noIncrease || keepNextTime) {
            next.aiReasoning = '本地保守调整：用户选择保持/不再加量，明天按原剂量保留。';
        } else if (painScore >= 4) {
            next.spec = lowerSpec(next.spec || {});
            next.aiReasoning = `自动降载：用户反馈疼痛 ${painScore}/10，明天先降低负荷并观察。`;
        } else if (rpe === 5 || (part && stats.tooHardParts?.includes(part))) {
            next.spec = lowerSpec(next.spec || {});
            next.aiReasoning = `自动降载：今日反馈做不动(RPE 5)，明天避开${part || '同部位'}高负荷。`;
        } else if (rpe === 1 && canAutoProgress) {
            next.spec = raiseSpec(next.spec || {});
            next.aiReasoning = '自动小幅加量：今日反馈太轻(RPE 1)，且不属于待确认处方动作。';
        } else if (rpe === 4) {
            next.aiReasoning = '本地保守调整：今日反馈偏吃力(RPE 4)，明天先保持剂量并观察。';
        } else {
            next.aiReasoning = next.aiReasoning || '本地保守调整：今日反馈可接受，保持稳定训练。';
        }
        return window.planPolicy?.applyFutureProgressionSuggestion?.(next, item, options) || next;
    }

    function prescriptionTask(action = {}) {
        const meta = window.planPolicy?.actionMetaForName?.(`${action.name || ''} ${action.rawDescription || ''}`) || {};
        const spec = action.spec || { sets: 2, reps: 10, work: 3, repRest: 0, actionRest: 30, isAlt: false, mode: 'reps' };
        const needsConfirm = Boolean(action.requiresUserConfirm || action.safetyLevel === 'cautious');
        return {
            name: action.name || meta.canonicalName || '医嘱动作',
            category: window.planPolicy?.inferCategory?.(meta.categoryHint, action.name) || 'main',
            spec,
            aiReasoning: `本地保守补充处方动作：${action.reason || action.coachNote || action.status || '最近康复处方'}；按基准剂量安排，不自动加量。`,
            status: 'todo',
            doneSets: 0,
            userOverride: false,
            excludeFromPr: true,
            actionKey: action.actionKey || meta.actionKey || '',
            canonicalName: action.canonicalName || meta.canonicalName || action.name || '',
            progressionGroup: action.progressionGroup || meta.progressionGroup || '',
            progressionLevel: Number(action.progressionLevel || meta.progressionLevel || 0),
            chainId: action.chainId || meta.chainId || '',
            requiresUserConfirm: needsConfirm,
            userConfirmed: !needsConfirm,
            policy: { source: 'prescription', requiresUserConfirm: needsConfirm, prescriptionName: action.name || meta.canonicalName || '' }
        };
    }

    function buildFallbackPlans(ctx, sourcePlans = []) {
        const avoidNames = avoidedActionNames(ctx.db || {});
        const prescription = preferredPrescriptionActions(ctx.db || {});
        const addablePrescription = prescription.filter((action) => action.canAutoAdd);
        const cautiousCount = prescription.filter((action) => action.safetyLevel === 'cautious').length;
        const stats = feedbackStats(sourcePlans);
        return sourcePlans.map((source) => {
            const sourceByCategory = planItemsByCategory(source);
            const warmup = sourceByCategory.warmup
                .filter((item) => !itemMatchesAny(item, avoidNames))
                .map((item) => cloneForTomorrow(item, stats, { preventProgression: true }));
            let main = sourceByCategory.main
                .filter((item) => !itemMatchesAny(item, avoidNames))
                .map((item) => cloneForTomorrow(item, stats, { policy: findPrescriptionForItem(item, prescription), chain: findProgressionChain(ctx, item) }));
            const cooldown = sourceByCategory.cooldown
                .filter((item) => !itemMatchesAny(item, avoidNames))
                .map((item) => cloneForTomorrow(item, stats, { preventProgression: true }));
            const targetMainCount = Math.min(6, Math.max(3, main.length || 0));
            if ((source.type || 'rehab') === 'rehab') {
                const hasPrescriptionMain = main.some((item) => findPrescriptionForItem(item, prescription));
                const missingPrescription = addablePrescription.filter((action) => !main.some((item) => itemMatchesAny(item, [action.name])));
                const supplement = missingPrescription
                    .slice(0, Math.max(0, targetMainCount - main.length))
                    .map(prescriptionTask);
                main = [...main, ...supplement];
                if (!hasPrescriptionMain && !supplement.length && missingPrescription.length && main.length >= targetMainCount) {
                    main = [...main.slice(0, Math.max(0, targetMainCount - 1)), prescriptionTask(missingPrescription[0])];
                }
            }
            return {
                date: ctx.targetDate,
                type: source.type || 'rehab',
                title: source.title || ctx.planTypeMeta?.(source.type)?.label || '训练计划',
                source: 'ai',
                notes: [
                    `本地保守调整：根据 ${ctx.sourceDate} 训练反馈生成。`,
                    stats.maxRpe >= 4 ? '已避免继续推进偏吃力部位。' : '仅对明确太轻且安全的主训练小幅推进。',
                    cautiousCount ? '观察/待确认处方动作不会被自动新增或加量。' : '',
                    '热身和冷却按结构保留。'
                ].filter(Boolean).join(''),
                items: capStructuredItems({ warmup, main, cooldown })
            };
        }).filter((plan) => plan.items.length);
    }

    window.dataPlanAutoAdjust = {
        _autoAdjustInFlight: false,

        shouldAutoAdjustAfterPlanFeedback() {
            const sourceDate = this.logicalDateKey?.() || this.dateKey?.(new Date()) || new Date().toISOString().slice(0, 10);
            const todaysPlans = this.activeRecords?.(this.db.dailyPlans || []).filter((item) => item.date === sourceDate) || [];
            const completedPlans = todaysPlans.filter((item) => completion(item).complete);
            if (!completedPlans.length) return false;
            return todaysPlans.every((item) => {
                const rate = completion(item);
                return !rate.total || rate.complete;
            });
        },

        maybeAutoAdjustNextDayAfterFeedback() {
            if (!this.shouldAutoAdjustAfterPlanFeedback?.()) return;
            this.autoAdjustNextDayPlans?.({ reason: 'training-complete' });
        },

        async autoAdjustNextDayPlans(options = {}) {
            if (this._autoAdjustInFlight) return null;
            const sourceDate = String(options.sourceDate || this.logicalDateKey?.() || this.dateKey?.(new Date()) || new Date().toISOString().slice(0, 10));
            const targetDate = String(options.targetDate || dateOffset(sourceDate, 1));
            const sourcePlans = (this.activeRecords?.(this.db.dailyPlans || []) || [])
                .filter((plan) => plan.date === sourceDate && completion(plan).complete)
                .filter((plan) => mainItems(plan).some((item) => item.feedback?.rpe || item.status === 'done'));
            if (!sourcePlans.length) return null;
            const types = normalizePlanTypes(sourcePlans.map((plan) => plan.type || 'rehab'));
            const key = `${AUTO_KEY_PREFIX}${sourceDate}:${targetDate}:${types.join(',')}`;
            const latestDoneAt = Math.max(...sourcePlans.flatMap((plan) => mainItems(plan).map((item) => Number(item.feedback?.doneAt || item.updatedAt || 0))));
            if (!options.force && this.db?.lastPlanAutoAdjust?.key === key && Number(this.db.lastPlanAutoAdjust.latestDoneAt || 0) >= latestDoneAt) return null;

            this._autoAdjustInFlight = true;
            window.toast?.show?.('正在根据今日反馈自动调整明天计划…', 'info', 3200);
            const beforePlans = clone(this.db.dailyPlans || []);
            try {
                await this.ensureAutoPlanAiReady?.();
                const plans = await this.generateAutoAdjustedPlans?.({ sourceDate, targetDate, sourcePlans, types });
                const finalPlans = this.sanitizeAutoAdjustedPlans?.(plans, { sourceDate, targetDate, sourcePlans, types }) || [];
                const applied = this.applyAutoAdjustedPlans?.(finalPlans, { sourceDate, targetDate, beforePlans, key, latestDoneAt });
                if (applied) {
                    window.toast?.show?.('已根据今日反馈自动调整明天计划', 'success', {
                        timeout: 7000,
                        action: '撤销',
                        onAction: () => this.undoLastPlanAutoAdjust?.()
                    });
                }
                return applied;
            } catch (error) {
                const fallbackReason = errorSummary(error);
                const fallback = this.sanitizeAutoAdjustedPlans?.(buildFallbackPlans({ ...this, sourceDate, targetDate, db: this.db }, sourcePlans), { sourceDate, targetDate, sourcePlans, types }) || [];
                const applied = this.applyAutoAdjustedPlans?.(fallback, { sourceDate, targetDate, beforePlans, key, latestDoneAt, fallback: true, fallbackReason });
                if (applied) {
                    window.toast?.show?.('AI 调整失败，已用本地规则保守调整明天计划', 'info', {
                        timeout: 8000,
                        actions: [
                            { label: '撤销', onClick: () => this.undoLastPlanAutoAdjust?.() },
                            { label: '重试 AI', onClick: () => this.autoAdjustNextDayPlans?.({ sourceDate, targetDate, force: true }) }
                        ]
                    });
                } else {
                    window.toast?.show?.(`自动调整失败：${window.toast?.sanitize ? toast.sanitize(error) : error?.message || error}`, 'error');
                }
                return applied;
            } finally {
                this._autoAdjustInFlight = false;
            }
        },

        async ensureAutoPlanAiReady() {
            if (typeof window.loadAppScript === 'function') {
                if (!window.ai) await window.loadAppScript('ai-store');
                if (!window.ai?.run) await window.loadAppScript('ai-api');
                if (!window.planAiPure) await window.loadAppScript('plan-ai-pure');
                if (!window.dataPlanAi?.buildPlanAiContext) await window.loadAppScript('plan-ai');
                this.refreshModules?.();
            }
            if (window.ai && !window.ai.cfg?.profiles?.length && typeof window.ai.init === 'function') {
                await window.ai.init({ saveData: true, renderData: false });
            }
            if (!window.ai?.run) throw new Error('AI 模块未配置或未加载');
            if (typeof this.buildPlanAiContext !== 'function' || typeof this.parsePlanAiPayload !== 'function') throw new Error('训练计划 AI 模块未就绪');
        },

        async generateAutoAdjustedPlans({ sourceDate, targetDate, sourcePlans, types }) {
            const stats = feedbackStats(sourcePlans);
            const prescription = preferredPrescriptionActions(this.db || {});
            const cautiousPrescription = prescription.filter((action) => action.safetyLevel === 'cautious');
            const addablePrescription = prescription.filter((action) => action.canAutoAdd);
            const avoided = avoidedActionNames(this.db || {});
            const typeSet = new Set(normalizePlanTypes(types));
            const targetAiPlans = (this.activeRecords?.(this.db?.dailyPlans || []) || [])
                .filter((plan) => plan.date === targetDate && typeSet.has(plan.type || 'rehab') && String(plan.source || '') === 'ai')
                .filter((plan) => {
                    const items = activeItems(plan);
                    return items.length && !items.some((item) => item.requiresUserConfirm && item.userConfirmed !== true);
                });
            const targetAiPlanTypes = [...new Set(targetAiPlans.map((plan) => plan.type || 'rehab'))];
            const previousStart = dateOffset(targetDate, -3);
            const futureEnd = dateOffset(targetDate, 6);
            const bodyPartSchedule = (this.activeRecords?.(this.db?.dailyPlans || []) || [])
                .filter((plan) => plan.date && plan.date >= previousStart && plan.date <= futureEnd)
                .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
                .flatMap((plan) => mainItems(plan).slice(0, 8).map((item) => `${plan.date}:${plan.type || 'rehab'}:${item.name || ''}/${itemBodyPart(item) || '未识别'}`))
                .join('|');
            const targetAiSummary = targetAiPlans.map((plan) => `${plan.type || 'rehab'}:${activeItems(plan).map((item) => `${item.name || ''}/${taskCategory(item)}/${itemBodyPart(item) || ''}/${JSON.stringify(item.spec || {})}`).join(',')}`).join('|');
            const policyContext = window.planPolicy?.buildPlanPolicyContext?.({
                db: this.db || {},
                activeRecords: this.activeRecords?.bind(this),
                sourcePlans,
                types
            });
            
            const sourceSignals = sourcePlans.flatMap(plan => loadItems(plan).map(item => {
                const meta = window.planPolicy?.actionMetaForName?.(item.name || '') || {};
                const chainId = item.chainId || meta.chainId || '';
                if (!chainId || !window.planProgression?.evaluate) return null;
                const chain = window.planChains?.find?.(chainId) || window.planChains?.get?.(chainId);
                const signal = window.planProgression.evaluate({
                    taskItem: item,
                    chain,
                    history: this.buildFeedbackHistory?.(chainId, item) || item.progressionHistory || [],
                    planType: plan.type
                });
                return { name: item.name, signal };
            }).filter(Boolean));

            const extra = [
                '自动调明天；医嘱优先、反馈优先。',
                targetAiPlans.length
                    ? `已有已确认AI(${targetAiPlanTypes.join('、')})：以它微调，禁整套重写；只按反馈改量/部位/少量增删，未否定原动作保留。`
                    : '无AI基线：全新生成时按前3天+未来7天部位排程，避开连续高负荷/疼痛部位。',
                '桥链勿被单腿臀桥自动替代；延续今日类型；结构1-2 warmup/3-6 main/1-2 cooldown。',
                `源:${sourceDate};目标:${targetDate}。`,
                'RPE1小进；2-3稳；4保持/轻降；5降载/替换；热身冷却不加量。',
                '不加量/保持/疼痛>=4/不想继续/不适合=>hold/deload/待确认。',
                '处方近3周canAutoAdd做主框架；非医嘱新增须确认；cautious/watch不新增不加量；dropped/avoid/暂停禁用；锁定不覆盖。',
                `策略: ${JSON.stringify(policyContext?.summary || policyContext || {})}`,
                `进阶信号: ${JSON.stringify(sourceSignals)}`,
                `反馈: ${JSON.stringify(stats)}`,
                `目标AI: ${targetAiSummary || '无'}`,
                `部位排程: ${bodyPartSchedule || '无'}`,
                `可排处方: ${JSON.stringify(addablePrescription)}`,
                `谨慎处方: ${JSON.stringify(cautiousPrescription)}`,
                `禁用处方: ${JSON.stringify(avoided)}`
            ].join('\n');
            const messages = [
                { role: 'system', content: '只输出严格JSON。' },
                { role: 'user', content: `${this.buildPlanAiContext('today', extra, types, { targetDate })}\nplan.date=${targetDate}。` }
            ];
            const text = await window.ai.runStream('plan.adjust', messages, 1800);
            const parsed = this.parsePlanAiPayload(text, types);
            if (!parsed.ok) throw new Error(parsed.reason || 'AI 返回计划无法解析');
            return parsed.plans.map((plan) => ({ ...plan, date: targetDate }));
        },

        sanitizeAutoAdjustedPlans(plans = [], ctx = {}) {
            const types = new Set(normalizePlanTypes(ctx.types));
            const rawPlans = (Array.isArray(plans) ? plans : [])
                .map((plan) => {
                    const type = PLAN_TYPES.includes(plan.type) ? plan.type : [...types][0] || 'rehab';
                    if (!types.has(type)) return null;
                    return { ...plan, type, date: ctx.targetDate };
                })
                .filter(Boolean);
            if (window.planPolicy?.sanitizeGeneratedPlans) {
                return window.planPolicy.sanitizeGeneratedPlans(rawPlans, {
                    db: this.db || {},
                    activeRecords: this.activeRecords?.bind(this),
                    sourcePlans: ctx.sourcePlans || [],
                    targetDate: ctx.targetDate,
                    types: [...types],
                    ensureTaskShape: (item, planType) => this.ensureTaskShape?.({
                        ...item,
                        id: '',
                        status: 'todo',
                        doneSets: 0,
                        feedback: null,
                        userOverride: false,
                        excludeFromPr: true,
                        planType: planType || item.planType || 'rehab'
                    }, { planType: planType || item.planType || 'rehab' }) || item
                }).map((plan) => ({
                    date: ctx.targetDate,
                    type: PLAN_TYPES.includes(plan.type) ? plan.type : [...types][0] || 'rehab',
                    title: String(plan.title || this.planTypeMeta?.(plan.type)?.label || '训练计划'),
                    source: 'ai',
                    notes: String(plan.notes || `自动根据 ${ctx.sourceDate} 反馈调整`),
                    items: capStructuredItems(planItemsByCategory({ items: plan.items || [] }))
                })).filter((plan) => plan.items.length);
            }
            const avoidNames = avoidedActionNames(this.db || {});
            const prescription = preferredPrescriptionActions(this.db || {});
            return rawPlans
                .map((plan) => {
                    const type = plan.type;
                    const items = (Array.isArray(plan.items) ? plan.items : [])
                        .filter((item) => item && item.name && !itemMatchesAny(item, avoidNames))
                        .map((item) => annotateGeneratedItem(item, prescription))
                        .map((item) => this.ensureTaskShape?.({
                            ...item,
                            id: '',
                            status: 'todo',
                            doneSets: 0,
                            feedback: null,
                            userOverride: false,
                            excludeFromPr: true,
                            planType: type
                        }, { planType: type }) || item);
                    const cappedItems = capStructuredItems(planItemsByCategory({ items }));
                    return {
                        date: ctx.targetDate,
                        type,
                        title: String(plan.title || this.planTypeMeta?.(type)?.label || '训练计划'),
                        source: 'ai',
                        notes: String(plan.notes || `自动根据 ${ctx.sourceDate} 反馈调整`),
                        items: cappedItems
                    };
                })
                .filter((plan) => plan && plan.items.length);
        },

        applyAutoAdjustedPlans(plans = [], meta = {}) {
            if (!plans.length) return false;
            const beforePlans = meta.beforePlans || clone(this.db.dailyPlans || []);
            const batchBeforePlans = [];
            const afterPlans = [];
            const source = meta.fallback ? 'local-rule' : 'ai';
            const changes = [];
            let blockedReason = '';
            let appliedCount = 0;
            plans.forEach((plan) => {
                if (blockedReason) return;
                const current = (this.activeRecords?.(this.db.dailyPlans || []) || []).find((item) => item.date === plan.date && (item.type || 'rehab') === (plan.type || 'rehab'));
                const preserved = activeItems(current).filter((item) => window.planPolicy?.isProtectedPlanTask?.(item, current));
                const generatedItems = (plan.items || []).filter((item) => !preserved.some((protectedItem) => window.planPolicy?.tasksShareIdentity?.(item, protectedItem)));
                const mergedSource = String(current?.source || '') === 'ai' && String(plan.source || '') === 'ai' ? 'ai' : source;
                const merged = this.ensureDailyPlanShape?.({
                    ...(current || {}),
                    date: plan.date,
                    type: plan.type || 'rehab',
                    title: plan.title || this.planTypeMeta?.(plan.type)?.label || '训练计划',
                    source: mergedSource,
                    notes: plan.notes,
                    items: [...preserved, ...generatedItems]
                }) || plan;
                const validation = window.planPolicy?.validatePlanChanges?.({
                    beforePlans: current ? [current] : [],
                    afterPlans: [merged],
                    source
                });
                if (validation && !validation.ok) {
                    blockedReason = validation.violations[0]?.reason || '存在受保护任务变更';
                    return;
                }
                changes.push(...(window.planPolicy?.buildPlanAdjustmentChanges?.(current || {}, merged, plan) || []));
                if (current) batchBeforePlans.push(current);
                this.saveDailyPlan?.(merged, { save: false });
                afterPlans.push(merged);
                appliedCount += 1;
            });
            if (blockedReason) {
                this.db.dailyPlans = clone(beforePlans);
                window.toast?.show?.(`自动调整被阻止：${blockedReason}`, 'error');
                return false;
            }
            if (!appliedCount) return false;
            const batch = this.createPlanAdjustmentBatch?.({
                source,
                status: 'applied',
                createdAt: Date.now(),
                appliedAt: Date.now(),
                sourceDate: meta.sourceDate || '',
                targetDates: [...new Set(plans.map((plan) => plan.date).filter(Boolean))],
                trigger: { type: 'training-complete' },
                summary: meta.fallback ? 'AI 调整失败后使用本地规则保守调整明天计划' : '根据今日反馈自动调整明天计划',
                beforePlans: batchBeforePlans,
                afterPlans,
                changes,
                undo: { beforePlansRef: 'inline', canUndo: true }
            }, { save: false });
            this.db.lastPlanAutoAdjust = {
                key: meta.key || '',
                sourceDate: meta.sourceDate || '',
                targetDate: meta.targetDate || '',
                latestDoneAt: Number(meta.latestDoneAt || Date.now()),
                beforePlans: batchBeforePlans,
                batchId: batch?.id || '',
                appliedAt: Date.now(),
                fallback: !!meta.fallback,
                mode: meta.fallback ? 'local-fallback' : 'ai',
                fallbackReason: meta.fallback ? String(meta.fallbackReason || '') : ''
            };
            this.save?.();
            this.render?.();
            return true;
        },

        undoLastPlanAutoAdjust() {
            const batchId = this.db?.lastPlanAutoAdjust?.batchId || '';
            if (batchId && this.undoLastPlanAdjustment?.(batchId)) {
                this.db.lastPlanAutoAdjust = null;
                this.save?.();
                return true;
            }
            const snapshot = this.db?.lastPlanAutoAdjust?.beforePlans;
            if (!Array.isArray(snapshot)) {
                window.toast?.show?.('没有可撤销的自动调整', 'info');
                return false;
            }
            this.db.dailyPlans = clone(snapshot);
            this.db.lastPlanAutoAdjust = null;
            this.save?.();
            this.render?.();
            window.toast?.show?.('已撤销上次自动调整', 'success');
            return true;
        },

        detectMissedPlanCandidates(options = {}) {
            const targetDate = String(options.targetDate || this.logicalDateKey?.() || this.dateKey?.(new Date()) || new Date().toISOString().slice(0, 10));
            return window.planPolicy?.detectMissedPlanCandidates?.(this.activeRecords?.(this.db.dailyPlans || []) || [], {
                ...options,
                targetDate
            }) || [];
        }
    };
})();
