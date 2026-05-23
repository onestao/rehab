# Agent Instructions

## Project Rules

- This is a static, local-first PWA. Do not introduce a backend or a bundler without an explicit decision.
- Runtime modules use IIFEs and attach adapters to `window`; pure modules may also export functions for Node tests.
- New browser-facing JS files must be added to `index.html` loading order and `sw.js` precache assets.
- CSS source lives in `css-src/`; after changing CSS, run `npm run build:css`.
- Any changes to sync, data persistence, workout timing, AI rendering, or Service Worker behavior must pass `npm run ci`.

## Safety Rules

- Treat all strings from `data.db`, user input, imported backups, and synced remote data as untrusted.
- Do not interpolate untrusted strings directly into `innerHTML` templates.
- Use `renderSafe.escapeHtml` or `data.escapeHtml` before placing untrusted strings into HTML or attributes.
- Prefer `textContent` for direct DOM text updates.
- Do not log, export, or sync raw credentials unless the existing credential path explicitly allows it.

## Module Shape

- Put domain calculations and schema decisions in pure or schema modules.
- Put DOM, browser APIs, prompts, speech, wake lock, fetch, and storage side effects in adapter modules.
- Keep facade modules small: they should orchestrate deeper modules, not own every detail.
- Avoid mechanical file splitting. Split only when the new module has a smaller interface and better locality.

## Verification

- Run `npm run build:css` after CSS edits.
- Run `node scripts/bump-version.js --check` after asset or script loading changes.
- Run `npm run ci` before considering implementation work complete.
