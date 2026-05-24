// @ts-nocheck
(function () {
    if (window.weeklyPlan) return;

    const days = [
        ['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']
    ];

    function todayKey(date = new Date()) {
        return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()];
    }

    function esc(value) {
        return window.renderSafe?.escapeHtml ? window.renderSafe.escapeHtml(value) : String(value ?? '');
    }

    function ensure(db = window.data?.db) {
        if (!db) return {};
        db.weeklyPlan = db.weeklyPlan && typeof db.weeklyPlan === 'object' ? db.weeklyPlan : {};
        return db.weeklyPlan;
    }

    function routineFor(dayKey = todayKey()) {
        const id = ensure()[dayKey] || '';
        return (window.data?.activeRecords?.(data.db.routines || []) || []).find(r => r.id === id) || null;
    }

    function renderStrip() {
        const plan = ensure();
        const routines = window.data?.activeRecords?.(data.db.routines || []) || [];
        return `<div class="weekly-plan-strip">
            ${days.map(([key, label]) => {
                const routine = routines.find(r => r.id === plan[key]);
                return `<button class="weekly-plan-chip ${key === todayKey() ? 'is-today' : ''}" onclick="weeklyPlan.pickDay('${key}')" type="button">
                    <span>${label}</span><small>${esc(routine?.name || '未绑定')}</small>
                </button>`;
            }).join('')}
        </div>`;
    }

    function renderTodayBanner() {
        const routine = routineFor();
        if (!routine) {
            return `<div class="weekly-plan-banner is-empty">
                <span class="material-symbols-rounded">calendar_month</span>
                <strong>今天未配置方案</strong>
                <button class="md-btn md-btn-tonal" onclick="ui.tab('profile', document.querySelector('.nav-item:nth-child(5)'));data.setRoutineView?.('library')" type="button">去配置</button>
            </div>`;
        }
        return `<div class="weekly-plan-banner">
            <span class="material-symbols-rounded">today</span>
            <strong>今天计划：${esc(routine.name || '未命名方案')}</strong>
            <button class="md-btn md-btn-tonal" onclick="weeklyPlan.loadToday()" type="button">载入</button>
        </div>`;
    }

    function pickDay(dayKey) {
        const routines = window.data?.activeRecords?.(data.db.routines || []) || [];
        if (!routines.length) {
            window.toast?.show?.('方案库为空，先保存一个方案', 'info');
            return;
        }
        const body = `<div class="weekly-plan-picker">
            <button class="model-picker-row" type="button" data-weekly-routine=""><span class="material-symbols-rounded">block</span><span class="model-picker-main"><strong>清空绑定</strong><small>这一天不显示计划</small></span></button>
            ${routines.map(r => `<button class="model-picker-row" type="button" data-weekly-routine="${esc(r.id)}"><span class="material-symbols-rounded">bookmarks</span><span class="model-picker-main"><strong>${esc(r.name || '未命名方案')}</strong><small>${(r.actions || []).length} 个动作</small></span></button>`).join('')}
        </div>`;
        window.data?._openModal?.({
            title: '绑定周计划',
            icon: 'calendar_month',
            bodyHtml: body,
            actionsHtml: '<button class="md-btn" type="button" data-modal-close>取消</button>',
            onMount(root, close) {
                root.querySelectorAll('[data-weekly-routine]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        ensure()[dayKey] = btn.getAttribute('data-weekly-routine') || '';
                        data.save();
                        window.haptics?.light?.();
                        close();
                        data.renderRoutines?.();
                        data.renderWorkoutPlanCard?.();
                    });
                });
            }
        });
    }

    function loadToday() {
        const routine = routineFor();
        if (!routine) return;
        window.data?.loadRoutineById?.(routine.id);
        window.haptics?.light?.();
    }

    window.weeklyPlan = { ensure, todayKey, routineFor, renderStrip, renderTodayBanner, pickDay, loadToday };
})();
