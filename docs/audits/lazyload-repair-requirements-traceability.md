# Lazyload Rehab Repair — Requirements Traceability Matrix

**Branch:** `integration/lazyload-rehab-repair`  
**Worktree:** `G:/LLM/rehab/.claude/worktrees/lazy-integration`  
**Baseline:** `0fa29d9` / `perfrom` / v335  
**Candidate HEAD:** `5ebcfd1513eb4d3ce85104edad9974c1089711c2`  
**Release:** **v336** / `training-assistant-v336`  
**Date:** 2026-07-20  
**Scope:** 合入前任务书完成度与证据追踪复核（只读；不扩修；不 push；不 merge）

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

- Working tree at audit time: clean at `5ebcfd1`.
- Final validation doc freeze table still cites `01ffecc` for “Candidate HEAD”; later pin commit is `5ebcfd1` (docs-only SHA pin). Functional code freeze for gates is **v336 @ `5ebcfd1`** after `31a3ce7` bump + test retargets + evidence harness.
- Gates claimed in final validation (npm 687, browser 7, evidence 10/10) have log files under `.tmp/lazyload-repair/gates/`; this matrix does **not** re-execute them.

---

## 1. Executive judgment

| Question | Answer |
|----------|--------|
| Core FIND-01–06 product failures (plan first-click, deep-link shell/navStack app-back, cancelled nav side effects, Today history-view precache, plan fail toast, basic update defer) | **Largely DONE** with E2–E3 |
| Full task-book delivery (architecture docs, full offline rehab loop, post-upgrade session restore, full a11y, phase G hygiene, system browser-back) | **Not complete** — several **PARTIAL / NOT DONE / DEFERRED** |
| Forbidden “fixes” (full sync load, `?.` silence for plan openers, SW off as product fix, bloat all pages into ASSETS) | **Not observed** on plan openers / SW |
| Recommend merge to `perfrom` as-is? | **Conditional yes for A–F core release**, **only if** product accepts residual risks in §6. **No** if stakeholder treats architecture docs + 1.4 restore + B-T4 system-back + FIND-07 as merge blockers. |
| Expand fixes now? | **No** (per user instruction). Report gaps only. |

---

## 2. Product contracts (Plan §1.1–1.5)

| ID | Requirement | Status | Evidence | Notes |
|----|-------------|--------|----------|-------|
| P-1.1 | First visible click completes intent or loading→auto-continue; no second click; no silent `?.`; no raw tech error to user | **DONE** (plan openers path) | E3: A-T1/A-T2/A-T3, S1/S2; E2: plan-feature-gate unit | Covers `openNewPlanSheet` / gate openers. **Does not** cover FIND-07 weekly/AI `?.` buttons. |
| P-1.2 | Active training state independent of DOM/route/SW update; must not be reset unintentionally | **PARTIAL** | E2: C unit + E-T*; E3: S4/S6/S7 | Cancelled nav does not force workout mode; update defer broad. No assert that timers/pain drafts survive arbitrary route/module preload independently of DOM. |
| P-1.3 | Minimal offline rehab loop: view Today plan, start/pause/complete, local pain/symptom, back/close; online features degrade clearly | **PARTIAL** | E1/E2: D-T1–T3; E3: S5 cache 200 for history-view/today-view-core/data | Precache closes FIND-05 Today script hole. **No** E3 that offline start→pause→complete training + pain save works. Workout/AI pages still warm-dependent (accepted non-bloat). |
| P-1.4 | No force-navigate mid dangerous moment; save → mark pending → safe apply → **restore recoverable training state** | **PARTIAL** | E2: E-T1–T8; E3: S6/S7; E1: SW defer before `client.navigate` | Block/defer **DONE**. Explicit pre-update local save orchestration + **post-upgrade session restore** **NOT DONE**. |
| P-1.5 | a11y core not deferred utility: focus trap, Escape/system close, focus restore, close control, keyboard, busy/error a11y | **PARTIAL** | E1: F-T1–T3; E3: S8 (script load path) | Trap loads early + open-path ensure. Escape handled in `a11y-focus-trap.js`. **No** E3 Tab cycle / Escape close / focus-return / AT busy asserts. S8: `trapApi: false` at sample point (script present, API not yet true). |

