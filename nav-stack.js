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

        open(type, id, close) {
            if (!type || !id || typeof close !== 'function') return;
            const entry = { type, id, close };
            const top = this.top();
            if (top.type === type && top.id === id) this.stack[this.stack.length - 1] = entry;
            else this.push(entry);
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

        find(type, id = '') {
            return this.stack.map(entry => entry?.type === type && (!id || entry.id === id)).lastIndexOf(true);
        },

        popType(type, id = '') {
            const idx = this.find(type, id);
            if (idx < 1) return false;
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

        rewind(count = 1) {
            this._suppress = true;
            try { history.go(-count); } catch {}
            setTimeout(() => { this._suppress = false; }, 120);
        },

        close(type, id, fn) {
            const idx = this.find(type, id);
            if (idx < 1) return fn ? fn() !== false : false;
            if ((fn || this.stack[idx].close)() === false) return false;
            const count = this.stack.length - idx;
            this.stack.splice(idx);
            this.rewind(count);
            return true;
        },

        requestClose(type, id = '') {
            const top = this.top();
            if ((type && top.type !== type) || (id && top.id !== id) || top === ROOT || top.close?.() === false) return false;
            this.stack.pop();
            this.rewind();
            return true;
        },

        _onPopState(event) {
            if (this._suppress) return;
            const workoutGuard = window.workoutSystem || window.workout;
            if (workoutGuard?.isPlaying) {
                workoutGuard.handleBackGuard?.();
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
