// @ts-nocheck

function normalizeProvider(provider = '') {
    return String(provider || '').trim() || 'openai';
}

function normalizeSource(source = '') {
    return source === 'manual' ? 'manual' : 'discovered';
}

function normalizeUrl(baseUrl = '') {
    return String(baseUrl || '').trim().replace(/\/+$/, '').toLowerCase();
}

export function endpointFingerprint(baseUrl = '') {
    const input = normalizeUrl(baseUrl);
    if (!input) return '';
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return `ep_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function listContains(value, expected) {
    const list = Array.isArray(value) ? value : (value ? [value] : []);
    return list.some(item => String(item || '').toLowerCase().includes(expected));
}

function inferVendor(model = {}, provider = '') {
    return String(model.vendor || model.owned_by || model.ownedBy || model.publisher || '').trim()
        || ({ claude: 'Anthropic', gemini: 'Google', openai: 'OpenAI', 'openai-responses': 'OpenAI' })[provider]
        || provider;
}

export function inferModelFamily(model = {}) {
    const id = String(model.id || model.name || '').toLowerCase();
    const owner = String(model.owned_by || model.ownedBy || model.vendor || model.publisher || '').trim();
    const rules = [
        [/claude/, 'Claude'], [/gemini/, 'Gemini'], [/(^|[/_-])gpt([/_-]|$)|(^|[/_-])o[134]([/_-]|$)/, 'OpenAI'],
        [/deepseek/, 'DeepSeek'], [/qwen|qwq/, 'Qwen'], [/glm/, 'GLM'], [/llama/, 'Llama'],
        [/mistral|mixtral/, 'Mistral'], [/command-r/, 'Command'], [/embedding|embed/, 'Embedding']
    ];
    return rules.find(([pattern]) => pattern.test(id))?.[1] || owner || '其他';
}

function inferIconKey(vendor = '', provider = '', modelId = '') {
    const value = `${vendor} ${modelId}`.toLowerCase();
    if (/anthropic|claude/.test(value)) return 'claude';
    if (/google|gemini/.test(value)) return 'gemini';
    if (/deepseek/.test(value)) return 'deepseek';
    if (/qwen|alibaba|dashscope/.test(value)) return 'qwen';
    if (/openai|gpt|o[134]-/.test(value)) return 'openai';
    return provider || 'generic';
}

function inferSizeTier(modelId = '') {
    const id = String(modelId || '').toLowerCase();
    if (/mini|nano|flash|haiku|small|lite|\b7b\b|\b8b\b/.test(id)) return 'small';
    if (/opus|pro|max|large|\b70b\b|\b72b\b|\b120b\b/.test(id)) return 'large';
    return 'unknown';
}

function inferReasoning(modelId = '', provider = '') {
    const value = `${provider} ${modelId}`.toLowerCase();
    return /(^|[\/_-])(o[134]|gpt-5|deepseek-r1|qwq)([\/_-]|$)|claude-(3-7|4|opus-4|sonnet-4)|gemini-(2\.5|3)/.test(value);
}

export function normalizeCatalogModel(model = {}, context = {}) {
    const provider = normalizeProvider(context.provider || model.provider);
    const id = String(model.id || model.name || '').replace(/^models\//, '').trim();
    const fetchedAt = String(context.fetchedAt || model.fetchedAt || new Date().toISOString());
    const vendor = inferVendor(model, provider);
    const upstreamCapabilities = model.capabilities && typeof model.capabilities === 'object' ? model.capabilities : {};
    const vision = model.vision === true
        || upstreamCapabilities.vision === true
        || listContains(model.input_modalities || model.inputModalities || model.modalities, 'image')
        || listContains(upstreamCapabilities.input_modalities || upstreamCapabilities.inputModalities || upstreamCapabilities.modalities, 'image');
    const visionCapability = vision
        ? true
        : (upstreamCapabilities.vision === false || model.vision === false ? false : undefined);
    return {
        ...model,
        id,
        displayName: String(model.displayName || model.display_name || id),
        profileId: String(context.profileId || model.profileId || '').trim(),
        provider,
        endpointFingerprint: String(context.endpointFingerprint || model.endpointFingerprint || endpointFingerprint(context.baseUrl || '')),
        vendor,
        family: String(model.family || inferModelFamily(model)),
        owned_by: String(model.owned_by || model.ownedBy || vendor),
        iconKey: String(model.iconKey || inferIconKey(vendor, provider, id)),
        capabilities: {
            text: upstreamCapabilities.text !== false,
            vision: visionCapability,
            streaming: upstreamCapabilities.streaming === true || model.streaming === true,
            json: upstreamCapabilities.json === true || upstreamCapabilities.json_mode === true || model.json === true,
            reasoning: upstreamCapabilities.reasoning === false || model.reasoning === false
                ? false
                : (upstreamCapabilities.reasoning === true || model.reasoning === true || inferReasoning(id, provider) ? true : undefined)
        },
        sizeTier: String(model.sizeTier || inferSizeTier(id)),
        source: normalizeSource(context.source || model.source),
        enabled: model.enabled !== false,
        fetchedAt,
        lastSeenAt: String(context.lastSeenAt || model.lastSeenAt || fetchedAt)
    };
}

function sortCatalog(models = []) {
    return models.sort((a, b) => {
        const profileOrder = String(a.profileId || '').localeCompare(String(b.profileId || ''));
        if (profileOrder !== 0) return profileOrder;
        return String(a.id || '').localeCompare(String(b.id || ''));
    });
}

export function replaceDiscoveredModelsForProfile(existing = [], incoming = [], context = {}) {
    const profileId = String(context.profileId || '').trim();
    const current = Array.isArray(existing) ? existing : [];
    const previousById = new Map(current
        .filter(model => String(model?.profileId || '') === profileId)
        .map(model => [String(model?.id || ''), model]));
    const kept = current.filter(model => {
        return String(model?.profileId || '') !== profileId || normalizeSource(model?.source) === 'manual';
    });
    const discovered = (Array.isArray(incoming) ? incoming : [])
        .filter(model => normalizeSource(previousById.get(String(model?.id || ''))?.source) !== 'manual')
        .map(model => {
            const previous = previousById.get(String(model?.id || ''));
            return normalizeCatalogModel({ ...model, enabled: previous?.enabled ?? model?.enabled }, {
                ...context, profileId, source: 'discovered'
            });
        })
        .filter(model => model.id);
    return sortCatalog([...kept, ...discovered]);
}

export function clearModelCatalog(models = [], options = {}) {
    const profileId = String(options.profileId || '').trim();
    const includeManual = options.includeManual === true;
    return (Array.isArray(models) ? models : []).filter(model => {
        if (profileId && String(model?.profileId || '') !== profileId) return true;
        if (!includeManual && normalizeSource(model?.source) === 'manual') return true;
        return false;
    });
}

export function migrateLegacyModelCatalog(models = [], profiles = []) {
    const profileList = Array.isArray(profiles) ? profiles : [];
    return (Array.isArray(models) ? models : []).map(model => {
        if (model?.profileId) return normalizeCatalogModel(model, model);
        const provider = normalizeProvider(model?.provider);
        const matches = profileList.filter(profile => normalizeProvider(profile?.provider) === provider);
        if (matches.length !== 1) {
            return normalizeCatalogModel({ ...model, migrationStatus: 'needs-refresh' }, {
                provider,
                source: model?.source || 'discovered'
            });
        }
        const profile = matches[0];
        return normalizeCatalogModel({ ...model, migrationStatus: 'migrated' }, {
            profileId: profile.id,
            provider,
            baseUrl: profile.baseUrl || '',
            source: model?.source || 'discovered'
        });
    });
}

if (typeof window !== 'undefined') {
    window.aiModelCatalogPure = {
        clearModelCatalog,
        endpointFingerprint,
        inferModelFamily,
        migrateLegacyModelCatalog,
        normalizeCatalogModel,
        replaceDiscoveredModelsForProfile
    };
}