---

## 3. FIND-01 … FIND-17

| ID | Severity (audit) | Status | Production touch | Assertions that actually match | Evidence | Residual |
|----|------------------|--------|------------------|--------------------------------|----------|----------|
| **FIND-01** Plan first-click TypeError | P1 | **DONE** | `data.js` planFeatureGate + LAZY_PLAN_OPENERS stubs; attach on load | A-T1: delay plan-ui, real click, 0 TypeError, 1 modal; A-T2: 5 intents → 1 modal, gate=ready, planUiHits 1–2; unit first-open/replay/single-flight | E3+E2 | Drawer/continue-train paths share openers list; not each button click-tested in browser. |
| **FIND-02** Deep-link paints Today first | P1 | **DONE** | `index.html` earlyDeepLinkShell; boot parse→shell→ensureDeps(initial)→side effects→init→applyCurrent | B-T1: no Today flash after profile shell; S3 active=profile | E3 | Sub-ms first paint of default HTML class before early script still possible in theory; assert samples post-shell. |
| **FIND-03** navStack / back broken | P1 | **PARTIAL** | app-route + navStack replaceTopOrPushTab on activate; boot single transaction | B-T2: hash/DOM/stack/subroute align; B-T3: requestClose not no-op, progressive leave library | E3 | **B-T4 system/browser `history.back` leaving SPA** (V1 user fault) **not** re-asserted with real browser back to about:blank. App-internal back **DONE**. |
| **FIND-04** Cancelled nav runs side effects | P1 | **DONE** | `ensureDeps` pure; `activatePageSideEffects` after token | C-T1 unit + browser: setMode/swipe/workoutStateInit = 0 on cancelled workout; S4 | E3+E2 | Module warm may remain (allowed). |
| **FIND-05** SW ASSETS vs PAGE_DEPS | P1 | **PARTIAL** | `history-view.js?v=336` in ASSETS | D-T1 closure ⊆ ASSETS; D-T2 shell; D-T3 no advice-panel bloat; S5 offline fetch 200 | E3+E2+E1 | Full FIND-05 “all lazy pages offline” **not** claimed; product chose essential Today only. Workout/AI cold-offline still structural. |
| **FIND-06** Enhancement fail UX | P1 | **DONE** | Gate fail → Chinese toast; busy clear; retry | A-T3 toast regex + recover modal; unit fail toast | E3+E2 | Enhancement idle path itself not separately toast-tested; user-intent path covers failure UX. |
| **FIND-07** `?.` silent plan/AI/weekly | P2 | **NOT DONE** | still `data.openPlanTodayAiSheet?.()` and `window.planWeekly?.open?.()` in today-view-core | none for silent-no-op fix | E0 | Still outside gate list for hard onclick; intentional or missed — either way **not fixed**. |
| **FIND-08** Subroute write before token | P2 | **PARTIAL** | navigation improved; `app-route.js` still sets `healthView`/`routineView` **before** `_activateTab` | no dedicated race assert | E1 observation | Audit C-02 residual. |
| **FIND-09** Modal survives tab change | P2 | **NOT DONE** | no new route-change close modal policy in this delta | none | E0 | Still structure risk. |
| **FIND-10** a11y/haptics delayed | P2 | **PARTIAL** | a11y-focus-trap immediate in post-render; openModal ensure; still in ASSETS | F-T1–T3 source; S8 script loaded | E1+weak E3 | Haptics/sheet-drag remain idle; full a11y behavior under-tested. |
| **FIND-11** LAZY_RECORD_OPENERS overwrite | P2 | **DEFERRED WITH ACCEPTED RISK** | not targeted in A–F core | pre-existing diet path tests exist elsewhere; not this repair’s gate | — | Phase G hygiene. |
| **FIND-12** Interact before data.init | P2 | **DEFERRED WITH ACCEPTED RISK** | early shell only; no init-before-click shield | none new | — | Audit residual. |
| **FIND-13** Leave Today cancels enhancement | P2 | **PARTIAL** | Gate cancels cross-route open; enhancement schedule still today-gated | unit: leave Today no modal | E2 | Enhancement abandon still exists by design. |
| **FIND-14** Tests bypass real boot | P3 | **PARTIAL** | formal browser tests + evidence harness added | A/B/C browser suites + S1–S10 | E3 | **CI still may not force Playwright** (repo `npm test` is node). Harness is pre-merge script, not proven in default CI matrix. |
| **FIND-15** `_loaded` seed incomplete | P3 | **DEFERRED WITH ACCEPTED RISK** | phase G | none | — | |
| **FIND-16** Incomplete prereq graph | P3 | **DEFERRED WITH ACCEPTED RISK** | phase G | none | — | |
| **FIND-17** Listener guard flags | P3 | **NOT APPLICABLE** (as fix) / **DEFERRED** | V4 did not prove leak; not fixed this round | V4 historical only | E0 | Keep as static risk. |

