// @ts-nocheck
(function () {
    function available() {
        return {
            wakeLock: !!navigator.wakeLock?.request,
            mediaSession: !!navigator.mediaSession,
            pip: !!document.pictureInPictureEnabled,
            serviceWorker: !!navigator.serviceWorker?.controller,
            online: navigator.onLine !== false,
            visibility: document.visibilityState || 'visible'
        };
    }

    function score(cap = available()) {
        const checks = [cap.wakeLock, cap.mediaSession, cap.pip, cap.serviceWorker];
        return checks.reduce((n, ok) => n + (ok ? 1 : 0), 0);
    }

    function message(cap = available()) {
        const tips = [];
        if (!cap.wakeLock) tips.push('屏幕常亮不可用，锁屏后可能暂停');
        if (!cap.mediaSession) tips.push('通知栏控制不可用');
        if (!cap.pip) tips.push('画中画不可用，后台可见性较弱');
        if (!cap.serviceWorker) tips.push('离线缓存尚未接管');
        if (!cap.online) tips.push('当前离线，AI 和云端同步不可用');
        if (!tips.length) return '后台保持能力正常。训练时建议保持屏幕亮起，或开启画中画。';
        return `后台保持有风险：${tips.join('；')}。`;
    }

    function render() {
        const el = document.getElementById('workoutReadiness');
        if (!el) return;
        const cap = available();
        const level = score(cap) >= 3 ? 'ok' : score(cap) >= 2 ? 'warn' : 'bad';
        el.dataset.level = level;
        el.innerHTML = `<span class="material-symbols-rounded">shield</span><span>${message(cap)}</span>`;
    }

    function notifyBeforeStart() {
        const cap = available();
        const text = message(cap);
        if (score(cap) < 3) window.toast?.show?.(text, 'info');
        render();
        return cap;
    }

    window.workoutReadiness = { available, score, message, render, notifyBeforeStart };
    document.addEventListener('visibilitychange', render);
    window.addEventListener('online', render);
    window.addEventListener('offline', render);
})();
