// 注意：cfg 独立于 db 存储，防止拉取失败导致配置丢失
let cfg = JSON.parse(localStorage.getItem('rp_v30_cfg')) || { mode: 'none', s3: {}, dav: {} };

async function sha256(str) { const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)); return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join(""); }
async function hmac(key, data) { const cKey = typeof key === "string" ? new TextEncoder().encode(key) : key; const cryptoKey = await crypto.subtle.importKey("raw", cKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data)); }

async function s3Req(method, body = null) {
    const { endpoint, bucket, region, key, secret } = cfg.s3;
    const urlObj = new URL(endpoint);
    const host = urlObj.host;
    const path = `/${bucket}/rehab_v30.json`;
    const datetime = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const date = datetime.slice(0, 8);
    const hashedPayload = body ? await sha256(body) : "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const canonicalRequest = `${method}\n${path}\n\nhost:${host}\nx-amz-content-sha256:${hashedPayload}\nx-amz-date:${datetime}\n\nhost;x-amz-content-sha256;x-amz-date\n${hashedPayload}`;
    const scope = `${date}/${region}/s3/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${datetime}\n${scope}\n${await sha256(canonicalRequest)}`;
    const kDate = await hmac("AWS4" + secret, date);
    const kRegion = await hmac(kDate, region);
    const kService = await hmac(kRegion, "s3");
    const kSigning = await hmac(kService, "aws4_request");
    const signature = Array.from(new Uint8Array(await hmac(kSigning, stringToSign))).map(b => b.toString(16).padStart(2, "0")).join("");

    return fetch(`${endpoint}${path}`, {
        method,
        headers: {
            'Authorization': `AWS4-HMAC-SHA256 Credential=${key}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${signature}`,
            'x-amz-date': datetime,
            'x-amz-content-sha256': hashedPayload
        },
        body
    });
}

function saveSyncConfig() {
    cfg.mode = document.getElementById('syncMode').value;
    cfg.s3 = {
        endpoint: document.getElementById('s3Endpoint').value,
        bucket: document.getElementById('s3Bucket').value,
        region: document.getElementById('s3Region').value || 'auto',
        key: document.getElementById('s3Key').value,
        secret: document.getElementById('s3Secret').value
    };
    localStorage.setItem('rp_v30_cfg', JSON.stringify(cfg));
    alert("配置已保存。请手动点击“下载云端数据”。");
}

async function manualPull() {
    try {
        const res = await s3Req('GET');
        if(res.ok) {
            const data = await res.json();
            localStorage.setItem('rp_v30_db', JSON.stringify(data));
            location.reload();
        } else { alert("拉取失败，请检查参数。"); }
    } catch(e) { alert("网络错误。"); }
}

async function manualPush() {
    try {
        const res = await s3Req('PUT', localStorage.getItem('rp_v30_db'));
        if(res.ok) alert("备份成功！");
    } catch(e) { alert("上传失败。"); }
}

function toggleSyncFields() {
    document.getElementById('s3Fields').classList.toggle('hidden', document.getElementById('syncMode').value !== 's3');
}

// 自动初始化UI
window.addEventListener('load', () => {
    if(cfg.s3.endpoint) {
        document.getElementById('s3Endpoint').value = cfg.s3.endpoint;
        document.getElementById('s3Bucket').value = cfg.s3.bucket;
        document.getElementById('s3Key').value = cfg.s3.key;
        document.getElementById('s3Secret').value = cfg.s3.secret;
        toggleSyncFields();
    }
});
