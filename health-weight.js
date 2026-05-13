(function () {
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
            document.getElementById('modalWeightValue').value = '';
            document.getElementById('modalWeightNote').value = '';
            this.closeWeightModal();
            this.saveAndBackup();
        },

        deleteWeight(id) {
            this.softDeleteById(this.db.health.weights, id);
            this.saveAndBackup();
        },

        renderWeightPanel() {
            const weights = this.sortedWeights();
            const latest = weights[weights.length - 1];
            const previous = weights[weights.length - 2];
            const delta = latest && previous ? latest.weight - previous.weight : 0;
            const analysis = this.weightAnalysis();
            const h = this.db.health.height || 0;
            const bmi = (latest && h > 0) ? (latest.weight / ((h / 100) ** 2)) : 0;
            const bmiInfo = bmi > 0 ? this.bmiCategory(bmi) : null;
            const recentWeights = weights.slice(-8).reverse();
            const historyCollapsed = this.isCollapsed('weightHistory', true);
            return `<div class="md-card weight-card">
            <div class="weight-head">
                <div>
                    <span class="cardio-kicker">体重管理</span>
                    <h3>${latest ? `${latest.weight.toFixed(1)} kg` : '-- kg'}</h3>
                    <small>${latest ? `${latest.date}${delta ? ` · 较上次 ${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg` : ''}` : '点击下方添加第一条体重记录'}</small>
                </div>
                <span class="material-symbols-rounded weight-icon">monitor_weight</span>
            </div>
            <div class="bmi-row">
                <button class="md-btn md-btn-tonal weight-open-btn" onclick="data.openWeightModal()"><span class="material-symbols-rounded">edit_note</span> 记录体重</button>
                ${bmiInfo ? `<div class="bmi-display">
                    <span class="bmi-value">${bmi.toFixed(1)}</span>
                    <span class="bmi-label" style="color:${bmiInfo.color}">${bmiInfo.label}</span>
                    <span class="bmi-range">BMI ${bmiInfo.range}</span>
                </div>` : '<div class="bmi-display bmi-empty"><small>填写身高计算 BMI</small></div>'}
            </div>
            <div class="weight-range-tabs">
                ${['week','month','year'].map(r => `<button class="weight-range ${this.weightRange === r ? 'active' : ''}" onclick="data.setWeightRange('${r}')">${r === 'week' ? '周' : r === 'month' ? '月' : '年'}</button>`).join('')}
            </div>
            ${this.renderWeightChart()}
            <div class="weight-analysis">
                <div><b>${analysis.avgText}</b><small>日均变化</small></div>
                <div><b>${analysis.trend}</b><small>阶段判断</small></div>
            </div>
            ${recentWeights.length ? `<div class="weight-history-card ${historyCollapsed ? 'collapsed' : ''}">
                <button class="weight-history-head" onclick="data.toggleCollapse('weightHistory')" type="button">
                    <span class="material-symbols-rounded">history</span>
                    <strong>近期记录</strong>
                    <small>${recentWeights.length} 条</small>
                    <span class="material-symbols-rounded">${historyCollapsed ? 'expand_more' : 'expand_less'}</span>
                </button>
                <div class="weight-history-content">
                    ${this.renderWeightList(recentWeights)}
                </div>
            </div>` : ''}
        </div>`;
        },

        renderWeightChart() {
            const points = this.weightPointsForRange();
            if (points.length < 2) return `<div class="weight-empty-chart"><span class="material-symbols-rounded">show_chart</span><p>至少需要 2 条记录生成曲线（当前 ${points.length} 条）</p></div>`;
            const values = points.map(p => p.weight);
            const min = Math.min(...values) - 0.5;
            const max = Math.max(...values) + 0.5;
            const width = 320;
            const height = 150;
            const pad = 18;
            const coords = points.map((p, i) => {
                const x = pad + (i / (points.length - 1)) * (width - pad * 2);
                const y = height - pad - ((p.weight - min) / (max - min || 1)) * (height - pad * 2);
                return { ...p, x, y };
            });
            const path = coords.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

            // 关键点：最低、最高、最新
            const minIdx = values.indexOf(Math.min(...values));
            const maxIdx = values.indexOf(Math.max(...values));
            const lastIdx = coords.length - 1;
            const labelIndices = new Set([minIdx, maxIdx, lastIdx]);
            const labels = coords.map((p, i) => labelIndices.has(i)
                ? `<text class="weight-dot-label" x="${p.x.toFixed(1)}" y="${(p.y - 8).toFixed(1)}" text-anchor="middle">${p.weight.toFixed(1)}</text>`
                : '').join('');

            const dots = coords.map((p, i) =>
                `<circle class="weight-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="6" data-date="${p.date}" data-weight="${p.weight}" onclick="data.showWeightTip(event, '${p.date}', ${p.weight})"><title>${p.date}: ${p.weight}kg</title></circle>`
            ).join('');

            return `<div class="weight-chart-wrap" id="weightChartWrap">
                <svg class="weight-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="体重变化曲线">
                    <path class="weight-grid-line" d="M${pad},${pad} H${width - pad} M${pad},${height / 2} H${width - pad} M${pad},${height - pad} H${width - pad}" />
                    <path class="weight-line" d="${path}" />
                    ${dots}
                    ${labels}
                </svg>
                <div class="weight-chart-tip" id="weightChartTip" style="display:none"></div>
                <div class="weight-chart-labels"><span>${points[0].date.slice(5)}</span><span>${points[points.length - 1].date.slice(5)}</span></div>
            </div>`;
        },

        renderWeightList(weights) {
            if (weights.length === 0) return '';
            return `<div class="weight-list">
            ${weights.map(w => `<div class="weight-list-item"><span>${w.date}</span><b>${w.weight.toFixed(1)} kg</b><button class="delete-btn" onclick="data.deleteWeight('${w.id}')"><span class="material-symbols-rounded">delete</span></button></div>`).join('')}
        </div>`;
        },

        sortedWeights() {
            return [...this.activeRecords(this.db.health?.weights || [])].sort((a, b) => this.dateFromKey(a.date) - this.dateFromKey(b.date));
        },

        weightPointsForRange() {
            const days = this.weightRange === 'week' ? 7 : this.weightRange === 'month' ? 31 : 366;
            const cutoffKey = this.dateKey(new Date(this.logicalDayStart().getTime() - days * 86400000));
            return this.sortedWeights().filter(w => w.date >= cutoffKey);
        },

        weightAnalysis() {
            const points = this.weightPointsForRange();
            if (points.length < 2) return { avgText: '-- kg/日', trend: '记录不足' };
            const first = points[0];
            const last = points[points.length - 1];
            const days = Math.max(1, Math.round((this.dateFromKey(last.date) - this.dateFromKey(first.date)) / 86400000));
            const total = last.weight - first.weight;
            const avg = total / days;
            const trend = Math.abs(avg) < 0.01 ? '基本不变' : avg < 0 ? '下降趋势' : '上升趋势';
            return { avgText: `${avg > 0 ? '+' : ''}${avg.toFixed(2)} kg/日`, trend };
        },

        saveHeight(val) {
            const h = parseFloat(val);
            if (h > 0) { this.db.health.height = h; this.save({ render: false }); this.renderHistory(); }
        },

        showWeightTip(event, date, weight) {
            const wrap = document.getElementById('weightChartWrap');
            const tip = document.getElementById('weightChartTip');
            if (!wrap || !tip) return;
            const rect = wrap.getBoundingClientRect();
            const x = (event.clientX || (event.touches && event.touches[0]?.clientX) || 0) - rect.left;
            tip.style.display = 'block';
            tip.style.left = Math.max(8, Math.min(rect.width - 80, x - 40)) + 'px';
            tip.textContent = `${date}  ${Number(weight).toFixed(1)} kg`;
            clearTimeout(this._weightTipTimer);
            this._weightTipTimer = setTimeout(() => { tip.style.display = 'none'; }, 2200);
        }
    };
})();
