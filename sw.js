// @ts-nocheck
const CACHE = 'training-assistant-v75';
const ASSETS = [
    'index.html',
    'build/generated.css?v=75',
    'css-src/42-health-profile.css?v=75',
    'theme.js?v=75',
    'fooddb.js?v=75',
    'ai-store.js?v=75',
    'ai-profile.js?v=75',
    'ai-models.js?v=75',
    'ai-api.js?v=75',
    'data-utils.js?v=75',
    'storage/idb.js?v=75',
    'storage/migrate.js?v=75',
    'data-store.js?v=75',
    'data-ui-state.js?v=75',
    'health-diet.js?v=75',
    'health-weight.js?v=75',
    'health-exercise.js?v=75',
    'goal-plan.js?v=75',
    'routine-library.js?v=75',
    'data-views.js?v=75',
    'data.js?v=75',
    'food-log.js?v=75',
    'advice-panel.js?v=75',
    'advice-render.js?v=75',
    'advice-prompt.js?v=75',
    'backup.js?v=75',
    'sync.js?v=75',
    'sync-status.js?v=75',
    'workout-system.js?v=75',
    'workout-pip.js?v=75',
    'workout-core.js?v=75',
    'workout-cardio.js?v=75',
    'workout-engine.js?v=75',
    'workout-state.js?v=75',
    'app-update.js?v=75',
    'toast.js?v=75',
    'error-bus.js?v=75',
    'weekly-summary.js?v=75',
    'onboarding.js?v=75',
    'swipe-actions.js?v=75',
    'health-profile.js?v=75',
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
