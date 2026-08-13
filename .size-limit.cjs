module.exports = [
  {
    name: 'first-paint-critical-js',
    path: [
      'm3e-ripple.js',
      'toast.js',
      'error-bus.js',
      'i18n.js',
      'theme.js',
      'render-safe.js',
      'nav-stack.js',
      'app-route.js',
      'data-utils-pure.js',
      'action-taxonomy-pure.js',
      'action-identity.js',
      'data-utils.js',
      'storage/idb.js',
      'storage/migrate.js',
      'data-records.js',
      'data-schema.js',
      'data-store.js',
      'data-ui-core.js',
      'data-views.js',
      'data.js',
      'sync-status.js'
    ],
    limit: '52 KB'
  },
  { name: 'update-runtime', path: 'app-update.js', limit: '6 KB' },
  { name: 'page-ui-state', path: 'data-ui-state.js', limit: '9 KB' },
  {
    name: 'post-render-utilities',
    path: ['pwa-support.js', 'haptics.js', 'a11y-focus-trap.js', 'sheet-drag.js'],
    limit: '5 KB'
  },
  {
    name: 'deferred-storage',
    path: ['data-store-deferred.js', 'storage/idb-collections.js', 'storage/idb-advice-collections.js'],
    limit: '3.5 KB'
  },
  { name: 'food-database', path: 'fooddb.js', limit: '2 KB' },
  { name: 'search-bundle', path: ['search-*.js', 'search-*.mjs'], limit: '30 KB' },
  { name: 'profile-credentials', path: 'credential-fields.js', limit: '1.2 KB' },
  { name: 'generated-css', path: 'build/generated.css', limit: '80 KB' },
  { name: 'workout-bundle', path: ['workout-*.js', 'strength-form.js', 'swipe-actions.js', 'weekly-plan.js'], limit: '50 KB' },
  // Nested AI settings, model pickers and provider editors participate in the Android back stack.
  { name: 'ai-bundle', path: ['ai-*.js', 'ai-*.mjs', 'advice-*.js', 'coach-context.js', 'lib/virtual-core.umd.js', 'lib/flexsearch.light.js'], limit: '144.5 KB' },
  { name: 'rehab-policy', path: 'rehab-policy.js', limit: '12 KB' },
  { name: 'rehab-progression-pure', path: 'rehab-progression-pure.js', limit: '4 KB' },
  // Plan is intentionally tight; keep UI growth lazy and move parser/spec logic into exported pure modules.
  { name: 'plan-bundle', path: 'plan-*.js', limit: '72.5 KB' },
  { name: 'debug-bundle', path: 'debug-*.js', limit: '10 KB' },
  {
    name: 'records-bundle',
    path: [
      'health-*.js',
      'food-ai-normalizer-pure.js',
      'food-evidence-pure.mjs',
      'food-evidence.js',
      'food-log.js',
      'history-view.js',
      'today-view-core.js',
      'weekly-summary.js',
      'goal-plan.js',
      'report-*.js',
      'pr-tracker.js',
      'volume-heatmap.js',
      'action-history.js'
    ],
    // Includes evidence adapters plus history-aware summary/action sheets.
    limit: '94.2 KB'
  },
  {
    name: 'today-view-core',
    path: 'today-view-core.js',
    limit: '18 KB'
  },
  { name: 'routine-bundle', path: 'routine-*.js', limit: '25 KB' },
  { name: 'sync-bundle', path: ['backup.js', 'backup-import-pure.js', 'backup-ring-pure.js', 'sync.js', 'sync-pure.js', 'sync-ui.js', 'sync-adapters.js'], limit: '30 KB' },
  { name: 'voice-bundle', path: 'voice-*.js', limit: '12 KB' },
  { name: 'device-bundle', path: 'mi-scale-*.js', limit: '8 KB' }
];
