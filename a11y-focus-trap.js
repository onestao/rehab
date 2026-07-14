// @ts-nocheck
(function () {
    if (window.focusTrap?.__installed) return;

    /** @type {{ root: HTMLElement|null, handler: any, previous: Element|null }} */
    const state = { root: null, handler: null, previous: null };

    function focusables(root) {
        return Array.from(root.querySelectorAll('a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'))
            .filter(el => el && el.offsetParent !== null);
    }

    function trap(rootEl) {
        if (!rootEl) return;
        if (state.root === rootEl && state.handler) return;
        const previous = state.root === rootEl ? state.previous : document.activeElement;
        release({ restore: false });
        state.root = rootEl;
        state.previous = previous;
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
        if (!rootEl.contains(document.activeElement)) {
            (list[0] || rootEl).focus?.();
        }
    }

    function release(options = {}) {
        const restore = options.restore !== false;
        if (state.handler) document.removeEventListener('keydown', state.handler);
        state.handler = null;
        state.root = null;
        if (restore) {
            try { state.previous?.focus?.(); } catch {}
        }
        state.previous = null;
    }

    function isOpenModal(el) {
        if (!el || typeof el !== 'object') return false;
        if (el.classList?.contains?.('hidden')) return false;
        if (el.getAttribute?.('aria-hidden') === 'true') return false;
        const style = window.getComputedStyle?.(el);
        if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
        return true;
    }

    function findOpenModal() {
        const preferred = [
            document.getElementById('voiceImportDialog'),
            document.getElementById('voiceEngineDialog'),
            document.getElementById('profileModal'),
            document.getElementById('themeSheet'),
            document.getElementById('voiceSettingsSheet'),
            document.querySelector('.md-modal[data-rl-modal="1"]'),
            document.querySelector('.md-modal:not(.hidden)[role="dialog"]'),
            document.querySelector('.md-modal-sheet:not(.hidden)[role="dialog"]')
        ];
        for (const el of preferred) {
            if (isOpenModal(el)) return el;
        }
        return null;
    }

    function attachOpenModals() {
        const open = findOpenModal();
        if (open) trap(open);
    }

    window.focusTrap = { trap, release, attachOpenModals, __installed: true };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachOpenModals, { once: true });
    } else {
        attachOpenModals();
    }
})();
