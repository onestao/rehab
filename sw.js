const CACHE = 'training-assistant-v56';
const ASSETS = [
    'index.html',
    'build/generated.css?v=56',
    'theme.js?v=56',
    'fooddb.js?v=56',
    'ai-store.js?v=56',
    'ai-profile.js?v=56',
    'ai-models.js?v=56',
    'ai-api.js?v=56',
    'data.js?v=56',
    'food-log.js?v=56',
    'advice-panel.js?v=56',
    'advice-render.js?v=56',
    'advice-prompt.js?v=56',
    'backup.js?v=56',
    'sync.js?v=56',
    'sync-status.js?v=56',
    'workout-system.js?v=56',
    'workout-pip.js?v=56',
    'workout-core.js?v=56',
    'workout-cardio.js?v=56',
    'workout-engine.js?v=56',
    'workout-state.js?v=56',
    'app-update.js?v=56',
    'toast.js?v=56',
    'weekly-summary.js?v=56',
    'onboarding.js?v=56',
    'swipe-actions.js?v=56',
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
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE).map(k => caches.delete(k))
        ))
    );
    self.clients.claim();
});

self.addEventListener('message', e => {
    if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
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
