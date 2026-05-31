# Android PWA Smoke Test

Run this checklist on a real Android phone with Chrome after each release that changes PWA, training timing, storage, sync, camera, AI, or Service Worker behavior.

## Install And Offline

1. Open the deployed site in Chrome.
2. Use Add to Home screen and launch from the installed icon.
3. Confirm the app opens standalone, not as a regular browser tab.
4. Long press the app icon and confirm shortcuts appear for training, today, AI, and sync.
5. Turn on airplane mode and relaunch the app.
6. Confirm the Today and Workout pages render without network.
7. Open Sync settings and run the PWA offline check.
8. Confirm local icon and core assets are reported as cached.

## Training Reliability

1. Add or load a strength plan with at least one timed movement and one rest period.
2. Start training and confirm the readiness banner reports Wake Lock, Media Session, PiP, and offline status.
3. Lock the screen for 20 seconds, unlock, and confirm the timer has advanced by real elapsed time.
4. Switch to another app for 20 seconds, return, and confirm remaining time is corrected.
5. Pause training, wait 10 seconds, and confirm the timer does not advance while paused.
6. Resume, skip, previous, and stop from the in-app controls.
7. If notification shade media controls appear, test pause and next.
8. Complete a session longer than 20 seconds and confirm history is saved.

## Backup And Sync

1. Open Profile > Cloud Sync.
2. Tap Local data preview and confirm counts match expected training, routines, diet, weight, and AI records.
3. Export a backup and confirm a `.json.gz` file downloads.
4. Import the exported backup and confirm the preview appears before overwrite.
5. Cancel once, then repeat and confirm the final confirmation protects overwrite.
6. Configure WebDAV or S3 on a test bucket/path.
7. Push, pull, and retry queue if any failure appears.
8. Confirm Sync health shows mode, last sync, pending queue, conflict count, archive date, and queue reason.

## AI And Camera

1. Configure an AI profile.
2. On Today, tap Generate weekly summary.
3. Confirm the AI prompt uses recent 7-day context and includes fatigue/deload analysis.
4. Add a diet photo through the camera input.
5. Confirm the preview/recognition flow works and no credentials are shown in logs or exported plain text.

## Update Path

1. Deploy a new version.
2. Relaunch the installed PWA.
3. Confirm the update banner appears or the app refreshes into the new version.
4. Confirm old cached assets are not used after refresh.
