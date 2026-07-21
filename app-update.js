// @ts-nocheck
const appUpdate = {
    registration: null,
    waitingWorker: null,
    checking: false,
    controllerReloadBound: false,
    swUrl: './sw.js?v=356',
    version: '356',

    controllerReloadKey() {
        return 'rehab-sw-controller-reload-v356';
    },

    claimControllerReload() {
        const key = this.controllerReloadKey();
        if (typeof window.claimServiceWorkerReload === 'function') {
            return window.claimServiceWorkerReload(key);
        }
        // Fallback must stay per-document. Shared sessionStorage would block
        // sibling tabs from reloading after the first tab claims.
        const claimed = this._controllerReloadClaimed;
        if (claimed && claimed[key]) return false;
        this._controllerReloadClaimed = Object.assign({}, claimed || null, { [key]: true });
        return true;
    },

    documentNeedsControllerReload() {
        try {
            const controller = navigator.serviceWorker?.controller;
            if (!controller?.scriptURL) return true;
            const controllerVersion = new URL(controller.scriptURL, window.location.href)
                .searchParams.get('v');
            if (controllerVersion && controllerVersion !== this.version) return true;
            const scripts = document.scripts ? [...document.scripts] : [];
            const versioned = scripts
                .map((script) => script.src)
                .filter(Boolean)
                .some((src) => {
                    try {
                        return new URL(src, window.location.href).searchParams.get('v') === this.version;
                    } catch {
                        return false;
                    }
                });
            // Already executing this release's scripts: do not force another reload.
            return !versioned;
        } catch {
            return true;
        }
    },

    bindControllerReload(hadController) {
        if (!hadController || this.controllerReloadBound) return;
        this.controllerReloadBound = true;
        const reloadIfNeeded = (reason) => {
            if (!this.documentNeedsControllerReload()) {
                window.errorBus?.event?.('appUpdate', 'controllerchange:skip', {
                    version: this.version,
                    reason: 'document-already-current'
                });
                // Still acknowledge readiness so the worker can drop this client's
                // migration marker. Legacy cache retirement stays SW-owned so a sibling
                // tab that is still migrating keeps its offline cache.
                try {
                    navigator.serviceWorker?.controller?.postMessage?.({
                        type: 'V327_PAGE_READY',
                        version: this.version
                    });
                } catch {}
                this.hideUpgradeOverlay();
                return;
            }
            if (this.hasActiveRehabSession()) {
                this.deferredForSession = true;
                this.notifyServiceWorkerSessionDefer();
                this.showUpdateDeferredForSession();
                window.errorBus?.event?.('appUpdate', 'controllerchange:deferred-for-session', {
                    version: this.version,
                    reason
                });
                return;
            }
            if (!this.claimControllerReload()) {
                // Another reload already claimed for this document only.
                this.showRefreshRequired('更新已完成，请刷新页面');
                return;
            }
            this.showUpgradeOverlay('正在完成更新…');
            window.errorBus?.event?.('appUpdate', reason, { version: this.version });
            window.location.reload();
        };
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            reloadIfNeeded('controllerchange');
        }, { once: true });
        // Sibling tabs that miss controllerchange (or lose the SW navigate race) still
        // receive an explicit refresh request from the active worker.
        navigator.serviceWorker.addEventListener('message', (event) => {
            const data = event && event.data;
            if (!data || data.type !== 'UPDATE_REFRESH_REQUIRED') return;
            if (String(data.version || '') !== this.version) return;
            reloadIfNeeded('update-refresh-required');
        });
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

    hasActiveRehabSession() {
        try {
            const w = window.workoutSystem || window.workout;
            // Playing, paused, or started-not-finished all block forced updates.
            if (w?.isPlaying) return true;
            if (w?.isPaused) return true;
            if (Number.isFinite(w?._phaseLeft) && Number(w._phaseLeft) > 0) return true;
            if (w?.timer || w?.sessionInt) return true;
            if (Number(w?.totalSec || 0) > 0 && w?.isPlaying !== false && w?.mode) {
                // totalSec advances only during an active/paused session window.
                if (w.isPlaying || w.isPaused) return true;
            }
            const cardio = window.cardio;
            if (cardio?.isRunning) return true;
            if (cardio?.isPaused && Number(cardio?.seconds || 0) > 0) return true;
            const engine = window.workoutEngine;
            if (engine?.state && (w?.isPlaying || w?.isPaused)) return true;
            if (Number.isFinite(engine?.state?.phaseLeft) && Number(engine.state.phaseLeft) > 0) return true;
            // Persisted mid-session snapshot (visibility/background restore).
            try {
                if (localStorage.getItem(window.workoutState?.KEY || 'rehab_active_session')) return true;
            } catch {}
            const data = window.data;
            if (data?._pendingLocalWrite) return true;
            // Unsaved action / pain-adjacent drafts and open edit sheets.
            if (data?.db?.lastActionDraft) return true;
            if (data?._editingExerciseDraft || data?._editingFoodDraft) return true;
            if (data?._aiFoodDrafts?.length) return true;
            // Visible pain/symptom inputs with non-empty values.
            const draftInputs = document.querySelectorAll?.(
                '#painScore, #painLevel, [name="painScore"], [name="painLevel"], #symptomNote, [name="symptomNote"], #symptomDraft, textarea[data-rehab-draft="1"], input[data-rehab-draft="1"]'
            );
            if (draftInputs && draftInputs.length) {
                for (const el of draftInputs) {
                    const val = String(el.value ?? el.textContent ?? '').trim();
                    if (val && val !== '0') return true;
                }
            }
            // Open modal with dirty text inputs (symptom/pain forms often live here).
            const openModal = document.querySelector?.('.md-modal[data-rl-modal="1"], .md-modal:not(.hidden)[role="dialog"]');
            if (openModal) {
                const dirty = openModal.querySelectorAll('input, textarea, select');
                for (const el of dirty) {
                    if (el.matches?.('[data-modal-close], button, [type="button"], [type="submit"]')) continue;
                    const val = String(el.value ?? '').trim();
                    if (val && el.defaultValue !== undefined && val !== String(el.defaultValue || '').trim()) return true;
                    if (val && el.type === 'range' && Number(val) > 0) return true;
                    if (val && (el.name || el.id || '').toLowerCase().match(/pain|symptom|note|fatigue|rpe/)) return true;
                }
            }
            return false;
        } catch {
            return false;
        }
    },

    notifyServiceWorkerSessionDefer() {
        try {
            navigator.serviceWorker?.controller?.postMessage?.({
                type: 'UPDATE_DEFER_FOR_SESSION',
                version: this.version,
                reason: 'active-rehab-session'
            });
        } catch {}
    },

    showUpdateDeferredForSession() {
        // H5: freeze session journal before any later upgrade can navigate the client.
        try { window.workoutState?.saveJournal?.({ deferredForUpdate: true }); } catch {}
        this.notify('训练进行中，更新已推迟。结束后可在设置中完成更新。', 'info');
        const banner = document.getElementById('appUpdateBanner');
        if (!banner) return;
        banner.classList.remove('hidden');
        const title = banner.querySelector('strong');
        const detail = banner.querySelector('small');
        if (title) title.textContent = '更新已就绪（训练中推迟）';
        if (detail) detail.textContent = '当前训练不会被打断。训练结束后再点“立即更新”。';
        this.armSessionClearWatcher();
    },

    armSessionClearWatcher() {
        if (this._sessionClearWatch) return;
        this._sessionClearWatch = window.setInterval(() => {
            if (this.hasActiveRehabSession()) return;
            window.clearInterval(this._sessionClearWatch);
            this._sessionClearWatch = null;
            this.deferredForSession = false;
            try {
                navigator.serviceWorker?.controller?.postMessage?.({
                    type: 'UPDATE_SESSION_CLEAR',
                    version: this.version
                });
            } catch {}
            // If a waiting worker is still present, re-show normal update banner.
            const worker = this.waitingWorker || this.registration?.waiting;
            if (worker) this.show(worker);
        }, 2000);
    },

    async apply() {
        const worker = this.waitingWorker || this.registration?.waiting;
        if (!worker) {
            if (this.hasActiveRehabSession()) {
                this.deferredForSession = true;
                this.notifyServiceWorkerSessionDefer();
                this.showUpdateDeferredForSession();
                window.errorBus?.event?.('appUpdate', 'apply:deferred-no-worker');
                return { ok: false, reason: 'active-session' };
            }
            window.errorBus?.event?.('appUpdate', 'apply:reloadFallback');
            window.location.reload();
            return;
        }

        if (this.hasActiveRehabSession()) {
            this.deferredForSession = true;
            this.waitingWorker = worker;
            this.notifyServiceWorkerSessionDefer();
            this.showUpdateDeferredForSession();
            window.errorBus?.event?.('appUpdate', 'apply:deferred-for-session');
            return { ok: false, reason: 'active-session' };
        }

        this.bindControllerReload(!!navigator.serviceWorker.controller);
        try {
            // H5: final pre-apply journal flush if a residual session snapshot exists.
            try {
                if (window.workoutState?.readJournal?.()?.isPlaying) {
                    window.workoutState.saveJournal({ preApply: true });
                }
            } catch {}
            window.errorBus?.event?.('appUpdate', 'apply:prepare', { state: worker.state || '' });
            await this.prepareWaitingWorker(worker);
            if (this.hasActiveRehabSession()) {
                this.deferredForSession = true;
                this.notifyServiceWorkerSessionDefer();
                this.showUpdateDeferredForSession();
                window.errorBus?.event?.('appUpdate', 'apply:deferred-after-prepare');
                return { ok: false, reason: 'active-session' };
            }
            this.showUpgradeOverlay('正在完成更新…');
            window.errorBus?.event?.('appUpdate', 'apply:skipWaiting', { state: worker.state || '' });
            worker.postMessage({ type: 'SKIP_WAITING' });
            window.setTimeout(() => {
                if (document.getElementById('appUpdateBanner')
                    && !document.getElementById('appUpdateBanner').classList.contains('hidden')) {
                    this.showRefreshRequired('更新可能已完成，请刷新页面');
                }
            }, 15000);
            return { ok: true };
        } catch (e) {
            this.hideUpgradeOverlay();
            window.errorBus?.event?.('appUpdate', 'apply:failed', { error: e });
            this.notify('更新失败：' + (e?.message || '请稍后重试'), 'error');
            return { ok: false, reason: 'failed', error: e };
        }
    },

    showUpgradeOverlay(message = '正在完成更新…') {
        let el = document.getElementById('rehabUpgradeOverlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'rehabUpgradeOverlay';
            el.setAttribute('role', 'alertdialog');
            el.setAttribute('aria-live', 'assertive');
            el.setAttribute('aria-modal', 'true');
            el.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.72);color:#fff;font:600 16px/1.4 system-ui,sans-serif;pointer-events:all;';
            const panel = document.createElement('div');
            panel.style.cssText = 'padding:20px 24px;border-radius:16px;background:#0f172a;max-width:280px;text-align:center';
            panel.textContent = message;
            el.appendChild(panel);
            document.body.appendChild(el);
            // Block keyboard until ready.
            el._keyHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();
            };
            document.addEventListener('keydown', el._keyHandler, true);
        } else {
            const panel = el.querySelector('div');
            if (panel) panel.textContent = message;
            el.style.display = 'flex';
        }
    },

    hideUpgradeOverlay() {
        const el = document.getElementById('rehabUpgradeOverlay');
        if (!el) return;
        if (el._keyHandler) document.removeEventListener('keydown', el._keyHandler, true);
        el.remove();
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
