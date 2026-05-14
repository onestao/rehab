// @ts-nocheck
const workout = window.workout = window.workout || {};

Object.assign(workout, {
    isPlaying: false, isPaused: false, skipFlag: false,
    mode: 'strength',
    timer: null, sessionInt: null, totalSec: 0,
    _countResolve: null, _speakResolve: null, _speechWatchdog: null,
    _audioListenerBound: false,
    _audioKeepAliveInt: null,
    _backGuardBound: false,
    _backToastTimer: null,
    wakeLock: null,
    pipWindow: null,
    pipSyncInt: null,
    pipMode: null,
    pipCanvas: null,
    pipCtx: null,
    pipStream: null,
    _pipVideoControlSync: false,
    _phaseLeft: null,
    _phaseSub: '',
    _phaseStatus: '',
    _lastActiveAt: null,

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
        if (window.workoutWakeLock?.request) return window.workoutWakeLock.request();
        if (!('wakeLock' in navigator)) return;
        try {
            this.wakeLock = await navigator.wakeLock.request('screen');
        } catch (e) { console.warn('Wake Lock unavailable', e); }
    },

    releaseWakeLock() {
        if (window.workoutWakeLock?.release) { window.workoutWakeLock.release(); return; }
        if (this.wakeLock) this.wakeLock.release().catch(() => {});
        this.wakeLock = null;
    },

    setupMediaSession() {
        // Delegated to workout-media-session.js when available; keep a minimal fallback
        // so older deploys still surface a play/pause action handler.
        if (window.workoutMediaSession) return;
        if (!('mediaSession' in navigator)) return;
        navigator.mediaSession.metadata = new MediaMetadata({ title: '训练中', artist: '训练助手' });
        navigator.mediaSession.playbackState = this.isPaused ? 'paused' : 'playing';
        navigator.mediaSession.setActionHandler('play', () => { if (this.isPaused) this.setTrainingPaused(false); });
        navigator.mediaSession.setActionHandler('pause', () => { if (!this.isPaused && this.isPlaying) this.setTrainingPaused(true); });
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
            this.renderPip();
            if (!document.hidden && window.workoutState) workoutState.compensateElapsed();
        });
    },

    reinforceKeepAlive() {
        if (!this.isPlaying) return;
        const audio = document.getElementById('silentAudio');
        if (audio && !this.isPaused) audio.play().catch(()=>{});
        if (!this.isPaused) window.speechSynthesis.resume();
        if (!document.hidden) this.acquireWakeLock();
        this.setupMediaSession();
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

    showToast(message) {
        let toast = document.getElementById('backToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'backToast';
            toast.className = 'md-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(this._backToastTimer);
        this._backToastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
    },

    showBackToast() {
        this.showToast('训练正在进行：按 Home 进入后台，或点停止结束训练');
    },

    // Training keyboard shortcuts, only active when workout page is visible.
    _kbdBound: false,
    bindHotkeys() {
        if (this._kbdBound) return;
        this._kbdBound = true;
        window.addEventListener('keydown', (e) => {
            const active = document.querySelector('.page.active')?.id === 'workout';
            if (!active) return;
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
            if (e.code === 'Space') { e.preventDefault(); this.toggle(); }
            if (e.code === 'ArrowRight') { e.preventDefault(); this.skip(); }
            if (e.code === 'ArrowLeft') { e.preventDefault(); this.prevAction?.(); }
            if (e.code === 'Escape') { e.preventDefault(); this.stop(); }
        });
    },
});
