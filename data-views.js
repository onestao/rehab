(function () {
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
            if (activePage === 'records') return safe('renderRecordsPage', () => this.renderRecordsPage?.());
            if (activePage === 'ai-coach') return safe('renderAiCoachPage', () => this.renderAiCoachPage?.());
            if (activePage === 'profile') return safe('renderProfilePage', () => this.renderProfilePage?.());
        },

        renderTodayPage() {
            const overview = document.getElementById('todayOverview');
            const quickActions = document.getElementById('todayQuickActions');
            const timeline = document.getElementById('todayTimeline');
            const aiCard = document.getElementById('todayAiCard');
            if (overview) overview.innerHTML = this.renderRecordOverview();
            if (quickActions) quickActions.innerHTML = this.renderRecordQuickActions();
            if (timeline) timeline.innerHTML = this.renderTodayTimeline();
            if (aiCard) aiCard.innerHTML = this.renderContextAiCard?.('today') || '';
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
            if (overview) overview.innerHTML = '';
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
                        this.renderManualExercisePanel() +
                        '<div class="record-section-title">最近训练记录</div>' +
                        this.renderRecentHistoryList(5) +
                        (this.renderContextAiCard?.('exercise') || '');
                case 'calendar':
                    return '<div class="record-section-title">记录日历</div>' +
                        (this.renderVolumeHeatmap?.() || '') +
                        (this.renderPrLeaderboard?.() || '') +
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
                content.innerHTML = this.renderAdvicePanel();
                requestAnimationFrame(() => this.autoResizeAdvicePrompt?.());
                requestAnimationFrame(() => {
                    this.bindAdviceScrollListener?.();
                    this.restoreAdviceScroll?.();
                });
            }
        }
    };

    document.addEventListener('click', function (e) {
        var btn = e.target.closest('.context-ai-btn');
        if (!btn) return;
        var ctx = btn.dataset.aiCtx;
        var idx = Number(btn.dataset.aiIdx);
        if (!ctx || isNaN(idx)) return;
        var list = data.contextAiPrompts?.(ctx);
        if (list && list[idx]) data.askContextAi(ctx, list[idx].prompt);
    }, { passive: true });

    window.addEventListener('ai:ready', function () {
        if (!window.data?.db) return;
        var active = document.querySelector('.page.active')?.id;
        if (active) window.dataViews.render(active);
    });
})();
