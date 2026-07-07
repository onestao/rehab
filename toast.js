// @ts-nocheck
function normalizeToastActions(action) {
    const actions = Array.isArray(action) ? action : [action];
    return actions
        .filter(Boolean)
        .map((item) => ({
            label: item.label || item.action || '',
            onClick: typeof item.onClick === 'function' ? item.onClick : item.onAction
        }))
        .filter((item) => item.label && typeof item.onClick === 'function');
}

window.toast = {
    show(msg, type = 'info', ms = 2400, action = null) {
        if (ms && typeof ms === 'object') {
            action = Array.isArray(ms.actions) ? ms.actions : ms.action ? {
                label: ms.action,
                onClick: typeof ms.onAction === 'function' ? ms.onAction : ms.onClick
            } : (ms.actionConfig || null);
            ms = Number(ms.timeout || ms.ms || 2400);
        }
        const actions = normalizeToastActions(action);
        if (type === 'error') window.haptics?.error?.();
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
        actions.forEach((toastAction) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'app-toast-action';
            btn.textContent = toastAction.label;
            btn.onclick = () => {
                toastAction.onClick();
                el.classList.remove('show');
            };
            el.appendChild(btn);
        });
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
