// @ts-nocheck
const CACHE = 'training-assistant-v81';
const ASSETS = [
    'index.html',
    'build/generated.css?v=81',
    'css-src/42-health-profile.css?v=81',
    'theme.js?v=81',
    'fooddb.js?v=81',
    'ai-store.js?v=81',
    'ai-profile.js?v=81',
    'ai-models.js?v=81',
    'ai-api.js?v=81',
    'data-utils.js?v=81',
    'storage/idb.js?v=81',
    'storage/migrate.js?v=81',
    'data-store.js?v=81',
    'data-ui-state.js?v=81',
    'health-diet.js?v=81',
    'health-weight.js?v=81',
    'health-exercise.js?v=81',
    'goal-plan.js?v=81',
    'routine-library.js?v=81',
    'data-views.js?v=81',
    'data.js?v=81',
    'food-log.js?v=81',
    'advice-panel.js?v=81',
    'advice-render.js?v=81',
    'advice-prompt.js?v=81',
    'advice-stream-renderer.js?v=81',
    'backup.js?v=81',
    'sync.js?v=81',
    'sync-status.js?v=81',
    'workout-system.js?v=81',
    'workout-wakelock.js?v=81',
    'workout-media-session.js?v=81',
    'workout-pip.js?v=81',
    'workout-core.js?v=81',
    'workout-cardio.js?v=81',
    'workout-engine.js?v=81',
    'workout-state.js?v=81',
    'app-update.js?v=81',
    'toast.js?v=81',
    'error-bus.js?v=81',
    'i18n.js?v=81',
    'a11y-focus-trap.js?v=81',
    'i18n/zh-CN.json?v=81',
    'i18n/en-US.json?v=81',
    'weekly-summary.js?v=81',
    'onboarding.js?v=81',
    'swipe-actions.js?v=81',
    'health-profile.js?v=81',
    'assets/model-icons/openai.svg',
    'assets/model-icons/gemini.svg',
    'assets/model-icons/grok.svg',
    'assets/model-icons/deepseek.svg',
    'assets/model-icons/claude.svg',
    'assets/model-icons/qwen.svg',
    'assets/model-icons/doubao.svg',
    'assets/model-icons/kimi.svg',
    'assets/model-icons/minimax.svg',
    'assets/model-icons/mimo.svg',
    'assets/model-icons/glm.svg',
    'assets/model-icons/generic.svg',
    'manifest.json'
];


self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE).map(k => caches.delete(k))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    if (url.origin !== location.origin) return;
    e.respondWith(
        fetch(e.request).then(res => {
            if (res.ok) {
                const clone = res.clone();
                caches.open(CACHE).then(c => c.put(e.request, clone));
            }
            return res;
        }).catch(() => caches.match(e.request))
    );
});
