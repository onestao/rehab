// @ts-nocheck
(function () {
    const ROOT = { type: 'tab', id: 'today', close: () => false };

    const navStack = {
        stack: [ROOT],
        _bound: false,
        _suppress: false,

        init() {
            if (this._bound) return;
            this._bound = true;
            this.stack = [ROOT];
            try { history.replaceState({ navRoot: true, navIndex: 0 }, ''); } catch {}
            window.addEventListener('popstate', () => this._onPopState());
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
            try { history.pushState({ navIndex: this.stack.length - 1, type: entry.type, id: entry.id }, ''); } catch {}
        },

        replaceOrPush(entry) {
            if (!entry?.type || !entry?.id || typeof entry.close !== 'function') return;
            const top = this.top();
            if (top.type === entry.type && top.id === entry.id) {
                this.stack[this.stack.length - 1] = entry;
                try { history.replaceState({ navIndex: this.stack.length - 1, type: entry.type, id: entry.id }, ''); } catch {}
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
            const top = this.top();
            if (top.type === 'tab' && top.id !== 'today') {
                this.stack[this.stack.length - 1] = entry;
                try { history.replaceState({ navIndex: this.stack.length - 1, type: 'tab', id }, ''); } catch {}
                return;
            }
            this.push(entry);
        },

        resetToRoot() {
            this.stack = [ROOT];
            try { history.replaceState({ navRoot: true, navIndex: 0 }, ''); } catch {}
        },

        popType(type) {
            if (!type) return false;
            const idx = this.stack.map(e => e.type).lastIndexOf(type);
            if (idx <= 0) return false;
            this.stack.splice(idx, 1);
            try { history.replaceState({ navIndex: this.stack.length - 1 }, ''); } catch {}
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

        _onPopState() {
            if (this._suppress) return;
            const workoutGuard = window.workoutSystem || window.workout;
            if (workoutGuard?.isPlaying) {
                workoutGuard.handleBackGuard?.();
                return;
            }
            const top = this.top();
            if (!top || top === ROOT) return;
            const closed = top.close?.() !== false;
            if (closed) this.stack.pop();
        }
    };

    window.navStack = navStack;
})();
