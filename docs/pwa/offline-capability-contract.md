# Offline Capability Contract (v342 / Scheme B)

**Scheme B (narrowed promise):** full offline rehab is **not** claimed. Cold offline supports the **essential Today golden path** that is pre-cached in the Service Worker `ASSETS` list.

## Guaranteed offline (must work after first online install)

- App shell: `index.html`, core CSS/JS in `ASSETS`
- Today first paint (`today-view-core` + PAGE_DEPS.today closure including `history-view`)
- Focus trap module for modals (`a11y-focus-trap.js`)
- Update / session safety modules that are in `ASSETS`

## Best-effort / may degrade offline

- Plan interaction (`plan-ui`, `plan-weekly`) if not yet cached
- AI, food DB search extras, optional sheets not in `ASSETS`
- External fonts / network-only APIs

## Degrade UX (required, non-silent)

When a lazy feature fails offline or network-missing:

- Chinese toast via existing plan/record/update openers (see lazy-feature-readiness)
- No silent `?.` no-op on Today hard buttons
- Gate state `failed` allows retry when online

## What we do **not** promise

- Complete offline workout library authoring
- Offline AI generation
- Offline multi-day plan editing without prior cache of those modules

## Verification

- Unit closure: `test/offline-essential-closure.test.mjs` (PAGE_DEPS.today ⊆ ASSETS)
- Evidence harness: `scripts/verify-lazyload-repair-evidence.mjs` (optional SW-on path)
- Do not mark “full offline rehab” DONE without a dedicated E3 cold-offline run of every claimed surface

## Owner

- SW `ASSETS` / install: keep essential Today closure in precache when PAGE_DEPS grow
- Product: expand offline only with new ASSETS entries + tests
