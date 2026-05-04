const workout = {
    isPlaying: false, isPaused: false, skipFlag: false,
    mode: 'strength',
    timer: null, sessionInt: null, totalSec: 0,
    _countResolve: null, _speakResolve: null, _speechWatchdog: null,
    _audioListenerBound: false,
    _audioKeepAliveInt: null,
    _backGuardBound: false,
    _backToastTimer: null,
    wakeLock: null,

    async speak(text) {
        if (!text) return;
        return new Promise(resolve => {
            if (this.skipFlag || !this.isPlaying) { resolve(); return; }
            let settled = false;
            const done = () => {
                if (settled) return;
                settled = true;
                clearInterval(this._speechWatchdog);
                this._speakResolve = null;
                setTimeout(resolve, 160);
            };
            this._speakResolve = done;
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'zh-CN'; u.rate = parseFloat(data.db.rate);
            u.onend = done; u.onerror = done;
            this._speechWatchdog = setInterval(() => {
                if (this.isPaused || this.skipFlag || !this.isPlaying) return;
                window.speechSynthesis.resume();
                document.getElementById('silentAudio').play().catch(()=>{});
            }, 2500);
            setTimeout(done, text.length * 450 + 1200);
            window.speechSynthesis.speak(u);
        });
    },

    async acquireWakeLock() {
        if (!('wakeLock' in navigator)) return;
        try {
            this.wakeLock = await navigator.wakeLock.request('screen');
        } catch (e) { console.warn('Wake Lock unavailable', e); }
    },

    releaseWakeLock() {
        if (this.wakeLock) this.wakeLock.release().catch(() => {});
        this.wakeLock = null;
    },

    setupMediaSession() {
        if (!('mediaSession' in navigator)) return;
        navigator.mediaSession.metadata = new MediaMetadata({ title: '训练中', artist: '训练助手' });
        navigator.mediaSession.playbackState = 'playing';
        navigator.mediaSession.setActionHandler('play', () => { if (this.isPaused) this.toggle(); });
        navigator.mediaSession.setActionHandler('pause', () => { if (!this.isPaused && this.isPlaying) this.toggle(); });
        navigator.mediaSession.setActionHandler('stop', () => this.stop());
        navigator.mediaSession.setActionHandler('nexttrack', () => this.skip());
    },

    keepAudioAlive() {
        const audio = document.getElementById('silentAudio');
        audio.play().catch(()=>{});
        clearInterval(this._audioKeepAliveInt);
        this._audioKeepAliveInt = setInterval(() => {
            if (!this.isPlaying || this.isPaused) return;
            audio.play().catch(()=>{});
            window.speechSynthesis.resume();
        }, 5000);
        if (this._audioListenerBound) return;
        this._audioListenerBound = true;
        document.addEventListener('visibilitychange', () => {
            if (!this.isPlaying) return;
            if (!document.hidden) this.acquireWakeLock();
            audio.play().catch(()=>{});
            window.speechSynthesis.resume();
        });
    },

    initBackGuard() {
        const pushGuard = () => history.pushState({ rehabGuard: true }, '');
        if (this._backGuardBound) { pushGuard(); return; }
        this._backGuardBound = true;
        history.replaceState({ rehabRoot: true }, '');
        pushGuard();
        window.addEventListener('popstate', () => {
            if (!this.isPlaying) {
                return;
            }
            pushGuard();
            this.showBackToast();
            if (!this.isPaused) window.speechSynthesis.resume();
            document.getElementById('silentAudio').play().catch(()=>{});
        });
        window.addEventListener('beforeunload', (e) => {
            if (!this.isPlaying) return;
            e.preventDefault();
            e.returnValue = '训练正在进行，退出会中断后台播放。';
        });
    },

    showBackToast() {
        let toast = document.getElementById('backToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'backToast';
            toast.className = 'md-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = '训练正在进行：按 Home 进入后台，或点停止结束训练';
        toast.classList.add('show');
        clearTimeout(this._backToastTimer);
        this._backToastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
    },

    updateRate(val) {
        data.db.rate = parseFloat(val);
        document.getElementById('rateLabel').innerText = val;
        localStorage.setItem(data.DB_KEY, JSON.stringify(data.db));
    },

    updateStateClasses() {
        document.body.classList.toggle('is-training', this.isPlaying);
        document.body.classList.toggle('is-paused', this.isPlaying && this.isPaused);
        document.body.classList.toggle('is-cardio-mode', this.mode === 'cardio');
    },

    setMode(mode) {
        if (this.isPlaying) return alert('训练中不能切换模式');
        this.mode = mode;
        document.getElementById('modeStrengthBtn').classList.toggle('active', mode === 'strength');
        document.getElementById('modeCardioBtn').classList.toggle('active', mode === 'cardio');
        document.getElementById('strengthCard').classList.toggle('hidden', mode !== 'strength');
        document.querySelector('.cardio-card').classList.toggle('hidden', mode !== 'cardio');
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
        if (this.mode === 'cardio') return cardio.toggle();
        if (!this.isPlaying) {
            if (data.db.actions.length === 0) return;
            this.isPlaying = true; this.isPaused = false; this.totalSec = 0;
            this.updateStateClasses();
            document.getElementById('playIcon').innerText = 'pause';
            document.getElementById('stopBtn').classList.remove('hidden');
            await this.acquireWakeLock();
            this.setupMediaSession();
            this.keepAudioAlive();
            this.initBackGuard();
            
            this.sessionInt = setInterval(() => { if(!this.isPaused) { this.totalSec++; this.updateUI(); }}, 1000);
            
            await this.speak("训练开始");
            this.run();
        } else {
            this.isPaused = !this.isPaused;
            this.updateStateClasses();
            document.getElementById('playIcon').innerText = this.isPaused ? 'play_arrow' : 'pause';
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = this.isPaused ? 'paused' : 'playing';
            if(this.isPaused) window.speechSynthesis.pause(); else window.speechSynthesis.resume();
        }
    },

    async run() {
        for (let i = 0; i < data.db.actions.length; i++) {
            if (!this.isPlaying) break;
            const a = data.db.actions[i];
            await this.speak("下一项：" + a.name);
            
            for (let s = 1; s <= a.sets; s++) {
                if (!this.isPlaying) break;
                document.getElementById('curSet').innerText = s;
                document.getElementById('totalSet').innerText = a.sets;

                const sides = a.isAlt ? ['左侧', '右侧'] : [''];
                for (let side of sides) {
                    if (!this.isPlaying) break;
                    if (side) { await this.speak(side + "开始"); }
                    else if (a.sets > 1) { await this.speak("第" + s + "组"); }

                    for (let r = 1; r <= a.reps; r++) {
                        if (!this.isPlaying) break;
                        document.getElementById('curRep').innerText = r;
                        document.getElementById('totalRep').innerText = a.reps;
                        await this.speak("第" + r + "次");
                        await this.count(a.work, a.name, 'HOLD');
                        if (r < a.reps && this.isPlaying) {
                            await this.speak("放松");
                            await this.count(a.repRest, "放松休息", "REST");
                        }
                    }
                    if (a.isAlt && side === '左侧' && this.isPlaying) {
                        await this.speak("准备换边");
                        await this.count(a.switchRest, "请切换侧向", "SWITCH");
                    }
                }
                if (s < a.sets && this.isPlaying) {
                    await this.speak("组间休息");
                    await this.count(a.actionRest, "稍作休息", "SET REST");
                }
            }
            if (i < data.db.actions.length - 1 && this.isPlaying) {
                await this.speak("更换动作");
                await this.count(a.groupRest, "下一项准备", "BREAK");
            }
        }
        if (this.isPlaying) this.finish();
    },

    count(sec, sub, status) {
        return new Promise(resolve => {
            let left = sec;
            this._countResolve = resolve;
            document.getElementById('subText').innerText = sub;
            document.getElementById('statusText').innerText = status;
            document.getElementById('mainTime').innerText = left;
            if (sec > 12 && status !== 'HOLD') this.speak(`${sub}，${sec}秒`);
            this.timer = setInterval(() => {
                if (!this.isPlaying || this.skipFlag) {
                    clearInterval(this.timer); this.skipFlag = false;
                    this._countResolve = null; resolve(); return;
                }
                if (this.isPaused) return;
                left--;
                document.getElementById('mainTime').innerText = left;
                if (left <= 3 && left > 0) this.speak(left.toString());
                if (left <= 0) { clearInterval(this.timer); this._countResolve = null; resolve(); }
            }, 1000);
        });
    },

    skip() {
        if (!this.isPlaying) return;
        this.skipFlag = true;
        window.speechSynthesis.cancel();
        if (this._speakResolve) { this._speakResolve(); this._speakResolve = null; }
        if (this._countResolve) { this._countResolve(); this._countResolve = null; }
        clearInterval(this.timer);
        document.getElementById('statusText').innerText = 'SKIP';
        document.getElementById('subText').innerText = '已跳过当前阶段';
        this.skipFlag = false;
    },
    updateUI() {
        const m = Math.floor(this.totalSec/60).toString().padStart(2,'0');
        const s = (this.totalSec%60).toString().padStart(2,'0');
        document.getElementById('sessionTime').innerText = `${m}:${s}`;
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
        window.speechSynthesis.cancel();
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
        this.releaseWakeLock();
        this._countResolve = null;
        this._speakResolve = null;
        document.getElementById('playIcon').innerText = 'play_arrow';
        document.getElementById('stopBtn').classList.add('hidden');
        if (duration < 20) {
            this.speak("训练时间过短，无法记录");
            alert("训练时间低于20秒，无法保存记录");
            data.save();
            return;
        }
        this.speak("训练完成");
        data.db.history.unshift({ date: new Date().toLocaleString(), duration, actions: [...data.db.actions] });
        data.saveAndBackup();
        this.resetMainPanel();
    }
};

const cardio = {
    types: {
        walk: { name: '步行', met: 3.5 },
        brisk_walk: { name: '快走', met: 4.3 },
        jog: { name: '慢跑', met: 7.0 },
        run: { name: '跑步', met: 9.8 },
        cycling: { name: '骑行', met: 6.8 },
        swim: { name: '游泳', met: 7.0 },
        elliptical: { name: '椭圆机', met: 5.0 },
        rowing: { name: '划船机', met: 7.0 },
        battle_rope: { name: '战绳', met: 8.0 },
        spin_bike: { name: '动感单车', met: 7.5 }
    },
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
        return { type, weight, target, ...(this.types[type] || this.types.walk) };
    },

    updatePlan() {
        const plan = this.currentPlan();
        data.db.cardio = { type: plan.type, weight: plan.weight, target: plan.target };
        localStorage.setItem(data.DB_KEY, JSON.stringify(data.db));
        if (workout.mode === 'cardio') {
            document.getElementById('subText').innerText = `${plan.name} · ${plan.weight}kg · ${plan.met} MET`;
            document.getElementById('curSet').innerText = plan.met;
            document.getElementById('curRep').innerText = plan.target;
        }
        this.updateUI();
    },

    calories(seconds = this.seconds) {
        const plan = this.currentPlan();
        return plan.met * plan.weight * (seconds / 3600);
    },

    async toggle() {
        if (!this.isRunning) {
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
            return;
        }
        this.isPaused = !this.isPaused;
        workout.isPaused = this.isPaused;
        workout.updateStateClasses();
        document.body.classList.toggle('is-cardio-paused', this.isPaused);
        document.getElementById('playIcon').innerText = this.isPaused ? 'play_arrow' : 'pause';
    },

    tick() {
        if (!this.isRunning || this.isPaused) return;
        this.seconds++;
        workout.totalSec = this.seconds;
        this.updateUI();
        const targetSec = this.currentPlan().target * 60;
        if (!this.targetAnnounced && targetSec > 0 && this.seconds >= targetSec) {
            this.targetAnnounced = true;
            this.speak('有氧目标完成');
        }
    },

    updateUI() {
        const m = Math.floor(this.seconds / 60).toString().padStart(2, '0');
        const s = (this.seconds % 60).toString().padStart(2, '0');
        document.getElementById('mainTime').innerText = `${m}:${s}`;
        document.getElementById('sessionTime').innerText = `${Math.round(this.calories())} kcal`;
    },

    async stop() {
        if (!this.isRunning) return;
        if (!confirm('结束并保存有氧记录？')) return;
        if (this.seconds < 20) {
            this.reset();
            alert('有氧时间低于20秒，无法保存记录');
            return;
        }
        const plan = this.currentPlan();
        const duration = this.seconds;
        data.db.history.unshift({
            type: 'cardio',
            date: new Date().toLocaleString(),
            duration,
            actions: [],
            cardio: {
                name: plan.name,
                type: plan.type,
                met: plan.met,
                weight: plan.weight,
                target: plan.target,
                calories: this.calories(duration)
            }
        });
        this.speak('有氧训练完成');
        this.reset();
        await data.saveAndBackup();
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
        window.speechSynthesis.cancel();
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
        workout.releaseWakeLock();
        document.body.classList.remove('is-cardio', 'is-cardio-paused');
        workout.updateStateClasses();
        document.getElementById('playIcon').innerText = 'play_arrow';
        document.getElementById('stopBtn').classList.add('hidden');
        workout.resetMainPanel();
    },

    speak(text) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN';
        u.rate = parseFloat(data.db.rate || 1.1);
        window.speechSynthesis.speak(u);
    }
};
