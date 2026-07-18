(function () {
    const TODAY_SLOT_IDS = [
        'todayOverview',
        'todayQuickActions',
        'todayPlanStatus',
        'todayDietStatus',
        'todayTimeline',
        'todayAiCard'
    ];

    function isBlank(value) {
        return !String(value || '').trim();
    }

    function slotMeta(el) {
        if (!el) return null;
        if (!el.dataset || typeof el.dataset !== 'object') el.dataset = {};
        return el.dataset;
    }

    function staticQuickDockPlaceholder() {
        return `<div class="quick-dock today-quick-skeleton" aria-busy="true" aria-label="快捷操作加载中">
            <div class="record-quick-btn is-placeholder" aria-hidden="true"><span class="material-symbols-rounded">monitor_weight</span><span>记体重</span></div>
            <div class="record-quick-btn is-placeholder" aria-hidden="true"><span class="material-symbols-rounded">restaurant</span><span>记饮食</span></div>
            <div class="record-quick-btn is-placeholder" aria-hidden="true"><span class="material-symbols-rounded">fitness_center</span><span>记运动</span></div>
            <div class="record-quick-btn is-placeholder record-quick-btn-ai" aria-hidden="true"><span class="material-symbols-rounded">psychology</span><span>问 AI</span></div>
        </div>`;
    }

    function staticTodaySkeleton(slotId) {
        if (slotId === 'todayQuickActions') return staticQuickDockPlaceholder();
        if (slotId === 'todayOverview') {
            return `<div class="hero today-shell-skeleton" aria-busy="true">
                <div class="hero-head"><div><div class="hero-label">今日概览</div><div class="hero-title">加载中</div></div></div>
                <div class="rings">
                    <div class="ring ring-diet is-placeholder" aria-hidden="true"><div><b>--</b><small>摄入</small><em>准备中</em></div></div>
                    <span class="ring-divider" aria-hidden="true"></span>
                    <div class="ring ring-train is-placeholder" aria-hidden="true"><div><b>--</b><small>训练</small><em>准备中</em></div></div>
                </div>
            </div>`;
        }
        if (slotId === 'todayPlanStatus') {
            return `<div class="sect-head"><span class="t">当前训练计划</span></div>
                <div class="glass-card plan-card today-shell-skeleton" aria-busy="true">
                    <div class="plan-head"><div><div class="pt">准备中</div><div class="pn">训练区加载中</div></div></div>
                    <div class="plan-meta"><span>计划模块到达后显示任务</span></div>
                </div>`;
        }
        if (slotId === 'todayDietStatus') {
            return `<div class="sect-head"><span class="t">饮食摄入</span></div>
                <div class="glass-card today-shell-skeleton" aria-busy="true">
                    <div class="calorie-head"><div><span class="num">--</span><span class="unit">kcal</span></div></div>
                    <div class="plan-meta"><span>饮食摘要加载中</span></div>
                </div>`;
        }
        if (slotId === 'todayTimeline') {
            return `<div class="md-card today-timeline-card today-shell-skeleton" aria-busy="true">
                <div class="today-timeline-header"><span class="material-symbols-rounded">timeline</span><strong>今日时间线</strong><small>加载中</small></div>
            </div>`;
        }
        if (slotId === 'todayAiCard') {
            return `<div class="md-card today-shell-skeleton" aria-busy="true" style="padding:16px">
                <div class="plan-meta"><span>AI 提醒加载中</span></div>
            </div>`;
        }
        return '';
    }

    function ensureTodayShellSkeleton() {
        TODAY_SLOT_IDS.forEach((id) => {
            const el = document.getElementById(id);
            if (!el || !isBlank(el.innerHTML)) return;
            el.innerHTML = staticTodaySkeleton(id);
            slotMeta(el).todayShell = 'skeleton';
        });
    }

    function fillTodaySlot(el, html, slotId) {
        if (!el) return;
        const meta = slotMeta(el);
        const next = String(html || '');
        if (isBlank(next)) {
            if (isBlank(el.innerHTML) || meta.todayShell === 'skeleton') {
                el.innerHTML = staticTodaySkeleton(slotId);
                meta.todayShell = 'skeleton';
            }
            return;
        }
        if (slotId === 'todayQuickActions' && meta.todayShell === 'ready' && typeof el.querySelectorAll === 'function') {
            const currentKeys = Array.from(el.querySelectorAll('[data-q]')).map((node) => node.dataset?.q || '');
            const nextKeys = Array.from(next.matchAll(/data-q=["']([^"']+)["']/g), (match) => match[1]);
            if (currentKeys.length && currentKeys.join('|') === nextKeys.join('|')) return;
        }
        el.innerHTML = next;
        meta.todayShell = 'ready';
        if (typeof el.removeAttribute === 'function') el.removeAttribute('aria-busy');
    }

    window.dataViews = {
        render(pageId) {
            const safe = (label, fn) => {
                try { fn(); } catch (e) { console.error('[render] ' + label + ' failed', e); }
            };
            const activePage = pageId || document.querySelector('.page.active')?.id || 'today';
            if (activePage === 'workout') {
                safe('renderActions', () => this.renderActions?.());
                safe('renderWorkoutPlanCard', () => this.renderWorkoutPlanCard?.());
                return;
            }
            if (activePage === 'today') return safe('renderTodayPage', () => this.renderTodayPage?.());
            if (activePage === 'records') {
                safe('renderRecordsPage', () => this.renderRecordsPage?.());
                return;
            }
            if (activePage === 'ai-coach') {
                safe('renderAiCoachPage', () => this.renderAiCoachPage?.());
                return;
            }
            if (activePage === 'profile') {
                safe('renderProfilePage', () => this.renderProfilePage?.());
            }
        },

        ensureTodayShellSkeleton,

        renderTodayPage() {
            const ctx = window.data || this;
            ensureTodayShellSkeleton();
            const overview = document.getElementById('todayOverview');
            const quickActions = document.getElementById('todayQuickActions');
            const planStatus = document.getElementById('todayPlanStatus');
            const dietStatus = document.getElementById('todayDietStatus');
            const timeline = document.getElementById('todayTimeline');
            const aiCard = document.getElementById('todayAiCard');

            fillTodaySlot(overview, ctx.renderPlanTodaySection?.() || '', 'todayOverview');
            fillTodaySlot(quickActions, ctx.renderTodayActionDock?.() || '', 'todayQuickActions');
            fillTodaySlot(planStatus, ctx.renderTodayV6PlanCard?.() || '', 'todayPlanStatus');
            fillTodaySlot(dietStatus, ctx.renderTodayV6DietCard?.() || '', 'todayDietStatus');
            fillTodaySlot(timeline, ctx.renderTodayTimeline?.() || '', 'todayTimeline');

            if (aiCard) {
                let aiHtml = ctx.renderTodayAiReminder?.() || ctx.renderContextAiCard?.('today') || '';
                if (ctx.renderWeeklyAiInsightCard) aiHtml += ctx.renderWeeklyAiInsightCard();
                fillTodaySlot(aiCard, aiHtml, 'todayAiCard');
            }

            ctx.bindPlanQuickRepeat?.();
            ctx.updateTodayV6Greet?.();
        },

        renderDietPage() {
            const content = document.getElementById('dietContent');
            const aiCard = document.getElementById('dietAiCard');
            if (content) content.innerHTML = this.renderDietPanel();
            if (aiCard) aiCard.innerHTML = this.renderContextAiCard?.('diet') || '';
            requestAnimationFrame(() => this.autoResizeDietInput?.());
        },

        renderRecordsPage() {
            const overview = document.getElementById('recordsOverview');
            const content = document.getElementById('recordsContent');
            if (overview) overview.innerHTML = this.renderRecordsV6Overview?.() || '';
            if (content) {
                content.innerHTML = `
                ${this.renderHealthTabs()}
                ${this.renderHealthSwipeDeck()}`;
            }
            requestAnimationFrame(() => {
                this.syncHealthDeckPosition(false);
                this.updateHealthSwipeEffects();
                if (this.healthView === 'diet') this.autoResizeDietInput?.();
            });
        },

        renderHealthView() {
            switch (this.healthView) {
                case 'weight':
                    return this.renderWeightPanel() + (this.renderContextAiCard?.('weight') || '');
                case 'training':
                    return this.renderHealthProfileCard() +
                        (this.renderRehabWeeklyCard?.() || '') +
                        this.renderManualExercisePanel() +
                        '<div class="record-section-title">最近训练记录</div>' +
                        this.renderRecentHistoryList(5) +
                        (this.renderTrainingReviewSection?.() || '') +
                        (this.renderContextAiCard?.('exercise') || '');
                case 'calendar':
                    return '<div class="record-section-title">记录日历</div>' +
                        this.renderHistoryCalendar() +
                        this.renderCalendarDayDetail() +
                        '<div class="record-section-title">历史明细</div>' +
                        this.renderHistoryList();
                case 'diet':
                default:
                    return this.renderDietPanel() + (this.renderContextAiCard?.('diet') || '');
            }
        },

        renderAiCoachPage() {
            const content = document.getElementById('aiCoachContent');
            if (content && typeof this.renderAdvicePanel === 'function') {
                try {
                    if (window.advicePanel && typeof advicePanel.attach === 'function') advicePanel.attach(this);
                    content.innerHTML = this.renderAdvicePanel();
                } catch (e) {
                    if (window.advicePanel && typeof advicePanel.attach === 'function') {
                        advicePanel.attach(this);
                        content.innerHTML = this.renderAdvicePanel();
                    } else {
                        throw e;
                    }
                }
                requestAnimationFrame(() => {
                    this.autoResizeAdvicePrompt?.();
                    this.bindAdviceAttachmentControls?.();
                    this.updateAdviceSendState?.();
                });
                requestAnimationFrame(() => {
                    this.refreshAdviceSearchResults?.();
                    this.bindAdviceScrollListener?.();
                    this.restoreAdviceScroll?.();
                    requestAnimationFrame(() => this.syncAdviceTopChromeToScroll?.());
                });
            }
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if ((document.querySelector('.page.active')?.id || 'today') === 'today') {
                ensureTodayShellSkeleton();
            }
        }, { once: true });
    } else if ((document.querySelector('.page.active')?.id || 'today') === 'today') {
        ensureTodayShellSkeleton();
    }

    document.addEventListener('click', function (e) {
        var target = e.target;
        if (!(target instanceof Element)) return;
        var btn = target.closest('.context-ai-btn');
        if (!btn) return;
        if (!(btn instanceof HTMLElement)) return;
        var ctx = btn.dataset.aiCtx;
        var idx = Number(btn.dataset.aiIdx);
        if (!ctx || isNaN(idx)) return;
        if (btn.closest('.summary-sheet-overlay')) data.closeSummarySheet?.();
        var list = data.contextAiPrompts?.(ctx);
        if (list && list[idx]) data.askContextAi(ctx, list[idx].prompt);
    }, { passive: true });

    if (typeof window.addEventListener === 'function') {
        window.addEventListener('ai:ready', function () {
            if (!window.data?.db) return;
            var active = document.querySelector('.page.active')?.id;
            if (active) window.dataViews.render(active);
        });
    }
})();
