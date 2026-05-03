// --- 核心签名逻辑 ---
async function sha256(str) { const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)); return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join(""); }
async function hmac(key, data) { const cKey = typeof key === "string" ? new TextEncoder().encode(key) : key; const cryptoKey = await crypto.subtle.importKey("raw", cKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data)); }

async function s3Req(method, body = null) {
    const { endpoint, bucket, region, key, secret } = cfg.s3;
    const host = new URL(endpoint).host;
    const path = `/${bucket}/rehab_v29.json`;
    const datetime = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const date = datetime.slice(0, 8);
    const hashedPayload = body ? await sha256(body) : "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const canonicalRequest = `${method}\n${path}\n\nhost:${host}\nx-amz-content-sha256:${hashedPayload}\nx-amz-date:${datetime}\n\nhost;x-amz-content-sha256;x-amz-date\n${hashedPayload}`;
    const stringToSign = `AWS4-HMAC-SHA256\n${datetime}\n${date}/${region}/s3/aws4_request\n${await sha256(canonicalRequest)}`;
    
    const kDate = await hmac("AWS4" + secret, date);
    const kRegion = await hmac(kDate, region);
    const kService = await hmac(kRegion, "s3");
    const kSigning = await hmac(kService, "aws4_request");
    const signature = Array.from(new Uint8Array(await hmac(kSigning, stringToSign))).map(b => b.toString(16).padStart(2, "0")).join("");

    return fetch(`${endpoint}${path}`, { method, headers: { 'Authorization': `AWS4-HMAC-SHA256 Credential=${key}/${date}/${region}/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${signature}`, 'x-amz-date': datetime, 'x-amz-content-sha256': hashedPayload }, body });
}

async function davReq(method, body = null) {
    const { url, user, pass } = cfg.dav;
    const auth = btoa(`${user}:${pass}`);
    return fetch(url.endsWith('/')?url+'rehab.json':url+'/rehab.json', { method, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }, body });
}

// --- 同步分步逻辑 ---
function saveSyncConfig() {
    cfg.mode = document.getElementById('syncMode').value;
    cfg.s3 = { endpoint: document.getElementById('s3Endpoint').value, bucket: document.getElementById('s3Bucket').value, region: document.getElementById('s3Region').value, key: document.getElementById('s3Key').value, secret: document.getElementById('s3Secret').value };
    cfg.dav = { url: document.getElementById('davUrl').value, user: document.getElementById('davUser').value, pass: document.getElementById('davPass').value };
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
    alert("配置已本地保存。如果是新设备，请点击“从云端下载”。");
}

async function manualPull() {
    document.getElementById('syncStatus').innerText = "● PULLING...";
    try {
        const res = (cfg.mode === 's3') ? await s3Req('GET') : await davReq('GET');
        if(res.ok) {
            db = await res.json();
            localStorage.setItem(DB_KEY, JSON.stringify(db));
            location.reload(); // 刷新以应用云端数据
        } else { alert("下载失败，请检查配置。"); }
    } catch(e) { alert("网络错误。"); }
}

async function manualPush() {
    document.getElementById('syncStatus').innerText = "● PUSHING...";
    try {
        const res = (cfg.mode === 's3') ? await s3Req('PUT', JSON.stringify(db)) : await davReq('PUT', JSON.stringify(db));
        if(res.ok) { document.getElementById('syncStatus').innerText = "● SYNCED"; }
    } catch(e) {}
}

function toggleSyncFields() {
    const m = document.getElementById('syncMode').value;
    document.getElementById('s3Fields').classList.toggle('hidden', m !== 's3');
    document.getElementById('webdavFields').classList.toggle('hidden', m !== 'webdav');
}
