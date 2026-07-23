// @ts-nocheck
const workoutState = {
    KEY: 'rehab_active_session',
    /** H5 session journal schema — survives SW upgrade when snapshot is written before apply. */
    SCHEMA_VERSION: 1,

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
        const strengthSnapshot = window.workoutEngine?.snapshot?.()
            || (workout.mode === 'strength' && workout.isPlaying
                ? window.workoutEngine?.createInitialState?.() || null
                : null);
        return {
            schemaVersion: this.SCHEMA_VERSION,
            journal: 'rehab-session',
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
            strength: strengthSnapshot
        };
    },

    /** Persist journal only for a real playing session (prevents idle/false lock-in). */
    saveJournal(extra = {}) {
        try {
            if (!workout?.isPlaying) {
                this.clear();
                return null;
            }
            const base = this.snapshot();
            const payload = {
                ...extra,
                ...base,
                schemaVersion: this.SCHEMA_VERSION,
                journal: 'rehab-session',
                updatedAt: new Date().toISOString()
            };
            if (!this.isRecoverableJournal(payload)) {
                this.clear();
                return null;
            }
            localStorage.setItem(this.KEY, JSON.stringify(payload));
            return payload;
        } catch {
            return null;
        }
    },

    readJournal() {
        try {
            const raw = localStorage.getItem(this.KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data || typeof data !== 'object') return null;
            return data;
        } catch {
            return null;
        }
    },

    /** Shared validity gate for restore + update defer (true mid-session only). */
    isRecoverableJournal(snapshot, now = Date.now()) {
        if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false;
        if (snapshot.schemaVersion !== this.SCHEMA_VERSION) return false;
        if (snapshot.journal !== 'rehab-session') return false;
        if (snapshot.isPlaying !== true) return false;
        if (snapshot.mode !== 'strength' && snapshot.mode !== 'cardio') return false;
        if (!Number.isFinite(snapshot.totalSec) || snapshot.totalSec < 0) return false;
        const updatedAt = new Date(snapshot.updatedAt).getTime();
        const ageMs = now - updatedAt;
        if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 1000 * 60 * 60 * 12) return false;
        if (snapshot.mode === 'cardio') {
            return !!snapshot.cardio
                && typeof snapshot.cardio === 'object'
                && !Array.isArray(snapshot.cardio)
                && snapshot.cardio.isRunning === true
                && Number.isFinite(snapshot.cardio.seconds)
                && snapshot.cardio.seconds >= 0;
        }
        return !!snapshot.strength
            && typeof snapshot.strength === 'object'
            && !Array.isArray(snapshot.strength)
            && typeof snapshot.strength.phase === 'string'
            && snapshot.strength.phase.trim().length > 0;
    },

    markActive() {
        if (!workout.isPlaying) {
            this.clear();
            return;
        }
        this.saveJournal();
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
        } catch {
            this.clear();
            return;
        }
        if (!this.isRecoverableJournal(snapshot)) {
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
        if (snapshot.mode === 'strength') {
            this.restoreStrength(snapshot);
            return;
        }
        this.clear();
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
        workout._sessionLastTick = Date.now();
        workout.sessionInt = setInterval(() => {
            if (workout.isPaused) {
                workout._sessionLastTick = Date.now();
                return;
            }
            const now = Date.now();
            const delta = Math.max(0, Math.floor((now - Number(workout._sessionLastTick || now)) / 1000));
            if (delta <= 0) return;
            workout._sessionLastTick = Number(workout._sessionLastTick || now) + delta * 1000;
            workout.totalSec += delta;
            workout.updateUI();
        }, 1000);
        workout._lastActiveAt = new Date(snapshot.updatedAt || Date.now()).getTime();
        workoutEngine.restore(snapshot.strength, snapshot.labels, snapshot.updatedAt);
        this.compensateElapsed();
        workout.showToast('已恢复未完成的力量训练');
    }
};

if (typeof window !== 'undefined') window.workoutState = workoutState;
