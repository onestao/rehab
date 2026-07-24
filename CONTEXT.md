# Project Context

## Product

Training Assistant is a local-first web training timer and health log. It supports strength workout plans, cardio sessions, records, routine libraries, diet and weight tracking, AI coaching, cloud backup, and PWA offline caching.

## Domain Terms

- Action: a reusable movement in the current plan or action library. Only the `training` category uses strength-style sets/reps fields; cardio, stretch, and other categories remain distinct.
- Routine: a saved workout plan containing ordered actions.
- History Record: a completed workout or cardio session saved into `data.db.history`.
- Cardio Session: a timed aerobic workout with MET-based calorie estimation.
- Health Log: weight, food, and exercise entries stored under `data.db.health`.
- AI Advice: AI coach chat messages and versioned assistant responses.
- Sync Snapshot: full remote database snapshot.
- Incremental Sync: per-entity changes stored in time-windowed remote files.
- Record Meta: common entity metadata: `id`, `updatedAt`, `deleted`, and optional `__fieldUpdatedAt`.

## Architecture Constraints

- The app is deployed as static files and runs directly in the browser.
- Runtime modules are loaded by `index.html` and usually attach to `window`.
- Pure modules can be imported by Node tests and should also attach a browser adapter to `window` when used at runtime.
- `data.js` is the current app-state facade. Feature modules attach behavior to it through `Object.assign`.
- CSS source files in `css-src/` are concatenated into `build/generated.css` by `scripts/build-css.mjs`.
- `sw.js` precaches versioned assets; script additions must be reflected there.
- Shared AI JSON contract helpers live in `ai-json-pure.mjs` and attach as `window.aiJsonPure` (candidate extraction, shape checks, completion/block classification, safe diagnostics). `ai-api.js` owns request orchestration and `runJson` two-attempt retry only.

## Safety Invariants

- User-entered names, notes, tags, AI prompts, imported backups, and synced remote records are untrusted.
- Rendering untrusted strings must go through `renderSafe.escapeHtml` or `data.escapeHtml`.
- Credential fields are local-device secrets. Raw AI keys, S3 secrets, and WebDAV passwords must not be accidentally written into ordinary sync payloads.
- Data loss prevention lives around `data-schema`, `data-records`, `backup`, and `sync`.

## Preferred Change Pattern

- Add or extend pure logic first.
- Add browser adapters second.
- Keep facade modules compatible with existing `window` callers.
- Update `index.html`, `sw.js`, globals, tests, and docs in the same change when a new module is introduced.
