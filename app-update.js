// @ts-nocheck
const appUpdate = {
    registration: null,
    waitingWorker: null,
    checking: false,
    controllerReloadBound: false,
    swUrl: './sw.js?v=391',
    version: '391',

    controllerReloadKey() {
        return 'rehab-sw-controller-reload-v391';
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

    isPendingUpdateWorker(worker) {
        return !!(worker && worker.state === 'installed');
    },

    resolvePendingUpdateWorker(registration, preferredWorker) {
        const candidates = [
            preferredWorker,
            registration?.waiting,
            this.waitingWorker,
            registration?.installing
        ];
        for (const worker of candidates) {
            if (this.isPendingUpdateWorker(worker)) return worker;
        }
        // Drop stale remembered refs that are no longer waiting to activate.
        if (this.waitingWorker && !this.isPendingUpdateWorker(this.waitingWorker)) {
            this.waitingWorker = null;
        }
        return null;
    },

    clearCompletedUpdateState() {
        this.waitingWorker = null;
        this.deferredForSession = false;
        if (this._updateBlockClearWatch != null) {
            try { window.clearInterval(this._updateBlockClearWatch); } catch {}
            this._updateBlockClearWatch = null;
        }
        if (this._sessionClearWatch != null) {
            try { window.clearInterval(this._sessionClearWatch); } catch {}
            this._sessionClearWatch = null;
        }
        this.dismiss();
        this.hideUpgradeOverlay();
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
                this.clearCompletedUpdateState();
                return;
            }
            const blockReason = this.getUpdateBlockReason();
            if (blockReason) {
                this.showUpdateBlocked(blockReason);
                window.errorBus?.event?.('appUpdate', 'controllerchange:deferred-for-session', {
                    version: this.version,
                    reason,
                    blockReason
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
        const candidate = worker || this.waitingWorker;
        if (!this.isPendingUpdateWorker(candidate)) {
            if (this.waitingWorker && !this.isPendingUpdateWorker(this.waitingWorker)) {
                this.waitingWorker = null;
            }
            return false;
        }
        this.waitingWorker = candidate;
        window.errorBus?.event?.('appUpdate', 'waiting:show', { state: candidate.state || '' });
        const blockReason = this.getUpdateBlockReason();
        if (blockReason) {
            this.showUpdateBlocked(blockReason, candidate);
            return true;
        }
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
        return true;
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

    hasDirtyRehabForm() {
        try {
            const draftInputs = document.querySelectorAll?.(
                '#painScore, #painLevel, [name="painScore"], [name="painLevel"], #symptomNote, [name="symptomNote"], #symptomDraft, textarea[data-rehab-draft="1"], input[data-rehab-draft="1"]'
            );
            if (draftInputs && draftInputs.length) {
                for (const el of draftInputs) {
                    const val = String(el.value ?? el.textContent ?? '').trim();
                    if (val && val !== '0') return true;
                }
            }
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

    /**
     * Classify update blockers without conflating residual timers / parameter memory.
     * @returns {'active-session'|'pending-write'|'unsaved-draft'|null}
     */
    getUpdateBlockReason() {
        try {
            const workout = window.workoutSystem || window.workout;
            const cardio = window.cardio;
            const journal = this.readRecoverableSessionJournal();
            // Production pause keeps isPlaying === true; do not treat lone isPaused / timers as session.
            if (workout?.isPlaying === true || cardio?.isRunning === true || journal) {
                return 'active-session';
            }

            const data = window.data;
            if (data?._dbDirty || data?._pendingPersistPromise || data?._pendingLocalWrite) {
                return 'pending-write';
            }
            if (
                data?._editingExerciseDraft
                || data?._editingFoodDraft
                || data?._aiFoodDrafts?.length
                || this.hasDirtyRehabForm?.()
            ) {
                return 'unsaved-draft';
            }
            return null;
        } catch {
            return null;
        }
    },

    isRecoverableSessionJournal(snapshot, now = Date.now()) {
        if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false;
        if (snapshot.schemaVersion !== 1 || snapshot.journal !== 'rehab-session') return false;
        if (snapshot.isPlaying !== true) return false;
        if (snapshot.mode !== 'strength' && snapshot.mode !== 'cardio') return false;
        if (!Number.isFinite(snapshot.totalSec) || snapshot.totalSec < 0) return false;
        const updatedAt = new Date(snapshot.updatedAt).getTime();
        const ageMs = now - updatedAt;
        if (!Number.isFinite(updatedAt) || ageMs < 0 || ageMs > 12 * 60 * 60 * 1000) return false;
        if (snapshot.mode === 'cardio') {
            return !!snapshot.cardio
                && typeof snapshot.cardio === 'object'
                && !Array.isArray(snapshot.cardio)
                && snapshot.cardio.isRunning === true
                && Number.isFinite(snapshot.cardio.seconds)
                && snapshot.cardio.seconds >= 0;
        }
        return !!snapshot.strength
            && typeof snapshot.strength === 'object'
            && !Array.isArray(snapshot.strength)
            && typeof snapshot.strength.phase === 'string'
            && snapshot.strength.phase.trim().length > 0;
    },

    readRecoverableSessionJournal() {
        const key = 'rehab_active_session';
        let raw = null;
        try {
            raw = window.localStorage?.getItem?.(key);
            if (raw == null) return null;
            const snapshot = JSON.parse(raw);
            if (this.isRecoverableSessionJournal(snapshot)) return snapshot;
        } catch {}
        try { window.localStorage?.removeItem?.(key); } catch {}
        return null;
    },

    hasActiveRehabSession() {
        return this.getUpdateBlockReason() === 'active-session';
    },

    updateClientMessageTargets(worker) {
        const targets = [
            navigator.serviceWorker?.controller,
            worker,
            this.waitingWorker,
            this.registration?.waiting
        ];
        return targets.filter((target, index) => (
            target
            && typeof target.postMessage === 'function'
            && targets.indexOf(target) === index
        ));
    },

    postUpdateClientMessage(type, reason, worker) {
        const message = reason == null
            ? { type, version: this.version }
            : { type, version: this.version, reason };
        for (const target of this.updateClientMessageTargets(worker)) {
            try { target.postMessage(message); } catch {}
        }
    },

    notifyServiceWorkerClientDefer(reason, worker) {
        this.postUpdateClientMessage('UPDATE_DEFER_FOR_CLIENT', reason, worker);
    },

    clearServiceWorkerClientDefer(worker) {
        this.postUpdateClientMessage('UPDATE_CLIENT_CLEAR', null, worker);
    },

    // Compatibility wrapper retained for callers that still use the session-specific name.
    notifyServiceWorkerSessionDefer(worker) {
        this.notifyServiceWorkerClientDefer('active-session', worker);
    },

    showUpdateDeferredForSession(worker) {
        this.deferredForSession = true;
        this.notifyServiceWorkerSessionDefer(worker);
        this.armSessionClearWatcher();
        // H5: freeze session journal only when a real playing session is active.
        try {
            const workout = window.workoutSystem || window.workout;
            if (workout?.isPlaying === true) {
                window.workoutState?.saveJournal?.({ deferredForUpdate: true });
            }
        } catch {}
        this.notify('训练进行中，更新已推迟。结束后可在设置中完成更新。', 'info');
        const banner = document.getElementById('appUpdateBanner');
        if (!banner) return;
        banner.classList.remove('hidden');
        const title = banner.querySelector('strong');
        const detail = banner.querySelector('small');
        if (title) title.textContent = '更新已就绪（训练中推迟）';
        if (detail) detail.textContent = '当前训练不会被打断。训练结束后再点“立即更新”。';
    },

    armUpdateBlockClearWatcher() {
        if (this._updateBlockClearWatch != null || this._sessionClearWatch != null) return;
        const watch = window.setInterval(() => {
            if (this.getUpdateBlockReason()) return;
            window.clearInterval(this._updateBlockClearWatch);
            this._updateBlockClearWatch = null;
            this._sessionClearWatch = null;
            this.deferredForSession = false;
            this.clearServiceWorkerClientDefer();
            // If a waiting worker is still present, re-show normal update banner.
            const worker = this.resolvePendingUpdateWorker(this.registration, this.waitingWorker);
            if (worker) this.show(worker);
        }, 2000);
        this._updateBlockClearWatch = watch;
        this._sessionClearWatch = watch;
    },

    // Compatibility wrapper retained for existing public/session API users.
    armSessionClearWatcher() {
        return this.armUpdateBlockClearWatcher();
    },

    showUpdateBlocked(reason, worker) {
        if (reason === 'active-session') {
            this.showUpdateDeferredForSession(worker);
            return;
        }
        this.notifyServiceWorkerClientDefer(reason, worker);
        this.armUpdateBlockClearWatcher();
        const copy = reason === 'pending-write'
            ? ['数据正在保存，请稍后重试更新。', '更新已就绪（保存中）', '本地数据正在写入，请稍后再点“立即更新”。']
            : reason === 'unsaved-draft'
                ? ['有未保存编辑，请先保存或关闭后再更新。', '更新已就绪（未保存编辑）', '请先保存或关闭当前编辑，再点“立即更新”。']
                : null;
        if (!copy) return;
        this.notify(copy[0], 'info');
        const banner = document.getElementById('appUpdateBanner');
        if (!banner) return;
        banner.classList.remove('hidden');
        const title = banner.querySelector('strong');
        const detail = banner.querySelector('small');
        if (title) title.textContent = copy[1];
        if (detail) detail.textContent = copy[2];
    },

    async apply() {
        const worker = this.resolvePendingUpdateWorker(this.registration, this.waitingWorker);
        if (!worker) {
            const blockNoWorker = this.getUpdateBlockReason();
            if (blockNoWorker) {
                this.showUpdateBlocked(blockNoWorker);
                window.errorBus?.event?.('appUpdate', 'apply:deferred-no-worker', { blockReason: blockNoWorker });
                return { ok: false, reason: blockNoWorker };
            }
            window.errorBus?.event?.('appUpdate', 'apply:reloadFallback');
            window.location.reload();
            return;
        }

        const blockReason = this.getUpdateBlockReason();
        if (blockReason) {
            this.waitingWorker = worker;
            this.showUpdateBlocked(blockReason);
            window.errorBus?.event?.('appUpdate', 'apply:deferred-for-session', { blockReason });
            return { ok: false, reason: blockReason };
        }

        this.bindControllerReload(!!navigator.serviceWorker.controller);
        try {
            // H5: final pre-apply journal flush if a residual session snapshot exists.
            try {
                const journal = window.workoutState?.readJournal?.();
                if (window.workoutState?.isRecoverableJournal?.(journal) && (window.workoutSystem || window.workout)?.isPlaying === true) {
                    window.workoutState.saveJournal({ preApply: true });
                }
            } catch {}
            window.errorBus?.event?.('appUpdate', 'apply:prepare', { state: worker.state || '' });
            await this.prepareWaitingWorker(worker);
            const blockAfterPrepare = this.getUpdateBlockReason();
            if (blockAfterPrepare) {
                this.showUpdateBlocked(blockAfterPrepare);
                window.errorBus?.event?.('appUpdate', 'apply:deferred-after-prepare', { blockReason: blockAfterPrepare });
                return { ok: false, reason: blockAfterPrepare };
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

            let worker = this.resolvePendingUpdateWorker(registration);
            if (!worker && registration?.installing) {
                worker = await this.waitForInstalling(registration.installing);
                if (!this.isPendingUpdateWorker(worker)) worker = null;
            }
            if (worker && this.show(worker)) {
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
