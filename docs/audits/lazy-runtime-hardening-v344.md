# Lazy Runtime Hardening v345 — Final Evidence & Freeze Candidate

**Branch:** `hardening/lazy-runtime-v344`
**Worktree:** `G:/LLM/rehab/.claude/worktrees/lazy-runtime-v344`
**Temp / evidence:** `G:/LLM/rehab/.tmp/lazy-runtime-v344/`
**Base:** `perfrom` / `e94fea70a71b73c83a1dc4e38670e975b204cbeb` (v343 freeze tip)
**Date:** 2026-07-20
**Push:** no
**Merge:** no
**Pin commit for final SHA:** no (explicit freeze protocol)

## Goal

Close remaining lazy-load anti-recurrence engineering items only:

| FIND | Status |
|---|---|
| FIND-11 method owner + refreshModules | **DONE** |
| FIND-12 data.init write barrier | **DONE** |
| FIND-14 real CI release gate | **DONE** |
| FIND-15 entry / `_loaded` seed sync | **DONE** |
| FIND-16 dependency closure validator | **DONE** |
| FIND-17 lifecycle leak verification | **DONE by verification** (instrumented real counts) |

Out of scope (not implemented): full session restore, full offline rehab, product features.

v343 Today AI picker readiness (`ensureAiPickerRuntime` + diet/plan mounts) is preserved and re-verified inside final browser gate.

## Baseline

| Check | Result |
|---|---|
| Worktree HEAD at freeze evidence | see **ACTUAL_FINAL_HEAD** below (includes FIND-17 instrumentation commit if present) |
| Version | **v345** |
| Path rule | All work under `G:/LLM/rehab` worktree/tmp only |
| Production code changed for FIND-17 re-verify | **no** (test instrumentation only; no real leak found) |

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
- triggers: PR + push `main`/`master`/`perfrom`/`opt/**`/`hardening/**`/`hotfix/**` + `workflow_dispatch`
- `npm ci` → `npm run ci` → `npm run test:deps` → `npm run test:release`
- Playwright Chromium install on GHA; `AUDIT_CHANNEL=chromium`
- upload `.tmp/**` evidence artifacts with `if: always()`; timeout 45m; no `continue-on-error`
- **No** bump / commit / push steps in CI

### Static validation (2026-07-20)
- YAML parse: **OK** (`yaml.safe_load`)
- `actionlint`: not installed (skipped)
- Checklist: `test:release`, `test:deps`, `if: always()`, Chromium channel, `npm ci`, hardening/perfrom triggers, no continue-on-error, no git push/commit, no bump-version, timeout 45 → **ALL_OK**

## FIND-15 — entry / `_loaded` seed

### Problem
Sync `data-rehab-entry` listed shell modules but `_loaded` seed omitted several, so loader could re-fetch already-executed scripts.

### Fix
`_loaded` seed aligned 1:1 with entry base names (20 modules).
Validator: `test/entry-loaded-seed.test.mjs`.

## FIND-16 — dependency closure

### Fix
- `npm run test:deps` (also part of `test:release` via unit `*.test.mjs` + explicit script)
- `test/deps-closure.test.mjs`: acyclic prereqs, file existence, Today ⊆ SW ASSETS, Today must not hard-include Profile AI chain, feature gate source contracts
- Reuses offline essential closure tests

## FIND-17 — lifecycle leak (instrumented)

### Approach
Dynamic verification first. **No production rewrite** — real leak not found.
Test-only probe installed via Playwright `addInitScript` before app scripts:

- window / document `addEventListener` / `removeEventListener` live counts
- `setTimeout` / `setInterval` / clear* live handle counts
- `MutationObserver` / `ResizeObserver` construct + `disconnect` alive counts
- route-owned: modals, scrims, navStack depth, `[data-page-bound]`
- checkpoint samples at rounds **0, 1, 5, 10, 20**
- leak criterion: **post-warm growth rounds 1→20** (cold 0→1 one-shot lazy PAGE_DEPS attach is classified persistent, not leak)

### Checkpoint table (instrumented, channel msedge)

| Round | window | document | timeouts | intervals | MO | RO | modals | scrims | readyState |
|------:|-------:|---------:|---------:|----------:|---:|---:|-------:|-------:|:----------|
| 0 | 37 | 21 | 6 | 2 | 2 | 0 | 15 | 0 | ready |
| 1 | 53 | 38 | 3 | 2 | 3 | 39 | 0 | 0 | ready |
| 5 | 53 | 38 | 2 | 2 | 3 | 39 | 0 | 0 | ready |
| 10 | 53 | 38 | 2 | 2 | 3 | 39 | 0 | 0 | ready |
| 20 | 53 | 38 | 2 | 2 | 3 | 39 | 0 | 0 | ready |

