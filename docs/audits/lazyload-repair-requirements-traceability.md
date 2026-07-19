# Lazyload Rehab Repair — Requirements Traceability Matrix

**Branch:** `fix/lazyload-repair-closeout-v336` (closeout) · prior matrix on `integration/lazyload-rehab-repair`  
**Worktree:** `G:/LLM/rehab/.claude/worktrees/lazy-closeout`  
**Baseline:** `0fa29d9` / `perfrom` / v335  
**Pre-closeout matrix freeze:** `fc83ab8`  
**Release:** **v342** / `training-assistant-v342`  
**Date:** 2026-07-20  
**Scope:** closeout implementation + re-verified gates (see `docs/audits/lazyload-repair-closeout-final.md`). No push / no merge until user approves.

### Sources

| Source | Path |
|--------|------|
| Repair plan | `D:/Download/GROK45-PWA-LAZYLOAD-REHAB-REPAIR-PLAN.md` |
| Audit final | `G:/LLM/rehab/.tmp/lazyload-audit/FINAL-REPORT.md` |
| Extra 5 | `G:/LLM/rehab/.tmp/lazyload-audit/EXTRA-5-FINDINGS.md` |
| Final validation | `docs/audits/lazyload-repair-final-validation.md` |
| Evidence | `G:/LLM/rehab/.tmp/lazyload-repair/evidence/summary.json` |
| Gates | `G:/LLM/rehab/.tmp/lazyload-repair/gates/` |
| Shared state | `G:/LLM/rehab/.tmp/lazyload-repair/shared/` |

### Status vocabulary (only these)

| Status | Meaning |
|--------|---------|
| **DONE** | Requirement implemented **and** covered by matching assertions that were actually run (not “file exists”). |
| **PARTIAL** | Meaningful implementation or partial proof; at least one contract clause still open or under-asserted. |
| **NOT DONE** | No production fix and/or no meaningful assertion for the stated contract. |
| **NOT APPLICABLE** | Explicitly out of scope, downgraded by audit, or superseded. |
| **DEFERRED WITH ACCEPTED RISK** | Known gap; intentional postpone with residual risk documented. |
| **UNVERIFIED** | Code/docs claim exists, but this audit did not re-run or could not confirm the exact assertion. |

### Evidence levels

| Level | Definition |
|-------|------------|
| **E3** | Real browser (Playwright/msedge) + local HTTP, optionally SW; scenario logs under `.tmp/lazyload-repair/`. |
| **E2** | Node / `node:test` / vm integration with behavioral asserts. |
| **E1** | Static source-contract regex / structural assert only. |
| **E0** | Report / commit message / design intent only — **not** sufficient for DONE. |

**Rule used here:** “test file exists” ≠ DONE. DONE requires a named assert that matches the requirement text.

### Freeze note

- Pre-closeout matrix freeze: clean at `fc83ab8` (v336 era).
- Closeout branch: `fix/lazyload-repair-closeout-v336` · worktree `lazy-closeout` · production fingerprint **v342**.
- Closeout gates re-run: unit **708**, formal browser lazyload **14**, evidence **10/10**, version check OK.
- Authoritative closeout report: `docs/audits/lazyload-repair-closeout-final.md`.

---

## 1. Executive judgment

| Question | Answer |
|----------|--------|
| Core FIND-01–06 product failures (plan first-click, deep-link shell/navStack app-back, cancelled nav side effects, Today history-view precache, plan fail toast, basic update defer) | **DONE** with E2–E3 (inherited + re-verified at closeout) |
| Closeout residual blockers (FIND-07 hard openers, B-T4 progressive back, H3 a11y E3, H5 journal restore, architecture/PWA docs, formal release scripts) | **DONE** — see closeout-final |
| Full offline rehab / FIND-11–16 hygiene / CI default `test:release` | **Scheme B + DEFERRED WITH ACCEPTED RISK** — not release blockers |
| Forbidden “fixes” (full sync load, `?.` silence for plan openers, SW off as product fix, bloat all pages into ASSETS) | **Not used** |
| Recommend merge to `perfrom` as-is? | **Yes for closeout candidate after user review** of closeout-final + residual deferred list |
| Expand fixes now? | **No** — closeout complete; stop for approval (no push / no merge). |

