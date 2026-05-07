const CACHE = 'training-assistant-v18';
const ASSETS = [
    'index.html',
    'styles.css',
    'build/generated.css',
    'css-src/01-vars.css',
    'css-src/02-base.css',
    'css-src/03-banner.css',
    'css-src/04-layout-appbar.css',
    'css-src/05-layout-chip.css',
    'css-src/06-layout-page.css',
    'css-src/07-layout-page-header.css',
    'css-src/08-components-cards.css',
    'css-src/09-workout-timer.css',
    'css-src/10-components-fields.css',
    'css-src/11-components-grid.css',
    'css-src/12-components-divider.css',
    'css-src/13-components-switch.css',
    'css-src/14-components-buttons.css',
    'css-src/15-components-lists.css',
    'css-src/16-history-hero-calendar.css',
    'css-src/17-record-tabs-health.css',
    'css-src/18-health-diet.css',
    'css-src/19-health-weightloss-ai.css',
    'css-src/20-settings-ai.css',
    'css-src/21-workout-rate.css',
    'css-src/22-workout-mode-tabs.css',
    'css-src/23-routines-tool.css',
    'css-src/24-routines-cards.css',
    'css-src/25-workout-cardio.css',
    'css-src/26-settings-sync.css',
    'css-src/27-layout-nav.css',
    'css-src/28-workout-fab.css',
    'css-src/29-workout-skip.css',
    'css-src/30-components-toast.css',
    'css-src/31-components-empty.css',
    'css-src/32-utilities-hidden.css',
    'css-src/33-workout-input-card.css',
    'css-src/34-settings-theme.css',
    'css-src/35-components-modal.css',
    'css-src/36-responsive.css',
    'css-src/37-dark-mode.css',
    'css-src/99-custom-overrides.css',
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
