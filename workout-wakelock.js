// @ts-nocheck
(function () {
    const errorBus = window.errorBus;
    const state = {
        sentinel: /** @type {any} */ (null),
        warned: false,
        training: false
    };

    function logOnce(msg) {
        if (state.warned) return;
        state.warned = true;
        try { console.info(msg); } catch {}
    }

    function renderStatus() {
        const btn = document.getElementById('wakeLockStatusButton');
        if (!btn) return;
        const active = isActive();
        btn.classList.toggle('hidden', !state.training && !active);
        btn.classList.toggle('is-active', active);
        const icon = btn.querySelector('.material-symbols-rounded');
        if (icon) icon.textContent = active ? 'lock' : 'lock_open';
        btn.title = active ? '屏幕常亮中' : '屏幕常亮已释放，点击重新申请';
    }

    async function request() {
        state.training = true;
        try {
            if (!navigator.wakeLock || typeof navigator.wakeLock.request !== 'function') {
                logOnce('[wakelock] Wake Lock API unavailable');
                renderStatus();
                return false;
            }
            if (state.sentinel) {
                renderStatus();
                return true;
            }
            const sentinel = await navigator.wakeLock.request('screen');
            state.sentinel = sentinel;
            if (sentinel?.addEventListener) {
                sentinel.addEventListener('release', () => { state.sentinel = null; renderStatus(); });
            } else if ('onrelease' in sentinel) {
                sentinel.onrelease = () => { state.sentinel = null; renderStatus(); };
            }
            renderStatus();
            return true;
        } catch (e) {
            state.sentinel = null;
            renderStatus();
            try { errorBus?.report?.('wakelock', e); } catch {}
            return false;
        }
    }

    async function release() {
        state.training = false;
        const s = state.sentinel;
        state.sentinel = null;
        renderStatus();
        if (!s?.release) return;
        try { await s.release(); } catch (e) {
            try { errorBus?.report?.('wakelock', e); } catch {}
        }
    }

    function isActive() {
        return !!state.sentinel;
    }

    document.addEventListener('visibilitychange', () => {
        if (!state.training) return;
        if (!document.hidden) request();
    });

    window.addEventListener('workout:state', (e) => {
        const d = e?.detail || {};
        if (d.status === 'playing') request();
        if (d.status === 'paused') release();
        if (d.status === 'stopped' || d.status === 'idle') release();
        renderStatus();
    });

    window.workoutWakeLock = { request, release, isActive, renderStatus };
})();