---

## 2. Product contracts (Plan §1.1–1.5)

| ID | Requirement | Status | Evidence | Notes |
|----|-------------|--------|----------|-------|
| P-1.1 | First visible click completes intent or loading→auto-continue; no second click; no silent `?.`; no raw tech error to user | **DONE** | E3: A-T1–T3, H1-T1–T3, S1/S2; E2: plan-feature-gate unit | Plan openers + FIND-07 weekly/AI hard buttons non-silent. |
| P-1.2 | Active training state independent of DOM/route/SW update; must not be reset unintentionally | **DONE** (core path) | E2: C unit + E-T* + H5; E3: S4/S6/S7 | Cancelled nav does not force workout mode; update defer + journal freeze. |
| P-1.3 | Minimal offline rehab loop: view Today plan, start/pause/complete, local pain/symptom, back/close; online features degrade clearly | **Scheme B DONE** | E1/E2: D-T1–T3; E3: S5; offline contract | Essential Today ⊆ ASSETS. Full offline rehab **not** claimed. |
| P-1.4 | No force-navigate mid dangerous moment; save → mark pending → safe apply → **restore recoverable training state** | **DONE** (closeout journal) | E2: E-T* + H5-T1–T4; E3: S6/S7/S9 | Defer + `saveJournal` freeze + `restoreIfNeeded` path. |
| P-1.5 | a11y core not deferred utility: focus trap, Escape/system close, focus restore, close control, keyboard, busy/error a11y | **DONE** (closeout trap E3) | E2: F-T1–T4; E3: H3-T1/T2 | Delayed trap still Tab-cycles; Escape + head close button. |

---

## 3. FIND-01 … FIND-17

| ID | Severity (audit) | Status | Production touch | Assertions that actually match | Evidence | Residual |
|----|------------------|--------|------------------|--------------------------------|----------|----------|
| **FIND-01** Plan first-click TypeError | P1 | **DONE** | `data.js` planFeatureGate + LAZY_PLAN_OPENERS stubs; attach on load | A-T1: delay plan-ui, real click, 0 TypeError, 1 modal; A-T2: 5 intents → 1 modal, gate=ready, planUiHits 1–2; unit first-open/replay/single-flight | E3+E2 | Drawer/continue-train paths share openers list; not each button click-tested in browser. |
| **FIND-02** Deep-link paints Today first | P1 | **DONE** | `index.html` earlyDeepLinkShell; boot parse→shell→ensureDeps(initial)→side effects→init→applyCurrent | B-T1: no Today flash after profile shell; S3 active=profile | E3 | Sub-ms first paint of default HTML class before early script still possible in theory; assert samples post-shell. |
| **FIND-03** navStack / back broken | P1 | **DONE** (closeout app progressive back) | nav-stack browser/pwa mode; history state; popstate closes modal | B-T2/B-T3/B-T4 E3 (`history.back` closes modal then leaves tab); H2-T2 PWA root | E3 | Leaving SPA to about:blank still browser-owned; not claimed fixed. |
| **FIND-04** Cancelled nav runs side effects | P1 | **DONE** | `ensureDeps` pure; `activatePageSideEffects` after token | C-T1 unit + browser: setMode/swipe/workoutStateInit = 0 on cancelled workout; S4 | E3+E2 | Module warm may remain (allowed). |
| **FIND-05** SW ASSETS vs PAGE_DEPS | P1 | **Scheme B DONE** | essential Today ASSETS (history-view + today closure) | D-T1–T3; S5 offline fetch 200 | E3+E2+E1 | Full offline rehab **not** claimed. |
| **FIND-06** Enhancement fail UX | P1 | **DONE** | Gate fail → Chinese toast; busy clear; retry | A-T3 toast regex + recover modal; unit fail toast | E3+E2 | Enhancement idle path itself not separately toast-tested; user-intent path covers failure UX. |
| **FIND-07** `?.` silent plan/AI/weekly | P2 | **DONE** (closeout) | `today-view-core` hard buttons; `data.openPlanWeeklySheet` non-silent load | H1-T1–T3 E3; FIND-07 unit E2 | E3+E2 | See closeout-final. |
| **FIND-08** Subroute write before token | P2 | **DONE** (closeout) | staged subroutes commit after activate token | FIND-08 unit + app-route cancelled nav | E2 | |
| **FIND-09** Modal survives tab change | P2 | **DONE** (closeout) | `appRoute.apply` closes route-bound modal | B-T4 E3 modal closed on back/tab path | E3 | |
| **FIND-10** a11y/haptics delayed | P2 | **DONE** (trap path closeout) | a11y-focus-trap force-reload + `_openModal` await; ASSETS | F-T1–T4; H3-T1/T2 E3 | E3+E2 | Haptics/sheet-drag remain idle (accepted). |
| **FIND-11** LAZY_RECORD_OPENERS overwrite | P2 | **DEFERRED WITH ACCEPTED RISK** | not targeted in A–F core | pre-existing diet path tests exist elsewhere; not this repair’s gate | — | Phase G hygiene. |
| **FIND-12** Interact before data.init | P2 | **DEFERRED WITH ACCEPTED RISK** | early shell only; no init-before-click shield | none new | — | Audit residual. |
| **FIND-13** Leave Today cancels enhancement | P2 | **PARTIAL** | Gate cancels cross-route open; enhancement schedule still today-gated | unit: leave Today no modal | E2 | Enhancement abandon still exists by design. |
| **FIND-14** Tests bypass real boot | P3 | **PARTIAL** | formal `test:browser:lazyload` + `test:evidence:lazyload` + `test:release` | A/B/C/H1/H2/H3 browser + S1–S10 | E3 | Scripts exist; default `npm test` still unit-only unless CI uses `test:release`. |
| **FIND-15** `_loaded` seed incomplete | P3 | **DEFERRED WITH ACCEPTED RISK** | phase G | none | — | |
| **FIND-16** Incomplete prereq graph | P3 | **DEFERRED WITH ACCEPTED RISK** | phase G | none | — | |
| **FIND-17** Listener guard flags | P3 | **NOT APPLICABLE** (as fix) / **DEFERRED** | V4 did not prove leak; not fixed this round | V4 historical only | E0 | Keep as static risk. |

