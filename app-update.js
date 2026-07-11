// @ts-nocheck
const appUpdate = {
    registration: null,
    waitingWorker: null,
    checking: false,
    swUrl: 'sw.js',
    version: '315',

    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        const started = Date.now();
        window.errorBus?.event?.('appUpdate', 'register:start', { swUrl: this.swUrl, version: this.version });
        try {
            this.registration = await navigator.serviceWorker.register(this.swUrl, { updateViaCache: 'none' });
            this.bindRegistration(this.registration);
            await this.registration.update?.();
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.errorBus?.event?.('appUpdate', 'controllerchange');
                window.location.reload();
            }, { once: true });
            window.errorBus?.event?.('appUpdate', 'register:success', { elapsedMs: Date.now() - started, hasWaiting: !!this.registration?.waiting });
        } catch (e) {
            window.errorBus?.event?.('appUpdate', 'register:failed', { elapsedMs: Date.now() - started, error: e });
        }
    },

    bindRegistration(registration) {
        if (!registration) return;
        if (registration.waiting) this.show(registration.waiting);
        if (registration.installing) this.bindWorker(registration.installing);
        if (registration._appUpdateBound) return;
        registration._appUpdateBound = true;
        registration.addEventListener('updatefound', () => {
            window.errorBus?.event?.('appUpdate', 'updatefound');
            const worker = registration.installing;
            if (!worker) return;
            this.bindWorker(worker);
        });
    },

    bindWorker(worker) {
        if (!worker || worker._appUpdateBound) return;
        worker._appUpdateBound = true;
        worker.addEventListener('statechange', () => {
            window.errorBus?.event?.('appUpdate', 'worker:state', { state: worker.state, hasController: !!navigator.serviceWorker.controller });
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                this.show(worker);
            }
        });
    },

    show(worker) {
        this.waitingWorker = worker;
        window.errorBus?.event?.('appUpdate', 'waiting:show', { state: worker?.state || '' });
        document.getElementById('appUpdateBanner')?.classList.remove('hidden');
    },

    apply() {
        const worker = this.waitingWorker || this.registration?.waiting;
        if (worker) {
            try {
                window.errorBus?.event?.('appUpdate', 'apply:skipWaiting', { state: worker.state || '' });
                worker.postMessage({ type: 'SKIP_WAITING' });
            } catch (e) {
                window.errorBus?.event?.('appUpdate', 'apply:failed', { error: e });
            }
            // controllerchange handler will reload once the new SW activates.
            return;
        }
        window.errorBus?.event?.('appUpdate', 'apply:reloadFallback');
        window.location.reload();
    },

    dismiss() {
        document.getElementById('appUpdateBanner')?.classList.add('hidden');
    },

    async checkNow() {
        if (!('serviceWorker' in navigator)) {
            window.errorBus?.event?.('appUpdate', 'check:unsupported');
            this.notify('当前浏览器不支持离线更新', 'error');
            return { ok: false, reason: 'unsupported' };
        }
        if (this.checking) return { ok: false, reason: 'checking' };

        const started = Date.now();
        window.errorBus?.event?.('appUpdate', 'check:start', { version: this.version });
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
                window.errorBus?.event?.('appUpdate', 'check:updateFound', { elapsedMs: Date.now() - started, workerState: worker.state || '' });
                return { ok: true, updateFound: true };
            }

            this.notify('已是最新版本', 'success');
            window.errorBus?.event?.('appUpdate', 'check:current', { elapsedMs: Date.now() - started });
            return { ok: true, updateFound: false };
        } catch (e) {
            window.errorBus?.event?.('appUpdate', 'check:failed', { elapsedMs: Date.now() - started, error: e });
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
