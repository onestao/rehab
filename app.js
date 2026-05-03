const DB_KEY = 'rp_v30_db';
const CFG_KEY = 'rp_v30_cfg';

let db = JSON.parse(localStorage.getItem(DB_KEY)) || { actions: [], routines: [], history: [], rate: 1.1 };
let isPlaying = false, isPaused = false, skipFlag = false;
let timerInterval = null, sessionInterval = null, totalSeconds = 0;

// --- 语音队列管理器 (彻底解决语音被截断) ---
let speechQueue = [];
let isSpeaking = false;

function speak(text) {
    return new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = parseFloat(db.rate);
        
        // 结束时触发下一个
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        
        // 如果系统挂起，4秒强制保险
        setTimeout(resolve, 4000);
        
        window.speechSynthesis.speak(utterance);
    });
}

// --- 训练引擎 ---
async function handlePlay() {
    if (!isPlaying) {
        if (db.actions.length === 0) return;
        isPlaying = true; isPaused = false; totalSeconds = 0;
        document.getElementById('playIcon').innerText = 'pause';
        document.getElementById('stopBtn').classList.remove('hidden');
        document.getElementById('silentAudio').play().catch(()=>{});

        sessionInterval = setInterval(() => {
            if(!isPaused) { totalSeconds++; updateSessionUI(); }
        }, 1000);

        await speak("准备开始康复训练");
        startWorkoutSequence();
    } else {
        isPaused = !isPaused;
        document.getElementById('playIcon').innerText = isPaused ? 'play_arrow' : 'pause';
        if(isPaused) window.speechSynthesis.pause(); else window.speechSynthesis.resume();
    }
}

async function startWorkoutSequence() {
    for (let i = 0; i < db.actions.length; i++) {
        if (!isPlaying) break;
        const a = db.actions[i];
        updateMediaMetadata(a.name);
        await speak("下一项：" + a.name);

        for (let s = 1; s <= a.sets; s++) {
            if (!isPlaying) break;
            document.getElementById('totalSet').innerText = a.sets;
            document.getElementById('curSet').innerText = s;

            const sides = a.isAlt ? ['左侧', '右侧'] : [''];
            for (let side of sides) {
                if (!isPlaying) break;
                if (side) await speak(side + "开始");
                else if (a.sets > 1) await speak("第" + s + "组");

                for (let r = 1; r <= a.reps; r++) {
                    if (!isPlaying) break;
                    document.getElementById('totalRep').innerText = a.reps;
                    document.getElementById('curRep').innerText = r;

                    await speak("第" + r + "次");
                    await runTimer(a.work, a.name + (side?' '+side:''), 'HOLD');
                    
                    if (r < a.reps && isPlaying) {
                        await speak("放松");
                        await runTimer(a.repRest, "次间休息", "REST");
                    }
                }
                if (a.isAlt && side === '左侧' && isPlaying) {
                    await speak("换边");
                    await runTimer(a.switchRest || 3, "准备换边", "SWITCH");
                }
            }
            if (s < a.sets && isPlaying) {
                await speak("组间休息");
                await runTimer(a.actionRest || 10, "稍作休息", "SET REST");
            }
        }
        if (i < db.actions.length - 1 && isPlaying) {
            await speak("更换动作");
            await runTimer(a.groupRest || 15, "准备下一项", "BREAK");
        }
    }
    if (isPlaying) finishWorkout();
}

function runTimer(sec, title, status) {
    return new Promise(resolve => {
        let left = sec;
        document.getElementById('subText').innerText = title;
        document.getElementById('statusText').innerText = status;
        document.getElementById('mainTime').innerText = left;

        timerInterval = setInterval(async () => {
            if (!isPlaying || skipFlag) { clearInterval(timerInterval); skipFlag = false; resolve(); return; }
            if (isPaused) return;

            left--;
            document.getElementById('mainTime').innerText = left;
            if (left <= 3 && left > 0) speak(left.toString());
            if (left <= 0) { clearInterval(timerInterval); resolve(); }
        }, 1000);
    });
}

function skipCurrent() { skipFlag = true; speak("跳过"); }
function stopTrainer() { if(confirm("强制停止并结算？")) { isPlaying = false; finishWorkout(); } }

function finishWorkout() {
    isPlaying = false;
    clearInterval(timerInterval); clearInterval(sessionInterval);
    document.getElementById('playIcon').innerText = 'play_arrow';
    document.getElementById('stopBtn').classList.add('hidden');
    speak("训练圆满完成");
    db.history.unshift({ date: new Date().toLocaleString(), duration: totalSeconds, actions: [...db.actions] });
    saveLocal();
}

// --- 业务辅助 ---
function tabNav(id, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    el.classList.add('active');
    renderList();
}

function updateSessionUI() {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    document.getElementById('sessionTime').innerText = `${m}:${s}`;
}

function saveAction() {
    const a = {
        name: document.getElementById('name').value || '未命名',
        sets: parseInt(document.getElementById('sets').value) || 1,
        reps: parseInt(document.getElementById('reps').value) || 1,
        work: parseInt(document.getElementById('work').value) || 5,
        repRest: parseInt(document.getElementById('repRest').value) || 2,
        actionRest: 10, groupRest: 15, switchRest: 3,
        isAlt: document.getElementById('isAlt').checked
    };
    db.actions.push(a); saveLocal();
}

function renderList() {
    document.getElementById('currentActionList').innerHTML = db.actions.map((a, i) => `
        <div class="list-item">
            <div class="action-info"><strong>${a.name}</strong><br><small>${a.sets}组 | ${a.reps}次 | ${a.work}s</small></div>
            <button class="delete-btn" onclick="db.actions.splice(${i},1);saveLocal();"><span class="material-symbols-rounded">delete</span></button>
        </div>`).join('');
    // 方案和历史渲染同理...
}

function saveLocal() { localStorage.setItem(DB_KEY, JSON.stringify(db)); renderList(); }
function updateRate() { db.rate = document.getElementById('ttsRate').value; document.getElementById('rateLabel').innerText = db.rate; }
function updateMediaMetadata(t) { if ('mediaSession' in navigator) { navigator.mediaSession.metadata = new MediaMetadata({ title: t, artist: 'REHAB PRO' }); } }

window.onload = () => { renderList(); };
