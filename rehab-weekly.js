// @ts-nocheck
(function () {
    if (window.rehabWeekly) return;

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

    window.rehabWeekly = {
        selectedDate: '',

        range() {
            const start = dayStart();
            return Array.from({ length: 7 }, (_, index) => {
                const date = addDays(start, index);
                const key = data.dateKey(date);
                const plan = data.getDailyPlan?.(key);
                const rate = data.completionRate?.(plan) || { done: 0, total: 0, rate: 0 };
                return { date, key, plan, rate };
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
            const sheet = document.getElementById('rehabWeeklySheet');
            const body = document.getElementById('rehabWeeklySheetBody');
            if (!sheet || !body) return;
            this.selectedDate = this.selectedDate || data.logicalDateKey?.() || data.dateKey(new Date());
            body.innerHTML = this.render();
            this.bindDrag(body);
            sheet.classList.remove('hidden');
            sheet.setAttribute('aria-hidden', 'false');
            window.navStack?.push?.({
                type: 'modal',
                id: 'rehabWeeklySheet',
                close: () => this.close()
            });
        },

        close() {
            const sheet = document.getElementById('rehabWeeklySheet');
            sheet?.classList.add('hidden');
            sheet?.setAttribute('aria-hidden', 'true');
            return true;
        },

        select(dateKey) {
            this.selectedDate = dateKey;
            const body = document.getElementById('rehabWeeklySheetBody');
            if (body) {
                body.innerHTML = this.render();
                this.bindDrag(body);
            }
        },

        bindDrag(root) {
            if (!root || root.dataset.rehabWeeklyDragBound === '1') return;
            root.dataset.rehabWeeklyDragBound = '1';
            let timer = 0;
            let drag = null;
            const clearTimer = () => {
                clearTimeout(timer);
                timer = 0;
            };
            const reset = () => {
                clearTimer();
                document.querySelectorAll('.rehab-weekly-day.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
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
                drag.ghost.className = 'rehab-weekly-drag-ghost';
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
                document.querySelectorAll('.rehab-weekly-day.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
                const target = document.elementFromPoint(point.clientX, point.clientY)?.closest?.('[data-rehab-weekly-date]');
                target?.classList.add('is-drop-target');
                event.preventDefault?.();
            };
            const finishDrag = (event) => {
                if (!drag) return reset();
                const point = event.changedTouches?.[0] || event;
                const target = document.elementFromPoint(point.clientX, point.clientY)?.closest?.('[data-rehab-weekly-date]');
                const targetDate = target?.getAttribute('data-rehab-weekly-date') || '';
                const shouldMove = targetDate && targetDate !== drag.startDate;
                const planId = drag.planId;
                const taskId = drag.taskId;
                reset();
                if (shouldMove) {
                    data.moveTask?.(planId, taskId, targetDate);
                    this.selectedDate = targetDate;
                    const body = document.getElementById('rehabWeeklySheetBody');
                    if (body) {
                        body.innerHTML = this.render();
                        this.bindDrag(body);
                    }
                    data.render?.('today');
                    window.toast?.show?.('已移动到目标日期', 'success');
                    window.haptics?.success?.();
                }
            };
            root.addEventListener('pointerdown', (event) => {
                const row = event.target?.closest?.('.rehab-weekly-task');
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

        render() {
            const list = this.range();
            const selected = this.selectedDate || list[0]?.key || '';
            return `<div class="rehab-weekly-sheet">
                <div class="rehab-weekly-list">
                    ${list.map((item) => `
                        <button class="rehab-weekly-day ${selected === item.key ? 'active' : ''}" type="button" onclick="rehabWeekly.select('${item.key}')" data-rehab-weekly-date="${item.key}">
                            <div>
                                <strong>${item.date.toLocaleDateString('zh-CN', { weekday: 'long', month: 'numeric', day: 'numeric' })}</strong>
                                <small>${item.rate.done}/${item.rate.total || 0} 完成</small>
                            </div>
                            <span class="material-symbols-rounded">${item.rate.total && item.rate.done < item.rate.total ? 'warning' : 'check_circle'}</span>
                        </button>
                    `).join('')}
                </div>
                <div class="rehab-weekly-detail">
                    ${(() => {
                        const entry = list.find((item) => item.key === selected) || list[0];
                        const plan = entry?.plan;
                        if (!plan) return '<div class="empty-state"><span class="material-symbols-rounded">event_note</span><p>当天还没有康复计划</p></div>';
                        return (plan.items || []).filter((item) => !item.deleted).map((item) => `
                            <div class="rehab-weekly-task" data-plan-id="${plan.id}" data-task-id="${item.id}" data-date="${plan.date}">
                                <button class="rehab-weekly-task-main" type="button" onclick="data.handleRehabTaskTap('${plan.id}','${item.id}')">
                                    <strong>${data.escapeHtml(item.name || '未命名任务')}</strong>
                                    <small>${item.status === 'done' ? '已完成' : item.status === 'skipped' ? '已跳过' : '待执行'}</small>
                                </button>
                                <button class="md-icon-btn" type="button" onclick="data.openRehabTaskMenu('${plan.id}','${item.id}')"><span class="material-symbols-rounded">more_vert</span></button>
                            </div>
                        `).join('');
                    })()}
                </div>
                <div class="md-row modal-actions">
                    <button class="md-btn" type="button" data-modal-close onclick="rehabWeekly.close()">关闭</button>
                    <button class="md-btn md-btn-tonal" type="button" onclick="data.openRehabAiSheet('week')">+ AI 重排剩余天</button>
                </div>
            </div>`;
        }
    };
})();
