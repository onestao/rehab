// @ts-nocheck
const CACHE = 'training-assistant-v77';
const ASSETS = [
    'index.html',
    'build/generated.css?v=77',
    'css-src/42-health-profile.css?v=77',
    'theme.js?v=77',
    'fooddb.js?v=77',
    'ai-store.js?v=77',
    'ai-profile.js?v=77',
    'ai-models.js?v=77',
    'ai-api.js?v=77',
    'data-utils.js?v=77',
    'storage/idb.js?v=77',
    'storage/migrate.js?v=77',
    'data-store.js?v=77',
    'data-ui-state.js?v=77',
    'health-diet.js?v=77',
    'health-weight.js?v=77',
    'health-exercise.js?v=77',
    'goal-plan.js?v=77',
    'routine-library.js?v=77',
    'data-views.js?v=77',
    'data.js?v=77',
    'food-log.js?v=77',
    'advice-panel.js?v=77',
    'advice-render.js?v=77',
    'advice-prompt.js?v=77',
    'backup.js?v=77',
    'sync.js?v=77',
    'sync-status.js?v=77',
    'workout-system.js?v=77',
    'workout-wakelock.js?v=77',
    'workout-media-session.js?v=77',
    'workout-pip.js?v=77',
    'workout-core.js?v=77',
    'workout-cardio.js?v=77',
    'workout-engine.js?v=77',
    'workout-state.js?v=77',
    'app-update.js?v=77',
    'toast.js?v=77',
    'error-bus.js?v=77',
    'weekly-summary.js?v=77',
    'onboarding.js?v=77',
    'swipe-actions.js?v=77',
    'health-profile.js?v=77',
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
