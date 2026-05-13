const CACHE = 'training-assistant-v61';
const ASSETS = [
    'index.html',
    'build/generated.css?v=60',
    'css-src/42-health-profile.css?v=60',
    'theme.js?v=60',
    'fooddb.js?v=60',
    'ai-store.js?v=60',
    'ai-profile.js?v=60',
    'ai-models.js?v=60',
    'ai-api.js?v=60',
    'data-utils.js?v=60',
    'storage/idb.js?v=60',
    'storage/migrate.js?v=60',
    'data-store.js?v=60',
    'data-ui-state.js?v=60',
    'health-diet.js?v=60',
    'health-weight.js?v=60',
    'data.js?v=60',
    'food-log.js?v=60',
    'advice-panel.js?v=60',
    'advice-render.js?v=60',
    'advice-prompt.js?v=60',
    'backup.js?v=60',
    'sync.js?v=60',
    'sync-status.js?v=60',
    'workout-system.js?v=60',
    'workout-pip.js?v=60',
    'workout-core.js?v=60',
    'workout-cardio.js?v=60',
    'workout-engine.js?v=60',
    'workout-state.js?v=60',
    'app-update.js?v=60',
    'toast.js?v=60',
    'weekly-summary.js?v=60',
    'onboarding.js?v=60',
    'swipe-actions.js?v=60',
    'health-profile.js?v=60',
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
