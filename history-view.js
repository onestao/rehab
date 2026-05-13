(function () {
    window.dataHistoryView = {
        deleteHistory(id) {
            this.softDeleteById(this.db.history, id);
            this.save();
        },

        renderHistory() {
            this.renderTodayPage();
            this.renderRecordsPage();
            this.renderProfilePage();
        },

        renderRecordOverview() {
            const today = this.logicalDateKey();
            const weight = this.activeRecords(this.db.health.weights || []).find(w => w.date === today) || this.sortedWeights().slice(-1)[0];
            const intake = this.todayCalories();
            const exerciseCal = this.todayTrainingCalories();
            const macros = this.todayMacros();
            const goalCal = this.db.health.dietGoal?.dailyCal || 0;
            const goals = this.defaultDietGoals();
            const progress = goalCal ? Math.min(100, Math.round((intake / goalCal) * 100)) : 0;
            const remaining = goalCal ? goalCal - intake : 0;
            const macroStops = {
                pro: Math.min(120, this.ratio(macros.pro, goals.pro) * 1.2),
                carb: 120 + Math.min(120, this.ratio(macros.carb, goals.carb) * 1.2),
                fat: 240 + Math.min(120, this.ratio(macros.fat, goals.fat) * 1.2)
            };
            const remainingText = goalCal ? (remaining >= 0 ? `剩余${remaining}kcal` : `超出${Math.abs(remaining)}kcal`) : '';
            const monthNum = Number(today.slice(5, 7));
            const dayNum = Number(today.slice(8, 10));
            const weekdays = ['周日','周一','周二','周三','周四','周五','周六'];
            const weekday = weekdays[this.dateFromKey(today).getDay()];
            let status = '', hint = '';
            if (goalCal) {
                if (remaining >= 500) { status = '空间充足'; hint = '还可摄入约 ' + remaining + ' kcal，优先补蛋白和蔬菜'; }
                else if (remaining >= 150) { status = '节奏良好'; hint = '还可摄入约 ' + remaining + ' kcal，晚餐建议清淡均衡'; }
                else if (remaining >= 0) { status = '接近目标'; hint = '已接近目标，控制油脂和零食'; }
                else { status = '已超出目标'; hint = '已超出 ' + Math.abs(remaining) + ' kcal，可增加散步或低强度活动'; }
            }
            return `<div class="md-card hero-card record-overview-card">
            <div class="record-overview-top">
                <div class="record-overview-date">
                    <span class="hero-kicker">今日总览</span>
                    <h3>${monthNum}月${dayNum}日 ${weekday}</h3>
                    ${weight ? `<p>体重 ${weight.weight.toFixed(1)} kg</p>` : ''}
                </div>
                ${goalCal ? `<div class="today-focus-ring macro-focus-ring" style="--progress:${progress};--pro-stop:${macroStops.pro}deg;--carb-stop:${macroStops.carb}deg;--fat-stop:${macroStops.fat}deg"><div><b>${progress}%</b><small>摄入</small><em>${remainingText}</em></div></div>` : ''}
            </div>
            <div class="record-overview-stats">
                <div class="record-overview-stat"><b>${intake}${goalCal ? `/${goalCal}` : ''}</b><small>摄入 kcal</small></div>
                <div class="record-overview-stat"><b>${exerciseCal}</b><small>消耗 kcal</small></div>
                <div class="record-overview-stat"><b>${macros.pro.toFixed(0)}/${goals.pro}</b><small>蛋白 g</small></div>
            </div>
            ${goalCal ? `<div class="today-focus-hint"><b>${status}</b><p>${hint}</p></div>` : ''}
        </div>`;
        },

        renderRecordQuickActions() {
            const aiPrompt = this.isGainMode()
                ? '请以增肌目标为前提，分析我今天的饮食、训练和体重记录，并给出今晚或明天的调整建议'
                : '请分析我今天的饮食、训练和体重记录，并给出今晚或明天的调整建议';
            return `<div class="record-quick-actions">
            <button class="record-quick-btn" onclick="data.openDietModal()"><span class="material-symbols-rounded">restaurant</span><span>记饮食</span></button>
            <button class="record-quick-btn" onclick="data.openExerciseModal()"><span class="material-symbols-rounded">fitness_center</span><span>记运动</span></button>
            <button class="record-quick-btn" onclick="data.openWeightModal()"><span class="material-symbols-rounded">monitor_weight</span><span>记体重</span></button>
            <button class="record-quick-btn record-quick-btn-ai" onclick="data.askContextAi('today','${aiPrompt}')"><span class="material-symbols-rounded">psychology</span><span>问 AI</span></button>
        </div>`;
        },

        renderTodayTimeline() {
            const today = this.logicalDateKey();
            const entries = this.activeRecords(this.db.history).filter(h => this.historyDayKey(h) === today);
            const foods = this.activeRecords(this.db.health.foodLogs || []).filter(f => f.date === today);
            const exercises = this.activeRecords(this.db.health.exerciseLogs || []).filter(e => e.date === today);
            const weight = this.activeRecords(this.db.health.weights || []).find(w => w.date === today);
            const items = [];
            const mealGroups = { breakfast: [], lunch: [], dinner: [], snack: [] };
            foods.forEach(f => (mealGroups[f.meal] || mealGroups.snack).push(f));
            const mealOrder = { breakfast: 1, lunch: 2, dinner: 3, snack: 4 };
            const mealNames = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
            Object.entries(mealGroups).forEach(([meal, list]) => {
                if (!list.length) return;
                const totalCal = list.reduce((s, f) => s + Number(f.cal || 0), 0);
                const totalPro = list.reduce((s, f) => s + Number(f.pro || 0), 0);
                const totalCarb = list.reduce((s, f) => s + Number(f.carb || 0), 0);
                const totalFat = list.reduce((s, f) => s + Number(f.fat || 0), 0);
                const names = list.map(f => f.name).slice(0, 3).join('、') + (list.length > 3 ? '等' + list.length + '项' : '');
                items.push({ order: mealOrder[meal] || 5, sk: list[0]?.createdAt || '', icon: 'restaurant', label: mealNames[meal] || '加餐', detail: totalCal + ' kcal', meta: 'P' + totalPro.toFixed(0) + ' C' + totalCarb.toFixed(0) + ' F' + totalFat.toFixed(0) + ' · ' + list.length + '项', sub: names, type: 'diet' });
            });
            entries.forEach(h => {
                const mins = Math.floor(h.duration / 60), secs = h.duration % 60;
                const names = this.historyNames(h).join('、');
                const cal = Math.round(h.cardio?.calories || 0);
                items.push({ order: 5, sk: h.date || '', icon: this.historyIcon(h), label: names || '训练', detail: mins+'分'+secs+'秒', meta: cal ? cal+' kcal' : (h.actions?.length||0)+' 个动作', type: 'training' });
            });
            exercises.forEach(e => {
                items.push({ order: 6, sk: e.createdAt || '', icon: this.sportIcon(this.exerciseLabel(e.type, e)), label: this.exerciseLabel(e.type, e), detail: e.minutes+' 分钟', meta: e.calories ? e.calories+' kcal' : '', type: 'exercise' });
            });
            if (weight) items.push({ order: 0, sk: '0', icon: 'monitor_weight', label: '体重记录', detail: weight.weight.toFixed(1)+' kg', meta: weight.note || '', type: 'weight' });
            if (!items.length) return '<div class="md-card today-timeline-empty"><div class="empty-state" style="padding:24px 16px"><span class="material-symbols-rounded">timeline</span><p>今天还没有记录，使用上方快捷按钮开始记录</p></div></div>';
            items.sort((a, b) => a.order - b.order || String(a.sk).localeCompare(String(b.sk)));
            return '<div class="md-card today-timeline-card"><div class="today-timeline-header"><span class="material-symbols-rounded">timeline</span><strong>今日时间线</strong><small>' + items.length + ' 条</small></div><div class="today-timeline-list">' + items.map(it => '<div class="today-timeline-item today-timeline-' + it.type + '"><span class="today-timeline-icon material-symbols-rounded">' + it.icon + '</span><div class="today-timeline-body"><div class="today-timeline-main"><strong>' + it.label + '</strong><span>' + it.detail + '</span></div>' + (it.meta ? '<small>' + it.meta + '</small>' : '') + (it.sub ? '<span class="today-timeline-sub">' + it.sub + '</span>' : '') + '</div></div>').join('') + '</div></div>';
        },

        renderRecentHistoryList(limit = 5) {
            const liveHistory = this.activeRecords(this.db.history);
            if (!liveHistory.length) return '<div class="empty-state"><span class="material-symbols-rounded">event_note</span><p>暂无训练记录</p></div>';
            const sorted = [...liveHistory].sort((a, b) => this.parseHistoryDate(b.date) - this.parseHistoryDate(a.date)).slice(0, limit);
            return '<div class="recent-history-list">' + sorted.map(h => {
                const mins = Math.floor(h.duration / 60), secs = h.duration % 60;
                const names = this.historyNames(h).join('、');
                const meta = h.type === 'cardio' ? Math.round(h.cardio.calories||0)+' kcal' : h.actions.length+'个动作';
                return '<div class="list-item"><span class="record-icon material-symbols-rounded">' + this.historyIcon(h) + '</span><div style="flex:1;min-width:0"><strong>' + h.date + '</strong><small>' + mins + '分' + secs + '秒 · ' + meta + '</small><div class="item-chip">' + (names.length > 20 ? names.slice(0, 20) + '...' : names) + '</div></div><button class="delete-btn" onclick="data.deleteHistory(\'' + h.id + '\')"><span class="material-symbols-rounded">delete</span></button></div>';
            }).join('') + (liveHistory.length > limit ? '<button class="md-btn md-btn-tonal" style="margin:8px auto;display:flex" onclick="data.setRecordView(\'calendar\')"><span class="material-symbols-rounded">calendar_month</span> 查看全部记录</button>' : '') + '</div>';
        },

        renderHistoryList() {
            const liveHistory = this.activeRecords(this.db.history);
            if (liveHistory.length === 0) {
                return `<div class="empty-state"><span class="material-symbols-rounded">event_note</span><p>暂无训练记录，完成一次训练后自动记录</p></div>`;
            }
            const groups = {};
            liveHistory.forEach((h, i) => {
                const d = this.parseHistoryDate(h.date);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push({ h, i });
            });
            const currentMonth = this.logicalDateKey().slice(0, 7);
            return Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(key => {
                const [y, m] = key.split('-');
                const items = groups[key];
                const totalMin = Math.round(items.reduce((s, { h }) => s + (h.duration || 0), 0) / 60);
                const collapsed = this.isCollapsed(`history_month_${key}`, key !== currentMonth);
                return `<section class="history-month-group ${collapsed ? 'collapsed' : ''}">
                <button class="history-month-head" onclick="data.toggleCollapse('history_month_${key}')" type="button">
                    <span class="material-symbols-rounded">calendar_month</span>
                    <strong>${y}年${Number(m)}月</strong>
                    <small>${items.length} 次 · ${totalMin} 分钟</small>
                    <span class="material-symbols-rounded">${collapsed ? 'expand_more' : 'expand_less'}</span>
                </button>
                <div class="history-month-content">
                    ${(() => {
                        const sorted = [...items].sort((a, b) => {
                            const da = this.parseHistoryDate(a.h.date);
                            const db2 = this.parseHistoryDate(b.h.date);
                            return db2 - da || b.i - a.i;
                        });
                        const recentItems = sorted.slice(0, 3);
                        const olderItems = sorted.slice(3);
                        const olderCollapsed = this.isCollapsed(`history_month_older_${key}`, true);
                        const renderOne = ({ h, i }) => {
                            const mins = Math.floor(h.duration / 60);
                            const secs = h.duration % 60;
                            const names = this.historyNames(h).join('、');
                            const meta = h.type === 'cardio'
                                ? `${Math.round(h.cardio.calories || 0)} kcal &middot; ${h.cardio.weight || 0}kg`
                                : `${h.actions.length}个动作`;
                            const icon = this.historyIcon(h);
                            return `<div class="list-item">
                                <span class="record-icon material-symbols-rounded">${icon}</span>
                                <div style="flex:1;min-width:0">
                                    <strong>${h.date}</strong>
                                    <small>${mins}分${secs}秒 &middot; ${meta}</small>
                                    <div class="item-chip">${names.length > 20 ? names.slice(0, 20) + '...' : names}</div>
                                </div>
                                <button class="delete-btn" onclick="data.deleteHistory('${h.id}')"><span class="material-symbols-rounded">delete</span></button>
                            </div>`;
                        };
                        let html = recentItems.map(renderOne).join('');
                        if (olderItems.length > 0) {
                            html += `<div class="history-older-group ${olderCollapsed ? 'collapsed' : ''}">
                                <button class="history-older-head" onclick="data.toggleCollapse('history_month_older_${key}')" type="button">
                                    <span class="material-symbols-rounded">expand_more</span>
                                    <small>还有 ${olderItems.length} 条更早记录</small>
                                </button>
                                <div class="history-older-content">
                                    ${olderItems.map(renderOne).join('')}
                                </div>
                            </div>`;
                        }
                        return html;
                    })()}
                </div>
            </section>`;
            }).join('');
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
            const byDate = this.groupCalendarActivitiesByDate();
            const cells = [];
            for (let i = 0; i < leading; i++) cells.push('<div class="calendar-day empty"></div>');
            for (let day = 1; day <= days; day++) {
                const key = this.dateKey(new Date(year, month, day));
                const entries = byDate[key] || [];
                const names = entries.map(e => e.name).filter(Boolean).slice(0, 3);
                const totalMin = Math.round(entries.reduce((sum, e) => sum + (e.minutes || 0), 0));
                const isSelected = this.selectedCalendarDate === key;
                cells.push(`
                <div class="calendar-day ${entries.length ? 'has-record' : ''} ${isSelected ? 'selected' : ''}" onclick="data.selectCalendarDate('${key}')">
                    <div class="calendar-day-head">
                        <span>${day}</span>
                        ${entries.length ? `<b>${totalMin}分</b>` : ''}
                    </div>
                    <div class="calendar-events">
                        ${names.map(name => `
                            <span class="calendar-event" style="--event-color:${this.actionColor(name)}"><span class="material-symbols-rounded">${this.sportIcon(name)}</span>${this.shortName(name)}</span>
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
            const names = [...new Set(Object.values(this.groupCalendarActivitiesByDate()).flat().map(e => e.name))].slice(0, 6);
            if (names.length === 0) return '';
            return `
            <div class="calendar-legend">
                ${names.map(name => `<span><i style="background:${this.actionColor(name)}"></i>${name}</span>`).join('')}
            </div>`;
        },

        renderCalendarDayDetail() {
            if (!this.selectedCalendarDate) return '';
            const date = this.selectedCalendarDate;
            const entries = this.activeRecords(this.db.history).filter(h => this.historyDayKey(h) === date);
            const foods = this.activeRecords(this.db.health.foodLogs || []).filter(f => f.date === date);
            const manualExercises = this.activeRecords(this.db.health.exerciseLogs || []).filter(e => e.date === date);
            const weight = this.activeRecords(this.db.health.weights || []).find(w => w.date === date);
            const totalMin = Math.round(entries.reduce((s, h) => s + (h.duration || 0), 0) / 60 + manualExercises.reduce((s, e) => s + (e.minutes || 0), 0));
            const totalCal = Math.round(entries.reduce((s, h) => s + (h.cardio?.calories || 0), 0) + manualExercises.reduce((s, e) => s + (e.calories || 0), 0));
            const foodCal = foods.reduce((s, f) => s + (f.cal || 0), 0);
            const foodPro = foods.reduce((s, f) => s + Number(f.pro || 0), 0);
            const foodCarb = foods.reduce((s, f) => s + Number(f.carb || 0), 0);
            const foodFat = foods.reduce((s, f) => s + Number(f.fat || 0), 0);
            const mealNames = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
            if (entries.length === 0 && foods.length === 0 && manualExercises.length === 0 && !weight) {
                return `<div class="md-card day-detail-card">
                <div class="day-detail-head"><span class="material-symbols-rounded">event</span><strong>${date}</strong><button class="icon-btn" onclick="data.selectCalendarDate('${date}')"><span class="material-symbols-rounded">close</span></button></div>
                <div class="empty-state" style="padding:20px"><p>当天暂无记录</p></div>
            </div>`;
            }
            return `<div class="md-card day-detail-card">
            <div class="day-detail-head"><span class="material-symbols-rounded">event</span><strong>${date}</strong><button class="icon-btn" onclick="data.selectCalendarDate('${date}')"><span class="material-symbols-rounded">close</span></button></div>
            <div class="day-detail-stats">
                <span>${totalMin} 分钟训练</span>
                ${totalCal ? `<span>${totalCal} kcal 运动消耗</span>` : ''}
                ${foodCal ? `<span>${foodCal} kcal 摄入</span>` : ''}
                ${weight ? `<span>${weight.weight.toFixed(1)} kg</span>` : ''}
            </div>
            ${entries.length ? `<div class="day-detail-section"><b>训练</b>${entries.map(h => {
                const icon = this.historyIcon(h);
                const names = this.historyNames(h).join('、');
                const mins = Math.floor(h.duration / 60);
                const secs = h.duration % 60;
                return `<div class="day-detail-item"><span class="record-icon material-symbols-rounded">${icon}</span><span>${names}</span><small>${mins}分${secs}秒${h.cardio ? ' · ' + Math.round(h.cardio.calories || 0) + ' kcal' : ''}</small></div>`;
            }).join('')}</div>` : ''}
            ${foods.length ? `<div class="day-detail-section"><b>饮食 · ${foodCal} kcal · P${foodPro.toFixed(0)} C${foodCarb.toFixed(0)} F${foodFat.toFixed(0)}</b>${foods.map(f => {
                return `<div class="day-detail-item"><span class="food-tag">${mealNames[f.meal] || f.meal}</span><span>${f.name}${f.grams ? ' ' + f.grams + 'g' : ''}</span><small>${f.cal} kcal · P${Number(f.pro || 0).toFixed(0)} C${Number(f.carb || 0).toFixed(0)} F${Number(f.fat || 0).toFixed(0)}</small></div>`;
            }).join('')}</div>` : ''}
            ${manualExercises.length ? `<div class="day-detail-section"><b>手动运动</b>${manualExercises.map(e => `<div class="day-detail-item"><span class="record-icon material-symbols-rounded">${this.sportIcon(this.exerciseLabel(e.type, e))}</span><span>${this.exerciseLabel(e.type, e)} ${e.minutes} 分钟${e.note ? ' · ' + this.escapeHtml(e.note) : ''}</span><small>${e.calories || 0} kcal</small></div>`).join('')}</div>` : ''}
            ${weight ? `<div class="day-detail-section"><b>体重</b><div class="day-detail-item"><span class="material-symbols-rounded" style="font-size:18px">monitor_weight</span><span>${weight.weight.toFixed(1)} kg</span>${weight.note ? `<small>${weight.note}</small>` : ''}</div></div>` : ''}
        </div>`;
        },

        groupHistoryByDate() {
            return this.activeRecords(this.db.history).reduce((map, h) => {
                const key = this.historyDayKey(h);
                if (!map[key]) map[key] = [];
                map[key].push(h);
                return map;
            }, {});
        },

        groupCalendarActivitiesByDate() {
            const map = {};
            this.activeRecords(this.db.history || []).forEach(h => {
                const key = this.historyDayKey(h);
                if (!map[key]) map[key] = [];
                this.historyNames(h).forEach((name, idx) => {
                    map[key].push({ name, minutes: idx === 0 ? (h.duration || 0) / 60 : 0, source: 'history' });
                });
            });
            this.activeRecords(this.db.health.exerciseLogs || []).forEach(e => {
                if (!e.date) return;
                if (!map[e.date]) map[e.date] = [];
                const name = this.exerciseLabel(e.type, e);
                map[e.date].push({ name, minutes: Number(e.minutes || 0), source: 'manual' });
            });
            return map;
        },

        renderContextAiCard(context) {
            if (!ai.cfg.enabled) return '';
            const prompts = this.contextAiPrompts(context);
            return '<div class="md-card context-ai-card"><div class="context-ai-head"><div><span class="cardio-kicker">AI 建议</span><h3>' + this.contextAiTitle(context) + '</h3><small>' + this.contextAiDescription(context) + '</small></div><span class="context-ai-icon material-symbols-rounded">psychology</span></div><div class="context-ai-actions">' + prompts.map(p => '<button class="md-btn md-btn-tonal context-ai-btn" onclick="data.askContextAi(\'' + context + '\',\'' + this.escapeHtml(p.prompt) + '\')">' + p.label + '</button>').join('') + '</div></div>';
        },

        contextAiTitle(context) { return { today: '综合分析', diet: '饮食分析', exercise: '训练分析', weight: '体重分析', calendar: '日历分析' }[context] || 'AI 分析'; },
        contextAiDescription(context) { return { today: '结合今日饮食、训练和体重记录生成建议', diet: '检查热量、蛋白质和饮食结构是否贴合目标', exercise: '根据训练频率、强度和恢复情况给出调整', weight: '结合趋势判断目标推进是否稳定', calendar: '按选中日期或本月记录总结关键变化' }[context] || '结合你的记录生成可执行建议'; },

        contextAiPrompts(context) {
            const isGain = this.isGainMode();
            return {
                today: [{ label: '分析今天', prompt: '请分析我今天的饮食、训练和体重记录，并给出今晚或明天的调整建议' }, { label: '晚餐建议', prompt: '根据今天已经摄入的饮食和目标，给我晚餐建议' }, { label: '明日调整', prompt: '根据今天记录，帮我安排明天的饮食和训练重点' }],
                diet: [{ label: '饮食分析', prompt: '请分析我今天和最近的饮食结构，重点看热量和蛋白质是否达标' }, { label: '补蛋白建议', prompt: '我今天蛋白质够不够？如果不够，建议怎么补' }, { label: '热量控制', prompt: '请根据我的饮食记录判断热量控制是否合理' }],
                exercise: [{ label: '训练强度', prompt: '请分析我最近训练频率和强度是否合理' }, { label: '恢复建议', prompt: '根据最近训练记录，帮我安排一次恢复训练' }, { label: '训练调整', prompt: '我应该增加还是减少训练量？请结合记录判断' }],
                weight: isGain
                    ? [{ label: '增肌趋势', prompt: '请分析我最近体重趋势，判断增肌进展是否正常' }, { label: '停滞原因', prompt: '如果我最近增肌停滞，请结合饮食和训练记录分析原因' }, { label: '目标调整', prompt: '请根据我的体重趋势调整增肌热量和训练建议' }]
                    : [{ label: '趋势分析', prompt: '请分析我最近体重趋势，并判断减重是否正常' }, { label: '停滞原因', prompt: '如果我最近减重停滞，请结合饮食和训练记录分析原因' }, { label: '目标调整', prompt: '请根据我的体重趋势调整热量和运动建议' }],
                calendar: [{ label: '分析选中日', prompt: '请分析我选中日期当天的饮食、训练和体重记录' }, { label: '本月总结', prompt: '请总结我这个月的训练、饮食和体重变化' }]
            }[context] || [{ label: '分析今天', prompt: '请分析我今天的记录' }];
        },

        askContextAi(context, prompt) {
            if (!ai.cfg.enabled) return alert('请先在设置中配置 AI');
            if (context === 'weight') this.adviceRange = 'month';
            this.routineView = 'advice';
            const nav = document.querySelectorAll('.nav-item')[3];
            ui.tab('ai-coach', nav);
            requestAnimationFrame(() => {
                const input = document.getElementById('advicePrompt');
                if (input) { input.value = prompt; this.onAdvicePromptInput?.(input); this.sendAiAdvice(prompt); }
            });
        }
    };
})();
