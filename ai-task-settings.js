// @ts-nocheck
(function attachAiTaskSettings(root) {
    'use strict';

    const DEPTHS = [
        { value: 'auto', label: '\u81ea\u52a8' },
        { value: 'off', label: '\u5173\u95ed' },
        { value: 'low', label: '\u4f4e' },
        { value: 'medium', label: '\u4e2d' },
        { value: 'high', label: '\u9ad8' }
    ];
    let renderVersion = 0;

    function text(value) {
        return String(value == null ? '' : value);
    }

    function normalizeReasoningDepth(value) {
        const depth = text(value).trim().toLowerCase();
        return DEPTHS.some(item => item.value === depth) ? depth : 'auto';
    }

    function normalizeTaskDefinitions(input) {
        const definitions = Array.isArray(input)
            ? input
            : Object.entries(input || {}).map(([id, definition]) => ({ id, ...(definition || {}) }));
        return definitions
            .map(definition => ({
                ...definition,
                id: text(definition?.id || definition?.taskId).trim(),
                label: text(definition?.label || definition?.name || definition?.id || definition?.taskId).trim(),
                description: text(definition?.description || definition?.hint).trim()
            }))
            .filter(definition => definition.id);
    }

    function modelId(model) {
        return text(model?.modelId || model?.id || model?.model).trim();
    }

    function modelProfileId(model) {
        return text(model?.profileId || model?.connectionId).trim();
    }

    function modelKey(model) {
        return text(model?.key).trim() || `${modelProfileId(model)}::${modelId(model)}`;
    }

    function modelOptionLabel(model) {
        const connection = text(model?.profileName || model?.connectionName || model?.provider || '\u672a\u547d\u540d\u8fde\u63a5').trim();
        const name = text(model?.displayName || modelId(model) || '\u672a\u547d\u540d\u6a21\u578b').trim();
        return `${connection} \u00b7 ${name}`;
    }

    function routePrimary(route) {
        return route?.primary || (route?.modelId || route?.model ? route : null);
    }

    function routeFallback(route) {
        return Array.isArray(route?.fallbacks) ? route.fallbacks[0] || null : null;
    }

    function modelRef(model) {
        if (!model) return null;
        return {
            profileId: modelProfileId(model),
            modelId: modelId(model)
        };
    }

    function el(tag, className, content) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (content != null) node.textContent = text(content);
        return node;
    }

    function icon(name) {
        const node = el('span', 'material-symbols-rounded', name);
        node.setAttribute('aria-hidden', 'true');
        return node;
    }

    function setStatus(message, isError) {
        const node = document.getElementById('aiModelCacheStatus');
        if (!node) return;
        node.textContent = text(message);
        node.classList.toggle('is-error', Boolean(isError));
    }

    async function callAi(methodNames, ...args) {
        const ai = root.ai;
        const method = methodNames.find(name => typeof ai?.[name] === 'function');
        if (!method) throw new Error(`AI adapter missing: ${methodNames[0]}`);
        return ai[method](...args);
    }

    function createSelect(label, models, selectedRef, onChange, includeEmpty) {
        const wrap = el('label', 'ai-task-control');
        wrap.append(el('span', 'ai-task-control-label', label));
        const select = el('select', 'ai-task-select');
        const lookup = new Map();
        if (includeEmpty) {
            const empty = document.createElement('option');
            empty.value = '';
            empty.textContent = '\u4e0d\u4f7f\u7528\u5907\u7528\u6a21\u578b';
            select.append(empty);
        }
        for (const model of models) {
            const key = modelKey(model);
            if (!key || lookup.has(key)) continue;
            lookup.set(key, model);
            const option = document.createElement('option');
            option.value = key;
            option.textContent = modelOptionLabel(model);
            select.append(option);
        }
        const selectedKey = selectedRef ? modelKey(selectedRef) : '';
        if (selectedKey && !lookup.has(selectedKey)) {
            const unavailable = document.createElement('option');
            unavailable.value = selectedKey;
            unavailable.textContent = `${modelOptionLabel(selectedRef)} (\u5df2\u4e0d\u53ef\u7528)`;
            lookup.set(selectedKey, selectedRef);
            select.append(unavailable);
        }
        select.value = selectedKey;
        select.disabled = models.length === 0 && !selectedKey;
        select.addEventListener('change', () => onChange(lookup.get(select.value) || null));
        wrap.append(select);
        return wrap;
    }

    function selectedModel(models, route) {
        const primary = routePrimary(route);
        const key = primary ? modelKey(primary) : '';
        return models.find(model => modelKey(model) === key) || primary;
    }

    function createReasoningControl(taskId, route, models, save) {
        const wrap = el('div', 'ai-task-control');
        wrap.append(el('span', 'ai-task-control-label', '\u63a8\u7406\u6df1\u5ea6'));
        const group = el('div', 'ai-reasoning-segments');
        group.setAttribute('role', 'group');
        group.setAttribute('aria-label', '\u63a8\u7406\u6df1\u5ea6');
        const current = normalizeReasoningDepth(route?.reasoningDepth);
        const model = selectedModel(models, route);
        const explicitlyUnsupported = model?.capabilities?.reasoning === false;
        for (const depth of DEPTHS) {
            const button = el('button', 'ai-reasoning-option', depth.label);
            button.type = 'button';
            button.dataset.taskId = taskId;
            button.dataset.reasoningDepth = depth.value;
            button.classList.toggle('is-selected', depth.value === current);
            button.setAttribute('aria-pressed', String(depth.value === current));
            button.disabled = explicitlyUnsupported && !['auto', 'off'].includes(depth.value);
            if (button.disabled) button.title = '\u5f53\u524d\u6a21\u578b\u4e0d\u652f\u6301\u663e\u5f0f\u63a8\u7406\u6df1\u5ea6';
            button.addEventListener('click', () => save({ ...route, reasoningDepth: depth.value }));
            group.append(button);
        }
        wrap.append(group);
        return wrap;
    }

    async function saveRoute(taskId, nextRoute, row) {
        row.classList.add('is-saving');
        try {
            await callAi(['setTaskRoute', 'saveTaskRoute'], taskId, nextRoute);
            root.dispatchEvent?.(new CustomEvent('ai:task-route-changed', { detail: { taskId, route: nextRoute } }));
            await render();
        } catch (error) {
            row.classList.remove('is-saving');
            setStatus(error?.message || '\u4fdd\u5b58\u529f\u80fd\u6a21\u578b\u5931\u8d25', true);
        }
    }

    function createTaskRow(definition, route, models) {
        const row = el('section', 'ai-task-settings-row');
        row.dataset.taskId = definition.id;
        const meta = el('div', 'ai-task-meta');
        meta.append(el('strong', '', definition.label));
        if (definition.description) meta.append(el('small', '', definition.description));

        const controls = el('div', 'ai-task-controls');
        const save = nextRoute => saveRoute(definition.id, nextRoute, row);
        controls.append(createSelect('\u8fde\u63a5 \u00b7 \u6a21\u578b', models, routePrimary(route), model => {
            save({ ...route, primary: modelRef(model) });
        }, false));
        controls.append(createReasoningControl(definition.id, route, models, save));
        if (definition.allowFallbacks !== false) {
            controls.append(createSelect('\u5907\u7528\u6a21\u578b', models, routeFallback(route), model => {
                save({ ...route, fallbacks: model ? [modelRef(model)] : [] });
            }, true));
        }
        const actions = el('div', 'ai-task-row-actions');
        const reset = el('button', 'ai-task-reset');
        reset.type = 'button';
        reset.append(icon('restart_alt'), document.createTextNode('\u6062\u590d\u9ed8\u8ba4'));
        reset.addEventListener('click', async () => {
            row.classList.add('is-saving');
            try {
                await callAi(['resetTaskRoute'], definition.id);
                await render();
            } catch (error) {
                row.classList.remove('is-saving');
                setStatus(error?.message || '\u6062\u590d\u9ed8\u8ba4\u5931\u8d25', true);
            }
        });
        actions.append(reset);
        controls.append(actions);
        row.append(meta, controls);
        return row;
    }

    function shouldMountInlinePicker(container, taskId) {
        const key = text(taskId).trim();
        if (!container || !key) return false;
        return container.dataset.aiTaskPickerMountingFor !== key
            && container.dataset.aiTaskPickerMountedFor !== key;
    }

    async function mountInlinePicker(container, taskId, options = {}) {
        if (!container || !taskId) return;
        const key = text(taskId).trim();
        if (!options.force && !shouldMountInlinePicker(container, key)) return;
        container.dataset.aiTaskPickerMountingFor = key;
        delete container.dataset.aiTaskPickerMountedFor;
        container.replaceChildren(el('div', 'ai-task-settings-empty', '\u6b63\u5728\u52a0\u8f7d\u6a21\u578b\u2026'));
        try {
            const [definitions, route, models] = await Promise.all([
                callAi(['getTaskDefinitions']),
                callAi(['getTaskRoute'], taskId),
                callAi(['listSelectableModels'], taskId)
            ]);
            const definition = normalizeTaskDefinitions(definitions).find(item => item.id === taskId) || { id: taskId, label: taskId };
            const shell = el('div', 'ai-task-inline-picker');
            const title = el('div', 'ai-task-inline-title');
            title.append(icon('tune'), el('strong', '', `${definition.label} \u6a21\u578b`));
            const controls = el('div', 'ai-task-inline-controls');
            const save = async nextRoute => {
                shell.classList.add('is-saving');
                try {
                    await callAi(['setTaskRoute', 'saveTaskRoute'], taskId, nextRoute);
                    await mountInlinePicker(container, taskId, { force: true });
                } catch (error) {
                    shell.classList.remove('is-saving');
                    setStatus(error?.message || '\u4fdd\u5b58\u529f\u80fd\u6a21\u578b\u5931\u8d25', true);
                }
            };
            controls.append(createSelect('\u8fde\u63a5 \u00b7 \u6a21\u578b', Array.isArray(models) ? models : [], routePrimary(route), model => {
                save({ ...(route || {}), primary: modelRef(model) });
            }, false));
            controls.append(createReasoningControl(taskId, route || {}, Array.isArray(models) ? models : [], save));
            shell.append(title, controls);
            container.replaceChildren(shell);
            container.dataset.aiTaskPickerMountedFor = key;
        } catch (error) {
            container.replaceChildren(el('div', 'ai-task-settings-empty', error?.message || '\u529f\u80fd\u6a21\u578b\u52a0\u8f7d\u5931\u8d25'));
            container.dataset.aiTaskPickerMountedFor = key;
        } finally {
            delete container.dataset.aiTaskPickerMountingFor;
        }
    }

    function mountInlinePickers(scope, options = {}) {
        const rootNode = scope?.querySelectorAll ? scope : document;
        const nodes = [];
        if (rootNode?.matches?.('[data-ai-task-picker]')) nodes.push(rootNode);
        rootNode?.querySelectorAll?.('[data-ai-task-picker]').forEach(node => nodes.push(node));
        nodes.forEach(node => mountInlinePicker(node, text(node.dataset.aiTaskPicker).trim(), options));
    }

    function resolveInsertionTarget(container, reference) {
        return {
            parent: reference?.parentElement || container,
            before: reference || null
        };
    }

    function mountPlanAiPicker() {
        const body = document.getElementById('planAiSheetBody');
        if (!body || !body.childElementCount) return;
        const taskId = root.data?._planAiMode === 'week' ? 'plan.week' : 'plan.today';
        let host = document.getElementById('planAiTaskPicker');
        if (!host) {
            host = el('div');
            host.id = 'planAiTaskPicker';
            const actions = body.querySelector('.modal-actions');
            const target = resolveInsertionTarget(body, actions);
            target.parent.insertBefore(host, target.before);
        }
        if (host.dataset.aiTaskPicker === taskId && host.childElementCount) return;
        host.dataset.aiTaskPicker = taskId;
        mountInlinePicker(host, taskId);
    }

    async function render() {
        const container = document.getElementById('aiTaskSettingsMatrix');
        if (!container) return;
        const version = ++renderVersion;
        container.replaceChildren(el('div', 'ai-task-settings-empty', '\u6b63\u5728\u52a0\u8f7d\u529f\u80fd\u914d\u7f6e\u2026'));
        try {
            const definitions = normalizeTaskDefinitions(await callAi(['getTaskDefinitions']));
            const entries = await Promise.all(definitions.map(async definition => ({
                definition,
                route: await callAi(['getTaskRoute'], definition.id) || {},
                models: await callAi(['listSelectableModels'], definition.id) || []
            })));
            if (version !== renderVersion) return;
            const fragment = document.createDocumentFragment();
            for (const entry of entries) {
                fragment.append(createTaskRow(entry.definition, entry.route, Array.isArray(entry.models) ? entry.models : []));
            }
            container.replaceChildren(fragment);
            if (!entries.length) {
                container.replaceChildren(el('div', 'ai-task-settings-empty', '\u6682\u65e0\u53ef\u914d\u7f6e\u7684 AI \u529f\u80fd'));
            }
        } catch (error) {
            if (version !== renderVersion) return;
            const message = root.ai
                ? (error?.message || '\u529f\u80fd\u6a21\u578b\u52a0\u8f7d\u5931\u8d25')
                : '\u4fdd\u5b58 AI \u8fde\u63a5\u540e\u5373\u53ef\u914d\u7f6e\u529f\u80fd\u6a21\u578b';
            container.replaceChildren(el('div', 'ai-task-settings-empty', message));
        }
    }

    async function runCacheAction(action, successMessage) {
        setStatus('\u6b63\u5728\u5904\u7406\u2026', false);
        try {
            await action();
            setStatus(successMessage, false);
            await render();
        } catch (error) {
            setStatus(error?.message || '\u6a21\u578b\u7f13\u5b58\u64cd\u4f5c\u5931\u8d25', true);
        }
    }

    function refreshCurrentModels() {
        return runCacheAction(
            () => callAi(['fetchModels', 'refreshCurrentProfileModels']),
            '\u5df2\u5237\u65b0\u5f53\u524d\u8fde\u63a5\u7684\u6a21\u578b'
        );
    }

    function clearCurrentModelCache() {
        return runCacheAction(
            () => callAi(['clearCurrentProfileModelCache', 'clearCurrentModelCache']),
            '\u5df2\u6e05\u7406\u5f53\u524d\u8fde\u63a5\u7684\u6a21\u578b\u7f13\u5b58'
        );
    }

    function clearAllModelCaches() {
        return runCacheAction(
            () => callAi(['clearAllModelCaches', 'clearModelCache'], { scope: 'all' }),
            '\u5df2\u6e05\u7406\u5168\u90e8\u6a21\u578b\u7f13\u5b58'
        );
    }

    const api = {
        render,
        mountInlinePicker,
        mountInlinePickers,
        mountPlanAiPicker,
        refreshCurrentModels,
        clearCurrentModelCache,
        clearAllModelCaches,
        _test: { modelKey, modelOptionLabel, normalizeReasoningDepth, normalizeTaskDefinitions, shouldMountInlinePicker, resolveInsertionTarget }
    };
    root.aiTaskSettings = api;
    root.addEventListener?.('ai:catalog-changed', render);
    root.addEventListener?.('ai:task-routes-changed', render);
    root.addEventListener?.('ai:ready', () => {
        render();
        mountInlinePickers(document, { force: true });
    });
    if (typeof document !== 'undefined') {
        const boot = () => {
            render();
            mountInlinePickers(document);
            mountPlanAiPicker();
            if (typeof MutationObserver === 'function' && document.body) {
                const observer = new MutationObserver(records => {
                    records.forEach(record => record.addedNodes.forEach(node => {
                        if (node?.nodeType === 1) mountInlinePickers(node);
                    }));
                });
                observer.observe(document.body, { childList: true, subtree: true });
            }
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
        else queueMicrotask(boot);
    }
    root.addEventListener?.('click', event => {
        if (event.target?.closest?.('[data-plan-ai-mode]')) setTimeout(mountPlanAiPicker, 0);
    });
})(typeof window !== 'undefined' ? window : globalThis);
