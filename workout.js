const workout = {
    isPlaying: false, isPaused: false, skipFlag: false,
    timer: null, sessionInt: null, totalSec: 0,
    _countResolve: null, _speakResolve: null, _speechWatchdog: null,
    _audioListenerBound: false,
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
                if (document.hidden && window.speechSynthesis.paused) window.speechSynthesis.resume();
            }, 4000);
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
        navigator.mediaSession.metadata = new MediaMetadata({ title: '康复训练中', artist: '康复助手' });
        navigator.mediaSession.setActionHandler('play', () => { if (this.isPaused) this.toggle(); });
        navigator.mediaSession.setActionHandler('pause', () => { if (!this.isPaused && this.isPlaying) this.toggle(); });
        navigator.mediaSession.setActionHandler('stop', () => this.stop());
        navigator.mediaSession.setActionHandler('nexttrack', () => this.skip());
    },

    keepAudioAlive() {
        const audio = document.getElementById('silentAudio');
        audio.play().catch(()=>{});
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

    async toggle() {
        if (!this.isPlaying) {
            if (data.db.actions.length === 0) return;
            this.isPlaying = true; this.isPaused = false; this.totalSec = 0;
            document.getElementById('playIcon').innerText = 'pause';
            document.getElementById('stopBtn').classList.remove('hidden');
            await this.acquireWakeLock();
            this.setupMediaSession();
            this.keepAudioAlive();
            this.initBackGuard();
            
            this.sessionInt = setInterval(() => { if(!this.isPaused) { this.totalSec++; this.updateUI(); }}, 1000);
            
            await this.speak("康复训练开始");
            this.run();
        } else {
            this.isPaused = !this.isPaused;
            document.getElementById('playIcon').innerText = this.isPaused ? 'play_arrow' : 'pause';
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
            this.timer = setInterval(() => {
                if (!this.isPlaying || this.skipFlag) {
                    clearInterval(this.timer); this.skipFlag = false;
                    this._countResolve = null; resolve(); return;
                }
                if (this.isPaused) return;
                left--;
                document.getElementById('mainTime').innerText = left;
                if (left <= 3 && left > 0) {
                    window.speechSynthesis.speak(new SpeechSynthesisUtterance(left.toString()));
                }
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
        if(confirm("停止并记录历史？")) {
            this.isPlaying = false;
            if (this._countResolve) { this._countResolve(); this._countResolve = null; }
            this.finish();
        }
    },
    finish() {
        const duration = this.totalSec;
        this.isPlaying = false;
        clearInterval(this.timer); clearInterval(this.sessionInt);
        clearInterval(this._speechWatchdog);
        window.speechSynthesis.cancel();
        this.releaseWakeLock();
        this._countResolve = null;
        this._speakResolve = null;
        document.getElementById('playIcon').innerText = 'play_arrow';
        document.getElementById('stopBtn').classList.add('hidden');
        if (duration < 20) {
            this.speak("训练时间过短，无法记录");
            alert("训练时间低于20秒，无法记录历史");
            data.save();
            return;
        }
        this.speak("训练完成");
        data.db.history.unshift({ date: new Date().toLocaleString(), duration, actions: [...data.db.actions] });
        data.saveAndBackup();
    }
};
