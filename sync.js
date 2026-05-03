const sync = {
    async sha256(s) {
        const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
        return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, "0")).join("");
    },

    async hmac(k, d) {
        const cK = typeof k === "string" ? new TextEncoder().encode(k) : k;
        const key = await crypto.subtle.importKey("raw", cK, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        return await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(d));
    },

    async s3Req(method, body = null) {
        const { endpoint, region, bucket, key, secret } = data.cfg.s3;
        const host = new URL(endpoint).host;
        const path = `/${bucket}/rehab_pro_data.json`;
        const dt = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
        const date = dt.slice(0, 8);
        const hash = body
            ? await this.sha256(body)
            : "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        const canon = `${method}\n${path}\n\nhost:${host}\nx-amz-content-sha256:${hash}\nx-amz-date:${dt}\n\nhost;x-amz-content-sha256;x-amz-date\n${hash}`;
        const scope = `${date}/${region}/s3/aws4_request`;
        const stringToSign = `AWS4-HMAC-SHA256\n${dt}\n${scope}\n${await this.sha256(canon)}`;
        const kDate = await this.hmac("AWS4" + secret, date);
        const kRegion = await this.hmac(kDate, region);
        const kService = await this.hmac(kRegion, "s3");
        const kSigning = await this.hmac(kService, "aws4_request");
        const sig = Array.from(new Uint8Array(await this.hmac(kSigning, stringToSign)))
            .map(x => x.toString(16).padStart(2, "0")).join("");
        return fetch(`${endpoint}${path}`, {
            method,
            headers: {
                'Authorization': `AWS4-HMAC-SHA256 Credential=${key}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${sig}`,
                'x-amz-date': dt,
                'x-amz-content-sha256': hash,
                'Content-Type': 'application/json'
            },
            body
        });
    },

    davUrl() {
        const cfg = data.cfg.dav || {};
        const base = (cfg.url || '').trim().replace(/\/+$/, '');
        const file = (cfg.path || 'training_assistant_data.json').trim().replace(/^\/+/, '');
        if (!base) throw new Error('请填写 WebDAV 地址');
        return `${base}/${file}`;
    },

    basicAuth(user, pass) {
        const bytes = new TextEncoder().encode(`${user || ''}:${pass || ''}`);
        let binary = '';
        bytes.forEach(b => { binary += String.fromCharCode(b); });
        return btoa(binary);
    },

    davHeaders() {
        const { user, pass } = data.cfg.dav || {};
        const headers = { 'Content-Type': 'application/json' };
        if (user || pass) headers.Authorization = `Basic ${this.basicAuth(user, pass)}`;
        return headers;
    },

    async davReq(method, body = null) {
        return fetch(this.davUrl(), {
            method,
            headers: this.davHeaders(),
            body
        });
    },

    async syncReq(method, body = null) {
        if (data.cfg.mode === 's3') return this.s3Req(method, body);
        if (data.cfg.mode === 'webdav') return this.davReq(method, body);
        throw new Error('请先选择并保存同步方式');
    },

    saveConfig() {
        data.cfg.mode = document.getElementById('syncMode').value;
        data.cfg.s3 = {
            endpoint: document.getElementById('s3Endpoint').value,
            region: document.getElementById('s3Region').value || 'us-east-1',
            bucket: document.getElementById('s3Bucket').value,
            key: document.getElementById('s3Key').value,
            secret: document.getElementById('s3Secret').value
        };
        data.cfg.dav = {
            url: document.getElementById('davUrl').value,
            user: document.getElementById('davUser').value,
            pass: document.getElementById('davPass').value,
            path: document.getElementById('davPath').value || 'training_assistant_data.json'
        };
        localStorage.setItem(data.CFG_KEY, JSON.stringify(data.cfg));
        this.setStatus(data.cfg.mode === 'none' ? 'local' : 'cloud');
        alert("配置已本地保存");
    },

    async pull() {
        try {
            this.setStatus('syncing');
            const res = await this.syncReq('GET');
            if (res.ok) {
                const remote = await res.json();
                data.db = { ...data.db, ...remote };
                data.save();
                data.render();
                this.setStatus('cloud');
                alert("下载恢复成功（含训练历史）");
            } else {
                this.setStatus('error');
                alert("拉取失败，请检查参数");
            }
        } catch (e) { this.setStatus('error'); alert("同步失败: " + e.message); }
    },

    async push() {
        try {
            this.setStatus('syncing');
            const payload = JSON.stringify(data.db);
            const res = await this.syncReq('PUT', payload);
            this.setStatus(res.ok ? 'cloud' : 'error');
            if (res.ok) alert("备份成功（含训练历史、方案库、动作列表）");
            else alert("备份失败，请检查参数");
        } catch (e) { this.setStatus('error'); alert("备份失败: " + e.message); }
    },

    async autoBackup(reason = 'auto') {
        if (data.cfg.mode === 'none') return;
        if (data.cfg.mode === 's3') {
            const { endpoint, region, bucket, key, secret } = data.cfg.s3 || {};
            if (!endpoint || !region || !bucket || !key || !secret) return;
        }
        if (data.cfg.mode === 'webdav') {
            const { url } = data.cfg.dav || {};
            if (!url) return;
        }
        this.setStatus('syncing');
        try {
            const res = await this.syncReq('PUT', JSON.stringify(data.db));
            this.setStatus(res.ok ? 'cloud' : 'error');
            if (!res.ok) console.warn('Auto backup failed', reason, res.status);
        } catch (e) {
            this.setStatus('error');
            console.warn('Auto backup failed', reason, e);
        }
    },

    setStatus(state) {
        const el = document.getElementById('syncStatus');
        if (!el) return;
        const map = {
            local: ['cloud_off', '本地'],
            syncing: ['sync', '同步中'],
            cloud: ['cloud_done', '云端'],
            error: ['cloud_alert', '同步失败']
        };
        const [icon, label] = map[state] || map.local;
        el.innerHTML = `<span class="material-symbols-rounded" style="font-size:14px">${icon}</span> ${label}`;
        el.dataset.state = state;
    },

    toggleFields(m) {
        document.getElementById('s3Fields').classList.toggle('hidden', m !== 's3');
        document.getElementById('webdavFields').classList.toggle('hidden', m !== 'webdav');
    },

    initUI() {
        data.cfg.s3 = data.cfg.s3 || {};
        data.cfg.dav = data.cfg.dav || {};
        document.getElementById('s3Endpoint').value = data.cfg.s3.endpoint || '';
        document.getElementById('s3Region').value = data.cfg.s3.region || 'us-east-1';
        document.getElementById('s3Bucket').value = data.cfg.s3.bucket || '';
        document.getElementById('s3Key').value = data.cfg.s3.key || '';
        document.getElementById('s3Secret').value = data.cfg.s3.secret || '';
        document.getElementById('davUrl').value = data.cfg.dav.url || '';
        document.getElementById('davUser').value = data.cfg.dav.user || '';
        document.getElementById('davPass').value = data.cfg.dav.pass || '';
        document.getElementById('davPath').value = data.cfg.dav.path || 'training_assistant_data.json';
        const mode = data.cfg.mode || 'none';
        document.getElementById('syncMode').value = mode;
        this.toggleFields(mode);
        this.setStatus(mode === 'none' ? 'local' : 'cloud');
    }
};
