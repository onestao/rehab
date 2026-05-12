window.toast = {
    show(msg, type = 'info', ms = 2400) {
        let el = document.getElementById('appToast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'appToast';
            el.className = 'app-toast';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.dataset.type = type;
        el.classList.add('show');
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove('show'), ms);
    },
    sanitize(err) {
        const s = String(err?.message || err || '');
        return s.replace(/sk-[A-Za-z0-9]{8,}/g, 'sk-***')
                .replace(/Bearer\s+\S+/gi, 'Bearer ***');
    }
};
