# ADR 0001: Split V6 styles by domain into 51..56 partials

Date: 2026-05-27
Status: Accepted

## Context

`css-src/50-v6-ui.css` grew to 43 KB / 644 lines, mixing nine
concerns under a single "V6 UI" file: glass tokens, today-page hero
and rings, workout timer panel, records tabs and tiles, AI coach
hero / messages / composer, profile hero / settings, bottom nav,
keyframes, and the reduced-motion fallback.

Around the same time:

- `css-src/49-plan.css` reached 38 KB / 1611 lines covering plan
  hero, type tabs, current actions, weekly list, task drawer,
  equipment sheet, AI preview sheet, feedback sheet, cooldown
  toast and workout banner.
- `css-src/18-health-diet.css` reached 39 KB / 1188 lines, of
  which 172 selectors were `.advice-*` (AI coach chat) instead
  of diet/food.
- `css-src/20-settings-ai.css` mixed AI provider configuration
  (170 lines) with weight chart / report (411 lines).
- `css-src/41-m3e-effects.css` was a "miscellaneous effects"
  drawer with skeleton shimmer, global training bar, list-item
  swipe, today-focus pulse, advice quick-prompts snap mixed in.
- `css-src/99-custom-overrides.css` carried `.history-month-*`
  and `.weight-history-*` rules that were already fully present
  in `15-components-lists.css` (pure duplication).

The branch had drifted: instead of editing the existing host
modules, every V6 iteration appended to `50-v6-ui.css` /
`49-plan.css` / `18-health-diet.css`, producing implicit overrides
that depended on file load order in `scripts/css-sections.mjs`.

## Decision

Split each oversized file along **domain boundaries** rather than
mechanical line counts. Concretely:

- `50-v6-ui.css` keeps only the glass design language (safety
  nets `min-width: 0`, `overflow-wrap`, `text-overflow`,
  `.glass-card`, `.sect-head`, `.md-icon-btn-bar`) and the
  M3 keyframes plus reduced-motion fallback.
- Page-level V6 styles split into `51-v6-today.css`,
  `52-v6-workout.css`, `53-v6-records.css`, `54-v6-ai.css`,
  `55-v6-profile.css`, `56-v6-nav.css`.
- `49-plan.css` keeps core plan UI plus all `@media` blocks
  (so responsive cascade stays in one file). AI / weekly /
  feedback / cooldown sections move to `49-plan-ai.css`.
- `18-health-diet.css` keeps diet and food only. Advice / AI
  coach moves to `46-advice-ai.css`.
- `20-settings-ai.css` keeps AI provider configuration and
  password visibility. Weight chart / report moves to
  `57-weight-report.css`.
- `41-m3e-effects.css` keeps design-language keyframes and the
  TASK-20 theme transition envelope. Skeleton goes to
  `58-skeleton.css`. Global training bar goes to
  `59-global-training-bar.css`. Selector-specific effects
  (today-focus pulse, advice quick-prompts snap, swipe-open
  delete reveals, weekly summary rise) move to their host
  modules.
- `99-custom-overrides.css` is repurposed as a queue: any rule
  added there must carry `/* TARGET: <host>.css */` so it can
  be promoted back into its host file.
- Dark `--glass-*` tokens move from `50-v6-ui.css` to
  `37-dark-mode.css` so all dark token overrides live in one
  place.

## Verification

The split is enforced by:

- `scripts/check-css-section-markers.mjs` — every CSS source
  file must start with the marker registered in
  `scripts/css-sections.mjs` (catches drift between file head
  and snapshot rebuild markers).
- `scripts/css-overlap-report.mjs` — property-level overlap
  classifier with three buckets: real conflicts (same property,
  different values), duplicates (same property, same value),
  complements (disjoint properties on the same selector).
  CI fails when real conflicts exceed `CSS_REAL_CONFLICT_MAX`
  (default 220, current count 209).
- `scripts/check-99-targets.mjs` — every rule block in
  `99-custom-overrides.css` must be preceded by a
  `/* TARGET: <host>.css */` comment.
- `npm run ci` runs lint + typecheck + test + `check:css` +
  size-limit.

## Consequences

Positive:

- Largest CSS source file is now 28 KB (`49-plan.css`) versus
  43 KB before.
- Each new V6 page partial is < 17 KB and owns a single page.
- Host modules keep responsibility for their `@media` rules and
  swipe-open / hover behaviour, removing the "effects drawer"
  anti-pattern.
- `npm run ci` flags any new property-level conflict before it
  reaches `main`.
- Dark-mode token policy is documented and enforced: tokens
  live only in `37-dark-mode.css`; module files may carry
  `[data-theme-mode="dark"]` only when they need additional
  non-token properties (e.g. `.hero` gradient swap).

Negative:

- Source file count grew from 51 to 61. Mitigated by the marker
  check and by section-aware tooling already understanding the
  ordered list.
- The 209-conflict baseline includes `:root` light-vs-dark token
  pairs that look like conflicts to the analyser but are
  intentional. Future scripts may want to ignore `:root` or
  emit a separate "expected" bucket.

## References

- `scripts/css-sections.mjs` — ordered file list with section markers.
- `scripts/build-css.mjs` — concatenates with `@layer` wrapping.
- `AGENTS.md` — agent-facing guardrails for CSS edits.
- Prior bundles: `git log --oneline rebuild..ui-mockup` (3 commits
  introducing `50-v6-ui.css`).
