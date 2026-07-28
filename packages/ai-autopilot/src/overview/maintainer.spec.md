`CodeOverviewMaintainer` — owns the overview's maintenance policy: holds the current `CodeOverview`, regenerates on demand, and refreshes only on *material* changes so the map does not churn on every commit.

## TLDR

- `get()` — current overview or `undefined` (never generated/loaded).
- `load()` — reads `CODE-OVERVIEW.md` from the configured `OverviewFs` (no-op without `fs` or file).
- `generate(reason?, event?)` — unconditional regenerate (the on-demand path) + persist + `generated` event.
- `handle(event)` — the loop path: run the detector; if immaterial emit `skip` and return `{ refreshed: false }`; if material emit `refresh`, regenerate with the previous overview seeded, persist, return `{ refreshed: true, reasons, overview }`.

## Decisions

- `regenerate` is a required injected function (constructor TypeErrors without it) — usually `agentOverview(agent)` — so the policy is tested offline with stubs.
- Detector defaults to `detectMaterialChange`; `fs` and `path` (default `OVERVIEW_FILE` = `CODE-OVERVIEW.md`) are optional so the maintainer also works purely in memory.
- The previous overview is always passed into `regenerate` (as `ctx.previous`) so the model revises rather than rewrites blind; material reasons are joined into `ctx.reason`.
- `onEvent` observers are isolated via `makeEmitter(..., 'overview')` — a throwing callback is logged and swallowed.

## Flows

- `handle(event): detect(event) → material? regenerate({reason, event, previous}) → persist via saveOverview → OverviewRefresh : skip`
- `generate(): regenerate({reason, previous?, event?}) → persist → emit generated`
- `load(): loadOverview(fs, path) → cache`
