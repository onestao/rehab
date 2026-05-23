// @ts-nocheck
(function () {
    window.syncUi = {
        readConfigForm(current = {}) {
            return {
                mode: document.getElementById('syncMode')?.value || current.mode || 'none',
                s3: {
                    endpoint: document.getElementById('s3Endpoint')?.value || '',
                    region: document.getElementById('s3Region')?.value || 'us-east-1',
                    bucket: document.getElementById('s3Bucket')?.value || '',
                    key: document.getElementById('s3Key')?.value || '',
                    secret: document.getElementById('s3Secret')?.value || ''
                },
                dav: {
                    url: document.getElementById('davUrl')?.value || '',
                    user: document.getElementById('davUser')?.value || '',
                    pass: document.getElementById('davPass')?.value || '',
                    path: document.getElementById('davPath')?.value || 'training_assistant_data.json'
                }
            };
        },

        writeConfigForm(cfg = {}) {
            const s3 = cfg.s3 || {};
            const dav = cfg.dav || {};
            const set = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.value = value;
            };
            set('s3Endpoint', s3.endpoint || '');
            set('s3Region', s3.region || 'us-east-1');
            set('s3Bucket', s3.bucket || '');
            set('s3Key', s3.key || '');
            set('s3Secret', s3.secret || '');
            set('davUrl', dav.url || '');
            set('davUser', dav.user || '');
            set('davPass', dav.pass || '');
            set('davPath', dav.path || 'training_assistant_data.json');
            set('syncMode', cfg.mode || 'none');
        },

        setStatus(state, detail = '') {
            const el = document.getElementById('syncStatus');
            if (!el) return;
            const map = {
                local: ['cloud_off', '本地'],
                syncing: ['sync', '同步中'],
                cloud: ['cloud_done', '云端'],
                error: ['cloud_alert', '同步失败']
            };
            const [icon, label] = map[state] || map.local;
            el.innerHTML = `<span class="material-symbols-rounded" style="font-size:14px">${window.renderSafe?.escapeHtml(icon) || icon}</span> ${window.renderSafe?.escapeHtml(label) || label}`;
            el.dataset.state = state;
            el.dataset.detail = detail;
        },

        toggleFields(mode) {
            document.getElementById('s3Fields')?.classList.toggle('hidden', mode !== 's3');
            document.getElementById('webdavFields')?.classList.toggle('hidden', mode !== 'webdav');
        }
    };
})();
