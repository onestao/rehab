// @ts-nocheck
const CACHE = 'training-assistant-v73';
const ASSETS = [
    'index.html',
    'build/generated.css?v=73',
    'css-src/42-health-profile.css?v=73',
    'theme.js?v=73',
    'fooddb.js?v=73',
    'ai-store.js?v=73',
    'ai-profile.js?v=73',
    'ai-models.js?v=73',
    'ai-api.js?v=73',
    'data-utils.js?v=73',
    'storage/idb.js?v=73',
    'storage/migrate.js?v=73',
    'data-store.js?v=73',
    'data-ui-state.js?v=73',
    'health-diet.js?v=73',
    'health-weight.js?v=73',
    'health-exercise.js?v=73',
    'goal-plan.js?v=73',
    'routine-library.js?v=73',
    'data-views.js?v=73',
    'data.js?v=73',
    'food-log.js?v=73',
    'advice-panel.js?v=73',
    'advice-render.js?v=73',
    'advice-prompt.js?v=73',
    'backup.js?v=73',
    'sync.js?v=73',
    'sync-status.js?v=73',
    'workout-system.js?v=73',
    'workout-pip.js?v=73',
    'workout-core.js?v=73',
    'workout-cardio.js?v=73',
    'workout-engine.js?v=73',
    'workout-state.js?v=73',
    'app-update.js?v=73',
    'toast.js?v=73',
    'error-bus.js?v=73',
    'weekly-summary.js?v=73',
    'onboarding.js?v=73',
    'swipe-actions.js?v=73',
    'health-profile.js?v=73',
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
