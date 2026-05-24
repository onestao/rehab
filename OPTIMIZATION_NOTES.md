# Android-First Optimization Notes

## Changed Files

Modified:
- `index.html`, `sw.js`
- `advice-panel.js`, `advice-prompt.js`, `advice-render.js`, `advice-stream-renderer.js`
- `ai-api.js`, `ai-store.js`
- `data.js`, `data-schema.js`, `data-ui-state.js`, `data-store.js`, `data-records.js`
- `storage/migrate.js`, `storage/migrate-pure.js`
- `routine-plan.js`, `routine-library.js`
- `toast.js`, `workout-core.js`, `workout-engine.js`, `workout-pip.js`
- `scripts/build-css.mjs`, `scripts/css-sections.mjs`
- `history-view.js`, `food-log.js`, `health-diet.js`, `health-weight.js`, `health-exercise.js`, `action-history.js`
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
- `test/migrate-history.test.mjs`
- `build/css-dedup-report.txt`

## Completion

P0:
- P0-1 M3 segmented buttons: revised done. The capsule segmented visual refactor was removed per follow-up direction. Existing `.mode-tabs`, `.record-tabs-scroll`, profile tabs, and `.voice-priority-group` visuals are preserved; only aria state sync remains.
- P0-2 haptics: done. Added `window.haptics`, default-on `db.prefs.haptics`, personalization switch, workout/timer/save/toast feedback hooks.
- P0-3 strength form usability: done. Defaults, presets, reps/work mutual exclusion, helper text, phase rest suggestion, and haptic feedback are implemented.
- P0-4 credential input safety: done. Password fields use `type="password"`, eye toggle auto-hides after 3s, and Base URL warns on non-HTTPS.
- P0-5 AI stream jitter: done. Stream rendering now freezes stable paragraph blocks into `data-stream="stable"`/`data-stream="committed"` nodes, only re-renders the live `data-stream="tail"` block, keeps token-in animation, and shows a `↓ 新消息` float when user scroll intent pauses auto-follow.
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
- P1-2 single action history curve: done. Added sheet/canvas/list entries and fixed PR handling by computing per-action bests from `db.history`; PR points are highlighted with tertiary markers.
- P1-3 RPE/RIR input: done. Set review now records RPE and RIR, storing both top-level values and `extras.rpe`/`extras.rir`.
- P1-4 FAB upgrade: done. Empty state play FAB is extended with text, training state morphs compact, pause state has stronger shape, PiP hides when unsupported, and stop requires a 1.5s long press with progress ring and medium haptic.
- P1-5 weekly plan: done. Weekly plan strip and direct today binding entry are wired, and the workout banner only appears for unloaded bound routines.
- P1-6 swipe delete undo toast: done. Delete actions now use soft-delete + toast action undo across history, plan actions, food, weight, manual exercise, and AI advice/version messages.
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
- P2-2 IDB migration for history/advice: done. IDB adapter now splits `db.history` and `db.health.aiAdviceChat` into separate IDB keys, hydrates them back into memory, keeps legacy full local snapshot for rollback, and localStorage flushes the light meta snapshot.
- P2-3 wake lock visualization: done. The timer panel shows a small `lock` indicator while screen wake lock is active and `lock_open` when training is active but the lock is unavailable/released; tapping retries the request.
- P2-4 routine JSON save from AI output: done. Assistant replies with fenced ```routine JSON blocks show a "保存到方案库" action, validate/normalize actions strictly, prompt for name/tags, and save through the existing routine library schema.
- P2-5 CSS engineering cleanup: done. Build now emits layer-wrapped CSS and `build/css-dedup-report.txt`; optional `lightningcss` minify is used only if installed.
- P3-1 diet photo recognition: done. Added Android camera file input and wired "拍照识别" to multimodal API (OpenAI Chat/Responses, Claude, Gemini) with image resize+base64; results reuse the existing AI food list UI.

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

node scripts/bump-version.js
Collected 120 icons -> build/icons.txt, build/icons.csv
bumped to v122 (patch)

node scripts/bump-version.js --check
version sync OK (v122)
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
tests 57, pass 57, fail 0

size-limit:
first-paint-critical-js 22.67 kB / 60 kB
generated-css 24.21 kB / 80 kB
workout-bundle 24.84 kB / 50 kB
ai-bundle 36.83 kB / 50 kB

npx --yes size-limit
first-paint-critical-js 22.67 kB / 60 kB
generated-css 24.21 kB / 80 kB
workout-bundle 24.84 kB / 50 kB
ai-bundle 36.83 kB / 50 kB
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
5. `chore(pwa): bump local asset version to v122`
   - `index.html`, `sw.js`, `build/icons.txt`, `build/icons.csv`.
6. `feat(workout): complete FAB, RPE/RIR, history PR, and undo deletes`
   - `index.html`, `workout-core.js`, `routine-plan.js`, `data-records.js`, `history-view.js`, `food-log.js`, `health-weight.js`, `health-exercise.js`, `action-history.js`, related CSS.
7. `feat(ai): freeze stream tail and save routine JSON outputs`
   - `advice-stream-renderer.js`, `advice-panel.js`, `advice-render.js`, `css-src/18-health-diet.css`.
8. `feat(storage): split history and advice into IndexedDB`
   - `storage/migrate.js`, `storage/migrate-pure.js`, `data-store.js`, `test/migrate-history.test.mjs`.
9. `feat(diet): add camera recognition entry`
   - `health-diet.js`, `css-src/18-health-diet.css`.

## Rehab Daily Plan（v4.1）
- R1 数据层与内置链: done
- R2 道具偏好面板: done
- R3 今日主卡（折叠+紧凑手动记录）: done
- R4 任务行单击直跑: done
- R5 5 档体感反馈: done
- R6 挂载式 30s 放松 toast: done
- R7 进阶链升降级: done
- R8 本周抽屉: done
- R9 AI 上下文注入 + JSON schema: done
- R10 底部常驻栏: done
- R11 完成存方案提示: done
- R12 自由记录回到原位（紧凑形态）: done
- R13 记录页区分: done

涉及文件：
- 新增 `rehab-chains.js`, `rehab-store.js`, `rehab-ui.js`, `rehab-cooldown.js`, `rehab-feedback.js`, `rehab-weekly.js`, `rehab-ai.js`, `rehab-equipment.js`, `rehab-dock.js`
- 新增纯模块与测试 `rehab-progression-pure.js`, `rehab-store-pure.js`, `test/rehab-progression.test.mjs`, `test/rehab-store.test.mjs`
- 新增样式 `css-src/49-rehab.css`
- 修改 `data.js`, `data-schema.js`, `data-store.js`, `data-views.js`, `sync.js`, `sync-pure.js`, `history-view.js`, `routine-library.js`, `workout-core.js`, `index.html`, `sw.js`, `scripts/css-sections.mjs`

[ci 日志贴]
```text
node scripts/bump-version.js
Collected 121 icons -> build/icons.txt, build/icons.csv
bumped to v125 (patch)

