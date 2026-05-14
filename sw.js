// @ts-nocheck
const CACHE = 'training-assistant-v80';
const ASSETS = [
    'index.html',
    'build/generated.css?v=80',
    'css-src/42-health-profile.css?v=80',
    'theme.js?v=80',
    'fooddb.js?v=80',
    'ai-store.js?v=80',
    'ai-profile.js?v=80',
    'ai-models.js?v=80',
    'ai-api.js?v=80',
    'data-utils.js?v=80',
    'storage/idb.js?v=80',
    'storage/migrate.js?v=80',
    'data-store.js?v=80',
    'data-ui-state.js?v=80',
    'health-diet.js?v=80',
    'health-weight.js?v=80',
    'health-exercise.js?v=80',
    'goal-plan.js?v=80',
    'routine-library.js?v=80',
    'data-views.js?v=80',
    'data.js?v=80',
    'food-log.js?v=80',
    'advice-panel.js?v=80',
    'advice-render.js?v=80',
    'advice-prompt.js?v=80',
    'advice-stream-renderer.js?v=80',
    'backup.js?v=80',
    'sync.js?v=80',
    'sync-status.js?v=80',
    'workout-system.js?v=80',
    'workout-wakelock.js?v=80',
    'workout-media-session.js?v=80',
    'workout-pip.js?v=80',
    'workout-core.js?v=80',
    'workout-cardio.js?v=80',
    'workout-engine.js?v=80',
    'workout-state.js?v=80',
    'app-update.js?v=80',
    'toast.js?v=80',
    'error-bus.js?v=80',
    'i18n.js?v=80',
    'a11y-focus-trap.js?v=80',
    'i18n/zh-CN.json?v=80',
    'i18n/en-US.json?v=80',
    'weekly-summary.js?v=80',
    'onboarding.js?v=80',
    'swipe-actions.js?v=80',
    'health-profile.js?v=80',
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
