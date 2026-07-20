# Lazyload Repair Closeout Final (merge-ready candidate)

**Branch:** `fix/lazyload-repair-closeout-v336`
**Worktree:** `G:/LLM/rehab/.claude/worktrees/lazy-closeout`
**Base (matrix freeze):** `fc83ab8` / `integration/lazyload-rehab-repair`
**Final candidate HEAD:** `6a8117af99c40e8b66bab2c0a9e0d99ca543e06d`
**Product closeout commit:** `9393be8929e61869cf450970cf82659b1eed4e55`
**Release fingerprint:** **v342** (`training-assistant-v342`)
**Date:** 2026-07-20
**Status:** frozen candidate for user approval — **no push / no merge**

---

## 0. Freeze record (this turn)

### 0.1 Working tree

| Check | Result |
|-------|--------|
| Branch | `fix/lazyload-repair-closeout-v336` |
| HEAD (full) | `6a8117af99c40e8b66bab2c0a9e0d99ca543e06d` |
| Working tree at freeze tip | clean (junk Edge profiles under `build/fooddb-diet-profile-*` removed; not committed) |
| `.tmp` / logs / traces / browser profiles in git | **not committed** (temp under `G:/LLM/rehab/.tmp/lazyload-closeout/` and `.tmp/lazyload-repair/`) |
| Uncommitted report edits | none after this freeze tip |

### 0.2 Closeout commit list (`fc83ab8..HEAD`)

| SHA | Message |
|-----|---------|
| `9393be8` | `fix: closeout PWA lazyload residual blockers at v342` |
| `6a8117a` | `docs: freeze closeout candidate HEAD and gate truth` |

Product closeout is `9393be8`. Freeze docs tip is `6a8117a`. Full integration repair chain is ancestors of `fc83ab8`.

### 0.3 Topology vs integration / perfrom

| Ref | Full SHA |
|-----|----------|
| `perfrom` | `0fa29d9a8379dc0f1551d3b90961337307232d8b` |
| `origin/perfrom` | `0fa29d9a8379dc0f1551d3b90961337307232d8b` (not advanced) |
| `integration/lazyload-rehab-repair` | `fc83ab8859a4eeb4501bb47a9f3ee2a68f20f556` |
| closeout HEAD | `6a8117af99c40e8b66bab2c0a9e0d99ca543e06d` |
| product closeout | `9393be8929e61869cf450970cf82659b1eed4e55` |
| `merge-base(fc83ab8, closeout)` | `fc83ab8859a4eeb4501bb47a9f3ee2a68f20f556` |

| Direction | Commits |
|-----------|---------|
| `integration..closeout` | `9393be8` + `6a8117a` |
| `closeout..integration` | **empty** |
| `perfrom..closeout` | 14 commits (full repair series + closeout + freeze docs) |
| `closeout..perfrom` | **empty** |

| Ancestor check | Result |
|----------------|--------|
| integration ancestor of closeout | **yes** |
| perfrom ancestor of closeout | **yes** |
| closeout ancestor of perfrom | no |
| bidirectional unique commits | **none** |

**Conclusion:** linear history. Fast-forward is possible both:

1. `integration` ← FF `closeout`
2. `perfrom` ← FF `closeout` (or FF integration after step 1)

`perfrom` did **not** move during this work. **No rebase required. Do not squash.**

### 0.4 Recommended merge path (do not squash)

```text
fix/lazyload-repair-closeout-v336
  → fast-forward integration/lazyload-rehab-repair
  → fast-forward perfrom
```

Preserve root-cause commit boundaries from the integration series:

- plan gate / intent replay
- deep-link navigation transaction
- gated page side effects
- offline history-view precache
- SW session defer
- focus trap / plan gate harden
- broadened session defer + SW hard navigate
- v336 bump + retarget tests
- evidence harness
- matrix freeze docs
- **closeout v342 residual blockers** (`9393be8`)

Only if a future remote advance breaks FF should rebase/ordinary merge be reconsidered. Default is **linear FF**.

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
| Final `npm run test:release` this freeze | **FAIL** — unit 708/0 + browser 14/0 **PASS**; evidence harness **S2 FAIL** (toast capture), see §4 |
| Recommend FF after user approval? | **Yes for product code**, after accepting S2 harness residual **or** fixing evidence toast capture in a docs/test-only follow-up |
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

