// @ts-check
(function () {
    /** @typedef {{ in: number, out: number }} TokenUsage */
    /** @typedef {{ provider: string, model: string, inUsdPer1kTok: number, outUsdPer1kTok: number }} PriceRow */

    /** @type {readonly PriceRow[]} */
    const PRICES = [
        // OpenAI (common)
        { provider: 'openai', model: 'gpt-4o-mini', inUsdPer1kTok: 0.00015, outUsdPer1kTok: 0.0006 },
        { provider: 'openai', model: 'gpt-4o', inUsdPer1kTok: 0.005, outUsdPer1kTok: 0.015 },

        // Anthropic (approx)
        { provider: 'claude', model: 'claude-3-5-sonnet', inUsdPer1kTok: 0.003, outUsdPer1kTok: 0.015 },
        { provider: 'claude', model: 'claude-3-5-haiku', inUsdPer1kTok: 0.0008, outUsdPer1kTok: 0.004 },

        // Gemini (approx)
        { provider: 'gemini', model: 'gemini-1.5-flash', inUsdPer1kTok: 0.00035, outUsdPer1kTok: 0.0007 },
        { provider: 'gemini', model: 'gemini-1.5-pro', inUsdPer1kTok: 0.0035, outUsdPer1kTok: 0.0105 },

        // DeepSeek/Qwen/etc (placeholder values; manually maintained)
        { provider: 'openai', model: 'deepseek-chat', inUsdPer1kTok: 0.0002, outUsdPer1kTok: 0.0002 },
        { provider: 'openai', model: 'qwen2.5-72b-instruct', inUsdPer1kTok: 0.0004, outUsdPer1kTok: 0.0004 }
    ];

    function norm(s) {
        return String(s || '').trim().toLowerCase();
    }

    /**
     * @param {string} provider
     * @param {string} model
     */
    function findPrice(provider, model) {
        const p = norm(provider);
        const m = norm(model);
        if (!m) return null;
        // exact match
        for (const row of PRICES) {
            if (norm(row.provider) === p && norm(row.model) === m) return row;
        }
        // prefix match for versioned models
        for (const row of PRICES) {
            if (norm(row.provider) !== p) continue;
            const rm = norm(row.model);
            if (m.startsWith(rm)) return row;
        }
        return null;
    }

    /**
     * @param {TokenUsage|null|undefined} usage
     * @param {string} provider
     * @param {string} model
     */
    function estimate(usage, provider, model) {
        const u = usage || { in: 0, out: 0 };
        const row = findPrice(provider, model);
        if (!row) return { costUsd: 0, price: null };
        const costUsd = (Number(u.in || 0) / 1000) * row.inUsdPer1kTok + (Number(u.out || 0) / 1000) * row.outUsdPer1kTok;
        return { costUsd: Number(costUsd.toFixed(6)), price: row };
    }

    window.aiPricing = {
        PRICES,
        findPrice,
        estimate
    };
})();