npm run build:css
Generated build\generated.css from 49 source files

node scripts/bump-version.js --check
version sync OK (v125)

npm run ci
eslint -c .eslintrc.cjs --quiet .
tsc -p tsconfig.check.json
node --test test/*.test.mjs
tests 73, pass 73, fail 0

size-limit:
first-paint-critical-js 22.77 kB / 60 kB
generated-css 24.98 kB / 80 kB
workout-bundle 24.98 kB / 50 kB
ai-bundle 38.52 kB / 50 kB
```

补齐剩余三项后：
```text
node scripts/bump-version.js
Collected 121 icons -> build/icons.txt, build/icons.csv
bumped to v126 (patch)

npm run build:css
Generated build\generated.css from 49 source files

node scripts/bump-version.js --check
version sync OK (v126)

npm run ci
eslint -c .eslintrc.cjs --quiet .
tsc -p tsconfig.check.json
node --test test/*.test.mjs
tests 73, pass 73, fail 0

size-limit:
first-paint-critical-js 22.77 kB / 60 kB
generated-css 25.16 kB / 80 kB
workout-bundle 25 kB / 50 kB
ai-bundle 38.52 kB / 50 kB
```

补齐说明：
- R8：本周抽屉任务行支持长按拖动，拖到周内日期行后跨日移动。
- R9：AI 预览卡支持逐条编辑动作名、组数、次数、时长、休息和理由，支持增删动作后再落库。
- R11：存方案提示改为三按钮 sheet（不用 / 改名后存 / 默认存），并按完成率 >= 80% 且 23:00 后或用户主动结束训练触发；保存后写入 `rehabPlanId` 并避免重复提示。

[折叠态主卡 + 紧凑手动记录段 DOM 片段]
```html
<div class="md-card rehab-today-card">
  <div class="rehab-today-head">
    <div>
      <span class="cardio-kicker">康复计划</span>
      <h3>1/4 已完成</h3>
    </div>
    <span class="material-symbols-rounded">health_and_safety</span>
  </div>
  <div class="rehab-progress"><i style="width:25%"></i></div>
  <div class="rehab-current-block">
    <strong>康复·桥式保持</strong>
    <small>下一项 · 3组 · 30秒</small>
  </div>
  <div class="rehab-compact-list">...</div>
  <button class="rehab-expand-btn" type="button">展开全部 4 项</button>
  <div class="rehab-manual-strip">
    <div class="rehab-manual-divider">┄ 手动记录 ┄</div>
    <div class="rehab-manual-actions">
      <button class="md-chip rehab-manual-chip">💪 力量</button>
      <button class="md-chip rehab-manual-chip">🏃 有氧</button>
      <button class="md-chip rehab-manual-chip">⚖️ 体重</button>
      <button class="md-chip rehab-manual-chip">🍱 饮食</button>
    </div>
  </div>
</div>
```

[底部常驻栏 DOM 片段]
```html
<div class="rehab-dock" id="rehabDock">
  <button class="md-chip rehab-dock-chip"><span class="material-symbols-rounded">self_improvement</span>待拉伸 2</button>
  <button class="md-chip rehab-dock-chip has-alert"><span class="material-symbols-rounded">week</span>本周 12/35</button>
  <button class="md-chip rehab-dock-chip"><span class="material-symbols-rounded">auto_awesome</span>AI</button>
</div>
```

[内置进阶链 12 条概览]
```text
1. 髋外展
2. 桥式
3. 深蹲
4. 踝背屈
5. 肩外旋
6. 核心稳定
7. 腰椎激活
8. 膝伸
9. 单腿平衡
10. 胸椎活动
11. 髋屈
12. 踝跖屈
```

[建议 commit 拆分计划]
1. `feat(rehab): add rehab data model, builtin progression chains, and sync entities`
   - `rehab-chains.js`, `rehab-store.js`, `rehab-progression-pure.js`, `rehab-store-pure.js`, `data.js`, `data-schema.js`, `data-store.js`, `sync.js`, `sync-pure.js`, tests
2. `feat(rehab-ui): add today rehab card, feedback flow, cooldown prompt, and dock`
   - `rehab-ui.js`, `rehab-feedback.js`, `rehab-cooldown.js`, `rehab-dock.js`, `workout-core.js`, `data-views.js`, `index.html`, `css-src/49-rehab.css`
3. `feat(rehab-ai): add rehab weekly sheet, equipment prefs, and AI plan generation`
   - `rehab-weekly.js`, `rehab-equipment.js`, `rehab-ai.js`, `routine-library.js`, `advice-panel.js`, `index.html`
4. `feat(history): distinguish rehab records in calendar and day detail`
   - `history-view.js`
5. `chore(pwa): register rehab assets and bump local version to v125`
   - `sw.js`, `scripts/css-sections.mjs`, `build/generated.css`, `build/icons.txt`, `build/icons.csv`, `index.html`
