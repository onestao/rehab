// @ts-nocheck
const adviceRules = {
    diagnose(ctx) {
        const rules = [
            this._proteinDeficit,
            this._trainingGap,
            this._weightPlateau,
            this._excessDeficit,
            this._trainingStreak,
        ];
        for (const rule of rules) {
            const hit = rule.call(this, ctx);
            if (hit) return hit;
        }
        return null;
    },

    renderInsightHeader(ctx) {
        const diag = ctx.diag;
        if (!diag) return this._renderFallbackHeader(ctx);
        const esc = window.renderSafe?.escapeHtml || window.data?.escapeHtml || (s => s);
        const sourceTag = diag.source === 'llm'
            ? '<span class="ai-insight-tag">规则 + AI</span>'
            : '<span class="ai-insight-tag">规则 · 已命中</span>';
        const badge = diag.badge
            ? `<span class="ai-insight-badge alert">${esc(diag.badge)}</span>`
            : '';
        const planBadge = ctx.planProgress
            ? `<span class="ai-insight-badge train">${esc(ctx.planProgress)}</span>`
            : '';
        return `
            <div class="ai-insight-header" onclick="data.toggleAiInsight()">
                <div class="ai-avatar"><span class="material-symbols-rounded">psychology</span></div>
                <div class="ai-insight-hd-text">
                    <div class="ai-insight-kicker">今日洞察 ${sourceTag}</div>
                    <div class="ai-insight-title">${esc(diag.title)}</div>
                    <div class="ai-insight-sub">${esc(diag.subtitle)}</div>
                </div>
                <div class="ai-insight-badges">${planBadge}${badge}</div>
                <div class="ai-insight-chevron"><span class="material-symbols-rounded">expand_more</span></div>
            </div>`;
    },

    renderInsightBaseline(ctx) {
        const esc = window.renderSafe?.escapeHtml || window.data?.escapeHtml || (s => s);
        const m = ctx.metrics || {};
        const up = (v) => `<span class="ai-metric-up">${esc(String(v))}</span>`;
        const warn = (v) => `<span class="ai-metric-warn">${esc(String(v))}</span>`;
        const val = (v) => esc(String(v));

        const volumeDelta = m.volumeDelta != null
            ? (m.volumeDelta > 0 ? up('+' + m.volumeDelta + '%') : val(m.volumeDelta + '%'))
            : '--';
        const daysSince = m.daysSinceMuscle != null ? val(m.daysSinceMuscle) : '--';
        const weekDeficit = m.weekDeficit != null
            ? (m.weekDeficit < -500 ? warn(m.weekDeficit) : val(m.weekDeficit))
            : '--';

        const planLine = ctx.planCompact || '';

        return `
            <div class="ai-insight-baseline">
                <div class="ai-insight-metrics">
                    <div class="ai-im"><div class="ai-im-l">本周训练量</div><div class="ai-im-v">${volumeDelta}</div></div>
                    <div class="ai-im"><div class="ai-im-l">部位间隔</div><div class="ai-im-v">${daysSince}<span class="ai-im-u">天</span></div></div>
                    <div class="ai-im"><div class="ai-im-l">7天热量</div><div class="ai-im-v">${weekDeficit}</div></div>
                </div>
                ${planLine}
            </div>`;
    },

    renderInsightExpandable(ctx) {
        const esc = window.renderSafe?.escapeHtml || window.data?.escapeHtml || (s => s);
        const a = ctx.analysis || {};
        const delta = (v, label) => {
            if (v == null) return '';
            if (typeof v === 'number') {
                return v > 0
                    ? `<span class="ai-ana-delta up">${esc('+' + (typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(0) : v) + '%')}</span>`
                    : `<span class="ai-ana-delta flat">${esc(v + '%')}</span>`;
            }
            return `<span class="ai-ana-delta up">${esc(String(v))}</span>`;
        };

        const cells = [];
        if (a.weeklyVolumeLoad != null) {
            cells.push(`<div class="ai-ana-cell"><div class="ai-ana-l">本周训练负荷</div><div class="ai-ana-v">${esc(String(a.weeklyVolumeLoad))} ${delta(a.volumeDelta)}</div><div class="ai-ana-h">vs 上周 ${esc(String(a.lastWeekVolumeLoad || '--'))} kg·rep</div></div>`);
        }
        if (a.prDistance != null) {
            cells.push(`<div class="ai-ana-cell"><div class="ai-ana-l">距 PR 距离</div><div class="ai-ana-v">${esc(String(a.prDistance))}<span class="ai-ana-delta up">本月新近</span></div><div class="ai-ana-h">${esc(a.prLift || '最近动作')} PR ${esc(String(a.prWeight || '--'))}</div></div>`);
        }
        if (a.streakDays != null) {
            const streakTag = a.streakDays >= 3
                ? '<span class="ai-ana-delta flat">天</span>'
                : '<span class="ai-ana-delta flat">天</span>';
            cells.push(`<div class="ai-ana-cell"><div class="ai-ana-l">连续训练</div><div class="ai-ana-v">${esc(String(a.streakDays))} ${streakTag}</div><div class="ai-ana-h">${a.streakDays >= 3 ? '建议轻量或休息' : '状态良好'}</div></div>`);
        }
        if (a.pushPullRatio) {
            cells.push(`<div class="ai-ana-cell"><div class="ai-ana-l">部位均衡</div><div class="ai-ana-v">推:拉</div><div class="ai-ana-h">${esc(a.pushPullRatio)}</div></div>`);
        }

        const recoveryBar = a.recoveryIndex != null
            ? `<div class="ai-recovery-row"><span class="ai-recovery-l">恢复指数</span><div class="ai-recovery-bar"><div class="ai-recovery-fill" style="width:${Math.min(100, Math.max(0, a.recoveryIndex))}%"></div></div><span class="ai-recovery-v">${esc(String(a.recoveryIndex))}%</span></div>`
            : '';

        const llmBlock = ctx.llmHtml
            ? ctx.llmHtml
            : `<div class="ai-llm-block ai-llm-skeleton"><div class="ai-llm-label"><span class="ai-llm-dot"></span> AI 正在生成具体建议…</div><div class="ai-llm-line"></div><div class="ai-llm-line"></div><div class="ai-llm-line ai-llm-short"></div></div>`;

        const offlineNote = ctx.offline
            ? '<div class="ai-offline-note"><span class="material-symbols-rounded" style="font-size:16px">cloud_off</span>暂时无法连接 AI 服务，已切换到本地建议库。</div>'
            : '';

        return `
            <div class="ai-insight-body">
                <div class="ai-insight-body-inner">
                    <div class="ai-insight-divider"></div>
                    ${cells.length ? `<div class="ai-analysis-block"><div class="ai-analysis-head"><span>📊 训练分析</span></div><div class="ai-analysis-grid">${cells.join('')}</div>${recoveryBar}</div>` : ''}
                    ${offlineNote}
                    ${llmBlock}
                </div>
            </div>`;
    },

    _renderFallbackHeader(ctx) {
        const esc = window.renderSafe?.escapeHtml || window.data?.escapeHtml || (s => s);
        const planBadge = ctx.planProgress
            ? `<span class="ai-insight-badge train">${esc(ctx.planProgress)}</span>`
            : '';
        return `
            <div class="ai-insight-header" onclick="data.toggleAiInsight()">
                <div class="ai-avatar"><span class="material-symbols-rounded">psychology</span></div>
                <div class="ai-insight-hd-text">
                    <div class="ai-insight-kicker">今日洞察</div>
                    <div class="ai-insight-title">今日建议</div>
                    <div class="ai-insight-sub">点击展开查看详情</div>
                </div>
                <div class="ai-insight-badges">${planBadge}</div>
                <div class="ai-insight-chevron"><span class="material-symbols-rounded">expand_more</span></div>
            </div>`;
    },

    /* --- Rule implementations --- */

    _proteinDeficit({ macros, bodyWeight, goalType }) {
        if (!macros || !bodyWeight) return null;
        const target = goalType === 'gain' ? 1.6 : 1.2;
        const perKg = macros.pro / bodyWeight;
        if (perKg >= target * 0.85) return null;
        const deficitG = Math.round((target * bodyWeight) - macros.pro);
        if (deficitG <= 5) return null;
        return {
            id: 'protein_deficit',
            title: '蛋白质缺口 ' + deficitG + 'g',
            subtitle: '近N天均蛋白 ' + perKg.toFixed(1) + ' g/kg，目标 ' + target + ' g/kg',
            badge: '↓' + deficitG + 'g',
            source: 'rule',
            data: { deficitG, perKg, target },
        };
    },

    _trainingGap({ dailyPlans, today }) {
        if (!dailyPlans || !today) return null;
        const recentDates = [];
        for (let i = 1; i <= 7; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            recentDates.push(d.toISOString().slice(0, 10));
        }
        const activeDays = recentDates.filter(date =>
            dailyPlans.some(p => p.date === date && !p.deleted)
        );
        const gap = activeDays.length === 0 ? 7 : (() => {
            const last = activeDays[0];
            return Math.round((new Date(today) - new Date(last)) / 86400000);
        })();
        if (gap < 3) return null;
        return {
            id: 'training_gap',
            title: '训练断档 ' + gap + ' 天',
            subtitle: '连续 ' + gap + ' 天无训练记录',
            badge: gap + '天未练',
            source: 'rule',
            data: { gap },
        };
    },

    _weightPlateau({ weights, goalType }) {
        if (!weights || weights.length < 5 || goalType !== 'loss') return null;
        const recent = weights.slice(-14);
        if (recent.length < 5) return null;
        const first = Number(recent[0].weight);
        const last = Number(recent[recent.length - 1].weight);
        const delta = Math.abs(last - first);
        if (delta >= 0.5) return null;
        return {
            id: 'weight_plateau',
            title: '体重停滞',
            subtitle: '近' + recent.length + '天体重均值变化 < 0.5kg',
            badge: '停滞',
            source: 'rule',
            data: { delta },
        };
    },

    _excessDeficit({ weekDeficit }) {
        if (weekDeficit == null || weekDeficit >= -800) return null;
        return {
            id: 'excess_deficit',
            title: '赤字过大',
            subtitle: '近7天平均赤字 ' + Math.abs(weekDeficit) + ' kcal',
            badge: '⚠ 赤字',
            source: 'rule',
            data: { weekDeficit },
        };
    },

    _trainingStreak({ dailyPlans, today }) {
        if (!dailyPlans || !today) return null;
        let streak = 0;
        for (let i = 0; i < 14; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            if (dailyPlans.some(p => p.date === key && !p.deleted)) streak++;
            else break;
        }
        if (streak < 5) return null;
        return {
            id: 'training_streak',
            title: '连续训练 ' + streak + ' 天',
            subtitle: '连续高强度训练，建议安排轻量日或休息',
            badge: streak + '天连练',
            source: 'rule',
            data: { streak },
        };
    },

    /* --- Local templates for offline LLM fallback --- */

    renderLocalAdvice(diag) {
        if (!diag) return '';
        const templates = {
            protein_deficit: (d) => `按 ${d.target} g/kg × 体重估算，今日还需 ≈${d.deficitG}g 蛋白。<ul><li>鸡胸 150g + 1 杯希腊酸奶</li><li>或：3 个鸡蛋 + 1 勺蛋白粉</li></ul>`,
            training_gap: (d) => `连续 ${d.gap} 天未训练，建议：<ul><li>从轻量恢复训练开始</li><li>降低训练量至上次的 60-70%</li></ul>`,
            weight_plateau: () => `<ul><li>检查近期饮食是否有隐形热量</li><li>考虑调整训练强度或增加有氧</li><li>建议重新评估 TDEE</li></ul>`,
            excess_deficit: (d) => `近7天赤字 ${Math.abs(d.weekDeficit)} kcal，风险提示：<ul><li>过大赤字可能导致肌肉流失</li><li>建议适当增加摄入 200-300 kcal</li></ul>`,
            training_streak: (d) => `连续 ${d.streak} 天训练，建议：<ul><li>明日安排轻量或完全休息</li><li>关注睡眠和恢复</li></ul>`,
        };
        const fn = templates[diag.id];
        return fn ? `<div class="ai-llm-block"><div class="ai-llm-label"><span class="material-symbols-rounded" style="font-size:14px">auto_awesome</span> 本地建议</div>${fn(diag.data)}</div>` : '';
    },

    attach(target) {
        Object.assign(target, {
            diagnoseInsight: this.diagnose.bind(this),
            renderInsightHeader: this.renderInsightHeader.bind(this),
            renderInsightBaseline: this.renderInsightBaseline.bind(this),
            renderInsightExpandable: this.renderInsightExpandable.bind(this),
            renderLocalAdvice: this.renderLocalAdvice.bind(this),
        });
    },
};

if (typeof window !== 'undefined') {
    window.adviceRules = adviceRules;
    if (window.data) adviceRules.attach(window.data);
}
