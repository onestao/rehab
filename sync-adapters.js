// @ts-nocheck
(function () {
    function requireS3Config() {
        const cfg = data.cfg.s3 || {};
        const { endpoint, region, bucket, key, secret } = cfg;
        if (!endpoint || !region || !bucket || !key || !secret) throw new Error('请完整填写 S3 参数');
        return cfg;
    }

    window.syncAdapters = {
        async s3Req(sync, method, remotePath, body = null, extraHeaders = {}) {
            const { endpoint, region, bucket, key, secret } = requireS3Config();
            const host = new URL(endpoint).host;
            const path = `/${bucket}/${remotePath}`;
            const dt = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
            const date = dt.slice(0, 8);
            const hash = body
                ? await sync.sha256(body)
                : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
            const canon = `${method}\n${path}\n\nhost:${host}\nx-amz-content-sha256:${hash}\nx-amz-date:${dt}\n\nhost;x-amz-content-sha256;x-amz-date\n${hash}`;
            const scope = `${date}/${region}/s3/aws4_request`;
            const stringToSign = `AWS4-HMAC-SHA256\n${dt}\n${scope}\n${await sync.sha256(canon)}`;
            const kDate = await sync.hmac('AWS4' + secret, date);
            const kRegion = await sync.hmac(kDate, region);
            const kService = await sync.hmac(kRegion, 's3');
            const kSigning = await sync.hmac(kService, 'aws4_request');
            const sig = Array.from(new Uint8Array(await sync.hmac(kSigning, stringToSign)))
                .map(x => x.toString(16).padStart(2, '0')).join('');

            return fetch(`${endpoint}${path}`, {
                method,
                headers: {
                    Authorization: `AWS4-HMAC-SHA256 Credential=${key}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${sig}`,
                    'x-amz-date': dt,
                    'x-amz-content-sha256': hash,
                    'Content-Type': 'application/json',
                    ...extraHeaders
                },
                body
            });
        },

        async s3PutBlob(sync, remotePath, blob, contentType = 'application/octet-stream') {
            const { endpoint, region, bucket, key, secret } = requireS3Config();
            const host = new URL(endpoint).host;
            const path = `/${bucket}/${remotePath}`;
            const dt = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
            const date = dt.slice(0, 8);
            const buf = await blob.arrayBuffer();
            const hash = await sync.sha256(new Uint8Array(buf));
            const canon = `PUT\n${path}\n\nhost:${host}\nx-amz-content-sha256:${hash}\nx-amz-date:${dt}\n\nhost;x-amz-content-sha256;x-amz-date\n${hash}`;
            const scope = `${date}/${region}/s3/aws4_request`;
            const stringToSign = `AWS4-HMAC-SHA256\n${dt}\n${scope}\n${await sync.sha256(canon)}`;
            const kDate = await sync.hmac('AWS4' + secret, date);
            const kRegion = await sync.hmac(kDate, region);
            const kService = await sync.hmac(kRegion, 's3');
            const kSigning = await sync.hmac(kService, 'aws4_request');
            const sig = Array.from(new Uint8Array(await sync.hmac(kSigning, stringToSign)))
                .map(x => x.toString(16).padStart(2, '0')).join('');

            return fetch(`${endpoint}${path}`, {
                method: 'PUT',
                headers: {
                    Authorization: `AWS4-HMAC-SHA256 Credential=${key}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${sig}`,
                    'x-amz-date': dt,
                    'x-amz-content-sha256': hash,
                    'Content-Type': contentType
                },
                body: buf
            });
        },

        davRoot() {
            const cfg = data.cfg.dav || {};
            const raw = String(cfg.path || '').trim().replace(/^\/+|\/+$/g, '');
            if (!raw) return '';
            if (/\.json$/i.test(raw)) {
                const pos = raw.lastIndexOf('/');
                return pos >= 0 ? raw.slice(0, pos) : '';
            }
            return raw;
        },

        davUrl(remotePath) {
            const cfg = data.cfg.dav || {};
            const base = (cfg.url || '').trim().replace(/\/+$/, '');
            if (!base) throw new Error('请填写 WebDAV 地址');
            const root = this.davRoot();
            const cleanPath = String(remotePath || '').replace(/^\/+/, '');
            return `${base}/${root ? `${root}/` : ''}${cleanPath}`;
        },

        basicAuth(user, pass) {
            const bytes = new TextEncoder().encode(`${user || ''}:${pass || ''}`);
            let binary = '';
            bytes.forEach(b => { binary += String.fromCharCode(b); });
            return btoa(binary);
        },

        davHeaders(extraHeaders = {}) {
            const { user, pass } = data.cfg.dav || {};
            const headers = { 'Content-Type': 'application/json', ...extraHeaders };
            if (user || pass) headers.Authorization = `Basic ${this.basicAuth(user, pass)}`;
            return headers;
        },

        async ensureWebdavDirs(remotePath) {
            const cfg = data.cfg.dav || {};
            const base = (cfg.url || '').trim().replace(/\/+$/, '');
            const root = this.davRoot();
            const cleanPath = String(remotePath || '').replace(/^\/+/, '');
            const fullBase = `${base}/${root ? `${root}/` : ''}`;
            const parts = cleanPath.split('/');
            let currentPath = '';
            for (let i = 0; i < parts.length - 1; i++) {
                currentPath += parts[i] + '/';
                try {
                    const res = await fetch(`${fullBase}${currentPath}`, {
                        method: 'MKCOL',
                        headers: this.davHeaders()
                    });
                    if (res.status === 405 || res.status === 409) continue;
                } catch (e) {
                    console.warn('MKCOL failed', currentPath, e);
                }
            }
        },

        async davReq(method, remotePath, body = null, extraHeaders = {}) {
            return fetch(this.davUrl(remotePath), {
                method,
                headers: this.davHeaders(extraHeaders),
                body
            });
        },

        async webdavPutBlob(remotePath, blob, contentType = 'application/octet-stream') {
            await this.ensureWebdavDirs(remotePath);
            const res = await fetch(this.davUrl(remotePath), {
                method: 'PUT',
                headers: this.davHeaders({ 'Content-Type': contentType }),
                body: blob
            });
            if (!res.ok) throw new Error(`WebDAV PUT ${res.status}`);
            return res.headers.get('ETag') || '';
        }
    };
})();
