// @ts-nocheck
(function () {
    /** @type {{ root: HTMLElement|null, handler: any, previous: Element|null }} */
    const state = { root: null, handler: null, previous: null };

    function focusables(root) {
        return Array.from(root.querySelectorAll('a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'))
            .filter(el => el && el.offsetParent !== null);
    }

    function trap(rootEl) {
        if (!rootEl) return;
        release();
        state.root = rootEl;
        state.previous = document.activeElement;
        state.handler = (e) => {
            if (!state.root) return;
            if (e.key === 'Escape') {
                const close = state.root.querySelector('[data-modal-close]');
                if (close) close.click();
                return;
            }
            if (e.key !== 'Tab') return;
            const list = focusables(state.root);
            if (!list.length) return;
            const first = list[0];
            const last = list[list.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', state.handler);
        const list = focusables(rootEl);
        (list[0] || rootEl).focus?.();
    }

    function release() {
        if (state.handler) document.removeEventListener('keydown', state.handler);
        state.handler = null;
        state.root = null;
        try { state.previous?.focus?.(); } catch {}
        state.previous = null;
    }

    window.focusTrap = { trap, release };
})();
