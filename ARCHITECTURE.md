# Architecture

## Structure

- root `*.js`: browser runtime modules in IIFE/global-object style
- `storage/`: adapters and migration helpers
- `scripts/`: maintenance/build tools using ESM
- `test/`: node:test suites for pure logic
- `docs/`: design and operations documentation

## Runtime Globals

- `window.data`
- `window.workout`
- `window.ai`
- `window.sync`
- `window.syncStatus`
- `window.errorBus`
- `window.theme`
- `window.backup`
- `window.prTracker`
- `window.volumeHeatmap`

## Startup Sequence

```mermaid
sequenceDiagram
    participant Browser
    participant HTML as index.html
    participant Theme as theme
    participant SW as appUpdate
    participant Lazy as ensureDeps
    participant Data as data.init
    participant WL as workoutWakeLock
    participant MS as workoutMediaSession

    Browser->>HTML: load shell
    HTML->>Theme: theme.init()
    HTML->>SW: registerServiceWorker()
    HTML->>Lazy: ensureDeps(activePage)
    HTML->>Data: data.init()
    Data->>Data: normalizeDb / restore state
    Data->>HTML: first render
    Browser->>Lazy: tab change
    Lazy->>Data: refreshModules()
    Data->>WL: workout:state events
    Data->>MS: workout:state events
```

## Module Graph

```mermaid
graph LR
    UI[index.html] --> DATA[data.js]
    UI --> THEME[theme.js]
    UI --> ERR[error-bus.js]
    DATA --> STORE[data-store.js]
    STORE --> IDB[storage/idb.js]
    STORE --> MIG[storage/migrate.js]
    DATA --> HEALTH[health modules]
    DATA --> HISTORY[history-view.js]
    DATA --> ROUTINES[routine-library.js]
    DATA --> PR[pr-tracker.js]
    DATA --> HEATMAP[volume-heatmap.js]
    DATA --> AI[ai modules]
    DATA --> SYNC[sync.js]
    WORKOUT[workout modules] --> DATA
    WORKOUT --> WL[workout-wakelock.js]
    WORKOUT --> MS[workout-media-session.js]
    SYNC --> STATUS[sync-status.js]
```

## Sync Flow

```mermaid
flowchart LR
    A[Local mutation] --> B[data.save/saveAndBackup]
    B --> C[sync.pushChanges]
    C --> D{success?}
    D -- yes --> E[manifest/status update]
    D -- no --> F[pendingQueue]
    F --> G[online event / timed flush]
    G --> C
```

## Profile Page Layout

- `#profile` overview rendered by `data.renderProfileIdentityCard()` as single identity card
- Sub-tabs: library / weightloss / ai / sync (`data.routineView`)
- Theme/dark/language controlled by top-bar `.theme-trigger` opening `#themeSheet`
- `#profileSettings` container holds `[data-settings="ai"]` and `[data-settings="sync"]` cards, toggled by sub-tab

### Library Sub-Module

- 「库」子 Tab 内含两段视图：`actions`（动作库）/`routines`（方案库）
- 状态字段：`db.libraryView`（当前段）与 `db.libraryFilterTag`（共享标签过滤）
- 交互：点击 segment 与左右滑动 deck 都通过 `data.setLibraryView()` 同步
- 标签字典通过 `data.collectLibraryTags()` 从 actions+routines 合并去重
- 删除动作前通过 `countActionReferences()` 计算被方案引用次数并提示风险
