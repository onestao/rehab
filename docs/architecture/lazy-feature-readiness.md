# Lazy Feature Readiness

Contract for deferred modules that must not fail silently on first user click.

## States

| State | Meaning |
| --- | --- |
| `unloaded` | Scripts not requested yet |
| `loading` | Single-flight load in progress |
| `ready` | Owner methods registered on `data` / window |
| `failed` | Last load failed; user saw Chinese toast; retry allowed |

## Plan Feature Gate

- Owner: `data.planFeatureGate` in `data.js`
- Stubbed openers (`LAZY_PLAN_OPENERS`): `openNewPlanSheet`, `openPlanTaskDrawer`, `handlePlanTaskTap`, `selectTodayPlan`, `openPlanTodayAiSheet`, `enhanceTodayPage`
- First click runs `gate.run` → `ensureReady` → load `plan-ui` → replay once
- Route cancel: if active page or `_navigationToken` changed after click, do not open
- Fail toast: `计划功能暂时未加载成功。请检查网络后重试，已保存的训练记录不会丢失。`

## Non-gate but non-silent openers

| Opener | Load path | Fail toast |
| --- | --- | --- |
| `openPlanWeeklySheet` | `plan-weekly` then `plan-ui` fallback | 近期计划功能暂时未加载成功… |
| `openPlanAiSheet` | `plan-ai` | AI 计划… |
| Record modals | `fooddb` / health modules | 饮食/体重/运动记录加载失败… |
| `checkAppUpdate` | `app-update` | 更新模块… |

## Today hard buttons (FIND-07)

- Must call `data.openPlanWeeklySheet()` / `data.openPlanTodayAiSheet()` **without** `?.` silent no-ops
- Source of truth for first paint: `today-view-core.js`

## Busy feedback

- `beginActionBusy` / `endActionBusy` disable matching `[onclick*="…"]` nodes and set `aria-busy`

## Tests

- Unit: `test/plan-feature-gate.test.mjs`
- Browser: `test/plan-feature-gate.browser.test.mjs` (A-T* + H1-T*)
