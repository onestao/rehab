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
            destroyed: false,
            autoScroll: true
        };

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
            target.innerHTML = render(state.shown);
            if (state.autoScroll) {
                target.scrollIntoView({ block: 'end' });
            }
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
            target.innerHTML = render(state.shown);
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
