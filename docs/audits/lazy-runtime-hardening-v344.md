# Lazy Runtime Hardening v345

**Branch:** `hardening/lazy-runtime-v344`
**Worktree:** `G:/LLM/rehab/.claude/worktrees/lazy-runtime-v344`
**Temp / evidence:** `G:/LLM/rehab/.tmp/lazy-runtime-v344/`
**Base:** `perfrom` / `e94fea70a71b73c83a1dc4e38670e975b204cbeb` (v343 freeze tip)
**Date:** 2026-07-20
**Push:** no
**Merge:** no

## Goal

Close remaining lazy-load anti-recurrence engineering items only:

| FIND | Status |
|---|---|
| FIND-11 method owner + refreshModules | **DONE** |
| FIND-12 data.init write barrier | **DONE** |
| FIND-14 real CI release gate | **DONE** |
| FIND-15 entry / `_loaded` seed sync | **DONE** |
| FIND-16 dependency closure validator | **DONE** |
| FIND-17 lifecycle leak verification | **DONE by verification** |

Out of scope (not implemented): full session restore, full offline rehab, product features.

v343 Today AI picker readiness (`ensureAiPickerRuntime` + diet/plan mounts) is preserved and re-verified.

## Baseline

| Check | Result |
|---|---|
| Worktree HEAD at start | `e94fea70a71b73c83a1dc4e38670e975b204cbeb` |
| Version | v343 → **v345** (production code + ready-state runtime keys; intermediate fingerprint was v344) |
| Path rule | All work under `G:/LLM/rehab` worktree/tmp only |

## FIND-11 — module owner + refreshModules

### Problem
Lazy record openers rewrote `data[method]` on every `refreshModules()` without stub identity. Real owner implementations could be clobbered; no machine-checkable registry.

### Fix
- `resolveRecordOpener` only trusts `window[owner][method]` (not first-paint `data-ui-state` stand-ins).
- Stubs tagged `__isLazyRecordOpenerStub` (mirrors plan gate `__isPlanFeatureGateStub`).
- Non-clobber attach: owner present → promote owner identity; existing stub kept; real never re-stubbed.
- `data.getMethodOwnerRegistry()` exposes method / owner / stub|real identity / runtimeStateKeys.

### Evidence
`npm run test:deps` → `test/method-owner-registry.test.mjs` (stub→real, multi-refresh, fail/retry, no re-stub).

## FIND-12 — data.init write barrier

### Problem
`data.save` / first-paint writers could run while `init()` was pending or after failure, risking empty-default DB overwrite.

### Fix
- `_readyState`: `pending | ready | failed`
- `ensureDataReady()`, `whenReady(action, options)`, `markDataReady()`, `markDataFailed()`
- `init()` marks ready/failed in try/catch
- `save()` blocks when pending (queues via `whenReady`) or failed (Chinese toast, no write)
- Single-flight per `busyKey`; route/nav generation cancel
- `dataStore.__runtimeStateKeys` preserves ready barrier across `refreshModules`

### Evidence
`test/data-ready-barrier.test.mjs` (double-click, success, failure, route change, no empty overwrite).
Lifecycle sample keeps `_readyState: ready` after 20 rounds.

## FIND-14 — CI release gate

### Fix
`.github/workflows/ci.yml`:
- triggers: PR + push `main`/`master`/`perfrom`/`opt/**`/`hardening/**`/`hotfix/**`
- `npm ci` → `npm run ci` → `npm run test:deps` → `npm run test:release`
- Playwright Chromium install on GHA; `AUDIT_CHANNEL=chromium`
- upload `.tmp/**` evidence artifacts; timeout 45m; fail hard on browser failure

## FIND-15 — entry / `_loaded` seed

### Problem
Sync `data-rehab-entry` listed shell modules (`m3e-ripple`…`app-route`, …) but `_loaded` seed omitted several, so loader could re-fetch already-executed scripts.

### Fix
`_loaded` seed aligned 1:1 with entry base names (20 modules).
Validator: `test/entry-loaded-seed.test.mjs`.

## FIND-16 — dependency closure

### Fix
- `npm run test:deps` (also part of `test:release` via unit `*.test.mjs` + explicit script)
- `test/deps-closure.test.mjs`: acyclic prereqs, file existence, Today ⊆ SW ASSETS, Today must not hard-include Profile AI chain, feature gate source contracts
- Reuses offline essential closure tests

## FIND-17 — lifecycle leak

### Approach
Dynamic verification first (no product rewrite).

### Test
`test/route-lifecycle-leak.browser.test.mjs`: 20 rounds Today/Records/Workout/AI/Profile + plan open/close; fail on TypeError or modal/scrim growth.

### Result
**DONE by verification** — pass, no growth, no TypeErrors.
Evidence: `G:/LLM/rehab/.tmp/lazy-runtime-v344/playwright/lifecycle/lifecycle-20-round.json`

## Files changed (product + gates)

| File | Role |
|---|---|
| `data.js` | Lazy record stub identity, resolveRecordOpener, getMethodOwnerRegistry |
| `data-store.js` | whenReady / ensureDataReady / save barrier / init ready state / runtimeStateKeys |
| `index.html` | `_loaded` seed sync (FIND-15); version pin via bump |
| `sw.js` / `app-update.js` / build icons | v345 bump |
| `package.json` | `test:deps`, `test:browser:lifecycle`, release includes lifecycle |
| `.github/workflows/ci.yml` | full release gate |
| `test/method-owner-registry.test.mjs` | FIND-11 |
| `test/data-ready-barrier.test.mjs` | FIND-12 |
| `test/entry-loaded-seed.test.mjs` | FIND-15 |
| `test/deps-closure.test.mjs` | FIND-16 |
| `test/route-lifecycle-leak.browser.test.mjs` | FIND-17 |
| version fixture tests + evidence script | v345 pins |

## Forced gates

| Gate | Result |
|---|---|
| `git diff --check` | clean (CRLF warnings only) |
| `node scripts/bump-version.js --check` | OK v345 |
| `npm run test:deps` | 25/0 |
| `npm run test:unit` | 739/0 (includes Today AI picker T1–T8) |
| `npm run test:browser:lifecycle` | 1/0 (20-round; readyState stays ready) |
| `npm run test:evidence:lazyload` | 10/0 |
| v343 AI picker regression | T1–T8 pass inside unit/browser suite |

## Commits on branch

1. `fix: protect writes until data initialization completes`
2. `refactor: make module ownership and loaded state deterministic`
3. `fix: align sync entry list with loader _loaded seed`
4. `test: validate dependency closure and lifecycle leaks`
5. `ci: enforce full release gate`
6. `chore: bump release assets to v344` (superseded by final pin)
7. `docs: close remaining lazy runtime findings`
8. Final `chore: bump release assets to v345` (fingerprint after ready-state keys)

## Final state

| Item | Value |
|---|---|
| Release | **v345** |
| FIND-11…17 | all **DONE** / **DONE by verification** |
| Push | **no** |
| Merge | **no** |
| v343 picker | not regressed |
