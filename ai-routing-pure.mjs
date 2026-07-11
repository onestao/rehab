// @ts-nocheck
export const REASONING_DEPTHS = Object.freeze(['auto', 'off', 'low', 'medium', 'high']);
export const FALLBACK_MODES = Object.freeze(['manual', 'automatic']);

const EXPLICIT_REASONING_DEPTHS = new Set(['low', 'medium', 'high']);
const PROTOCOL_ALIASES = Object.freeze({
  openai: 'openai-chat',
  'openai-compatible': 'openai-chat',
  'openai-chat': 'openai-chat',
  'openai-responses': 'openai-responses',
  anthropic: 'claude',
  claude: 'claude',
  google: 'gemini',
  gemini: 'gemini'
});
const THINKING_BUDGETS = Object.freeze({ low: 1024, medium: 4096, high: 8192 });

function routingError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function normalizeId(value) {
  return String(value || '').trim();
}

function normalizeDepth(value, fallback = 'auto') {
  const depth = String(value || '').trim().toLowerCase();
  return REASONING_DEPTHS.includes(depth) ? depth : fallback;
}

function normalizeFallbackMode(value, fallback = 'manual') {
  const mode = String(value || '').trim().toLowerCase();
  return FALLBACK_MODES.includes(mode) ? mode : fallback;
}

function normalizeTarget(value, defaultDepth = null) {
  if (!value || typeof value !== 'object') return null;
  const profileId = normalizeId(value.profileId || value.connectionId);
  const modelId = normalizeId(value.modelId || value.model);
  if (!profileId || !modelId) return null;
  const target = { profileId, modelId };
  if (value.reasoningDepth != null || defaultDepth != null) {
    target.reasoningDepth = normalizeDepth(value.reasoningDepth, defaultDepth || 'auto');
  }
  return target;
}

function targetKey(target) {
  return `${target.profileId}\u0000${target.modelId}\u0000${target.reasoningDepth || ''}`;
}

export function normalizeTaskRegistry(input = {}) {
  const definitions = Array.isArray(input)
    ? input.map(raw => [null, raw])
    : Object.entries(input || {});
  const registry = {};
  for (const [key, raw] of definitions) {
    if (!raw || typeof raw !== 'object') continue;
    const id = normalizeId(raw.id || raw.taskId || key);
    if (!id) throw routingError('AI_TASK_ID_REQUIRED', 'AI task id is required');
    if (registry[id]) throw routingError('AI_TASK_DUPLICATE', `Duplicate AI task: ${id}`, { taskId: id });
    registry[id] = {
      id,
      defaultReasoningDepth: normalizeDepth(raw.defaultReasoningDepth, 'auto'),
      requiredCapabilities: [...new Set(
        (Array.isArray(raw.requiredCapabilities) ? raw.requiredCapabilities : [])
          .map(normalizeId)
          .filter(Boolean)
      )]
    };
  }
  return registry;
}

export function registerTaskDefinitions(registry = {}, definitions = []) {
  const current = normalizeTaskRegistry(registry);
  const additions = normalizeTaskRegistry(definitions);
  const merged = { ...current };
  for (const [id, definition] of Object.entries(additions)) {
    if (merged[id]) throw routingError('AI_TASK_DUPLICATE', `Duplicate AI task: ${id}`, { taskId: id });
    merged[id] = definition;
  }
  return merged;
}

export function normalizeTaskRoute(route = {}, defaults = {}) {
  const defaultPrimary = normalizeTarget(defaults.primary || defaults);
  const primary = normalizeTarget(route.primary || route, null) || defaultPrimary;
  const reasoningDepth = normalizeDepth(
    route.reasoningDepth,
    normalizeDepth(defaults.reasoningDepth, 'auto')
  );
  const fallbackMode = normalizeFallbackMode(route.fallbackMode, normalizeFallbackMode(defaults.fallbackMode, 'manual'));
  const fallbacks = [];
  const seen = new Set(primary ? [targetKey({ ...primary, reasoningDepth })] : []);
  const rawFallbacks = Array.isArray(route.fallbacks)
    ? route.fallbacks
    : (Array.isArray(defaults.fallbacks) ? defaults.fallbacks : []);
  for (const raw of rawFallbacks) {
    const fallback = normalizeTarget(raw, null);
    if (!fallback) continue;
    const comparable = { ...fallback, reasoningDepth: fallback.reasoningDepth || reasoningDepth };
    const key = targetKey(comparable);
    if (seen.has(key)) continue;
    seen.add(key);
    fallbacks.push(fallback);
  }
  return { primary, reasoningDepth, fallbackMode, fallbacks };
}

