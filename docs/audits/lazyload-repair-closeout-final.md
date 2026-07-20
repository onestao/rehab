# Lazyload Repair Closeout Final (merge-ready candidate)

**Branch:** `fix/lazyload-repair-closeout-v336`
**Worktree:** `G:/LLM/rehab/.claude/worktrees/lazy-closeout`
**Base (matrix freeze):** `fc83ab8` / `integration/lazyload-rehab-repair`
**Final product candidate:** `9393be8929e61869cf450970cf82659b1eed4e55` (v342 production + tests)
**Branch tip:** includes freeze docs + S2 evidence test-only fix after product (see §0.2)
**Release fingerprint:** **v342** (`training-assistant-v342`)
**Date:** 2026-07-20
**Status:** merge-ready for local **FF-only** after user approval — **no push / no merge performed**

---

## 0. Freeze record

### 0.1 Working tree

| Check | Result |
|-------|--------|
| Branch | `fix/lazyload-repair-closeout-v336` |
| Product freeze | `9393be8929e61869cf450970cf82659b1eed4e55` (**unchanged**) |
| Post-product commits | freeze docs + S2 evidence harness only |
| Product files vs `9393be8` | **no product code changes** |
| `.tmp` / profiles | not committed |

### 0.2 Closeout commit list (`fc83ab8..HEAD`)

| SHA | Message | Kind |
|-----|---------|------|
| `9393be8` | `fix: closeout PWA lazyload residual blockers at v342` | **product freeze** |
| docs tips | freeze report / matrix P-1.4 wording | docs |
| S2 test tip | `test: make plan failure toast evidence deterministic` | test/evidence only |

### 0.3 Topology vs integration / perfrom

| Ref | Full SHA |
|-----|----------|
| `perfrom` | `0fa29d9a8379dc0f1551d3b90961337307232d8b` |
| `origin/perfrom` | `0fa29d9a8379dc0f1551d3b90961337307232d8b` (not advanced) |
| `integration/lazyload-rehab-repair` | `fc83ab8859a4eeb4501bb47a9f3ee2a68f20f556` |
| product freeze | `9393be8929e61869cf450970cf82659b1eed4e55` |

| Direction | Result |
|-----------|--------|
| `closeout..integration` | **empty** |
| `closeout..perfrom` | **empty** |
| integration ancestor of closeout | **yes** |
| perfrom ancestor of closeout | **yes** |
| bidirectional unique commits | **none** |

**FF path:** `closeout → integration → perfrom` with `--ff-only`. **Do not squash.**

### 0.4 S2 root cause (test-only)

| Formal A-T3 | Evidence S2 (old) |
|-------------|-------------------|
| Wraps `window.toast.show` during `openNewPlanSheet` | Sampled `document.body.innerText` after fixed 800ms |
| Captures API text even if toast auto-hides | Missed ephemeral `#appToast` after hide |

**Fix (evidence only):** `context.addInitScript` before `goto` wraps `toast.show` + MutationObserver on toast DOM; wait for `loadAppScript`; assert 404 hit, Chinese fail copy, busy cleared, no TypeError, no modal on fail; unfail then **user-active retry** → exactly 1 modal. No product/toast/SW changes.
---

## 1. Executive result

| Question | Answer |
|----------|--------|
| P1 FIND-01–06 core product failures | **DONE** (E2–E3) — inherited + re-verified |
| Closeout residuals (FIND-07, staged subroutes, modal close, B-T4 progressive back, H3 a11y, journal freeze) | **DONE** with production code + formal unit/browser gates |
| P-1.4 post-upgrade **full** training restore | **PARTIAL** — journal freeze + workout/cardio restore-on-init exists; **not** full pain/symptom/draft restore (see §5) |
| Offline full rehab | **Scheme B only** |
| Architecture / PWA docs | **DONE** |
| Formal release scripts | present (`test:unit`, `test:browser:lazyload`, `test:evidence:lazyload`, `test:release`) |
| Final `npm run test:release` | **exit 0** — unit 708/0, browser 14/0, evidence **10/10** |
| Recommend FF after user approval? | **Yes** — product `9393be8` + test/docs only; S2 deterministic |
| Push / merge performed? | **No** |

---

## 2. What changed in this closeout (vs matrix at `fc83ab8`)

### Production

