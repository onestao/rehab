// @ts-nocheck
(function () {
    if (window.credentialFields) return;

    const PASSWORD_IDS = ['aiApiKey', 'aiEncryptPass', 'aiDecryptPass', 's3Secret', 'davPass'];
    const timers = new Map();

    function enhancePassword(input) {
        if (!input || input.dataset.visibilityBound === 'true') return;
        input.dataset.visibilityBound = 'true';
        input.type = 'text';
        input.autocomplete = 'one-time-code';
        input.setAttribute('autocapitalize', 'off');
        input.setAttribute('autocorrect', 'off');
        input.setAttribute('spellcheck', 'false');
        input.setAttribute('data-lpignore', 'true');
        input.setAttribute('data-1p-ignore', 'true');
        input.setAttribute('data-form-type', 'other');
        input.classList.add('credential-masked');
        const field = input.closest('.md-field');
        if (!field || field.querySelector(`[data-password-toggle="${input.id}"]`)) return;
        field.classList.add('md-field-has-action');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'md-icon-btn password-visibility-toggle';
        button.dataset.passwordToggle = input.id;
        button.setAttribute('aria-label', '显示或隐藏凭据');
        button.innerHTML = '<span class="material-symbols-rounded">visibility</span>';
        button.addEventListener('click', () => toggle(input, button));
        field.appendChild(button);
    }

    function toggle(input, button) {
        const icon = button.querySelector('.material-symbols-rounded');
        const showing = !input.classList.contains('credential-masked');
        clearTimeout(timers.get(input.id));
        if (showing) {
            input.classList.add('credential-masked');
            if (icon) icon.textContent = 'visibility';
            return;
        }
        input.classList.remove('credential-masked');
        if (icon) icon.textContent = 'visibility_off';
        timers.set(input.id, setTimeout(() => {
            input.classList.add('credential-masked');
            if (icon) icon.textContent = 'visibility';
        }, 3000));
    }

    function validateBaseUrl() {
        const input = document.getElementById('aiBaseUrl');
        if (!input) return;
        input.pattern = '^https?://.+';
        if (input.dataset.baseUrlBound === 'true') return;
        input.dataset.baseUrlBound = 'true';
        input.addEventListener('blur', () => {
            const value = String(input.value || '').trim();
            if (value && !/^https:\/\//i.test(value)) {
                window.toast?.show?.('Base URL 不是 HTTPS，移动浏览器可能拦截请求', 'warning');
            }
        });
    }

    function init() {
        PASSWORD_IDS.forEach(id => enhancePassword(document.getElementById(id)));
        validateBaseUrl();
    }

    window.credentialFields = { init };
    window.addEventListener('load', init);
    document.addEventListener('ai:ready', init);
})();
