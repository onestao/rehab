// @ts-nocheck
(function () {
    function weekWindow(offsetWeeks = 0) {
        const now = new Date();
        const monday = new Date(now);
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + offsetWeeks * 7);
        monday.setHours(0,0,0,0);
        const end = new Date(monday);
        end.setDate(end.getDate() + 7);
        return { start: monday, end };
    }

    function dateKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function startOfIsoWeek(date = new Date()) {
        const d = new Date(date);
        d.setHours(0,0,0,0);
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return d;
    }

    function isoWeekKey(date = new Date()) {
        const d = startOfIsoWeek(date);
        const thursday = new Date(d);
        thursday.setDate(d.getDate() + 3);
        const year = thursday.getFullYear();
        const weekOne = startOfIsoWeek(new Date(year, 0, 4));
        const week = Math.floor((d.getTime() - weekOne.getTime()) / 604800000) + 1;
        return `${year}-W${String(week).padStart(2, '0')}`;
    }

    function weekStartFromKey(weekKey) {
        const match = String(weekKey || '').match(/^(\d{4})-W(\d{2})$/);
        if (!match) return startOfIsoWeek(new Date());
        const year = Number(match[1]);
        const week = Number(match[2]);
        const start = startOfIsoWeek(new Date(year, 0, 4));
        start.setDate(start.getDate() + (week - 1) * 7);
        return start;
    }

    window.dataWeeklySummary = {
        weeklyTrainingSummaryForRange(start, end) {
            const hist = this.activeRecords(this.db.history || []).filter(h => {
                const d = this.parseHistoryDate(h.date);
                return d >= start && d < end;
            });
            const ex = this.activeRecords(this.db.health.exerciseLogs || []).filter(e => {
                const d = new Date(e.date);
                return d >= start && d < end;
            });
            const minutes = Math.round(hist.reduce((s, h) => s + (h.duration || 0) / 60, 0))
                + ex.reduce((s, e) => s + (e.minutes || 0), 0);
            const sets = hist.reduce((s, h) => s + (h.actualSets?.length || 0), 0);
            const rpeValues = hist.flatMap(h => h.actualSets || []).map(s => Number(s.rpe || s.extras?.rpe || 0)).filter(Boolean);
            const avgRpe = rpeValues.length ? rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length : 0;
            const cal = Math.round(hist.reduce((s, h) => s + (h.cardio?.calories || 0), 0)
                + ex.reduce((s, e) => s + (e.calories || 0), 0));
            const counts = {};
            hist.forEach(h => this.historyNames(h).forEach(n => counts[n] = (counts[n] || 0) + 1));
            ex.forEach(e => { const n = this.exerciseLabel(e.type, e); counts[n] = (counts[n] || 0) + 1; });
            const top = Object.entries(counts).sort((a,b) => b[1]-a[1])[0]?.[0] || '—';
            return { total: hist.length + ex.length, minutes, cal, top, sets, avgRpe };
        },

        weeklyTrainingSummary(offsetWeeks = 0) {
            const { start, end } = weekWindow(offsetWeeks);
            return this.weeklyTrainingSummaryForRange(start, end);
        },

        weeklyFatigueInsight(weekKey = '') {
            const currentStart = weekKey ? weekStartFromKey(weekKey) : weekWindow(0).start;
            const currentEnd = new Date(currentStart);
            currentEnd.setDate(currentEnd.getDate() + 7);
            const previousStart = new Date(currentStart);
            previousStart.setDate(previousStart.getDate() - 7);
            const cur = this.weeklyTrainingSummaryForRange(currentStart, currentEnd);
            const prev = this.weeklyTrainingSummaryForRange(previousStart, currentStart);
            const minuteDelta = cur.minutes - prev.minutes;
            const loadSpike = prev.minutes > 0 ? cur.minutes / prev.minutes : (cur.minutes > 90 ? 2 : 1);
            const highRpe = cur.avgRpe >= 8.5;
            const fatigue = highRpe || loadSpike >= 1.5 || cur.total >= 6;
            const deload = fatigue && (cur.minutes >= 180 || highRpe);
            const level = deload ? '建议降载' : fatigue ? '注意恢复' : '节奏正常';
            const hint = deload
                ? '本周训练量或体感偏高，建议下周减少 20%-30% 训练量，保留动作模式但降低强度。'
                : fatigue
                    ? '本周训练压力偏高，优先保证睡眠、拉伸和低强度有氧。'
                    : '本周训练节奏稳定，可按计划渐进。';
            return { cur, prev, minuteDelta, loadSpike, highRpe, fatigue, deload, level, hint, weekKey: isoWeekKey(currentStart), weekStart: dateKey(currentStart), weekEnd: dateKey(new Date(currentEnd.getTime() - 86400000)) };
        },

        weeklyAiPromptForWeek(weekKey = '') {
            const insight = this.weeklyFatigueInsight(weekKey);
            const tpl = window.dataAiTemplates;
            const prefs = tpl?.getPromptPrefs('weekly_report', this.db) || {};
            const focusMap = { completion: '完成率', fatigue: '疲劳', deload: '降载', diet: '饮食', weight: '体重' };
            const focusStr = Array.isArray(prefs.focus) && prefs.focus.length ? prefs.focus.map(f => focusMap[f] || f).join('、') : '完成率、疲劳、降载';
            return `请基于 ${insight.weekStart} 至 ${insight.weekEnd} 的训练、饮食、体重和计划完成情况，做一份周总结。重点分析：${focusStr}。当前本地摘要：该周 ${insight.cur.total} 次训练，${insight.cur.minutes} 分钟，较前一周 ${insight.minuteDelta >= 0 ? '+' : ''}${insight.minuteDelta} 分钟，平均 RPE ${insight.cur.avgRpe ? insight.cur.avgRpe.toFixed(1) : '暂无'}，初步判断：${insight.level}。${prefs.customNote ? '用户补充：' + prefs.customNote : ''}`;
        },

        weeklyAiPrompt() {
            return this.weeklyAiPromptForWeek();
        },

        renderWeeklyAiInsightCard() {
            const hasAi = !!(this.db?.aiProfiles?.length && (this.db.aiActiveId || this.db.aiProfiles[0]?.id)) || !!(window.ai && ai.cfg?.enabled);
            const insight = this.weeklyFatigueInsight();
            const safe = this.escapeHtml.bind(this);
            return `<div class="md-card weekly-ai-insight-card">
                <div class="context-ai-head"><div><span class="cardio-kicker">AI 周总结</span><h3>${safe(insight.level)}</h3><small>${safe(insight.hint)}</small></div><span class="context-ai-icon material-symbols-rounded">tips_and_updates</span></div>
                <div class="record-overview-stats">
                    <div class="record-overview-stat"><b>${insight.cur.total}</b><small>本周训练</small></div>
                    <div class="record-overview-stat"><b>${insight.cur.minutes}</b><small>分钟</small></div>
                    <div class="record-overview-stat"><b>${insight.cur.avgRpe ? insight.cur.avgRpe.toFixed(1) : '--'}</b><small>平均 RPE</small></div>
                </div>
                <div class="context-ai-actions">
                    <button class="md-btn md-btn-tonal context-ai-btn" ${hasAi ? '' : 'disabled'} data-ai-ctx="weekly_review" data-ai-idx="0" type="button">生成周总结</button>
                    <button class="md-btn md-btn-tonal context-ai-btn" ${hasAi ? '' : 'disabled'} data-ai-ctx="weekly_review" data-ai-idx="1" type="button">判断是否降载</button>
                </div>
            </div>`;
        },

        renderWeeklySummaryCard() {
            const now = new Date();
            const monday = new Date(now);
            monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
            monday.setHours(0,0,0,0);
            const lastMonday = new Date(monday); lastMonday.setDate(lastMonday.getDate() - 7);
            const summarize = (start, end) => {
                const hist = this.activeRecords(this.db.history || []).filter(h => {
                    const d = this.parseHistoryDate(h.date);
                    return d >= start && d < end;
                });
                const ex = this.activeRecords(this.db.health.exerciseLogs || []).filter(e => {
                    const d = new Date(e.date);
                    return d >= start && d < end;
                });
                const total = hist.length + ex.length;
                const minutes = Math.round(hist.reduce((s, h) => s + (h.duration || 0) / 60, 0))
                              + ex.reduce((s, e) => s + (e.minutes || 0), 0);
                const cal = Math.round(hist.reduce((s, h) => s + (h.cardio?.calories || 0), 0)
                              + ex.reduce((s, e) => s + (e.calories || 0), 0));
                const counts = {};
                hist.forEach(h => this.historyNames(h).forEach(n => counts[n] = (counts[n] || 0) + 1));
                ex.forEach(e => { const n = this.exerciseLabel(e.type, e); counts[n] = (counts[n] || 0) + 1; });
                const top = Object.entries(counts).sort((a,b) => b[1]-a[1])[0]?.[0] || '—';
                return { total, minutes, cal, top };
            };
            const cur = summarize(monday, new Date(now.getTime() + 86400000));
            const prev = summarize(lastMonday, monday);
            const dt = (a, b) => a - b > 0 ? `+${a-b}` : `${a-b}`;
            return `<div class="md-card weekly-summary-card">
                <div class="hero-kicker">本周总结</div>
                <h3>${cur.total} 次训练 · ${cur.minutes} 分钟</h3>
                <div class="record-overview-stats">
                    <div class="record-overview-stat"><b>${cur.cal}</b><small>消耗 kcal</small></div>
                    <div class="record-overview-stat"><b>${dt(cur.total, prev.total)}</b><small>较上周</small></div>
                    <div class="record-overview-stat"><b>${cur.top}</b><small>最常练</small></div>
                </div>
            </div>`;
        },

        closeSummarySheet() {
            const el = document.getElementById('summarySheetOverlay');
            if (!el) return;
            el.style.animation = 'summarySheetFadeIn .2s ease reverse forwards';
            const sheet = el.querySelector('.summary-sheet');
            if (sheet) sheet.style.animation = 'summarySheetSlideUp .25s var(--md-sys-motion-emphasized) reverse forwards';
            setTimeout(() => el.remove(), 220);
            document.removeEventListener('keydown', this._summarySheetEsc);
        },

        renderWeeklySummarySheetBody(weekKey = '') {
            const safe = this.escapeHtml.bind(this);
            const insight = this.weeklyFatigueInsight(weekKey);
            const hasAi = !!(this.db?.aiProfiles?.length && (this.db.aiActiveId || this.db.aiProfiles[0]?.id)) || !!(window.ai && ai.cfg?.enabled);
            const dt = (a, b) => a - b > 0 ? `+${a-b}` : `${a-b}`;
            return `<div class="summary-month-controls">
                <label class="summary-month-field" for="summaryWeekInput"><span class="material-symbols-rounded">event</span><input id="summaryWeekInput" type="week" value="${safe(insight.weekKey)}" onchange="data.applyWeeklySummaryWeek()" aria-label="选择总结周"></label>
                <button class="summary-month-apply" onclick="data.applyWeeklySummaryWeek()" type="button">查看</button>
            </div>
            <div class="summary-glass-card">
                <div class="summary-kicker">AI 周总结 · ${safe(insight.weekStart)} 至 ${safe(insight.weekEnd)}</div>
                <h3>${safe(insight.level)}</h3>
                <small>${safe(insight.hint)}</small>
                <div class="summary-stats">
                    <div class="summary-stat"><strong>${insight.cur.total}</strong><small>本周训练</small></div>
                    <div class="summary-stat"><strong>${insight.cur.minutes}</strong><small>分钟</small></div>
                    <div class="summary-stat"><strong>${insight.cur.avgRpe ? insight.cur.avgRpe.toFixed(1) : '--'}</strong><small>平均 RPE</small></div>
                </div>
                <div class="summary-ai-actions">
                    <button class="summary-ai-btn" ${hasAi ? '' : 'disabled'} onclick="data.askWeeklySummaryAi('${safe(insight.weekKey)}', false)" type="button"><span class="material-symbols-rounded">auto_awesome</span>${safe(insight.weekKey)}总结</button>
                    <button class="summary-ai-btn" ${hasAi ? '' : 'disabled'} onclick="data.askWeeklySummaryAi('${safe(insight.weekKey)}', true)" type="button"><span class="material-symbols-rounded">trending_down</span>判断降载</button>
                </div>
            </div>
            <div class="summary-glass-card">
                <div class="summary-kicker">周概览</div>
                <h3>${insight.cur.total} 次训练 · ${insight.cur.minutes} 分钟</h3>
                <small>较前一周 ${dt(insight.cur.minutes, insight.prev.minutes)} 分钟 · ${insight.cur.cal} kcal</small>
                <div class="summary-stats">
                    <div class="summary-stat"><strong>${insight.cur.cal}</strong><small>消耗 kcal</small></div>
                    <div class="summary-stat"><strong>${dt(insight.cur.total, insight.prev.total)}</strong><small>较前周</small></div>
                    <div class="summary-stat"><strong>${safe(insight.cur.top)}</strong><small>最常练</small></div>
                </div>
            </div>`;
        },

        applyWeeklySummaryWeek() {
            const input = document.getElementById('summaryWeekInput');
            const body = document.getElementById('summarySheetBody');
            if (!body) return;
            body.innerHTML = this.renderWeeklySummarySheetBody(input?.value);
        },

        askWeeklySummaryAi(weekKey = '', deload = false) {
            const basePrompt = this.weeklyAiPromptForWeek(weekKey);
            const prompt = deload ? `${basePrompt}\n请特别判断下一周是否需要 deload，并给出具体降载比例、保留动作和恢复安排。` : basePrompt;
            this._inlineSummaryAi('weekly', weekKey, prompt, deload ? '判断降载' : '周总结');
        },

        askMonthlySummaryAi(monthKey = '') {
            const prompt = this.monthlySummaryAiPrompt(monthKey);
            this._inlineSummaryAi('monthly', monthKey, prompt, '月总结');
        },

        async _inlineSummaryAi(kind, periodKey, prompt, label) {
            const hasAi = !!(this.db?.aiProfiles?.length && (this.db.aiActiveId || this.db.aiProfiles[0]?.id)) || !!(window.ai && ai.cfg?.enabled);
            if (!hasAi) return alert('请先在设置中配置 AI');
            const body = document.getElementById('summarySheetBody');
            if (!body) return;
            const safe = this.escapeHtml ? this.escapeHtml.bind(this) : (v) => String(v ?? '');
            let responseEl = document.getElementById('summaryAiResponse');
            if (!responseEl) {
                responseEl = document.createElement('div');
                responseEl.id = 'summaryAiResponse';
                responseEl.className = 'summary-ai-response';
                body.appendChild(responseEl);
            }
            responseEl.innerHTML = `<div class="summary-ai-loading"><span class="material-symbols-rounded progress-icon">progress_activity</span> 正在生成${safe(label)}…</div>`;
            responseEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            try {
                const systemMsg = kind === 'monthly'
                    ? '你是严谨的训练与体重数据复盘助手。禁止编造数据，只能引用输入字段。输出：summary ≤80字，highlights ≤3条，suggestions ≤3条。'
                    : '你是严谨的训练与体重数据复盘助手。禁止编造数据，只能引用输入字段。输出：summary ≤80字，highlights ≤3条，suggestions ≤3条，deload判断（如适用）。';
                const messages = [
                    { role: 'system', content: systemMsg },
                    { role: 'user', content: prompt }
                ];
                const renderMd = this.renderAdviceMarkdown ? (t) => this.renderAdviceMarkdown(t) : (t) => `<p>${safe(t)}</p>`;
                if (window.ai?.callStream) {
                    let accumulated = '';
                    let _lastRender = 0;
                    const result = await ai.callStream(messages, 1800, (delta, acc) => {
                        accumulated = acc;
                        const now = Date.now();
                        if (now - _lastRender > 60) {
                            _lastRender = now;
                            responseEl.innerHTML = `<div class="summary-ai-result">${renderMd(accumulated)}</div>`;
                        }
                    });
                    const finalText = typeof result === 'string' ? result : accumulated;
                    responseEl.innerHTML = `<div class="summary-ai-result">${renderMd(finalText)}</div>`;
                    this._saveSummaryReport(kind, periodKey, finalText);
                } else {
                    const result = await ai.call(messages, 1800);
                    const text = typeof result === 'string' ? result : (result?.choices?.[0]?.message?.content || JSON.stringify(result));
                    responseEl.innerHTML = `<div class="summary-ai-result">${renderMd(text)}</div>`;
                    this._saveSummaryReport(kind, periodKey, text);
                }
            } catch (err) {
                responseEl.innerHTML = `<div class="summary-ai-error"><span class="material-symbols-rounded">error</span> ${safe(String(err?.message || err || '请求失败'))}</div>`;
            }
        },

        _saveSummaryReport(kind, periodKey, content) {
            try {
                this.db.health.reports = this.db.health.reports || [];
                const now = Date.now();
                const existing = this.activeRecords(this.db.health.reports).find(r => r.kind === `summary_${kind}` && r.periodKey === periodKey);
                const record = {
                    id: existing?.id || this.generateRecordId(`summary-${kind}`),
                    kind: `summary_${kind}`,
                    periodKey,
                    generatedAt: existing?.generatedAt || new Date(now).toISOString(),
                    updatedAt: now,
                    deleted: false,
                    content,
                    ai: { summary: content, model: 'ai', prompt_id: `summary_${kind}` }
                };
                if (existing) Object.assign(existing, record);
                else this.db.health.reports.push(record);
                this.saveAndBackup?.();
            } catch {}
        },

        openWeeklySummarySheet() {
            const existing = document.getElementById('summarySheetOverlay');
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.id = 'summarySheetOverlay';
            overlay.className = 'summary-sheet-overlay';
            overlay.addEventListener('click', (e) => { if (e.target === overlay) this.closeSummarySheet(); });

            overlay.innerHTML = `<div class="summary-sheet">
                <div class="summary-sheet-head">
                    <h3><span class="summary-sheet-head-icon material-symbols-rounded">summarize</span>周总结</h3>
                    <button class="summary-sheet-close" onclick="data.closeSummarySheet()" type="button"><span class="material-symbols-rounded">close</span></button>
                </div>
                <div id="summarySheetBody" class="summary-sheet-body">${this.renderWeeklySummarySheetBody()}</div>
            </div>`;

            document.body.appendChild(overlay);
            this._summarySheetEsc = (e) => { if (e.key === 'Escape') this.closeSummarySheet(); };
            document.addEventListener('keydown', this._summarySheetEsc);
            window.navStack?.push?.({ type: 'sheet', id: 'weeklySummary', close: () => this.closeSummarySheet() });
        },

        normalizeSummaryMonthKey(monthKey) {
            const now = new Date();
            const fallback = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const raw = String(monthKey || fallback).trim();
            return /^\d{4}-\d{2}$/.test(raw) ? raw : fallback;
        },

        monthlyTrainingSummary(monthKey) {
            const key = this.normalizeSummaryMonthKey(monthKey);
            const [year, month] = key.split('-').map(Number);
            const monthStart = new Date(year, month - 1, 1);
            const nextMonth = new Date(year, month, 1);
            const hist = this.activeRecords(this.db.history || []).filter(h => {
                const d = this.parseHistoryDate(h.date);
                return d >= monthStart && d < nextMonth;
            });
            const ex = this.activeRecords(this.db.health.exerciseLogs || []).filter(e => {
                const d = new Date(e.date);
                return d >= monthStart && d < nextMonth;
            });
            const total = hist.length + ex.length;
            const minutes = Math.round(hist.reduce((s, h) => s + (h.duration || 0) / 60, 0))
                          + ex.reduce((s, e) => s + (e.minutes || 0), 0);
            const cal = Math.round(hist.reduce((s, h) => s + (h.cardio?.calories || 0), 0)
                          + ex.reduce((s, e) => s + (e.calories || 0), 0));
            const sets = hist.reduce((s, h) => s + (h.actualSets?.length || 0), 0);
            const rpeValues = hist.flatMap(h => h.actualSets || []).map(s => Number(s.rpe || s.extras?.rpe || 0)).filter(Boolean);
            const avgRpe = rpeValues.length ? rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length : 0;
            const counts = {};
            hist.forEach(h => this.historyNames(h).forEach(n => counts[n] = (counts[n] || 0) + 1));
            ex.forEach(e => { const n = this.exerciseLabel(e.type, e); counts[n] = (counts[n] || 0) + 1; });
            const top3 = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 3);
            const daysInMonth = new Date(year, month, 0).getDate();
            const daysWithTraining = new Set([
                ...hist.map(h => this.parseHistoryDate(h.date)?.toDateString()),
                ...ex.map(e => new Date(e.date)?.toDateString())
            ].filter(Boolean)).size;
            return { total, minutes, cal, sets, avgRpe, top3, daysInMonth, daysWithTraining, monthKey: key, monthLabel: `${year}年${month}月` };
        },

        monthlySummaryAiPrompt(monthKey) {
            const m = this.monthlyTrainingSummary(monthKey);
            const top = m.top3.length ? m.top3.map(([name, count]) => `${name}×${count}`).join('、') : '暂无';
            return `请总结我${m.monthLabel}的训练、饮食和体重变化，并给出下一个月建议。当前本地训练摘要：${m.monthLabel}共 ${m.total} 次训练，${m.minutes} 分钟，${m.daysWithTraining}/${m.daysInMonth} 天有训练记录，总组数 ${m.sets}，平均 RPE ${m.avgRpe ? m.avgRpe.toFixed(1) : '暂无'}，消耗 ${m.cal} kcal，高频动作：${top}。请不要编造不存在的数据。`;
        },

        renderMonthlySummarySheetBody(monthKey) {
            const safe = this.escapeHtml.bind(this);
            const m = this.monthlyTrainingSummary(monthKey);
            const hasAi = !!(this.db?.aiProfiles?.length && (this.db.aiActiveId || this.db.aiProfiles[0]?.id)) || !!(window.ai && ai.cfg?.enabled);
            return `<div class="summary-month-controls">
                <label class="summary-month-field" for="summaryMonthInput"><span class="material-symbols-rounded">calendar_month</span><input id="summaryMonthInput" type="month" value="${safe(m.monthKey)}" onchange="data.applyMonthlySummaryMonth()" aria-label="选择总结月份"></label>
                <button class="summary-month-apply" onclick="data.applyMonthlySummaryMonth()" type="button">查看</button>
            </div>
            <div class="summary-glass-card">
                <div class="summary-kicker">${safe(m.monthLabel)}</div>
                <h3>${m.total} 次训练 · ${m.minutes} 分钟</h3>
                <small>${m.daysWithTraining}/${m.daysInMonth} 天有训练记录</small>
                <div class="summary-stats">
                    <div class="summary-stat"><strong>${m.total}</strong><small>训练次数</small></div>
                    <div class="summary-stat"><strong>${m.minutes}</strong><small>总分钟</small></div>
                    <div class="summary-stat"><strong>${m.cal}</strong><small>kcal</small></div>
                </div>
                <div class="summary-month-grid">
                    <div class="summary-month-item"><strong>${m.sets}</strong><small>总组数</small></div>
                    <div class="summary-month-item"><strong>${m.avgRpe ? m.avgRpe.toFixed(1) : '--'}</strong><small>平均 RPE</small></div>
                </div>
                ${m.top3.length ? `<div style="margin-top:12px"><div class="summary-kicker">高频动作</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">${m.top3.map(([name, count]) => `<span style="padding:4px 10px;border-radius:999px;background:var(--md-sys-secondary-container);color:var(--md-sys-on-secondary-container);font-size:12px;font-weight:600">${safe(name)} ×${count}</span>`).join('')}</div></div>` : ''}
                <div class="summary-ai-actions">
                    <button class="summary-ai-btn" ${hasAi ? '' : 'disabled'} onclick="data.askMonthlySummaryAi('${safe(m.monthKey)}')" type="button"><span class="material-symbols-rounded">auto_awesome</span>${safe(m.monthLabel)}总结</button>
                </div>
            </div>`;
        },

        applyMonthlySummaryMonth() {
            const input = document.getElementById('summaryMonthInput');
            const body = document.getElementById('summarySheetBody');
            if (!body) return;
            body.innerHTML = this.renderMonthlySummarySheetBody(input?.value);
        },

        openMonthlySummarySheet() {
            const existing = document.getElementById('summarySheetOverlay');
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.id = 'summarySheetOverlay';
            overlay.className = 'summary-sheet-overlay';
            overlay.addEventListener('click', (e) => { if (e.target === overlay) this.closeSummarySheet(); });

            overlay.innerHTML = `<div class="summary-sheet">
                <div class="summary-sheet-head">
                    <h3><span class="summary-sheet-head-icon material-symbols-rounded">calendar_month</span>月总结</h3>
                    <button class="summary-sheet-close" onclick="data.closeSummarySheet()" type="button"><span class="material-symbols-rounded">close</span></button>
                </div>
                <div id="summarySheetBody" class="summary-sheet-body">${this.renderMonthlySummarySheetBody()}</div>
            </div>`;

            document.body.appendChild(overlay);
            this._summarySheetEsc = (e) => { if (e.key === 'Escape') this.closeSummarySheet(); };
            document.addEventListener('keydown', this._summarySheetEsc);
            window.navStack?.push?.({ type: 'sheet', id: 'monthlySummary', close: () => this.closeSummarySheet() });
        }
    };
})();
