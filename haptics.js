// @ts-nocheck
(function () {
    if (window.haptics) return;

    function enabled() {
        const prefs = window.data?.db?.prefs;
        return !prefs || prefs.haptics !== false;
    }

    function pulse(pattern) {
        if (!enabled()) return;
        try { navigator.vibrate?.(pattern); } catch {}
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
            input.checked = enabled();
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

    window.addEventListener('load', () => window.haptics.syncToggle());
})();
