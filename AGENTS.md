# Agent Instructions

## Project Rules

- This is a static, local-first PWA. Do not introduce a backend or a bundler without an explicit decision.
- Runtime modules use IIFEs and attach adapters to `window`; pure modules may also export functions for Node tests.
- New browser-facing JS files must be added to `index.html` loading order and `sw.js` precache assets.
- CSS source lives in `css-src/`; after changing CSS, run `npm run build:css`.
- Any changes to sync, data persistence, workout timing, AI rendering, or Service Worker behavior must pass `npm run ci`.
- For user-reported bug fixes and cross-cutting AI/health data behavior changes, apply the same scoped change to both `ui-mockup` and `perfrom` when both worktrees are available, unless the user explicitly asks for one branch only. Prefer existing worktrees over switching branches.

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

## CSS Module Conventions

- One file per **domain**, not per "feature drawer". A new effect or page-level rule must live with the host module that owns the selectors it targets.
- File header comment must match the marker registered in `scripts/css-sections.mjs`. The header is what `scripts/build-css.mjs` and `scripts/check-css-section-markers.mjs` use to verify file identity.
- Numeric prefix groups (current convention):
  - `01..02` design tokens and reset.
  - `03..14` global components (app bar, page shell, cards, fields, buttons, switches, divider, lists).
  - `15..32` features and components (lists, history, records, diet, weightloss, settings AI, workout, routines, sync, nav, fab, skip, toast, empty, hidden util).
  - `33..36` layout / theme / responsive / modal.
  - `37` dark-mode (single source of truth for `[data-theme-mode="dark"]` and `prefers-color-scheme: dark` token overrides).
  - `38..49` page-level (record-page, workout-plan, a11y, m3e effects, health-profile, identity-card, theme-sheet, library-segment, advice-ai, view-transitions, advice-model-picker, action-history-weekly, plan, plan-ai).
  - `50..56` V6 UI design language and per-page V6 partials.
  - `57..59` domain extensions (weight-report, skeleton, global-training-bar).
  - `99` migration override queue.
- Dark mode policy:
  - `--md-sys-*` and `--glass-*` token overrides live ONLY in `37-dark-mode.css`.
  - Module files may carry `[data-theme-mode="dark"] .selector { ... }` blocks ONLY when they need non-token properties (e.g. `.hero` gradient swap).
- `@media` policy:
  - Keep responsive blocks alongside the base rules they override. Do not split a domain across two files just because of media queries.
  - Prefer 360 / 480 / 640 breakpoints. Adding a new breakpoint requires an ADR.
- `99-custom-overrides.css` policy:
  - Treat as a queue, not a stylesheet. Every rule block must be preceded by `/* TARGET: <host>.css */`. The CI gate `npm run check:99-targets` enforces this.
  - Empty out the queue every time a host module is touched: promote queued rules back into the host.

## Verification

- Run `npm run build:css` after CSS edits.
- Run `node scripts/bump-version.js --check` after asset or script loading changes.
- Run `npm run ci` before considering implementation work complete. `ci` covers:
  - `lint` (eslint), `typecheck` (tsc), `test` (`node --test test/*.test.mjs`).
  - `check:css` = `check:css-markers` + `check:css-sources` + `check:99-targets` + `check:css-overlap`. The overlap report is written to `build/css-overlap-report.txt` and CI fails when real conflicts exceed `CSS_REAL_CONFLICT_MAX` (default 220).
  - `check:html-safety` reviews `innerHTML` / `insertAdjacentHTML` sink counts so new HTML insertion points must be explicitly audited.
  - `size-limit` against `.size-limit.cjs`.
- Generated artefacts under `build/` are committed (`generated.css`, `css-dedup-report.txt`, `css-overlap-report.txt`, `icons.csv`, `icons.txt`).

## When extending CSS

- New page-level styling: add to the appropriate `5x-v6-*.css` partial or create one with the next free `5x` number.
- New design-language animation that applies broadly: extend `41-m3e-effects.css`. Selector-specific animation belongs in the host file.
- New module-specific override: edit the host file. If you cannot edit the host file in this branch, queue it in `99-custom-overrides.css` with a `TARGET:` comment.
- Always run `npm run check:css-overlap` after a CSS change. If real conflicts increase, justify the increase or fix it.
