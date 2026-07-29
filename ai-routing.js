// @ts-nocheck
(function () {
    const TASK_DEFINITIONS = Object.freeze([
        { id: 'advice.chat', label: 'AI 日常建议', group: '建议', defaultReasoningDepth: 'auto', requiredCapabilities: ['text', 'streaming'], localPicker: true },
        { id: 'advice.vision', label: 'AI 图片问答', group: '建议', defaultReasoningDepth: 'medium', requiredCapabilities: ['vision'], localPicker: true },
        { id: 'food.text', label: '文字食物解析', group: '饮食', defaultReasoningDepth: 'off', requiredCapabilities: ['text', 'json'] },
        { id: 'food.vision', label: '食物照片识别', group: '饮食', defaultReasoningDepth: 'low', requiredCapabilities: ['vision', 'json'], localPicker: true },
        { id: 'food.verify', label: '食物营养核实', group: '饮食', defaultReasoningDepth: 'off', requiredCapabilities: ['text', 'json'] },
        { id: 'rehab.weekly', label: '康复周处方解析', group: '康复', defaultReasoningDepth: 'off', requiredCapabilities: ['text', 'json'], localPicker: true },
        { id: 'plan.today', label: '今日训练计划', group: '训练计划', defaultReasoningDepth: 'medium', requiredCapabilities: ['text', 'json'], localPicker: true },
        { id: 'plan.week', label: '一周训练计划', group: '训练计划', defaultReasoningDepth: 'high', requiredCapabilities: ['text', 'json'], localPicker: true },
        { id: 'plan.adjust', label: '明日自动调整', group: '训练计划', defaultReasoningDepth: 'medium', requiredCapabilities: ['text', 'json'] },
        { id: 'goal.body', label: '减重与增肌方案', group: '健康目标', defaultReasoningDepth: 'high', requiredCapabilities: ['text', 'json'], localPicker: true },
        { id: 'summary.weekly', label: '训练周总结', group: '周期总结', defaultReasoningDepth: 'medium', requiredCapabilities: ['text'] },
        { id: 'summary.monthly', label: '训练月总结', group: '周期总结', defaultReasoningDepth: 'medium', requiredCapabilities: ['text'] },
        { id: 'report.weight.weekly', label: '周体重复盘', group: '周期总结', defaultReasoningDepth: 'medium', requiredCapabilities: ['text', 'json'] },
        { id: 'report.weight.monthly', label: '月体重复盘', group: '周期总结', defaultReasoningDepth: 'medium', requiredCapabilities: ['text', 'json'] },
        { id: 'insight.quick', label: '今日快速洞察', group: '后台分析', defaultReasoningDepth: 'low', requiredCapabilities: ['text'] }
    ]);

    function pure() {
        return window.aiRoutingPure || null;
    }

    function normalizeProvider(value = '') {
        return ai.normalizeProvider ? ai.normalizeProvider(value) : (String(value || '').trim() || 'openai');
    }

    function profileForId(profileId = '') {
        return (ai.cfg.profiles || []).find(profile => profile.id === profileId) || null;
    }

    function modelForTarget(profileId = '', modelId = '') {
        return (ai.models || []).find(model =>
            String(model.profileId || '') === String(profileId || '') &&
            String(model.id || '') === String(modelId || '')
        ) || null;
    }

    function defaultPrimary() {
        const profile = profileForId(ai.cfg.activeProfileId)
            || ai.cfg.profiles?.find(item => item.enabled !== false && item.archived !== true)
            || null;
        const modelId = String(profile?.model || ai.cfg.model || '').trim();
        return profile?.id && modelId ? { profileId: profile.id, modelId } : null;
    }

    Object.assign(ai, {
        TASK_DEFINITIONS,

        getTaskDefinitions() {
            return TASK_DEFINITIONS.map(definition => ({ ...definition, requiredCapabilities: [...definition.requiredCapabilities] }));
        },

        getTaskDefinition(taskId = '') {
            return TASK_DEFINITIONS.find(definition => definition.id === taskId) || null;
        },

        getTaskRoute(taskId = '') {
            const helper = pure();
            const definition = this.getTaskDefinition(taskId);
            const fallback = {
                taskId,
                primary: defaultPrimary(),
                reasoningDepth: definition?.defaultReasoningDepth || 'auto',
                fallbackMode: 'manual',
                fallbacks: []
            };
            if (!helper?.resolveTaskRoute) return fallback;
            return helper.resolveTaskRoute({
                taskRegistry: TASK_DEFINITIONS,
                defaultRoute: { primary: defaultPrimary(), reasoningDepth: 'auto', fallbackMode: 'manual', fallbacks: [] },
                taskRoutes: this.cfg.taskRoutes || {}
            }, taskId);
        },

        async setTaskRoute(taskId = '', route = {}) {
            const definition = this.getTaskDefinition(taskId);
            if (!definition) throw new Error(`未知 AI 功能：${taskId}`);
            const helper = pure();
            const normalized = helper?.normalizeTaskRoute
                ? helper.normalizeTaskRoute(route, { reasoningDepth: definition.defaultReasoningDepth })
                : route;
            // Network is a separate, security-sensitive contract. Keep the legacy
            // route normalizer stable and let the dedicated policy module discard
            // unknown or unsafe fields.
            const network = window.searchPolicyPure?.normalizeNetworkPolicy?.(route?.network, this.cfg?.networkDefaults || {});
            if (network) normalized.network = network;
            this.cfg.taskRoutes = { ...(this.cfg.taskRoutes || {}), [taskId]: normalized };
            await this.persist?.();
            this.persistDataDb?.(false);
            try { window.dispatchEvent(new CustomEvent('ai:task-route-change', { detail: { taskId, route: normalized } })); } catch {}
            try { window.dispatchEvent(new CustomEvent('ai:task-routes-changed', { detail: { taskId, route: normalized } })); } catch {}
            return normalized;
        },

        async resetTaskRoute(taskId = '') {
            const routes = { ...(this.cfg.taskRoutes || {}) };
            delete routes[taskId];
            this.cfg.taskRoutes = routes;
            await this.persist?.();
            this.persistDataDb?.(false);
            try { window.dispatchEvent(new CustomEvent('ai:task-route-change', { detail: { taskId, route: null } })); } catch {}
            try { window.dispatchEvent(new CustomEvent('ai:task-routes-changed', { detail: { taskId, route: null } })); } catch {}
            return this.getTaskRoute(taskId);
        },

        listSelectableModels(taskId = '') {
            const definition = this.getTaskDefinition(taskId);
            const helper = pure();
            const requiredCapabilities = Array.isArray(definition?.requiredCapabilities) ? definition.requiredCapabilities : [];
            const capabilityStateFor = capabilities => {
                try {
                    const state = helper?.requiredCapabilityState?.(requiredCapabilities, capabilities);
                    if (state && ['compatible', 'unknown', 'incompatible'].includes(state.status)) {
                        return {
                            status: state.status,
                            missing: Array.isArray(state.missing) ? [...state.missing] : [],
                            incompatible: Array.isArray(state.incompatible) ? [...state.incompatible] : []
                        };
                    }
                } catch {}
                return {
                    status: requiredCapabilities.length ? 'unknown' : 'compatible',
                    missing: [...requiredCapabilities],
                    incompatible: []
                };
            };
            const rows = [];
            const seen = new Set();
            const add = (profile, modelId, model = null) => {
                if (!profile?.id || profile.enabled === false || profile.archived === true || !modelId || !this.apiKeyFor?.(profile.id)) return;
                const capabilities = model?.capabilities || {};
                const key = `${profile.id}::${modelId}`;
                if (seen.has(key)) return;
                seen.add(key);
                rows.push({
                    key,
                    value: key,
                    profileId: profile.id,
                    profileName: profile.name || profile.id,
                    provider: normalizeProvider(profile.provider),
                    modelId,
                    model: modelId,
                    displayName: model?.displayName || modelId,
                    label: `${profile.name || profile.id} · ${model?.displayName || modelId}`,
                    family: typeof model?.family === 'string' && model.family.trim() ? model.family.trim() : '其他',
                    capabilities,
                    capabilityState: capabilityStateFor(capabilities),
                    sizeTier: model?.sizeTier || 'unknown',
                    iconKey: model?.iconKey || model?.vendor || ''
                });
            };
            (this.cfg.profiles || []).forEach(profile => {
                (this.models || [])
                    .filter(model => String(model.profileId || '') === String(profile.id))
                    .forEach(model => add(profile, model.id, model));
            });
            return rows;
        },

        resolveTaskConfig(taskId = '', override = null) {
            const helper = pure();
            const route = helper?.resolveTaskRoute
                ? helper.resolveTaskRoute({
                    taskRegistry: TASK_DEFINITIONS,
                    defaultRoute: { primary: defaultPrimary(), reasoningDepth: 'auto', fallbackMode: 'manual', fallbacks: [] },
                    taskRoutes: this.cfg.taskRoutes || {}
                }, taskId, override)
                : { ...this.getTaskRoute(taskId), ...(override || {}) };
            const target = route.primary || defaultPrimary();
            const profile = profileForId(target?.profileId);
            const modelId = target?.modelId || profile?.model || this.cfg.model || '';
            const model = modelForTarget(profile?.id, modelId);
            const network = this.getTaskNetworkPolicy?.(taskId, route);
            return {
                taskId,
                route,
                profileId: profile?.id || '',
                provider: normalizeProvider(profile?.provider || this.cfg.provider || 'openai'),
                model: modelId,
                modelId,
                baseUrl: profile?.baseUrl || this.cfg.baseUrl || '',
                extraVisionKeywords: profile?.extraVisionKeywords || this.cfg.extraVisionKeywords || '',
                reasoningDepth: route.reasoningDepth || 'auto',
                capabilities: model?.capabilities || {},
                network,
                enabled: !!(profile && profile.enabled !== false && profile.archived !== true && profile.baseUrl && modelId && model),
                apiKey: profile?.id ? this.apiKeyFor(profile.id) : ''
            };
        },

        getTaskNetworkPolicy(taskId = '', route = null) {
            const policy = window.searchPolicyPure;
            if (!policy?.normalizeNetworkPolicy) return { mode: 'off', execution: 'native-first', providerIds: [], sourcePolicy: 'official-preferred', fallback: 'local-estimate', allowedDomains: [] };
            // food.verify is an internal second step. It inherits the source task's
            // policy unless an advanced user has explicitly stored an override.
            const sourceId = taskId === 'food.verify' ? 'food.text' : taskId;
            const stored = route?.network ? route : (this.cfg.taskRoutes || {})[taskId] || (this.cfg.taskRoutes || {})[sourceId] || {};
            return policy.resolveNetworkPolicy?.(stored || {}, {
                searchProviders: this.cfg?.searchProviders || [],
                networkDefaults: this.cfg?.networkDefaults || {}
            }) || policy.normalizeNetworkPolicy(stored?.network, this.cfg?.networkDefaults || {});
            // food.verify is now a registered internal task; user overrides in taskRoutes['food.verify'] are respected.
        },

        getTaskRequestSequence(taskId = '', override = null) {
            const helper = pure();
            const effective = this.resolveTaskConfig(taskId, override);
            const targets = helper?.buildFallbackSequence ? helper.buildFallbackSequence(effective.route) : [effective.route.primary].filter(Boolean);
            return targets.map(target => this.resolveTaskConfig(taskId, target));
        }
    });
})();
