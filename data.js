const data = {
    DB_KEY: 'rehab_pro_universal_db',
    CFG_KEY: 'rehab_pro_universal_cfg',
    db: { actions: [], routines: [], history: [], rate: 1.1 },
    cfg: { mode: 'none', s3: {}, dav: {} },

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
    },

    saveRoutine() {
        const nameInput = document.getElementById('newRoutineName');
        const name = nameInput.value.trim();
        if (!name) return alert('请输入方案名称');
        if (this.db.actions.length === 0) return alert('请先添加训练动作');
        this.db.routines.push({ name, actions: JSON.parse(JSON.stringify(this.db.actions)), created: new Date().toLocaleDateString() });
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

    render() {
        this.renderActions();
        this.renderRoutines();
        this.renderHistory();
    },

    renderActions() {
        const list = document.getElementById('currentActionList');
        if (!list) return;
        list.innerHTML = this.db.actions.map((a, i) => `
            <div class="list-item">
                <div style="flex:1"><strong>${a.name}</strong><br><small>${a.sets}组 | ${a.reps}次 | ${a.work}s | 组休${a.actionRest}s | 项休${a.groupRest}s</small></div>
                <div style="display:flex; flex-direction:column">
                    <button onclick="data.move(${i},-1)" style="border:none;background:none"><span class="material-symbols-rounded">expand_less</span></button>
                    <button onclick="data.move(${i},1)" style="border:none;background:none"><span class="material-symbols-rounded">expand_more</span></button>
                </div>
                <button onclick="data.db.actions.splice(${i},1);data.save();" style="border:none;background:none;color:red"><span class="material-symbols-rounded">delete</span></button>
            </div>`).join('');
    },

    renderRoutines() {
        const list = document.getElementById('routineList');
        if (!list) return;
        if (this.db.routines.length === 0) {
            list.innerHTML = '<div class="md-card" style="text-align:center;color:#73777f">暂无保存的方案</div>';
            return;
        }
        list.innerHTML = this.db.routines.map((r, i) => `
            <div class="list-item">
                <div style="flex:1"><strong>${r.name}</strong><br><small>${r.actions.length}个动作 | ${r.created}</small></div>
                <button class="md-btn md-btn-tonal" style="flex:none;padding:0 12px;height:32px" onclick="data.loadRoutine(${i})">载入</button>
                <button onclick="data.deleteRoutine(${i})" style="border:none;background:none;color:red"><span class="material-symbols-rounded">delete</span></button>
            </div>`).join('');
    },

    renderHistory() {
        const list = document.getElementById('historyList');
        if (!list) return;
        if (this.db.history.length === 0) {
            list.innerHTML = '<div class="md-card" style="text-align:center;color:#73777f">暂无训练记录</div>';
            return;
        }
        list.innerHTML = this.db.history.map((h, i) => {
            const mins = Math.floor(h.duration / 60);
            const secs = h.duration % 60;
            const names = h.actions.map(a => a.name).join('、');
            return `<div class="list-item">
                <div style="flex:1"><strong>${h.date}</strong><br><small>${mins}分${secs}秒 | ${names}</small></div>
                <button onclick="data.deleteHistory(${i})" style="border:none;background:none;color:red"><span class="material-symbols-rounded">delete</span></button>
            </div>`;
        }).join('');
    },

    move(i, d) {
        if (i + d >= 0 && i + d < this.db.actions.length) {
            [this.db.actions[i], this.db.actions[i + d]] = [this.db.actions[i + d], this.db.actions[i]];
            this.save();
        }
    }
};
