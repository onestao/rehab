const DB_KEY = 'rp_v31_db';
const CFG_KEY = 'rp_v31_cfg';

let db = JSON.parse(localStorage.getItem(DB_KEY)) || { actions: [], routines: [], history: [], rate: 1.1 };
let isPlaying = false, isPaused = false, skipFlag = false;
let timerInterval = null, sessionInterval = null, totalSeconds = 0;

// --- 核心改进：串行语音播报引擎 ---
function speak(text) {
    return new Promise((resolve) => {
        if (!text) return resolve();
        
        // 彻底解决打断问题：如果正在说，强制停止上一个（仅用于极端情况，正常流程靠 Promise 阻塞）
        window.speechSynthesis.cancel();

        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN';
        u.rate = parseFloat(db.rate);

        let resolved = false;
        const handleEnd = () => {
            if (!resolved) {
                resolved = true;
                // 强制呼吸间隙，给系统语音引擎缓冲时间
                setTimeout(resolve, 250);
            }
        };

        u.onend = handleEnd;
        u.onerror = handleEnd;

        // 安全保险丝：根据字数计算最长等待时间 (350ms/字)
        const timeout = text.length * 350 / u.rate + 1000;
        setTimeout(handleEnd, timeout);

        window.speechSynthesis.speak(u);
    });
}

// --- 训练流管理 ---
async function handlePlay() {
    if (!isPlaying) {
        if (db.actions.length === 0) return;
        isPlaying = true; isPaused = false; totalSeconds = 0;
        document.getElementById('playIcon').innerText = 'pause';
        document.getElementById('stopBtn').classList.remove('hidden');
        document.getElementById('silentAudio').play().catch(()=>{});

        sessionInterval = setInterval(() => { if(!isPaused) { totalSeconds++; updateSessionUI(); } }, 1000);

        // 顺序播报：先报欢迎，再报第一个动作，完全结束后再开始计时
        await speak("康复训练开始");
        startWorkoutLoop();
    } else {
        isPaused = !isPaused;
        document.getElementById('playIcon').innerText = isPaused ? 'play_arrow' : 'pause';
        if(isPaused) window.speechSynthesis.pause(); else window.speechSynthesis.resume();
    }
}

async function startWorkoutLoop() {
    for (let i = 0; i < db.actions.length; i++) {
        if (!isPlaying) break;
        const a = db.actions[i];
        updateMediaMetadata(a.name);
        
        // 关键：等待动作名播报完成
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

                    // 关键：等待“第 X 次”说完再跳秒
                    await speak("第" + r + "次");
                    await runTimer(a.work, a.name + (side?' '+side:''), 'HOLD');
                    
                    if (r < a.reps && isPlaying) {
                        await speak("放松");
                        await runTimer(a.repRest, "放松休息", "REST");
                    }
                }
                if (a.isAlt && side === '左侧' && isPlaying) {
                    await speak("准备换边");
                    await runTimer(3, "请换到另一侧", "SWITCH");
                }
            }
            if (s < a.sets && isPlaying) {
                await speak("组间休息");
                await runTimer(a.actionRest || 10, "稍作休息", "SET REST");
            }
        }
        if (i < db.actions.length - 1 && isPlaying) {
            await speak("更换动作");
            await runTimer(a.groupRest || 15, "下一项准备", "BREAK");
        }
    }
    if (isPlaying) finishTraining();
}

function runTimer(sec, title, status) {
    return new Promise(resolve => {
        let l = sec;
        document.getElementById('subText').innerText = title;
        document.getElementById('statusText').innerText = status;
        document.getElementById('mainTime').innerText = l;

        timerInterval = setInterval(async () => {
            if (!isPlaying || skipFlag) { clearInterval(timerInterval); skipFlag = false; resolve(); return; }
            if (isPaused) return;

            l--;
            document.getElementById('mainTime').innerText = l;
            if (l <= 3 && l > 0) speak(l.toString()); // 倒计时不需要 await，它们很短
            if (l <= 0) { clearInterval(timerInterval); resolve(); }
        }, 1000);
    });
}

// --- 业务辅助 ---
function navTo(id, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-dest').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    el.classList.add('active');
    renderList();
}
function updateSessionUI() {
    const m = Math.floor(totalSeconds/60).toString().padStart(2,'0');
    const s = (totalSeconds%60).toString().padStart(2,'0');
    document.getElementById('sessionTime').innerText = `${m}:${s}`;
}
function saveAction() {
    const a = { name: document.getElementById('name').value||'动作', sets: parseInt(document.getElementById('sets').value)||1, reps: parseInt(document.getElementById('reps').value)||1, work: parseInt(document.getElementById('work').value)||5, repRest: parseInt(document.getElementById('repRest').value)||2, actionRest: 10, groupRest: 15, isAlt: document.getElementById('isAlt').checked };
    db.actions.push(a); saveLocal();
}
function renderList() {
    document.getElementById('currentActionList').innerHTML = db.actions.map((a, i) => `
        <div class="list-item">
            <div class="sort-btns">
                <button class="sort-btn" onclick="moveAction(${i},-1)"><span class="material-symbols-rounded">expand_less</span></button>
                <button class="sort-btn" onclick="moveAction(${i},1)"><span class="material-symbols-rounded">expand_more</span></button>
            </div>
            <div class="item-content"><strong>${a.name}</strong><br><small>${a.sets}组 | ${a.reps}次 | ${a.work}s</small></div>
            <button onclick="db.actions.splice(${i},1);saveLocal();" style="border:none;background:none;color:#ba1a1a;"><span class="material-symbols-rounded">delete</span></button>
        </div>`).join('');
}
function moveAction(i, d) { if(i+d>=0 && i+d<db.actions.length) { [db.actions[i], db.actions[i+d]] = [db.actions[i+d], db.actions[i]]; saveLocal(); } }
function saveLocal() { localStorage.setItem(DB_KEY, JSON.stringify(db)); renderList(); }
function updateRate() { db.rate = document.getElementById('ttsRate').value; document.getElementById('rateLabel').innerText = db.rate; }
function skipCurrent() { skipFlag = true; speak("跳过"); }
function stopTrainer() { if(confirm("停止？")) { isPlaying = false; finishTraining(); } }
function finishTraining() {
    isPlaying = false; clearInterval(timerInterval); clearInterval(sessionInterval);
    document.getElementById('playIcon').innerText = 'play_arrow';
    document.getElementById('stopBtn').classList.add('hidden');
    speak("训练圆满完成");
    db.history.unshift({ date: new Date().toLocaleString(), duration: totalSeconds, actions: [...db.actions] });
    saveLocal();
}
function updateMediaMetadata(t) { if ('mediaSession' in navigator) { navigator.mediaSession.metadata = new MediaMetadata({ title: t, artist: '康复助手 Pro' }); } }
window.onload = () => { renderList(); };
