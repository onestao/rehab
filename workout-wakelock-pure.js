/**
 * @typedef {{ report?: (scope: string, err: unknown, meta?: any) => any }} ErrorBus
 * @typedef {{ info?: (msg: string, ...args: any[]) => void }} Logger
 * @typedef {{ request: (type: 'screen') => Promise<{ release: () => Promise<void> } & { onrelease?: any, addEventListener?: any }> }} WakeLockApi
 * @typedef {{ wakeLock?: WakeLockApi }} NavigatorLike
 * @typedef {{ hidden: boolean, addEventListener: (type: string, cb: any) => void }} DocumentLike
 * @typedef {{ addEventListener: (type: string, cb: any) => void }} WindowLike
 * @typedef {{ navigator: NavigatorLike, document: DocumentLike, window: WindowLike, errorBus?: ErrorBus, console?: Logger }} Env
 */

// @ts-nocheck
export function createWorkoutWakeLock(env) {
    const state = {
        sentinel: null,
        warned: false,
        training: false
    };

    function logOnce(msg) {
        if (state.warned) return;
        state.warned = true;
        try { env.console?.info?.(msg); } catch {}
    }

    async function request() {
        state.training = true;
        try {
            if (!env.navigator?.wakeLock?.request) {
                logOnce('[wakelock] Wake Lock API unavailable');
                return false;
            }
            if (state.sentinel) return true;
            const sentinel = await env.navigator.wakeLock.request('screen');
            state.sentinel = sentinel;
            if (sentinel?.addEventListener) {
                sentinel.addEventListener('release', () => { state.sentinel = null; });
            } else if ('onrelease' in (sentinel || {})) {
                sentinel.onrelease = () => { state.sentinel = null; };
            }
            return true;
        } catch (e) {
            state.sentinel = null;
            try { env.errorBus?.report?.('wakelock', e); } catch {}
            return false;
        }
    }

    async function release() {
        state.training = false;
        const s = state.sentinel;
        state.sentinel = null;
        if (!s?.release) return;
        try { await s.release(); } catch (e) {
            try { env.errorBus?.report?.('wakelock', e); } catch {}
        }
    }

    function isActive() {
        return !!state.sentinel;
    }

    function bindVisibility() {
        env.document?.addEventListener?.('visibilitychange', () => {
            if (!state.training) return;
            if (!env.document.hidden) request();
        });
    }

    function bindWorkoutEvents() {
        env.window?.addEventListener?.('workout:state', (e) => {
            const d = e?.detail || {};
            if (d.status === 'playing') request();
            if (d.status === 'paused' || d.status === 'stopped' || d.status === 'idle') release();
        });
    }

    bindVisibility();
    bindWorkoutEvents();

    return { request, release, isActive, _state: state };
}
