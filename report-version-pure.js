// @ts-nocheck
(function (r, f) {
    const a = f(r ? r.searchPolicyPure : require('./report-search-evidence-pure.cjs'));
    if (typeof module !== 'undefined' && module.exports) module.exports = a;
    if (r) r.reportVersionPure = a;
})(typeof window !== 'undefined' ? window : null, function (p) {
    const LIMIT = 3;

    function metaFromResult(result, fallback = {}) {
        if (!result || typeof result === 'string') return {
            text: String(result || ''),
            model: fallback.model || fallback.modelId || 'ai',
            profileId: fallback.profileId || '',
            reasoningEffort: fallback.reasoningEffort || fallback.reasoningDepth || '',
            fallback: fallback.fallback || null
        };
        return {
            text: String(result.text ?? result.content ?? result.output ?? result.choices?.[0]?.message?.content ?? ''),
            model: result.model || result.modelId || result.meta?.model || result.meta?.modelId || fallback.model || fallback.modelId || 'ai',
            profileId: result.profileId || result.meta?.profileId || fallback.profileId || '',
            reasoningEffort: result.reasoningEffort || result.reasoningDepth || result.meta?.reasoningEffort || result.meta?.reasoningDepth || fallback.reasoningEffort || fallback.reasoningDepth || '',
            fallback: result.fallback || result.meta?.fallback || fallback.fallback || null,
            searchEvidence: result.searchEvidence || result.meta?.searchEvidence || fallback.searchEvidence || []
        };
    }

    function makeVersion(payload = {}, now = Date.now()) {
        const s = p.searchEvidenceVersion(payload);
        return {
            id: payload.id || `v-${now}-${Math.random().toString(36).slice(2, 8)}`,
            createdAt: payload.createdAt || new Date(now).toISOString(),
            content: payload.content || '',
            ai: s.ai,
            metrics: payload.metrics,
            searchEvidence: s.searchEvidence
        };
    }

    function normalizeRecord(record, now = Date.now()) {
        if (!record) return record;
        let versions = Array.isArray(record.versions) ? record.versions.filter(Boolean) : [];
        if (!versions.length && (record.ai || record.content)) {
            versions = [makeVersion({
                id: `${record.id || 'report'}-legacy`,
                createdAt: record.generatedAt || new Date(record.updatedAt || now).toISOString(),
                content: record.content || record.ai?.summary || '',
                ai: record.ai || {},
                metrics: record.metrics,
                searchEvidence: record.searchEvidence
            }, now)];
        }
        versions = versions.slice(-LIMIT);
        const activeVersionId = versions.some(v => v.id === record.activeVersionId)
            ? record.activeVersionId : versions.at(-1)?.id || '';
        return { ...record, versions, activeVersionId };
    }

    function appendVersion(record, payload, now = Date.now()) {
        const r = normalizeRecord(record, now) || {};
        const v = makeVersion(payload, now);
        return { ...r, versions: [...r.versions, v].slice(-LIMIT), activeVersionId: v.id, updatedAt: now };
    }

    function activeVersion(record) {
        const r = normalizeRecord(record);
        return r?.versions.find(v => v.id === r.activeVersionId) || r?.versions.at(-1) || null;
    }

    function cycle(record, delta) {
        const r = normalizeRecord(record);
        if (!r?.versions.length) return r;
        const i = Math.max(0, r.versions.findIndex(v => v.id === r.activeVersionId));
        const next = Math.max(0, Math.min(r.versions.length - 1, i + Number(delta || 0)));
        return { ...r, activeVersionId: r.versions[next].id };
    }

    function removeVersion(record, versionId) {
        const r = normalizeRecord(record);
        if (!r?.versions.length) return r;
        const i = r.versions.findIndex(v => v.id === versionId);
        const versions = r.versions.filter(v => v.id !== versionId);
        const next = versions[Math.min(Math.max(i, 0), versions.length - 1)] || versions.at(-1);
        return { ...r, versions, activeVersionId: next?.id || '' };
    }

    return { LIMIT, metaFromResult, makeVersion, normalizeRecord, appendVersion, activeVersion, cycle, removeVersion };
});
