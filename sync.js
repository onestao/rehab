const sync = {
    async sha256(s) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, "0")).join(""); },
    async hmac(k, d) { const cK = typeof k === "string" ? new TextEncoder().encode(k) : k; const key = await crypto.subtle.importKey("raw", cK, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(d)); },

    async s3Req(method, body = null) {
        const { endpoint, bucket, key, secret } = data.cfg.s3;
        const host = new URL(endpoint).host;
        const path = `/${bucket}/rehab_pro_data.json`;
        const dt = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
        const date = dt.slice(0, 8);
        const hash = body ? await this.sha256(body) : "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        const canon = `${method}\n${path}\n\nhost:${host}\nx-amz-content-sha256:${hash}\nx-amz-date:${dt}\n\nhost;x-amz-content-sha256;x-amz-date\n${hash}`;
        const scope = `${date}/auto/s3/aws4_request`;
        const stringToSign = `AWS4-HMAC-SHA256\n${dt}\n${scope}\n${await this.sha256(canon)}`;
        const kDate = await this.hmac("AWS4" + secret, date);
        const kRegion = await this.hmac(kDate, "auto");
        const kService = await this.hmac(kRegion, "s3");
        const kSigning = await this.hmac(kService, "aws4_request");
        const sig = Array.from(new Uint8Array(await this.hmac(kSigning, stringToSign))).map(x => x.toString(16).padStart(2, "0")).join("");
        return fetch(`${endpoint}${path}`, { method, headers: { 'Authorization': `AWS4-HMAC-SHA256 Credential=${key}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${sig}`, 'x-amz-date': dt, 'x-amz-content-sha256': hash }, body });
    },

    saveConfig() {
        data.cfg.mode = document.getElementById('syncMode').value;
        data.cfg.s3 = { endpoint: document.getElementById('s3Endpoint').value, bucket: document.getElementById('s3Bucket').value, key: document.getElementById('s3Key').value, secret: document.getElementById('s3Secret').value };
        localStorage.setItem(data.CFG_KEY, JSON.stringify(data.cfg));
        alert("配置已本地保存");
    },

    async pull() {
        try {
            const res = await this.s3Req('GET');
            if(res.ok) { data.db = await res.json(); data.save(); location.reload(); }
            else alert("拉取失败，请检查参数");
        } catch(e) { alert("同步失败: " + e.message); }
    },

    async push() {
        try {
            const res = await this.s3Req('PUT', JSON.stringify(data.db));
            if(res.ok) alert("备份成功");
        } catch(e) { alert("备份失败"); }
    },

    toggleFields(m) { document.getElementById('s3Fields').classList.toggle('hidden', m !== 's3'); },

    initUI() {
        if(data.cfg.s3.endpoint) {
            document.getElementById('s3Endpoint').value = data.cfg.s3.endpoint;
            document.getElementById('s3Bucket').value = data.cfg.s3.bucket;
            document.getElementById('s3Key').value = data.cfg.s3.key;
            document.getElementById('s3Secret').value = data.cfg.s3.secret;
            document.getElementById('syncMode').value = data.cfg.mode;
            this.toggleFields(data.cfg.mode);
        }
    }
};