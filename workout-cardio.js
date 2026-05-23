// @ts-nocheck
const cardio = {
    types: window.cardioPure?.cardioTypes || {},
    isRunning: false,
    isPaused: false,
    seconds: 0,
    timer: null,
    targetAnnounced: false,

    initUI() {
        const cfg = data.db.cardio || {};
        document.getElementById('cardioType').value = cfg.type || 'walk';
        document.getElementById('cardioWeight').value = cfg.weight || 70;
        document.getElementById('cardioTarget').value = cfg.target || 30;
        this.updatePlan();
    },

    currentPlan() {
        const type = document.getElementById('cardioType').value;
        const weight = parseFloat(document.getElementById('cardioWeight').value) || 70;
        const target = parseInt(document.getElementById('cardioTarget').value) || 30;
        return window.cardioPure.normalizeCardioPlan({ type, weight, target });
    },

    updatePlan() {
        const plan = this.currentPlan();
        data.db.cardio = { type: plan.type, weight: plan.weight, target: plan.target };
        data.save({ render: false });
        if (workout.mode === 'cardio') {
            document.getElementById('subText').innerText = `${plan.name} · ${plan.weight}kg · ${plan.met} MET`;
            document.getElementById('curSet').innerText = plan.met;
            document.getElementById('curRep').innerText = plan.target;
        }
        this.updateUI();
    },

    calories(seconds = this.seconds) {
        return window.cardioPure.calcCaloriesForSeconds(this.currentPlan(), seconds);
    },

    async toggle() {
        if (!this.isRunning) {
            window.workoutVoice?.unlockAudio?.();
            this.isRunning = true;
            this.isPaused = false;
            this.seconds = 0;
            this.targetAnnounced = false;
            workout.isPlaying = true;
            workout.isPaused = false;
            workout.totalSec = 0;
            this.updatePlan();
            await workout.acquireWakeLock();
            workout.setupMediaSession();
            workout.keepAudioAlive();
            workout.initBackGuard();
            workout.updateStateClasses();
            document.body.classList.add('is-cardio');
            document.getElementById('statusText').innerText = 'CARDIO';
            document.getElementById('playIcon').innerText = 'pause';
            document.getElementById('stopBtn').classList.remove('hidden');
            this.speak(`${this.currentPlan().name}开始`);
            clearInterval(this.timer);
            this.timer = setInterval(() => this.tick(), 1000);
            if (window.workoutState) workoutState.markActive();
            return;
        }
        workout.setTrainingPaused(!this.isPaused);
    },

    tick() {
        if (!this.isRunning || this.isPaused) return;
        this.seconds++;
        workout.totalSec = this.seconds;
        this.updateUI();
        if (window.cardioPure.shouldAnnounceTarget({ seconds: this.seconds, target: this.currentPlan().target, targetAnnounced: this.targetAnnounced })) {
            this.targetAnnounced = true;
            this.speak('有氧目标完成');
        }
    },

    updateUI() {
        document.getElementById('mainTime').innerText = window.cardioPure.formatDurationParts(this.seconds).label;
        document.getElementById('sessionTime').innerText = `${Math.round(this.calories())} kcal`;
        workout._lastActiveAt = Date.now();
        workout.renderPip();
        if (window.workoutState) workoutState.markActive();
    },

    async stop() {
        if (!this.isRunning) return;
        if (!confirm('结束有氧训练？')) return;
        if (!window.cardioPure.shouldSaveCardioSession(this.seconds)) {
            this.reset();
            alert('有氧时间低于20秒，无法保存记录');
            return;
        }
        const plan = this.currentPlan();
        const duration = this.seconds;
        const calories = this.calories(duration);
        this.reset();
        this.showEditModal(plan, duration, calories);
    },

    showEditModal(plan, duration, calories) {
        const modal = document.getElementById('cardioEditModal');
        const min = Math.floor(duration / 60);
        const sec = duration % 60;
        document.getElementById('cardioEditType').value = plan.type;
        document.getElementById('cardioEditMin').value = min;
        document.getElementById('cardioEditSec').value = sec;
        document.getElementById('cardioEditWeight').value = plan.weight;
        document.getElementById('cardioEditTarget').value = plan.target;
        document.getElementById('cardioEditCal').value = Math.round(calories);
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        window.navStack?.replaceOrPush?.({
            type: 'modal',
            id: 'cardioEditModal',
            close: () => this.closeEditModalInternal()
        });
        this._editOriginalDuration = duration;
        this._editOriginalCalories = calories;
        this.updateEditCalories();
    },

    closeEditModal() {
        if (!window.navStack?.requestClose?.('modal')) this.closeEditModalInternal();
    },

    closeEditModalInternal() {
        const modal = document.getElementById('cardioEditModal');
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        return true;
    },

    updateEditCalories() {
        const type = document.getElementById('cardioEditType').value;
        const weight = parseFloat(document.getElementById('cardioEditWeight').value) || 70;
        const min = parseInt(document.getElementById('cardioEditMin').value) || 0;
        const sec = parseInt(document.getElementById('cardioEditSec').value) || 0;
        const totalSec = min * 60 + sec;
        const cal = window.cardioPure.calcCaloriesForSeconds({ type, weight, target: 1 }, totalSec);
        document.getElementById('cardioEditCal').value = Math.round(cal);
    },

    async saveCardioEdit() {
        const type = document.getElementById('cardioEditType').value;
        const min = parseInt(document.getElementById('cardioEditMin').value) || 0;
        const sec = parseInt(document.getElementById('cardioEditSec').value) || 0;
        const weight = parseFloat(document.getElementById('cardioEditWeight').value) || 70;
        const target = parseInt(document.getElementById('cardioEditTarget').value) || 0;
        const calories = parseInt(document.getElementById('cardioEditCal').value) || 0;
        const duration = min * 60 + sec;
        if (!window.cardioPure.shouldSaveCardioSession(duration)) {
            alert('有氧时间低于20秒，无法保存');
            return;
        }
        data.db.history.unshift(window.cardioPure.buildCardioHistoryRecord({
            id: data.generateRecordId('history'),
            now: Date.now(),
            dayKey: data.logicalDateKey(),
            plan: { type, weight, target },
            duration,
            calories
        }));
        this.closeEditModal();
        this.speak('有氧训练完成');
        await data.saveAndBackup();
        data.render();
    },

    reset() {
        clearInterval(this.timer);
        this.isRunning = false;
        this.isPaused = false;
        this.seconds = 0;
        this.targetAnnounced = false;
        workout.isPlaying = false;
        workout.isPaused = false;
        workout.totalSec = 0;
        clearInterval(workout._speechWatchdog); clearInterval(workout._audioKeepAliveInt);
        workout.closePip();
        (window.workoutVoice?.cancel?.() ?? window.speechSynthesis.cancel());
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
        workout.releaseWakeLock();
        document.body.classList.remove('is-cardio', 'is-cardio-paused');
        workout.updateStateClasses();
        document.getElementById('playIcon').innerText = 'play_arrow';
        document.getElementById('stopBtn').classList.add('hidden');
        workout.resetMainPanel();
        if (window.workoutState) workoutState.clear();
    },

    speak(text) {
        workout.playCue?.('normal');
        if (window.workoutVoice?.speak) {
            window.workoutVoice.speak(text, { rate: parseFloat(data.db.rate || 1.1) });
            return;
        }
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN';
        u.rate = parseFloat(data.db.rate || 1.1);
        u.volume = 1;
        u.pitch = 1.05;
        window.speechSynthesis.speak(u);
    }
};

if (typeof window !== 'undefined') window.cardio = cardio;