---

## 4. EXTRA V1–V5

| ID | Audit conclusion | Status after repair | Evidence | Notes |
|----|------------------|---------------------|----------|-------|
| **V1** Deep-link real back | User-level fault | **PARTIAL** | B-T3 requestClose E3; no real `history.back` suite | App stack fixed; system back residual **UNVERIFIED** as fixed. |
| **V2** Fresh cold offline | Structural gap | **PARTIAL** | history-view now in ASSETS; S5; D-T* | Today essential improved; non-Today offline still warm-dependent (**accepted**). |
| **V3** plan-ui 404 | TypeError + weak toast | **DONE** | A-T3, S2 | Chinese fail copy + retry. |
| **V4** Listener loops | No growth | **NOT APPLICABLE** | S10 open/close residual modals/TypeError only | Not a fix target; S10 ≠ CDP listener delta. |
| **V5** Multi-tab SW upgrade | Force sibling navigate; mid-boot shell | **PARTIAL** | S6 dual-tab defer; E-T SW order; upgrade overlay | Training tab defers; idle applies. Mid-boot half-init still possible; **session restore after upgrade not implemented**. |

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
| B-T4 browser/system back | **NOT DONE** | no assert |
| Single navigation transaction boot | **DONE** | code + B suite |
| Modal-first close policy on back | **PARTIAL** | navStack modal type exists pre-repair; not expanded this round |

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
| Document offline contract file | **NOT DONE** | `docs/pwa/offline-capability-contract.md` **missing** |
| Offline start/pause/complete training | **NOT DONE** | no E3 loop |

### Phase E — Update session safety

| Item | Status | Asserts |
|------|--------|---------|
| Defer when isPlaying | **DONE** | E-T1 |
| Defer when paused / draft / pending / phase | **DONE** | E-T5–T7, S7 |
| Idle still SKIP_WAITING | **DONE** | E-T2/E-T8, S6 A |
| Dual-tab: idle apply, training defer | **DONE** | S6 |
| SW skip hard navigate when deferred | **DONE** | E1 order + S9 indices |
| UPDATE_SESSION_CLEAR on end | **DONE** (code + E1) | armSessionClearWatcher; interval unref for tests |
| Upgrade overlay / early barrier | **DONE** | E-T4 + index guards v336 |
| Pre-update local save orchestration | **NOT DONE** | not asserted |
| Post-upgrade training restore | **NOT DONE** | not implemented |
| Doc `docs/pwa/update-session-safety.md` | **NOT DONE** | missing |

### Phase F — Modal / a11y

