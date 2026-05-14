// @ts-nocheck
const CACHE = 'training-assistant-v76';
const ASSETS = [
    'index.html',
    'build/generated.css?v=76',
    'css-src/42-health-profile.css?v=76',
    'theme.js?v=76',
    'fooddb.js?v=76',
    'ai-store.js?v=76',
    'ai-profile.js?v=76',
    'ai-models.js?v=76',
    'ai-api.js?v=76',
    'data-utils.js?v=76',
    'storage/idb.js?v=76',
    'storage/migrate.js?v=76',
    'data-store.js?v=76',
    'data-ui-state.js?v=76',
    'health-diet.js?v=76',
    'health-weight.js?v=76',
    'health-exercise.js?v=76',
    'goal-plan.js?v=76',
    'routine-library.js?v=76',
    'data-views.js?v=76',
    'data.js?v=76',
    'food-log.js?v=76',
    'advice-panel.js?v=76',
    'advice-render.js?v=76',
    'advice-prompt.js?v=76',
    'backup.js?v=76',
    'sync.js?v=76',
    'sync-status.js?v=76',
    'workout-system.js?v=76',
    'workout-wakelock.js?v=76',
    'workout-media-session.js?v=76',
    'workout-pip.js?v=76',
    'workout-core.js?v=76',
    'workout-cardio.js?v=76',
    'workout-engine.js?v=76',
    'workout-state.js?v=76',
    'app-update.js?v=76',
    'toast.js?v=76',
    'error-bus.js?v=76',
    'weekly-summary.js?v=76',
    'onboarding.js?v=76',
    'swipe-actions.js?v=76',
    'health-profile.js?v=76',
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
