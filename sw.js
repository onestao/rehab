// @ts-nocheck
const CACHE = 'training-assistant-v79';
const ASSETS = [
    'index.html',
    'build/generated.css?v=79',
    'css-src/42-health-profile.css?v=79',
    'theme.js?v=79',
    'fooddb.js?v=79',
    'ai-store.js?v=79',
    'ai-profile.js?v=79',
    'ai-models.js?v=79',
    'ai-api.js?v=79',
    'data-utils.js?v=79',
    'storage/idb.js?v=79',
    'storage/migrate.js?v=79',
    'data-store.js?v=79',
    'data-ui-state.js?v=79',
    'health-diet.js?v=79',
    'health-weight.js?v=79',
    'health-exercise.js?v=79',
    'goal-plan.js?v=79',
    'routine-library.js?v=79',
    'data-views.js?v=79',
    'data.js?v=79',
    'food-log.js?v=79',
    'advice-panel.js?v=79',
    'advice-render.js?v=79',
    'advice-prompt.js?v=79',
    'backup.js?v=79',
    'sync.js?v=79',
    'sync-status.js?v=79',
    'workout-system.js?v=79',
    'workout-wakelock.js?v=79',
    'workout-media-session.js?v=79',
    'workout-pip.js?v=79',
    'workout-core.js?v=79',
    'workout-cardio.js?v=79',
    'workout-engine.js?v=79',
    'workout-state.js?v=79',
    'app-update.js?v=79',
    'toast.js?v=79',
    'error-bus.js?v=79',
    'i18n.js?v=79',
    'a11y-focus-trap.js?v=79',
    'i18n/zh-CN.json?v=79',
    'i18n/en-US.json?v=79',
    'weekly-summary.js?v=79',
    'onboarding.js?v=79',
    'swipe-actions.js?v=79',
    'health-profile.js?v=79',
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