## 4. Final gate results (freeze re-run)

Commands run in worktree `G:/LLM/rehab/.claude/worktrees/lazy-closeout`.

| Gate | Exit | Result | Duration / notes |
|------|------|--------|------------------|
| `node scripts/bump-version.js --check` | **0** | version sync OK (**v342**) | — |
| `git diff --check fc83ab8..HEAD` | **2** | trailing whitespace in **docs only** (markdown double-space hard breaks) | no code whitespace errors |
| `npm run test:release` | **1** | composite fail | **~130s** |
| → unit (`test/*.test.mjs`) | **0** | **708 pass / 0 fail** | part of release |
| → `test:browser:lazyload` | **0** | **14 pass / 0 fail** | A-T1–3, H1-T1–3, B-T1–4, H2-T2, C-T1, H3-T1–2 |
| → `test:evidence:lazyload` | **1** | **9 pass / 1 fail** | **S2-plan-404-recover** only |
| Evidence re-run alone | **1** | same S2 fail | **~36s**, channel **msedge** |

### Evidence detail (S2)

- Artifact: `G:/LLM/rehab/.tmp/lazyload-repair/evidence/s2-plan-404.json`
- Detail: `{ "toastOk": false, "modals": 1 }`
- Recovery path **works** (`modals: 1` after unfail).
- `toastOk` fails because harness samples `document.body.innerText` after 800ms; toast text is not reliably present there (toast host / ephemeral UI). Formal browser **A-T3** still **PASS** (captures `window.toast.show` messages).
- Product fail copy in `data.js`: `PLAN_FEATURE_FAIL_TOAST = '计划功能暂时未加载成功。请检查网络后重试，已保存的训练记录不会丢失。'`
- **Classification:** evidence **harness detection gap**, not product 404-toast regression. Formal A-T3 is the stronger contract.

### Logs / artifacts

| Item | Path |
|------|------|
| Full `test:release` log | `G:/LLM/rehab/.tmp/lazyload-closeout/gates/final-test-release.txt` |
| Evidence re-run | `G:/LLM/rehab/.tmp/lazyload-closeout/gates/evidence-rerun-1.txt` |
| Evidence JSON | `G:/LLM/rehab/.tmp/lazyload-repair/evidence/` |
| Fingerprint | `training-assistant-v342` / asset `?v=342` |

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

## 6. Residual risks (accepted for this candidate)

1. **Scheme B offline only** — non-Today / uncached modules may toast-fail offline.
2. **FIND-14** — default `npm test` is unit-only unless pipeline uses `test:release`.
3. **FIND-11/12/15/16** — hygiene deferred.
4. **Evidence S2 toast capture** — harness false negative; formal A-T3 green. Prefer test-only fix later, not product churn.
5. **P-1.4 partial** — workout/cardio restore-on-init, not full draft universe.
6. **Docs `git diff --check` trailing spaces** — markdown hard-break spaces only.

---

## 7. Forbidden patterns (re-check)

| Forbidden | Status |
|-----------|--------|
| Full sync plan-ui as only fix | Not used |
| Silent `?.` on Today weekly/AI hard buttons | Removed |
| SW-off as product fix | Not used |
| Bloat all pages into ASSETS | Not done (Scheme B) |
| Whole router rewrite | Not done |
| Squash entire series into one commit on merge | **Do not** — preserve boundaries |

---

## 8. Stop rule

**Freeze complete. No push. No merge.**

User decision needed:

1. Accept candidate **v342 @ `6a8117a`** (product `9393be8`) with S2 evidence residual + P-1.4 partial wording, then FF integration → perfrom; **or**
2. Request test-only S2 toast capture fix before FF (no production change required).

---

## 9. Suggested next user actions

1. Read this freeze record + architecture/PWA docs.
2. Spot-check Today weekly/AI first click and `#/profile/library` back.
3. If approved: **linear FF only** (closeout → integration → perfrom). Do not squash.
4. Agent will not push/merge unprompted.