---

## 4. EXTRA V1–V5

| ID | Audit conclusion | Status after repair | Evidence | Notes |
|----|------------------|---------------------|----------|-------|
| **V1** Deep-link real back | User-level fault | **DONE** (app progressive back) | B-T3 requestClose E3; B-T4 `history.back` closes modal then leaves tab | Leaving SPA to about:blank still browser-owned. |
| **V2** Fresh cold offline | Structural gap | **Scheme B DONE** | history-view in ASSETS; S5; D-T*; offline contract | Today essential only; non-Today offline warm-dependent (**accepted**). |
| **V3** plan-ui 404 | TypeError + weak toast | **DONE** | A-T3, S2 | Chinese fail copy + retry. |
| **V4** Listener loops | No growth | **NOT APPLICABLE** | S10 open/close residual modals/TypeError only | Not a fix target; S10 ≠ CDP listener delta. |
| **V5** Multi-tab SW upgrade | Force sibling navigate; mid-boot shell | **DONE** (defer + journal freeze) | S6 dual-tab defer; E-T SW order; H5 journal; upgrade overlay | Training tab defers; idle applies; journal frozen before apply. |

---

## 5. Phase A–G (task book)

### Phase A — Plan Feature Gate

| Item | Status | Asserts |
|------|--------|---------|
| A-T1 first click delayed plan-ui | **DONE** | browser A-T1 + S1 |
| A-T2 five rapid clicks single flight | **DONE** | browser A-T2 (gate=ready, 1 modal, hits≤2) |
| A-T3 404 toast + retry | **DONE** | browser A-T3 + unit + S2 |
| A-T4 leave Today intent cancel | **DONE** (unit) / **PARTIAL** (no dedicated browser A-T4) | unit “does not open after leaving Today” |
| Feature gate states unloaded/loading/ready/failed | **DONE** | unit + browser |
| ensureReady: load + refresh + method real | **DONE** | unit replaces stub; gate ready |
| Chinese fail copy | **DONE** | toast regex |
| No full plan-ui sync into first paint | **DONE** | still lazy enhancement |

