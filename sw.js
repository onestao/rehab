// @ts-nocheck
const CACHE = 'training-assistant-v78';
const ASSETS = [
    'index.html',
    'build/generated.css?v=78',
    'css-src/42-health-profile.css?v=78',
    'theme.js?v=78',
    'fooddb.js?v=78',
    'ai-store.js?v=78',
    'ai-profile.js?v=78',
    'ai-models.js?v=78',
    'ai-api.js?v=78',
    'data-utils.js?v=78',
    'storage/idb.js?v=78',
    'storage/migrate.js?v=78',
    'data-store.js?v=78',
    'data-ui-state.js?v=78',
    'health-diet.js?v=78',
    'health-weight.js?v=78',
    'health-exercise.js?v=78',
    'goal-plan.js?v=78',
    'routine-library.js?v=78',
    'data-views.js?v=78',
    'data.js?v=78',
    'food-log.js?v=78',
    'advice-panel.js?v=78',
    'advice-render.js?v=78',
    'advice-prompt.js?v=78',
    'backup.js?v=78',
    'sync.js?v=78',
    'sync-status.js?v=78',
    'workout-system.js?v=78',
    'workout-wakelock.js?v=78',
    'workout-media-session.js?v=78',
    'workout-pip.js?v=78',
    'workout-core.js?v=78',
    'workout-cardio.js?v=78',
    'workout-engine.js?v=78',
    'workout-state.js?v=78',
    'app-update.js?v=78',
    'toast.js?v=78',
    'error-bus.js?v=78',
    'i18n.js?v=78',
    'a11y-focus-trap.js?v=78',
    'i18n/zh-CN.json?v=78',
    'i18n/en-US.json?v=78',
    'weekly-summary.js?v=78',
    'onboarding.js?v=78',
    'swipe-actions.js?v=78',
    'health-profile.js?v=78',
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
