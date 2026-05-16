# AI Rendering

## Streaming Renderer

The AI coach panel renders streaming responses using `advice-stream-renderer.js` (DOM scheduler) and a small queue that breaks large chunks into per-frame updates.

Key behaviors:

- Streaming chunks are appended incrementally.
- Pause/resume controls allow users to stop auto-rendering while reading.
- A "show all" action flushes buffered chunks immediately.

## Versioned Replies

AI answers can be retried without overwriting prior output. Each retry creates a new version under the same logical reply group.

- Users can switch versions with the UI arrows or keyboard shortcuts (`[` and `]`).
- The active version is rendered in the chat list; other versions remain stored.
- Versions are capped by LRU pruning (starred versions are kept).

## Storage Fields

Each assistant reply may include:

- `replyToId` / `versionIdx`
- `versionActive` / `versionPinned`
- `lastViewedAt` (used by LRU pruning)
- `tokenUsage` / `costUsd`

## Sync Notes

Version arrays use append-only merge semantics when synced; see `docs/SYNC_STRATEGY.md`.
