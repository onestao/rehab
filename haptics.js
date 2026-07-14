// @ts-nocheck
(function () {
    if (window.haptics) {
        if (document.readyState === 'complete') window.haptics.syncToggle?.();
        else window.addEventListener('load', () => window.haptics.syncToggle?.(), { once: true });
        return;
    }

    function enabled() {
        const prefs = window.data?.db?.prefs;
        return !prefs || prefs.haptics !== false;
    }

    function supported() {
        return typeof navigator !== 'undefined' &&
            typeof navigator.vibrate === 'function';
    }

    function pulse(pattern) {
        if (!supported() || !enabled()) return;
        try { navigator.vibrate(pattern); } catch {}
    }

    window.haptics = {
        light() { pulse([10]); },
        medium() { pulse([20]); },
        heavy() { pulse([30]); },
        success() { pulse([10, 40, 10]); },
        error() { pulse([30, 60, 30]); },
        setEnabled(value) {
            if (!window.data?.db) return;
            data.db.prefs = data.db.prefs || {};
            data.db.prefs.haptics = !!value;
            data.save?.({ render: false });
        },
        syncToggle() {
            const input = document.getElementById('hapticsEnabled');
            if (!input) return;
            const available = supported();
            input.checked = enabled();
            input.disabled = !available;
            input.setAttribute?.('aria-disabled', available ? 'false' : 'true');
            window.ui?.syncSwitchAria?.(input);
        }
    };

    document.addEventListener('change', (event) => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || input.id !== 'hapticsEnabled') return;
        window.haptics.setEnabled(input.checked);
        window.ui?.syncSwitchAria?.(input);
        window.haptics.light();
    });

    if (document.readyState === 'complete') {
        window.haptics.syncToggle();
    } else {
        window.addEventListener('load', () => window.haptics.syncToggle(), { once: true });
    }
})();
