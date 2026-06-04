// @ts-nocheck
const appUpdate = {
    registration: null,
    waitingWorker: null,
    checking: false,
    swUrl: 'sw.js',
    version: '212',

    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        try {
            this.registration = await navigator.serviceWorker.register(this.swUrl, { updateViaCache: 'none' });
            this.bindRegistration(this.registration);
            await this.registration.update?.();
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload();
            }, { once: true });
        } catch {}
    },

    bindRegistration(registration) {
        if (!registration) return;
        if (registration.waiting) this.show(registration.waiting);
        if (registration.installing) this.bindWorker(registration.installing);
        if (registration._appUpdateBound) return;
        registration._appUpdateBound = true;
        registration.addEventListener('updatefound', () => {
            const worker = registration.installing;
            if (!worker) return;
            this.bindWorker(worker);
        });
    },

    bindWorker(worker) {
        if (!worker || worker._appUpdateBound) return;
        worker._appUpdateBound = true;
        worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                this.show(worker);
            }
        });
    },

    show(worker) {
        this.waitingWorker = worker;
        document.getElementById('appUpdateBanner')?.classList.remove('hidden');
    },

    apply() {
        const worker = this.waitingWorker || this.registration?.waiting;
        if (worker) {
            try { worker.postMessage({ type: 'SKIP_WAITING' }); } catch {}
            // controllerchange handler will reload once the new SW activates.
            return;
        }
        window.location.reload();
    },

    dismiss() {
        document.getElementById('appUpdateBanner')?.classList.add('hidden');
    },

    async checkNow() {
        if (!('serviceWorker' in navigator)) {
            this.notify('当前浏览器不支持离线更新', 'error');
            return { ok: false, reason: 'unsupported' };
        }
        if (this.checking) return { ok: false, reason: 'checking' };

        this.checking = true;
        this.updateProfileButton(true);
        this.notify('正在检测更新...');

        try {
            this.registration = this.registration || await navigator.serviceWorker.getRegistration() || await navigator.serviceWorker.register(this.swUrl, { updateViaCache: 'none' });
            this.bindRegistration(this.registration);
            await this.registration.update?.();

            const worker = this.registration.waiting || this.waitingWorker || await this.waitForInstalling(this.registration.installing);
            if (worker) {
                this.show(worker);
                this.notify('发现新版本，点击“立即更新”完成刷新', 'success');
                return { ok: true, updateFound: true };
            }

            this.notify('已是最新版本', 'success');
            return { ok: true, updateFound: false };
        } catch (e) {
            this.notify('检测更新失败：' + (e?.message || '请稍后重试'), 'error');
            return { ok: false, reason: 'failed', error: e };
        } finally {
            this.checking = false;
            this.updateProfileButton(false);
        }
    },

    waitForInstalling(worker) {
        if (!worker) return Promise.resolve(null);
        if (worker.state === 'installed' && navigator.serviceWorker.controller) return Promise.resolve(worker);
        return new Promise(resolve => {
            const timer = setTimeout(() => resolve(null), 8000);
            worker.addEventListener('statechange', () => {
                if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                    clearTimeout(timer);
                    resolve(worker);
                }
            });
        });
    },

    updateProfileButton(checking) {
        const btn = document.getElementById('profileUpdateCheckBtn');
        if (!btn) return;
        btn.disabled = !!checking;
        const label = btn.querySelector('.pvf-check-label');
        if (label) label.textContent = checking ? '检测中...' : '检测更新';
    },

    notify(message, type = 'info') {
        if (typeof toast?.show === 'function') toast.show(message, type);
    }
};

if (typeof window !== 'undefined') window.appUpdate = appUpdate;
