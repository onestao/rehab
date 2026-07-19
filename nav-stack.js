// @ts-nocheck
(function () {
    const ROOT = { type: 'tab', id: 'today', close: () => false };

    function isStandaloneDisplay() {
        try {
            if (window.matchMedia?.('(display-mode: standalone)')?.matches) return true;
            if (window.matchMedia?.('(display-mode: minimal-ui)')?.matches) return true;
            if (window.navigator?.standalone === true) return true;
        } catch {}
        return false;
    }

    const navStack = {
        stack: [ROOT],
        _bound: false,
        _suppress: false,
        /** Product: standalone/PWA uses layered back; plain browser bookmark may leave site. */
        mode: 'browser',

        init() {
            if (this._bound) return;
            this._bound = true;
            this.mode = isStandaloneDisplay() ? 'pwa' : 'browser';
            this.stack = [ROOT];
            try {
                history.replaceState({
                    navRoot: true,
                    navIndex: 0,
                    rehabNav: true,
                    mode: this.mode
                }, '');
            } catch {}
            window.addEventListener('popstate', (event) => this._onPopState(event));
            if (history.state?.navIndex > 0) {
                try { history.go(-Number(history.state.navIndex || 0)); } catch {}
            }
        },

        top() {
            return this.stack[this.stack.length - 1] || ROOT;
        },

        push(entry) {
            if (!entry?.type || !entry?.id || typeof entry.close !== 'function') return;
            this.stack.push(entry);
            try {
                history.pushState({
                    navIndex: this.stack.length - 1,
                    type: entry.type,
                    id: entry.id,
                    rehabNav: true,
                    mode: this.mode
                }, '');
            } catch {}
        },

        replaceOrPush(entry) {
            if (!entry?.type || !entry?.id || typeof entry.close !== 'function') return;
            const top = this.top();
            if (top.type === entry.type && top.id === entry.id) {
                this.stack[this.stack.length - 1] = entry;
                try {
                    history.replaceState({
                        navIndex: this.stack.length - 1,
                        type: entry.type,
                        id: entry.id,
                        rehabNav: true,
                        mode: this.mode
                    }, '');
                } catch {}
                return;
            }
            this.push(entry);
        },

        replaceTopOrPushTab(id) {
            if (!id || id === 'today') return this.resetToRoot();
            const entry = {
                type: 'tab',
                id,
                close: () => {
                    window.ui?._activateTab?.('today', document.querySelector('.nav-item'));
                    return true;
                }
            };
            let lastTabIdx = -1;
            for (let i = this.stack.length - 1; i >= 0; i -= 1) {
                if (this.stack[i]?.type === 'tab') {
                    lastTabIdx = i;
                    break;
                }
            }
            // Already on this tab (possibly with subtabs/modals above): keep frames, refresh handler.
            if (lastTabIdx > 0 && this.stack[lastTabIdx].id === id) {
                this.stack[lastTabIdx] = entry;
                return;
            }
            // Replace a non-root tab (and drop frames above it) when switching tabs.
            if (lastTabIdx > 0 && this.stack[lastTabIdx].id !== 'today') {
                this.stack = this.stack.slice(0, lastTabIdx).concat([entry]);
                try {
                    history.replaceState({
                        navIndex: this.stack.length - 1,
                        type: 'tab',
                        id,
                        rehabNav: true,
                        mode: this.mode
                    }, '');
                } catch {}
                return;
            }
            this.push(entry);
        },

        resetToRoot() {
            this.stack = [ROOT];
            try {
                history.replaceState({
                    navRoot: true,
                    navIndex: 0,
                    rehabNav: true,
                    mode: this.mode
                }, '');
            } catch {}
        },

        popType(type) {
            if (!type) return false;
            const idx = this.stack.map(e => e.type).lastIndexOf(type);
            if (idx <= 0) return false;
            this.stack.splice(idx, 1);
            try {
                history.replaceState({
                    navIndex: this.stack.length - 1,
                    rehabNav: true,
                    mode: this.mode
                }, '');
            } catch {}
            return true;
        },

        requestClose(type) {
            const top = this.top();
            if (type && top.type !== type) return false;
            if (!top || top === ROOT) return false;
            const closed = top.close?.() !== false;
            if (!closed) return false;
            this.stack.pop();
            this._suppress = true;
            try { history.back(); } catch {}
            setTimeout(() => { this._suppress = false; }, 120);
            return true;
        },

        /**
         * H2: System/browser back.
         * - Always close modal/drawer first.
         * - PWA/standalone: walk subroute → tab → Today; exit only at root.
         * - Plain browser cold bookmark with only root: allow leaving the site (no infinite trap).
         */
        _onPopState(event) {
            if (this._suppress) return;
            const workoutGuard = window.workoutSystem || window.workout;
            if (workoutGuard?.isPlaying) {
                workoutGuard.handleBackGuard?.();
                // Re-assert current stack frame so a playing workout is not abandoned silently.
                try {
                    history.pushState({
                        navIndex: this.stack.length - 1,
                        type: this.top()?.type,
                        id: this.top()?.id,
                        rehabNav: true,
                        mode: this.mode
                    }, '');
                } catch {}
                return;
            }
            const top = this.top();
            if (!top || top === ROOT || (top.type === 'tab' && top.id === 'today' && this.stack.length <= 1)) {
                // Root: plain browser may leave; PWA re-pushes root so system back does not dump blank.
                if (this.mode === 'pwa' || isStandaloneDisplay()) {
                    try {
                        history.pushState({
                            navRoot: true,
                            navIndex: 0,
                            rehabNav: true,
                            mode: 'pwa'
                        }, '');
                    } catch {}
                }
                return;
            }
            const closed = top.close?.() !== false;
            if (closed) {
                this.stack.pop();
                // Keep history index aligned with remaining stack when browser already popped.
                try {
                    history.replaceState({
                        navIndex: Math.max(0, this.stack.length - 1),
                        type: this.top()?.type,
                        id: this.top()?.id,
                        rehabNav: true,
                        mode: this.mode
                    }, '');
                } catch {}
            } else {
                // close refused: restore state so user is not stuck off-stack.
                try {
                    history.pushState({
                        navIndex: this.stack.length - 1,
                        type: top.type,
                        id: top.id,
                        rehabNav: true,
                        mode: this.mode
                    }, '');
                } catch {}
            }
        }
    };

    window.navStack = navStack;
})();