| Item | Status | Asserts |
|------|--------|---------|
| focus trap not only +2s idle | **DONE** | F-T1 immediate loadScript |
| open path ensure trap | **DONE** | F-T2 |
| trap in ASSETS | **DONE** | F-T3 v336 |
| Escape closes modal | **PARTIAL** | code in a11y-focus-trap; **no** browser assert |
| Focus restore to trigger | **NOT DONE** / **UNVERIFIED** | not asserted this round |
| Keyboard Tab trap cycle | **NOT DONE** | not asserted |
| Busy/error AT announcement | **NOT DONE** | not asserted |
| plan drawer navStack/trap parity | **PARTIAL** / **UNVERIFIED** | drawer uses openers; full drawer lifecycle not E3 |

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
| Batched production fixes | **DONE** | commits 6061f56…38be40a + bump |
| Per-batch fail→pass tests | **PARTIAL** | tests exist; red-before-green history not re-proven in this audit |
| Non-skippable Playwright release gate | **PARTIAL** | suites exist; default `npm test` does not run them |
| `docs/architecture/lazy-feature-readiness.md` | **NOT DONE** | directory absent |
| `docs/architecture/navigation-lifecycle.md` | **NOT DONE** | absent |
| `docs/pwa/offline-capability-contract.md` | **NOT DONE** | absent |
| `docs/pwa/update-session-safety.md` | **NOT DONE** | absent |
| `docs/audits/lazyload-repair-final-validation.md` | **DONE** | present; pin note §freeze |
| Change list / risk / rollback | **PARTIAL** | final validation + known-risks shared; not full formal rollback runbook |
| Unresolved risk list | **PARTIAL** | this matrix + shared known-risks |
| Version bump after production change | **DONE** | v336; bump-version --check claimed OK; hard-coded upgrade guards taught |

---

## 6. Gap classification

### 6.1 Release blockers (if stakeholder requires **full** task book)

| Gap | Why blocking under strict reading |
|-----|-----------------------------------|
| Architecture + PWA contract docs missing | Explicit Plan §3 deliverables 4–7 |
| P-1.4 post-upgrade session restore absent | Product principle “更新后恢复可恢复的训练状态” not delivered |
| B-T4 / V1 system browser-back | Audit user-level leave-SPA not re-closed with E3 |
| FIND-07 silent `?.` weekly/AI | Same Today surface as FIND-01 family; still silent no-op |
| Full offline training loop | P-1.3 “开始、暂停、继续、完成” not E3 |

### 6.2 Acceptable deferred risks (if merge goal = **A–F confirmed P1 core**)

| Gap | Why deferrable |
|-----|----------------|
| Workout/AI full precache | Explicitly avoided bloat (D-T3); document as non-offline |
| Phase G FIND-11/15/16/17 | Plan order G last; low severity |
| FIND-08/09 | P2 structure; not in closed A–C acceptance tests |
| FIND-12 init-before-click | Pre-existing; not regression of this series |
| Playwright not in default CI | Pre-merge harness + focused browser suite ran; residual process risk |
| Full a11y Tab/focus-restore E3 | Trap load path fixed; residual UX risk not TypeError-class |
| Final validation SHA table lag (`01ffecc` vs `5ebcfd1`) | Docs-only; functional freeze still v336 |

### 6.3 Not applicable / closed by design

| Item | Note |
|------|------|
| FIND-17 as P1 | V4 downgraded |
| Disable SW as fix | Not used |
| Re-sync all modules | Not used |
| Hide plan openers with `?.` | Gate uses real stubs + toast, not silence |

---

## 7. Evidence index (what was actually asserted)

### 7.1 Browser formal tests (E3)

| Suite | Tests | Pass claim (gates) |
|-------|-------|--------------------|
| `test/plan-feature-gate.browser.test.mjs` | A-T1, A-T2, A-T3 | yes |
| `test/deep-link-nav.browser.test.mjs` | B-T1, B-T2, B-T3 | yes |
| `test/ensure-deps-side-effects.browser.test.mjs` | C-T1 | yes |

### 7.2 Node / contract (E1–E2)

