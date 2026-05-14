// @ts-nocheck
window.toast = {
    show(msg, type = 'info', ms = 2400, action = null) {
        let el = document.getElementById('appToast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'appToast';
            el.className = 'app-toast';
            document.body.appendChild(el);
        }
        el.innerHTML = '';
        const text = document.createElement('span');
        text.className = 'app-toast-text';
        text.textContent = msg;
        el.appendChild(text);
        if (action?.label && typeof action.onClick === 'function') {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'app-toast-action';
            btn.textContent = action.label;
            btn.onclick = () => {
                action.onClick();
                el.classList.remove('show');
            };
            el.appendChild(btn);
        }
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
