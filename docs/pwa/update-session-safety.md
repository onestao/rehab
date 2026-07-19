# Update + Session Safety (v342)

Prevents mid-rehab forced reload when a new Service Worker is ready.

## Active session definition

`appUpdate.hasActiveRehabSession()` is true when any of:

- `workout` / `workoutSystem` playing, paused, phase timer, or live intervals
- `cardio` running / paused with elapsed time
- `localStorage` key `rehab_active_session` (session journal) present
- Pending local write / edit drafts / dirty pain-symptom inputs / dirty open modal fields

## Session journal (H5)

| Field | Source |
| --- | --- |
| Storage key | `workoutState.KEY` = `rehab_active_session` |
| Schema | `schemaVersion: 1`, `journal: 'rehab-session'` |
| Write | `workoutState.markActive` (visibility hidden), `saveJournal` |
| Pre-update freeze | `showUpdateDeferredForSession` → `saveJournal({ deferredForUpdate: true })` |
| Pre-apply flush | `apply()` if journal still `isPlaying` |
| Restore | `workoutState.restoreIfNeeded()` on init (confirm dialog) |

## SW coordination

Client messages:

- `UPDATE_DEFER_FOR_SESSION` — client id enters `sessionDeferClientIds`
- `UPDATE_SESSION_CLEAR` — remove defer after session ends
- Hard `client.navigate` skip while deferred

## User-visible defer

- Banner: “更新已就绪（训练中推迟）”
- Toast: “训练进行中，更新已推迟…”
- `armSessionClearWatcher` re-shows normal update when session clears

## Forbidden

- Force `SKIP_WAITING` + hard reload while session active
- Clearing journal without user decline of restore confirm

## Tests

- `test/app-update-session-safety.test.mjs`
- `test/session-journal.test.mjs`
