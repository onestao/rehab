const CACHE = 'training-assistant-v23';
const ASSETS = [
    'index.html',
    'build/generated.css?v=23',
    'theme.js?v=23',
    'fooddb.js?v=23',
    'ai.js?v=23',
    'data.js?v=23',
    'food-log.js?v=23',
    'advice-panel.js?v=23',
    'backup.js?v=23',
    'sync.js?v=23',
    'sync-status.js?v=23',
    'workout.js?v=23',
    'workout-engine.js?v=23',
    'workout-state.js?v=23',
    'app-update.js?v=23',
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
