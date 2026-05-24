// @ts-nocheck
(function () {
    if (window.sheetDrag) return;

    let active = null;
    const DRAG_HANDLE_HEIGHT = 36;

    function closeSheet(card) {
        const modal = card.closest('.md-modal-sheet');
        const close = modal?.querySelector('[data-modal-close], .md-modal-head .icon-btn');
        if (close instanceof HTMLElement) {
            close.click();
            return;
        }
        modal?.querySelector('.md-modal-backdrop')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }

    function onStart(event) {
        const touch = event.touches?.[0];
        if (!touch) return;
        const card = event.target?.closest?.('.md-modal-sheet-card');
        if (!card || card.closest('.hidden')) return;
        const rect = card.getBoundingClientRect();
        const fromHead = !!event.target?.closest?.('.md-modal-head');
        const fromHandle = touch.clientY - rect.top <= DRAG_HANDLE_HEIGHT;
        if (!fromHead && !fromHandle) return;
        active = {
            card,
            startY: touch.clientY,
            lastY: touch.clientY,
            startAt: performance.now(),
            height: rect.height
        };
        card.classList.add('is-dragging');
    }

    function onMove(event) {
        if (!active) return;
        const touch = event.touches?.[0];
        if (!touch) return;
        const rawDy = touch.clientY - active.startY;
        if (rawDy < 0) {
            active.lastY = touch.clientY;
            active.card.style.removeProperty('--sheet-drag-y');
            return;
        }
        const dy = Math.max(0, rawDy);
        active.lastY = touch.clientY;
        active.card.style.setProperty('--sheet-drag-y', `${dy}px`);
        if (dy > 6) event.preventDefault();
    }

    function onEnd() {
        if (!active) return;
        const dy = Math.max(0, active.lastY - active.startY);
        const dt = Math.max(1, performance.now() - active.startAt);
        const velocity = dy / dt;
        const shouldClose = dy > active.height / 3 || velocity > 0.6;
        const card = active.card;
        card.classList.remove('is-dragging');
        card.style.removeProperty('--sheet-drag-y');
        active = null;
        if (shouldClose) closeSheet(card);
    }

    function init() {
        document.addEventListener('touchstart', onStart, { passive: true, capture: true });
        document.addEventListener('touchmove', onMove, { passive: false, capture: true });
        document.addEventListener('touchend', onEnd, { passive: true, capture: true });
        document.addEventListener('touchcancel', onEnd, { passive: true, capture: true });
    }

    window.sheetDrag = { init };
    init();
})();
