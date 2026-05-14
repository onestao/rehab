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

## Startup Sequence

```mermaid
sequenceDiagram
    participant Browser
    participant HTML as index.html
    participant Theme as theme
    participant SW as appUpdate
    participant Lazy as ensureDeps
    participant Data as data.init

    Browser->>HTML: load shell
    HTML->>Theme: theme.init()
    HTML->>SW: registerServiceWorker()
    HTML->>Lazy: ensureDeps(activePage)
    HTML->>Data: data.init()
    Data->>Data: normalizeDb / restore state
    Data->>HTML: first render
    Browser->>Lazy: tab change
    Lazy->>Data: refreshModules()
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
    DATA --> AI[ai modules]
    DATA --> SYNC[sync.js]
    WORKOUT[workout modules] --> DATA
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
