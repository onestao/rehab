# Today AI Picker Readiness Hotfix (v343)

**Branch:** `hotfix/today-ai-picker-readiness-v343`
**Worktree:** `G:/LLM/rehab/.claude/worktrees/today-ai-picker-v343`
**Temp / evidence:** `G:/LLM/rehab/.tmp/today-ai-picker-v343/`
**Base:** `perfrom` @ `4aed616` (v342 freeze tip)
**Date:** 2026-07-20
**Push:** no
**Merge:** no

## 根因

这不是“模型配置不存在”，而是 **Today 冷启动路径从未建立 AI picker readiness**。

观察到的生产路径：

1. 全新冷启动停在 Today，不访问“我的”。
2. 打开饮食记录 / 周计划 AI → 模型选择控件为空或缺失。
3. 先点“我的”，再回 Today → 同一配置下按钮出现。

技术链：

| 环节 | 修复前行为 |
|---|---|
| `PAGE_DEPS.today` | 只有 `history-view` + `today-view-core`，不含 AI 链 |
| `PAGE_DEPS.profile` | 加载完整 AI 链（`ai-store`…`ai-task-settings`）并在 `ensureDeps` 中 `ai.init()` |
| `LAZY_RECORD_OPENERS.openDietModal` | 只加载 `fooddb` / `health-diet` / `food-log` |
| `openDietModal()` | 生成 `data-ai-task-picker` 节点后 **不** 确保 picker runtime / 不显式 mount |
| `openPlanAiSheet()` | `window.aiTaskSettings?.mountPlanAiPicker?.()` **可选链静默 no-op** |
| `ai-task-settings` boot | 依赖 script 已加载 + MutationObserver / `ai:ready`；Today 从未加载该脚本时这些机制都无效 |

结论：**script loaded ≠ client initialized ≠ models hydrated ≠ routes ready ≠ picker mounted**。
Profile 偶然“修好”只是因为 Profile 的 `PAGE_DEPS` 拉起了 AI 链；不应把 Profile 依赖写进产品路径。

## 修改文件

| 文件 | 变更 |
|---|---|
| `data.js` | 新增 `data.ensureAiPickerRuntime({ vision })`：single-flight readiness gate（`unloaded/loading/ready/failed`），复用 `ensureAiRuntime` + `loadAppScripts(['ai-task-settings'])`，校验真实 API |
| `health-diet.js` | `openDietModal` 后确定性 `mountDietAiPickers`：placeholder → ensure → `mountInlinePickers(scope, { force: true })`；失败中文错误 + 重试；generation 防 late write |
| `plan-ai.js` | 去掉可选链 no-op；`mountPlanAiPickerReady` 确定性 ensure + `mountPlanAiPicker({ force: true })` |
| `ai-task-settings.js` | `mountPlanAiPicker(options = {})` 支持 `force: true`，失败/重试可重挂 |
| `package.json` | `test:browser:lazyload` 纳入新 browser 测试 |
| `test/today-ai-picker-readiness.browser.test.mjs` | T1–T8 真实 Edge/Playwright 冷启动门禁 |
| `test/ai-task-settings.test.mjs` | 源码契约：计划 picker 显式 readiness |
| `test/perf-loading-smoke.test.mjs` | 契约：`ensureAiPickerRuntime` / diet mount |
| 版本门禁 fixture | `service-worker-version-gate` / `version-fetch` / `a11y-focus-trap-ready` / `controller-reload-claim` / `app-update-session-safety` / evidence script 同步 v343 |
| `index.html` / `sw.js` / `app-update.js` / build icons | `node scripts/bump-version.js --patch` → **v343** |
| `docs/audits/today-ai-picker-readiness-hotfix.md` | 本审计 |

**未采用的修法：** 未把 Profile `PAGE_DEPS` 复制进 Today；未首屏同步加载全部 AI 模块；未靠 sleep / 仅 MutationObserver / 仅 `ai:ready` / 虚假 dispatch。

## 冷启动复现（修复前语义）

R1 饮食：Today 打开饮食 modal → `data-ai-task-picker` 存在但无 `button.ai-compact-model`；`window.aiTaskSettings` 通常不存在。
R2 计划：`openPlanAiSheet` 可选链直接结束，`#planAiTaskPicker` 不出现。
访问 Profile 后再打开同一入口则恢复。

## 修复后结果

冷启动停留 Today、从不访问 Profile：

- 饮食 `food.text` / `food.vision` 首次打开即出现模型按钮；
- 周计划 `plan.week` 首次打开即出现模型按钮；
- 加载中显示「正在加载模型…」；失败显示中文错误 +「重试」；
- 并发打开 single-flight；关闭再开可 force remount；
- `ai:ready` 先于 DOM 时仍靠显式 mount 成功。

## 新测试

文件：`test/today-ai-picker-readiness.browser.test.mjs`
Evidence：`G:/LLM/rehab/.tmp/today-ai-picker-v343/playwright/`

