# Smoke Test

Run this after changes to app shell, data, sync, workout, AI, or PWA caching.

## Boot

- Open the app through a local static server or deployed static page.
- Confirm no console errors on first load.
- Refresh once and confirm the app still renders.

## Today

- Add a food record.
- Edit the food record.
- Delete the food record.
- Confirm totals update.

## Workout

- Open the Workout tab.
- Add a strength action.
- Start, pause, resume, and stop a workout.
- Use skip/previous controls if visible.
- Confirm a saved record appears in records.

## Cardio

- Switch to cardio mode.
- Start cardio and run at least 20 seconds.
- Stop, edit calories, and save.
- Confirm the cardio history record appears.

## Records

- Open records.
- Switch between record views.
- Confirm calendar/history content renders.

## AI Coach

- Open AI Coach.
- Open template manager.
- Create, edit, select, export, and delete a template.
- With no key configured, confirm the error path is visible and non-crashing.

## Sync

- Open Profile settings.
- Switch sync mode between none, S3, and WebDAV.
- Confirm the correct fields show and hide.
- Save config and confirm status chip updates.

## PWA

- Refresh after Service Worker install.
- Confirm static resources still load offline if supported by the browser test environment.
