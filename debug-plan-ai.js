// @ts-nocheck
(function () {
    if (window.planAiDebug) return;

    const patched = [];
    let enabled = false;

    function truncate(value, max = 120) {
        const raw = String(value || '').trim();
        return raw.length > max ? `${raw.slice(0, max)}...` : raw;
    }

    function asArray(value) {
        return Array.isArray(value) ? value.filter(Boolean) : [];
    }

    function categoryOf(item = {}) {
        const raw = item.category || item.type || item.phase || item.section || 'main';
        return window.planAiPure?.normalizeAiCategory?.(raw) || window.actionTaxonomy?.normalizePlanPhase?.(raw) || 'main';
    }

    function collectRawItems(plan = {}) {
        if (Array.isArray(plan.items)) return plan.items;
        const items = [];
        ['warmup', 'warmUp', 'main', 'cooldown', 'stretching', 'actions', 'exercises'].forEach((key) => {
            if (Array.isArray(plan[key])) items.push(...plan[key]);
        });
        if (Array.isArray(plan.sections)) {
            plan.sections.forEach((section) => {
                if (Array.isArray(section?.items)) items.push(...section.items);
                if (Array.isArray(section?.actions)) items.push(...section.actions);
                if (Array.isArray(section?.exercises)) items.push(...section.exercises);
            });
        }
        return items;
    }

    function summarizeItem(item = {}) {
        const spec = item.spec || {};
        return {
            name: truncate(item.name || item.canonicalName || item.title || ''),
            category: categoryOf(item),
            source: item.policy?.source || '',
            blocked: !!(item.policy?.blocked || item.policy?.source === 'blocked'),
            requiresUserConfirm: !!item.requiresUserConfirm,
            userConfirmed: item.userConfirmed === true,
            prescription: !!item.prescriptionActionId,
            autoFilled: asArray(item.autoFilled),
            mode: spec.mode || item.mode || '',
            sets: Number(spec.sets || item.sets || 0),
            reps: Number(spec.reps || item.reps || 0),
            work: Number(spec.work || item.work || 0),
            rest: Number(spec.actionRest || item.actionRest || item.rest || 0)
        };
    }

    function summarizeItems(items = []) {
        const list = asArray(items);
        const categories = {};
        const policySources = {};
        list.forEach((item) => {
            const category = categoryOf(item);
            categories[category] = (categories[category] || 0) + 1;
            const source = item?.policy?.source || (item?.prescriptionActionId ? 'prescription' : '');
            if (source) policySources[source] = (policySources[source] || 0) + 1;
        });
        return {
            count: list.length,
            categories,
            policySources,
            confirmRequired: list.filter((item) => item?.requiresUserConfirm).length,
            confirmed: list.filter((item) => item?.requiresUserConfirm && item?.userConfirmed === true).length,
            blocked: list.filter((item) => item?.policy?.blocked || item?.policy?.source === 'blocked').length,
            prescription: list.filter((item) => item?.prescriptionActionId).length,
            autoFilled: list.filter((item) => asArray(item?.autoFilled).length).length,
            samples: list.slice(0, 8).map(summarizeItem)
        };
    }

    function summarizePlans(plans = []) {
        return asArray(plans).map((plan) => {
            const items = collectRawItems(plan);
            return {
                date: truncate(plan?.date || plan?.day || plan?.dayKey || ''),
                type: truncate(plan?.type || plan?.planType || plan?.goal || ''),
                title: truncate(plan?.title || plan?.name || ''),
                ...summarizeItems(items)
            };
        });
    }

    function itemKey(item = {}) {
        return `${categoryOf(item)}:${String(item.name || item.canonicalName || item.title || '').trim()}`;
    }

    function summarizeSanitizeChanges(beforePlans = [], afterPlans = []) {
        return asArray(beforePlans).map((beforePlan, index) => {
            const beforeItems = collectRawItems(beforePlan);
            const afterItems = collectRawItems(asArray(afterPlans)[index] || {});
            const beforeKeys = new Set(beforeItems.map(itemKey));
            const afterKeys = new Set(afterItems.map(itemKey));
            const added = afterItems.filter((item) => !beforeKeys.has(itemKey(item))).slice(0, 8).map(summarizeItem);
            const removed = beforeItems.filter((item) => !afterKeys.has(itemKey(item))).slice(0, 8).map(summarizeItem);
            return {
                index,
                beforeCount: beforeItems.length,
                afterCount: afterItems.length,
                addedCount: Math.max(0, afterItems.length - beforeItems.length),
                removedCount: Math.max(0, beforeItems.length - afterItems.length),
                added,
                removed
            };
        }).filter((entry) => entry.added.length || entry.removed.length || entry.beforeCount !== entry.afterCount);
    }

    function summarizePolicy(entries = []) {
        return asArray(entries).map((entry) => ({
            type: truncate(entry.type || entry.planType || ''),
            keptBlockedForConfirm: summarizeItems(entry.keptBlockedForConfirm).count,
            removedBlocked: summarizeItems(entry.removedBlocked).count,
            addedCooldown: summarizeItems(entry.addedCooldown).count,
            mustKeep: asArray(entry.mustKeep).length
        }));
    }

    function event(type, meta = {}) {
        if (!enabled) return;
        try { window.errorBus?.event?.('plan-ai', type, meta); } catch {}
    }

    function patch(target, name, wrap) {
        const original = target?.[name];
        if (typeof original !== 'function' || original.__planAiDebugPatched) return;
        const wrapped = function (...args) {
            return wrap.call(this, original, args);
        };
        wrapped.__planAiDebugPatched = true;
        wrapped.__planAiDebugOriginal = original;
        target[name] = wrapped;
        patched.push(() => {
            if (target[name] === wrapped) target[name] = original;
        });
    }

    function patchPlanPolicy() {
        patch(window.planPolicy, 'sanitizeGeneratedPlans', function (original, args) {
            const beforePlans = args[0];
            const options = args[1] || {};
            const policy = [];
            const onDebug = options.onDebug;
            const nextOptions = {
                ...options,
                onDebug(entry) {
                    policy.push(entry);
                    if (typeof onDebug === 'function') onDebug(entry);
                }
            };
            const result = original.call(this, beforePlans, nextOptions);
            event('sanitize', {
                before: summarizePlans(beforePlans),
                after: summarizePlans(result),
                changes: summarizeSanitizeChanges(beforePlans, result),
                policy: summarizePolicy(policy)
            });
            return result;
        });
    }

    function patchPlanApi(target) {
        if (!target) return;
        patch(target, 'parsePlanAiPayload', function (original, args) {
            const started = Date.now();
            try {
                const result = original.apply(this, args);
                event(result?.ok ? 'parse:success' : 'parse:failed', {
                    reason: truncate(result?.reason || ''),
                    rawChars: String(args[0] || '').length,
                    elapsedMs: Date.now() - started,
                    plans: summarizePlans(result?.plans || [])
                });
                return result;
            } catch (e) {
                event('parse:thrown', { error: truncate(e?.message || e), elapsedMs: Date.now() - started });
                throw e;
            }
        });
        patch(target, 'validatePlanAiPayload', function (original, args) {
            const result = original.apply(this, args);
            event('validate', {
                ok: !!result?.ok,
                errorCount: asArray(result?.errors).length,
                errors: asArray(result?.errors).slice(0, 6).map((item) => truncate(item, 180))
            });
            return result;
        });
        patch(target, 'previewPlanAiPlans', function (original, args) {
            const beforePlans = args[0];
            const options = args[1] || {};
            event('preview:open:start', {
                skipSanitize: !!options.skipSanitize,
                before: summarizePlans(beforePlans)
            });
            const result = original.apply(this, args);
            event('preview:open:done', {
                issue: truncate(options.issue?.message || ''),
                after: summarizePlans(this._pendingPlanAiPlans || beforePlans)
            });
            return result;
        });
        patch(target, 'setPlanAiPreviewIssue', function (original, args) {
            const message = String(args[0] || '');
            if (message) event('preview:issue', { message: truncate(message, 220) });
            return original.apply(this, args);
        });
        patch(target, 'confirmPlanAiPlans', function (original, args) {
            let collected = [];
            try { collected = this.collectPlanAiPreviewPlans?.() || []; } catch (e) {
                event('confirm:collect-failed', { error: truncate(e?.message || e) });
            }
            const beforeCount = asArray(this.db?.dailyPlans).length;
            const beforeSelectedPlanId = String(this.selectedPlanId || '');
            event('confirm:start', { plans: summarizePlans(collected), dailyPlanCount: beforeCount });
            try {
                const result = original.apply(this, args);
                event('confirm:finish', {
                    dailyPlanCountBefore: beforeCount,
                    dailyPlanCountAfter: asArray(this.db?.dailyPlans).length,
                    selectedChanged: beforeSelectedPlanId !== String(this.selectedPlanId || ''),
                    pending: summarizePlans(this._pendingPlanAiPlans || [])
                });
                return result;
            } catch (e) {
                event('confirm:thrown', { error: truncate(e?.message || e) });
                throw e;
            }
        });
    }

    function install() {
        if (!enabled) return;
        patchPlanPolicy();
        patchPlanApi(window.dataPlanAi);
        patchPlanApi(window.data);
    }

    function enable() {
        enabled = true;
        window.errorBus?.enableDebug?.();
        install();
        event('debug:enabled', { hasPlanAi: !!window.dataPlanAi, hasData: !!window.data });
    }

    function disable() {
        enabled = false;
        while (patched.length) {
            try { patched.pop()(); } catch {}
        }
    }

    function snapshot() {
        return {
            enabled,
            pending: summarizePlans(window.data?._pendingPlanAiPlans || window.dataPlanAi?._pendingPlanAiPlans || []),
            dailyPlans: summarizePlans(window.data?.db?.dailyPlans || []),
            debugEvents: window.errorBus?.listDebug?.().filter((entry) => entry?.scope === 'plan-ai').length || 0
        };
    }

    window.planAiDebug = { enable, disable, install, event, snapshot, summarizePlans };
    if (window.errorBus?.isDebugEnabled?.()) enable();
})();
