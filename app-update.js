// @ts-nocheck
const appUpdate = {
    registration: null,
    waitingWorker: null,
    swUrl: 'sw.js?v=106',

    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        try {
            this.registration = await navigator.serviceWorker.register(this.swUrl, { updateViaCache: 'none' });
            this.bindRegistration(this.registration);
            await this.registration.update?.();
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload();
            }, { once: true });
        } catch {}
    },

    bindRegistration(registration) {
        if (!registration) return;
        if (registration.waiting) this.show(registration.waiting);
        if (registration.installing) this.bindWorker(registration.installing);
        registration.addEventListener('updatefound', () => {
            const worker = registration.installing;
            if (!worker) return;
            this.bindWorker(worker);
        });
    },

    bindWorker(worker) {
        if (!worker || worker._appUpdateBound) return;
        worker._appUpdateBound = true;
        worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                this.show(worker);
            }
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
