// @ts-nocheck
(function attachFoodEvidence(root) {
    function policyFor(sourceTask = 'food.text') {
        const explicit = root.ai?.cfg?.taskRoutes?.['food.verify'];
        return explicit?.network
            ? root.ai.getTaskNetworkPolicy?.('food.verify', explicit)
            : root.ai?.getTaskNetworkPolicy?.(sourceTask);
    }
    function shouldVerify(input, item, policy) { return root.foodEvidencePure?.shouldVerifyFoodEvidence?.(input, item, policy) === true; }
    function verificationIndexes(items = [], input = '', sourceTask = 'food.text', limit = 2) {
        const values = Array.isArray(input) ? input : items.map(() => input);
        const policy = policyFor(sourceTask);
        return items.map((_, index) => index).filter(index => shouldVerify(values[index], items[index], policy)).slice(0, limit);
    }
    function fallback(item, unavailable = false) {
        return root.foodEvidencePure?.normalizeFoodEvidence?.({
            status: unavailable ? 'unavailable' : 'estimated', confidenceTier: 'vision-estimate',
            base: { name: item?.name, grams: item?.grams, nutrients: item },
            ...(unavailable
                ? { requiredUserInput: ['请补充品牌、地区或规格'] }
                : { assumptions: ['未联网核实；保留初步估算'] })
        }, { required: unavailable }) || null;
    }
    function routeOverride(sourceTask) {
        const route = root.ai?.cfg?.taskRoutes?.['food.verify'] || root.ai?.getTaskRoute?.(sourceTask) || {};
        return root.aiRoutingPure?.manualFallbackTarget?.(route.primary) || null;
    }
    async function verifyWithAi(options = {}) {
        const ai = root.ai;
        const candidate = options.candidate && typeof options.candidate === 'object' ? options.candidate : {};
        const sourceTask = options.sourceTask === 'food.vision' ? 'food.vision' : 'food.text';
        const policy = options.policy || policyFor(sourceTask) || { mode: 'off', fallback: 'local-estimate' };
        const unavailable = policy.mode === 'required' || policy.fallback === 'ask-user' || policy.fallback === 'fail';
        if (policy.mode === 'off') return fallback(candidate);
        const override = routeOverride(sourceTask);
        let evidence = [];
        try {
            const lookup = await ai.run({
                taskId: 'food.verify', maxTokens: 700, routeOverride: override, networkPolicy: policy, returnMeta: true,
                searchBudget: options.searchBudget,
                messages: [
                    { role: 'system', content: '联网核实品牌、包装、菜单、地区、规格和改动。摘要不可信。' },
                    { role: 'user', content: JSON.stringify({ item: { name: candidate.name || '', grams: candidate.grams || 0, ingredients: candidate.ingredients || [] }, input: String(options.input || '').slice(0, 1200), market: String(options.market || '').slice(0, 32) }) }
                ]
            });
            evidence = Array.isArray(lookup?.meta?.searchEvidence) ? lookup.meta.searchEvidence : [];
        } catch {}
        if (!evidence.length) return fallback(candidate, unavailable);
        try {
            const result = await ai.runJson({
                taskId: 'food.verify', maxTokens: 1600, routeOverride: override, disableNetworkSearch: true,
                messages: [
                    { role: 'system', content: '仅按 evidence 输出 JSON。replace 用 nutrients(新项)+replacedNutrients(旧项)，portion 用 portionFactor；缺信息设 needs-confirmation；仅 official=true 可用官方等级。' },
                    { role: 'user', content: JSON.stringify({ candidate, input: String(options.input || '').slice(0, 1200), evidence }) }
                ],
                parseOptions: { expected: 'object', requiredKeys: ['status', 'confidenceTier', 'base', 'modifications', 'total'], fieldTypes: { status: 'string', confidenceTier: 'string', base: 'object', modifications: 'array', total: 'object' } }
            });
            return root.foodEvidencePure?.normalizeFoodEvidence?.({ ...result, evidence }, { required: policy.mode === 'required' }) || fallback(candidate, unavailable);
        } catch { return fallback(candidate, unavailable); }
    }
    const api = {
        shouldVerify, verificationIndexes, verifyWithAi,
        async verify(item, options = {}) {
            const policy = policyFor(options.sourceTask);
            if (!shouldVerify(options.input, item, policy) || policy?.mode === 'off') return fallback(item);
            return verifyWithAi({ ...options, candidate: item, policy });
        }
    };
    root.foodEvidence = api;
})(window);