### Classification
- **Persistent (after first route load):** window/document listeners (+16/+13–17), ResizeObservers (+39), MutationObservers (+1) — flat after warm.
- **Route-owned disposable:** modals drop 15→0 after first plan open/close + force-clean; scrims 0; no growth 1→20.
- **Timers:** timeouts settle 6→2; intervals steady at 2; no post-warm growth.
- **TypeErrors:** none.
- **Production change required:** no.

### Evidence paths
- `G:/LLM/rehab/.tmp/lazy-runtime-v344/playwright/lifecycle/lifecycle-20-round.json`
- `G:/LLM/rehab/.tmp/lazy-runtime-v344/playwright/lifecycle/lifecycle-checkpoint-table.json`
- `test/route-lifecycle-leak.browser.test.mjs` (instrumented probe)

### Result
**DONE by verification** — post-warm growth = 0 for listeners/observers; no TypeErrors; readyState stays `ready`.

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
| `test/route-lifecycle-leak.browser.test.mjs` | FIND-17 (instrumented real counts) |
| version fixture tests + evidence script | v345 pins |

## Forced gates (final run 2026-07-20)

| Gate | Result | Detail |
|---|---|---|
| `git diff --check` | **pass** (exit 0) | CRLF warning only on lifecycle test |
| `node scripts/bump-version.js --check` | **pass** | version sync OK (**v345**) |
| `npm run test:deps` | **pass** | **26/0**, ~360ms |
| `npm run test:unit` | **pass** | **740/0**, ~56910ms; includes AI picker T1–T8 |
| `npm run test:browser:lazyload` | **pass** (via test:release) | **22/0**, ~52063ms; T1–T8 all pass |
| `npm run test:browser:lifecycle` | **pass** | **1/0**, ~31682–36085ms; instrumented; post-warm flat |
| `npm run test:evidence:lazyload` | **pass** | **10/0** (S1–S10) |
| **`npm run test:release`** | **pass** (exit 0) | unit 740/0 + browser:lazyload 22/0 + lifecycle 1/0 + evidence 10/0; log: `.tmp/lazy-runtime-v344/test-release-full.log` |
| v343 AI picker regression | **pass** | T1, T2, T3, T5, T6, T7, T8 all green in final browser:lazyload inside test:release |

## Commits on branch (`e94fea7..HEAD` + instrumentation)

1. `b6c338a` fix: protect writes until data initialization completes
2. `e820836` refactor: make module ownership and loaded state deterministic
3. `9cc053a` fix: align sync entry list with loader _loaded seed
4. `76b0f5c` test: validate dependency closure and lifecycle leaks
5. `f6efe58` ci: enforce full release gate
6. `8728add` chore: bump release assets to v344
7. `d31e455` docs: close remaining lazy runtime findings
8. `6ef5e38` chore: bump release assets to v345
9. (pending/included) test+docs: instrument FIND-17 real resource counts for freeze evidence

## Git freeze report (read-only)

| Item | Value |
|---|---|
| Worktree | `G:/LLM/rehab/.claude/worktrees/lazy-runtime-v344` |
| Branch | `hardening/lazy-runtime-v344` |
| Upstream | **none** (not pushed) |
| Base | `e94fea70a71b73c83a1dc4e38670e975b204cbeb` (= local `perfrom` = `origin/perfrom`) |
| Main repo current branch | `perfrom` @ `e94fea7` |
| `origin/main` / `main` | `207ed0da5d89bf6793c28f24c7269f662933f3d8` (not target of this freeze) |
| FF-only into `perfrom` | **yes** (`perfrom` is ancestor of hardening HEAD) |
| FF-only from `origin/perfrom` | **yes** |
| Pin commit for final SHA | **not created** (protocol) |
| Push | **no** |
| Merge | **no** |

> **Note:** After the FIND-17 instrumentation commit lands, `ACTUAL_FINAL_HEAD` is that commit’s SHA. Prior product HEAD remains `6ef5e38` (v345 assets). Instrumentation is **test + docs only** — no production fingerprint change, version stays **v345**.

## Final state

| Item | Value |
|---|---|
| Release | **v345** |
| FIND-11…17 | all **DONE** / **DONE by verification** |
| FIND-17 evidence mode | **instrumented** (not probe-or-zero) |
| Real leak found | **no** → production code **unchanged** for FIND-17 |
| Push | **no** |
| Merge | **no** |
| v343 picker | not regressed (T1–T8 in final test:release) |
| Candidate freeze | **eligible** for later FF into `perfrom` after explicit approval |
