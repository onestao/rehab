module.exports = {
    extends: ['eslint:recommended'],
    parserOptions: { ecmaVersion: 2022, sourceType: 'script' },
    env: { browser: true, worker: true, es2022: true },
    ignorePatterns: [
        'build/**',
        'assets/**',
        '**/*.bak',
        'node_modules/**'
    ],
    rules: {
        // Repo is IIFE + window globals; keep rules pragmatic.
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        'no-undef': 'error',
        eqeqeq: 'off',
        'prefer-const': 'warn',
        'no-empty': ['warn', { allowEmptyCatch: true }],
        'no-redeclare': 'off',
        'no-useless-escape': 'off',
        'no-constant-condition': 'off'
    },
    overrides: [
        {
            files: ['*-pure.js', 'sync-pure.js', 'workout-*-pure.js', 'error-bus-pure.js'],
            parserOptions: { sourceType: 'module' },
            env: { node: true }
        },
        {
            files: ['scripts/**/*.{mjs,js}', 'test/**/*.mjs'],
            parserOptions: { sourceType: 'module' },
            env: { node: true }
        },
        {
            files: ['sw.js'],
            env: { serviceworker: true }
        },
        {
            files: ['**/*.js'],
            globals: {
                data: 'readonly', workout: 'readonly', sync: 'readonly', ai: 'readonly', theme: 'readonly', toast: 'readonly', cardio: 'readonly',
                errorBus: 'readonly', i18n: 'readonly', appUpdate: 'readonly', syncStatus: 'readonly', swipeActions: 'readonly', workoutState: 'readonly',
                workoutWakeLock: 'readonly', workoutMediaSession: 'readonly', advicePanel: 'readonly', focusTrap: 'readonly',
                ui: 'readonly', workoutEngine: 'readonly', onboarding: 'readonly', fooddb: 'readonly', adviceStreamRenderer: 'readonly'
            }
        }
    ]
};
