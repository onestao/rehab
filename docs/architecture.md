# Architecture

## Runtime Shape

- `index.html` is the app shell, static markup owner, and lazy script loader.
- `data.js` is the app-state facade assembled from feature modules.
- `data-store.js` owns storage adapter selection, load/init, save, flush, and persistence hooks.
- `data-records.js` owns common record metadata behavior.
- `data-schema.js` owns DB normalization and schema defaults.
- `sync.js` owns sync workflow orchestration: push, pull, merge, retry queue, and conflict handling.
- `sync-ui.js` owns sync settings/status DOM interaction.
- `sync-adapters.js` owns S3 and WebDAV transport details.
- `workout-cardio-pure.js` owns cardio domain calculations and history record construction.
- `workout-cardio.js` adapts cardio logic to DOM, speech, timers, wake lock, media session, and persistence.
- `advice-template-manager.js` owns AI prompt template CRUD/import/export UI behavior.
- `advice-panel.js` owns AI coach chat orchestration and delegates template management.
- `render-safe.js` owns shared HTML escaping.

## Pure Versus Adapter

Pure modules should accept plain inputs and return values without touching DOM, storage, network, timers, or browser APIs. Adapter modules may read DOM, call `fetch`, speak, save data, show dialogs, and interact with PWA APIs.

## Loading Rules

New script files need three updates:

- Add direct boot scripts or lazy dependencies in `index.html`.
- Add the asset to `sw.js` so the PWA cache contains it.
- Add globals in `globals.d.ts` if attached to `window`.

## Testing Rules

Pure modules should have Node tests under `test/`. Browser adapters are currently verified by lint, typecheck, and smoke testing.