function normalizeOverride(override) {
  if (!override || typeof override !== 'object') return null;
  const source = override.primary && typeof override.primary === 'object'
    ? { ...override.primary, reasoningDepth: override.reasoningDepth ?? override.primary.reasoningDepth }
    : override;
  const target = normalizeTarget({
    profileId: source.profileId || source.connectionId,
    modelId: source.modelId || source.model
  }, null);
  return {
    target,
    reasoningDepth: source.reasoningDepth == null ? null : normalizeDepth(source.reasoningDepth, 'auto'),
    fallbacks: Array.isArray(override.fallbacks) ? override.fallbacks : null,
    fallbackMode: override.fallbackMode == null ? null : normalizeFallbackMode(override.fallbackMode, 'manual')
  };
}

export function resolveTaskRoute(cfg = {}, taskId, override = null) {
  const id = normalizeId(taskId);
  if (!id) throw routingError('AI_TASK_ID_REQUIRED', 'AI task id is required');
  const registry = normalizeTaskRegistry(cfg.taskRegistry || cfg.tasks || {});
  const definition = registry[id] || null;
  const defaultRoute = normalizeTaskRoute(cfg.defaultRoute || cfg.route || {});
  const routes = cfg.taskRoutes || cfg.aiTaskRoutes || {};
  const taskRoute = routes[id] || {};
  const route = normalizeTaskRoute(taskRoute, {
    ...defaultRoute,
    reasoningDepth: taskRoute.reasoningDepth == null
      ? (definition?.defaultReasoningDepth || defaultRoute.reasoningDepth)
      : defaultRoute.reasoningDepth
  });
  const normalizedOverride = normalizeOverride(override);
  if (normalizedOverride?.target) route.primary = normalizedOverride.target;
  if (normalizedOverride?.reasoningDepth) route.reasoningDepth = normalizedOverride.reasoningDepth;
  if (normalizedOverride?.fallbackMode) route.fallbackMode = normalizedOverride.fallbackMode;
  if (normalizedOverride?.fallbacks) {
    route.fallbacks = normalizeTaskRoute({
      primary: route.primary,
      reasoningDepth: route.reasoningDepth,
      fallbacks: normalizedOverride.fallbacks
    }).fallbacks;
  }
  route.fallbacks = route.fallbacks.map(item => ({
    ...item,
    reasoningDepth: item.reasoningDepth || route.reasoningDepth
  }));
  return { taskId: id, ...route };
}

export function buildFallbackSequence(route = {}) {
  const normalized = normalizeTaskRoute(route);
  const sequence = [];
  if (normalized.primary) {
    sequence.push({ ...normalized.primary, reasoningDepth: normalized.reasoningDepth });
  }
  if (normalized.fallbackMode === 'automatic') {
    for (const fallback of normalized.fallbacks) {
      sequence.push({ ...fallback, reasoningDepth: fallback.reasoningDepth || normalized.reasoningDepth });
    }
  }
  return sequence;
}

function normalizeProtocol(value) {
  return PROTOCOL_ALIASES[String(value || '').trim().toLowerCase()] || '';
}

function inferReasoningSupport(protocol, modelId) {
  const model = String(modelId || '').trim().toLowerCase();
  if (protocol === 'openai-responses') {
    return /(^|[\/_-])(o[134]|gpt-5)([\/_-]|$)/.test(model);
  }
  if (protocol === 'openai-chat') {
    return /(^|[\/_-])(o[134]|gpt-5|deepseek-r1|qwq)([\/_-]|$)/.test(model);
  }
  if (protocol === 'claude') return /claude-(3-7|4|opus-4|sonnet-4)/.test(model);
  if (protocol === 'gemini') return /gemini-(2\.5|3)/.test(model);
  return false;
}

function supportedModes(capabilities = {}) {
  if (!Array.isArray(capabilities.reasoningModes)) return null;
  return [...new Set(capabilities.reasoningModes.map(item => normalizeDepth(item, '')).filter(item => EXPLICIT_REASONING_DEPTHS.has(item)))];
}

