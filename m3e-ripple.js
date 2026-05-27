// @ts-nocheck
(function () {
    if (typeof window === 'undefined') return;
    const SELECTOR = '.md-btn,.md-chip,.md-fab,.nav-item,.setting-row,.record-tab,.mode-tab,.record-quick-btn,.ai-send';
    function spawn(e, host) {
        const rect = host.getBoundingClientRect();
        const dot = document.createElement('span');
        dot.className = 'ripple';
        const x = (e.clientX || rect.left + rect.width / 2) - rect.left;
        const y = (e.clientY || rect.top + rect.height / 2) - rect.top;
        dot.style.left = x + 'px';
        dot.style.top = y + 'px';
        host.appendChild(dot);
        setTimeout(() => dot.remove(), 600);
    }
    document.addEventListener('pointerdown', (e) => {
        const matched = e.target.closest(SELECTOR);
        if (!matched) return;
        // For bottom nav, the visual pill is .nav-content, not the full rectangular button.
        // Anchoring the ripple to .nav-content keeps the effect inside the pill shape and
        // avoids the gray rectangular splash on mobile.
        let host = matched;
        if (matched.classList.contains('nav-item')) {
            const pill = matched.querySelector('.nav-content');
            if (pill) host = pill;
        }
        const cs = getComputedStyle(host);
        if (cs.position === 'static') host.style.position = 'relative';
        if (cs.overflow !== 'hidden') host.style.overflow = 'hidden';
        spawn(e, host);
    }, { passive: true });
})();