| Area | Files | Change |
|------|-------|--------|
| FIND-07 non-silent openers | `today-view-core.js`, `data.js` | Weekly/AI hard buttons call real openers; non-silent load + Chinese fail toast |
| FIND-08 staged subroutes | `app-route.js` | subroutes commit only after activate under current token |
| FIND-09 route-bound modals | `app-route.js` | tab apply closes `data-rl-modal` unless `preserveModal` |
| H2 back lifecycle | `nav-stack.js` | browser vs pwa mode; popstate closes modal first; PWA root re-push |
| H3 modal a11y | `data-ui-state.js`, `a11y-focus-trap.js`, `index.html` | await trap when missing; force reload when trap cleared |
| H5 session journal | `workout-state.js`, `app-update.js` | schemaVersion 1 journal; defer freezes journal; restore path on init |
| Modal callers | `plan-ui.js`, `routine-library.js`, `history-view.js`, `advice-panel.js` | return `_openModal` promise |

### Diff size `fc83ab8..9393be8`

38 files, **+1895 / −404**

---

## 3. Closeout requirement status (selected)

| ID | Closeout status | Evidence |
|----|-----------------|----------|
| FIND-07 | **DONE** | H1-T1–T3 E3; unit FIND-07*; no silent `?.` on Today weekly/AI hard buttons |
| FIND-08 | **DONE** | unit + app-route cancelled nav |
| FIND-09 | **DONE** | B-T4 modal closed on back/tab path |
| FIND-03 / B-T4 | **DONE** (app progressive back) | B-T4 `page.goBack`; leaving SPA to about:blank still browser-owned |
| P-1.4 session restore | **PARTIAL** | freeze + workout restore-on-init **yes**; pain/draft full restore **no** — §5 |
| P-1.5 a11y | **DONE** trap/Tab/Escape | H3-T1/T2 E3; F-T1–T4 |
| P-1.3 offline | **Scheme B DONE** | D-T*; offline contract |
| FIND-11/12/15/16/17 | **DEFERRED WITH ACCEPTED RISK** | hygiene |
| FIND-14 CI default | **PARTIAL** | scripts exist; default `npm test` unit-only |

---

## 4. Final gate results

| Gate | Exit | Result | Notes |
|------|------|--------|-------|
| `node scripts/bump-version.js --check` | **0** | v342 OK | fingerprint unchanged |
| unit (`test/*.test.mjs`) | **0** | **708 pass / 0 fail** | via `test:release` |
| `test:browser:lazyload` | **0** | **14 pass / 0 fail** | msedge |
| `test:evidence:lazyload` | **0** | **10 pass / 0 fail** | S2 deterministic |
| `npm run test:release` | **0** | all stages green | ~124s log: `.tmp/lazyload-closeout/gates/final-test-release-s2fix.txt` |

### S2 evidence asserts (now)

- `planUi404Hits >= 1` on first open
- Chinese fail toast via `toast.show` wrap + DOM observer (`toastOk`)
- no TypeError / is not a function
- busy cleared (`_actionBusy.openNewPlanSheet` false)
- no modal on fail
- after unfail: user-active retry → `modals === 1`, `planUiOkHits >= 1`
- semantics labeled `user-active-retry-after-unfail` (not auto-replay of failed click)

### Logs

| Item | Path |
|------|------|
| `test:release` after S2 fix | `G:/LLM/rehab/.tmp/lazyload-closeout/gates/final-test-release-s2fix.txt` |
| Evidence S2 JSON | `G:/LLM/rehab/.tmp/lazyload-repair/evidence/s2-plan-404.json` |
| Fingerprint | `training-assistant-v342` / `?v=342` |

---

## 5. Session restore — precise scope (P-1.4)

### 5.1 When journal is written

| Trigger | Behavior |
|---------|----------|
| `document.visibilitychange` → hidden + `workout.isPlaying` | `markActive()` → `saveJournal()` |
| visibility hidden + not playing | `clear()` |
| `appUpdate.showUpdateDeferredForSession()` | `saveJournal({ deferredForUpdate: true })` **before** defer UX |
| `appUpdate.apply()` while `readJournal()?.isPlaying` | `saveJournal({ preApply: true })` then continue apply path |
| Not playing markActive path | clears key |

### 5.2 When new document reads / applies restore

| Stage | Behavior |
|-------|----------|
| Boot | `index.html` calls `workoutState.init()` |
| `init()` | `installVisibilityHandler()` then **`restoreIfNeeded()`** |
| Guard | skip if `workout.isPlaying` already; skip if snapshot missing / not `isPlaying`; clear if age > 12h |
| User | `confirm('检测到未完成的…，是否恢复？')` — decline → `clear()` |

