// @ts-nocheck
(function () {
    function renderPlainText(text = '') {
        const safe = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return safe(String(text || '')).replace(/\n/g, '<br>');
    }

    function createScheduler() {
        let mode = 'live';
        let chunkPerFrame = 8;
        let scheduled = false;
        return {
            setMode(next) { mode = next; },
            getMode() { return mode; },
            setChunkPerFrame(n) { chunkPerFrame = Math.max(1, Number(n) || 8); },
            tick(bufferLen) {
                if (mode === 'paused') return 0;
                if (mode === 'fast') return bufferLen;
                return Math.min(bufferLen, chunkPerFrame);
            },
            schedule(fn) {
                if (scheduled) return;
                scheduled = true;
                requestAnimationFrame(() => { scheduled = false; fn(); });
            }
        };
    }

    function create(target, opts = {}) {
        const scheduler = createScheduler();
        const render = typeof opts.renderMarkdown === 'function'
            ? (text) => String(opts.renderMarkdown(text) || '')
            : renderPlainText;
        const state = {
            buffer: '',
            shown: '',
            committedText: '',
            committedHtml: '',
            tail: '',
            tailRendered: '',
            destroyed: false,
            autoScroll: false
        };
        let stableEl = null;
        let tailEl = null;
        const animatedTokens = new WeakSet();

        function ensureNodes() {
            if (stableEl && tailEl && stableEl.isConnected && tailEl.isConnected) return;
            target.innerHTML = '';
            stableEl = document.createElement('span');
            stableEl.setAttribute('data-stream', 'stable');
            tailEl = document.createElement('span');
            tailEl.setAttribute('data-stream', 'tail');
            tailEl.setAttribute('data-no-stream-cursor', '');
            target.append(stableEl, tailEl);
        }

        function stableBoundary(text) {
            const value = String(text || '');
            let inCode = false;
            let boundary = 0;
            const lines = value.split('\n');
            let pos = 0;
            lines.forEach(line => {
                const end = pos + line.length + 1;
                if (line.trim().startsWith('```')) inCode = !inCode;
                if (!inCode && !line.trim()) boundary = end;
                pos = end;
            });
            return Math.max(0, Math.min(boundary, value.length));
        }

        function animateTokens(root) {
            root.querySelectorAll('p, li, h1, h2, h3').forEach(el => {
                if (animatedTokens.has(el)) return;
                animatedTokens.add(el);
                el.classList.add('m3e-token-in');
            });
        }

        function renderTail() {
            ensureNodes();
            if (!state.tail) {
                if (state.tailRendered) {
                    tailEl.innerHTML = '';
                    state.tailRendered = '';
                }
                return;
            }
            const nextHtml = render(state.tail);
            if (nextHtml === state.tailRendered) return;
            const shouldAnimate = !state.tailRendered;
            tailEl.innerHTML = nextHtml;
            state.tailRendered = nextHtml;
            if (shouldAnimate) animateTokens(tailEl);
        }

        function commitStable() {
            const boundary = stableBoundary(state.shown);
            if (boundary <= state.committedText.length) return;
            const stableText = state.shown.slice(state.committedText.length, boundary);
            if (!stableText) return;
            ensureNodes();
            const chunk = document.createElement('span');
            chunk.setAttribute('data-stream', 'committed');
            chunk.innerHTML = render(stableText);
            animateTokens(chunk);
            stableEl.appendChild(chunk);
            state.committedText = state.shown.slice(0, boundary);
            state.committedHtml = stableEl.innerHTML;
        }

        function emit(detail) {
            try { window.dispatchEvent(new CustomEvent('advice:render-state', { detail })); } catch {}
        }

        function renderFrame() {
            if (state.destroyed) return;
            const n = scheduler.tick(state.buffer.length);
            if (n <= 0) return;
            const chunk = state.buffer.slice(0, n);
            state.buffer = state.buffer.slice(n);
            state.shown += chunk;
            ensureNodes();
            commitStable();
            state.tail = state.shown.slice(state.committedText.length);
            renderTail();
            if (state.buffer.length) scheduler.schedule(renderFrame);
        }

        function enqueue(chunk) {
            if (state.destroyed) return;
            state.buffer += String(chunk || '');
            scheduler.schedule(renderFrame);
        }

        function seed(text) {
            if (state.destroyed) return;
            state.shown = String(text || '');
            state.buffer = '';
            state.committedText = '';
            state.committedHtml = '';
            state.tail = state.shown;
            state.tailRendered = '';
            stableEl = null;
            tailEl = null;
            ensureNodes();
            renderTail();
        }

        function pause(reason = 'manual') {
            scheduler.setMode('paused');
            emit({ mode: 'paused', reason, bufferedChars: state.buffer.length });
        }

        function resume() {
            scheduler.setMode('live');
            emit({ mode: 'live', bufferedChars: state.buffer.length });
            scheduler.schedule(renderFrame);
        }

        function flushAll() {
            scheduler.setMode('fast');
            emit({ mode: 'fast', bufferedChars: state.buffer.length });
            scheduler.schedule(() => {
                renderFrame();
                scheduler.setMode('live');
                emit({ mode: 'live', bufferedChars: state.buffer.length });
            });
        }

        function destroy() {
            state.destroyed = true;
        }

        return { enqueue, seed, pause, resume, flushAll, destroy, getState: () => ({ ...state, mode: scheduler.getMode() }) };
    }

    window.adviceStreamRenderer = { create };
})();
