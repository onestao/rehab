# Update + Session Safety

Prevents Service Worker activation and legacy migration from reloading a client
while it owns active training state, pending persistence, or unsaved edits.

## Update blocker classification

`appUpdate.getUpdateBlockReason()` returns one of:

| Reason | Source | Journal write |
| --- | --- | --- |
| `active-session` | Live workout/cardio state or a recoverable session journal | Yes, for a live workout only |
| `pending-write` | `_dbDirty`, `_pendingPersistPromise`, or compatibility `_pendingLocalWrite` | No |
| `unsaved-draft` | Active edit drafts or dirty rehab inputs | No |

Residual timer handles, elapsed phase values, `isPaused` without `isPlaying`, and
`lastActionDraft` parameter memory are not update blockers.

## Session journal

The shared `rehab_active_session` journal is recoverable only when all schema,
identity, mode, timestamp, and mode-specific payload checks pass. Both the lazy
workout module and `app-update.js` apply the same contract. This lets a profile-only
tab protect a workout running in a sibling tab before `workout-state.js` loads.

Invalid, malformed, incomplete, expired, or future-dated journals are removed.
Only a real live workout may write or refresh the journal.

## Service Worker coordination

Every blocked client registers navigation deferral with both the current controller
and the waiting worker:

- `UPDATE_DEFER_FOR_CLIENT` adds the source client to `clientDeferClientIds`.
- `UPDATE_CLIENT_CLEAR` removes it after all blocker reasons clear.
- Legacy `UPDATE_DEFER_FOR_SESSION` and `UPDATE_SESSION_CLEAR` remain aliases.
- `V327_PAGE_READY` also clears the ready client's deferral.

The waiting worker must receive deferral before activation so a sibling tab cannot
activate it and hard-navigate a blocked client. Deferral is per client: one blocked
tab does not prevent safe migration of another tab.

## Client lifecycle

When a waiting worker is discovered, `appUpdate.show(worker)` immediately classifies
the client. A blocked client registers deferral and arms a watcher even when the
update banner is unavailable. The watcher checks the full blocker classification,
sends clear only after it becomes `null`, and then restores the normal update UI.

## Forbidden

- Sending `SKIP_WAITING` from a blocked client.
- Hard-navigating a client present in `clientDeferClientIds`.
- Treating ordinary drafts or pending writes as training journals.
- Restoring a journal before its complete mode-specific schema is validated.
- Relying on a workout-page-only module to protect sibling or profile-only tabs.

## Tests

- `test/app-update-session-safety.test.mjs`
- `test/session-journal.test.mjs`
- `test/sw-client-defer-protocol.test.mjs`
