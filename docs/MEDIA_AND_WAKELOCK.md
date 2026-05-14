# Media Session and Wake Lock

## Compatibility

| Platform | Wake Lock | Media Session | Notes |
| --- | --- | --- | --- |
| Chrome / Edge (Desktop) | Yes | Yes | Best experience; lock-screen controls supported |
| Chrome Android PWA | Yes | Yes | Media controls appear in notification shade |
| Safari iOS PWA | Partial | Partial | Some versions release wake lock on background; metadata behavior varies |
| Firefox | No/Partial | Partial | Media Session exists but actions support varies |

## Fallback Chain

The runtime uses multiple layers for training continuity:

1. `silentAudio` loop (baseline)
2. Picture-in-Picture (visual second channel)
3. Wake Lock (prevent screen from sleeping)
4. Media Session (lock screen controls)

If a layer is not available, it silently degrades (console info once), and the app continues with the remaining layers.

## Known Pitfalls

- iOS: backgrounding may release wake lock; switching tabs can require re-request.
- Media Session artwork and metadata display can be cached by the OS; clear metadata on stop.
- Lock screen action handlers must not throw.

## Debug Checklist

- Ensure `workout:state` events are firing.
- Confirm `navigator.wakeLock` exists before requesting.
- Confirm `navigator.mediaSession` exists before setting metadata.
- Verify `sw.js` precaches new scripts for offline training.
