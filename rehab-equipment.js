// @ts-nocheck
(function () {
    if (window.dataRehabEquipment) return;

    const EQUIPMENT = [
        ['fascia_gun', '筋膜枪'],
        ['foam_roller', '泡沫轴'],
        ['band', '弹力带'],
        ['yoga_ball', '瑜伽球'],
        ['balance_pad', '平衡垫'],
        ['stretch_strap', '拉伸带']
    ];

    window.dataRehabEquipment = {
        renderRehabEquipmentCard() {
            const prefs = this.ensureRehabPrefs?.() || {};
            return `<div class="md-card rehab-pref-card">
                <div class="rehab-pref-head">
                    <div>
                        <span class="cardio-kicker">偏好 · 康复道具</span>
                        <h3>康复计划偏好</h3>
                        <small>这些设置会影响 AI 计划、放松流和底部常驻栏</small>
                    </div>
                    <span class="material-symbols-rounded">health_and_safety</span>
                </div>
                <div class="md-grid rehab-pref-grid">
                    <div class="md-field">
                        <select onchange="data.updateRehabPref('stage', this.value)">
                            ${[
                                ['unset', '未设置'],
                                ['post_op_4w', '术后 4 周'],
                                ['post_op_8w', '术后 8 周'],
                                ['maintenance', '维持期'],
                                ['chronic', '慢性不适']
                            ].map(([value, label]) => `<option value="${value}" ${prefs.stage === value ? 'selected' : ''}>${label}</option>`).join('')}
                        </select>
                        <label>康复阶段</label>
                    </div>
                    <div class="md-field">
                        <select onchange="data.updateRehabPref('cooldownMode', this.value)">
                            ${[
                                ['attached', '挂载式提示'],
                                ['paired', '主项后直接接放松'],
                                ['centralized', '全部暂存集中拉伸']
                            ].map(([value, label]) => `<option value="${value}" ${prefs.cooldownMode === value ? 'selected' : ''}>${label}</option>`).join('')}
                        </select>
                        <label>放松默认模式</label>
                    </div>
                    <div class="md-field">
                        <select onchange="data.updateRehabPref('askOnEdit', this.value)">
                            ${[
                                ['always', '每次都问'],
                                ['lock_default', '默认锁定'],
                                ['pass_default', '默认直接通过']
                            ].map(([value, label]) => `<option value="${value}" ${prefs.askOnEdit === value ? 'selected' : ''}>${label}</option>`).join('')}
                        </select>
                        <label>编辑时行为</label>
                    </div>
                </div>
                <div class="rehab-equipment-chips">
                    ${EQUIPMENT.map(([value, label]) => `
                        <button class="md-chip ${prefs.equipment?.includes(value) ? 'active' : ''}" type="button" onclick="data.toggleRehabEquipment('${value}')">${label}</button>
                    `).join('')}
                </div>
                <div class="rehab-pref-switches">
                    ${[
                        ['askBeforeProgression', '进阶前询问'],
                        ['showCooldownDock', '显示待拉伸常驻栏'],
                        ['showWeeklyDock', '显示本周常驻栏']
                    ].map(([key, label]) => `
                        <label class="md-switch rehab-pref-switch" role="switch" aria-checked="${!!prefs[key]}">
                            <span>${label}</span>
                            <span class="switch-track">
                                <input type="checkbox" ${prefs[key] ? 'checked' : ''} onchange="data.updateRehabPref('${key}', this.checked)">
                                <span class="switch-thumb"></span>
                            </span>
                        </label>
                    `).join('')}
                </div>
            </div>`;
        },

        updateRehabPref(key, value) {
            const prefs = this.ensureRehabPrefs?.();
            if (!prefs) return;
            prefs[key] = value;
            this.save();
            this.renderProfilePage?.();
            this.renderRehabDock?.();
        },

        toggleRehabEquipment(name) {
            const prefs = this.ensureRehabPrefs?.();
            if (!prefs) return;
            const set = new Set(prefs.equipment || []);
            if (set.has(name)) set.delete(name);
            else set.add(name);
            prefs.equipment = [...set];
            this.save();
            this.renderProfilePage?.();
        }
    };
})();

