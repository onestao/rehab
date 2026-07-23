// @ts-nocheck
(function () {
    function actionBusySelector(key) {
        if (key === 'openDietModal') return '[onclick*="openDietModal"],[data-q="diet"],[data-plan-quick="diet"]';
        if (key === 'openWeightModal') return '[onclick*="openWeightModal"],[data-q="weight"],[data-plan-quick="weight"]';
        if (key === 'openExerciseModal') return '[onclick*="openExerciseModal"],[data-q="cardio"],[data-plan-quick="cardio"]';
        if (key === 'openPlanAiSheet') return '[onclick*="openPlanAiSheet"],[onclick*="openPlanTodayAiSheet"],[onclick*="createSelectedPlans"]';
        if (key === 'openNewPlanSheet') return '[onclick*="openNewPlanSheet"]';
        if (key === 'openPlanTaskDrawer') return '[onclick*="openPlanTaskDrawer"]';
        if (key === 'handlePlanTaskTap') return '[onclick*="handlePlanTaskTap"]';
        if (key === 'selectTodayPlan') return '[onclick*="selectTodayPlan"]';
        if (key === 'openPlanTodayAiSheet') return '[onclick*="openPlanTodayAiSheet"]';
        if (key === 'openPlanWeeklySheet') return '[onclick*="openPlanWeeklySheet"],.today-weekly-plan-btn';
        if (key === 'enhanceTodayPage') return '';
        if (key === 'openPlanTaskEdit') return '[onclick*="openPlanTaskEdit"]';
        if (key === 'checkAppUpdate') return '#profileUpdateCheckBtn';
        return '';
    }

    function actionBusyTextNode(node) {
        return node.querySelector('.pvf-check-label') ||
            Array.from(node.querySelectorAll('span'))
                .find((span) => !span.classList.contains('material-symbols-rounded'));
    }

    const runtimeStateKeys = ['_activeModalEl'];

    window.dataUiState = {
        _activeModalEl: null,

        _closeActiveModalInternal() {
            const el = this._activeModalEl || document.querySelector('.md-modal[data-rl-modal="1"]');
            if (el) el.remove();
            this._activeModalEl = null;
            if (window.focusTrap?.release) window.focusTrap.release();
            return true;
        },

        _closeActiveModal() {
            if (!window.navStack?.requestClose?.('modal')) this._closeActiveModalInternal();
        },

        async ensureFocusTrapReady() {
            if (window.focusTrap?.trap) return true;
            if (typeof window.loadAppScript !== 'function') {
                for (let i = 0; i < 40 && typeof window.loadAppScript !== 'function'; i += 1) {
                    await new Promise((resolve) => setTimeout(resolve, 25));
                }
            }
            if (typeof window.loadAppScript !== 'function') return false;
            try {
                await window.loadAppScript('a11y-focus-trap', { force: !window.focusTrap?.trap });
            } catch {
                return false;
            }
            if (window.focusTrap?.trap) return true;
            for (let i = 0; i < 20 && !window.focusTrap?.trap; i += 1) {
                await new Promise((resolve) => setTimeout(resolve, 25));
            }
            return !!window.focusTrap?.trap;
        },

        async _openModal({ title, icon, bodyHtml, actionsHtml, onMount }) {
            if (this._activeModalEl) window.navStack?.popType?.('modal');
            this._closeActiveModalInternal();
            if (!window.focusTrap?.trap) await this.ensureFocusTrapReady();
            const modal = document.createElement('div');
            modal.className = 'md-modal';
            modal.setAttribute('data-rl-modal', '1');
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.tabIndex = -1;
            modal.innerHTML = `
                <div class="md-modal-backdrop" data-modal-close></div>
                <div class="md-modal-card">
                    <div class="md-modal-head">
                        <strong>${icon ? `<span class="material-symbols-rounded" style="font-size:20px;vertical-align:-4px;margin-right:6px">${this.escapeHtml(icon)}</span>` : ''}${this.escapeHtml(title || '')}</strong>
                        <button class="md-icon-btn" type="button" data-modal-close aria-label="关闭" style="width:40px;height:40px;border:0;border-radius:999px;display:inline-grid;place-items:center;background:var(--md-sys-surface-container-high);color:var(--md-sys-on-surface-variant)">
                            <span class="material-symbols-rounded">close</span>
                        </button>
                    </div>
                    <div class="md-modal-body">${bodyHtml || ''}</div>
                    <div class="md-row modal-actions">${actionsHtml || ''}</div>
                </div>`;

            const close = () => this._closeActiveModal();
            modal.querySelectorAll('[data-modal-close]').forEach((button) => {
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    close();
                });
            });

            document.body.appendChild(modal);
            this._activeModalEl = modal;
            window.navStack?.push?.({
                type: 'modal',
                id: `routine-${Date.now()}`,
                close: () => this._closeActiveModalInternal()
            });
            if (window.focusTrap?.trap) window.focusTrap.trap(modal);
            try { onMount?.(modal, close); } catch {}
            return modal;
        },

        _confirmModal({ title, icon, message, okText, cancelText, danger, onOk }) {
            const escapedMessage = this.escapeHtml(message || '').replace(/\n/g, '<br>');
            const showCancel = cancelText !== '';
            return this._openModal({
                title,
                icon,
                bodyHtml: `<div style="color:var(--md-sys-on-surface-variant);font-size:13px;line-height:1.45">${escapedMessage}</div>`,
                actionsHtml: `
                    ${showCancel ? `<button class="md-btn" type="button" data-modal-close>${this.escapeHtml(cancelText || '取消')}</button>` : ''}
                    <button class="md-btn md-btn-filled" type="button" data-rl-ok style="${danger ? 'background:var(--md-sys-error);color:var(--md-sys-on-error)' : ''}">${this.escapeHtml(okText || '确定')}</button>`,
                onMount: (root, close) => {
                    root.querySelector('[data-rl-ok]')?.addEventListener('click', (event) => {
                        event.preventDefault();
                        try { onOk?.(); } finally { close(); }
                    });
                }
            });
        },

        beginActionBusy(key, label) {
            this._actionBusy = this._actionBusy || {};
            if (this._actionBusy[key]) return false;
            this._actionBusy[key] = true;
            const selector = actionBusySelector(key);
            if (!selector) return true;
            document.querySelectorAll(selector).forEach((node) => {
                if (!(node instanceof HTMLElement)) return;
                if ('disabled' in node) {
                    if (node.dataset.busyDisabledSaved == null) node.dataset.busyDisabledSaved = String(!!node.disabled);
                    node.disabled = true;
                }
                node.setAttribute('aria-busy', 'true');
                node.classList.add('is-action-busy');
                if (node.dataset.busyLabelSaved != null) return;
                const textNode = actionBusyTextNode(node);
                if (textNode) {
                    node.dataset.busyLabelSaved = textNode.textContent || '';
                    textNode.textContent = label || '加载中';
                }
            });
            return true;
        },

        endActionBusy(key) {
            this._actionBusy = this._actionBusy || {};
            delete this._actionBusy[key];
            const selector = actionBusySelector(key);
            if (!selector) return;
            document.querySelectorAll(selector).forEach((node) => {
                if (!(node instanceof HTMLElement)) return;
                if ('disabled' in node && node.dataset.busyDisabledSaved != null) {
                    node.disabled = node.dataset.busyDisabledSaved === 'true';
                    delete node.dataset.busyDisabledSaved;
                }
                node.removeAttribute('aria-busy');
                node.classList.remove('is-action-busy');
                if (node.dataset.busyLabelSaved == null) return;
                const textNode = actionBusyTextNode(node);
                if (textNode) textNode.textContent = node.dataset.busyLabelSaved;
                delete node.dataset.busyLabelSaved;
            });
        },

        requestHealthProfileCss(reason = 'intent') {
            const promise = window.loadAppCss?.('42-health-profile');
            promise?.catch?.((error) => {
                window.errorBus?.report?.('records.healthProfileCss', error, { reason });
            });
            return promise;
        },

        bindHealthCssIntent() {
            if (this._healthCssIntentBound || window.__rehabHealthCssIntentBound) {
                this._healthCssIntentBound = true;
                return;
            }
            this._healthCssIntentBound = true;
            window.__rehabHealthCssIntentBound = true;
            const request = (reason) => this.requestHealthProfileCss(reason);
            document.addEventListener('pointerdown', (event) => {
                const target = event.target;
                if (!(target instanceof Element)) return;
                if (target.closest('[data-health-view="training"], [data-route-view="training"], [data-health-entry="training"]')) {
                    request('pointerdown');
                }
            }, true);
            document.addEventListener('focusin', (event) => {
                const target = event.target;
                if (!(target instanceof Element)) return;
                if (target.closest('[data-health-view="training"]')) request('focus');
            }, true);
            document.addEventListener('pointerdown', (event) => {
                const deck = document.getElementById('healthSwipeDeck');
                if (!deck || !(event.target instanceof Element) || !deck.contains(event.target)) return;
                this._healthSwipeIntent = { x: event.clientX, y: event.clientY, active: true };
            }, true);
            document.addEventListener('pointermove', (event) => {
                const intent = this._healthSwipeIntent;
                if (!intent?.active) return;
                const dx = Math.abs(event.clientX - intent.x);
                const dy = Math.abs(event.clientY - intent.y);
                if (dx >= 8 && dx > dy) {
                    intent.active = false;
                    request('swipe-start');
                }
            }, true);
            const clearIntent = () => { this._healthSwipeIntent = null; };
            document.addEventListener('pointerup', clearIntent, true);
            document.addEventListener('pointercancel', clearIntent, true);
        },

        toggleCollapse(id) {
            this.captureAdviceDraft?.();
            this._collapse = this._collapse || {};
            const currentCollapsed = this.currentDomCollapseState(id);
            if (this._collapse[id] === undefined) {
                this._collapse[id] = currentCollapsed === null ? id === 'dietPanel' : !currentCollapsed;
            } else {
                this._collapse[id] = !this._collapse[id];
            }
            if (this.applyCollapseStateToDom(id)) return;
            this.render();
        },

        currentDomCollapseState(id) {
            const container = this.findCollapseContainer(id);
            return container ? container.classList.contains('collapsed') : null;
        },

        applyCollapseStateToDom(id) {
            const container = this.findCollapseContainer(id);
            if (!container) return false;
            const button = this.findCollapseButton(id);
            const collapsed = !!this._collapse?.[id];
            container.classList.toggle('collapsed', collapsed);
            if (button?.classList.contains('collapsible-head-btn')) button.setAttribute('aria-expanded', String(!collapsed));
            const icons = Array.from(button?.querySelectorAll('.material-symbols-rounded') || []);
            const icon = icons.findLast?.((element) => /^expand_(more|less)$/.test(element.textContent.trim()))
                || icons.reverse().find((element) => /^expand_(more|less)$/.test(element.textContent.trim()));
            if (icon) icon.textContent = collapsed ? 'expand_more' : 'expand_less';
            return true;
        },

        findCollapseContainer(id) {
            const button = this.findCollapseButton(id);
            return button?.closest('.pr-board-item, .collapsible-card, .diet-meal-group, .history-month-group, .history-older-group, .weight-history-card') || null;
        },

        findCollapseButton(id) {
            return Array.from(document.querySelectorAll('button[onclick^="data.toggleCollapse"]'))
                .find((button) => {
                    const handler = button.getAttribute('onclick') || '';
                    return handler.includes(`'${id}'`) || handler.includes(`"${id}"`);
                }) || null;
        },

        isCollapsed(id, defaultState = true) {
            this._collapse = this._collapse || {};
            return this._collapse[id] ?? defaultState;
        }
    };

    Object.defineProperty(window.dataUiState, '__runtimeStateKeys', {
        value: runtimeStateKeys,
        enumerable: false
    });
    try { window.dataUiState.bindHealthCssIntent(); } catch {}
})();
