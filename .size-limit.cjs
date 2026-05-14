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
      'onboarding.js'
    ],
    limit: '60 KB'
  },
  { name: 'generated-css', path: 'build/generated.css', limit: '80 KB' },
  { name: 'workout-bundle', path: 'workout-*.js', limit: '50 KB' },
  { name: 'ai-bundle', path: ['ai-*.js', 'advice-*.js'], limit: '50 KB' }
];
