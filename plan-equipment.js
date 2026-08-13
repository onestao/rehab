// @ts-nocheck
(function () {
    if (window.dataPlanEquipment) return;

    const EQUIPMENT = [
        ['fascia_gun', '筋膜枪', 'vibration'],
        ['foam_roller', '泡沫轴', 'self_improvement'],
        ['band', '弹力带', 'linear_scale'],
        ['yoga_ball', '瑜伽球', 'sports_gymnastics'],
        ['balance_pad', '平衡垫', 'balance'],
        ['stretch_strap', '拉伸带', 'accessibility_new']
    ];

    function customEquipmentId(label) {
        return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${String(label || '').trim().slice(0, 12)}`;
    }

    function attr(value) {
        return window.renderSafe?.escapeHtml ? window.renderSafe.escapeHtml(value) : String(value ?? '');
    }

    window.dataPlanEquipment = {
        planEquipmentOptions() {
            const prefs = this.ensurePlanPrefs?.() || {};
            const custom = Array.isArray(prefs.customEquipment) ? prefs.customEquipment : [];
            return [
                ...EQUIPMENT.map(([id, label, icon]) => ({ id, label, icon, builtin: true })),
                ...custom.map((item) => ({
                    id: String(item.id || ''),
                    label: String(item.label || ''),
                    icon: String(item.icon || 'inventory_2') || 'inventory_2',
                    builtin: false
                })).filter((item) => item.id && item.label)
            ];
        },

        renderPlanEquipmentCard() {
            const prefs = this.ensurePlanPrefs?.() || {};
            return `<div class="md-card plan-pref-card">
                <div class="plan-pref-head">
                    <div>
                        <span class="cardio-kicker">设计偏好</span>
                        <h3>日程计划偏好</h3>
                        <small>这些设置会影响 AI 计划、放松流和训练阶段</small>
                    </div>
                    <button class="md-btn md-btn-tonal plan-equipment-open-btn" type="button" onclick="data.openPlanEquipmentSheet()">
                        <span class="material-symbols-rounded">inventory_2</span>
                        <span>训练装备</span>
                        <small>${(prefs.equipment || []).length}</small>
                    </button>
                </div>
                <div class="md-grid plan-pref-grid">
                    <div class="md-field">
                        <select onchange="data.updatePlanPref('stage', this.value)">
                            ${[
                                ['unset', '未设置'],
                                ['post_op', '术后/康复'],
                                ['cutting', '减脂期'],
                                ['bulking', '增肌期'],
                                ['maintenance', '维持期'],
                                ['custom', '自定义']
                            ].map(([value, label]) => `<option value="${value}" ${prefs.stage === value ? 'selected' : ''}>${label}</option>`).join('')}
                        </select>
                        <label>训练阶段</label>
                    </div>
                    <div class="md-field">
                        <select onchange="data.updatePlanPref('cooldownMode', this.value)">
                            ${[
                                ['attached', '挂载式提示'],
                                ['paired', '主项后直接接放松'],
                                ['centralized', '全部暂存集中拉伸']
                            ].map(([value, label]) => `<option value="${value}" ${prefs.cooldownMode === value ? 'selected' : ''}>${label}</option>`).join('')}
                        </select>
                        <label>放松默认模式</label>
                    </div>
                    <div class="md-field">
                        <select onchange="data.updatePlanPref('askOnEdit', this.value)">
                            ${[
                                ['always', '每次都问'],
                                ['lock_default', '默认锁定'],
                                ['pass_default', '默认直接通过']
                            ].map(([value, label]) => `<option value="${value}" ${prefs.askOnEdit === value ? 'selected' : ''}>${label}</option>`).join('')}
                        </select>
                        <label>编辑时行为</label>
                    </div>
                </div>
                ${prefs.stage === 'custom' ? `<div class="md-field"><input type="text" value="${this.escapeHtml(prefs.customStageLabel || '')}" placeholder=" " onchange="data.updatePlanPref('customStageLabel', this.value)"><label>自定义阶段</label></div>` : ''}
                <div class="plan-pref-switches">
                    ${[
                        ['askBeforeProgression', '进阶前询问'],
                        ['showCooldownDock', '显示待拉伸入口'],
                        ['showWeeklyDock', '显示本周入口']
                    ].map(([key, label]) => `
                        <label class="md-switch plan-pref-switch" role="switch" aria-checked="${!!prefs[key]}">
                            <span>${label}</span>
                            <span class="switch-track">
                                <input type="checkbox" ${prefs[key] ? 'checked' : ''} onchange="data.updatePlanPref('${key}', this.checked)">
                                <span class="switch-thumb"></span>
                            </span>
                        </label>
                    `).join('')}
                </div>
            </div>`;
        },

        renderPlanEquipmentSheetBody() {
            const prefs = this.ensurePlanPrefs?.() || {};
            const selected = new Set(prefs.equipment || []);
            const options = this.planEquipmentOptions();
            return `<div class="plan-equipment-sheet">
                <div class="plan-equipment-sheet-copy">
                    <strong>选择可用训练装备</strong>
                    <small>AI 排训练动作和放松动作时会优先使用这些装备；可以加入自己的训练/放松装备。</small>
                </div>
                <div class="plan-equipment-add-row">
                    <div class="md-field">
                        <input id="planEquipmentNameInput" data-plan-equipment-input type="text" placeholder=" " autocomplete="off" maxlength="24">
                        <label>新增装备名称</label>
                    </div>
                    <button class="md-btn md-btn-tonal" type="button" data-plan-equipment-add><span class="material-symbols-rounded">add</span>添加</button>
                </div>
                <div class="plan-equipment-chips">
                    ${options.map((item) => `
                        <button class="plan-equipment-chip ${selected.has(item.id) ? 'active' : ''}" type="button" data-plan-equipment-toggle="${attr(item.id)}">
                            <span class="material-symbols-rounded">${this.escapeHtml(item.icon)}</span>
                            <strong>${this.escapeHtml(item.label)}</strong>
                            <i class="material-symbols-rounded">${selected.has(item.id) ? 'check_circle' : 'radio_button_unchecked'}</i>
                            ${item.builtin ? '' : `<em class="material-symbols-rounded" data-plan-equipment-delete="${attr(item.id)}" title="删除">close</em>`}
                        </button>
                    `).join('')}
                </div>
            </div>`;
        },

        openPlanEquipmentSheet() {
            this.closePlanEquipmentSheetInternal?.();
            const modal = document.createElement('div');
            modal.id = 'planEquipmentSheet';
            modal.className = 'md-modal md-modal-sheet';
            modal.setAttribute('aria-hidden', 'false');
            modal.innerHTML = `
                <div class="md-modal-backdrop" data-modal-close></div>
                <div class="md-modal-card md-modal-sheet-card">
                    <div class="md-modal-head">
                        <strong>训练装备</strong>
                        <button class="icon-btn" type="button" data-modal-close aria-label="关闭"><span class="material-symbols-rounded">close</span></button>
                    </div>
                    <div class="md-modal-body" id="planEquipmentSheetBody">${this.renderPlanEquipmentSheetBody()}</div>
                </div>`;
            modal.querySelectorAll('[data-modal-close]').forEach((btn) => {
                btn.addEventListener('click', () => this.closePlanEquipmentSheet?.());
            });
            modal.addEventListener('click', (event) => {
                const deleteBtn = event.target?.closest?.('[data-plan-equipment-delete]');
                if (deleteBtn) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.deleteCustomPlanEquipment?.(deleteBtn.getAttribute('data-plan-equipment-delete') || '');
                    return;
                }
                const addBtn = event.target?.closest?.('[data-plan-equipment-add]');
                if (addBtn) {
                    event.preventDefault();
                    this.addPlanEquipmentFromInput?.();
                    return;
                }
                const chip = event.target?.closest?.('[data-plan-equipment-toggle]');
                if (chip) {
                    event.preventDefault();
                    this.togglePlanEquipment?.(chip.getAttribute('data-plan-equipment-toggle') || '');
                }
            });
            modal.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' || !event.target?.matches?.('[data-plan-equipment-input]')) return;
                event.preventDefault();
                this.addPlanEquipmentFromInput?.();
            });
            document.body.appendChild(modal);
            this._planEquipmentSheetEl = modal;
            window.navStack?.open?.('modal', 'planEquipmentSheet', () => this.closePlanEquipmentSheetInternal());
            requestAnimationFrame(() => document.getElementById('planEquipmentNameInput')?.focus?.());
        },

        closePlanEquipmentSheet() {
            return window.navStack?.requestClose?.('modal', 'planEquipmentSheet') || this.closePlanEquipmentSheetInternal();
        },

        closePlanEquipmentSheetInternal() {
            const el = this._planEquipmentSheetEl || document.getElementById('planEquipmentSheet');
            el?.remove?.();
            this._planEquipmentSheetEl = null;
            return true;
        },

        refreshPlanEquipmentSheet() {
            const body = document.getElementById('planEquipmentSheetBody');
            if (body) body.innerHTML = this.renderPlanEquipmentSheetBody();
        },

        updatePlanPref(key, value) {
            const prefs = this.ensurePlanPrefs?.();
            if (!prefs) return;
            prefs[key] = value;
            this.save();
            this.renderProfilePage?.();
        },

        togglePlanEquipment(name) {
            const prefs = this.ensurePlanPrefs?.();
            if (!prefs) return;
            const set = new Set(prefs.equipment || []);
            if (set.has(name)) set.delete(name);
            else set.add(name);
            prefs.equipment = [...set];
            this.save();
            this.renderProfilePage?.();
            this.refreshPlanEquipmentSheet?.();
        },

        addCustomPlanEquipment(label) {
            const prefs = this.ensurePlanPrefs?.();
            if (!prefs) return false;
            const name = String(label || '').trim();
            if (!name) {
                window.toast?.show?.('请输入道具名称', 'error');
                return false;
            }
            const existing = this.planEquipmentOptions?.() || [];
            if (existing.some((item) => item.label === name)) {
                window.toast?.show?.('这个道具已经存在', 'info');
                return false;
            }
            prefs.customEquipment = Array.isArray(prefs.customEquipment) ? prefs.customEquipment : [];
            const item = { id: customEquipmentId(name), label: name, icon: 'inventory_2' };
            prefs.customEquipment.push(item);
            prefs.equipment = [...new Set([...(prefs.equipment || []), item.id])];
            this.save();
            this.renderProfilePage?.();
            this.refreshPlanEquipmentSheet?.();
            window.haptics?.light?.();
            window.toast?.show?.(`已添加装备：${name}`, 'success');
            return true;
        },

        addPlanEquipmentFromInput() {
            const input = document.getElementById('planEquipmentNameInput');
            if (!input) return;
            if (this.addCustomPlanEquipment(input.value)) {
                input.value = '';
                requestAnimationFrame(() => document.getElementById('planEquipmentNameInput')?.focus?.());
            }
        },

        deleteCustomPlanEquipment(id) {
            const prefs = this.ensurePlanPrefs?.();
            if (!prefs) return;
            prefs.customEquipment = (prefs.customEquipment || []).filter((item) => item && item.id !== id);
            prefs.equipment = (prefs.equipment || []).filter((itemId) => itemId !== id);
            this.save();
            this.renderProfilePage?.();
            this.refreshPlanEquipmentSheet?.();
            window.haptics?.light?.();
        }
    };
})();
