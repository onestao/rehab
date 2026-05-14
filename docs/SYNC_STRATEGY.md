# Sync Strategy

## Data Model

Each syncable record carries `id`, `updatedAt`, and optional tombstone state through `deleted` or `deletedAt`.

Current synchronized entities:

- `actions`
- `routines`
- `history`
- `weights`
- `foodLogs`
- `exerciseLogs`
- `healthProfile`
- `aiAdviceChat`

## Merge Algorithm

The application uses record-level LWW (last-writer-wins by `updatedAt`).

- newer remote record replaces local record
- newer local record remains unchanged during pull
- soft-deleted records are preserved as tombstones

This keeps conflict resolution deterministic and cheap for a static app.

### Fieldwise merge (optional)

When `cfg.mergeStrategy` is set to `fieldwise`, the app can merge per-field updates using:

```
__fieldUpdatedAt: { fieldName: ISOString }
```

If either side lacks `__fieldUpdatedAt`, merge falls back to record-level LWW.

## Tombstones

When a record is deleted, the tombstone must remain newer than any live copy.

- remote tombstone newer than local live record: remote wins
- local tombstone newer than remote live record: local wins

## Retry Strategy

- retries: `3`
- base delay: `800ms`
- factor: `2`
- jitter: `±20%`

Retryable failures:

- `429`
- `5xx`
- transport/network failures such as `Failed to fetch`

Non-retryable failures:

- `4xx` except `429`

## Queue Replay

Failed write operations are retained in `data.db.syncMeta.pendingQueue`.

Replay triggers:

- next manual push/pull
- periodic background flush from `sync-status.js`
- browser `online` event

### Batch replay

Queue replay runs in FIFO batches (max 20 items per flush). On the first failure, remaining items in the current batch are kept and the flush stops.

## Encrypted AI Sync

AI profiles are synchronized inside app data using encrypted payloads.

- key derivation: `PBKDF2`
- cipher: `AES-GCM`
- IV/salt: random per encryption

## Example Conflicts

### Example 1: remote newer

Local `updatedAt=100`, remote `updatedAt=140`.

Result: remote replaces local.

### Example 2: local tombstone newer

Local deleted record `updatedAt=200`, remote live record `updatedAt=180`.

Result: local tombstone remains.

### Example 3: divergent edits

Local changed one field, remote changed another field on the same record.

Result: newer whole record wins; field-level merge remains a future extension point.
