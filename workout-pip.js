Object.assign(workout, {
    isDocPipSupported() {
        return 'documentPictureInPicture' in window && typeof window.documentPictureInPicture.requestWindow === 'function';
    },

    isVideoPipSupported() {
        const video = document.getElementById('pipVideo');
        return !!(video && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled && typeof video.requestPictureInPicture === 'function');
    },

    isPipSupported() {
        return this.isDocPipSupported() || this.isVideoPipSupported();
    },

    isPipActive() {
        return !!((this.pipWindow && !this.pipWindow.closed) || document.pictureInPictureElement === document.getElementById('pipVideo'));
    },

    updatePipButton() {
        const btn = document.getElementById('pipBtn');
        const icon = document.getElementById('pipIcon');
        if (!btn || !icon) return;
        const active = this.isPipActive();
        btn.classList.toggle('active', active);
        btn.classList.toggle('unsupported', !this.isPipSupported());
        btn.setAttribute('aria-label', active ? '关闭训练画中画' : '打开训练画中画');
        icon.innerText = active ? 'close_fullscreen' : 'picture_in_picture_alt';
    },

    async togglePip() {
        if (this.isPipActive()) {
            this.closePip();
            return;
        }
        await this.openPip();
    },

    async openPip() {
        if (!this.isPlaying) {
            this.showToast('请先开始训练，再打开画中画保活小窗');
            return;
        }
        this.reinforceKeepAlive();
        if (this.isDocPipSupported()) {
            try {
                await this.openDocumentPip();
                return;
            } catch (e) {
                console.warn('Document Picture-in-Picture unavailable', e);
            }
        }
        if (this.isVideoPipSupported()) {
            try {
                await this.openVideoPip();
                return;
            } catch (e) {
                console.warn('Video Picture-in-Picture unavailable', e);
            }
        }
        this.pipWindow = null;
        this.pipMode = null;
        this.updatePipButton();
        this.showToast('当前浏览器不支持画中画保活，已继续使用后台音频保活');
    },

    async openDocumentPip() {
        const pip = await window.documentPictureInPicture.requestWindow({ width: 360, height: 480 });
        this.pipWindow = pip;
        this.pipMode = 'document';
        this.writePipDocument(pip.document);
        this.bindPipControls(pip);
        pip.addEventListener('pagehide', () => {
            if (this.pipWindow === pip) {
                this.stopPipSync();
                this.pipWindow = null;
                this.pipMode = null;
                this.updatePipButton();
            }
        });
        this.startPipSync();
        this.renderPip();
        this.updatePipButton();
    },

    async openVideoPip() {
        const video = document.getElementById('pipVideo');
        if (!video) throw new Error('pipVideo not found');
        this.ensureVideoPipStream(video);
        video.muted = true;
        video.playsInline = true;
        await video.play();
        await video.requestPictureInPicture();
        this.pipMode = 'video';
        video.onleavepictureinpicture = () => {
            if (this.pipMode === 'video') {
                this.stopPipSync();
                this.pipMode = null;
                this.clearVideoPipHandlers(video);
                this.updatePipButton();
            }
        };
        video.onpause = () => this.syncVideoPipPlayback(false, video);
        video.onplay = () => this.syncVideoPipPlayback(true, video);
        this.startPipSync();
        this.renderPip();
        this.showToast('已打开视频画中画：可用小窗播放/暂停控制训练');
        this.updatePipButton();
    },

    syncVideoPipPlayback(playing, video) {
        if (this._pipVideoControlSync || this.pipMode !== 'video' || !this.isPlaying) return;
        this.setTrainingPaused(!playing);
        this.syncPipVideoElement(playing, video);
    },

    syncPipVideoElement(playing, video = document.getElementById('pipVideo')) {
        if (!video || this.pipMode !== 'video') return;
        this._pipVideoControlSync = true;
        if (playing) {
            if (video.paused) {
                video.play().catch(() => {}).finally(() => { this._pipVideoControlSync = false; });
                return;
            }
        } else if (!video.paused) {
            video.pause();
        }
        this._pipVideoControlSync = false;
    },

    clearVideoPipHandlers(video = document.getElementById('pipVideo')) {
        if (!video) return;
        video.onleavepictureinpicture = null;
        video.onpause = null;
        video.onplay = null;
        this._pipVideoControlSync = false;
    },

    startPipSync() {
        clearInterval(this.pipSyncInt);
        this.pipSyncInt = setInterval(() => {
            this.reinforceKeepAlive();
            this.renderPip();
        }, 1000);
    },

    stopPipSync() {
        clearInterval(this.pipSyncInt);
        this.pipSyncInt = null;
    },

    closePip() {
        this.stopPipSync();
        const pip = this.pipWindow;
        this.pipWindow = null;
        if (pip && !pip.closed) pip.close();
        const video = document.getElementById('pipVideo');
        this.clearVideoPipHandlers(video);
        if (document.pictureInPictureElement === video && typeof document.exitPictureInPicture === 'function') {
            document.exitPictureInPicture().catch(() => {});
        }
        this.pipMode = null;
        this.updatePipButton();
    },

    writePipDocument(doc) {
        doc.open();
        doc.write(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>训练画中画</title><style>${this.pipStyles()}</style></head><body><main class="pip-card"><div class="pip-head"><span class="pip-kicker">训练助手</span><button id="pipClose" class="pip-icon-btn" aria-label="关闭">×</button></div><div id="pipStatus" class="pip-status">READY</div><div id="pipTime" class="pip-time">00</div><div id="pipSub" class="pip-sub">准备就绪</div><div id="pipNext" class="pip-next"></div><div class="pip-stats"><div><small id="pipLabelA">总用时</small><b id="pipValueA">00:00</b></div><div><small id="pipLabelB">组数</small><b id="pipValueB">0/0</b></div><div><small id="pipLabelC">次数</small><b id="pipValueC">0/0</b></div></div><div class="pip-actions"><button id="pipPlay" class="pip-btn pip-primary">暂停</button><button id="pipSkip" class="pip-btn">跳过</button><button id="pipStop" class="pip-btn pip-danger">停止</button></div><p class="pip-hint">保持此小窗可降低后台暂停概率</p></main></body></html>`);
        doc.close();
    },

    legacyPipStyles() {
        return `:root{color-scheme:dark;--primary:#a0cafd;--primary-container:#00497d;--surface:#111418;--surface-high:#1e2024;--surface-higher:#282a2f;--on:#e3e2e6;--muted:#c3c7cf;--danger:#ffb4ab;--danger-bg:#93000a}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at top right,rgba(160,202,253,.22),transparent 46%),linear-gradient(145deg,#001d36,#00497d 52%,#0061a4);font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans SC',sans-serif;color:var(--on);overflow:hidden}.pip-card{width:100%;min-height:100vh;padding:16px;display:grid;grid-template-rows:auto auto auto auto auto 1fr auto;gap:10px}.pip-head{display:flex;align-items:center;justify-content:space-between}.pip-kicker{font-size:12px;font-weight:900;letter-spacing:.18em;color:var(--primary);text-transform:uppercase}.pip-icon-btn{width:34px;height:34px;border:0;border-radius:999px;background:rgba(255,255,255,.12);color:var(--on);font-size:24px;line-height:1;cursor:pointer}.pip-status{justify-self:start;padding:4px 10px;border-radius:999px;background:rgba(209,228,255,.14);color:var(--primary);font-size:12px;font-weight:900;letter-spacing:.16em}.pip-time{font-size:clamp(58px,27vw,96px);font-weight:950;line-height:.95;color:#d1e4ff;text-shadow:0 8px 32px rgba(160,202,253,.28);font-variant-numeric:tabular-nums;letter-spacing:-2px}.pip-sub{min-height:42px;color:rgba(255,255,255,.72);font-size:16px;font-weight:700;line-height:1.35;word-break:break-word}.pip-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.pip-stats div{padding:10px 8px;border-radius:18px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.1)}.pip-stats small{display:block;color:rgba(255,255,255,.58);font-size:11px;font-weight:700}.pip-stats b{display:block;margin-top:3px;color:#fff;font-size:15px;font-variant-numeric:tabular-nums}.pip-actions{align-self:end;display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:8px}.pip-btn{height:46px;border:0;border-radius:999px;background:rgba(255,255,255,.14);color:var(--on);font-size:14px;font-weight:900;cursor:pointer}.pip-btn:disabled{opacity:.42;cursor:not-allowed}.pip-primary{background:var(--primary);color:#003258}.pip-danger{background:var(--danger-bg);color:var(--danger)}.pip-hint{margin:0;text-align:center;color:rgba(255,255,255,.48);font-size:11px}.paused .pip-status{background:rgba(242,218,255,.18);color:#f2daff}.paused .pip-primary{background:#f2daff;color:#3b2948}`;
    },

    pipStyles() {
        return `
            :root{color-scheme:dark;--primary:#a0cafd;--surface:#111418;--on:#e3e2e6;--danger:#ffb4ab}
            *{box-sizing:border-box}
            body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 80% 8%,rgba(160,202,253,.28),transparent 44%),radial-gradient(circle at 12% 84%,rgba(209,228,255,.16),transparent 38%),linear-gradient(145deg,#001d36,#00497d 52%,#0061a4);font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans SC',sans-serif;color:var(--on);overflow:hidden;text-align:center}
            .pip-card{width:100%;min-height:100vh;padding:18px;display:grid;grid-template-rows:auto auto minmax(90px,1fr) auto auto auto auto;gap:14px;background:rgba(17,20,24,.08)}
            .pip-head{display:flex;align-items:center;justify-content:space-between;text-align:left}
            .pip-kicker{font-size:13px;font-weight:950;letter-spacing:.18em;color:var(--primary);text-transform:uppercase}
            .pip-icon-btn{width:38px;height:38px;border:0;border-radius:999px;background:rgba(255,255,255,.14);color:var(--on);font-size:26px;line-height:1;cursor:pointer}
            .pip-status{justify-self:center;display:inline-flex;align-items:center;justify-content:center;padding:6px 14px;border-radius:999px;background:rgba(209,228,255,.15);color:var(--primary);font-size:13px;font-weight:950;letter-spacing:.16em;min-width:96px}
            .pip-time{align-self:end;font-size:clamp(72px,28vw,118px);font-weight:950;line-height:.9;color:#d1e4ff;text-shadow:0 10px 34px rgba(160,202,253,.32);font-variant-numeric:tabular-nums;letter-spacing:-3px}
            .pip-sub{align-self:start;min-height:52px;color:rgba(255,255,255,.78);font-size:18px;font-weight:800;line-height:1.35;word-break:break-word;display:flex;align-items:flex-start;justify-content:center;padding:0 8px}
            .pip-next{color:rgba(160,202,253,.85);font-size:14px;font-weight:800;text-align:center;min-height:20px;line-height:1.35}
            .pip-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
            .pip-stats div{padding:12px 8px;border-radius:20px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 26px rgba(0,0,0,.14)}
            .pip-stats small{display:block;color:rgba(255,255,255,.64);font-size:12px;font-weight:800;line-height:1.2}
            .pip-stats b{display:block;margin-top:4px;color:#fff;font-size:17px;font-weight:950;font-variant-numeric:tabular-nums;line-height:1.18}
            .pip-actions{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:10px}
            .pip-btn{height:46px;border:0;border-radius:18px;background:rgba(255,255,255,.15);color:var(--on);font-size:15px;font-weight:950;cursor:pointer;box-shadow:0 10px 24px rgba(0,0,0,.14)}
            .pip-btn:disabled{opacity:.42}
            .pip-primary{background:#d1e4ff;color:#003258}
            .pip-danger{background:rgba(255,180,171,.2);color:var(--danger)}
            .pip-hint{margin:0;color:rgba(255,255,255,.58);font-size:12px;font-weight:700;line-height:1.35}
            .paused .pip-card{background:rgba(0,0,0,.2)}
            .paused .pip-status{background:rgba(242,218,255,.18);color:#f2daff}
            @media (max-width:330px),(max-height:390px){.pip-card{padding:14px;gap:10px}.pip-time{font-size:clamp(58px,27vw,92px)}.pip-sub{font-size:16px;min-height:42px}.pip-stats{gap:7px}.pip-stats div{padding:9px 5px;border-radius:16px}.pip-stats b{font-size:14px}.pip-btn{height:40px;font-size:13px}.pip-hint{font-size:11px}}
        `;
    },

    bindPipControls(pip) {
        const doc = pip.document;
        doc.getElementById('pipClose').addEventListener('click', () => this.closePip());
        doc.getElementById('pipPlay').addEventListener('click', () => this.toggle());
        doc.getElementById('pipSkip').addEventListener('click', () => this.skip());
        doc.getElementById('pipStop').addEventListener('click', () => {
            if (this.mode === 'cardio') cardio.stop();
            else this.stop();
        });
    },

    renderPip() {
        if (this.pipMode === 'video') {
            this.drawVideoPipFrame();
            this.updatePipButton();
            return;
        }
        const pip = this.pipWindow;
        if (!pip || pip.closed) {
            this.updatePipButton();
            return;
        }
        const doc = pip.document;
        const text = id => document.getElementById(id)?.innerText || '';
        doc.body.classList.toggle('paused', this.isPaused);
        doc.getElementById('pipStatus').innerText = this.isPaused ? 'PAUSED' : text('statusText');
        doc.getElementById('pipTime').innerText = text('mainTime');
        doc.getElementById('pipSub').innerText = text('subText');
        doc.getElementById('pipLabelA').innerText = document.querySelectorAll('.stat-label')[0]?.innerText || '总用时';
        doc.getElementById('pipValueA').innerText = text('sessionTime');
        doc.getElementById('pipLabelB').innerText = document.querySelectorAll('.stat-label')[1]?.innerText || '组数';
        doc.getElementById('pipValueB').innerText = `${text('curSet')}/${text('totalSet')}`;
        doc.getElementById('pipLabelC').innerText = document.querySelectorAll('.stat-label')[2]?.innerText || '次数';
        doc.getElementById('pipValueC').innerText = `${text('curRep')}/${text('totalRep')}`;
        const pipNext = doc.getElementById('pipNext');
        if (pipNext) {
            const next = workout._nextActionName || '';
            const done = workout._doneSetsAll || 0;
            const total = workout._totalSetsAll || 0;
            pipNext.innerText = next ? `下一组：${next}${total ? ` · ${done}/${total}` : ''}` : '';
        }
        doc.getElementById('pipPlay').innerText = this.isPaused ? '继续' : '暂停';
        doc.getElementById('pipSkip').disabled = this.mode === 'cardio' || !this.isPlaying;
        this.updatePipButton();
    },

    ensureVideoPipStream(video) {
        if (!this.pipCanvas) {
            this.pipCanvas = document.createElement('canvas');
            this.pipCanvas.width = 640;
            this.pipCanvas.height = 360;
            this.pipCtx = this.pipCanvas.getContext('2d');
        }
        this.drawVideoPipFrame();
        if (!this.pipStream) this.pipStream = this.pipCanvas.captureStream(2);
        if (video.srcObject !== this.pipStream) video.srcObject = this.pipStream;
    },

    drawVideoPipFrame() {
        if (!this.pipCanvas || !this.pipCtx) return;
        const ctx = this.pipCtx;
        const w = this.pipCanvas.width;
        const h = this.pipCanvas.height;
        const text = id => document.getElementById(id)?.innerText || '';
        const labels = document.querySelectorAll('.stat-label');
        const status = this.isPaused ? 'PAUSED' : text('statusText');
        const time = text('mainTime') || '00';
        const sub = text('subText') || '训练中';
        const labelA = labels[0]?.innerText || '总用时';
        const labelB = labels[1]?.innerText || '组数';
        const labelC = labels[2]?.innerText || '次数';
        const valueA = text('sessionTime');
        const valueB = `${text('curSet')}/${text('totalSet')}`;
        const valueC = `${text('curRep')}/${text('totalRep')}`;
        const grd = ctx.createLinearGradient(0, 0, w, h);
        grd.addColorStop(0, '#001d36');
        grd.addColorStop(0.55, this.isPaused ? '#523f5f' : '#00497d');
        grd.addColorStop(1, '#0061a4');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(209,228,255,0.12)';
        ctx.beginPath();
        ctx.arc(w - 70, 72, 120, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.roundRect(28, 24, w - 56, h - 48, 28);
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#a0cafd';
        ctx.font = '900 22px system-ui, sans-serif';
        ctx.fillText('训练助手', w / 2, 60);
        ctx.fillStyle = this.isPaused ? '#f2daff' : '#d1e4ff';
        ctx.font = '900 24px system-ui, sans-serif';
        ctx.fillText(status, w / 2, 98);
        ctx.fillStyle = '#d1e4ff';
        ctx.font = '900 116px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(time, w / 2, 172);
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.font = '800 30px system-ui, sans-serif';
        this.wrapCanvasText(ctx, sub, w / 2, 250, w - 112, 34, 2);
        const next = workout._nextActionName || '';
        if (next) {
            ctx.fillStyle = 'rgba(160,202,253,0.85)';
            ctx.font = '800 22px system-ui, sans-serif';
            const progress = workout._totalSetsAll ? ` · ${workout._doneSetsAll || 0}/${workout._totalSetsAll}` : '';
            ctx.fillText(`下一组：${next}${progress}`, w / 2, 320);
        }
        ctx.textAlign = 'left';
        this.drawVideoPipStat(ctx, 55, 294, labelA, valueA);
        this.drawVideoPipStat(ctx, 238, 294, labelB, valueB);
        this.drawVideoPipStat(ctx, 421, 294, labelC, valueC);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    },

    drawVideoPipStat(ctx, x, y, label, value) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.roundRect(x, y, 164, 42, 18);
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.62)';
        ctx.font = '800 14px system-ui, sans-serif';
        ctx.fillText(label, x + 82, y + 17);
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 18px system-ui, sans-serif';
        ctx.fillText(value || '-', x + 82, y + 35);
    },

    wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
        const chars = String(text).split('');
        let line = '';
        let lineNo = 0;
        for (const ch of chars) {
            const testLine = line + ch;
            if (ctx.measureText(testLine).width > maxWidth && line) {
                ctx.fillText(line, x, y + lineNo * lineHeight);
                line = ch;
                lineNo++;
                if (lineNo >= maxLines) return;
            } else {
                line = testLine;
            }
        }
        if (lineNo < maxLines) ctx.fillText(line, x, y + lineNo * lineHeight);
    },
});
