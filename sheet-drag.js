// @ts-nocheck
(function () {
    if (window.sheetDrag) return;

    let active = null;
    const DRAG_HANDLE_HEIGHT = 36;
    const SCROLL_EPSILON = 1;
    const DIRECTION_THRESHOLD = 6;

    function isInteractiveTarget(target) {
        return !!target?.closest?.('input, textarea, select, button, a, label, summary, details, [role="button"], [tabindex], [onclick], [contenteditable="true"]');
    }

    function getScrollableAncestors(target, card) {
        const scrollers = [];
        let node = target instanceof Element ? target : null;
        while (node && node !== card.parentElement) {
            if (node instanceof HTMLElement) {
                const style = getComputedStyle(node);
                const overflowY = style.overflowY;
                const canScroll = /(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight + SCROLL_EPSILON;
                if (canScroll) scrollers.push(node);
            }
            if (node === card) break;
            node = node.parentElement;
        }
        return scrollers;
    }

    function canDragFromBody(event, card) {
        if (isInteractiveTarget(event.target)) return false;
        return getScrollableAncestors(event.target, card).every((scroller) => scroller.scrollTop <= SCROLL_EPSILON);
    }

    function resetActive() {
        if (!active) return;
        active.card.classList.remove('is-dragging');
        active.card.style.removeProperty('--sheet-drag-y');
        active = null;
    }

    function closeSheet(card) {
        const modal = card.closest('.md-modal-sheet, .md-modal-overlay');
        const close = modal?.querySelector('[data-modal-close], .md-modal-head .icon-btn, .md-modal-head .md-icon-btn');
        if (close instanceof HTMLElement) {
            close.click();
            return;
        }
        modal?.querySelector('.md-modal-backdrop')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }

    function findDraggableCard(target) {
        const sheetCard = target?.closest?.('.md-modal-sheet-card');
        if (sheetCard && !sheetCard.closest('.hidden')) return sheetCard;
        const modalCard = target?.closest?.('.md-modal[data-drag-dismiss]');
        if (!modalCard || modalCard.closest('.hidden')) return null;
        return modalCard;
    }

    function onStart(event) {
        if (event.touches?.length !== 1) return;
        const touch = event.touches?.[0];
        if (!touch) return;
        const card = findDraggableCard(event.target);
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const fromHead = !!event.target?.closest?.('.md-modal-head');
        const fromHandle = touch.clientY - rect.top <= DRAG_HANDLE_HEIGHT;
        const fromBodyTop = !fromHead && !fromHandle && canDragFromBody(event, card);
        if (!fromHead && !fromHandle && !fromBodyTop) return;
        active = {
            card,
            fromBodyTop,
            startY: touch.clientY,
            lastY: touch.clientY,
            startAt: performance.now(),
            height: rect.height
        };
        card.classList.add('is-dragging');
    }

    function onMove(event) {
        if (!active) return;
        if (event.touches?.length !== 1) {
            resetActive();
            return;
        }
        const touch = event.touches?.[0];
        if (!touch) return;
        const rawDy = touch.clientY - active.startY;
        if (active.fromBodyTop && rawDy < -DIRECTION_THRESHOLD) {
            resetActive();
            return;
        }
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
        resetActive();
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
