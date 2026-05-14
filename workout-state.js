// @ts-nocheck
const workoutState = {
    KEY: 'rehab_active_session',

    init() {
        this.installVisibilityHandler();
        this.restoreIfNeeded();
    },

    installVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.markActive();
                return;
            }
            this.compensateElapsed();
        });
    },

    snapshot() {
        return {
            mode: workout.mode,
            isPaused: workout.isPaused,
            isPlaying: workout.isPlaying,
            totalSec: workout.totalSec,
            updatedAt: new Date().toISOString(),
            labels: {
                statusText: document.getElementById('statusText')?.innerText || '',
                mainTime: document.getElementById('mainTime')?.innerText || '',
                subText: document.getElementById('subText')?.innerText || '',
                sessionTime: document.getElementById('sessionTime')?.innerText || '',
                curSet: document.getElementById('curSet')?.innerText || '',
                totalSet: document.getElementById('totalSet')?.innerText || '',
                curRep: document.getElementById('curRep')?.innerText || '',
                totalRep: document.getElementById('totalRep')?.innerText || ''
            },
            cardio: {
                isRunning: cardio.isRunning,
                isPaused: cardio.isPaused,
                seconds: cardio.seconds,
                targetAnnounced: cardio.targetAnnounced
            },
            strength: window.workoutEngine?.snapshot() || null
        };
    },

    markActive() {
        if (!workout.isPlaying) {
            this.clear();
            return;
        }
        localStorage.setItem(this.KEY, JSON.stringify(this.snapshot()));
        workout._lastActiveAt = Date.now();
    },

    clear() {
        localStorage.removeItem(this.KEY);
        workout._lastActiveAt = null;
    },

    compensateElapsed() {
        if (!workout.isPlaying || workout.isPaused || !workout._lastActiveAt) return;
        const delta = Math.floor((Date.now() - workout._lastActiveAt) / 1000);
        if (delta <= 1) return;
        if (workout.mode === 'cardio' && cardio.isRunning && !cardio.isPaused) {
            cardio.seconds += delta;
            workout.totalSec = cardio.seconds;
            cardio.updateUI();
        } else if (window.workoutEngine) {
            workoutEngine.compensateElapsed(delta);
        }
        this.markActive();
    },

    restoreIfNeeded() {
        if (workout.isPlaying) return;
        let snapshot = null;
        try {
            snapshot = JSON.parse(localStorage.getItem(this.KEY) || 'null');
        } catch {}
        if (!snapshot?.isPlaying) return;
        const ageMs = Date.now() - new Date(snapshot.updatedAt || 0).getTime();
        if (!Number.isFinite(ageMs) || ageMs > 1000 * 60 * 60 * 12) {
            this.clear();
            return;
        }
        const label = snapshot.mode === 'cardio' ? '有氧训练' : '力量训练';
        if (!confirm(`检测到未完成的${label}，是否恢复？`)) {
            this.clear();
            return;
        }
        if (snapshot.mode === 'cardio') {
            this.restoreCardio(snapshot);
            return;
        }
        this.restoreStrength(snapshot);
    },

    restoreCardio(snapshot) {
        workout.setMode('cardio');
        cardio.isRunning = true;
        cardio.isPaused = !!snapshot.cardio?.isPaused;
        cardio.seconds = Number(snapshot.cardio?.seconds || 0);
        cardio.targetAnnounced = !!snapshot.cardio?.targetAnnounced;
        workout.isPlaying = true;
        workout.isPaused = !!snapshot.isPaused;
        workout.totalSec = Number(snapshot.totalSec || cardio.seconds || 0);
        workout.updateStateClasses();
        document.body.classList.add('is-cardio');
        document.body.classList.toggle('is-cardio-paused', cardio.isPaused);
        document.getElementById('statusText').innerText = snapshot.labels?.statusText || 'CARDIO';
        document.getElementById('subText').innerText = snapshot.labels?.subText || document.getElementById('subText').innerText;
        document.getElementById('playIcon').innerText = cardio.isPaused ? 'play_arrow' : 'pause';
        document.getElementById('stopBtn').classList.remove('hidden');
        cardio.updatePlan();
        workout.keepAudioAlive();
        workout.initBackGuard();
        workout.acquireWakeLock();
        workout.setupMediaSession();
        clearInterval(cardio.timer);
        cardio.timer = setInterval(() => cardio.tick(), 1000);
        workout._lastActiveAt = new Date(snapshot.updatedAt || Date.now()).getTime();
        this.compensateElapsed();
        workout.showToast('已恢复未完成的有氧训练');
    },

    restoreStrength(snapshot) {
        workout.setMode('strength');
        workout.isPlaying = true;
        workout.isPaused = !!snapshot.isPaused;
        workout.totalSec = Number(snapshot.totalSec || 0);
        workout.updateStateClasses();
        document.getElementById('playIcon').innerText = workout.isPaused ? 'play_arrow' : 'pause';
        document.getElementById('stopBtn').classList.remove('hidden');
        workout.keepAudioAlive();
        workout.initBackGuard();
        workout.acquireWakeLock();
        workout.setupMediaSession();
        clearInterval(workout.sessionInt);
        workout.sessionInt = setInterval(() => {
            if (!workout.isPaused) {
                workout.totalSec++;
                workout.updateUI();
            }
        }, 1000);
        workout._lastActiveAt = new Date(snapshot.updatedAt || Date.now()).getTime();
        workoutEngine.restore(snapshot.strength, snapshot.labels, snapshot.updatedAt);
        this.compensateElapsed();
        workout.showToast('已恢复未完成的力量训练');
    }
};

if (typeof window !== 'undefined') window.workoutState = workoutState;
