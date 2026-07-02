// @ts-nocheck
Object.assign(workout, {
    prevAction() {
        // Minimal, safe fallback: restart current phase/set.
        if (!this.isPlaying) return;
        if (window.workoutEngine?.state) {
            workoutEngine.state.phase = 'announceSet';
            workoutEngine.state.phaseLeft = null;
            workoutEngine.state.phaseSub = '';
            workoutEngine.state.phaseStatus = '';
            workout.abortCurrentPhaseWait?.();
            try { window.dispatchEvent(new CustomEvent('workout:state', { detail: { status: this.isPaused ? 'paused' : 'playing', phase: workoutEngine.state.phase, action: workoutEngine.state.activeAction, set: workoutEngine.state.setIndex, rep: workoutEngine.state.repIndex } })); } catch {}
        }
    },
    updateRate(val) {
        data.db.rate = parseFloat(val);
        document.getElementById('rateLabel').innerText = val;
        data.save({ render: false });
    },

    updateStateClasses() {
        document.body.classList.toggle('is-training', this.isPlaying);
        document.body.classList.toggle('is-paused', this.isPlaying && this.isPaused);
        document.body.classList.toggle('is-cardio-mode', this.mode === 'cardio');
        document.body.classList.toggle('is-strength-log-mode', this.mode === 'strengthLog');
        const controls = document.querySelector('.workout-controls');
        if (controls) {
            const hideControls = this.mode === 'strengthLog';
            controls.classList.toggle('hidden', hideControls);
            controls.setAttribute('aria-hidden', String(hideControls));
        }
        const tweak = document.getElementById('timerTweak');
        if (tweak) tweak.classList.toggle('hidden', !this.isPlaying);
        this.updatePipButton();
        this.renderPip();
        const prev = document.getElementById('prevBtn');
        if (prev) prev.classList.toggle('hidden', !this.isPlaying);
        window.data?.updatePlanWorkoutBanner?.();
        window.rehabDock?.render?.(document.querySelector('.page.active')?.id || 'workout');
    },

    tweakPhase(delta) {
        if (!this.isPlaying) return;
        if (this._phaseLeft == null) return;
        const next = Math.max(0, this._phaseLeft + delta);
        this._phaseLeft = next;
        if (window.workoutEngine?.state) workoutEngine.state.phaseLeft = next;
        const el = document.getElementById('mainTime');
        if (el) el.innerText = next;
        this.renderPip();
        if (window.workoutState) workoutState.markActive();
        if (next === 0 && this._countResolve) {
            this._countResolve();
            this._countResolve = null;
            clearInterval(this.timer);
        }
    },

    setTrainingPaused(paused) {
        if (!this.isPlaying) return;
        window.haptics?.light?.();
        const nextPaused = !!paused;
        if (this.mode === 'cardio') {
            cardio.isPaused = nextPaused;
            this.isPaused = nextPaused;
            document.body.classList.toggle('is-cardio-paused', nextPaused);
        } else {
            this.isPaused = nextPaused;
            if (!nextPaused) window.speechSynthesis.resume();
        }
        if (nextPaused) (window.workoutVoice?.cancel?.() ?? window.speechSynthesis.cancel());
        window.errorBus?.event?.('workout', nextPaused ? 'pause' : 'resume', { mode: this.mode, phase: window.workoutEngine?.state?.phase || '', phaseLeft: this._phaseLeft });
        document.getElementById('playIcon').innerText = nextPaused ? 'play_arrow' : 'pause';
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = nextPaused ? 'paused' : 'playing';
        this.syncPipVideoElement(!nextPaused);
        if (!nextPaused) {
            this.reinforceKeepAlive();
        }
        this.updateStateClasses();
        try {
            window.dispatchEvent(new CustomEvent('workout:state', {
                detail: { status: this.isPlaying ? (this.isPaused ? 'paused' : 'playing') : 'idle', phase: window.workoutEngine?.state?.phase || '', action: window.workoutEngine?.state?.activeAction || null, set: window.workoutEngine?.state?.setIndex || 0, rep: window.workoutEngine?.state?.repIndex || 0 }
            }));
        } catch {}
    },

    setMode(mode) {
        if (this.isPlaying) return alert('训练中不能切换模式');
        this.mode = mode;
        document.getElementById('modeStrengthBtn').classList.toggle('active', mode === 'strength');
        document.getElementById('modeCardioBtn').classList.toggle('active', mode === 'cardio');
        document.getElementById('modeStrengthLogBtn').classList.toggle('active', mode === 'strengthLog');
        document.getElementById('modeStrengthBtn').setAttribute('aria-selected', String(mode === 'strength'));
        document.getElementById('modeCardioBtn').setAttribute('aria-selected', String(mode === 'cardio'));
        document.getElementById('modeStrengthLogBtn').setAttribute('aria-selected', String(mode === 'strengthLog'));
        document.getElementById('modeStrengthBtn').setAttribute('aria-pressed', String(mode === 'strength'));
        document.getElementById('modeCardioBtn').setAttribute('aria-pressed', String(mode === 'cardio'));
        document.getElementById('modeStrengthLogBtn').setAttribute('aria-pressed', String(mode === 'strengthLog'));
        document.getElementById('strengthCard').classList.toggle('hidden', mode !== 'strength');
        document.querySelector('.cardio-card').classList.toggle('hidden', mode !== 'cardio');
        document.getElementById('strengthLogCard').classList.toggle('hidden', mode !== 'strengthLog');
        document.getElementById('currentActionList').classList.toggle('hidden', mode !== 'strength');
        document.querySelector('.routine-tool').classList.toggle('hidden', mode !== 'strength');
        this.resetMainPanel();
        this.updateStateClasses();
        if (mode === 'cardio') cardio.updatePlan();
    },

    resetMainPanel() {
        document.getElementById('statusText').innerText = this.mode === 'cardio' ? 'CARDIO' : 'READY';
        document.getElementById('mainTime').innerText = this.mode === 'cardio' ? '00:00' : '00';
        document.getElementById('subText').innerText = this.mode === 'cardio' ? '准备有氧训练' : this.nextStrengthActionLabel?.() || '准备就绪';
        if (this.mode === 'cardio') {
            const plan = cardio.currentPlan();
            document.querySelectorAll('.stat-label')[0].innerText = '热量';
            document.getElementById('sessionTime').innerText = '0 kcal';
            document.querySelectorAll('.stat-label')[1].innerText = '强度';
            document.getElementById('curSet').innerText = plan.met;
            document.getElementById('totalSet').innerText = 'MET';
            document.querySelectorAll('.stat-label')[2].innerText = '目标';
            document.getElementById('curRep').innerText = plan.target;
            document.getElementById('totalRep').innerText = '分';
            return;
        }
        document.querySelectorAll('.stat-label')[0].innerText = '总用时';
        document.getElementById('sessionTime').innerText = '00:00';
        document.querySelectorAll('.stat-label')[1].innerText = '组数';
        document.getElementById('curSet').innerText = '0';
        document.getElementById('totalSet').innerText = '0';
        document.querySelectorAll('.stat-label')[2].innerText = '次数';
        document.getElementById('curRep').innerText = '0';
        document.getElementById('totalRep').innerText = '0';
    },

    nextStrengthActionLabel() {
        const planActions = data._planActions ? data._planActions() : data.activeRecords(data.db.actions || []).filter(a => !a.libOnly);
        const action = planActions.find(a => a && !a.deleted && !a.libOnly);
        if (action?.name) return action.name;
        const todayPlans = data.getTodayDailyPlans?.() || [];
        const task = todayPlans
            .flatMap(plan => (plan.items || []).filter(item => !item.deleted && item.status !== 'done' && item.status !== 'skipped'))
            .sort((a, b) => {
                const order = { 'in-progress': 0, todo: 1 };
                return (order[a.status] ?? 9) - (order[b.status] ?? 9);
            })[0];
        return task?.name || '';
    },

    async toggle() {
        window.haptics?.light?.();
        const fab = document.getElementById('playBtn');
        if (fab) {
            const r = document.createElement('span');
            r.className = 'ripple';
            fab.appendChild(r);
            setTimeout(() => r.remove(), 600);
        }
        if (this.mode === 'cardio') return cardio.toggle();
        if (!this.isPlaying) {
            const plannedActions = data._planActions ? data._planActions() : data.activeRecords(data.db.actions || []).filter(a => !a.libOnly);
            if (plannedActions.length === 0) return;
            window.errorBus?.event?.('workout', 'start', { mode: this.mode, actionCount: plannedActions.length });
            window.workoutReadiness?.notifyBeforeStart?.();
            window.workoutVoice?.unlockAudio?.();
            this.isPlaying = true; this.isPaused = false; this.totalSec = 0;
            if (window.workoutEngine) workoutEngine.state = workoutEngine.createInitialState();
            this.updateStateClasses();
            const firstAction = this.nextStrengthActionLabel?.();
            if (firstAction) {
                document.getElementById('statusText').innerText = 'NEXT';
                document.getElementById('subText').innerText = firstAction;
            }
            document.getElementById('playIcon').innerText = 'pause';
            document.getElementById('stopBtn').classList.remove('hidden');
            await this.acquireWakeLock();
            this.setupMediaSession();
            try { window.dispatchEvent(new CustomEvent('workout:state', { detail: { status: 'playing', phase: 'intro', action: null, set: 0, rep: 0 } })); } catch {}
            this.keepAudioAlive();
            this.initBackGuard();
            
            this._sessionLastTick = Date.now();
            this.sessionInt = setInterval(() => {
                if (this.isPaused) {
                    this._sessionLastTick = Date.now();
                    return;
                }
                const now = Date.now();
                const delta = Math.max(0, Math.floor((now - Number(this._sessionLastTick || now)) / 1000));
                if (delta <= 0) return;
                this._sessionLastTick = Number(this._sessionLastTick || now) + delta * 1000;
                this.totalSec += delta;
                this.updateUI();
            }, 1000);
            if (window.workoutState) workoutState.markActive();
            
            await this.speak("训练开始");
            if (window.workoutEngine) workoutEngine.start();
        } else {
            this.setTrainingPaused(!this.isPaused);
        }
    },

    async run() {
        if (window.workoutEngine) return workoutEngine.run();
    },

    count(sec, sub, status) {
        return new Promise(resolve => {
            this._phaseLeft = sec;
            this._phaseSub = sub;
            this._phaseStatus = status;
            this._phaseLastTick = Date.now();
            this._countResolve = resolve;
            document.getElementById('subText').innerText = sub;
            document.getElementById('statusText').innerText = status;
            document.getElementById('mainTime').innerText = this._phaseLeft;
            if (window.workoutState) workoutState.markActive();
            if (sec > 12 && status !== 'HOLD') this.speak(`${sub}，${sec}秒`);
            this.timer = setInterval(() => {
                if (!this.isPlaying || this.skipFlag) {
                    clearInterval(this.timer); this.skipFlag = false;
                    this._phaseLeft = null;
                    this._countResolve = null; resolve(); return;
                }
                if (this.isPaused) {
                    this._phaseLastTick = Date.now();
                    return;
                }
                const now = Date.now();
                const delta = Math.max(0, Math.floor((now - Number(this._phaseLastTick || now)) / 1000));
                if (delta <= 0) return;
                this._phaseLastTick = Number(this._phaseLastTick || now) + delta * 1000;
                this._phaseLeft = Math.max(0, Number(this._phaseLeft || 0) - delta);
                if (window.workoutEngine?.state) workoutEngine.state.phaseLeft = this._phaseLeft;
                document.getElementById('mainTime').innerText = this._phaseLeft;
                this.renderPip();
                if (window.workoutState) workoutState.markActive();
                if (this._phaseLeft <= 3 && this._phaseLeft > 0) this.speak(this._phaseLeft.toString());
                if (this._phaseLeft <= 0) { clearInterval(this.timer); this._phaseLeft = null; this._countResolve = null; resolve(); }
            }, 1000);
        });
    },

    skip() {
        if (!this.isPlaying) return;
        window.haptics?.medium?.();
        window.errorBus?.event?.('workout', 'skip', { mode: this.mode, phase: window.workoutEngine?.state?.phase || '', phaseLeft: this._phaseLeft });
        if (this.mode === 'strength' && window.workoutEngine?.skipCurrentPhase()) {
            document.getElementById('statusText').innerText = 'SKIP';
            document.getElementById('subText').innerText = '已跳过当前阶段';
            if (window.workoutState) workoutState.markActive();
            return;
        }
        this.abortCurrentPhaseWait();
        document.getElementById('statusText').innerText = 'SKIP';
        document.getElementById('subText').innerText = '已跳过当前阶段';
    },
    abortCurrentPhaseWait() {
        this.skipFlag = true;
        (window.workoutVoice?.cancel?.() ?? window.speechSynthesis.cancel());
        if (this._speakResolve) { this._speakResolve(); this._speakResolve = null; }
        if (this._countResolve) { this._countResolve(); this._countResolve = null; }
        clearInterval(this.timer);
        this._phaseLeft = null;
        this.skipFlag = false;
    },
    updateUI() {
        const m = Math.floor(this.totalSec/60).toString().padStart(2,'0');
        const s = (this.totalSec%60).toString().padStart(2,'0');
        document.getElementById('sessionTime').innerText = `${m}:${s}`;
        this._lastActiveAt = Date.now();
        this.renderPip();
        if (window.workoutState) workoutState.markActive();
    },
    stop() {
        if (this.mode === 'cardio') return cardio.stop();
        window.haptics?.medium?.();
        if(confirm("停止并保存记录？")) {
            window.errorBus?.event?.('workout', 'stop:confirmed', { mode: this.mode, duration: this.totalSec, phase: window.workoutEngine?.state?.phase || '' });
            this.isPlaying = false;
            if (this._countResolve) { this._countResolve(); this._countResolve = null; }
            this._manualStopRequested = true;
            this.finish();
        }
    },
    finish() {
        const duration = this.totalSec;
        const manualStop = !!this._manualStopRequested;
        window.errorBus?.event?.('workout', 'finish:start', { mode: this.mode, duration, manualStop });
        this._manualStopRequested = false;
        this.isPlaying = false;
        this.isPaused = false;
        this.updateStateClasses();
        clearInterval(this.timer); clearInterval(this.sessionInt);
        clearInterval(this._speechWatchdog); clearInterval(this._audioKeepAliveInt);
        this.closePip();
        (window.workoutVoice?.cancel?.() ?? window.speechSynthesis.cancel());
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
        this.releaseWakeLock();
        try { window.dispatchEvent(new CustomEvent('workout:state', { detail: { status: 'stopped', phase: 'completed', action: null, set: 0, rep: 0 } })); } catch {}
        this._phaseLeft = null;
        this._lastActiveAt = null;
        if (window.workoutEngine) workoutEngine.state = null;
        this._countResolve = null;
        this._speakResolve = null;
        document.getElementById('playIcon').innerText = 'play_arrow';
        document.getElementById('stopBtn').classList.add('hidden');
        if (window.workoutState) workoutState.clear();
        workout._nextActionName = ''; workout._totalSetsAll = 0; workout._doneSetsAll = 0;
        const bar = document.getElementById('globalTrainingBar');
        if (bar) { bar.classList.add('hidden'); bar.querySelector('span').style.width = '0%'; }
        const buildHistoryRecord = () => ({
            id: data.generateRecordId('history'),
            date: new Date().toLocaleString(), dayKey: data.logicalDateKey(), duration,
            actions: [...(data._planActions ? data._planActions() : data.activeRecords(data.db.actions || []).filter(a => !a.libOnly))],
            actualSets: data.db.actualSetsBuffer || [],
            manualStop,
            updatedAt: Date.now(),
            deleted: false
        });
        const attachPlanContext = (historyRecord) => {
            if (window.data?.activeRun) {
                historyRecord.__planCtx = JSON.parse(JSON.stringify(window.data.activeRun));
            }
            return historyRecord;
        };
        if (duration < 20) {
            if (window.data?.activeRun && !manualStop) {
                const historyRecord = attachPlanContext(buildHistoryRecord());
                historyRecord.planShortRun = true;
                window.data?.handlePlanWorkoutFinished?.(historyRecord);
                data.db.actualSetsBuffer = [];
                data.saveAndBackup();
                this.resetMainPanel();
                window.toast?.show?.('计划动作已完成，未保存过短训练记录', 'success');
                return;
            }
            window.errorBus?.event?.('workout', 'finish:tooShort', { duration, manualStop });
            if (window.data?.activeRun) {
                const ctx = window.data.activeRun;
                if (ctx.previousPlan && window.data?._replacePlanActions) window.data._replacePlanActions(ctx.previousPlan);
                window.data.activeRun = null;
                window.data.updatePlanWorkoutBanner?.();
            }
            this.speak("训练时间过短，无法记录");
            alert("训练时间低于20秒，无法保存记录");
            data.save();
            return;
        }
        this.speak("训练完成");
        window.haptics?.success?.();
        const historyRecord = attachPlanContext(buildHistoryRecord());
        if (data.history) {
            data.history.append(historyRecord);
        } else {
            data.db.history.unshift(historyRecord);
        }
        window.errorBus?.event?.('workout', 'finish:recorded', { duration, manualStop, actionCount: historyRecord.actions.length, actualSetCount: historyRecord.actualSets.length });
        window.data?.handlePlanWorkoutFinished?.(historyRecord);
        data.db.actualSetsBuffer = [];
        data.saveAndBackup();
        this.resetMainPanel();
    },

    openSetReview(actionName, setIdx, plannedReps) {
        this._reviewCtx = { actionName, setIdx, plannedReps };
        document.getElementById('setReviewTitle').textContent = `${actionName} 第${setIdx}组`;
        document.getElementById('setReviewReps').value = plannedReps;
        document.getElementById('setReviewWeight').value = '';
        document.getElementById('setReviewRpe').value = '';
        document.getElementById('setReviewRir').value = '';
        document.getElementById('setReviewNote').value = '';
        this.setReviewRpe('');
        this.setReviewRir('');
        const modal = document.getElementById('setReviewModal');
        window.navStack?.replaceOrPush?.({
            type: 'modal',
            id: 'setReviewModal',
            close: () => this.closeSetReviewInternal()
        });
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
    },
    closeSetReview() {
        if (!window.navStack?.requestClose?.('modal')) this.closeSetReviewInternal();
    },
    closeSetReviewInternal() {
        const modal = document.getElementById('setReviewModal');
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        this._reviewCtx = null;
        return true;
    },
    saveSetReview() {
        if (!this._reviewCtx) return;
        const w = parseFloat(document.getElementById('setReviewWeight').value) || 0;
        const reps = parseInt(document.getElementById('setReviewReps').value) || this._reviewCtx.plannedReps;
        const rpe = parseInt(document.getElementById('setReviewRpe')?.value || '', 10) || null;
        const rirValue = document.getElementById('setReviewRir')?.value ?? '';
        const rir = rirValue === '' ? null : Math.max(0, parseInt(rirValue, 10) || 0);
        const note = document.getElementById('setReviewNote').value || '';
        const extras = {};
        if (rpe) extras.rpe = rpe;
        if (rir !== null) extras.rir = rir;
        data.db.actualSetsBuffer = data.db.actualSetsBuffer || [];
        data.db.actualSetsBuffer.push({
            action: this._reviewCtx.actionName, setIdx: this._reviewCtx.setIdx,
            weightKg: w, reps, note, extras, rpe, rir, at: new Date().toISOString()
        });
        window.haptics?.success?.();
        data.save();
        this.closeSetReview();
    },
    setReviewRpe(value) {
        const input = document.getElementById('setReviewRpe');
        if (input) input.value = value ? String(value) : '';
        document.querySelectorAll('[data-rpe]').forEach(btn => {
            btn.classList.toggle('active', String(btn.getAttribute('data-rpe')) === String(value));
            btn.setAttribute('aria-selected', String(btn.classList.contains('active')));
        });
        if (value) window.haptics?.light?.();
    },
    setReviewRir(value) {
        const input = document.getElementById('setReviewRir');
        if (input) input.value = value === '' || value == null ? '' : String(value);
        document.querySelectorAll('[data-rir]').forEach(btn => {
            btn.classList.toggle('active', String(btn.getAttribute('data-rir')) === String(value));
            btn.setAttribute('aria-selected', String(btn.classList.contains('active')));
        });
        if (value !== '' && value != null) window.haptics?.light?.();
    }
});
