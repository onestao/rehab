// @ts-nocheck
window.swipeActions = {
    init() {
        document.addEventListener('touchstart', this.onStart, { passive: true });
        document.addEventListener('touchmove', this.onMove, { passive: false });
        document.addEventListener('touchend', this.onEnd, { passive: true });
    },
    onStart(e) {
        if (document.querySelector('.page.active')?.id !== 'workout') return;
        const target = e.target.closest('.day-detail-item, .today-timeline-item, .list-item');
        if (!target) return;
        swipeActions._t = target;
        swipeActions._x0 = e.touches[0].clientX;
        swipeActions._dx = 0;
    },
    onMove(e) {
        if (!swipeActions._t) return;
        const dx = e.touches[0].clientX - swipeActions._x0;
        if (Math.abs(dx) < 10) return;
        e.preventDefault();
        swipeActions._dx = Math.max(-96, Math.min(0, dx));
        swipeActions._t.style.transform = `translateX(${swipeActions._dx}px)`;
    },
    onEnd() {
        if (!swipeActions._t) return;
        if (swipeActions._dx <= -56) {
            swipeActions._t.classList.add('swipe-open');
            swipeActions._t.style.transform = 'translateX(-72px)';
        } else {
            swipeActions._t.classList.remove('swipe-open');
            swipeActions._t.style.transform = '';
        }
        swipeActions._t = null;
    }
};
