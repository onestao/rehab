const workoutEngine = {
    state: null,
    skipOverride: null,

    currentActions() {
        return data.activeRecords(data.db.actions || []);
    },

    createInitialState() {
        return {
            actionIndex: 0,
            setIndex: 0,
            sideIndex: 0,
            repIndex: 0,
            phase: 'intro',
            phaseLeft: null,
            phaseSub: '',
            phaseStatus: '',
            activeAction: null
        };
    },

    snapshot() {
        return this.state ? JSON.parse(JSON.stringify(this.state)) : null;
    },

    transition(phase, patch = {}) {
        if (!this.state) return;
        Object.assign(this.state, patch, { phase });
        if (window.workoutState) workoutState.markActive();
    },

    applySkipOverride() {
        if (!this.skipOverride) return false;
        const { phase, patch } = this.skipOverride;
        this.skipOverride = null;
        this.transition(phase, patch);
        return true;
    },

    nextPhaseAfterCount(phase) {
        return {
            hold: 'restAfterRep',
            repRest: 'announceRep',
            switchRest: 'switchSide',
            setRest: 'nextSet',
            actionBreak: 'completed'
        }[phase] || null;
    },

    skipTarget() {
        if (!this.state) return null;
        const action = this.state.activeAction || this.currentActions()[this.state.actionIndex];
        const nextSetIndex = this.state.setIndex + 1;
        switch (this.state.phase) {
            case 'intro': return { phase: 'announceSet' };
            case 'announceSet': return { phase: 'announceRep' };
            case 'announceRep': return { phase: 'hold' };
            case 'hold': return { phase: 'restAfterRep' };
            case 'restAfterRep':
                if (this.state.repIndex + 1 < (action?.reps || 0)) return { phase: 'announceRep', patch: { repIndex: this.state.repIndex + 1 } };
                return { phase: 'afterReps', patch: { repIndex: this.state.repIndex + 1 } };
            case 'repRest': return { phase: 'announceRep' };
            case 'afterReps':
                if (action?.isAlt && this.state.sideIndex === 0) return { phase: 'switchSide', patch: { sideIndex: 1, repIndex: 0 } };
                if (nextSetIndex < (action?.sets || 0)) return { phase: 'announceSet', patch: { setIndex: nextSetIndex, sideIndex: 0, repIndex: 0 } };
                return { phase: 'completed', patch: { setIndex: nextSetIndex, sideIndex: 0, repIndex: 0 } };
            case 'switchRest': return { phase: 'switchSide' };
            case 'switchSide': return { phase: 'announceSet' };
            case 'setRest': return { phase: 'nextSet' };
            case 'nextSet': return { phase: 'announceSet' };
            case 'actionBreak': return { phase: 'completed' };
            default: return null;
        }
    },

    skipCurrentPhase() {
        const target = this.skipTarget();
        if (!target) return false;
        this.skipOverride = {
            phase: target.phase,
            patch: {
                phaseLeft: null,
                phaseSub: '',
                phaseStatus: '',
                ...(target.patch || {})
            }
        };
        workout.abortCurrentPhaseWait?.();
        return true;
    },

    async start() {
        this.state = this.createInitialState();
        await this.run();
    },

    async run() {
        const actions = this.currentActions();
        while (workout.isPlaying && this.state && this.state.actionIndex < actions.length) {
            const action = actions[this.state.actionIndex];
            this.state.activeAction = JSON.parse(JSON.stringify(action));
            if (window.workoutState) workoutState.markActive();
            await this.stepAction(action);
            if (!workout.isPlaying) return;
            if (this.state.phase === 'completed') {
                this.state.actionIndex++;
                this.state.setIndex = 0;
                this.state.sideIndex = 0;
                this.state.repIndex = 0;
                this.state.phase = 'intro';
            }
        }
        if (workout.isPlaying) workout.finish();
    },

    async stepAction(action) {
        const actions = this.currentActions();
        const sides = action.isAlt ? ['左侧', '右侧'] : [''];
        let totalSetsAll = 0;
        let doneSetsAll = 0;
        actions.forEach((a, i) => {
            const s = a.sets || 1;
            totalSetsAll += s;
            if (i < this.state.actionIndex) doneSetsAll += s;
        });
        doneSetsAll += this.state.setIndex;
        workout._totalSetsAll = totalSetsAll;
        workout._doneSetsAll = doneSetsAll;
        const bar = document.getElementById('globalTrainingBar');
        if (bar && totalSetsAll > 0) {
            bar.classList.remove('hidden');
            bar.querySelector('span').style.width = `${Math.round((doneSetsAll / totalSetsAll) * 100)}%`;
        }
        const nextAction = actions[this.state.actionIndex + 1];
        workout._nextActionName = nextAction?.name || '';
        while (workout.isPlaying && this.state.actionIndex < actions.length) {
            if (this.state.phase === 'intro') {
                await workout.speak(`下一项：${action.name}`);
                if (this.applySkipOverride()) continue;
                this.transition('announceSet');
                continue;
            }
            if (this.state.setIndex >= action.sets) {
                this.transition('actionBreak');
            }
            if (this.state.phase === 'announceSet') {
                document.getElementById('curSet').innerText = this.state.setIndex + 1;
                document.getElementById('totalSet').innerText = action.sets;
                if (sides[this.state.sideIndex]) await workout.speak(`${sides[this.state.sideIndex]}开始`);
                else if (action.sets > 1) await workout.speak(`第${this.state.setIndex + 1}组`);
                if (this.applySkipOverride()) continue;
                this.transition('announceRep');
                continue;
            }
            if (this.state.phase === 'announceRep') {
                if (this.state.repIndex >= action.reps) {
                    this.transition('afterReps');
                    continue;
                }
                document.getElementById('curRep').innerText = this.state.repIndex + 1;
                document.getElementById('totalRep').innerText = action.reps;
                await workout.speak(`第${this.state.repIndex + 1}次`);
                if (this.applySkipOverride()) continue;
                this.transition('hold');
                continue;
            }
            if (this.state.phase === 'hold') {
                await this.runCount(action.work, action.name, 'HOLD', 'restAfterRep');
                continue;
            }
            if (this.state.phase === 'restAfterRep') {
                this.state.repIndex++;
                if (this.state.repIndex < action.reps) {
                    await workout.speak('放松');
                    if (this.applySkipOverride()) continue;
                    this.transition('repRest');
                    continue;
                }
                this.transition('afterReps');
                continue;
            }
            if (this.state.phase === 'repRest') {
                await this.runCount(action.repRest, '放松休息', 'REST', 'announceRep');
                continue;
            }
            if (this.state.phase === 'afterReps') {
                if (action.isAlt && this.state.sideIndex === 0) {
                    await workout.speak('准备换边');
                    if (this.applySkipOverride()) continue;
                    this.transition('switchRest');
                } else {
                    this.state.sideIndex = 0;
                    this.state.repIndex = 0;
                    this.state.setIndex++;
                    this.transition(this.state.setIndex < action.sets ? 'setRest' : 'actionBreak');
                }
                continue;
            }
            if (this.state.phase === 'switchRest') {
                await this.runCount(action.switchRest, '请切换侧向', 'SWITCH', 'switchSide');
                continue;
            }
            if (this.state.phase === 'switchSide') {
                this.state.sideIndex = 1;
                this.state.repIndex = 0;
                this.transition('announceSet');
                continue;
            }
            if (this.state.phase === 'setRest') {
                if (this.state.setIndex >= action.sets) {
                    this.transition('actionBreak');
                    continue;
                }
                workout.openSetReview(action.name, this.state.setIndex, action.reps);
                await workout.speak('组间休息');
                if (this.applySkipOverride()) continue;
                await this.runCount(action.actionRest, '稍作休息', 'SET REST', 'nextSet');
                continue;
            }
            if (this.state.phase === 'nextSet') {
                this.state.sideIndex = 0;
                this.state.repIndex = 0;
                this.transition('announceSet');
                continue;
            }
            if (this.state.phase === 'actionBreak') {
                if (this.state.actionIndex < actions.length - 1) {
                    await workout.speak('更换动作');
                    if (this.applySkipOverride()) continue;
                    await this.runCount(action.groupRest, '下一项准备', 'BREAK', 'completed');
                    return;
                }
                this.transition('completed');
                return;
            }
            return;
        }
    },

    async runCount(sec, sub, status, nextPhase) {
        const remaining = Number.isFinite(this.state.phaseLeft) ? this.state.phaseLeft : sec;
        this.state.phaseLeft = remaining;
        this.state.phaseSub = sub;
        this.state.phaseStatus = status;
        workout._phaseLeft = remaining;
        workout._phaseSub = sub;
        workout._phaseStatus = status;
        await workout.count(remaining, sub, status);
        if (this.applySkipOverride()) return;
        if (workout.isPlaying) this.transition(nextPhase, { phaseLeft: null, phaseSub: '', phaseStatus: '' });
    },

    compensateElapsed(delta) {
        if (!this.state || !Number.isFinite(workout._phaseLeft)) return;
        const next = Math.max(0, workout._phaseLeft - delta);
        workout._phaseLeft = next;
        this.state.phaseLeft = next;
        document.getElementById('mainTime').innerText = next;
        workout.renderPip();
        if (next <= 0) {
            clearInterval(workout.timer);
            const resolve = workout._countResolve;
            workout._countResolve = null;
            workout._phaseLeft = null;
            this.state.phaseLeft = null;
            if (resolve) resolve();
            else {
                const nextPhase = this.nextPhaseAfterCount(this.state.phase);
                if (nextPhase) this.transition(nextPhase, { phaseLeft: null, phaseSub: '', phaseStatus: '' });
            }
        }
    },

    restore(snapshot, labels, updatedAt) {
        if (!snapshot) return;
        this.state = JSON.parse(JSON.stringify(snapshot));
        if (!this.state.activeAction) {
            this.state.activeAction = JSON.parse(JSON.stringify(this.currentActions()[this.state.actionIndex] || null));
        }
        document.getElementById('statusText').innerText = labels?.statusText || snapshot.phaseStatus || 'READY';
        document.getElementById('mainTime').innerText = labels?.mainTime || snapshot.phaseLeft || '00';
        document.getElementById('subText').innerText = labels?.subText || snapshot.phaseSub || '准备就绪';
        document.getElementById('sessionTime').innerText = labels?.sessionTime || document.getElementById('sessionTime').innerText;
        document.getElementById('curSet').innerText = labels?.curSet || String((snapshot.setIndex || 0) + 1);
        document.getElementById('totalSet').innerText = labels?.totalSet || String(snapshot.activeAction?.sets || 0);
        document.getElementById('curRep').innerText = labels?.curRep || String((snapshot.repIndex || 0) + 1);
        document.getElementById('totalRep').innerText = labels?.totalRep || String(snapshot.activeAction?.reps || 0);
        workout._phaseLeft = Number(snapshot.phaseLeft ?? workout._phaseLeft ?? 0);
        workout._phaseSub = snapshot.phaseSub || workout._phaseSub;
        workout._phaseStatus = snapshot.phaseStatus || workout._phaseStatus;
        workout._lastActiveAt = new Date(updatedAt || Date.now()).getTime();
        this.resume();
    },

    resume() {
        setTimeout(() => this.run(), 0);
    }
};

if (typeof window !== 'undefined') window.workoutEngine = workoutEngine;