### Phase B — Deep-link / navStack / back

| Item | Status | Asserts |
|------|--------|---------|
| B-T1 no Today active flash | **DONE** | browser B-T1 |
| B-T2 hash/DOM/stack/subroute | **DONE** | browser B-T2 |
| B-T3 requestClose path | **DONE** | browser B-T3 |
| B-T4 browser/system back | **DONE** (closeout progressive) | browser B-T4 `page.goBack` closes modal then leaves tab |
| Single navigation transaction boot | **DONE** | code + B suite |
| Modal-first close policy on back | **DONE** (closeout) | popstate closes modal first; route apply closes route-bound modal |

### Phase C — ensureDeps vs side effects

| Item | Status | Asserts |
|------|--------|---------|
| ensureDeps pure (no setMode/swipe/init) | **DONE** | E1 source + C unit |
| Side effects after token | **DONE** | E1 order + C-T1 browser |
| C-T1 rapid Today→Workout→Records→Today | **DONE** | browser + S4 |

### Phase D — Offline essential

| Item | Status | Asserts |
|------|--------|---------|
| history-view in ASSETS | **DONE** | D-T1, S5 |
| Today PAGE_DEPS closure ⊆ ASSETS | **DONE** | D-T1 |
| Not bloat all lazy pages | **DONE** | D-T3 advice-panel false |
| Document offline contract file | **DONE** (closeout) | `docs/pwa/offline-capability-contract.md` Scheme B |
| Offline start/pause/complete training | **DEFERRED WITH ACCEPTED RISK** | Scheme B does not claim full offline rehab loop |

### Phase E — Update session safety

| Item | Status | Asserts |
|------|--------|---------|
| Defer when isPlaying | **DONE** | E-T1 |
| Defer when paused / draft / pending / phase | **DONE** | E-T5–T7, S7 |
| Idle still SKIP_WAITING | **DONE** | E-T2/E-T8, S6 A |
| Dual-tab: idle apply, training defer | **DONE** | S6 |
| SW skip hard navigate when deferred | **DONE** | E1 order + S9 indices |
| UPDATE_SESSION_CLEAR on end | **DONE** (code + E1) | armSessionClearWatcher; interval unref for tests |
| Upgrade overlay / early barrier | **DONE** | E-T4 + index guards v342 |
| Pre-update local save orchestration | **DONE** (closeout) | `showUpdateDeferredForSession` → `saveJournal({ deferredForUpdate: true })` |
| Post-upgrade training restore | **DONE** (closeout journal path) | `workoutState.restoreIfNeeded` + H5-T* |
| Doc `docs/pwa/update-session-safety.md` | **DONE** (closeout) | present |

### Phase F — Modal / a11y

| Item | Status | Asserts |
|------|--------|---------|
| focus trap not only +2s idle | **DONE** | F-T1 immediate loadScript |
| open path ensure trap | **DONE** | F-T2 await-before-append + force reload |
| trap in ASSETS | **DONE** | F-T3 v342 |
| Escape closes modal | **DONE** (closeout) | H3-T2 Escape + head close button E3 |
| Focus restore to trigger | **PARTIAL** | trap restores; not every open path E3-asserted |
| Keyboard Tab trap cycle | **DONE** (closeout) | H3-T1 delayed trap still Tab-cycles E3 |
| Busy/error AT announcement | **DEFERRED WITH ACCEPTED RISK** | not E3 this round |
| plan drawer navStack/trap parity | **PARTIAL** | drawer uses openers; full drawer lifecycle not E3 |

### Phase G — Hygiene

| Item | Status |
|------|--------|
| FIND-11 openers rewrite pattern | **DEFERRED WITH ACCEPTED RISK** |
| FIND-15/16 seed/prereq | **DEFERRED WITH ACCEPTED RISK** |
| FIND-17 listener guards | **DEFERRED WITH ACCEPTED RISK** |
| Single AI init path | **DEFERRED WITH ACCEPTED RISK** |

### Phase 0 / deliverables (Plan §3)

