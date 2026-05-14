// @ts-nocheck
(function () {
    const errorBus = window.errorBus;
    const ARTWORK = [
        { src: 'https://cdn-icons-png.flaticon.com/512/2964/2964514.png', sizes: '512x512', type: 'image/png' }
    ];

    let warned = false;
    function logOnce(msg) {
        if (warned) return;
        warned = true;
        try { console.info(msg); } catch {}
    }

    function ms() {
        if (!navigator.mediaSession) {
            logOnce('[mediaSession] Media Session API unavailable');
            return null;
        }
        return navigator.mediaSession;
    }

    function setPlaybackState(state) {
        try {
            const s = ms();
            if (!s) return;
            s.playbackState = state;
        } catch (e) { try { errorBus?.report?.('mediaSession', e); } catch {} }
    }

    function update(detail) {
        try {
            const s = ms();
            if (!s) return;
            const title = detail?.action?.name || '训练中';
            const artist = detail?.statusText || '';
            const album = `训练助手 · ${detail?.phase || ''}`;
            // MediaMetadata is widely supported where mediaSession exists.
            s.metadata = new MediaMetadata({ title, artist, album, artwork: ARTWORK });
        } catch (e) { try { errorBus?.report?.('mediaSession', e); } catch {} }
    }

    function clear() {
        try {
            const s = ms();
            if (!s) return;
            s.metadata = null;
            s.playbackState = 'none';
        } catch (e) { try { errorBus?.report?.('mediaSession', e); } catch {} }
    }

    function bindActions() {
        const s = ms();
        if (!s?.setActionHandler) return;
        try {
            s.setActionHandler('play', () => workout?.toggle?.());
            s.setActionHandler('pause', () => workout?.toggle?.());
            s.setActionHandler('nexttrack', () => workout?.skip?.());
            s.setActionHandler('previoustrack', () => workout?.prevAction?.() || workout?.resetCurrentSet?.());
            s.setActionHandler('stop', () => workout?.stop?.());
        } catch (e) { try { errorBus?.report?.('mediaSession', e); } catch {} }
    }

    function onState(e) {
        const detail = e?.detail || {};
        if (detail?.status === 'stopped' || detail?.status === 'idle') return clear();
        if (detail?.status === 'paused') setPlaybackState('paused');
        if (detail?.status === 'playing') setPlaybackState('playing');
        update(detail);
    }

    window.addEventListener('workout:state', onState);
    bindActions();
    window.workoutMediaSession = { update, setPlaybackState, clear, bindActions };
})();
