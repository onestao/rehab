const data = {
    DB_KEY: 'rehab_pro_universal_db',
    CFG_KEY: 'rehab_pro_universal_cfg',
    db: { actions: [], routines: [], history: [], rate: 1.1 },
    cfg: { mode: 'none', s3: {}, dav: {} },
    historyMonthOffset: 0,
    historyColors: ['#2563eb', '#7c3aed', '#059669', '#f59e0b', '#e11d48', '#0891b2', '#9333ea', '#ea580c'],

    init() {
        const localDb = localStorage.getItem(this.DB_KEY);
        const localCfg = localStorage.getItem(this.CFG_KEY);
        if (localDb) this.db = JSON.parse(localDb);
        else this.migrateLegacy();
        if (localCfg) this.cfg = JSON.parse(localCfg);
        this.render();
        sync.initUI();
    },

    migrateLegacy() {
        const legacy = ['rp_v31_db', 'rp_v28_db', 'rp_v21_main'];
        for (let key of legacy) {
            let old = localStorage.getItem(key);
            if (old) { this.db = JSON.parse(old); this.save(); break; }
        }
    },

    save() {
        localStorage.setItem(this.DB_KEY, JSON.stringify(this.db));
        this.render();
    },

    async saveAndBackup() {
        this.save();
        await sync.autoBackup('history');
    },

    addAction() {
        const a = {
            name: document.getElementById('name').value || '未命名',
            sets: parseInt(document.getElementById('sets').value) || 1,
            reps: parseInt(document.getElementById('reps').value) || 1,
            work: parseInt(document.getElementById('work').value) || 5,
            repRest: parseInt(document.getElementById('repRest').value) || 2,
            actionRest: parseInt(document.getElementById('actionRest').value) || 10,
            groupRest: parseInt(document.getElementById('groupRest').value) || 15,
            switchRest: 3,
            isAlt: document.getElementById('isAlt').checked
        };
        this.db.actions.push(a);
        this.save();
        document.getElementById('name').value = '';
    },

    saveRoutine() {
        const nameInput = document.getElementById('newRoutineName');
        const name = nameInput.value.trim();
        if (!name) return alert('请输入方案名称');
        if (this.db.actions.length === 0) return alert('请先添加训练动作');
        this.db.routines.push({
            name,
            actions: JSON.parse(JSON.stringify(this.db.actions)),
            created: new Date().toLocaleDateString()
        });
        nameInput.value = '';
        this.save();
        alert('方案 "' + name + '" 已保存');
    },

    loadRoutine(idx) {
        const r = this.db.routines[idx];
        if (!r) return;
        this.db.actions = JSON.parse(JSON.stringify(r.actions));
        this.save();
        ui.tab('workout', document.querySelector('.nav-item'));
    },

    deleteRoutine(idx) {
        this.db.routines.splice(idx, 1);
        this.save();
    },

    deleteHistory(idx) {
        this.db.history.splice(idx, 1);
        this.save();
    },

    shiftHistoryMonth(delta) {
        this.historyMonthOffset += delta;
        this.renderHistory();
    },

    render() {
        this.renderActions();
        this.renderRoutines();
        this.renderHistory();
    },

    renderActions() {
        const list = document.getElementById('currentActionList');
        if (!list) return;
        if (this.db.actions.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">playlist_add</span>
                    <p>还没有动作，添加一个开始吧</p>
                </div>`;
            return;
        }
        list.innerHTML = this.db.actions.map((a, i) => `
            <div class="list-item">
                <div class="sort-btns">
                    <button class="sort-btn" onclick="data.move(${i},-1)"><span class="material-symbols-rounded">expand_less</span></button>
                    <button class="sort-btn" onclick="data.move(${i},1)"><span class="material-symbols-rounded">expand_more</span></button>
                </div>
                <div style="flex:1;min-width:0">
                    <strong>${a.name}</strong>
                    <small>${a.sets}组 &middot; ${a.reps}次 &middot; ${a.work}s</small>
                    <div class="item-chip">组休${a.actionRest}s &middot; 项休${a.groupRest}s${a.isAlt ? ' &middot; 双侧' : ''}</div>
                </div>
                <button class="delete-btn" onclick="data.db.actions.splice(${i},1);data.save();"><span class="material-symbols-rounded">delete</span></button>
            </div>`).join('');
    },

    renderRoutines() {
        const list = document.getElementById('routineList');
        if (!list) return;
        if (this.db.routines.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">bookmark_border</span>
                    <p>暂无保存的方案</p>
                </div>`;
            return;
        }
        list.innerHTML = this.db.routines.map((r, i) => `
            <div class="list-item">
                <div style="flex:1;min-width:0">
                    <strong>${r.name}</strong>
                    <small>${r.actions.length}个动作 &middot; ${r.created}</small>
                </div>
                <button class="md-btn md-btn-tonal" style="flex:none;padding:0 14px;height:32px;font-size:12px" onclick="data.loadRoutine(${i})">载入</button>
                <button class="delete-btn" onclick="data.deleteRoutine(${i})"><span class="material-symbols-rounded">delete</span></button>
            </div>`).join('');
    },

    renderHistory() {
        const list = document.getElementById('historyList');
        if (!list) return;
        if (this.db.history.length === 0) {
            list.innerHTML = `
                ${this.renderHistoryCalendar()}
                <div class="empty-state">
                    <span class="material-symbols-rounded">event_note</span>
                    <p>暂无训练记录，完成一次训练后自动记录</p>
                </div>`;
            return;
        }
        list.innerHTML = `
            ${this.renderHistoryCalendar()}
            <div class="record-section-title">记录明细</div>
            ${this.db.history.map((h, i) => {
            const mins = Math.floor(h.duration / 60);
            const secs = h.duration % 60;
            const names = h.actions.map(a => a.name).join('、');
            return `<div class="list-item">
                <div style="flex:1;min-width:0">
                    <strong>${h.date}</strong>
                    <small>${mins}分${secs}秒 &middot; ${h.actions.length}个动作</small>
                    <div class="item-chip">${names.length > 20 ? names.slice(0, 20) + '...' : names}</div>
                </div>
                <button class="delete-btn" onclick="data.deleteHistory(${i})"><span class="material-symbols-rounded">delete</span></button>
            </div>`;
        }).join('')}`;
    },

    renderHistoryCalendar() {
        const view = new Date();
        view.setDate(1);
        view.setMonth(view.getMonth() + this.historyMonthOffset);
        const year = view.getFullYear();
        const month = view.getMonth();
        const first = new Date(year, month, 1);
        const days = new Date(year, month + 1, 0).getDate();
        const leading = (first.getDay() + 6) % 7;
        const byDate = this.groupHistoryByDate();
        const cells = [];
        for (let i = 0; i < leading; i++) cells.push('<div class="calendar-day empty"></div>');
        for (let day = 1; day <= days; day++) {
            const key = this.dateKey(new Date(year, month, day));
            const entries = byDate[key] || [];
            const names = this.uniqueActionNames(entries).slice(0, 3);
            const totalMin = Math.round(entries.reduce((sum, h) => sum + (h.duration || 0), 0) / 60);
            cells.push(`
                <div class="calendar-day ${entries.length ? 'has-record' : ''}">
                    <div class="calendar-day-head">
                        <span>${day}</span>
                        ${entries.length ? `<b>${totalMin}分</b>` : ''}
                    </div>
                    <div class="calendar-events">
                        ${names.map(name => `
                            <span class="calendar-event" style="--event-color:${this.actionColor(name)}">${this.shortName(name)}</span>
                        `).join('')}
                    </div>
                </div>`);
        }
        return `
            <div class="md-card calendar-card">
                <div class="calendar-toolbar">
                    <button class="icon-btn" onclick="data.shiftHistoryMonth(-1)" aria-label="上个月"><span class="material-symbols-rounded">chevron_left</span></button>
                    <strong>${year}年 ${month + 1}月</strong>
                    <button class="icon-btn" onclick="data.shiftHistoryMonth(1)" aria-label="下个月"><span class="material-symbols-rounded">chevron_right</span></button>
                </div>
                <div class="calendar-weekdays">
                    ${['一', '二', '三', '四', '五', '六', '日'].map(d => `<span>${d}</span>`).join('')}
                </div>
                <div class="calendar-grid">${cells.join('')}</div>
                ${this.renderHistoryLegend()}
            </div>`;
    },

    renderHistoryLegend() {
        const names = this.uniqueActionNames(this.db.history).slice(0, 6);
        if (names.length === 0) return '';
        return `
            <div class="calendar-legend">
                ${names.map(name => `<span><i style="background:${this.actionColor(name)}"></i>${name}</span>`).join('')}
            </div>`;
    },

    groupHistoryByDate() {
        return this.db.history.reduce((map, h) => {
            const key = this.dateKey(this.parseHistoryDate(h.date));
            if (!map[key]) map[key] = [];
            map[key].push(h);
            return map;
        }, {});
    },

    parseHistoryDate(value) {
        const direct = new Date(value);
        if (!Number.isNaN(direct.getTime())) return direct;
        const match = String(value || '').match(/(\d{4})[\/\-年.](\d{1,2})[\/\-月.](\d{1,2})/);
        if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        return new Date();
    },

    dateKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    uniqueActionNames(entries) {
        const set = new Set();
        entries.forEach(h => (h.actions || []).forEach(a => set.add(a.name || '未命名')));
        return [...set];
    },

    actionColor(name) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
        return this.historyColors[hash % this.historyColors.length];
    },

    shortName(name) {
        return name.length > 4 ? name.slice(0, 4) : name;
    },

    move(i, d) {
        if (i + d >= 0 && i + d < this.db.actions.length) {
            [this.db.actions[i], this.db.actions[i + d]] = [this.db.actions[i + d], this.db.actions[i]];
            this.save();
        }
    }
};