| Deliverable | Status | Evidence |
|-------------|--------|----------|
| Batched production fixes | **DONE** | integration A–F + closeout H1–H5 production |
| Per-batch fail→pass tests | **DONE** (closeout gates) | unit 708; browser 14; evidence 10/10 |
| Non-skippable Playwright release gate | **PARTIAL** | `test:browser:lazyload` + `test:release` exist; default `npm test` unit-only |
| `docs/architecture/lazy-feature-readiness.md` | **DONE** (closeout) | present |
| `docs/architecture/navigation-lifecycle.md` | **DONE** (closeout) | present |
| `docs/pwa/offline-capability-contract.md` | **DONE** (closeout) | Scheme B |
| `docs/pwa/update-session-safety.md` | **DONE** (closeout) | present |
| `docs/audits/lazyload-repair-final-validation.md` | **DONE** | present; closeout supersession to v342 |
| `docs/audits/lazyload-repair-closeout-final.md` | **DONE** | closeout report |
| Change list / risk / rollback | **DONE** (closeout residual risks) | closeout-final §5–§6 |
| Unresolved risk list | **DONE** | deferred hygiene + Scheme B + FIND-14 |
| Version bump after production change | **DONE** | **v342**; bump-version --check OK |

---

## 6. Gap classification

### 6.1 Former release blockers — **closed in closeout**

| Gap | Closeout resolution |
|-----|---------------------|
| Architecture + PWA contract docs | Written under `docs/architecture/*` + `docs/pwa/*` |
| P-1.4 post-upgrade session restore | Journal + `restoreIfNeeded` + defer freeze |
| B-T4 progressive browser back | B-T4 E3 + nav-stack modes |
| FIND-07 silent `?.` weekly/AI | Non-silent openers + H1-T* |
| a11y Tab/Escape E3 | H3-T1/T2 |
| Full offline training loop | **Not claimed** — Scheme B only (accepted) |

### 6.2 Acceptable deferred risks (closeout candidate)

| Gap | Why deferrable |
|-----|----------------|
| Workout/AI full precache | Explicitly avoided bloat (D-T3); Scheme B |
| Phase G FIND-11/15/16/17 | Hygiene; not TypeError-class blockers |
| FIND-12 init-before-click | Pre-existing residual |
| Playwright not default `npm test` | `test:release` / `test:browser:lazyload` formal; CI wiring residual (FIND-14) |
| Busy/error AT announcement | Deferred; trap/Tab/Escape covered |
| Full offline start→pause→complete E3 | Outside Scheme B |

### 6.3 Not applicable / closed by design

| Item | Note |
|------|------|
| FIND-17 as P1 | V4 downgraded |
| Disable SW as fix | Not used |
| Re-sync all modules | Not used |
| Hide plan openers with `?.` | Removed on Today weekly/AI hard buttons + gated openers |

---

## 7. Evidence index (what was actually asserted)

### 7.1 Browser formal tests (E3)

| Suite | Tests | Pass claim (closeout) |
|-------|-------|--------------------|
| `test/plan-feature-gate.browser.test.mjs` | A-T1–T3, H1-T1–T3 | yes (14-suite formal) |
| `test/deep-link-nav.browser.test.mjs` | B-T1–T4, H2-T2 | yes |
| `test/ensure-deps-side-effects.browser.test.mjs` | C-T1 | yes |
| `test/modal-a11y.browser.test.mjs` | H3-T1, H3-T2 | yes |

### 7.2 Node / contract (E1–E2)

| Suite | Coverage |
|-------|----------|
| `test/plan-feature-gate.test.mjs` | stubs, replay, single-flight, fail toast, leave Today, source wiring |
| `test/ensure-deps-side-effects.test.mjs` | pure ensureDeps, token order, unit cancel |
| `test/offline-essential-closure.test.mjs` | D-T1–T3 |
| `test/app-update-session-safety.test.mjs` | E-T1–T8 + SW order |
| `test/a11y-focus-trap-ready.test.mjs` | F-T1–T4 |
| `test/session-journal.test.mjs` | H5-T* |
| `test/nav-stack-lifecycle.test.mjs` | nav modes / popstate |
| Version suites retargeted to **342** | controller-reload, SW version gate/fetch |

