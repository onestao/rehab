// @ts-nocheck
(function () {
    const entityMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };

    function escapeHtml(value = '') {
        return String(value).replace(/[&<>'"]/g, ch => entityMap[ch]);
    }

    function attr(value = '') {
        return escapeHtml(value);
    }

    function text(value = '') {
        return escapeHtml(value);
    }

    window.renderSafe = { escapeHtml, attr, text };
})();