**This is not “API only”.** Restore is invoked on real boot via `workoutState.init()`.

### 5.3 Fields actually restored

| Surface | Restored | Not restored |
|---------|----------|--------------|
| Mode | cardio / strength via `workout.setMode` | — |
| Play flags | `isPlaying`, `isPaused`, `totalSec` | — |
| Cardio | `cardio.isRunning/isPaused/seconds/targetAnnounced`; restarts tick interval; labels for status/sub/play | pain/symptom form drafts; diet drafts; arbitrary modal dirty fields |
| Strength | `workoutEngine.restore(snapshot.strength, labels, updatedAt)` + session timer | full pain/symptom drafts; history “already completed set” beyond engine snapshot contents |
| UI labels | statusText, mainTime, subText, sessionTime, curSet/totalSet, curRep/totalRep (snapshot.labels) | free-form non-workout drafts |
| Meta | `schemaVersion: 1`, `journal: 'rehab-session'`, `deferredForUpdate` / `preApply` flags on write | automatic silent restore without confirm |

### 5.4 Duplicate completion / safety

| Concern | Reality |
|---------|---------|
| Prevent duplicate complete records | **No dedicated** “already completed this set → skip write” gate beyond user confirm + decline clears journal |
| Mid-session forced SW navigate | Blocked when `hasActiveRehabSession()` (includes journal key presence) + SW `sessionDeferClientIds` |
| Restore without user consent | **No** — confirm required |

### 5.5 H5-T1–T4 exact asserts

| Test | Asserts |
|------|---------|
| **H5-T1** | snapshot has `schemaVersion === 1`, `journal === 'rehab-session'`, `isPlaying === true`, `totalSec === 42` |
| **H5-T2** | `saveJournal({ deferredForUpdate: true })` writes KEY; `readJournal()` returns schemaVersion 1, deferredForUpdate true, totalSec 42 |
| **H5-T3** | `app-update.js` source contains `saveJournal`, `hasActiveRehabSession`, defer SW message; **method body** of `showUpdateDeferredForSession` contains `saveJournal` + Chinese defer toast copy |
| **H5-T4** | `workout-state.js` source contains `restoreIfNeeded`, KEY/`rehab_active_session`, `schemaVersion`, `saveJournal` |

H5 is **E2** (unit/source). E3 dual-tab defer is S6 (update defer), not full post-reload restore E3.

### 5.6 Correct status wording

- **DONE:** pre-update journal freeze; active-session defer; boot calls `restoreIfNeeded`; cardio/strength recoverable path with confirm.
- **NOT fully DONE for maximal P-1.4 reading:** pain/symptom/edit drafts; E3 “reload after upgrade → full training UI restored”; anti-duplicate completion ledger.

---

## 6. Residual risks (accepted)

1. **Scheme B offline only** — non-Today modules may toast-fail offline.
2. **FIND-14** — default `npm test` unit-only unless CI uses `test:release`.
3. **FIND-11/12/15/16** — hygiene deferred.
4. **P-1.4 limited restore** — workout/cardio + confirm; no pain/symptom/dirty-modal/anti-duplicate completion restore.
5. **Docs trailing spaces** — markdown hard-break only (non-blocking).

---

## 7. Forbidden patterns (re-check)

| Forbidden | Status |
|-----------|--------|
| Product change in S2 fix | **Not done** — harness only |
| Full sync plan-ui | Not used |
| Silent `?.` weekly/AI | Removed (product freeze) |
| SW-off as fix | Not used |
| Squash on merge | **Do not** |

---

## 8. Stop rule

**S2 evidence deterministic. `test:release` exit 0. Product still `9393be8`.**
**No push. No merge.** Await user approval for local FF:

```text
git checkout integration/lazyload-rehab-repair && git merge --ff-only fix/lazyload-repair-closeout-v336
git checkout perfrom && git merge --ff-only integration/lazyload-rehab-repair
```

---

## 9. User checklist for local FF approval

- [x] product freeze = `9393be8`
- [x] only test/docs after product
- [x] evidence 10/10
- [x] test:release exit 0
- [x] working tree clean (after commit)
- [x] perfrom not advanced
- [x] closeout contains full integration
- [ ] user explicitly approves FF (not performed by agent)