// @ts-nocheck
const appUpdate = {
    registration: null,
    waitingWorker: null,

    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        try {
            this.registration = await navigator.serviceWorker.register('sw.js?v=81');
            this.bindRegistration(this.registration);
            this.registration.update?.();
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload();
            }, { once: true });
        } catch {}
    },

    bindRegistration(registration) {
        if (!registration) return;
        if (registration.waiting) this.show(registration.waiting);
        registration.addEventListener('updatefound', () => {
            const worker = registration.installing;
            if (!worker) return;
            worker.addEventListener('statechange', () => {
                if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                    this.show(worker);
                }
            });
        });
    },

    show(worker) {
        this.waitingWorker = worker;
        document.getElementById('appUpdateBanner')?.classList.remove('hidden');
    },

    apply() {
        const worker = this.waitingWorker || this.registration?.waiting;
        if (worker) {
            try { worker.postMessage({ type: 'SKIP_WAITING' }); } catch {}
            // controllerchange handler will reload once the new SW activates.
            return;
        }
        window.location.reload();
    },

    dismiss() {
        document.getElementById('appUpdateBanner')?.classList.add('hidden');
    }
};

if (typeof window !== 'undefined') window.appUpdate = appUpdate;

