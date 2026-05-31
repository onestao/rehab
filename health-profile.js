// @ts-nocheck
(function () {
    const REHAB_STATUS_LABEL = {
        new: '本周新增',
        continued: '继续执行',
        progressed: '进阶/调整',
        dropped: '暂停/淘汰',
        watch: '疼痛观察'
    };

    function esc(ctx, value = '') {
        return ctx.escapeHtml ? ctx.escapeHtml(value || '') : String(value || '');
    }

    function normalizeRehabStatus(value = '') {
        const raw = String(value || '').trim().toLowerCase();
        if (['new', '新增', '本周新增'].includes(raw)) return 'new';
        if (['progressed', 'progress', '进阶', '调整', '加量'].includes(raw)) return 'progressed';
        if (['dropped', 'drop', 'paused', 'pause', '暂停', '淘汰', '停止'].includes(raw)) return 'dropped';
        if (['watch', 'pain', '疼痛', '观察'].includes(raw)) return 'watch';
        return 'continued';
    }

    function normalizeRehabSpec(raw = {}) {
        if (!raw || typeof raw !== 'object') return null;
        const mode = ['reps', 'hold', 'alt-reps', 'alt-hold'].includes(raw.mode) ? raw.mode : 'reps';
        const isHold = mode === 'hold' || mode === 'alt-hold';
        return {
            sets: Math.max(0, Math.round(Number(raw.sets || 0))),
            reps: isHold ? 0 : Math.max(0, Math.round(Number(raw.reps || 0))),
            work: Math.max(0, Math.round(Number(raw.work || 0))),
            mode,
            actionRest: Math.max(0, Math.round(Number(raw.actionRest || 0)))
        };
    }

    function extractJsonObject(raw = '') {
        const text = String(raw || '').trim();
        try { return JSON.parse(text); } catch {}
        const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fenced) {
            try { return JSON.parse(fenced[1]); } catch {}
        }
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try { return JSON.parse(match[0]); } catch { return null; }
    }

    window.dataHealthProfile = {
        rehabWeekStart(date = new Date()) {
            const d = new Date(date);
            const day = d.getDay() || 7;
            d.setDate(d.getDate() - day + 1);
            d.setHours(0, 0, 0, 0);
            return this.dateKey ? this.dateKey(d) : d.toISOString().slice(0, 10);
        },

        latestRehabWeekly(limit = 3) {
            return (this.activeRecords?.(this.db.health?.rehabWeekly || []) || [])
                .slice()
                .sort((a, b) => String(b.weekStart || '').localeCompare(String(a.weekStart || '')) || Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
                .slice(0, limit);
        },

        rehabStatusLabel(status = '') {
            return REHAB_STATUS_LABEL[normalizeRehabStatus(status)] || '继续执行';
        },

        rehabStatusClass(status = '') {
            const normalized = normalizeRehabStatus(status);
            if (normalized === 'new') return 'is-new';
            if (normalized === 'progressed') return 'is-progressed';
            if (normalized === 'dropped' || normalized === 'watch') return 'is-watch';
            return 'is-continued';
        },

        rehabSpecLabel(spec) {
            if (!spec) return '不进入本周训练';
            const sets = Number(spec.sets || 0);
            const work = Number(spec.work || 0);
            const reps = Number(spec.reps || 0);
            const mode = String(spec.mode || 'reps');
            if (mode.includes('hold')) return `${sets || '?'}组 × ${work || '?'}秒`;
            return `${sets || '?'}组 × ${reps || '?'}次${mode.includes('alt') ? '/侧' : ''}`;
        },

        renderRehabWeeklyCard() {
            const weeks = this.latestRehabWeekly?.(3) || [];
            const latest = weeks[0] || null;
            const actions = latest?.actions || [];
            const reviewCount = actions.filter(a => a.needsReview || Number(a.confidence || 100) < 80 || Number(a.painLevel || 0) >= 4).length;
            const newCount = actions.filter(a => normalizeRehabStatus(a.status) === 'new').length;
            const actionPreview = actions.slice(0, 4).map(action => `
                <div class="rehab-week-action-mini">
                    <span class="rehab-status ${this.rehabStatusClass(action.status)}">${this.rehabStatusLabel(action.status)}</span>
                    <b>${esc(this, action.name || '未命名动作')}</b>
                    <small>${esc(this, this.rehabSpecLabel(action.spec))}</small>
                </div>`).join('');
            return `<div class="md-card rehab-week-card">
                <div class="rehab-week-glass-summary">
                    <div class="rehab-week-stat"><strong>${actions.length || 0}</strong><small>动作</small></div>
                    <div class="rehab-week-stat"><strong>${newCount}</strong><small>新增</small></div>
                    <div class="rehab-week-stat"><strong>${reviewCount}</strong><small>确认</small></div>
                </div>
                <div class="profile-head rehab-week-head">
                    <div class="profile-head-main">
                        <span class="profile-card-icon material-symbols-rounded">clinical_notes</span>
                        <div>
                            <span class="cardio-kicker">康复周处方</span>
                            <h3>${latest ? `${esc(this, latest.weekStart || '')} 起` : '还没有本周处方'}</h3>
                            <small>${latest ? '训练计划 AI 会自动参考最近 3 周处方' : '输入康复师原话，AI 解析后再确认录入'}</small>
                        </div>
                    </div>
                    <button class="md-btn md-btn-tonal profile-edit-btn" onclick="data.openRehabWeeklySheet()" type="button"><span class="material-symbols-rounded">auto_awesome</span> 录入</button>
                </div>
                ${latest ? `<div class="rehab-week-action-list">${actionPreview || '<div class="profile-condition-note">本周处方暂无动作明细</div>'}</div>` : `<div class="profile-condition-note">适合每周从康复中心回来后录入新动作、暂停动作和疼痛反馈。</div>`}
            </div>`;
        },

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

        openRehabWeeklySheet() {
            const weekStart = this.rehabWeekStart?.() || this.logicalDateKey?.() || this.dateKey(new Date());
            const visitDate = this.logicalDateKey?.() || this.dateKey(new Date());
            this._rehabWeeklyDraft = null;
            document.getElementById('rehabWeeklySheet')?.remove();
            const html = `<div class="md-modal-overlay rehab-week-overlay" id="rehabWeeklySheet" onclick="if(event.target===this)data.closeRehabWeeklySheet()">
                <div class="md-modal rehab-week-modal">
                    <div class="md-modal-head rehab-week-modal-head">
                        <h3><span class="profile-modal-title-icon material-symbols-rounded">clinical_notes</span>录入康复周处方</h3>
                        <button class="md-icon-btn" onclick="data.closeRehabWeeklySheet()" type="button"><span class="material-symbols-rounded">close</span></button>
                    </div>
                    <div class="rehab-week-mobile-summary" aria-label="康复周处方摘要">
                        <div class="rehab-week-stat"><strong id="rehabDraftActions">0</strong><small>动作</small></div>
                        <div class="rehab-week-stat"><strong id="rehabDraftNew">0</strong><small>新增</small></div>
                        <div class="rehab-week-stat"><strong id="rehabDraftReview">0</strong><small>确认</small></div>
                    </div>
                    <div class="md-modal-body rehab-week-body">
                        ${this.renderRehabWeeklyStepBaseline()}
                        ${this.renderRehabWeeklyStepInput(weekStart, visitDate)}
                        ${this.renderRehabWeeklyStepDiff()}
                        ${this.renderRehabWeeklyStepReview()}
                        ${this.renderRehabWeeklyStepCommit()}
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
            this.openRehabWeeklyStep('rehabStepInput');
            this.updateRehabWeeklyDraftUi();
        },

        renderRehabWeeklyStepBaseline() {
            const latest = this.latestRehabWeekly?.(1)?.[0] || null;
            const actions = latest?.actions || [];
            const fallback = [{ name: '暂无上周处方', status: 'continued', spec: null, coachNote: '保存一次处方后，下周会自动作为对比基线。' }];
            const rows = (actions.length ? actions : fallback).slice(0, 6).map(action => `
                <div class="baseline-item">
                    <div><strong>${esc(this, action.name || '未命名动作')}</strong><small>${esc(this, this.rehabSpecLabel(action.spec))}${action.coachNote ? ' · ' + esc(this, action.coachNote) : ''}</small></div>
                    <span class="rehab-status ${this.rehabStatusClass(action.status)}">${this.rehabStatusLabel(action.status)}</span>
                </div>`).join('');
            return `<details class="rehab-step-card" id="rehabStepBaseline">
                <summary><span class="rehab-step-index">0</span><span class="rehab-step-copy"><strong>上周基线</strong><small>AI 用它判断老动作</small></span><span class="rehab-step-trailing"><span class="rehab-status is-continued">${actions.length || 0} 条</span><span class="material-symbols-rounded">expand_more</span></span></summary>
                <div class="rehab-step-body"><div class="baseline-list">${rows}</div></div>
            </details>`;
        },

        renderRehabWeeklyStepInput(weekStart, visitDate) {
            return `<details class="rehab-step-card" id="rehabStepInput" open>
                <summary><span class="rehab-step-index">1</span><span class="rehab-step-copy"><strong>粘贴或口述本周处方</strong><small>自然语言即可</small></span><span class="rehab-step-trailing"><span id="rehabInputBadge" class="rehab-status is-progressed">当前</span><span class="material-symbols-rounded">expand_more</span></span></summary>
                <div class="rehab-step-body">
                    <div class="rehab-week-date-grid">
                        <div class="md-field"><input type="date" id="rehabWeekStart" value="${esc(this, weekStart)}" placeholder=" "><label>周开始</label></div>
                        <div class="md-field"><input type="date" id="rehabVisitDate" value="${esc(this, visitDate)}" placeholder=" "><label>复诊日期</label></div>
                    </div>
                    <div class="md-field rehab-prescription-field"><textarea id="rehabPrescriptionText" rows="5" placeholder=" "></textarea><label>康复师原话/运动描述</label></div>
                    <div class="rehab-week-chips">
                        <button class="md-chip" type="button" onclick="data.fillRehabWeeklyExample('short')">半结构化示例</button>
                        <button class="md-chip" type="button" onclick="data.fillRehabWeeklyExample('messy')">口语化示例</button>
                        <button class="md-chip" type="button" onclick="data.fillRehabWeeklyExample('pain')">带疼痛反馈</button>
                    </div>
                    <div class="md-row rehab-week-actions"><button id="rehabParseBtn" class="md-btn md-btn-filled" type="button" onclick="data.parseRehabWeeklyWithAi()"><span class="material-symbols-rounded">auto_awesome</span>让 AI 解析</button></div>
                    <div id="rehabParseStatus" class="rehab-parse-status" aria-live="polite"></div>
                </div>
            </details>`;
        },

        renderRehabWeeklyStepDiff() {
            return `<details class="rehab-step-card" id="rehabStepDiff">
                <summary><span class="rehab-step-index">2</span><span class="rehab-step-copy"><strong>查看本周差分</strong><small>解析后才会出现</small></span><span class="rehab-step-trailing"><span id="rehabDiffBadge" class="rehab-status is-continued">等待解析</span><span class="material-symbols-rounded">expand_more</span></span></summary>
                <div class="rehab-step-body" id="rehabDiffBody"><div class="rehab-empty"><span class="material-symbols-rounded">compare_arrows</span><p>先录入本周描述，AI 才能和上周基线做差分。</p></div></div>
            </details>`;
        },

        renderRehabWeeklyStepReview() {
            return `<details class="rehab-step-card" id="rehabStepReview">
                <summary><span class="rehab-step-index">3</span><span class="rehab-step-copy"><strong>确认 AI 解析结果</strong><small>修正动作名/状态/疼痛</small></span><span class="rehab-step-trailing"><span id="rehabReviewBadge" class="rehab-status is-continued">等待确认</span><span class="material-symbols-rounded">expand_more</span></span></summary>
                <div class="rehab-step-body" id="rehabReviewBody"><div class="rehab-empty"><span class="material-symbols-rounded">rule</span><p>解析后这里会出现可编辑动作卡。</p></div></div>
            </details>`;
        },

        renderRehabWeeklyStepCommit() {
            return `<details class="rehab-step-card" id="rehabStepCommit">
                <summary><span class="rehab-step-index">4</span><span class="rehab-step-copy"><strong>确认录入与 AI 上下文</strong><small>保存后供计划 AI 使用</small></span><span class="rehab-step-trailing"><span id="rehabCommitBadge" class="rehab-status is-continued">未就绪</span><span class="material-symbols-rounded">expand_more</span></span></summary>
                <div class="rehab-step-body">
                    <pre id="rehabRecordJson" class="rehab-json">暂无数据</pre>
                    <details class="context-preview"><summary>查看注入给 AI 的上下文</summary><pre id="rehabContextPreview" class="rehab-json">暂无上下文</pre></details>
                    <div class="md-row rehab-week-actions"><button id="rehabSaveBtn" class="md-btn md-btn-filled" type="button" onclick="data.saveRehabWeeklyDraft()" disabled><span class="material-symbols-rounded">done_all</span>确认录入</button></div>
                </div>
            </details>`;
        },

        closeRehabWeeklySheet() {
            document.getElementById('rehabWeeklySheet')?.remove();
            this._rehabWeeklyDraft = null;
        },

        openRehabWeeklyStep(id) {
            ['rehabStepBaseline', 'rehabStepInput', 'rehabStepDiff', 'rehabStepReview', 'rehabStepCommit'].forEach(stepId => {
                const el = document.getElementById(stepId);
                if (el) el.open = stepId === id;
            });
        },

        setRehabParseStatus(message = '', state = '') {
            const el = document.getElementById('rehabParseStatus');
            if (!el) return;
            el.textContent = message;
            el.dataset.state = state || '';
        },

        setRehabParsePending(pending) {
            const btn = document.getElementById('rehabParseBtn');
            if (!btn) return;
            btn.disabled = !!pending;
            btn.innerHTML = pending
                ? '<span class="material-symbols-rounded">progress_activity</span>解析中'
                : '<span class="material-symbols-rounded">auto_awesome</span>让 AI 解析';
        },

        fillRehabWeeklyExample(type = 'short') {
            const examples = {
                short: '这周继续靠墙静蹲，3组，每组40秒，蹲到膝盖不痛的位置。新增弹力带膝外推，每侧15次做2组。上周跪姿后踢腿先停掉，老师说我腰有代偿。最后继续股四头肌等长收缩，每次夹毛巾保持10秒。',
                messy: '今天康复老师说：那个靠墙慢慢蹲的还要做，但是不要蹲太低；又加了一个坐着还是躺着用弹力带把膝盖往外打开的动作，左右都做，大概15下；之前趴着/跪着腿往后抬那个先不做，说我的腰容易抢力。还有一个脚踩台阶慢慢下来的动作，让我扶着做。',
                pain: '本周反馈：靠墙蹲做到40秒膝盖大概2分疼，可以继续。弹力带开合做完髋外侧酸，膝盖不疼，老师说是新动作。台阶下放右腿支撑时膝前方有4分疼，老师说先降低台阶高度。跪姿后踢腿暂停。'
            };
            const input = document.getElementById('rehabPrescriptionText');
            if (input) input.value = examples[type] || examples.short;
        },

        recentRehabWeeklyContext(limit = 3) {
            return (this.latestRehabWeekly?.(limit) || []).map(week => ({
                weekStart: week.weekStart || '',
                visitDate: week.visitDate || '',
                therapistAssessment: week.therapistAssessment || '',
                actions: (week.actions || []).map(action => ({
                    name: action.name || '',
                    status: normalizeRehabStatus(action.status),
                    rawDescription: action.rawDescription || action.raw || '',
                    spec: action.spec || null,
                    painLevel: Number(action.painLevel || 0),
                    coachNote: action.coachNote || '',
                    confidence: Number(action.confidence || 0)
                }))
            }));
        },

        buildRehabWeeklyPrompt(text = '', weekStart = '', visitDate = '') {
            const recent = this.recentRehabWeeklyContext?.(3) || [];
            return [
                '你是康复训练处方结构化助手。用户只能提供康复师的自然语言描述，你需要把它解析为本周康复处方。',
                '必须只返回严格 JSON，不要 Markdown，不要解释。',
                'JSON 结构：{"weekStart":"YYYY-MM-DD","visitDate":"YYYY-MM-DD","therapistAssessment":"...","homework":"...","actions":[{"name":"标准化动作名","rawDescription":"用户原话片段","status":"new|continued|progressed|dropped|watch","confidence":0-100,"spec":{"sets":number,"reps":number,"work":number,"mode":"reps|hold|alt-reps|alt-hold","actionRest":number}|null,"painLevel":0-10,"coachNote":"...","needsReview":true|false}]}',
                '规则：',
                '- name 要尽量归一化为可执行动作名；如果不确定，在 name 中保留候选，如“弹力带髋外展 / 蚌式开合”。',
                '- status 必须通过本周描述和最近处方对比判断：首次出现为 new；延续为 continued；加量/改强度为 progressed；明确停做为 dropped；疼痛或需观察为 watch。',
                '- 低置信动作 confidence < 80 或疼痛 >= 4 必须 needsReview=true。',
                '- dropped 动作 spec 可以为 null。',
                '- 不要编造用户没提到的动作。',
                `本周开始：${weekStart || '未知'}`,
                `复诊日期：${visitDate || '未知'}`,
                `最近3周处方：${JSON.stringify(recent)}`,
                `用户本周描述：${text}`
            ].join('\n');
        },

        normalizeRehabWeeklyPayload(payload = {}, fallback = {}) {
            const actions = (Array.isArray(payload.actions) ? payload.actions : []).map(action => {
                const name = String(action.name || '').trim();
                if (!name) return null;
                const status = normalizeRehabStatus(action.status);
                const painLevel = Math.max(0, Math.min(10, Math.round(Number(action.painLevel || 0))));
                const confidence = Math.max(0, Math.min(100, Math.round(Number(action.confidence || 0)) || 75));
                return {
                    name,
                    rawDescription: String(action.rawDescription || action.raw || '').slice(0, 220),
                    status,
                    confidence,
                    spec: status === 'dropped' ? null : normalizeRehabSpec(action.spec),
                    painLevel,
                    coachNote: String(action.coachNote || '').slice(0, 240),
                    needsReview: !!action.needsReview || confidence < 80 || painLevel >= 4
                };
            }).filter(Boolean);
            return {
                weekStart: String(payload.weekStart || fallback.weekStart || this.rehabWeekStart?.() || this.logicalDateKey?.() || '').slice(0, 10),
                visitDate: String(payload.visitDate || fallback.visitDate || this.logicalDateKey?.() || '').slice(0, 10),
                source: 'ai-parsed-natural-language',
                rawText: String(fallback.rawText || '').slice(0, 4000),
                therapistAssessment: String(payload.therapistAssessment || '').slice(0, 500),
                homework: String(payload.homework || '').slice(0, 500),
                actions
            };
        },

        async parseRehabWeeklyWithAi() {
            const rawText = String(document.getElementById('rehabPrescriptionText')?.value || '').trim();
            if (!rawText) {
                this.setRehabParseStatus('先输入康复师原话或动作描述。', 'error');
                return;
            }
            const weekStart = document.getElementById('rehabWeekStart')?.value || this.rehabWeekStart?.() || '';
            const visitDate = document.getElementById('rehabVisitDate')?.value || this.logicalDateKey?.() || '';
            this.setRehabParsePending(true);
            this.setRehabParseStatus('正在让 AI 解析自然语言处方...', 'busy');
            try {
                if (typeof window.ai === 'undefined' || typeof ai.call !== 'function') throw new Error('AI 模块未加载');
                const content = this.buildRehabWeeklyPrompt(rawText, weekStart, visitDate);
                const result = await ai.call([
                    { role: 'system', content: '你是康复训练处方结构化助手，只返回严格 JSON。' },
                    { role: 'user', content }
                ], 2200);
                const parsed = extractJsonObject(result);
                if (!parsed) throw new Error('AI 返回不是有效 JSON');
                const draft = this.normalizeRehabWeeklyPayload(parsed, { weekStart, visitDate, rawText });
                if (!draft.actions.length) throw new Error('AI 未解析出可用动作');
                this._rehabWeeklyDraft = draft;
                this.renderRehabWeeklyDraft();
                this.openRehabWeeklyStep('rehabStepDiff');
                this.setRehabParseStatus('已解析，请先查看差分，再确认动作。', 'ok');
                window.haptics?.success?.();
            } catch (e) {
                this.setRehabParseStatus(e?.message || 'AI 解析失败', 'error');
            } finally {
                this.setRehabParsePending(false);
            }
        },

        renderRehabWeeklyDraft() {
            const draft = this._rehabWeeklyDraft || null;
            const actions = draft?.actions || [];
            const reviewCount = actions.filter(a => a.needsReview || Number(a.confidence || 100) < 80 || Number(a.painLevel || 0) >= 4).length;
            const newCount = actions.filter(a => a.status === 'new').length;
            const droppedCount = actions.filter(a => a.status === 'dropped').length;
            const keepCount = actions.filter(a => ['continued', 'progressed'].includes(a.status)).length;
            this.setRehabDraftText('rehabDraftActions', actions.length);
            this.setRehabDraftText('rehabDraftNew', newCount);
            this.setRehabDraftText('rehabDraftReview', reviewCount);
            this.setRehabDraftText('rehabDiffBadge', `${newCount} 新增`);
            this.setRehabDraftText('rehabReviewBadge', `${actions.length} 动作`);
            this.setRehabDraftText('rehabCommitBadge', reviewCount ? '需确认' : '可录入');
            const diff = document.getElementById('rehabDiffBody');
            if (diff) diff.innerHTML = `<div class="rehab-diff-grid">
                <div class="rehab-diff-card"><small>继续/进阶</small><strong>${keepCount}</strong></div>
                <div class="rehab-diff-card"><small>本周新增</small><strong>${newCount}</strong></div>
                <div class="rehab-diff-card"><small>暂停/淘汰</small><strong>${droppedCount}</strong></div>
                <div class="rehab-diff-card"><small>需确认</small><strong>${reviewCount}</strong></div>
            </div><div class="rehab-diff-list">${actions.map(a => `<div class="baseline-item"><div><strong>${esc(this, a.name)}</strong><small>${esc(this, a.rawDescription || a.coachNote || '')}</small></div><span class="rehab-status ${this.rehabStatusClass(a.status)}">${this.rehabStatusLabel(a.status)}</span></div>`).join('')}</div>`;
            const review = document.getElementById('rehabReviewBody');
            if (review) review.innerHTML = actions.map((action, index) => this.renderRehabActionReview(action, index)).join('');
            const record = document.getElementById('rehabRecordJson');
            if (record) record.textContent = JSON.stringify(draft || {}, null, 2);
            const context = document.getElementById('rehabContextPreview');
            if (context) context.textContent = this.rehabWeeklyAiContextText(draft);
            const save = document.getElementById('rehabSaveBtn');
            if (save) save.disabled = !actions.length;
        },

        renderRehabActionReview(action, index) {
            const status = normalizeRehabStatus(action.status);
            return `<div class="rehab-action-review" data-rehab-action-index="${index}">
                <div class="rehab-action-review-head">
                    <div><strong>${esc(this, action.name)}</strong><small>${esc(this, action.rawDescription || action.coachNote || '')}</small></div>
                    <span class="rehab-confidence ${action.confidence < 80 ? 'is-low' : ''}">${Number(action.confidence || 0)}%</span>
                </div>
                <div class="rehab-review-grid">
                    <label class="mini-field"><span>状态</span><select data-field="status"><option value="continued" ${status === 'continued' ? 'selected' : ''}>继续</option><option value="new" ${status === 'new' ? 'selected' : ''}>新增</option><option value="progressed" ${status === 'progressed' ? 'selected' : ''}>进阶</option><option value="dropped" ${status === 'dropped' ? 'selected' : ''}>暂停</option><option value="watch" ${status === 'watch' ? 'selected' : ''}>观察</option></select></label>
                    <label class="mini-field"><span>动作名</span><input data-field="name" value="${esc(this, action.name)}"></label>
                    <label class="mini-field"><span>疼痛</span><input data-field="painLevel" type="number" min="0" max="10" value="${Number(action.painLevel || 0)}"></label>
                </div>
            </div>`;
        },

        setRehabDraftText(id, value) {
            const el = document.getElementById(id);
            if (el) el.textContent = String(value);
        },

        collectRehabWeeklyReviewEdits() {
            const draft = this._rehabWeeklyDraft;
            if (!draft) return null;
            document.querySelectorAll('[data-rehab-action-index]').forEach(row => {
                const index = Number(row.dataset.rehabActionIndex);
                const action = draft.actions[index];
                if (!action) return;
                action.status = normalizeRehabStatus(row.querySelector('[data-field="status"]')?.value);
                action.name = String(row.querySelector('[data-field="name"]')?.value || action.name).trim() || action.name;
                action.painLevel = Math.max(0, Math.min(10, Math.round(Number(row.querySelector('[data-field="painLevel"]')?.value || 0))));
                action.needsReview = action.needsReview || action.painLevel >= 4 || Number(action.confidence || 100) < 80;
                if (action.status === 'dropped') action.spec = null;
            });
            return draft;
        },

        rehabWeeklyAiContextText(draft = this._rehabWeeklyDraft) {
            if (!draft) return '暂无上下文';
            const actions = draft.actions || [];
            const mustInclude = actions.filter(a => ['continued', 'progressed'].includes(a.status)).map(a => a.name);
            const mustExclude = actions.filter(a => a.status === 'dropped').map(a => a.name);
            const cautious = actions.filter(a => a.status === 'new' || a.status === 'watch' || a.needsReview).map(a => `${a.name}（${this.rehabStatusLabel(a.status)}，疼痛${Number(a.painLevel || 0)}/10，置信${Number(a.confidence || 0)}%）`);
            return [`【近3周康复中心处方 - 本周摘要】`, `必须保留或参考：${mustInclude.join('、') || '无'}`, `本周禁止出现在计划中：${mustExclude.join('、') || '无'}`, `新增/观察动作不得自动加量：${cautious.join('、') || '无'}`, '规则：低置信动作必须先让用户确认；疼痛 >=4/10 的动作只能降级或替换，不能进阶。'].join('\n');
        },

        updateRehabWeeklyDraftUi() {
            this.renderRehabWeeklyDraft();
        },

        saveRehabWeeklyDraft() {
            const draft = this.collectRehabWeeklyReviewEdits();
            if (!draft || !draft.actions?.length) return;
            this.db.health = this.db.health || {};
            this.db.health.rehabWeekly = Array.isArray(this.db.health.rehabWeekly) ? this.db.health.rehabWeekly : [];
            const existing = this.db.health.rehabWeekly.find(item => !item.deleted && item.weekStart === draft.weekStart);
            const record = existing || { id: this.generateRecordId?.('rehab-week') || `rehab-week-${Date.now()}` };
            Object.assign(record, draft);
            this.touchRecord(record, ['weekStart', 'visitDate', 'actions', 'therapistAssessment', 'homework', 'rawText']);
            if (!existing) this.db.health.rehabWeekly.unshift(record);
            this.saveAndBackup?.() || this.save?.();
            this.closeRehabWeeklySheet();
            this.renderHistory?.();
            window.toast?.show?.('已录入本周康复处方', 'success');
        },

        closeProfileModal() {
            document.getElementById('profileModal')?.remove();
        }
    };
})();
