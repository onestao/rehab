// @ts-nocheck
(function attachAiTaskSettings(root) {
    'use strict';

    const DEPTHS = [
        { value: 'auto', label: '\u81ea\u52a8', title: '\u81ea\u52a8', icon: 'auto_awesome' },
        { value: 'off', label: '\u76f4\u63a5\u56de\u7b54', title: '\u5173\u95ed', icon: 'block' },
        { value: 'low', label: '\u8f7b\u91cf\u601d\u8003', title: '\u4f4e', icon: 'self_improvement' },
        { value: 'medium', label: '\u6807\u51c6\u601d\u8003', title: '\u4e2d', icon: 'psychology' },
        { value: 'high', label: '\u6df1\u5165\u601d\u8003', title: '\u9ad8', icon: 'tips_and_updates' }
    ];
    const FAVORITES_KEY = 'rehab.ai.modelFavorites.v2';
    const RECENTS_KEY = 'rehab.ai.modelRecents.v1';
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
        const labels = modelLabelCandidates(model);
        const name = labels.custom && labels.id ? `${labels.full} \u00b7 ${labels.id}` : labels.full;
        return `${connection} \u00b7 ${name}`;
    }

    function modelLabelCandidates(model) {
        return root.aiModelVisual.modelLabelCandidates(model);
    }

    function compactModelName(model) {
        return modelLabelCandidates(model).compact;
    }

    function resolveModelVisual(model) {
        return root.aiModelVisual.resolve({ modelId: modelId(model) || model?.displayName, provider: model?.provider || model?.profileName || model?.connectionName, iconKey: model?.iconKey || model?.vendor, local: true });
    }

    function registerCompactModelLabel(button, label) {
        const fit = () => [12, 11, 10].some(size => {
            label.style.fontSize = `${size}px`;
            return label.scrollWidth <= label.clientWidth + 1;
        });
        new root.ResizeObserver(fit).observe(button);
        root.requestAnimationFrame(fit);
        root.document.fonts.ready.then(fit);
    }

    function modelVisualNode(model, visual = resolveModelVisual(model)) {
        const slot = el('span', 'ai-model-connection-mark');
        slot.setAttribute('aria-hidden', 'true');
        if (visual.theme?.markBg) slot.style.setProperty('--ai-model-mark-bg', visual.theme.markBg);
        if (!visual.iconSrcs?.length) { slot.textContent = visual.mark || 'AI'; return slot; }
        const image = document.createElement('img');
        image.className = 'ai-model-visual-icon';
        image.alt = '';
        let index = 0;
        image.addEventListener('error', () => {
            index += 1;
            if (index < visual.iconSrcs.length) image.src = visual.iconSrcs[index];
            else image.replaceWith(document.createTextNode(visual.mark || 'AI'));
        });
        image.src = visual.iconSrcs[0];
        slot.append(image);
        return slot;
    }

    function readJson(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch (_) { return fallback; }
    }

    function favoriteKeys() {
        return new Set(readJson(FAVORITES_KEY, []));
    }

    function toggleFavorite(model) {
        const values = favoriteKeys();
        const key = modelKey(model);
        if (values.has(key)) values.delete(key); else values.add(key);
        try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(values).slice(0, 100))); } catch (_) { /* storage may be unavailable */ }
    }

    function rememberRecent(taskId, model) {
        const all = readJson(RECENTS_KEY, {});
        const key = modelKey(model);
        all[taskId] = [key, ...(all[taskId] || []).filter(item => item !== key)].slice(0, 3);
        try { localStorage.setItem(RECENTS_KEY, JSON.stringify(all)); } catch (_) { /* storage may be unavailable */ }
    }

    function routePrimary(route) {
        return route?.primary || (route?.modelId || route?.model ? route : null);
    }

    function routeFallback(route) {
        return Array.isArray(route?.fallbacks) ? route.fallbacks[0] || null : null;
    }

    function unavailableReason(route, models) {
        const primary = routePrimary(route);
        if (!primary) return models.length ? '' : '尚未选择模型';
        const profile = root.ai?.findProfile?.(modelProfileId(primary));
        if (!profile) return '供应商已删除';
        if (profile.archived === true) return '供应商已归档';
        if (profile.enabled === false) return '供应商已禁用';
        if (!models.some(model => modelKey(model) === modelKey(primary))) return '模型已删除或未添加';
        return '';
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

    function closeQuickSheet() {
        const modal = document.getElementById('aiModelPickerSheet');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('ai-task-quick-sheet');
        modal.classList.remove('advice-model-picker-sheet');
        modal.setAttribute('aria-hidden', 'true');
        const card = modal.querySelector('.md-modal-sheet-card');
        card?.classList.remove('ai-task-quick-card');
        card?.classList.remove('advice-model-picker-card');
        const content = document.getElementById('aiModelPickerContent');
        if (content) { content.replaceChildren(); content.className = ''; }
        const heading = modal.querySelector('.md-modal-head strong');
        if (heading) heading.textContent = '\u9009\u62e9\u672c\u6b21\u6a21\u578b';
    }

    function openQuickSheet(title, build) {
        closeQuickSheet();
        const modal = document.getElementById('aiModelPickerSheet');
        const body = document.getElementById('aiModelPickerContent');
        const card = modal?.querySelector('.md-modal-sheet-card');
        if (!modal || !body || !card) return;
        const heading = modal.querySelector('.md-modal-head strong');
        if (heading) heading.textContent = title;
        modal.classList.add('ai-task-quick-sheet');
        card.classList.add('ai-task-quick-card');
        body.className = 'ai-task-quick-body';
        build(body);
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        modal.querySelector('[data-modal-close]')?.focus();
    }

    function createCompactModelControl(taskId, models, route, save) {
        const selected = selectedModel(models, route);
        const button = el('button', 'ai-compact-model');
        const visual = resolveModelVisual(selected);
        const invalidReason = unavailableReason(route, models);
        const invalid = !!invalidReason && !!routePrimary(route);
        const stateLabel = models.length ? '\u9009\u62e9\u6a21\u578b' : '\u6682\u65e0\u6a21\u578b';
        const labels = selected ? modelLabelCandidates(selected) : { compact: stateLabel };
        const name = el('span', 'ai-compact-model-name', labels.compact);
        if (invalid) button.classList.add('is-invalid');
        button.type = 'button';
        if (visual.theme?.bg) button.style.setProperty('--ai-model-control-bg', visual.theme.bg);
        if (visual.theme?.color) button.style.setProperty('--ai-model-control-color', visual.theme.color);
        button.append(
            modelVisualNode(selected, visual),
            name,
            invalid ? icon('error') : icon('expand_more')
        );
        const fullIdentity = selected ? modelOptionLabel(selected) : stateLabel;
        button.setAttribute('aria-label', `\u9009\u62e9\u6a21\u578b\uff1a${fullIdentity}`);
        button.title = fullIdentity;
        registerCompactModelLabel(button, name);
        button.addEventListener('click', () => openQuickSheet(selected ? `\u9009\u62e9\u6a21\u578b \u00b7 ${fullIdentity}` : '\u9009\u62e9\u6a21\u578b', body => {
            const favorites = favoriteKeys();
            const recentKeys = readJson(RECENTS_KEY, {})[taskId] || [];
            const ordered = [...models];
            if (invalidReason) body.append(el('div', 'ai-task-model-invalid', invalidReason));
            if (!ordered.length) {
                const empty = el('div', 'ai-task-settings-empty', '暂无可用模型');
                const manage = el('button', 'md-btn md-btn-filled', '管理供应商');
                manage.type = 'button';
                manage.addEventListener('click', () => {
                    closeQuickSheet();
                    root.aiProviderManager?.open?.();
                });
                body.append(empty, manage);
                return;
            }
            if (ordered.length > 8) {
                const searchToggle = el('button', 'ai-task-model-search-toggle');
                searchToggle.type = 'button';
                searchToggle.setAttribute('aria-label', '\u641c\u7d22\u6a21\u578b');
                searchToggle.append(icon('search'));
                const search = el('input', 'ai-task-model-search');
                search.type = 'search';
                search.placeholder = '\u641c\u7d22\u6a21\u578b';
                search.hidden = true;
                search.addEventListener('input', () => body.querySelectorAll('.ai-task-model-row').forEach(row => {
                    row.hidden = !text(row.dataset.search).toLowerCase().includes(search.value.trim().toLowerCase());
                }));
                searchToggle.addEventListener('click', () => {
                    search.hidden = !search.hidden;
                    searchToggle.classList.toggle('active', !search.hidden);
                    if (!search.hidden) search.focus();
                });
                const searchBar = el('div', 'ai-task-model-search-bar');
                searchBar.append(searchToggle, search);
                body.append(searchBar);
            }
            const appendRows = (label, rows) => {
                if (!rows.length) return;
                body.append(el('div', 'ai-task-model-section-title', label));
                rows.forEach(model => {
                const row = el('div', 'ai-task-model-row');
                row.dataset.search = modelOptionLabel(model);
                const choose = el('button', 'ai-task-model-main');
                choose.type = 'button';
                choose.append(modelVisualNode(model));
                const labels = el('span', 'ai-task-model-labels');
                const modelLabels = modelLabelCandidates(model);
                const connection = text(model?.profileName || model?.connectionName || model?.provider);
                const secondary = modelLabels.custom && modelLabels.id ? `${connection} \u00b7 ${modelLabels.id}` : connection;
                labels.append(el('strong', '', modelLabels.full), el('small', '', secondary));
                choose.append(labels);
                if (modelKey(model) === modelKey(selected)) choose.append(icon('check'));
                choose.addEventListener('click', () => {
                    rememberRecent(taskId, model);
                    closeQuickSheet();
                    save({ ...route, primary: modelRef(model) });
                    root.toast?.show?.(`\u5df2\u5207\u6362\u81f3 ${compactModelName(model)}`, 'success');
                });
                const isFavorite = favorites.has(modelKey(model));
                const star = el('button', `model-picker-star ${isFavorite ? 'active' : ''}`);
                star.type = 'button';
                star.setAttribute('aria-label', isFavorite ? '\u53d6\u6d88\u6536\u85cf' : '\u6536\u85cf');
                star.append(icon(isFavorite ? 'star' : 'star_border'));
                star.addEventListener('click', () => { toggleFavorite(model); star.classList.toggle('active'); star.firstChild.textContent = star.classList.contains('active') ? 'star' : 'star_border'; });
                row.append(choose, star);
                body.append(row);
                });
            };
            const favoriteRows = ordered.filter(model => favorites.has(modelKey(model)));
            const favoriteSet = new Set(favoriteRows.map(modelKey));
            const recentRows = recentKeys.map(key => ordered.find(model => modelKey(model) === key)).filter(model => model && !favoriteSet.has(modelKey(model)));
            const promoted = new Set([...favoriteSet, ...recentRows.map(modelKey)]);
            appendRows('\u6536\u85cf\u6a21\u578b', favoriteRows);
            appendRows('\u6700\u8fd1\u4f7f\u7528', recentRows);
            const groups = new Map();
            ordered.filter(model => !promoted.has(modelKey(model))).forEach(model => {
                const group = text(model?.profileName || model?.connectionName || model?.provider || '\u5176\u4ed6\u8fde\u63a5');
                const familyGroup = `${group} · ${text(model?.family || '其他')}`;
                if (!groups.has(familyGroup)) groups.set(familyGroup, []);
                groups.get(familyGroup).push(model);
            });
            groups.forEach((rows, label) => appendRows(label, rows));
        }));
        return button;
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

    function openTaskSettingsSheet(definition, route, models) {
        openQuickSheet(`${definition.label} \u00b7 \u5b8c\u6574\u8bbe\u7f6e`, body => {
            let current = { ...(route || {}) };
            const save = async next => {
                current = next;
                await callAi(['setTaskRoute', 'saveTaskRoute'], definition.id, next);
                root.dispatchEvent?.(new CustomEvent('ai:task-route-changed', { detail: { taskId: definition.id, route: next } }));
                render();
            };
            const fallback = createSelect('\u5907\u7528\u6a21\u578b', models, routeFallback(current), model => {
                checkbox.disabled = !model;
                if (!model) checkbox.checked = false;
                save({ ...current, fallbacks: model ? [modelRef(model)] : [], fallbackMode: model ? (current.fallbackMode || 'manual') : 'manual' });
            }, true);
            const automatic = el('label', 'ai-task-fallback-toggle');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = current.fallbackMode === 'automatic';
            checkbox.disabled = !routeFallback(current);
            checkbox.addEventListener('change', () => save({ ...current, fallbackMode: checkbox.checked ? 'automatic' : 'manual' }));
            const toggleCopy = el('span', '');
            toggleCopy.append(el('strong', '', '\u4e3b\u6a21\u578b\u5931\u8d25\u540e\u81ea\u52a8\u4f7f\u7528\u5907\u7528\u6a21\u578b'), el('small', '', '\u9ed8\u8ba4\u5173\u95ed\uff1b\u6bcf\u6b21\u56de\u9000\u4ecd\u4f1a\u660e\u786e\u63d0\u793a'));
            automatic.append(checkbox, toggleCopy);
            const reset = el('button', 'md-btn md-btn-tonal');
            reset.type = 'button';
            reset.append(icon('restart_alt'), document.createTextNode('\u6062\u590d\u9ed8\u8ba4'));
            reset.addEventListener('click', async () => {
                await callAi(['resetTaskRoute'], definition.id);
                closeQuickSheet();
                render();
            });
            body.append(fallback, automatic, reset);
        });
    }

    function selectedModel(models, route) {
        const primary = routePrimary(route);
        const key = primary ? modelKey(primary) : '';
        return models.find(model => modelKey(model) === key) || primary;
    }

    function reasoningMeta(value) {
        return DEPTHS.find(item => item.value === normalizeReasoningDepth(value)) || DEPTHS[0];
    }

    function openReasoningMenu(route, models, save) {
        const current = normalizeReasoningDepth(route?.reasoningDepth);
        openQuickSheet('\u63a8\u7406\u5f3a\u5ea6', body => DEPTHS.forEach(depth => {
            const option = el('button', `ai-reasoning-menu-item is-${depth.value}`);
            option.type = 'button';
            option.append(icon(depth.icon));
            const labels = el('span', 'ai-task-model-labels');
            labels.append(el('strong', '', depth.label), el('small', '', depth.title));
            option.append(labels);
            if (depth.value === current) option.append(icon('check'));
            option.addEventListener('click', () => { closeQuickSheet(); save({ ...route, reasoningDepth: depth.value }); });
            body.append(option);
        }));
    }

    function createReasoningControl(route, models, save) {
        const current = normalizeReasoningDepth(route?.reasoningDepth);
        const selected = reasoningMeta(current);
        const button = el('button', `ai-reasoning-trigger is-${current}`);
        button.type = 'button';
        button.append(icon(selected.icon));
        button.setAttribute('aria-label', `\u63a8\u7406\u5f3a\u5ea6\uff1a${selected.label}`);
        button.title = `\u63a8\u7406\u5f3a\u5ea6\uff1a${selected.label}`;
        button.addEventListener('click', () => openReasoningMenu(route, models, save));
        return button;
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
        const primary = routePrimary(route);
        const invalidReason = unavailableReason(route, models);
        if (primary && invalidReason) row.classList.add('is-invalid');
        const meta = el('div', 'ai-task-meta');
        meta.append(el('strong', '', definition.label));
        if (definition.description) meta.append(el('small', '', definition.description));
        if (invalidReason) meta.append(el('small', 'ai-task-invalid-reason', invalidReason));

        const controls = el('div', 'ai-task-controls');
        const save = nextRoute => saveRoute(definition.id, nextRoute, row);
        const quick = el('div', 'ai-task-quick-controls');
        quick.append(createCompactModelControl(definition.id, models, route, save));
        quick.append(createReasoningControl(route, models, save));
        if (definition.allowFallbacks !== false) {
            const more = el('button', `ai-task-route-more ${routeFallback(route) ? 'has-fallback' : ''}`);
            more.type = 'button';
            more.setAttribute('aria-label', '\u5b8c\u6574\u6a21\u578b\u8bbe\u7f6e');
            more.append(icon('compare_arrows'));
            more.addEventListener('click', () => openTaskSettingsSheet(definition, route, models));
            quick.append(more);
        }
        controls.append(quick);
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
            const quick = el('div', 'ai-task-quick-controls');
            const choices = Array.isArray(models) ? models : [];
            quick.append(createCompactModelControl(taskId, choices, route || {}, save));
            quick.append(createReasoningControl(route || {}, choices, save));
            controls.append(quick);
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
        closeQuickSheet,
        openReasoningMenu,
        reasoningMeta,
        _test: { modelKey, modelOptionLabel, modelLabelCandidates, compactModelName, modelVisualNode, normalizeReasoningDepth, normalizeTaskDefinitions, shouldMountInlinePicker, resolveInsertionTarget }
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
