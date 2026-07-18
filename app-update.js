// @ts-nocheck
const appUpdate = {
    registration: null,
    waitingWorker: null,
    checking: false,
    controllerReloadBound: false,
    swUrl: './sw.js',
    version: '332',

    controllerReloadKey() {
        return 'rehab-sw-controller-reload-v332';
    },

    claimControllerReload() {
        const key = this.controllerReloadKey();
        if (typeof window.claimServiceWorkerReload === 'function') {
            return window.claimServiceWorkerReload(key);
        }
        try {
            if (window.sessionStorage.getItem(key) === '1') return false;
            window.sessionStorage.setItem(key, '1');
            return true;
        } catch {
            return false;
        }
    },

    bindControllerReload(hadController) {
        if (!hadController || this.controllerReloadBound) return;
        this.controllerReloadBound = true;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!this.claimControllerReload()) {
                this.showRefreshRequired('更新已完成，请刷新页面');
                return;
            }
            window.errorBus?.event?.('appUpdate', 'controllerchange', { version: this.version });
            window.location.reload();
        }, { once: true });
    },

    showRefreshRequired(message = '更新已完成，请刷新页面') {
        const banner = document.getElementById('appUpdateBanner');
        if (!banner) {
            this.notify(message, 'info');
            return;
        }
        banner.classList.remove('hidden');
        const title = banner.querySelector('strong');
        const detail = banner.querySelector('small');
        const buttons = banner.querySelectorAll('button');
        if (title) title.textContent = message;
        if (detail) detail.textContent = '新版已接管；若页面未自动切换，请手动刷新一次。';
        if (buttons[0]) {
            buttons[0].textContent = '稍后';
            buttons[0].onclick = () => this.dismiss();
        }
        if (buttons[1]) {
            buttons[1].textContent = '刷新';
            buttons[1].onclick = () => window.location.reload();
        }
    },

    async ensureRegistration() {
        if (!('serviceWorker' in navigator)) return null;
        this.registration = this.registration
            || await navigator.serviceWorker.getRegistration()
            || await navigator.serviceWorker.register(this.swUrl, { updateViaCache: 'none' });
        this.bindRegistration(this.registration);
        return this.registration;
    },

    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        const started = Date.now();
        window.errorBus?.event?.('appUpdate', 'register:start', { swUrl: this.swUrl, version: this.version });
        try {
            const registration = await this.ensureRegistration();
            await registration?.update?.();
            window.errorBus?.event?.('appUpdate', 'register:success', {
                elapsedMs: Date.now() - started,
                hasWaiting: !!registration?.waiting
            });
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
            window.errorBus?.event?.('appUpdate', 'worker:state', {
                state: worker.state,
                hasController: !!navigator.serviceWorker.controller
            });
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                this.show(worker);
            }
        });
    },

    show(worker) {
        this.waitingWorker = worker || this.waitingWorker;
        window.errorBus?.event?.('appUpdate', 'waiting:show', { state: worker?.state || '' });
        const banner = document.getElementById('appUpdateBanner');
        if (!banner) return;
        banner.classList.remove('hidden');
        const title = banner.querySelector('strong');
        const detail = banner.querySelector('small');
        const buttons = banner.querySelectorAll('button');
        if (title) title.textContent = '发现新版本';
        if (detail) detail.textContent = '已下载最新资源，点击更新后将刷新页面并启用新版本。';
        if (buttons[0]) {
            buttons[0].textContent = '稍后';
            buttons[0].onclick = () => this.dismiss();
        }
        if (buttons[1]) {
            buttons[1].textContent = '立即更新';
            buttons[1].onclick = () => { void this.apply(); };
        }
    },

    async prepareWaitingWorker(worker) {
        if (!worker || typeof worker.postMessage !== 'function') return false;
        const requestId = `rehab-prepare-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        return await new Promise((resolve) => {
            let settled = false;
            const finish = (ok) => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timer);
                navigator.serviceWorker.removeEventListener('message', onMessage);
                resolve(ok);
            };
            const onMessage = (event) => {
                const data = event && event.data;
                if (!data || data.requestId !== requestId) return;
                if (data.type === 'RELEASE_READY') {
                    finish(String(data.version || '') === this.version);
                    return;
                }
                if (data.type === 'RELEASE_FAILED') finish(false);
            };
            const timer = window.setTimeout(() => finish(false), 20000);
            navigator.serviceWorker.addEventListener('message', onMessage);
            try {
                worker.postMessage({ type: 'PREPARE_RELEASE', requestId });
            } catch {
                finish(false);
            }
        });
    },

    async apply() {
        const worker = this.waitingWorker || this.registration?.waiting;
        if (!worker) {
            window.errorBus?.event?.('appUpdate', 'apply:reloadFallback');
            window.location.reload();
            return;
        }

        this.bindControllerReload(!!navigator.serviceWorker.controller);
        try {
            window.errorBus?.event?.('appUpdate', 'apply:prepare', { state: worker.state || '' });
            await this.prepareWaitingWorker(worker);
            window.errorBus?.event?.('appUpdate', 'apply:skipWaiting', { state: worker.state || '' });
            worker.postMessage({ type: 'SKIP_WAITING' });
            window.setTimeout(() => {
                if (document.getElementById('appUpdateBanner')
                    && !document.getElementById('appUpdateBanner').classList.contains('hidden')) {
                    this.showRefreshRequired('更新可能已完成，请刷新页面');
                }
            }, 15000);
        } catch (e) {
            window.errorBus?.event?.('appUpdate', 'apply:failed', { error: e });
            this.notify('更新失败：' + (e?.message || '请稍后重试'), 'error');
        }
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
            const registration = await this.ensureRegistration();
            await registration?.update?.();

            const worker = registration?.waiting
                || this.waitingWorker
                || await this.waitForInstalling(registration?.installing);
            if (worker) {
                this.show(worker);
                this.notify('发现新版本，点击“立即更新”完成刷新', 'success');
                window.errorBus?.event?.('appUpdate', 'check:updateFound', {
                    elapsedMs: Date.now() - started,
                    workerState: worker.state || ''
                });
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
        return new Promise((resolve) => {
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
