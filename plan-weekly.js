// @ts-nocheck
(function () {
    if (window.planWeekly) return;

    function dayStart(date = new Date()) {
        const copy = new Date(date);
        const offset = (copy.getDay() + 6) % 7;
        copy.setHours(0, 0, 0, 0);
        copy.setDate(copy.getDate() - offset);
        return copy;
    }

    function addDays(date, delta) {
        const copy = new Date(date);
        copy.setDate(copy.getDate() + delta);
        return copy;
    }

    function statusMeta(item = {}) {
        if (item.status === 'done') return { label: '已完成', icon: 'check_circle', className: 'is-done' };
        if (item.status === 'skipped') return { label: '已跳过', icon: 'remove_circle', className: 'is-skipped' };
        if (item.status === 'in-progress') return { label: '进行中', icon: 'play_circle', className: 'is-current' };
        return { label: '待执行', icon: 'radio_button_unchecked', className: 'is-todo' };
    }

    window.planWeekly = {
        selectedDate: '',

        range() {
            const start = dayStart();
            return Array.from({ length: 7 }, (_, index) => {
                const date = addDays(start, index);
                const key = data.dateKey(date);
                const plans = data.getDailyPlans?.(key) || [];
                const rate = data.aggregateCompletionRate?.(plans) || { done: 0, total: 0, rate: 0 };
                return { date, key, plans, plan: plans[0] || null, rate };
            });
        },

        summary() {
            const items = this.range();
            const done = items.reduce((sum, item) => sum + Number(item.rate.done || 0), 0);
            const total = items.reduce((sum, item) => sum + Number(item.rate.total || 0), 0);
            const missed = items.reduce((sum, item) => sum + Math.max(0, Number(item.rate.total || 0) - Number(item.rate.done || 0)), 0);
            return { done, total, missed };
        },

        open() {
            const sheet = document.getElementById('planWeeklySheet');
            const body = document.getElementById('planWeeklySheetBody');
            if (!sheet || !body) return;
            this.selectedDate = this.selectedDate || data.logicalDateKey?.() || data.dateKey(new Date());
            body.innerHTML = this.render();
            this.bindDrag(body);
            this.bindActions(body);
            sheet.classList.remove('hidden');
            sheet.setAttribute('aria-hidden', 'false');
            window.navStack?.push?.({
                type: 'modal',
                id: 'planWeeklySheet',
                close: () => this.close()
            });
        },

        close() {
            const sheet = document.getElementById('planWeeklySheet');
            sheet?.classList.add('hidden');
            sheet?.setAttribute('aria-hidden', 'true');
            return true;
        },

        select(dateKey) {
            this.selectedDate = dateKey;
            const body = document.getElementById('planWeeklySheetBody');
            if (body) {
                body.innerHTML = this.render();
                this.bindDrag(body);
                this.bindActions(body);
            }
        },

        bindDrag(root) {
            if (!root || root.dataset.planWeeklyDragBound === '1') return;
            root.dataset.planWeeklyDragBound = '1';
            let timer = 0;
            let drag = null;
            const clearTimer = () => {
                clearTimeout(timer);
                timer = 0;
            };
            const reset = () => {
                clearTimer();
                document.querySelectorAll('.plan-weekly-day.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
                if (drag?.row) drag.row.classList.remove('is-dragging');
                if (drag?.ghost) drag.ghost.remove();
                drag = null;
            };
            const startDrag = (row, event) => {
                const point = event.touches?.[0] || event;
                drag = {
                    row,
                    planId: row.getAttribute('data-plan-id') || '',
                    taskId: row.getAttribute('data-task-id') || '',
                    startDate: row.getAttribute('data-date') || '',
                    pointerId: event.pointerId,
                    ghost: row.cloneNode(true)
                };
                row.classList.add('is-dragging');
                drag.ghost.className = 'plan-weekly-drag-ghost';
                drag.ghost.style.left = `${point.clientX}px`;
                drag.ghost.style.top = `${point.clientY}px`;
                document.body.appendChild(drag.ghost);
                window.haptics?.medium?.();
            };
            const moveDrag = (event) => {
                if (!drag) return;
                const point = event.touches?.[0] || event;
                if (drag.ghost) {
                    drag.ghost.style.left = `${point.clientX}px`;
                    drag.ghost.style.top = `${point.clientY}px`;
                }
                document.querySelectorAll('.plan-weekly-day.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
                const target = document.elementFromPoint(point.clientX, point.clientY)?.closest?.('[data-plan-weekly-date]');
                target?.classList.add('is-drop-target');
                event.preventDefault?.();
            };
            const finishDrag = (event) => {
                if (!drag) return reset();
                const point = event.changedTouches?.[0] || event;
                const target = document.elementFromPoint(point.clientX, point.clientY)?.closest?.('[data-plan-weekly-date]');
                const targetDate = target?.getAttribute('data-plan-weekly-date') || '';
                const shouldMove = targetDate && targetDate !== drag.startDate;
                const planId = drag.planId;
                const taskId = drag.taskId;
                reset();
                if (shouldMove) {
                    data.moveTask?.(planId, taskId, targetDate);
                    this.selectedDate = targetDate;
                    const body = document.getElementById('planWeeklySheetBody');
                    if (body) {
                        body.innerHTML = this.render();
                        this.bindDrag(body);
                        this.bindActions(body);
                    }
                    data.render?.('today');
                    window.toast?.show?.('已移动到目标日期', 'success');
                    window.haptics?.success?.();
                }
            };
            root.addEventListener('pointerdown', (event) => {
                const row = event.target?.closest?.('.plan-weekly-task');
                if (!row || event.target?.closest?.('button.md-icon-btn')) return;
                clearTimer();
                timer = setTimeout(() => startDrag(row, event), 450);
            }, { passive: true });
            root.addEventListener('pointermove', (event) => {
                if (drag) moveDrag(event);
            }, { passive: false });
            root.addEventListener('pointerup', finishDrag, { passive: true });
            root.addEventListener('pointercancel', reset, { passive: true });
            root.addEventListener('pointerleave', () => clearTimer(), { passive: true });
        },

        bindActions(root) {
            if (!root || root.dataset.planWeeklyActionsBound === '1') return;
            root.dataset.planWeeklyActionsBound = '1';
            root.addEventListener('click', (event) => {
                const btn = event.target?.closest?.('[data-plan-weekly-action]');
                if (!btn || !root.contains(btn)) return;
                const action = btn.getAttribute('data-plan-weekly-action') || '';
                const planId = btn.getAttribute('data-plan-id') || '';
                const taskId = btn.getAttribute('data-task-id') || '';

                event.preventDefault();
                if (action === 'task-tap') data.handlePlanTaskTap?.(planId, taskId);
                else if (action === 'task-menu') data.openPlanTaskMenu?.(planId, taskId);
            });
        },

        render() {
            const list = this.range();
            const selected = this.selectedDate || list[0]?.key || '';
            return `<div class="plan-weekly-sheet">
                <div class="plan-weekly-list">
                    ${list.map((item) => {
                        const percent = Math.round((item.rate.rate || 0) * 100);
                        return `
                        <button class="plan-weekly-day ${selected === item.key ? 'active' : ''} ${item.rate.missed ? 'has-alert' : ''}" type="button" onclick="planWeekly.select('${item.key}')" data-plan-weekly-date="${item.key}">
                            <div>
                                <strong>${item.date.toLocaleDateString('zh-CN', { weekday: 'long', month: 'numeric', day: 'numeric' })}</strong>
                                <small>${item.rate.done}/${item.rate.total || 0} 完成</small>
                            </div>
                            <span class="plan-weekly-day-progress"><i style="width:${percent}%"></i></span>
                            <span class="material-symbols-rounded">${item.rate.total && item.rate.done < item.rate.total ? 'warning' : 'check_circle'}</span>
                        </button>
                    `; }).join('')}
                </div>
                <div class="plan-weekly-detail">
                    ${(() => {
                        const entry = list.find((item) => item.key === selected) || list[0];
                        const plans = entry?.plans || [];
                        if (!plans.length) return '<div class="empty-state"><span class="material-symbols-rounded">event_note</span><p>当天还没有训练计划</p></div>';
                        return plans.flatMap((plan) => (plan.items || []).filter((item) => !item.deleted).map((item) => `
                            ${(() => {
                                const meta = statusMeta(item);
                                const planId = data.escapeHtml(plan.id || '');
                                const taskId = data.escapeHtml(item.id || '');
                                return `<div class="plan-weekly-task ${meta.className}" data-plan-id="${planId}" data-task-id="${taskId}" data-date="${data.escapeHtml(plan.date || '')}">
                                <button class="plan-weekly-task-main" type="button" data-plan-weekly-action="task-tap" data-plan-id="${planId}" data-task-id="${taskId}">
                                    <span class="material-symbols-rounded">${meta.icon}</span>
                                    <strong>${data.escapeHtml(item.name || '未命名任务')}</strong>
                                    <small>${meta.label}</small>
                                </button>
                                <button class="md-icon-btn" type="button" data-plan-weekly-action="task-menu" data-plan-id="${planId}" data-task-id="${taskId}"><span class="material-symbols-rounded">more_vert</span></button>
                            </div>`;
                            })()}
                        `)).join('');
                    })()}
                </div>
                <div class="md-row modal-actions">
                    <button class="md-btn" type="button" data-modal-close onclick="planWeekly.close()">关闭</button>
                    <button class="md-btn md-btn-tonal" type="button" onclick="data.openPlanAiSheet('week')">+ AI 重排剩余天</button>
                </div>
            </div>`;
        }
    };
})();
