const CACHE = 'training-assistant-v15';
const ASSETS = [
    'index.html',
    'styles.css',
    'theme.js',
    'fooddb.js',
    'ai.js',
    'data.js',
    'food-log.js',
    'advice-panel.js',
    'backup.js',
    'sync.js',
    'sync-status.js',
    'workout.js',
    'workout-engine.js',
    'workout-state.js',
    'app-update.js',
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
