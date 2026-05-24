// @ts-nocheck
(function () {
    if (window.rehabDock) return;

    function host() {
        let el = document.getElementById('rehabDockHost');
        if (!el) {
            el = document.createElement('div');
            el.id = 'rehabDockHost';
            document.body.appendChild(el);
        }
        return el;
    }

    window.rehabDock = {
        hiddenUntil: 0,

        render(pageId = document.querySelector('.page.active')?.id || 'today') {
            const prefs = data.ensureRehabPrefs?.() || {};
            const root = host();
            if (!['today', 'workout'].includes(pageId) || (!prefs.showCooldownDock && !prefs.showWeeklyDock)) {
                root.innerHTML = '';
                return;
            }
            const hiddenUntil = Number(sessionStorage.getItem('rehabDockHiddenUntil') || 0);
            if (hiddenUntil > Date.now()) {
                root.innerHTML = '';
                return;
            }
            const plan = data.getTodayDailyPlan?.();
            const pending = Math.min(8, Number(plan?.pendingCooldowns?.length || 0));
            const pendingLabel = Number(plan?.pendingCooldowns?.length || 0) > 8 ? '8+' : String(pending);
            const week = window.rehabWeekly?.summary?.() || { done: 0, total: 0, missed: 0 };
            const isTraining = !!window.workout?.isPlaying;
            root.innerHTML = `<div class="rehab-dock ${isTraining ? 'is-compact' : ''}" id="rehabDock">
                ${(prefs.showCooldownDock && pending > 0) ? `<button class="md-chip rehab-dock-chip" type="button" onclick="data.openPendingCooldownSheet()"><span class="material-symbols-rounded">self_improvement</span>待拉伸 ${pendingLabel}</button>` : ''}
                ${(!isTraining && prefs.showWeeklyDock) ? `<button class="md-chip rehab-dock-chip ${week.missed ? 'has-alert' : ''}" type="button" onclick="rehabWeekly.open()"><span class="material-symbols-rounded">calendar_month</span>本周 ${week.done}/${week.total || 0}</button>` : ''}
                ${!isTraining ? `<button class="md-chip rehab-dock-chip" type="button" onclick="data.openRehabAiSheet('today')"><span class="material-symbols-rounded">auto_awesome</span>AI</button>` : ''}
            </div>`;
            const dock = document.getElementById('rehabDock');
            if (!dock || dock.dataset.bound === '1') return;
            dock.dataset.bound = '1';
            let startX = 0;
            dock.addEventListener('touchstart', (event) => {
                startX = Number(event.touches?.[0]?.clientX || 0);
            }, { passive: true });
            dock.addEventListener('touchend', (event) => {
                const endX = Number(event.changedTouches?.[0]?.clientX || 0);
                if (startX - endX > 48) {
                    sessionStorage.setItem('rehabDockHiddenUntil', String(Date.now() + 5 * 60 * 1000));
                    this.render(pageId);
                }
            }, { passive: true });
        }
    };

    window.dataRehabUi = window.dataRehabUi || {};
    window.dataRehabUi.renderRehabDock = function (pageId) {
        return window.rehabDock.render(pageId);
    };
})();
