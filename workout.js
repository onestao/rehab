const workout = {
    isPlaying: false, isPaused: false, skipFlag: false,
    timer: null, sessionInt: null, totalSec: 0,
    _countResolve: null,

    async speak(text) {
        if (!text) return;
        return new Promise(resolve => {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'zh-CN'; u.rate = parseFloat(data.db.rate);
            const done = () => { setTimeout(resolve, 200); };
            u.onend = done; u.onerror = done;
            setTimeout(done, text.length * 400 + 1000);
            window.speechSynthesis.speak(u);
        });
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
            document.getElementById('silentAudio').play().catch(()=>{});
            
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

    skip() { this.skipFlag = true; this.speak("跳过"); },
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
        this.isPlaying = false;
        clearInterval(this.timer); clearInterval(this.sessionInt);
        this._countResolve = null;
        document.getElementById('playIcon').innerText = 'play_arrow';
        document.getElementById('stopBtn').classList.add('hidden');
        this.speak("训练完成");
        data.db.history.unshift({ date: new Date().toLocaleString(), duration: this.totalSec, actions: [...data.db.actions] });
        data.saveAndBackup();
    }
};