| Suite | Coverage |
|-------|----------|
| `test/plan-feature-gate.test.mjs` | stubs, replay, single-flight, fail toast, leave Today, source wiring |
| `test/ensure-deps-side-effects.test.mjs` | pure ensureDeps, token order, unit cancel |
| `test/offline-essential-closure.test.mjs` | D-T1–T3 |
| `test/app-update-session-safety.test.mjs` | E-T1–T8 + SW order |
| `test/a11y-focus-trap-ready.test.mjs` | F-T1–T3 |
| Version suites retargeted to 336 | controller-reload, SW version gate/fetch |

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
| S8 | ok (script path; trapApi false) | FIND-10 load only |
| S9 | ok | SW defer before navigate |
| S10 | ok | residual open/close stability |

### 7.4 Claims that must **not** be treated as DONE

| Claim | Why insufficient alone |
|-------|------------------------|
| “test/plan-feature-gate.browser.test.mjs exists” | Without reading A-T* asserts |
| “S5 offline Today” | Proves script fetch 200, not full rehab offline loop |
| “S8 focus trap” | Proves script/open path; not Tab/Escape/restore |
| “E-T* session safety” | Blocks update; does not restore session after upgrade |
| “final-validation.md says 10/10” | E0 unless paired with summary.json / gate logs (those exist here) |

---

## 8. Forbidden-item compliance (Plan §4.3)

| Forbidden approach | Observed? |
|--------------------|-----------|
| Restore all modules to full sync load | **No** |
| Stuff entire plan-ui into first paint | **No** |
| Use `?.` to hide missing plan openers | **No** for gated openers; **Yes residual** on weekly/AI (FIND-07) |
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
| Work only in integration worktree | **DONE** |
| No push / no merge without user | **DONE** (still) |
| Temp under `G:/LLM/rehab/.tmp/lazyload-repair/` | **DONE** |
| Bump via repo script after prod change | **DONE** v336 |
| `bump-version.js --check` | **DONE** (gate log) |
| Hard-coded `__rehab_upgrade` / controller-v guards | **DONE** taught in bump script + 336 values |
| Do not expand fixes in this audit turn | **DONE** |

---

## 10. Merge recommendation

### 10.1 If merge criterion = “close audit P1 FIND-01–06 core + real browser gates”

**Recommend approve merge to `perfrom` after user confirmation**, with residual risks accepted as:

1. System browser-back deep-link (V1/B-T4) not re-proved.  
2. Offline promise = Today essential scripts, not full training loop.  
3. Update defers mid-session; does not auto-restore session after upgrade.  
4. FIND-07 weekly/AI `?.` still silent.  
5. Architecture/PWA formal docs still missing.  
6. Playwright not proven as default CI gate.

### 10.2 If merge criterion = “full GROK task book §1 + §3 deliverables”

**Do not merge yet.** Minimum remaining for that bar:

1. Write four architecture/PWA docs.  
2. E3 for B-T4 or explicit product decision “browser bookmark back may leave SPA”.  
3. Either implement post-upgrade restore or rewrite 1.4 acceptance to “defer only”.  
4. Gate or disable FIND-07 silent buttons.  
5. Optional: one offline training golden path E3.

### 10.3 Actions **not** taken in this turn

- No production code changes  
- No new tests  
- No push  
- No merge  
- No “quick fix” expansion of gaps  

---

## 11. Traceability summary counts

| Status | Count (approx., unique requirement rows above) |
|--------|-----------------------------------------------|
| DONE | ~28 |
| PARTIAL | ~18 |
| NOT DONE | ~12 |
| DEFERRED WITH ACCEPTED RISK | ~6 |
| NOT APPLICABLE | ~2 |
| UNVERIFIED | ~3 |

**Bottom line:** Implementation work on FIND-01–06 class failures is real and evidence-backed (E2/E3). Task-book completeness is **not** 100%. Merge is a product risk acceptance decision, not an automatic “all green.”

---

*Generated for pre-merge review only. Candidate remains on `integration/lazyload-rehab-repair` @ `5ebcfd1` / v336.*
