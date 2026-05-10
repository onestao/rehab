const CACHE = 'training-assistant-v22';
const ASSETS = [
    'index.html',
    'build/generated.css?v=22',
    'theme.js?v=22',
    'fooddb.js?v=22',
    'ai.js?v=22',
    'data.js?v=22',
    'food-log.js?v=22',
    'advice-panel.js?v=22',
    'backup.js?v=22',
    'sync.js?v=22',
    'sync-status.js?v=22',
    'workout.js?v=22',
    'workout-engine.js?v=22',
    'workout-state.js?v=22',
    'app-update.js?v=22',
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
