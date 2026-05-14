/**
 * @typedef {{ metadata?: any, playbackState?: 'none'|'paused'|'playing', setActionHandler?: (action: string, handler: any) => void }} MediaSessionLike
 * @typedef {{ mediaSession?: MediaSessionLike }} NavigatorLike
 * @typedef {{ report?: (scope: string, err: unknown, meta?: any) => any }} ErrorBus
 * @typedef {{ info?: (msg: string, ...args: any[]) => void }} Logger
 * @typedef {{ navigator: NavigatorLike, errorBus?: ErrorBus, console?: Logger }} Env
 */

export function createWorkoutMediaSession(env, getWorkoutApi) {
    let warned = false;
    function logOnce(msg) {
        if (warned) return;
        warned = true;
        try { env.console?.info?.(msg); } catch {}
    }

    function getSession() {
        const ms = env.navigator?.mediaSession;
        if (!ms) {
            logOnce('[mediaSession] Media Session API unavailable');
            return null;
        }
        return ms;
    }

    function setPlaybackState(state) {
        try {
            const ms = getSession();
            if (!ms) return;
            ms.playbackState = state;
        } catch (e) { env.errorBus?.report?.('mediaSession', e); }
    }

    function update(meta) {
        try {
            const ms = getSession();
            if (!ms) return;
            ms.metadata = meta;
        } catch (e) { env.errorBus?.report?.('mediaSession', e); }
    }

    function clear() {
        try {
            const ms = getSession();
            if (!ms) return;
            ms.metadata = null;
            ms.playbackState = 'none';
        } catch (e) { env.errorBus?.report?.('mediaSession', e); }
    }

    function bindActions() {
        const ms = getSession();
        if (!ms?.setActionHandler) return;
        const workout = getWorkoutApi();
        try {
            ms.setActionHandler('play', () => workout?.toggle?.());
            ms.setActionHandler('pause', () => workout?.toggle?.());
            ms.setActionHandler('nexttrack', () => workout?.skip?.());
            ms.setActionHandler('previoustrack', () => workout?.prevAction?.() || workout?.resetCurrentSet?.());
            ms.setActionHandler('stop', () => workout?.stop?.());
        } catch (e) { env.errorBus?.report?.('mediaSession', e); }
    }

    bindActions();
    return { setPlaybackState, update, clear, bindActions };
}