| ID | 内容 | 结果 |
|---|---|---|
| source contract | Today PAGE_DEPS 不含 AI 全链；openers 使用 readiness | pass |
| T1 | Diet text cold picker | pass |
| T2 | Diet vision cold picker + 打开列表 | pass |
| T3 | Plan week cold picker | pass |
| T4 | 嵌在 T1–T3 内：active page 始终 Today，Profile 从未激活 | pass |
| T5 | Single-flight：`ai-task-settings` request = 1 | pass |
| T6 | 首次 404 → 中文失败/重试 → 恢复按钮 | pass |
| T7 | Early `ai:ready` 后仍显式 mount | pass |
| T8 | 打开→关闭→再打开仍 mount | pass |

## 全量门禁

```text
git diff --check                         OK
node scripts/bump-version.js --check     version sync OK (v343)
npm run test:unit                        716 pass / 0 fail
npm run test:browser:lazyload            22 pass / 0 fail
npm run test:evidence:lazyload           10 pass / 0 fail
npm run test:release                     pass
```

## 版本

| 项 | 值 |
|---|---|
| release | **343** |
| SW cache | `training-assistant-v343` |
| query `?v=` | `343` |
| `__rehab_upgrade` | `343` |
| controller reload key | `rehab-sw-controller-reload-v343` |
| app-update version | `343` |

## 性能影响

- **Today 首屏：** 无变化（`PAGE_DEPS.today` 未膨胀）。
- **首次打开饮食/计划 AI：** 多一次 shared AI picker readiness（`ensureAiRuntime` + `ai-task-settings` 及其 prereq）；single-flight，后续打开复用 ready。
- **未** 把 AI 全链同步塞进 Today 首屏。

## 是否 push / merge

- **Push:** 否
- **Merge:** 否
- 仅本地 hotfix 分支 + 项目内 worktree；完成后停止。

## Final candidate freeze

| Item | Value |
|---|---|
| Final candidate HEAD | `b3346c78be2d4572fe70fbce898bbde0c9e48784` (freeze report; merge tip = pin commit after this) |
| Branch | `hotfix/today-ai-picker-readiness-v343` |
| Base | `perfrom` @ `4aed61659ea6e830346c66405fb6f90823f04c1a` |
| Working tree | **clean** (no tracked dirt; no .tmp/trace/profile/log in commits) |
| `perfrom` | `4aed61659ea6e830346c66405fb6f90823f04c1a` |
| `origin/perfrom` | `4aed61659ea6e830346c66405fb6f90823f04c1a` |
| merge-base(perfrom, hotfix) | `4aed61659ea6e830346c66405fb6f90823f04c1a` |
| `perfrom..hotfix` | product fix + tests + v343 bump + audit + freeze + pin |
| `hotfix..perfrom` | **empty** |
| FF-only feasible | **yes** — `git merge --ff-only hotfix/today-ai-picker-readiness-v343` |
| Production version | **v343** (`node scripts/bump-version.js --check` → version sync OK) |
| Push | **no** |
| Merge | **no** |

### Commit list (`4aed616..HEAD`)

1. `df509e2` fix: cold Today diet/plan AI pickers via shared readiness gate
2. `8aab1c6` test: cover cold Today AI picker readiness T1-T8
3. `d55d78a` chore: bump release assets to v343
4. `d7a78fb` docs: audit Today AI picker readiness hotfix
5. `b3346c78be2d4572fe70fbce898bbde0c9e48784` docs: freeze Today AI picker v343 candidate
6. *(pin commit tip)* docs: pin freeze tip SHA after freeze report

### Final gates (re-run on freeze candidate)

| Gate | Result |
|---|---|
| `git diff --check` | OK |
| `node scripts/bump-version.js --check` | version sync OK (v343) |
| unit (`test/*.test.mjs`) | **716 pass / 0 fail** |
| browser (`test:browser:lazyload`) | **22 pass / 0 fail** |
| evidence (`test:evidence:lazyload`) | **10 pass / 0 fail** |
| `npm run test:release` | **exit 0** |
| duration | **155 s** (2026-07-20T14:42:20 → 14:44:55 +08:00) |
| Edge / Chromium | **msedge 150.0.4078.83** (`playwright` channel `msedge`) |
| log | `G:/LLM/rehab/.tmp/today-ai-picker-v343/final-freeze-gates.log` |

### Topology verdict

- `perfrom` is ancestor of hotfix: **yes**
- `hotfix..perfrom` empty: **yes**
- `perfrom` not moved past base: **yes** (`perfrom` == `origin/perfrom` == `4aed616`)
- FF-only merge path: **allowed** (no squash / no ordinary merge / no rebase)

### Files in range (no temp/trace/profile/log)

18 product/test/doc paths under version control. Browser `build/fooddb-diet-profile-*` never committed. Evidence/logs only under `G:/LLM/rehab/.tmp/today-ai-picker-v343/`.
