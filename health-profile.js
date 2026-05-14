// @ts-nocheck
(function () {
    window.dataHealthProfile = {
        renderHealthProfileCard() {
            const p = this.db.health?.profile || {};
            const conds = p.conditions || [];
            const allergies = p.allergies || [];
            const equipment = p.preferences?.equipment || [];
            const sports = p.preferences?.sports || [];
            const hasAny = conds.length || allergies.length || equipment.length || sports.length || p.age || p.vitals?.restingHR;

            const typeLabel = { injury: '运动损伤', chronic: '慢性病', allergy: '过敏', surgery: '手术史', medication: '用药', other: '其他' };
            const sevLabel = { mild: '轻', moderate: '中', severe: '重' };

            const condChips = conds.map(c => `
                <div class="profile-condition">
                    <div class="profile-condition-head">
                        <span class="profile-condition-type type-${c.type}">${typeLabel[c.type] || c.type}</span>
                        <b>${this.escapeHtml ? this.escapeHtml(c.label) : c.label}</b>
                        ${c.severity ? `<span class="profile-sev sev-${c.severity}">${sevLabel[c.severity] || ''}</span>` : ''}
                    </div>
                    ${c.avoid?.length ? `<div class="profile-condition-avoid"><span class="material-symbols-rounded">block</span>避免：${c.avoid.join('、')}</div>` : ''}
                    ${c.note ? `<div class="profile-condition-note">${this.escapeHtml ? this.escapeHtml(c.note) : c.note}</div>` : ''}
                </div>
            `).join('');

            const detailSections = `
                ${conds.length ? `<div class="profile-section">
                    <div class="profile-section-title"><span class="material-symbols-rounded">warning</span> 训练禁忌与健康状况（${conds.length}）</div>
                    <div class="profile-condition-list">${condChips}</div>
                </div>` : ''}
                ${allergies.length ? `<div class="profile-section">
                    <div class="profile-section-title"><span class="material-symbols-rounded">no_food</span> 过敏 / 不耐受</div>
                    <div class="profile-chip-row">${allergies.map(a => `<span class="profile-chip">${this.escapeHtml ? this.escapeHtml(a) : a}</span>`).join('')}</div>
                </div>` : ''}
                ${equipment.length ? `<div class="profile-section">
                    <div class="profile-section-title"><span class="material-symbols-rounded">fitness_center</span> 可用器材</div>
                    <div class="profile-chip-row">${equipment.map(a => `<span class="profile-chip">${this.escapeHtml ? this.escapeHtml(a) : a}</span>`).join('')}</div>
                </div>` : ''}
                ${sports.length ? `<div class="profile-section">
                    <div class="profile-section-title"><span class="material-symbols-rounded">sports</span> 偏好运动</div>
                    <div class="profile-chip-row">${sports.map(a => `<span class="profile-chip">${this.escapeHtml ? this.escapeHtml(a) : a}</span>`).join('')}</div>
                </div>` : ''}
                ${p.vitals?.restingHR ? `<div class="profile-section profile-vitals">
                    <span class="material-symbols-rounded">monitor_heart</span>静息心率 ${p.vitals.restingHR} bpm
                </div>` : ''}`;

            return `<div class="md-card health-profile-card">
                <div class="profile-head">
                    <div class="profile-head-main">
                        <span class="profile-card-icon material-symbols-rounded">health_and_safety</span>
                        <div>
                            <span class="cardio-kicker">健康档案</span>
                            <h3>${p.gender === 'female' ? '女' : '男'} · ${p.age || '?'} 岁${this.db.health?.height ? ' · ' + this.db.health.height + ' cm' : ''}</h3>
                            <small>${hasAny ? 'AI 在每次分析时会自动参考此档案' : '点击编辑，让 AI 给你更安全、更贴合的建议'}</small>
                        </div>
                    </div>
                    <button class="md-btn md-btn-tonal profile-edit-btn" onclick="data.openProfileModal()" type="button"><span class="material-symbols-rounded">edit</span> 编辑</button>
                </div>
                ${hasAny ? `<details class="profile-details">
                    <summary><span class="material-symbols-rounded">expand_more</span> 查看详细健康档案</summary>
                    <div class="profile-details-body">${detailSections}</div>
                </details>` : ''}
                <div class="profile-footnote"><span class="material-symbols-rounded">lock</span>仅保存在本机/你的同步账号</div>
            </div>`;
        },

        openProfileModal() {
            const p = this.db.health?.profile || {};
            const modal = document.getElementById('profileModal');
            if (modal) modal.remove();
            const html = `<div class="md-modal-overlay" id="profileModal" onclick="if(event.target===this)data.closeProfileModal()">
                <div class="md-modal profile-modal">
                    <div class="md-modal-head">
                        <h3><span class="profile-modal-title-icon material-symbols-rounded">clinical_notes</span>编辑健康档案</h3>
                        <button class="md-icon-btn" onclick="data.closeProfileModal()" type="button"><span class="material-symbols-rounded">close</span></button>
                    </div>
                    <div class="md-modal-body">
                        <div class="profile-form-section profile-form-basic">
                            <h4><span class="profile-section-icon material-symbols-rounded">badge</span>基础信息</h4>
                            <div class="md-grid">
                                <div class="md-field">
                                    <select id="profGender">
                                        <option value="male" ${p.gender === 'male' ? 'selected' : ''}>男</option>
                                        <option value="female" ${p.gender === 'female' ? 'selected' : ''}>女</option>
                                    </select>
                                    <label>性别</label>
                                </div>
                                <div class="md-field"><input type="number" id="profAge" min="10" max="100" value="${p.age || ''}" placeholder=" "><label>年龄</label></div>
                                <div class="md-field"><input type="number" id="profRestHR" min="30" max="120" value="${p.vitals?.restingHR || ''}" placeholder=" "><label>静息心率 bpm</label></div>
                            </div>
                        </div>
                        <div class="profile-form-section profile-form-health">
                            <h4><span class="profile-section-icon material-symbols-rounded">health_and_safety</span>健康状况 / 训练禁忌</h4>
                            <div id="profCondList">${(p.conditions || []).map((c, i) => data.renderConditionEditor(c, i)).join('')}</div>
                            <button class="md-btn md-btn-tonal" onclick="data.addConditionRow()" type="button"><span class="material-symbols-rounded">add</span> 添加一条</button>
                        </div>
                        <div class="profile-form-section profile-form-allergy">
                            <h4><span class="profile-section-icon material-symbols-rounded">no_food</span>过敏 / 不耐受</h4>
                            <div class="md-field"><textarea id="profAllergies" class="profile-auto-textarea" rows="1" placeholder=" " oninput="data.autoResizeProfileTextareas(this)">${this.escapeHtml ? this.escapeHtml((p.allergies || []).join('、')) : (p.allergies || []).join('、')}</textarea><label>用「、」分隔，如：乳糖、花生</label></div>
                        </div>
                        <div class="profile-form-section profile-form-preference">
                            <h4><span class="profile-section-icon material-symbols-rounded">tune</span>偏好</h4>
                            <div class="md-field"><textarea id="profEquip" class="profile-auto-textarea" rows="1" placeholder=" " oninput="data.autoResizeProfileTextareas(this)">${this.escapeHtml ? this.escapeHtml((p.preferences?.equipment || []).join('、')) : (p.preferences?.equipment || []).join('、')}</textarea><label>可用器材，「、」分隔</label></div>
                            <div class="md-field"><textarea id="profSports" class="profile-auto-textarea" rows="1" placeholder=" " oninput="data.autoResizeProfileTextareas(this)">${this.escapeHtml ? this.escapeHtml((p.preferences?.sports || []).join('、')) : (p.preferences?.sports || []).join('、')}</textarea><label>偏好运动，「、」分隔</label></div>
                        </div>
                        <p class="profile-privacy"><span class="material-symbols-rounded">shield</span>数据仅保存在本机或你的同步账号，不会上传第三方服务</p>
                    </div>
                    <div class="md-modal-foot">
                        <button class="md-btn" onclick="data.closeProfileModal()" type="button">取消</button>
                        <button class="md-btn md-btn-filled" onclick="data.saveProfileFromModal()" type="button">保存</button>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
            this.autoResizeProfileTextareas(document.getElementById('profileModal'));
        },

        renderConditionEditor(c, i) {
            c = c || {};
            const esc = value => this.escapeHtml ? this.escapeHtml(value || '') : String(value || '');
            const types = [['injury', '运动损伤'], ['chronic', '慢性病'], ['allergy', '过敏'], ['surgery', '手术史'], ['medication', '用药'], ['other', '其他']];
            const sevs = [['mild', '轻'], ['moderate', '中'], ['severe', '重']];
            return `<div class="profile-cond-row" data-idx="${i}">
                <div class="md-grid profile-cond-meta-grid">
                    <div class="md-field profile-cond-type-field">
                        <select class="prof-cond-type">${types.map(([v, l]) => `<option value="${v}" ${c.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
                        <label>类型</label>
                    </div>
                    <div class="md-field profile-cond-sev-field">
                        <select class="prof-cond-sev">${sevs.map(([v, l]) => `<option value="${v}" ${c.severity === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
                        <label>严重程度</label>
                    </div>
                </div>
                <div class="md-field"><textarea class="prof-cond-label profile-auto-textarea" rows="1" placeholder=" " oninput="data.autoResizeProfileTextareas(this)">${esc(c.label)}</textarea><label>描述（如：左膝半月板二级损伤）</label></div>
                <div class="md-field"><textarea class="prof-cond-avoid profile-auto-textarea" rows="1" placeholder=" " oninput="data.autoResizeProfileTextareas(this)">${esc((c.avoid || []).join('、'))}</textarea><label>需避免的动作/食物，「、」分隔</label></div>
                <div class="md-field"><textarea class="prof-cond-note profile-auto-textarea" rows="1" placeholder=" " oninput="data.autoResizeProfileTextareas(this)">${esc(c.note)}</textarea><label>备注（可选）</label></div>
                <button class="md-btn profile-cond-del" onclick="data.removeConditionRow(this)" type="button"><span class="material-symbols-rounded">delete</span> 删除此条</button>
            </div>`;
        },

        autoResizeProfileTextareas(target) {
            const textareas = target?.matches?.('.profile-auto-textarea') ? [target] : Array.from(target?.querySelectorAll?.('.profile-auto-textarea') || []);
            textareas.forEach(textarea => {
                textarea.style.height = 'auto';
                textarea.style.height = Math.max(46, textarea.scrollHeight) + 'px';
            });
        },

        addConditionRow() {
            const list = document.getElementById('profCondList');
            if (!list) return;
            const idx = list.children.length;
            list.insertAdjacentHTML('beforeend', this.renderConditionEditor({}, idx));
            this.autoResizeProfileTextareas(list.lastElementChild);
        },

        removeConditionRow(btn) {
            const row = btn.closest('.profile-cond-row');
            if (row) row.remove();
        },

        saveProfileFromModal() {
            const p = this.db.health.profile = this.db.health.profile || {};
            p.gender = document.getElementById('profGender')?.value || 'male';
            p.age = parseInt(document.getElementById('profAge')?.value) || null;
            p.vitals = p.vitals || {};
            p.vitals.restingHR = parseInt(document.getElementById('profRestHR')?.value) || null;
            const splitFn = v => String(v || '').split(/[、,，]/).map(s => s.trim()).filter(Boolean);
            p.allergies = splitFn(document.getElementById('profAllergies')?.value);
            p.preferences = p.preferences || {};
            p.preferences.equipment = splitFn(document.getElementById('profEquip')?.value);
            p.preferences.sports = splitFn(document.getElementById('profSports')?.value);
            const rows = document.querySelectorAll('#profCondList .profile-cond-row');
            const conds = [];
            rows.forEach(row => {
                const label = row.querySelector('.prof-cond-label')?.value.trim();
                if (!label) return;
                conds.push({
                    id: 'c' + Date.now() + Math.random().toString(36).slice(2, 6),
                    type: row.querySelector('.prof-cond-type')?.value || 'other',
                    severity: row.querySelector('.prof-cond-sev')?.value || 'mild',
                    label,
                    avoid: splitFn(row.querySelector('.prof-cond-avoid')?.value),
                    note: row.querySelector('.prof-cond-note')?.value.trim() || '',
                    addedAt: new Date().toISOString().slice(0, 10)
                });
            });
            p.conditions = conds;
            this.touchRecord(p);
            this.saveAndBackup();
            this.closeProfileModal();
            this.renderHistory();
        },

        closeProfileModal() {
            document.getElementById('profileModal')?.remove();
        }
    };
})();
