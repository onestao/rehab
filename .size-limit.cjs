module.exports = [
  {
    name: 'first-paint-critical-js',
    path: [
      'toast.js',
      'theme.js',
      'error-bus.js',
      'i18n.js',
      'data-utils.js',
      'storage/idb.js',
      'storage/migrate.js',
      'data-store.js',
      'data-ui-state.js',
      'data-views.js',
      'data.js',
      'app-update.js',
      'sync-status.js',
      'm3e-ripple.js',
      'pwa-support.js',
      'haptics.js',
      'a11y-focus-trap.js',
      'fooddb.js',
      'render-safe.js',
      'nav-stack.js',
      'data-utils-pure.js',
      'data-records.js',
      'data-schema.js',
      'storage/idb-collections.js',
      'storage/idb-advice-collections.js',
      'credential-fields.js',
      'sheet-drag.js'
    ],
    limit: '60 KB'
  },
  { name: 'generated-css', path: 'build/generated.css', limit: '80 KB' },
  { name: 'workout-bundle', path: ['workout-*.js', 'strength-form.js', 'swipe-actions.js', 'weekly-plan.js'], limit: '50 KB' },
  { name: 'ai-bundle', path: ['ai-*.js', 'ai-*.mjs', 'advice-*.js', 'coach-context.js'], limit: '90 KB' },
  { name: 'plan-bundle', path: 'plan-*.js', limit: '60 KB' },
  {
    name: 'records-bundle',
    path: [
      'health-*.js',
      'food-log.js',
      'history-view.js',
      'weekly-summary.js',
      'goal-plan.js',
      'report-*.js',
      'pr-tracker.js',
      'volume-heatmap.js',
      'action-history.js'
    ],
    limit: '90 KB'
  },
  { name: 'routine-bundle', path: 'routine-*.js', limit: '25 KB' },
  { name: 'sync-bundle', path: ['backup.js', 'sync.js', 'sync-pure.js', 'sync-ui.js', 'sync-adapters.js'], limit: '30 KB' },
  { name: 'voice-bundle', path: 'voice-*.js', limit: '12 KB' },
  { name: 'device-bundle', path: 'mi-scale-*.js', limit: '8 KB' }
];
