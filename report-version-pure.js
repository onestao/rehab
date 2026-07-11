// @ts-nocheck
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.reportVersionPure = api;
})(typeof window !== 'undefined' ? window : null, function () {
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
            fallback: result.fallback || result.meta?.fallback || fallback.fallback || null
        };
    }

    function makeVersion(payload = {}, now = Date.now()) {
        return {
            id: payload.id || `v-${now}-${Math.random().toString(36).slice(2, 8)}`,
            createdAt: payload.createdAt || new Date(now).toISOString(),
            content: payload.content || '',
            ai: payload.ai || {},
            metrics: payload.metrics
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
                metrics: record.metrics
            }, now)];
        }
        versions = versions.slice(-LIMIT);
        const activeVersionId = versions.some(v => v.id === record.activeVersionId)
            ? record.activeVersionId : versions.at(-1)?.id || '';
        return { ...record, versions, activeVersionId };
    }

    function appendVersion(record, payload, now = Date.now()) {
        const normalized = normalizeRecord(record, now) || {};
        const version = makeVersion(payload, now);
        const versions = [...normalized.versions, version].slice(-LIMIT);
        return { ...normalized, versions, activeVersionId: version.id, updatedAt: now };
    }

    function activeVersion(record) {
        const normalized = normalizeRecord(record);
        return normalized?.versions.find(v => v.id === normalized.activeVersionId) || normalized?.versions.at(-1) || null;
    }

    function cycle(record, delta) {
        const normalized = normalizeRecord(record);
        if (!normalized?.versions.length) return normalized;
        const current = Math.max(0, normalized.versions.findIndex(v => v.id === normalized.activeVersionId));
        const index = Math.max(0, Math.min(normalized.versions.length - 1, current + Number(delta || 0)));
        return { ...normalized, activeVersionId: normalized.versions[index].id };
    }

    function removeVersion(record, versionId) {
        const normalized = normalizeRecord(record);
        if (!normalized?.versions.length) return normalized;
        const current = normalized.versions.findIndex(version => version.id === versionId);
        const versions = normalized.versions.filter(version => version.id !== versionId);
        const next = versions[Math.min(Math.max(current, 0), versions.length - 1)] || versions.at(-1) || null;
        return { ...normalized, versions, activeVersionId: next?.id || '' };
    }

    return { LIMIT, metaFromResult, makeVersion, normalizeRecord, appendVersion, activeVersion, cycle, removeVersion };
});
