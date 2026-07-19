# Navigation Lifecycle

How hash routes, DOM active page, and `navStack` stay aligned after lazyload repair.

## Layers

1. **Hash / `appRoute`** — parse/serialize `#/profile/library`, deep-link `apply`
2. **`ui._activateTab` + `_navigationToken`** — page shell activation generation
3. **`navStack`** — tab / subtab / modal frames + History API
4. **Side effects** — `ensureDeps` (pure load) vs `activatePageSideEffects` (render after active)

## Deep-link first paint (FIND-02/03)

- Early shell in `index.html` paints the hash target page active before full boot
- `appRoute.apply` calls `_activateTab` with `preserveSubroute: true`
- **FIND-08:** subroute fields (`healthView`, `routineView`, `adviceRange`) are staged and committed **only after** activate succeeds for the current intent token
- `navStack.replaceTopOrPushTab` / `resetToRoot` keeps stack aligned with tab

## Back semantics (FIND-04 / B-T4)

| Environment | Root behavior | Stacked frames |
| --- | --- | --- |
| Plain browser (`navStack.mode = browser`) | At Today root, system back may leave the site (no infinite trap) | Close top frame: modal → subtab → tab → Today |
| PWA / standalone (`mode = pwa`) | At root, re-push root state so back does not dump a blank shell | Same ordered close |

Detection: `display-mode: standalone|minimal-ui` or `navigator.standalone`.

## Modal frames

- Route-bound modals use `data-rl-modal="1"` and push `{ type: 'modal', close }`
- **FIND-09:** `appRoute.apply` closes active route-bound modal unless `preserveModal`
- `requestClose` / `history.back` / popstate all prefer closing the top frame

## Workout guard

- If `workout.isPlaying`, popstate runs `handleBackGuard` and re-asserts history state

## Tests

- Browser: `test/deep-link-nav.browser.test.mjs` (B-T1..T4)
- Unit: `test/nav-stack-lifecycle.test.mjs`, `test/app-route.test.mjs`
