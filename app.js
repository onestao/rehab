// --- 常量与初始化 ---
const DB_KEY = 'rp_v29_db';
const CFG_KEY = 'rp_v29_cfg';

let db = JSON.parse(localStorage.getItem(DB_KEY)) || { actions: [], routines: [], history: [], rate: 1.1 };
let cfg = JSON.parse(localStorage.getItem(CFG_KEY)) || { mode: 'none', s3: {}, dav: {} };

let isPlaying = false, isPaused = false;
let timerInterval = null, sessionInterval = null;
let skipFlag = false, totalSessionSeconds = 0;

// --- 自动迁移逻辑 ---
function migrate() {
    const olderKeys = ['rp_v28_db', 'rp_v26_db', 'rp_v21_main'];
    if (db.actions.length === 0) {
        for (let k of olderKeys) {
            let old = localStorage.getItem(k);
            if (old) { db = JSON.parse(old); break; }
        }
    }
}

// --- 稳定语音引擎 (带防截断等待) ---
function sleep(ms) { return new Promise(r => setTimeout(res => r(), ms)); }

async function speak(t) {
    if (!t) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = 'zh-CN';
    u.rate = parseFloat(db.rate);
    window.speechSynthesis.speak(u);
    // 给系统语音留出呼吸时间，避免被下一个指令瞬间覆盖
    await sleep(t.length * 250 > 2000 ? 2000 : t.length * 250); 
}

// --- 训练引擎 ---
async function handlePlay() {
    if (!isPlaying) {
        if (db.actions.length === 0) return;
        isPlaying = true; isPaused = false; totalSessionSeconds = 0;
        document.getElementById('playIcon').innerText = 'pause';
        document.getElementById('stopBtn').classList.remove('hidden');
        document.getElementById('silentAudio').play().catch(()=>{});

        sessionInterval = setInterval(() => { if(!isPaused) { totalSessionSeconds++; updateSessionUI(); } }, 1000);

        await speak("现在开始康复训练");
        runFullSequence(); 
    } else {
        isPaused = !isPaused;
        document.getElementById('playIcon').innerText = isPaused ? 'play_arrow' : 'pause';
    }
}

async function runFullSequence() {
    for (let i = 0; i < db.actions.length; i++) {
        if (!isPlaying) break;
        const a = db.actions[i];
        updateMediaMetadata(a.name);
        await speak(`下一项：${a.name}`);

        for (let s = 1; s <= a.sets; s++) {
            if (!isPlaying) break;
            document.getElementById('totalSet').innerText = a.sets;
            document.getElementById('curSet').innerText = s;
            
            const sides = a.isAlt ? ['左侧', '右侧'] : [''];
            for (let side of sides) {
                if (!isPlaying) break;
                if (side) await speak(`${side}开始`);
                else if (a.sets > 1) await speak(`第${s}组`);

                for (let r = 1; r <= a.reps; r++) {
                    if (!isPlaying) break;
                    document.getElementById('totalRep').innerText = a.reps;
                    document.getElementById('curRep').innerText = r;
                    await speak(`第${r}次`);
                    await timer(a.work, `${a.name} ${side}`, 'HOLD');
                    if (r < a.reps && isPlaying) await timer(a.repRest, "放松", "REST");
                }
                if (a.isAlt && side === '左侧' && isPlaying) await timer(a.switchRest || 3, "换边", "SWITCH");
            }
            if (s < a.sets && isPlaying) await timer(a.actionRest || 10, "组间休息", "SET REST");
        }
        if (i < db.actions.length - 1 && isPlaying) await timer(a.groupRest || 15, "切换动作", "BREAK");
    }
    if (isPlaying) finishTraining();
}

function timer(sec, title, status) {
    return new Promise(res => {
        let left = sec;
        document.getElementById('subText').innerText = title;
        document.getElementById('statusText').innerText = status;
        document.getElementById('mainTime').innerText = left;
        
        const t = setInterval(() => {
            if (!isPlaying || skipFlag) { clearInterval(t); skipFlag = false; res(); return; }
            if (isPaused) return;
            left--;
            document.getElementById('mainTime').innerText = left;
            if (left <= 3 && left > 0) speak(left.toString());
            if (left <= 0) { clearInterval(t); res(); }
        }, 1000);
    });
}

// --- UI 与 交互 ---
function setTab(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    // 简单匹配底部导航状态
    event.currentTarget.classList.add('active');
    render();
}

function render() {
    // 渲染动作列表
    document.getElementById('currentActionList').innerHTML = db.actions.map((a, i) => `
        <div class="list-item">
            <div class="sort-btns">
                <button class="sort-btn" onclick="moveAction(${i},-1)"><span class="material-symbols-rounded">expand_less</span></button>
                <button class="sort-btn" onclick="moveAction(${i},1)"><span class="material-symbols-rounded">expand_more</span></button>
            </div>
            <div class="action-content">
                <strong>${a.name}</strong><br><small>${a.sets}组 | ${a.reps}次 | ${a.work}s</small>
            </div>
            <button onclick="deleteAction(${i})" style="color:var(--error); border:none; background:none;"><span class="material-symbols-rounded">delete</span></button>
        </div>
    `).join('');

    // 历史记录
    document.getElementById('historyList').innerHTML = db.history.map(h => `
        <div class="md-card">
            <div style="display:flex; justify-content:space-between"><b>${h.date}</b> <small>${Math.floor(h.duration/60)}m ${h.duration%60}s</small></div>
            <div class="history-detail">${h.actions.map(a => `<small>${a.name}</small>`).join(' · ')}</div>
        </div>
    `).join('');
}

function saveAction() {
    const a = {
        name: document.getElementById('name').value || '未命名',
        sets: parseInt(document.getElementById('sets').value) || 1,
        reps: parseInt(document.getElementById('reps').value) || 1,
        work: parseInt(document.getElementById('work').value) || 5,
        repRest: parseInt(document.getElementById('repRest').value) || 2,
        actionRest: parseInt(document.getElementById('actionRest').value) || 10,
        groupRest: parseInt(document.getElementById('groupRest').value) || 15,
        isAlt: document.getElementById('isAlt').checked
    };
    db.actions.push(a); saveLocal();
}

function deleteAction(i) { db.actions.splice(i,1); saveLocal(); }
function moveAction(i, d) { if(i+d >=0 && i+d < db.actions.length) { [db.actions[i], db.actions[i+d]] = [db.actions[i+d], db.actions[i]]; saveLocal(); } }
function skipCurrent() { skipFlag = true; speak("跳过"); }
function stopTrainer() { if(confirm("停止？")) { isPlaying = false; finishTraining(); } }
function saveLocal() { localStorage.setItem(DB_KEY, JSON.stringify(db)); render(); }
function updateSessionUI() {
    const m = Math.floor(totalSessionSeconds/60).toString().padStart(2,'0');
    const s = (totalSessionSeconds%60).toString().padStart(2,'0');
    document.getElementById('sessionTime').innerText = `${m}:${s}`;
}
function finishTraining() {
    isPlaying = false; clearInterval(timerInterval); clearInterval(sessionInterval);
    document.getElementById('playIcon').innerText = 'play_arrow';
    document.getElementById('stopBtn').classList.add('hidden');
    speak("训练圆满完成");
    db.history.unshift({ date: new Date().toLocaleString(), duration: totalSessionSeconds, actions: [...db.actions] });
    saveLocal();
}

// 锁屏控制
function updateMediaMetadata(t) { if ('mediaSession' in navigator) { navigator.mediaSession.metadata = new MediaMetadata({ title: t, artist: 'REHAB PRO' }); } }

window.onload = () => { migrate(); render(); };
