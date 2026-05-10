const CACHE = 'training-assistant-v24';
const ASSETS = [
    'index.html',
    'build/generated.css?v=24',
    'theme.js?v=24',
    'fooddb.js?v=24',
    'ai.js?v=24',
    'data.js?v=24',
    'food-log.js?v=24',
    'advice-panel.js?v=24',
    'backup.js?v=24',
    'sync.js?v=24',
    'sync-status.js?v=24',
    'workout.js?v=24',
    'workout-engine.js?v=24',
    'workout-state.js?v=24',
    'app-update.js?v=24',
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