function unsupportedReasoning(protocol, modelId) {
  return routingError(
    'AI_REASONING_UNSUPPORTED',
    `Reasoning is not supported by ${protocol || 'unknown protocol'}${modelId ? ` / ${modelId}` : ''}`,
    { protocol, modelId }
  );
}

export function buildReasoningOptions(options = {}) {
  const protocol = normalizeProtocol(options.protocol || options.provider);
  const modelId = normalizeId(options.modelId || options.model);
  const capabilities = options.capabilities && typeof options.capabilities === 'object'
    ? options.capabilities
    : {};
  const requestedDepth = normalizeDepth(options.reasoningDepth, 'auto');
  const visibleOutputTokens = Number.isFinite(Number(options.maxOutputTokens))
    ? Math.max(0, Math.floor(Number(options.maxOutputTokens)))
    : 0;
  const base = {
    requestedDepth,
    effectiveDepth: 'off',
    supported: true,
    params: {},
    omitTemperature: false,
    maxOutputTokens: visibleOutputTokens,
    visibleOutputTokens,
    thinkingBudget: 0
  };
  if (requestedDepth === 'off') return base;

  const explicitlyUnsupported = capabilities.reasoning === false;
  const inferredSupport = inferReasoningSupport(protocol, modelId);
  if (requestedDepth === 'auto' && (explicitlyUnsupported || (!protocol || (capabilities.reasoning !== true && !inferredSupport)))) {
    return { ...base, supported: !explicitlyUnsupported };
  }
  if (!protocol || explicitlyUnsupported) throw unsupportedReasoning(protocol, modelId);

  const modes = supportedModes(capabilities);
  let effectiveDepth = requestedDepth;
  if (requestedDepth === 'auto') {
    const preferred = normalizeDepth(capabilities.defaultReasoningDepth, 'medium');
    effectiveDepth = modes?.includes(preferred) ? preferred : (modes?.[0] || preferred);
  }
  if (modes && !modes.includes(effectiveDepth)) {
    throw routingError(
      'AI_REASONING_DEPTH_UNSUPPORTED',
      `Reasoning depth ${effectiveDepth} is not supported by this model`,
      { protocol, modelId, reasoningDepth: effectiveDepth, supportedModes: modes }
    );
  }

  const result = { ...base, effectiveDepth, omitTemperature: true };
  if (protocol === 'openai-responses') {
    result.params = { reasoning: { effort: effectiveDepth } };
  } else if (protocol === 'openai-chat') {
    result.params = { reasoning_effort: effectiveDepth };
  } else if (protocol === 'claude') {
    const thinkingBudget = THINKING_BUDGETS[effectiveDepth];
    result.params = { thinking: { type: 'enabled', budget_tokens: thinkingBudget } };
    result.thinkingBudget = thinkingBudget;
    result.maxOutputTokens = visibleOutputTokens + thinkingBudget;
  } else if (protocol === 'gemini') {
    const thinkingBudget = THINKING_BUDGETS[effectiveDepth];
    result.params = { thinkingConfig: { thinkingBudget } };
    result.thinkingBudget = thinkingBudget;
  } else {
    throw unsupportedReasoning(protocol, modelId);
  }
  return result;
}

export function isRetryableAiError(errorLike) {
  if (!errorLike) return false;
  if (errorLike.name === 'AbortError' || errorLike.code === 'AI_CANCELLED') return false;
  const code = String(errorLike.code || '').toUpperCase();
  if (['AI_TIMEOUT', 'NETWORK_ERROR', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED'].includes(code)) return true;
  const status = Number(errorLike.status || errorLike.response?.status || 0);
  if (status === 408 || status === 429 || (status >= 500 && status <= 599)) return true;
  if (errorLike instanceof TypeError) {
    return /fetch|network|load failed/i.test(String(errorLike.message || errorLike));
  }
  return false;
}

if (typeof window !== 'undefined') {
  window.aiRoutingPure = {
    FALLBACK_MODES,
    REASONING_DEPTHS,
    buildFallbackSequence,
    buildReasoningOptions,
    isRetryableAiError,
    normalizeTaskRegistry,
    normalizeTaskRoute,
    registerTaskDefinitions,
    resolveTaskRoute
  };
}
