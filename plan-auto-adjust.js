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
        return window.data?.dateKey ? data.dateKey(date) : date.toISOString().slice(0, 10);
    }

    function normalizePlanTypes(types = []) {
        const list = Array.isArray(types) ? types : [types];
        const normalized = list.map((type) => String(type || 'rehab')).filter((type) => PLAN_TYPES.includes(type));
        return [...new Set(normalized.length ? normalized : ['rehab'])];
    }

    function activeItems(plan = {}) {
        return (Array.isArray(plan.items) ? plan.items : []).filter((item) => item && !item.deleted);
    }

    function mainItems(plan = {}) {
        return activeItems(plan).filter((item) => item.category !== 'cooldown');
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

    function feedbackStats(plans = []) {
        const rows = plans.flatMap((plan) => mainItems(plan).map((item) => ({ plan, item }))).filter(({ item }) => item.feedback?.rpe);
        const rpes = rows.map(({ item }) => Number(item.feedback?.rpe || 0)).filter(Boolean);
        const high = rows.filter(({ item }) => Number(item.feedback?.rpe || 0) >= 4);
        const easy = rows.filter(({ item }) => [1, 2].includes(Number(item.feedback?.rpe || 0)));
        return {
            count: rpes.length,
            maxRpe: rpes.length ? Math.max(...rpes) : 0,
            avgRpe: rpes.length ? Number((rpes.reduce((sum, value) => sum + value, 0) / rpes.length).toFixed(1)) : 0,
            highPainParts: [...new Set(high.map(({ item }) => inferBodyPart(`${item.name || ''} ${item.feedback?.note || ''} ${item.aiReasoning || ''}`)).filter(Boolean))],
            easyParts: [...new Set(easy.map(({ item }) => inferBodyPart(`${item.name || ''} ${item.feedback?.note || ''} ${item.aiReasoning || ''}`)).filter(Boolean))],
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

    function isAvoidedAction(action = {}) {
        const text = `${action.status || ''} ${action.rawDescription || ''} ${action.coachNote || ''}`.toLowerCase();
        return /dropped|avoid|暂停|停做|避免|禁忌/.test(text) || Number(action.painLevel || 0) >= 4;
    }

    function avoidedActionNames(db = {}) {
        return recentRehabActions(db)
            .filter(({ action }) => isAvoidedAction(action))
            .map(({ action }) => String(action.name || '').trim())
            .filter(Boolean);
    }

    function preferredPrescriptionActions(db = {}) {
        return recentRehabActions(db)
            .filter(({ action }) => !isAvoidedAction(action))
            .map(({ action }) => ({
                name: action.name || '',
                status: action.status || 'continued',
                bodyPart: action.bodyPart || inferBodyPart(`${action.name || ''} ${action.rawDescription || ''}`),
                spec: action.spec || null,
                coachNote: action.coachNote || '',
                painLevel: Number(action.painLevel || 0)
            }))
            .slice(0, 16);
    }

    function itemMatchesAny(item = {}, names = []) {
        const itemName = String(item.name || '').trim();
        if (!itemName) return false;
        return names.some((name) => itemName.includes(name) || String(name || '').includes(itemName));
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

    function cloneForTomorrow(item = {}, stats = {}) {
        const next = clone(item);
        delete next.id;
        next.status = 'todo';
        next.doneSets = 0;
        next.feedback = null;
        next.userOverride = false;
        const part = inferBodyPart(`${item.name || ''} ${item.aiReasoning || ''}`);
        const rpe = Number(item.feedback?.rpe || 0);
        if (rpe >= 4 || (part && stats.highPainParts?.includes(part))) {
            next.spec = lowerSpec(next.spec || {});
            next.aiReasoning = `自动降载：今日反馈偏高，明天避开${part || '同部位'}高负荷。`;
        } else if (rpe === 1 || rpe === 2) {
            next.spec = raiseSpec(next.spec || {});
            next.aiReasoning = `自动小幅加量：今日反馈${rpe === 1 ? '太轻' : '合适'}，在安全范围内推进。`;
        } else {
            next.aiReasoning = next.aiReasoning || '自动延续：今日反馈可接受，保持稳定训练。';
        }
        return next;
    }

    function buildFallbackPlans(ctx, sourcePlans = []) {
        const avoidNames = avoidedActionNames(ctx.db || {});
        const prescription = preferredPrescriptionActions(ctx.db || {});
        const stats = feedbackStats(sourcePlans);
        return sourcePlans.map((source) => {
            const sourceItems = mainItems(source)
                .filter((item) => !itemMatchesAny(item, avoidNames))
                .map((item) => cloneForTomorrow(item, stats));
            const prescriptionItems = (source.type || 'rehab') === 'rehab'
                ? prescription
                    .filter((action) => !sourceItems.some((item) => item.name === action.name))
                    .slice(0, Math.max(0, 5 - sourceItems.length))
                    .map((action) => ({
                        name: action.name,
                        category: 'main',
                        spec: action.spec || { sets: 2, reps: 10, work: 3, repRest: 0, actionRest: 30, isAlt: false, mode: 'reps' },
                        aiReasoning: `自动补充处方动作：${action.coachNote || action.status || '最近康复处方'}`,
                        status: 'todo',
                        doneSets: 0,
                        userOverride: false,
                        excludeFromPr: true
                    }))
                : [];
            return {
                date: ctx.targetDate,
                type: source.type || 'rehab',
                title: source.title || ctx.planTypeMeta?.(source.type)?.label || '训练计划',
                source: 'ai',
                notes: `自动根据 ${ctx.sourceDate} 训练反馈调整；${stats.maxRpe >= 4 ? '已降低疼痛部位负荷' : '已按反馈微调强度'}。`,
                items: [...sourceItems, ...prescriptionItems].slice(0, 8)
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
            if (this.db?.lastPlanAutoAdjust?.key === key && Number(this.db.lastPlanAutoAdjust.latestDoneAt || 0) >= latestDoneAt) return null;

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
                const fallback = this.sanitizeAutoAdjustedPlans?.(buildFallbackPlans({ ...this, sourceDate, targetDate, db: this.db }, sourcePlans), { sourceDate, targetDate, sourcePlans, types }) || [];
                const applied = this.applyAutoAdjustedPlans?.(fallback, { sourceDate, targetDate, beforePlans, key, latestDoneAt, fallback: true });
                if (applied) {
                    window.toast?.show?.('AI 调整失败，已用本地规则保守调整明天计划', 'info', {
                        timeout: 8000,
                        action: '撤销',
                        onAction: () => this.undoLastPlanAutoAdjust?.()
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
                if (!window.ai?.call) await window.loadAppScript('ai-api');
                if (!window.planAiPure) await window.loadAppScript('plan-ai-pure');
                if (!window.dataPlanAi?.buildPlanAiContext) await window.loadAppScript('plan-ai');
                this.refreshModules?.();
            }
            if (window.ai && !window.ai.cfg?.profiles?.length && typeof window.ai.init === 'function') {
                await window.ai.init({ saveData: true, renderData: false });
            }
            if (!window.ai?.call && !window.ai?.callStream) throw new Error('AI 模块未配置或未加载');
            if (typeof this.buildPlanAiContext !== 'function' || typeof this.parsePlanAiPayload !== 'function') throw new Error('训练计划 AI 模块未就绪');
        },

        async generateAutoAdjustedPlans({ sourceDate, targetDate, sourcePlans, types }) {
            const stats = feedbackStats(sourcePlans);
            const prescription = preferredPrescriptionActions(this.db || {});
            const avoided = avoidedActionNames(this.db || {});
            const extra = [
                '自动调整模式：今天训练已经结束，请直接生成/重写明天计划。',
                `源日期: ${sourceDate}；目标日期必须是: ${targetDate}。`,
                '必须延续今天已完成的计划类型，不要凭空新增未训练类型。',
                '用户要求：根据反馈及时调整第二天强度；反馈“太轻”或“合适”(RPE 1-2)时必须小幅增加难度，RPE 3 维持或微调，RPE 4-5 降载、替换或避开高负荷。',
                '部位要求：疼痛避让，同时保证康复尽可能科学锻炼到相关功能链和全身部位，不要机械重复单一处方动作。',
                '处方优先：有康复处方时尽量使用最近3周处方动作作为主框架；可加入辅助/活动度/拮抗肌动作来补足部位覆盖，但必须在 aiReasoning 中说明。',
                '硬红线：dropped/avoid/暂停/停做/疼痛>=4 的处方动作不得出现；用户锁定任务由客户端保留，不要试图覆盖。',
                `今日反馈统计: ${JSON.stringify(stats)}`,
                `优先处方动作: ${JSON.stringify(prescription)}`,
                `禁用/高疼痛处方动作: ${JSON.stringify(avoided)}`
            ].join('\n');
            const messages = [
                { role: 'system', content: '你是康复和训练排程助手，只输出严格 JSON。' },
                { role: 'user', content: `${this.buildPlanAiContext('today', extra, types)}\n目标日期覆盖: 所有输出 plan.date 必须等于 ${targetDate}。` }
            ];
            const text = typeof window.ai.callStream === 'function'
                ? await window.ai.callStream(messages, 1800)
                : await window.ai.call(messages, 1800);
            const parsed = this.parsePlanAiPayload(text, types);
            if (!parsed.ok) throw new Error(parsed.reason || 'AI 返回计划无法解析');
            return parsed.plans.map((plan) => ({ ...plan, date: targetDate }));
        },

        sanitizeAutoAdjustedPlans(plans = [], ctx = {}) {
            const types = new Set(normalizePlanTypes(ctx.types));
            const avoidNames = avoidedActionNames(this.db || {});
            return (Array.isArray(plans) ? plans : [])
                .map((plan) => {
                    const type = PLAN_TYPES.includes(plan.type) ? plan.type : [...types][0] || 'rehab';
                    if (!types.has(type)) return null;
                    const items = (Array.isArray(plan.items) ? plan.items : [])
                        .filter((item) => item && item.name && !itemMatchesAny(item, avoidNames))
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
                    return {
                        date: ctx.targetDate,
                        type,
                        title: String(plan.title || this.planTypeMeta?.(type)?.label || '训练计划'),
                        source: 'ai',
                        notes: String(plan.notes || `自动根据 ${ctx.sourceDate} 反馈调整`),
                        items
                    };
                })
                .filter((plan) => plan && plan.items.length);
        },

        applyAutoAdjustedPlans(plans = [], meta = {}) {
            if (!plans.length) return false;
            const beforePlans = meta.beforePlans || clone(this.db.dailyPlans || []);
            plans.forEach((plan) => {
                const current = (this.activeRecords?.(this.db.dailyPlans || []) || []).find((item) => item.date === plan.date && (item.type || 'rehab') === (plan.type || 'rehab'));
                const preserved = activeItems(current).filter((item) => item.userOverride || item.status === 'done');
                const merged = this.ensureDailyPlanShape?.({
                    ...(current || {}),
                    date: plan.date,
                    type: plan.type || 'rehab',
                    title: plan.title || this.planTypeMeta?.(plan.type)?.label || '训练计划',
                    source: 'ai',
                    notes: plan.notes,
                    items: [...preserved, ...plan.items]
                }) || plan;
                this.saveDailyPlan?.(merged, { save: false });
            });
            this.db.lastPlanAutoAdjust = {
                key: meta.key || '',
                sourceDate: meta.sourceDate || '',
                targetDate: meta.targetDate || '',
                latestDoneAt: Number(meta.latestDoneAt || Date.now()),
                beforePlans,
                appliedAt: Date.now(),
                fallback: !!meta.fallback
            };
            this.save?.();
            this.render?.();
            return true;
        },

        undoLastPlanAutoAdjust() {
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
        }
    };
})();
