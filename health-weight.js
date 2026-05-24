// @ts-nocheck
(function () {
    const DAY_MS = 86400000;

    window.dataHealthWeight = {
        addWeight() {
            const date = document.getElementById('modalWeightDate').value || this.logicalDateKey();
            const weight = parseFloat(document.getElementById('modalWeightValue').value);
            const note = document.getElementById('modalWeightNote').value.trim();
            const height = parseFloat(document.getElementById('modalHeight').value);
            if (!weight || weight <= 0) return alert('请输入有效体重');
            this.db.health = this.db.health || { weights: [] };
            this.db.health.weights = this.db.health.weights || [];
            if (height > 0) this.db.health.height = height;
            this.db.health.weights.push({
                id: this.generateRecordId('weight'),
                date,
                weight,
                note,
                createdAt: new Date().toISOString(),
                updatedAt: Date.now(),
                deleted: false
            });
            this.db.health.weights.sort((a, b) => this.dateFromKey(b.date) - this.dateFromKey(a.date));
            this.weightRecordAnchorKey = date;
            document.getElementById('modalWeightValue').value = '';
            document.getElementById('modalWeightNote').value = '';
            this.closeWeightModal();
            this.saveAndBackup();
        },

        deleteWeight(id) {
            this.deleteWithUndo(this.db.health.weights, id, {
                save: () => this.saveAndBackup(),
                render: () => this.renderHistory?.()
            });
        },

        renderWeightPanel() {
            this.scheduleWeightChartPinchBinding?.();
            return `${this.renderWeightOverviewCard()}
                ${this.renderWeightTrendCard()}
                ${this.renderWeightRecordsCard()}`;
        },

        renderWeightOverviewCard() {
            const weights = this.sortedWeights();
            const latest = weights[weights.length - 1];
            const previous = weights[weights.length - 2];
            const delta = latest && previous ? latest.weight - previous.weight : 0;
            const h = this.db.health.height || 0;
            const bmi = (latest && h > 0) ? (latest.weight / ((h / 100) ** 2)) : 0;
            const bmiInfo = bmi > 0 ? this.bmiCategory(bmi) : null;
            return `<div class="md-card weight-card weight-overview-card">
                <div class="weight-head">
                    <div>
                        <span class="cardio-kicker">体重管理</span>
                        <h3>${latest ? `${latest.weight.toFixed(1)} kg` : '-- kg'}</h3>
                        <small>${latest ? `${this.escapeHtml(latest.date)}${delta ? ` · 较上次 ${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg` : ''}` : '点击下方添加第一条体重记录'}</small>
                    </div>
                    <span class="material-symbols-rounded weight-icon">monitor_weight</span>
                </div>
                <div class="bmi-row">
                    <button class="md-btn md-btn-tonal weight-open-btn" onclick="data.openWeightModal()" type="button"><span class="material-symbols-rounded">edit_note</span> 记录体重</button>
                    ${bmiInfo ? `<div class="bmi-display">
                        <span class="bmi-value">${bmi.toFixed(1)}</span>
                        <span class="bmi-label" style="color:${bmiInfo.color}">${bmiInfo.label}</span>
                        <span class="bmi-range">BMI ${bmiInfo.range}</span>
                    </div>` : '<div class="bmi-display bmi-empty"><small>填写身高计算 BMI</small></div>'}
                </div>
            </div>`;
        },

        renderWeightTrendCard() {
            const range = this.normalizeWeightTrendRange();
            const points = this.weightTrendPointsForRange(range);
            const analysis = this.weightAnalysis(points);
            const ranges = [['week', '7天'], ['month', '30天'], ['quarter', '90天'], ['year', '1年'], ['all', '全部']];
            const anchorText = range === 'all' ? '' : ` · 截至 ${this.escapeHtml(this.weightTrendAnchorKey || this.logicalDateKey())}`;
            const reportNew = this.hasNewWeightReport?.() ? ' data-has-new="true"' : '';
            return `<div class="md-card weight-card weight-trend-card">
                <div class="weight-section-head weight-trend-head">
                    <div class="weight-section-title">
                        <span class="cardio-kicker">趋势</span>
                        <h3>体重变化</h3>
                        <small>${this.weightTrendLabel(range)}${anchorText} · ${points.length} 条记录</small>
                    </div>
                    <div class="weight-section-actions">
                        <button class="md-icon-btn weight-report-btn" onclick="data.openWeightReport('weekly')" type="button" aria-label="查看周报与月报"${reportNew}><span class="material-symbols-rounded">assignment</span></button>
                        <span class="material-symbols-rounded weight-section-icon">show_chart</span>
                    </div>
                </div>
                <div class="weight-range-tabs weight-range-tabs-scroll weight-trend-tabs">
                    ${ranges.map(([key, label]) => `<button class="weight-range ${range === key ? 'active' : ''}" onclick="data.setWeightTrendRange('${key}')" type="button">${label}</button>`).join('')}
                </div>
                ${this.renderWeightChart(points, { id: 'weightTrendChartWrap', emptyLabel: '至少需要 2 条记录生成趋势', enablePinch: true, pinchKind: 'trend' })}
                <div class="weight-analysis">
                    <div><b>${analysis.avgText}</b><small>日均变化</small></div>
                    <div><b>${analysis.trend}</b><small>阶段判断</small></div>
                    <div><b>${analysis.deltaText}</b><small>区间变化</small></div>
                </div>
            </div>`;
        },

        renderWeightRecordsCard() {
            const range = this.normalizeWeightRecordRange();
            const period = this.weightRecordPeriod(range);
            const points = this.weightRecordPointsForRange(range, period);
            const ranges = [['week', '周'], ['month', '月'], ['year', '年'], ['all', '全部']];
            const canShift = range !== 'all';
            return `<div class="md-card weight-card weight-record-card">
                <div class="weight-section-head weight-record-head">
                    <div>
                        <span class="cardio-kicker">记录</span>
                        <h3>${period.title}</h3>
                        <small>${points.length ? `${points.length} 条体重记录` : '当前范围暂无记录'}</small>
                    </div>
                    <button class="md-btn md-btn-tonal weight-open-btn" onclick="data.openWeightModal()" type="button"><span class="material-symbols-rounded">add</span> 记录</button>
                </div>
                <div class="weight-range-tabs weight-record-tabs">
                    ${ranges.map(([key, label]) => `<button class="weight-range ${range === key ? 'active' : ''}" onclick="data.setWeightRecordRange('${key}')" type="button">${label}</button>`).join('')}
                </div>
                <div class="weight-period-nav ${canShift ? '' : 'is-all'}">
                    <button class="weight-period-btn" onclick="data.shiftWeightRecordPeriod(-1)" type="button" ${canShift ? '' : 'disabled'} aria-label="上一周期"><span class="material-symbols-rounded">chevron_left</span></button>
                    <div><b>${period.title}</b><small>${period.sub}</small></div>
                    <button class="weight-period-btn" onclick="data.shiftWeightRecordPeriod(1)" type="button" ${canShift ? '' : 'disabled'} aria-label="下一周期"><span class="material-symbols-rounded">chevron_right</span></button>
                </div>
                ${this.renderWeightChart(points, {
                    id: 'weightRecordChartWrap',
                    emptyLabel: '当前范围至少需要 2 条记录生成曲线',
                    start: period.start,
                    end: period.end,
                    showMonthMarkers: range === 'month' || range === 'year' || range === 'all',
                    enablePinch: true
                })}
                ${this.renderWeightList(points, {
                    grouped: range === 'year' || range === 'all',
                    collapseAfter: ['week', 'month', 'all'].includes(range) ? 3 : 0,
                    collapseKey: `weight_${range}_older`
                })}
            </div>`;
        },

        renderWeightChart(points, opts = {}) {
            const pinchKind = opts.pinchKind || 'record';
            const transitionClass = this.weightChartRangeTransitionClass(pinchKind);
            const transitionStyle = this.weightChartRangeTransitionStyle(pinchKind);
            if (points.length < 2) return `<div class="weight-empty-chart weight-chart-node${transitionClass}"${transitionStyle}><span class="material-symbols-rounded">show_chart</span><p>${opts.emptyLabel || '至少需要 2 条记录生成曲线'}（当前 ${points.length} 条）</p></div>`;
            const values = points.map(p => Number(p.weight || 0));
            const min = Math.min(...values) - 0.5;
            const max = Math.max(...values) + 0.5;
            const width = 320;
            const height = 150;
            const pad = 18;
            const startMs = opts.start ? opts.start.getTime() : this.dateFromKey(points[0].date).getTime();
            const endMs = opts.end ? opts.end.getTime() : this.dateFromKey(points[points.length - 1].date).getTime();
            const span = Math.max(DAY_MS, endMs - startMs);
            const coords = points.map(p => {
                const t = this.dateFromKey(p.date).getTime();
                const x = pad + Math.max(0, Math.min(1, (t - startMs) / span)) * (width - pad * 2);
                const y = height - pad - ((p.weight - min) / (max - min || 1)) * (height - pad * 2);
                return { ...p, x, y };
            });
            const path = coords.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
            const markerHtml = opts.showMonthMarkers ? this.renderWeightMonthMarkers(startMs, endMs, width, height, pad) : '';

            const minIdx = values.indexOf(Math.min(...values));
            const maxIdx = values.indexOf(Math.max(...values));
            const lastIdx = coords.length - 1;
            const labelIndices = new Set([minIdx, maxIdx, lastIdx]);
            const labels = coords.map((p, i) => labelIndices.has(i)
                ? `<text class="weight-dot-label" x="${p.x.toFixed(1)}" y="${(p.y - 8).toFixed(1)}" text-anchor="middle">${Number(p.weight).toFixed(1)}</text>`
                : '').join('');

            const dots = coords.map(p => {
                const date = this.escapeHtml(p.date || '');
                const weight = Number(p.weight || 0).toFixed(1);
                return `<circle class="weight-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="6" data-date="${date}" data-weight="${weight}" onclick="data.showWeightTipFromNode(event, this)"><title>${date}: ${weight}kg</title></circle>`;
            }).join('');

            const startAttr = Number.isFinite(startMs) ? ` data-start-ms="${startMs}"` : '';
            const endAttr = Number.isFinite(endMs) ? ` data-end-ms="${endMs}"` : '';
            const pinchAttr = opts.enablePinch ? ` data-pinch-chart="${this.escapeHtml(pinchKind)}"` : '';
            return `<div class="weight-chart-wrap weight-chart-node${transitionClass}" id="${opts.id || 'weightChartWrap'}"${startAttr}${endAttr}${pinchAttr}${transitionStyle}>
                <div class="weight-chart-stage">
                    <svg class="weight-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="体重变化曲线">
                        <path class="weight-grid-line" d="M${pad},${pad} H${width - pad} M${pad},${height / 2} H${width - pad} M${pad},${height - pad} H${width - pad}" />
                        ${markerHtml}
                        <path class="weight-line" d="${path}" />
                        ${dots}
                        ${labels}
                    </svg>
                    <div class="weight-chart-labels"><span>${this.escapeHtml(points[0].date || '').slice(5)}</span><span>${this.escapeHtml(points[points.length - 1].date || '').slice(5)}</span></div>
                </div>
                <div class="weight-chart-tip" style="display:none"></div>
            </div>`;
        },

        weightChartRangeTransitionClass(kind) {
            const transition = this._weightChartRangeTransition;
            if (!transition || transition.kind !== kind || Date.now() > transition.until) return '';
            return ` is-range-zoom is-range-zoom-${transition.direction}`;
        },

        weightChartRangeTransitionStyle(kind) {
            const transition = this._weightChartRangeTransition;
            if (!transition || transition.kind !== kind || Date.now() > transition.until || !Number.isFinite(transition.startScale)) return '';
            return ` style="--weight-chart-range-start-scale:${transition.startScale.toFixed(3)}"`;
        },

        replaceWeightCardFromHtml(selector, html) {
            const current = document.querySelector(selector);
            if (!current) return false;
            const template = document.createElement('template');
            template.innerHTML = html.trim();
            const next = template.content.firstElementChild;
            if (!next) return false;
            current.replaceWith(next);
            return true;
        },

        refreshWeightChartSurface(kind) {
            if (kind === 'trend') return this.replaceWeightCardFromHtml('.weight-trend-card', this.renderWeightTrendCard());
            if (kind === 'record') return this.replaceWeightCardFromHtml('.weight-record-card', this.renderWeightRecordsCard());
            return false;
        },

        renderWeightChartForKind(kind) {
            if (kind === 'trend') {
                const range = this.normalizeWeightTrendRange();
                const points = this.weightTrendPointsForRange(range);
                return this.renderWeightChart(points, { id: 'weightTrendChartWrap', emptyLabel: '至少需要 2 条记录生成趋势', enablePinch: true, pinchKind: 'trend' });
            }
            const range = this.normalizeWeightRecordRange();
            const period = this.weightRecordPeriod(range);
            const points = this.weightRecordPointsForRange(range, period);
            return this.renderWeightChart(points, {
                id: 'weightRecordChartWrap',
                emptyLabel: '当前范围至少需要 2 条记录生成曲线',
                start: period.start,
                end: period.end,
                showMonthMarkers: range === 'month' || range === 'year' || range === 'all',
                enablePinch: true
            });
        },

        refreshWeightChartGraph(kind) {
            const card = document.querySelector(kind === 'trend' ? '.weight-trend-card' : '.weight-record-card');
            const current = card?.querySelector?.('.weight-chart-node');
            if (!card || !current) return false;
            const template = document.createElement('template');
            template.innerHTML = this.renderWeightChartForKind(kind).trim();
            const next = template.content.firstElementChild;
            if (!next) return false;
            current.replaceWith(next);
            this.updateWeightChartMeta(kind, card);
            if (kind === 'record') this.refreshWeightRecordList(card);
            this.bindWeightChartPinches(card);
            return true;
        },

        updateWeightRangeTabs(container, activeRange) {
            container?.querySelectorAll?.('.weight-range').forEach((btn) => {
                const handler = btn.getAttribute('onclick') || '';
                btn.classList.toggle('active', handler.includes(`'${activeRange}'`) || handler.includes(`"${activeRange}"`));
            });
        },

        updateWeightChartMeta(kind, card) {
            if (kind === 'trend') {
                const range = this.normalizeWeightTrendRange();
                const points = this.weightTrendPointsForRange(range);
                const analysis = this.weightAnalysis(points);
                const anchorText = range === 'all' ? '' : ` · 截至 ${this.weightTrendAnchorKey || this.logicalDateKey()}`;
                const small = card.querySelector('.weight-trend-head small');
                if (small) small.textContent = `${this.weightTrendLabel(range)}${anchorText} · ${points.length} 条记录`;
                this.updateWeightRangeTabs(card.querySelector('.weight-trend-tabs'), range);
                const values = card.querySelectorAll('.weight-analysis b');
                if (values[0]) values[0].textContent = analysis.avgText;
                if (values[1]) values[1].textContent = analysis.trend;
                if (values[2]) values[2].textContent = analysis.deltaText;
                return;
            }
            const range = this.normalizeWeightRecordRange();
            const period = this.weightRecordPeriod(range);
            const points = this.weightRecordPointsForRange(range, period);
            const canShift = range !== 'all';
            const title = card.querySelector('.weight-record-head h3');
            const small = card.querySelector('.weight-record-head small');
            if (title) title.textContent = period.title;
            if (small) small.textContent = points.length ? `${points.length} 条体重记录` : '当前范围暂无记录';
            this.updateWeightRangeTabs(card.querySelector('.weight-record-tabs'), range);
            const nav = card.querySelector('.weight-period-nav');
            nav?.classList.toggle('is-all', !canShift);
            nav?.querySelectorAll('button').forEach(btn => { btn.disabled = !canShift; });
            const navTitle = nav?.querySelector('b');
            const navSub = nav?.querySelector('small');
            if (navTitle) navTitle.textContent = period.title;
            if (navSub) navSub.textContent = period.sub;
        },

        refreshWeightRecordList(card) {
            const current = card?.querySelector?.('.weight-list, .weight-record-empty');
            if (!current) return false;
            const range = this.normalizeWeightRecordRange();
            const period = this.weightRecordPeriod(range);
            const points = this.weightRecordPointsForRange(range, period);
            const template = document.createElement('template');
            template.innerHTML = this.renderWeightList(points, {
                grouped: range === 'year' || range === 'all',
                collapseAfter: ['week', 'month', 'all'].includes(range) ? 3 : 0,
                collapseKey: `weight_${range}_older`
            }).trim();
            const next = template.content.firstElementChild;
            if (!next) return false;
            current.replaceWith(next);
            return true;
        },

        renderWeightMonthMarkers(startMs, endMs, width, height, pad) {
            const start = new Date(startMs);
            const end = new Date(endMs);
            const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
            if (cursor.getTime() < startMs) cursor.setMonth(cursor.getMonth() + 1);
            const totalMonths = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1);
            const showEvery = totalMonths > 18 ? 3 : 1;
            const parts = [];
            let idx = 0;
            while (cursor.getTime() <= endMs) {
                const x = pad + ((cursor.getTime() - startMs) / Math.max(DAY_MS, endMs - startMs)) * (width - pad * 2);
                if (x > pad + 2 && x < width - pad - 2) {
                    parts.push(`<path class="weight-month-line" d="M${x.toFixed(1)},${pad} V${height - pad}" />`);
                    if (idx % showEvery === 0) {
                        const label = `${cursor.getMonth() + 1}月`;
                        parts.push(`<text class="weight-month-label" x="${x.toFixed(1)}" y="${height - 3}" text-anchor="middle">${label}</text>`);
                    }
                }
                cursor.setMonth(cursor.getMonth() + 1);
                idx++;
            }
            return parts.join('');
        },

        renderWeightList(weights, opts = {}) {
            if (weights.length === 0) return '<div class="weight-empty-chart weight-record-empty"><span class="material-symbols-rounded">event_note</span><p>当前范围暂无体重记录</p></div>';
            const collapseAfter = Number(opts.collapseAfter || 0);
            if (collapseAfter > 0 && weights.length > collapseAfter) {
                return this.renderCollapsedWeightList(weights, opts);
            }
            if (!opts.grouped) {
                return `<div class="weight-list">
                    ${weights.slice().reverse().map(w => this.renderWeightListItem(w)).join('')}
                </div>`;
            }
            const groups = {};
            weights.forEach(w => {
                const key = String(w.date || '').slice(0, 7) || '未知月份';
                groups[key] = groups[key] || [];
                groups[key].push(w);
            });
            const renderGrouped = (map) => Object.keys(map).sort((a, b) => b.localeCompare(a)).map(key => {
                const items = map[key].slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
                const [year, month] = key.split('-');
                return `<section class="weight-month-group">
                    <div class="weight-month-head"><span>${this.escapeHtml(year || '')}年${Number(month || 0) || ''}月</span><small>${items.length} 条</small></div>
                    ${items.map(w => this.renderWeightListItem(w)).join('')}
                </section>`;
            }).join('');
            return `<div class="weight-list weight-list-grouped">${renderGrouped(groups)}</div>`;
        },

        renderCollapsedWeightList(weights, opts = {}) {
            const descending = weights.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
            const visibleCount = Number(opts.collapseAfter || 3);
            const recent = descending.slice(0, visibleCount);
            const older = descending.slice(visibleCount);
            if (!older.length) {
                return `<div class="weight-list weight-list-grouped">${recent.map(w => this.renderWeightListItem(w)).join('')}</div>`;
            }
            const olderGroups = {};
            older.forEach(w => {
                const key = String(w.date || '').slice(0, 7) || '未知月份';
                olderGroups[key] = olderGroups[key] || [];
                olderGroups[key].push(w);
            });
            const collapseKey = opts.collapseKey || 'weightOlder';
            const olderCollapsed = this.isCollapsed(collapseKey, true);
            const renderGrouped = (map) => Object.keys(map).sort((a, b) => b.localeCompare(a)).map(key => {
                const items = map[key].slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
                const [year, month] = key.split('-');
                return `<section class="weight-month-group">
                    <div class="weight-month-head"><span>${this.escapeHtml(year || '')}年${Number(month || 0) || ''}月</span><small>${items.length} 条</small></div>
                    ${items.map(w => this.renderWeightListItem(w)).join('')}
                </section>`;
            }).join('');
            return `<div class="weight-list weight-list-grouped">
                ${recent.map(w => this.renderWeightListItem(w)).join('')}
                <div class="history-older-group ${olderCollapsed ? 'collapsed' : ''}">
                    <button class="history-older-head" onclick="data.toggleCollapse('${collapseKey}')" type="button">
                        <span class="material-symbols-rounded">${olderCollapsed ? 'expand_more' : 'expand_less'}</span>
                        <small>其余 ${older.length} 条记录</small>
                    </button>
                    <div class="history-older-content">
                        ${renderGrouped(olderGroups)}
                    </div>
                </div>
            </div>`;
        },

        renderWeightListItem(w) {
            const note = w.note ? `<small>${this.escapeHtml(w.note)}</small>` : '';
            return `<div class="weight-list-item">
                <span>${this.escapeHtml(w.date || '')}${note}</span>
                <b>${Number(w.weight || 0).toFixed(1)} kg</b>
                <button class="delete-btn" data-id="${this.escapeHtml(w.id || '')}" onclick="data.deleteWeight(this.dataset.id)" type="button"><span class="material-symbols-rounded">delete</span></button>
            </div>`;
        },

        sortedWeights() {
            return [...this.activeRecords(this.db.health?.weights || [])].sort((a, b) => this.dateFromKey(a.date) - this.dateFromKey(b.date));
        },

        latestWeightDateKey() {
            return this.sortedWeights().slice(-1)[0]?.date || '';
        },

        normalizeWeightTrendRange() {
            const range = this.weightTrendRange || this.weightRange || 'month';
            return ['week', 'month', 'quarter', 'year', 'all'].includes(range) ? range : 'month';
        },

        normalizeWeightRecordRange() {
            const range = this.weightRecordRange || 'month';
            return ['week', 'month', 'year', 'all'].includes(range) ? range : 'month';
        },

        weightTrendZoomOrder() {
            return ['all', 'year', 'quarter', 'month', 'week'];
        },

        weightRecordZoomOrder() {
            return ['all', 'year', 'month', 'week'];
        },

        weightTrendLabel(range) {
            return { week: '最近7天', month: '最近30天', quarter: '最近90天', year: '最近1年', all: '全部记录' }[range] || '最近30天';
        },

        weightTrendPointsForRange(range = this.normalizeWeightTrendRange()) {
            const all = this.sortedWeights();
            if (range === 'all') return all;
            this.ensureWeightTrendAnchor();
            this.weightTrendAnchorKey = this.resolveWeightTrendAnchor(range, this.weightTrendAnchorKey || this.latestWeightDateKey() || this.logicalDateKey());
            return this.weightTrendPointsForAnchor(range, this.weightTrendAnchorKey);
        },

        weightPointsForRange() {
            return this.weightTrendPointsForRange();
        },

        ensureWeightTrendAnchor() {
            if (this.weightTrendAnchorKey) return;
            this.weightTrendAnchorKey = this.latestWeightDateKey() || this.logicalDateKey();
        },

        ensureWeightRecordAnchor() {
            if (this.weightRecordAnchorKey) return;
            const weights = this.sortedWeights();
            this.weightRecordAnchorKey = weights[weights.length - 1]?.date || this.logicalDateKey();
        },

        shiftWeightRecordAnchor(delta) {
            const range = this.normalizeWeightRecordRange();
            if (range === 'all') return;
            this.ensureWeightRecordAnchor();
            const d = this.dateFromKey(this.weightRecordAnchorKey);
            if (range === 'week') d.setDate(d.getDate() + delta * 7);
            if (range === 'month') d.setMonth(d.getMonth() + delta);
            if (range === 'year') d.setFullYear(d.getFullYear() + delta);
            this.weightRecordAnchorKey = this.dateKey(d);
        },

        weightRecordPeriod(range = this.normalizeWeightRecordRange()) {
            const weights = this.sortedWeights();
            if (range === 'all') {
                const first = weights[0]?.date || '';
                const last = weights[weights.length - 1]?.date || '';
                return {
                    title: '全部记录',
                    sub: first && last ? `${first} 至 ${last}` : '暂无记录',
                    start: first ? this.dateFromKey(first) : null,
                    end: last ? this.dateFromKey(last) : null
                };
            }
            this.ensureWeightRecordAnchor();
            const anchor = this.dateFromKey(this.weightRecordAnchorKey);
            if (range === 'week') {
                const start = new Date(anchor);
                const dow = (start.getDay() + 6) % 7;
                start.setDate(start.getDate() - dow);
                const end = new Date(start);
                end.setDate(start.getDate() + 6);
                return { title: `${this.dateKey(start).slice(5)} 至 ${this.dateKey(end).slice(5)}`, sub: `${start.getFullYear()}年第 ${this.weightWeekNumber(start)} 周`, start, end };
            }
            if (range === 'year') {
                const start = new Date(anchor.getFullYear(), 0, 1);
                const end = new Date(anchor.getFullYear(), 11, 31);
                return { title: `${anchor.getFullYear()}年`, sub: '按月份区分体重记录', start, end };
            }
            const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
            const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
            return { title: `${anchor.getFullYear()}年${anchor.getMonth() + 1}月`, sub: `${this.dateKey(start)} 至 ${this.dateKey(end)}`, start, end };
        },

        weightWeekNumber(date) {
            const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const day = (d.getDay() + 6) % 7;
            d.setDate(d.getDate() - day + 3);
            const firstThursday = new Date(d.getFullYear(), 0, 4);
            const firstDay = (firstThursday.getDay() + 6) % 7;
            firstThursday.setDate(firstThursday.getDate() - firstDay + 3);
            return 1 + Math.round((d - firstThursday) / (7 * DAY_MS));
        },

        weightRecordPointsForRange(range = this.normalizeWeightRecordRange(), period = this.weightRecordPeriod(range)) {
            const all = this.sortedWeights();
            if (range === 'all' || !period.start || !period.end) return all;
            const startKey = this.dateKey(period.start);
            const endKey = this.dateKey(period.end);
            return all.filter(w => w.date >= startKey && w.date <= endKey);
        },

        weightRecordFocusDateFromClientX(wrap, clientX) {
            if (!wrap || !Number.isFinite(clientX)) return this.weightRecordAnchorKey || this.logicalDateKey();
            const rect = wrap.getBoundingClientRect();
            const startMs = Number(wrap.dataset.startMs || 0);
            const endMs = Number(wrap.dataset.endMs || 0);
            if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs || rect.width <= 0) {
                return this.weightRecordAnchorKey || this.logicalDateKey();
            }
            const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const ms = startMs + (endMs - startMs) * ratio;
            return this.dateKey(new Date(ms));
        },

        weightTrendPointsForAnchor(range, anchorKey) {
            const all = this.sortedWeights();
            if (range === 'all') return all;
            const days = { week: 7, month: 30, quarter: 90, year: 365 }[range] || 30;
            const anchorDate = this.dateFromKey(anchorKey || this.latestWeightDateKey() || this.logicalDateKey());
            const endKey = this.dateKey(anchorDate);
            const cutoffKey = this.dateKey(new Date(anchorDate.getTime() - days * DAY_MS));
            return all.filter(w => w.date >= cutoffKey && w.date <= endKey);
        },

        resolveWeightTrendAnchor(range, preferredKey) {
            const latest = this.latestWeightDateKey() || this.logicalDateKey();
            if (range === 'all') return latest;
            if (preferredKey && this.weightTrendPointsForAnchor(range, preferredKey).length >= 2) return preferredKey;
            if (this.weightTrendPointsForAnchor(range, latest).length >= 2) return latest;
            const dates = this.sortedWeights().map(w => w.date).reverse();
            const preferredTime = this.dateFromKey(preferredKey || latest).getTime();
            dates.sort((a, b) => Math.abs(this.dateFromKey(a) - preferredTime) - Math.abs(this.dateFromKey(b) - preferredTime));
            return dates.find(date => this.weightTrendPointsForAnchor(range, date).length >= 2) || latest;
        },

        weightChartZoomStep(scale) {
            if (!Number.isFinite(scale) || scale <= 0) return 0;
            const logScale = Math.log2(scale);
            if (logScale >= 0.22) return 1;
            if (logScale <= -0.22) return -1;
            return 0;
        },

        weightChartZoomTarget(kind, step) {
            const order = kind === 'trend' ? this.weightTrendZoomOrder() : this.weightRecordZoomOrder();
            const current = kind === 'trend' ? this.normalizeWeightTrendRange() : this.normalizeWeightRecordRange();
            const index = order.indexOf(current);
            if (index < 0 || !step) return null;
            const nextIndex = Math.max(0, Math.min(order.length - 1, index + step));
            if (nextIndex === index) return null;
            return order[nextIndex];
        },

        changeWeightChartRangeByZoom(kind, step, focusDate, opts = {}) {
            step = Math.sign(step);
            const nextRange = this.weightChartZoomTarget(kind, step);
            if (!nextRange) return false;
            if (focusDate) {
                if (kind === 'trend') this.weightTrendAnchorKey = this.resolveWeightTrendAnchor(nextRange, focusDate);
                else this.weightRecordAnchorKey = focusDate;
            }
            if (kind === 'trend') {
                this.weightTrendRange = nextRange;
                this.weightRange = this.weightTrendRange;
            } else {
                this.weightRecordRange = nextRange;
            }
            if (opts.transition) {
                const existing = this._weightChartRangeTransition;
                this._weightChartRangeTransition = {
                    kind,
                    direction: step > 0 ? 'in' : 'out',
                    startScale: existing?.kind === kind && Number.isFinite(existing.startScale) ? existing.startScale : (step > 0 ? 1.16 : 0.86),
                    until: Date.now() + 320
                };
            }
            if (opts.surfaceOnly && this.refreshWeightChartGraph(kind)) return true;
            if (opts.surfaceOnly && this.refreshWeightChartSurface(kind)) {
                this.scheduleWeightChartPinchBinding?.();
                return true;
            }
            this.renderHistory();
            return true;
        },

        weightAnalysis(points = this.weightTrendPointsForRange()) {
            if (points.length < 2) return { avgText: '-- kg/日', trend: '记录不足', deltaText: '-- kg' };
            const first = points[0];
            const last = points[points.length - 1];
            const days = Math.max(1, Math.round((this.dateFromKey(last.date) - this.dateFromKey(first.date)) / DAY_MS));
            const total = last.weight - first.weight;
            const avg = total / days;
            const trend = Math.abs(avg) < 0.01 ? '基本不变' : avg < 0 ? '下降趋势' : '上升趋势';
            return {
                avgText: `${avg > 0 ? '+' : ''}${avg.toFixed(2)} kg/日`,
                trend,
                deltaText: `${total > 0 ? '+' : ''}${total.toFixed(1)} kg`
            };
        },

        saveHeight(val) {
            const h = parseFloat(val);
            if (h > 0) { this.db.health.height = h; this.save({ render: false }); this.renderHistory(); }
        },

        scheduleWeightChartPinchBinding() {
            if (typeof window === 'undefined') return;
            if (this._weightChartBindFrame) return;
            const raf = window.requestAnimationFrame || ((fn) => setTimeout(fn, 16));
            this._weightChartBindFrame = raf(() => {
                this._weightChartBindFrame = 0;
                this.bindWeightChartPinches();
            });
        },

        bindWeightChartPinches(root = document) {
            root?.querySelectorAll?.('.weight-chart-wrap[data-pinch-chart]').forEach(wrap => this.bindWeightChartPinch(wrap));
        },

        bindWeightChartPinch(wrap) {
            if (!wrap || wrap._pinchBound) return;
            wrap.addEventListener('touchstart', (event) => this.onWeightChartTouchStart(event), { passive: false });
            wrap.addEventListener('touchmove', (event) => this.onWeightChartTouchMove(event), { passive: false });
            wrap.addEventListener('touchend', (event) => this.onWeightChartTouchEnd(event), { passive: false });
            wrap.addEventListener('touchcancel', (event) => this.onWeightChartTouchEnd(event), { passive: false });
            wrap.addEventListener('wheel', (event) => this.onWeightChartWheel(event), { passive: false });
            wrap._pinchBound = true;
        },

        onWeightChartTouchStart(event) {
            if (event.touches?.length !== 2) {
                this.clearWeightChartPinch();
                return;
            }
            const wrap = event.currentTarget?.closest?.('.weight-chart-wrap') || event.currentTarget;
            const stage = wrap?.querySelector?.('.weight-chart-stage');
            const [a, b] = event.touches;
            const centerX = (a.clientX + b.clientX) / 2;
            const dist = Math.abs(a.clientX - b.clientX);
            this._weightChartPinch = {
                kind: wrap?.dataset?.pinchChart || 'record',
                wrap,
                stage,
                startDistance: dist,
                lastDistance: dist,
                focusDate: this.weightRecordFocusDateFromClientX(wrap, centerX),
                scale: 1,
                visualScale: 1,
                originX: centerX,
                direction: 0,
                frame: 0
            };
            wrap?.classList?.add('is-pinching');
            event.preventDefault();
        },

        onWeightChartTouchMove(event) {
            const pinch = this._weightChartPinch;
            if (!pinch || event.touches?.length !== 2) return;
            const [a, b] = event.touches;
            const dx = a.clientX - b.clientX;
            const dy = a.clientY - b.clientY;
            if (Math.abs(dx) < Math.abs(dy) * 0.7) return;
            const dist = Math.abs(dx);
            const centerX = (a.clientX + b.clientX) / 2;
            pinch.focusDate = this.weightRecordFocusDateFromClientX(pinch.wrap, centerX);
            const rawScale = Math.max(0.48, Math.min(2.15, dist / Math.max(1, pinch.startDistance)));
            const logScale = Math.log2(rawScale);
            if (!pinch.direction && Math.abs(logScale) > 0.05) pinch.direction = Math.sign(logScale);
            pinch.scale = pinch.direction > 0 ? Math.max(1, rawScale) : pinch.direction < 0 ? Math.min(1, rawScale) : rawScale;
            pinch.visualScale = pinch.scale;
            pinch.lastDistance = dist;
            pinch.originX = centerX;
            this.scheduleWeightChartPinchFrame(pinch);
            event.preventDefault();
        },

        scheduleWeightChartPinchFrame(pinch = this._weightChartPinch) {
            if (!pinch?.stage || pinch.frame) return;
            const raf = window.requestAnimationFrame || ((fn) => setTimeout(fn, 16));
            pinch.frame = raf(() => {
                pinch.frame = 0;
                if (this._weightChartPinch !== pinch || !pinch.stage) return;
                const rect = pinch.wrap.getBoundingClientRect();
                const originX = Math.max(0, Math.min(rect.width, pinch.originX - rect.left));
                pinch.stage.style.transformOrigin = `${originX}px center`;
                pinch.stage.style.transform = `translate3d(0,0,0) scale(${pinch.visualScale.toFixed(3)})`;
            });
        },

        onWeightChartTouchEnd(event) {
            const pinch = this._weightChartPinch;
            if (!pinch) return;
            if (event.touches?.length >= 2) return;
            let step = this.weightChartZoomStep(pinch.scale);
            if (pinch.direction && step && Math.sign(step) !== pinch.direction) step = 0;
            if (step && this.weightChartZoomTarget(pinch.kind, step)) {
                this.commitWeightChartPinch(pinch, step);
                return;
            }
            this.clearWeightChartPinch({ settle: true });
        },

        commitWeightChartPinch(pinch, step) {
            if (!pinch) return;
            const stage = pinch.stage;
            const wrap = pinch.wrap;
            this._weightChartPinch = null;
            wrap?.classList?.remove('is-pinching');
            wrap?.classList?.add('is-zoom-committing');
            this._weightChartRangeTransition = {
                kind: pinch.kind,
                direction: step > 0 ? 'in' : 'out',
                startScale: pinch.visualScale,
                until: Date.now() + 320
            };
            if (stage) stage.style.transform = `translate3d(0,0,0) scale(${pinch.visualScale.toFixed(3)})`;
            const timeout = window.setTimeout || setTimeout;
            timeout(() => {
                this.changeWeightChartRangeByZoom(pinch.kind, step, pinch.focusDate, { transition: true, surfaceOnly: true });
            }, 16);
        },

        onWeightChartWheel(event) {
            if (!event.ctrlKey) return;
            event.preventDefault();
            const wrap = event.currentTarget?.closest?.('.weight-chart-wrap') || event.currentTarget;
            const kind = wrap?.dataset?.pinchChart || 'record';
            const step = Math.sign(-event.deltaY);
            if (!step || !this.weightChartZoomTarget(kind, step)) return;
            const focusDate = this.weightRecordFocusDateFromClientX(wrap, event.clientX);
            this._weightChartRangeTransition = {
                kind,
                direction: step > 0 ? 'in' : 'out',
                startScale: step > 0 ? 1.08 : 0.94,
                until: Date.now() + 320
            };
            this.changeWeightChartRangeByZoom(kind, step, focusDate, { transition: true, surfaceOnly: true });
        },

        clearWeightChartPinch(opts = {}) {
            const pinch = this._weightChartPinch;
            if (pinch?.stage) {
                if (opts.settle) {
                    pinch.wrap?.classList?.remove('is-pinching');
                    pinch.wrap?.classList?.add('is-zoom-settling');
                    pinch.stage.style.transform = 'translate3d(0,0,0) scale(1)';
                    const timeout = window.setTimeout || setTimeout;
                    timeout(() => {
                        pinch.stage.style.transform = '';
                        pinch.stage.style.transformOrigin = '';
                        pinch.wrap?.classList?.remove('is-zoom-settling');
                    }, 160);
                } else {
                    pinch.stage.style.transform = '';
                    pinch.stage.style.transformOrigin = '';
                }
            }
            if (!opts.settle) pinch?.wrap?.classList?.remove('is-pinching');
            this._weightChartPinch = null;
        },

        showWeightTipFromNode(event, node) {
            this.showWeightTip(event, node?.dataset?.date || '', Number(node?.dataset?.weight || 0), node?.closest?.('.weight-chart-wrap'));
        },

        showWeightTip(event, date, weight, wrap = null) {
            wrap = wrap || document.getElementById('weightTrendChartWrap') || document.getElementById('weightRecordChartWrap');
            const tip = wrap?.querySelector?.('.weight-chart-tip');
            if (!wrap || !tip) return;
            const rect = wrap.getBoundingClientRect();
            const clientX = event.clientX || (event.touches && event.touches[0]?.clientX) || 0;
            const x = clientX - rect.left;
            const viewportWidth = window.innerWidth || document.documentElement.clientWidth || rect.width;
            const wrapRightInViewport = Math.min(rect.width, viewportWidth - rect.left);
            const safeText = `${date}  ${Number(weight).toFixed(1)} kg`;

            tip.textContent = safeText;
            tip.style.display = 'block';
            tip.style.left = '8px';

            const tipWidth = tip.offsetWidth || 80;
            const minLeft = 8;
            const maxLeft = Math.max(minLeft, wrapRightInViewport - tipWidth - 8);
            const desiredLeft = x - (tipWidth / 2);
            tip.style.left = Math.max(minLeft, Math.min(maxLeft, desiredLeft)) + 'px';

            clearTimeout(this._weightTipTimer);
            this._weightTipTimer = setTimeout(() => { tip.style.display = 'none'; }, 2200);
        }
    };
})();
