/**
 * @param {{ activeProfileId?: string, provider?: string, model?: string, baseUrl?: string, profiles?: Array<{ id?: string, provider?: string, model?: string, baseUrl?: string }> }} cfg
 * @param {Record<string, string>} keyMap
 * @param {{ profileId?: string, provider?: string, model?: string } | null} override
 */
export function resolveEffectiveAiConfig(cfg = {}, keyMap = {}, override = null) {
  const profiles = Array.isArray(cfg.profiles) ? cfg.profiles : [];
  const activeProfile = profiles.find((profile) => profile.id === cfg.activeProfileId) || null;
  const overrideProfile = override?.profileId
    ? profiles.find((profile) => profile.id === override.profileId) || null
    : null;
  const base = overrideProfile || activeProfile || {
    id: cfg.activeProfileId || '',
    provider: cfg.provider || 'openai',
    model: cfg.model || '',
    baseUrl: cfg.baseUrl || ''
  };
  const profileId = override?.profileId || base.id || cfg.activeProfileId || '';
  const provider = override?.provider || base.provider || cfg.provider || 'openai';
  const model = override?.model || base.model || cfg.model || '';
  const baseUrl = base.baseUrl || cfg.baseUrl || '';
  return {
    profileId,
    provider,
    model,
    baseUrl,
    enabled: !!(baseUrl && model),
    apiKey: profileId ? (keyMap[profileId] || '') : ''
  };
}
