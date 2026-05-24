# Android-First Optimization Notes

## Changed Files

Modified:
- `index.html`, `sw.js`
- `advice-panel.js`, `advice-prompt.js`, `advice-render.js`, `advice-stream-renderer.js`
- `ai-api.js`, `ai-store.js`
- `data.js`, `data-schema.js`, `data-ui-state.js`
- `routine-plan.js`, `routine-library.js`
- `toast.js`, `workout-core.js`, `workout-engine.js`, `workout-pip.js`
- `scripts/build-css.mjs`, `scripts/css-sections.mjs`
- `history-view.js`
- `css-src/01-vars.css`, `css-src/08-components-cards.css`, `css-src/16-history-hero-calendar.css`, `css-src/20-settings-ai.css`, `css-src/33-workout-input-card.css`, `css-src/35-components-modal.css`, `css-src/36-responsive.css`, `css-src/37-dark-mode.css`
- `build/generated.css`, `build/icons.txt`, `build/icons.csv`

Added:
- `haptics.js`
- `strength-form.js`
- `credential-fields.js`
- `sheet-drag.js`
- `ai-store-pure.mjs`
- `css-src/47-view-transitions.css`
- `css-src/48-advice-model-picker.css`
- `action-history.js`
- `weekly-plan.js`
- `css-src/49-action-history-weekly.css`
- `test/ai-override.test.mjs`
- `build/css-dedup-report.txt`

## Completion

P0:
- P0-1 M3 segmented buttons: revised done. The capsule segmented visual refactor was removed per follow-up direction. Existing `.mode-tabs`, `.record-tabs-scroll`, profile tabs, and `.voice-priority-group` visuals are preserved; only aria state sync remains.
- P0-2 haptics: done. Added `window.haptics`, default-on `db.prefs.haptics`, personalization switch, workout/timer/save/toast feedback hooks.
- P0-3 strength form usability: done. Defaults, presets, reps/work mutual exclusion, helper text, phase rest suggestion, and haptic feedback are implemented.
- P0-4 credential input safety: done. Password fields use `type="password"`, eye toggle auto-hides after 3s, and Base URL warns on non-HTTPS.
- P0-5 AI stream jitter: partial. Stream rendering now isolates the tail with `data-stream="tail"` and token animation; full stable-block freezing/new-message float was not completed.
- P0-6 calendar icon/mobile record visibility: done. Calendar events now render 2 items plus `+N`, mobile icon/text sizing is locked, 360px collapses events to compact color blocks, and AI coach blank page caused by missing model picker facade methods is fixed.
- P0-7 icon alignment regression: done. The CSS layer build put project icon sizing rules into layers while the Google Material Symbols stylesheet stayed unlayered, so browser cascade restored many icons to the font default size. The font import is now loaded into the lowest-priority `fonts` layer and generated CSS declares `@layer fonts, base, components, utilities, overrides`.
- P0-8 AI model picker/mobile sheet regression: done. Model icons now resolve from model family names instead of blindly using the API provider, the advice model chip is icon-only and refreshes immediately after selection, and bottom-sheet drag only starts from the handle/header so scrollable sheet content no longer collapses the sheet while browsing.
- P0-9 AI model picker scope tabs: done. The picker tabs now switch between current profile, other profiles, and cached model lists without closing the sheet.
- P0-10 AI model picker decoupling: done. The drawer now lists independently selectable cached/default models by provider scope; profiles are only used to locate credentials for a provider, not as the model option source. The chip and rows reuse the original `advice-model-*` themed fill colors while keeping the bottom-sheet picker.
- P0-11 calendar compact text and weekly icon regression: done. The 360px calendar no longer hides event text/icons as color-only bars, and weekly plan UI now uses `calendar_month` instead of the missing `week` symbol.
- P0-12 password visibility button styling: done. Credential eye buttons are now transparent M3E icon buttons with state-layer feedback, no browser-default border/background box.
- P0-13 AI coach top chrome gesture collapse: done. The AI coach header/filter chrome can again collapse from an upward gesture that starts on the title/filter area, restoring more visible chat text space.
- P0-14 AI coach filter tap flash: done. AI coach filter chips and icon toggles no longer show Android tap-highlight or pressed-color flashes when clicked.
- P0-15 stale app shell update path: done. `index.html` is no longer precached by the service worker, navigation requests use network `no-store`, SW registration uses stable `sw.js` with `updateViaCache: none`, new SW installs call `skipWaiting()`, and stale versioned asset requests such as `?v=114` are normalized to the active cache version.
- P0-16 AI coach filter blue background flash: done. AI coach card hover/active tint is disabled inside the chat surface, and filter active states use secondary container coloring to avoid a primary-blue flash during rerender.
- P0-17 AI coach composer placeholder/scrollbar polish: done. The "向 AI 提问" composer textarea now uses a stable 44dp empty height, vertically centered placeholder padding, and hidden scrollbars until content exceeds the maximum input height.