### 7.3 Pre-merge evidence harness (E3, msedge)

| ID | Result in `summary.json` | Maps to |
|----|--------------------------|---------|
| S1 | ok | FIND-01 / A-T1 |
| S2 | ok | FIND-06 / A-T3 |
| S3 | ok | FIND-02 |
| S4 | ok | FIND-04 |
| S5 | ok | FIND-05 Today scripts |
| S6 | ok | V5 dual-tab defer |
| S7 | ok | E expanded predicates |
| S8 | ok | FIND-10 load path (H3 covers Tab/Escape E3) |
| S9 | ok | SW defer before navigate |
| S10 | ok | residual open/close stability |

### 7.4 Claims that must **not** be over-read

| Claim | Correct reading |
|-------|-----------------|
| “S5 offline Today” | Script fetch 200 for essential Today — **not** full offline rehab |
| “Scheme B DONE” | Essential Today only; non-Today may degrade with toast |
| “default npm test” | Unit only unless `test:release` / browser scripts run |

---

## 8. Forbidden-item compliance (Plan §4.3)

| Forbidden approach | Observed? |
|--------------------|-----------|
| Restore all modules to full sync load | **No** |
| Stuff entire plan-ui into first paint | **No** |
| Use `?.` to hide missing plan openers | **No** — gated openers + Today weekly/AI hard buttons non-silent |
| Random setTimeout / sleep as fix | **No** as product fix (test delays only) |
| Require second click | **No** for gated plan open |
| Change only tests | **No** — production commits present |
| Disable SW as product fix | **No** |
| Unconditionally precache every page | **No** (D-T3) |
| Rewrite entire router/store/loader | **No** — incremental |

---

## 9. Version / process constraints

| Constraint | Status |
|------------|--------|
| Work only in closeout worktree | **DONE** (`lazy-closeout`) |
| No push / no merge without user | **DONE** (still) |
| Temp under `G:/LLM/rehab/.tmp/lazyload-closeout/` (+ prior lazyload-repair) | **DONE** |
| Bump via repo script after prod change | **DONE** **v342** |
| `bump-version.js --check` | **DONE** OK |
| Hard-coded `__rehab_upgrade` / controller-v guards | **DONE** taught in bump script |
| Closeout expands remaining blockers only | **DONE** — stop for approval |

---

## 10. Merge recommendation

### 10.1 Closeout candidate (recommended bar)

**Recommend approve merge to `perfrom` after user confirmation** of:

- `docs/audits/lazyload-repair-closeout-final.md`
- Architecture/PWA docs
- Residual deferred list (Scheme B offline, FIND-11/12/15/16 hygiene, FIND-14 CI default)

Closeout closed: FIND-07, FIND-08/09, B-T4 progressive back, H3 a11y E3, H5 journal restore, formal scripts, docs.

### 10.2 Explicitly **not** claimed

1. Full offline rehab loop (start→pause→complete every surface).  
2. Default CI always runs Playwright (use `test:release`).  
3. Phase G hygiene FIND-11/15/16/17.  
4. Leaving SPA via browser chrome to about:blank (browser-owned).

### 10.3 Actions for this closeout turn

- Production + tests + docs landed on `fix/lazyload-repair-closeout-v336`  
- **No push**  
- **No merge**  

---

## 11. Traceability summary counts (closeout)

| Status | Notes |
|--------|-------|
| DONE | P1 FIND-01–07 class + closeout FIND-08/09 + H3/H5 + docs |
| Scheme B DONE | Offline essential Today only |
| PARTIAL | FIND-14 CI default; some AT announcements |
| DEFERRED WITH ACCEPTED RISK | FIND-11/12/15/16/17 hygiene; full offline training E3 |
| NOT APPLICABLE | FIND-17 as P1 |

**Bottom line:** Closeout candidate at **v342** is merge-ready after user review. Not 100% of original task-book maximal reading (full offline + all hygiene). Forbidden patterns not used.

---

*Closeout report: `docs/audits/lazyload-repair-closeout-final.md`. Candidate on `fix/lazyload-repair-closeout-v336` / **v342**. No push / no merge until user approves.*
