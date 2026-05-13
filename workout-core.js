Object.assign(workout, {
    updateRate(val) {
        data.db.rate = parseFloat(val);
        document.getElementById('rateLabel').innerText = val;
        data.save({ render: false });
    },

    updateStateClasses() {
        document.body.classList.toggle('is-training', this.isPlaying);
        document.body.classList.toggle('is-paused', this.isPlaying && this.isPaused);
        document.body.classList.toggle('is-cardio-mode', this.mode === 'cardio');
        const tweak = document.getElementById('timerTweak');
        if (tweak) tweak.classList.toggle('hidden', !this.isPlaying);
        this.updatePipButton();
        this.renderPip();
    },

    tweakPhase(delta) {
        if (!this.isPlaying) return;
        if (this._phaseLeft == null) return;
        const next = Math.max(0, this._phaseLeft + delta);
        this._phaseLeft = next;
        const el = document.getElementById('mainTime');
        if (el) el.innerText = next;
        if (next === 0 && this._countResolve) {
            this._countResolve();
            this._countResolve = null;
            clearInterval(this.timer);
        }
    },

    setTrainingPaused(paused) {
        if (!this.isPlaying) return;
        const nextPaused = !!paused;
        if (this.mode === 'cardio') {
            cardio.isPaused = nextPaused;
            this.isPaused = nextPaused;
            document.body.classList.toggle('is-cardio-paused', nextPaused);
        } else {
            this.isPaused = nextPaused;
            if (nextPaused) window.speechSynthesis.pause();
            else window.speechSynthesis.resume();
        }
        document.getElementById('playIcon').innerText = nextPaused ? 'play_arrow' : 'pause';
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = nextPaused ? 'paused' : 'playing';
        this.syncPipVideoElement(!nextPaused);
        if (!nextPaused) {
            this.reinforceKeepAlive();
        }
        this.updateStateClasses();
    },

    setMode(mode) {
        if (this.isPlaying) return alert('训练中不能切换模式');
        this.mode = mode;
        document.getElementById('modeStrengthBtn').classList.toggle('active', mode === 'strength');
        document.getElementById('modeCardioBtn').classList.toggle('active', mode === 'cardio');
        document.getElementById('modeStrengthLogBtn').classList.toggle('active', mode === 'strengthLog');
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
        document.getElementById('subText').innerText = this.mode === 'cardio' ? '准备有氧训练' : '准备就绪';
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

    async toggle() {
        const fab = document.getElementById('playBtn');
        if (fab) {
            const r = document.createElement('span');
            r.className = 'ripple';
            fab.appendChild(r);
            setTimeout(() => r.remove(), 600);
        }
        if (this.mode === 'cardio') return cardio.toggle();
        if (!this.isPlaying) {
            if (data.activeRecords(data.db.actions || []).length === 0) return;
            this.isPlaying = true; this.isPaused = false; this.totalSec = 0;
            if (window.workoutEngine) workoutEngine.state = workoutEngine.createInitialState();
            this.updateStateClasses();
            document.getElementById('playIcon').innerText = 'pause';
            document.getElementById('stopBtn').classList.remove('hidden');
            await this.acquireWakeLock();
            this.setupMediaSession();
            this.keepAudioAlive();
            this.initBackGuard();
            
            this.sessionInt = setInterval(() => { if(!this.isPaused) { this.totalSec++; this.updateUI(); }}, 1000);
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
            let left = sec;
            this._phaseLeft = sec;
            this._phaseSub = sub;
            this._phaseStatus = status;
            this._countResolve = resolve;
            document.getElementById('subText').innerText = sub;
            document.getElementById('statusText').innerText = status;
            document.getElementById('mainTime').innerText = left;
            if (window.workoutState) workoutState.markActive();
            if (sec > 12 && status !== 'HOLD') this.speak(`${sub}，${sec}秒`);
            this.timer = setInterval(() => {
                if (!this.isPlaying || this.skipFlag) {
                    clearInterval(this.timer); this.skipFlag = false;
                    this._phaseLeft = null;
                    this._countResolve = null; resolve(); return;
                }
                if (this.isPaused) return;
                left--;
                this._phaseLeft = left;
                document.getElementById('mainTime').innerText = left;
                this.renderPip();
                if (window.workoutState) workoutState.markActive();
                if (left <= 3 && left > 0) this.speak(left.toString());
                if (left <= 0) { clearInterval(this.timer); this._phaseLeft = null; this._countResolve = null; resolve(); }
            }, 1000);
        });
    },

    skip() {
        if (!this.isPlaying) return;
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
        window.speechSynthesis.cancel();
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
        if(confirm("停止并保存记录？")) {
            this.isPlaying = false;
            if (this._countResolve) { this._countResolve(); this._countResolve = null; }
            this.finish();
        }
    },
    finish() {
        const duration = this.totalSec;
        this.isPlaying = false;
        this.isPaused = false;
        this.updateStateClasses();
        clearInterval(this.timer); clearInterval(this.sessionInt);
        clearInterval(this._speechWatchdog); clearInterval(this._audioKeepAliveInt);
        this.closePip();
        window.speechSynthesis.cancel();
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
        this.releaseWakeLock();
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
        if (duration < 20) {
            this.speak("训练时间过短，无法记录");
            alert("训练时间低于20秒，无法保存记录");
            data.save();
            return;
        }
        this.speak("训练完成");
        data.db.history.unshift({
            id: data.generateRecordId('history'),
            date: new Date().toLocaleString(), dayKey: data.logicalDateKey(), duration,
            actions: [...data.activeRecords(data.db.actions || [])],
            actualSets: data.db.actualSetsBuffer || [],
            updatedAt: Date.now(),
            deleted: false
        });
        data.db.actualSetsBuffer = [];
        data.saveAndBackup();
        this.resetMainPanel();
    },

    openSetReview(actionName, setIdx, plannedReps) {
        this._reviewCtx = { actionName, setIdx, plannedReps };
        document.getElementById('setReviewTitle').textContent = `${actionName} 第${setIdx}组`;
        document.getElementById('setReviewReps').value = plannedReps;
        document.getElementById('setReviewWeight').value = '';
        document.getElementById('setReviewNote').value = '';
        document.getElementById('setReviewModal').classList.remove('hidden');
    },
    closeSetReview() {
        document.getElementById('setReviewModal').classList.add('hidden');
        this._reviewCtx = null;
    },
    saveSetReview() {
        if (!this._reviewCtx) return;
        const w = parseFloat(document.getElementById('setReviewWeight').value) || 0;
        const reps = parseInt(document.getElementById('setReviewReps').value) || this._reviewCtx.plannedReps;
        const note = document.getElementById('setReviewNote').value || '';
        data.db.actualSetsBuffer = data.db.actualSetsBuffer || [];
        data.db.actualSetsBuffer.push({
            action: this._reviewCtx.actionName, setIdx: this._reviewCtx.setIdx,
            weightKg: w, reps, note, at: new Date().toISOString()
        });
        data.save();
        this.closeSetReview();
    }
});