P0-6 DOM state examples:
```html
<!-- 412px: two readable rows + overflow chip -->
<div class="calendar-events">
  <span class="calendar-event"><span class="material-symbols-rounded">fitness_center</span>深蹲</span>
  <span class="calendar-event"><span class="material-symbols-rounded">directions_run</span>慢跑</span>
  <div class="calendar-event-more">+3</div>
</div>

<!-- 360px: same DOM, CSS hides text/icon and keeps compact color bars -->
<div class="calendar-events">
  <span class="calendar-event" style="--event-color:#2563eb">深蹲</span>
  <span class="calendar-event" style="--event-color:#059669">慢跑</span>
  <div class="calendar-event-more">+3</div>
</div>
```

P1:
- P1-1 bottom sheet drag: done. Added handle styling and generic touch drag-to-close for modal sheets.
- P1-2 single action history curve: partial. Added `action-history.js`, sheet, canvas chart, strength-log entry, and current-action entry; PR display is basic.
- P1-3 RPE/RIR input: partial. Added RPE selector and stores `rpe`/`extras.rpe`; no separate RIR UI.
- P1-4 FAB upgrade: partial. PiP button hides when unsupported and haptics were added; extended empty-state FAB and long-press stop ring were not completed.
- P1-5 weekly plan: partial. Added in-memory/data schema support and `weekly-plan.js`; library strip wiring is incomplete.
- P1-6 swipe delete undo toast: skipped. Existing `swipe-actions.js` only opens rows and does not own deletion.
- P1-7 View Transitions: done. `ui._activateTab` uses `document.startViewTransition` with CSS fade-through fallback.
- P1-8 AI review one-shot model picker: done. Override stays in memory only, `ai.getEffectiveConfig()` drives calls and pricing, version bubbles record the effective model/provider.
- P1-9 training plan card import entry cleanup: done. The workout plan card now always renders one top toolbar for 方案库、动作库、手动添加 and today's weekly-plan binding. The empty weekly banner is removed, and the today-plan banner only appears when a bound routine has not already been loaded.

P1-8 DOM state examples:
```html
<button class="advice-model-chip">
  <img src="assets/model-icons/openai.svg" alt="">
  <span>gpt-4o-mini</span><small>默认</small>
</button>
<button class="advice-model-chip is-override">
  <img src="assets/model-icons/claude.svg" alt="">
  <span>claude-sonnet</span><small>临时</small><span class="advice-model-chip-x">×</span>
</button>
```

P2/P3:
- P2-1 M3 token completion: done for tokens required by this pass.
- P2-2 IDB migration for history/advice: skipped.
- P2-3 wake lock visualization: done. The timer panel shows a small `lock` indicator while screen wake lock is active and `lock_open` when training is active but the lock is unavailable/released; tapping retries the request.
- P2-4 routine JSON save from AI output: skipped.
- P2-5 CSS engineering cleanup: done. Build now emits layer-wrapped CSS and `build/css-dedup-report.txt`; optional `lightningcss` minify is used only if installed.
- P3-1 diet photo recognition: skipped.

## Verification Log

Version:
```text
node scripts/bump-version.js
Collected 120 icons -> build/icons.txt, build/icons.csv
bumped to v116 (patch)

node scripts/bump-version.js
Collected 120 icons -> build/icons.txt, build/icons.csv
bumped to v117 (patch)

node scripts/bump-version.js
Collected 120 icons -> build/icons.txt, build/icons.csv
bumped to v118 (patch)

node scripts/bump-version.js
Collected 120 icons -> build/icons.txt, build/icons.csv
bumped to v120 (patch)

node scripts/bump-version.js
Collected 120 icons -> build/icons.txt, build/icons.csv
bumped to v121 (patch)

node scripts/bump-version.js --check
version sync OK (v121)
```

CSS:
```text
npm run build:css
Generated build\generated.css from 48 source files
```

CI:
```text
npm run ci
eslint -c .eslintrc.cjs --quiet .
tsc -p tsconfig.check.json
node --test test/*.test.mjs
tests 56, pass 56, fail 0

size-limit:
first-paint-critical-js 22.13 kB / 60 kB
generated-css 23.82 kB / 80 kB
workout-bundle 24.13 kB / 50 kB
ai-bundle 34.43 kB / 50 kB
```

Note: PowerShell printed an npm/npx profile warning about denied access to `C:\Users\YING\AppData\Roaming\npm\...`, but each command continued and exited successfully.

## Suggested Commit Split

1. `feat(ui): add Android haptics and safer mobile forms`
   - `index.html`, `haptics.js`, `strength-form.js`, `credential-fields.js`, input/password CSS, workout/routine/toast hooks.
2. `feat(ai): support one-shot advice model override`
   - `ai-store.js`, `ai-api.js`, `advice-panel.js`, `advice-prompt.js`, `advice-render.js`, `ai-store-pure.mjs`, `test/ai-override.test.mjs`, model picker CSS.
3. `feat(modal): add draggable bottom sheets and view transitions`
   - `sheet-drag.js`, modal CSS, view-transition CSS, `index.html`, `sw.js`.
4. `build(css): layer generated CSS and emit dedupe report`
   - `scripts/build-css.mjs`, `scripts/css-sections.mjs`, `build/generated.css`, `build/css-dedup-report.txt`.
5. `chore(pwa): bump local asset version to v107`
   - `index.html`, `sw.js`, `build/icons.txt`, `build/icons.csv`.
